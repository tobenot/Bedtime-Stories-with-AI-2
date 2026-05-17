/**
 * Preset 注册表入口
 *
 * 提供对内置预设的查询、按 URL 匹配、模型列表派生等能力。
 * Phase 1B: activePresetId 成为唯一事实源。
 * Phase 4: 预设支持能力标记（features）。
 */

import { safeGetLocalStorage, safeSetLocalStorage, safeSetJsonLocalStorage } from '@/utils/localStorageSafe.js';
import { BUILTIN_PRESETS } from './builtin.js';


const CUSTOM_PRESETS_KEY = 'bs2_custom_presets';
const SELECTED_MODEL_KEY = 'bs2_selected_model_by_preset_id';
const ACTIVE_PRESET_KEY = 'bs2_active_preset_id';
const MAX_SELECTED_MODEL_LENGTH = 1024;
const MAX_SELECTED_MODEL_BUCKETS = 64;
const MAX_PRESET_ID_LENGTH = 128;

export const DEFAULT_PRESET_FEATURES = Object.freeze({

	imageOutput: false,
	reasoning: false,
});

function getProxyOverrideStorageKey(presetId) {
	if (presetId === 'builtin_backend_openai') return 'bs2_backend_url_deepseek';
	if (presetId === 'builtin_backend_gemini') return 'bs2_backend_url_gemini';
	return '';
}

export function normalizeBaseUrl(apiUrl) {
	const raw = String(apiUrl || '').trim();
	if (!raw) return '';
	return raw
		.replace(/\/chat\/completions\/?$/, '')
		.replace(/\/models\/?$/, '')
		.replace(/\/$/, '');
}

function normalizePresetModels(models) {
	return [...new Set(
		(Array.isArray(models) ? models : [])
			.map(model => String(model || '').trim())
			.filter(Boolean)
	)];
}

function normalizeSelectedModel(model) {
	const value = String(model || '').trim();
	return value && value.length <= MAX_SELECTED_MODEL_LENGTH ? value : '';
}

function sanitizeSelectedModelMap(map) {
	if (!map || typeof map !== 'object') return {};
	const sanitized = {};
	for (const [rawPresetId, rawModel] of Object.entries(map)) {
		if (Object.keys(sanitized).length >= MAX_SELECTED_MODEL_BUCKETS) break;
		const presetId = String(rawPresetId || '').trim();
		const model = normalizeSelectedModel(rawModel);
		if (!presetId || presetId.length > MAX_PRESET_ID_LENGTH || !model) continue;
		sanitized[presetId] = model;
	}
	return sanitized;
}

function saveSelectedModelMap(map) {
	const sanitized = sanitizeSelectedModelMap(map);
	try {
		return safeSetJsonLocalStorage(SELECTED_MODEL_KEY, sanitized, '模型选择缓存');
	} catch (error) {

		console.warn('[presets] 模型选择缓存写入失败，已阻止切换流程被中断', {
			error: error?.message || String(error),
			bucketCount: Object.keys(sanitized).length
		});
		return false;
	}
}

export function normalizePresetFeatures(features = {}) {

	const raw = features && typeof features === 'object' ? features : {};
	return {
		imageOutput: Boolean(raw.imageOutput),
		reasoning: Boolean(raw.reasoning),
	};
}

function hydratePreset(preset) {
	if (!preset || typeof preset !== 'object') return null;

	return {
		...preset,
		label: preset.label || '未命名预设',
		protocol: preset.protocol === 'gemini' ? 'gemini' : 'openai',
		baseUrl: normalizeBaseUrl(preset.baseUrl),
		models: normalizePresetModels(preset.models),
		features: normalizePresetFeatures(preset.features),
		isBuiltin: Boolean(preset.isBuiltin),
		authMode: preset.authMode === 'password' ? 'password' : 'apiKey',
	};
}

function loadCustomPresets() {
	try {
		const raw = safeGetLocalStorage(CUSTOM_PRESETS_KEY, '');
		const parsed = raw ? JSON.parse(raw) : [];

		return Array.isArray(parsed)
			? parsed.map(hydratePreset).filter(Boolean)
			: [];
	} catch {
		return [];
	}
}

function saveCustomPresets(presets) {
	const normalized = (Array.isArray(presets) ? presets : [])
		.map(hydratePreset)
		.filter(Boolean);
	safeSetJsonLocalStorage(CUSTOM_PRESETS_KEY, normalized, '自定义预设');

}

export function getAllBuiltinPresets() {
	return BUILTIN_PRESETS.map(hydratePreset).filter(Boolean);
}

export function getAllPresets() {
	return [...getAllBuiltinPresets(), ...loadCustomPresets()];
}

export function getPresetById(id) {
	return getAllPresets().find(preset => preset.id === id) || null;
}

export function getPresetFeatures(presetOrId) {
	const preset = typeof presetOrId === 'string' ? getPresetById(presetOrId) : hydratePreset(presetOrId);
	return preset?.features || { ...DEFAULT_PRESET_FEATURES };
}

const URL_TO_PRESET_MAP = [
	{ keyword: 'api.siliconflow.cn', presetId: 'builtin_siliconflow' },
	{ keyword: 'api.deepseek.com', presetId: 'builtin_deepseek' },
	{ keyword: 'ark.cn-beijing.volces.com', presetId: 'builtin_volces' },
	{ keyword: 'openrouter.ai', presetId: 'builtin_openrouter' },
	{ keyword: 'api.lmrouter.com', presetId: 'builtin_lmrouter' },
	{ keyword: 'api.laozhang.ai', presetId: 'builtin_laozhang' },
	{ keyword: 'aihubmix.com', presetId: 'builtin_aihubmix' },
	{ keyword: 'generativelanguage.googleapis.com', presetId: 'builtin_gemini' },
];

export function matchPresetByUrl(apiUrl) {
	const normalizedUrl = normalizeBaseUrl(apiUrl).toLowerCase();
	if (!normalizedUrl) return null;

	for (const { keyword, presetId } of URL_TO_PRESET_MAP) {
		if (normalizedUrl.includes(keyword)) {
			return getPresetById(presetId);
		}
	}
	return null;
}

export function findCustomPresetByBaseUrl(baseUrl, protocol = 'openai') {
	const normalizedUrl = normalizeBaseUrl(baseUrl);
	if (!normalizedUrl) return null;

	return loadCustomPresets().find(preset => (
		preset.protocol === protocol && normalizeBaseUrl(preset.baseUrl) === normalizedUrl
	)) || null;
}

function buildCustomPreset({ baseUrl, protocol = 'openai', label, models = [], features = {} } = {}) {
	const normalizedUrl = normalizeBaseUrl(baseUrl);
	if (!normalizedUrl) return null;

	const now = new Date().toISOString();
	return hydratePreset({
		id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		label: label || `自定义预设 (${normalizedUrl})`,
		protocol,
		baseUrl: normalizedUrl,
		models,
		features,
		isBuiltin: false,
		authMode: 'apiKey',
		createdAt: now,
		updatedAt: now,
	});
}

export function createCustomPreset({ baseUrl, protocol = 'openai', label, models = [], features = {} } = {}) {
	const customPreset = buildCustomPreset({ baseUrl, protocol, label, models, features });
	if (!customPreset) return null;

	const customs = loadCustomPresets();
	customs.push(customPreset);
	saveCustomPresets(customs);
	return customPreset;
}

export function upsertCustomPreset({ baseUrl, protocol = 'openai', label, models = [], features = {} } = {}) {
	const normalizedUrl = normalizeBaseUrl(baseUrl);
	if (!normalizedUrl) return null;

	const existing = findCustomPresetByBaseUrl(normalizedUrl, protocol);
	if (existing) {
		return existing;
	}

	const customPreset = buildCustomPreset({ baseUrl: normalizedUrl, protocol, label, models, features });
	if (!customPreset) return null;

	const customs = loadCustomPresets();
	customs.push(customPreset);
	saveCustomPresets(customs);
	return customPreset;
}

export function updateCustomPreset(presetId, { label, baseUrl, protocol, models, features } = {}) {
	const customs = loadCustomPresets();
	const idx = customs.findIndex(preset => preset.id === presetId);
	if (idx < 0) return null;

	const current = customs[idx];
	const nextPreset = hydratePreset({
		...current,
		label: label !== undefined ? label : current.label,
		baseUrl: baseUrl !== undefined ? (normalizeBaseUrl(baseUrl) || current.baseUrl) : current.baseUrl,
		protocol: protocol !== undefined ? protocol : current.protocol,
		models: models !== undefined ? models : current.models,
		features: features !== undefined ? features : current.features,
		updatedAt: new Date().toISOString(),
	});

	customs[idx] = nextPreset;
	saveCustomPresets(customs);
	return nextPreset;
}

export function deleteCustomPreset(presetId) {
	const customs = loadCustomPresets();
	const filtered = customs.filter(preset => preset.id !== presetId);
	saveCustomPresets(filtered);
	return filtered;
}

export function getPresetRuntimeBaseUrl(presetOrId) {
	const preset = typeof presetOrId === 'string' ? getPresetById(presetOrId) : hydratePreset(presetOrId);
	if (!preset) return '';

	const overrideKey = getProxyOverrideStorageKey(preset.id);
	if (overrideKey) {
		return normalizeBaseUrl(safeGetLocalStorage(overrideKey, '') || preset.baseUrl);
	}


	return normalizeBaseUrl(preset.baseUrl);
}

export function saveEditablePresetBaseUrl(presetId, baseUrl) {
	const preset = getPresetById(presetId);
	if (!preset) return '';

	const normalizedUrl = normalizeBaseUrl(baseUrl) || normalizeBaseUrl(preset.baseUrl);
	const overrideKey = getProxyOverrideStorageKey(preset.id);
	if (overrideKey) {
		safeSetLocalStorage(overrideKey, normalizedUrl, '代理预设地址');
		return normalizedUrl;
	}


	if (preset.isBuiltin) {
		return normalizedUrl;
	}

	const customs = loadCustomPresets();
	const targetIndex = customs.findIndex(item => item.id === presetId);
	if (targetIndex >= 0) {
		customs[targetIndex] = hydratePreset({
			...customs[targetIndex],
			baseUrl: normalizedUrl,
			updatedAt: new Date().toISOString(),
		});
		saveCustomPresets(customs);
	}

	return normalizedUrl;
}

export function resolvePresetIdFromOldConfig({ provider, useBackendProxy, apiUrl }) {
	if (useBackendProxy) {
		return provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
	}

	if (provider === 'gemini') {
		return 'builtin_gemini';
	}

	const matched = matchPresetByUrl(apiUrl);
	if (matched && matched.protocol === 'openai') {
		return matched.id;
	}

	const customPreset = upsertCustomPreset({
		baseUrl: apiUrl,
		label: `迁移预设 (${normalizeBaseUrl(apiUrl) || '未知'})`,
	});
	return customPreset?.id || 'builtin_siliconflow';
}

export function deriveApiUrlOptions(provider) {
	let presets = getAllPresets().filter(preset => preset.authMode !== 'password');

	if (provider === 'gemini') {
		presets = presets.filter(preset => preset.protocol === 'gemini');
	} else if (provider === 'openai_compatible') {
		presets = presets.filter(preset => preset.protocol === 'openai');
	}

	return presets.map(preset => ({
		label: preset.label,
		value: getPresetRuntimeBaseUrl(preset)
	}));
}

export function listModelsForPreset(presetId) {
	const preset = getPresetById(presetId);
	return preset ? [...preset.models] : [];
}

export function listModelsFromPresets(provider, useBackendProxy = false, apiUrl = '') {
	if (useBackendProxy) {
		if (provider === 'gemini') {
			const proxyPreset = getPresetById('builtin_backend_gemini');
			return proxyPreset ? [...proxyPreset.models] : [];
		}
		const proxyPreset = getPresetById('builtin_backend_openai');
		return proxyPreset ? [...proxyPreset.models] : [];
	}

	if (provider === 'gemini') {
		const geminiPreset = getPresetById('builtin_gemini');
		return geminiPreset ? [...geminiPreset.models] : [];
	}

	const matched = matchPresetByUrl(apiUrl);
	if (matched && matched.protocol === 'openai') {
		return [...matched.models];
	}

	return [];
}

export function loadSelectedModelByPresetId() {
	try {
		const raw = safeGetLocalStorage(SELECTED_MODEL_KEY, '');

		return raw ? sanitizeSelectedModelMap(JSON.parse(raw)) : {};
	} catch {
		return {};
	}
}

export function saveSelectedModelForPreset(presetId, model) {
	const id = String(presetId || '').trim();
	if (!id || id.length > MAX_PRESET_ID_LENGTH) return false;
	const map = loadSelectedModelByPresetId();
	const selectedModel = normalizeSelectedModel(model);
	if (selectedModel) {
		if (map[id] === selectedModel) return true;
		map[id] = selectedModel;
	} else {
		if (!Object.prototype.hasOwnProperty.call(map, id)) return true;
		delete map[id];
	}
	return saveSelectedModelMap(map);
}

export function deleteSelectedModelForPreset(presetId) {
	const id = String(presetId || '').trim();
	const map = loadSelectedModelByPresetId();
	if (!Object.prototype.hasOwnProperty.call(map, id)) return true;
	delete map[id];
	return saveSelectedModelMap(map);
}

export function getSelectedModelForPreset(presetId) {
	const map = loadSelectedModelByPresetId();
	const selectedModel = normalizeSelectedModel(map[presetId]);
	if (selectedModel) return selectedModel;
	const preset = getPresetById(presetId);
	return normalizeSelectedModel(preset?.models?.[0]) || '';
}

export function loadActivePresetId() {
	return safeGetLocalStorage(ACTIVE_PRESET_KEY, '') || '';
}


export function saveActivePresetId(id) {
	return safeSetLocalStorage(ACTIVE_PRESET_KEY, id, '当前预设');

}


export { BUILTIN_PRESETS };
