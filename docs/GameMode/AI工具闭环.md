# AI 工具闭环

AI 工具闭环解决的问题是：AI 可以决定是否需要投骰子、抽随机遭遇或执行其他 GameMode 工具，但工具结果必须由 GameMode 真实执行后再反馈给 AI。

## 为什么需要闭环

错误流程：

```text
AI 先写叙述
  ↓
AI 请求骰子
  ↓
GameMode 投骰子
  ↓
把骰子结果拼到回复后面
```

问题是 AI 写叙述时还不知道骰子结果，可能出现：

```text
AI 写“你成功潜入”，但骰子结果是 2。
```

正确流程：

```text
AI 判断需要工具
  ↓
GameMode 执行工具
  ↓
AI 看到工具结果
  ↓
AI 再写最终叙述
```

## 模型可以分开

GameMode 可以把工具规划和叙述生成拆成两个模型角色。

| 角色 | 职责 | 可选模型策略 |
|---|---|---|
| `toolPlanner` | 判断是否需要工具、请求哪些工具 | 便宜、稳定、结构化能力强 |
| `narrator` | 根据工具结果生成最终剧情 | 创作能力强、风格稳定 |

默认可以使用同一个模型：

```json
{
	"models": {
		"toolPlanner": "same-as-chat",
		"narrator": "same-as-chat"
	}
}
```

高级配置可以分开：

```json
{
	"models": {
		"toolPlanner": "fast-json-model",
		"narrator": "creative-story-model"
	}
}
```

## 响应类型

AI 不再只有一种返回格式，而是分阶段返回。

### 请求工具

```json
{
	"phase": "tool_request",
	"toolRequests": [
		{
			"toolId": "rollD20",
			"reason": "潜行检定",
			"input": {
				"difficulty": 12
			}
		}
	]
}
```

### 最终回复

```json
{
	"phase": "final",
	"narration": "你压低身形靠近营地，但脚下枯枝发出清脆的断裂声。守卫猛地转头，举起火把朝你的方向走来。",
	"choices": [
		"立刻躲进旁边的灌木",
		"装作路过的旅人",
		"抢先制服守卫"
	],
	"statePatch": {
		"world.alertLevel": 1
	}
}
```

### 不需要工具时

如果不需要工具，AI 直接返回 `final`：

```json
{
	"phase": "final",
	"narration": "你沿着石阶向下，潮湿的空气里有淡淡铁锈味。",
	"choices": ["继续前进", "检查墙壁", "返回入口"],
	"statePatch": {}
}
```

## Tool Loop 流程

```text
玩家行动
  ↓
执行 trigger 工具
  ↓
调用 toolPlanner
  ↓
如果 phase = tool_request
  ↓
执行 toolRequests
  ↓
把 toolResults 加入上下文
  ↓
再次调用 toolPlanner 或 narrator
  ↓
直到 phase = final
  ↓
调用 narrator 生成最终回复
  ↓
保存消息和状态
```

如果使用同一个模型，可以简化为：

```text
call AI
  ↓
返回 tool_request？执行工具后再次 call AI
  ↓
返回 final？结束
```

如果使用分离模型，推荐：

```text
toolPlanner 只决定工具
  ↓
Tool Runtime 执行工具
  ↓
narrator 只写最终叙述
```

## 上下文格式

第二次调用 AI 时，需要明确传入工具结果。

```json
{
	"turnContext": {
		"playerInput": "我悄悄潜入营地。",
		"state": {
			"world.location": "森林营地",
			"world.alertLevel": 0
		},
		"toolResults": [
			{
				"toolId": "rollD20",
				"reason": "潜行检定",
				"ok": true,
				"data": {
					"notation": "1d20",
					"rolls": [7],
					"total": 7,
					"difficulty": 12,
					"outcome": "failure"
				}
			}
		]
	}
}
```

## 多轮工具调用

允许 AI 基于工具结果继续请求工具，但必须有限制。

示例：

```text
玩家潜入营地
  ↓
AI 请求潜行检定
  ↓
骰子失败
  ↓
AI 请求随机遭遇，判断是哪类守卫发现玩家
  ↓
抽到“醉酒守卫”
  ↓
AI 生成最终叙述
```

限制建议：

```js
const maxToolRounds = 3;
const maxToolCalls = 8;
```

超过限制时，GameMode 应向 AI 发送强制最终回复指令：

```text
本回合工具调用次数已达上限。不要再请求工具，必须基于已有结果返回 phase=final。
```

## 提示词职责

### `toolPlanner` 提示词

只要求它判断工具需求：

```text
你是 GameMode 工具规划器。
你只能返回 JSON。
如果需要工具，返回 phase=tool_request。
如果不需要工具，返回 phase=final。
不要编造骰点、随机表结果或工具结果。
只能请求可用工具列表中的工具。
```

### `narrator` 提示词

只要求它写最终叙述：

```text
你是游戏主持人。
你必须根据玩家行动、当前状态、触发器结果和工具结果生成最终叙述。
不得忽略工具结果。
不得伪造未执行的工具结果。
返回 phase=final JSON。
```

## 状态变更规则

1. `tool_request` 阶段不应该返回最终 `statePatch`。
2. 工具自己的 `patch` 可以立即应用，并记录 `changes`。
3. `final` 阶段可以返回 `statePatch`。
4. `final statePatch` 应基于真实工具结果。
5. 发生冲突时记录冲突，默认后写覆盖前写。

## 玩家可见内容

`tool_request` 阶段默认不展示给玩家。

最终展示内容建议包含：

```text
叙述正文

【检定】
D20 检定：1d20 = 7，难度 12，失败。

【状态变化】
world.alertLevel：0 → 1

【可选行动】
1. 立刻躲进旁边的灌木
2. 装作路过的旅人
3. 抢先制服守卫
```

是否展示工具结果可以由机制包控制：

```json
{
	"toolResultVisibility": "visible"
}
```

可选值：

| 值 | 说明 |
|---|---|
| `visible` | 对玩家展示工具结果 |
| `summary` | 只展示摘要 |
| `hidden` | 不展示，只影响叙述和状态 |

默认建议 `visible`，方便玩家信任随机结果。
