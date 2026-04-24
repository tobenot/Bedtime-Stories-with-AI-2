/**
 * Preset 注册表入口
 * 
 * 提供对内置预设的查询、按 URL 匹配、模型列表派生等能力。
 * Phase 1A 阶段仅做数据集中化，不改变状态事实源。
 */

import { BUILTIN_PRESETS } from './builtin.js';

// ── 查询 ──

/**
 * 获取所有内置预设（只读副本）
 */
export function getAllBuiltinPresets() {
	return BUILTIN_PRESETS;
}

/**
 * 根据 id 查找内置预设
 */
export function getPresetById(id) {
	return BUILTIN_PRESETS.find(p => p.id === id) || null;
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

// ── 派生：apiUrlOptions（供 Phase 1A 向后兼容） ──

/**
 * 从内置预设生成 apiUrlOptions 数组
 * 只包含直连预设（authMode !== 'password'），格式与旧 AppCore.data().apiUrlOptions 兼容
 * 
 * 注意：value 使用 baseUrl（不含 /chat/completions），
 * 运行时由 ensureCompletionsEndpoint() 在请求发送前拼接端点。
 */
export function deriveApiUrlOptions() {
	return BUILTIN_PRESETS
		.filter(p => p.authMode !== 'password')
		.map(p => ({
			label: p.label,
			value: p.baseUrl
		}));
}

// ── 派生：模型列表（供 Phase 1A 向后兼容） ──

/**
 * 根据当前配置状态，从 preset 数据表中获取模型列表
 * 
 * Phase 1A 仍然使用 provider + useBackendProxy + apiUrl 三参数签名，
 * 以保持与 configMethods.updateModels() 的调用兼容。
 * 
 * Phase 1B 将改为 listModelsForPreset(currentPreset) 单参数签名。
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

// ── 重新导出 ──

export { BUILTIN_PRESETS };
