# FleurDict - 优雅的 Obsidian 英语词典插件

一款功能强大的 Obsidian 英语词典插件，提供划词查询、AI 智能解析、生词本管理和间隔重复复习等完整学习体验。

## ✨ 核心功能

### 📖 智能词典查询
- **划词即查**：双击单词或划选短语，自动弹出词典释义
- **多源聚合**：支持 Free Dictionary API、本地 JSON 词典、MDX 格式词典
- **离线支持**：可导入本地词典文件，无网络也能查词
- **智能缓存**：自动缓存查询结果，减少重复请求

### 🤖 AI 智能解析
- **AI 详解**：一键获取单词的详细讲解，包括词源、记忆技巧、用法示例
- **AI 翻译**：智能翻译选中的文本或整个句子
- **多模型支持**：支持 DeepSeek、Qwen、GLM、SiliconFlow 等主流 AI 服务
- **流式输出**：实时显示 AI 回复，无需等待完整响应

### 📝 生词本管理
- **自动收录**：查询过的单词可一键加入生词本
- **分类管理**：支持自定义分类标签，灵活组织单词
- **上下文记录**：自动保存单词出现的语境
- **导出功能**：支持导出为 Markdown 格式，方便复习和备份

### 🎴 间隔重复复习
- **SM-2 算法**：基于科学的间隔重复算法，优化记忆效果
- **闪卡模式**：支持到期复习、分类复习、随机复习
- **进度追踪**：记录每个单词的复习次数和掌握程度
- **每日统计**：显示今日待复习单词数量

### 🎨 优雅界面
- **Light/Dark 主题**：完美适配 Obsidian 浅色和深色主题
- **响应式设计**：支持桌面端和移动端
- **流畅动画**：精心设计的过渡动画，提升使用体验
- **自定义外观**：可调整弹窗位置、宽度等显示选项

## 📦 安装方式

### 方法一：通过 BRAT 安装（推荐）

1. 在 Obsidian 中安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 打开 BRAT 设置，点击 "Add Beta Plugin"
3. 输入仓库地址：`gibsonchan5/fleurdict`
4. 点击 "Add Plugin" 完成安装

### 方法二：手动安装

1. 从 [Releases](https://github.com/gibsonchan5/fleurdict/releases) 下载最新版本
2. 解压后将文件夹放入 Obsidian vault 的 `.obsidian/plugins/` 目录
3. 在 Obsidian 设置中启用 FleurDict 插件

### 方法三：从源码构建

```bash
# 克隆仓库
git clone https://github.com/gibsonchan5/fleurdict.git

# 安装依赖
cd fleurdict
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## 🚀 快速开始

### 1. 配置 AI 服务（可选）

如果想要使用 AI 详解和翻译功能：

1. 打开设置 → FleurDict → AI 设置
2. 选择 AI 提供商（推荐 DeepSeek）
3. 填入 API Key
4. 保存设置

### 2. 导入本地词典（可选）

如果需要使用离线词典：

1. 准备 JSON 格式的词典文件（见下方格式说明）
2. 打开设置 → FleurDict → 本地词典导入
3. 点击 "导入 JSON 词典"，选择文件
4. 等待导入完成

### 3. 开始使用

- **划词查词**：在编辑器中双击单词或划选短语
- **右键菜单**：右键点击选中的文本，选择 "查词"、"AI 详解"、"加入生词本"
- **命令面板**：按 `Ctrl/Cmd + P`，输入 "FleurDict" 查看可用命令
- **侧栏视图**：点击左侧 ribbon 图标打开生词本或 AI 侧栏

## 📚 词典格式说明

### JSON 格式（数组）

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

### JSON 格式（对象）

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

## ⚙️ 配置说明

### 词典源设置

- **查询优先级**：本地优先 / 在线优先 / 合并展示
- **缓存设置**：启用缓存、缓存有效期、清除缓存
- **本地词典**：导入 JSON 词典文件

### AI 设置

- **AI 提供商**：DeepSeek、Qwen、GLM、SiliconFlow、自定义
- **API 配置**：Base URL、API Key、模型名称
- **高级选项**：Temperature、Max Tokens、流式输出

### 生词本设置

- **自动收录**：查询超过指定次数自动加入生词本
- **默认分类**：新单词的默认分类
- **导出功能**：导出为 Markdown 文件

### 闪卡设置

- **每日限额**：每日新卡上限、复习上限
- **算法参数**：初始 Ease Factor
- **复习模式**：到期复习、分类复习、随机复习

### 外观设置

- **弹窗位置**：跟随选区、固定右侧、固定顶部
- **弹窗宽度**：300-600 像素可调
- **显示选项**：音标、例句、发音按钮、AI 按钮等

## 🔧 开发指南

### 项目结构

```
fleurdict/
├── src/
│   ├── main.ts                    # 插件主入口
│   ├── types.ts                   # 类型定义
│   ├── settings.ts                # 设置面板
│   ├── core/                      # 核心模块
│   │   ├── dictionary-engine.ts   # 词典引擎
│   │   ├── online-dict.ts         # 在线词典
│   │   ├── local-dict.ts          # 本地词典
│   │   ├── llm-service.ts         # AI 服务
│   │   ├── wordbook-manager.ts    # 生词本管理
│   │   └── flashcard-engine.ts    # 闪卡引擎
│   ├── ui/                        # UI 组件
│   │   ├── dict-popup.ts          # 词典弹窗
│   │   ├── ai-modal.ts            # AI 弹窗
│   │   ├── ai-sidebar.ts          # AI 侧栏
│   │   ├── flashcard-modal.ts     # 闪卡弹窗
│   │   └── wordbook-view.ts       # 生词本视图
│   ├── features/                  # 功能模块
│   │   ├── selection-handler.ts   # 划词处理
│   │   ├── context-menu.ts        # 右键菜单
│   │   └── commands.ts            # 命令注册
│   └── utils/                     # 工具函数
│       └── helpers.ts
├── styles.css                     # 样式文件
├── manifest.json                  # 插件清单
└── package.json                   # 项目配置
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run check
```

### 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'Add new feature'`
4. 推送到分支：`git push origin feature/new-feature`
5. 创建 Pull Request

## 📝 更新日志

### v0.3.2 (2026-08-24)
- ⚖️ 新增「数据来源与免责声明」，在设置页面底部展示
- 🗃️ 优化缓存策略设置展示，调整分组和文案
- 📝 更新 README，新增数据来源与免责声明说明

### v0.3.1 (2026-08-24)
- 🔧 修复复习按钮点击无响应问题
- 🔧 修复生词列表部分词条不显示的问题（两阶段渲染）
- 🎨 优化设置界面布局和控件样式
- 🎨 闪卡按钮简化为三个（忘了/记得/跳过）
- 🎨 Toggle 改为「点亮」风格

### v0.3.0 (2026-08-20)
- ✨ 完整实现所有核心功能
-  优化 Light/Dark 主题适配
- 📱 改进移动端响应式布局
-  修复多个已知问题

### v0.2.0 (2026-08-20)
- ✨ 添加 AI 侧栏视图
- ✨ 支持多 AI 提供商
- ✨ 实现生词本管理功能
- ✨ 添加闪卡复习功能

### v0.1.0 (2026-08-20)
- 🎉 首次发布
- ✨ 基础词典查询功能
- ✨ 划词查询和右键菜单
- ✨ 在线词典集成

## 🙏 致谢

- [Free Dictionary API](https://dictionaryapi.dev/) - 免费词典数据源
- [Obsidian](https://obsidian.md/) - 优秀的笔记应用
- [SM-2 算法](https://www.supermemo.com/en/archives/ssm/sm2) - 间隔重复算法

##  许可证

MIT License

## ⚖️ 数据来源与免责声明

### 数据来源
本插件使用的词典数据来源：
- **有道词典**：提供英汉/汉英词典查询服务，数据来源于网易有道词典网页版接口
- **Free Dictionary API**：提供英文释义，数据来源于 Wiktionary（CC BY-SA 4.0 许可证）
- **欧路词典 API**：用于生词本同步，用户需自行提供授权 Token

### 免责声明
- 本插件仅供个人学习使用，不得用于商业用途
- 词典数据版权归原作者或机构所有，插件开发者不拥有相关数据权利
- 如相关数据提供方认为本插件侵犯其权益，请联系开发者处理
- 使用本插件即表示您同意遵守各数据提供方的服务条款

本项目为开源项目，遵循 MIT 许可证。

## 📮 联系方式

- GitHub: [@gibsonchan5](https://github.com/gibsonchan5)
- Issues: [提交问题](https://github.com/gibsonchan5/fleurdict/issues)

---

**Made with ❤️ for Obsidian community**
