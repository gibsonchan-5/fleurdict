/**
 * FleurDict - AI Sidebar
 * Independent sidebar view for AI chat/translation/explanation
 */

import {
  ItemView,
  WorkspaceLeaf,
  Notice,
  MarkdownRenderer,
  Component,
} from 'obsidian';
import { LLMService, ChatMessage } from '../core/llm-service';
import { FleurDictSettings } from '../types';
import { sanitizeHTML } from '../utils/helpers';

export const AI_SIDEBAR_VIEW_TYPE = 'fleurdict-ai-sidebar';

interface ChatMessageUI {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

/**
 * AI Sidebar view - a persistent chat panel
 */
export class AISidebarView extends ItemView {
  private settings: FleurDictSettings;
  private llmService: LLMService;
  private chatHistory: ChatMessageUI[] = [];
  private currentAbortController: AbortController | null = null;
  private component: Component;

  // UI elements
  private chatContainer: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, settings: FleurDictSettings, llmService: LLMService) {
    super(leaf);
    this.settings = settings;
    this.llmService = llmService;
    this.component = new Component();
    this.component.load();
  }

  getViewType(): string {
    return AI_SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'FleurDict AI';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('fleurdict-ai-sidebar');

    this.buildUI(container as HTMLElement);
  }

  /**
   * Build the sidebar UI
   */
  private buildUI(container: HTMLElement) {
    // Header
    const header = container.createDiv('fleurdict-sidebar-header');
    const titleEl = header.createDiv('fleurdict-sidebar-title');
    titleEl.setText('FleurDict AI');

    const clearBtn = header.createEl('button', { cls: 'fleurdict-sidebar-clear' });
    clearBtn.setText('清空');
    clearBtn.title = '清空对话';
    clearBtn.addEventListener('click', () => this.clearChat());

    // Chat messages area
    this.chatContainer = container.createDiv('fleurdict-sidebar-chat');

    // Welcome message
    this.addWelcomeMessage();

    // Input area
    const inputArea = container.createDiv('fleurdict-sidebar-input-area');

    // Quick action buttons
    const quickActions = inputArea.createDiv('fleurdict-quick-actions');

    const translateBtn = quickActions.createEl('button', { cls: 'fleurdict-quick-btn' });
    translateBtn.setText('翻译选中');
    translateBtn.addEventListener('click', () => this.translateSelection());

    const explainBtn = quickActions.createEl('button', { cls: 'fleurdict-quick-btn' });
    explainBtn.setText('详解选中');
    explainBtn.addEventListener('click', () => this.explainSelection());

    // Textarea
    const textareaWrapper = inputArea.createDiv('fleurdict-textarea-wrapper');
    this.inputEl = textareaWrapper.createEl('textarea', {
      cls: 'fleurdict-sidebar-input',
      attr: { placeholder: '输入英文问题，或翻译/详解请求...', rows: '2' },
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    const buttonRow = inputArea.createDiv('fleurdict-button-row');
    this.sendBtn = buttonRow.createEl('button', { cls: 'fleurdict-send-btn mod-cta' });
    this.sendBtn.setText('发送');
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    const stopBtn = buttonRow.createEl('button', { cls: 'fleurdict-stop-btn' });
    stopBtn.setText('停止');
    stopBtn.addClass('is-hidden');
    stopBtn.addEventListener('click', () => this.stopStreaming());
  }

  /**
   * Add welcome message
   */
  private addWelcomeMessage() {
    if (!this.chatContainer) return;

    const welcome = this.chatContainer.createDiv('fleurdict-welcome');
    welcome.innerHTML = `
      <div class="fleurdict-welcome-icon">F</div>
      <div class="fleurdict-welcome-title">FleurDict AI</div>
      <div class="fleurdict-welcome-hint">
        你可以向我提问任何英语相关问题：<br/>
        • 翻译句子或段落<br/>
        • 详解单词的用法和搭配<br/>
        • 语法讲解<br/>
        • 近义辨析
      </div>
    `;

    if (!this.settings.aiApiKey) {
      const warning = welcome.createDiv('fleurdict-welcome-warning');
      warning.setText('请先在设置中配置 AI API Key');
    }
  }

  /**
   * Send message to AI
   */
  private async sendMessage(customMessage?: string) {
    const message = customMessage || this.inputEl?.value?.trim();
    if (!message) return;

    if (!this.settings.aiApiKey) {
      new Notice('请先在设置中配置 AI API Key');
      return;
    }

    // Remove welcome message
    const welcome = this.chatContainer?.querySelector('.fleurdict-welcome');
    if (welcome) welcome.remove();

    // Clear input
    if (!customMessage && this.inputEl) {
      this.inputEl.value = '';
    }

    // Add user message
    this.addMessage('user', message);

    // Build chat context
    const chatMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是一位专业的英语教师助手，请用简洁有条理的方式回答问题。中文讲解，英文示例。使用 Markdown 格式回答。',
      },
      ...this.chatHistory
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Add assistant placeholder
    const assistantEl = this.addMessage('assistant', '', true);

    // Toggle buttons
    this.setStreamingState(true);

    let fullContent = '';

    this.currentAbortController = await this.llmService.sendMessageStream(
      chatMessages,
      (chunk) => {
        if (chunk.content) {
          fullContent += chunk.content;
          this.updateMessage(assistantEl, fullContent);
        }
      },
      () => {
        // Streaming complete
        this.chatHistory.push({
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        });
        this.setStreamingState(false);
        this.scrollToBottom();
      },
      (error) => {
        this.updateMessage(assistantEl, `错误：${error.message}`);
        this.setStreamingState(false);
      }
    );
  }

  /**
   * Add a message to the chat UI
   */
  private addMessage(role: 'user' | 'assistant', content: string, streaming = false): HTMLElement {
    if (!this.chatContainer) return document.createElement('div');

    const msgEl = this.chatContainer.createDiv(`fleurdict-message fleurdict-message-${role}`);

    const avatar = msgEl.createDiv('fleurdict-message-avatar');
    avatar.setText(role === 'user' ? '我' : 'AI');

    const body = msgEl.createDiv('fleurdict-message-body');

    if (streaming) {
      const loading = body.createDiv('fleurdict-message-loading');
      loading.setText('AI 正在思考...');
    } else {
      this.renderMessageContent(body, content);
    }

    // Add to history
    if (!streaming) {
      this.chatHistory.push({
        role,
        content,
        timestamp: Date.now(),
      });
    }

    this.scrollToBottom();
    return body;
  }

  /**
   * Update a streaming message
   */
  private updateMessage(el: HTMLElement, content: string) {
    el.empty();
    this.renderMessageContent(el, content);
    this.scrollToBottom();
  }

  /**
   * Render message content with Markdown
   */
  private renderMessageContent(el: HTMLElement, content: string) {
    // Simple markdown rendering
    const html = this.simpleMarkdown(content);
    // Sanitize HTML to prevent XSS attacks
    el.innerHTML = sanitizeHTML(html);
  }

  /**
   * Simple markdown to HTML
   */
  private simpleMarkdown(text: string): string {
    let html = text;

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  /**
   * Translate current selection
   */
  private translateSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text) {
      new Notice('请先选中要翻译的文本');
      return;
    }

    // Get surrounding context from editor
    const context = this.getEditorContext();
    this.sendMessage(`请将以下内容翻译为中文：\n\n${text}${context ? `\n\n（上下文：${context}）` : ''}`);
  }

  /**
   * Explain current selection
   */
  private explainSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text) {
      new Notice('请先选中要详解的文本');
      return;
    }

    this.sendMessage(
      `请详细讲解这个${text.includes(' ') ? '短语' : '单词'}：${text}\n\n包括音标、释义、常见搭配、词源记忆和近义辨析。`
    );
  }

  /**
   * Get context from current editor
   */
  private getEditorContext(): string {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) return '';

      const view = this.app.workspace.getActiveViewOfType(
        require('obsidian').MarkdownView
      );
      if (!view?.editor) return '';

      const editor = view.editor;
      const cursor = editor.getCursor();
      const line = editor.getLine(cursor.line);

      // Return surrounding lines as context
      const startLine = Math.max(0, cursor.line - 1);
      const endLine = Math.min(editor.lineCount() - 1, cursor.line + 1);
      const context: string[] = [];

      for (let i = startLine; i <= endLine; i++) {
        if (i !== cursor.line) {
          context.push(editor.getLine(i));
        }
      }

      return context.join(' ');
    } catch {
      return '';
    }
  }

  /**
   * Clear chat history
   */
  private clearChat() {
    this.chatHistory = [];
    if (this.chatContainer) {
      this.chatContainer.empty();
      this.addWelcomeMessage();
    }
  }

  /**
   * Set streaming state (toggle buttons)
   */
  private setStreamingState(streaming: boolean) {
    if (this.sendBtn) {
      this.sendBtn.toggleClass('is-hidden', streaming);
    }
    const stopBtn = this.containerEl.querySelector('.fleurdict-stop-btn') as HTMLElement;
    if (stopBtn) {
      stopBtn.toggleClass('is-hidden', !streaming);
    }
    if (this.inputEl) {
      this.inputEl.disabled = streaming;
    }
  }

  /**
   * Stop streaming
   */
  private stopStreaming() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.setStreamingState(false);
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  /**
   * Public method: send a message from outside
   */
  public sendFromOutside(message: string) {
    this.sendMessage(message);
  }

  async onClose() {
    this.stopStreaming();
    this.component.unload();
  }
}
