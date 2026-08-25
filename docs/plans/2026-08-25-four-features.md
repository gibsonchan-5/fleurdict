# FleurDict 四大新功能实施方案

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现双击选词、阅读模式、单词分级、高亮标色四个核心功能，提升学习体验

**Architecture:** 
1. 双击选词通过 CM6 EditorView 事件监听实现
2. 阅读模式通过设置开关 + ribbon 按钮 + context-menu 过滤实现
3. 单词分级通过扩展 WordEntry 数据结构 + 修改 SM-2 算法实现
4. 高亮标色通过 CM6 Decoration API 实现语法高亮

**Tech Stack:** TypeScript, Obsidian API, CodeMirror 6

---

## Task 1: 单词分级数据结构

**Files:**
- Modify: `src/types.ts:201-219`

**Step 1: 添加 proficiency 和 consecutiveCorrect 字段**

```typescript
export interface WordEntry {
  // ... 现有字段保持不变 ...
  
  // 新增分级字段
  proficiency: number;        // 熟练度等级：0=陌生(红)，1=渐熟(黄)，2=熟悉(绿)，3=无标记
  consecutiveCorrect: number; // 连续正确回答次数
  
  // ... 其他现有字段 ...
}
```

**Step 2: 修改 WordbookManager.load() 添加默认值**

在 `src/core/wordbook-manager.ts` 的 `load()` 方法中，为旧数据添加默认值：

```typescript
for (const entry of data.words) {
  if (entry.proficiency === undefined) {
    entry.proficiency = 0;
  }
  if (entry.consecutiveCorrect === undefined) {
    entry.consecutiveCorrect = 0;
  }
}
```

**Step 3: Commit**

```bash
git add src/types.ts src/core/wordbook-manager.ts
git commit -m "feat: add proficiency level and consecutive correct fields to WordEntry"
```

---

## Task 2: 修改闪卡算法为分级算法

**Files:**
- Modify: `src/core/flashcard-engine.ts:122-167`

**Step 1: 重写 rateCard 方法**

```typescript
rateCard(rating: FlashcardRating): void {
  if (!this.currentCard) return;

  const card = this.currentCard;
  let { interval, easeFactor } = card;
  const nextReview = Date.now(); // 默认立即复习

  // 分级逻辑
  if (rating === 1) {
    // 陌生：降级，重置连续正确次数
    card.proficiency = 0;
    card.consecutiveCorrect = 0;
    interval = 1; // 1 天后复习
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 2) {
    // 渐熟：增加连续正确次数
    card.consecutiveCorrect++;
    
    if (card.proficiency === 1 && card.consecutiveCorrect >= 3) {
      // 渐熟 → 熟悉
      card.proficiency = 2;
      card.consecutiveCorrect = 0;
      interval = 7; // 7 天后复习
    } else if (card.proficiency === 0 && card.consecutiveCorrect >= 2) {
      // 陌生 → 渐熟
      card.proficiency = 1;
      card.consecutiveCorrect = 0;
      interval = 3; // 3 天后复习
    } else {
      // 保持当前级别
      if (card.proficiency === 0) interval = 1;
      else if (card.proficiency === 1) interval = 3;
      else if (card.proficiency === 2) interval = 7;
    }
    
    easeFactor = Math.max(1.3, easeFactor - 0.1);
  } else if (rating === 3) {
    // 熟悉：增加连续正确次数
    card.consecutiveCorrect++;
    
    if (card.proficiency === 2 && card.consecutiveCorrect >= 4) {
      // 熟悉 → 无标记
      card.proficiency = 3;
      card.consecutiveCorrect = 0;
      interval = 0; // 不再复习
    } else {
      // 保持当前级别
      if (card.proficiency === 1) interval = 3;
      else if (card.proficiency === 2) interval = 7;
      else if (card.proficiency === 3) interval = 0;
    }
    
    easeFactor += 0.1;
  } else {
    // 跳过：不改变状态
    return;
  }

  // 更新卡片
  card.interval = interval;
  card.easeFactor = easeFactor;
  card.nextReview = interval === 0 ? 0 : nextReview + interval * 24 * 60 * 60 * 1000;
  card.lastReviewed = Date.now();
  card.reviewCount++;

  this.nextCard();
}
```

**Step 2: 删除旧的 calculateSchedule 方法**

该方法被新的分级算法替代，可以删除。

**Step 3: Commit**

```bash
git add src/core/flashcard-engine.ts
git commit -m "feat: implement proficiency-based flashcard algorithm"
```

---

## Task 3: 修改闪卡 UI 为四个按钮

**Files:**
- Modify: `src/ui/flashcard-modal.ts:199-224`

**Step 1: 修改评分按钮**

```typescript
const ratings: Array<{ label: string; rating: FlashcardRating | null; color: string }> = [
  { label: '陌生', rating: 1, color: 'red' },
  { label: '渐熟', rating: 2, color: 'yellow' },
  { label: '熟悉', rating: 3, color: 'green' },
  { label: '跳过', rating: null, color: 'gray' }
];

for (const r of ratings) {
  const btn = document.createElement('button');
  btn.addClass(`fleurdict-rating-btn fleurdict-rating-${r.color}`);
  btn.textContent = r.label;
  
  btn.addEventListener('click', () => {
    if (r.rating === null) {
      this.engine.nextCard();
      this.isFlipped = false;
      this.onUpdate();
      this.renderCard();
    } else {
      this.handleRating(r.rating);
    }
  });
  
  ratingContainer.appendChild(btn);
}
```

**Step 2: 添加颜色样式到 styles.css**

```css
.fleurdict-rating-red {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.fleurdict-rating-yellow {
  background: #fff9c4;
  color: #f57f17;
  border: 1px solid #fff176;
}

.fleurdict-rating-green {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.fleurdict-rating-gray {
  background: #f5f5f5;
  color: #757575;
  border: 1px solid #e0e0e0;
}
```

**Step 3: Commit**

```bash
git add src/ui/flashcard-modal.ts styles.css
git commit -m "feat: change flashcard buttons to 4 proficiency levels"
```

---

## Task 4: 新单词默认分级

**Files:**
- Modify: `src/main.ts:181-234`

**Step 1: 修改 addToWordbook 方法**

在创建新 WordEntry 时添加默认值：

```typescript
const newEntry: WordEntry = {
  // ... 现有字段 ...
  proficiency: 0,           // 默认陌生
  consecutiveCorrect: 0,    // 默认 0 次连续正确
  // ... 其他字段 ...
};
```

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: set default proficiency level for new words"
```

---

## Task 5: 双击选词功能

**Files:**
- Modify: `src/features/selection-handler.ts:28-30`

**Step 1: 实现 register 方法**

```typescript
register(): void {
  // 监听 CM6 编辑器双击事件
  this.plugin.registerEditorExtension(
    EditorView.domEventHandlers({
      dblclick: (view, pos) => {
        // 获取双击位置的单词
        const line = view.state.doc.lineAt(pos);
        const lineText = line.text;
        const offset = pos - line.from;
        
        // 提取英文单词
        const wordMatch = lineText.match(/\b[a-zA-Z'-]+\b/g);
        if (!wordMatch) return false;
        
        // 找到双击位置的单词
        let currentPos = 0;
        for (const match of wordMatch) {
          const start = lineText.indexOf(match, currentPos);
          const end = start + match.length;
          
          if (offset >= start && offset <= end) {
            // 选中单词
            view.dispatch({
              selection: { anchor: line.from + start, head: line.from + end }
            });
            
            // 查词
            setTimeout(() => {
              this.lookupWord(match);
            }, 50);
            
            return true; // 阻止默认行为
          }
          
          currentPos = end;
        }
        
        return false;
      }
    })
  );
}
```

**Step 2: 添加必要的 import**

在文件顶部添加：

```typescript
import { EditorView } from '@codemirror/view';
```

**Step 3: Commit**

```bash
git add src/features/selection-handler.ts
git commit -m "feat: implement double-click word selection"
```

---

## Task 6: 阅读模式设置

**Files:**
- Modify: `src/types.ts` (FleurDictSettings 接口)
- Modify: `src/settings.ts`

**Step 1: 添加设置字段**

在 `src/types.ts` 的 `FleurDictSettings` 接口中添加：

```typescript
export interface FleurDictSettings {
  // ... 现有字段 ...
  readingModeEnabled: boolean; // 阅读模式开关
  // ... 其他字段 ...
}
```

**Step 2: 设置默认值**

在 `src/main.ts` 的 `loadSettings` 方法中添加默认值：

```typescript
if (settings.readingModeEnabled === undefined) {
  settings.readingModeEnabled = false;
}
```

**Step 3: 添加设置 UI**

在 `src/settings.ts` 中添加开关：

```typescript
new Setting(containerEl)
  .setName('阅读模式')
  .setDesc('启用后右键菜单只显示 FleurDict 功能')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.readingModeEnabled)
    .onChange(async (value) => {
      this.plugin.settings.readingModeEnabled = value;
      await this.plugin.saveSettings();
    })
  );
```

**Step 4: Commit**

```bash
git add src/types.ts src/main.ts src/settings.ts
git commit -m "feat: add reading mode setting"
```

---

## Task 7: 阅读模式菜单过滤

**Files:**
- Modify: `src/features/context-menu.ts:49-128`

**Step 1: 修改 buildMenu 方法**

在构建菜单前检查阅读模式：

```typescript
private buildMenu(menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo): void {
  const selectedText = editor.getSelection();
  if (!selectedText) return;

  // ... 现有文本清洗逻辑 ...

  if (this.plugin.settings.readingModeEnabled) {
    // 阅读模式：只显示 FleurDict 功能
    menu.setNoItems(); // 清除所有默认菜单项
    
    menu.addItem(item => {
      item.setTitle('FleurDict 查词');
      item.setIcon('book-open');
      item.onClick(() => {
        this.selectionHandler.lookupWord(cleanWord);
      });
    });

    menu.addItem(item => {
      item.setTitle('加入生词本');
      item.setIcon('bookmark');
      item.onClick(() => {
        this.plugin.app.workspace.trigger('fleurdict:add-to-wordbook', cleanWord);
      });
    });

    menu.addItem(item => {
      item.setTitle('AI 翻译');
      item.setIcon('languages');
      item.onClick(() => {
        this.plugin.app.workspace.trigger('fleurdict:ai-translate', fullSelection);
      });
    });

    menu.addItem(item => {
      item.setTitle('AI 详解');
      item.setIcon('sparkles');
      item.onClick(() => {
        this.plugin.app.workspace.trigger('fleurdict:ai-detail', fullSelection);
      });
    });
  } else {
    // 正常模式：保留所有 Obsidian 菜单项 + 追加 FleurDict 功能
    // ... 现有逻辑 ...
  }
}
```

**Step 2: Commit**

```bash
git add src/features/context-menu.ts
git commit -m "feat: filter context menu in reading mode"
```

---

## Task 8: 阅读模式 Ribbon 按钮

**Files:**
- Modify: `src/main.ts:36-91` (onload 方法)

**Step 1: 添加 Ribbon 按钮**

在 onload 方法中添加：

```typescript
// 添加阅读模式切换按钮
this.addRibbonIcon('book', 'FleurDict 阅读模式', () => {
  this.settings.readingModeEnabled = !this.settings.readingModeEnabled;
  this.saveSettings();
  
  // 显示提示
  new Notice(`阅读模式已${this.settings.readingModeEnabled ? '启用' : '禁用'}`);
});
```

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: add reading mode ribbon button"
```

---

## Task 9: 单词高亮功能

**Files:**
- Create: `src/features/word-highlighter.ts`
- Modify: `src/main.ts`

**Step 1: 创建 WordHighlighter 类**

```typescript
import { Plugin, MarkdownView, Editor, Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from 'obsidian';
import { FleurDictSettings } from '../types';
import { WordbookManager } from '../core/wordbook-manager';

export class WordHighlighter {
  constructor(
    private plugin: Plugin,
    private settings: FleurDictSettings,
    private wordbookManager: WordbookManager
  ) {}

  register(): void {
    this.plugin.registerEditorExtension(
      ViewPlugin.fromClass(
        class {
          decorations: DecorationSet;
          
          constructor(private view: EditorView) {
            this.decorations = this.buildDecorations();
          }

          update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
              this.decorations = this.buildDecorations();
            }
          }

          buildDecorations(): DecorationSet {
            const decorations: any[] = [];
            const wordbook = this.plugin.wordbookManager.data;
            
            // 创建单词 → proficiency 映射
            const wordMap = new Map<string, number>();
            for (const entry of [...wordbook.words, ...wordbook.phrases]) {
              wordMap.set(entry.word.toLowerCase(), entry.proficiency);
            }

            // 扫描文档
            const doc = this.view.state.doc;
            for (let i = 1; i <= doc.lines; i++) {
              const line = doc.line(i);
              const text = line.text;
              
              // 匹配英文单词
              const wordRegex = /\b[a-zA-Z'-]+\b/g;
              let match;
              
              while ((match = wordRegex.exec(text)) !== null) {
                const word = match[0].toLowerCase();
                const proficiency = wordMap.get(word);
                
                if (proficiency !== undefined && proficiency < 3) {
                  const from = line.from + match.index;
                  const to = from + match[0].length;
                  
                  let color: string;
                  if (proficiency === 0) {
                    color = 'var(--fleurdict-red)';
                  } else if (proficiency === 1) {
                    color = 'var(--fleurdict-yellow)';
                  } else if (proficiency === 2) {
                    color = 'var(--fleurdict-green)';
                  }
                  
                  decorations.push(
                    Decoration.mark({
                      class: 'fleurdict-highlight',
                      attributes: { style: `background-color: ${color}` }
                    }).range(from, to)
                  );
                }
              }
            }

            return Decoration.set(decorations);
          }
        },
        {
          decorations: v => v.decorations
        }
      )
    );
  }
}
```

**Step 2: 添加 CSS 变量**

在 `styles.css` 中添加：

```css
:root {
  --fleurdict-red: #ffebee;
  --fleurdict-yellow: #fff9c4;
  --fleurdict-green: #e8f5e9;
}

.fleurdict-highlight {
  border-radius: 2px;
  padding: 0 2px;
}
```

**Step 3: 注册高亮功能**

在 `src/main.ts` 的 onload 方法中：

```typescript
this.wordHighlighter = new WordHighlighter(this, this.settings, this.wordbookManager);
this.wordHighlighter.register();
```

**Step 4: Commit**

```bash
git add src/features/word-highlighter.ts styles.css src/main.ts
git commit -m "feat: implement word highlighting by proficiency level"
```

---

## Task 10: 构建测试与部署

**Step 1: 构建插件**

```bash
cd /Users/jasonchen/WorkBuddy/WB工作区/2026-08-20-14-33-46/fleurdict
npm run build
```

**Step 2: 部署到 Obsidian**

```bash
cp main.js styles.css manifest.json /Users/jasonchen/WorkBuddy/obsidian-vault/.obsidian/plugins/fleurdict/
```

**Step 3: 在 Obsidian 中测试**

- 按 Cmd+P → "Reload app without saving"
- 测试双击选词
- 测试阅读模式开关
- 测试闪卡复习按钮
- 测试单词高亮

**Step 4: 提交并发布**

```bash
git add .
git commit -m "feat: v1.2.0 - double-click selection, reading mode, proficiency system, word highlighting"

# 更新版本号
# manifest.json: 1.1.0 → 1.2.0
# package.json: 1.1.0 → 1.2.0
# versions.json: 添加 "1.2.0": "1.0.0"

git add manifest.json package.json versions.json
git commit -m "chore: bump to v1.2.0"

https_proxy=http://127.0.0.1:7897 git push origin main
https_proxy=http://127.0.0.1:7897 gh release create 1.2.0 main.js manifest.json styles.css --title "1.2.0" --notes "..."
```

---

## 回滚方案

如果实施过程中遇到问题，可以回滚到当前版本：

```bash
git reset --hard ab00116  # 回滚到 1.1.0 版本
git push -f origin main
```

---

## 实施顺序建议

1. **先实施 Task 1-4**：单词分级系统（数据模型 + 算法 + UI）
   - 这是基础，其他功能依赖这个数据结构
   
2. **再实施 Task 9**：单词高亮
   - 依赖分级数据结构
   
3. **然后实施 Task 5**：双击选词
   - 独立功能，可以单独测试
   
4. **最后实施 Task 6-8**：阅读模式
   - 依赖设置系统，最后实施避免冲突

每个 Task 完成后都构建部署测试，确保功能正常再继续。
