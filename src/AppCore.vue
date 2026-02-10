<!--
	微内核主应用
	负责插件加载、路由管理、全局状态管理
-->
<template>
	<div class="app-container flex overflow-hidden">
		<ChatSidebar
			v-model="showSidebar"
			:chat-history="chatHistory"
			:current-chat-id="currentChatId"
			@create-new-chat="createNewChat"
			@switch-chat="switchChat"
			@delete-chat="deleteChat"
			@update-title="changeChatTitle"
			@open-external-link="openExternalLink"
		/>

		<div class="main-content flex-1 flex flex-col min-w-0 relative">
			<div class="top-bar-container flex-shrink-0">
				<HeaderBar
					:title="currentChat?.title || '与AI的睡前故事 2'"
					:can-export="!!currentChat?.messages?.length"
					@toggle-sidebar="toggleSidebar"
					@toolbox-command="handleToolboxCommand"
					@export-pdf="exportToPDF"
					@open-settings="showSettings = true"
				/>
				
				<div class="mode-selector p-2 border-b border-gray-200 bg-white">
					<el-select 
						v-model="activeMode" 
						placeholder="选择模式"
						@change="handleModeChange"
						class="w-full md:w-64"
					>
						<el-option
							v-for="mode in availableModes"
							:key="mode.id"
							:label="mode.name"
							:value="mode.id"
						>
							<span class="flex items-center">
								<el-icon class="mr-2">
									<component :is="mode.icon" />
								</el-icon>
								{{ mode.name }}
							</span>
						</el-option>
					</el-select>
				</div>

				<ModelSelector
					:selected-model="model"
					:models="models"
					@update:model="model = $event; saveModel()"
				/>
			</div>

			<div class="plugin-container flex-1 overflow-hidden">
				<component
					v-if="currentModeComponent"
					:is="currentModeComponent"
					:config="modeConfig"
					:chat="currentChat"
					@open-settings="showSettings = true"
					@focus-input="focusInput"
					@open-script-panel="showScriptPanel = true"
					@copy-message="copyMessage"
					@edit-message="enableEditMessage"
					@regenerate-message="confirmRegenerateMessage"
					@delete-message="confirmDeleteMessage"
					@toggle-reasoning="toggleReasoning"
					@update-chat="saveChatHistory"
					@scroll-bottom-changed="showScrollToBottom = $event"
					@scroll-progress="onScrollProgress"
					@fork-chat="forkChatAt"
					ref="currentMode"
				/>
			</div>

			<button
				v-if="showScrollToBottom"
				@click="scrollToBottomManual"
				class="scroll-to-bottom-btn"
				:class="{ 'mobile': !isDesktop }"
				title="滚动到底部"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		</div>
	</div>

	<!-- 设置抽屉 -->
	<SettingsDrawer
		v-model="showSettings"
		:provider="provider"
		:api-key="apiKey"
		:api-url="apiUrl"
		:use-backend-proxy="useBackendProxy"
		:backend-url-deepseek="backendUrlDeepseek"
		:backend-url-gemini="backendUrlGemini"
		:feature-password="featurePassword"
		:temperature="temperature"
		:max-tokens="maxTokens"
		:model="model"
		:default-hide-reasoning="defaultHideReasoning"
		:auto-collapse-reasoning="autoCollapseReasoning"
		:models="models"
		:api-url-options="apiUrlOptions"
		:gemini-reasoning-effort="geminiReasoningEffort"
		@update:provider="provider = $event; onProviderChanged()"
		@update:api-key="apiKey = $event; saveApiKey()"
		@update:api-url="apiUrl = $event; saveApiUrl()"
		@update:useBackendProxy="useBackendProxy = $event; saveUseBackendProxy(); onProviderChanged()"
		@update:backendUrlDeepseek="backendUrlDeepseek = $event; saveBackendUrls(); onProviderChanged()"
		@update:backendUrlGemini="backendUrlGemini = $event; saveBackendUrls(); onProviderChanged()"
		@update:featurePassword="featurePassword = $event; saveFeaturePassword()"
		@update:temperature="temperature = $event; saveTemperature()"
		@update:max-tokens="maxTokens = $event; saveMaxTokens()"
		@update:model="model = $event; saveModel()"
		@update:default-hide-reasoning="defaultHideReasoning = $event; saveDefaultHideReasoning()"
		@update:auto-collapse-reasoning="autoCollapseReasoning = $event; saveAutoCollapseReasoning()"
		@update:gemini-reasoning-effort="geminiReasoningEffort = $event; saveGeminiReasoningEffort()"
		@export-chat-archive="exportChatArchive"
		@export-current-chat-archive="exportCurrentChatArchive"
		@export-chat-titles="exportChatTitles"
		@repair-chat-data="repairChatData"
		@import-chat-archive="importChatArchive"
		@show-author-info="showAuthorInfo = true"
	/>

	<!-- 其他对话框 -->
	<AuthorDialog v-model="showAuthorInfo" />
	<ScriptSelector v-model="showScriptPanel" :scripts="scripts" @script-selected="selectScript" />
	<LocalScriptEditor v-model="showLocalScriptEditor" @script-selected="selectScript" />
	<EditMessageDialog
		v-model="showEditDialog"
		:content="editingMessage.content"
		@update:content="editingMessage.content = $event"
		@save="saveEditedMessageDialog"
	/>
	<TxtNovelExporter v-model="showTxtNovelExporter" :chat="currentChat" />
	<MarkdownTool v-model="showMarkdownTool" />
	<ScrollNavigator
		v-model="showScrollNavigator"
		:total-messages="messageCount"
		:current-percent="currentScrollPercent"
		@scroll-percent="scrollByPercent"
		@scroll-index="scrollToMessageIndex"
	/>

	<!-- 隐藏的文件上传控件 -->
	<input
		type="file"
		ref="importFile"
		style="display: none;"
		accept=".json"
		@change="handleImportFile"
	/>
</template>

<script>
import { ChatDotRound } from '@element-plus/icons-vue';
import { pluginSystem } from '@/core/pluginSystem';
import { registerAllModes, getAllModes } from '@/modes';
import { registerAllTools } from '@/tools';
import { listModelsByProvider, callAiModel } from '@/core/services/aiService';
import { throttle } from '@/utils/throttleHelper';
import { getApiKeyForUrl, saveApiKeyForUrl, migrateOldApiKeys } from '@/utils/keyManager';
import ChatSidebar from './components/ChatSidebar.vue';
import HeaderBar from './components/HeaderBar.vue';
import ModelSelector from './components/ModelSelector.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import AuthorDialog from './components/AuthorDialog.vue';
import EditMessageDialog from './components/EditMessageDialog.vue';
import ScriptSelector from './components/ScriptSelector.vue';
import LocalScriptEditor from './components/LocalScriptEditor.vue';
import TxtNovelExporter from './components/TxtNovelExporter.vue';
import MarkdownTool from './components/MarkdownTool.vue';
import ScrollNavigator from './components/ScrollNavigator.vue';
import scripts from './config/scripts.js';
import { exportChatToPDF } from './utils/pdfExporter';
import { parseArchiveJson, mergeImportedChats, generateUniqueBranchTitle } from '@/utils/archive.js';
import confirmUseScript from './utils/scriptPreview.js';
import { COPY_SUFFIX, MAX_TITLE_LENGTH } from '@/config/constants.js';
import { createUuid, cloneMessagesWithNewIds, normalizeAndRepairChats, sortChatsByCreatedTime } from '@/utils/chatData';
import { createPasswordProof, verifyPasswordProof, encryptTextWithPassword, decryptTextWithPassword } from '@/utils/secureArchive.js';

export default {
	name: 'AppCore',
	components: {
		ChatDotRound,
		ChatSidebar,
		HeaderBar,
		ModelSelector,
		SettingsDrawer,
		AuthorDialog,
		EditMessageDialog,
		ScriptSelector,
		LocalScriptEditor,
		TxtNovelExporter,
		MarkdownTool,
		ScrollNavigator
	},
	data() {
		// 初始化提供商
		let provider = localStorage.getItem('bs2_provider') || 'gemini';
		if (provider === 'deepseek') {
			provider = 'openai_compatible';
			localStorage.setItem('bs2_provider', provider);
		}

		// 迁移旧的API密钥
		const oldApiKey = localStorage.getItem('bs2_deepseek_api_key');
		if (oldApiKey) {
			localStorage.setItem('bs2_openai_compatible_api_key', oldApiKey);
			localStorage.removeItem('bs2_deepseek_api_key');
		}
		migrateOldApiKeys();

		const savedApiUrl = localStorage.getItem('bs2_api_url') || 'https://api.siliconflow.cn/v1/chat/completions';
		const initialApiKey = getApiKeyForUrl(savedApiUrl);

		return {
			// 核心状态
			activeMode: localStorage.getItem('bs2_active_mode') || 'standard-chat',
			availableModes: [],
			
			// AI配置
			provider,
			model: localStorage.getItem('bs2_model') || 'gemini-2.5-flash',
			models: [],
			temperature: parseFloat(localStorage.getItem('bs2_temperature') || '1.0'),
			maxTokens: parseInt(localStorage.getItem('bs2_max_tokens') || '16384', 10),
			apiKey: initialApiKey,
			apiUrl: savedApiUrl,
			useBackendProxy: JSON.parse(localStorage.getItem('bs2_use_backend_proxy') || 'true'),
			backendUrlDeepseek: localStorage.getItem('bs2_backend_url_deepseek') || '/api/deepseek/stream',
			backendUrlGemini: localStorage.getItem('bs2_backend_url_gemini') || '/api/gemini/stream',
			featurePassword: localStorage.getItem('bs2_feature_password') || '',
			geminiReasoningEffort: localStorage.getItem('bs2_gemini_reasoning_effort') || 'medium',
			
			// UI状态
			showSettings: false,
			showSidebar: window.innerWidth >= 768,
			isDesktop: window.innerWidth >= 768,
			showScrollToBottom: false,
			showAuthorInfo: false,
			showScriptPanel: false,
			showLocalScriptEditor: false,
			showMarkdownTool: false,
			showScrollNavigator: false,
			showEditDialog: false,
			showTxtNovelExporter: false,
			currentScrollPercent: 0,
			
			// 对话历史
			chatHistory: [],
			currentChatId: null,
			
			// 其他
			scripts,
			apiUrlOptions: [
				{ label: '硅基流动', value: 'https://api.siliconflow.cn/v1/chat/completions' },
				{ label: 'Deepseek官方', value: 'https://api.deepseek.com/v1/chat/completions' },
				{ label: '火山引擎', value: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' },
				{ label: 'OpenRouter', value: 'https://openrouter.ai/api/v1/chat/completions' },
				{ label: 'LMRouter', value: 'https://api.lmrouter.com/openai/v1/chat/completions' }
			],
			defaultHideReasoning: JSON.parse(localStorage.getItem('bs2_default_hide_reasoning') || 'false'),
			autoCollapseReasoning: JSON.parse(localStorage.getItem('bs2_auto_collapse_reasoning') || 'true'),
			editingMessage: { index: null, content: '' }
		};
	},
	computed: {
		currentChat() {
			return this.chatHistory.find(chat => chat.id === this.currentChatId);
		},
		messageCount() {
			return this.currentChat?.messages?.length || 0;
		},
		currentModeComponent() {
			const mode = pluginSystem.getById(this.activeMode);
			return mode?.component || null;
		},
		modeConfig() {
			return {
				provider: this.provider,
				model: this.model,
				apiKey: this.apiKey,
				apiUrl: this.apiUrl,
				temperature: this.temperature,
				maxTokens: this.maxTokens,
				useBackendProxy: this.useBackendProxy,
				backendUrlDeepseek: this.backendUrlDeepseek,
				backendUrlGemini: this.backendUrlGemini,
				featurePassword: this.featurePassword,
				geminiReasoningEffort: this.geminiReasoningEffort,
				defaultHideReasoning: this.defaultHideReasoning,
				autoCollapseReasoning: this.autoCollapseReasoning
			};
		}
	},
	watch: {
		provider() {
			console.log('[AppCore] Provider changed, updating models');
			this.updateModels();
		},
		useBackendProxy() {
			console.log('[AppCore] Backend proxy changed, updating models and loading API key');
			this.loadApiKeyForCurrentUrl();
			this.updateModels();
		},
		apiUrl() {
			console.log('[AppCore] API URL changed, updating models and loading API key');
			this.loadApiKeyForCurrentUrl();
			this.updateModels();
		}
	},
	created() {
		// 注册所有插件和工具
		registerAllModes();
		registerAllTools();
		
		// 加载可用模式
		this.availableModes = getAllModes();
		
		// 设置默认激活模式
		if (!pluginSystem.getById(this.activeMode)) {
			console.log('[AppCore] Active mode unavailable, fallback to standard-chat:', this.activeMode);
			this.activeMode = 'standard-chat';
			localStorage.setItem('bs2_active_mode', this.activeMode);
		}
		pluginSystem.setActive(this.activeMode);
		
		// 加载对话历史
		this.loadChatHistory();
		
		// 加载当前URL对应的API密钥
		this.loadApiKeyForCurrentUrl();
		
		// 更新模型列表
		this.updateModels();
	},
	mounted() {
		window.addEventListener('resize', this.handleResize);
	},
	unmounted() {
		window.removeEventListener('resize', this.handleResize);
	},
	methods: {
		resolveAvailableMode(modeId) {
			return pluginSystem.getById(modeId) ? modeId : 'standard-chat';
		},
		createMessage(role, content, extra = {}) {
			const now = Date.now();
			return {
				id: createUuid(),
				role,
				content,
				createdAt: new Date(now).toISOString(),
				createdAtMs: now,
				...extra
			};
		},
		createChatRecord({ title = '新对话', messages = [], mode = this.activeMode } = {}) {
			const now = Date.now();
			return {
				id: createUuid(),
				title,
				messages,
				createdAt: new Date(now).toISOString(),
				createdAtMs: now,
				mode
			};
		},
		syncCurrentChatIdAfterRepair(savedCurrentChatId, idMap) {
			if (!this.chatHistory.length) {
				this.currentChatId = null;
				return;
			}
			const mappedCurrentId = savedCurrentChatId ? (idMap[String(savedCurrentChatId)] || String(savedCurrentChatId)) : null;
			const found = mappedCurrentId ? this.chatHistory.find(chat => chat.id === mappedCurrentId) : null;
			this.currentChatId = found ? found.id : this.chatHistory[0].id;
			localStorage.setItem('bs2_current_chat_id', this.currentChatId);
		},
		loadChatHistory() {
			const savedHistory = localStorage.getItem('bs2_chat_history');
			if (savedHistory) {
				const parsedHistory = JSON.parse(savedHistory);
				const savedCurrentChatId = localStorage.getItem('bs2_current_chat_id');
				const repaired = normalizeAndRepairChats(parsedHistory);
				this.chatHistory = repaired.chats;
				this.syncCurrentChatIdAfterRepair(savedCurrentChatId, repaired.idMap);
				if (repaired.changed) {
					console.log('[AppCore] 对话数据自动修复完成', repaired.stats);
					this.saveChatHistory();
				}
				if (this.chatHistory.length > 0) {
					const currentChat = this.chatHistory.find(chat => chat.id === this.currentChatId);
					if (currentChat?.mode) {
						const resolvedMode = this.resolveAvailableMode(currentChat.mode);
						const modeChanged = currentChat.mode !== resolvedMode;
						this.activeMode = resolvedMode;
						if (modeChanged) {
							console.log('[AppCore] Chat mode unavailable, fallback to standard-chat:', currentChat.mode);
						}
						currentChat.mode = resolvedMode;
						pluginSystem.setActive(resolvedMode);
						if (modeChanged) {
							this.saveChatHistory();
						}
					} else {
						this.activeMode = 'standard-chat';
						pluginSystem.setActive('standard-chat');
					}
				}
			}
			if (!this.currentChatId) {
				this.createNewChat();
			}
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
		},
		createNewChat() {
			const newChat = this.createChatRecord({
				title: '新对话',
				messages: [],
				mode: this.activeMode
			});
			this.chatHistory.push(newChat);
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			this.currentChatId = newChat.id;
			localStorage.setItem('bs2_current_chat_id', newChat.id);
			this.saveChatHistory();
			if (!this.isDesktop) this.showSidebar = false;
		},
	switchChat(chatId) {
		this.currentChatId = chatId;
		localStorage.setItem('bs2_current_chat_id', chatId);
		const chat = this.chatHistory.find(c => c.id === chatId);
		if (chat?.mode) {
			const resolvedMode = this.resolveAvailableMode(chat.mode);
			const modeChanged = chat.mode !== resolvedMode;
			this.activeMode = resolvedMode;
			if (modeChanged) {
				console.log('[AppCore] Switch chat mode unavailable, fallback to standard-chat:', chat.mode);
			}
			chat.mode = resolvedMode;
			pluginSystem.setActive(resolvedMode);
			if (modeChanged) {
				this.saveChatHistory();
			}
		} else {
			this.activeMode = 'standard-chat';
			pluginSystem.setActive('standard-chat');
		}
		if (!this.isDesktop) this.showSidebar = false;
	},
	deleteChat(chatId) {
		const index = this.chatHistory.findIndex(chat => chat.id === chatId);
		if (index !== -1) {
			this.chatHistory.splice(index, 1);
			if (this.verifiedProtectedChatId === chatId) {
				this.verifiedProtectedChatId = null;
			}
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			if (this.chatHistory.length === 0) {
				this.createNewChat();
			} else if (this.currentChatId === chatId) {
				this.currentChatId = this.chatHistory[0].id;
				localStorage.setItem('bs2_current_chat_id', this.currentChatId);
			}
			this.saveChatHistory();
		}
	},
	async configureChatProtection(chatId) {
		const chat = this.chatHistory.find(c => c.id === chatId);
		if (!chat) {
			return;
		}
		if (!this.isChatProtected(chat)) {
			const password = await this.promptPassword('设置对话密码', `为"${chat.title || '新对话'}"设置密码`);
			if (password === null) {
				return;
			}
			chat.protection = {
				enabled: true,
				...(await createPasswordProof(password))
			};
			if (this.currentChatId === chat.id) {
				this.verifiedProtectedChatId = chat.id;
			}
			this.saveChatHistory();
			console.log('[AppCore] 已设置对话密码', { chatId: chat.id });
			this.$message({ message: '已设置对话密码', type: 'success', duration: 2000 });
			return;
		}
		const removePassword = await this.promptPassword('移除对话密码', `请输入"${chat.title || '新对话'}"的当前密码`);
		if (removePassword === null) {
			return;
		}
		const passed = await verifyPasswordProof(removePassword, chat.protection);
		if (!passed) {
			console.warn('[AppCore] 移除对话密码失败，校验不通过', { chatId: chat.id });
			this.$message({ message: '密码错误，无法移除', type: 'error', duration: 2000 });
			return;
		}
		delete chat.protection;
		if (this.verifiedProtectedChatId === chat.id) {
			this.verifiedProtectedChatId = null;
		}
		this.saveChatHistory();
		console.log('[AppCore] 已移除对话密码', { chatId: chat.id });
		this.$message({ message: '已移除对话密码', type: 'success', duration: 2000 });
	},
		saveChatHistory() {
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			localStorage.setItem('bs2_chat_history', JSON.stringify(this.chatHistory));
			if (this.currentChatId) {
				localStorage.setItem('bs2_current_chat_id', String(this.currentChatId));
			}
		},
		changeChatTitle({ id, title }) {
			const chat = this.chatHistory.find(c => c.id === id);
			if (chat) {
				chat.title = title;
				this.saveChatHistory();
			}
		},
		toggleSidebar() {
			this.showSidebar = !this.showSidebar;
		},
		handleResize() {
			const desktop = window.innerWidth >= 768;
			if (desktop !== this.isDesktop) {
				this.isDesktop = desktop;
				this.showSidebar = desktop;
			}
		},
		scrollToBottomManual() {
			if (this.$refs.currentMode?.scrollToBottomManual) {
				this.$refs.currentMode.scrollToBottomManual();
			}
		},
		focusInput() {
			if (this.$refs.currentMode?.focus) {
				this.$refs.currentMode.focus();
			}
		},
		async copyMessage(content) {
			try {
				await navigator.clipboard.writeText(content);
				this.$message({ message: '复制成功', type: 'success', duration: 2000 });
			} catch (err) {
				this.$message({ message: '复制失败', type: 'error', duration: 2000 });
			}
		},
		async exportToPDF() {
			try {
				await exportChatToPDF(this.currentChat);
				this.$message({ message: 'PDF导出成功', type: 'success', duration: 2000 });
			} catch (error) {
				console.error('PDF 导出失败:', error);
				this.$message({ message: 'PDF导出失败', type: 'error', duration: 2000 });
			}
		},
		handleToolboxCommand(command) {
			console.log('[AppCore] Toolbox command:', command);
			if (command === 'copyChat') {
				this.copyCurrentChat();
			} else if (command === 'configureChatProtection') {
				if (this.currentChatId) {
					this.configureChatProtection(this.currentChatId);
				}
			} else if (command === 'localScriptEditor') {
				this.showLocalScriptEditor = true;
			} else if (command === 'exportTxtNovel') {
				this.showTxtNovelExporter = !this.showTxtNovelExporter;
			} else if (command === 'markdownTool') {
				this.showMarkdownTool = true;
			} else if (command === 'scrollNavigator') {
				this.updateScrollStats();
				this.showScrollNavigator = true;
			}
		},
		updateScrollStats() {
			const stats = this.$refs.currentMode?.getScrollStats?.();
			if (stats && typeof stats.percent === 'number') {
				this.currentScrollPercent = Math.round(stats.percent);
			}
		},
		onScrollProgress(percent) {
			if (typeof percent !== 'number') {
				return;
			}
			this.currentScrollPercent = Math.round(percent);
		},
		scrollByPercent(percent) {
			const clamped = Math.min(Math.max(percent, 0), 100);
			console.log('[AppCore] Scroll locator percent', { percent: clamped, totalMessages: this.messageCount });
			if (this.$refs.currentMode?.scrollByPercent) {
				this.$refs.currentMode.scrollByPercent(clamped);
			}
		},
		scrollToMessageIndex(index) {
			const count = this.messageCount;
			if (!count) {
				return;
			}
			const target = Math.min(Math.max(parseInt(index, 10) || 1, 1), count);
			console.log('[AppCore] Scroll locator index', { target, totalMessages: count });
			if (this.$refs.currentMode?.scrollToMessageIndex) {
				this.$refs.currentMode.scrollToMessageIndex(target);
			}
		},
		forkChatAt(index) {
			if (!this.currentChat) return;
			
			const messagesToKeep = this.currentChat.messages.slice(0, index + 1);
			
			const newChat = this.createChatRecord({
				title: this.generateBranchTitle(this.currentChat.title),
				messages: cloneMessagesWithNewIds(messagesToKeep),
				mode: this.currentChat.mode || this.activeMode
			});
			
			this.chatHistory.push(newChat);
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			this.currentChatId = newChat.id;
			localStorage.setItem('bs2_current_chat_id', newChat.id);
			this.saveChatHistory();
			this.$message({ message: '已从此处分叉对话', type: 'success', duration: 2000 });
		},
		generateBranchTitle(originalTitle) {
			const titles = this.chatHistory.map(chat => chat.title);
			return generateUniqueBranchTitle(originalTitle, titles);
		},
		copyCurrentChat() {
			if (!this.currentChat) return;
			const newChat = this.createChatRecord({
				title: this.generateCopyTitle(this.currentChat.title),
				messages: cloneMessagesWithNewIds(this.currentChat.messages),
				mode: this.currentChat.mode || this.activeMode
			});
			this.chatHistory.push(newChat);
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			this.currentChatId = newChat.id;
			localStorage.setItem('bs2_current_chat_id', newChat.id);
			this.saveChatHistory();
			this.$message({ message: '对话已复制', type: 'success', duration: 2000 });
		},
		generateCopyTitle(originalTitle) {
			let baseTitle = originalTitle;
			while (baseTitle.endsWith(COPY_SUFFIX)) {
				baseTitle = baseTitle.slice(0, -COPY_SUFFIX.length);
			}
			if (baseTitle.length > MAX_TITLE_LENGTH - COPY_SUFFIX.length) {
				baseTitle = baseTitle.slice(0, MAX_TITLE_LENGTH - COPY_SUFFIX.length);
			}
			return baseTitle + COPY_SUFFIX;
		},
		selectScript(script) {
			confirmUseScript(script)
				.then(finalScript => {
					if (this.$refs.currentMode) {
						this.$refs.currentMode.inputMessage = finalScript;
						this.focusInput();
					}
					this.showScriptPanel = false;
				})
				.catch(error => {
					console.warn('剧本选择已取消或发生错误:', error);
				});
		},
		enableEditMessage(index) {
			this.editingMessage = {
				index: index,
				content: this.currentChat.messages[index].content
			};
			this.showEditDialog = true;
		},
		async promptPassword(title, message) {
			try {
				const { value } = await this.$prompt(message, title, {
					inputType: 'password',
					inputValue: '',
					inputPlaceholder: '请输入密码',
					confirmButtonText: '确定',
					cancelButtonText: '取消',
					closeOnClickModal: false,
					closeOnPressEscape: true,
					showClose: true
				});
				const password = typeof value === 'string' ? value.trim() : '';
				if (!password) {
					this.$message({ message: '密码不能为空', type: 'warning', duration: 2000 });
					return null;
				}
				return password;
			} catch (err) {
				return null;
			}
		},
		saveEditedMessageDialog(editedContent) {
			if (editedContent) {
				this.currentChat.messages[this.editingMessage.index].content = editedContent;
				this.saveChatHistory();
				this.$message({ message: '消息已更新', type: 'success', duration: 2000 });
				this.showEditDialog = false;
				this.editingMessage = { index: null, content: '' };
			}
		},
		confirmRegenerateMessage() {
			if (!this.currentChat || this.currentChat.messages.length === 0) return;
			
			// 删除最后一条AI消息，插件会重新生成
			const lastMessage = this.currentChat.messages[this.currentChat.messages.length - 1];
			if (lastMessage.role === 'assistant') {
				this.currentChat.messages.pop();
				this.saveChatHistory();
			}
			
			// 通知插件重新发送
			if (this.$refs.currentMode && this.$refs.currentMode.handleSend) {
				// 找到最后一条用户消息
				for (let i = this.currentChat.messages.length - 1; i >= 0; i--) {
					if (this.currentChat.messages[i].role === 'user') {
						this.$refs.currentMode.inputMessage = this.currentChat.messages[i].content;
						this.currentChat.messages.splice(i, 1); // 临时移除用户消息
						this.$refs.currentMode.handleSend();
						break;
					}
				}
			}
		},
		confirmDeleteMessage(index) {
			this.$confirm('确定删除这条消息吗？', '确认删除', {
				confirmButtonText: '删除',
				cancelButtonText: '取消',
				type: 'warning'
			}).then(() => {
				this.currentChat.messages.splice(index, 1);
				this.saveChatHistory();
				this.$message({ message: '消息已删除', type: 'success', duration: 2000 });
			}).catch(() => {});
		},
	toggleReasoning(index) {
		this.currentChat.messages[index].isReasoningCollapsed = !this.currentChat.messages[index].isReasoningCollapsed;
		this.saveChatHistory();
	},
	async prepareExportContent(payload) {
		let shouldEncrypt = false;
		try {
			await this.$confirm('是否为本次导出设置密码？', '导出选项', {
				confirmButtonText: '加密导出',
				cancelButtonText: '明文导出',
				distinguishCancelAndClose: true,
				type: 'warning'
			});
			shouldEncrypt = true;
		} catch (action) {
			if (action === 'close') {
				return null;
			}
		}
		const jsonData = JSON.stringify(payload, null, 2);
		if (!shouldEncrypt) {
			console.log('[AppCore] 导出明文存档');
			return jsonData;
		}
		const password = await this.promptPassword('加密导出', '请输入导出密码');
		if (password === null) {
			return null;
		}
		const encryptedPayload = await encryptTextWithPassword(jsonData, password);
		console.log('[AppCore] 导出加密存档');
		return JSON.stringify(encryptedPayload, null, 2);
	},
	async exportChatArchive() {
		try {
			const payload = {
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'full',
					totalChats: Array.isArray(this.chatHistory) ? this.chatHistory.length : 0
				},
				chatHistory: this.chatHistory
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_history_${new Date().toISOString().slice(0,10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: '存档已导出', type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出存档失败', type: 'error', duration: 2000 });
		}
	},
		exportChatTitles() {
			try {
				const chats = Array.isArray(this.chatHistory) ? this.chatHistory : [];
				const lines = chats.map(c => (c.title && c.title.trim()) ? c.title.trim() : '新对话');
				const text = lines.join('\n');
				const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `chat_titles_${new Date().toISOString().slice(0,10)}.txt`;
				a.click();
				URL.revokeObjectURL(url);
				this.$message({ message: '对话标题列表已导出', type: 'success', duration: 2000 });
			} catch (error) {
				this.$message({ message: '导出对话标题列表失败', type: 'error', duration: 2000 });
			}
		},
	async exportCurrentChatArchive() {
		if (!this.currentChat) {
			this.$message({ message: '暂无当前对话可导出', type: 'warning', duration: 2000 });
			return;
		}
		try {
			const payload = {
				singleChatOnly: true,
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'single',
					totalChats: 1,
					currentChatId: this.currentChat.id
				},
				chatHistory: [JSON.parse(JSON.stringify(this.currentChat))]
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_current_${new Date().toISOString().slice(0,10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: '当前对话已导出', type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出当前对话失败', type: 'error', duration: 2000 });
		}
	},
	importChatArchive(mode) {
		this.importMode = mode;
		this.$refs.importFile.click();
	},
	async parseImportedArchiveText(rawText) {
		const parsed = JSON.parse(rawText);
		if (!parsed?.encrypted) {
			return parseArchiveJson(rawText);
		}
		const password = await this.promptPassword('导入加密存档', '请输入导入密码');
		if (password === null) {
			throw new Error('import_cancelled');
		}
		const decryptedText = await decryptTextWithPassword(parsed, password);
		console.log('[AppCore] 已解密导入存档');
		return parseArchiveJson(decryptedText);
	},
	repairChatData() {
			const repaired = normalizeAndRepairChats(this.chatHistory);
			this.chatHistory = repaired.chats;
			this.syncCurrentChatIdAfterRepair(this.currentChatId, repaired.idMap);
			this.saveChatHistory();
			console.log('[AppCore] 手动统一修复完成', repaired.stats);
			this.$message({
				message: `统一修复完成：修复对话 ${repaired.stats.repairedChatCount} 条，修复消息 ${repaired.stats.repairedMessageCount} 条`,
				type: 'success',
				duration: 2500
			});
		},
	handleImportFile(event) {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async (e) => {
			let importedData = null;
			try {
				importedData = await this.parseImportedArchiveText(e.target.result);
			} catch (err) {
				if (err?.message === 'import_cancelled') {
					return;
				}
				this.$message({ message: '无法解析文件或密码错误，请确认后重试。', type: 'error', duration: 2000 });
				return;
			}
				const { chats, singleChatOnly } = importedData;
				const normalizedImported = normalizeAndRepairChats(chats).chats;
				if (this.importMode === 'overwrite') {
					if (singleChatOnly) {
						this.$message({ message: '单个对话存档仅支持合并导入，禁止覆盖。', type: 'warning', duration: 2500 });
						return;
					}
					this.chatHistory = sortChatsByCreatedTime(normalizedImported);
					if (this.chatHistory.length > 0) {
						this.currentChatId = this.chatHistory[0].id;
						localStorage.setItem('bs2_current_chat_id', this.currentChatId);
					} else {
						this.createNewChat();
					}
					this.$message({ message: '存档已覆盖', type: 'success', duration: 2000 });
				} else if (this.importMode === 'merge') {
					mergeImportedChats(normalizedImported, this.chatHistory);
					const repairedMerged = normalizeAndRepairChats(this.chatHistory);
					this.chatHistory = repairedMerged.chats;
					if (!this.currentChatId && this.chatHistory.length > 0) {
						this.currentChatId = this.chatHistory[0].id;
						localStorage.setItem('bs2_current_chat_id', this.currentChatId);
					}
					this.$message({ message: '存档已合并', type: 'success', duration: 2000 });
				}
				this.saveChatHistory();
			};
			reader.readAsText(file);
			event.target.value = '';
		},
		openExternalLink(url) {
			window.open(url, '_blank');
		}
	}
};
</script>

<style src="./index.css"></style>

<style scoped>
.app-container {
	width: 100vw;
	height: 100vh;
	height: 100dvh;
	position: fixed;
	top: 0;
	left: 0;
}

.main-content {
	height: 100%;
	overflow: hidden;
}

.top-bar-container {
	z-index: 10;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.plugin-container {
	position: relative;
	height: 100%;
}

.scroll-to-bottom-btn {
	position: absolute;
	bottom: 10rem;
	right: 2.5rem;
	width: 3rem;
	height: 3rem;
	background-color: #e5e7eb;
	border-radius: 9999px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 40;
	transition: all 0.3s ease;
	border: none;
	cursor: pointer;
}

.scroll-to-bottom-btn:hover {
	background-color: #d1d5db;
	transform: translateY(-2px);
	box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.scroll-to-bottom-btn:active {
	transform: translateY(0);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.scroll-to-bottom-btn.mobile {
	bottom: 8rem;
	right: 1rem;
	width: 2.75rem;
	height: 2.75rem;
}

@media (max-width: 768px) {
	.mode-selector {
		padding: 0.5rem;
	}
	
	.scroll-to-bottom-btn {
		bottom: 7rem;
		right: 1rem;
		width: 2.5rem;
		height: 2.5rem;
	}
}

@media (min-width: 768px) {
	.main-content {
		border-left: 1px solid #e5e7eb;
	}
}
</style>

<style>
.reasoning-body.collapsed {
	display: none;
}
</style>

