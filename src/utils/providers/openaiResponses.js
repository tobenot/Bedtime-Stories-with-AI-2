import { normalizeOpenAiUsage } from '@/utils/tokenUsage.js';
import { normalizeMaxTokens } from '@/utils/tokenLimits.js';

/**
 * OpenAI Responses API（POST /v1/responses）
 *
 * Chat Completions 的进化版。本驱动把现有 OpenAI 风格 messages 转为
 * instructions + input，解析 output / 流式语义事件，向上返回与其他驱动
 * 相同形状的 assistantMessage。
 *
 * 多轮：默认手动回传历史（store: false），不依赖 previous_response_id。
 * 结构化输出：把 extraBody.response_format 映射为 text.format。
 */

const RESPONSES_EXTRA_KEYS = [
	'top_p', 'tools', 'tool_choice', 'metadata', 'user',
	'previous_response_id', 'store', 'truncation', 'parallel_tool_calls',
	'prompt_cache_key', 'safety_identifier', 'service_tier',
	'reasoning', 'include', 'background', 'conversation'
];

/**
 * baseUrl → /v1/responses
 */
export function ensureResponsesEndpoint(apiUrl) {
	if (!apiUrl) return apiUrl;
	let url = String(apiUrl).trim();
	if (!url) return url;
	if (/\/v1\/responses(?:\?|$)/i.test(url)) return url;
	if (url.includes('/chat/completions')) {
		return url.replace('/chat/completions', '/responses');
	}
	if (url.includes('/messages')) {
		return url.replace('/messages', '/responses');
	}
	url = url.endsWith('/') ? url.slice(0, -1) : url;
	if (/\/v\d+(?:beta)?$/i.test(url)) return url + '/responses';
	return url + '/v1/responses';
}

function contentToText(content) {
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content.map((block) => {
			if (typeof block === 'string') return block;
			if (typeof block?.text === 'string') return block.text;
			return '';
		}).join('');
	}
	if (content == null) return '';
	return String(content);
}

/**
 * messages → { instructions?, input }
 * system/developer 抽到 instructions；其余 user/assistant 进 input。
 */
export function buildResponsesInput(messages) {
	const instructionParts = [];
	const input = [];

	if (!Array.isArray(messages)) {
		return { instructions: undefined, input: [] };
	}

	for (const message of messages) {
		if (!message || typeof message !== 'object') continue;
		const role = message.role;
		const text = contentToText(message.content);

		if (role === 'system' || role === 'developer') {
			if (text) instructionParts.push(text);
			continue;
		}
		if (role === 'user' || role === 'assistant') {
			input.push({
				role,
				content: text
			});
		}
	}

	return {
		instructions: instructionParts.length > 0 ? instructionParts.join('\n\n') : undefined,
		input
	};
}

/**
 * Chat Completions 的 response_format → Responses 的 text.format
 */
export function convertResponseFormatToTextFormat(responseFormat) {
	if (!responseFormat || typeof responseFormat !== 'object') return null;
	const type = responseFormat.type;
	if (type === 'json_object') {
		return { type: 'json_object' };
	}
	if (type === 'text') {
		return { type: 'text' };
	}
	if (type === 'json_schema') {
		const schemaWrapper = responseFormat.json_schema || {};
		const format = {
			type: 'json_schema',
			name: schemaWrapper.name || 'response',
			schema: schemaWrapper.schema || { type: 'object' }
		};
		if (schemaWrapper.strict !== undefined) {
			format.strict = schemaWrapper.strict;
		}
		if (schemaWrapper.description) {
			format.description = schemaWrapper.description;
		}
		return format;
	}
	return null;
}

function pickResponsesExtraBody(extraBody = {}) {
	const out = {};
	if (!extraBody || typeof extraBody !== 'object') return out;

	for (const key of RESPONSES_EXTRA_KEYS) {
		if (key in extraBody && extraBody[key] !== undefined) {
			out[key] = extraBody[key];
		}
	}

	if (extraBody.reasoning_effort && !out.reasoning) {
		out.reasoning = { effort: extraBody.reasoning_effort };
	}

	const textFormat = convertResponseFormatToTextFormat(extraBody.response_format);
	if (textFormat) {
		out.text = {
			...(typeof extraBody.text === 'object' ? extraBody.text : {}),
			format: textFormat
		};
	} else if (extraBody.text && typeof extraBody.text === 'object') {
		out.text = extraBody.text;
	}

	return out;
}

export function extractResponsesOutputText(response) {
	if (!response || typeof response !== 'object') return '';
	if (typeof response.output_text === 'string' && response.output_text) {
		return response.output_text;
	}
	const parts = [];
	for (const item of response.output || []) {
		if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
		for (const block of item.content) {
			if (block?.type === 'output_text' && typeof block.text === 'string') {
				parts.push(block.text);
			}
		}
	}
	return parts.join('');
}

export function extractResponsesReasoning(response) {
	if (!response || typeof response !== 'object') return '';
	const parts = [];
	for (const item of response.output || []) {
		if (item?.type !== 'reasoning') continue;
		if (Array.isArray(item.summary)) {
			for (const summary of item.summary) {
				if (typeof summary?.text === 'string' && summary.text) {
					parts.push(summary.text);
				}
			}
		}
		if (Array.isArray(item.content)) {
			for (const block of item.content) {
				if (
					(block?.type === 'reasoning_text' || block?.type === 'summary_text')
					&& typeof block.text === 'string'
					&& block.text
				) {
					parts.push(block.text);
				}
			}
		}
	}
	return parts.join('\n');
}

function extractImages(response) {
	const images = [];
	for (const item of response?.output || []) {
		if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
		for (const block of item.content) {
			if (block?.type === 'output_image' && block.image_url) {
				images.push({ image_url: { url: block.image_url } });
			}
		}
	}
	return images;
}

function applyCompletedResponse(newMessage, response) {
	if (!response || typeof response !== 'object') return;
	const text = extractResponsesOutputText(response);
	if (text) newMessage.content = text;
	const reasoning = extractResponsesReasoning(response);
	if (reasoning) newMessage.reasoning_content = reasoning;
	const images = extractImages(response);
	if (images.length) newMessage.images = images;
	if (response.id) newMessage.responseId = response.id;
	if (response.usage) {
		newMessage.usage = normalizeOpenAiUsage(response.usage);
	}
	if (response.error) {
		const msg = response.error.message || response.error.code || '未知错误';
		throw new Error(`API错误: ${msg}`);
	}
	if (response.status === 'failed') {
		throw new Error(`API错误: Responses 请求失败（status=failed）`);
	}
}

function createResponsesError(message, status) {
	const err = new Error(message);
	err.status = status;
	err.isResponsesApiError = true;
	return err;
}

/**
 * @returns {Promise<{role, content, reasoning_content, timestamp, images, usage, responseId?}>}
 */
export async function callModelOpenAIResponses({
	apiUrl,
	apiKey,
	model,
	messages,
	temperature = 0.7,
	maxTokens = 4096,
	signal,
	onChunk,
	featurePassword,
	isBackendProxy,
	stream = true,
	extraBody = {}
}) {
	const endpoint = ensureResponsesEndpoint(apiUrl);
	const safeMaxTokens = normalizeMaxTokens(maxTokens, 4096);
	const { instructions, input } = buildResponsesInput(messages);
	const mappedExtra = pickResponsesExtraBody(extraBody);

	const requestBody = {
		model,
		input,
		stream,
		temperature,
		max_output_tokens: safeMaxTokens,
		// 浏览器端自行回传历史，默认不落库
		store: false,
		...mappedExtra
	};

	if (instructions) {
		requestBody.instructions = instructions;
	}

	// mappedExtra 里若显式传了 store，保留用户值
	if (mappedExtra.store !== undefined) {
		requestBody.store = mappedExtra.store;
	}

	console.log('[Responses API] request:', {
		endpoint,
		model,
		inputCount: Array.isArray(input) ? input.length : 0,
		hasInstructions: Boolean(instructions),
		stream,
		store: requestBody.store,
		hasTextFormat: Boolean(requestBody.text?.format),
		hasPreviousResponseId: Boolean(requestBody.previous_response_id),
		tools: Array.isArray(requestBody.tools)
			? requestBody.tools.map((t) => t?.type).filter(Boolean)
			: []
	});

	const headers = { 'Content-Type': 'application/json' };
	if (isBackendProxy) {
		if (apiKey) headers['x-api-key'] = apiKey;
		if (featurePassword && featurePassword.trim()) {
			headers['X-Feature-Password'] = featurePassword;
		}
	} else if (apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[Responses API] request failed:', response.status, errorText);
		const baseMsg = `API请求失败: ${response.status} - ${errorText}`;
		const hint = response.status === 401
			? ' 若密钥无误，可能是上游或中转暂时异常，可过半小时重试，不是你的问题（作者遇到过）。'
			: '';
		throw createResponsesError(baseMsg + hint, response.status);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString(),
		images: [],
		usage: null
	};

	if (!stream) {
		const data = await response.json();
		applyCompletedResponse(newMessage, data);
		return newMessage;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let idx;
		while ((idx = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (!line || line.startsWith(':') || line.startsWith('event:')) continue;
			if (line === 'data: [DONE]' || line === '[DONE]') continue;

			let jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonStr) continue;

			let event;
			try {
				event = JSON.parse(jsonStr);
			} catch (parseErr) {
				console.error('[Responses API] SSE parse error:', parseErr, 'line:', line);
				continue;
			}

			const type = event?.type;
			if (!type) continue;

			if (type === 'error' || type === 'response.failed') {
				const msg = event.error?.message
					|| event.response?.error?.message
					|| event.message
					|| 'Responses 流式错误';
				throw new Error(`API错误: ${msg}`);
			}

			if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
				newMessage.content += event.delta;
			} else if (type === 'response.reasoning_summary_text.delta' && typeof event.delta === 'string') {
				newMessage.reasoning_content += event.delta;
			} else if (type === 'response.reasoning_text.delta' && typeof event.delta === 'string') {
				newMessage.reasoning_content += event.delta;
			} else if (type === 'response.completed' && event.response) {
				applyCompletedResponse(newMessage, event.response);
			} else if (type === 'response.created' && event.response?.id) {
				newMessage.responseId = event.response.id;
			}

			if (typeof onChunk === 'function') {
				onChunk({ ...newMessage });
			}
		}
	}

	return newMessage;
}
