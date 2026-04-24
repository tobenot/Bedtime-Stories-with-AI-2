import { pluginSystem } from '@/core/pluginSystem';
import { listModelsByProvider } from '@/core/services/aiService';
import { getApiKeyForUrl, saveApiKeyForUrl } from '@/utils/keyManager';
import { deriveApiUrlOptions } from '@/config/presets';

export const configMethods = {
	resolveAvailableMode(modeId) {
		return pluginSystem.getById(modeId) ? modeId : 'standard-chat';
	},
	handleModeChange(modeId) {
		if (this.currentChat?.messages?.length > 0) {
			this.$message({
				message: '当前对话已有消息，无法切换模式。请创建新对话后再切换模式。',
				type: 'warning',
				duration: 3000
			});
			this.$nextTick(() => {
				this.activeMode = this.currentChat.mode || 'standard-chat';
			});
			return;
		}
		console.log('[AppCore] Mode changed to:', modeId);
		pluginSystem.setActive(modeId);
		localStorage.setItem('bs2_active_mode', modeId);
		if (this.currentChat) {
			this.currentChat.mode = modeId;
			this.saveChatHistory();
		}
	},
	updateModels() {
		this.models = listModelsByProvider(this.provider, this.useBackendProxy, this.apiUrl);
		// 刷新按 provider 过滤的 URL 选项
		this.apiUrlOptions = deriveApiUrlOptions(this.provider);
		if (this.models.length === 0) {
			// 自定义 URL / 空预设：保留当前模型，允许用户手动输入
			return;
		}
		if (!this.models.includes(this.model)) {
			this.model = this.models[0];
			this.saveModel();
		}
	},
	saveModel() {
		localStorage.setItem('bs2_model', this.model);
	},
	saveApiKey() {
		saveApiKeyForUrl(this.apiUrl, this.apiKey);
	},
	saveApiUrl() {
		// 按 provider 分开存储，避免切换 provider 时互相污染
		const providerKey = this.provider === 'gemini' ? 'bs2_api_url_gemini' : 'bs2_api_url_openai';
		localStorage.setItem(providerKey, this.apiUrl);
		// 同时写入通用 key 保持向后兼容
		localStorage.setItem('bs2_api_url', this.apiUrl);
	},
	saveUseBackendProxy() {
		localStorage.setItem('bs2_use_backend_proxy', JSON.stringify(this.useBackendProxy));
	},
	saveBackendUrls() {
		localStorage.setItem('bs2_backend_url_deepseek', this.backendUrlDeepseek);
		localStorage.setItem('bs2_backend_url_gemini', this.backendUrlGemini);
	},
	saveFeaturePassword() {
		localStorage.setItem('bs2_feature_password', this.featurePassword);
	},
	showPasswordTip(password, label = '密码') {
		const text = typeof password === 'string' ? password.trim() : '';
		if (!text) {
			return;
		}
		this.$message({
			message: `${label}：${text}`,
			type: 'info',
			duration: 3500,
			showClose: true
		});
	},
	saveDefaultHideReasoning() {
		localStorage.setItem('bs2_default_hide_reasoning', JSON.stringify(this.defaultHideReasoning));
	},
	saveAutoCollapseReasoning() {
		localStorage.setItem('bs2_auto_collapse_reasoning', JSON.stringify(this.autoCollapseReasoning));
	},
	saveMaxTokens() {
		localStorage.setItem('bs2_max_tokens', this.maxTokens.toString());
	},
	saveTemperature() {
		localStorage.setItem('bs2_temperature', this.temperature.toString());
	},
	saveGeminiReasoningEffort() {
		localStorage.setItem('bs2_gemini_reasoning_effort', this.geminiReasoningEffort);
	},
	loadApiKeyForCurrentUrl() {
		this.apiKey = getApiKeyForUrl(this.apiUrl);
	},
	onProviderChanged() {
		localStorage.setItem('bs2_provider', this.provider);
		if (this.provider === 'gemini') {
			this.apiUrl = this.useBackendProxy
				? this.backendUrlGemini
				: (localStorage.getItem('bs2_api_url_gemini') || 'https://generativelanguage.googleapis.com/v1beta');
		} else {
			this.apiUrl = this.useBackendProxy
				? this.backendUrlDeepseek
				: (localStorage.getItem('bs2_api_url_openai') || 'https://api.siliconflow.cn/v1');
		}
		if (this.useBackendProxy) {
			this.apiKey = '';
		} else {
			this.loadApiKeyForCurrentUrl();
		}
		this.updateModels();
		this.saveApiUrl();
	}
};
