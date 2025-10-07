<!--
	虚拟恋人模式插件
	与彩彩的对话，体验虚拟恋人的温馨互动
-->
<template>
	<div class="virtual-lover-mode">
		<div class="mode-container">
			<!-- 左侧：对话区域 -->
			<div class="chat-area">
				<el-main 
					ref="container" 
					class="message-list"
					@scroll="handleScroll"
				>
					<!-- API Key提示 -->
					<template v-if="!hasValidAuth && !messages.length">
						<el-alert type="info" :closable="false" show-icon>
							<template #title>
								<div class="text-lg font-semibold text-primary">
									{{ useBackendProxy ? '当前是神秘链接模式，需要配置连接信息' : '请先设置API Key' }}
								</div>
							</template>
							<template #default>
								<div class="text-base text-customGray">
									<template v-if="!useBackendProxy">
										请前往 <a href="https://cloud.siliconflow.cn/i/M9KJQRfy" target="_blank" class="text-secondary underline">硅基流动(本项目邀请码)</a><br> 
										注册账号，获取您的 API Key<br>新注册用户有14元免费额度。
									</template>
									<template v-else>
										当前使用神秘链接模式，请配置神秘链接地址和功能密码。
										<br>如需使用API Key模式，请在设置中关闭神秘链接模式。
									</template>
									<br>
									点击右上角
									<el-button type="link" class="inline-block text-blue-500 p-0" @click="$emit('open-settings')">
										<el-icon><Setting /></el-icon> 设置
									</el-button>
									按钮配置
								</div>
							</template>
						</el-alert>
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
					:content="message.content"
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
					:emote="currentEmote"
					:body-action="currentBodyAction"
					:evaluation="currentEvaluation"
					:score="currentScore"
				/>
				
				<div v-if="isStreaming" class="streaming-indicator">
					<div class="streaming-animation"></div>
					<span>彩彩正在回复...</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { Setting, CopyDocument, Edit, Refresh, Delete } from '@element-plus/icons-vue';
import { callAiModel } from '@/utils/aiService';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import FavorabilityPanel from './components/FavorabilityPanel.vue';
import CharacterStatus from './components/CharacterStatus.vue';

export default {
	name: 'VirtualLoverMode',
	components: {
		Setting,
		CopyDocument,
		Edit,
		Refresh,
		Delete,
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
			jsonBuffer: '',
			showScrollToBottom: false,
			loverData: {
				favorability: 50
			},
			currentEmote: 1,
			currentBodyAction: 5,
			currentEvaluation: '',
			currentScore: null,
			lastFavorabilityChange: null
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
				this.currentEmote = state.emote || 1;
				this.currentBodyAction = state.bodyAction || 5;
				this.currentEvaluation = state.evaluation || '';
				this.currentScore = state.score ?? null;
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
				emote: this.currentEmote,
				bodyAction: this.currentBodyAction,
				evaluation: this.currentEvaluation,
				score: this.currentScore
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
			this.jsonBuffer = '';
			
			const assistantMessage = { 
				role: 'assistant', 
				content: '', 
				metadata: {} 
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
				await callAiModel({
					...this.config,
					messages: [
						{ role: 'system', content: systemPrompt },
						...this.chat.messages
					],
					onChunk: (chunk) => {
						this.jsonBuffer += chunk.content;
						
						const replyMatch = this.jsonBuffer.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
						if (replyMatch && replyMatch[1]) {
							assistantMessage.content = replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
						} else {
							assistantMessage.content = this.jsonBuffer;
						}
						
						try {
							const data = JSON.parse(this.jsonBuffer);
							assistantMessage.content = data.reply || data.content;
							
							if (data.emote) {
								this.currentEmote = data.emote;
								assistantMessage.metadata.emote = data.emote;
							}
							if (data.bodyAction) {
								this.currentBodyAction = data.bodyAction;
								assistantMessage.metadata.bodyAction = data.bodyAction;
							}
							if (data.evaluation) {
								this.currentEvaluation = data.evaluation;
								assistantMessage.metadata.evaluation = data.evaluation;
							}
							if (data.score !== undefined) {
								this.currentScore = data.score;
								assistantMessage.metadata.score = data.score;
							}
						} catch (e) {
						}
						
						this.chat.messages = [...this.chat.messages];
						this.$emit('update-chat', this.chat);
						
						this.$nextTick(() => {
							this.scrollToBottomManual();
						});
					},
					onDone: () => {
						console.log('[VirtualLoverMode] AI回复完成');
						this.isTyping = false;
						this.isStreaming = false;
						
						let finalData = null;
						try {
							finalData = JSON.parse(this.jsonBuffer);
							assistantMessage.content = finalData.reply || finalData.content;
							console.log('[VirtualLoverMode] AI回复内容:', assistantMessage.content);
							
							if (finalData.emote) {
								this.currentEmote = finalData.emote;
								assistantMessage.metadata.emote = finalData.emote;
							}
							if (finalData.bodyAction) {
								this.currentBodyAction = finalData.bodyAction;
								assistantMessage.metadata.bodyAction = finalData.bodyAction;
							}
							if (finalData.evaluation) {
								this.currentEvaluation = finalData.evaluation;
								assistantMessage.metadata.evaluation = finalData.evaluation;
							}
							if (finalData.score !== undefined) {
								this.currentScore = finalData.score;
								assistantMessage.metadata.score = finalData.score;
								
								const favorabilityChange = this.calculateFavorabilityChange(finalData.score);
								if (favorabilityChange !== 0) {
									this.loverData.favorability += favorabilityChange;
									this.lastFavorabilityChange = favorabilityChange;
									assistantMessage.metadata.favorabilityChange = favorabilityChange;
									
									setTimeout(() => {
										this.lastFavorabilityChange = null;
									}, 2000);
								}
							}
						} catch (e) {
							console.warn('[VirtualLoverMode] JSON解析失败，使用原始内容', e);
							assistantMessage.content = this.jsonBuffer;
						}
						
						this.saveLoverData();
						this.saveCharacterState();
						this.$emit('update-chat', this.chat);
						this.scrollToBottomManual();
					}
				});
			} catch (error) {
				console.error('[VirtualLoverMode] AI调用失败:', error);
				this.isTyping = false;
				this.isStreaming = false;
				assistantMessage.content = '抱歉，彩彩现在有点累了，稍后再聊吧~';
				this.currentEmote = 6;
				this.$emit('update-chat', this.chat);
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
		}
	}
};
</script>

<style scoped>
.virtual-lover-mode {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.mode-container {
	display: flex;
	height: 100%;
	gap: 16px;
}

.chat-area {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.status-panel {
	width: 280px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px;
	background: linear-gradient(135deg, #fef7f0 0%, #f0f9ff 100%);
	border-left: 1px solid #e5e7eb;
	overflow-y: auto;
}

.message-list {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
}

.typing-indicator {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 16px;
	color: #6b7280;
	font-style: italic;
}

.typing-dots {
	display: flex;
	gap: 4px;
}

.typing-dots span {
	width: 6px;
	height: 6px;
	background-color: #9ca3af;
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
		transform: scale(1);
		opacity: 1;
	}
}

.streaming-indicator {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px;
	background: rgba(59, 130, 246, 0.1);
	border-radius: 8px;
	color: #1e40af;
	font-size: 14px;
}

.streaming-animation {
	width: 16px;
	height: 16px;
	border: 2px solid #3b82f6;
	border-top: 2px solid transparent;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

@media (max-width: 768px) {
	.mode-container {
		flex-direction: column;
	}
	
	.status-panel {
		width: 100%;
		flex-direction: row;
		overflow-x: auto;
		padding: 12px;
	}
	
	.status-panel > * {
		min-width: 200px;
		flex-shrink: 0;
	}
}
</style>
