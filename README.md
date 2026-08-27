# FleurDict

一款优雅的 Obsidian 英语词典插件，提供划词查询、AI 智能解析、生词本管理和间隔重复复习等完整学习体验。

An elegant English dictionary plugin for Obsidian, providing word lookup, AI-powered explanations, vocabulary notebook, and spaced repetition review.

---

## 中文文档

### 核心功能

#### 智能词典查询
- **划词即查**：双击单词或划选短语，自动弹出词典释义
- **多源聚合**：支持有道词典、Free Dictionary API、本地 JSON 词典、MDX 格式词典
- **离线支持**：可导入本地词典文件，无网络也能查词
- **智能缓存**：自动缓存查询结果，减少重复请求

#### AI 智能解析
- **AI 详解**：一键获取单词的详细讲解，包括词源、记忆技巧、用法示例
- **AI 翻译**：智能翻译选中的文本或整个句子
- **多模型支持**：支持 DeepSeek、Qwen、GLM、SiliconFlow 等主流 AI 服务
- **流式输出**：实时显示 AI 回复，无需等待完整响应

#### 生词本管理
- **自动收录**：查询过的单词可一键加入生词本
- **词性标注**：名词、动词、形容词等词性标签可视化渲染
- **上下文记录**：自动保存单词出现的语境
- **欧路同步**：支持与欧路词典双向同步

#### 间隔重复复习
- **SM-2 算法**：基于科学的间隔重复算法，优化记忆效果
- **闪卡模式**：支持到期复习、分类复习、随机复习
- **进度追踪**：记录每个单词的复习次数和掌握程度
- **每日统计**：显示今日待复习单词数量

#### 优雅界面
- **Light/Dark 主题**：完美适配 Obsidian 浅色和深色主题
- **响应式设计**：支持桌面端和移动端
- **可拖拽弹窗**：词典弹窗可自由拖拽和调整大小

### 安装方式

#### 通过社区插件安装（推荐）

1. 打开 Obsidian 设置 > 第三方插件
2. 搜索 "FleurDict"
3. 点击安装并启用

#### 通过 BRAT 安装

1. 在 Obsidian 中安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 打开 BRAT 设置，点击 "Add Beta Plugin"
3. 输入仓库地址：`gibsonchan5/fleurdict`
4. 点击 "Add Plugin" 完成安装

#### 手动安装

1. 从 [Releases](https://github.com/gibsonchan5/fleurdict/releases) 下载最新版本
2. 解压后将文件夹放入 Obsidian vault 的 `.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用 FleurDict 插件

### 快速开始

#### 1. 配置 AI 服务（可选）

1. 打开设置 > FleurDict > AI 设置
2. 选择 AI 提供商（推荐 DeepSeek）
3. 填入 API Key
4. 保存设置

#### 2. 开始使用

- **划词查词**：在编辑器中双击单词或划选短语
- **右键菜单**：右键点击选中的文本，选择 "查词"、"AI 详解"、"加入生词本"
- **侧栏视图**：点击左侧 ribbon 图标打开生词本或 AI 侧栏

---

## English Documentation

### Features

#### Smart Dictionary Lookup
- **Click to look up**: Double-click a word or select a phrase to get instant definitions
- **Multi-source**: Supports Youdao, Eudic, Free Dictionary API, and more
- **Smart caching**: Automatic caching to reduce redundant API calls

#### AI-Powered Analysis
- **AI Explanation**: One-click detailed explanation including etymology, memory tips, and usage examples
- **AI Translation**: Smart translation for selected text or full sentences
- **Multi-model support**: Works with DeepSeek and other mainstream AI providers
- **Streaming output**: Real-time display of AI responses

#### Vocabulary Notebook
- **Auto collection**: Add looked-up words to your notebook with one click
- **POS tags**: Part-of-speech labels rendered as visual tags
- **Context saving**: Automatically records the context where the word appeared
- **Eudic sync**: Bidirectional sync with Eudic dictionary

#### Spaced Repetition Review
- **SM-2 algorithm**: Scientific spaced repetition for optimal memorization
- **Flashcard mode**: Due-only, category-based, or random review
- **Progress tracking**: Records review count and mastery level for each word

#### Elegant Interface
- **Light/Dark theme**: Seamlessly adapts to Obsidian light and dark themes
- **Responsive design**: Works on desktop and mobile
- **Draggable popup**: Freely draggable and resizable dictionary popup

### Installation

#### From Community Plugins (Recommended)

1. Open Obsidian Settings > Community Plugins
2. Search for "FleurDict"
3. Click Install and Enable

#### Via BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings, click "Add Beta Plugin"
3. Enter repository: `gibsonchan5/fleurdict`

#### Manual Installation

1. Download the latest release from [Releases](https://github.com/gibsonchan5/fleurdict/releases)
2. Extract and copy the folder to `.obsidian/plugins/`
3. Enable in Obsidian Settings > Community Plugins

### Quick Start

#### 1. Configure AI Service (Optional)

Open Settings > FleurDict > AI Settings, enter your DeepSeek API Key to enable AI explanations and translations.

#### 2. Start Using

- **Look up words**: Double-click a word or select a phrase in the editor
- **Right-click menu**: Right-click selected text for "Look up", "AI Explanation", "Add to Vocabulary"
- **Sidebar**: Click the ribbon icon on the left to open the Vocabulary Notebook or AI sidebar

---

## 致谢 / Credits

- [有道词典](https://dict.youdao.com/) - 英汉/汉英词典查询数据源
- [Free Dictionary API](https://dictionaryapi.dev/) - 英文释义数据源
- [欧路词典](https://www.eudic.net/) - 生词本同步支持
- [Obsidian](https://obsidian.md/) - 优秀的笔记应用
- [SM-2 算法](https://www.supermemo.com/en/archives/ssm/sm2) - 间隔重复算法

## 许可证 / License

MIT License

## 数据来源与免责声明 / Data Sources & Disclaimer

### 数据来源 / Data Sources

本插件使用的词典数据来源：
- **有道词典**：提供英汉/汉英词典查询服务，数据来源于网易有道词典网页版接口
- **Free Dictionary API**：提供英文释义，数据来源于 Wiktionary（CC BY-SA 4.0 许可证）
- **欧路词典 API**：用于生词本同步，用户需自行提供授权 Token

Dictionary data sources used by this plugin:
- **Youdao Dictionary**: Provides English-Chinese/Chinese-English dictionary lookup, data sourced from NetEase Youdao Dictionary web API
- **Free Dictionary API**: Provides English definitions, data sourced from Wiktionary (CC BY-SA 4.0 license)
- **Eudic API**: Used for vocabulary notebook sync, users must provide their own authorization token

### 免责声明 / Disclaimer

- 本插件仅供个人学习使用，不得用于商业用途
- 词典数据版权归原作者或机构所有，插件开发者不拥有相关数据权利
- 如相关数据提供方认为本插件侵犯其权益，请联系开发者处理
- 使用本插件即表示您同意遵守各数据提供方的服务条款

- This plugin is for personal learning use only and may not be used for commercial purposes
- Dictionary data is owned by its respective authors/organizations; the plugin developer does not own the rights to this data
- If any data provider believes this plugin infringes on their rights, please contact the developer
- By using this plugin, you agree to comply with the terms of service of each data provider

## 联系方式 / Contact

- GitHub: [@gibsonchan5](https://github.com/gibsonchan5)
- Issues: [提交问题 / Report a bug](https://github.com/gibsonchan5/fleurdict/issues)

---

**Made with heart for Obsidian community**
