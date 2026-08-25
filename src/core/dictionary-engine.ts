/**
 * FleurDict - Dictionary Engine
 * 默认使用有道词典（中文释义），Free Dictionary API 作为兜底
 */

import {
  DictionaryEntry,
  DictionaryResult,
  FleurDictSettings,
} from '../types';
import { YoudaoDictionaryAPI, FreeDictionaryAPI } from './online-dict';
import { normalizeWord } from '../utils/helpers';

/**
 * Dictionary engine - manages Youdao (primary) + Free Dict (fallback) + cache
 */
export class DictionaryEngine {
  private settings: FleurDictSettings;
  private youdaoAPI: YoudaoDictionaryAPI;
  private freeDictAPI: FreeDictionaryAPI;
  private cache: Map<string, { data: DictionaryResult; timestamp: number }>;

  constructor(plugin: any, settings: FleurDictSettings) {
    this.plugin = plugin;
    this.settings = { ...settings };
    this.youdaoAPI = new YoudaoDictionaryAPI();
    this.freeDictAPI = new FreeDictionaryAPI();
    this.cache = new Map();
  }

  /**
   * Update settings
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  /**
   * Query a word - 先查有道，失败再查 Free Dictionary API
   */
  async query(word: string): Promise<DictionaryResult[]> {
    const normalizedWord = normalizeWord(word);

    // Check cache first
    if (this.settings.cacheEnabled) {
      const cached = this.getCached(normalizedWord);
      if (cached) {
        return [cached];
      }
    }

    const source = this.settings.dictionarySource || 'youdao';

    // Source: 'youdao' (default)
    if (source === 'youdao' || source === 'both') {
      try {
        const entries = await this.youdaoAPI.query(normalizedWord);
        if (entries.length > 0) {
          const result: DictionaryResult = { source: 'youdao', entries };
          if (this.settings.cacheEnabled) this.setCache(normalizedWord, result);
          return [result];
        }
      } catch (error) {
        console.error('FleurDict: Youdao query failed:', error);
      }
    }

    // Source: 'free-dict' or 'both' (no fallback when source is explicitly 'youdao')
    if (source === 'free-dict' || source === 'both') {
      try {
        const entries = await this.freeDictAPI.query(normalizedWord);
        if (entries.length > 0) {
          const result: DictionaryResult = { source: 'free-dict', entries };
          if (this.settings.cacheEnabled) this.setCache(normalizedWord, result);
          return [result];
        }
      } catch (error) {
        console.error('FleurDict: FreeDict query failed:', error);
      }
    }

    return [{ source: 'error', entries: [], error: '查询失败' }];
  }

  /**
   * Get cached result
   */
  private getCached(word: string): DictionaryResult | null {
    const cached = this.cache.get(word);
    if (!cached) return null;

    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = this.settings.cacheDays * 24 * 60 * 60 * 1000;

    if (cacheAge > maxAge) {
      this.cache.delete(word);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache
   */
  private setCache(word: string, data: DictionaryResult): void {
    this.cache.set(word, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get phonetic text from entry
   */
  static getPhonetic(entry: DictionaryEntry): string {
    const phonetic = entry.phonetics.find((p) => p.text);
    return phonetic?.text || '';
  }

  /**
   * Get audio URL from entry
   */
  static getAudioUrl(entry: DictionaryEntry): string | null {
    const phonetic = entry.phonetics.find((p) => p.audio);
    return phonetic?.audio || null;
  }

  /**
   * Get first definition from entry
   */
  static getFirstDefinition(entry: DictionaryEntry): string {
    for (const meaning of entry.meanings) {
      if (meaning.definitions.length > 0) {
        return meaning.definitions[0].definition;
      }
    }
    return '';
  }

  /**
   * Get all definitions from entry (combined, grouped by POS)
   */
  static getAllDefinitions(entry: DictionaryEntry): string {
    const parts: string[] = [];
    for (const meaning of entry.meanings) {
      if (meaning.definitions.length === 0) continue;
      const defs = meaning.definitions.map((d) => d.definition).join('；');
      if (meaning.partOfSpeech) {
        parts.push(`${meaning.partOfSpeech} ${defs}`);
      } else {
        parts.push(defs);
      }
    }
    return parts.join('；');
  }
}
