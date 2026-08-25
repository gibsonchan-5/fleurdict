/**
 * FleurDict - Online Dictionary API Adapters
 * 
 * 1. YoudaoDictionaryAPI - 有道词典（中文释义，免费无需 Key）
 * 2. FreeDictionaryAPI - Free Dictionary API（英文释义，备用）
 */

import { DictionaryEntry } from '../types';
import { requestUrl } from 'obsidian';

// Use requestUrl as primary (no CORS issues in Electron), fetch as fallback
async function httpGet(url: string): Promise<{ status: number; json: any }> {
  try {
    const resp = await requestUrl({ url, method: 'GET' });
    return { status: resp.status, json: resp.json };
  } catch (reqErr: any) {
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      return { status: resp.status, json };
    } catch (fetchErr: any) {
      throw reqErr;
    }
  }
}

/**
 * Base interface for online dictionary sources
 */
export interface OnlineDictionarySource {
  query(word: string): Promise<DictionaryEntry[]>;
}

/**
 * 有道词典 API (dict.youdao.com/jsonapi)
 * - 免费，无需 API Key
 * - 返回中文释义（英汉词典）
 * - 英式/美式音标 + 真人发音
 */
export class YoudaoDictionaryAPI implements OnlineDictionarySource {
  async query(word: string): Promise<DictionaryEntry[]> {
    try {
      const dictsParam = encodeURIComponent(JSON.stringify({ count: 99, dicts: [['ec']] }));
      const url = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}&dicts=${dictsParam}`;

      // Use httpGet (fetch primary, requestUrl fallback)
      const response = await httpGet(url);

      const entries = this.parseYoudaoData(response.json, word);
      return entries;
    } catch (error) {
      console.error('FleurDict: YoudaoDictionaryAPI error:', error);
      throw error;
    }
  }

  /**
   * Parse Youdao jsonapi response
   */
  private parseYoudaoData(data: any, word: string): DictionaryEntry[] {
    const ec = data?.ec;
    if (!ec || !ec.word || ec.word.length === 0) {
      return [];
    }

    const wordData = ec.word[0];

    const entries: DictionaryEntry[] = [];

    // Build phonetics from Youdao data
    const phonetics: DictionaryEntry['phonetics'] = [];
    
    // UK phonetic
    if (wordData.ukphone) {
      // Youdao provides audio via dictvoice with type parameter
      // type=1 for UK, type=2 for US
      phonetics.push({
        text: `英 ${wordData.ukphone}`,
        audio: `https://dict.youdao.com/dictvoice?audio=${word}&type=1`,
      });
    }
    
    // US phonetic
    if (wordData.usphone) {
      phonetics.push({
        text: `美 ${wordData.usphone}`,
        audio: `https://dict.youdao.com/dictvoice?audio=${word}&type=2`,
      });
    }
    
    // No fallback audio push when there is no phonetic text — otherwise the popup
    // would render an empty colored badge. Audio playback is still available via
    // the dict-popup's own audio fallback when a phonetic with text is present.

    // Filter out any phonetic that has no displayable IPA text after stripping the "英"/"美" prefix.
    // This is the second line of defense against empty badges.
    const validPhonetics = phonetics.filter((p) => {
      if (!p.text) return false;
      const ipa = p.text.replace(/^[英美]\s*/, '').trim();
      return ipa.length > 0;
    });
    phonetics.length = 0;
    phonetics.push(...validPhonetics);

    // Parse Chinese definitions grouped by part of speech
    const posMap = new Map<string, DictionaryEntry['meanings'][0]>();

    if (wordData.trs && Array.isArray(wordData.trs)) {
      for (const trOuter of wordData.trs) {
        // trOuter.tr is an ARRAY of {l: {i: [...]}} objects
        const trArray = trOuter.tr;
        if (!Array.isArray(trArray)) continue;

        for (const trItem of trArray) {
          const l = trItem?.l;
          if (!l) continue;

          // l.i can be an array of strings or a single string
          let fullDef: string;
          if (Array.isArray(l.i)) {
            fullDef = l.i.join('');
          } else if (typeof l.i === 'string') {
            fullDef = l.i;
          } else {
            continue;
          }

          // Parse "n. 释义内容" or "v. 释义内容"
          const posMatch = fullDef.match(/^([a-z]+\.)\s*(.+)$/i);
          let pos = '';
          let definition = fullDef;

          if (posMatch) {
            pos = this.normalizePOS(posMatch[1]);
            definition = posMatch[2];
          }

          if (!posMap.has(pos)) {
            posMap.set(pos, {
              partOfSpeech: pos,
              definitions: [],
              synonyms: [],
              antonyms: [],
            });
          }

          // Split definition by Chinese semicolons — Youdao joins many senses with "；"
          const subDefs = definition.split(/[；;]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);

          for (const subDef of subDefs) {
            posMap.get(pos)!.definitions.push({
              definition: subDef,
              example: null,
              synonyms: [],
              antonyms: [],
            });
          }
        }
      }
    }

    const meanings = Array.from(posMap.values());

    // Build the entry
    // return-phrase can be a string ("appointment") or an object ({l: {i: "appointment"}})
    const rp = wordData['return-phrase'];
    let entryWord: string;
    if (typeof rp === 'string') {
      entryWord = rp;
    } else if (rp?.l?.i) {
      entryWord = Array.isArray(rp.l.i) ? rp.l.i.join('') : String(rp.l.i);
    } else {
      entryWord = word;
    }

    const entry: DictionaryEntry = {
      word: entryWord,
      phonetics,
      meanings,
      sourceUrls: ['https://dict.youdao.com'],
    };

    entries.push(entry);

    // exam_type tags (e.g. 初中, 高中, CET4) are NOT synonyms — skip them

    return entries;
  }

  private normalizePOS(pos: string): string {
    const posMap: Record<string, string> = {
      'n.': 'noun',
      'v.': 'verb',
      'vt.': 'verb',
      'vi.': 'verb',
      'adj.': 'adjective',
      'adv.': 'adverb',
      'prep.': 'preposition',
      'conj.': 'conjunction',
      'pron.': 'pronoun',
      'int.': 'interjection',
      'interj.': 'interjection',
      'det.': 'determiner',
      'art.': 'article',
      'aux.': 'auxiliary',
    };
    return posMap[pos.toLowerCase()] || pos;
  }
}

/**
 * Free Dictionary API (dictionaryapi.dev)
 * - Free, no API key required
 * - English definitions only (Wiktionary/WordNet data)
 */
export class FreeDictionaryAPI implements OnlineDictionarySource {
  async query(word: string): Promise<DictionaryEntry[]> {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const response = await requestUrl({ url, method: 'GET' });

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = response.json;
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => this.parseEntry(item));
    } catch (error) {
      console.error('FleurDict: FreeDictionaryAPI error:', error);
      throw error;
    }
  }

  private parseEntry(data: any): DictionaryEntry {
    return {
      word: data.word || '',
      phonetics: (data.phonetics || []).map((p: any) => ({
        text: p.text || '',
        audio: p.audio || '',
        sourceUrl: p.sourceUrl,
      })),
      meanings: (data.meanings || []).map((m: any) => ({
        partOfSpeech: m.partOfSpeech || '',
        definitions: (m.definitions || []).map((d: any) => ({
          definition: d.definition || '',
          example: d.example,
          synonyms: d.synonyms || [],
          antonyms: d.antonyms || [],
        })),
        synonyms: m.synonyms || [],
        antonyms: m.antonyms || [],
      })),
      sourceUrls: data.sourceUrls || [],
    };
  }
}
