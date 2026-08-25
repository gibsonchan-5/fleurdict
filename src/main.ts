/**
 * FleurDict - Main Plugin Entry
 * An elegant English dictionary plugin for Obsidian
 */

import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';
import { FleurDictSettings, DEFAULT_SETTINGS } from './types';
import { DictionaryEngine } from './core/dictionary-engine';
import { WordbookManager } from './core/wordbook-manager';
import { FlashcardEngine } from './core/flashcard-engine';
import { LLMService } from './core/llm-service';
import { EudicService } from './core/eudic-service';
import { SelectionHandler } from './features/selection-handler';
import { ContextMenuManager } from './features/context-menu';
import { CommandManager } from './features/commands';
import { ReadingModeHandler } from './features/reading-mode-handler';
import { FleurDictSettingTab } from './settings';
import { showAITranslation, showAIDetail } from './ui/ai-modal';
import { AISidebarView, AI_SIDEBAR_VIEW_TYPE } from './ui/ai-sidebar';
import { FlashcardModal } from './ui/flashcard-modal';
import { WordbookView, WORDBOOK_VIEW_TYPE } from './ui/wordbook-view';
import { createWordHighlightPlugin, refreshAllEditorHighlights } from './features/word-highlighter';

/**
 * FleurDict Plugin
 */
export default class FleurDictPlugin extends Plugin {
  settings: FleurDictSettings = DEFAULT_SETTINGS;
  dictEngine!: DictionaryEngine;
  wordbookManager!: WordbookManager;
  flashcardEngine!: FlashcardEngine;
  llmService!: LLMService;
  eudicService!: EudicService;
  selectionHandler!: SelectionHandler;
  contextMenuManager!: ContextMenuManager;
  commandManager!: CommandManager;
  readingModeHandler!: ReadingModeHandler;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Initialize core modules
    this.dictEngine = new DictionaryEngine(this, this.settings);
    this.wordbookManager = new WordbookManager(this, this.settings);
    this.flashcardEngine = new FlashcardEngine();
    this.llmService = new LLMService(this.settings);
    this.eudicService = new EudicService(this, this.settings);

    // Load wordbook data
    await this.wordbookManager.load();

    // Initialize UI modules
    this.selectionHandler = new SelectionHandler(this, this.settings, this.dictEngine);
    this.contextMenuManager = new ContextMenuManager(this, this.settings, this.selectionHandler);
    this.commandManager = new CommandManager(
      this,
      this.settings,
      this.selectionHandler,
      this.wordbookManager,
      this.flashcardEngine
    );
    this.readingModeHandler = new ReadingModeHandler(
      this,
      this.wordbookManager,
      this.selectionHandler
    );

    // Register event handlers
    this.selectionHandler.register();
    this.contextMenuManager.register();
    this.commandManager.register();
    this.readingModeHandler.register();

    // Initialize reading mode handler (auto-detects preview mode, no toggle needed)

    // Register settings tab
    this.addSettingTab(new FleurDictSettingTab(this.app, this));

    // Register AI sidebar view
    this.registerView(AI_SIDEBAR_VIEW_TYPE, (leaf) => {
      return new AISidebarView(leaf, this.settings, this.llmService);
    });

    // Register wordbook view
    this.registerView(WORDBOOK_VIEW_TYPE, (leaf) => {
      return new WordbookView(leaf, this.settings, this.wordbookManager, this.dictEngine);
    });

    // Force-detach all existing leaves for our views to clear any stale/orphan
    // leaves from previous sessions (e.g. "插件不再活动" errors caused by the
    // workspace caching a view state from a broken build). This is safe because
    // registerView has already wired up the factory — any leaf that was open
    // will be recreated by Obsidian on the next reveal.
    // Defer to next tick so view registration is fully wired up first.
    this.app.workspace.onLayoutReady(() => {
      for (const viewType of [WORDBOOK_VIEW_TYPE, AI_SIDEBAR_VIEW_TYPE]) {
        try {
          const leaves = this.app.workspace.getLeavesOfType(viewType);
          for (const leaf of leaves) {
            leaf.detach();
          }
        } catch (e) {
          console.warn(`FleurDict: orphan cleanup for ${viewType} failed:`, e);
        }
      }
    });

    // Register word highlight CM6 extensions (StateField + ViewPlugin)
    const highlightExtensions = createWordHighlightPlugin(this, this.wordbookManager);
    this.registerEditorExtension(highlightExtensions);

    // Register workspace events
    this.registerWorkspaceEvents();

    // Ribbon: 生词本入口
    this.addRibbonIcon('book-open', 'FleurDict 生词本', () => {
      this.activateWordbookView();
    });
  }

  onunload() {

    // Unregister event handlers
    try {
      this.selectionHandler.unregister();
      this.readingModeHandler.unregister();
    } catch (e) {
      console.error('FleurDict: Error unregistering handlers:', e);
    }

    // Detach custom views to prevent "error while closing".
    // Wrap each detach in try/catch so one failing view doesn't break the others.
    try {
      this.app.workspace.detachLeavesOfType(AI_SIDEBAR_VIEW_TYPE);
    } catch (e) {
      console.error('FleurDict: Error detaching AI sidebar:', e);
    }
    try {
      this.app.workspace.detachLeavesOfType(WORDBOOK_VIEW_TYPE);
    } catch (e) {
      console.error('FleurDict: Error detaching wordbook view:', e);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    // Fix migration: ensure dictionarySource is always set
    if (!this.settings.dictionarySource || this.settings.dictionarySource === undefined) {
      this.settings.dictionarySource = 'youdao';
    }
    // Fix: eudicCategoryId must be "0" (default), remove category selector support
    if (this.settings.eudicCategoryId && this.settings.eudicCategoryId !== '0') {
      this.settings.eudicCategoryId = '0';
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    const data = (await this.loadData()) || {};
    data.settings = this.settings;
    await this.saveData(data);

    // Update all modules with new settings
    this.dictEngine.updateSettings(this.settings);
    this.wordbookManager.updateSettings(this.settings);
    this.llmService.updateSettings(this.settings);
    this.selectionHandler.updateSettings(this.settings);
    this.contextMenuManager.updateSettings(this.settings);
    this.commandManager.updateSettings(this.settings);
  }

  /**
   * Register workspace event handlers
   */
  private registerWorkspaceEvents() {
    // Add to wordbook
    this.registerEvent(
      this.app.workspace.on('fleurdict:add-to-wordbook', async (word: string) => {
        await this.addToWordbook(word);
      })
    );

    // AI detail
    this.registerEvent(
      this.app.workspace.on('fleurdict:ai-detail', (word: string) => {
        this.showAIDetail(word);
      })
    );

    // AI translate
    this.registerEvent(
      this.app.workspace.on('fleurdict:ai-translate', (text: string) => {
        this.showAITranslate(text);
      })
    );

    // Start flashcard
    this.registerEvent(
      this.app.workspace.on('fleurdict:start-flashcard', () => {
        this.startFlashcard();
      })
    );

    // Export wordbook
    this.registerEvent(
      this.app.workspace.on('fleurdict:export-wordbook', () => {
        this.exportWordbook();
      })
    );
  }

  /**
   * Add a word to wordbook
   */
  private async addToWordbook(word: string) {
    try {
      // Query dictionary for meaning
      const results = await this.dictEngine.query(word);
      let meaning = '';
      let phonetic = '';
      let audioUrlUK: string | undefined;
      let audioUrlUS: string | undefined;

      if (results.length > 0 && results[0].entries.length > 0) {
        const entry = results[0].entries[0];
        meaning = DictionaryEngine.getFirstDefinition(entry);
        phonetic = DictionaryEngine.getPhonetic(entry);
        // Extract UK/US audio URLs from phonetics
        for (const p of entry.phonetics) {
          if (p.text?.startsWith('英') && p.audio) audioUrlUK = p.audio;
          if (p.text?.startsWith('美') && p.audio) audioUrlUS = p.audio;
        }
      }

      // Get context from current selection
      const selection = window.getSelection();
      const context = selection?.toString().trim() || undefined;

      // Add to local wordbook
      await this.wordbookManager.addEntry(word, meaning, phonetic, context, undefined, audioUrlUK, audioUrlUS);

      // Refresh editor highlights (CM6 decorations)
      refreshAllEditorHighlights(this);

      // Refresh reading/preview mode highlights (DOM-based)
      this.readingModeHandler?.refreshAllReadingViews();

      // Refresh wordbook view if open
      const leaves = this.app.workspace.getLeavesOfType(WORDBOOK_VIEW_TYPE);
      for (const leaf of leaves) {
        const view = leaf.view as any;
        if (typeof view.refresh === 'function') {
          view.refresh();
        }
      }

      // Sync to Eudic if enabled
      if (this.settings.eudicEnabled && this.settings.eudicToken) {
        try {
          await this.eudicService.addWord(word, context);
          new Notice(`✓ "${word}" 已加入生词本并同步到欧路`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          new Notice(`✓ "${word}" 已加入本地生词本（欧路同步失败：${errMsg}）`, 6000);
        }
      } else {
        new Notice(`✓ "${word}" 已加入生词本`);
      }
    } catch (error) {
      console.error('FleurDict: Failed to add to wordbook:', error);
      new Notice(`加入生词本失败：${error}`);
    }
  }

  /**
   * Show AI detail for a word
   */
  private async showAIDetail(word: string, context?: string) {
    if (!this.settings.aiApiKey) {
      new Notice('请先在设置中配置 AI API Key');
      return;
    }

    await showAIDetail(this.app, this.settings, this.llmService, word, context, this);
  }

  /**
   * Show AI translate
   */
  private async showAITranslate(text: string, context?: string) {
    if (!this.settings.aiApiKey) {
      new Notice('请先在设置中配置 AI API Key');
      return;
    }

    await showAITranslation(this.app, this.settings, this.llmService, text, context, this);
  }

  /**
   * Start flashcard review
   */
  private startFlashcard() {
    const dueEntries = this.wordbookManager.getDueEntries();

    if (dueEntries.length === 0) {
      new Notice('今日没有需要复习的单词');
      return;
    }

    // Start session
    this.flashcardEngine.startSession(
      'due',
      dueEntries,
      undefined,
      this.settings.dailyReviewLimit
    );

    // Open flashcard modal
    const session = this.flashcardEngine.getSession();
    if (!session) {
      new Notice('无法启动复习会话');
      return;
    }

    const modal = new FlashcardModal(
      this.app,
      this.settings,
      this.flashcardEngine,
      session,
      () => {
        // Update callback - refresh wordbook view and editor highlights
        const leaves = this.app.workspace.getLeavesOfType(WORDBOOK_VIEW_TYPE);
        if (leaves.length > 0) {
          const view = leaves[0].view as WordbookView;
          view.refresh();
        }
        // Refresh editor highlights after review
        refreshAllEditorHighlights(this);
      }
    );
    modal.open();
  }

  /**
   * Export wordbook to Markdown
   */
  private async exportWordbook() {
    const entries = this.wordbookManager.getAllEntries();

    if (entries.length === 0) {
      new Notice('生词本是空的');
      return;
    }

    const words = entries.filter((e) => e.type === 'word');
    const phrases = entries.filter((e) => e.type === 'phrase');

    let md = `> 导出时间：${new Date().toLocaleDateString('zh-CN')} | 共 ${words.length} 个单词 / ${phrases.length} 个短语\n\n`;

    if (words.length > 0) {
      md += `## 单词\n\n`;
      md += `| 单词 | 音标 | 释义 |\n`;
      md += `| --- | --- | --- |\n`;
      for (const w of words) {
        md += `| ${w.word} | ${w.phonetic || '-'} | ${w.meaning || '-'} |\n`;
      }
      md += `\n`;
    }

    if (phrases.length > 0) {
      md += `## 短语\n\n`;
      md += `| 短语 | 释义 |\n`;
      md += `| --- | --- |\n`;
      for (const p of phrases) {
        md += `| ${p.word} | ${p.meaning || '-'} |\n`;
      }
      md += `\n`;
    }

    try {
      const folder = 'FleurDict';
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      const fileName = `${folder}/生词本-全部-${dateStr}.md`;

      const file = await this.app.vault.create(fileName, md);
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file);
      new Notice(`✓ 已导出到 ${fileName}`);
    } catch (e: any) {
      new Notice(` 导出失败：${e.message}`);
    }
  }

  /**
   * Activate AI sidebar view
   */
  async activateAISidebar() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(AI_SIDEBAR_VIEW_TYPE);

    if (leaves.length > 0) {
      // A leaf with our view already exists, simply reveal it
      workspace.revealLeaf(leaves[0]);
    } else {
      // Create a new leaf in the right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: AI_SIDEBAR_VIEW_TYPE, active: true });
        workspace.revealLeaf(leaf);
      }
    }
  }

  /**
   * Activate wordbook sidebar view
   */
  async activateWordbookView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(WORDBOOK_VIEW_TYPE);

    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: WORDBOOK_VIEW_TYPE, active: true });
        workspace.revealLeaf(leaf);
      }
    }
  }
}
