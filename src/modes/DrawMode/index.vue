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
			<!-- 空状态：绘图模式已停止新开，引导至迁移站点 -->
			<EmptyState
				v-if="!messages.length"
				title="绘图模式已停止新开"
				description="绘图功能已迁移至全新的独立绘图站 image.tobenot.top —— 一个面向 OpenAI 兼容图片生成 API 的纯前端 WebUI，自带 API Key 即可开始创作。已有绘图会话不受影响，仍可继续查看。"
			>
				<template #icon>
					<el-icon class="w-12 h-12 text-primary" style="font-size: 48px;"><Picture /></el-icon>
				</template>
				<template #actions>
					<a href="https://image.tobenot.top" target="_blank" rel="noopener">
						<el-button type="primary">前往 image.tobenot.top</el-button>
					</a>
				</template>
			</EmptyState>

			<!-- 消息列表 -->
			<template v-else>
				<MessageBubble
					v-for="(msg, index) in messages"
					:key="msg.id || index"
					:role="msg.role"
					:content="msg.content"
					:reasoning-content="msg.reasoning_content"
					:is-reasoning-collapsed="msg.isReasoningCollapsed"
				>
					<template #controls>
						<!-- 直接绑 v-for 的真实消息对象 msg，不用插槽副本（缺 cacheBreakpoint） -->
						<MessageControls
							:message="msg"
							:messages="messages"
							:index="index"
							:is-last="index === messages.length - 1"
							:is-typing="isTyping"
							:cache-available="config.promptCacheAvailable !== false"
							:cache-unavailable-reason="config.promptCacheUnavailableReason"
							:prompt-cache-ttl="config.promptCacheTtl"
							@copy="$emit('copy-message', msg.content)"
							@edit="$emit('edit-message', index)"
							@regenerate="$emit('regenerate-message')"
							@fork="$emit('fork-chat', index)"
							@delete="$emit('delete-message', index)"
							@cache-breakpoint="$emit('set-cache-breakpoint', index, $event)"
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

		<!-- 底部控制栏：仅已有消息的旧会话保留生图能力 -->
		<div v-if="messages.length" class="input-area">
			<!-- 宽高比选择 -->
			<div class="options-bar px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-4">
				<span class="text-xs text-gray-500">画面比例:</span>
				<el-radio-group v-model="aspectRatio" size="small">
					<el-radio-button label="1:1">1:1 (方)</el-radio-button>
					<el-radio-button label="16:9">16:9 (宽)</el-radio-button>
					<el-radio-button label="9:16">9:16 (竖)</el-radio-button>
					<el-radio-button label="4:3">4:3</el-radio-button>
					<el-radio-button label="3:4">3:4</el-radio-button>
					<el-radio-button label="3:2">3:2</el-radio-button>
					<el-radio-button label="2:3">2:3</el-radio-button>
					<el-radio-button label="21:9">21:9 (超宽)</el-radio-button>
					<el-radio-button label="9:21">9:21 (超竖)</el-radio-button>
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
import { Picture } from '@element-plus/icons-vue';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageControls from '@/modes/StandardChatMode/components/MessageControls.vue'; // 复用标准模式的控件
import { createUuid } from '@/utils/chatData';
import { callAiModel } from '@/core/services/aiService';

export default {
	name: 'DrawMode',
	components: {
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
		'focus-input',
		'copy-message',
		'edit-message',
		'regenerate-message',
		'delete-message',
		'update-chat',
		'scroll-bottom-changed',
		'fork-chat',
		'set-cache-breakpoint',
		'start-cache-countdown'
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
		isBackendProxy() {
			return this.config.isBackendProxy || false;
		},
		hasValidAuth() {
			return this.isBackendProxy || this.config.currentPreset?.apiKeyRequired === false || !!this.apiKey;
		},
		messages() {
			return this.chat?.messages || [];
		},
		/** 当前生效的缓存 TTL：'5m' | '1h' | null（全局优先，否则取最后一条手动断点） */
		activeCacheTtl() {
			if (this.config.promptCacheAvailable === false) return null;
			const global = this.config.promptCacheTtl;
			if (global === '5m' || global === '1h') return global;
			for (let i = this.messages.length - 1; i >= 0; i--) {
				const bp = this.messages[i]?.cacheBreakpoint;
				if (bp === '5m' || bp === '1h') return bp;
			}
			return null;
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
				id: createUuid(),
				role: 'user',
				content: this.inputMessage.trim(),
				createdAt: new Date().toISOString(),
				createdAtMs: Date.now()
			};

			this.chat.messages.push(userMessage);
			this.$emit('update-chat');
			
			const inputText = this.inputMessage;
			this.inputMessage = '';
			this.isLoading = true;
			this.isTyping = true;
			this.errorMessage = '';

			// 启用 5m 缓存时，发送后启动 5 分钟倒计时（1h 不显示，用户自行掌握）
			if (this.activeCacheTtl === '5m') {
				this.$emit('start-cache-countdown');
			}

			// 创建AI消息占位
			const assistantMessage = {
				id: createUuid(),
				role: 'assistant',
				content: '', // 将在获取响应后填充
				images: [],
				createdAt: new Date().toISOString(),
				createdAtMs: Date.now()
			};
			
			// 暂时不推入消息列表，等到获取到结果（非流式）再推入，或者先推入一个loading状态的消息
			// 为了复用 MessageBubble 的逻辑，我们先推入，但 content 为空
			this.chat.messages.push(assistantMessage);

			try {
				this.abortController = new AbortController();

				let effectiveApiUrl = this.config.apiUrl;

				// 使用配置的模型，如果未配置则回退到默认
				const modelToUse = this.config.model || 'google/gemini-3-flash-preview';
				
				// 简单的模型能力检查（实际应用中可能需要更复杂的判断）
				const isGeminiImageModel =
					(modelToUse.includes('gemini') && (modelToUse.includes('image') || modelToUse.includes('vision')))
					|| modelToUse === 'google/gemini-3-flash-preview';
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
					provider: this.config.provider || 'openai_compatible',
					apiUrl: effectiveApiUrl,
					apiKey: this.config.apiKey,
					model: modelToUse,
					messages: contextMessages,
					temperature: this.config.temperature,
					maxTokens: this.config.maxTokens,
					signal: this.abortController.signal,
					featurePassword: this.config.featurePassword,
					isBackendProxy: this.isBackendProxy,
					stream: false,
					extraBody: Object.keys(extraBody).length > 0 ? extraBody : undefined,
					promptCacheTtl: this.config.promptCacheTtl,
					requestFormat: this.config.requestFormat || 'auto',
					responsesTools: this.config.responsesTools || [],
					activePresetId: this.config.activePresetId || ''
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
				if (!assistantMessage.content) {
					assistantMessage.content = error.name === 'AbortError' ? '已取消，未生成更多内容。' : '生成中断，未生成更多内容。';
				}
				this.chat.messages = [...this.chat.messages];
				
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

