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

/** 是否在 UI 展示手动缓存控件（非 Claude 自动缓存时不展示） */
export function shouldShowPromptCacheControls(reason) {
	if (!reason) return true;
	return reason !== CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY;
}

/**
 * 下拉/旁注等一行说明（plain language）
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableSummary(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
		case CACHE_UNAVAILABLE_REASON.FORMAT_RESPONSES:
			return '请在设置中切换 API 格式';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '当前代理不支持';
		default:
			return '当前不可用';
	}
}

/**
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableLabel(reason) {
	return getCacheUnavailableSummary(reason);
}

/**
 * @param {string|null} reason
 * @returns {string}
 */
export function getCacheUnavailableTooltip(reason) {
	switch (reason) {
		case CACHE_UNAVAILABLE_REASON.AUTO_CACHE_ONLY:
			return '当前模型无需手动设置，缓存由服务自动处理。顶部「关/5m/1h」仅 Claude 可用。';
		case CACHE_UNAVAILABLE_REASON.FORMAT_CHAT_COMPLETIONS:
			return '此开关仅 Claude 可用。请在设置 → API 格式 中选择「自动」或「Anthropic Messages」。';
		case CACHE_UNAVAILABLE_REASON.FORMAT_RESPONSES:
			return '此开关仅 Claude 可用。当前为 Responses 格式，请在设置中改回「自动」或「Anthropic Messages」。';
		case CACHE_UNAVAILABLE_REASON.BACKEND_PROXY:
			return '当前后端代理不支持 Claude 手动缓存，其余模型仍会自动缓存。';
		case CACHE_UNAVAILABLE_REASON.GEMINI_PROTOCOL:
			return '当前模型无需手动设置，缓存由服务自动处理。';
		default:
			return '当前无法使用手动缓存设置。';
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
