<!--
	标准对话模式插件
	提供基础的AI对话功能
-->
<template>
	<div class="standard-chat-mode">
		<el-main 
			ref="container" 
			class="message-list"
			@scroll="handleScroll"
		>
			<!-- Debug info (only in development) -->
			<div v-if="isDevelopment" class="debug-info bg-yellow-100 p-2 mb-4 rounded text-xs">
				<strong>Debug Info:</strong> 
				Messages: {{ messages.length }}, 
				API Key: {{ !!apiKey }}, 
				Backend Proxy: {{ useBackendProxy }}, 
				Typing: {{ isTyping }}
			</div>
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
				v-else-if="!messages.length"
				title="开始新的对话吧！"
				:description="emptyDescription"
			>
				<template #icon>
					<img src="/logo.svg" alt="Logo" class="w-12 h-12 inline-block" />
				</template>
				<template #default>
					<div class="software-info mb-4">
						<h1 class="software-title text-3xl font-bold text-primary">与AI的睡前故事 2</h1>
						<p class="software-author text-lg text-gray-700">作者：tobenot</p>
						<p class="software-message text-sm text-gray-600">
							因为喜欢和AI玩文字游戏和聊各种东西，所以做了这个项目，希望你也喜欢！
						</p>
					</div>
				</template>
				<template #actions>
					<el-button class="btn-small" @click="$emit('focus-input')">手动输入</el-button>
					<el-button class="btn-small ml-2" @click="$emit('open-script-panel')">选择剧本</el-button>
				</template>
			</EmptyState>

			<!-- 消息列表 -->
			<template v-else>
				<MessageBubble
					v-for="(msg, index) in messages"
					:key="index"
					:role="msg.role"
					:content="msg.content"
					:reasoning-content="msg.reasoning_content"
					:is-reasoning-collapsed="msg.isReasoningCollapsed"
					:is-summary="msg.isSummary"
				>
					<template #controls="{ message }">
						<MessageControls
							:message="message"
							:index="index"
							:is-last="index === messages.length - 1"
							:is-typing="isTyping"
							@copy="$emit('copy-message', message.content)"
							@edit="$emit('edit-message', index)"
							@regenerate="$emit('regenerate-message')"
							@delete="$emit('delete-message', index)"
							@toggle-reasoning="$emit('toggle-reasoning', index)"
							@summary="handleSummary(index)"
							@fork="$emit('fork-chat', index)"
						/>
					</template>
				</MessageBubble>
				
				<!-- 输入中指示器 -->
				<div v-if="isTyping" class="message-bubble assistant-message">
					<div class="typing-indicator">
						<div class="dot" style="animation-delay: 0s"></div>
						<div class="dot" style="animation-delay: 0.2s"></div>
						<div class="dot" style="animation-delay: 0.4s"></div>
					</div>
				</div>
			</template>
		</el-main>

		<!-- 输入区域 -->
		<ChatInput
			v-model="inputMessage"
			:disabled="!hasValidAuth"
			:is-loading="isLoading"
			:error-message="errorMessage"
			@send="handleSend"
			@cancel="handleCancel"
			ref="inputRef"
		/>
	</div>
</template>

<script>
import { Setting } from '@element-plus/icons-vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageControls from './components/MessageControls.vue';
import { throttle } from '@/utils/throttleHelper';

export default {
	name: 'StandardChatMode',
	components: {
		Setting,
		MessageBubble,
		ChatInput,
		EmptyState,
		MessageControls
	},
	props: {
		// 从微内核传入的配置
		config: {
			type: Object,
			default: () => ({})
		},
		// 当前对话数据
		chat: {
			type: Object,
			default: null
		}
	},
	emits: [
		'open-settings',
		'focus-input',
		'open-script-panel',
		'copy-message',
		'edit-message',
		'regenerate-message',
		'delete-message',
		'toggle-reasoning',
		'update-chat',
		'scroll-bottom-changed',
		'summary-message',
		'fork-chat'
	],
	data() {
		return {
			inputMessage: '',
			isLoading: false,
			isTyping: false,
			errorMessage: '',
			abortController: null,
			isAtBottom: true,
			throttledScroll: null
		};
	},
	computed: {
		apiKey() {
			return this.config.apiKey || '';
		},
		useBackendProxy() {
			return this.config.useBackendProxy || false;
		},
		hasValidAuth() {
			return this.useBackendProxy || !!this.apiKey;
		},
		emptyDescription() {
			return '如果你要把这里当做普通的对话，请直接像在官方app那样使用~\n如果你要玩剧本，请选择剧本，或者自己在下方输入框输入你想要的故事开头！';
		},
		messages() {
			return this.chat?.messages || [];
		},
		isDevelopment() {
			return import.meta.env.DEV;
		}
	},
	watch: {
		messages: {
			handler(newMessages, oldMessages) {
				if (newMessages.length > (oldMessages?.length || 0)) {
					this.$nextTick(() => {
						this.scrollToBottom();
					});
				}
			},
			deep: true
		}
	},
	mounted() {
		console.log('[StandardChatMode] Mounted');
		this.throttledScroll = throttle(() => {
			this.scrollToBottom();
		}, 100);
		this.$nextTick(() => {
			this.emitScrollState();
			this.isAtBottom = true;
		});
	},
	methods: {
		handleScroll() {
			this.emitScrollState();
		},
		emitScrollState() {
			let container = this.$refs.container;
			if (container && container.$el) container = container.$el;
			if (!container) return;
			
			const threshold = 50;
			const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
			this.isAtBottom = distanceFromBottom <= threshold;
			
			this.$emit('scroll-bottom-changed', distanceFromBottom > 150);
		},
		async handleSend() {
			if (!this.inputMessage.trim() || this.isLoading) {
				return;
			}

			console.log('[StandardChatMode] Send message:', this.inputMessage);

			const userMessage = {
				role: 'user',
				content: this.inputMessage.trim()
			};

			this.chat.messages.push(userMessage);
			this.$emit('update-chat');
			this.isAtBottom = true;
			
			const inputText = this.inputMessage;
			this.inputMessage = '';
			this.isLoading = true;
			this.isTyping = true;
			this.errorMessage = '';

			const assistantMessage = {
				role: 'assistant',
				content: '',
				reasoning_content: '',
				isReasoningCollapsed: this.config.defaultHideReasoning || false
			};
			
			this.chat.messages.push(assistantMessage);
			this.isAtBottom = true;

			try {
				// 创建中止控制器
				this.abortController = new AbortController();

				// 动态导入AI服务
				const { callAiModel } = await import('@/core/services/aiService');
				
				// 准备API URL
				let effectiveApiUrl = this.config.apiUrl;
				if (this.useBackendProxy) {
					effectiveApiUrl = this.config.provider === 'gemini' 
						? this.config.backendUrlGemini 
						: this.config.backendUrlDeepseek;
				}

				// 获取有效的消息（处理总结消息）
				const effectiveMessages = this.getEffectiveMessages();
				
				// 缓冲变量
				let pendingContent = '';
				let pendingReasoning = '';
				
				// 创建节流更新函数
				// UI更新频率：1000ms (1fps) - 根据用户要求降低频率
				const throttledUIUpdate = throttle(() => {
					if (pendingContent) assistantMessage.content = pendingContent;
					if (pendingReasoning) assistantMessage.reasoning_content = pendingReasoning;
					
					// 强制更新视图
					this.chat.messages = [...this.chat.messages];
					
					// 滚动到底部
					if (this.throttledScroll) {
						this.throttledScroll();
					}
				}, 1000);

				// 保存频率：2000ms (2秒一次)
				const throttledSave = throttle(() => {
					this.$emit('update-chat');
				}, 2000);
				
				// 调用AI
				await callAiModel({
					provider: this.config.provider,
					apiUrl: effectiveApiUrl,
					apiKey: this.config.apiKey,
					model: this.config.model,
					messages: effectiveMessages.slice(0, -1), // 不包括占位消息
					temperature: this.config.temperature,
					maxTokens: this.config.maxTokens,
					signal: this.abortController.signal,
					featurePassword: this.config.featurePassword,
					useBackendProxy: this.useBackendProxy,
					geminiReasoningEffort: this.config.geminiReasoningEffort,
					onChunk: (chunk) => {
						// 更新缓冲变量
						if (chunk.content !== undefined) {
							pendingContent = chunk.content;
						}
						if (chunk.reasoning_content !== undefined) {
							pendingReasoning = chunk.reasoning_content;
						}
						
						// 触发节流更新
						throttledUIUpdate();
						throttledSave();
					}
				});

				// 确保最后的内容被更新
				if (pendingContent) assistantMessage.content = pendingContent;
				if (pendingReasoning) assistantMessage.reasoning_content = pendingReasoning;
				this.chat.messages = [...this.chat.messages];
				this.$emit('update-chat');

				console.log('[StandardChatMode] Message sent successfully');
				
				// 如果是第一条消息，自动生成标题
				if (this.chat.messages.length === 2 && this.chat.title === '新对话') {
					this.generateChatTitle(userMessage.content);
				}
				
			} catch (error) {
				console.error('[StandardChatMode] Error sending message:', error);
				
				// 移除失败的消息
				this.chat.messages.pop();
				
				if (error.name === 'AbortError') {
					this.errorMessage = '已取消';
				} else {
					this.errorMessage = error.message || '发送失败，请重试';
				}
				
				// 恢复输入
				this.inputMessage = inputText;
			} finally {
				this.isLoading = false;
				this.isTyping = false;
				this.abortController = null;
				this.$emit('update-chat');
			}
		},
		handleCancel() {
			// 取消请求逻辑
			if (this.abortController) {
				this.abortController.abort();
			}
		},
		focus() {
			if (this.$refs.inputRef) {
				this.$refs.inputRef.focus();
			}
		},
		scrollToBottom() {
			this.$nextTick(() => {
				let container = this.$refs.container;
				if (container && container.$el) container = container.$el;
				if (!container) return;
				
				if (this.isAtBottom) {
					container.scrollTop = container.scrollHeight;
				}
			});
		},
		scrollToBottomManual() {
			const container = this.$refs.container;
			if (container) {
				const el = container.$el || container;
				el.scrollTop = el.scrollHeight;
				this.isAtBottom = true;
			}
		},
		generateChatTitle(firstMessage) {
			// 自动生成对话标题
			let title = firstMessage.substring(0, 20);
			if (firstMessage.length > 20) {
				title += '...';
			}
			this.chat.title = title;
			this.$emit('update-chat');
		},
		handleSummary(index) {
			// 触发总结功能
			this.$emit('summary-message', index);
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
		}
	}
};
</script>

<style scoped>
.standard-chat-mode {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	position: relative;
}

.message-list {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 1.25rem;
	padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
}

.message-list::-webkit-scrollbar {
	width: 8px;
}

.message-list::-webkit-scrollbar-track {
	background: #f1f1f1;
	border-radius: 4px;
}

.message-list::-webkit-scrollbar-thumb {
	background: #888;
	border-radius: 4px;
}

.message-list::-webkit-scrollbar-thumb:hover {
	background: #555;
}

.typing-indicator {
	display: flex;
	gap: 4px;
}

.dot {
	width: 8px;
	height: 8px;
	background-color: #999;
	border-radius: 50%;
	animation: typing 1.4s infinite;
}

@keyframes typing {
	0%, 60%, 100% {
		transform: translateY(0);
		opacity: 0.7;
	}
	30% {
		transform: translateY(-10px);
		opacity: 1;
	}
}

@media (max-width: 768px) {
	.message-list {
		padding: 0.75rem;
	}
}

@media (max-width: 480px) {
	.message-list {
		padding: 0.5rem;
	}
	
	.message-list::-webkit-scrollbar {
		width: 4px;
	}
}
</style>

