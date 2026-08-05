# API 格式显式切换与缓存可用性方案

> 状态：已实现
> 背景：当前已支持 Chat Completions 与 Anthropic Messages（Claude Code 同系）两条请求路径；本方案补齐显式格式切换与缓存不可用 UI。

---

## 1. 现状

### 1.1 两条 API 格式

| 格式 | 端点 | 驱动 | 触发条件（现状） |
|------|------|------|------------------|
| Chat Completions | `/v1/chat/completions` | `openaiCompatible.js` | 默认路径；带前缀模型（如 `anthropic/claude-*`）；后端代理 |
| Anthropic Messages（Claude Code 同系） | `/v1/messages` | `anthropic.js` | 裸名 `claude-*` 且非后端代理；失败则回退 Chat Completions |

另有 Gemini 原生路径，与本文缓存议题无关。

### 1.2 缓存与格式的关系

Prompt Cache（`cache_control`）只在 Anthropic Messages 上可靠生效并回传 `cache_*_input_tokens`。Chat Completions 路径可注入标记，但多数中转会忽略，实测缓存写入常为 0。

当前路由逻辑（`shouldUseAnthropicNative`）：

- 裸 `claude-*` → 自动走 Anthropic Messages
- `anthropic/claude-*` → 仍走 Chat Completions（交给中转自有缓存）
- 后端代理 → 强制 Chat Completions（无 `/v1/messages`）

### 1.3 UI 缺口

- 设置抽屉 / 模型栏：**没有**「API 格式」开关，用户无法显式选择
- 缓存控件（关 / 5m / 1h）始终可点，不区分当前路径是否真能缓存
- 无「缓存不可用」态；仅有 tooltip 软提示与 DevTools 遥测

消息上的灰色 **A** 徽章表示「自动断点」，不是 API 格式名。下文「Anthropic 格式」指 `/v1/messages` 路径。

---

## 2. 目标

1. 在设置中可**显式切换** API 格式：Chat Completions ↔ Anthropic Messages
2. **仅 Anthropic Messages 路径**开放 Prompt Cache 机制（写断点、计 TTL、倒计时）
3. 选用 Claude 系列模型时，**自动切到 Anthropic Messages**，以便产生缓存
4. 缓存不可用时，界面上的缓存设置呈现**明确不可用态**（禁用 + 原因）

非目标：把 `protocol` 扩成用户可选第三种预设协议；不改 Gemini 路由；不引入 Claude Code CLI 协议。

---

## 3. 概念拆分

把两层概念分开，避免和现有 `preset.protocol`（`openai` | `gemini`）纠缠：

| 概念 | 含义 | 存哪 |
|------|------|------|
| `preset.protocol` | 预设通道：OpenAI 兼容底座 vs Gemini 原生 | 预设注册表（已有） |
| `requestFormat` | 单次请求外壳：`chat_completions` \| `anthropic_messages` | 用户偏好 + 运行时推导 |

`requestFormat` 只作用于「OpenAI 兼容底座」上的二次路由（老张、LMRouter、自定义中转等）。Gemini 预设不受此开关影响。

命名建议（UI 文案）：

- `Chat Completions`
- `Anthropic Messages`（副文案：Claude Code 同系 / 可启用提示词缓存）

内部枚举：`chat_completions` | `anthropic_messages` | `auto`（推荐默认）。

---

## 4. 路由规则

### 4.1 有效格式 `resolveRequestFormat()`

输入：`requestFormatPref`（用户偏好）、`model`、`isBackendProxy`、`preset.protocol`。

```
若 preset.protocol === 'gemini'        → 不走本开关（Gemini 驱动）
若 isBackendProxy                      → chat_completions（硬约束）
若 requestFormatPref === 'chat_completions'     → chat_completions
若 requestFormatPref === 'anthropic_messages'   → anthropic_messages
若 requestFormatPref === 'auto'（默认）:
    若 isClaudeModel(model)            → anthropic_messages
    否则                               → chat_completions
```

`isClaudeModel(model)` 建议：

- 裸名 `/^claude-/i`
- 或剥掉常见前缀后仍以 `claude-` 开头（如 `anthropic/claude-sonnet-4.5`）
- 自动模式下对带前缀的 Claude：**仍切 Anthropic Messages**（与现状不同），以便缓存生效；若中转无 `/v1/messages`，沿用现有 404/405/5xx 回退

### 4.2 与现状的差异

| 场景 | 现状 | 方案后（auto） |
|------|------|----------------|
| 老张 + `claude-sonnet-4-…` | Anthropic Messages | 同左 |
| OpenRouter + `anthropic/claude-…` | Chat Completions | **改为** Anthropic Messages（为缓存）；失败回退 |
| 用户强制 Chat Completions + Claude | 无法强制 | 可强制；缓存标记为不可用 |
| 用户强制 Anthropic Messages + 非 Claude | 无法强制 | 允许尝试（中转若支持）；缓存控件可用但提示「取决于上游」 |
| 后端代理 + Claude | Chat Completions | 同左；缓存不可用 |

### 4.3 缓存可用性 `isPromptCacheAvailable`

```
available =
  !isBackendProxy
  && requestFormatEffective === 'anthropic_messages'
  && preset.protocol !== 'gemini'
```

可选加严：同时要求 `isClaudeModel(model)`。推荐**以格式为准**（与「只有 Anthropic 路径才能缓存」一致）；模型不匹配时用弱提示，不额外禁用。

---

## 5. UI 方案

### 5.1 设置抽屉（右上角齿轮 → 设置）

在「选择模型」附近新增一项：

```
API 格式
  ○ 自动（推荐）
  ○ Chat Completions
  ○ Anthropic Messages（可启用提示词缓存）

说明随选项变化：
  自动：Claude 模型走 Anthropic Messages，其余走 Chat Completions
  Chat Completions：始终 /v1/chat/completions；提示词缓存不可用
  Anthropic Messages：始终 /v1/messages；需中转支持该端点
```

后端代理预设下：该项禁用，固定显示「Chat Completions（代理不支持 Messages 端点）」。

Gemini 预设下：隐藏或禁用该项。

### 5.2 模型栏缓存控件（`ModelSelector`）

当 `!isPromptCacheAvailable`：

1. 关 / 5m / 1h **整组 disabled**
2. 旁注文案，例如：`缓存不可用 · 当前为 Chat Completions`
3. tooltip 写清原因（见下表）
4. 若用户此前选了 5m/1h，**保留偏好值**但运行时不注入 `cache_control`；恢复可用后无需重选

| 原因码 | 界面文案 |
|--------|----------|
| `format_chat_completions` | 当前 API 格式为 Chat Completions，缓存仅在 Anthropic Messages 下可用 |
| `backend_proxy` | 后端代理无 Messages 端点，缓存不可用 |
| `gemini_protocol` | Gemini 通道不支持此缓存机制 |
| （可用） | 现有说明保留 |

### 5.3 消息侧缓存入口（金币 / A 徽章）

不可用时：

- 金币按钮 disabled，或点击后 dropdown 仅展示「缓存不可用：…」
- 不展示自动 **A** 徽章（无自动断点）
- 手动断点字段可保留在消息上，但发送时不注入

### 5.4 可选：轻量状态条

在模型栏右侧或缓存旁增加只读标签：`格式: 自动→Messages` / `格式: Completions`，降低「设了缓存却没生效」的困惑。非必须，可二期。

---

## 6. 数据与改动面

### 6.1 持久化

| Key | 值 | 说明 |
|-----|-----|------|
| `bs2_request_format` | `auto` \| `chat_completions` \| `anthropic_messages` | 全局偏好，默认 `auto` |

不进预设，避免每个预设各记一份；若后续需要按预设记忆，再迁到 preset features。

### 6.2 代码落点

| 文件 | 改动 |
|------|------|
| 新建 `src/utils/requestFormat.js` | `isClaudeModel` / `resolveRequestFormat` / `isPromptCacheAvailable` / 原因码 |
| `src/core/services/aiService.js` | 用 `resolveRequestFormat` 替换裸 `shouldUseAnthropicNative`；传入用户偏好 |
| `src/appCore/methods/configMethods.js` + `AppCore.vue` / `store` | 读写 `requestFormat` |
| `src/components/SettingsDrawer.vue` | API 格式单选项 |
| `src/components/ModelSelector.vue` | 缓存控件 disabled + 原因 |
| `MessageControls.vue` | 不可用态 |
| 各 Mode `callAiModel` 调用处 | 传入 `requestFormat`；按可用性决定是否传有效 `promptCacheTtl` |
| `promptCache.js` | 可选：入口处若 TTL 被上层清空则行为不变；不必感知格式 |

### 6.3 调用链（改后）

```
Settings: requestFormatPref
ModelSelector: 读 isPromptCacheAvailable → 启用/禁用缓存 UI
Mode 发送:
  format = resolveRequestFormat(...)
  ttl = available ? promptCacheTtl : ''
  callAiModel({ ..., requestFormat: format, promptCacheTtl: ttl })
aiService:
  anthropic_messages → anthropic.js（可回退）
  chat_completions   → openaiCompatible.js
```

---

## 7. 行为细则

### 7.1 Claude 自动切换

用户保持「自动」时：

1. 选中任意 Claude 模型（含 `anthropic/` 前缀）→ 有效格式变为 Anthropic Messages
2. 缓存控件变为可用（若非代理 / 非 Gemini）
3. 切到非 Claude 模型 → 有效格式回到 Chat Completions，缓存控件禁用并展示原因

用户显式选「Chat Completions」时：即使 Claude 也不自动切换；缓存保持不可用。

用户显式选「Anthropic Messages」时：非 Claude 模型也走 Messages；中转不支持则按现有逻辑回退，并打状态变化日志（非 tick）。

### 7.2 回退与日志

保留 Anthropic 端点缺失时的回退。回退发生时：

- 打一条状态变化日志（格式、status、是否回退）
- 本次请求等价于无缓存；不在 UI 瞬时闪「不可用」（避免抖动）
- 可选：会话级 `lastNativeEndpointFailed`，用于弱提示「当前中转可能不支持 Messages」

### 7.3 与 OpenRouter 前缀模型

现状故意让 `anthropic/` 走 Completions。方案在 **auto** 下改为走 Messages，以便统一缓存体验。风险：部分聚合商只有 Completions。回退机制覆盖该风险；若实测某预设从不支持 Messages，可在 preset `features.forceChatCompletions: true` 上打标（二期）。

---

## 8. 实施顺序

1. **纯函数层**：`requestFormat.js` + 单测（模型判定、可用性、原因码）
2. **路由接入**：`aiService` 吃偏好；Mode 传参；默认 `auto` 行为对齐 §4
3. **设置 UI**：格式三选一
4. **缓存不可用态**：ModelSelector + MessageControls
5. **回退提示 / 状态标签**（可选）

每步可独立合入；1–2 无 UI 也能改善 Claude 前缀模型的缓存命中。

---

## 9. 验收标准

- [ ] 设置里可在三种格式间切换，刷新后偏好仍在
- [ ] `auto` + Claude 模型 → 实际请求 `/v1/messages`（或回退有日志）
- [ ] `auto` + 非 Claude → `/v1/chat/completions`
- [ ] 强制 Completions 时，缓存 关/5m/1h 禁用，并显示「缓存不可用」及原因
- [ ] 强制 Messages 且非代理时，缓存控件可用
- [ ] 后端代理下格式项与缓存均不可用，文案正确
- [ ] Gemini 预设不受格式开关干扰
- [ ] 消息自动 **A** 徽章仅在缓存可用且全局 TTL 开启时出现

---

## 10. 开放问题（实现前确认）

1. **「A 开头的 API」**若另有所指（例如仅某家中转、或仅指消息上的 A 徽章），需对齐后再改 `isPromptCacheAvailable` 条件。
2. OpenRouter 类 `anthropic/` 前缀模型：auto 是否一律切 Messages（本方案默认是）。
3. 格式偏好：全局一份，还是跟预设走。
4. 缓存不可用时：仅禁用顶部控件，还是同时禁用消息金币菜单。
