export const DEFAULT_MAX_TOKENS = 16384;
export const API_MIN_MAX_TOKENS = 16;

export function normalizeMaxTokens(value, fallback = DEFAULT_MAX_TOKENS) {
	const fallbackValue = Number.isFinite(Number(fallback)) && Number(fallback) >= API_MIN_MAX_TOKENS
		? Math.floor(Number(fallback))
		: DEFAULT_MAX_TOKENS;
	const numericValue = Number(value);

	if (!Number.isFinite(numericValue) || numericValue < API_MIN_MAX_TOKENS) {
		return fallbackValue;
	}

	return Math.floor(numericValue);
}

export function getBaseModelName(model) {
	if (typeof model !== 'string' || !model) return '';
	return model.toLowerCase().split('/').pop() || '';
}

export function usesMaxCompletionTokens(model) {
	const base = getBaseModelName(model);
	if (!base) return false;
	if (/^gpt-5(?:[\-.]|$)/.test(base)) return true;
	if (/^gpt-4\.1(?:[\-.]|$)/.test(base)) return true;
	if (/^o(?:1|3|4)(?:$|[-.])/.test(base)) return true;
	return false;
}

export function buildOpenAiTokenLimitFields(model, maxTokens, fallback = DEFAULT_MAX_TOKENS) {
	const safeMaxTokens = normalizeMaxTokens(maxTokens, fallback);
	if (usesMaxCompletionTokens(model)) {
		return { max_completion_tokens: safeMaxTokens };
	}
	return { max_tokens: safeMaxTokens };
}
