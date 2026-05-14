# GameMode 文档

GameMode 是游戏模式的运行时。它负责机制包、状态、工具、触发器、AI 调用和对话保存。

工具运行期是 GameMode 内部能力，不设计成全局通用工具系统。机制包只声明工具，GameMode 负责解释、执行、回传和保存结果。

## 文档索引

- [机制包结构](./机制包结构.md)
- [机制包制作指南](./机制包制作指南.md)
- [提示词构造](./提示词构造.md)
- [工具基建设计](./工具基建设计.md)
- [随机池与随机表](./随机池与随机表.md)
- [AI 工具闭环](./AI工具闭环.md)
- [触发器](./触发器.md)
- [存档与导入](./存档与导入.md)

## 当前代码位置

- 模式入口：`src/modes/GameMode/`
- 内置机制包：`src/gamePacks/builtin.js`
- 机制包注册表：`src/gamePacks/index.js`
- 运行时工具：`src/utils/gamePackRuntime.js`

## 核心边界

GameMode 内部包含以下模块职责：

| 模块 | 职责 |
|---|---|
| `GameMode` | UI、消息流、状态同步、AI 调用编排 |
| `GamePack` | 声明状态、UI、工具、触发器、提示词、规则数据 |
| `Tool Runtime` | 执行 GameMode 工具，返回结构化结果 |
| `Random Runtime` | 执行随机池、随机表、子词条、洗牌袋等随机机制 |
| `Tool Loop` | 处理 AI 请求工具、执行工具、把结果回传 AI |
| `Trigger Runtime` | 在玩家行动后检查规则并自动执行工具 |
| `State Runtime` | 读取、补丁、变更记录、持久化 |

## 标准回合流程

```text
玩家输入
  ↓
GameMode 增加回合数
  ↓
Trigger Runtime 执行系统触发器
  ↓
Tool Planner 判断是否需要 AI 工具
  ↓
Tool Runtime 执行工具
  ↓
Tool Loop 把工具结果回传给 AI
  ↓
Narrator 生成最终叙述、选项、状态补丁
  ↓
GameMode 应用状态变更并保存消息
```

## 设计原则

1. 工具运行期属于 `GameMode`，不外溢为全局工具系统。
2. AI 可以决定是否请求工具，但不能伪造工具结果。
3. 工具执行必须由前端运行时完成，并返回结构化结果。
4. 最终叙述必须基于真实工具结果生成。
5. 机制包应尽量声明式，避免写代码。
6. 工具结果既要可读展示，也要结构化保存。

## 运行日志系统

GameMode 现已内置回合级日志系统，侧栏可直接查看。

- 可开关日志采集（默认开启）
- 支持级别筛选（Debug / Info / Warn / Error）
- 支持 Console 镜像输出
- 可清空日志
- 自动记录关键阶段：回合启动、触发器执行、AI 工具请求、工具执行结果、最终落地/异常

日志存储在当前对话 `metadata.gameMode.logs` 中，配置在 `metadata.gameMode.logSettings`。

