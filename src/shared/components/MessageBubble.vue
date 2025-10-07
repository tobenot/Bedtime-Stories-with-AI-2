<!-- 
	可复用的消息气泡组件
	支持用户消息和AI消息的展示
-->
<template>
	<div class="message-bubble" :class="[roleClass, customClass]">
		<div v-if="role === 'user'">
			<MarkdownRenderer :content="content" />
			<div v-if="showControls" class="message-controls mt-2 flex justify-start">
				<slot name="controls" :message="{ role, content }">
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
				<MarkdownRenderer :content="content" />
			</div>
			
			<!-- 总结消息分界线 -->
			<div v-if="isSummary" class="summary-divider mt-4 mb-2">
				<div class="divider-line"></div>
				<div class="divider-text">总结完成</div>
				<div class="divider-line"></div>
			</div>
			
			<div v-if="showControls" class="assistant-controls mt-2 flex justify-start">
				<slot name="controls" :message="{ role, content, reasoningContent }">
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
		showControls: {
			type: Boolean,
			default: true
		},
		customClass: {
			type: String,
			default: ''
		},
		isSummary: {
			type: Boolean,
			default: false
		}
	},
	emits: ['toggle-reasoning'],
	computed: {
		roleClass() {
			return this.role === 'user' ? 'user-message' : 'assistant-message';
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

.summary-divider {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.divider-line {
	flex: 1;
	height: 1px;
	background-color: #e5e7eb;
}

.divider-text {
	font-size: 0.75rem;
	color: #6b7280;
	font-weight: 500;
	white-space: nowrap;
}
</style>

