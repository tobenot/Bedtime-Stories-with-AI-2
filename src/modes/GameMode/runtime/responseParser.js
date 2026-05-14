function stripCodeFence(text) {
	return String(text || '')
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/```$/i, '')
		.trim();
}

function normalizeJsonLikeText(text) {
	return String(text || '')
		.replace(/[\u201C\u201D\uFF02]/g, '"')
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/\u00A0/g, ' ')
		.trim();
}

function collectBalancedJsonObjects(text) {
	const list = [];
	let start = -1;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === '\\') {
				escaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === '{') {
			if (depth === 0) start = i;
			depth += 1;
			continue;
		}
		if (char === '}') {
			if (depth <= 0) continue;
			depth -= 1;
			if (depth === 0 && start >= 0) {
				list.push(text.slice(start, i + 1));
				start = -1;
			}
		}
	}
	return list;
}

function tryParseJsonCandidate(candidate) {
	if (!candidate) return null;
	try {
		return JSON.parse(candidate);
	} catch {
		try {
			const noTrailingComma = String(candidate).replace(/,\s*([}\]])/g, '$1');
			return JSON.parse(noTrailingComma);
		} catch {
			return null;
		}
	}
}

function isGameProtocolObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	return ['phase', 'toolRequests', 'narration', 'choices', 'statePatch'].some(key => key in value);
}

function normalizeKeyValueArray(value) {
	if (!Array.isArray(value)) return value && typeof value === 'object' ? value : {};
	return value.reduce((result, item) => {
		const key = item?.key || item?.path || item?.name;
		if (key) result[key] = item.value;
		return result;
	}, {});
}

function normalizeGameResponse(parsed) {
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
	const normalized = { ...parsed };
	if (Array.isArray(normalized.toolRequests)) {
		normalized.toolRequests = normalized.toolRequests.map(request => ({
			...request,
			toolId: request?.toolId || request?.tool || '',
			reason: request?.reason || '',
			input: normalizeKeyValueArray(request?.input)
		}));
	}
	return normalized;
}

function extractNarrationFromMalformedPayload(text) {
	const normalized = normalizeJsonLikeText(stripCodeFence(text));
	const match = normalized.match(/"narration"\s*:\s*"((?:\\.|[^"\\])*)"/);
	if (!match?.[1]) return '';
	return match[1]
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\"/g, '"')
		.trim();
}

export function safeParseGameResponse(text) {
	const normalized = normalizeJsonLikeText(stripCodeFence(text));
	if (!normalized) return null;
	const candidates = collectBalancedJsonObjects(normalized);
	for (const candidate of candidates) {
		const parsed = tryParseJsonCandidate(candidate);
		if (isGameProtocolObject(parsed)) return normalizeGameResponse(parsed);
	}
	for (const candidate of candidates) {
		const parsed = tryParseJsonCandidate(candidate);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return normalizeGameResponse(parsed);
	}
	return normalizeGameResponse(tryParseJsonCandidate(normalized));
}

export function buildGameFallbackContent(text) {
	const raw = String(text || '').trim();
	if (!raw) return '主持人没有返回内容。';
	const hasProtocolToken = /tool_request|toolRequests|"phase"|“phase”|statePatch|narration/i.test(raw);
	if (!hasProtocolToken) return raw;
	const narration = extractNarrationFromMalformedPayload(raw);
	if (narration) return narration;
	return '主持人返回了格式异常的结构化数据，已拦截中间协议内容，请重试上一行动。';
}
