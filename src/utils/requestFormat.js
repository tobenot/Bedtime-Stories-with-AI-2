/**
 * 请求格式与 Prompt Cache 可用性
 *
 * requestFormat 是 OpenAI 兼容底座上的二次路由，与 preset.protocol（openai|gemini）分开。
 * 可选：auto | chat_completions | anthropic_messages | responses
 */

export const REQUEST_FORMAT = {
	AUTO: 'auto',
	CHAT_COMPLETIONS: 'chat_completions',
	ANTHROPIC_MESSAGES: 'anthropic_messages',
	RESPONSES: 'responses'
};

export const CACHE_UNAVAILABLE_REASON = {
	/** Claude 等非自动缓存模型：强制 Chat Completions 时无法用手动 cache_control */
	FORMAT_CHAT_COMPLETIONS: 'format_chat_completions',
	FORMAT_RESPONSES: 'format_responses',
	BACKEND_PROXY: 'backend_proxy',
	GEMINI_PROTOCOL: 'gemini_protocol',
	/** 非 Claude：走 Chat Completions / Gemini 等，缓存由中转自动处理，无需本开关 */
	AUTO_CACHE_ONLY: 'auto_cache_only'
};

const VALID_PREFS = new Set([
	REQUEST_FORMAT.AUTO,
	REQUEST_FORMAT.CHAT_COMPLETIONS,
	REQUEST_FORMAT.ANTHROPIC_MESSAGES,
	REQUEST_FORMAT.RESPONSES
]);

/**
 * @param {unknown} value
 * @returns {'auto'|'chat_completions'|'anthropic_messages'|'responses'}
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
 * @returns {'chat_completions'|'anthropic_messages'|'responses'|null}
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
	if (pref === REQUEST_FORMAT.RESPONSES) return REQUEST_FORMAT.RESPONSES;

	return isClaudeModel(model)
		? REQUEST_FORMAT.ANTHROPIC_MESSAGES
		: REQUEST_FORMAT.CHAT_COMPLETIONS;
}

/**
 * Prompt Cache 是否可用，及不可用原因
 * 仅 Anthropic Messages 路径开放 Anthropic 风格 cache_control。
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
			reason: CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY,
			effectiveFormat: null
		};
	}
	if (isBackendProxy) {
		return {
			available: false,
			reason: isClaudeModel(model)
				? CACHE_UNAVAILABLE_REASON.BACKEND_PROXY
				: CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY,
			effectiveFormat: REQUEST_FORMAT.CHAT_COMPLETIONS
		};
	}

	const effectiveFormat = resolveRequestFormat({
		requestFormatPref,
		model,
		isBackendProxy,
		protocol
	});

	if (effectiveFormat === REQUEST_FORMAT.ANTHROPIC_MESSAGES) {
		return {
			available: true,
			reason: null,
			effectiveFormat
		};
	}

	if (effectiveFormat === REQUEST_FORMAT.RESPONSES) {
		return {
			available: false,
			reason: CACHE_UNAVAILABLE_REASON.FORMAT_RESPONSES,
			effectiveFormat
		};
	}

	return {
		available: false,
		reason: isClaudeModel(model)
			? CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS
			: CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY,
		effectiveFormat
	};
}

export function isPromptCacheAvailable(options) {
	return getPromptCacheAvailability(options).available;
}

/**
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableLabel(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY:
			return '自动缓存';
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
			return '需 Messages';
		case CACHE_UNAVAILABLE_REASON.FORMAT_RESPONSES:
			return '需 Messages';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '无 Messages';
		case CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL:
			return '自动缓存';
		default:
			return '不可用';
	}
}

/**
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableTooltip(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY:
			return '除 Claude 外，其余模型经中转自动缓存，无需设置关/5m/1h。此开关仅用于 Claude：需在设置中选「自动」或「Anthropic Messages」，并选用 Claude 模型。';
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
			return 'Claude 的手动提示词缓存（关/5m/1h、消息金币标记）仅在 Anthropic Messages 格式下生效。可在设置中将 API 格式改为「自动」或「Anthropic Messages」。';
		case CACHE_UNAVAILABLE_REASON.FORMAT_RESPONSES:
			return 'Claude 的手动提示词缓存在 OpenAI Responses 格式下不可用；Responses 有自己的服务端缓存（与本开关无关）。';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '后端代理只暴露 Chat Completions 端点，无 /v1/messages，Claude 无法启用手动提示词缓存。其余模型仍由中转自动缓存。';
		case CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL:
			return '除 Claude 外，其余模型经中转自动缓存，无需设置关/5m/1h。此开关仅用于 Claude（Anthropic Messages 格式）。';
		default:
			return '当前条件下 Claude 手动提示词缓存不可用。';
	}
}

/**
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
