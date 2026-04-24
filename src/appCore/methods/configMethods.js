import { pluginSystem } from '@/core/pluginSystem';
import { listModelsByProvider } from '@/core/services/aiService';
import {
	getPresetById,
	getPresetRuntimeBaseUrl,
	saveEditablePresetBaseUrl,
	deriveApiUrlOptions,
	listModelsForPreset,
	loadActivePresetId,
	saveActivePresetId,
	getSelectedModelForPreset,
	saveSelectedModelForPreset,
	resolvePresetIdFromOldConfig,
	matchPresetByUrl,
	upsertCustomPreset
} from '@/config/presets';
import {
	getApiKeyForPreset,
	saveApiKeyForPreset,
	getApiKeyForUrl,
	saveApiKeyForUrl,
	migrateKeyToPresetBucket
} from '@/utils/keyManager';

const DEFAULT_OPENAI_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function resolveOpenAIPresetIdFromUrl(apiUrl) {
	const matched = matchPresetByUrl(apiUrl);
	if (matched && matched.protocol === 'openai') {
		return matched.id;
	}

	const customPreset = upsertCustomPreset({ baseUrl: apiUrl });
	return customPreset?.id || 'builtin_siliconflow';
}

function resolveDirectPresetId(provider, fallbackUrl = '') {
	if (provider === 'gemini') {
		return 'builtin_gemini';
	}
	return resolveOpenAIPresetIdFromUrl(fallbackUrl || DEFAULT_OPENAI_BASE_URL);
}

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

	applyCurrentPreset() {
		const preset = getPresetById(this.activePresetId);
		if (!preset) {
			console.warn('[AppCore] Preset not found:', this.activePresetId, '→ fallback to builtin_siliconflow');
			this.activePresetId = 'builtin_siliconflow';
			saveActivePresetId(this.activePresetId);
			return this.applyCurrentPreset();
		}

		const runtimeBaseUrl = getPresetRuntimeBaseUrl(preset);

		this.provider = preset.protocol === 'gemini' ? 'gemini' : 'openai_compatible';
		this.apiUrl = runtimeBaseUrl;
		this.useBackendProxy = preset.authMode === 'password';

		if (preset.id === 'builtin_backend_openai') {
			this.backendUrlDeepseek = runtimeBaseUrl;
		}
		if (preset.id === 'builtin_backend_gemini') {
			this.backendUrlGemini = runtimeBaseUrl;
		}

		this.models = listModelsForPreset(this.activePresetId);
		this.apiUrlOptions = deriveApiUrlOptions(this.provider);

		const savedModel = getSelectedModelForPreset(this.activePresetId);
		if (savedModel && (this.models.length === 0 || this.models.includes(savedModel))) {
			this.model = savedModel;
		} else if (this.models.length > 0 && !this.models.includes(this.model)) {
			this.model = this.models[0];
		}

		if (preset.authMode === 'password') {
			this.apiKey = '';
		} else {
			migrateKeyToPresetBucket(this.activePresetId, runtimeBaseUrl);
			this.apiKey = getApiKeyForPreset(this.activePresetId, runtimeBaseUrl);
		}

		console.log('[AppCore] Applied preset:', this.activePresetId, '→', {
			provider: this.provider,
			apiUrl: this.apiUrl,
			model: this.model,
			isProxy: this.useBackendProxy
		});
	},

	switchPreset(presetId) {
		if (this.activePresetId && this.model) {
			saveSelectedModelForPreset(this.activePresetId, this.model);
		}

		this.activePresetId = presetId;
		saveActivePresetId(presetId);
		this.applyCurrentPreset();
	},

	initPresetMigration() {
		const existingPresetId = loadActivePresetId();

		if (existingPresetId && getPresetById(existingPresetId)) {
			this.activePresetId = existingPresetId;
			console.log('[AppCore] Loaded existing activePresetId:', existingPresetId);
		} else {
			const oldProvider = localStorage.getItem('bs2_provider') || 'gemini';
			const oldUseProxy = JSON.parse(localStorage.getItem('bs2_use_backend_proxy') || 'true');
			const oldApiUrl = oldProvider === 'gemini'
				? (localStorage.getItem('bs2_api_url_gemini') || localStorage.getItem('bs2_api_url') || DEFAULT_GEMINI_BASE_URL)
				: (localStorage.getItem('bs2_api_url_openai') || localStorage.getItem('bs2_api_url') || DEFAULT_OPENAI_BASE_URL);

			const resolvedId = resolvePresetIdFromOldConfig({
				provider: oldProvider === 'deepseek' ? 'openai_compatible' : oldProvider,
				useBackendProxy: oldUseProxy,
				apiUrl: oldApiUrl
			});

			this.activePresetId = resolvedId;
			saveActivePresetId(resolvedId);

			const oldModel = localStorage.getItem('bs2_model');
			if (oldModel) {
				saveSelectedModelForPreset(resolvedId, oldModel);
			}

			console.log('[AppCore] Migrated from old config → activePresetId:', resolvedId);
		}

		this.applyCurrentPreset();
	},

	updateModels() {
		if (this.activePresetId) {
			this.models = listModelsForPreset(this.activePresetId);
		} else {
			this.models = listModelsByProvider(this.provider, this.useBackendProxy, this.apiUrl);
		}
		this.apiUrlOptions = deriveApiUrlOptions(this.provider);
		if (this.models.length === 0) {
			return;
		}
		if (!this.models.includes(this.model)) {
			this.model = this.models[0];
			this.saveModel();
		}
	},
	saveModel() {
		localStorage.setItem('bs2_model', this.model);
		if (this.activePresetId) {
			saveSelectedModelForPreset(this.activePresetId, this.model);
		}
	},
	saveApiKey() {
		if (this.activePresetId) {
			const runtimeBaseUrl = getPresetRuntimeBaseUrl(this.activePresetId);
			saveApiKeyForPreset(this.activePresetId, this.apiKey, runtimeBaseUrl);
		}
		saveApiKeyForUrl(this.apiUrl, this.apiKey);
	},
	saveApiUrl() {
		const providerKey = this.provider === 'gemini' ? 'bs2_api_url_gemini' : 'bs2_api_url_openai';
		localStorage.setItem(providerKey, this.apiUrl);
		localStorage.setItem('bs2_api_url', this.apiUrl);
	},
	saveUseBackendProxy() {
		localStorage.setItem('bs2_use_backend_proxy', JSON.stringify(this.useBackendProxy));
	},
	saveBackendUrls() {
		this.backendUrlDeepseek = saveEditablePresetBaseUrl('builtin_backend_openai', this.backendUrlDeepseek);
		this.backendUrlGemini = saveEditablePresetBaseUrl('builtin_backend_gemini', this.backendUrlGemini);
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
		if (this.activePresetId) {
			const preset = getPresetById(this.activePresetId);
			if (preset?.authMode === 'password') {
				this.apiKey = '';
				return;
			}
			if (preset) {
				const runtimeBaseUrl = getPresetRuntimeBaseUrl(preset);
				migrateKeyToPresetBucket(this.activePresetId, runtimeBaseUrl);
				this.apiKey = getApiKeyForPreset(this.activePresetId, runtimeBaseUrl);
				return;
			}
		}
		this.apiKey = getApiKeyForUrl(this.apiUrl);
	},

	onApiUrlChanged(newUrl) {
		const matched = matchPresetByUrl(newUrl);
		if (matched) {
			this.switchPreset(matched.id);
			this.saveApiUrl();
			return;
		}

		const customPreset = upsertCustomPreset({ baseUrl: newUrl });
		if (customPreset) {
			this.switchPreset(customPreset.id);
			this.saveApiUrl();
			return;
		}

		this.apiUrl = newUrl;
		this.saveApiUrl();
		this.loadApiKeyForCurrentUrl();
		this.updateModels();
	},

	onUseBackendProxyChanged(newValue) {
		this.useBackendProxy = newValue;
		this.saveUseBackendProxy();
		if (newValue) {
			const targetId = this.provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
			this.switchPreset(targetId);
			return;
		}

		const fallbackUrl = this.provider === 'gemini'
			? (localStorage.getItem('bs2_api_url_gemini') || DEFAULT_GEMINI_BASE_URL)
			: (localStorage.getItem('bs2_api_url_openai') || localStorage.getItem('bs2_api_url') || DEFAULT_OPENAI_BASE_URL);
		this.switchPreset(resolveDirectPresetId(this.provider, fallbackUrl));
	},

	onBackendUrlDeepseekChanged(newUrl) {
		this.backendUrlDeepseek = newUrl;
		this.saveBackendUrls();
		if (this.activePresetId === 'builtin_backend_openai') {
			this.apiUrl = this.backendUrlDeepseek;
		}
	},

	onBackendUrlGeminiChanged(newUrl) {
		this.backendUrlGemini = newUrl;
		this.saveBackendUrls();
		if (this.activePresetId === 'builtin_backend_gemini') {
			this.apiUrl = this.backendUrlGemini;
		}
	},

	onProviderChanged() {
		localStorage.setItem('bs2_provider', this.provider);

		if (this.useBackendProxy) {
			const targetId = this.provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
			this.switchPreset(targetId);
			return;
		}

		const fallbackUrl = this.provider === 'gemini'
			? (localStorage.getItem('bs2_api_url_gemini') || DEFAULT_GEMINI_BASE_URL)
			: (localStorage.getItem('bs2_api_url_openai') || localStorage.getItem('bs2_api_url') || DEFAULT_OPENAI_BASE_URL);
		this.switchPreset(resolveDirectPresetId(this.provider, fallbackUrl));
	}
};
