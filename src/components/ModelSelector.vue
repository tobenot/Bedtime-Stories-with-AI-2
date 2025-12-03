<template>
	<div class="model-selector-container">
		<div class="model-selector-wrapper">
			<span class="model-label">模型:</span>
			<el-select 
				:model-value="selectedModel" 
				@update:model-value="handleModelChange"
				placeholder="选择模型"
				class="model-select-white"
				size="small"
				style="min-width: 140px; max-width: 200px;"
				clearable
				filterable
				allow-create
				default-first-option
			>
				<el-option
					v-for="modelOption in models"
					:key="modelOption"
					:label="getModelDisplayName(modelOption)"
					:value="modelOption"
				/>
			</el-select>
		</div>
	</div>
</template>

<script>
export default {
	name: 'ModelSelector',
	props: {
		selectedModel: { type: String, required: true },
		models: { type: Array, required: true }
	},
	emits: ['update:model'],
	methods: {
		handleModelChange(value) {
			this.$emit('update:model', value);
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
}

.model-label {
	font-size: 12px;
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

/* 响应式设计 */
@media (max-width: 768px) {
	.model-selector-container {
		margin: 6px 12px;
	}
	
	.model-selector-wrapper {
		padding: 6px 10px;
	}
	
	.model-select-white {
		min-width: 120px !important;
		max-width: 160px !important;
	}
}

@media (max-width: 480px) {
	.model-selector-container {
		margin: 4px 8px;
	}
	
	.model-selector-wrapper {
		padding: 4px 8px;
	}
	
	.model-select-white {
		min-width: 100px !important;
		max-width: 140px !important;
	}
}
</style>