/**
 * Responses API 托管工具（BYOK 网页对话）
 *
 * 仅实现网页对话可用的工具开关；file_search / computer_use 等依赖
 * 服务端基础设施的能力在 UI 中展示为不可用，不会写入请求。
 *
 * DeepSeek Responses：仅 web_search 服务端执行（见官方兼容性表）。
 * OpenAI 官方：web_search 托管执行。
 */

export const RESPONSES_TOOL = {
	WEB_SEARCH: 'web_search',
	FILE_SEARCH: 'file_search',
	CODE_INTERPRETER: 'code_interpreter',
	COMPUTER_USE: 'computer_use'
};

/** BYOK 侧实际可开关的工具 */
export const RESPONSES_BYOK_TOOLS = [RESPONSES_TOOL.WEB_SEARCH];

/**
 * 设置页工具列表（含不可用项，用于对照说明）
 * @type {ReadonlyArray<{ type: string, label: string, byok: boolean, unavailableHint?: string }>}
 */
export const RESPONSES_TOOLS_CATALOG = Object.freeze([
	{
		type: RESPONSES_TOOL.WEB_SEARCH,
		label: '网络搜索',
		byok: true
	},
	{
		type: RESPONSES_TOOL.FILE_SEARCH,
		label: '文件搜索',
		byok: false,
		unavailableHint: '需向量库，BYOK 网页对话不支持'
	},
	{
		type: RESPONSES_TOOL.CODE_INTERPRETER,
		label: '代码解释器',
		byok: false,
		unavailableHint: '需托管沙箱，BYOK 网页对话不支持'
	},
	{
		type: RESPONSES_TOOL.COMPUTER_USE,
		label: '电脑操作',
		byok: false,
		unavailableHint: '需虚拟机，BYOK 网页对话不支持'
	}
]);

const STORAGE_KEY = 'bs2_responses_tools';

/**
 * @param {unknown} apiUrl
 * @param {unknown} [presetId]
 * @returns {boolean}
 */
export function isDeepSeekResponsesHost(apiUrl, presetId) {
	if (presetId === 'builtin_deepseek') return true;
	const u = typeof apiUrl === 'string' ? apiUrl.toLowerCase() : '';
	if (!u) return false;
	return u.includes('deepseek.com');
}

/**
 * @param {unknown} apiUrl
 * @returns {boolean}
 */
export function isOpenAiResponsesHost(apiUrl) {
	const u = typeof apiUrl === 'string' ? apiUrl.toLowerCase() : '';
	if (!u) return false;
	return u.includes('api.openai.com');
}

/**
 * 当前接入是否提供托管网络搜索
 * @param {{ apiUrl?: string, presetId?: string }} [ctx]
 * @returns {boolean}
 */
export function supportsHostedWebSearch(ctx = {}) {
	const { apiUrl = '', presetId = '' } = ctx;
	return isDeepSeekResponsesHost(apiUrl, presetId) || isOpenAiResponsesHost(apiUrl);
}

/**
 * @param {{ apiUrl?: string, presetId?: string }} [ctx]
 * @returns {Array<{
 *   type: string,
 *   label: string,
 *   available: boolean,
 *   unavailableHint: string|null
 * }>}
 */
export function listResponsesToolsForUi(ctx = {}) {
	const webSearchOk = supportsHostedWebSearch(ctx);
	return RESPONSES_TOOLS_CATALOG.map((item) => {
		if (!item.byok) {
			return {
				type: item.type,
				label: item.label,
				available: false,
				unavailableHint: item.unavailableHint || '不支持'
			};
		}
		if (item.type === RESPONSES_TOOL.WEB_SEARCH) {
			return {
				type: item.type,
				label: item.label,
				available: webSearchOk,
				unavailableHint: webSearchOk
					? null
					: '当前接入未提供托管网络搜索（DeepSeek / OpenAI 官方可用）'
			};
		}
		return {
			type: item.type,
			label: item.label,
			available: false,
			unavailableHint: '不支持'
		};
	});
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeResponsesTools(value) {
	const raw = Array.isArray(value)
		? value
		: (typeof value === 'string' ? (() => {
			try {
				return JSON.parse(value);
			} catch {
				return [];
			}
		})() : []);

	const allowed = new Set(RESPONSES_BYOK_TOOLS);
	const out = [];
	for (const item of raw) {
		const type = typeof item === 'string' ? item.trim() : '';
		if (!type || !allowed.has(type) || out.includes(type)) continue;
		out.push(type);
	}
	return out;
}

/**
 * @param {string[]} enabledTypes
 * @param {{ apiUrl?: string, presetId?: string }} [ctx]
 * @returns {string[]}
 */
export function filterEnabledResponsesTools(enabledTypes, ctx = {}) {
	const normalized = normalizeResponsesTools(enabledTypes);
	const available = new Set(
		listResponsesToolsForUi(ctx)
			.filter((t) => t.available)
			.map((t) => t.type)
	);
	return normalized.filter((t) => available.has(t));
}

/**
 * 写入 Responses 请求的 tools 数组
 * @param {string[]} enabledTypes
 * @param {{ apiUrl?: string, presetId?: string }} [ctx]
 * @returns {Array<{ type: string }>|undefined}
 */
export function buildResponsesToolsPayload(enabledTypes, ctx = {}) {
	const types = filterEnabledResponsesTools(enabledTypes, ctx);
	if (!types.length) return undefined;
	return types.map((type) => ({ type }));
}

/**
 * @returns {string[]}
 */
export function loadResponsesToolsFromStorage(getItem) {
	const read = typeof getItem === 'function'
		? getItem
		: (key) => {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		};
	return normalizeResponsesTools(read(STORAGE_KEY));
}

/**
 * @param {string[]} enabledTypes
 * @param {(key: string, value: string) => void} [setItem]
 */
export function saveResponsesToolsToStorage(enabledTypes, setItem) {
	const value = JSON.stringify(normalizeResponsesTools(enabledTypes));
	if (typeof setItem === 'function') {
		setItem(STORAGE_KEY, value);
		return;
	}
	try {
		localStorage.setItem(STORAGE_KEY, value);
	} catch {
		/* ignore */
	}
}

export { STORAGE_KEY as RESPONSES_TOOLS_STORAGE_KEY };
