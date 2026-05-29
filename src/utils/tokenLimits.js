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
