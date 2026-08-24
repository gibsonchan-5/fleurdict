# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-08-20

### Added
- ✨ 完整的本地词典导入功能（JSON 格式）
- ✨ 闪卡复习弹窗（SM-2 间隔重复算法）
- ✨ 生词本管理侧栏视图
- ✨ AI 详解和翻译功能
- ✨ AI 侧栏聊天视图
- ✨ 支持多 AI 提供商（DeepSeek、Qwen、GLM、SiliconFlow）
- ✨ 生词本导出为 Markdown
- ✨ 完整的设置面板（5 个 Tab）
- ✨ Light/Dark 主题完整适配
- ✨ 移动端响应式布局

### Changed
- 🎨 优化 UI 过渡动画
- 🎨 改进错误提示和加载状态
- 📱 优化移动端触摸交互
- ⚡ 提升词典查询性能

### Fixed
- 🐛 修复划词事件在 Live Preview 下的稳定性
- 🐛 修复词典弹窗位置计算
- 🐛 修复生词本数据持久化问题
- 🐛 修复 AI 流式输出的中断处理

## [0.2.0] - 2026-08-20

### Added
- ✨ AI 侧栏视图
- ✨ 多 AI 提供商支持
- ✨ 生词本管理功能
- ✨ 闪卡复习功能
- ✨ SM-2 间隔重复算法
- ✨ 右键菜单增强
- ✨ 命令面板集成

### Changed
- 🎨 重构 UI 组件架构
- 🎨 优化样式系统
- 📦 改进模块化设计

## [0.1.0] - 2026-08-20

### Added
- 🎉 首次发布
- ✨ 基础词典查询功能
- ✨ 划词查询（双击/划选）
- ✨ 右键菜单查词
- ✨ 词典弹窗 UI
- ✨ Free Dictionary API 集成
- ✨ 缓存机制
- ✨ 设置面板基础功能

### Known Issues
- MDX 格式词典支持尚未完成（计划在 v0.4.0 实现）
- 移动端部分功能需要优化

---

## 版本说明

- **Added** - 新增功能
- **Changed** - 功能变更
- **Deprecated** - 即将废弃的功能
- **Removed** - 已移除的功能
- **Fixed** - 问题修复
- **Security** - 安全性修复

## 计划中的功能

### v0.4.0
- MDX/MDD 格式词典完整支持
- 词根词缀记忆法
- 词频统计标记

### v0.5.0
- Anki 导出功能
- 学习报告生成
- 单词关联图谱

### v1.0.0
- 提交 Obsidian 社区插件审核
- 完整的文档和测试
- 性能优化和稳定性提升
