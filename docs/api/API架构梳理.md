# 项目 API 架构梳理

> 面向：阅读/扩展本项目 AI 调用层、新增模式插件、新增 AI 提供商、排查请求链路的人。
> 范围：**前端到 AI 提供商之间的所有调用基建**，不包含 UI/存档等非 API 相关基建。
> 更新日期：2026-04-25（已完成 Preset 架构改造 Phase 0–4）

---

## 0. 全景图：调用链路一览

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                       调用方 (Caller)                           │
 │                                                                  │
 │  StandardChatMode / DrawMode / (未来的 VirtualLoverMode …)        │
 │   │  · 构造 messages / extraBody                                  │
 │   │  · 准备 AbortController                                       │
 │   │  · 准备 onChunk 节流回调                                       │
 │   ▼                                                              │
 └──────────────────────────────────────────────────────────────────┘
                            │ 统一入口
                            ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │         核心 AI 服务  src/core/services/aiService.js             │
 │                                                                  │
 │  callAiModel({ provider, apiUrl, apiKey, model, messages, ... }) │
 │     │                                                            │
 │     ├─ normalizeApiUrl()         规范化协议                      │
 │     ├─ ensureCompletionsEndpoint() 补齐 /v1/chat/completions     │
 │     ├─ getProviderByModelName()  由模型名推断供应商               │
 │     ├─ getProviderByApiUrl()     由域名推断供应商                 │
 │     └─ 路由 → openaiCompatible / gemini                          │
 └──────────────────────────────────────────────────────────────────┘
                            │
               ┌────────────┴───────────────┐
               ▼                            ▼
 ┌──────────────────────────┐    ┌──────────────────────────┐
 │ providers/               │    │ providers/gemini.js      │
 │ openaiCompatible.js      │    │ Google 原生 + OpenAI 兼容 │
 │ 所有 OpenAI 兼容协议驱动  │    │                          │
 │                          │    │                          │
 │ · /v1/chat/completions   │    │ · :streamGenerateContent │
 │ · SSE `data: { … }`      │    │ · SSE `data: { … }`      │
 │ · reasoning_content      │    │ · candidates[].parts     │
 │ · choices[].delta        │    │ · choices[].delta (兼容) │
 │ · images (OpenRouter)    │    │                          │
 └──────────────────────────┘    └──────────────────────────┘
               │                            │
               └────────────┬───────────────┘
                            ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │              远端服务（两种模式由当前预设决定）                    │
 │                                                                  │
 │  A. 直连模式 (preset.authMode === 'apiKey')                       │
 │     · SiliconFlow / Deepseek 官方 / OpenRouter / LMRouter /       │
 │       火山引擎 / Gemini 官方 / 自定义预设                          │
 │     · 使用 Authorization: Bearer <user key>                       │
 │                                                                  │
│  B. 后端代理模式 (preset.authMode === 'password')                  │
│     · builtin_backend_openai / builtin_backend_gemini              │
│     · 真 key 在后端；前端主用 X-Feature-Password，兼容场景可附带    │
│       x-api-key                                                    │
 └──────────────────────────────────────────────────────────────────┘
```

这套基建围绕一个核心思想：**调用方只认 `callAiModel` 一个函数；供应商差异由 core/providers 两层消化掉；而"连接哪个供应商"的知识完全收敛在 Preset 注册表中**。

---

## 1. 四层分层结构

项目的 API 基建可以清晰地切成 **4 层**，从上到下分别是：

| 层次 | 角色 | 目录 | 可替换性 |
|------|------|------|----------|
| L1 调用方 | 模式插件（业务层） | `src/modes/**` | 新模式自由接入 |
| L2 统一入口 | 核心 AI 服务 | `src/core/services/aiService.js` | 应保持稳定 |
| L3 协议适配 | Provider Drivers | `src/utils/providers/*.js` | 按协议新增 |
| L4 支撑基建 | Preset 注册表 / Key 管理 / 辅助工具 | `src/config/presets/`、`src/utils/*.js`、`src/core/store.js` | 独立演进 |

还有一条与 L1~L4 正交的 **L0 旁路**：
- `src/utils/aiService.js` 是一个 `@deprecated` 的**兼容转发壳**，目前无人使用，保留的唯一目的是防止外部代码直接 import 老路径后爆炸。

---

## 2. L4 重点：Preset 注册表（Phase 0–4 成果）

### 2.1 总体架构

```
┌─────────────────────────────────────────────┐
│ Layer A: Preset Registry                    │
│ - 内置直连预设（硅基流动、Deepseek…）       │
│ - 内置代理预设（OpenAI/Gemini 后端代理）    │
│ - 自定义预设（用户创建，localStorage 持久化）│
│ - 协议 / baseUrl / 模型列表 / authMode      │
│ - features: 能力标记（imageOutput / reasoning）│
└─────────────────────────────────────────────┘
                     ↓ 选择 activePresetId
┌─────────────────────────────────────────────┐
│ Layer B: Runtime State + Protocol Adapter   │
│ - activePresetId → currentPreset            │
│ - selectedModelByPresetId                   │
│ - provider = currentPreset.protocol         │
│ - 全局偏好（temperature / maxTokens）       │
│ - 对应 driver 直接发请求                    │
└─────────────────────────────────────────────┘
```

### 2.2 核心文件

| 文件 | 职责 |
|------|------|
| `src/config/presets/builtin.js` | 内置预设注册表（只读数据源） |
| `src/config/presets/index.js` | Preset 入口：查询、匹配、CRUD、能力标记规范化、模型列表派生 |
| `src/utils/keyManager.js` | API Key 按 `presetId` 分桶存储 |
| `src/core/services/modelFetcher.js` | 从远端拉取模型列表 |

### 2.3 Preset Schema

```js
{
  id: 'builtin_openrouter',
  label: 'OpenRouter',
  protocol: 'openai',           // 'openai' | 'gemini'
  baseUrl: 'https://openrouter.ai/api/v1',
  models: ['google/gemini-2.5-flash', ...],
  isBuiltin: true,
  authMode: 'apiKey',           // 'apiKey' | 'password'
  editableBaseUrl: false,       // 仅代理预设为 true
  features: {                   // Phase 4 新增
    imageOutput: true,
    reasoning: true,
  },
  // 仅自定义预设
  createdAt: '2026-04-24T23:00:00.000Z',
  updatedAt: '2026-04-24T23:00:00.000Z',
}
```

### 2.4 关键派生关系

```
activePresetId
   ↓
currentPreset = getPresetById(activePresetId)
   ├─ provider = currentPreset.protocol
   ├─ apiUrl = getPresetRuntimeBaseUrl(currentPreset)
   ├─ authMode → isBackendProxy = (authMode === 'password')
   ├─ models = currentPreset.models
   └─ features = currentPreset.features
       └─ supportsImageOutput = features.imageOutput
```

**`activePresetId` 是唯一事实源。** `provider`、`apiUrl`、`isBackendProxy` 全部是派生值。

### 2.5 内置预设清单

| id | label | protocol | authMode | features |
|----|-------|----------|----------|----------|
| `builtin_siliconflow` | 硅基流动 | openai | apiKey | — |
| `builtin_deepseek` | Deepseek 官方 | openai | apiKey | — |
| `builtin_volces` | 火山引擎 | openai | apiKey | — |
| `builtin_openrouter` | OpenRouter | openai | apiKey | imageOutput ✓, reasoning ✓ |
| `builtin_lmrouter` | LMRouter | openai | apiKey | — |
| `builtin_gemini` | Google Gemini | gemini | apiKey | imageOutput ✓, reasoning ✓ |
| `builtin_backend_openai` | OpenAI 后端代理 | openai | password | — |
| `builtin_backend_gemini` | Gemini 后端代理 | gemini | password | — |

---

## 3. L2：统一入口 `core/services/aiService.js`

这是整个 API 架构真正的"腰"。所有模式最终都经过它。

### 3.1 对外导出

| 导出 | 作用 | 使用位置 |
|------|------|----------|
| `callAiModel(options)` | **唯一**的 AI 调用入口，返回最终 assistant message | StandardChatMode、DrawMode |
| `listModelsByProvider(provider, useBackendProxy, apiUrl)` | 根据当前配置列出可用模型 | `configMethods.updateModels()` |
| `getProviderByApiUrl(apiUrl)` | 根据 URL 推断 provider | 内部使用，也对外暴露 |

### 3.2 `callAiModel` 选项契约

```js
await callAiModel({
  provider,              // 'gemini' | 'openai_compatible' | 未指定
  apiUrl,                // 由 preset.baseUrl 派生的运行时 URL
  apiKey,                // 用户 key 或代理认证 key
  model,                 // 模型名；可反推 provider
  messages,              // [{ role, content }]，角色标准：user/assistant
  temperature = 0.7,
  maxTokens   = 4096,
  signal,                // AbortSignal，用于取消
  onChunk,               // (chunk) => void，流式进度回调
  featurePassword,       // 仅后端代理模式使用
  isBackendProxy,        // 由 preset.authMode === 'password' 派生
  geminiReasoningEffort, // 'off' | 'low' | 'medium' | 'high'
  stream = true,         // DrawMode 会置 false
  extraBody = {}         // 提供商特有参数透传（如 modalities / image_config）
})
```

**返回值统一**是 provider 回传的 `assistantMessage`：
```js
{
  role: 'assistant',
  content: string,
  reasoning_content: string,   // 可为空
  timestamp: ISO string,
  images: [{...}]              // 仅 DrawMode 场景会有
}
```

### 3.3 四道"消化阀"

`callAiModel` 在落到具体 provider 之前做了四件关键的事，每一件都在向调用方**屏蔽差异**：

1. **URL 规范化** —— `normalizeApiUrl()`
   补齐 `https://`，容忍无协议/双斜线写法。

2. **端点补齐** —— `ensureCompletionsEndpoint()`
   - 保留 `/stream`、`/v1/chat/completions`、`/v3/chat/completions`。
   - 后端代理形如 `/api/gemini/stream`、`/api/deepseek/stream` 统一改写成 `/api/v1/chat/completions`。
   - 其它裸域名统一追加 `/v1/chat/completions`。

3. **Provider 推断双通道**
   - 先看 `model` 名前缀（如 `gemini-`、`openai/`、`deepseek/`、`openrouter/`、`lmrouter/`）。
   - 再看 URL 域名（`generativelanguage.googleapis.com`、`openrouter.ai`、`siliconflow.cn` …）。
   - 最终走 `gemini` 分支还是 `openai_compatible` 分支就此确定。

4. **参数转发**
   保留 `stream`、`extraBody`、`geminiReasoningEffort` 等能力，**不做魔法删减**。

> 设计要点：这一层**不碰 fetch**、不管 SSE 解析，只做 **路由** + **参数转发**，因此极轻量，易于扩展。

---

## 4. L3：Provider Drivers

真正的网络通信和协议适配发生在这层。目前有两个驱动，它们结构对称但协议不同。

### 4.1 `providers/openaiCompatible.js` —— OpenAI 兼容阵营

> 历史注：此文件在 Phase 1A 前名为 `deepseek.js`，已按协议名重命名。

**代表一大类**：SiliconFlow、Deepseek 官方、OpenRouter、LMRouter、火山引擎，以及自建代理和所有用户自定义预设。

核心行为：
- 请求体固定用 `{ model, messages, stream, temperature, max_tokens, ...extraBody }`。
- 若模型名含 `gemini` 且设置了 `geminiReasoningEffort`，挂 `reasoning.effort`（OpenRouter 风格）。
- 流式：按 `\n` 拆行，解析 `data: {...}`，忽略 `[DONE]` 与注释行 `:`。
- 字段映射：
  - `choices[0].delta.content` → `content`
  - `choices[0].delta.reasoning_content` / `reasoning` → `reasoning_content`（后者把 `\\n` 还原成真换行）
  - `choices[0].message.images` → `images`（OpenRouter 的 Gemini 图像响应）
- 非流式：返回 `choices[0].message.{content, reasoning_content, images}`。

### 4.2 `providers/gemini.js` —— 双协议兼容

根据 `apiUrl` 是否指向 `generativelanguage.googleapis.com` 分叉：

| 分支 | 请求路径 | Body 形态 | 响应解析 |
|------|----------|-----------|----------|
| `isDirectGoogle=true` | `https://...googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key=...` | Google 原生 `contents[{ role, parts:[{text}] }]` + `generationConfig` | `candidates[0].content.parts[*].text` |
| `isDirectGoogle=false` | 由调用方给（通常是后端代理） | OpenAI 兼容 `messages` + `reasoning.effort` | `choices[0].delta.{content, reasoning_content}` |

这样，同一个 `gemini` 驱动既能打 Google 官方，也能打任何 OpenAI 兼容的 Gemini 透传代理。

### 4.3 鉴权策略（两种驱动共享同一规则）

| 模式 | 是否加 `Authorization` | 额外头 |
|------|------------------------|--------|
| 直连（`isBackendProxy=false`） | ✅ `Bearer <apiKey>` | — |
| 直连 Google Gemini | ❌（key 放 query string） | — |
| 后端代理（`isBackendProxy=true`） | ❌ 不加，避免覆盖后端真实 key | 主用 `X-Feature-Password: <featurePassword>`；兼容场景下可附带 `x-api-key: <apiKey>` |

这条规则是**整个项目鉴权的唯一真相**。

### 4.4 新增 Provider 的模板

以接入 "XYZ 协议" 为例：
1. 在 `src/utils/providers/` 新增 `xyz.js`，导出 `async function callModelXyz(options)`，返回统一的 `assistantMessage`。
2. 在 `core/services/aiService.js` 的 `getProviderByModelName` / `getProviderByApiUrl` 中加入识别规则。
3. 在 `callAiModel` 的路由分支中新增 `if (effectiveProvider === 'xyz') return callModelXyz({...})`。
4. 如需让 UI 下拉列表显示其模型，在 `listModelsByProvider` 中补一段。

调用方**零修改**。

---

## 5. L1：调用方（模式插件）的统一模板

现存两个实际使用者都遵循同一套骨架：

```js
// 1) 中止控制
this.abortController = new AbortController();

// 2) 统一使用 modeConfig 下发的运行时 URL（已由 Preset 层派生好）
let effectiveApiUrl = this.config.apiUrl;

// 3) 调用
await callAiModel({
  provider: this.config.provider,      // 从 preset.protocol 派生
  apiUrl: effectiveApiUrl,
  apiKey: this.config.apiKey,
  model: this.config.model,
  messages,
  temperature: this.config.temperature,
  maxTokens: this.config.maxTokens,
  signal: this.abortController.signal,
  featurePassword: this.config.featurePassword,
  isBackendProxy: this.config.isBackendProxy,  // 从 preset.authMode 派生
  geminiReasoningEffort: this.config.geminiReasoningEffort,
  onChunk: (chunk) => { /* 节流 UI 更新 */ },
  stream, extraBody
});
```

两者差异只在 **stream / extraBody / onChunk** 的使用方式：

| 模式 | stream | onChunk | 典型 extraBody |
|------|--------|---------|----------------|
| `StandardChatMode` | `true`（默认） | 有，配合 `throttle(1000ms)` 刷 UI、`throttle(2000ms)` 存盘 | 无 |
| `DrawMode` | `false` | 无（非流式） | `{ modalities: ['image','text'], image_config: { aspect_ratio } }` |

### 5.1 DrawMode 的能力感知（Phase 4）

DrawMode 现在**不再硬编码推荐 OpenRouter**，而是通过 `modeConfig` 中的能力标记来决定行为：

```js
// 从 modeConfig 读取当前预设是否支持图像输出
this.config.supportsImageOutput    // Boolean
this.config.presetFeatures         // { imageOutput, reasoning }
this.config.currentPreset          // 完整预设对象
```

自定义预设也可以在"高级能力"里手动开启 `imageOutput`，DrawMode 同样能识别。

---

## 6. 支撑基建

`callAiModel` 本身很薄，真正让调用方写得"干净"的，是 `src/utils/` 下一组彼此正交的小工具。它们共同构成**模式开发者的配套 SDK**。

### 6.1 Mode Helper 家族（通过 `src/utils/modeHelpers.js` 聚合导出）

| Helper | 文件 | 职责 | 与 API 调用的关系 |
|--------|------|------|-------------------|
| `AbortManager` | `abortHelper.js` | 封装 `AbortController`：`create()` 自动 abort 上一次 | 传给 `callAiModel({ signal })` |
| `ThrottleManager` / `throttle` | `throttleHelper.js` | 节流。1 个 `setTimeout` 窗口 | 包住 `onChunk` 里的 UI/存盘动作 |
| `StreamJsonParser` | `streamJsonParser.js` | 给"流式返回 JSON"的模型用：容错剥离 ```json 包装、括号配对、中/英引号修正、增量 buffer | 在 `onChunk` 里 `appendChunk()`，随时 `tryParse()` |
| `ScrollManager` | `scrollHelper.js` | 判断是否靠近底部、平滑滚动到底 | 流式更新时联动 UI |
| `ModeMetadataManager` | `modeMetadataHelper.js` | 在 `chat.metadata[modeKey]` 下开命名空间做 get/set/clear | 模式专属状态（等级、好感度…） |

### 6.2 Key 管理 `utils/keyManager.js`

改造后 Key 按 **`presetId`** 分桶（而非旧的按 URL 分桶），这让用户切换预设时能自动召回对应 Key，并支持：

- 两个自定义预设使用同一个 `baseUrl` 但不同 Key
- 修改自定义预设的 `baseUrl` 后 Key 不丢失
- 内置预设与"另存为自定义"互不干扰

主要对外接口：

| 函数 | 说明 |
|------|------|
| `getApiKeyForPreset(presetId, baseUrl)` | 获取指定预设的 API Key |
| `saveApiKeyForPreset(presetId, apiKey, baseUrl)` | 保存 Key 到对应预设桶 |
| `exportApiKeys()` / `importApiKeys()` | 批量导入/导出 |

> 旧的按 URL 分桶的 `getApiKeyForUrl` / `saveApiKeyForUrl` 仍保留作为 fallback，但新代码应一律使用 `*ForPreset` 系列。

### 6.3 配置状态 `AppCore.vue` + `modeConfig`

`AppCore.vue` 持有 `activePresetId` 这个唯一事实源，并通过 `modeConfig` computed **下发 props** 给插件：

```
activePresetId
   ↓ getPresetById()
currentPreset
   ↓ 派生
modeConfig = {
  provider, model, apiKey, apiUrl,
  temperature, maxTokens,
  isBackendProxy, featurePassword,
  geminiReasoningEffort, defaultHideReasoning, autoCollapseReasoning,
  activePresetId, currentPreset, presetFeatures, supportsImageOutput
}
   ↓
<ModeComponent :config="modeConfig" />
```

`provider`、`apiUrl`、`isBackendProxy` **不再是独立持久化状态**，而是从当前预设派生。切换预设就是切换一整组 API 配置。

---

## 7. 后端代理协议（前端视角）

虽然后端代码不在本仓库，但前端对后端的**接口契约**是这套架构里很重要的一部分，列清如下：

| 项 | 值 |
|----|-----|
| 端点（默认） | `/api/deepseek/stream`、`/api/gemini/stream` |
| 端点（经 `ensureCompletionsEndpoint` 改写后实际请求） | `/api/v1/chat/completions` |
| HTTP 方法 | `POST` |
| `Content-Type` | `application/json` |
| 主鉴权头 | `X-Feature-Password: <featurePassword>` |
| 兼容鉴权头 | `x-api-key: <apiKey>`（当前 UI 不主打此路径，但驱动仍兼容） |
| Body | 与 OpenAI ChatCompletion 相同；`messages` / `stream` / `temperature` / `max_tokens` / 可选 `reasoning.effort` / `modalities` / `image_config` |
| 响应 | OpenAI 兼容 SSE，`data: {...}` + `[DONE]`，带 `reasoning_content` 字段 |

后端代理现在以独立内置预设的形式存在（`builtin_backend_openai` / `builtin_backend_gemini`），用户选择代理预设即进入代理模式，**不再有独立的 `useBackendProxy` 开关**。

---

## 8. 典型请求的时序（以 StandardChatMode 为例）

```
user 点击发送
 │
 ├─► StandardChatMode.handleSend()
 │     · push userMessage
 │     · push 空 assistantMessage
 │     · new AbortController()
 │     · effectiveApiUrl = config.apiUrl (已由 Preset 派生)
 │
 ├─► callAiModel(options)
 │     · normalizeApiUrl → ensureCompletionsEndpoint
 │     · 推断 effectiveProvider
 │     │
 │     ├─ provider === 'gemini'
 │     │    └─► callModelGemini(...)
 │     │
 │     └─ 其它
 │          └─► callModelOpenAICompatible(...)
 │                · fetch(POST, signal, body)
 │                · 流式读 reader.read()
 │                · 按 \n 拆 SSE 行
 │                · 累加 content / reasoning_content
 │                · 每解析一行 → onChunk({ ...newMessage })
 │
 ├─ onChunk 回调侧（StandardChatMode 内）
 │     · pendingContent / pendingReasoning 更新
 │     · throttle(1000ms) 刷 assistantMessage + messages 数组
 │     · throttle(2000ms) 触发 update-chat 事件 → 持久化
 │
 └─ 请求结束
       · 最后一次强制同步 pending* → assistantMessage
       · emit update-chat
       · isLoading / isTyping / abortController 复位
```

**取消路径**：`handleCancel()` → `abortController.abort()` → provider 内 `fetch` 抛 `AbortError` → 调用方 `catch` 写入 "已取消"。

---

## 9. 边界与设计取舍

1. **单一入口 vs 灵活性**
   所有调用走 `callAiModel`；不同协议差异由 `extraBody` 透传。好处是调用方简单；代价是 DrawMode 要显式置 `stream:false` 并拼 `modalities`。

2. **文件名 `openaiCompatible.js` 对齐协议名**
   Phase 1A 已把旧 `deepseek.js` 重命名为 `openaiCompatible.js`，导出函数也改为 `callModelOpenAICompatible`。`providers/` 目录下**不再出现任何供应商名**。

3. **旧 `utils/aiService.js` 保留为兼容壳**
   标注 `@deprecated`，仅转发到 `core/services/aiService.js`。调用方请**统一从 `@/core/services/aiService` 引入**。

4. **Provider 推断优先级**：**模型名 > URL 域名 > 默认 openai_compatible**
   这意味着只要模型名带 `gemini-` 前缀，即使打到一个"看起来像 OpenAI"的 URL，也会走 gemini 驱动。OpenRouter 上的 `google/gemini-xxx` 不触发此分支（前缀是 `google/` 而非 `gemini-`），因此仍走 OpenAI 兼容驱动——这是有意为之。

5. **`activePresetId` 是唯一事实源**
   `core/store.js` 的 `globalState` 不再维护独立的 `provider` / `apiUrl` 状态，旧的 `bs2_provider`、`bs2_api_url`、`bs2_use_backend_proxy` 已废弃。

6. **Key 的粒度**
   按 **presetId** 维度，允许同一 `baseUrl` 下多个预设各自存不同 Key。

---

## 10. 新场景"速查表"

| 想做的事 | 改这里 |
|---------|--------|
| 新增一个模式插件，用现有协议 | 仅写 `src/modes/XxxMode/`；调用 `callAiModel` 即可 |
| 新增一个 OpenAI 兼容厂商 | 在 `src/config/presets/builtin.js` 加一条内置预设即可 |
| 新增一个非 OpenAI 协议 | 在 `src/utils/providers/` 写新驱动，在 `callAiModel` 里加路由分支 |
| 用户创建自定义预设 | `SettingsDrawer.vue` → `create-custom-preset` 事件 → `configMethods.onCreateCustomPreset()` |
| 想让模式感知预设能力 | 读 `config.presetFeatures` 或 `config.supportsImageOutput` |
| 想让流式返回解析为 JSON | 在模式里 `createStreamJsonParser()`，`onChunk` 中 `appendChunk` + `tryParse` |
| 想让流式 UI 不掉帧 | 用 `throttle(...)` 包 `onChunk` 里的重渲染与存盘 |
| 想统一取消/重发 | 用 `createAbortManager()`，把 `signal` 传给 `callAiModel` |
| 想持久化模式自己的状态 | `createMetadataManager(chat, 'myModeData')`，存 `chat.metadata` 里随对话走 |

---

## 11. 小结

这套 API 基建的核心是**一条主干 + 两个驱动 + 一个 Preset 注册表 + 一组正交工具**：

- **Preset 注册表** `config/presets/`：集中管理所有供应商知识——`baseUrl`、`protocol`、`models`、`features`，用户可创建无限多的自定义预设。
- **主干 `callAiModel`**：屏蔽 URL、端点、鉴权、provider 选择的差异。
- **两个驱动 `openaiCompatible.js` / `gemini.js`**：屏蔽 HTTP 协议与 SSE 解析差异，向上返回同一形状的 `assistantMessage`。
- **正交工具**（Abort / Throttle / StreamJsonParser / Scroll / Metadata / KeyManager）：让模式开发只聚焦"业务交互"。

在这套约定之上，添加"新的 AI 用法"几乎总能落成一句话：**写一个新 mode，调 `callAiModel`，按需拼 `extraBody`**。
