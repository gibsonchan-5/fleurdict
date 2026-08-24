/**
 * FleurDict - Wordbook Manager
 * Manages vocabulary notebook with words and phrases
 */

import { Plugin } from 'obsidian';
import {
  WordEntry,
  WordbookCategory,
  WordbookData,
  FleurDictSettings,
} from '../types';
import { generateId, now, normalizeWord, isPhrase } from '../utils/helpers';

/**
 * Wordbook manager - handles vocabulary notebook operations
 */
export class WordbookManager {
  private plugin: Plugin;
  private settings: FleurDictSettings;
  private data: WordbookData;

  constructor(plugin: Plugin, settings: FleurDictSettings) {
    this.plugin = plugin;
    this.settings = settings;
    this.data = {
      words: [],
      phrases: [],
      categories: [],
    };
  }

  /**
   * Load wordbook data from storage
   */
  async load(): Promise<void> {
    try {
      const wordsData = await this.plugin.loadData();
      if (wordsData?.wordbook) {
        this.data = wordsData.wordbook;
      }
    } catch (error) {
      console.error('FleurDict: Failed to load wordbook:', error);
    }
  }

  /**
   * Save wordbook data to storage
   */
  async save(): Promise<void> {
    try {
      const allData = (await this.plugin.loadData()) || {};
      allData.wordbook = this.data;
      await this.plugin.saveData(allData);
    } catch (error) {
      console.error('FleurDict: Failed to save wordbook:', error);
    }
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  /**
   * Get raw wordbook data (for UI views)
   */
  getData(): WordbookData {
    return this.data;
  }

  /**
   * Add a word or phrase to wordbook
   */
  async addEntry(
    word: string,
    meaning: string,
    phonetic: string,
    context?: string,
    category?: string,
    audioUrlUK?: string,
    audioUrlUS?: string
  ): Promise<WordEntry> {
    const normalizedWord = normalizeWord(word);
    const type = isPhrase(normalizedWord) ? 'phrase' : 'word';

    // Check if already exists
    const existing = this.findEntry(normalizedWord);
    if (existing) {
      return existing;
    }

    const entry: WordEntry = {
      id: generateId(),
      word: normalizedWord,
      type,
      category: category || this.settings.defaultCategory,
      meaning,
      phonetic,
      audioUrlUK,
      audioUrlUS,
      source: this.plugin.app.workspace.getActiveFile()?.path,
      context,
      createdAt: now(),
      reviewCount: 0,
      lastReviewed: 0,
      nextReview: now(),
      easeFactor: this.settings.initialEaseFactor,
      interval: 0,
    };

    if (type === 'word') {
      this.data.words.push(entry);
    } else {
      this.data.phrases.push(entry);
    }

    await this.save();
    return entry;
  }

  /**
   * Remove an entry from wordbook
   */
  async removeEntry(id: string): Promise<void> {
    this.data.words = this.data.words.filter((w) => w.id !== id);
    this.data.phrases = this.data.phrases.filter((p) => p.id !== id);
    await this.save();
  }

  /**
   * Find an entry by word
   */
  findEntry(word: string): WordEntry | undefined {
    const normalizedWord = normalizeWord(word);
    return (
      this.data.words.find((w) => w.word === normalizedWord) ||
      this.data.phrases.find((p) => p.word === normalizedWord)
    );
  }

  /**
   * Get all entries (words + phrases)
   */
  getAllEntries(): WordEntry[] {
    return [...this.data.words, ...this.data.phrases];
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: string): WordEntry[] {
    return this.getAllEntries().filter((e) => e.category === category);
  }

  /**
   * Get entries due for review (SM-2)
   */
  getDueEntries(): WordEntry[] {
    const nowTimestamp = now();
    return this.getAllEntries().filter((e) => e.nextReview <= nowTimestamp);
  }

  /**
   * Update entry after review
   */
  async updateAfterReview(id: string, rating: number): Promise<void> {
    const entry = this.findEntryById(id);
    if (!entry) return;

    // SM-2 algorithm
    entry.reviewCount++;
    entry.lastReviewed = now();

    if (rating < 3) {
      // Failed - reset
      entry.interval = 1;
      entry.easeFactor = Math.max(1.3, entry.easeFactor - 0.2);
    } else {
      // Passed
      if (entry.interval === 0) {
        entry.interval = 1;
      } else if (entry.interval === 1) {
        entry.interval = 6;
      } else {
        entry.interval = Math.round(entry.interval * entry.easeFactor);
      }

      if (rating === 5) {
        entry.easeFactor += 0.1;
      } else if (rating === 4) {
        // No change
      } else {
        entry.easeFactor = Math.max(1.3, entry.easeFactor - 0.1);
      }
    }

    entry.nextReview = now() + entry.interval * 24 * 60 * 60 * 1000;
    await this.save();
  }

  /**
   * Find entry by ID
   */
  private findEntryById(id: string): WordEntry | undefined {
    return (
      this.data.words.find((w) => w.id === id) ||
      this.data.phrases.find((p) => p.id === id)
    );
  }

  // ==========================================================================
  // Category Management
  // ==========================================================================

  /**
   * Add a new category
   */
  async addCategory(name: string, color?: string): Promise<WordbookCategory> {
    const category: WordbookCategory = {
      id: generateId(),
      name,
      color,
      createdAt: now(),
    };

    this.data.categories.push(category);
    await this.save();
    return category;
  }

  /**
   * Remove a category
   */
  async removeCategory(id: string): Promise<void> {
    this.data.categories = this.data.categories.filter((c) => c.id !== id);

    // Move entries to default category
    const defaultCategory = this.settings.defaultCategory;
    for (const entry of this.getAllEntries()) {
      if (entry.category === id) {
        entry.category = defaultCategory;
      }
    }

    await this.save();
  }

  /**
   * Update category
   */
  async updateCategory(id: string, name: string, color?: string): Promise<void> {
    const category = this.data.categories.find((c) => c.id === id);
    if (category) {
      category.name = name;
      if (color !== undefined) {
        category.color = color;
      }
      await this.save();
    }
  }

  /**
   * Get all categories
   */
  getCategories(): WordbookCategory[] {
    return this.data.categories;
  }

  /**
   * Update entry category
   */
  async updateEntryCategory(entryId: string, categoryId: string): Promise<void> {
    const entry = this.findEntryById(entryId);
    if (entry) {
      entry.category = categoryId;
      await this.save();
    }
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  /**
   * Export wordbook to Markdown format
   */
  exportToMarkdown(categoryId?: string): string {
    const entries = categoryId
      ? this.getEntriesByCategory(categoryId)
      : this.getAllEntries();

    const category = categoryId
      ? this.data.categories.find((c) => c.id === categoryId)
      : null;

    let markdown = `# FleurDict ${category?.name || '生词本'}\n\n`;
    markdown += `> 导出时间：${new Date().toLocaleDateString('zh-CN')}\n`;
    markdown += `> 共 ${this.data.words.filter((w) => !categoryId || w.category === categoryId).length} 个单词 / ${this.data.phrases.filter((p) => !categoryId || p.category === categoryId).length} 个短语\n\n`;

    // Words section
    const words = entries.filter((e) => e.type === 'word');
    if (words.length > 0) {
      markdown += `## 单词\n\n`;
      for (const word of words) {
        markdown += `### ${word.word} ${word.phonetic}\n`;
        markdown += `- **释义**：${word.meaning}\n`;
        if (word.context) {
          markdown += `- **例句**：${word.context}\n`;
        }
        if (word.note) {
          markdown += `- **笔记**：${word.note}\n`;
        }
        if (word.source) {
          markdown += `- **来源**：[[${word.source}]]\n`;
        }
        markdown += `\n`;
      }
    }

    // Phrases section
    const phrases = entries.filter((e) => e.type === 'phrase');
    if (phrases.length > 0) {
      markdown += `## 短语搭配\n\n`;
      for (const phrase of phrases) {
        markdown += `### ${phrase.word}\n`;
        markdown += `- **释义**：${phrase.meaning}\n`;
        if (phrase.context) {
          markdown += `- **例句**：${phrase.context}\n`;
        }
        if (phrase.note) {
          markdown += `- **笔记**：${phrase.note}\n`;
        }
        if (phrase.source) {
          markdown += `- **来源**：[[${phrase.source}]]\n`;
        }
        markdown += `\n`;
      }
    }

    return markdown;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get wordbook statistics
   */
  getStats(): {
    totalWords: number;
    totalPhrases: number;
    totalEntries: number;
    dueToday: number;
    categoryCounts: Record<string, number>;
  } {
    const allEntries = this.getAllEntries();
    const dueToday = this.getDueEntries().length;

    const categoryCounts: Record<string, number> = {};
    for (const entry of allEntries) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
    }

    return {
      totalWords: this.data.words.length,
      totalPhrases: this.data.phrases.length,
      totalEntries: allEntries.length,
      dueToday,
      categoryCounts,
    };
  }
}
