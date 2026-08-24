# FleurDict

一款优雅的 Obsidian 英语词典插件，提供划词查询、AI 智能解析、生词本管理和间隔重复复习等完整学习体验。

An elegant English dictionary plugin for Obsidian with word lookup, AI-powered analysis, vocabulary notebook, and spaced repetition review.

---

## 中文文档

### ✨ 核心功能

#### 📖 智能词典查询
- **划词即查**：双击单词或划选短语，自动弹出词典释义
- **多源聚合**：支持有道词典、Free Dictionary API、本地 JSON 词典、MDX 格式词典
- **离线支持**：可导入本地词典文件，无网络也能查词
- **智能缓存**：自动缓存查询结果，减少重复请求

#### 🤖 AI 智能解析
- **AI 详解**：一键获取单词的详细讲解，包括词源、记忆技巧、用法示例
- **AI 翻译**：智能翻译选中的文本或整个句子
- **多模型支持**：支持 DeepSeek、Qwen、GLM、SiliconFlow 等主流 AI 服务
- **流式输出**：实时显示 AI 回复，无需等待完整响应

#### 📝 生词本管理
- **自动收录**：查询过的单词可一键加入生词本
- **分类管理**：支持自定义分类标签，灵活组织单词
- **上下文记录**：自动保存单词出现的语境
- **导出功能**：支持导出为 Markdown 格式，方便复习和备份

#### 🎴 间隔重复复习
- **SM-2 算法**：基于科学的间隔重复算法，优化记忆效果
- **闪卡模式**：支持到期复习、分类复习、随机复习
- **进度追踪**：记录每个单词的复习次数和掌握程度
- **每日统计**：显示今日待复习单词数量

#### 🎨 优雅界面
- **Light/Dark 主题**：完美适配 Obsidian 浅色和深色主题
- **响应式设计**：支持桌面端和移动端
- **流畅动画**：精心设计的过渡动画，提升使用体验
- **自定义外观**：可调整弹窗位置、宽度等显示选项

### 📦 安装方式

#### 方法一：通过 BRAT 安装（推荐）

1. 在 Obsidian 中安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 打开 BRAT 设置，点击 "Add Beta Plugin"
3. 输入仓库地址：`gibsonchan5/fleurdict`
4. 点击 "Add Plugin" 完成安装

#### 方法二：手动安装

1. 从 [Releases](https://github.com/gibsonchan5/fleurdict/releases) 下载最新版本
2. 解压后将文件夹放入 Obsidian vault 的 `.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用 FleurDict 插件

#### 方法三：从源码构建

```bash
git clone https://github.com/gibsonchan5/fleurdict.git
cd fleurdict
npm install
npm run dev      # 开发模式
npm run build    # 构建生产版本
```

### 🚀 快速开始

#### 1. 配置 AI 服务（可选）

1. 打开设置 → FleurDict → AI 设置
2. 选择 AI 提供商（推荐 DeepSeek）
3. 填入 API Key
4. 保存设置

#### 2. 导入本地词典（可选）

1. 准备 JSON 格式的词典文件
2. 打开设置 → FleurDict → 本地词典导入
3. 点击 "导入 JSON 词典"，选择文件
4. 等待导入完成

#### 3. 开始使用

- **划词查词**：在编辑器中双击单词或划选短语
- **右键菜单**：右键点击选中的文本，选择 "查词"、"AI 详解"、"加入生词本"
- **命令面板**：按 `Ctrl/Cmd + P`，输入 "FleurDict" 查看可用命令
- **侧栏视图**：点击左侧 ribbon 图标打开生词本或 AI 侧栏

### 📚 词典格式说明

#### JSON 格式（数组）

```json
[
  {
    "word": "hello",
    "phonetics": [{ "text": "/həˈləʊ/", "audio": "https://example.com/hello.mp3" }],
    "meanings": [{
      "partOfSpeech": "noun",
      "definitions": [{ "definition": "A greeting", "example": "Hello, how are you?" }]
    }]
  }
]
```

#### JSON 格式（对象）

```json
{
  "hello": {
    "phonetic": "/həˈləʊ/",
    "meanings": [{ "partOfSpeech": "noun", "definition": "A greeting", "example": "Hello, how are you?" }]
  }
}
```

### ⚙️ 配置说明

- **词典源设置**：查询优先级（本地优先/在线优先/合并展示）、缓存策略、本地词典导入
- **AI 设置**：提供商选择、API 配置（Base URL / API Key / 模型）、Temperature、Max Tokens、流式输出
- **生词本设置**：自动收录阈值、默认分类、导出格式
- **闪卡设置**：每日限额、初始 Ease Factor、复习模式
- **外观设置**：弹窗位置（跟随选区/固定右侧/固定顶部）、弹窗宽度（300-600px）、显示选项

### 📝 更新日志

#### 1.1.0 (2026-08-24)
- ⚖️ 新增「数据来源与免责声明」区块
- 🗃️ 优化缓存策略设置展示
- 🔧 复习按钮简化为三个（忘了/记得/跳过）
- 🎨 Toggle 改为「点亮」风格
- 🐛 修复部分生词不显示的问题
- 🐛 修复插件禁用时报错
- 🐛 修复欧路词典同步失败

#### 0.3.0 (2026-08-20)
- ✨ 完整实现所有核心功能
- 🎨 优化 Light/Dark 主题适配
- 📱 改进移动端响应式布局

#### 0.2.0 (2026-08-20)
- ✨ AI 侧栏视图、多 AI 提供商支持、生词本管理、闪卡复习

#### 0.1.0 (2026-08-20)
- 🎉 首次发布，基础词典查询、划词查询、在线词典集成

### 🙏 致谢

- [Free Dictionary API](https://dictionaryapi.dev/) - 免费词典数据源
- [Obsidian](https://obsidian.md/) - 优秀的笔记应用
- [SM-2 算法](https://www.supermemo.com/en/archives/ssm/sm2) - 间隔重复算法

### ⚖️ 数据来源与免责声明

**数据来源：**
- **有道词典**：提供英汉/汉英词典查询服务，数据来源于网易有道词典网页版接口
- **Free Dictionary API**：提供英文释义，数据来源于 Wiktionary（CC BY-SA 4.0 许可证）
- **欧路词典 API**：用于生词本同步，用户需自行提供授权 Token

**免责声明：**
- 本插件仅供个人学习使用，不得用于商业用途
- 词典数据版权归原作者或机构所有，插件开发者不拥有相关数据权利
- 如相关数据提供方认为本插件侵犯其权益，请联系开发者处理
- 使用本插件即表示您同意遵守各数据提供方的服务条款

本项目为开源项目，遵循 MIT 许可证。

---

## English

### ✨ Features

#### 📖 Smart Dictionary Lookup
- **Instant lookup**: Double-click a word or select a phrase to see definitions instantly
- **Multiple sources**: Youdao Dictionary, Free Dictionary API, local JSON dictionary, MDX format dictionary
- **Offline support**: Import local dictionary files for offline usage
- **Smart caching**: Automatically cache results to reduce repeated requests

#### 🤖 AI-Powered Analysis
- **AI explanation**: One-click detailed word analysis including etymology, mnemonic tips, and usage examples
- **AI translation**: Intelligent translation for selected text or entire sentences
- **Multi-model support**: DeepSeek, Qwen, GLM, SiliconFlow, and more
- **Streaming output**: Real-time AI responses

#### 📝 Vocabulary Notebook
- **Auto-collect**: One-click to add looked-up words to your notebook
- **Categorization**: Custom tags and categories for flexible organization
- **Context recording**: Automatically saves the context where the word appeared
- **Export**: Export to Markdown format for review and backup

#### 🎴 Spaced Repetition Review
- **SM-2 algorithm**: Scientifically proven spaced repetition for optimized memorization
- **Flashcard modes**: Due review, category review, random review
- **Progress tracking**: Track review count and mastery level for each word
- **Daily statistics**: See how many words are due for review today

#### 🎨 Elegant Interface
- **Light/Dark theme**: Perfect match for Obsidian themes
- **Responsive design**: Desktop and mobile support
- **Smooth animations**: Carefully crafted transitions
- **Customizable appearance**: Adjustable popup position, width, and display options

### 📦 Installation

#### Method 1: via BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin in Obsidian
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter repository: `gibsonchan5/fleurdict`
4. Click "Add Plugin" to complete installation

#### Method 2: Manual Installation

1. Download the latest version from [Releases](https://github.com/gibsonchan5/fleurdict/releases)
2. Extract and place the folder in your vault's `.obsidian/plugins/` directory
3. Enable FleurDict in Obsidian settings

#### Method 3: Build from Source

```bash
git clone https://github.com/gibsonchan5/fleurdict.git
cd fleurdict
npm install
npm run dev      # Development mode
npm run build    # Build for production
```

### 🚀 Quick Start

#### 1. Configure AI Service (Optional)

1. Open Settings → FleurDict → AI Settings
2. Select an AI provider (DeepSeek recommended)
3. Enter your API Key
4. Save settings

#### 2. Import Local Dictionary (Optional)

1. Prepare a JSON format dictionary file
2. Open Settings → FleurDict → Local Dictionary Import
3. Click "Import JSON Dictionary" and select the file
4. Wait for import to complete

#### 3. Start Using

- **Lookup**: Double-click a word or select a phrase in the editor
- **Context menu**: Right-click selected text and choose "Lookup", "AI Explain", or "Add to Wordbook"
- **Command palette**: Press `Ctrl/Cmd + P` and type "FleurDict" to see available commands
- **Sidebar views**: Click the ribbon icons to open wordbook or AI sidebar

### 📚 Dictionary Format

#### JSON Format (Array)

```json
[
  {
    "word": "hello",
    "phonetics": [{ "text": "/həˈləʊ/", "audio": "https://example.com/hello.mp3" }],
    "meanings": [{
      "partOfSpeech": "noun",
      "definitions": [{ "definition": "A greeting", "example": "Hello, how are you?" }]
    }]
  }
]
```

#### JSON Format (Object)

```json
{
  "hello": {
    "phonetic": "/həˈləʊ/",
    "meanings": [{ "partOfSpeech": "noun", "definition": "A greeting", "example": "Hello, how are you?" }]
  }
}
```

### ⚙️ Configuration

- **Dictionary Source**: Lookup priority (Local first / Online first / Merged view), cache strategy, local dictionary import
- **AI Settings**: Provider selection, API config (Base URL / API Key / Model), Temperature, Max Tokens, streaming
- **Wordbook Settings**: Auto-collect threshold, default category, export format
- **Flashcard Settings**: Daily limits, initial Ease Factor, review modes
- **Appearance**: Popup position (Follow selection / Fixed right / Fixed top), popup width (300-600px), display options

### 📝 Changelog

#### 1.1.0 (2026-08-24)
- ⚖️ Added "Data Sources & Disclaimer" section
- 🗃️ Improved cache strategy settings UI
- 🔧 Simplified review buttons (Forgot / Remembered / Skip)
- 🎨 Redesigned toggle to "light-up" style
- 🐛 Fixed missing words in wordbook view
- 🐛 Fixed error on plugin disable
- 🐛 Fixed Eudic sync failures

#### 0.3.0 (2026-08-20)
- ✨ All core features implemented
- 🎨 Improved Light/Dark theme support
- 📱 Improved mobile responsive layout

#### 0.2.0 (2026-08-20)
- ✨ AI sidebar view, multi AI provider support, wordbook management, flashcard review

#### 0.1.0 (2026-08-20)
- 🎉 Initial release with basic dictionary lookup, selection lookup, and online dictionary integration

### 🙏 Acknowledgements

- [Free Dictionary API](https://dictionaryapi.dev/) - Free dictionary data source
- [Obsidian](https://obsidian.md/) - The excellent note-taking app
- [SM-2 Algorithm](https://www.supermemo.com/en/archives/ssm/sm2) - Spaced repetition algorithm

### ⚖️ Data Sources & Disclaimer

**Data Sources:**
- **Youdao Dictionary**: Provides English-Chinese and Chinese-English dictionary lookup via Youdao's web interface
- **Free Dictionary API**: Provides English definitions sourced from Wiktionary (CC BY-SA 4.0 License)
- **Eudic API**: Used for vocabulary sync; users must provide their own authorization token

**Disclaimer:**
- This plugin is for personal learning only and must not be used for commercial purposes
- Dictionary data remains the property of its original owners; the plugin developer does not claim any rights to such data
- If any data provider believes this plugin infringes their rights, please contact the developer
- By using this plugin, you agree to comply with the terms of service of each data provider

This is an open-source project licensed under the MIT License.

---

## 🔧 开发指南 / Development

### 项目结构 / Project Structure

```
fleurdict/
├── src/
│   ├── main.ts                    # 插件主入口 / Plugin entry
│   ├── types.ts                   # 类型定义 / Type definitions
│   ├── settings.ts                # 设置面板 / Settings panel
│   ├── core/                      # 核心模块 / Core modules
│   │   ├── dictionary-engine.ts   # 词典引擎 / Dictionary engine
│   │   ├── online-dict.ts         # 在线词典 / Online dictionary
│   │   ├── local-dict.ts          # 本地词典 / Local dictionary
│   │   ├── llm-service.ts         # AI 服务 / AI service
│   │   ├── wordbook-manager.ts    # 生词本管理 / Wordbook manager
│   │   └── flashcard-engine.ts    # 闪卡引擎 / Flashcard engine
│   ├── ui/                        # UI 组件 / UI components
│   │   ├── dict-popup.ts          # 词典弹窗 / Dictionary popup
│   │   ├── ai-modal.ts            # AI 弹窗 / AI modal
│   │   ├── ai-sidebar.ts          # AI 侧栏 / AI sidebar
│   │   ├── flashcard-modal.ts     # 闪卡弹窗 / Flashcard modal
│   │   └── wordbook-view.ts       # 生词本视图 / Wordbook view
│   └── features/                  # 功能模块 / Features
│       ├── selection-handler.ts   # 划词处理 / Selection handler
│       ├── context-menu.ts        # 右键菜单 / Context menu
│       └── commands.ts            # 命令注册 / Command registration
├── styles.css                     # 样式文件 / Styles
├── manifest.json                  # 插件清单 / Plugin manifest
└── package.json                   # 项目配置 / Project config
```

### 开发命令 / Development Commands

```bash
npm install         # 安装依赖 / Install dependencies
npm run dev         # 开发模式 / Development mode (hot reload)
npm run build       # 构建生产版本 / Build for production
npm run check       # 类型检查 / Type check
```

### 贡献指南 / Contributing

欢迎提交 Issue 和 Pull Request！ / Issues and Pull Requests are welcome!

1. Fork 本仓库 / Fork this repository
2. 创建功能分支 / Create feature branch: `git checkout -b feature/your-feature`
3. 提交更改 / Commit: `git commit -m 'Add some feature'`
4. 推送分支 / Push: `git push origin feature/your-feature`
5. 创建 Pull Request / Create a Pull Request

---

## 📄 许可证 / License

MIT License

## 📮 联系方式 / Contact

- GitHub: [@gibsonchan5](https://github.com/gibsonchan5)
- Issues: [提交问题 / Submit issues](https://github.com/gibsonchan5/fleurdict/issues)

---

**Made with ❤️ for Obsidian community**
