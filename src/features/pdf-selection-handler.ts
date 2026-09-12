/**
 * FleurDict - PDF Selection Handler
 * Double-click word lookup + right-click menu inside Obsidian's PDF viewer (pdf.js textLayer).
 *
 * The PDF textLayer produces standard DOM selections, so we reuse the same
 * downstream pipeline as Markdown: DictionaryEngine -> DictPopup -> AI / wordbook.
 *
 * Note: Obsidian's PDF viewer clears the DOM selection when focus shifts to
 * the popup layer. We keep a saved Range and restore it via a selectionchange
 * guard while the popup is open, so the word stays highlighted.
 */

import { Menu } from 'obsidian';
import { FleurDictSettings } from '../types';
import { DictionaryEngine } from '../core/dictionary-engine';
import { DictPopup } from '../ui/dict-popup';
import { isPhrase } from '../utils/helpers';

export class PdfSelectionHandler {
  private plugin: any;
  private settings: FleurDictSettings;
  private dictEngine: DictionaryEngine;
  private dictPopup: DictPopup;
  private lookupInFlight = false;

  // Selection guard: keeps the highlighted word visible while popup is open
  private savedRange: Range | null = null;
  private guardActive = false;
  private guardListener: (() => void) | null = null;

  constructor(plugin: any, settings: FleurDictSettings, dictEngine: DictionaryEngine) {
    this.plugin = plugin;
    this.settings = settings;
    this.dictEngine = dictEngine;
    this.dictPopup = new DictPopup(plugin, settings, dictEngine);
  }

  register(): void {
    // Double-click inside a PDF textLayer triggers word lookup
    this.plugin.registerDomEvent(document, 'dblclick', (evt: MouseEvent) => {
      this.handleDblClick(evt);
    }, true);

    // Right-click on selected PDF text opens the FleurDict menu
    this.plugin.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
      this.handleContextMenu(evt);
    }, true);
  }

  unregister(): void {
    this.stopSelectionGuard();
    this.dictPopup.close();
  }

  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
    // Keep a visible popup alive. Settings are mutated in place, so the live
    // instance already observes the new values; recreating it here meant that
    // ANY saveSettings() (e.g. the geometry write at the end of a drag, which
    // saveSettings cascades back through every handler) closed the panel under
    // the user's cursor.
    if (!this.dictPopup.isVisible()) {
      this.dictPopup = new DictPopup(this.plugin, settings, this.dictEngine);
    }
  }

  isPopupVisible(): boolean {
    return this.dictPopup.isVisible();
  }

  closePopup(): void {
    this.dictPopup.close();
  }

  private handleDblClick(evt: MouseEvent): void {
    if (!this.settings.pdfLookupEnabled) return;

    const target = evt.target as HTMLElement | null;
    if (!target) return;

    // Ignore double-clicks inside our own popup
    if (target.closest('.fleurdict-popup')) return;

    // Only react to pdf.js text layers (PDF view + pdf-embed blocks)
    const textLayer = target.closest('.textLayer');
    if (!textLayer) return;

    const selection = window.getSelection();
    const raw = selection?.toString() || '';
    const word = this.normalizePdfSelection(raw);

    if (!word) return;

    // Save the selection so we can restore it if the PDF viewer clears it
    this.savedRange = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;

    this.lookupWord(word, selection);
  }

  private handleContextMenu(evt: MouseEvent): void {
    if (!this.settings.pdfLookupEnabled) return;

    const target = evt.target as HTMLElement | null;
    if (!target) return;

    // Ignore right-clicks inside our own popup
    if (target.closest('.fleurdict-popup')) return;

    // Only react to pdf.js text layers
    const textLayer = target.closest('.textLayer');
    if (!textLayer) return;

    const selection = window.getSelection();
    const raw = selection?.toString() || '';

    // Same cleanup as the Markdown context menu
    const normalized = this.normalizePdfSelection(raw);
    if (!normalized) return; // No English selection — leave Obsidian's native menu alone

    // Suppress the default PDF menu and show ours
    evt.preventDefault();
    evt.stopPropagation();

    // Word/phrase for lookup & wordbook, full selection for AI features
    const match = normalized.match(/[a-zA-Z][a-zA-Z'\-\s,;:!?]*[a-zA-Z']?/);
    const cleanWord = (match ? match[0] : normalized).trim();
    const fullSelection = raw.trim();

    // Keep the selection highlight alive while the menu is open
    this.savedRange = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;

    const menu = new Menu();
    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('FleurDict 查词')
        .setIcon('book-open')
        .onClick(() => this.lookupWord(cleanWord, selection));
    });

    menu.addItem((item) => {
      item
        .setTitle('加入生词本')
        .setIcon('bookmark')
        .onClick(() => {
          this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', cleanWord);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('AI 翻译')
        .setIcon('languages')
        .onClick(() => {
          this.plugin.app.workspace.trigger('fleurdict:ai-translate', fullSelection);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('AI 详解')
        .setIcon('sparkles')
        .onClick(() => {
          this.plugin.app.workspace.trigger('fleurdict:ai-detail', fullSelection);
        });
    });

    menu.addSeparator();
    menu.showAtMouseEvent(evt);
  }

  /**
   * Clean text extracted from a pdf.js textLayer:
   * - soft hyphens, hyphenated line breaks, ligatures
   * - unicode dashes, collapsed whitespace, leading/trailing punctuation
   */
  private normalizePdfSelection(raw: string): string | null {
    if (!raw) return null;

    let text = raw
      .replace(/\u00AD/g, '')                            // soft hyphen
      .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')      // hyphenated line break: exam-\nple -> example
      .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-') // unicode dashes -> ASCII hyphen
      .replace(/\uFB00/g, 'ff')
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl')
      .replace(/\uFB03/g, 'ffi')
      .replace(/\uFB04/g, 'ffl')
      .replace(/\s+/g, ' ')
      .trim();

    // Strip leading/trailing punctuation picked up from the textLayer span
    text = text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}']+$/u, '');

    if (!text || !/[a-zA-Z]/.test(text)) return null;

    // Defensive: a stray multi-line selection shouldn't flood the dictionary
    const tokens = text.split(' ');
    if (tokens.length > 8) {
      text = tokens.slice(0, 8).join(' ');
    }

    return text;
  }

  /**
   * Query the dictionary and show the popup near the selection.
   * Same pipeline as SelectionHandler.lookupWord.
   */
  private async lookupWord(queryWord: string, selection: Selection | null): Promise<void> {
    if (this.lookupInFlight) return;
    this.lookupInFlight = true;

    const word = queryWord.trim().toLowerCase();

    try {
      // Position near the selected word (viewport coords from the DOM selection)
      const rect = selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
      const posX = rect && rect.width > 0 ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const posY = rect && rect.height > 0 ? rect.bottom : window.innerHeight / 2;

      const results = await this.dictEngine.query(word);

      if (results.length === 0 || results[0].entries.length === 0) {
        this.dictPopup.showError(word, '未找到该单词的释义');
        return;
      }

      this.dictPopup.show(word, results, {
        x: posX,
        y: posY,
        isPhrase: isPhrase(word),
        onAddToWordbook: () => {
          this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', word);
        },
        onAIDetail: () => {
          // Close popup first to avoid overlap with AI modal
          this.dictPopup.close();
          this.stopSelectionGuard();
          setTimeout(() => {
            this.plugin.app.workspace.trigger('fleurdict:ai-detail', word);
          }, 50);
        },
      });

      // Keep the highlighted word visible while the popup is open
      this.startSelectionGuard();
      this.restoreSavedSelection();
    } catch (error) {
      console.error('FleurDict PDF: Lookup failed:', error);
      this.dictPopup.showError(word, '查询失败，请稍后重试');
    } finally {
      this.lookupInFlight = false;
    }
  }

  /**
   * While the popup is open, watch for the PDF viewer collapsing the DOM
   * selection and restore the saved range immediately.
   * Self-stops once the popup is closed.
   */
  private startSelectionGuard(): void {
    if (!this.savedRange) return;
    if (this.guardActive) return;

    this.guardActive = true;
    this.guardListener = () => {
      // Popup gone? Stop guarding and release the saved range.
      if (!this.dictPopup.isVisible()) {
        this.stopSelectionGuard();
        return;
      }
      const sel = window.getSelection();
      if (sel && sel.toString().length === 0 && this.savedRange) {
        this.restoreSavedSelection();
      }
    };
    document.addEventListener('selectionchange', this.guardListener);
  }

  private stopSelectionGuard(): void {
    if (this.guardListener) {
      document.removeEventListener('selectionchange', this.guardListener);
      this.guardListener = null;
    }
    this.guardActive = false;
    this.savedRange = null;
  }

  private restoreSavedSelection(): void {
    if (!this.savedRange) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    } catch (e) {
      // Range may be detached after a pdf.js re-render — silently ignore
      console.warn('FleurDict PDF: Could not restore selection', e);
    }
  }
}
