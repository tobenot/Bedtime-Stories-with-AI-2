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
			:hide-on-click="true"
			@command="onCacheCommand"
		>
			<span class="cache-trigger" :aria-label="cacheAriaLabel">
				<el-button
					class="btn-cache"
					:class="{ 'is-marked': !!cacheBadge, 'is-auto': isAuto }"
				>
					<el-icon style="font-size: 1.6rem;"><Coin /></el-icon>
					<span v-if="cacheBadge" class="cache-badge">{{ cacheBadge }}</span>
					<span v-else-if="isAuto" class="cache-badge auto">A</span>
				</el-button>
			</span>
			<template #dropdown>
				<el-dropdown-menu>
					<!-- 当前状态说明（不可点击，纯展示；手机无 tooltip 也能看到） -->
					<el-dropdown-item disabled class="cache-status-line">
						{{ statusLine }}
					</el-dropdown-item>
					<el-dropdown-item divided command="5m" :disabled="cacheBadge === '5m'">
						手动覆盖 · 5 分钟
					</el-dropdown-item>
					<el-dropdown-item command="1h" :disabled="cacheBadge === '1h'">
						手动覆盖 · 1 小时
					</el-dropdown-item>
					<!-- 手动点删除后的去向取决于该位置是否本就是自动点 -->
					<el-dropdown-item v-if="cacheBadge" divided command="auto">
						{{ wouldBeAuto ? '恢复自动' : '取消缓存' }}
					</el-dropdown-item>
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
import { isAutoBreakpoint, getAutoRole } from '@/utils/promptCache';

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
		autoRole() {
			return getAutoRole(this.messages, this.index);
		},
		// 若删除当前手动点，该位置是否会变回自动断点（决定「恢复自动」还是「取消缓存」）
		wouldBeAuto() {
			if (!this.cacheBadge) return this.isAuto;
			const cleared = this.messages.map((m, i) =>
				i === this.index ? { ...m, cacheBreakpoint: undefined } : m
			);
			return isAutoBreakpoint(cleared, this.index);
		},
		cacheAriaLabel() {
			if (this.cacheBadge) return `缓存点：${this.cacheBadge === '5m' ? '5 分钟' : '1 小时'}（手动）`;
			if (this.isAuto) return '自动缓存点，点击可手动覆盖';
			return '标记为缓存点';
		},
		// 下拉菜单首行：当前状态说明（手机无 tooltip 也能看到）
		statusLine() {
			if (this.cacheBadge) {
				return `当前：手动 · ${this.cacheBadge === '5m' ? '5 分钟' : '1 小时'}`;
			}
			if (this.isAuto) {
				const roleLabel = {
					tail: '继续发消息时命中',
					resend: '重发刚才那条时命中',
					start: '起点（缓存开头）',
					long: '长内容终点'
				}[this.autoRole] || '自动缓存点';
				return `当前：自动 · ${roleLabel}`;
			}
			return '当前：未缓存';
		}
	},
	methods: {
		onCacheCommand(command) {
			// 'auto' = 恢复自动（删除手动标记，自动策略重新接管）
			if (command === 'auto') {
				this.$emit('cache-breakpoint', null);
			} else if (command === '5m' || command === '1h') {
				this.$emit('cache-breakpoint', command);
			}
			// 其它值（如 disabled 项的空串）不做任何事
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

/* 下拉菜单状态说明行 */
.cache-status-line {
	color: #6b7280 !important;
	font-size: 12px;
	cursor: default !important;
}

@media (max-width: 768px) {
	/* 手机：徽章加大、可读性优先（手机无 tooltip 可靠性，靠徽章本身传达状态） */
	.cache-badge {
		min-width: 22px;
		height: 18px;
		font-size: 11px;
		line-height: 18px;
		top: -7px;
		right: -7px;
	}

	.cache-badge.auto {
		font-size: 10px;
	}
}
</style>

