import { applyPromptCacheControl } from '@/utils/promptCache';
import { buildOpenAiTokenLimitFields, usesMaxCompletionTokens } from '@/utils/tokenLimits.js';
import { normalizeOpenAiUsage } from '@/utils/tokenUsage.js';

export async function callModelOpenAICompatible({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk, featurePassword, isBackendProxy, geminiReasoningEffort, stream = true, extraBody = {}, promptCacheTtl }) {

	// 注入提示词缓存标记（Claude 等支持缓存的模型命中 Prompt Cache）
	const cachedMessages = applyPromptCacheControl(messages, promptCacheTtl);

	const sanitizedMessages = Array.isArray(cachedMessages)
		? cachedMessages.map(message => ({
			role: message?.role,
			content: message?.content ?? ''
		}))
		: [];

	const requestBody = {
		model,
		messages: sanitizedMessages,
		stream,
		temperature,
		...extraBody,
		...buildOpenAiTokenLimitFields(model, maxTokens)
	};

	// 流式默认不回 usage；需要显式打开才能拿到 cached_tokens
	if (stream) {
		requestBody.stream_options = {
			...(requestBody.stream_options || {}),
			include_usage: true
		};
	}

	if (usesMaxCompletionTokens(model)) {
		delete requestBody.max_tokens;
	} else {
		delete requestBody.max_completion_tokens;
	}

	if (model && model.includes('gemini') && geminiReasoningEffort && geminiReasoningEffort !== 'off') {
		requestBody.reasoning = {
			effort: geminiReasoningEffort
		};
	}

	const headers = { 'Content-Type': 'application/json' };
	
	if (isBackendProxy) {
		// 后端代理模式：不添加Authorization头，避免覆盖后端配置的真实API Key
		// 只添加用于前端用户认证的自定义头
		if (apiKey) {
			headers['x-api-key'] = apiKey;
		}
		if (featurePassword && featurePassword.trim()) {
			headers['X-Feature-Password'] = featurePassword;
		}
	} else {
		// 直连模式：对于所有OpenAI兼容的API，只要有apiKey就添加Authorization头
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
	}

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[DEBUG] API request failed:', response.status, errorText);
		const baseMsg = `API请求失败: ${response.status} - ${errorText}`;
		const hint = response.status === 401 ? ' 若密钥无误，可能是上游或中转暂时异常，可过半小时重试，不是你的问题（作者遇到过）。' : '';
		throw new Error(baseMsg + hint);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString(),
		images: [], // Support for images
		usage: null
	};

	if (!stream) {
		const data = await response.json();
		if (data.error) {
			throw new Error(`API错误: ${data.error.message || data.error.type || '未知错误'}`);
		}
		const choice = data.choices?.[0];
		if (choice) {
			newMessage.content = choice.message?.content || '';
			if (choice.message?.reasoning_content) {
				newMessage.reasoning_content = choice.message.reasoning_content;
			}
			// Handle OpenRouter Gemini image response
			if (choice.message?.images) {
				newMessage.images = choice.message.images;
			}
		}
		newMessage.usage = normalizeOpenAiUsage(data.usage);
		return newMessage;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let chunkCount = 0;
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunkCount++;
		const chunk = decoder.decode(value, { stream: true });
		buffer += chunk;
		let idx;
		while ((idx = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (!line) continue;
			if (line.startsWith(':')) continue;
			if (line === 'data: [DONE]' || line === '[DONE]') {
				continue;
			}
			let jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);

				if (data.error) {
					console.error('[DEBUG] OpenAI Compatible API error:', data.error);
					throw new Error(`API错误: ${data.error.message || data.error.type || '未知错误'}`);
				}

				// usage-only 末包：choices 可能为空数组，勿假设 choices[0] 必有
				const delta = data.choices?.[0]?.delta;
				if (delta?.reasoning_content !== undefined) {
					newMessage.reasoning_content += delta.reasoning_content || '';
				} else if (delta?.reasoning !== undefined) {
					const reasoningText = delta.reasoning || '';
					newMessage.reasoning_content += reasoningText.replace(/\\n/g, '\n');
				}
				if (delta?.content !== undefined) {
					newMessage.content += delta.content || '';
				}
				if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (data.usage) {
					newMessage.usage = normalizeOpenAiUsage(data.usage);
				}
				if (typeof onChunk === 'function') {
					onChunk({ ...newMessage });
				}
			} catch (error) {
				console.error('[DEBUG] Data parsing error:', error, 'Original data:', line);
				if (error.message && error.message.includes('API错误:')) {
					throw error;
				}
			}
		}
	}
	return newMessage;
}
