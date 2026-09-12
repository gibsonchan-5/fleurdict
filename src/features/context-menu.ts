/**
 * FleurDict - Context Menu
 * Registers right-click menu items
 */

import { Plugin, Menu, MenuItem } from 'obsidian';
import { FleurDictSettings } from '../types';
import { SelectionHandler } from './selection-handler';
import { debugLog } from '../core/debug';

/**
 * Context menu manager
 */
export class ContextMenuManager {
  private plugin: Plugin;
  private settings: FleurDictSettings;
  private selectionHandler: SelectionHandler;

  constructor(
    plugin: Plugin,
    settings: FleurDictSettings,
    selectionHandler: SelectionHandler
  ) {
    this.plugin = plugin;
    this.settings = settings;
    this.selectionHandler = selectionHandler;
  }

  /**
   * Register context menu
   */
  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
        this.buildMenu(menu, editor, view);
      })
    );
  }

  /**
   * Update settings
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  /**
   * Build the context menu
   */
  private buildMenu(menu: Menu, editor: any): void {
    let selectedText = editor.getSelection().trim();
    debugLog('FleurDict: Context menu opened, selected text:', selectedText);

    if (!selectedText) {
      debugLog('FleurDict: No valid selection, skipping menu');
      return;
    }

    // Clean up: remove markdown syntax (headers, bold, links, etc.)
    const fullSelection = selectedText; // preserve user's original selection for AI

    selectedText = selectedText
      .replace(/^#+\s*/gm, '')   // remove headers
      .replace(/\*\*/g, '')      // remove bold
      .replace(/\*/g, '')        // remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links
      .replace(/`/g, '')         // remove inline code
      .trim();

    // Extract the actual English word/phrase (remove non-English parts)
    // Only used for lookup / wordbook — AI features use fullSelection instead
    const match = selectedText.match(/[a-zA-Z][a-zA-Z'\-\s,;:!?]*[a-zA-Z']?/);
    const cleanWord = match ? match[0].trim() : selectedText;

    // Allow the menu to appear as long as there's at least one English letter
    // (previously required the ENTIRE text to be English-only, which blocked sentences with punctuation)
    const hasEnglish = /[a-zA-Z]/.test(fullSelection);
    if (!hasEnglish) {
      debugLog('FleurDict: No English text found, skipping menu');
      return;
    }

    debugLog('FleurDict: Adding menu items for:', cleanWord, '| full selection:', fullSelection);
    menu.addSeparator();

    // Lookup word — uses extracted single word/phrase
    menu.addItem((item: MenuItem) => {
      item
        .setTitle(`FleurDict 查词`)
        .setIcon('book-open')
        .onClick(() => {
          debugLog('FleurDict: Lookup clicked for:', cleanWord);
          this.selectionHandler.lookupWord(cleanWord);
        });
    });

    // Add to wordbook — uses extracted single word/phrase
    menu.addItem((item: MenuItem) => {
      item
        .setTitle('加入生词本')
        .setIcon('bookmark')
        .onClick(() => {
          this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', cleanWord);
        });
    });

    // AI Translate — uses the user's FULL selection, not just the first word
    menu.addItem((item: MenuItem) => {
      item
        .setTitle('AI 翻译')
        .setIcon('languages')
        .onClick(() => {
          debugLog('FleurDict: AI translate for full text:', fullSelection);
          this.plugin.app.workspace.trigger('fleurdict:ai-translate', fullSelection);
        });
    });

    // AI Detail — uses the user's FULL selection, not just the first word
    menu.addItem((item: MenuItem) => {
      item
        .setTitle('AI 详解')
        .setIcon('sparkles')
        .onClick(() => {
          debugLog('FleurDict: AI detail for full text:', fullSelection);
          this.plugin.app.workspace.trigger('fleurdict:ai-detail', fullSelection);
        });
    });

    menu.addSeparator();
  }

  /**
   * Check if text is English
   */
  private isEnglishText(text: string): boolean {
    return /^[a-zA-Z][a-zA-Z'\-\s]*[a-zA-Z']?$/.test(text) && text.length <= 50;
  }
}
