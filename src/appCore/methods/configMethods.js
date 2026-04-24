import { pluginSystem } from '@/core/pluginSystem';
import { listModelsByProvider } from '@/core/services/aiService';
import {
	getPresetById,
	deriveApiUrlOptions,
	listModelsForPreset,
	loadActivePresetId,
	saveActivePresetId,
	getSelectedModelForPreset,
	saveSelectedModelForPreset,
	resolvePresetIdFromOldConfig,
	matchPresetByUrl
} from '@/config/presets';
import { getApiKeyForPreset, saveApiKeyForPreset, getApiKeyForUrl, saveApiKeyForUrl } from '@/utils/keyManager';

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

	// ── Phase 1B: Preset 驱动的核心方法 ──

	/**
	 * 从 currentPreset 派生所有状态
	 * 这是 Phase 1B 的核心：activePresetId → 一切
	 */
	applyCurrentPreset() {
		const preset = getPresetById(this.activePresetId);
		if (!preset) {
			console.warn('[AppCore] Preset not found:', this.activePresetId, '→ fallback to builtin_siliconflow');
			this.activePresetId = 'builtin_siliconflow';
			saveActivePresetId(this.activePresetId);
			return this.applyCurrentPreset();
		}

		// 1. 派生 provider
		this.provider = preset.protocol === 'gemini' ? 'gemini' : 'openai_compatible';

		// 2. 派生 apiUrl
		this.apiUrl = preset.baseUrl;

		// 3. 派生 useBackendProxy（兼容属性）
		this.useBackendProxy = preset.authMode === 'password';

		// 4. 如果是代理预设，同步 backendUrl 兼容字段
		if (preset.id === 'builtin_backend_openai') {
			this.backendUrlDeepseek = preset.baseUrl;
		} else if (preset.id === 'builtin_backend_gemini') {
			this.backendUrlGemini = preset.baseUrl;
		}

		// 5. 派生模型列表
		this.models = listModelsForPreset(this.activePresetId);
		this.apiUrlOptions = deriveApiUrlOptions(this.provider);

		// 6. 恢复该预设上次选择的模型
		const savedModel = getSelectedModelForPreset(this.activePresetId);
		if (savedModel && (this.models.length === 0 || this.models.includes(savedModel))) {
			this.model = savedModel;
		} else if (this.models.length > 0 && !this.models.includes(this.model)) {
			this.model = this.models[0];
		}
		// 如果 models 为空且 savedModel 也为空，保留当前 model（允许手动输入）

		// 7. 加载该预设的 API Key
		if (preset.authMode === 'password') {
			this.apiKey = '';
		} else {
			this.apiKey = getApiKeyForPreset(this.activePresetId, preset.baseUrl);
		}

		console.log('[AppCore] Applied preset:', this.activePresetId, '→', {
			provider: this.provider,
			apiUrl: this.apiUrl,
			model: this.model,
			isProxy: this.useBackendProxy
		});
	},

	/**
	 * 切换预设（Phase 1B 的主入口）
	 */
	switchPreset(presetId) {
		// 保存当前预设的模型选择
		if (this.activePresetId && this.model) {
			saveSelectedModelForPreset(this.activePresetId, this.model);
		}

		this.activePresetId = presetId;
		saveActivePresetId(presetId);
		this.applyCurrentPreset();
	},

	/**
	 * 初始化时的迁移入口
	 * 检查是否需要从旧配置迁移到 preset 架构
	 */
	initPresetMigration() {
		const existingPresetId = loadActivePresetId();

		if (existingPresetId && getPresetById(existingPresetId)) {
			// 已有有效的 presetId，直接使用
			this.activePresetId = existingPresetId;
			console.log('[AppCore] Loaded existing activePresetId:', existingPresetId);
		} else {
			// 需要从旧配置迁移
			const oldProvider = localStorage.getItem('bs2_provider') || 'gemini';
			const oldUseProxy = JSON.parse(localStorage.getItem('bs2_use_backend_proxy') || 'true');
			const oldApiUrl = oldProvider === 'gemini'
				? (localStorage.getItem('bs2_api_url_gemini') || localStorage.getItem('bs2_api_url') || 'https://generativelanguage.googleapis.com/v1beta')
				: (localStorage.getItem('bs2_api_url_openai') || localStorage.getItem('bs2_api_url') || 'https://api.siliconflow.cn/v1');

			const resolvedId = resolvePresetIdFromOldConfig({
				provider: oldProvider === 'deepseek' ? 'openai_compatible' : oldProvider,
				useBackendProxy: oldUseProxy,
				apiUrl: oldApiUrl
			});

			this.activePresetId = resolvedId;
			saveActivePresetId(resolvedId);

			// 迁移旧模型到当前 preset
			const oldModel = localStorage.getItem('bs2_model');
			if (oldModel) {
				saveSelectedModelForPreset(resolvedId, oldModel);
			}

			// 迁移代理预设的 baseUrl
			const oldBackendDeepseek = localStorage.getItem('bs2_backend_url_deepseek');
			if (oldBackendDeepseek) {
				const backendOpenai = getPresetById('builtin_backend_openai');
				if (backendOpenai) backendOpenai.baseUrl = oldBackendDeepseek;
			}
			const oldBackendGemini = localStorage.getItem('bs2_backend_url_gemini');
			if (oldBackendGemini) {
				const backendGemini = getPresetById('builtin_backend_gemini');
				if (backendGemini) backendGemini.baseUrl = oldBackendGemini;
			}

			console.log('[AppCore] Migrated from old config → activePresetId:', resolvedId);
		}

		this.applyCurrentPreset();
	},

	// ── 兼容旧接口（Phase 1B 过渡期） ──

	updateModels() {
		// Phase 1B: 优先从 preset 取模型列表
		if (this.activePresetId) {
			this.models = listModelsForPreset(this.activePresetId);
		} else {
			this.models = listModelsByProvider(this.provider, this.useBackendProxy, this.apiUrl);
		}
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
		// Phase 1B: 同时保存到 preset 维度
		if (this.activePresetId) {
			saveSelectedModelForPreset(this.activePresetId, this.model);
		}
	},
	saveApiKey() {
		// Phase 1B: 按 presetId 保存
		if (this.activePresetId) {
			const preset = getPresetById(this.activePresetId);
			saveApiKeyForPreset(this.activePresetId, this.apiKey, preset?.baseUrl || '');
		}
		// 兼容旧桶
		saveApiKeyForUrl(this.apiUrl, this.apiKey);
	},
	saveApiUrl() {
		// Phase 1B: apiUrl 由 preset 驱动，不再独立持久化
		// 但保留向后兼容写入
		const providerKey = this.provider === 'gemini' ? 'bs2_api_url_gemini' : 'bs2_api_url_openai';
		localStorage.setItem(providerKey, this.apiUrl);
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
		// Phase 1B: 优先从 presetId 桶读
		if (this.activePresetId) {
			const preset = getPresetById(this.activePresetId);
			if (preset && preset.authMode !== 'password') {
				this.apiKey = getApiKeyForPreset(this.activePresetId, preset.baseUrl);
				return;
			}
		}
		this.apiKey = getApiKeyForUrl(this.apiUrl);
	},

	/**
	 * 当用户在 SettingsDrawer 的 URL 下拉框中选择/输入了新 URL 时
	 * Phase 1B: 尝试匹配到对应 preset 并切换
	 */
	onApiUrlChanged(newUrl) {
		this.apiUrl = newUrl;
		this.saveApiUrl();
		// 尝试匹配到一个内置 preset
		const matched = matchPresetByUrl(newUrl);
		if (matched) {
			this.switchPreset(matched.id);
		} else {
			// 自定义 URL：更新模型列表，加载 key
			this.loadApiKeyForCurrentUrl();
			this.updateModels();
		}
	},

	/**
	 * 当用户切换"神秘链接"开关时
	 * Phase 1B: 转化为 preset 切换
	 */
	onUseBackendProxyChanged(newValue) {
		this.useBackendProxy = newValue;
		this.saveUseBackendProxy();
		if (newValue) {
			// 打开代理 → 切到对应的代理预设
			const targetId = this.provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
			this.switchPreset(targetId);
		} else {
			// 关闭代理 → 切到一个合适的直连预设
			if (this.provider === 'gemini') {
				this.switchPreset('builtin_gemini');
			} else {
				const oldUrl = localStorage.getItem('bs2_api_url_openai') || 'https://api.siliconflow.cn/v1';
				const matched = matchPresetByUrl(oldUrl);
				this.switchPreset(matched ? matched.id : 'builtin_siliconflow');
			}
		}
	},

	/**
	 * 旧接口兼容：当 provider 通过 SettingsDrawer 改变时
	 * Phase 1B: 转化为 preset 切换
	 */
	onProviderChanged() {
		localStorage.setItem('bs2_provider', this.provider);

		if (this.useBackendProxy) {
			// 代理模式下切 provider → 切到对应的代理预设
			const targetId = this.provider === 'gemini' ? 'builtin_backend_gemini' : 'builtin_backend_openai';
			this.switchPreset(targetId);
		} else {
			// 直连模式下切 provider → 尝试找一个合适的直连预设
			if (this.provider === 'gemini') {
				this.switchPreset('builtin_gemini');
			} else {
				// 尝试匹配旧的 apiUrl 到一个预设
				const oldUrl = localStorage.getItem('bs2_api_url_openai') || 'https://api.siliconflow.cn/v1';
				const matched = matchPresetByUrl(oldUrl);
				this.switchPreset(matched ? matched.id : 'builtin_siliconflow');
			}
		}
	}
};
