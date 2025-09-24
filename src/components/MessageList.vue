<template>
	<el-main ref="container" :class="['message-list', 'flex-1', 'overflow-y-auto', 'p-5', showSidebar ? 'mt-16' : 'mt-0', 'md:mt-0', 'scrollbar', 'scrollbar-thumb-gray-500', 'scrollbar-track-gray-200']" @scroll="handleScroll">
		<!-- Debug info (only in development) -->
		<div v-if="isDevelopment" class="debug-info bg-yellow-100 p-2 mb-4 rounded text-xs">
			<strong>Debug Info:</strong> Messages: {{ debugInfo.messagesLength }}, 
			API Key: {{ debugInfo.hasApiKey }}, 
			Backend Proxy: {{ debugInfo.useBackendProxy }}, 
			Typing: {{ debugInfo.isTyping }}
		</div>
		
		<template v-if="!apiKey && !useBackendProxy">
			<div class="empty-state text-center p-5">
				<el-alert type="info" :closable="false" show-icon>
					<template #title>
						<div class="text-lg font-semibold text-primary">请先设置API Key</div>
					</template>
					<template #default>
						<div class="text-base text-customGray">
							请前往 <a href="https://cloud.siliconflow.cn/i/M9KJQRfy" target="_blank" class="text-secondary underline">硅基流动(本项目邀请码)</a><br> 注册账号，获取您的 API Key<br>新注册用户有14元免费额度。
							<br>
							点击右上角
							<el-button type="link" class="inline-block text-blue-500 p-0" @click="$emit('open-settings')">
								<el-icon><Setting /></el-icon> 设置
							</el-button>
							按钮配置您的API Key
						</div>
					</template>
				</el-alert>
			</div>
		</template>
		<template v-else-if="!apiKey && useBackendProxy && !messages?.length">
			<div class="empty-state text-center p-5">
				<el-alert type="info" :closable="false" show-icon>
					<template #title>
						<div class="text-lg font-semibold text-primary">当前是神秘链接模式，需要配置连接信息</div>
					</template>
					<template #default>
						<div class="text-base text-customGray">
							当前使用神秘链接模式，请点击右上角
							<el-button type="link" class="inline-block text-blue-500 p-0" @click="$emit('open-settings')">
								<el-icon><Setting /></el-icon> 设置
							</el-button>
							按钮配置神秘链接地址和功能密码。
							<br>
							如需使用API Key模式，请在设置中关闭神秘链接模式。
						</div>
					</template>
				</el-alert>
			</div>
		</template>
		<template v-else-if="!messages?.length">
			<div class="empty-state text-center p-5">
				<div class="empty-state-icon mb-4">
					<img src="/logo.svg" alt="Logo" class="w-12 h-12 inline-block" />
				</div>
				<div class="software-info mb-4">
					<h1 class="software-title text-3xl font-bold text-primary">与AI的睡前故事 2</h1>
					<p class="software-author text-lg text-gray-700">作者：tobenot</p>
					<p class="software-message text-sm text-gray-600">因为喜欢和AI玩文字游戏和聊各种东西，所以做了这个项目，希望你也喜欢！</p>
				</div>
				<h3 class="empty-state-title text-2xl font-semibold text-primary mb-2">开始新的对话吧！</h3>
				<p class="empty-state-description text-base text-customGray mb-4">
					如果你要把这里当做普通的对话，请直接像在官方app那样使用~<br>
					如果你要玩剧本，请选择剧本，或者自己在下方输入框输入你想要的故事开头！
				</p>
				<el-button class="btn-small" @click="$emit('focus-input')">手动输入</el-button>
				<el-button class="btn-small ml-2" @click="$emit('open-script-panel')">选择剧本</el-button>
			</div>
		</template>
		<template v-else>
			<div v-for="(msg, index) in messages" :key="index" class="message-bubble" :class="msg.role === 'user' ? 'user-message' : 'assistant-message'">
				<div v-if="msg.role === 'user'">
					<MarkdownRenderer :content="msg.content" />
					<div class="message-controls mt-2 flex justify-start">
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
					</div>
				</div>
				<template v-else>
					<template v-if="msg.reasoning_content">
						<div class="reasoning-content bg-reasoningBg text-white p-2 rounded mb-2">
							<div class="flex items-center mb-1">
								<div class="reasoning-toggle cursor-pointer mr-2" @click="$emit('toggle-reasoning', index)">
									<el-icon>
										<component :is="msg.isReasoningCollapsed ? 'ArrowRight' : 'ArrowDown'" />
									</el-icon>
								</div>
								<span class="font-bold">思考过程</span>
							</div>
							<div class="reasoning-body" :class="{ collapsed: msg.isReasoningCollapsed }">
								<MarkdownRenderer :content="msg.reasoning_content" />
							</div>
						</div>
					</template>
					<div class="markdown-content">
						<MarkdownRenderer :content="msg.content" />
					</div>
					<div class="assistant-controls mt-2 flex justify-start">
						<el-tooltip content="复制" placement="top">
							<el-button class="btn-copy" @click="$emit('copy-message', msg.content)">
								<el-icon style="font-size: 1.6rem;"><CopyDocument /></el-icon>
							</el-button>
						</el-tooltip>
						<template v-if="!(index === messages.length - 1 && isTyping)">
							<el-tooltip content="编辑" placement="top">
								<el-button class="btn-edit" @click="$emit('edit-message', index)">
									<el-icon style="font-size: 1.6rem;"><Edit /></el-icon>
								</el-button>
							</el-tooltip>
						</template>
						<template v-if="index === messages.length - 1 && !isTyping">
							<el-tooltip content="重新生成" placement="top">
								<el-button class="btn-refresh" @click="$emit('regenerate-message')">
									<el-icon style="font-size: 1.6rem;"><Refresh /></el-icon>
								</el-button>
							</el-tooltip>
						</template>
						<template v-if="!(index === messages.length - 1 && isTyping)">
							<el-tooltip content="删除" placement="top">
								<el-button class="btn-delete" @click="$emit('delete-message', index)">
									<el-icon style="font-size: 1.6rem;"><Delete /></el-icon>
								</el-button>
							</el-tooltip>
						</template>
					</div>
				</template>
			</div>
			<div v-if="isTyping" class="message-bubble assistant-message">
				<div class="typing-indicator">
					<div class="dot" style="animation-delay: 0s"></div>
					<div class="dot" style="animation-delay: 0.2s"></div>
					<div class="dot" style="animation-delay: 0.4s"></div>
				</div>
			</div>
		</template>
	</el-main>
</template>

<script>
import { Refresh, CopyDocument, Delete, Edit, Setting, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

export default {
	name: 'MessageList',
	components: { Refresh, CopyDocument, Delete, Edit, Setting, ArrowRight, ArrowDown, MarkdownRenderer },
	props: {
		messages: { type: Array, default: () => [] },
		apiKey: { type: String, default: '' },
		useBackendProxy: { type: Boolean, default: false },
		isTyping: { type: Boolean, default: false },
		showSidebar: { type: Boolean, default: false }
	},
	emits: ['toggle-reasoning', 'copy-message', 'edit-message', 'regenerate-message', 'delete-message', 'open-settings', 'scroll-bottom-changed', 'focus-input', 'open-script-panel'],
	computed: {
		isDevelopment() {
			return import.meta.env.DEV;
		},
		debugInfo() {
			return {
				messagesLength: this.messages?.length || 0,
				hasApiKey: !!this.apiKey,
				useBackendProxy: this.useBackendProxy,
				isTyping: this.isTyping,
				lastMessage: this.messages?.[this.messages.length - 1]
			};
		}
	},
	mounted() {
		console.log('[DEBUG] MessageList mounted');
		this.$nextTick(() => this.emitScrollState())
	},
	watch: {
		messages: {
			handler(newMessages, oldMessages) {
				console.log('[DEBUG] Messages changed:', {
					oldLength: oldMessages?.length || 0,
					newLength: newMessages?.length || 0,
					apiKey: !!this.apiKey,
					useBackendProxy: this.useBackendProxy,
					lastMessage: newMessages?.[newMessages.length - 1]
				});
			},
			deep: true
		}
	},
	methods: {
		handleScroll() {
			this.emitScrollState()
		},
		emitScrollState() {
			let container = this.$refs.container
			if (container && container.$el) container = container.$el
			if (!container) return
			const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
			this.$emit('scroll-bottom-changed', distanceFromBottom > 150)
		},
		scrollToBottom() {
			this.$nextTick(() => {
				let container = this.$refs.container
				if (container && container.$el) container = container.$el
				if (!container) return
				const threshold = 50
				if (container.scrollTop + container.clientHeight + threshold >= container.scrollHeight) {
					container.scrollTop = container.scrollHeight
				}
			})
		},
		scrollToBottomManual() {
			let container = this.$refs.container
			if (container && container.$el) container = container.$el
			if (!container) return
			container.scrollTop = container.scrollHeight
		}
	}
}
</script>

<style scoped>
</style>


