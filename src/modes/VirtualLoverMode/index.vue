<!--
	虚拟恋人模式插件
	与彩彩的对话，体验虚拟恋人的温馨互动
-->
<template>
	<div class="virtual-lover-mode">
		<div class="mode-container">
			<!-- 左侧：对话区域 -->
			<div class="chat-area">
				<div class="chat-header">
					<div class="character-avatar">
						<div class="avatar-circle">
							<span class="avatar-emoji">{{ characterConfig.avatar }}</span>
						</div>
						<div class="character-info">
							<h2 class="character-name">{{ characterConfig.name }}</h2>
							<p class="character-title">{{ characterConfig.title }}</p>
						</div>
					</div>
					<div class="status-indicators">
						<div class="status-dot" :class="{ active: isTyping }"></div>
						<span class="status-text">{{ isTyping ? '正在回复...' : '在线' }}</span>
					</div>
				</div>
				
				<el-main 
					ref="container" 
					class="message-list"
					@scroll="handleScroll"
				>
					<!-- API Key提示 -->
					<template v-if="!hasValidAuth && !messages.length">
						<div class="auth-alert">
							<div class="alert-icon">🔑</div>
							<div class="alert-content">
								<h3 class="alert-title">
									{{ useBackendProxy ? '当前是神秘链接模式，需要配置连接信息' : '请先设置API Key' }}
								</h3>
								<div class="alert-description">
									<template v-if="!useBackendProxy">
										请前往 <a href="https://cloud.siliconflow.cn/i/M9KJQRfy" target="_blank" class="link-text">硅基流动(本项目邀请码)</a><br> 
										注册账号，获取您的 API Key<br>新注册用户有14元免费额度。
									</template>
									<template v-else>
										当前使用神秘链接模式，请配置神秘链接地址和功能密码。
										<br>如需使用API Key模式，请在设置中关闭神秘链接模式。
									</template>
									<br>
									点击右上角
									<el-button type="link" class="settings-link" @click="$emit('open-settings')">
										<el-icon><Setting /></el-icon> 设置
									</el-button>
									按钮配置
								</div>
							</div>
						</div>
					</template>

					<!-- 空状态 -->
					<EmptyState
						v-if="!messages.length && hasValidAuth"
						:title="`与${characterConfig.name}开始对话`"
						:description="characterConfig.description"
						:show-script-selector="true"
						@script-selected="$emit('open-script-panel')"
					>
						<template #extra>
							<!-- 角色选择器 - 只在空对话状态下显示 -->
							<CharacterSelector
								:current-character-key="currentCharacterKey"
								@character-selected="switchCharacter"
							/>
						</template>
					</EmptyState>

				<!-- 消息列表 -->
				<MessageBubble
					v-for="(message, index) in messages"
					:key="index"
					:role="message.role"
					:content="getDisplayContent(message)"
					:reasoning-content="message.reasoning_content"
					:is-reasoning-collapsed="message.isReasoningCollapsed"
					:is-summary="message.isSummary"
					@toggle-reasoning="$emit('toggle-reasoning', index)"
				>
					<template #controls="{ message: msg }">
						<el-tooltip content="复制" placement="top">
							<el-button class="btn-copy" @click="$emit('copy-message', msg.content)">
								<el-icon style="font-size: 1.6rem;"><CopyDocument /></el-icon>
							</el-button>
						</el-tooltip>
						<el-tooltip content="从此处分叉对话(if线)" placement="top">
							<el-button class="btn-fork" @click="$emit('fork-chat', index)">
								<el-icon style="font-size: 1.6rem;"><Share /></el-icon>
							</el-button>
						</el-tooltip>
						<el-tooltip content="编辑" placement="top">
							<el-button class="btn-edit" @click="$emit('edit-message', index)">
								<el-icon style="font-size: 1.6rem;"><Edit /></el-icon>
							</el-button>
						</el-tooltip>
						<template v-if="index === messages.length - 1 && !isTyping">
							<el-tooltip content="重新生成" placement="top">
								<el-button class="btn-refresh" @click="$emit('regenerate-message')">
									<el-icon style="font-size: 1.6rem;"><Refresh /></el-icon>
								</el-button>
							</el-tooltip>
						</template>
						<el-tooltip v-if="message.role === 'assistant' && !isTyping" content="总结对话" placement="top">
							<el-button class="btn-summary" @click="$emit('summary-message', index)">
								<el-icon style="font-size: 1.6rem;"><DocumentCopy /></el-icon>
							</el-button>
						</el-tooltip>
						<el-tooltip content="删除" placement="top">
							<el-button class="btn-delete" @click="$emit('delete-message', index)">
								<el-icon style="font-size: 1.6rem;"><Delete /></el-icon>
							</el-button>
						</el-tooltip>
					</template>
				</MessageBubble>

					<!-- 流式输入指示器 -->
					<div v-if="isTyping" class="typing-indicator">
						<div class="typing-dots">
							<span></span>
							<span></span>
							<span></span>
						</div>
						<span class="typing-text">{{ characterConfig.name }}正在思考...</span>
					</div>
				</el-main>

				<!-- 输入区域 -->
				<ChatInput
					v-model="inputMessage"
					:disabled="isTyping || !hasValidAuth"
					:placeholder="isTyping ? `${characterConfig.name}正在回复...` : `和${characterConfig.name}说点什么吧...`"
					@send="handleSend"
					@focus="$emit('focus-input')"
				/>
			</div>

			<!-- 右侧：状态面板（桌面端） -->
			<div class="status-panel desktop-panel">
				<FavorabilityPanel 
					:favorability="loverData.favorability"
					:last-change="lastFavorabilityChange"
				/>
				
				<CharacterStatus
					:message="lastAssistantMessage"
				/>
				
				<div v-if="isStreaming" class="streaming-indicator">
					<div class="streaming-animation"></div>
					<span>{{ characterConfig.name }}正在回复...</span>
				</div>
			</div>

			<!-- 移动端悬浮按钮 -->
			<button 
				class="mobile-status-fab"
				@click="isMobileStatusPanelOpen = true"
			>
				<span class="fab-icon">📊</span>
				<span class="fab-text">状态</span>
			</button>

			<!-- 移动端设置按钮 -->
			<button 
				class="mobile-settings-fab"
				@click="toggleAutoShowStatus"
				:class="{ active: autoShowStatusPanel }"
			>
				<span class="fab-icon">{{ autoShowStatusPanel ? '🔔' : '🔕' }}</span>
				<span class="fab-text">自动</span>
			</button>

			<!-- 移动端状态面板浮窗 -->
			<transition name="mobile-panel">
				<div 
					v-if="isMobileStatusPanelOpen"
					class="mobile-panel-overlay"
					@click.self="isMobileStatusPanelOpen = false"
				>
					<div class="mobile-panel-container">
						<div class="mobile-panel-header">
							<h3 class="mobile-panel-title">{{ characterConfig.name }}的状态</h3>
							<div class="mobile-panel-controls">
								<button 
									class="mobile-panel-toggle-auto"
									@click="toggleAutoShowStatus"
									:class="{ active: autoShowStatusPanel }"
									title="自动显示状态面板"
								>
									<el-icon><Bell /></el-icon>
								</button>
								<button 
									class="mobile-panel-close"
									@click="isMobileStatusPanelOpen = false"
								>
									<el-icon><Close /></el-icon>
								</button>
							</div>
						</div>
						
						<div class="mobile-panel-content">
							<FavorabilityPanel 
								:favorability="loverData.favorability"
								:last-change="lastFavorabilityChange"
							/>
							
							<CharacterStatus
								:message="lastAssistantMessage"
							/>
							
							<div v-if="isStreaming" class="streaming-indicator">
								<div class="streaming-animation"></div>
								<span>{{ characterConfig.name }}正在回复...</span>
							</div>
						</div>
					</div>
				</div>
			</transition>
		</div>
	</div>
</template>

<script>
import { Setting, CopyDocument, Edit, Refresh, Delete, ArrowDown, ChatDotRound, Close, Bell, DocumentCopy, Share } from '@element-plus/icons-vue';
import { callAiModel } from '@/core/services/aiService';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import FavorabilityPanel from './components/FavorabilityPanel.vue';
import CharacterStatus from './components/CharacterStatus.vue';
import CharacterSelector from './components/CharacterSelector.vue';
import { createStreamJsonParser, createThrottle, createMetadataManager, createAbortManager } from '@/utils/modeHelpers';
import { DEFAULT_CONFIG } from './utils/constants.js';
import { characters, defaultCharacter } from './characters';
import { 
	saveLoverData, 
	saveCharacterState, 
	loadLoverData, 
	loadCharacterState, 
	isAtBottom, 
	scrollToBottom,
	parseMessageContent 
} from './utils/helpers.js';

export default {
	name: 'VirtualLoverMode',
	components: {
		Setting,
		CopyDocument,
		Edit,
		Refresh,
		Delete,
		ArrowDown,
		ChatDotRound,
		Close,
		Bell,
		DocumentCopy,
		Share,
		EmptyState,
		MessageBubble,
		ChatInput,
		FavorabilityPanel,
		CharacterStatus,
		CharacterSelector
	},
	props: {
		config: {
			type: Object,
			required: true
		},
		chat: {
			type: Object,
			required: true
		}
	},
	data() {
		return {
			inputMessage: '',
			isTyping: false,
			isStreaming: false,
			showScrollToBottom: false,
			loverData: { ...DEFAULT_CONFIG },
			characterState: { ...DEFAULT_CONFIG },
			lastFavorabilityChange: null,
			jsonParser: createStreamJsonParser(),
			throttleManager: createThrottle(50),
			abortManager: createAbortManager(),
			isMobileStatusPanelOpen: false,
			autoShowStatusPanel: true,
			currentCharacterKey: defaultCharacter
		};
	},
	computed: {
		messages() {
			return this.chat?.messages || [];
		},
		hasValidAuth() {
			return this.config.useBackendProxy || !!this.config.apiKey;
		},
		useBackendProxy() {
			return this.config.useBackendProxy;
		},
		isDevelopment() {
			return import.meta.env.DEV;
		},
		lastAssistantMessage() {
			const assistantMessages = this.messages.filter(msg => msg.role === 'assistant');
			return assistantMessages[assistantMessages.length - 1] || null;
		},
		characterConfig() {
			return this.currentCharacter;
		},
		currentCharacter() {
			return characters[this.currentCharacterKey];
		}
	},
	mounted() {
		this.initializeData();
	},
	methods: {
		initializeData() {
			// 从聊天元数据中加载角色选择
			if (this.chat.metadata?.currentCharacter) {
				this.currentCharacterKey = this.chat.metadata.currentCharacter;
			}
			
			this.loverData = loadLoverData(this.chat, DEFAULT_CONFIG);
			this.characterState = loadCharacterState(this.chat);
		},
		
		saveLoverData() {
			saveLoverData(this.chat, this.loverData);
		},
		
		saveCharacterState() {
			saveCharacterState(this.chat, this.characterState);
		},
		
		handleScroll(event) {
			const atBottom = isAtBottom(event);
			this.showScrollToBottom = !atBottom;
			this.$emit('scroll-bottom-changed', !atBottom);
		},
		
		scrollToBottomManual() {
			if (this.$refs.container) {
				scrollToBottom(this.$refs.container.$el);
			}
		},
		
		focus() {
			this.$nextTick(() => {
				const input = this.$el.querySelector('textarea');
				if (input) {
					input.focus();
				}
			});
		},
		
		
		async handleSend() {
			if (!this.inputMessage.trim() || this.isTyping) return;
			
			console.log('[VirtualLoverMode] 发送消息:', this.inputMessage);
			
			const userMessage = { role: 'user', content: this.inputMessage.trim() };
			this.chat.messages.push(userMessage);
			console.log('[VirtualLoverMode] 用户消息已添加，消息总数:', this.chat.messages.length);
			this.$emit('update-chat', this.chat);
			
			this.inputMessage = '';
			this.isTyping = true;
			this.isStreaming = true;
			this.jsonParser.reset();
			this.throttleManager.cancel();
			
			const assistantMessage = { 
				role: 'assistant', 
				content: '' 
			};
			this.chat.messages.push(assistantMessage);
			console.log('[VirtualLoverMode] AI消息占位已添加，消息总数:', this.chat.messages.length);
			this.$emit('update-chat', this.chat);
			
			this.$nextTick(() => {
				this.scrollToBottomManual();
			});
			
			const systemPrompt = this.currentCharacter.SYSTEM_PROMPT;

			try {
				const abortController = this.abortManager.create();
				
				let effectiveApiUrl = this.config.apiUrl;
				if (this.useBackendProxy) {
					effectiveApiUrl = this.config.provider === 'gemini' 
						? this.config.backendUrlGemini 
						: this.config.backendUrlDeepseek;
				}

				// 获取有效的消息（处理总结消息）
				const effectiveMessages = this.getEffectiveMessages();
				
				await callAiModel({
					provider: this.config.provider,
					apiUrl: effectiveApiUrl,
					apiKey: this.config.apiKey,
					model: this.config.model,
					messages: [
						{ role: 'system', content: systemPrompt },
						...effectiveMessages.slice(0, -1)
					],
					temperature: this.config.temperature,
					maxTokens: this.config.maxTokens,
					signal: abortController.signal,
					featurePassword: this.config.featurePassword,
					useBackendProxy: this.useBackendProxy,
					geminiReasoningEffort: this.config.geminiReasoningEffort,
					onChunk: (chunk) => {
						this.jsonParser.appendChunk(chunk.content);
						this.updateUIThrottled(assistantMessage);
					}
				});

				console.log('[VirtualLoverMode] AI回复完成');
				
				let finalData = null;
				try {
					finalData = this.jsonParser.parseComplete();
					assistantMessage.content = this.jsonParser.cleanJsonText(this.jsonParser.getBuffer());
					console.log('[VirtualLoverMode] AI回复JSON已存储');
					
					if (finalData.emote) {
						this.characterState.emote = finalData.emote;
					}
					if (finalData.bodyAction) {
						this.characterState.bodyAction = finalData.bodyAction;
					}
					if (finalData.evaluation) {
						this.characterState.evaluation = finalData.evaluation;
					}
					if (finalData.score !== undefined) {
						this.characterState.score = finalData.score;
						
						const favorabilityChange = this.calculateFavorabilityChange(finalData.score);
						if (favorabilityChange !== 0) {
							this.loverData.favorability += favorabilityChange;
							this.lastFavorabilityChange = favorabilityChange;
							
							setTimeout(() => {
								this.lastFavorabilityChange = null;
							}, 2000);
						}
					}
				} catch (e) {
					console.warn('[VirtualLoverMode] JSON解析失败，使用原始内容', e);
					console.warn('[VirtualLoverMode] buffer完整内容:', this.jsonParser.getBuffer());
					assistantMessage.content = this.jsonParser.getBuffer();
				}
				
				this.saveLoverData();
				this.saveCharacterState();
				
				// 检查是否需要自动显示状态面板
				this.$nextTick(() => {
					this.checkAndShowStatusPanel();
				});
				
			} catch (error) {
				console.error('[VirtualLoverMode] AI调用失败:', error);
				this.chat.messages.pop();
				assistantMessage.content = `抱歉，${this.characterConfig.name}现在有点累了，稍后再聊吧~`;
				this.characterState.emote = 6;
			} finally {
				this.throttleManager.cancel();
				this.isTyping = false;
				this.isStreaming = false;
				this.abortManager.abort();
				this.chat.messages = [...this.chat.messages];
				this.$emit('update-chat', this.chat);
				this.scrollToBottomManual();
			}
		},
		
		calculateFavorabilityChange(score) {
			return this.currentCharacter.SCORE_MAP[score]?.favorabilityChange || 0;
		},
		
		updateUIThrottled(assistantMessage) {
			assistantMessage.content = this.jsonParser.getBuffer();
			
			this.throttleManager.execute(() => {
				this.chat.messages = [...this.chat.messages];
				this.$emit('update-chat', this.chat);
				this.$nextTick(() => {
					this.scrollToBottomManual();
				});
			});
		},
		
		getDisplayContent(message) {
			return parseMessageContent(message);
		},
		
		toggleAutoShowStatus() {
			this.autoShowStatusPanel = !this.autoShowStatusPanel;
			console.log('[VirtualLoverMode] 自动显示状态面板:', this.autoShowStatusPanel);
		},
		
		checkAndShowStatusPanel() {
			if (this.autoShowStatusPanel && window.innerWidth <= 768) {
				this.isMobileStatusPanelOpen = true;
				console.log('[VirtualLoverMode] 自动显示状态面板');
			}
		},
		getEffectiveMessages() {
			const messages = this.chat.messages;
			
			let lastSummaryAssistantIndex = -1;
			for (let i = messages.length - 1; i >= 0; i--) {
				if (messages[i].isSummary && messages[i].role === 'assistant') {
					lastSummaryAssistantIndex = i;
					break;
				}
			}
			
			if (lastSummaryAssistantIndex === -1) {
				return messages;
			}
			
			return messages.slice(lastSummaryAssistantIndex);
		},
		
		switchCharacter(characterKey) {
			if (this.currentCharacterKey === characterKey) {
				return;
			}
			
			console.log('[VirtualLoverMode] 切换角色:', characterKey);
			
			// 保存当前角色的状态
			this.saveLoverData();
			this.saveCharacterState();
			
			// 切换角色
			this.currentCharacterKey = characterKey;
			
			// 重新初始化新角色的数据
			this.initializeData();
			
			// 保存角色选择到聊天元数据
			if (!this.chat.metadata) {
				this.chat.metadata = {};
			}
			this.chat.metadata.currentCharacter = characterKey;
			this.$emit('update-chat', this.chat);
			
			console.log('[VirtualLoverMode] 角色切换完成:', this.currentCharacter.name);
		}
	}
};
</script>

<style scoped>
@import './styles/index.css';

.btn-summary {
	background-color: #f0f9ff;
	border-color: #0ea5e9;
	color: #0ea5e9;
}

.btn-summary:hover {
	background-color: #e0f2fe;
	border-color: #0284c7;
	color: #0284c7;
}

</style>
