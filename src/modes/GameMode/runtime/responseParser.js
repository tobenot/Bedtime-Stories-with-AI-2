function stripCodeFence(text) {
	return String(text || '')
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/```$/i, '')
		.trim();
}

/**
 * 智能归一化 JSON 结构位置的中文引号，不破坏字符串值内的中文对话引号。
 *
 * 策略：只替换"看起来像 JSON 结构定界符"位置的中文引号：
 *   - 紧邻 { } [ ] , : 的引号（键名 / 键值定界）
 *   - 不替换两个英文双引号之间的中文引号（那是字符串内容）
 *
 * 如果智能归一化失败（仍然无法解析），才退化为全局替换。
 */
function smartNormalizeQuotes(text) {
	// 匹配 JSON 结构位置的中文引号：
	//   (?<=[{}\[\],:]\s*)  前面是结构字符
	//   (?=\s*[{}\[\],:])   后面是结构字符
	//   (?<=^\s*)            行首（顶层键）
	return String(text || '')
		.replace(/\u00A0/g, ' ')
		// 键名左引号：结构符或行首后紧跟中文引号再跟英文字母/下划线（JSON key 的典型开头）
		.replace(/(^|[{,\[\]:\s])\s*([\u201C\u201D\uFF02])\s*([a-zA-Z_])/gm, (_, pre, _q, after) => `${pre}"${after}`)
		// 键名右引号：英文字母/数字后紧跟中文引号再跟结构符
		.replace(/([a-zA-Z0-9_])\s*([\u201C\u201D\uFF02])\s*(?=\s*[:,}\]\[])/g, (_, pre) => `${pre}"`)
		// 字符串值定界引号：冒号后面的左引号
		.replace(/(:)\s*([\u201C\u201D\uFF02])/g, '$1"')
		// 字符串值结束引号：引号后紧跟逗号/}/] 且前面不是反斜杠
		.replace(/([^\\])([\u201C\u201D\uFF02])\s*(?=[,}\]])/g, '$1"')
		.trim();
}

function bruteForceNormalizeQuotes(text) {
	return String(text || '')
		.replace(/[\u201C\u201D\uFF02]/g, '"')
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/\u00A0/g, ' ')
		.trim();
}

function normalizeJsonLikeText(text) {
	const smart = smartNormalizeQuotes(text);
	const parsed = tryParseJsonCandidate(smart);
	if (parsed) return smart;
	return bruteForceNormalizeQuotes(text);
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
	const stripped = stripCodeFence(text);
	// 同时匹配 "narration" / \u201Cnarration\u201D / \uFF02narration\uFF02 等键名写法
	const keyPattern = /[""\uFF02]narration[""\uFF02]\s*:\s*[""\uFF02]/;
	const keyMatch = keyPattern.exec(stripped);
	if (!keyMatch) return '';
	const valueStart = keyMatch.index + keyMatch[0].length;
	// 从值开始位置手动找到未转义的结束引号（英文或中文）
	let escaped = false;
	let end = -1;
	for (let i = valueStart; i < stripped.length; i += 1) {
		const ch = stripped[i];
		if (escaped) { escaped = false; continue; }
		if (ch === '\\') { escaped = true; continue; }
		if (ch === '"' || ch === '\u201D' || ch === '\uFF02') { end = i; break; }
	}
	if (end < 0) return '';
	return stripped.slice(valueStart, end)
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\"/g, '"')
		.trim();
}

function parseGameResponseFromText(text) {
	const direct = tryParseJsonCandidate(text);
	if (isGameProtocolObject(direct)) return normalizeGameResponse(direct);
	const candidates = collectBalancedJsonObjects(text);
	for (const candidate of candidates) {
		const parsed = tryParseJsonCandidate(candidate);
		if (isGameProtocolObject(parsed)) return normalizeGameResponse(parsed);
	}
	for (const candidate of candidates) {
		const parsed = tryParseJsonCandidate(candidate);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return normalizeGameResponse(parsed);
	}
	if (direct && typeof direct === 'object' && !Array.isArray(direct)) return normalizeGameResponse(direct);
	return null;
}

export function safeParseGameResponse(text) {
	const stripped = stripCodeFence(text);
	if (!stripped) return null;

	const parsed = parseGameResponseFromText(stripped);
	if (parsed) return parsed;

	const normalized = normalizeJsonLikeText(stripped);
	if (!normalized || normalized === stripped) return null;
	return parseGameResponseFromText(normalized);
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
