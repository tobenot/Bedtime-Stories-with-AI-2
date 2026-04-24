# Preset 架构改造方案（修订版）

> **状态**：Phase 3 已完成（模型拉取功能可用，自定义预设弹窗支持模型列表编辑和从服务器拉取），准备进入 Phase 4  
> **修订日期**：2026-04-25  
> **配套文档**：`docs/API架构梳理.md`

---

## 0. 文档目的

本文档用于定义项目后续的 API / Preset 架构改造方向，目标是：

- 把目前**散落在多个文件中的 provider 知识**集中起来；
- 保留当前项目已经可用的多路接入能力；
- 支持用户创建**多个命名的自定义 OpenAI 兼容预设**；
- 保持 Gemini 原生协议作为**内置专用通道**；
- 通过分 Phase 的方式，逐步实施，尽量避免一次性大改。

这份方案不是为了否定现状。当前实现属于**"散而不烂"**：已经具备统一调用入口、驱动分层、按 URL 存 Key 的基础，只是"provider 知识"仍然散落在多个位置，随着后续支持"自定义预设"会越来越难维护，因此需要升级为数据驱动的 Preset 架构。

---

## 1. 最终拍板的设计原则

### 1.1 协议只保留两种

系统只支持两种协议类型：

- `openai`：OpenAI 兼容协议
- `gemini`：Google Gemini 原生协议

除此之外，**不支持让用户自定义第三种协议**。Claude、Ollama、Anthropic 原生等场景如果要接入，默认通过 OpenAI 兼容网关或聚合商实现。

### 1.2 自定义预设只允许 OpenAI 兼容

用户可以创建多个命名的自定义预设，例如：

- `我的 OneAPI 网关`
- `公司代理`
- `自己买的海外中转`

但这些自定义预设的协议类型**固定为 `openai`**，不会在 UI 中暴露协议选择器。

### 1.3 内置预设只读

内置预设（硅基流动、Deepseek 官方、火山引擎、OpenRouter、LMRouter、Gemini、OpenAI 后端代理、Gemini 后端代理）都是只读的。

用户如果想基于内置预设做修改，统一走：

- **"另存为自定义预设"**

这样做的好处：

- 后续升级内置预设时不会和用户本地修改冲突；
- 数据模型简单；
- 用户心智也更稳定。

> **例外**：代理预设的 `baseUrl` 是可编辑的（通过 `editableBaseUrl: true` 标记），因为每个人的代理地址不同。但其他字段仍然只读。

### 1.4 `activePresetId` 是唯一事实源

这是本次架构改造最重要的一条：

> **当前选中的预设 ID (`activePresetId`) 是 API 配置的唯一事实源。**

这意味着：

- `provider` 不再作为独立配置长期保存，而是从 `currentPreset.protocol` 派生；
- `apiUrl` 不再作为主状态长期保存，而是从 `currentPreset.baseUrl` 直接推导端点；
- 切换预设，就是切换一整组 API 配置；
- 不能再出现"当前是 OpenRouter 预设，但 provider 仍是 gemini"这类非法状态；
- **是否处于后端代理模式，也由当前预设决定**（选了代理预设就是代理模式，选了直连预设就是直连模式）。

### 1.5 后端代理作为独立预设（不再有 Transport 层）

旧方案曾提出 Preset / Transport 二层分离。经讨论后决定**不设 Transport 层**，原因如下：

#### 旧方案的问题

如果后端代理是一个 Transport 模式，就会出现"Preset × Transport"的笛卡尔积：

- 选了"硅基流动"预设 + 开了代理 → 硅基流动的 `baseUrl` 完全没用，请求走代理地址
- 代理模式下 Preset 的模型列表也用不上，换成了代理后端的模型列表

这说明 Transport 层和 Preset 层在代理场景下互相架空，增加了不必要的概念复杂度。

#### 新方案：代理 = 预设

后端代理拆成两个独立的内置预设：

- **`builtin_backend_openai`**：OpenAI 后端代理（`protocol: 'openai'`）
- **`builtin_backend_gemini`**：Gemini 后端代理（`protocol: 'gemini'`）

用户想用后端代理，就**选对应的代理预设**。选了之后只需要填：

1. 代理地址（`baseUrl`，可编辑）
2. 功能密码
3. 选模型

**不再需要理解"先选一个 API 供应商，再切代理模式"这个二级概念。**

#### 好处

- `activePresetId` 真正成为唯一事实源，不再有 `useBackendProxy` 开关
- 数据结构统一：代理预设和直连预设的 Schema 完全一致，只是 `authMode` 和 `editableBaseUrl` 不同
- 架构从三层变成两层，概念更少

#### `useBackendProxy` 的废弃

旧的 `useBackendProxy` 开关不再作为独立持久化状态。它变成一个**计算属性**：

```js
const isBackendProxy = computed(() => currentPreset.authMode === 'password')
```

UI 上如果仍想提供"快捷切换"体验，可以实现为：

```js
function toggleBackendProxy() {
  if (isBackendProxy.value) {
    activePresetId = lastDirectPresetId || 'builtin_siliconflow'
  } else {
    activePresetId = lastProxyPresetId || 'builtin_backend_openai'
  }
}
```

但底层数据只有 `activePresetId` 一个事实源。

### 1.6 `baseUrl` 保留这个命名，但必须语义统一

本方案确认继续使用 `baseUrl` 命名。

但必须同时确认一条硬规则：

> `baseUrl` 永远表示**协议基础前缀**，而不是完整动作端点。

也就是：

#### 正确示例
- `https://api.siliconflow.cn/v1`
- `https://api.deepseek.com/v1`
- `https://openrouter.ai/api/v1`
- `https://api.lmrouter.com/openai/v1`
- `https://ark.cn-beijing.volces.com/api/v3`
- `https://generativelanguage.googleapis.com/v1beta`

#### 错误示例
- `https://openrouter.ai/api/v1/chat/completions`
- `https://api.deepseek.com/v1/chat/completions`
- `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent`

运行时再根据协议去拼具体端点：

- OpenAI 兼容聊天端点：`{baseUrl}/chat/completions`
- OpenAI 兼容模型列表端点：`{baseUrl}/models`
- Gemini 原生流式端点：`{baseUrl}/models/{model}:streamGenerateContent?alt=sse&key=...`

如果用户在自定义预设里输入的是完整 `chat/completions` 地址，保存时要**自动归一化为 `baseUrl`**。

### 1.7 Key 和"选中的模型"都按 Preset 维度记忆

Key 需要按 `presetId` 分桶，这是本方案保留的结论。

另外，模型选择也要升级为：

> **按 `presetId` 记忆用户上次选择的模型。**

原因很简单：

- OpenRouter 可能常用 `google/gemini-2.5-flash`
- 公司代理可能常用 `gpt-4o-mini`
- 切回去时，应该恢复各自上次选择，而不是只有一个全局 `bs2_model`

因此不再建议只保留单一 `model` 字段作为长期记忆。

### 1.8 文件与目录命名统一

本次架构升级必须同步**纠正一些误导性的文件命名**。当前代码里最典型的例子：

- `src/utils/providers/deepseek.js`  
  实际上是 **OpenAI 兼容协议总驱动**，服务硅基流动、Deepseek 官方、火山引擎、OpenRouter、LMRouter 以及所有未来用户自定义的 OpenAI 兼容端点。`deepseek` 只是历史上第一个接入的供应商名，早已不能代表该文件的真实职责。

在 Preset 架构下，文件命名必须和**协议边界**对齐，而不是和某个供应商名绑定，理由如下：

- 自定义预设一旦开放，任意 OpenAI 兼容端点都会走这个驱动，继续叫 `deepseek.js` 会严重误导新同事；
- 文档里反复强调"协议只有两种"，但代码里驱动文件却只叫得出"一种供应商名 + gemini"，概念不闭环；
- 未来如果真要再加一种协议（比如 Anthropic 原生），目录里必须有一个**可以类比的命名范式**，否则会被迫再造一套结构。

本方案规定的命名规则：

| 位置 | 当前 | 目标 |
|---|---|---|
| OpenAI 兼容驱动 | `src/utils/providers/deepseek.js` | `src/utils/providers/openaiCompatible.js` |
| Gemini 原生驱动 | `src/utils/providers/gemini.js` | 保持 `gemini.js` 即可 |
| 驱动导出函数名 | `callModelDeepseek` | `callModelOpenAICompatible` |
| 驱动导出函数名 | `callModelGemini` | 保持不变 |

同时约束：

- `providers/` 下的文件名**只能是协议名**，不能再出现任何供应商名；
- 供应商名**只能出现在** `src/config/presets/` 下；
- `callAiModel` 内部的 `provider` 分支也应同步由 `'openai_compatible' / 'gemini'` 继续对齐，不再新增分支。

> 这一项不会产生任何运行时行为变化，但它是**架构清晰度的重要一环**，必须在 Phase 1A 一次性完成，避免和后续状态模型改造混在一起。  
> 同时它的改造成本极低：当前 `deepseek.js` 只有 `src/core/services/aiService.js` 这一处引用。

---

## 2. 架构总览

### 2.1 新架构的两层

```text
┌─────────────────────────────────────────────┐
│ Layer A: Preset Registry                    │
│ - 内置直连预设（硅基流动、Deepseek…）       │
│ - 内置代理预设（OpenAI/Gemini 后端代理）    │
│ - 自定义预设                                │
│ - 协议 / baseUrl / 模型列表 / authMode      │
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

### 2.2 派生链路

```text
activePresetId
   ↓
currentPreset
   ├─ provider = currentPreset.protocol
   ├─ baseUrl = currentPreset.baseUrl
   ├─ authMode = currentPreset.authMode   ('apiKey' | 'password')
   └─ models = currentPreset.models
   ↓
baseUrl + protocol → final request endpoint
   ↓
对应 driver 发请求
```

### 2.3 运行时"谁决定谁"

为了避免以后逻辑重新变乱，这里明确依赖方向：

- `activePresetId` 决定 `currentPreset`
- `currentPreset` 决定 `provider`
- `currentPreset.baseUrl` 决定请求端点（不再有 Transport 层参与）
- `currentPreset.authMode` 决定认证方式（API Key 或功能密码）
- `currentPreset + selectedModelByPresetId` 决定当前模型
- `provider` **不再反向修改** `preset`
- `apiUrl` **不再反向决定** `provider`
- **是否后端代理** 不再是独立开关，而是从 `currentPreset.authMode` 派生

也就是说，旧架构里那种：

- 改 provider → 推测 apiUrl
- 改 apiUrl → 推测 provider
- 拨 useBackendProxy → 覆盖 apiUrl

的多向推断关系，全部收敛为**单向：activePresetId → 一切**。

---

## 3. 数据结构设计

## 3.1 Preset Schema（正式版）

```js
{
  id: 'builtin_openrouter',
  label: 'OpenRouter',
  protocol: 'openai',           // 'openai' | 'gemini'
  baseUrl: 'https://openrouter.ai/api/v1',
  models: ['google/gemini-2.5-flash', 'openai/gpt-5.4'],
  isBuiltin: true,

  // 认证与编辑控制
  authMode: 'apiKey',           // 'apiKey' | 'password'，默认 'apiKey'
  editableBaseUrl: false,       // 是否允许用户编辑 baseUrl，默认 false

  // Phase 4+ 可选字段
  features: {
    imageOutput: true,
    reasoning: true,
  },
  extraHeaders: {
    // 例如 OpenRouter 的 HTTP-Referer / X-Title
  },
  defaultExtraBody: {},
  keyHelpUrl: 'https://openrouter.ai/keys',

  // 仅自定义预设使用
  createdAt: '2026-04-24T23:00:00.000Z',
  updatedAt: '2026-04-24T23:00:00.000Z',
}
```

### 3.1.1 一期最小字段

Phase 1 / Phase 2 只要求以下字段是必需的：

- `id`
- `label`
- `protocol`
- `baseUrl`
- `models`
- `isBuiltin`
- `authMode`（默认 `'apiKey'`，代理预设为 `'password'`）

其他字段全部视为可选增强字段。

### 3.1.2 `authMode` 说明

| 值 | 含义 | UI 表现 |
|---|---|---|
| `'apiKey'` | 标准 API Key 认证（Bearer token） | 显示 API Key 输入框 |
| `'password'` | 功能密码认证（后端代理模式） | 显示功能密码输入框，不显示 API Key |

代理预设的认证方式是功能密码，而不是 API Key。通过 `authMode` 字段，UI 层可以统一判断展示哪个输入框。

`isBackendProxy` 不再作为独立状态，而是一个计算属性：

```js
const isBackendProxy = computed(() => currentPreset.authMode === 'password')
```

### 3.1.3 `editableBaseUrl` 说明

| 预设类型 | `editableBaseUrl` | 说明 |
|---|---|---|
| 普通内置预设 | `false`（默认） | baseUrl 只读，如"硅基流动"永远是 `https://api.siliconflow.cn/v1` |
| 代理内置预设 | `true` | baseUrl 用户可编辑，因为每个人的代理地址不同 |
| 自定义预设 | 天然可编辑 | 不需要这个字段，自定义预设的所有字段都可编辑 |

### 3.1.2 自定义预设的输入规则

自定义预设创建时，UI 只让用户填：

- 预设名称
- API 地址
- API Key
- 模型列表

保存时做两件事：

1. 将用户输入的 API 地址归一化为 `baseUrl`
2. 强制写入 `protocol: 'openai'`

例如：

- 用户输入 `https://openrouter.ai/api/v1/chat/completions`
- 实际保存 `baseUrl: 'https://openrouter.ai/api/v1'`

---

## 3.2 功能密码（`featurePassword`）的存储

`featurePassword` 保持为**全局状态**，不按 `presetId` 分桶。

原因：功能密码本质上是"我的后端代理服务器的访问密码"，跟"我在硅基流动的 API Key"不是一个层面的东西。两个代理预设（OpenAI 后端代理 + Gemini 后端代理）通常共享同一个后端服务，因此共享同一个密码。

```js
// 全局状态
{
  featurePassword: 'my-secret-password',   // 全局，不分桶
}

// 对比：API Key 按 presetId 分桶
{
  builtin_siliconflow: 'sk-xxx',
  builtin_deepseek: 'sk-xxx',
  // 代理预设不在 Key 桶中——它们用 featurePassword
}
```

---

## 3.3 运行时状态（Runtime State）

```js
{
  activePresetId: 'builtin_openrouter',

  // 每个 preset 记住自己上次用的模型
  selectedModelByPresetId: {
    builtin_openrouter: 'google/gemini-2.5-flash',
    builtin_deepseek: 'deepseek-chat',
    builtin_backend_openai: 'deepseek-chat',
    custom_company_gateway: 'gpt-4o-mini',
  },

  // 当前输入框里展示的 apiKey 可以是派生值，不一定长期单独存
  // 真正持久化的 key 在 key buckets 里

  // 全局偏好
  temperature: 0.7,
  maxTokens: 4096,
  defaultHideReasoning: false,
  autoCollapseReasoning: true,
  geminiReasoningEffort: 'off',

  // 全局密码（仅代理预设使用）
  featurePassword: '',
}
```

### 3.3.1 哪些状态是"全局偏好"

以下建议保留为全局偏好，不随 preset 切换而清空：

- `temperature`
- `maxTokens`
- `defaultHideReasoning`
- `autoCollapseReasoning`
- `geminiReasoningEffort`

### 3.3.2 哪些状态必须按 preset 记忆

以下建议按 preset 维度记忆：

- `apiKey`
- `selectedModel`

### 3.3.3 模型 fallback 策略

当 `selectedModelByPresetId[activePresetId]` 不存在时，按以下顺序 fallback：

1. `currentPreset.models[0]`（取预设模型列表的第一个）
2. 空字符串 `''`（允许用户手动输入）

也就是说，如果预设的 `models` 为空数组（如火山引擎），最终 fallback 到空字符串，UI 应提示用户手动输入模型名。**不做弹窗拦截**，只在输入框 placeholder 中给出提示即可。

---

## 3.4 Key 存储

继续沿用 `bs2_api_keys` 这个桶，但键的含义改为 `presetId`：

```js
{
  builtin_siliconflow: 'sk-xxx',
  builtin_deepseek: 'sk-xxx',
  builtin_openrouter: 'sk-or-v1-xxx',
  builtin_gemini: 'AIza...',
  custom_ab12cd34: 'sk-xxx',
  custom_ef56gh78: 'sk-yyy'
}
```

这比按 URL 分桶更适合后续目标，因为它支持：

- 两个自定义预设用同一个 URL，但不同 Key
- 修改自定义预设的 `baseUrl` 后，Key 不丢失
- 内置预设与"另存为自定义"互不干扰

---

## 4. 端点推导规则

所有预设（无论直连还是代理）统一通过 `protocol + baseUrl` 推导最终请求端点。

## 4.1 OpenAI 兼容

对于 `protocol: 'openai'`：

- 聊天请求端点：`{baseUrl}/chat/completions`
- 模型列表端点：`{baseUrl}/models`

例如（直连预设）：

- `https://openrouter.ai/api/v1` → `https://openrouter.ai/api/v1/chat/completions`
- `https://api.deepseek.com/v1` → `https://api.deepseek.com/v1/models`

例如（代理预设）：

- `/api/deepseek/stream` → 直接使用该地址发请求（代理预设的 `baseUrl` 通常已经是完整端点，不再追加 `/chat/completions`）

> **注意**：代理预设的 `baseUrl` 语义略有不同——它可能已经是完整的流式端点地址（如 `/api/deepseek/stream`），而非标准的 `v1` 前缀。代码层面需要判断：如果 `baseUrl` 已包含 `/stream` 或 `/chat/completions`，则不再追加。

## 4.2 Gemini 原生

对于 `protocol: 'gemini'`：

- 流式请求端点：
  - `{baseUrl}/models/{model}:streamGenerateContent?alt=sse&key=...`

例如（直连预设）：

- `https://generativelanguage.googleapis.com/v1beta` → `.../models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=...`

例如（代理预设）：

- `/api/gemini/stream` → 直接使用该地址发请求

注意：Gemini 不要求在 Preset 中保存完整 endpoint，直连预设仍然保存 `baseUrl` 即可。

---

## 5. 内置预设清单（第一版）

## 5.1 必备内置预设

### 直连预设

| id | label | protocol | baseUrl | authMode | 说明 |
|---|---|---|---|---|---|
| `builtin_siliconflow` | 硅基流动 | openai | `https://api.siliconflow.cn/v1` | apiKey | 国内综合聚合 |
| `builtin_deepseek` | Deepseek 官方 | openai | `https://api.deepseek.com/v1` | apiKey | 原厂接口 |
| `builtin_volces` | 火山引擎 | openai | `https://ark.cn-beijing.volces.com/api/v3` | apiKey | 豆包 / endpoint ID 模式 |
| `builtin_openrouter` | OpenRouter | openai | `https://openrouter.ai/api/v1` | apiKey | 海外综合聚合 |
| `builtin_lmrouter` | LMRouter | openai | `https://api.lmrouter.com/openai/v1` | apiKey | 中转 / 聚合 |
| `builtin_gemini` | Google Gemini | gemini | `https://generativelanguage.googleapis.com/v1beta` | apiKey | Gemini 原生协议 |

### 代理预设

| id | label | protocol | baseUrl（默认值） | authMode | editableBaseUrl | 说明 |
|---|---|---|---|---|---|---|
| `builtin_backend_openai` | OpenAI 后端代理 | openai | `/api/deepseek/stream` | password | true | 用户自建代理（OpenAI 兼容协议） |
| `builtin_backend_gemini` | Gemini 后端代理 | gemini | `/api/gemini/stream` | password | true | 用户自建代理（Gemini 原生协议） |

代理预设与直连预设的 Schema 完全一致，区别仅在于：

- `authMode: 'password'`——UI 显示功能密码而非 API Key
- `editableBaseUrl: true`——用户必须填写自己的代理地址
- `baseUrl` 的默认值是相对路径（当前项目的后端代理默认路径）

## 5.2 模型列表来源

内置预设的 `models` 初始值来自当前代码中的：

- `AppCore.vue` 的 `apiUrlOptions`
- `core/services/aiService.js` 中的 `listModelsByProvider()`

迁移时要求：

- 与现状行为 **1:1 对齐**
- 不因为"做 Preset"而顺手改动默认模型策略

## 5.3 火山引擎的特殊性

火山引擎虽然也走 OpenAI 兼容协议，但模型名通常是 endpoint ID，而不是公开模型名。

因此：

- 内置预设可以提供空模型列表或示例模型列表；
- 用户需要能手动输入；
- 不强求 Phase 1 就把火山引擎的模型体验做得很"智能"。

---

## 6. Phase 切分（修订版）

为了降低风险，本方案不再把 Phase 1 写成一个大包，而是拆成 **Phase 1A / 1B**。

---

## Phase 0：Schema 与规则定稿（0.5 天）

### 目标

只做方案定稿，不改代码。

### 必须确认的内容

- `baseUrl` 语义最终拍板：只存基础前缀 ✅
- `activePresetId` 是唯一事实源 ✅
- `provider` 改为派生值 ✅
- 增加 `selectedModelByPresetId` ✅
- 后端代理作为独立预设，不设 Transport 层 ✅
- `useBackendProxy` 废弃，改为从 `authMode` 派生 ✅
- `featurePassword` 保持全局，不按 presetId 分桶 ✅
- 模型 fallback 策略：`models[0]` → 空字符串 ✅
- 迁移映射使用 `includes()` 模糊匹配 ✅
- Phase 1A 即归一化 `apiUrlOptions` 为 `baseUrl` ✅
- Phase 1B 收敛 `core/store.js` 和 `AppCore.vue` 重复默认值 ✅

### 交付物

- 本文档修订完成
- `src/config/presets/` 的字段草案定稿
- 附录中的内置预设示例定稿

### 完成标准

项目维护者对以上规则达成一致，不再反复增删核心字段。

---

## Phase 1A：集中 provider 知识，但不改状态事实源（1 天）

### 目标

把 provider 相关的散落知识先集中到一份内置 Preset 注册表中，**但暂时不切换到 `activePresetId` 作为唯一事实源**。

这是一个"纯整理阶段"，重点是把数据从代码逻辑里搬出来。

### 主要工作

#### 新增
- `src/config/presets/builtin.js`
- `src/config/presets/index.js`

#### 改造
- 让 `AppCore.vue` 的 `apiUrlOptions` 从内置 preset 派生
- **同时归一化所有 URL 为 `baseUrl` 格式**（去掉 `/chat/completions` 后缀），不等到 Phase 1B
- 同步调整 `ensureCompletionsEndpoint()` 的调用时机，确保运行时拼接端点正常
- 让 `listModelsByProvider()` 优先从 preset 数据表读取模型列表
- 把 `SettingsDrawer.vue` 里与已知 provider 相关的提示文案逐步改为读取 preset 元数据（先保留兼容分支也可以）

#### 文件/函数改名（按 1.8 节规则执行）
- 将 `src/utils/providers/deepseek.js` 重命名为 `src/utils/providers/openaiCompatible.js`
- 将导出函数 `callModelDeepseek` 重命名为 `callModelOpenAICompatible`
- 同步修改 `src/core/services/aiService.js` 的 import
- 顺手确认 `providers/` 目录下**不再出现任何供应商名**

> 说明：这一改名是**零行为变更**的纯重构，建议作为 Phase 1A 的**第一个 commit**，先把名字理顺，再做后续数据集中化，避免新旧命名混杂。

### 这个 Phase 故意**不做**的事

- 不引入自定义预设
- 不改 `provider` / `apiUrl` 的主状态关系
- 不改现有 `saveApiKeyForUrl(apiUrl)` 的调用入口
- 不改 `selectedModel` 的保存策略

### 完成标准

- 新增内置 provider 时，核心数据只需要改 `src/config/presets/`
- `apiUrlOptions` 的硬编码数组消失
- 模型预设列表不再散落在多个判断里
- `providers/` 目录下不再出现任何以供应商名命名的文件
- 全局搜索 `providers/deepseek` 无结果
- 行为与当前版本保持一致

### 为什么要保留这个中间 Phase

因为当前代码中 `provider`、`apiUrl`、`useBackendProxy` 的联动关系还比较紧：

- `provider` 会反向影响 `apiUrl`
- `apiUrl` 变化会触发重新加载 Key 和模型列表
- `useBackendProxy` 开关会覆盖 `apiUrl`

如果在同一个 Phase 同时改"数据来源"和"状态事实源"，风险会明显上升。Phase 1A 只做数据集中化，不动状态流。

---

## Phase 1B：引入 `activePresetId`，重构状态事实源（1~2 天）

### 目标

正式切到 Preset 架构的状态模型：

- `activePresetId` 成为唯一事实源
- `provider` 改为派生值
- `apiUrl` 改为运行时推导值
- Key 按 `presetId` 分桶
- 模型按 `presetId` 记忆

### 主要工作

#### 新状态
- `bs2_active_preset_id`
- `bs2_selected_model_by_preset_id`
- `bs2_api_keys`（键名改为 `presetId`）

#### 新派生关系
- `currentPreset = getPresetById(activePresetId)`
- `provider = currentPreset.protocol`
- `currentModel = selectedModelByPresetId[activePresetId] ?? currentPreset.models[0] ?? ''`
- `requestEndpoint = resolveEndpoint(currentPreset)`
- `isBackendProxy = currentPreset.authMode === 'password'`

#### 组件职责调整
- `AppCore.vue` 持有 `activePresetId`
- `ModelSelector.vue` 继续保持 dumb component，只接收 `models` 与 `selectedModel`
- `SettingsDrawer.vue` 不直接管理 provider 推断，而是管理 preset 切换

### 迁移策略（关键）

这个 Phase 不能简单地把"未知 URL"回退到默认预设，否则会破坏老用户已有的自定义接入。

因此迁移规则改为：

#### 规则 A：旧 URL 能匹配内置预设

使用 `includes()` 模糊匹配域名关键词，与现有代码 `getProviderByApiUrl` 的策略保持一致。具体映射表：

| 旧 URL 特征（`includes()` 匹配） | 匹配到的 presetId |
|---|---|
| `api.siliconflow.cn` | `builtin_siliconflow` |
| `api.deepseek.com` | `builtin_deepseek` |
| `ark.cn-beijing.volces.com` | `builtin_volces` |
| `openrouter.ai` | `builtin_openrouter` |
| `api.lmrouter.com` | `builtin_lmrouter` |
| `generativelanguage.googleapis.com` | `builtin_gemini` |

匹配成功则：
- 写入 `bs2_active_preset_id = matchedPreset.id`
- 将旧 Key 迁移到对应 `presetId`
- 将旧全局模型迁移到 `selectedModelByPresetId[matchedPreset.id]`

#### 规则 B：旧 URL 不能匹配内置预设
则：
- 立即生成一个**隐藏的 migrated custom preset**
- 将其写入 `bs2_custom_presets`
- `activePresetId` 指向这个 migrated preset
- 同时把旧 Key / 模型迁移过去

也就是说：

> **Phase 1B 就允许"隐藏自定义预设"存在，即使 Phase 2 才提供 UI。**

这样才能做到真正的"行为等价"。

### 兼容策略

- `bs2_provider` 进入废弃状态，不再作为主事实源
- `bs2_api_url` 在迁移完成后可保留一段观察期，但不再是主配置
- `bs2_model` 迁移后仅作为 fallback，不再继续主写入
- `bs2_use_backend_proxy` 废弃，由 `currentPreset.authMode === 'password'` 派生
- `bs2_backend_url_deepseek` 迁移到 `builtin_backend_openai` 预设的 `baseUrl`，然后废弃
- `bs2_backend_url_gemini` 迁移到 `builtin_backend_gemini` 预设的 `baseUrl`，然后废弃

### 状态事实源收敛

Phase 1B 必须同时收敛 `core/store.js` 和 `AppCore.vue` 的 `data()` 中的重复默认值：

- **`core/store.js` 是全局状态的唯一事实源**
- `AppCore.vue` 的 `data()` 不再维护自己的一套默认值副本，而是统一从 `core/store.js` 读取
- 如果某个状态只在 `AppCore.vue` 内部使用（纯 UI 状态），可以保留在 `data()` 中，但与 API 配置相关的状态（`provider`、`apiUrl`、`model`、`temperature` 等）必须只有 `core/store.js` 一个来源

### 完成标准

- 切换 Preset 后，Key / 功能密码能自动切换
- 切换 Preset 后，模型恢复各自上次选择
- 选代理预设后 UI 自动切换为代理模式（功能密码输入框 + 可编辑 baseUrl）
- 旧的 `useBackendProxy`、`backendUrlDeepseek`、`backendUrlGemini` 完成迁移后废弃
- 旧的 `provider -> apiUrl` 反向写入链路基本被移除

---

## Phase 2：开放自定义预设管理 UI（2~3 天）

### 目标

让用户可以正式管理自己的自定义 OpenAI 兼容预设。

### 功能范围

- 新建自定义预设
- 编辑自定义预设
- 删除自定义预设
- 另存内置预设为自定义预设
- 切换当前激活预设

### 自定义预设表单字段

| 字段 | 必填 | 说明 |
|---|---|---|
| 预设名称 | ✅ | 如"我的 OneAPI 网关" |
| API 地址 | ✅ | UI 文案写"API 地址"，保存后归一化到 `baseUrl` |
| API Key | ✅ | 保存到该 `presetId` 的 Key 桶 |
| 模型列表 | ✅ | tag 输入框，至少一条 |

### 保存逻辑

保存时执行：

1. 校验 URL 是否为 `http(s)`
2. 如果末尾包含 `/chat/completions`，自动裁剪到 `baseUrl`
3. 如果末尾包含 `/models`，也裁剪到 `baseUrl`
4. 强制写入 `protocol: 'openai'`

### UI 形态建议

在 `SettingsDrawer.vue` 中增加"API 预设管理"区域：

- 内置预设：锁图标，只可选中 / 另存为
- 自定义预设：可编辑 / 删除
- 当前激活项需要明显高亮

### 完成标准

- 用户能创建多个命名预设
- 两个自定义预设可以使用同一个 `baseUrl` 但不同 Key
- 编辑 `baseUrl` 不会导致 Key 丢失
- 删除当前激活的自定义预设时，系统自动切回一个安全的内置预设

---

## Phase 3：模型列表"从服务器拉取"（1 天）

### 目标

在自定义预设表单里新增一个"从服务器拉取"按钮，用于调用 OpenAI 兼容的 `GET {baseUrl}/models`。

### 设计原则

- 这是**辅助功能**，不是强依赖
- 拉取失败时，仍然允许手动维护模型列表
- 拉到之后，也允许继续人工编辑

### 预期交互

1. 用户填写 API 地址和 Key
2. 点击"从服务器拉取"
3. 系统请求 `{baseUrl}/models`
4. 成功后弹出：
   - 覆盖当前模型列表
   - 追加到当前模型列表
   - 取消
5. 失败则提示：
   - "拉取失败，请手动填写"

### 兼容要求

需要兼容常见响应格式，例如：

- `{ data: [{ id: 'gpt-4o' }] }`
- `{ models: [...] }`
- 甚至某些网关的非标准结构

### 完成标准

- OpenRouter / one-api / new-api 这类常见服务都能拉到模型列表
- 拉不到时，不影响手工录入

---

## Phase 4：能力标记与 DrawMode 解耦（1~2 天）

### 目标

让 DrawMode 不再靠硬编码"推荐 OpenRouter"，而是读预设能力标记。

### 新增字段

```js
features: {
  imageOutput: true,
  reasoning: true,
}
```

### 第一版策略

- `builtin_openrouter`：`imageOutput: true`
- `builtin_gemini`：`imageOutput: true`
- 其他内置预设：默认 `false`
- 自定义预设：高级区允许用户手动勾选（默认 false）

### 为什么放在这个 Phase

因为你当前的目标不是先重做 DrawMode，而是先把 Preset 体系立住。DrawMode 改造属于受益项，不属于主路径。

### 完成标准

- DrawMode 不再直接硬编码某一家
- 自定义预设如果手动标记支持图像输出，也可以被 DrawMode 识别

---

## Phase 5（可选）：导入 / 导出 / 分享（1 天）

### 目标

让用户导入 / 导出自定义预设，便于备份和分享。

### 导出格式建议

```json
{
  "version": 1,
  "presets": [
    {
      "label": "我的公司代理",
      "baseUrl": "https://example.com/v1",
      "models": ["gpt-4o-mini"],
      "features": { "imageOutput": false }
    }
  ]
}
```

### 注意事项

- 不导出 Key
- 不导出 `id`
- 导入后重新生成 `custom_<id>`
- 导入后让用户重新填写 Key

### 完成标准

- 可导出多个自定义预设
- 导入后可立即使用（填 Key 后）

---

## 7. 与当前代码的对应关系

## 7.1 当前实现中最需要收敛的几处关系

### 旧关系 1：`provider` 会反向改 `apiUrl`

当前 `configMethods.js` 里存在这种关系：

- 改 `provider`
- 自动重写 `apiUrl`
- 再刷新模型和 Key

这是旧实现的合理写法，但进入 Preset 架构后，应逐步改成：

- 改 `activePresetId`
- 自动得到 `provider`
- 自动得到 `apiUrl`

### 旧关系 2：模型列表通过 `provider + apiUrl` 推断

当前 `listModelsByProvider(provider, useBackendProxy, apiUrl)` 同时依赖：

- `provider`
- 是否代理
- `apiUrl`

后续建议收敛为：

- `listModelsForPreset(currentPreset)`

### 旧关系 3：`useBackendProxy` 开关覆盖 `apiUrl`

当前 `useBackendProxy` 一旦打开，会用 `backendUrlDeepseek` 或 `backendUrlGemini` 覆盖 `apiUrl`。

后续这个关系完全消除：

- 代理地址就是代理预设自己的 `baseUrl`
- 不存在"覆盖"的概念

### 旧关系 4：Key 按 URL 分桶

当前 `keyManager.js` 已经有 fallback 机制，但主思路仍是"按 URL 识别来源"。

后续要改成：

- `getApiKeyForPreset(presetId)`
- `saveApiKeyForPreset(presetId, apiKey)`

## 7.2 当前实现中可以保留的优点

本次方案不应否定以下现有优势：

- 已有统一 AI 入口 `callAiModel`
- 已有两个明确 driver：OpenAI 兼容 / Gemini
- `keyManager` 已有一定程度的泛化 fallback
- `ModelSelector` 已支持 `allow-create`
- `extraBody` 已能承载少量协议扩展能力

这些都说明本项目并不是要"推翻重来"，而是做一次**清晰的抽象升级**。

---

## 8. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 迁移时把未知旧 URL 回退成默认预设 | 中 | 高 | 不允许直接回退；必须生成 migrated custom preset |
| `baseUrl` 语义再次被写脏 | 中 | 中 | 保存时统一归一化；禁止直接持久化 `chat/completions` 全路径 |
| `provider` 与 `preset` 双轨并存过久 | 高 | 中 | Phase 1B 明确废弃 `bs2_provider` 的主事实源地位 |
| 按 preset 记忆模型改动影响老用户习惯 | 中 | 低 | 迁移旧 `bs2_model` 到当前 preset 的选中模型 |
| 旧 `useBackendProxy` / `backendUrl*` 迁移遗漏 | 中 | 高 | Phase 1B 必须完成代理旧数据 → 代理预设的迁移，同时废弃旧键 |
| 火山引擎 / 特殊网关模型列表体验不一致 | 高 | 低 | 允许手工输入，不强求一期做智能补齐 |
| 改名 `deepseek.js → openaiCompatible.js` 与未合并分支冲突 | 低 | 低 | 单独一个 commit 完成改名，方便 rebase；改名前先确认无长期未合并分支依赖该路径 |

---

## 9. 非目标（明确不做）

为了控制范围，以下事项**明确排除**：

- ❌ 支持用户自定义 `anthropic` / `ollama` / 第三种协议类型
- ❌ 让用户自定义请求/响应字段映射 DSL
- ❌ 让用户自定义鉴权方式（头名、prefix、query token 等）
- ❌ 改成云端同步预设
- ❌ 在主路径里优先重做 DrawMode
- ❌ 一开始就实现 `extraHeaders` / `defaultExtraBody` 的完整编辑器

---

## 10. 进度追踪清单

### Phase 0：规则定稿
- [x] `baseUrl` 语义定稿
- [x] `activePresetId` 唯一事实源定稿
- [x] 后端代理作为独立预设定稿（不设 Transport 层）
- [x] `selectedModelByPresetId` 定稿
- [x] 模型 fallback 策略定稿（→ `models[0]` → 空字符串）
- [x] 迁移映射策略定稿（`includes()` 模糊匹配）
- [x] `featurePassword` 全局存储定稿
- [x] Phase 1A 归一化 URL 定稿
- [x] Phase 1B 收敛状态事实源定稿
- [x] 文档修订完成

### Phase 1A：集中 provider 知识
- [x] 重命名 `providers/deepseek.js` → `providers/openaiCompatible.js`
- [x] 重命名导出函数 `callModelDeepseek` → `callModelOpenAICompatible`
- [x] 更新 `aiService.js` 的 import
- [x] 新增 `src/config/presets/builtin.js`
- [x] 新增 `src/config/presets/index.js`
- [x] `apiUrlOptions` 从 Preset 派生
- [x] `apiUrlOptions` 中的 URL 归一化为 `baseUrl`（去掉 `/chat/completions`）
- [x] 调整 `ensureCompletionsEndpoint()` 调用时机
- [x] 内置模型列表集中化
- [x] 行为保持与现状一致

#### Phase 1A Review 补丁（2026-04-25）
- [x] 修复：`bs2_api_url` 被 Gemini 和 OpenAI-compatible 共用导致切换污染 → 按 provider 分开存储 `bs2_api_url_gemini` / `bs2_api_url_openai`
- [x] 修复：`apiUrlOptions` 不区分 provider → `deriveApiUrlOptions(provider)` 按协议过滤
- [x] 修复：自定义 URL 场景 `model` 被清成 `undefined` → 空数组时保留当前模型
- [x] 修复：`builtin_gemini` 模型列表补齐 2.5 系列
- [x] 修复：`SettingsDrawer.apiUrlHint` 从精确匹配旧 endpoint 改为 `includes()` 域名匹配

### Phase 1B：切换状态事实源
- [x] 新增 `activePresetId`
- [x] `provider` 改为派生值
- [x] `apiUrl` 改为运行时推导
- [x] `isBackendProxy` 改为从 `authMode` 派生
- [x] Key 按 `presetId` 分桶
- [x] 模型按 `presetId` 记忆
- [x] 旧数据迁移（含未知 URL → migrated custom preset）
- [x] 旧 `backendUrlDeepseek` → `builtin_backend_openai.baseUrl` 迁移
- [x] 旧 `backendUrlGemini` → `builtin_backend_gemini.baseUrl` 迁移
- [x] 废弃 `useBackendProxy` / `backendUrlDeepseek` / `backendUrlGemini`（Phase 2 已彻底移除）
- [x] 收敛 `core/store.js` 和 `AppCore.vue` 的重复默认值

#### Phase 1B Review 补丁（2026-04-25）
- [x] 修复：自定义 `apiUrl` 只改了临时状态、没有真正进入 preset 体系 → 未命中内置预设时自动创建/复用自定义 preset 并切换到它
- [x] 修复：代理地址修改后刷新会回退默认值 → 代理预设 `baseUrl` 改为运行时从本地持久化覆盖读取
- [x] 修复：代理模式下 `apiUrl` 变化会误回填旧 URL 桶中的 API Key → `loadApiKeyForCurrentUrl()` 在代理 preset 下直接清空并返回
- [x] 修复：清空 Key 只删 `presetId` 桶不删旧 URL 桶 → 两个桶同步删除，避免旧密钥残留
- [x] 修复：代理地址输入框边输边触发整套 preset 重算 → 改为只同步当前运行时 URL，不重复执行完整派生流程

### Phase 2：自定义预设管理
- [x] 自定义预设 CRUD（新建、编辑、删除）
- [x] SettingsDrawer 改为 Preset 选择器驱动（移除 provider radio + 神秘链接开关 + 代理地址散装控件）
- [x] 彻底移除 `useBackendProxy` / `backendUrlDeepseek` / `backendUrlGemini` 兼容字段
- [x] AppCore / Mode / aiService 统一使用 `isBackendProxy`（由 preset.authMode 派生）
- [x] Mode 层不再手动选代理 URL（`config.apiUrl` 已是正确运行时值）
- [x] URL 归一化为 `baseUrl`（normalizeBaseUrl 统一处理）
- [x] 两个相同 `baseUrl` 不同 Key 的预设可共存（手动创建路径允许重复，迁移路径仍去重）
- [ ] "另存为自定义"（内置预设 → 自定义预设的快捷操作，可 Phase 3 补充）

### Phase 3：模型拉取
- [x] "从服务器拉取"按钮
- [x] `{baseUrl}/models` 兼容逻辑
- [x] 覆盖 / 追加 / 取消三种操作
- [x] 自定义预设弹窗增加模型列表 Tag 编辑
- [x] 自定义预设弹窗增加 API Key 输入框
- [x] createCustomPreset / updateCustomPreset 支持 models 字段
- [x] 新增 `src/core/services/modelFetcher.js`

### Phase 4：能力标记
- [x] `features.imageOutput`
- [x] DrawMode 读能力标记
- [x] 自定义预设高级区

### Phase 5：导入 / 导出
- [ ] 导出格式
- [ ] 导入解析
- [ ] 版本号兼容

---

## 11. 时间预估

| Phase | 工作量 | 优先级 | 是否主路径 |
|---|---|---|---|
| Phase 0 | 0.5 天 | 高 | 是 |
| Phase 1A | 1 天 | 高 | 是 |
| Phase 1B | 1~2 天 | 高 | 是 |
| Phase 2 | 2~3 天 | 高 | 是 |
| Phase 3 | 1 天 | 中 | 否 |
| Phase 4 | 1~2 天 | 中 | 否 |
| Phase 5 | 1 天 | 低 | 否 |

### 主路径总耗时

`Phase 0 + Phase 1A + Phase 1B + Phase 2` 约为：

- **4.5 ~ 6.5 天**

完成后即可交付：

- 统一的 Preset 架构
- 多个自定义 OpenAI 兼容预设
- 按预设存 Key
- 按预设记忆模型
- 不破坏现有 Gemini 原生能力

---

## 附录 A：内置预设数据草案（修订后）

```js
export const BUILTIN_PRESETS = [
  {
    id: 'builtin_siliconflow',
    label: '硅基流动',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-R1',
      'deepseek-ai/DeepSeek-V3'
    ],
    isBuiltin: true,
    authMode: 'apiKey',
  },
  {
    id: 'builtin_deepseek',
    label: 'Deepseek 官方',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    isBuiltin: true,
    authMode: 'apiKey',
  },
  {
    id: 'builtin_volces',
    label: '火山引擎',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [],
    isBuiltin: true,
    authMode: 'apiKey',
  },
  {
    id: 'builtin_openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'google/gemini-2.5-flash-lite',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
      'google/gemini-3-flash-preview',
      'google/gemini-3.1-pro-preview',
      'google/gemini-3.1-flash-image-preview',
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-sonnet-4.6',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-opus-4.6',
      'anthropic/claude-opus-4.7',
      'openai/gpt-5.2',
      'openai/gpt-5.2-codex',
      'openai/gpt-5.3',
      'openai/gpt-5.3-codex',
      'openai/gpt-5.4',
      'openai/gpt-5.4-pro',
      'x-ai/grok-4.20',
      'z-ai/glm-5.1',
      'minimax/minimax-m2.7',
      'qwen/qwen3.6-plus',
      'moonshotai/kimi-k2.6',
      'deepseek/deepseek-chat-v3.1:free',
      'deepseek/deepseek-chat-v3-0324',
      'deepseek/deepseek-r1-0528',
      'deepseek/deepseek-r1-0528:free',
      'deepseek/deepseek-v3.2',
      'deepseek/deepseek-v3.2-speciale',
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro'
    ],
    isBuiltin: true,
    authMode: 'apiKey',
  },
  {
    id: 'builtin_lmrouter',
    label: 'LMRouter',
    protocol: 'openai',
    baseUrl: 'https://api.lmrouter.com/openai/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'claude-3.5-sonnet',
      'claude-3-opus',
      'gemini-pro',
      'gemini-1.5-pro'
    ],
    isBuiltin: true,
    authMode: 'apiKey',
  },
  {
    id: 'builtin_gemini',
    label: 'Google Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro-002',
      'gemini-1.5-flash-002'
    ],
    isBuiltin: true,
    authMode: 'apiKey',
  },

  // ── 代理预设 ──
  {
    id: 'builtin_backend_openai',
    label: 'OpenAI 后端代理',
    protocol: 'openai',
    baseUrl: '/api/deepseek/stream',
    models: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    isBuiltin: true,
    authMode: 'password',
    editableBaseUrl: true,
  },
  {
    id: 'builtin_backend_gemini',
    label: 'Gemini 后端代理',
    protocol: 'gemini',
    baseUrl: '/api/gemini/stream',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro'
    ],
    isBuiltin: true,
    authMode: 'password',
    editableBaseUrl: true,
  },
];
```

---

## 附录 B：旧存储项与迁移关系

| 旧键 | 新含义 / 新位置 | 说明 |
|---|---|---|
| `bs2_provider` | 废弃 | 后续由 `currentPreset.protocol` 派生 |
| `bs2_api_url` | 迁移到 `activePresetId` 或 migrated custom preset | 不再作为主事实源 |
| `bs2_model` | 迁移到 `selectedModelByPresetId[currentPresetId]` | 不再作为唯一全局模型 |
| `bs2_openai_compatible_api_key` | 迁移到 `bs2_api_keys[presetId]` | Key 分桶升级 |
| `bs2_api_keys`（按 URL） | `bs2_api_keys`（按 presetId） | 结构升级，但键名桶可复用 |
| `bs2_use_backend_proxy` | 废弃 | 由 `currentPreset.authMode === 'password'` 派生 |
| `bs2_backend_url_deepseek` | 迁移到 `builtin_backend_openai` 预设的 `baseUrl` | 废弃旧键 |
| `bs2_backend_url_gemini` | 迁移到 `builtin_backend_gemini` 预设的 `baseUrl` | 废弃旧键 |
| `bs2_feature_password` | 保持为全局状态 `featurePassword` | 不变，不按 presetId 分桶 |

---

## 附录 C：术语对照

| 旧术语 | 新术语 | 说明 |
|---|---|---|
| `provider` | `currentPreset.protocol` | 不再独立持久化 |
| `apiUrl` | `requestEndpoint`（运行时） | 由 `preset.baseUrl + protocol` 推导 |
| `apiUrlOptions` | `preset list` | 来自注册表 |
| URL 分桶 Key | 按 `presetId` 分桶 Key | 自定义预设更稳定 |
| 全局 `model` | `selectedModelByPresetId` | 每个预设记住自己的模型 |
| `providers/deepseek.js` | `providers/openaiCompatible.js` | 按协议而非供应商命名 |
| `callModelDeepseek` | `callModelOpenAICompatible` | 驱动导出函数改名同上 |
| `useBackendProxy` | `currentPreset.authMode === 'password'` | 不再是独立开关，从预设派生 |
| `backendUrlDeepseek` | `builtin_backend_openai.baseUrl` | 代理地址存在代理预设的 `baseUrl` 中 |
| `backendUrlGemini` | `builtin_backend_gemini.baseUrl` | 同上 |
| Transport 层 | （已移除） | 后端代理作为独立预设，不再需要 Transport 概念 |

---

**文档结束。**
