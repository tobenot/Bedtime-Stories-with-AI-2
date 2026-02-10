<!-- 
	可复用的消息气泡组件
	支持用户消息和AI消息的展示
-->
<template>
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
			
			<div v-if="showControls" class="assistant-controls mt-2 flex flex-wrap gap-2 justify-start">
				<slot name="controls" :message="{ role, content, reasoningContent, isCollapsed }">
					<!-- 默认控制按钮 -->
				</slot>
			</div>
		</template>
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
	computed: {
		roleClass() {
			return this.role === 'user' ? 'user-message' : 'assistant-message';
		},
		displayContent() {
			if (!this.isCollapsed) return this.content;
			const lines = (this.content || '').split('\n');
			if (lines.length <= 4) return this.content;
			return [...lines.slice(0, 2), '\n...(已折叠)...\n', ...lines.slice(-2)].join('\n');
		}
	},
	methods: {
		toggleReasoning() {
			this.$emit('toggle-reasoning');
		}
	}
};
</script>

<style scoped>
.reasoning-body.collapsed {
	display: none;
}

</style>

