# Responses API 支持说明

## 入口

设置 → **API 格式** → `Responses`（`bs2_request_format = responses`）

自动模式不会切到 Responses；Claude 仍走 Anthropic Messages，其余走 Chat Completions。需要 Responses 时请显式选择。

## 行为

| 项 | 实现 |
|----|------|
| 端点 | `{base}/v1/responses` |
| 输入 | `messages` → `instructions`（system/developer）+ `input`（user/assistant） |
| 输出 | `output_text` / `output[].message`；流式 `response.output_text.delta` |
| 推理 | `response.reasoning_summary_text.delta` / `response.reasoning_text.delta` |
| 结构化输出 | `extraBody.response_format` → `text.format` |
| 多轮 | 手动回传历史；默认 `store: false` |
| 缺失端点 | 404/405/5xx 回退 Chat Completions |

驱动：`src/utils/providers/openaiResponses.js`

## 缓存

Anthropic 风格 Prompt Cache（关/5m/1h）在 Responses 下不可用，UI 会禁用并注明原因。Responses 自身的服务端缓存与该开关无关。

## 未做（可后续）

- Conversations API / UI 侧 `previous_response_id` 链路
- 内置工具（web_search 等）与服务端自动 tool loop
- DrawMode `modalities` 图像生成（仍建议 Chat Completions / Gemini）
