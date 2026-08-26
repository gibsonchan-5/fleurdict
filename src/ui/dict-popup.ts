/**
 * FleurDict - Dictionary Popup
 * Floating panel that shows dictionary results
 */

import { Plugin } from 'obsidian';
import { DictionaryEntry, DictionaryResult, FleurDictSettings } from '../types';
import { DictionaryEngine } from '../core/dictionary-engine';
import { escapeHtml } from '../utils/helpers';

/**
 * Popup callback options
 */
export interface DictPopupOptions {
  x: number;
  y: number;
  isPhrase: boolean;
  onAddToWordbook?: () => void;
  onAIDetail?: () => void;
  onClose?: () => void;
}

/**
 * Dictionary popup - floating panel
 */
export class DictPopup {
  private plugin: Plugin;
  private settings: FleurDictSettings;
  private dictEngine: DictionaryEngine;
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private visible: boolean = false;

  // Drag state
  private dragStartX = 0;
  private dragStartY = 0;
  private containerStartLeft = 0;
  private containerStartTop = 0;
  private isDragging = false;

  // Vertical resize state
  private resizeStartY = 0;
  private containerStartHeight = 0;
  private isResizing = false;

  constructor(plugin: Plugin, settings: FleurDictSettings, dictEngine: DictionaryEngine) {
    this.plugin = plugin;
    this.settings = settings;
    this.dictEngine = dictEngine;
  }

  /**
   * Save popup position and size to settings
   */
  private async savePopupRect(): Promise<void> {
    if (!this.container) return;
    const left = parseInt(this.container.style.left || '0', 10);
    const top = parseInt(this.container.style.top || '0', 10);
    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;
    this.settings.popupLeft = left;
    this.settings.popupTop = top;
    this.settings.popupWidth = width;
    this.settings.popupHeight = height;
    try {
      await (this.plugin as any).saveSettings?.();
    } catch {
      // Silently fail — not critical
    }
  }

  /**
   * Apply saved position and size
   */
  private applyPopupRect(): void {
    if (!this.container) return;
    const l = this.settings.popupLeft;
    const t = this.settings.popupTop;
    const h = this.settings.popupHeight;
    if (l != null && t != null) {
      this.container.style.left = `${l}px`;
      this.container.style.top = `${t}px`;
    }
    // Restore saved height if available
    if (h != null && h > 0) {
      this.container.style.height = `${h}px`;
    }
  }

  /**
   * Setup drag handlers on the header
   */
  private setupDrag(): void {
    if (!this.container) return;
    const header = this.container.querySelector('.fleurdict-header-top') as HTMLElement;
    if (!header) return;

    header.addClass('fleurdict-draggable-header');

    header.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking close button
      if ((e.target as HTMLElement).closest('.fleurdict-close-btn')) return;
      // Prevent text selection during drag, but not the default drag behavior
      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.containerStartLeft = parseInt(this.container!.style.left || '0', 10);
      this.containerStartTop = parseInt(this.container!.style.top || '0', 10);
      // Disable user select during drag for smoother following
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    });
  }

  /**
   * Global mouse handlers for drag
   */
  private attachGlobalDragHandlers(): void {
    const onDragMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.container) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.container.style.left = `${this.containerStartLeft + dx}px`;
      this.container.style.top = `${this.containerStartTop + dy}px`;
    };

    const onDragUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);
        // Restore user select
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        this.savePopupRect();
      }
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  }

  /**
   * Setup vertical resize handle at bottom
   */
  private setupVerticalResize(): void {
    if (!this.container) return;

    const resizeHandle = document.createElement('div');
    resizeHandle.addClass('fleurdict-resize-handle');
    this.container.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.resizeStartY = e.clientY;
      this.containerStartHeight = this.container!.offsetHeight;

      const onResizeMove = (moveEvent: MouseEvent) => {
        if (!this.isResizing || !this.container) return;
        const dy = moveEvent.clientY - this.resizeStartY;
        const newHeight = Math.max(300, this.containerStartHeight + dy);
        this.container.style.height = `${newHeight}px`;
      };

      const onResizeUp = () => {
        if (this.isResizing) {
          this.isResizing = false;
          document.removeEventListener('mousemove', onResizeMove);
          document.removeEventListener('mouseup', onResizeUp);
          this.savePopupRect();
        }
      };

      document.addEventListener('mousemove', onResizeMove);
      document.addEventListener('mouseup', onResizeUp);
    });
  }

  /**
   * Show the popup with dictionary results
   */
  show(word: string, results: DictionaryResult[], options: DictPopupOptions): void {
    // Always remove old DOM first to prevent duplicates
    this.close();
    this.createOverlay();
    this.createPopup(word, results, options);
    this.visible = true;
  }

  /**
   * Update popup content without recreating container (prevents flicker)
   */
  updateResults(word: string, results: DictionaryResult[], options: DictPopupOptions): void {
    if (!this.container || !this.visible) {
      // Container doesn't exist or not visible, fall back to show()
      this.show(word, results, options);
      return;
    }

    // Find the body container
    const body = this.container.querySelector('.fleurdict-popup-body') as HTMLElement;
    if (!body) {
      // Body container not found, fall back to show()
      this.show(word, results, options);
      return;
    }

    // Update header with phonetics
    const header = this.buildHeader(word, results);
    const oldHeader = this.container.querySelector('.fleurdict-popup-header');
    if (oldHeader) {
      oldHeader.replaceWith(header);
    }

    // Update body with definitions
    const newBody = this.buildBody(word, results);
    body.replaceWith(newBody);

    // Re-setup drag handlers (since header was recreated)
    this.setupDrag();
  }

  /**
   * Show error state
   */
  showError(word: string, message: string): void {
    this.close();
    this.createOverlay();
    this.createErrorPopup(word, message);
    this.visible = true;
  }

  /**
   * Check if popup is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Check if an element is inside the popup
   */
  containsElement(el: HTMLElement): boolean {
    if (!this.container) return false;
    return this.container.contains(el);
  }

  /**
   * Close the popup
   */
  close(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.visible = false;
  }

  /**
   * Create background overlay (transparent, for click-outside-to-close)
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.addClass('fleurdict-overlay');
    this.overlay.addEventListener('click', (e) => {
      // Only close if clicking the overlay itself, not its children
      if (e.target === this.overlay) {
        this.close();
      }
    });
    document.body.appendChild(this.overlay);
  }

  /**
   * Create the main popup container
   */
  private createPopup(word: string, results: DictionaryResult[], options: DictPopupOptions): void {
    this.container = document.createElement('div');
    this.container.addClass('fleurdict-popup');

    // Build content
    const content = document.createElement('div');
    content.addClass('fleurdict-popup-content');

    // Header
    const header = this.buildHeader(word, results);
    content.appendChild(header);

    // Body - meanings
    const body = this.buildBody(word, results);
    content.appendChild(body);

    // Footer - action buttons
    const footer = this.buildFooter(options);
    content.appendChild(footer);

    this.container.appendChild(content);

    // Position and add to DOM
    document.body.appendChild(this.container);

    // Apply saved position/size if available, otherwise use default positioning
    if (this.settings.popupLeft != null && this.settings.popupTop != null) {
      this.applyPopupRect();
    } else {
      this.positionPopup(options.x, options.y);
    }

    // Setup drag handlers
    this.setupDrag();
    this.attachGlobalDragHandlers();
    
    // Setup vertical resize handle
    this.setupVerticalResize();

    // Click outside to close
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Create error popup
   */
  private createErrorPopup(word: string, message: string): void {
    this.container = document.createElement('div');
    this.container.addClass('fleurdict-popup');

    const content = document.createElement('div');
    content.addClass('fleurdict-popup-content');

    content.innerHTML = `
      <div class="fleurdict-popup-header">
        <span class="fleurdict-word">${escapeHtml(word)}</span>
        <span class="fleurdict-error">未找到释义</span>
      </div>
      <div class="fleurdict-popup-body">
        <p class="fleurdict-error-message">${escapeHtml(message)}</p>
      </div>
    `;

    this.container.appendChild(content);
    document.body.appendChild(this.container);
    this.positionPopup(window.innerWidth / 2, window.innerHeight / 2);
  }

  /**
   * Build popup header (word on top, phonetics below)
   */
  private buildHeader(word: string, results: DictionaryResult[]): HTMLElement {
    const header = document.createElement('div');
    header.addClass('fleurdict-popup-header');

    // Top row: word + close button
    const topRow = document.createElement('div');
    topRow.addClass('fleurdict-header-top');

    const wordEl = document.createElement('span');
    wordEl.addClass('fleurdict-word');
    wordEl.textContent = word;
    topRow.appendChild(wordEl);

    const closeBtn = document.createElement('button');
    closeBtn.addClass('fleurdict-close-btn');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      this.close();
    });
    topRow.appendChild(closeBtn);

    header.appendChild(topRow);

    // Bottom: phonetics — each on its own line, aligned with word
    const firstEntry = results[0]?.entries[0];
    if (firstEntry && this.settings.showPhonetic && firstEntry.phonetics.length > 0) {
      header.addClass('has-phonetics');
      const phoneticsContainer = document.createElement('div');
      phoneticsContainer.addClass('fleurdict-phonetics-col');

      for (const phonetic of firstEntry.phonetics) {
        const phoneticItem = document.createElement('div');
        phoneticItem.addClass('fleurdict-phonetic-item');

        if (phonetic.text) {
          // Label: 英 or 美
          const label = document.createElement('span');
          label.addClass('fleurdict-phonetic-badge');
          label.textContent = phonetic.text.startsWith('英') ? '英' : '美';
          phoneticItem.appendChild(label);

          // IPA text
          const ipaText = phonetic.text.replace(/^[英美]\s*/, '');
          const ipa = document.createElement('span');
          ipa.addClass('fleurdict-phonetic-ipa');
          ipa.textContent = ipaText;
          phoneticItem.appendChild(ipa);

          if (this.settings.showAudioButton && phonetic.audio) {
            // Speaker icon
            const iconBtn = document.createElement('span');
            iconBtn.addClass('fleurdict-play-icon');
            iconBtn.setAttribute('role', 'button');
            iconBtn.setAttribute('aria-label', phonetic.text.startsWith('英') ? '英式发音' : '美式发音');
            iconBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
            iconBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.playAudio(word, phonetic.audio);
            });
            phoneticItem.appendChild(iconBtn);
          }
        }

        phoneticsContainer.appendChild(phoneticItem);
      }

      header.appendChild(phoneticsContainer);
    }

    return header;
  }

  /**
   * Build popup body (meanings and definitions)
   */
  private buildBody(word: string, results: DictionaryResult[]): HTMLElement {
    const body = document.createElement('div');
    body.addClass('fleurdict-popup-body');

    if (results.length === 0 || results[0].entries.length === 0) {
      body.innerHTML = '<p class="fleurdict-no-result">暂无释义</p>';
      return body;
    }

    // Process ALL entries from ALL results to show complete definitions
    let totalShown = 0;
    const maxPosSections = 6; // Show up to 6 part-of-speech sections

    for (const result of results) {
      if (totalShown >= maxPosSections) break;

      for (const entry of result.entries) {
        if (totalShown >= maxPosSections) break;

        for (const meaning of entry.meanings) {
          if (totalShown >= maxPosSections) break;

          // Part of speech section
          const posSection = document.createElement('div');
          posSection.addClass('fleurdict-pos-section');

          const posLabel = document.createElement('div');
          posLabel.addClass('fleurdict-pos-label');
          posLabel.textContent = this.translatePOS(meaning.partOfSpeech);
          posSection.appendChild(posLabel);

          // Definitions list
          // Use ol only when multiple definitions; use div (no number) when only one
          const defs = meaning.definitions.slice(0, 10);
          if (defs.length <= 1) {
            // Single definition — no numbering
            for (const def of defs) {
              const defItem = document.createElement('div');
              defItem.addClass('fleurdict-def-item');

              const defText = document.createElement('span');
              defText.addClass('fleurdict-def-text');
              defText.textContent = def.definition;
              defItem.appendChild(defText);

              if (this.settings.showExamples && def.example) {
                const exampleEl = document.createElement('div');
                exampleEl.addClass('fleurdict-example');
                exampleEl.textContent = def.example;
                defItem.appendChild(exampleEl);
              }

              posSection.appendChild(defItem);
            }
          } else {
            // Multiple definitions — numbered
            const defList = document.createElement('ol');
            defList.addClass('fleurdict-def-list');

            for (const def of defs) {
              const defItem = document.createElement('li');
              defItem.addClass('fleurdict-def-item');

              const defText = document.createElement('span');
              defText.addClass('fleurdict-def-text');
              defText.textContent = def.definition;
              defItem.appendChild(defText);

              if (this.settings.showExamples && def.example) {
                const exampleEl = document.createElement('div');
                exampleEl.addClass('fleurdict-example');
                exampleEl.textContent = def.example;
                defItem.appendChild(exampleEl);
              }

            defList.appendChild(defItem);
          }

          posSection.appendChild(defList);
        }

          // Synonyms
          if (meaning.synonyms.length > 0) {
            const synSection = document.createElement('div');
            synSection.addClass('fleurdict-synonyms');

            const synLabel = document.createElement('span');
            synLabel.addClass('fleurdict-syn-label');
            synLabel.textContent = '同义词：';
            synSection.appendChild(synLabel);

            const synWords = meaning.synonyms.slice(0, 8).join(', ');
            const synText = document.createElement('span');
            synText.addClass('fleurdict-syn-text');
            synText.textContent = synWords;
            synSection.appendChild(synText);

            posSection.appendChild(synSection);
          }

          body.appendChild(posSection);
          totalShown++;
        }
      }
    }

    return body;
  }

  /**
   * Build popup footer (action buttons)
   */
  private buildFooter(options: DictPopupOptions): HTMLElement {
    const footer = document.createElement('div');
    footer.addClass('fleurdict-popup-footer');

    // AI Detail button
    if (this.settings.showAIDetailButton) {
      const aiBtn = document.createElement('button');
      aiBtn.addClass('fleurdict-action-btn');
      aiBtn.addClass('fleurdict-ai-btn');
      aiBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M20 12a8 8 0 0 0-8-8v8h8z"></path></svg> AI 详解';
      aiBtn.addEventListener('click', () => {
        if (options.onAIDetail) {
          options.onAIDetail();
        }
      });
      footer.appendChild(aiBtn);
    }

    // Add to wordbook button
    if (this.settings.showAddToWordbookButton) {
      const addBtn = document.createElement('button');
      addBtn.addClass('fleurdict-action-btn');
      addBtn.addClass('fleurdict-add-btn');
      addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 加入生词本';
      addBtn.addEventListener('click', () => {
        if (options.onAddToWordbook) {
          options.onAddToWordbook();
        }
        // Show feedback
        addBtn.textContent = '✓ 已添加';
        addBtn.addClass('fleurdict-added');
        setTimeout(() => {
          addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 加入生词本';
          addBtn.removeClass('fleurdict-added');
        }, 2000);
      });
      footer.appendChild(addBtn);
    }

    return footer;
  }

  /**
   * Position the popup near the cursor
   */
  private positionPopup(x: number, y: number): void {
    if (!this.container) return;

    // Use the actual rendered width of the popup (CSS-controlled), not the settings value
    const popupWidth = this.container.offsetWidth;
    const popupHeight = this.container.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const margin = 16;

    let left: number;
    let top: number;

    if (this.settings.popupPosition === 'selection') {
      left = x - popupWidth / 2;
      top = y + 10;

      if (left < margin) left = margin;
      if (left + popupWidth > windowWidth - margin) {
        left = windowWidth - popupWidth - margin;
      }
      if (top + popupHeight > windowHeight - margin) {
        top = y - popupHeight - 10;
      }
    } else if (this.settings.popupPosition === 'right') {
      left = windowWidth - popupWidth - margin;
      top = margin;
    } else {
      left = (windowWidth - popupWidth) / 2;
      top = margin;
    }

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  /**
   * Play audio — prefer API URL, fallback to Speech Synthesis
   */
  private playAudio(word: string, audioUrl?: string | null): void {
    if (audioUrl && audioUrl.length > 0) {
      // Play the API-provided audio
      if (this.audio) {
        this.audio.pause();
      }
      this.audio = new Audio(audioUrl);
      this.audio.play().catch((e) => {
        console.warn('FleurDict: Audio playback failed:', e);
      });
    } else {
      // Fallback: use browser's Speech Synthesis API
      this.speak(word);
    }
  }

  /**
   * Speak a word using the browser's Speech Synthesis API
   */
  private speak(word: string): void {
    if (!('speechSynthesis' in window)) {
      console.warn('FleurDict: Speech Synthesis not supported');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Translate part of speech to Chinese
   */
  private translatePOS(pos: string): string {
    const posMap: Record<string, string> = {
      noun: 'n. 名词',
      verb: 'v. 动词',
      adjective: 'adj. 形容词',
      adverb: 'adv. 副词',
      pronoun: 'pron. 代词',
      preposition: 'prep. 介词',
      conjunction: 'conj. 连词',
      interjection: 'interj. 感叹词',
      determiner: 'det. 限定词',
      article: 'art. 冠词',
      exclamation: 'excl. 感叹词',
    };
    return posMap[pos] || pos;
  }
}
