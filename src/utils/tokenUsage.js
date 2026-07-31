/**
 * 把各家 API 的 usage 归一成 UI 用结构。
 * @typedef {{ inputTokens: number, outputTokens: number, cacheReadTokens: number, totalTokens: number, source: 'anthropic' | 'openai' }} NormalizedUsage
 */

function toNonNegInt(value) {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.round(n);
}

/**
 * Claude / Anthropic Messages API
 * 总输入 = input_tokens + cache_read + cache_creation（input_tokens 不含缓存）
 * @param {object|null|undefined} usage
 * @returns {NormalizedUsage|null}
 */
export function normalizeAnthropicUsage(usage) {
	if (!usage || typeof usage !== 'object') return null;
	const cacheReadTokens = toNonNegInt(usage.cache_read_input_tokens);
	const cacheWriteTokens = toNonNegInt(usage.cache_creation_input_tokens);
	const uncachedInput = toNonNegInt(usage.input_tokens);
	const outputTokens = toNonNegInt(usage.output_tokens);
	const inputTokens = uncachedInput + cacheReadTokens + cacheWriteTokens;
	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		totalTokens: inputTokens + outputTokens,
		source: 'anthropic'
	};
}

/**
 * OpenAI Chat Completions（及兼容端）
 * prompt_tokens 已含 cached_tokens
 * @param {object|null|undefined} usage
 * @returns {NormalizedUsage|null}
 */
export function normalizeOpenAiUsage(usage) {
	if (!usage || typeof usage !== 'object') return null;
	const inputTokens = toNonNegInt(usage.prompt_tokens ?? usage.input_tokens);
	const outputTokens = toNonNegInt(usage.completion_tokens ?? usage.output_tokens);
	const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
	const cacheReadTokens = toNonNegInt(details.cached_tokens);
	const totalTokens = toNonNegInt(usage.total_tokens) || inputTokens + outputTokens;
	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		totalTokens,
		source: 'openai'
	};
}
