/**
 * 全局状态管理
 * 提供跨插件的状态共享能力
 * 
 * Phase 2: activePresetId 是 API 配置的唯一事实源。
 * provider / apiUrl / isBackendProxy 均由 preset 派生。
 * useBackendProxy / backendUrlDeepseek / backendUrlGemini 已移除。
 * 此文件保留全局偏好（temperature / maxTokens 等）和 UI 状态。
 */

import { reactive, readonly } from 'vue';
import { safeGetLocalStorage, safeParseJson, safeSetLocalStorage } from '@/utils/localStorageSafe.js';

const state = reactive({

	// Phase 2: Preset 驱动 —— 这些字段由 applyCurrentPreset() 运行时赋值
	activePresetId: safeGetLocalStorage('bs2_active_preset_id', '') || '',

	provider: 'gemini',     // 由 preset.protocol 派生
	model: '',              // 由 selectedModelByPresetId 派生
	apiKey: '',             // 由 preset + keyManager 派生
	apiUrl: '',             // 由 preset.baseUrl 派生
	isBackendProxy: false,  // 由 preset.authMode === 'password' 派生

	// 全局偏好（不随 preset 切换而变化）
	temperature: parseFloat(safeGetLocalStorage('bs2_temperature', '1.0') || '1.0'),
	maxTokens: parseInt(safeGetLocalStorage('bs2_max_tokens', '16384') || '16384', 10),
	geminiReasoningEffort: safeGetLocalStorage('bs2_gemini_reasoning_effort', 'medium') || 'medium',
	featurePassword: safeGetLocalStorage('bs2_feature_password', '') || '',


	// UI状态
	showSidebar: typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
	isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
	
	// 当前激活的插件
	activeMode: safeGetLocalStorage('bs2_active_mode', 'standard-chat') || 'standard-chat',

	
	// 通用设置
	defaultHideReasoning: safeParseJson(safeGetLocalStorage('bs2_default_hide_reasoning', 'false'), false),
	autoCollapseReasoning: safeParseJson(safeGetLocalStorage('bs2_auto_collapse_reasoning', 'true'), true),

});

/**
 * 更新状态并持久化
 */
export function updateState(key, value) {
	state[key] = value;
	
	// 自动持久化到localStorage（仅全局偏好和UI状态）
	const persistKeys = [
		'temperature', 'maxTokens',
		'featurePassword', 'geminiReasoningEffort', 'activeMode',
		'defaultHideReasoning', 'autoCollapseReasoning'
	];
	
	if (persistKeys.includes(key)) {
		const storageKey = `bs2_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
		const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
		safeSetLocalStorage(storageKey, valueToStore, key);

	}

	// activePresetId 使用专用 key
	if (key === 'activePresetId') {
		safeSetLocalStorage('bs2_active_preset_id', value, 'activePresetId');

	}
}

/**
 * 批量更新状态
 */
export function updateStates(updates) {
	Object.entries(updates).forEach(([key, value]) => {
		updateState(key, value);
	});
}

/**
 * 导出只读的state供组件使用
 */
export const globalState = readonly(state);

/**
 * 导出可写的state供需要直接修改的场景
 */
export { state as writableState };
