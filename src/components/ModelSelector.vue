<template>
	<div class="model-selector-container">
		<div class="model-selector-wrapper">
			<span class="model-label">模型:</span>
			<el-select
				:model-value="selectedModel"
				@update:model-value="handleModelChange"
				placeholder="选择模型"
				class="model-select-white"
				style="min-width: 180px; max-width: 280px;"
				clearable
				filterable
				allow-create
				default-first-option
				popper-class="model-select-popper"
			>
				<el-option
					v-for="modelOption in models"
					:key="modelOption"
					:label="getModelDisplayName(modelOption)"
					:value="modelOption"
				/>
			</el-select>

			<span class="cache-divider"></span>

			<span class="model-label">缓存:</span>
			<el-radio-group
				:model-value="promptCacheTtl || ''"
				:disabled="!cacheAvailable"
				@update:model-value="handleCacheChange"
				size="small"
				class="cache-radio-group"
				:class="{ 'is-unavailable': !cacheAvailable }"
			>
				<el-radio-button label="">关</el-radio-button>
				<el-radio-button label="5m">5m</el-radio-button>
				<el-radio-button label="1h">1h</el-radio-button>
			</el-radio-group>
			<span v-if="!cacheAvailable" class="cache-unavailable-label">{{ unavailableLabel }}</span>
			<el-tooltip
				:content="helpContent"
				placement="bottom"
			>
				<el-icon class="cache-help-icon"><QuestionFilled /></el-icon>
			</el-tooltip>
		</div>
	</div>
</template>

<script>
import { QuestionFilled } from '@element-plus/icons-vue';
import {
	getCacheUnavailableLabel,
	getCacheUnavailableTooltip
} from '@/utils/requestFormat.js';

const CACHE_HELP_AVAILABLE =
	'Claude 手动提示词缓存：把重复发送的上下文缓存起来，命中后输入费用大幅降低（约 1 折）。此开关控制「自动补断点」的 TTL（关=不自动补；5m/1h=自动断点的有效期）。可在单条消息上用金币图标手动标记缓存点。仅 Claude + Anthropic Messages 格式下可用；其余模型由中转自动缓存，无需手动设置。';

export default {
	name: 'ModelSelector',
	components: { QuestionFilled },
	props: {
		selectedModel: { type: String, required: true },
		models: { type: Array, required: true },
		promptCacheTtl: { type: String, default: '' },
		cacheAvailable: { type: Boolean, default: true },
		cacheUnavailableReason: { type: String, default: null }
	},
	emits: ['update:model', 'update:prompt-cache-ttl'],
	computed: {
		unavailableLabel() {
			return getCacheUnavailableLabel(this.cacheUnavailableReason);
		},
		helpContent() {
			if (!this.cacheAvailable) {
				return getCacheUnavailableTooltip(this.cacheUnavailableReason);
			}
			return CACHE_HELP_AVAILABLE;
		}
	},
	methods: {
		handleModelChange(value) {
			this.$emit('update:model', value);
		},
		handleCacheChange(value) {
			if (!this.cacheAvailable) return;
			this.$emit('update:prompt-cache-ttl', value || '');
		},
		getModelDisplayName(model) {
			if (model.startsWith('deepseek-ai/')) {
				return model.replace('deepseek-ai/', '');
			}
			if (model.startsWith('google/')) {
				return model.replace('google/', '');
			}
			if (model.startsWith('anthropic/')) {
				return model.replace('anthropic/', '');
			}
			if (model.startsWith('openai/')) {
				return model.replace('openai/', '');
			}
			if (model.startsWith('x-ai/')) {
				return model.replace('x-ai/', '');
			}
			if (model.startsWith('z-ai/')) {
				return model.replace('z-ai/', '');
			}
			if (model.startsWith('deepseek/')) {
				return model.replace('deepseek/', '');
			}
			if (model.startsWith('moonshotai/')) {
				return model.replace('moonshotai/', '');
			}
			if (model.startsWith('qwen/')) {
				return model.replace('qwen/', '');
			}
			if (model.startsWith('minimax/')) {
				return model.replace('minimax/', '');
			}
			if (model.startsWith('lmrouter/')) {
				return model.replace('lmrouter/', '');
			}
			return model;
		}
	}
}
</script>

<style scoped>
.model-selector-container {
	position: relative;
	z-index: 40;
	margin: 8px 16px;
}

.model-selector-wrapper {
	display: flex;
	align-items: center;
	gap: 8px;
	background: white;
	padding: 8px 12px;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	border: 1px solid #e5e7eb;
	flex-wrap: wrap;
}

.model-label {
	font-size: 14px;
	font-weight: 500;
	color: #6b7280;
	white-space: nowrap;
}

.model-select-white {
	--el-select-border-color-hover: #805AD5;
	--el-select-border-color: #d1d5db;
}

.model-select-white :deep(.el-input__wrapper) {
	border-radius: 6px;
	border: 1px solid #d1d5db;
	background-color: white;
	transition: all 0.2s ease;
}

.model-select-white :deep(.el-input__wrapper:hover) {
	border-color: #805AD5;
	background-color: white;
}

.model-select-white :deep(.el-input__wrapper.is-focus) {
	border-color: #805AD5;
	box-shadow: 0 0 0 2px rgba(128, 90, 213, 0.2);
	background-color: white;
}

.model-select-white :deep(.el-input__inner) {
	color: #374151;
}

.model-select-white :deep(.el-input__inner::placeholder) {
	color: #9ca3af;
}

.model-select-white :deep(.el-select__caret) {
	color: #6b7280;
}

.cache-divider {
	width: 1px;
	height: 20px;
	background: #e5e7eb;
	flex-shrink: 0;
}

.cache-radio-group {
	flex-shrink: 0;
}

.cache-radio-group :deep(.el-radio-button__inner) {
	padding: 4px 10px;
	font-size: 12px;
	border-color: #d1d5db;
	color: #6b7280;
	background-color: #fff;
	transition: all 0.2s ease;
}

.cache-radio-group :deep(.el-radio-button__inner:hover) {
	color: #805AD5;
	border-color: #805AD5;
}

.cache-radio-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
	border-top-left-radius: 6px;
	border-bottom-left-radius: 6px;
}

.cache-radio-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
	border-top-right-radius: 6px;
	border-bottom-right-radius: 6px;
}

.cache-radio-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
	background-color: #805AD5;
	border-color: #805AD5;
	color: #fff;
	box-shadow: -1px 0 0 0 #805AD5;
}

.cache-radio-group.is-unavailable :deep(.el-radio-button__inner) {
	opacity: 0.55;
	cursor: not-allowed;
}

.cache-unavailable-label {
	font-size: 12px;
	color: #b45309;
	white-space: nowrap;
	flex-shrink: 0;
}

.cache-help-icon {
	font-size: 14px;
	color: #9ca3af;
	cursor: help;
	flex-shrink: 0;
	transition: color 0.2s ease;
}

.cache-help-icon:hover {
	color: #805AD5;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.model-selector-container {
		margin: 6px 12px;
	}

	.model-selector-wrapper {
		padding: 6px 10px;
	}

	.model-select-white {
		min-width: 140px !important;
		max-width: 200px !important;
	}

	.cache-radio-group :deep(.el-radio-button__inner) {
		padding: 4px 8px;
	}

	.cache-unavailable-label {
		display: none;
	}
}

@media (max-width: 480px) {
	.model-selector-container {
		margin: 4px 8px;
	}

	.model-selector-wrapper {
		padding: 4px 8px;
		flex-wrap: wrap;
		row-gap: 4px;
	}

	.model-select-white {
		min-width: 120px !important;
		max-width: 160px !important;
	}

	/* 极窄屏仅隐藏「缓存:」文字标签，保留开关与问号 */
	.cache-divider + .model-label {
		display: none;
	}
}
</style>

<style>
/* 模型选择器下拉面板样式（全局，因为 popper 挂在 body 上） */
.model-select-popper .el-select-dropdown__item {
	font-size: 14px;
	line-height: 1.6;
	padding: 8px 16px;
}
</style>
