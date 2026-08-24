# FleurDict - 优雅的 Obsidian 英语词典插件 / An Elegant English Dictionary Plugin for Obsidian

一款功能强大的 Obsidian 英语词典插件，提供划词查询、AI 智能解析、生词本管理和间隔重复复习等完整学习体验。

A powerful Obsidian English dictionary plugin offering word lookup, AI-powered analysis, vocabulary notebook, and spaced repetition review for a complete learning experience.

---

## ✨ 核心功能 / Features

### 📖 智能词典查询 / Smart Dictionary Lookup
- **划词即查**：双击单词或划选短语，自动弹出词典释义 / Double-click a word or select a phrase to instantly see definitions
- **多源聚合**：支持 Free Dictionary API、本地 JSON 词典、MDX 格式词典 / Multiple sources: Free Dictionary API, local JSON dictionary, MDX format dictionary
- **离线支持**：可导入本地词典文件，无网络也能查词 / Offline support: import local dictionary files for offline lookup
- **智能缓存**：自动缓存查询结果，减少重复请求 / Smart caching: automatically cache results to reduce repeated requests

### 🤖 AI 智能解析 / AI-Powered Analysis
- **AI 详解**：一键获取单词的详细讲解，包括词源、记忆技巧、用法示例 / One-click detailed word explanation including etymology, mnemonic tips, and usage examples
- **AI 翻译**：智能翻译选中的文本或整个句子 / Intelligent translation for selected text or entire sentences
- **多模型支持**：支持 DeepSeek、Qwen、GLM、SiliconFlow 等主流 AI 服务 / Multi-model support: DeepSeek, Qwen, GLM, SiliconFlow, and more
- **流式输出**：实时显示 AI 回复，无需等待完整响应 / Streaming output: see AI responses in real-time

### 📝 生词本管理 / Vocabulary Notebook
- **自动收录**：查询过的单词可一键加入生词本 / One-click to add looked-up words to your notebook
- **分类管理**：支持自定义分类标签，灵活组织单词 / Custom tags and categories for flexible organization
- **上下文记录**：自动保存单词出现的语境 / Automatically saves the context where the word appeared
- **导出功能**：支持导出为 Markdown 格式，方便复习和备份 / Export to Markdown format for review and backup

### 🎴 间隔重复复习 / Spaced Repetition Review
- **SM-2 算法**：基于科学的间隔重复算法，优化记忆效果 / SM-2 algorithm for optimized memorization
- **闪卡模式**：支持到期复习、分类复习、随机复习 / Flashcard modes: due review, category review, random review
- **进度追踪**：记录每个单词的复习次数和掌握程度 / Track review count and mastery level for each word
- **每日统计**：显示今日待复习单词数量 / Daily statistics showing words due for review

### 🎨 优雅界面 / Elegant Interface
- **Light/Dark 主题**：完美适配 Obsidian 浅色和深色主题 / Light/Dark theme: perfect match for Obsidian themes
- **响应式设计**：支持桌面端和移动端 / Responsive design for desktop and mobile
- **流畅动画**：精心设计的过渡动画，提升使用体验 / Smooth animations for a better experience
- **自定义外观**：可调整弹窗位置、宽度等显示选项 / Customizable popup position, width, and display options

---

## 📦 安装方式 / Installation

### 方法一：通过 BRAT 安装（推荐） / Method 1: via BRAT (Recommended)

1. 在 Obsidian 中安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件 / Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin in Obsidian
2. 打开 BRAT 设置，点击 "Add Beta Plugin" / Open BRAT settings and click "Add Beta Plugin"
3. 输入仓库地址 / Enter repository: `gibsonchan5/fleurdict`
4. 点击 "Add Plugin" 完成安装 / Click "Add Plugin" to install

### 方法二：手动安装 / Method 2: Manual Installation

1. 从 [Releases](https://github.com/gibsonchan5/fleurdict/releases) 下载最新版本 / Download the latest version from [Releases](https://github.com/gibsonchan5/fleurdict/releases)
2. 解压后将文件夹放入 Obsidian vault 的 `.obsidian/plugins/` 目录 / Extract and place the folder in your vault's `.obsidian/plugins/` directory
3. 在 Obsidian 设置中启用 FleurDict 插件 / Enable FleurDict in Obsidian settings

### 方法三：从源码构建 / Method 3: Build from Source

```bash
# 克隆仓库 / Clone the repository
git clone https://github.com/gibsonchan5/fleurdict.git

# 安装依赖 / Install dependencies
cd fleurdict
npm install

# 开发模式 / Development mode
npm run dev

# 构建生产版本 / Build for production
npm run build
```

---

## 🚀 快速开始 / Quick Start

### 1. 配置 AI 服务（可选） / 1. Configure AI Service (Optional)

如果想要使用 AI 详解和翻译功能 / For AI explanation and translation features:

1. 打开设置 → FleurDict → AI 设置 / Open Settings → FleurDict → AI Settings
2. 选择 AI 提供商（推荐 DeepSeek） / Select an AI provider (DeepSeek recommended)
3. 填入 API Key / Enter your API Key
4. 保存设置 / Save settings

### 2. 导入本地词典（可选） / 2. Import Local Dictionary (Optional)

如果需要使用离线词典 / For offline dictionary usage:

1. 准备 JSON 格式的词典文件（见下方格式说明） / Prepare a JSON format dictionary file (see format below)
2. 打开设置 → FleurDict → 本地词典导入 / Open Settings → FleurDict → Local Dictionary Import
3. 点击 "导入 JSON 词典"，选择文件 / Click "Import JSON Dictionary" and select the file
4. 等待导入完成 / Wait for import to complete

### 3. 开始使用 / 3. Start Using

- **划词查词**：在编辑器中双击单词或划选短语 / **Lookup**: Double-click a word or select a phrase in the editor
- **右键菜单**：右键点击选中的文本，选择 "查词"、"AI 详解"、"加入生词本" / **Context menu**: Right-click selected text and choose "Lookup", "AI Explain", or "Add to Wordbook"
- **命令面板**：按 `Ctrl/Cmd + P`，输入 "FleurDict" 查看可用命令 / **Command palette**: Press `Ctrl/Cmd + P` and type "FleurDict" to see available commands
- **侧栏视图**：点击左侧 ribbon 图标打开生词本或 AI 侧栏 / **Sidebar views**: Click the ribbon icons to open wordbook or AI sidebar

---

## 📚 词典格式说明 / Dictionary Format

### JSON 格式（数组） / JSON Format (Array)

```json
[
  {
    "word": "hello",
    "phonetics": [
      {
        "text": "/həˈləʊ/",
        "audio": "https://example.com/hello.mp3"
      }
    ],
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          {
            "definition": "A greeting",
            "example": "Hello, how are you?"
          }
        ]
      }
    ]
  }
]
```

### JSON 格式（对象） / JSON Format (Object)

```json
{
  "hello": {
    "phonetic": "/həˈləʊ/",
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definition": "A greeting",
        "example": "Hello, how are you?"
      }
    ]
  }
}
```

---

## ⚙️ 配置说明 / Configuration

### 词典源设置 / Dictionary Source Settings

- **查询优先级**：本地优先 / 在线优先 / 合并展示 / **Lookup priority**: Local first / Online first / Merged view
- **缓存设置**：启用缓存、缓存有效期、清除缓存 / **Cache**: Enable cache, cache duration, clear cache
- **本地词典**：导入 JSON 词典文件 / **Local dictionary**: Import JSON dictionary files

### AI 设置 / AI Settings

- **AI 提供商**：DeepSeek、Qwen、GLM、SiliconFlow、自定义 / **Provider**: DeepSeek, Qwen, GLM, SiliconFlow, Custom
- **API 配置**：Base URL、API Key、模型名称 / **API config**: Base URL, API Key, Model name
- **高级选项**：Temperature、Max Tokens、流式输出 / **Advanced**: Temperature, Max Tokens, Streaming

### 生词本设置 / Wordbook Settings

- **自动收录**：查询超过指定次数自动加入生词本 / **Auto-collect**: Automatically add words after a set number of lookups
- **默认分类**：新单词的默认分类 / **Default category**: Default category for new words
- **导出功能**：导出为 Markdown 文件 / **Export**: Export as Markdown file

### 闪卡设置 / Flashcard Settings

- **每日限额**：每日新卡上限、复习上限 / **Daily limits**: New cards per day, review limit per day
- **算法参数**：初始 Ease Factor / **Algorithm**: Initial Ease Factor
- **复习模式**：到期复习、分类复习、随机复习 / **Review modes**: Due review, category review, random review

### 外观设置 / Appearance Settings

- **弹窗位置**：跟随选区、固定右侧、固定顶部 / **Popup position**: Follow selection, Fixed right, Fixed top
- **弹窗宽度**：300-600 像素可调 / **Popup width**: Adjustable 300-600px
- **显示选项**：音标、例句、发音按钮、AI 按钮等 / **Display options**: Phonetic, examples, pronunciation button, AI button, etc.

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
│   ├── features/                  # 功能模块 / Features
│   │   ├── selection-handler.ts   # 划词处理 / Selection handler
│   │   ├── context-menu.ts        # 右键菜单 / Context menu
│   │   └── commands.ts            # 命令注册 / Command registration
│   └── utils/                     # 工具函数 / Utilities
│       └── helpers.ts
├── styles.css                     # 样式文件 / Styles
├── manifest.json                  # 插件清单 / Plugin manifest
└── package.json                   # 项目配置 / Project config
```

### 开发命令 / Development Commands

```bash
# 安装依赖 / Install dependencies
npm install

# 开发模式（热重载） / Development mode (hot reload)
npm run dev

# 构建生产版本 / Build for production
npm run build

# 类型检查 / Type check
npm run check
```

### 贡献指南 / Contributing

欢迎提交 Issue 和 Pull Request！ / Issues and Pull Requests are welcome!

1. Fork 本仓库 / Fork this repository
2. 创建功能分支 / Create a feature branch: `git checkout -b feature/new-feature`
3. 提交更改 / Commit changes: `git commit -m 'Add new feature'`
4. 推送到分支 / Push to the branch: `git push origin feature/new-feature`
5. 创建 Pull Request / Create a Pull Request

---

## 📝 更新日志 / Changelog

### 1.1.0 (2026-08-24)
- ⚖️ 新增「数据来源与免责声明」 / Added "Data Sources & Disclaimer" section
- 🗃️ 优化缓存策略设置展示 / Improved cache strategy settings UI
- 🔧 复习按钮简化为三个（忘了/记得/跳过） / Simplified review buttons (Forgot / Remembered / Skip)
- 🎨 Toggle 改为「点亮」风格 / Toggle redesigned to "light-up" style
- 🐛 修复部分生词不显示的问题 / Fixed missing words in wordbook view
- 🐛 修复插件禁用时报错 / Fixed error on plugin disable
- 🐛 修复欧路词典同步失败 / Fixed Eudic sync failures

### 0.3.0 (2026-08-20)
- ✨ 完整实现所有核心功能 / All core features implemented
- 🎨 优化 Light/Dark 主题适配 / Improved Light/Dark theme support
- 📱 改进移动端响应式布局 / Improved mobile responsive layout
- 🐛 修复多个已知问题 / Fixed multiple issues

### 0.2.0 (2026-08-20)
- ✨ 添加 AI 侧栏视图 / Added AI sidebar view
- ✨ 支持多 AI 提供商 / Multi AI provider support
- ✨ 实现生词本管理功能 / Wordbook management
- ✨ 添加闪卡复习功能 / Flashcard review system

### 0.1.0 (2026-08-20)
- 🎉 首次发布 / Initial release
- ✨ 基础词典查询功能 / Basic dictionary lookup
- ✨ 划词查询和右键菜单 / Selection lookup and context menu
- ✨ 在线词典集成 / Online dictionary integration

---

## 🙏 致谢 / Acknowledgements

- [Free Dictionary API](https://dictionaryapi.dev/) - 免费词典数据源 / Free dictionary data source
- [Obsidian](https://obsidian.md/) - 优秀的笔记应用 / The excellent note-taking app
- [SM-2 算法](https://www.supermemo.com/en/archives/ssm/sm2) - 间隔重复算法 / Spaced repetition algorithm

---

## 📄 许可证 / License

MIT License

---

## ⚖️ 数据来源与免责声明 / Data Sources & Disclaimer

### 数据来源 / Data Sources

本插件使用的词典数据来源： / Dictionary data sources used by this plugin:

- **有道词典 / Youdao Dictionary**：提供英汉/汉英词典查询服务，数据来源于网易有道词典网页版接口 / Provides English-Chinese and Chinese-English dictionary lookup via Youdao's web interface
- **Free Dictionary API**：提供英文释义，数据来源于 Wiktionary（CC BY-SA 4.0 许可证） / Provides English definitions sourced from Wiktionary (CC BY-SA 4.0 License)
- **欧路词典 API / Eudic API**：用于生词本同步，用户需自行提供授权 Token / Used for vocabulary sync; users must provide their own authorization token

### 免责声明 / Disclaimer

- 本插件仅供个人学习使用，不得用于商业用途 / This plugin is for personal learning only and must not be used for commercial purposes
- 词典数据版权归原作者或机构所有，插件开发者不拥有相关数据权利 / Dictionary data remains the property of its original owners; the plugin developer does not claim any rights to such data
- 如相关数据提供方认为本插件侵犯其权益，请联系开发者处理 / If any data provider believes this plugin infringes their rights, please contact the developer
- 使用本插件即表示您同意遵守各数据提供方的服务条款 / By using this plugin, you agree to comply with the terms of service of each data provider

本项目为开源项目，遵循 MIT 许可证。 / This is an open-source project licensed under the MIT License.

---

## 📮 联系方式 / Contact

- GitHub: [@gibsonchan5](https://github.com/gibsonchan5)
- Issues: [提交问题 / Submit issues](https://github.com/gibsonchan5/fleurdict/issues)

---

**Made with ❤️ for Obsidian community**
