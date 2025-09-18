<template>
	<div class="header sticky top-0 z-50 bg-primary text-white border-b border-primary-light">
		<!-- 模型选择器行 -->
		<div class="flex items-center justify-between px-4 py-1 bg-primary">
			<div class="flex items-center gap-2">
				<span class="text-xs text-white/80 font-medium whitespace-nowrap">模型:</span>
				<el-select 
					:model-value="selectedModel" 
					@update:model-value="handleModelChange"
					placeholder="选择模型"
					class="model-select-compact"
					size="small"
					style="min-width: 140px; max-width: 200px;"
					clearable
					filterable
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
		
		<!-- 标题和操作按钮行 -->
		<div class="flex items-center justify-between p-4">
			<button class="menu-button md:hidden text-white" @click="$emit('toggle-sidebar')">
				<el-icon><Expand /></el-icon>
			</button>
			<div class="flex items-center gap-2">
				<h2 class="truncate text-lg text-white font-medium">{{ title }}</h2>
			</div>
			<div class="header-actions flex items-center gap-4">
				<el-dropdown trigger="click" @command="$emit('toolbox-command', $event)">
					<template #default>
						<button class="header-action-button">
							<el-icon><Briefcase /></el-icon>
						</button>
					</template>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item command="copyChat">复制对话(开if线)</el-dropdown-item>
							<el-dropdown-item command="localScriptEditor">本地剧本编辑器</el-dropdown-item>
							<el-dropdown-item command="exportTxtNovel">导出txt小说</el-dropdown-item>
							<el-dropdown-item command="markdownTool">去星号（Markdown处理工具） </el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
				<button class="header-action-button" @click="$emit('export-pdf')" :disabled="!canExport">
					<el-icon><Printer /></el-icon>
				</button>
				<button class="header-action-button" @click="$emit('open-settings')">
					<el-icon><Setting /></el-icon>
				</button>
			</div>
		</div>
	</div>
</template>

<script>
import { Briefcase, Setting, Expand, Printer } from '@element-plus/icons-vue'

export default {
	name: 'HeaderBar',
	components: { Briefcase, Setting, Expand, Printer },
	props: {
		title: { type: String, default: '' },
		canExport: { type: Boolean, default: false },
		selectedModel: { type: String, required: true },
		models: { type: Array, required: true }
	},
	emits: ['toggle-sidebar', 'toolbox-command', 'export-pdf', 'open-settings', 'update:model'],
	methods: {
		handleModelChange(value) {
			this.$emit('update:model', value);
		},
		getModelDisplayName(model) {
			// 简化模型显示名称，去掉一些前缀
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
			if (model.startsWith('deepseek/')) {
				return model.replace('deepseek/', '');
			}
			return model;
		}
	}
}
</script>

<style scoped>
.model-select-compact {
	--el-select-border-color-hover: #805AD5;
	--el-select-border-color: rgba(255, 255, 255, 0.3);
}

.model-select-compact :deep(.el-input__wrapper) {
	border-radius: 4px;
	border: 1px solid rgba(255, 255, 255, 0.3);
	background-color: rgba(255, 255, 255, 0.1);
	transition: all 0.2s ease;
}

.model-select-compact :deep(.el-input__wrapper:hover) {
	border-color: #805AD5;
	background-color: rgba(255, 255, 255, 0.15);
}

.model-select-compact :deep(.el-input__wrapper.is-focus) {
	border-color: #805AD5;
	box-shadow: 0 0 0 2px rgba(128, 90, 213, 0.2);
	background-color: rgba(255, 255, 255, 0.15);
}

.model-select-compact :deep(.el-input__inner) {
	color: white;
}

.model-select-compact :deep(.el-input__inner::placeholder) {
	color: rgba(255, 255, 255, 0.6);
}

.model-select-compact :deep(.el-select__caret) {
	color: rgba(255, 255, 255, 0.8);
}

/* 响应式设计 */
@media (max-width: 768px) {
	.model-select-compact {
		min-width: 120px !important;
		max-width: 160px !important;
	}
}

@media (max-width: 480px) {
	.model-select-compact {
		min-width: 100px !important;
		max-width: 140px !important;
	}
}
</style>


