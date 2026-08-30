/**
 * FleurDict - AI Modal
 * Modal for displaying AI translation and detailed explanations
 */

import { App, Modal, Plugin, Notice } from 'obsidian';
import { LLMService, ChatMessage } from '../core/llm-service';
import { FleurDictSettings } from '../types';
import { sanitizeHTML, appendSafeHTML } from '../utils/helpers';

/**
 * AI Modal - displays AI-generated content with streaming support.
 * Supports drag to move (via title bar) and resize (via bottom-right handle).
 * Position and size are persisted to plugin data and restored on next open.
 */
export class AIModal extends Modal {
  private settings: FleurDictSettings;
  private llmService: LLMService;
  private messages: ChatMessage[];
  private title: string;
  private originalText?: string;
  private plugin?: Plugin;

  private contentEl: HTMLElement;
  private renderAreaEl: HTMLElement;
  private streamAbortController: AbortController | null = null;
  private fullContent = '';
  private copyButton?: HTMLButtonElement;
  private saveButton?: HTMLButtonElement;

  // Drag & resize state
  private isDragging = false;
  private isResizing = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private translateX = 0;
  private translateY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;
  private resizeStartX = 0;
  private resizeStartY = 0;

  private static DEFAULT_WIDTH = 700;
  private static DEFAULT_HEIGHT = 520;

  constructor(
    app: App,
    settings: FleurDictSettings,
    llmService: LLMService,
    messages: ChatMessage[],
    title: string,
    originalText?: string,
    plugin?: Plugin
  ) {
    super(app);
    this.settings = settings;
    this.llmService = llmService;
    this.messages = messages;
    this.title = title;
    this.originalText = originalText;
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;

    const saved = this.loadGeometry();
    const w = saved.w || AIModal.DEFAULT_WIDTH;
    const h = saved.h || AIModal.DEFAULT_HEIGHT;
    const left = saved.left;
    const top = saved.top;

    // Modal styling
    modalEl.addClass('fleurdict-ai-modal');
    modalEl.style.setProperty('width', `${w}px`);
    modalEl.style.setProperty('height', `${h}px`);

    if (left !== undefined && top !== undefined) {
      this.translateX = left;
      this.translateY = top;
    } else {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      this.translateX = Math.round((vw - w) / 2);
      this.translateY = Math.round((vh - h) / 2);
    }
    modalEl.style.setProperty('transform', `translate(${this.translateX}px, ${this.translateY}px)`);

    // Title bar
    contentEl.empty();
    const titleBar = contentEl.createDiv('fleurdict-ai-title-bar');
    const titleLabel = titleBar.createEl('span', { text: this.title });
    titleLabel.addClass('fleurdict-ai-title-label');

    // Content area
    this.contentEl = contentEl.createDiv('fleurdict-ai-content');
    contentEl.addClass('fleurdict-ai-modal-content');

    // Resize handle
    const resizeHandle = contentEl.createDiv('fleurdict-ai-resize-handle');
    const resizeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    resizeIcon.setAttribute('width', '16');
    resizeIcon.setAttribute('height', '16');
    resizeIcon.setAttribute('viewBox', '0 0 16 16');
    resizeIcon.setAttribute('fill', 'none');
    const rp1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rp1.setAttribute('d', 'M10 14V10H14');
    rp1.setAttribute('stroke', 'currentColor');
    rp1.setAttribute('stroke-width', '1.5');
    rp1.setAttribute('stroke-linecap', 'round');
    const rp2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rp2.setAttribute('d', 'M12 14V6H14');
    rp2.setAttribute('stroke', 'currentColor');
    rp2.setAttribute('stroke-width', '1.5');
    rp2.setAttribute('stroke-linecap', 'round');
    resizeIcon.appendChild(rp1);
    resizeIcon.appendChild(rp2);
    resizeHandle.appendChild(resizeIcon);

    // Original text display (if provided)
    if (this.originalText) {
      const originalEl = this.contentEl.createDiv('fleurdict-ai-original-text');
      const label = originalEl.createSpan();
      label.textContent = '原文：';
      label.addClass('fleurdict-ai-original-label');
      const textSpan = originalEl.createSpan();
      textSpan.textContent = this.originalText;
    }

    // Dedicated render area for AI output
    this.renderAreaEl = this.contentEl.createDiv('fleurdict-ai-render-area');

    // Loading indicator
    const loadingEl = this.renderAreaEl.createDiv('fleurdict-ai-loading');
    loadingEl.setText('AI 正在思考...');

    // Button container
    const buttonContainer = contentEl.createDiv('fleurdict-ai-buttons');

    // Copy button
    this.copyButton = buttonContainer.createEl('button', { text: '复制' });
    this.copyButton.addClass('fleurdict-ai-btn');
    this.copyButton.disabled = true;
    this.copyButton.onclick = () => this.copyContent();

    // Save to note button
    this.saveButton = buttonContainer.createEl('button', { text: '写入笔记' });
    this.saveButton.addClass('fleurdict-ai-btn');
    this.saveButton.disabled = true;
    this.saveButton.onclick = () => this.saveToNote();

    // Close button
    const closeButton = buttonContainer.createEl('button', { text: '关闭' });
    closeButton.addClass('fleurdict-ai-btn');
    closeButton.onclick = () => this.close();

    // === Drag to move (title bar only) ===
    titleBar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;

      this.isDragging = true;
      this.dragOffsetX = e.clientX - this.translateX;
      this.dragOffsetY = e.clientY - this.translateY;
      modalEl.addClass('is-dragging');
      titleBar.addClass('is-dragging');
      document.body.addClass('fleurdict-dragging');
      e.preventDefault();
    });

    // === Resize (handle) ===
    resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isResizing = true;
      this.resizeStartW = modalEl.offsetWidth;
      this.resizeStartH = modalEl.offsetHeight;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      document.body.addClass('fleurdict-dragging');
      e.preventDefault();
      e.stopPropagation();
    });

    const onGlobalMouseMove = (e: MouseEvent) => {
      if (this.isDragging) {
        this.translateX = e.clientX - this.dragOffsetX;
        this.translateY = e.clientY - this.dragOffsetY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const modalW = modalEl.offsetWidth;
        const modalH = modalEl.offsetHeight;
        this.translateX = Math.max(-modalW + 100, Math.min(vw - 100, this.translateX));
        this.translateY = Math.max(0, Math.min(vh - 60, this.translateY));
        modalEl.style.setProperty('transform', `translate(${this.translateX}px, ${this.translateY}px)`);
      }
      if (this.isResizing) {
        const newW = Math.max(420, this.resizeStartW + (e.clientX - this.resizeStartX));
        const newH = Math.max(300, this.resizeStartH + (e.clientY - this.resizeStartY));
        modalEl.style.setProperty('width', `${newW}px`);
        modalEl.style.setProperty('height', `${newH}px`);
      }
    };

    const onGlobalMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        modalEl.removeClass('is-dragging');
        titleBar.removeClass('is-dragging');
        document.body.removeClass('fleurdict-dragging');
        this.saveGeometry().catch(() => { /* ignore */ });
      }
      if (this.isResizing) {
        this.isResizing = false;
        this.saveGeometry().catch(() => { /* ignore */ });
      }
    };

    document.addEventListener('mousemove', onGlobalMouseMove);
    document.addEventListener('mouseup', onGlobalMouseUp);

    await this.startStreaming(loadingEl, this.copyButton, this.saveButton);
  }

  private loadGeometry(): { w?: number; h?: number; left?: number; top?: number } {
    if (!this.plugin) return {};
    try {
      const data = (this.plugin as any).settings?._aiModalGeometry;
      if (data && typeof data === 'object') return data;
    } catch { /* ignore */ }
    return {};
  }

  private async saveGeometry() {
    if (!this.plugin) return;
    const modalEl = this.modalEl;
    if (!modalEl) return;
    const rect = modalEl.getBoundingClientRect();
    const geom = {
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
    };
    geom.w = Math.max(380, Math.min(geom.w, window.innerWidth - 40));
    geom.h = Math.max(260, Math.min(geom.h, window.innerHeight - 40));
    try {
      const data = (await this.plugin.loadData()) || {};
      if (!data.settings) data.settings = {};
      data.settings._aiModalGeometry = geom;
      await this.plugin.saveData(data);
    } catch { /* ignore */ }
  }

  private async startStreaming(loadingEl: HTMLElement, copyButton?: HTMLButtonElement, saveButton?: HTMLButtonElement) {
    this.fullContent = '';

    this.streamAbortController = await this.llmService.sendMessageStream(
      this.messages,
      (chunk) => {
        if (loadingEl.parentElement) {
          loadingEl.remove();
        }
        if (chunk.content) {
          this.fullContent += chunk.content;
          this.renderContent(this.fullContent);
        }
      },
      () => {
        const hasContent = !!this.fullContent;
        if (copyButton) copyButton.disabled = !hasContent;
        if (saveButton) saveButton.disabled = !hasContent;
      },
      (error) => {
        loadingEl.setText(`错误：${error.message}`);
        loadingEl.addClass('fleurdict-ai-error-text');
        console.error('FleurDict: AI streaming error:', error);
      }
    );
  }

  private renderContent(content: string) {
    const lines = content.split('\n');
    const htmlLines: string[] = [];
    let inList = false;
    let inTable = false;
    let inTableHead = false;

    for (const line of lines) {
      if (/^---+$/.test(line.trim())) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push('<hr class="fleurdict-ai-hr">');
        continue;
      }

      const h4 = line.match(/^####\s+(.+)$/);
      if (h4) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h5 class="fleurdict-ai-h4">${this.inlineMarkdown(h4[1])}</h5>`);
        continue;
      }

      const h3 = line.match(/^###\s+(.+)$/);
      if (h3) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h4 class="fleurdict-ai-h3">${this.inlineMarkdown(h3[1])}</h4>`);
        continue;
      }

      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h3 class="fleurdict-ai-h2">${this.inlineMarkdown(h2[1])}</h3>`);
        continue;
      }

      const h1 = line.match(/^#\s+(.+)$/);
      if (h1) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h2 class="fleurdict-ai-h1">${this.inlineMarkdown(h1[1])}</h2>`);
        continue;
      }

      const li = line.match(/^[\-\*]\s+(.+)$/);
      if (li) {
        if (!inList) { htmlLines.push('<ul class="fleurdict-ai-ul">'); inList = true; }
        htmlLines.push(`<li class="fleurdict-ai-li">${this.inlineMarkdown(li[1])}</li>`);
        continue;
      }

      const oli = line.match(/^\d+\.\s+(.+)$/);
      if (oli) {
        htmlLines.push(`<p class="fleurdict-ai-oli">${this.inlineMarkdown(oli[1])}</p>`);
        continue;
      }

      const bq = line.match(/^>\s*(.+)$/);
      if (bq) {
        htmlLines.push(`<div class="fleurdict-ai-bq">${this.inlineMarkdown(bq[1])}</div>`);
        continue;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
          continue;
        }
        if (!inTable) {
          htmlLines.push('<table class="fleurdict-ai-table">');
          inTable = true;
          inTableHead = true;
        }
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (inTableHead) {
          htmlLines.push('<thead><tr>' + cells.map(c => `<th class="fleurdict-ai-th">${this.inlineMarkdown(c)}</th>`).join('') + '</tr></thead><tbody>');
          inTableHead = false;
        } else {
          htmlLines.push('<tr>' + cells.map(c => `<td class="fleurdict-ai-td">${this.inlineMarkdown(c)}</td>`).join('') + '</tr>');
        }
        continue;
      }

      if (inTable) {
        htmlLines.push('</tbody></table>');
        inTable = false;
        inTableHead = false;
      }

      if (line.trim() === '') {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push('<br>');
        continue;
      }

      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<p class="fleurdict-ai-p">${this.inlineMarkdown(line)}</p>`);
    }

    if (inList) { htmlLines.push('</ul>'); }
    if (inTable) { htmlLines.push('</tbody></table>'); }

    const safeHtml = sanitizeHTML(htmlLines.join(''));
    this.renderAreaEl.empty();
    appendSafeHTML(this.renderAreaEl, safeHtml);
  }

  private inlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="fleurdict-ai-link">$1</a>')
      .replace(/`([^`]+)`/g, '<code class="fleurdict-ai-code">$1</code>')
      ;
  }

  private async copyContent() {
    // Copy only the render area text (AI response), not the original text or buttons
    const text = this.renderAreaEl.innerText;
    try {
      await navigator.clipboard.writeText(text);
      const copyButton = this.copyButton;
      if (copyButton) {
        const originalText = copyButton.textContent;
        copyButton.textContent = '已复制！';
        setTimeout(() => {
          if (copyButton) copyButton.textContent = originalText || '复制';
        }, 2000);
      }
    } catch (error) {
      console.error('FleurDict: Failed to copy:', error);
    }
  }

  private async saveToNote() {
    const app = this.app;
    const vault = app.vault;

    const lines: string[] = [];
    lines.push(`# ${this.title}`);
    lines.push('');
    if (this.originalText) {
      lines.push(`> ${this.originalText}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
    if (this.fullContent) {
      lines.push(this.fullContent);
    } else {
      lines.push(this.renderAreaEl?.innerText || '');
    }
    lines.push('');

    const md = lines.join('\n');

    try {
      const folder = 'FleurDict';
      if (!vault.getAbstractFileByPath(folder)) {
        await vault.createFolder(folder);
      }

      const safeTitle = (this.originalText || this.title)
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50)
        .trim() || 'ai-response';

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `${folder}/${safeTitle}-${dateStr}.md`;

      const file = await vault.create(fileName, md);
      const leaf = app.workspace.getLeaf('tab');
      await leaf.openFile(file);
      new Notice(`✓ 已写入笔记：${fileName}`);
    } catch (e: any) {
      new Notice(`写入笔记失败：${e.message}`);
    }
  }

  onClose() {
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Show AI translation modal
 */
export async function showAITranslation(
  app: App,
  settings: FleurDictSettings,
  llmService: LLMService,
  text: string,
  context?: string,
  plugin?: Plugin
) {
  const { buildAITranslatePrompt } = await import('../core/llm-service');
  const messages = buildAITranslatePrompt(text, context);

  const modal = new AIModal(app, settings, llmService, messages, 'AI 翻译', text, plugin);
  modal.open();
}

/**
 * Show AI detailed explanation modal
 */
export async function showAIDetail(
  app: App,
  settings: FleurDictSettings,
  llmService: LLMService,
  word: string,
  context?: string,
  plugin?: Plugin
) {
  const { buildAIDetailPrompt } = await import('../core/llm-service');
  const messages = buildAIDetailPrompt(word, context);

  const modal = new AIModal(app, settings, llmService, messages, 'AI 详解', word, plugin);
  modal.open();
}
