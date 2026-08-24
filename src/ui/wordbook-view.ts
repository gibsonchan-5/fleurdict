/**
 * FleurDict - Wordbook View
 * Sidebar view for managing wordbook entries
 *
 * Context mode selector (reference FleurPilot):
 *   - active  → 当前笔记里的生词
 *   - all     → 全部笔记里的生词
 *   - custom  → 指定的文件夹 / 笔记里的生词
 *   - none    → 不限范围（等同 all）
 */

import { ItemView, WorkspaceLeaf, Menu, Modal, TFile, TFolder, Notice } from 'obsidian';
import { WordEntry, FleurDictSettings } from '../types';
import { WordbookManager } from '../core/wordbook-manager';
import { DictionaryEngine } from '../core/dictionary-engine';
import { EditEntryModal } from './edit-entry-modal';

export const WORDBOOK_VIEW_TYPE = 'fleurdict-wordbook-view';

type ContextMode = 'active' | 'all' | 'custom';

// ---------------------------------------------------------------------------
// ContextSearchModal — 单选：一次只能选中一个文件夹或一篇笔记
// ---------------------------------------------------------------------------
class ContextSearchModal extends Modal {
  private initialPath: string;
  private onConfirm: (path: string) => void;
  private selectedPath: string;
  private currentFolder: TFolder | null;
  private searchInput!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private isSearchMode = false;

  constructor(app: any, initialPath: string, onConfirm: (path: string) => void) {
    super(app);
    this.initialPath = initialPath;
    this.onConfirm = onConfirm;
    this.selectedPath = initialPath;
    this.currentFolder = app.vault.getRoot();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fleurdict-ctx-search');

    // Title
    contentEl.createEl('h3', { text: '选择文件夹或笔记（单选）' });

    // Search input
    const searchWrap = contentEl.createDiv('fleurdict-ctx-search-bar');
    this.searchInput = searchWrap.createEl('input', {
      type: 'text',
      cls: 'fleurdict-ctx-search-input',
      attr: { placeholder: '输入关键词搜索…' },
    });
    this.searchInput.addEventListener('input', () => this.renderList());

    // List
    this.listEl = contentEl.createDiv('fleurdict-ctx-search-list');
    this.renderList();

    // Footer buttons
    const footer = contentEl.createDiv('fleurdict-ctx-search-footer');

    const confirmBtn = footer.createEl('button', { text: '确定', cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm(this.selectedPath);
      this.close();
    });

    const cancelBtn = footer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  private renderList() {
    this.listEl.empty();
    const query = this.searchInput.value.toLowerCase().trim();
    this.isSearchMode = query.length > 0;

    if (this.isSearchMode) {
      this.renderSearchResults(query);
    } else {
      this.renderFolderContent();
    }
  }

  private renderSearchResults(query: string) {
    const allFiles = this.app.vault.getAllLoadedFiles();
    const folders = allFiles.filter((f: any) => 'children' in f || f.isRoot) as TFolder[];
    const files = allFiles.filter((f: any) => f.extension === 'md') as TFile[];

    const matchedFolders = folders.filter((f) => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));
    const matchedFiles = files.filter((f) => f.basename.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));

    if (matchedFolders.length === 0 && matchedFiles.length === 0) {
      this.listEl.createDiv({ text: '没有匹配结果', cls: 'fleurdict-ctx-search-empty' });
      return;
    }

    for (const folder of matchedFolders) {
      if (folder.isRoot) continue;
      this.renderItem(folder.name, folder.path, true, folder);
    }
    for (const file of matchedFiles) {
      this.renderItem(file.basename, file.path, false, file);
    }
  }

  private renderFolderContent() {
    const folder = this.currentFolder!;
    const children = folder.children || [];

    // Parent nav
    if (folder !== this.app.vault.getRoot()) {
      const parent = folder.parent;
      if (parent) {
        const upEl = this.listEl.createDiv('fleurdict-ctx-search-item fleurdict-ctx-search-parent');
        upEl.createEl('span', { text: `.. ${parent.name || '/'}`, cls: 'fleurdict-ctx-search-name' });
        upEl.addEventListener('click', () => {
          this.currentFolder = parent;
          this.searchInput.value = '';
          this.renderList();
        });
      }
    }

    // Separate folders and files
    const folders = children.filter((c: any) => 'children' in c || c.isRoot) as TFolder[];
    const files = children.filter((c: any) => c.extension === 'md') as TFile[];

    for (const f of folders.sort((a, b) => a.name.localeCompare(b.name))) {
      this.renderItem(f.name, f.path, true, f);
    }
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      this.renderItem(f.basename, f.path, false, f);
    }

    if (folders.length === 0 && files.length === 0 && folder !== this.app.vault.getRoot()) {
      this.listEl.createDiv({ text: '空文件夹', cls: 'fleurdict-ctx-search-empty' });
    }
  }

  private renderItem(displayName: string, fullPath: string, isFolder: boolean, item: any) {
    const el = this.listEl.createDiv('fleurdict-ctx-search-item');
    if (this.selectedPath === fullPath) {
      el.addClass('fleurdict-ctx-selected');
    }

    el.createEl('span', { text: displayName, cls: 'fleurdict-ctx-search-name' });
    el.createEl('span', { text: this.selectedPath === fullPath ? '✓' : '', cls: 'fleurdict-ctx-check' });

    // Single click: replace selection (radio behavior)
    el.addEventListener('click', () => {
      this.selectedPath = fullPath;
      this.renderList();
    });

    // Double click folder: navigate into it
    if (isFolder && !this.isSearchMode) {
      el.addEventListener('dblclick', () => {
        this.currentFolder = item;
        this.searchInput.value = '';
        this.renderList();
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// WordbookView
// ---------------------------------------------------------------------------
export class WordbookView extends ItemView {
  private settings: FleurDictSettings;
  private wordbookManager: WordbookManager;
  private dictEngine: DictionaryEngine;
  private contextMode: ContextMode = 'active';
  private contextPath: string = '';
  private contextButton!: HTMLButtonElement;
  // Cache for Youdao re-queried meanings: word -> meaning string
  private meaningCache = new Map<string, string>();

  constructor(leaf: WorkspaceLeaf, settings: FleurDictSettings, wordbookManager: WordbookManager, dictEngine: DictionaryEngine) {
    super(leaf);
    this.settings = settings;
    this.wordbookManager = wordbookManager;
    this.dictEngine = dictEngine;

    // Always default to 'active' mode
    this.contextMode = 'active';
    if (settings.contextPath) {
      this.contextPath = settings.contextPath;
    }
    console.log('[FleurDict] WordbookView created, contextMode =', this.contextMode);
  }

  getViewType() {
    return WORDBOOK_VIEW_TYPE;
  }

  getDisplayText() {
    return 'FleurDict 生词本';
  }

  getIcon() {
    return 'book';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('fleurdict-wordbook-view');

    // Register active-leaf-change listener: refresh when user switches notes
    this.register(
      this.app.workspace.on('active-leaf-change', () => {
        if (this.contextMode === 'active') {
          this.updateContextButtonLabel();
          this.renderWordList(this.containerEl.children[1]);
        }
      })
    );

    this.renderView(container);
  }

  async onClose() {
    // Nothing to clean up
  }

  /**
   * Render the entire view
   */
  private renderView(container: Element) {
    container.empty();

    // Header with action buttons
    this.renderHeader(container);

    // Context mode selector + search
    this.renderControls(container);

    // Word list
    this.renderWordList(container);
  }

  /**
   * Render header with action buttons
   */
  private renderHeader(container: Element) {
    const headerEl = container.createEl('div', { cls: 'fleurdict-wordbook-header' });

    const actionsEl = headerEl.createEl('div', { cls: 'fleurdict-wordbook-actions' });

    const reviewBtn = document.createElement('button');
    reviewBtn.textContent = '开始复习';
    reviewBtn.addEventListener('click', () => this.startReview());
    actionsEl.appendChild(reviewBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = '导出';
    exportBtn.addEventListener('click', () => this.exportWordbook());
    actionsEl.appendChild(exportBtn);
  }

  /**
   * Render controls: context mode button only (search removed)
   */
  private renderControls(container: Element) {
    const controlsEl = container.createEl('div', { cls: 'fleurdict-wordbook-controls' });

    // Context mode button (left side)
    this.contextButton = controlsEl.createEl('button', {
      cls: 'fleurdict-context-btn',
    });
    this.updateContextButtonLabel();
    this.contextButton.addEventListener('click', (e) => this.showContextMenu(e));
  }

  /**
   * Update context button label based on current mode
   */
  private updateContextButtonLabel() {
    const btn = this.contextButton;
    if (!btn) return;

    let label: string;
    let title: string;

    switch (this.contextMode) {
      case 'active': {
        const activeFile = this.app.workspace.getActiveFile();
        label = activeFile ? activeFile.basename : '当前笔记';
        title = label;
        break;
      }
      case 'all':
        label = '全部笔记';
        title = '点击切换范围';
        break;
      case 'custom': {
        if (this.contextPath) {
          const fileName = this.contextPath.split('/').pop() || this.contextPath;
          label = fileName.replace('.md', '');
          title = label;
        } else {
          label = '选择范围';
          title = '点击切换范围';
        }
        break;
      }
    }

    btn.empty();
    const labelEl = btn.createSpan({ cls: 'fleurdict-context-btn-label' });
    labelEl.textContent = label;
    btn.setAttribute('title', title);
  }

  /**
   * Show context mode menu (参考 FleurPilot)
   */
  private showContextMenu(event: MouseEvent) {
    const menu = new Menu();

    // 1. 当前笔记
    menu.addItem((item) => {
      item.setTitle(`${this.contextMode === 'active' ? '✓ ' : ''}当前笔记`)
        .setIcon('file-text')
        .onClick(() => {
          this.contextMode = 'active';
          this.contextPath = '';
          this.saveContextMode();
          this.updateContextButtonLabel();
          this.refresh();
        });
    });

    // 2. 全部笔记
    menu.addItem((item) => {
      item.setTitle(`${this.contextMode === 'all' ? '✓ ' : ''}全部笔记`)
        .setIcon('book-open')
        .onClick(() => {
          this.contextMode = 'all';
          this.contextPath = '';
          this.saveContextMode();
          this.updateContextButtonLabel();
          this.refresh();
        });
    });

    menu.addSeparator();

    // 3. 其他文件夹或笔记（单选）
    menu.addItem((item) => {
      let label = '其他文件夹或笔记';
      if (this.contextMode === 'custom' && this.contextPath) {
        const fileName = this.contextPath.split('/').pop() || this.contextPath;
        label = `其他文件夹或笔记（${fileName.replace('.md', '')}）`;
      }
      item.setTitle(`${this.contextMode === 'custom' ? '✓ ' : ''}${label}`)
        .setIcon('folder-search')
        .onClick(() => {
          new ContextSearchModal(
            this.app,
            this.contextPath,
            (path) => {
              this.contextMode = 'custom';
              this.contextPath = path;
              this.saveContextMode();
              this.updateContextButtonLabel();
              this.refresh();
            }
          ).open();
        });
    });

    menu.showAtMouseEvent(event);
  }

  /**
   * Save context mode to plugin settings
   */
  private async saveContextMode() {
    // Find the plugin instance to save settings
    const plugin = (this.app as any).plugins?.getPlugin?.('fleurdict');
    if (plugin) {
      plugin.settings.contextMode = this.contextMode;
      plugin.settings.contextPath = this.contextPath;
      await plugin.saveSettings();
    }
  }

  /**
   * Filter entries based on context mode.
   */
  private filterByContext(entries: WordEntry[]): WordEntry[] {
    switch (this.contextMode) {
      case 'active': {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return entries;
        const activePath = activeFile.path;
        // Only match entries from the exact current note
        return entries.filter((e) => e.source === activePath);
      }
      case 'all':
        return entries;
      case 'custom': {
        if (!this.contextPath) return entries;
        return entries.filter((e) => {
          if (!e.source) return false;
          // this.contextPath could be a file or folder
          const item = this.app.vault.getAbstractFileByPath(this.contextPath);
          if (item instanceof TFile) {
            return e.source === this.contextPath;
          } else if (item instanceof TFolder) {
            return e.source.startsWith(this.contextPath + '/') || e.source === this.contextPath;
          }
          return false;
        });
      }
      default:
        return entries;
    }
  }

  /**
   * Render the word list
   */
  private async renderWordList(container: Element) {
    const existingList = container.querySelector('.fleurdict-wordbook-list');
    if (existingList) {
      existingList.remove();
    }

    const listEl = container.createEl('div', { cls: 'fleurdict-wordbook-list' });

    const data = this.wordbookManager.getData();
    let entries = [...data.words, ...data.phrases];
    console.log('[FleurDict] renderWordList: contextMode =', this.contextMode, ', total entries =', entries.length);
    console.log('[FleurDict] renderWordList: entries sources =', entries.map(e => e.source));

    // Filter by context mode
    entries = this.filterByContext(entries);
    console.log('[FleurDict] renderWordList: after filter, entries =', entries.length, entries.map(e => e.word));

    // Sort by creation date (newest first)
    entries.sort((a, b) => b.createdAt - a.createdAt);

    if (entries.length === 0) {
      listEl.createEl('div', {
        text: '生词本是空的',
        cls: 'fleurdict-wordbook-empty',
      });
      return;
    }

    // Render entries (re-query Youdao for fresh meanings)
    for (const entry of entries) {
      await this.renderEntry(listEl, entry);
    }
  }

  /**
   * Render a single word entry — word + POS + meaning only
   */
  private async renderEntry(container: Element, entry: WordEntry) {
    const entryEl = container.createEl('div', { cls: 'fleurdict-wordbook-entry' });

    // Word header
    const headerEl = entryEl.createEl('div', { cls: 'fleurdict-wordbook-entry-header' });
    headerEl.createEl('span', {
      text: entry.word,
      cls: 'fleurdict-wordbook-word',
    });

    // Meaning from Youdao (includes POS labels like "noun xx; verb xx")
    const meaning = await this.getYoudaoMeaning(entry.word);
    const displayMeaning = meaning || entry.meaning || '';
    if (displayMeaning) {
      entryEl.createEl('div', {
        text: displayMeaning,
        cls: 'fleurdict-wordbook-meaning',
      });
    }

    // Note (user-written note, not context which is just the selected word)
    if (entry.note) {
      entryEl.createEl('div', {
        text: entry.note,
        cls: 'fleurdict-wordbook-note',
      });
    }

    // Action buttons
    const actionsEl = entryEl.createEl('div', { cls: 'fleurdict-wordbook-entry-actions' });

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
    editBtn.setAttribute('aria-label', '编辑');
    editBtn.addEventListener('click', () => this.openEditModal(entry));
    actionsEl.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
    deleteBtn.setAttribute('aria-label', '删除');
    deleteBtn.addEventListener('click', async () => {
      await this.deleteEntry(entry);
    });
    actionsEl.appendChild(deleteBtn);

    const reviewBtn = document.createElement('button');
    reviewBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>';
    reviewBtn.setAttribute('aria-label', 'AI 详解');
    reviewBtn.addEventListener('click', () => this.aiDetail(entry));
    actionsEl.appendChild(reviewBtn);
  }

  /**
   * Get fresh meaning from Youdao API (with in-session cache)
   */
  private async getYoudaoMeaning(word: string): Promise<string> {
    if (this.meaningCache.has(word)) {
      return this.meaningCache.get(word)!;
    }

    try {
      const results = await this.dictEngine.query(word);
      if (results.length > 0 && results[0].entries.length > 0) {
        const entry = results[0].entries[0];
        const meaning = DictionaryEngine.getAllDefinitions(entry);
        this.meaningCache.set(word, meaning);
        return meaning;
      }
    } catch {
      // fallback to stored meaning
    }
    return '';
  }

  /**
   * Open edit modal for a word entry
   */
  private openEditModal(entry: WordEntry) {
    const modal = new EditEntryModal(
      this.app,
      entry,
      this.wordbookManager,
      async (updated: WordEntry) => {
        const allEntries = this.wordbookManager.getAllEntries();
        const existing = allEntries.find(e => e.id === updated.id);
        if (existing) {
          Object.assign(existing, updated);
          await this.wordbookManager.save();
        }
        // Clear meaning cache for this word so it re-queries next time
        this.meaningCache.delete(updated.word);
        this.refresh();
      }
    );
    modal.open();
  }

  /**
   * Delete an entry
   */
  private async deleteEntry(entry: WordEntry) {
    await this.wordbookManager.removeEntry(entry.id);
    this.meaningCache.delete(entry.word);
    new Notice(`已删除: ${entry.word}`);

    const container = this.containerEl.children[1];
    this.renderView(container);
  }

  /**
   * Show AI detail for a word
   */
  private async aiDetail(entry: WordEntry) {
    this.app.workspace.trigger('fleurdict:ai-detail', entry.word, entry.context);
  }

  /**
   * Export wordbook to Markdown
   */
  private async exportWordbook() {
    const markdown = this.wordbookManager.exportToMarkdown();
    const fileName = `FleurDict-生词本-${new Date().toISOString().slice(0, 10)}.md`;
    const file = await this.app.vault.create(fileName, markdown);
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.openFile(file);
    new Notice(`✓ 生词本已导出到 ${fileName}`);
  }

  /**
   * Start flashcard review
   */
  private startReview() {
    const data = this.wordbookManager.getData();
    const entries = [...data.words, ...data.phrases];

    if (entries.length === 0) {
      new Notice('生词本是空的，无法开始复习');
      return;
    }

    this.app.workspace.trigger('fleurdict:start-flashcard');
  }

  /**
   * Refresh the view
   */
  refresh() {
    const container = this.containerEl.children[1];
    this.renderView(container);
  }
}
