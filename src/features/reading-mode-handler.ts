/**
 * Reading Mode Handler
 * 当用户处于 Obsidian 原生预览模式（阅读模式）时：
 * - 右键菜单只显示 FleurDict 功能（查词、生词本、AI 翻译、AI 详解）
 * - 双击单词直接查词
 * - 不需要额外开关，自动检测预览模式
 */

import { MarkdownView, Menu } from 'obsidian';
import type { Plugin } from 'obsidian';
import type { WordbookManager } from '../core/wordbook-manager';
import type { WordEntry } from '../types';
import type { SelectionHandler } from './selection-handler';

export class ReadingModeHandler {
  private plugin: Plugin;
  private wordbookManager: WordbookManager;
  private selectionHandler: SelectionHandler;
  private dblclickHandler: ((evt: MouseEvent) => void) | null = null;
  private contextmenuHandler: ((evt: MouseEvent) => void) | null = null;

  constructor(
    plugin: Plugin,
    wordbookManager: WordbookManager,
    selectionHandler: SelectionHandler
  ) {
    this.plugin = plugin;
    this.wordbookManager = wordbookManager;
    this.selectionHandler = selectionHandler;
  }

  /**
   * 检查当前活动的 Markdown 视图是否在预览模式
   */
  private isPreviewMode(): boolean {
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    return activeView?.getMode() === 'preview';
  }

  register(): void {
    // 注册 Markdown 后处理器，在预览模式渲染时直接对 el 应用高亮
    this.plugin.registerMarkdownPostProcessor((el, ctx) => {
      // el 就是刚渲染完的 markdown-preview-view 容器
      // 直接对它应用高亮，不依赖 view.getMode()
      setTimeout(() => {
        this.highlightPreviewContainer(el);
      }, 30);
    });

    // 双击查词（仅预览模式下）
    this.dblclickHandler = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target?.closest('.markdown-preview-view, .markdown-reading-view')) return;

      if (!this.isPreviewMode()) return;

      const word = this.getWordAtClickPoint(evt);
      if (!word) return;

      evt.preventDefault();
      evt.stopPropagation();
      this.selectionHandler.lookupWord(word);
    };

    // 右键菜单拦截（仅预览模式下）
    this.contextmenuHandler = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target?.closest('.markdown-preview-view, .markdown-reading-view')) return;

      if (!this.isPreviewMode()) return;

      // 获取文本：优先选中文本，其次点击位置的单词
      let text: string | null = null;
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';

      if (selectedText.length > 0) {
        const anchorNode = selection?.anchorNode;
        if (anchorNode) {
          const anchorEl = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode as HTMLElement;
          if (anchorEl?.closest('.markdown-preview-view, .markdown-reading-view')) {
            text = selectedText;
          }
        }
      }

      if (!text) {
        text = this.getWordAtClickPoint(evt);
        if (!text) return;
      }

      evt.preventDefault();
      evt.stopPropagation();

      // 短文本（单词/短语 ≤ 3 词）：显示查词 + 生词本 + AI
      // 长文本（> 3 词）：只显示 AI 翻译和详解
      const isLongText = text.includes(' ') && text.split(/\s+/).length > 3;
      this.showReadingModeMenu(evt.clientX, evt.clientY, text, isLongText);
    };

    document.addEventListener('dblclick', this.dblclickHandler, true);
    document.addEventListener('contextmenu', this.contextmenuHandler, true);

    // 视图切换时刷新阅读模式高亮
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        setTimeout(() => this.refreshAllReadingViews(), 300);
      })
    );

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('layout-change', () => {
        setTimeout(() => this.refreshAllReadingViews(), 300);
      })
    );

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-open', () => {
        setTimeout(() => this.refreshAllReadingViews(), 500);
      })
    );
  }

  unregister(): void {
    if (this.dblclickHandler) {
      document.removeEventListener('dblclick', this.dblclickHandler, true);
    }
    if (this.contextmenuHandler) {
      document.removeEventListener('contextmenu', this.contextmenuHandler, true);
    }
  }

  /**
   * 用 caretRangeFromPoint 获取鼠标点击位置的单词
   */
  private getWordAtClickPoint(evt: MouseEvent): string | null {
    const range = document.caretRangeFromPoint(evt.clientX, evt.clientY);
    if (!range) return null;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent || '';
    const offset = range.startOffset;
    return this.extractWordAtOffset(text, offset);
  }

  private extractWordAtOffset(text: string, offset: number): string | null {
    const wordRegex = /[a-zA-Z'-]+/g;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) {
        return match[0];
      }
    }
    return null;
  }

  /**
   * 弹出 FleurDict 专属右键菜单
   */
  private showReadingModeMenu(x: number, y: number, text: string, isLongText: boolean): void {
    const menu = new Menu();

    if (!isLongText) {
      menu.addItem((item) => {
        item
          .setTitle('FleurDict 查词')
          .setIcon('book-open')
          .onClick(() => this.selectionHandler.lookupWord(text));
      });

      menu.addItem((item) => {
        item
          .setTitle('加入生词本')
          .setIcon('bookmark')
          .onClick(() => this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', text));
      });
    }

    menu.addItem((item) => {
      item
        .setTitle('AI 翻译')
        .setIcon('languages')
        .onClick(() => this.plugin.app.workspace.trigger('fleurdict:ai-translate', text));
    });

    menu.addItem((item) => {
      item
        .setTitle('AI 详解')
        .setIcon('sparkles')
        .onClick(() => this.plugin.app.workspace.trigger('fleurdict:ai-detail', text));
    });

    menu.showAtPosition({ x, y });
  }

  /**
   * 刷新所有阅读模式视图的高亮
   */
  refreshAllReadingViews(): void {
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view.getViewType() === 'markdown') {
        const md = view as MarkdownView;
        if (md.getMode() === 'preview') {
          this.highlightPreviewView(md);
        }
      }
    });
  }

  /**
   * 直接对 DOM 容器应用高亮（供 registerMarkdownPostProcessor 调用）
   */
  private highlightPreviewContainer(el: HTMLElement): void {
    if (!el) return;

    // 清理旧高亮
    el.querySelectorAll('.fleurdict-hl').forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span);
        parent.normalize();
      }
    });

    // 全局开关
    const settings = (this.plugin as any).settings;
    if (!settings?.highlightEnabled) return;

    const allWords = this.wordbookManager.getAllEntries();
    const wordsToHighlight = allWords.filter(
      (w) => w.proficiency !== undefined && w.proficiency < 3
    );
    if (wordsToHighlight.length === 0) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim()) textNodes.push(node as Text);
    }
    for (const textNode of textNodes) {
      this.highlightTextNode(textNode, wordsToHighlight);
    }
  }

  private highlightPreviewView(view: MarkdownView): void {
    const container = view.containerEl;
    if (!container) return;

    const previewEl = container.querySelector('.markdown-preview-view');
    if (!previewEl) return;

    this.highlightPreviewContainer(previewEl);
  }

  private highlightTextNode(textNode: Text, words: WordEntry[]): void {
    const text = textNode.textContent || '';
    if (!text.trim()) return;

    const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

    interface MatchRange {
      start: number;
      end: number;
      cls: string;
    }
    const matches: MatchRange[] = [];
    const covered = new Set<number>();

    for (const { word, proficiency } of sorted) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let m: RegExpExecArray | null;

      while ((m = regex.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;

        let overlap = false;
        for (let i = start; i < end; i++) {
          if (covered.has(i)) { overlap = true; break; }
        }
        if (overlap) continue;

        for (let i = start; i < end; i++) covered.add(i);

        const cls =
          proficiency === 0 ? 'fleurdict-highlight-red'
          : proficiency === 1 ? 'fleurdict-highlight-yellow'
          : 'fleurdict-highlight-green';

        matches.push({ start, end, cls });
      }
    }

    if (matches.length === 0) return;

    matches.sort((a, b) => a.start - b.start);

    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const { start, end, cls } of matches) {
      if (start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, start)));
      }
      const span = document.createElement('span');
      span.className = `fleurdict-hl ${cls}`;
      span.textContent = text.slice(start, end);
      fragment.appendChild(span);
      lastEnd = end;
    }

    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}
