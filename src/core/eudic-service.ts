/**
 * FleurDict - Eudic Service
 * 欧路词典 OpenAPI 集成
 * 文档: https://my.eudic.net/OpenAPI/doc_api_study
 */

import { Plugin, Notice, requestUrl } from 'obsidian';
import {
  FleurDictSettings,
  EudicCategory,
  EudicWord,
  EudicApiResponse,
} from '../types';

const EUDIC_API_BASE = 'https://api.frdic.com/api/open/v1';

/**
 * Eudic Service - 管理欧路词典生词本同步
 */
export class EudicService {
  private plugin: Plugin;
  private settings: FleurDictSettings;

  constructor(plugin: Plugin, settings: FleurDictSettings) {
    this.plugin = plugin;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  /**
   * Check if Eudic API is configured
   */
  isConfigured(): boolean {
    return !!this.settings.eudicToken;
  }

  /**
   * Make API request with auth
   */
  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<EudicApiResponse<T>> {
    if (!this.settings.eudicToken) {
      throw new Error('未配置欧路词典 API Token');
    }

    const url = `${EUDIC_API_BASE}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `NIS ${this.settings.eudicToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const resp = await requestUrl({
        url,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // 204 No Content
      if (resp.status === 204) {
        return { message: 'success' } as EudicApiResponse<T>;
      }

      return resp.json as EudicApiResponse<T>;
    } catch (err: any) {
      const status = err?.status || err?.response?.status || 'unknown';
      const detail = err?.message || JSON.stringify(err);
      console.error('[FleurDict-DIAG] Eudic API request failed:', detail);
      throw new Error(`欧路 API 错误 (${status}): ${detail}`);
    }
  }

  // ============================================================================
  // 生词本分类管理
  // ============================================================================

  /**
   * 获取所有生词本分类
   */
  async getCategories(): Promise<EudicCategory[]> {
    try {
      const res = await this.request<EudicCategory[]>(
        `/studylist/category?language=${this.settings.eudicLanguage}`
      );
      return res.data || [];
    } catch (error) {
      console.error('FleurDict: Failed to get Eudic categories:', error);
      throw error;
    }
  }

  /**
   * 创建新分类
   */
  async createCategory(name: string): Promise<EudicCategory> {
    try {
      const res = await this.request<EudicCategory>(
        '/studylist/category',
        'POST',
        {
          language: this.settings.eudicLanguage,
          name,
        }
      );
      return res.data!;
    } catch (error) {
      console.error('FleurDict: Failed to create Eudic category:', error);
      throw error;
    }
  }

  /**
   * 重命名分类
   */
  async renameCategory(id: string, name: string): Promise<void> {
    await this.request('/studylist/category', 'PATCH', {
      id,
      language: this.settings.eudicLanguage,
      name,
    });
  }

  /**
   * 删除分类
   */
  async deleteCategory(id: string): Promise<void> {
    await this.request('/studylist/category', 'DELETE', {
      id,
      language: this.settings.eudicLanguage,
      name: '',
    });
  }

  // ============================================================================
  // 单词管理
  // ============================================================================

  /**
   * 获取分类中的单词列表
   */
  async getWords(
    categoryId: string = '0',
    page: number = 0,
    pageSize: number = 100
  ): Promise<EudicWord[]> {
    try {
      const res = await this.request<EudicWord[]>(
        `/studylist/words?language=${this.settings.eudicLanguage}&category_id=${categoryId}&page=${page}&page_size=${pageSize}`
      );
      return res.data || [];
    } catch (error) {
      console.error('FleurDict: Failed to get Eudic words:', error);
      throw error;
    }
  }

  /**
   * 添加单词到生词本
   */
  async addWord(word: string, context?: string, star: number = 2): Promise<void> {
    try {
      await this.request('/studylist/words', 'POST', {
        category_id: this.settings.eudicCategoryId,
        language: this.settings.eudicLanguage,
        words: [word],
      });
      console.log(`FleurDict: Added word "${word}" to Eudic`);
    } catch (error) {
      console.error('FleurDict: Failed to add word to Eudic:', error);
      throw error;
    }
  }

  /**
   * 批量添加单词
   */
  async addWords(words: string[]): Promise<void> {
    if (words.length === 0) return;

    try {
      const body = {
        category_id: this.settings.eudicCategoryId,
        language: this.settings.eudicLanguage,
        words,
      };
      console.log('[FleurDict-DIAG] addWords sending:', JSON.stringify(body));
      const result = await this.request('/studylist/words', 'POST', body);
      console.log(`[FleurDict-DIAG] addWords result:`, JSON.stringify(result));
      console.log(`FleurDict: Added ${words.length} words to Eudic`);
    } catch (error) {
      console.error('FleurDict: Failed to batch add words to Eudic:', error);
      throw error;
    }
  }

  /**
   * 删除单词
   */
  async deleteWord(word: string): Promise<void> {
    try {
      await this.request('/studylist/words', 'DELETE', {
        category_id: this.settings.eudicCategoryId,
        language: this.settings.eudicLanguage,
        words: [word],
      });
      console.log(`FleurDict: Deleted word "${word}" from Eudic`);
    } catch (error) {
      console.error('FleurDict: Failed to delete word from Eudic:', error);
      throw error;
    }
  }

  /**
   * 查询单个单词详情
   */
  async getWordDetail(word: string): Promise<EudicWord | null> {
    try {
      const res = await this.request<EudicWord>(
        `/studylist/word?language=${this.settings.eudicLanguage}&word=${encodeURIComponent(word)}`
      );
      return res.data || null;
    } catch (error) {
      console.error('FleurDict: Failed to get word detail from Eudic:', error);
      return null;
    }
  }

  /**
   * 添加/更新单个单词（带详细信息）
   */
  async addWordWithDetail(
    word: string,
    options: {
      star?: number;
      context_line?: string;
      category_ids?: string[];
    } = {}
  ): Promise<void> {
    try {
      await this.request('/studylist/word', 'POST', {
        language: this.settings.eudicLanguage,
        word,
        star: options.star || 2,
        context_line: options.context_line || '',
        category_ids: options.category_ids || [this.settings.eudicCategoryId],
      });
    } catch (error) {
      console.error('FleurDict: Failed to add word with detail to Eudic:', error);
      throw error;
    }
  }

  // ============================================================================
  // 同步功能
  // ============================================================================

  /**
   * 同步本地生词本到欧路
   */
  async syncLocalToEudic(localWords: string[]): Promise<{ added: number; failed: number }> {
    if (!this.isConfigured()) {
      throw new Error('未配置欧路词典 API Token');
    }

    try {
      console.log('[FleurDict-DIAG] syncLocalToEudic called with', localWords.length, 'words:', localWords);
      console.log('[FleurDict-DIAG] eudicCategoryId:', this.settings.eudicCategoryId);
      console.log('[FleurDict-DIAG] eudicLanguage:', this.settings.eudicLanguage);

      // 获取欧路现有单词（取全部，分页循环）
      let eudicWords: EudicWord[] = [];
      let page = 0;
      const pageSize = 100;
      while (true) {
        const batch = await this.getWords(this.settings.eudicCategoryId || '0', page, pageSize);
        console.log('[FleurDict-DIAG] Eudic page', page, 'returned', batch.length, 'words');
        eudicWords = eudicWords.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      const eudicWordSet = new Set(eudicWords.map(w => w.word.toLowerCase()));
      console.log('[FleurDict-DIAG] Eudic total words:', eudicWords.length);
      console.log('[FleurDict-DIAG] Eudic first 10 words:', JSON.stringify(eudicWords.slice(0, 10).map(w => w.word)));
      console.log('[FleurDict-DIAG] Local words sample:', JSON.stringify(localWords.slice(0, 10)));

      // 找出需要同步的单词
      const toSync = localWords.filter(
        w => !eudicWordSet.has(w.toLowerCase())
      );
      console.log('[FleurDict-DIAG] Words to sync:', toSync.length, JSON.stringify(toSync.slice(0, 10)));

      if (toSync.length === 0) {
        console.log('[FleurDict-DIAG] Nothing to sync - all local words already in Eudic');
        return { added: 0, failed: 0 };
      }

      // 分批同步（每批 50 个）
      let added = 0;
      let failed = 0;
      const batchSize = 50;

      for (let i = 0; i < toSync.length; i += batchSize) {
        const batch = toSync.slice(i, i + batchSize);
        try {
          await this.addWords(batch);
          added += batch.length;
        } catch (error) {
          console.error('[FleurDict-DIAG] Failed to sync batch:', error);
          failed += batch.length;
        }
      }

      console.log('[FleurDict-DIAG] Sync result: added=' + added + ', failed=' + failed);
      return { added, failed };
    } catch (error) {
      console.error('[FleurDict-DIAG] Failed to sync to Eudic:', error);
      throw error;
    }
  }

  /**
   * 从欧路同步单词到本地
   */
  async syncEudicToLocal(): Promise<EudicWord[]> {
    if (!this.isConfigured()) {
      throw new Error('未配置欧路词典 API Token');
    }

    try {
      const words = await this.getWords(this.settings.eudicCategoryId);
      return words;
    } catch (error) {
      console.error('FleurDict: Failed to sync from Eudic:', error);
      throw error;
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getCategories();
      return true;
    } catch (error) {
      console.error('FleurDict: Eudic API connection test failed:', error);
      return false;
    }
  }
}
