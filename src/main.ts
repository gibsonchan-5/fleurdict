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
import { debugLog } from './core/debug';
import {
  SECRET_FIELDS,
  hydrateSecrets,
  migrateSecrets,
  resolveBackend,
  scrubSecretsForPersistence,
  secretStorageAvailable,
  type SecretBackend,
} from './core/secret-store';
import { SelectionHandler } from './features/selection-handler';
import { PdfSelectionHandler } from './features/pdf-selection-handler';
import { PdfWordHighlighter } from './features/pdf-word-highlighter';
import { ContextMenuManager } from './features/context-menu';
import { CommandManager } from './features/commands';
import { FleurDictSettingTab } from './settings';
import { showAITranslation, showAIDetail } from './ui/ai-modal';
import { AISidebarView, AI_SIDEBAR_VIEW_TYPE } from './ui/ai-sidebar';
import { FlashcardModal } from './ui/flashcard-modal';
import { WordbookView, WORDBOOK_VIEW_TYPE } from './ui/wordbook-view';
import { createWordHighlightPlugin, refreshAllEditorHighlights } from './features/word-highlighter';
import { ReadingModeHandler } from './features/reading-mode-handler';

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
  pdfSelectionHandler!: PdfSelectionHandler;
  pdfWordHighlighter!: PdfWordHighlighter;
  contextMenuManager!: ContextMenuManager;
  commandManager!: CommandManager;
  readingModeHandler!: ReadingModeHandler;
  /** Whether API keys can be kept in the system keychain on this build. */
  secretStorageAvailable = false;

  /**
   * Where API keys are actually kept right now.
   *
   * `system` only applies when the keychain exists and the user did not opt
   * into the vault backend; every other combination falls back to `vault`.
   */
  get secretBackend(): SecretBackend {
    return resolveBackend(this.app, this.settings.secretStorageMode);
  }

  async onload() {
    debugLog('[FleurDict-DIAG] === Plugin loading BUILD v2026-09-12-SECRET-13 ===');
    debugLog('[FleurDict-DIAG] Loading plugin...');

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
    this.pdfSelectionHandler = new PdfSelectionHandler(this, this.settings, this.dictEngine);
    this.pdfWordHighlighter = new PdfWordHighlighter(this, this.settings, this.wordbookManager);
    this.contextMenuManager = new ContextMenuManager(this, this.settings, this.selectionHandler);
    this.commandManager = new CommandManager(
      this,
      this.settings,
      this.selectionHandler,
      this.wordbookManager,
      this.flashcardEngine
    );

    // Register event handlers
    this.selectionHandler.register();
    this.pdfSelectionHandler.register();
    this.pdfWordHighlighter.register();
    // fleur-pdf-style Notice diagnostic for the PDF highlight pipeline
    this.addCommand({
      id: 'pdf-highlight-diagnose',
      name: 'PDF 高亮诊断',
      callback: () => this.pdfWordHighlighter.diagnose(),
    });
    this.contextMenuManager.register();
    this.commandManager.register();

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

    // Register workspace events
    this.registerWorkspaceEvents();

    // Register CM6 editor extension for word highlighting in edit mode
    const [refreshField, highlightPlugin] = createWordHighlightPlugin(
      this,
      this.wordbookManager,
      this.selectionHandler
    );
    this.registerEditorExtension([refreshField, highlightPlugin]);

    // Initialize reading mode handler for word highlighting in preview mode
    this.readingModeHandler = new ReadingModeHandler(this, this.wordbookManager, this.selectionHandler);
    this.readingModeHandler.register();

    // 启动时延迟刷新所有视图的高亮（确保已打开的笔记也能高亮）
    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        refreshAllEditorHighlights();
        this.readingModeHandler?.refreshAllReadingViews();
      }, 500);
    });

    // Ribbon: 只保留生词本入口（查词走右键菜单，AI 走右键菜单）
    this.addRibbonIcon('book-open', 'FleurDict 生词本', () => {
      this.activateWordbookView();
    });

    debugLog('FleurDict: Plugin loaded successfully');
  }

  onunload() {
    debugLog('FleurDict: Unloading plugin...');

    // Unregister event handlers
    this.selectionHandler.unregister();
    this.pdfSelectionHandler?.unregister();
    this.pdfWordHighlighter?.unregister();
    this.readingModeHandler?.unregister();
  }

  /**
   * Load settings from storage
   *
   * Depending on `secretStorageMode`, secrets live in the system keychain or
   * in data.json. On the keychain backend any plain-text key still found on
   * disk (including the stale flat copies written by older versions) is
   * promoted into the keychain here and then removed from the file.
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

    this.secretStorageAvailable = secretStorageAvailable(this.app);
    const secrets = await hydrateSecrets(
      this.app,
      this.settings as unknown as Record<string, unknown>,
      data as Record<string, unknown> | null,
      this.secretBackend,
    );
    debugLog('FleurDict: secret storage', secrets);

    if (secrets.migrated.length > 0) {
      // Write immediately so the plain-text copies leave data.json now.
      await this.writeSettingsToDisk();
      new Notice(
        `FleurDict：${secrets.migrated.length} 个密钥已移入系统钥匙串，data.json 中不再保存明文`,
      );
    }

    debugLog('FleurDict: Loaded settings, dictionarySource =', this.settings.dictionarySource);
  }

  /**
   * Writes settings to data.json.
   *
   * On the keychain backend every secret field is stripped out: the value goes
   * to the keychain first and is only blanked once the keychain confirms it
   * holds it, so an unavailable keychain degrades to plain text instead of
   * losing the key. On the vault backend the values are written as-is.
   * Safe to call before the feature modules exist.
   */
  private async writeSettingsToDisk() {
    const data = ((await this.loadData()) as Record<string, unknown> | null) ?? {};
    data.settings = await scrubSecretsForPersistence(
      this.app,
      this.settings as unknown as Record<string, unknown>,
      this.secretBackend,
    );
    // Older versions also wrote flat copies at the top level, which are never
    // read back. Drop the secret ones so they cannot linger as plain text.
    for (const field of SECRET_FIELDS) {
      if (field in data) delete data[field];
    }
    await this.saveData(data);
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    await this.writeSettingsToDisk();

    // Update all modules with new settings
    this.dictEngine?.updateSettings(this.settings);
    this.wordbookManager?.updateSettings(this.settings);
    this.llmService?.updateSettings(this.settings);
    this.selectionHandler?.updateSettings(this.settings);
    this.pdfSelectionHandler?.updateSettings(this.settings);
    this.pdfWordHighlighter?.updateSettings(this.settings);
    this.contextMenuManager?.updateSettings(this.settings);
    this.commandManager?.updateSettings(this.settings);
  }

  /**
   * Switches where API keys are kept and carries the existing values over.
   *
   * Going to the keychain is verified field by field. If any write cannot be
   * confirmed the switch is rolled back to the previous mode, which leaves the
   * plain-text values in data.json rather than dropping them on the floor.
   */
  async setSecretStorageMode(
    mode: 'system' | 'vault',
  ): Promise<{ ok: boolean; failed: string[] }> {
    const previous = this.settings.secretStorageMode;
    const target = resolveBackend(this.app, mode);

    this.settings.secretStorageMode = mode;
    const result = await migrateSecrets(
      this.app,
      this.settings as unknown as Record<string, unknown>,
      target,
    );

    if (!result.ok) {
      this.settings.secretStorageMode = previous;
      await this.saveSettings();
      return { ok: false, failed: [...result.failed] };
    }

    await this.saveSettings();
    return { ok: true, failed: [] };
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
      let phoneticUK = '';
      let phoneticUS = '';
      let audioUrlUK: string | undefined;
      let audioUrlUS: string | undefined;

      if (results.length > 0 && results[0].entries.length > 0) {
        const entry = results[0].entries[0];
        // Use getAllDefinitions to preserve POS tags (e.g. "noun 网格，方格")
        meaning = DictionaryEngine.getAllDefinitions(entry);
        phonetic = DictionaryEngine.getPhonetic(entry);
        // Extract UK/US phonetics and audio URLs from phonetics
        for (const p of entry.phonetics) {
          if (p.text?.startsWith('英')) {
            phoneticUK = p.text;
            if (p.audio) audioUrlUK = p.audio;
          }
          if (p.text?.startsWith('美')) {
            phoneticUS = p.text;
            if (p.audio) audioUrlUS = p.audio;
          }
        }
      }

      // Get context from current selection
      const selection = window.getSelection();
      const context = selection?.toString().trim() || undefined;

      // Add to local wordbook
      await this.wordbookManager.addEntry(word, meaning, phonetic, context, undefined, audioUrlUK, audioUrlUS, phoneticUK, phoneticUS);

      // Refresh wordbook view if open
      const leaves = this.app.workspace.getLeavesOfType(WORDBOOK_VIEW_TYPE);
      for (const leaf of leaves) {
        const view = leaf.view as any;
        if (typeof view.refresh === 'function') {
          view.refresh();
        }
      }

      // Refresh editor highlights
      refreshAllEditorHighlights();
      this.readingModeHandler?.refreshAllReadingViews();

      // Sync to Eudic if enabled
      if (this.settings.eudicEnabled && this.settings.eudicToken) {
        try {
          await this.eudicService.addWord(word, context);
          new Notice(`✓ "${word}" 已加入生词本并同步到欧路`);
        } catch (e) {
          console.warn('FleurDict: Eudic sync failed:', e);
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
        // Update callback - refresh wordbook view if open
        const leaves = this.app.workspace.getLeavesOfType(WORDBOOK_VIEW_TYPE);
        if (leaves.length > 0) {
          const view = leaves[0].view as WordbookView;
          view.refresh();
        }
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
