/**
 * FleurDict - Wordbook View
 * Sidebar view for managing wordbook entries
 *
 * Context mode selector (reference FleurPilot):
 *   - active  → 当前笔记里的生词
 *   - all     → 全部笔记里的生词
 *   - custom  → 指定的文件夹 / 笔记里的生词
 *   - none    → 不限范围（等同 all）
 */

import { ItemView, WorkspaceLeaf, Menu, Modal, TFile, TFolder, Notice, setIcon } from 'obsidian';
import { WordEntry, FleurDictSettings } from '../types';
import { WordbookManager } from '../core/wordbook-manager';
import { DictionaryEngine } from '../core/dictionary-engine';
import { EditEntryModal } from './edit-entry-modal';

export const WORDBOOK_VIEW_TYPE = 'fleurdict-wordbook-view';

type ContextMode = 'active' | 'all' | 'custom';

// ---------------------------------------------------------------------------
// ContextSearchModal — 单选：一次只能选中一个文件夹或一篇笔记
// ---------------------------------------------------------------------------
class ContextSearchModal extends Modal {
  private initialPath: string;
  private onConfirm: (path: string) => void;
  private selectedPath: string;
  private currentFolder: TFolder | null;
  private searchInput!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private isSearchMode = false;

  constructor(app: any, initialPath: string, onConfirm: (path: string) => void) {
    super(app);
    this.initialPath = initialPath;
    this.onConfirm = onConfirm;
    this.selectedPath = initialPath;
    this.currentFolder = app.vault.getRoot();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fleurdict-ctx-search');

    // Title
    new Setting(contentEl)
      .setHeading()
      .setName('选择文件夹或笔记（单选）');

    // Search input
    const searchWrap = contentEl.createDiv('fleurdict-ctx-search-bar');
    this.searchInput = searchWrap.createEl('input', {
      type: 'text',
      cls: 'fleurdict-ctx-search-input',
      attr: { placeholder: '输入关键词搜索…' },
    });
    this.searchInput.addEventListener('input', () => this.renderList());

    // List
    this.listEl = contentEl.createDiv('fleurdict-ctx-search-list');
    this.renderList();

    // Footer buttons
    const footer = contentEl.createDiv('fleurdict-ctx-search-footer');

    const confirmBtn = footer.createEl('button', { text: '确定', cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm(this.selectedPath);
      this.close();
    });

    const cancelBtn = footer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  private renderList() {
    this.listEl.empty();
    const query = this.searchInput.value.toLowerCase().trim();
    this.isSearchMode = query.length > 0;

    if (this.isSearchMode) {
      this.renderSearchResults(query);
    } else {
      this.renderFolderContent();
    }
  }

  private renderSearchResults(query: string) {
    const allFiles = this.app.vault.getAllLoadedFiles();
    const folders = allFiles.filter((f: any) => 'children' in f || f.isRoot) as TFolder[];
    const files = allFiles.filter((f: any) => f.extension === 'md') as TFile[];

    const matchedFolders = folders.filter((f) => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));
    const matchedFiles = files.filter((f) => f.basename.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));

    if (matchedFolders.length === 0 && matchedFiles.length === 0) {
      this.listEl.createDiv({ text: '没有匹配结果', cls: 'fleurdict-ctx-search-empty' });
      return;
    }

    for (const folder of matchedFolders) {
      if (folder.isRoot) continue;
      this.renderItem(folder.name, folder.path, true, folder);
    }
    for (const file of matchedFiles) {
      this.renderItem(file.basename, file.path, false, file);
    }
  }

  private renderFolderContent() {
    const folder = this.currentFolder!;
    const children = folder.children || [];

    // Parent nav
    if (folder !== this.app.vault.getRoot()) {
      const parent = folder.parent;
      if (parent) {
        const upEl = this.listEl.createDiv('fleurdict-ctx-search-item fleurdict-ctx-search-parent');
        upEl.createEl('span', { text: `.. ${parent.name || '/'}`, cls: 'fleurdict-ctx-search-name' });
        upEl.addEventListener('click', () => {
          this.currentFolder = parent;
          this.searchInput.value = '';
          this.renderList();
        });
      }
    }

    // Separate folders and files
    const folders = children.filter((c: any) => 'children' in c || c.isRoot) as TFolder[];
    const files = children.filter((c: any) => c.extension === 'md') as TFile[];

    for (const f of folders.sort((a, b) => a.name.localeCompare(b.name))) {
      this.renderItem(f.name, f.path, true, f);
    }
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      this.renderItem(f.basename, f.path, false, f);
    }

    if (folders.length === 0 && files.length === 0 && folder !== this.app.vault.getRoot()) {
      this.listEl.createDiv({ text: '空文件夹', cls: 'fleurdict-ctx-search-empty' });
    }
  }

  private renderItem(displayName: string, fullPath: string, isFolder: boolean, item: any) {
    const el = this.listEl.createDiv('fleurdict-ctx-search-item');
    if (this.selectedPath === fullPath) {
      el.addClass('fleurdict-ctx-selected');
    }

    el.createEl('span', { text: displayName, cls: 'fleurdict-ctx-search-name' });
    el.createEl('span', { text: this.selectedPath === fullPath ? '✓' : '', cls: 'fleurdict-ctx-check' });

    // Single click: replace selection (radio behavior)
    el.addEventListener('click', () => {
      this.selectedPath = fullPath;
      this.renderList();
    });

    // Double click folder: navigate into it
    if (isFolder && !this.isSearchMode) {
      el.addEventListener('dblclick', () => {
        this.currentFolder = item;
        this.searchInput.value = '';
        this.renderList();
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// WordbookView
// ---------------------------------------------------------------------------
export class WordbookView extends ItemView {
  private settings: FleurDictSettings;
  private wordbookManager: WordbookManager;
  private dictEngine: DictionaryEngine;
  private contextMode: ContextMode = 'active';
  private contextPath: string = '';
  private contextButton!: HTMLButtonElement;
  // Cache for Youdao re-queried meanings: word -> { pos, def }[]
  private meaningCache = new Map<string, { pos: string; def: string }[]>();

  constructor(leaf: WorkspaceLeaf, settings: FleurDictSettings, wordbookManager: WordbookManager, dictEngine: DictionaryEngine) {
    super(leaf);
    this.settings = settings;
    this.wordbookManager = wordbookManager;
    this.dictEngine = dictEngine;

    // Always default to 'active' mode
    this.contextMode = 'active';
    if (settings.contextPath) {
      this.contextPath = settings.contextPath;
    }
    console.log('[FleurDict] WordbookView created, contextMode =', this.contextMode);
  }

  getViewType() {
    return WORDBOOK_VIEW_TYPE;
  }

  getDisplayText() {
    return 'FleurDict 生词本';
  }

  getIcon() {
    return 'book';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('fleurdict-wordbook-view');

    // Register active-leaf-change listener: refresh when user switches notes
    this.register(
      this.app.workspace.on('active-leaf-change', () => {
        if (this.contextMode === 'active') {
          this.updateContextButtonLabel();
          this.renderWordList(this.containerEl.children[1]);
        }
      })
    );

    this.renderView(container);
  }

  async onClose() {
    // Nothing to clean up
  }

  /**
   * Render the entire view
   */
  private renderView(container: Element) {
    container.empty();

    // Header with action buttons
    this.renderHeader(container);

    // Context mode selector + search
    this.renderControls(container);

    // Word list
    this.renderWordList(container);
  }

  /**
   * Render header with action buttons
   */
  private renderHeader(container: Element) {
    const headerEl = container.createEl('div', { cls: 'fleurdict-wordbook-header' });

    const actionsEl = headerEl.createEl('div', { cls: 'fleurdict-wordbook-actions' });

    const reviewBtn = document.createElement('button');
    reviewBtn.textContent = '开始复习';
    reviewBtn.addEventListener('click', () => this.startReview());
    actionsEl.appendChild(reviewBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = '导出';
    exportBtn.addEventListener('click', () => this.exportWordbook());
    actionsEl.appendChild(exportBtn);
  }

  /**
   * Render controls: context mode button only (search removed)
   */
  private renderControls(container: Element) {
    const controlsEl = container.createEl('div', { cls: 'fleurdict-wordbook-controls' });

    // Context mode button (left side)
    this.contextButton = controlsEl.createEl('button', {
      cls: 'fleurdict-context-btn',
    });
    this.updateContextButtonLabel();
    this.contextButton.addEventListener('click', (e) => this.showContextMenu(e));
  }

  /**
   * Update context button label based on current mode
   */
  private updateContextButtonLabel() {
    const btn = this.contextButton;
    if (!btn) return;

    let label: string;
    let title: string;

    switch (this.contextMode) {
      case 'active': {
        const activeFile = this.app.workspace.getActiveFile();
        label = activeFile ? activeFile.basename : '当前笔记';
        title = label;
        break;
      }
      case 'all':
        label = '全部笔记';
        title = '点击切换范围';
        break;
      case 'custom': {
        if (this.contextPath) {
          const fileName = this.contextPath.split('/').pop() || this.contextPath;
          label = fileName.replace('.md', '');
          title = label;
        } else {
          label = '选择范围';
          title = '点击切换范围';
        }
        break;
      }
    }

    btn.empty();
    const labelEl = btn.createSpan({ cls: 'fleurdict-context-btn-label' });
    labelEl.textContent = label;
    btn.setAttribute('title', title);
  }

  /**
   * Show context mode menu (参考 FleurPilot)
   */
  private showContextMenu(event: MouseEvent) {
    const menu = new Menu();

    // 1. 当前笔记
    menu.addItem((item) => {
      item.setTitle(`${this.contextMode === 'active' ? '✓ ' : ''}当前笔记`)
        .setIcon('file-text')
        .onClick(() => {
          this.contextMode = 'active';
          this.contextPath = '';
          this.saveContextMode();
          this.updateContextButtonLabel();
          this.refresh();
        });
    });

    // 2. 全部笔记
    menu.addItem((item) => {
      item.setTitle(`${this.contextMode === 'all' ? '✓ ' : ''}全部笔记`)
        .setIcon('book-open')
        .onClick(() => {
          this.contextMode = 'all';
          this.contextPath = '';
          this.saveContextMode();
          this.updateContextButtonLabel();
          this.refresh();
        });
    });

    menu.addSeparator();

    // 3. 其他文件夹或笔记（单选）
    menu.addItem((item) => {
      let label = '其他文件夹或笔记';
      if (this.contextMode === 'custom' && this.contextPath) {
        const fileName = this.contextPath.split('/').pop() || this.contextPath;
        label = `其他文件夹或笔记（${fileName.replace('.md', '')}）`;
      }
      item.setTitle(`${this.contextMode === 'custom' ? '✓ ' : ''}${label}`)
        .setIcon('folder-search')
        .onClick(() => {
          new ContextSearchModal(
            this.app,
            this.contextPath,
            (path) => {
              this.contextMode = 'custom';
              this.contextPath = path;
              this.saveContextMode();
              this.updateContextButtonLabel();
              this.refresh();
            }
          ).open();
        });
    });

    menu.showAtMouseEvent(event);
  }

  /**
   * Save context mode to plugin settings
   */
  private async saveContextMode() {
    // Find the plugin instance to save settings
    const plugin = (this.app as any).plugins?.getPlugin?.('fleurdict');
    if (plugin) {
      plugin.settings.contextMode = this.contextMode;
      plugin.settings.contextPath = this.contextPath;
      await plugin.saveSettings();
    }
  }

  /**
   * Filter entries based on context mode.
   */
  private filterByContext(entries: WordEntry[]): WordEntry[] {
    switch (this.contextMode) {
      case 'active': {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return entries;
        const activePath = activeFile.path;
        // Only match entries from the exact current note
        return entries.filter((e) => e.source === activePath);
      }
      case 'all':
        return entries;
      case 'custom': {
        if (!this.contextPath) return entries;
        return entries.filter((e) => {
          if (!e.source) return false;
          // this.contextPath could be a file or folder
          const item = this.app.vault.getAbstractFileByPath(this.contextPath);
          if (item instanceof TFile) {
            return e.source === this.contextPath;
          } else if (item instanceof TFolder) {
            return e.source.startsWith(this.contextPath + '/') || e.source === this.contextPath;
          }
          return false;
        });
      }
      default:
        return entries;
    }
  }

  /**
   * Render the word list
   */
  private async renderWordList(container: Element) {
    const existingList = container.querySelector('.fleurdict-wordbook-list');
    if (existingList) {
      existingList.remove();
    }

    const listEl = container.createEl('div', { cls: 'fleurdict-wordbook-list' });

    const data = this.wordbookManager.getData();
    let entries = [...data.words, ...data.phrases];
    console.log('[FleurDict] renderWordList: contextMode =', this.contextMode, ', total entries =', entries.length);
    console.log('[FleurDict] renderWordList: entries sources =', entries.map(e => e.source));

    // Filter by context mode
    entries = this.filterByContext(entries);
    console.log('[FleurDict] renderWordList: after filter, entries =', entries.length, entries.map(e => e.word));

    // Sort by creation date (newest first)
    entries.sort((a, b) => b.createdAt - a.createdAt);

    if (entries.length === 0) {
      listEl.createEl('div', {
        text: '生词本是空的',
        cls: 'fleurdict-wordbook-empty',
      });
      return;
    }

    // Phase 1: render all entries immediately with stored meanings
    const meaningEls: Map<string, Element> = new Map();
    for (const entry of entries) {
      try {
        const meaningEl = await this.renderEntry(listEl, entry);
        if (meaningEl) meaningEls.set(entry.word, meaningEl);
      } catch (e) {
        console.error(`[FleurDict] Failed to render entry "${entry.word}":`, e);
      }
    }

    // Phase 2: async refresh Youdao meanings (non-blocking)
    // Only replace DOM if we got actual structured data — never clear on API failure
    for (const entry of entries) {
      try {
        const structured = await this.getYoudaoMeaning(entry.word);
        if (structured.length > 0 && meaningEls.has(entry.word)) {
          const el = meaningEls.get(entry.word)!;
          el.empty();
          this.renderStructuredMeaning(el as HTMLElement, structured);
        }
        // If structured is empty (API failed), keep existing rendered content — do NOT touch the DOM
      } catch {
        // keep stored meaning
      }
    }
  }

  /**
   * Render a single word entry — word + POS + meaning only
   */
  private async renderEntry(container: Element, entry: WordEntry): Promise<Element | null> {
    const entryEl = container.createEl('div', { cls: 'fleurdict-wordbook-entry' });

    // Word header
    const headerEl = entryEl.createEl('div', { cls: 'fleurdict-wordbook-entry-header' });
    headerEl.createEl('span', {
      text: entry.word,
      cls: 'fleurdict-wordbook-word',
    });

    // Meaning — parse POS labels and render as styled tags
    let meaningEl: Element | null = null;
    const displayMeaning = entry.meaning || '';
    if (displayMeaning) {
      meaningEl = entryEl.createEl('div', { cls: 'fleurdict-wordbook-meaning' });
      this.renderMeaningWithPOS(meaningEl, displayMeaning);
    } else {
      meaningEl = entryEl.createEl('div', {
        text: '加载中…',
        cls: 'fleurdict-wordbook-meaning fleurdict-wordbook-loading',
      });
    }

    // Note (user-written note, not context which is just the selected word)
    if (entry.note) {
      entryEl.createEl('div', {
        text: entry.note,
        cls: 'fleurdict-wordbook-note',
      });
    }

    // Action buttons
    const actionsEl = entryEl.createEl('div', { cls: 'fleurdict-wordbook-entry-actions' });

    const editBtn = document.createElement('button');
    setIcon(editBtn, 'pencil');
    editBtn.setAttribute('aria-label', '编辑');
    editBtn.addEventListener('click', () => this.openEditModal(entry));
    actionsEl.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    setIcon(deleteBtn, 'trash');
    deleteBtn.setAttribute('aria-label', '删除');
    deleteBtn.addEventListener('click', async () => {
      await this.deleteEntry(entry);
    });
    actionsEl.appendChild(deleteBtn);

    const reviewBtn = document.createElement('button');
    setIcon(reviewBtn, 'sparkles');
    reviewBtn.setAttribute('aria-label', 'AI 详解');
    reviewBtn.addEventListener('click', () => this.aiDetail(entry));
    actionsEl.appendChild(reviewBtn);

    return meaningEl;
  }

  /**
   * Render meaning from structured POS data (from Youdao API).
   * Each {pos, def} pair becomes a <pos-tag> + definition block.
   */
  private renderStructuredMeaning(container: HTMLElement, items: { pos: string; def: string }[]) {
    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        container.appendChild(document.createTextNode('；'));
      }
      const { pos, def } = items[i];
      if (!def) continue;

      // Render POS tag if available (shorten to n./v./adj./adv. form)
      const shortPos = this.shortenPOS(pos);
      if (shortPos) {
        container.createEl('span', { text: shortPos, cls: 'fleurdict-pos-tag' });
        container.appendChild(document.createTextNode(' '));
      }
      container.appendChild(document.createTextNode(def));
    }

    // Add expand toggle if content is long
    this.maybeAddExpandToggle(container);
  }

  /**
   * Shorten full POS names to compact forms: noun→n., verb→v., adjective→adj., etc.
   */
  private shortenPOS(pos: string): string {
    const map: Record<string, string> = {
      'noun': 'n.', 'verb': 'v.', 'adjective': 'adj.', 'adverb': 'adv.',
      'pronoun': 'pron.', 'preposition': 'prep.', 'conjunction': 'conj.',
      'interjection': 'int.', 'determiner': 'det.', 'article': 'art.',
      'auxiliary': 'aux.', 'modal': 'modal',
    };
    return map[pos.toLowerCase()] || pos;
  }

  /**
   * Add a "展开/收起" toggle button AFTER the meaning container (as a sibling).
   * Only shows when content actually exceeds 3 lines (truncated by line-clamp).
   * Uses a hidden sibling clone to measure full height vs clamped height.
   */
  private maybeAddExpandToggle(meaningContainer: HTMLElement) {
    const parent = meaningContainer.parentElement;
    if (!parent) return;
    if (parent.querySelector('.fleurdict-expand-toggle')) return;

    // Measure full (unclamped) height using a hidden sibling clone
    const clone = meaningContainer.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: 'absolute',
      visibility: 'hidden',
      width: `${meaningContainer.offsetWidth}px`,
      overflow: 'visible',
      webkitLineClamp: 'unset',
      maxHeight: 'none',
      height: 'auto',
      display: 'block',
    });
    clone.classList.remove('fleurdict-expanded');
    parent.appendChild(clone);
    const fullHeight = clone.scrollHeight;
    clone.remove();

    // Estimate clamped height: 3 lines × lineHeight
    const lineHeight = parseFloat(getComputedStyle(meaningContainer).lineHeight) || 20;
    const clampedHeight = lineHeight * 3;

    if (fullHeight <= clampedHeight + 2) return; // content fits within 3 lines

    const toggleBtn = parent.createEl('span', { text: '展开', cls: 'fleurdict-expand-toggle' });
    meaningContainer.insertAdjacentElement('afterend', toggleBtn);

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = meaningContainer.classList.toggle('fleurdict-expanded');
      toggleBtn.textContent = isExpanded ? '收起' : '展开';
    });
  }

  /**
   * Render meaning text with POS (part-of-speech) labels styled as tags.
   * Used for stored meaning text (Phase 1) which may or may not have POS prefixes.
   */
  private renderMeaningWithPOS(container: HTMLElement, text: string) {
    // Common English POS labels (case-insensitive match)
    const posPattern = /\b(noun|verb|adj\.|adv\.|pron\.|prep\.|conj\.|interj\.|det\.|art\.|aux\.|modal|pl\.|singular|uncountable|countable|phrase|idiom|prefix|suffix|abbr\.|acronym)\b/gi;

    // Split by semicolons to handle multiple definitions
    const parts = text.split(/；|;/);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        container.appendChild(document.createTextNode('；'));
      }
      const part = parts[i].trim();
      if (!part) continue;

      // Find the first POS label in this part
      const match = posPattern.exec(part);
      posPattern.lastIndex = 0; // reset for next part

      if (match && match.index < 30) {
        // POS label is near the start — render as tag + rest
        const before = part.substring(0, match.index);
        const pos = part.substring(match.index, match.index + match[0].length);
        const after = part.substring(match.index + match[0].length).trim();

        if (before) {
          container.appendChild(document.createTextNode(before));
        }
        const tag = container.createEl('span', { text: pos, cls: 'fleurdict-pos-tag' });
        if (after) {
          container.appendChild(document.createTextNode(after));
        }
      } else {
        container.appendChild(document.createTextNode(part));
      }
    }

    // Add expand toggle if content is long
    this.maybeAddExpandToggle(container);
  }

  /**
   * Get fresh meaning from Youdao API (with in-session cache)
   * Returns structured { pos, def }[] so POS tags are reliably available
   * even when getAllDefinitions produces an empty POS prefix.
   */
  private async getYoudaoMeaning(word: string): Promise<{ pos: string; def: string }[]> {
    const empty: { pos: string; def: string }[] = [];
    if (this.meaningCache.has(word)) {
      return this.meaningCache.get(word) as any;
    }

    try {
      const results = await this.dictEngine.query(word);
      if (results.length > 0 && results[0].entries.length > 0) {
        const entry = results[0].entries[0];
        const structured: { pos: string; def: string }[] = [];
        for (const meaning of entry.meanings) {
          if (meaning.definitions.length === 0) continue;
          const defs = meaning.definitions.map((d) => d.definition).join('；');
          structured.push({
            pos: meaning.partOfSpeech || '',
            def: defs,
          });
        }
        if (structured.length > 0) {
          this.meaningCache.set(word, structured as any);
          return structured;
        }
      }
    } catch {
      // fallback to stored meaning
    }
    return empty;
  }

  /**
   * Open edit modal for a word entry
   */
  private openEditModal(entry: WordEntry) {
    const modal = new EditEntryModal(
      this.app,
      entry,
      this.wordbookManager,
      async (updated: WordEntry) => {
        const allEntries = this.wordbookManager.getAllEntries();
        const existing = allEntries.find(e => e.id === updated.id);
        if (existing) {
          Object.assign(existing, updated);
          await this.wordbookManager.save();
        }
        // Clear meaning cache for this word so it re-queries next time
        this.meaningCache.delete(updated.word);
        this.refresh();
      }
    );
    modal.open();
  }

  /**
   * Delete an entry
   */
  private async deleteEntry(entry: WordEntry) {
    await this.wordbookManager.removeEntry(entry.id);
    this.meaningCache.delete(entry.word);
    new Notice(`已删除: ${entry.word}`);

    const container = this.containerEl.children[1];
    this.renderView(container);
  }

  /**
   * Show AI detail for a word
   */
  private async aiDetail(entry: WordEntry) {
    this.app.workspace.trigger('fleurdict:ai-detail', entry.word, entry.context);
  }

  /**
   * Export wordbook to Markdown
   */
  private async exportWordbook() {
    const data = this.wordbookManager.getData();
    let entries = [...data.words, ...data.phrases];

    // Filter by current context mode (active / custom / all)
    entries = this.filterByContext(entries);

    if (entries.length === 0) {
      new Notice('当前范围没有生词可导出');
      return;
    }

    const words = entries.filter((e) => e.type === 'word');
    const phrases = entries.filter((e) => e.type === 'phrase');

    // Build scope label (shortened for filename)
    let scopeLabel: string;
    let shortLabel: string;
    switch (this.contextMode) {
      case 'active': {
        const af = this.app.workspace.getActiveFile();
        scopeLabel = af ? af.basename : '当前笔记';
        shortLabel = scopeLabel.length > 15 ? scopeLabel.slice(0, 15) + '…' : scopeLabel;
        break;
      }
      case 'custom': {
        const name = this.contextPath ? this.contextPath.split('/').pop()?.replace('.md', '') || '自定义' : '自定义';
        scopeLabel = name;
        shortLabel = name.length > 15 ? name.slice(0, 15) + '…' : name;
        break;
      }
      default:
        scopeLabel = '全部';
        shortLabel = '全部';
    }

    let md = `> 导出时间：${new Date().toLocaleDateString('zh-CN')} | 共 ${words.length} 个单词 / ${phrases.length} 个短语\n\n`;

    if (words.length > 0) {
      md += `## 单词\n\n`;
      md += `| 单词 | 音标 | 释义 |\n`;
      md += `| --- | --- | --- |\n`;
      for (const w of words) {
        md += `| ${w.word} | ${w.phonetic || '-'} | ${w.meaning || '-'} |\n`;
      }
      md += `\n`;
    }

    if (phrases.length > 0) {
      md += `## 短语\n\n`;
      md += `| 短语 | 释义 |\n`;
      md += `| --- | --- |\n`;
      for (const p of phrases) {
        md += `| ${p.word} | ${p.meaning || '-'} |\n`;
      }
      md += `\n`;
    }

    try {
      // Ensure FleurDict folder exists
      const folder = 'FleurDict';
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const fileName = `${folder}/生词本-${shortLabel}-${dateStr}.md`;

      const file = await this.app.vault.create(fileName, md);
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file);
      new Notice(`✓ 已导出到 ${fileName}`);
    } catch (e: any) {
      new Notice(` 导出失败：${e.message}`);
    }
  }

  /**
   * Start flashcard review
   */
  private startReview() {
    const data = this.wordbookManager.getData();
    const entries = [...data.words, ...data.phrases];

    if (entries.length === 0) {
      new Notice('生词本是空的，无法开始复习');
      return;
    }

    this.app.workspace.trigger('fleurdict:start-flashcard');
  }

  /**
   * Refresh the view
   */
  refresh() {
    const container = this.containerEl.children[1];
    this.renderView(container);
  }
}
