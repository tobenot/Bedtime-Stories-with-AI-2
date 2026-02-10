import { pluginSystem } from '@/core/pluginSystem';
import { listModelsByProvider } from '@/core/services/aiService';
import { getApiKeyForUrl, saveApiKeyForUrl } from '@/utils/keyManager';

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
			this.apiUrl = this.useBackendProxy ? this.backendUrlGemini : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent';
		} else {
			this.apiUrl = this.useBackendProxy ? this.backendUrlDeepseek : (localStorage.getItem('bs2_api_url') || 'https://api.siliconflow.cn/v1/chat/completions');
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
