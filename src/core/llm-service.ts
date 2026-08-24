/**
 * FleurDict - LLM Service
 * OpenAI-compatible API service with SSE streaming support
 */

import { requestUrl } from 'obsidian';
import { FleurDictSettings } from '../types';

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM response chunk
 */
export interface LLMChunk {
  content?: string;
  reasoning?: string;
  done: boolean;
}

/**
 * LLM Service - handles OpenAI-compatible API calls
 */
export class LLMService {
  private settings: FleurDictSettings;

  constructor(settings: FleurDictSettings) {
    this.settings = settings;
  }

  /**
   * Update settings
   */
  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  /**
   * Check if AI is configured
   */
  isConfigured(): boolean {
    return !!(this.settings.aiBaseUrl && this.settings.aiApiKey);
  }

  /**
   * Send message and get full response
   */
  async sendMessage(messages: ChatMessage[]): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('AI 未配置，请在设置中填写 API Key');
    }

    const url = `${this.settings.aiBaseUrl.replace(/\/$/, '')}/chat/completions`;

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.aiApiKey}`,
        },
        body: JSON.stringify({
          model: this.settings.aiModel,
          messages,
          temperature: this.settings.aiTemperature,
          max_tokens: this.settings.aiMaxTokens,
          stream: false,
        }),
      });

      if (response.status !== 200) {
        const errorText = response.text || `HTTP ${response.status}`;
        throw new Error(`API 错误：${errorText}`);
      }

      const data = response.json;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('FleurDict: LLM request failed:', error);
      throw error;
    }
  }

  /**
   * Send message with SSE streaming
   */
  async sendMessageStream(
    messages: ChatMessage[],
    onChunk: (chunk: LLMChunk) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): Promise<AbortController> {
    if (!this.isConfigured()) {
      onError(new Error('AI 未配置，请在设置中填写 API Key'));
      return new AbortController();
    }

    const url = `${this.settings.aiBaseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();

    // Use fetch for streaming (Obsidian's requestUrl doesn't support streaming well)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.aiApiKey}`,
        },
        body: JSON.stringify({
          model: this.settings.aiModel,
          messages,
          temperature: this.settings.aiTemperature,
          max_tokens: this.settings.aiMaxTokens,
          stream: this.settings.aiStreaming,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        onError(new Error(`API 错误：${response.status} ${errorText}`));
        return controller;
      }

      // Non-streaming response
      if (!this.settings.aiStreaming) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        onChunk({ content, done: true });
        onDone();
        return controller;
      }

      // Streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        onError(new Error('无法读取流式响应'));
        return controller;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') {
            if (trimmed === 'data: [DONE]') {
              onDone();
              return controller;
            }
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta;
              const content = delta?.content || '';
              const reasoning = delta?.reasoning_content || '';

              if (content || reasoning) {
                onChunk({
                  content: content || undefined,
                  reasoning: reasoning || undefined,
                  done: false,
                });
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      onDone();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User aborted
        onDone();
      } else {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return controller;
  }

  /**
   * Test AI connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: '请先填写 API Base URL 和 API Key' };
    }

    try {
      const result = await this.sendMessage([
        { role: 'user', content: '请用一句话回复：连接成功' },
      ]);

      if (result) {
        return { success: true, message: `连接成功：${result.substring(0, 50)}` };
      }

      return { success: false, message: '连接失败：无响应' };
    } catch (error) {
      return {
        success: false,
        message: `连接失败：${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }
}

/**
 * Build AI detail prompt for a word
 * Supports flexible arguments: (word, context?) or (word, phonetic, meanings, context?)
 */
export function buildAIDetailPrompt(
  word: string,
  phoneticOrContext?: string,
  meanings?: string,
  context?: string
): ChatMessage[] {
  const systemPrompt = `你是一位资深英语教师，请对以下英语单词/短语进行详细讲解。回答要简洁、有条理，使用中文讲解，英文示例。

请按以下结构讲解：
1. **音标**：英式 + 美式
2. **核心含义**：用简洁中文概括
3. **详细释义**：分词性列出，每个释义配 1-2 个例句
4. **常见搭配**：列出 3-5 个高频搭配
5. **词源记忆**：简要词源拆解，帮助记忆
6. **近义辨析**：与易混淆词对比（如有）
7. **用法提示**：正式/非正式、英式/美式差异等`;

  // Determine if called with (word, context?) or (word, phonetic, meanings, context?)
  let phonetic = '';
  let meaningsText = '';
  let contextText = '';

  if (meanings !== undefined) {
    // Full signature: (word, phonetic, meanings, context?)
    phonetic = phoneticOrContext || '';
    meaningsText = meanings;
    contextText = context || '';
  } else {
    // Short signature: (word, context?)
    contextText = phoneticOrContext || '';
  }

  let userPrompt = `请详细讲解这个${word.includes(' ') ? '短语' : '单词'}：\n\n`;
  userPrompt += `单词/短语：${word}\n`;
  if (phonetic) {
    userPrompt += `音标：${phonetic}\n`;
  }
  if (meaningsText) {
    userPrompt += `基础释义：${meaningsText}\n`;
  }
  if (contextText) {
    userPrompt += `当前语境：${contextText}\n`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Build AI translation prompt
 * Supports flexible arguments: (text) or (text, context?)
 */
export function buildAITranslatePrompt(text: string, context?: string): ChatMessage[] {
  let userContent = `请翻译以下内容：\n\n${text}`;
  if (context) {
    userContent += `\n\n上下文：${context}`;
  }
  userContent +=
    '\n\n请结合上下文给出最准确的翻译，如果是多义词请选择最符合语境的含义。如果是英文翻译成中文，如果是中文翻译成英文。只返回翻译结果，不要额外解释。';

  return [
    {
      role: 'system',
      content:
        '你是一位专业翻译，擅长结合语境进行准确翻译。请翻译为流畅自然的中文。',
    },
    { role: 'user', content: userContent },
  ];
}

/**
 * Build AI context-aware translation prompt (alias)
 */
export function buildAIContextTranslatePrompt(
  text: string,
  context?: string
): ChatMessage[] {
  return buildAITranslatePrompt(text, context);
}
