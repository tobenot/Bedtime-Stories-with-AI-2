/**
 * Preset 注册表入口
 * 
 * 提供对内置预设的查询、按 URL 匹配、模型列表派生等能力。
 * Phase 1B: activePresetId 成为唯一事实源。
 */

import { BUILTIN_PRESETS } from './builtin.js';

const CUSTOM_PRESETS_KEY = 'bs2_custom_presets';
const SELECTED_MODEL_KEY = 'bs2_selected_model_by_preset_id';
const ACTIVE_PRESET_KEY = 'bs2_active_preset_id';

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

export function getAllBuiltinPresets() {
	return BUILTIN_PRESETS;
}

export function getAllPresets() {
	return [...BUILTIN_PRESETS, ...loadCustomPresets()];
}

export function getPresetById(id) {
	return BUILTIN_PRESETS.find(p => p.id === id)
		|| loadCustomPresets().find(p => p.id === id)
		|| null;
}

const URL_TO_PRESET_MAP = [
	{ keyword: 'api.siliconflow.cn', presetId: 'builtin_siliconflow' },
	{ keyword: 'api.deepseek.com', presetId: 'builtin_deepseek' },
	{ keyword: 'ark.cn-beijing.volces.com', presetId: 'builtin_volces' },
	{ keyword: 'openrouter.ai', presetId: 'builtin_openrouter' },
	{ keyword: 'api.lmrouter.com', presetId: 'builtin_lmrouter' },
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

	return loadCustomPresets().find(p => (
		p.protocol === protocol && normalizeBaseUrl(p.baseUrl) === normalizedUrl
	)) || null;
}

export function upsertCustomPreset({ baseUrl, protocol = 'openai', label } = {}) {
	const normalizedUrl = normalizeBaseUrl(baseUrl);
	if (!normalizedUrl) return null;

	const existing = findCustomPresetByBaseUrl(normalizedUrl, protocol);
	if (existing) {
		return existing;
	}

	const customPreset = {
		id: `custom_${Date.now()}`,
		label: label || `自定义预设 (${normalizedUrl})`,
		protocol,
		baseUrl: normalizedUrl,
		models: [],
		isBuiltin: false,
		authMode: 'apiKey',
	};

	const customs = loadCustomPresets();
	customs.push(customPreset);
	saveCustomPresets(customs);
	return customPreset;
}

export function updateCustomPreset(presetId, { label, baseUrl, protocol } = {}) {
	const customs = loadCustomPresets();
	const idx = customs.findIndex(p => p.id === presetId);
	if (idx < 0) return null;

	if (label !== undefined) customs[idx].label = label;
	if (baseUrl !== undefined) customs[idx].baseUrl = normalizeBaseUrl(baseUrl) || customs[idx].baseUrl;
	if (protocol !== undefined) customs[idx].protocol = protocol;

	saveCustomPresets(customs);
	return customs[idx];
}

export function deleteCustomPreset(presetId) {
	const customs = loadCustomPresets();
	const filtered = customs.filter(p => p.id !== presetId);
	saveCustomPresets(filtered);
	return filtered;
}

export function getPresetRuntimeBaseUrl(presetOrId) {
	const preset = typeof presetOrId === 'string' ? getPresetById(presetOrId) : presetOrId;
	if (!preset) return '';

	const overrideKey = getProxyOverrideStorageKey(preset.id);
	if (overrideKey) {
		return normalizeBaseUrl(localStorage.getItem(overrideKey) || preset.baseUrl);
	}

	return normalizeBaseUrl(preset.baseUrl);
}

export function saveEditablePresetBaseUrl(presetId, baseUrl) {
	const preset = getPresetById(presetId);
	if (!preset) return '';

	const normalizedUrl = normalizeBaseUrl(baseUrl) || normalizeBaseUrl(preset.baseUrl);
	const overrideKey = getProxyOverrideStorageKey(preset.id);
	if (overrideKey) {
		localStorage.setItem(overrideKey, normalizedUrl);
		return normalizedUrl;
	}

	if (preset.isBuiltin) {
		return normalizedUrl;
	}

	const customs = loadCustomPresets();
	const targetIndex = customs.findIndex(item => item.id === presetId);
	if (targetIndex >= 0) {
		customs[targetIndex] = {
			...customs[targetIndex],
			baseUrl: normalizedUrl,
		};
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
	let presets = getAllPresets().filter(p => p.authMode !== 'password');

	if (provider === 'gemini') {
		presets = presets.filter(p => p.protocol === 'gemini');
	} else if (provider === 'openai_compatible') {
		presets = presets.filter(p => p.protocol === 'openai');
	}

	return presets.map(p => ({
		label: p.label,
		value: getPresetRuntimeBaseUrl(p)
	}));
}

export function listModelsForPreset(presetId) {
	const preset = getPresetById(presetId);
	return preset ? [...preset.models] : [];
}

export function listModelsFromPresets(provider, useBackendProxy = false, apiUrl = '') {
	if (useBackendProxy) {
		if (provider === 'gemini') {
			const proxy = getPresetById('builtin_backend_gemini');
			return proxy ? [...proxy.models] : [];
		}
		const proxy = getPresetById('builtin_backend_openai');
		return proxy ? [...proxy.models] : [];
	}

	if (provider === 'gemini') {
		const gemini = getPresetById('builtin_gemini');
		return gemini ? [...gemini.models] : [];
	}

	const matched = matchPresetByUrl(apiUrl);
	if (matched && matched.protocol === 'openai') {
		return [...matched.models];
	}

	return [];
}

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
	const preset = getPresetById(presetId);
	return preset?.models?.[0] || '';
}

export function loadActivePresetId() {
	return localStorage.getItem(ACTIVE_PRESET_KEY) || '';
}

export function saveActivePresetId(id) {
	localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

export { BUILTIN_PRESETS };
