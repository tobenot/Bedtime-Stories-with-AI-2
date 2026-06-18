<!--
	消息控制按钮组件
	提供复制、编辑、删除、重新生成等功能
-->
<template>
	<div class="message-controls flex flex-wrap gap-2">
		<el-tooltip :content="message.isCollapsed ? '展开' : '折叠'" placement="top">
			<el-button class="btn-collapse" @click="$emit('toggle-collapse')">
				<el-icon style="font-size: 1.6rem;">
					<component :is="message.isCollapsed ? 'ArrowDown' : 'ArrowUp'" />
				</el-icon>
			</el-button>
		</el-tooltip>

		<el-tooltip content="复制" placement="top">
			<el-button class="btn-copy" @click="$emit('copy')">
				<el-icon style="font-size: 1.6rem;"><CopyDocument /></el-icon>
			</el-button>
		</el-tooltip>

		<el-tooltip v-if="!isTyping || !isLast" content="编辑" placement="top">
			<el-button class="btn-edit" @click="$emit('edit')">
				<el-icon style="font-size: 1.6rem;"><Edit /></el-icon>
			</el-button>
		</el-tooltip>
		
		<el-tooltip v-if="isLast && !isTyping" content="重新生成" placement="top">
			<el-button class="btn-refresh" @click="$emit('regenerate')">
				<el-icon style="font-size: 1.6rem;"><Refresh /></el-icon>
			</el-button>
		</el-tooltip>

		<el-tooltip content="从此处分叉对话(if线)" placement="top">
			<el-button class="btn-fork" @click="$emit('fork')">
				<el-icon style="font-size: 1.6rem;"><Share /></el-icon>
			</el-button>
		</el-tooltip>

		<el-dropdown
			trigger="click"
			placement="top"
			@command="onCacheCommand"
		>
			<el-tooltip :content="cacheTooltip" placement="top">
				<el-button
					class="btn-cache"
					:class="{ 'is-marked': !!cacheBadge, 'is-auto': isAuto }"
				>
					<el-icon style="font-size: 1.6rem;"><Coin /></el-icon>
					<span v-if="cacheBadge" class="cache-badge">{{ cacheBadge }}</span>
					<span v-else-if="isAuto" class="cache-badge auto">A</span>
				</el-button>
			</el-tooltip>
			<template #dropdown>
				<el-dropdown-menu>
					<el-dropdown-item :command="''" :disabled="!cacheBadge">取消缓存点</el-dropdown-item>
					<el-dropdown-item command="5m" :disabled="cacheBadge === '5m'">5 分钟</el-dropdown-item>
					<el-dropdown-item command="1h" :disabled="cacheBadge === '1h'">1 小时</el-dropdown-item>
				</el-dropdown-menu>
			</template>
		</el-dropdown>

		<el-tooltip v-if="!isTyping || !isLast" content="删除" placement="top">
			<el-button class="btn-delete" @click="$emit('delete')">
				<el-icon style="font-size: 1.6rem;"><Delete /></el-icon>
			</el-button>
		</el-tooltip>
	</div>
</template>

<script>
import { CopyDocument, Edit, Refresh, Delete, Share, ArrowUp, ArrowDown, Coin } from '@element-plus/icons-vue';
import { isAutoBreakpoint } from '@/utils/promptCache';

export default {
	name: 'MessageControls',
	components: {
		CopyDocument,
		Edit,
		Refresh,
		Delete,
		Share,
		ArrowUp,
		ArrowDown,
		Coin
	},
	props: {
		message: {
			type: Object,
			required: true
		},
		messages: {
			type: Array,
			default: () => []
		},
		index: {
			type: Number,
			required: true
		},
		isLast: {
			type: Boolean,
			default: false
		},
		isTyping: {
			type: Boolean,
			default: false
		}
	},
	emits: ['copy', 'edit', 'regenerate', 'delete', 'toggle-reasoning', 'fork', 'toggle-collapse', 'cache-breakpoint'],
	computed: {
		cacheBadge() {
			const v = this.message?.cacheBreakpoint;
			return v === '5m' || v === '1h' ? v : '';
		},
		isAuto() {
			// 该消息是否会被自动标记为缓存断点（手动标记优先，不显示自动样式）
			return !this.cacheBadge && isAutoBreakpoint(this.messages, this.index);
		},
		cacheTooltip() {
			if (this.cacheBadge) {
				return `缓存点：${this.cacheBadge === '5m' ? '5 分钟' : '1 小时'}（手动，点击修改）`;
			}
			if (this.isAuto) {
				return '自动缓存点（由全局缓存策略标记，点击可手动覆盖为 5m/1h）';
			}
			return '标记为缓存点';
		}
	},
	methods: {
		onCacheCommand(command) {
			this.$emit('cache-breakpoint', command || null);
		}
	}
};
</script>

<style scoped>

.debug-info {
	margin-top: 0.25rem;
	padding: 0.25rem;
	background-color: #f3f4f6;
	border-radius: 0.25rem;
}

.btn-cache {
	position: relative;
}

.btn-cache.is-marked {
	color: #805AD5;
	border-color: #805AD5;
}

.btn-cache.is-auto {
	color: #9ca3af;
	border-color: #d1d5db;
}

.cache-badge {
	position: absolute;
	top: -6px;
	right: -6px;
	min-width: 20px;
	height: 16px;
	padding: 0 4px;
	font-size: 10px;
	font-weight: 600;
	line-height: 16px;
	color: #fff;
	background: #805AD5;
	border-radius: 8px;
}

.cache-badge.auto {
	background: #9ca3af;
	font-size: 9px;
}
</style>

