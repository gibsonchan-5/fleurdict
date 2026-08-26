/**
 * FleurDict - Selection Handler
 * Right-click triggered lookup
 */

import { MarkdownView } from 'obsidian';
import { FleurDictSettings } from '../types';
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
    this.dictPopup = new DictPopup(this.plugin, settings, this.dictEngine);
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
    console.log('FleurDict: lookupWord called with:', word);

    if (!queryWord) {
      queryWord = this.getSelection();
    }

    if (!queryWord) {
      console.log('FleurDict: No word to lookup');
      return;
    }

    queryWord = queryWord.trim().toLowerCase();
    console.log('FleurDict: Querying:', queryWord);

    if (!/[a-zA-Z]/.test(queryWord)) {
      console.log('FleurDict: Not a valid word');
      return;
    }

    // Position: center of screen
    const posX = window.innerWidth / 2;
    const posY = window.innerHeight / 2;

    try {
      const results = await this.dictEngine.query(queryWord);
      console.log('FleurDict: Query results:', results);

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
          this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', queryWord!);
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
      console.log('FleurDict: Popup shown with results');
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
