/**
 * FleurDict - Type Definitions
 */

/**
 * Plugin Settings
 */
export interface FleurDictSettings {
  // 词典源
  dictionarySource: 'youdao' | 'free-dict' | 'both'; // 有道 / Free Dictionary / 两者都用

  // 欧路词典同步
  eudicEnabled: boolean;
  eudicToken: string;
  eudicCategoryId: string;
  eudicSyncMode: 'manual' | 'auto';
  eudicLanguage: 'en' | 'fr' | 'de' | 'es';

  // 缓存
  cacheEnabled: boolean;
  cacheDays: number;

  // AI 设置
  aiProvider: 'deepseek' | 'qwen' | 'glm' | 'siliconflow' | 'custom';
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  aiStreaming: boolean;

  // 生词本
  autoAddToWordbook: boolean;
  autoAddThreshold: number;
  defaultCategory: string;

  // 闪卡
  dailyNewCardsLimit: number;
  dailyReviewLimit: number;
  autoPlayAudio: boolean;
  initialEaseFactor: number;

  // UI
  popupPosition: 'selection' | 'right' | 'top';
  popupWidth: number;
  popupHeight?: number;
  popupLeft?: number;
  popupTop?: number;
  showPhonetic: boolean;
  showExamples: boolean;
  showAudioButton: boolean;
  showAIDetailButton: boolean;
  showAddToWordbookButton: boolean;

  // 行为
  autoLookup: boolean;
  language: 'zh-CN' | 'en';
  
  // 音频偏好
  audioPreference: 'uk' | 'us'; // 英音 / 美音

  // 生词本上下文模式（参考 FleurPilot）
  contextMode: 'active' | 'all' | 'custom' | 'none';
  contextPath: string; // 自定义选择的单个文件夹或笔记路径

  // 阅读模式右键菜单
  readingModeContextMenu: boolean;
}

export const DEFAULT_SETTINGS: FleurDictSettings = {
  // 词典源：默认有道（中文释义）
  dictionarySource: 'youdao',

  // 欧路词典同步
  eudicEnabled: false,
  eudicToken: '',
  eudicCategoryId: '0',
  eudicSyncMode: 'manual',
  eudicLanguage: 'en',

  // 缓存
  cacheEnabled: true,
  cacheDays: 7,

  // AI 设置
  aiProvider: 'deepseek',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiApiKey: '',
  aiModel: 'deepseek-chat',
  aiTemperature: 0.7,
  aiMaxTokens: 8092,
  aiStreaming: true,

  // 生词本
  autoAddToWordbook: true,
  autoAddThreshold: 3,
  defaultCategory: '未分类',

  // 闪卡
  dailyNewCardsLimit: 20,
  dailyReviewLimit: 200,
  autoPlayAudio: true,
  initialEaseFactor: 2.5,

  // UI
  popupPosition: 'selection',
  popupWidth: 420,
  showPhonetic: true,
  showExamples: true,
  showAudioButton: true,
  showAIDetailButton: true,
  showAddToWordbookButton: true,

  // 行为
  autoLookup: false,
  language: 'zh-CN',
  
  // 音频偏好
  audioPreference: 'uk',

  // 生词本上下文模式
  contextMode: 'active',
  contextPath: '',

  // 阅读模式右键菜单
  readingModeContextMenu: false,
};

/**
 * 欧路词典生词本分类
 */
export interface EudicCategory {
  id: string;
  name: string;
  language?: string;
}

/**
 * 欧路词典单词条目
 */
export interface EudicWord {
  word: string;
  phon?: string;
  exp?: string;
  add_time?: string;
  star?: number;
  context_line?: string;
}

/**
 * 欧路词典 API 响应
 */
export interface EudicApiResponse<T> {
  data?: T;
  message?: string;
}

/**
 * Dictionary Result (from a single source)
 */
export interface DictionaryResult {
  source: string;
  entries: DictionaryEntry[];
  error?: string;
}

/**
 * Dictionary Entry (a single word)
 */
export interface DictionaryEntry {
  word: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
  sourceUrls?: string[];
  license?: License;
}

export interface Phonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: License;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface License {
  name: string;
  url: string;
}

/**
 * Wordbook Entry
 */
export interface WordEntry {
  id: string;
  word: string;
  type: 'word' | 'phrase';
  category: string;
  meaning: string;
  phonetic: string;
  phoneticUK?: string;
  phoneticUS?: string;
  audioUrlUK?: string;
  audioUrlUS?: string;
  source?: string;
  context?: string;
  note?: string;
  createdAt: number;
  reviewCount: number;
  lastReviewed: number;
  nextReview: number;
  easeFactor: number;
  interval: number;
  proficiency: number;
  consecutiveCorrect: number;
}

/**
 * Wordbook Category
 */
export interface WordbookCategory {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

/**
 * Wordbook Data
 */
export interface WordbookData {
  words: WordEntry[];
  phrases: WordEntry[];
  categories: WordbookCategory[];
}

/**
 * Flashcard Session
 */
export interface FlashcardSession {
  mode: FlashcardMode;
  categoryId?: string;
  cards: WordEntry[];
  currentIndex: number;
  reviewedCount: number;
  startTime: number;
}

/**
 * Flashcard Mode
 */
export type FlashcardMode = 'due' | 'category' | 'all' | 'random';

/**
 * Flashcard Rating (SM-2)
 */
export type FlashcardRating = 0 | 1 | 2 | 3 | 4 | 5;
