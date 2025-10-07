# 流式输出 JSON 解析问题技术报告

## 问题概述

在 VirtualLoverMode 中，AI 模型返回的 JSON 格式响应在流式输出过程中出现解析问题，导致角色状态（表情、动作、好感度）无法正确更新。

## 问题表现

### 1. Gemini 模型问题
- **现象**：AI 返回的 JSON 被 Markdown 代码块包裹
- **错误信息**：`SyntaxError: Unexpected token '`', "```json`
- **示例**：
```json
```json
{
"evaluation": "Greeting",
"action": "Greet back",
"reply": "你好呀！很高兴见到你！",
"emote": 1,
"bodyAction": 5,
"score": 2
}
```
```

### 2. Deepseek 模型问题
- **现象**：流式输出时每个字符后都重复发送完整 JSON 结构
- **错误信息**：`SyntaxError: Unexpected non-whitespace character after JSON at position 118`
- **示例**：
```
```json
{
"evaluation": "greeting",
"action": "initiating a topic",
"reply": "哇！你好呀！今天天气真好～",
"emote": "1",
"bodyAction": "0",
"score": "2"
}
``````json
{
"evaluation": "greeting",
"action": "initiating a topic",
"reply": "哇！你好呀！今天天气真好～",
"emote": "1",
"bodyAction": "0",
"score": "2"
}
```
```

## 根本原因分析

### 1. 流式输出机制差异
不同 AI 模型的流式输出行为不同：

- **Gemini**：增量输出 + 完整输出
- **Deepseek**：每个字符后重复完整结构
- **其他模型**：可能还有其他模式

### 2. JSON 解析时机问题
- 流式过程中尝试解析不完整的 JSON
- 最终解析时遇到重复或格式错误的内容
