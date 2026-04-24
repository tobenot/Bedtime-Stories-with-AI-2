/**
 * 全局状态管理
 * 提供跨插件的状态共享能力
 * 
 * Phase 1B: activePresetId 是 API 配置的唯一事实源。
 * provider / apiUrl / useBackendProxy 等均由 preset 派生，不再独立持久化为主事实源。
 * 此文件保留全局偏好（temperature / maxTokens 等）和 UI 状态。
 */

import { reactive, readonly } from 'vue';

const state = reactive({
	// Phase 1B: Preset 驱动 —— 这些字段由 applyCurrentPreset() 运行时赋值
	// 此处仅提供初始占位，不再从 localStorage 读默认值（避免与 AppCore.data() 重复）
	activePresetId: localStorage.getItem('bs2_active_preset_id') || '',
	provider: 'gemini',    // 将由 preset.protocol 派生
	model: '',             // 将由 selectedModelByPresetId 派生
	apiKey: '',            // 将由 preset + keyManager 派生
	apiUrl: '',            // 将由 preset.baseUrl 派生
	useBackendProxy: false, // 将由 preset.authMode === 'password' 派生

	// 全局偏好（不随 preset 切换而变化）
	temperature: parseFloat(localStorage.getItem('bs2_temperature') || '1.0'),
	maxTokens: parseInt(localStorage.getItem('bs2_max_tokens') || '16384', 10),
	geminiReasoningEffort: localStorage.getItem('bs2_gemini_reasoning_effort') || 'medium',
	featurePassword: localStorage.getItem('bs2_feature_password') || '',

	// 后端代理 URL（Phase 1B 过渡期保留，将迁移到代理预设的 baseUrl）
	backendUrlDeepseek: localStorage.getItem('bs2_backend_url_deepseek') || '/api/deepseek/stream',
	backendUrlGemini: localStorage.getItem('bs2_backend_url_gemini') || '/api/gemini/stream',

	// UI状态
	showSidebar: typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
	isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
	
	// 当前激活的插件
	activeMode: localStorage.getItem('bs2_active_mode') || 'standard-chat',
	
	// 通用设置
	defaultHideReasoning: JSON.parse(localStorage.getItem('bs2_default_hide_reasoning') || 'false'),
	autoCollapseReasoning: JSON.parse(localStorage.getItem('bs2_auto_collapse_reasoning') || 'true'),
});

/**
 * 更新状态并持久化
 */
export function updateState(key, value) {
	state[key] = value;
	
	// 自动持久化到localStorage（仅全局偏好和UI状态）
	const persistKeys = [
		'temperature', 'maxTokens',
		'backendUrlDeepseek', 'backendUrlGemini',
		'featurePassword', 'geminiReasoningEffort', 'activeMode',
		'defaultHideReasoning', 'autoCollapseReasoning'
	];
	
	if (persistKeys.includes(key)) {
		const storageKey = `bs2_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
		const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
		localStorage.setItem(storageKey, valueToStore);
	}

	// activePresetId 使用专用 key
	if (key === 'activePresetId') {
		localStorage.setItem('bs2_active_preset_id', value);
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
