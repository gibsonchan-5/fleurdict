/**
 * FleurDict - Selection Handler
 * Right-click triggered lookup
 */

import { MarkdownView } from 'obsidian';
import { FleurDictSettings } from '../types';
import { debugLog } from '../core/debug';
import { DictionaryEngine } from '../core/dictionary-engine';
import { DictPopup } from '../ui/dict-popup';
import { isPhrase } from '../utils/helpers';

/**
 * Selection handler - right-click triggered
 */
export class SelectionHandler {
  private plugin: any;
  private settings: FleurDictSettings;
  private dictEngine: DictionaryEngine;
  private dictPopup: DictPopup;

  constructor(plugin: any, settings: FleurDictSettings, dictEngine: DictionaryEngine) {
    this.plugin = plugin;
    this.settings = settings;
    this.dictEngine = dictEngine;
    this.dictPopup = new DictPopup(plugin, settings, dictEngine);
  }

  register(): void {
    // No automatic event listeners - all triggered via context menu
  }

  unregister(): void {
    this.dictPopup.close();
  }

  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
    // Keep a visible popup alive: settings are mutated in place, so the live
    // instance already sees the new values. Replacing it here orphaned the
    // on-screen panel (still in the DOM, no longer reachable by this handler),
    // and it used to fire on every saveSettings() — e.g. after dragging the
    // popup or clicking anything inside it.
    if (!this.dictPopup.isVisible()) {
      this.dictPopup = new DictPopup(this.plugin, settings, this.dictEngine);
    }
  }

  /**
   * Get current editor selection (CM6-compatible)
   */
  getSelection(): string | null {
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return null;
    const sel = activeView.editor.getSelection();
    return sel && sel.trim() ? sel.trim() : null;
  }

  /**
   * Lookup a word - show popup with dictionary results
   */
  async lookupWord(word?: string): Promise<void> {
    let queryWord = word;
    debugLog('FleurDict: lookupWord called with:', word);

    if (!queryWord) {
      queryWord = this.getSelection();
    }

    if (!queryWord) {
      debugLog('FleurDict: No word to lookup');
      return;
    }

    queryWord = queryWord.trim().toLowerCase();
    debugLog('FleurDict: Querying:', queryWord);

    if (!/[a-zA-Z]/.test(queryWord)) {
      debugLog('FleurDict: Not a valid word');
      return;
    }

    // Position: center of screen
    const posX = window.innerWidth / 2;
    const posY = window.innerHeight / 2;

    try {
      const results = await this.dictEngine.query(queryWord);
      debugLog('FleurDict: Query results:', results);

      if (results.length === 0 || results[0].entries.length === 0) {
        this.dictPopup.showError(queryWord, '未找到该单词的释义');
        return;
      }

      // Show popup with results directly (no intermediate empty state)
      this.dictPopup.show(queryWord, results, {
        x: posX,
        y: posY,
        isPhrase: isPhrase(queryWord),
        onAddToWordbook: () => {
          this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', queryWord);
        },
        onAIDetail: () => {
          // Close popup first to avoid overlap with AI modal
          this.dictPopup.close();
          // Small delay to ensure popup is hidden before modal opens
          setTimeout(() => {
            this.plugin.app.workspace.trigger('fleurdict:ai-detail', queryWord);
          }, 50);
        },
      });
      debugLog('FleurDict: Popup shown with results');
    } catch (error) {
      console.error('FleurDict: Lookup failed:', error);
      this.dictPopup.showError(queryWord, '查询失败，请稍后重试');
    }
  }

  isPopupVisible(): boolean {
    return this.dictPopup.isVisible();
  }

  closePopup(): void {
    this.dictPopup.close();
  }
}
