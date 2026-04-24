# 项目 API 架构梳理

> 面向：阅读/扩展本项目 AI 调用层、新增模式插件、新增 AI 提供商、排查请求链路的人。
> 范围：**前端到 AI 提供商之间的所有调用基建**，不包含 UI/存档等非 API 相关基建。

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
 │     └─ 路由 → deepseek / gemini                                  │
 └──────────────────────────────────────────────────────────────────┘
                             │
                ┌────────────┴───────────────┐
                ▼                            ▼
 ┌──────────────────────────┐    ┌──────────────────────────┐
 │ providers/deepseek.js    │    │ providers/gemini.js      │
 │ 代表所有 OpenAI 兼容协议  │    │ Google 原生 + OpenAI 兼容 │
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
 │              远端服务（两种模式二选一）                           │
 │                                                                  │
 │  A. 直连模式 (useBackendProxy = false)                            │
 │     · SiliconFlow / Deepseek 官方 / OpenRouter / LMRouter /       │
 │       火山引擎 / Gemini 官方                                      │
 │     · 使用 Authorization: Bearer <user key>                       │
 │                                                                  │
 │  B. 后端代理模式 (useBackendProxy = true)                         │
 │     · /api/deepseek/stream、/api/gemini/stream                    │
 │     · 真 key 在后端；前端仅透传 x-api-key + X-Feature-Password    │
 └──────────────────────────────────────────────────────────────────┘
```

这套基建围绕一个核心思想：**调用方只认 `callAiModel` 一个函数；供应商差异由 core/providers 两层消化掉**。

---

## 1. 四层分层结构

项目的 API 基建可以清晰地切成 **4 层**，从上到下分别是：

| 层次 | 角色 | 目录 | 可替换性 |
|------|------|------|----------|
| L1 调用方 | 模式插件（业务层） | `src/modes/**` | 新模式自由接入 |
| L2 统一入口 | 核心 AI 服务 | `src/core/services/aiService.js` | 应保持稳定 |
| L3 协议适配 | Provider Drivers | `src/utils/providers/*.js` | 按协议新增 |
| L4 支撑基建 | 辅助工具 / 配置 / Key 管理 | `src/utils/*.js`、`src/core/store.js`、`src/config/` | 独立演进 |

还有一条与 L1~L4 正交的 **L0 旁路**：
- `src/utils/aiService.js` 是一个 `@deprecated` 的**兼容转发壳**，目前无人使用（grep 只在 `core` 内自我引用和 README 提及），保留的唯一目的是防止外部代码直接 import 老路径后爆炸。

---

## 2. L2：统一入口 `core/services/aiService.js`

这是整个 API 架构真正的"腰"。所有模式最终都经过它。

### 2.1 对外 3 个导出

| 导出 | 作用 | 使用位置 |
|------|------|----------|
| `callAiModel(options)` | **唯一**的 AI 调用入口，返回最终 assistant message | StandardChatMode、DrawMode |
| `listModelsByProvider(provider, useBackendProxy, apiUrl)` | 根据当前配置列出可用模型 | `configMethods.updateModels()` |
| `getProviderByApiUrl(apiUrl)` | 根据 URL 推断 provider | 内部使用，也对外暴露 |

### 2.2 `callAiModel` 选项契约

```js
await callAiModel({
  provider,              // 'gemini' | 'openai_compatible' | 未指定
  apiUrl,                // 直连或后端代理 URL
  apiKey,                // 用户 key 或代理认证 key
  model,                 // 模型名；可反推 provider
  messages,              // [{ role, content }]，角色标准：user/assistant
  temperature = 0.7,
  maxTokens   = 4096,
  signal,                // AbortSignal，用于取消
  onChunk,               // (chunk) => void，流式进度回调
  featurePassword,       // 仅后端代理模式使用
  useBackendProxy,       // 控制 header 形态
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

### 2.3 四道"消化阀"

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

## 3. L3：Provider Drivers

真正的网络通信和协议适配发生在这层。目前有两个驱动，它们结构对称但协议不同。

### 3.1 `providers/deepseek.js` —— OpenAI 兼容阵营

**代表一大类**：SiliconFlow、Deepseek 官方、OpenRouter、LMRouter、火山引擎，以及自建代理。命名虽然是 "deepseek"，实际是整个 OpenAI 兼容协议的驱动。

核心行为：
- 请求体固定用 `{ model, messages, stream, temperature, max_tokens, ...extraBody }`。
- 若模型名含 `gemini` 且设置了 `geminiReasoningEffort`，挂 `reasoning.effort`（OpenRouter 风格）。
- 流式：按 `\n` 拆行，解析 `data: {...}`，忽略 `[DONE]` 与注释行 `:`。
- 字段映射：
  - `choices[0].delta.content` → `content`
  - `choices[0].delta.reasoning_content` / `reasoning` → `reasoning_content`（后者把 `\\n` 还原成真换行）
  - `choices[0].message.images` → `images`（OpenRouter 的 Gemini 图像响应）
- 非流式：返回 `choices[0].message.{content, reasoning_content, images}`。

### 3.2 `providers/gemini.js` —— 双协议兼容

根据 `apiUrl` 是否指向 `generativelanguage.googleapis.com` 分叉：

| 分支 | 请求路径 | Body 形态 | 响应解析 |
|------|----------|-----------|----------|
| `isDirectGoogle=true` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key=...` | Google 原生 `contents[{ role, parts:[{text}] }]` + `generationConfig` | `candidates[0].content.parts[*].text` |
| `isDirectGoogle=false` | 由调用方给（通常是后端代理） | OpenAI 兼容 `messages` + `reasoning.effort` | `choices[0].delta.{content, reasoning_content}` |

这样，同一个 `gemini` 驱动既能打 Google 官方，也能打任何 OpenAI 兼容的 Gemini 透传代理。

### 3.3 鉴权策略（两种驱动共享同一规则）

| 模式 | 是否加 `Authorization` | 额外头 |
|------|------------------------|--------|
| 直连（`useBackendProxy=false`） | ✅ `Bearer <apiKey>` | — |
| 直连 Google Gemini | ❌（key 放 query string） | — |
| 后端代理（`useBackendProxy=true`） | ❌ 不加，避免覆盖后端真实 key | `x-api-key: <apiKey>`、`X-Feature-Password: <featurePassword>` |

这条规则是**整个项目鉴权的唯一真相**。

### 3.4 新增 Provider 的模板

以接入 "XYZ 协议" 为例：
1. 在 `src/utils/providers/` 新增 `xyz.js`，导出 `async function callModelXyz(options)`，返回统一的 `assistantMessage`。
2. 在 `core/services/aiService.js` 的 `getProviderByModelName` / `getProviderByApiUrl` 中加入识别规则。
3. 在 `callAiModel` 的路由分支中新增 `if (effectiveProvider === 'xyz') return callModelXyz({...})`。
4. 如需让 UI 下拉列表显示其模型，在 `listModelsByProvider` 中补一段。

调用方**零修改**。

---

## 4. L1：调用方（模式插件）的统一模板

现存两个实际使用者都遵循同一套骨架：

```js
// 1) 中止控制
this.abortController = new AbortController();

// 2) 选择生效 URL（直连 or 代理）
let effectiveApiUrl = this.config.apiUrl;
if (this.useBackendProxy) {
  effectiveApiUrl = this.config.provider === 'gemini'
    ? this.config.backendUrlGemini
    : this.config.backendUrlDeepseek;
}

// 3) 调用
await callAiModel({
  provider: this.config.provider,
  apiUrl: effectiveApiUrl,
  apiKey: this.config.apiKey,
  model: this.config.model,
  messages,
  temperature: this.config.temperature,
  maxTokens: this.config.maxTokens,
  signal: this.abortController.signal,
  featurePassword: this.config.featurePassword,
  useBackendProxy: this.useBackendProxy,
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

这说明 `callAiModel` 的**参数形状已经能覆盖"纯文本流式"和"多模态非流式"两种完全不同的 AI 用法**。

---

## 5. L4：支撑基建

`callAiModel` 本身很薄，真正让调用方写得"干净"的，是 `src/utils/` 下一组彼此正交的小工具。它们共同构成**模式开发者的配套 SDK**。

### 5.1 Mode Helper 家族（通过 `src/utils/modeHelpers.js` 聚合导出）

| Helper | 文件 | 职责 | 与 API 调用的关系 |
|--------|------|------|-------------------|
| `AbortManager` | `abortHelper.js` | 封装 `AbortController`：`create()` 自动 abort 上一次 | 传给 `callAiModel({ signal })` |
| `ThrottleManager` / `throttle` | `throttleHelper.js` | 节流。1 个 `setTimeout` 窗口 | 包住 `onChunk` 里的 UI/存盘动作 |
| `StreamJsonParser` | `streamJsonParser.js` | 给"流式返回 JSON"的模型用：容错剥离 \`\`\`json 包装、括号配对、中/英引号修正、增量 buffer | 在 `onChunk` 里 `appendChunk()`，随时 `tryParse()` |
| `ScrollManager` | `scrollHelper.js` | 判断是否靠近底部、平滑滚动到底 | 流式更新时联动 UI |
| `ModeMetadataManager` | `modeMetadataHelper.js` | 在 `chat.metadata[modeKey]` 下开命名空间做 get/set/clear | 模式专属状态（等级、好感度…） |

### 5.2 Key 管理 `utils/keyManager.js`

项目**不是一个 provider 存一个 key**，而是**按 API URL 对应一个 key**，这让用户切换 Base URL 时能自动召回对应 key。

- 存储：`localStorage['bs2_api_keys']` 一个总 JSON。
- 索引算法：`getApiUrlIdentifier(url)` 对已知域名硬编码 identifier（`siliconflow`、`openrouter`、`lmrouter`、`volces`、`deepseek`、`gemini_official`、`backend_gemini`、`backend_deepseek` …），未知域名用 `hostname` 派生。
- 对外：`getApiKeyForUrl` / `saveApiKeyForUrl` / `exportApiKeys` / `importApiKeys` / `migrateOldApiKeys`。
- 旧 key（`bs2_openai_compatible_api_key` / `bs2_gemini_api_key` 等）会在 `AppCore.created` 中一次性迁移进新结构。

### 5.3 配置状态 `core/store.js` + `AppCore.vue`

`store.js` 提供一个 `reactive` 的 `globalState`（以及 `updateState/updateStates` 带 localStorage 持久化）。
但实际主路径并不走 `globalState`——`AppCore.vue` 有自己的一份 `data()`，通过 `modeConfig` computed **下发 props** 给插件：

```
AppCore.data  ──►  modeConfig (computed)  ──►  <ModeComponent :config="modeConfig" />
       ▲                                                 │
       │              appCoreMethods.configMethods       │
       └────────────── 持久化到 localStorage  ◄───────────┘
```

所有跟 API 相关的状态都走这条通道：
`provider / model / apiKey / apiUrl / useBackendProxy / backendUrlDeepseek / backendUrlGemini / featurePassword / temperature / maxTokens / geminiReasoningEffort`。

> `core/store.js` 目前处在"规划中未全量使用"的状态，属于未来可能接管的全局总线。当前**真相源是 AppCore.vue**。

### 5.4 Provider 切换副作用 `appCore/methods/configMethods.js`

`onProviderChanged()` 做了几件对 API 层很关键的事：
- 切 provider 时，如果开了后端代理，`apiUrl` 自动切到 `backendUrlGemini` / `backendUrlDeepseek`。
- 切到后端代理模式时，`apiKey` 清空（因为真 key 在后端）。
- 切到直连时，`loadApiKeyForCurrentUrl()` 从 KeyManager 召回当前 URL 的用户 key。
- 调 `updateModels()` 刷新下拉列表（→ `listModelsByProvider`）。
- 持久化 `apiUrl`。

`AppCore.vue` 的 `watch` 里还监听 `useBackendProxy / apiUrl`，变化时自动刷新模型列表和 key。

---

## 6. 后端代理协议（前端视角）

虽然后端代码不在本仓库，但前端对后端的**接口契约**是这套架构里很重要的一部分，列清如下：

| 项 | 值 |
|----|-----|
| 端点（默认） | `/api/deepseek/stream`、`/api/gemini/stream` |
| 端点（经 `ensureCompletionsEndpoint` 改写后实际请求） | `/api/v1/chat/completions` |
| HTTP 方法 | `POST` |
| `Content-Type` | `application/json` |
| 鉴权头 | `x-api-key: <用户输入>`（**非** Authorization） |
| 功能密码 | `X-Feature-Password: <featurePassword>`（可选） |
| Body | 与 OpenAI ChatCompletion 相同；`messages` / `stream` / `temperature` / `max_tokens` / 可选 `reasoning.effort` / `modalities` / `image_config` |
| 响应 | OpenAI 兼容 SSE，`data: {...}` + `[DONE]`，带 `reasoning_content` 字段 |

换句话说：**后端代理对外必须暴露"带 reasoning_content 扩展的 OpenAI 兼容 chat completions"**，前端就能无缝用现有 `deepseek.js` 驱动打它。

---

## 7. 典型请求的时序（以 StandardChatMode 为例）

```
user 点击发送
 │
 ├─► StandardChatMode.handleSend()
 │     · push userMessage
 │     · push 空 assistantMessage
 │     · new AbortController()
 │     · effectiveApiUrl = 代理/直连
 │
 ├─► callAiModel(options)
 │     · normalizeApiUrl → ensureCompletionsEndpoint
 │     · 推断 effectiveProvider
 │     │
 │     ├─ provider === 'gemini'
 │     │    └─► callModelGemini(...)
 │     │
 │     └─ 其它
 │          └─► callModelDeepseek(...)
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

## 8. 边界与设计取舍

1. **单一入口 vs 灵活性**
   所有调用走 `callAiModel`；不同协议差异由 `extraBody` 透传。好处是调用方简单；代价是 DrawMode 要显式置 `stream:false` 并拼 `modalities`。

2. **文件名 `deepseek.js` 实为"OpenAI 兼容驱动"**
   属于历史命名。真要改名建议 `openaiCompatible.js`，但会牵动多处 import，当前保持不变。

3. **旧 `utils/aiService.js` 保留为兼容壳**
   标注 `@deprecated`，仅转发到 `core/services/aiService.js`。调用方请**统一从 `@/core/services/aiService` 引入**。

4. **Provider 推断优先级**：**模型名 > URL 域名 > 默认 openai_compatible**
   这意味着只要模型名带 `gemini-` 前缀，即使打到一个"看起来像 OpenAI"的 URL，也会走 gemini 驱动。OpenRouter 上的 `google/gemini-xxx` 不触发此分支（前缀是 `google/` 而非 `gemini-`），因此仍走 OpenAI 兼容驱动——这是有意为之。

5. **`core/store.js` 是未完成的未来态**
   当前真相源在 `AppCore.vue`。新功能不建议直接挂到 `globalState`，以免和 AppCore 的 data 重复。

6. **Key 的粒度**
   按 **URL identifier** 而非 provider 维度，允许同一 provider 下多个 Base URL 各自存 key（例如同时有硅基流动 key 和 OpenRouter key）。

---

## 9. 新场景"速查表"

| 想做的事 | 改这里 |
|---------|--------|
| 新增一个模式插件，用现有协议 | 仅写 `src/modes/XxxMode/`；调用 `callAiModel` 即可 |
| 新增一个 OpenAI 兼容厂商（新域名） | `getProviderByApiUrl` 加 URL 识别；`listModelsByProvider` 加模型列表；`keyManager.getApiUrlIdentifier` 加 identifier |
| 新增一个非 OpenAI 协议 | 在 `src/utils/providers/` 写新驱动，在 `callAiModel` 里加路由分支 |
| 新增后端代理路径 | `core/store.js` + `AppCore.vue` 加 `backendUrlXxx`；`configMethods.onProviderChanged` 里加切换逻辑 |
| 想让流式返回解析为 JSON | 在模式里 `createStreamJsonParser()`，`onChunk` 中 `appendChunk` + `tryParse` |
| 想让流式 UI 不掉帧 | 用 `throttle(...)` 包 `onChunk` 里的重渲染与存盘 |
| 想统一取消/重发 | 用 `createAbortManager()`，把 `signal` 传给 `callAiModel` |
| 想持久化模式自己的状态 | `createMetadataManager(chat, 'myModeData')`，存 `chat.metadata` 里随对话走 |

---

## 10. 小结

这套 API 基建的核心是**一条主干 + 两个驱动 + 一组正交工具**：

- 主干 `callAiModel`：屏蔽 URL、端点、鉴权、provider 选择的差异。
- 两个驱动 `deepseek.js` / `gemini.js`：屏蔽 HTTP 协议与 SSE 解析差异，向上返回同一形状的 `assistantMessage`。
- 正交工具（Abort / Throttle / StreamJsonParser / Scroll / Metadata / KeyManager）：让模式开发只聚焦"业务交互"，不再重复造网络/节流/JSON/存储轮子。

在这套约定之上，添加"新的 AI 用法"几乎总能落成一句话：**写一个新 mode，调 `callAiModel`，按需拼 `extraBody`**。
