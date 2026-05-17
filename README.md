# 与 AI 的睡前故事 2

一个基于 **Vue 3 + Vite** 的 AI 交互应用，采用 **微内核 + 插件化模式** 架构。
它不只是聊天页，而是可扩展的前端 AI 平台：目前已经包含 **标准对话、绘图模式、GameMode（文本游戏）** 三种能力。

## 项目现状（2026）

- 已落地三种模式：`StandardChatMode`、`DrawMode`、`GameMode`
- 已落地预设体系（Preset）：内置预设 + 自定义预设 + 按预设分桶存储 API Key
- 已落地统一 AI 调用层：OpenAI 兼容协议 + Gemini 原生协议
- 已落地会话持久化与归档导入导出（含可选加密）
- GameMode 已具备机制包、工具运行时、触发器、状态面板、日志系统

## 核心功能

### 1) 标准对话模式

- 流式响应
- 多会话管理
- 消息编辑/重生/删除
- Markdown 渲染与代码高亮

### 2) 绘图模式

- 按预设能力标记自动识别图像输出能力
- 使用统一模型调用配置（与主应用一致）

### 3) GameMode（文本游戏运行时）

- 机制包驱动（内置 + 自定义导入）
- 工具系统：`dice` / `table` / `encounter` / `stateCheck` / `patchState`
- 触发器系统：回合条件触发、冷却、最大触发次数
- 状态系统：状态快照、回退、分支恢复
- 运行日志系统：Debug/Info/Warn/Error 分级

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
npm install
npm run dev
```

默认使用 Vite 开发服务器（端口 `3000`）。

### 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生产构建
npm run serve    # 预览构建产物
npm run deploy   # 发布 dist 到 GitHub Pages
```

补充：仓库内有一个手工测试脚本（非 npm script）：

```bash
node tests/branch-naming.test.mjs
```

## 架构概览

运行主链路：

`main.js` → `AppCore.vue` → 模式插件（`src/modes/*`）→ `aiService` → 协议适配器（`openaiCompatible` / `gemini`）

### 关键目录

```text
src/
├─ core/                 # 微内核：插件系统、全局状态、AI 服务
├─ config/presets/       # 预设体系（内置/自定义/CRUD）
├─ modes/                # 模式插件（standard-chat / draw / game）
├─ gamePacks/            # GameMode 机制包（内置与导入）
├─ utils/                # 通用工具与运行时（含 gamePackRuntime）
├─ appCore/methods/      # AppCore 方法拆分（聊天/设置/归档等）
└─ shared/components/    # 模式共享组件
```

## 配置与数据说明

- API Key 保存在浏览器本地（按 `presetId` 分桶）
- 聊天记录使用本地持久化（IndexedDB）
- 支持归档、导入导出、归档修复工具
- 应用是纯前端部署形态，无需自建后端即可使用（也支持后端代理预设）

## GameMode 文档入口

GameMode 的详细设计与进度在 `docs/GameMode/`：

- `docs/GameMode/README.md`
- `docs/GameMode/机制包结构.md`
- `docs/GameMode/机制包制作指南.md`
- `docs/GameMode/提示词构造.md`
- `docs/GameMode/工具基建设计.md`
- `docs/GameMode/随机池与随机表.md`
- `docs/GameMode/触发器.md`
- `docs/GameMode/存档与导入.md`
- `docs/GameMode/游戏模式开发进度.md`

## 开发与扩展

如果你要新增一个模式，建议从以下文档开始：

- `docs/快速开始.md`
- `docs/架构说明.md`
- `docs/插件开发示例.md`
- `docs/新模式开发文档.md`

## 部署说明

项目的 Vite `base` 已配置为：

- `/Bedtime-Stories-with-AI-2/`

适配 GitHub Pages 子路径部署。如需部署到根路径或其他域名子路径，请修改 `vite.config.js` 的 `base`。

## 技术栈

- Vue 3
- Vite 4
- Element Plus
- Tailwind CSS
- Markdown-It（Markdown 渲染）
- Highlight.js（代码高亮）

## 贡献

欢迎提交 Issue / PR，一起完善模式能力与文档。

## 许可证

本项目使用 [MIT License](./LICENSE)。
