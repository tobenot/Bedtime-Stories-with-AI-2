/**
 * 请求格式（Chat Completions / Anthropic Messages）与 Prompt Cache 可用性
 *
 * requestFormat 是 OpenAI 兼容底座上的二次路由，与 preset.protocol（openai|gemini）分开。
 */

export const REQUEST_FORMAT = {
	AUTO: 'auto',
	CHAT_COMPLETIONS: 'chat_completions',
	ANTHROPIC_MESSAGES: 'anthropic_messages'
};

export const CACHE_UNAVAILABLE_REASON = {
	FORMAT_CHAT_COMPLETIONS: 'format_chat_completions',
	BACKEND_PROXY: 'backend_proxy',
	GEMINI_PROTOCOL: 'gemini_protocol'
};

const VALID_PREFS = new Set([
	REQUEST_FORMAT.AUTO,
	REQUEST_FORMAT.CHAT_COMPLETIONS,
	REQUEST_FORMAT.ANTHROPIC_MESSAGES
]);

/**
 * @param {unknown} value
 * @returns {'auto'|'chat_completions'|'anthropic_messages'}
 */
export function normalizeRequestFormatPref(value) {
	const v = typeof value === 'string' ? value.trim() : '';
	return VALID_PREFS.has(v) ? v : REQUEST_FORMAT.AUTO;
}

/**
 * 判定是否为 Claude 系列模型（含 anthropic/claude-* 等前缀）
 * @param {unknown} model
 * @returns {boolean}
 */
export function isClaudeModel(model) {
	if (typeof model !== 'string' || !model) return false;
	const bare = model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model;
	return /^claude[-_]/i.test(bare);
}

/**
 * 解析本次请求应使用的外壳格式
 * Gemini 通道返回 null（由 gemini 驱动处理，不走本开关）
 *
 * @param {Object} options
 * @param {string} [options.requestFormatPref]
 * @param {string} [options.model]
 * @param {boolean} [options.isBackendProxy]
 * @param {string} [options.protocol] 'openai' | 'gemini'
 * @returns {'chat_completions'|'anthropic_messages'|null}
 */
export function resolveRequestFormat({
	requestFormatPref = REQUEST_FORMAT.AUTO,
	model = '',
	isBackendProxy = false,
	protocol = 'openai'
} = {}) {
	if (protocol === 'gemini') return null;
	if (isBackendProxy) return REQUEST_FORMAT.CHAT_COMPLETIONS;

	const pref = normalizeRequestFormatPref(requestFormatPref);
	if (pref === REQUEST_FORMAT.CHAT_COMPLETIONS) return REQUEST_FORMAT.CHAT_COMPLETIONS;
	if (pref === REQUEST_FORMAT.ANTHROPIC_MESSAGES) return REQUEST_FORMAT.ANTHROPIC_MESSAGES;

	return isClaudeModel(model)
		? REQUEST_FORMAT.ANTHROPIC_MESSAGES
		: REQUEST_FORMAT.CHAT_COMPLETIONS;
}

/**
 * Prompt Cache 是否可用，及不可用原因
 *
 * @returns {{ available: boolean, reason: string|null, effectiveFormat: string|null }}
 */
export function getPromptCacheAvailability({
	requestFormatPref = REQUEST_FORMAT.AUTO,
	model = '',
	isBackendProxy = false,
	protocol = 'openai'
} = {}) {
	if (protocol === 'gemini') {
		return {
			available: false,
			reason: CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL,
			effectiveFormat: null
		};
	}
	if (isBackendProxy) {
		return {
			available: false,
			reason: CACHE_UNAVAILABLE_REASON.BACKEND_PROXY,
			effectiveFormat: REQUEST_FORMAT.CHAT_COMPLETIONS
		};
	}

	const effectiveFormat = resolveRequestFormat({
		requestFormatPref,
		model,
		isBackendProxy,
		protocol
	});

	if (effectiveFormat !== REQUEST_FORMAT.ANTHROPIC_MESSAGES) {
		return {
			available: false,
			reason: CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS,
			effectiveFormat
		};
	}

	return {
		available: true,
		reason: null,
		effectiveFormat
	};
}

export function isPromptCacheAvailable(options) {
	return getPromptCacheAvailability(options).available;
}

/**
 * 缓存不可用时的短文案（模型栏旁注）
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableLabel(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
			return '缓存不可用 · 当前为 Chat Completions';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '缓存不可用 · 代理无 Messages 端点';
		case CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL:
			return '缓存不可用 · Gemini 通道不支持';
		default:
			return '缓存不可用';
	}
}

/**
 * 缓存不可用时的详细说明（tooltip）
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableTooltip(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
			return '提示词缓存仅在 Anthropic Messages 格式下可用。可在设置中将 API 格式改为「自动」或「Anthropic Messages」，并选用 Claude 模型。';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '后端代理只暴露 Chat Completions 端点，无 /v1/messages，无法使用提示词缓存。';
		case CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL:
			return '当前为 Gemini 原生通道，不支持 Anthropic 风格的提示词缓存。';
		default:
			return '当前条件下提示词缓存不可用。';
	}
}

/**
 * 去掉消息上的手动缓存断点（缓存不可用时发送前剥离，避免仍注入 cache_control）
 * @param {Array} messages
 * @returns {Array}
 */
export function stripCacheBreakpoints(messages) {
	if (!Array.isArray(messages)) return messages;
	return messages.map((m) => {
		if (!m || m.cacheBreakpoint == null) return m;
		const next = { ...m };
		delete next.cacheBreakpoint;
		return next;
	});
}
