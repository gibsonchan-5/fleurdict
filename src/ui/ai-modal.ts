/**
 * FleurDict - AI Modal
 * Modal for displaying AI translation and detailed explanations
 */

import { App, Modal, Plugin } from 'obsidian';
import { LLMService, ChatMessage } from '../core/llm-service';
import { FleurDictSettings } from '../types';

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
  // Drag: mouse-down point relative to modal's current top-left (in viewport px)
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  // Current translate offset applied to the modal (accumulated across drags)
  private translateX = 0;
  private translateY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;
  private resizeStartX = 0;
  private resizeStartY = 0;

  // Persisted geometry (defaults)
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

    // Load persisted geometry (or use defaults)
    const saved = this.loadGeometry();
    const w = saved.w || AIModal.DEFAULT_WIDTH;
    const h = saved.h || AIModal.DEFAULT_HEIGHT;
    const left = saved.left;
    const top = saved.top;

    // Modal styling — remove Obsidian's centered constraints
    modalEl.addClass('fleurdict-ai-modal');
    modalEl.style.maxWidth = 'none';
    modalEl.style.width = `${w}px`;
    modalEl.style.height = `${h}px`;

    // Force fixed positioning so drag math is consistent (viewport coordinates)
    modalEl.style.position = 'fixed';
    modalEl.style.margin = '0';

    // Restore saved position, or center on first open
    if (left !== undefined && top !== undefined) {
      this.translateX = left;
      this.translateY = top;
    } else {
      // Center in viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      this.translateX = Math.round((vw - w) / 2);
      this.translateY = Math.round((vh - h) / 2);
    }
    modalEl.style.left = '0';
    modalEl.style.top = '0';
    modalEl.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`;
    modalEl.style.willChange = 'transform';

    // Title bar (draggable handle)
    contentEl.empty();
    const titleBar = contentEl.createDiv('fleurdict-ai-title-bar');
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.marginBottom = '12px';
    titleBar.style.cursor = 'grab';
    titleBar.style.userSelect = 'none';

    const titleLabel = titleBar.createEl('span', { text: this.title });
    titleLabel.style.fontSize = '13px';
    titleLabel.style.fontWeight = '600';
    titleLabel.style.color = 'var(--text-muted)';
    titleLabel.style.letterSpacing = '0.02em';

    // Content area — fill remaining space
    this.contentEl = contentEl.createDiv('fleurdict-ai-content');
    this.contentEl.style.flex = '1';
    this.contentEl.style.minHeight = '100px';
    this.contentEl.style.overflow = 'auto';
    this.contentEl.style.padding = '16px';
    this.contentEl.style.backgroundColor = 'var(--background-secondary)';
    this.contentEl.style.borderRadius = '8px';
    this.contentEl.style.lineHeight = '1.6';
    this.contentEl.style.fontSize = '14px';
    this.contentEl.style.display = 'flex';
    this.contentEl.style.flexDirection = 'column';

    // Make the modal body a flex column
    modalEl.style.display = 'flex';
    modalEl.style.flexDirection = 'column';
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';
    contentEl.style.flex = '1';
    contentEl.style.overflow = 'hidden';

    // Resize handle (bottom-right corner)
    const resizeHandle = contentEl.createDiv('fleurdict-ai-resize-handle');
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.bottom = '0';
    resizeHandle.style.right = '0';
    resizeHandle.style.width = '18px';
    resizeHandle.style.height = '18px';
    resizeHandle.style.cursor = 'nwse-resize';
    resizeHandle.style.zIndex = '10';

    // SVG corner indicator
    resizeHandle.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 14V10H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14V6H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    resizeHandle.style.color = 'var(--text-faint)';
    resizeHandle.style.opacity = '0.4';
    resizeHandle.style.transition = 'opacity 0.15s';
    resizeHandle.addEventListener('mouseenter', () => { resizeHandle.style.opacity = '0.8'; });
    resizeHandle.addEventListener('mouseleave', () => { resizeHandle.style.opacity = '0.4'; });

    // Show original text if provided (direct child of contentEl, above render area)
    if (this.originalText) {
      const originalEl = this.contentEl.createDiv('fleurdict-ai-original-text');
      originalEl.style.cssText = `
        padding: 10px 14px;
        margin-bottom: 10px;
        background: var(--background-primary);
        border-left: 3px solid var(--interactive-accent, teal);
        border-radius: 6px;
        font-style: italic;
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.6;
        flex-shrink: 0;
      `;
      const label = originalEl.createSpan();
      label.textContent = '原文：';
      label.style.cssText = 'font-weight: 600; color: var(--text-secondary); font-style: normal;';
      const textSpan = originalEl.createSpan();
      textSpan.textContent = this.originalText;
    }

    // Dedicated render area for AI streaming output (innerHTML replaces safely here)
    this.renderAreaEl = this.contentEl.createDiv('fleurdict-ai-render-area');
    this.renderAreaEl.style.flex = '1';
    this.renderAreaEl.style.minHeight = '0';
    this.renderAreaEl.style.overflow = 'auto';

    // Loading indicator
    const loadingEl = this.renderAreaEl.createDiv('fleurdict-ai-loading');
    loadingEl.setText('AI 正在思考...');
    loadingEl.style.color = 'var(--text-muted)';
    loadingEl.style.fontStyle = 'italic';

    // Button container
    const buttonContainer = contentEl.createDiv('fleurdict-ai-buttons');
    buttonContainer.style.marginTop = '16px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.flexShrink = '0';

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

    // === Drag to move (title bar) ===
    titleBar.addEventListener('mousedown', (e) => {
      // Only left-click drag, and not on buttons
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;

      this.isDragging = true;
      // Record mouse position relative to modal's current transform origin
      this.dragOffsetX = e.clientX - this.translateX;
      this.dragOffsetY = e.clientY - this.translateY;
      modalEl.style.cursor = 'grabbing';
      titleBar.style.cursor = 'grabbing';
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
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
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });

    // Global mousemove / mouseup for drag & resize
    const onGlobalMouseMove = (e: MouseEvent) => {
      if (this.isDragging) {
        // Update translate offset directly (no layout thrash)
        this.translateX = e.clientX - this.dragOffsetX;
        this.translateY = e.clientY - this.dragOffsetY;

        // Clamp to viewport bounds (keep at least 100px visible)
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const modalW = modalEl.offsetWidth;
        const modalH = modalEl.offsetHeight;
        this.translateX = Math.max(-modalW + 100, Math.min(vw - 100, this.translateX));
        this.translateY = Math.max(0, Math.min(vh - 60, this.translateY));

        // Apply transform (GPU-composited, no reflow)
        modalEl.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`;
      }
      if (this.isResizing) {
        const newW = Math.max(420, this.resizeStartW + (e.clientX - this.resizeStartX));
        const newH = Math.max(300, this.resizeStartH + (e.clientY - this.resizeStartY));
        modalEl.style.width = `${newW}px`;
        modalEl.style.height = `${newH}px`;
      }
    };

    const onGlobalMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        modalEl.style.cursor = '';
        titleBar.style.cursor = 'grab';
        document.body.style.userSelect = '';
        // Persist final position (fire-and-forget is fine here)
        this.saveGeometry().catch(() => {});
      }
      if (this.isResizing) {
        this.isResizing = false;
        // Persist geometry
        this.saveGeometry().catch(() => {});
      }
    };

    document.addEventListener('mousemove', onGlobalMouseMove);
    document.addEventListener('mouseup', onGlobalMouseUp);

    // Start streaming
    await this.startStreaming(loadingEl, this.copyButton, this.saveButton);
  }

  /**
   * Load persisted geometry from plugin data
   */
  private loadGeometry(): { w?: number; h?: number; left?: number; top?: number } {
    if (!this.plugin) return {};
    try {
      const data = (this.plugin as any).settings?._aiModalGeometry;
      if (data && typeof data === 'object') return data;
    } catch { /* ignore */ }
    return {};
  }

  /**
   * Save current geometry to plugin data
   */
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
    // Clamp to reasonable bounds
    geom.w = Math.max(380, Math.min(geom.w, window.innerWidth - 40));
    geom.h = Math.max(260, Math.min(geom.h, window.innerHeight - 40));
    try {
      // Must merge with existing data.json, otherwise wordbook data would be overwritten.
      const data = (await this.plugin.loadData()) || {};
      if (!data.settings) data.settings = {};
      data.settings._aiModalGeometry = geom;
      await this.plugin.saveData(data);
    } catch { /* ignore save errors */ }
  }

  /**
   * Start streaming AI response
   */
  private async startStreaming(loadingEl: HTMLElement, copyButton?: HTMLButtonElement, saveButton?: HTMLButtonElement) {
    this.fullContent = '';

    this.streamAbortController = await this.llmService.sendMessageStream(
      this.messages,
      (chunk) => {
        // Remove loading indicator on first chunk
        if (loadingEl.parentElement) {
          loadingEl.remove();
        }

        if (chunk.content) {
          this.fullContent += chunk.content;
          this.renderContent(this.fullContent);
        }
      },
      () => {
        // Streaming complete
        const hasContent = !!this.fullContent;
        if (copyButton) copyButton.disabled = !hasContent;
        if (saveButton) saveButton.disabled = !hasContent;
      },
      (error) => {
        // Error occurred
        loadingEl.setText(`错误：${error.message}`);
        loadingEl.style.color = 'var(--text-error)';
        console.error('FleurDict: AI streaming error:', error);
      }
    );
  }

  /**
   * Render content with markdown support
   */
  private renderContent(content: string) {
    const lines = content.split('\n');
    const htmlLines: string[] = [];
    let inList = false;
    let inTable = false;
    let inTableHead = false;

    for (const line of lines) {
      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push('<hr style="margin:12px 0;border:none;border-top:1px solid var(--border-subtle)">');
        continue;
      }

      // H4: #### title (must match before ### to avoid partial match)
      const h4 = line.match(/^####\s+(.+)$/);
      if (h4) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h5 style="margin:12px 0 6px;font-size:14px;font-weight:600">${this.inlineMarkdown(h4[1])}</h5>`);
        continue;
      }

      // H3: ### title
      const h3 = line.match(/^###\s+(.+)$/);
      if (h3) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h4 style="margin:14px 0 6px;font-size:15px;font-weight:600">${this.inlineMarkdown(h3[1])}</h4>`);
        continue;
      }

      // H2: ## title
      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h3 style="margin:16px 0 8px;font-size:16px;font-weight:700">${this.inlineMarkdown(h2[1])}</h3>`);
        continue;
      }

      // H1: # title
      const h1 = line.match(/^#\s+(.+)$/);
      if (h1) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<h2 style="margin:18px 0 10px;font-size:18px;font-weight:700">${this.inlineMarkdown(h1[1])}</h2>`);
        continue;
      }

      // Unordered list item: - text or * text
      const li = line.match(/^[\-\*]\s+(.+)$/);
      if (li) {
        if (!inList) { htmlLines.push('<ul style="margin:4px 0;padding-left:20px;list-style:disc">'); inList = true; }
        htmlLines.push(`<li style="margin:2px 0">${this.inlineMarkdown(li[1])}</li>`);
        continue;
      }

      // Ordered list item: 1. text
      const oli = line.match(/^\d+\.\s+(.+)$/);
      if (oli) {
        htmlLines.push(`<p style="margin:4px 0;padding-left:24px;line-height:1.7">${this.inlineMarkdown(oli[1])}</p>`);
        continue;
      }

      // Blockquote: > text
      const bq = line.match(/^>\s*(.+)$/);
      if (bq) {
        htmlLines.push(`<div style="margin:8px 0;padding:8px 14px;border-left:3px solid var(--interactive-accent,teal);background:var(--background-secondary,rgba(0,0,0,0.03));border-radius:0 6px 6px 0;font-style:italic;color:var(--text-muted)">${this.inlineMarkdown(bq[1])}</div>`);
        continue;
      }

      // Markdown table: | cell | cell |
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Separator row: |---|---|---|
        if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
          // just skip separator rows, table is already open
          continue;
        }
        // Data row
        if (!inTable) {
          htmlLines.push('<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px">');
          inTable = true;
          inTableHead = true;
        }
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (inTableHead) {
          htmlLines.push('<thead><tr>' + cells.map(c => `<th style="border:1px solid var(--border-subtle,rgba(0,0,0,0.1));padding:6px 10px;text-align:left;font-weight:600;background:var(--background-secondary,rgba(0,0,0,0.04))">${this.inlineMarkdown(c)}</th>`).join('') + '</tr></thead><tbody>');
          inTableHead = false;
        } else {
          htmlLines.push('<tr>' + cells.map(c => `<td style="border:1px solid var(--border-subtle,rgba(0,0,0,0.1));padding:6px 10px">${this.inlineMarkdown(c)}</td>`).join('') + '</tr>');
        }
        continue;
      }

      // Close table if we were in one and hit a non-table line
      if (inTable) {
        htmlLines.push('</tbody></table>');
        inTable = false;
        inTableHead = false;
      }

      // Empty line
      if (line.trim() === '') {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push('<br>');
        continue;
      }

      // Regular paragraph
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<p style="margin:6px 0;line-height:1.7">${this.inlineMarkdown(line)}</p>`);
    }

    if (inList) { htmlLines.push('</ul>'); }
    if (inTable) { htmlLines.push('</tbody></table>'); }
    this.renderAreaEl.innerHTML = htmlLines.join('');
  }

  /**
   * Render inline markdown (bold, italic, code, links)
   */
  private inlineMarkdown(text: string): string {
    return text
      // **bold**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // *italic* (but not **bold**)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      // [text](url) links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--interactive-accent,teal)">$1</a>')
      // `inline code`
      .replace(/`([^`]+)`/g, '<code style="background:var(--background-modifier-cover);padding:2px 5px;border-radius:4px;font-size:13px">$1</code>')
      ;
  }

  /**
   * Copy content to clipboard
   */
  private async copyContent() {
    const text = this.contentEl.innerText;
    try {
      await navigator.clipboard.writeText(text);

      // Show feedback
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

  /**
   * Save AI response to a note in FleurDict folder
   */
  private async saveToNote() {
    const app = this.app;
    const vault = app.vault;

    // Build markdown content
    const lines: string[] = [];
    lines.push(`# ${this.title}`);
    lines.push('');
    if (this.originalText) {
      lines.push(`> ${this.originalText}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
    // Use the streamed content
    if (this.fullContent) {
      lines.push(this.fullContent);
    } else {
      // Fallback: use rendered text
      lines.push(this.renderAreaEl?.innerText || this.contentEl?.innerText || '');
    }
    lines.push('');

    const md = lines.join('\n');

    try {
      // Ensure FleurDict folder exists
      const folder = 'FleurDict';
      if (!vault.getAbstractFileByPath(folder)) {
        await vault.createFolder(folder);
      }

      // Generate filename: use first few words of original text or title
      const safeTitle = (this.originalText || this.title)
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50)
        .trim() || 'ai-response';

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
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
    // Abort streaming if in progress
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
