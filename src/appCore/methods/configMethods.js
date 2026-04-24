import { pluginSystem } from '@/core/pluginSystem';
import {
	getPresetById,
	getPresetRuntimeBaseUrl,
	saveEditablePresetBaseUrl,
	listModelsForPreset,
	loadActivePresetId,
	saveActivePresetId,
	getSelectedModelForPreset,
	saveSelectedModelForPreset,
	resolvePresetIdFromOldConfig,
	createCustomPreset,
	updateCustomPreset,
	deleteCustomPreset,
	deleteSelectedModelForPreset,
	normalizeBaseUrl
} from '@/config/presets';
import {
	getApiKeyForPreset,
	saveApiKeyForPreset,
	saveApiKeyForUrl,
	migrateKeyToPresetBucket,
	deleteApiKeyForPresetBucket
} from '@/utils/keyManager';

const DEFAULT_OPENAI_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

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

	/**
	 * 根据 activePresetId 设置所有运行时状态
	 * Phase 2: 不再设置 useBackendProxy / backendUrlDeepseek / backendUrlGemini
	 */
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
		this.isBackendProxy = preset.authMode === 'password';

		this.models = listModelsForPreset(this.activePresetId);

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
			isProxy: this.isBackendProxy
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

	/**
	 * 代理预设 baseUrl 变更（从 SettingsDrawer 的代理地址输入框触发）
	 */
	onProxyBaseUrlChanged(newUrl) {
		const preset = getPresetById(this.activePresetId);
		if (!preset || !preset.editableBaseUrl) return;

		saveEditablePresetBaseUrl(this.activePresetId, newUrl);

		// 只同步当前运行时 URL，不执行完整 preset 重算
		if (this.activePresetId === preset.id) {
			this.apiUrl = normalizeBaseUrl(newUrl) || getPresetRuntimeBaseUrl(preset);
		}
	},

	/**
	 * 自定义预设 CRUD
	 */
	onCreateCustomPreset({ label, baseUrl, apiKey, models, features }) {
		const preset = createCustomPreset({ baseUrl, label, models, features });
		if (preset) {
			if (apiKey && apiKey.trim()) {
				saveApiKeyForPreset(preset.id, apiKey.trim(), getPresetRuntimeBaseUrl(preset));
			}
			this.switchPreset(preset.id);
			this.$message({ message: `预设「${preset.label}」已创建`, type: 'success' });
		}
	},

	onUpdateCustomPreset({ id, label, baseUrl, apiKey, models, features }) {
		const updated = updateCustomPreset(id, { label, baseUrl, models, features });
		if (updated) {
			if (apiKey !== undefined) {
				saveApiKeyForPreset(id, apiKey, getPresetRuntimeBaseUrl(updated));
			}
			if (this.activePresetId === id) {
				this.applyCurrentPreset();
			}
			this.$message({ message: `预设「${updated.label}」已更新`, type: 'success' });
		}
	},

	onDeleteCustomPreset(presetId) {
		const preset = getPresetById(presetId);
		const wasActive = this.activePresetId === presetId;
		if (wasActive) {
			this.switchPreset('builtin_siliconflow');
		}
		deleteCustomPreset(presetId);
		deleteSelectedModelForPreset(presetId);
		deleteApiKeyForPresetBucket(presetId, preset?.baseUrl || '');
		this.$message({ message: '预设已删除', type: 'success' });
	}
};
