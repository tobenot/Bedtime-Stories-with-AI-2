/**
 * Preset 注册表入口
 * 
 * 提供对内置预设的查询、按 URL 匹配、模型列表派生等能力。
 * Phase 1B: activePresetId 成为唯一事实源。
 */

import { BUILTIN_PRESETS } from './builtin.js';

// ── 自定义预设存储 ──

const CUSTOM_PRESETS_KEY = 'bs2_custom_presets';

function loadCustomPresets() {
	try {
		const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveCustomPresets(presets) {
	localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

// ── 查询 ──

/**
 * 获取所有内置预设（只读副本）
 */
export function getAllBuiltinPresets() {
	return BUILTIN_PRESETS;
}

/**
 * 获取所有预设（内置 + 自定义）
 */
export function getAllPresets() {
	return [...BUILTIN_PRESETS, ...loadCustomPresets()];
}

/**
 * 根据 id 查找预设（内置 + 自定义）
 */
export function getPresetById(id) {
	return BUILTIN_PRESETS.find(p => p.id === id)
		|| loadCustomPresets().find(p => p.id === id)
		|| null;
}

// ── URL 匹配（供迁移和兼容层使用） ──

/**
 * URL 关键词 → presetId 映射表
 * 使用 includes() 模糊匹配，与现有 getProviderByApiUrl 的策略保持一致
 */
const URL_TO_PRESET_MAP = [
	{ keyword: 'api.siliconflow.cn',                   presetId: 'builtin_siliconflow' },
	{ keyword: 'api.deepseek.com',                     presetId: 'builtin_deepseek' },
	{ keyword: 'ark.cn-beijing.volces.com',            presetId: 'builtin_volces' },
	{ keyword: 'openrouter.ai',                        presetId: 'builtin_openrouter' },
	{ keyword: 'api.lmrouter.com',                     presetId: 'builtin_lmrouter' },
	{ keyword: 'generativelanguage.googleapis.com',    presetId: 'builtin_gemini' },
];

/**
 * 根据旧 URL 模糊匹配到内置预设
 * @returns {Object|null} 匹配到的预设对象，或 null
 */
export function matchPresetByUrl(apiUrl) {
	if (!apiUrl) return null;
	const u = String(apiUrl).toLowerCase();
	for (const { keyword, presetId } of URL_TO_PRESET_MAP) {
		if (u.includes(keyword)) {
			return getPresetById(presetId);
		}
	}
	return null;
}

// ── Phase 1B: 迁移辅助 ──

/**
 * 根据旧配置推断应该使用哪个 presetId
 * 
 * @param {Object} oldConfig - 旧配置
 * @param {string} oldConfig.provider - 旧的 provider ('gemini' | 'openai_compatible')
 * @param {boolean} oldConfig.useBackendProxy - 是否使用后端代理
 * @param {string} oldConfig.apiUrl - 旧的 apiUrl
 * @returns {string} presetId
 */
export function resolvePresetIdFromOldConfig({ provider, useBackendProxy, apiUrl }) {
	// 后端代理模式 → 对应代理预设
	if (useBackendProxy) {
		return provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
	}

	// Gemini 直连
	if (provider === 'gemini') {
		return 'builtin_gemini';
	}

	// OpenAI 兼容直连 → 按 URL 匹配
	const matched = matchPresetByUrl(apiUrl);
	if (matched && matched.protocol === 'openai') {
		return matched.id;
	}

	// 未知 URL → 创建迁移用自定义预设
	const migratedId = 'migrated_' + Date.now();
	const normalizedUrl = String(apiUrl || '').replace(/\/chat\/completions\/?$/, '').replace(/\/models\/?$/, '').replace(/\/$/, '');
	const customPreset = {
		id: migratedId,
		label: '迁移预设 (' + (normalizedUrl || '未知') + ')',
		protocol: 'openai',
		baseUrl: normalizedUrl || 'https://api.siliconflow.cn/v1',
		models: [],
		isBuiltin: false,
		authMode: 'apiKey',
	};
	const customs = loadCustomPresets();
	customs.push(customPreset);
	saveCustomPresets(customs);
	return migratedId;
}

// ── 派生：apiUrlOptions（供 Phase 1B 向后兼容） ──

/**
 * 从内置预设生成 apiUrlOptions 数组
 * 只包含直连预设（authMode !== 'password'），格式与旧 AppCore.data().apiUrlOptions 兼容
 * 
 * @param {string} [provider] - 可选，传入 'gemini' 或 'openai_compatible' 来过滤
 *   - 'gemini'             → 只返回 protocol === 'gemini' 的预设
 *   - 'openai_compatible'  → 只返回 protocol === 'openai' 的预设
 *   - 不传 / 其他          → 返回全部直连预设
 * 
 * 注意：value 使用 baseUrl（不含 /chat/completions），
 * 运行时由 ensureCompletionsEndpoint() 在请求发送前拼接端点。
 */
export function deriveApiUrlOptions(provider) {
	let presets = BUILTIN_PRESETS.filter(p => p.authMode !== 'password');

	if (provider === 'gemini') {
		presets = presets.filter(p => p.protocol === 'gemini');
	} else if (provider === 'openai_compatible') {
		presets = presets.filter(p => p.protocol === 'openai');
	}

	return presets.map(p => ({
		label: p.label,
		value: p.baseUrl
	}));
}

// ── 派生：模型列表 ──

/**
 * Phase 1B: 根据 presetId 直接获取模型列表
 */
export function listModelsForPreset(presetId) {
	const preset = getPresetById(presetId);
	return preset ? [...preset.models] : [];
}

/**
 * 根据当前配置状态，从 preset 数据表中获取模型列表
 * 
 * Phase 1A 兼容签名: provider + useBackendProxy + apiUrl
 * Phase 1B 推荐使用 listModelsForPreset(presetId)
 */
export function listModelsFromPresets(provider, useBackendProxy = false, apiUrl = '') {
	// 后端代理模式
	if (useBackendProxy) {
		if (provider === 'gemini') {
			const proxy = getPresetById('builtin_backend_gemini');
			return proxy ? [...proxy.models] : [];
		}
		const proxy = getPresetById('builtin_backend_openai');
		return proxy ? [...proxy.models] : [];
	}

	// 直连 Gemini
	if (provider === 'gemini') {
		const gemini = getPresetById('builtin_gemini');
		return gemini ? [...gemini.models] : [];
	}

	// 直连 OpenAI 兼容 —— 按 URL 匹配
	const u = String(apiUrl || '').toLowerCase();
	const matched = matchPresetByUrl(u);
	if (matched && matched.protocol === 'openai') {
		return [...matched.models];
	}

	// 未知 URL，返回空数组（允许用户手动输入）
	return [];
}

// ── selectedModelByPresetId 管理 ──

const SELECTED_MODEL_KEY = 'bs2_selected_model_by_preset_id';

export function loadSelectedModelByPresetId() {
	try {
		const raw = localStorage.getItem(SELECTED_MODEL_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export function saveSelectedModelForPreset(presetId, model) {
	const map = loadSelectedModelByPresetId();
	map[presetId] = model;
	localStorage.setItem(SELECTED_MODEL_KEY, JSON.stringify(map));
}

export function getSelectedModelForPreset(presetId) {
	const map = loadSelectedModelByPresetId();
	if (map[presetId]) return map[presetId];
	// fallback: preset 的第一个模型
	const preset = getPresetById(presetId);
	return preset?.models?.[0] || '';
}

// ── activePresetId 管理 ──

const ACTIVE_PRESET_KEY = 'bs2_active_preset_id';

export function loadActivePresetId() {
	return localStorage.getItem(ACTIVE_PRESET_KEY) || '';
}

export function saveActivePresetId(id) {
	localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

// ── 重新导出 ──

export { BUILTIN_PRESETS };
