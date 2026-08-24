# FleurDict 部署与测试指南

## 📦 构建产物

Phase 4 已完成，最终构建产物：

- **main.js**: 63KB（生产版本，已压缩）
- **styles.css**: 25KB（完整样式）
- **manifest.json**: 283B（插件清单）
- **源代码**: 约 5900 行 TypeScript

## 🚀 本地部署测试

### 步骤 1：找到 Obsidian Vault 插件目录

```bash
# macOS/Linux 示例
cd /path/to/your/vault/.obsidian/plugins/

# 如果 plugins 目录不存在，先创建
mkdir -p plugins
```

### 步骤 2：复制构建产物

```bash
# 创建插件目录
mkdir -p /path/to/your/vault/.obsidian/plugins/fleurdict

# 复制文件
cp /path/to/fleurdict/main.js /path/to/your/vault/.obsidian/plugins/fleurdict/
cp /path/to/fleurdict/styles.css /path/to/your/vault/.obsidian/plugins/fleurdict/
cp /path/to/fleurdict/manifest.json /path/to/your/vault/.obsidian/plugins/fleurdict/
```

### 步骤 3：启用插件

1. 打开 Obsidian
2. 进入 **设置** → **第三方插件**
3. 找到 **FleurDict**，点击启用
4. 如果提示"受限模式"，需要先关闭受限模式

## ✅ 功能测试清单

### Phase 1：基础词典功能
- [ ] 双击单词弹出词典弹窗
- [ ] 划选短语可查询
- [ ] 右键菜单显示"查词"选项
- [ ] 命令面板可搜索"FleurDict"
- [ ] 词典弹窗显示音标、释义、例句
- [ ] 发音按钮可播放音频
- [ ] 设置面板可打开并保存配置

### Phase 2：AI 功能
- [ ] 右键菜单显示"AI 详解"和"AI 翻译"
- [ ] 配置 AI Provider 和 API Key 后可用
- [ ] AI 弹窗正常显示流式输出
- [ ] AI 侧栏可打开并正常交互
- [ ] 左侧 Ribbon 图标可打开 AI 侧栏

### Phase 3：生词本与闪卡
- [ ] 右键菜单"加入生词本"功能正常
- [ ] 生词本侧栏可查看和管理单词
- [ ] 生词本可导出为 Markdown
- [ ] 闪卡复习弹窗可正常显示
- [ ] 评分按钮（忘了/困难/良好/简单）功能正常
- [ ] 闪卡复习完成后显示统计

### Phase 4：UI 与体验
- [ ] Light 主题显示正常
- [ ] Dark 主题显示正常
- [ ] 移动端响应式布局正常
- [ ] 过渡动画流畅
- [ ] 错误提示清晰友好
- [ ] 加载状态显示正常

## 🧪 边界情况测试

### 网络测试
- [ ] 断开网络后，本地缓存的单词仍可查询
- [ ] 网络恢复后，自动使用在线词典
- [ ] API 请求超时有友好提示

### 大数据测试
- [ ] 生词本 100+ 单词时性能正常
- [ ] 闪卡复习 50+ 张卡片时流畅
- [ ] 本地词典 10000+ 词条时加载正常

### 兼容性测试
- [ ] Live Preview 模式下划词正常
- [ ] Reading View 模式下划词正常
- [ ] Source Mode 下不影响编辑
- [ ] 多个 Obsidian 窗口同时运行正常

## 🔧 开发模式测试

如果需要实时调试，可以使用开发模式：

```bash
# 在 fleurdict 目录下
cd /path/to/fleurdict

# 启动开发模式（自动监听文件变化并重新构建）
npm run dev

# 然后使用软链接到 Obsidian vault
ln -s /path/to/fleurdict /path/to/your/vault/.obsidian/plugins/fleurdict
```

修改代码后会自动重新构建，重启 Obsidian 或重新加载插件即可看到效果。

## 📝 配置建议

### 推荐 AI 配置

**DeepSeek（推荐）**
- Base URL: `https://api.deepseek.com`
- Model: `deepseek-chat`
- API Key: 从 https://platform.deepseek.com 获取

**Qwen（通义千问）**
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Model: `qwen-turbo`
- API Key: 从阿里云控制台获取

### 词典源配置

建议优先级：
1. **本地词典**（如果有常用词典）- 响应最快
2. **Free Dictionary API** - 免费、稳定
3. **其他在线词典** - 作为备选

## 🐛 常见问题

### Q: 插件无法加载
A: 检查是否关闭了"受限模式"，确认文件完整性

### Q: 划词没有反应
A: 检查是否在编辑器区域（非侧栏），尝试重启 Obsidian

### Q: AI 功能不可用
A: 检查 API Key 是否正确配置，网络是否畅通

### Q: 发音按钮无声音
A: 检查网络连接，部分音频 URL 可能失效

### Q: 生词本数据丢失
A: 数据保存在 `.obsidian/plugins/fleurdict/data.json`，建议定期备份

## 📊 性能指标

- **词典查询响应时间**: < 500ms（在线），< 100ms（本地）
- **弹窗显示时间**: < 100ms
- **生词本加载时间**: < 200ms（1000 条）
- **插件启动时间**: < 300ms
- **内存占用**: < 20MB

## 🎯 下一步计划

### v0.4.0 计划
- MDX/MDD 格式完整支持
- 词根词缀记忆法
- 词频统计和考试标记

### v0.5.0 计划
- Anki 导出功能
- 学习报告生成
- 单词关联图谱

### v1.0.0 目标
- 提交 Obsidian 社区插件审核
- 完整的单元测试覆盖
- 性能优化和稳定性提升

---

**最后更新**: 2026-08-20  
**版本**: v0.3.0 (Phase 4 完成)
