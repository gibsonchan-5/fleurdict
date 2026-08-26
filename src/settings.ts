/**
 * FleurDict - Settings Tab
 * Plugin settings UI
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type FleurDictPlugin from './main';

/**
 * FleurDict settings tab
 */
export class FleurDictSettingTab extends PluginSettingTab {
  plugin: FleurDictPlugin;

  // DOM control refs for AI settings (to sync on provider switch)
  private aiBaseUrlText: any;
  private aiModelText: any;

  constructor(app: App, plugin: FleurDictPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('fleurdict-settings');

    // =========================================================================
    // Section 1: Dictionary Sources
    // =========================================================================
    const dictSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(dictSection).setHeading().setName('词典源设置');

    dictSection.createEl('p', {
      text: '查词引擎优先使用有道词典（免费、无需配置，中文释义），无结果时自动切换英文词典。',
      cls: 'fleurdict-settings-desc',
    });

    new Setting(dictSection)
      .setName('词典源')
      .setDesc('选择查词使用的词典源（推荐：有道词典，含中文释义）')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('youdao', '有道词典（中文释义）')
          .addOption('free-dict', 'Free Dictionary API（英文释义）')
          .addOption('both', '两者都用（有道优先，无结果则英文）')
          .setValue(this.plugin.settings.dictionarySource)
          .onChange(async (value: 'youdao' | 'free-dict' | 'both') => {
            this.plugin.settings.dictionarySource = value;
            await this.plugin.saveSettings();
            new Notice(`词典源已切换为：${value === 'youdao' ? '有道词典' : value === 'free-dict' ? 'Free Dictionary' : '两者都用'}`);
          })
      );

    new Setting(dictSection)
      .setName('发音偏好')
      .setDesc('选择英式发音或美式发音作为默认播放口音（查词弹窗、闪卡复习均适用）')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('uk', '英式发音 (UK)')
          .addOption('us', '美式发音 (US)')
          .setValue(this.plugin.settings.audioPreference || 'uk')
          .onChange(async (value: 'uk' | 'us') => {
            this.plugin.settings.audioPreference = value;
            await this.plugin.saveSettings();
            new Notice(`发音偏好已切换为：${value === 'uk' ? '英式发音' : '美式发音'}`);
          })
      );

    new Setting(dictSection)
      .setName('启用缓存')
      .setDesc('缓存在线词典查询结果，减少重复请求')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.cacheEnabled)
          .onChange(async (value) => {
            this.plugin.settings.cacheEnabled = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(dictSection)
      .setName('缓存有效期')
      .setDesc('缓存数据的保留天数')
      .addSlider((slider) => {
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.cacheDays)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cacheDays = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(dictSection)
      .setName('清除缓存')
      .setDesc('清除所有已缓存的词典数据')
      .addButton((button) => {
        button
          .setButtonText('清除')
          .setWarning()
          .onClick(async () => {
            this.plugin.dictEngine.clearCache();
            button.setButtonText('已清除 ✓');
            setTimeout(() => button.setButtonText('清除'), 2000);
          });
      });

    // =========================================================================
    // Section 2: Eudic Sync (欧路词典同步)
    // =========================================================================
    const eudicSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(eudicSection).setHeading().setName('欧路词典同步');

    eudicSection.createEl('p', {
      text: '将 Obsidian 生词本与欧路词典 App 双向同步。获取 Token：欧路词典官网 → 个人中心 → 开放 API。',
      cls: 'fleurdict-settings-desc',
    });

    new Setting(eudicSection)
      .setName('启用欧路同步')
      .setDesc('开启后可将生词同步到欧路词典 App，多端共享词库')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.eudicEnabled)
          .onChange(async (value) => {
            this.plugin.settings.eudicEnabled = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(eudicSection)
      .setName('API Token')
      .setDesc('欧路词典 OpenAPI Token（在 my.eudic.net 获取）')
      .addText((text) => {
        text
          .setPlaceholder('输入你的 API Token')
          .setValue(this.plugin.settings.eudicToken)
          .onChange(async (value) => {
            this.plugin.settings.eudicToken = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(eudicSection)
      .setName('语言')
      .setDesc('生词本对应的语言')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('en', '英语')
          .addOption('fr', '法语')
          .addOption('de', '德语')
          .addOption('es', '西班牙语')
          .setValue(this.plugin.settings.eudicLanguage)
          .onChange(async (value) => {
            this.plugin.settings.eudicLanguage = value as any;
            await this.plugin.saveSettings();
            // Reload categories after language change
            this.display();
          });
      });

    new Setting(eudicSection)
      .setName('同步模式')
      .setDesc('手动：点击按钮同步；自动：每次加入生词本时自动同步到欧路')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('manual', '手动同步')
          .addOption('auto', '自动同步')
          .setValue(this.plugin.settings.eudicSyncMode)
          .onChange(async (value) => {
            this.plugin.settings.eudicSyncMode = value as any;
            await this.plugin.saveSettings();
          });
      });

    // Test connection button
    new Setting(eudicSection)
      .setName('测试连接')
      .setDesc('验证 API Token 是否有效')
      .addButton((button) => {
        button
          .setButtonText('测试')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('测试中...');
            const ok = await this.plugin.eudicService.testConnection();
            if (ok) {
              button.setButtonText('连接成功 ✓');
              button.setCta();
              new Notice('✓ 欧路词典连接成功');
            } else {
              button.setButtonText('连接失败 ✗');
              button.setWarning();
            }
            setTimeout(() => {
              button.setDisabled(false);
              button.setButtonText('测试');
              button.removeCta();
              button.removeWarning();
            }, 3000);
          });
      });

    // Sync buttons
    new Setting(eudicSection)
      .setName('同步操作')
      .setDesc('手动触发同步')
      .addButton((button) => {
        button
          .setButtonText('本地 → 欧路')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('同步中...');
            try {
              const localWords = this.plugin.wordbookManager.getAllEntries().map(e => e.word);
              const result = await this.plugin.eudicService.syncLocalToEudic(localWords);
              if (result.added === 0) {
                new Notice(`✓ 已是最新，本地 ${localWords.length} 个单词已同步到欧路`);
              } else {
                new Notice(`✓ 已同步 ${result.added} 个单词到欧路词典`);
              }
            } catch (error) {
              new Notice(`同步失败：${error}`);
            }
            button.setDisabled(false);
            button.setButtonText('本地 → 欧路');
          });
      })
      .addButton((button) => {
        button
          .setButtonText('欧路 → 本地')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('同步中...');
            try {
              const words = await this.plugin.eudicService.syncEudicToLocal();
              let added = 0;
              for (const w of words) {
                const existing = this.plugin.wordbookManager.findEntry(w.word);
                if (!existing) {
                  await this.plugin.wordbookManager.addEntry(
                    w.word,
                    w.exp || '',
                    w.phon || '',
                    w.context_line
                  );
                  added++;
                }
              }
              new Notice(`✓ 从欧路同步了 ${added} 个新单词到本地`);
            } catch (error) {
              new Notice(`同步失败：${error}`);
            }
            button.setDisabled(false);
            button.setButtonText('欧路 → 本地');
          });
      });

    // =========================================================================
    // Section 3: AI Settings
    // =========================================================================
    const aiSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(aiSection).setHeading().setName('AI 设置');

    new Setting(aiSection)
      .setName('AI Provider')
      .setDesc('选择 AI 服务提供商')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('deepseek', 'DeepSeek')
          .addOption('qwen', '通义千问')
          .addOption('glm', '智谱 GLM')
          .addOption('siliconflow', 'SiliconFlow')
          .addOption('custom', '自定义')
          .setValue(this.plugin.settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider = value as any;
            await this.applyProviderPreset(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(aiSection)
      .setName('API Base URL')
      .setDesc('AI API 的基础 URL')
      .addText((text) => {
        this.aiBaseUrlText = text;
        text
          .setPlaceholder('https://api.deepseek.com/v1')
          .setValue(this.plugin.settings.aiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.aiBaseUrl = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(aiSection)
      .setName('API Key')
      .setDesc('AI API 密钥')
      .addText((text) => {
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.aiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.aiApiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(aiSection)
      .setName('模型')
      .setDesc('使用的 AI 模型名称')
      .addText((text) => {
        this.aiModelText = text;
        text
          .setPlaceholder('deepseek-chat')
          .setValue(this.plugin.settings.aiModel)
          .onChange(async (value) => {
            this.plugin.settings.aiModel = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(aiSection)
      .setName('Temperature')
      .setDesc('AI 回复的创造性程度（0 = 确定性，1 = 创造性）')
      .addSlider((slider) => {
        slider
          .setLimits(0, 1, 0.1)
          .setValue(this.plugin.settings.aiTemperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.aiTemperature = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(aiSection)
      .setName('Max Tokens')
      .setDesc('AI 回复的最大 token 数')
      .addText((text) => {
        text
          .setPlaceholder('2048')
          .setValue(String(this.plugin.settings.aiMaxTokens))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.aiMaxTokens = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(aiSection)
      .setName('流式输出')
      .setDesc('启用 SSE 流式输出，实时显示 AI 回复')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.aiStreaming)
          .onChange(async (value) => {
            this.plugin.settings.aiStreaming = value;
            await this.plugin.saveSettings();
          });
      });

    // Test AI connection button
    new Setting(aiSection)
      .setName('测试连接')
      .setDesc('验证 AI API 配置是否有效')
      .addButton((button) => {
        button
          .setButtonText('测试')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('测试中...');
            const result = await this.plugin.llmService.testConnection();
            if (result.success) {
              button.setButtonText('连接成功 ✓');
              button.setCta();
              new Notice(`✓ ${result.message}`);
            } else {
              button.setButtonText('连接失败 ✗');
              button.setWarning();
              new Notice(`✗ ${result.message}`, 5000);
            }
            setTimeout(() => {
              button.setDisabled(false);
              button.setButtonText('测试');
              button.removeCta();
              button.removeWarning();
            }, 3000);
          });
      });

    // =========================================================================
    // Section 4: Wordbook Settings
    // =========================================================================
    const wbSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(wbSection).setHeading().setName('生词本设置');

    new Setting(wbSection)
      .setName('自动提示加入生词本')
      .setDesc('查词后自动提示是否加入生词本')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoAddToWordbook)
          .onChange(async (value) => {
            this.plugin.settings.autoAddToWordbook = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(wbSection)
      .setName('自动收录阈值')
      .setDesc('查询超过指定次数的单词自动收录到生词本')
      .addSlider((slider) => {
        slider
          .setLimits(0, 10, 1)
          .setValue(this.plugin.settings.autoAddThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.autoAddThreshold = value;
            await this.plugin.saveSettings();
          });
      });

    // Context mode display (read-only info)
    const contextMode = this.plugin.settings.contextMode || 'active';
    const contextPaths = this.plugin.settings.contextPaths || [];
    let contextDesc = '默认显示当前笔记的生词。';
    if (contextMode === 'all') {
      contextDesc = '显示全部笔记的生词。';
    } else if (contextMode === 'custom' && contextPaths.length > 0) {
      const names = contextPaths.map(p => p.split('/').pop() || p).join('、');
      contextDesc = `显示指定范围的生词：${names}。`;
    } else if (contextMode === 'none') {
      contextDesc = '显示全部生词（不限范围）。';
    }

    new Setting(wbSection)
      .setName('侧边栏显示范围')
      .setDesc(contextDesc + '在侧边栏点击范围按钮可切换。')
      .addButton((button) => {
        button
          .setButtonText('说明')
          .onClick(() => {
            new Notice('在侧边栏顶部点击范围按钮，可选择：当前笔记 / 全部笔记 / 指定文件夹或笔记 / 不限范围', 5000);
          });
      });

    // Statistics display
    const stats = this.plugin.wordbookManager.getStats();
    new Setting(wbSection)
      .setName('生词本统计')
      .setDesc(`单词：${stats.totalWords} 个 | 短语：${stats.totalPhrases} 个 | 今日待复习：${stats.dueToday} 个`)
      .addButton((button) => {
        button
          .setButtonText('导出生词本')
          .onClick(() => {
            this.plugin.app.workspace.trigger('fleurdict:export-wordbook');
          });
      });

    // =========================================================================
    // Section 5: Flashcard Settings
    // =========================================================================
    const fcSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(fcSection).setHeading().setName('闪卡设置');

    new Setting(fcSection)
      .setName('每日新卡上限')
      .setDesc('每天最多学习的新单词数量')
      .addText((text) => {
        text
          .setPlaceholder('20')
          .setValue(String(this.plugin.settings.dailyNewCardsLimit))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.dailyNewCardsLimit = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(fcSection)
      .setName('每日复习上限')
      .setDesc('每天最多复习的单词数量')
      .addText((text) => {
        text
          .setPlaceholder('200')
          .setValue(String(this.plugin.settings.dailyReviewLimit))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.dailyReviewLimit = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(fcSection)
      .setName('自动播放发音')
      .setDesc('展示闪卡时自动播放单词发音')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoPlayAudio)
          .onChange(async (value) => {
            this.plugin.settings.autoPlayAudio = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(fcSection)
      .setName('开始今日复习')
      .setDesc(`今日待复习：${stats.dueToday} 个单词`)
      .addButton((button) => {
        button
          .setButtonText('开始复习')
          .setCta()
          .onClick(() => {
            this.plugin.app.workspace.trigger('fleurdict:start-flashcard');
          });
      });

    // =========================================================================
    // Section 6: Appearance & Shortcuts
    // =========================================================================
    const uiSection = containerEl.createDiv('fleurdict-settings-section');
    new Setting(uiSection).setHeading().setName('外观与快捷键');

    new Setting(uiSection)
      .setName('弹窗位置')
      .setDesc('词典弹窗的显示位置')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('selection', '跟随选区')
          .addOption('right', '固定右侧')
          .addOption('top', '固定顶部')
          .setValue(this.plugin.settings.popupPosition)
          .onChange(async (value) => {
            this.plugin.settings.popupPosition = value as any;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('弹窗宽度')
      .setDesc('词典弹窗的宽度（像素）')
      .addSlider((slider) => {
        slider
          .setLimits(300, 600, 20)
          .setValue(this.plugin.settings.popupWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.popupWidth = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('显示音标')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showPhonetic)
          .onChange(async (value) => {
            this.plugin.settings.showPhonetic = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('显示例句')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showExamples)
          .onChange(async (value) => {
            this.plugin.settings.showExamples = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('显示发音按钮')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showAudioButton)
          .onChange(async (value) => {
            this.plugin.settings.showAudioButton = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('显示 AI 详解按钮')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showAIDetailButton)
          .onChange(async (value) => {
            this.plugin.settings.showAIDetailButton = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(uiSection)
      .setName('显示加入生词本按钮')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showAddToWordbookButton)
          .onChange(async (value) => {
            this.plugin.settings.showAddToWordbookButton = value;
            await this.plugin.saveSettings();
          });
      });

    // Language
    new Setting(uiSection)
      .setName('界面语言')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('zh-CN', '简体中文')
          .addOption('en', 'English')
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as any;
            await this.plugin.saveSettings();
          });
      });
  }

  /**
   * Apply provider preset
   */
  private async applyProviderPreset(provider: string): Promise<void> {
    const presets: Record<string, { baseUrl: string; model: string }> = {
      deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
      },
      qwen: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-turbo',
      },
      glm: {
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-flash',
      },
      siliconflow: {
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3',
      },
    };

    const preset = presets[provider];
    if (preset) {
      this.plugin.settings.aiBaseUrl = preset.baseUrl;
      this.plugin.settings.aiModel = preset.model;
      // Sync DOM controls so UI reflects the new values immediately
      this.aiBaseUrlText?.setValue(preset.baseUrl);
      this.aiModelText?.setValue(preset.model);
    }
  }
}
