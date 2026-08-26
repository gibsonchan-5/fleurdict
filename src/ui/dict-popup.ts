/**
 * FleurDict - Dictionary Popup
 * Floating panel that shows dictionary results
 */

import { Plugin, setIcon } from 'obsidian';
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
      this.container.style.setProperty('left', `${l}px`);
      this.container.style.setProperty('top', `${t}px`);
    }
    // Restore saved height if available
    if (h != null && h > 0) {
      this.container.style.setProperty('height', `${h}px`);
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
      document.body.classList.add('fleurdict-dragging');
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
      this.container.style.setProperty('left', `${this.containerStartLeft + dx}px`);
      this.container.style.setProperty('top', `${this.containerStartTop + dy}px`);
    };

    const onDragUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);
        // Restore user select
        document.body.classList.remove('fleurdict-dragging');
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

    const resizeHandle = this.container.createDiv('fleurdict-resize-handle');

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
        this.container.style.setProperty('height', `${newHeight}px`);
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
    this.overlay = document.body.createDiv('fleurdict-overlay');
    this.overlay.addEventListener('click', (e) => {
      // Only close if clicking the overlay itself, not its children
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }

  /**
   * Create the main popup container
   */
  private createPopup(word: string, results: DictionaryResult[], options: DictPopupOptions): void {
    this.container = document.body.createDiv('fleurdict-popup');

    // Build content
    const content = this.container.createDiv('fleurdict-popup-content');

    // Header
    const header = this.buildHeader(word, results);
    content.appendChild(header);

    // Body - meanings
    const body = this.buildBody(word, results);
    content.appendChild(body);

    // Footer - action buttons
    const footer = this.buildFooter(options);
    content.appendChild(footer);

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
    this.container = document.body.createDiv('fleurdict-popup');

    const content = this.container.createDiv('fleurdict-popup-content');

    const header = content.createDiv('fleurdict-popup-header');
    const wordEl = header.createSpan('fleurdict-word');
    wordEl.textContent = word;
    const errorLabel = header.createSpan('fleurdict-error');
    errorLabel.textContent = '未找到释义';

    const body = content.createDiv('fleurdict-popup-body');
    const errorMsg = body.createEl('p', 'fleurdict-error-message');
    errorMsg.textContent = message;

    this.positionPopup(window.innerWidth / 2, window.innerHeight / 2);
  }

  /**
   * Build popup header (word on top, phonetics below)
   */
  private buildHeader(word: string, results: DictionaryResult[]): HTMLElement {
    const header = document.body.createDiv('fleurdict-popup-header');

    // Top row: word + close button
    const topRow = header.createDiv('fleurdict-header-top');

    const wordEl = topRow.createSpan('fleurdict-word');
    wordEl.textContent = word;

    const closeBtn = topRow.createEl('button', 'fleurdict-close-btn');
    closeBtn.setText('×');
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Bottom: phonetics — each on its own line, aligned with word
    const firstEntry = results[0]?.entries[0];
    if (firstEntry && this.settings.showPhonetic && firstEntry.phonetics.length > 0) {
      header.addClass('has-phonetics');
      const phoneticsContainer = header.createDiv('fleurdict-phonetics-col');

      for (const phonetic of firstEntry.phonetics) {
        const phoneticItem = phoneticsContainer.createDiv('fleurdict-phonetic-item');

        if (phonetic.text) {
          // Label: 英 or 美
          const label = phoneticItem.createSpan('fleurdict-phonetic-badge');
          label.textContent = phonetic.text.startsWith('英') ? '英' : '美';

          // IPA text
          const ipaText = phonetic.text.replace(/^[英美]\s*/, '');
          const ipa = phoneticItem.createSpan('fleurdict-phonetic-ipa');
          ipa.textContent = ipaText;

          if (this.settings.showAudioButton && phonetic.audio) {
            // Speaker icon
            const iconBtn = phoneticItem.createSpan('fleurdict-play-icon');
            iconBtn.setAttribute('role', 'button');
            iconBtn.setAttribute('aria-label', phonetic.text.startsWith('英') ? '英式发音' : '美式发音');
            setIcon(iconBtn, 'volume-2');
            iconBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.playAudio(word, phonetic.audio);
            });
          }
        }
      }
    }

    return header;
  }

  /**
   * Build popup body (meanings and definitions)
   */
  private buildBody(word: string, results: DictionaryResult[]): HTMLElement {
    const body = document.body.createDiv('fleurdict-popup-body');

    if (results.length === 0 || results[0].entries.length === 0) {
      const noResult = body.createEl('p', 'fleurdict-no-result');
      noResult.setText('暂无释义');
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
          const posSection = body.createDiv('fleurdict-pos-section');

          const posLabel = posSection.createDiv('fleurdict-pos-label');
          posLabel.textContent = this.translatePOS(meaning.partOfSpeech);

          // Definitions list
          // Use ol only when multiple definitions; use div (no number) when only one
          const defs = meaning.definitions.slice(0, 10);
          if (defs.length <= 1) {
            // Single definition — no numbering
            for (const def of defs) {
              const defItem = posSection.createDiv('fleurdict-def-item');

              const defText = defItem.createSpan('fleurdict-def-text');
              defText.textContent = def.definition;

              if (this.settings.showExamples && def.example) {
                const exampleEl = defItem.createDiv('fleurdict-example');
                exampleEl.textContent = def.example;
              }
            }
          } else {
            // Multiple definitions — numbered
            const defList = posSection.createEl('ol', 'fleurdict-def-list');

            for (const def of defs) {
              const defItem = defList.createEl('li', 'fleurdict-def-item');

              const defText = defItem.createSpan('fleurdict-def-text');
              defText.textContent = def.definition;

              if (this.settings.showExamples && def.example) {
                const exampleEl = defItem.createDiv('fleurdict-example');
                exampleEl.textContent = def.example;
              }
            }
          }

          // Synonyms
          if (meaning.synonyms.length > 0) {
            const synSection = posSection.createDiv('fleurdict-synonyms');

            const synLabel = synSection.createSpan('fleurdict-syn-label');
            synLabel.textContent = '同义词：';

            const synWords = meaning.synonyms.slice(0, 8).join(', ');
            const synText = synSection.createSpan('fleurdict-syn-text');
            synText.textContent = synWords;
          }

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
    const footer = document.body.createDiv('fleurdict-popup-footer');

    // AI Detail button
    if (this.settings.showAIDetailButton) {
      const aiBtn = footer.createEl('button', 'fleurdict-action-btn fleurdict-ai-btn');
      aiBtn.setText('✨ AI 详解');
      aiBtn.addEventListener('click', () => {
        if (options.onAIDetail) {
          options.onAIDetail();
        }
      });
    }

    // Add to wordbook button
    if (this.settings.showAddToWordbookButton) {
      const addBtn = footer.createEl('button', 'fleurdict-action-btn fleurdict-add-btn');
      addBtn.setText('+ 加入生词本');
      addBtn.addEventListener('click', () => {
        if (options.onAddToWordbook) {
          options.onAddToWordbook();
        }
        // Show feedback
        addBtn.textContent = '✓ 已添加';
        addBtn.addClass('fleurdict-added');
        setTimeout(() => {
          addBtn.setText('+ 加入生词本');
          addBtn.removeClass('fleurdict-added');
        }, 2000);
      });
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

    this.container.style.setProperty('left', `${left}px`);
    this.container.style.setProperty('top', `${top}px`);
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
