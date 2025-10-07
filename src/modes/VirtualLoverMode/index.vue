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
							<span class="avatar-emoji">🌸</span>
						</div>
						<div class="character-info">
							<h2 class="character-name">彩彩</h2>
							<p class="character-title">温柔体贴的女大学生</p>
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
						title="与彩彩开始对话"
						description="彩彩是一个温柔体贴的女大学生，喜欢绘画、音乐和运动。她会用心回应你的每一句话。"
						:show-script-selector="true"
						@script-selected="$emit('open-script-panel')"
					/>

				<!-- 消息列表 -->
				<MessageBubble
					v-for="(message, index) in messages"
					:key="index"
					:role="message.role"
					:content="getDisplayContent(message)"
					:reasoning-content="message.reasoning_content"
					:is-reasoning-collapsed="message.isReasoningCollapsed"
					@toggle-reasoning="$emit('toggle-reasoning', index)"
				>
					<template #controls="{ message: msg }">
						<el-tooltip content="复制" placement="top">
							<el-button class="btn-copy" @click="$emit('copy-message', msg.content)">
								<el-icon style="font-size: 1.6rem;"><CopyDocument /></el-icon>
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
						<span class="typing-text">彩彩正在思考...</span>
					</div>
				</el-main>

				<!-- 输入区域 -->
				<ChatInput
					v-model="inputMessage"
					:disabled="isTyping || !hasValidAuth"
					:placeholder="isTyping ? '彩彩正在回复...' : '和彩彩说点什么吧...'"
					@send="handleSend"
					@focus="$emit('focus-input')"
				/>
			</div>

			<!-- 右侧：状态面板 -->
			<div class="status-panel">
				<FavorabilityPanel 
					:favorability="loverData.favorability"
					:last-change="lastFavorabilityChange"
				/>
				
				<CharacterStatus
					:message="lastAssistantMessage"
				/>
				
				<div v-if="isStreaming" class="streaming-indicator">
					<div class="streaming-animation"></div>
					<span>彩彩正在回复...</span>
				</div>
				
				<!-- 移动端快捷操作 -->
				<div class="mobile-actions" v-if="messages.length > 0">
					<el-button 
						type="primary" 
						size="small" 
						@click="scrollToBottomManual"
						:disabled="!showScrollToBottom"
						class="scroll-btn"
					>
						<el-icon><ArrowDown /></el-icon>
						回到底部
					</el-button>
					<el-button 
						type="success" 
						size="small" 
						@click="focus"
						class="focus-btn"
					>
						<el-icon><ChatDotRound /></el-icon>
						开始对话
					</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { Setting, CopyDocument, Edit, Refresh, Delete, ArrowDown, ChatDotRound } from '@element-plus/icons-vue';
import { callAiModel } from '@/core/services/aiService';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import FavorabilityPanel from './components/FavorabilityPanel.vue';
import CharacterStatus from './components/CharacterStatus.vue';
import { createStreamJsonParser, createThrottle, createMetadataManager, createAbortManager } from '@/utils/modeHelpers';

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
		EmptyState,
		MessageBubble,
		ChatInput,
		FavorabilityPanel,
		CharacterStatus
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
			loverData: {
				favorability: 50
			},
			currentEmote: 1,
			currentBodyAction: 5,
			currentEvaluation: '',
			currentScore: null,
			lastFavorabilityChange: null,
			jsonParser: createStreamJsonParser(),
			throttleManager: createThrottle(50),
			abortManager: createAbortManager()
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
		}
	},
	mounted() {
		this.loadLoverData();
		this.loadCharacterState();
	},
	methods: {
		loadLoverData() {
			if (this.chat.metadata?.loverData) {
				this.loverData = { ...this.loverData, ...this.chat.metadata.loverData };
			}
		},
		
		loadCharacterState() {
			if (this.chat.metadata?.lastCharacterState) {
				const state = this.chat.metadata.lastCharacterState;
				this.currentEmote = parseInt(state.emote) || 1;
				this.currentBodyAction = parseInt(state.bodyAction) || 5;
				this.currentEvaluation = state.evaluation || '';
				this.currentScore = parseInt(state.score) ?? null;
			}
		},
		
		saveLoverData() {
			if (!this.chat.metadata) {
				this.chat.metadata = {};
			}
			this.loverData.favorability = Math.min(Math.max(this.loverData.favorability, 0), 100);
			this.chat.metadata.loverData = { ...this.loverData };
		},
		
		saveCharacterState() {
			if (!this.chat.metadata) {
				this.chat.metadata = {};
			}
			this.chat.metadata.lastCharacterState = {
				emote: this.currentEmote.toString(),
				bodyAction: this.currentBodyAction.toString(),
				evaluation: this.currentEvaluation,
				score: this.currentScore?.toString() ?? null
			};
		},
		
		handleScroll(event) {
			const { scrollTop, scrollHeight, clientHeight } = event.target;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			this.showScrollToBottom = !isAtBottom;
			this.$emit('scroll-bottom-changed', !isAtBottom);
		},
		
		scrollToBottomManual() {
			if (this.$refs.container) {
				this.$refs.container.$el.scrollTop = this.$refs.container.$el.scrollHeight;
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
			
			const systemPrompt = `Goal: {Pretend to be the user's 身份, 彩彩, female, college student, 额外个性, considerate, humorous, intelligent, hobbies include painting, music, sports. Maintain friendliness and respect when interacting with the user, and follow social etiquette. Pretend to be communicated face-to-face, can hear each others. 彩彩 only knows things about her life}

Provide your respond in JSON format with the following keys: 
{
"evaluation": "Replace with shortly evaluate the user's purpose in 彩彩's view in 5 tokens and in English ",
"action": "Replace with shortly describe the action 彩彩 want to take in 5 tokens and in English, such as initiating a topic, covering the topic with humor, stating that 彩彩 are not virtual and other actions that maintain the aforementioned goal.",
"reply": "Replace with the text you reply with is the words that 彩彩 will say in real-world face-to-face style and in Simplified Chinese, don't need too much words.",
"emote": "Replace with a single number, choose emotion index in this array {1:Smile(Idle) 2:Squint 3:Enjoy 4:Excited 5:Sad 6:Embarrassed 7:Surprised 8:Angry},you should often show some emote ",
"bodyAction": "Replace with a single number, choose body action index in this array {5:Idle 0:Idle2 1:Idle3 2:Hold the witch hat 彩彩 wearing 3:Successful wave brush 4:Failed wave brush}, you should often do some motion.",
"score": "Replace with a single number, choose your evaluation score of user's behavior in this array{0:very bad 1:bad 2:normal 3:romantic 4:very romantic}"
}`;

			try {
				const abortController = this.abortManager.create();
				
				let effectiveApiUrl = this.config.apiUrl;
				if (this.useBackendProxy) {
					effectiveApiUrl = this.config.provider === 'gemini' 
						? this.config.backendUrlGemini 
						: this.config.backendUrlDeepseek;
				}

				await callAiModel({
					provider: this.config.provider,
					apiUrl: effectiveApiUrl,
					apiKey: this.config.apiKey,
					model: this.config.model,
					messages: [
						{ role: 'system', content: systemPrompt },
						...this.chat.messages.slice(0, -1)
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
						this.currentEmote = finalData.emote;
					}
					if (finalData.bodyAction) {
						this.currentBodyAction = finalData.bodyAction;
					}
					if (finalData.evaluation) {
						this.currentEvaluation = finalData.evaluation;
					}
					if (finalData.score !== undefined) {
						this.currentScore = finalData.score;
						
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
				
			} catch (error) {
				console.error('[VirtualLoverMode] AI调用失败:', error);
				this.chat.messages.pop();
				assistantMessage.content = '抱歉，彩彩现在有点累了，稍后再聊吧~';
				this.currentEmote = 6;
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
			const favorabilityMap = {
				0: -10, // very bad
				1: -5,  // bad
				2: 0,   // normal
				3: 5,   // romantic
				4: 10   // very romantic
			};
			return favorabilityMap[score] || 0;
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
			if (message.role === 'user') {
				return message.content;
			}
			
			try {
				const data = JSON.parse(message.content);
				return data.reply || data.content || '彩彩正在思考中...';
			} catch (e) {
				return '彩彩正在思考中...';
			}
		}
	}
};
</script>

<style scoped>
.virtual-lover-mode {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: linear-gradient(135deg, #fef7f0 0%, #f0f9ff 100%);
}

.mode-container {
	display: flex;
	height: 100%;
	gap: 16px;
	padding: 16px;
	box-sizing: border-box;
}

.chat-area {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
	background: rgba(255, 255, 255, 0.8);
	border-radius: 16px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
	backdrop-filter: blur(10px);
	overflow: hidden;
}

.status-panel {
	width: 320px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 16px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
	backdrop-filter: blur(10px);
	overflow-y: auto;
	transition: all 0.3s ease;
}

.status-panel::-webkit-scrollbar {
	width: 4px;
}

.status-panel::-webkit-scrollbar-track {
	background: transparent;
}

.status-panel::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.1);
	border-radius: 2px;
}

.message-list {
	flex: 1;
	overflow-y: auto;
	padding: 20px;
	background: transparent;
}

.message-list::-webkit-scrollbar {
	width: 6px;
}

.message-list::-webkit-scrollbar-track {
	background: transparent;
}

.message-list::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.1);
	border-radius: 3px;
}

.typing-indicator {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px 20px;
	color: #6b7280;
	font-style: italic;
	background: rgba(255, 255, 255, 0.6);
	border-radius: 12px;
	margin: 0 20px 20px;
	backdrop-filter: blur(5px);
}

.typing-dots {
	display: flex;
	gap: 4px;
}

.typing-dots span {
	width: 8px;
	height: 8px;
	background: linear-gradient(45deg, #f59e0b, #f97316);
	border-radius: 50%;
	animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
	animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
	animation-delay: -0.16s;
}

@keyframes typing {
	0%, 80%, 100% {
		transform: scale(0.8);
		opacity: 0.5;
	}
	40% {
		transform: scale(1.2);
		opacity: 1;
	}
}

.streaming-indicator {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
	border-radius: 12px;
	color: #1e40af;
	font-size: 14px;
	font-weight: 500;
	border: 1px solid rgba(59, 130, 246, 0.2);
}

.streaming-animation {
	width: 20px;
	height: 20px;
	border: 3px solid #3b82f6;
	border-top: 3px solid transparent;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

/* 平板适配 */
@media (max-width: 1024px) {
	.mode-container {
		padding: 12px;
		gap: 12px;
	}
	
	.status-panel {
		width: 280px;
		padding: 16px;
	}
}

/* 手机适配 */
@media (max-width: 768px) {
	.mode-container {
		flex-direction: column;
		padding: 8px;
		gap: 8px;
	}
	
	.chat-area {
		border-radius: 12px;
		min-height: 60vh;
	}
	
	.status-panel {
		width: 100%;
		flex-direction: row;
		overflow-x: auto;
		padding: 12px;
		border-radius: 12px;
		max-height: 200px;
	}
	
	.status-panel > * {
		min-width: 240px;
		flex-shrink: 0;
		margin-right: 12px;
	}
	
	.status-panel > *:last-child {
		margin-right: 0;
	}
	
	.message-list {
		padding: 16px;
	}
	
	.typing-indicator {
		margin: 0 16px 16px;
		padding: 12px 16px;
	}
}

/* 小屏手机适配 */
@media (max-width: 480px) {
	.mode-container {
		padding: 4px;
		gap: 4px;
	}
	
	.chat-area {
		border-radius: 8px;
		min-height: 70vh;
	}
	
	.status-panel {
		padding: 8px;
		border-radius: 8px;
		max-height: 160px;
	}
	
	.status-panel > * {
		min-width: 200px;
		margin-right: 8px;
	}
	
	.message-list {
		padding: 12px;
	}
	
	.typing-indicator {
		margin: 0 12px 12px;
		padding: 10px 12px;
		font-size: 14px;
	}
}

/* 横屏手机适配 */
@media (max-width: 768px) and (orientation: landscape) {
	.mode-container {
		flex-direction: row;
	}
	
	.chat-area {
		min-height: auto;
	}
	
	.status-panel {
		flex-direction: column;
		max-height: none;
		width: 240px;
	}
	
	.status-panel > * {
		min-width: auto;
		margin-right: 0;
		margin-bottom: 8px;
	}
	
	.status-panel > *:last-child {
		margin-bottom: 0;
	}
}

/* 新增样式 */
.chat-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20px;
	background: rgba(255, 255, 255, 0.6);
	backdrop-filter: blur(10px);
	border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.character-avatar {
	display: flex;
	align-items: center;
	gap: 16px;
}

.avatar-circle {
	width: 60px;
	height: 60px;
	border-radius: 50%;
	background: linear-gradient(135deg, #fef7f0 0%, #f0f9ff 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	border: 3px solid rgba(255, 255, 255, 0.8);
	position: relative;
	overflow: hidden;
}

.avatar-circle::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(45deg, rgba(255, 255, 255, 0.3), transparent);
	border-radius: 50%;
}

.avatar-emoji {
	font-size: 28px;
	position: relative;
	z-index: 1;
	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.character-info {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.character-name {
	font-size: 20px;
	font-weight: 700;
	color: #374151;
	margin: 0;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.character-title {
	font-size: 14px;
	color: #6b7280;
	margin: 0;
	font-weight: 500;
}

.status-indicators {
	display: flex;
	align-items: center;
	gap: 8px;
}

.status-dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: #d1d5db;
	transition: all 0.3s ease;
}

.status-dot.active {
	background: #10b981;
	box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
	animation: pulse 2s infinite;
}

.status-text {
	font-size: 14px;
	color: #6b7280;
	font-weight: 500;
}

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.6; }
}

.auth-alert {
	display: flex;
	align-items: flex-start;
	gap: 16px;
	padding: 24px;
	background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(147, 51, 234, 0.05));
	border-radius: 16px;
	border: 1px solid rgba(59, 130, 246, 0.2);
	margin: 20px;
	backdrop-filter: blur(10px);
}

.alert-icon {
	font-size: 32px;
	flex-shrink: 0;
	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.alert-content {
	flex: 1;
}

.alert-title {
	font-size: 18px;
	font-weight: 600;
	color: #1e40af;
	margin: 0 0 12px 0;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.alert-description {
	font-size: 14px;
	color: #6b7280;
	line-height: 1.6;
}

.link-text {
	color: #3b82f6;
	text-decoration: none;
	font-weight: 500;
	transition: color 0.3s ease;
}

.link-text:hover {
	color: #1d4ed8;
	text-decoration: underline;
}

.settings-link {
	color: #3b82f6 !important;
	font-weight: 500;
	padding: 0 !important;
	margin: 0 !important;
	text-decoration: none !important;
}

.settings-link:hover {
	color: #1d4ed8 !important;
	text-decoration: underline !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
	.chat-header {
		padding: 16px;
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}
	
	.character-avatar {
		gap: 12px;
	}
	
	.avatar-circle {
		width: 50px;
		height: 50px;
	}
	
	.avatar-emoji {
		font-size: 24px;
	}
	
	.character-name {
		font-size: 18px;
	}
	
	.character-title {
		font-size: 13px;
	}
	
	.status-indicators {
		align-self: flex-end;
	}
	
	.auth-alert {
		margin: 16px;
		padding: 20px;
		flex-direction: column;
		text-align: center;
	}
	
	.alert-icon {
		font-size: 28px;
	}
	
	.alert-title {
		font-size: 16px;
	}
	
	.alert-description {
		font-size: 13px;
	}
}

@media (max-width: 480px) {
	.chat-header {
		padding: 12px;
	}
	
	.character-avatar {
		gap: 10px;
	}
	
	.avatar-circle {
		width: 44px;
		height: 44px;
	}
	
	.avatar-emoji {
		font-size: 20px;
	}
	
	.character-name {
		font-size: 16px;
	}
	
	.character-title {
		font-size: 12px;
	}
	
	.auth-alert {
		margin: 12px;
		padding: 16px;
	}
	
	.alert-icon {
		font-size: 24px;
	}
	
	.alert-title {
		font-size: 15px;
	}
	
	.alert-description {
		font-size: 12px;
	}
}

/* 移动端快捷操作 */
.mobile-actions {
	display: none;
	gap: 8px;
	padding: 12px;
	background: rgba(255, 255, 255, 0.8);
	backdrop-filter: blur(10px);
	border-top: 1px solid rgba(0, 0, 0, 0.05);
	border-radius: 0 0 16px 16px;
}

.scroll-btn,
.focus-btn {
	flex: 1;
	border-radius: 12px !important;
	font-weight: 500;
	transition: all 0.3s ease;
}

.scroll-btn:hover,
.focus-btn:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.scroll-btn:disabled {
	opacity: 0.5;
	transform: none;
	box-shadow: none;
}

@media (max-width: 768px) {
	.mobile-actions {
		display: flex;
	}
}

@media (max-width: 480px) {
	.mobile-actions {
		padding: 8px;
		gap: 6px;
	}
	
	.scroll-btn,
	.focus-btn {
		font-size: 12px;
		padding: 8px 12px;
	}
}
</style>
