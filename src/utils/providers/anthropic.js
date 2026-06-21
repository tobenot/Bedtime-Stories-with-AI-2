import { applyPromptCacheControl } from '@/utils/promptCache';

/**
 * Anthropic 原生 /v1/messages 调用
 *
 * 为什么要单独走原生端点：
 *   Anthropic 的 prompt caching（cache_control / cache_creation_input_tokens /
 *   cache_read_input_tokens）只在原生 /v1/messages 上真正生效并回传缓存计数。
 *   OpenAI 兼容端点 /v1/chat/completions 的 schema 没有 cache_control，usage 也
 *   不含 cache_*_input_tokens，中转站是否转发/回传无保证（实测老张走兼容端点时
 *   缓存写入恒为 0）。要让 Claude 真正吃上缓存，必须打 /v1/messages。
 *
 * 复用 applyPromptCacheControl 产出的 content 块（[{type:'text', text, cache_control}]）
 * —— 这与 Anthropic 原生 content block 格式一致，无需二次转换。
 *
 * 认证策略：同时发送 x-api-key 与 Authorization: Bearer，并带 anthropic-version。
 *   官方 Anthropic 用 x-api-key；多数中转（含老张）用 Bearer。两者都带，兼容最广，
 *   额外头会被忽略，无害。
 *
 * SSE 事件：message_start（含 input/cache 计数）/ content_block_delta
 *   （text_delta→content，thinking_delta→reasoning_content）/ message_delta
 *   （output_tokens）/ message_stop / error / ping。
 */

const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Anthropic /v1/messages 接受的顶层可选参数白名单。
 * extraBody 只透传这些键，其余 OpenAI 专有字段（response_format / modalities /
 * image_config / reasoning / frequency_penalty 等）一律丢弃，避免原生端点 400。
 * 核心字段（model/messages/max_tokens/temperature/stream）由本函数显式设置，不在此列。
 */
const ANTHROPIC_NATIVE_EXTRA_KEYS = [
	'top_p', 'top_k', 'stop_sequences', 'metadata',
	'tools', 'tool_choice', 'thinking', 'system'
];

/**
 * 把 baseUrl 规范化为 /v1/messages 端点
 * 兼容传入：https://api.laozhang.ai/v1、.../v1/chat/completions、.../v1/messages
 */
function ensureMessagesEndpoint(apiUrl) {
	if (!apiUrl) return apiUrl;
	let url = String(apiUrl).trim();
	if (!url) return url;
	// 已是 messages 端点
	if (/\/v1\/messages(?:\?|$)/i.test(url)) return url;
	// 已含 chat/completions → 同版本前缀下替换为 messages（避免 /v1/v1/messages）
	if (url.includes('/chat/completions')) {
		return url.replace('/chat/completions', '/messages');
	}
	// 后端代理相对路径 / 统一端点：交由后端处理，这里只拼成 /v1/messages
	// 去掉尾部斜杠
	url = url.endsWith('/') ? url.slice(0, -1) : url;
	// 以版本路径结尾（/v1、/v2…）→ 直接追加 /messages
	if (/\/v\d+(?:beta)?$/i.test(url)) return url + '/messages';
	// 其他 → 追加 /v1/messages
	return url + '/v1/messages';
}

/**
 * 从 OpenAI 格式消息构造 Anthropic /v1/messages 的 messages 字段
 * applyPromptCacheControl 已把需缓存消息的 content 转为带 cache_control 的块数组，
 * 直接透传；未标记消息保持原字符串/数组，Anthropic 均接受。
 */
function buildAnthropicMessages(cachedMessages) {
	if (!Array.isArray(cachedMessages)) return [];
	return cachedMessages
		.filter(m => m && (m.role === 'user' || m.role === 'assistant'))
		.map(m => ({
			role: m.role,
			content: m.content ?? ''
		}));
}

/**
 * 缓存命中遥测：把 usage 拆解为结构化指标并落盘到控制台。
 *
 * 浏览器端无法接 Prometheus/CloudWatch，这里用 console 输出结构化指标，
 * 便于在 DevTools 里观察 cache_read / cache_write / 命中率。
 *
 * 关键判据：当输入规模较大（> 4096 token）却 cache_read=0 时，
 * 往往意味着缓存未命中或被静默降级（前缀变动 / 中转剥离 cache_control /
 * 工作空间隔离 / 模型切换），打 warn 提示排查。
 *
 * usage 字段（Anthropic 原生 /v1/messages）：
 *   input_tokens                      未缓存部分（全价）
 *   cache_creation_input_tokens       本次写入（1.25x@5m / 2x@1h）
 *   cache_read_input_tokens           本次命中读取（0.1x）
 * 总输入 = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
 */
function logCacheTelemetry(usage) {
	if (!usage || typeof usage !== 'object') return;
	const inputTokens = usage.input_tokens || 0;
	const cacheRead = usage.cache_read_input_tokens || 0;
	const cacheWrite = usage.cache_creation_input_tokens || 0;
	const totalInput = inputTokens + cacheRead + cacheWrite;
	const cacheHitRate = totalInput > 0 ? (cacheRead / totalInput) * 100 : 0;

	const metrics = {
		inputTokens,
		cacheRead,
		cacheWrite,
		outputTokens: usage.output_tokens || 0,
		cacheHitRate: Number(cacheHitRate.toFixed(1))
	};

	if (cacheRead === 0 && totalInput > 4096) {
		// 大规模冷启动或缓存未命中：前缀可能被某个静默失效因子打破
		console.warn('[Cache] 缓存未命中且输入较大，排查前缀稳定性 / 中转转发 / 工作空间隔离:', metrics);
	} else {
		console.log('[Cache] 命中遥测:', metrics);
	}
}

export async function callModelAnthropicNative({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk, featurePassword, isBackendProxy, stream = true, extraBody = {}, promptCacheTtl }) {
	console.log('[DEBUG] callModelAnthropicNative called:', {
		apiUrl,
		hasApiKey: !!apiKey,
		model,
		messagesCount: messages?.length,
		temperature,
		maxTokens,
		stream,
		promptCacheTtl
	});

	// 注入缓存断点（与 OpenAI 路径共用同一套标记逻辑）
	const cachedMessages = applyPromptCacheControl(messages, promptCacheTtl);
	const anthropicMessages = buildAnthropicMessages(cachedMessages);

	const requestBody = {
		model,
		messages: anthropicMessages,
		max_tokens: maxTokens,
		stream
	};
	// temperature: Anthropic 接受 0~1；仅当有值时发送
	if (typeof temperature === 'number' && Number.isFinite(temperature)) {
		requestBody.temperature = temperature;
	}
	// 透传调用方的额外参数 —— 但仅取 Anthropic /v1/messages 合法字段。
	// OpenAI 专有字段（response_format / modalities / image_config / reasoning 等）
	// 原生端点不认，直接发会 400，必须过滤掉。
	if (extraBody && typeof extraBody === 'object') {
		for (const k of ANTHROPIC_NATIVE_EXTRA_KEYS) {
			if (k in extraBody && !(k in requestBody)) {
				requestBody[k] = extraBody[k];
			}
		}
	}

	const finalUrl = ensureMessagesEndpoint(apiUrl);

	const headers = {
		'Content-Type': 'application/json',
		'Accept': 'text/event-stream',
		'anthropic-version': ANTHROPIC_VERSION
	};
	// 1h 缓存已 GA：在 cache_control 块里声明 "ttl":"1h" 即可原生激活，
	// 不需要任何 beta 头。早期 1h 处于 beta 时需要 extended-cache-ttl-2025-04-11，
	// 现在该头已废弃——继续发送过时 beta 头可能被中转网关剥离或触发服务端
	// 降级，反而导致 cache_control 失效、cache_*_tokens 归零。
	// cache_control 的 ttl 字段由 applyPromptCacheControl / buildCacheControl 生成。

	if (isBackendProxy) {
		// 后端代理：用 x-api-key 承载前端用户认证，feature 密码走自定义头
		if (apiKey) headers['x-api-key'] = apiKey;
		if (featurePassword && featurePassword.trim()) headers['X-Feature-Password'] = featurePassword;
	} else {
		// 直连：x-api-key（官方）与 Bearer（多数中转）都带，兼容最广
		if (apiKey) {
			headers['x-api-key'] = apiKey;
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
	}

	const response = await fetch(finalUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[DEBUG] Anthropic native request failed:', response.status, errorText);
		// 抛出带状态码的错误，便于上层按 404/405 判断端点是否存在并回退
		const err = new Error(`Anthropic原生请求失败: ${response.status} - ${errorText}`);
		err.status = response.status;
		err.isAnthropicNativeError = true;
		throw err;
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString(),
		images: [],
		usage: null // 缓存计数：{ input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }
	};

	// 非流式
	if (!stream) {
		const data = await response.json();
		if (data.error) {
			throw new Error(`API错误: ${data.error.message || data.error.type || '未知错误'}`);
		}
		// content blocks: [{type:'text', text}, {type:'thinking', thinking}, ...]
		if (Array.isArray(data.content)) {
			for (const block of data.content) {
				if (block.type === 'text' && typeof block.text === 'string') {
					newMessage.content += block.text;
				} else if (block.type === 'thinking' && typeof block.thinking === 'string') {
					newMessage.reasoning_content += block.thinking;
				}
			}
		}
		if (data.usage) {
			newMessage.usage = data.usage;
			console.log('[DEBUG] Anthropic native usage:', data.usage);
			logCacheTelemetry(data.usage);
		}
		return newMessage;
	}

	// 流式 SSE
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let currentEvent = '';

	const handleEvent = (eventType, data) => {
		if (!data) return;
		try {
			const parsed = JSON.parse(data);

			if (eventType === 'error' || parsed.error) {
				console.error('[DEBUG] Anthropic native stream error:', parsed.error);
				throw new Error(`API错误: ${parsed.error?.message || parsed.error?.type || '未知错误'}`);
			}

			if (eventType === 'message_start') {
				const u = parsed.message?.usage;
				if (u) {
					newMessage.usage = { ...u };
				}
			} else if (eventType === 'content_block_delta') {
				const delta = parsed.delta;
				if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
					// 从 thinking 切到正文时补一个段落分隔，便于 Markdown 渲染
					if (newMessage.reasoning_content && !newMessage.reasoning_content.endsWith('\n\n')) {
						newMessage.reasoning_content += newMessage.reasoning_content.endsWith('\n') ? '\n' : '\n\n';
					}
					newMessage.content += delta.text;
				} else if (delta?.type === 'thinking_delta' && typeof delta.text === 'string') {
					newMessage.reasoning_content += delta.text;
				}
			} else if (eventType === 'message_delta') {
				// 增量补全 output_tokens 等
				if (parsed.usage) {
					newMessage.usage = { ...(newMessage.usage || {}), ...parsed.usage };
				}
			}
			// message_stop / ping / content_block_start / content_block_stop：无需处理
		} catch (err) {
			// 业务错误向上抛；JSON 解析错仅记录
			if (err.message && err.message.includes('API错误:')) throw err;
			console.error('[DEBUG] Anthropic native parse error:', err, 'payload:', data);
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let nlIdx;
		while ((nlIdx = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, nlIdx).trim();
			buffer = buffer.slice(nlIdx + 1);

			if (!line) {
				// 空行 = 一个 SSE 事件结束（事件之间分隔），不强制重置 currentEvent
				continue;
			}
			if (line.startsWith(':')) continue; // 注释/心跳

			if (line.startsWith('event:')) {
				currentEvent = line.slice(6).trim();
				continue;
			}
			if (line.startsWith('data:')) {
				const payload = line.slice(5).trim();
				if (!payload) continue;
				if (payload === '[DONE]') continue;
				// 复用 currentEvent；若无 event: 行，交给 handleEvent 用 data 内字段兜底
				handleEvent(currentEvent || '', payload);
				if (typeof onChunk === 'function') {
					onChunk({ ...newMessage });
				}
				// 事件消费后重置，避免下一段无 event: 时误用上一个类型
				currentEvent = '';
			}
		}
	}

	if (newMessage.usage) {
		console.log('[DEBUG] Anthropic native final usage:', newMessage.usage);
		logCacheTelemetry(newMessage.usage);
	} else {
		console.warn('[DEBUG] Anthropic native: 未收到 usage（可能中转未回传）');
	}
	return newMessage;
}
