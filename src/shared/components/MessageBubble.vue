<!-- 
	可复用的消息气泡组件
	支持用户消息和AI消息的展示
-->
<template>
	<div
		class="message-bubble-wrapper"
		:class="wrapperClass"
	>
		<button
			v-if="showJumpToControls"
			type="button"
			class="jump-to-controls-btn"
			title="跳到底部工具栏"
			aria-label="跳到底部工具栏"
			@click="scrollToControls"
		>
			<el-icon :size="14">
				<ArrowDown />
			</el-icon>
		</button>

		<div class="message-bubble" :class="[roleClass, customClass]">
			<div v-if="role === 'user'">
				<MarkdownRenderer :content="displayContent" />
				<div v-if="showControls" class="message-controls mt-2 flex flex-wrap gap-2 justify-start">
					<slot name="controls" :message="{ role, content, isCollapsed }">
						<!-- 默认控制按钮 -->
					</slot>
				</div>
			</div>
			<template v-else>
				<!-- AI的思考过程 -->
				<template v-if="reasoningContent">
					<div class="reasoning-content bg-reasoningBg text-white p-2 rounded mb-2">
						<div class="flex items-center mb-1">
							<div class="reasoning-toggle cursor-pointer mr-2" @click="toggleReasoning">
								<el-icon>
									<component :is="isReasoningCollapsed ? 'ArrowRight' : 'ArrowDown'" />
								</el-icon>
							</div>
							<span class="font-bold">思考过程</span>
						</div>
						<div class="reasoning-body" :class="{ collapsed: isReasoningCollapsed }">
							<MarkdownRenderer :content="reasoningContent" />
						</div>
					</div>
				</template>
				
				<!-- AI的回复内容 -->
				<div class="markdown-content">
					<MarkdownRenderer :content="displayContent" />
				</div>
				
				<div
					v-if="showControls"
					ref="controlsRef"
					class="assistant-controls mt-2 flex flex-wrap gap-2 justify-start"
				>
					<slot name="controls" :message="{ role, content, reasoningContent, isCollapsed }">
						<!-- 默认控制按钮 -->
					</slot>
				</div>
			</template>
		</div>
	</div>
</template>

<script>
import { ArrowRight, ArrowDown } from '@element-plus/icons-vue';
import MarkdownRenderer from './MarkdownRenderer.vue';

export default {
	name: 'MessageBubble',
	components: { 
		ArrowRight, 
		ArrowDown, 
		MarkdownRenderer 
	},
	props: {
		role: {
			type: String,
			required: true,
			validator: (value) => ['user', 'assistant'].includes(value)
		},
		content: {
			type: String,
			default: ''
		},
		reasoningContent: {
			type: String,
			default: ''
		},
		isReasoningCollapsed: {
			type: Boolean,
			default: false
		},
		isCollapsed: {
			type: Boolean,
			default: false
		},
		showControls: {
			type: Boolean,
			default: true
		},
		customClass: {
			type: String,
			default: ''
		}
	},
	emits: ['toggle-reasoning'],
	data() {
		return {
			controlsVisible: true,
			controlsObserver: null
		};
	},
	computed: {
		roleClass() {
			return this.role === 'user' ? 'user-message' : 'assistant-message';
		},
		wrapperClass() {
			return this.role === 'user' ? 'message-bubble-wrapper--user' : 'message-bubble-wrapper--assistant';
		},
		displayContent() {
			if (!this.isCollapsed) return this.content;
			const lines = (this.content || '').split('\n');
			if (lines.length <= 4) return this.content;
			return [...lines.slice(0, 2), '\n...(已折叠)...\n', ...lines.slice(-2)].join('\n');
		},
		showJumpToControls() {
			return this.role === 'assistant' && this.showControls && !this.controlsVisible;
		}
	},
	watch: {
		showControls(visible) {
			if (visible) {
				this.$nextTick(() => this.setupControlsObserver());
			} else {
				this.teardownControlsObserver();
			}
		}
	},
	mounted() {
		if (this.role === 'assistant' && this.showControls) {
			this.$nextTick(() => this.setupControlsObserver());
		}
	},
	beforeUnmount() {
		this.teardownControlsObserver();
	},
	methods: {
		toggleReasoning() {
			this.$emit('toggle-reasoning');
		},
		setupControlsObserver() {
			this.teardownControlsObserver();

			const controls = this.$refs.controlsRef;
			if (!controls) return;

			this.controlsObserver = new IntersectionObserver(
				([entry]) => {
					this.controlsVisible = entry.isIntersecting;
				},
				{ threshold: 0, rootMargin: '0px 0px -8px 0px' }
			);
			this.controlsObserver.observe(controls);
		},
		teardownControlsObserver() {
			if (this.controlsObserver) {
				this.controlsObserver.disconnect();
				this.controlsObserver = null;
			}
		},
		scrollToControls() {
			const controls = this.$refs.controlsRef;
			if (!controls) return;

			controls.scrollIntoView({ behavior: 'instant', block: 'end' });
		}
	}
};
</script>

<style scoped>
.message-bubble-wrapper {
	position: relative;
	max-width: clamp(18rem, 70vw, 55rem);
	width: min(100%, clamp(18rem, 70vw, 55rem));
	box-sizing: border-box;
}

.message-bubble-wrapper--assistant {
	padding-right: 1.5rem;
}

.message-bubble-wrapper .message-bubble {
	max-width: none;
	width: 100%;
}

.jump-to-controls-btn {
	position: absolute;
	top: 0.25rem;
	right: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	padding: 0;
	border: none;
	border-radius: 9999px;
	background: transparent;
	color: #9ca3af;
	cursor: pointer;
	opacity: 0.45;
	transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.message-bubble-wrapper:hover .jump-to-controls-btn,
.jump-to-controls-btn:hover {
	opacity: 0.9;
	color: #6b7280;
	background-color: rgba(229, 231, 235, 0.6);
}

.jump-to-controls-btn:active {
	opacity: 1;
	background-color: rgba(209, 213, 219, 0.8);
}

.reasoning-body.collapsed {
	display: none;
}
</style>
