/**
 * FleurDict - Commands
 * Registers Obsidian commands
 */

import { Plugin, App } from 'obsidian';
import { FleurDictSettings } from '../types';
import { SelectionHandler } from './selection-handler';
import { WordbookManager } from '../core/wordbook-manager';
import { FlashcardEngine } from '../core/flashcard-engine';

/**
 * Command manager
 */
export class CommandManager {
  private plugin: Plugin;
  private settings: FleurDictSettings;
  private selectionHandler: SelectionHandler;
  private wordbookManager: WordbookManager;
  private flashcardEngine: FlashcardEngine;

  constructor(
    plugin: Plugin,
    settings: FleurDictSettings,
    selectionHandler: SelectionHandler,
    wordbookManager: WordbookManager,
    flashcardEngine: FlashcardEngine
  ) {
    this.plugin = plugin;
    this.settings = settings;
    this.selectionHandler = selectionHandler;
    this.wordbookManager = wordbookManager;
    this.flashcardEngine = flashcardEngine;
  }

  /**
   * Register commands
   */
  register(): void {
    // Quick lookup
    this.plugin.addCommand({
      id: 'fleurdict-lookup',
      name: '查询选中单词',
      callback: () => {
        this.selectionHandler.lookupWord();
      },
    });

    // Lookup with input
    this.plugin.addCommand({
      id: 'fleurdict-lookup-input',
      name: '查询单词（手动输入）',
      callback: () => {
        this.showLookupInput();
      },
    });

    // Add to wordbook
    this.plugin.addCommand({
      id: 'fleurdict-add-to-wordbook',
      name: '将选中单词加入生词本',
      callback: () => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          const text = selection.toString().trim();
          if (text) {
            this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', text);
          }
        }
      },
    });

    // Flashcard review
    this.plugin.addCommand({
      id: 'fleurdict-flashcard-review',
      name: '开始闪卡复习',
      callback: () => {
        this.plugin.app.workspace.trigger('fleurdict:start-flashcard');
      },
    });

    // Close popup
    this.plugin.addCommand({
      id: 'fleurdict-close-popup',
      name: '关闭词典弹窗',
      checkCallback: (checking) => {
        if (this.selectionHandler.isPopupVisible()) {
          if (!checking) {
            this.selectionHandler.closePopup();
          }
          return true;
        }
        return false;
      },
    });

    // Open wordbook view
    this.plugin.addCommand({
      id: 'fleurdict-open-wordbook',
      name: '打开生词本',
      callback: () => {
        this.plugin.app.workspace.trigger('fleurdict:open-wordbook');
      },
    });

    // Export wordbook
    this.plugin.addCommand({
      id: 'fleurdict-export-wordbook',
      name: '导出生词本为 Markdown',
      callback: () => {
        this.plugin.app.workspace.trigger('fleurdict:export-wordbook');
      },
    });
  }

  /**
   * Show lookup input modal
   */
  private showLookupInput(): void {
    // Use Obsidian's suggest modal
    const { SuggestModal } = require('obsidian');

    class WordLookupModal extends SuggestModal<string> {
      private plugin: Plugin;
      private selectionHandler: SelectionHandler;

      constructor(plugin: Plugin, selectionHandler: SelectionHandler) {
        super(plugin.app);
        this.plugin = plugin;
        this.selectionHandler = selectionHandler;
        this.setPlaceholder('输入要查询的英文单词...');
      }

      getSuggestions(query: string): string[] {
        // Return the query itself as suggestion
        return query ? [query] : [];
      }

      renderSuggestion(suggestion: string, el: HTMLElement) {
        el.setText(suggestion);
      }

      onChooseSuggestion(suggestion: string) {
        this.selectionHandler.lookupWord(suggestion);
      }
    }

    new WordLookupModal(this.plugin, this.selectionHandler).open();
  }

  /**
   * Update settings
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }
}
