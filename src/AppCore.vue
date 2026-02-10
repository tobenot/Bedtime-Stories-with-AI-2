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
					@toggle-message-collapse="toggleMessageCollapse"
					@update-chat="saveChatHistory"
					@scroll-bottom-changed="showScrollToBottom = $event"
					@scroll-progress="onScrollProgress"
					@fork-chat="forkChatAt"
					@request-edit-current-chat-title="requestEditCurrentChatTitle"
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
import { getApiKeyForUrl, migrateOldApiKeys } from '@/utils/keyManager';
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
import { appCoreMethods } from './appCore/methods';

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
			verifiedProtectedChatId: null,
			importMode: null,

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
		...appCoreMethods
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

