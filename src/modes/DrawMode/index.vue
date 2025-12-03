<!--
	绘图模式插件
	支持基于文本生成图片（单次生图模式）
	注意：当前版本不支持多轮修图，每次生成都是独立的创作
-->
<template>
	<div class="draw-mode">
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
								本模式建议使用 OpenRouter API Key 以支持 Gemini 绘图模型。<br>
								请前往 <a href="https://openrouter.ai/" target="_blank" class="text-secondary underline">OpenRouter</a> 获取 Key。
							</template>
							<template v-else>
								当前使用神秘链接模式，请配置神秘链接地址和功能密码。
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
				title="创意绘图助手"
				description="描述你想要生成的画面，AI 会根据你的描述生成图片。当前版本支持单次生图，每次生成都是独立的创作。"
			>
				<template #icon>
					<el-icon class="w-12 h-12 text-primary" style="font-size: 48px;"><Picture /></el-icon>
				</template>
				<template #actions>
					<div class="quick-prompts">
						<el-button size="small" @click="inputMessage = '一只可爱的赛博朋克风格的猫'; handleSend()">赛博朋克猫</el-button>
						<el-button size="small" @click="inputMessage = '水墨画风格的山水图'; handleSend()">水墨山水</el-button>
					</div>
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
						/>
					</template>
				</MessageBubble>
				
				<!-- 输入中指示器 -->
				<div v-if="isTyping" class="message-bubble assistant-message">
					<div class="typing-indicator">
						<div class="dot" style="animation-delay: 0s"></div>
						<div class="dot" style="animation-delay: 0.2s"></div>
						<div class="dot" style="animation-delay: 0.4s"></div>
						<span class="ml-2 text-gray-500 text-sm">正在绘制中...</span>
					</div>
				</div>
			</template>
		</el-main>

		<!-- 底部控制栏 -->
		<div class="input-area">
			<!-- 宽高比选择 -->
			<div class="options-bar px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4">
				<span class="text-xs text-gray-500">画面比例:</span>
				<el-radio-group v-model="aspectRatio" size="small">
					<el-radio-button label="1:1">1:1 (方)</el-radio-button>
					<el-radio-button label="16:9">16:9 (宽)</el-radio-button>
					<el-radio-button label="9:16">9:16 (竖)</el-radio-button>
					<el-radio-button label="4:3">4:3</el-radio-button>
					<el-radio-button label="3:4">3:4</el-radio-button>
				</el-radio-group>
			</div>

			<!-- 输入区域 -->
			<ChatInput
				v-model="inputMessage"
				:disabled="!hasValidAuth"
				:is-loading="isLoading"
				:error-message="errorMessage"
				placeholder="描述画面内容..."
				@send="handleSend"
				@cancel="handleCancel"
				ref="inputRef"
			/>
		</div>
	</div>
</template>

<script>
import { Setting, Picture } from '@element-plus/icons-vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageControls from '@/modes/StandardChatMode/components/MessageControls.vue'; // 复用标准模式的控件

export default {
	name: 'DrawMode',
	components: {
		Setting,
		Picture,
		MessageBubble,
		ChatInput,
		EmptyState,
		MessageControls
	},
	props: {
		config: {
			type: Object,
			default: () => ({})
		},
		chat: {
			type: Object,
			default: null
		}
	},
	emits: [
		'open-settings',
		'focus-input',
		'copy-message',
		'edit-message',
		'regenerate-message',
		'delete-message',
		'update-chat',
		'scroll-bottom-changed'
	],
	data() {
		return {
			inputMessage: '',
			isLoading: false,
			isTyping: false,
			errorMessage: '',
			abortController: null,
			aspectRatio: '1:1'
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
		messages() {
			return this.chat?.messages || [];
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
		console.log('[DrawMode] Mounted with model:', this.config.model);
	},
	methods: {
		handleScroll() {
			let container = this.$refs.container;
			if (container && container.$el) container = container.$el;
			if (!container) return;
			
			const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
			this.$emit('scroll-bottom-changed', distanceFromBottom > 150);
		},
		scrollToBottom() {
			this.$nextTick(() => {
				let container = this.$refs.container;
				if (container && container.$el) container = container.$el;
				if (!container) return;
				container.scrollTop = container.scrollHeight;
			});
		},
		async handleSend() {
			if (!this.inputMessage.trim() || this.isLoading) {
				return;
			}

			console.log('[DrawMode] Send message:', this.inputMessage);

			const userMessage = {
				role: 'user',
				content: this.inputMessage.trim()
			};

			this.chat.messages.push(userMessage);
			this.$emit('update-chat');
			
			const inputText = this.inputMessage;
			this.inputMessage = '';
			this.isLoading = true;
			this.isTyping = true;
			this.errorMessage = '';

			// 创建AI消息占位
			const assistantMessage = {
				role: 'assistant',
				content: '', // 将在获取响应后填充
				images: []
			};
			
			// 暂时不推入消息列表，等到获取到结果（非流式）再推入，或者先推入一个loading状态的消息
			// 为了复用 MessageBubble 的逻辑，我们先推入，但 content 为空
			this.chat.messages.push(assistantMessage);

			try {
				this.abortController = new AbortController();

				const { callAiModel } = await import('@/core/services/aiService');
				
				let effectiveApiUrl = this.config.apiUrl;
				if (this.useBackendProxy) {
					effectiveApiUrl = this.config.provider === 'gemini' 
						? this.config.backendUrlGemini 
						: this.config.backendUrlDeepseek;
				}

				// 使用配置的模型，如果未配置则回退到默认
				const modelToUse = this.config.model || 'google/gemini-2.5-flash-image-preview';
				
				// 简单的模型能力检查（实际应用中可能需要更复杂的判断）
				const isGeminiImageModel = modelToUse.includes('gemini') && (modelToUse.includes('image') || modelToUse.includes('vision'));
				const isFluxModel = modelToUse.includes('flux');
				
				if (!isGeminiImageModel && !isFluxModel) {
					console.warn('[DrawMode] 当前模型可能不支持图像生成:', modelToUse);
				}

				// 准备上下文消息
				// 注意：当前版本仅支持单次生图，不传递历史图片（Base64 数据过大）
				// 只传递文本历史，让模型理解对话上下文即可
				const contextMessages = this.chat.messages.slice(0, -1).map(m => {
					// 移除图片 Markdown，只保留文本内容
					const textContent = m.content.replace(/!\[.*?\]\(.*?\)/g, '').trim();
					return {
						role: m.role,
						content: textContent || m.content // 如果移除图片后为空，保留原内容
					};
				});

				// 根据模型类型准备 extraBody
				const extraBody = {};
				
				if (isGeminiImageModel) {
					// Gemini Image 模型需要 modalities 和 image_config
					extraBody.modalities = ['image', 'text'];
					extraBody.image_config = {
						aspect_ratio: this.aspectRatio
					};
				}
				// Flux 等其他模型通常不需要额外参数，或者参数不同

				// 调用 AI
				const result = await callAiModel({
					provider: 'openai_compatible', // OpenRouter 使用 OpenAI 兼容接口
					apiUrl: effectiveApiUrl,
					apiKey: this.config.apiKey,
					model: modelToUse,
					messages: contextMessages,
					temperature: this.config.temperature,
					maxTokens: this.config.maxTokens,
					signal: this.abortController.signal,
					featurePassword: this.config.featurePassword,
					useBackendProxy: this.useBackendProxy,
					stream: false, // 非流式
					extraBody: Object.keys(extraBody).length > 0 ? extraBody : undefined
				});

				console.log('[DrawMode] Result:', result);

				// 处理结果
				if (result) {
					let finalContent = result.content || '';
					
					// 如果有图片，追加到 content 中
					if (result.images && result.images.length > 0) {
						const imageUrl = result.images[0].image_url.url;
						// 使用 Markdown 图片语法
						finalContent += `\n\n![生成图片](${imageUrl})\n`;
					} else if (!finalContent) {
						finalContent = '生成失败，未返回内容。';
					}

					assistantMessage.content = finalContent;
					// 触发更新
					this.chat.messages = [...this.chat.messages];
					this.$emit('update-chat');
				}

			} catch (error) {
				console.error('[DrawMode] Error:', error);
				this.chat.messages.pop(); // 移除助手消息
				
				if (error.name === 'AbortError') {
					this.errorMessage = '已取消';
				} else {
					this.errorMessage = error.message || '生成失败，请重试';
				}
				this.inputMessage = inputText;
			} finally {
				this.isLoading = false;
				this.isTyping = false;
				this.abortController = null;
				this.$emit('update-chat');
				this.scrollToBottom();
			}
		},
		handleCancel() {
			if (this.abortController) {
				this.abortController.abort();
			}
		}
	}
};
</script>

<style scoped>
.draw-mode {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.message-list {
	flex: 1;
	overflow-y: auto;
	padding: 1.25rem;
	scroll-behavior: smooth;
}

.quick-prompts {
	display: flex;
	gap: 8px;
	margin-top: 12px;
}

.input-area {
	flex-shrink: 0;
	background: white;
	z-index: 10;
}

.typing-indicator {
	display: flex;
	align-items: center;
	padding: 8px;
}

.dot {
	width: 8px;
	height: 8px;
	background-color: #999;
	border-radius: 50%;
	margin-right: 4px;
	animation: typing 1.4s infinite;
}

@keyframes typing {
	0%, 60%, 100% {
		transform: translateY(0);
		opacity: 0.7;
	}
	30% {
		transform: translateY(-5px);
		opacity: 1;
	}
}

/* 复用一些基础样式 */
:deep(.message-bubble) {
	margin-bottom: 16px;
}
</style>

