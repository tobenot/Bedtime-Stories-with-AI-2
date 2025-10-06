<!--
	微内核主应用
	负责插件加载、路由管理、全局状态管理
-->
<template>
	<div class="app-container flex h-screen">
		<!-- 侧边栏 -->
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

		<!-- 主内容区 -->
		<div class="main-content flex-1 flex flex-col">
			<!-- 顶部栏 -->
			<HeaderBar
				:title="currentChat?.title || '与AI的睡前故事 2'"
				:can-export="!!currentChat?.messages?.length"
				@toggle-sidebar="toggleSidebar"
				@toolbox-command="handleToolboxCommand"
				@export-pdf="exportToPDF"
				@open-settings="showSettings = true"
			/>
			
			<!-- 模式选择器 -->
			<div class="mode-selector p-2 border-b border-gray-200">
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

			<!-- 模型选择器 -->
			<ModelSelector
				:selected-model="model"
				:models="models"
				@update:model="model = $event; saveModel()"
			/>

			<!-- 动态加载的插件组件 -->
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
				ref="currentMode"
			/>

			<!-- 滚动到底部按钮 -->
			<button
				v-if="showScrollToBottom"
				@click="scrollToBottomManual"
				class="fixed bottom-40 right-10 w-12 h-12 bg-gray-200 rounded-full shadow-neumorphic flex items-center justify-center focus:outline-none z-50"
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
import { listModelsByProvider } from '@/core/services/aiService';
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
import scripts from './config/scripts.js';
import { exportChatToPDF } from './utils/pdfExporter';
import { parseArchiveJson, mergeImportedChats } from '@/utils/archive.js';
import confirmUseScript from './utils/scriptPreview.js';
import { COPY_SUFFIX, MAX_TITLE_LENGTH } from '@/config/constants.js';

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
		MarkdownTool
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
			showEditDialog: false,
			showTxtNovelExporter: false,
			
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
				featurePassword: this.featurePassword,
				geminiReasoningEffort: this.geminiReasoningEffort,
				defaultHideReasoning: this.defaultHideReasoning,
				autoCollapseReasoning: this.autoCollapseReasoning
			};
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
			this.activeMode = 'standard-chat';
		}
		pluginSystem.setActive(this.activeMode);
		
		// 加载对话历史
		this.loadChatHistory();
		
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
		loadChatHistory() {
			const savedHistory = localStorage.getItem('bs2_chat_history');
			if (savedHistory) {
				this.chatHistory = JSON.parse(savedHistory);
				if (this.chatHistory.length > 0) {
					const savedCurrentChatId = localStorage.getItem('bs2_current_chat_id');
					if (savedCurrentChatId) {
						const savedChat = this.chatHistory.find(chat => chat.id == savedCurrentChatId);
						this.currentChatId = savedChat ? savedChat.id : this.chatHistory[0].id;
					} else {
						this.currentChatId = this.chatHistory[0].id;
					}
				}
			}
			if (!this.currentChatId) {
				this.createNewChat();
			}
		},
		handleModeChange(modeId) {
			console.log('[AppCore] Mode changed to:', modeId);
			pluginSystem.setActive(modeId);
			localStorage.setItem('bs2_active_mode', modeId);
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
		},
		createNewChat() {
			const newChat = {
				id: Date.now(),
				title: '新对话',
				messages: [],
				createdAt: new Date().toISOString(),
				mode: this.activeMode
			};
			this.chatHistory.unshift(newChat);
			this.currentChatId = newChat.id;
			localStorage.setItem('bs2_current_chat_id', newChat.id.toString());
			this.saveChatHistory();
			if (!this.isDesktop) this.showSidebar = false;
		},
		switchChat(chatId) {
			this.currentChatId = chatId;
			localStorage.setItem('bs2_current_chat_id', chatId.toString());
			if (!this.isDesktop) this.showSidebar = false;
		},
		deleteChat(chatId) {
			const index = this.chatHistory.findIndex(chat => chat.id === chatId);
			if (index !== -1) {
				this.chatHistory.splice(index, 1);
				if (this.chatHistory.length === 0) {
					this.createNewChat();
				} else if (this.currentChatId === chatId) {
					this.currentChatId = this.chatHistory[0].id;
					localStorage.setItem('bs2_current_chat_id', this.currentChatId.toString());
				}
				this.saveChatHistory();
			}
		},
		saveChatHistory() {
			localStorage.setItem('bs2_chat_history', JSON.stringify(this.chatHistory));
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
			} else if (command === 'localScriptEditor') {
				this.showLocalScriptEditor = true;
			} else if (command === 'exportTxtNovel') {
				this.showTxtNovelExporter = !this.showTxtNovelExporter;
			} else if (command === 'markdownTool') {
				this.showMarkdownTool = true;
			}
		},
		copyCurrentChat() {
			if (!this.currentChat) return;
			const newChat = {
				id: Date.now(),
				title: this.generateCopyTitle(this.currentChat.title),
				messages: JSON.parse(JSON.stringify(this.currentChat.messages)),
				createdAt: new Date().toISOString(),
				mode: this.currentChat.mode || this.activeMode
			};
			this.chatHistory.unshift(newChat);
			this.currentChatId = newChat.id;
			localStorage.setItem('bs2_current_chat_id', newChat.id.toString());
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
			// 重新生成逻辑将由插件实现
			console.log('[AppCore] Regenerate message requested');
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
		exportChatArchive() {
			try {
				const jsonData = JSON.stringify(this.chatHistory, null, 2);
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
		importChatArchive(mode) {
			this.importMode = mode;
			this.$refs.importFile.click();
		},
		handleImportFile(event) {
			const file = event.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				let importedData = null;
				try {
					importedData = parseArchiveJson(e.target.result);
				} catch (err) {
					this.$message({ message: '无法解析文件，请确认文件格式正确。', type: 'error', duration: 2000 });
					return;
				}
				if (this.importMode === 'overwrite') {
					this.chatHistory = importedData;
					if (this.chatHistory.length > 0) {
						this.currentChatId = this.chatHistory[0].id;
						localStorage.setItem('bs2_current_chat_id', this.currentChatId.toString());
					} else {
						this.createNewChat();
					}
					this.$message({ message: '存档已覆盖', type: 'success', duration: 2000 });
				} else if (this.importMode === 'merge') {
					mergeImportedChats(importedData, this.chatHistory);
					if (!this.currentChatId && this.chatHistory.length > 0) {
						this.currentChatId = this.chatHistory[0].id;
						localStorage.setItem('bs2_current_chat_id', this.currentChatId.toString());
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

<style>
.reasoning-body.collapsed {
	display: none;
}
</style>

