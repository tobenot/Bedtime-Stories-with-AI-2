/**
 * 全局状态管理
 * 提供跨插件的状态共享能力
 */

import { reactive, readonly } from 'vue';

const state = reactive({
	// AI配置
	provider: localStorage.getItem('bs2_provider') || 'gemini',
	model: localStorage.getItem('bs2_model') || 'gemini-2.5-flash',
	apiKey: '',
	apiUrl: localStorage.getItem('bs2_api_url') || 'https://api.siliconflow.cn/v1/chat/completions',
	temperature: parseFloat(localStorage.getItem('bs2_temperature') || '1.0'),
	maxTokens: parseInt(localStorage.getItem('bs2_max_tokens') || '16384', 10),
	useBackendProxy: JSON.parse(localStorage.getItem('bs2_use_backend_proxy') || 'true'),
	backendUrlDeepseek: localStorage.getItem('bs2_backend_url_deepseek') || '/api/deepseek/stream',
	backendUrlGemini: localStorage.getItem('bs2_backend_url_gemini') || '/api/gemini/stream',
	featurePassword: localStorage.getItem('bs2_feature_password') || '',
	geminiReasoningEffort: localStorage.getItem('bs2_gemini_reasoning_effort') || 'medium',
	
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
	
	// 自动持久化到localStorage
	const persistKeys = [
		'provider', 'model', 'apiUrl', 'temperature', 'maxTokens',
		'useBackendProxy', 'backendUrlDeepseek', 'backendUrlGemini',
		'featurePassword', 'geminiReasoningEffort', 'activeMode',
		'defaultHideReasoning', 'autoCollapseReasoning'
	];
	
	if (persistKeys.includes(key)) {
		const storageKey = `bs2_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
		const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
		localStorage.setItem(storageKey, valueToStore);
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

