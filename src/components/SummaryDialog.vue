<!--
	总结对话框组件
	允许用户输入总结倾向，触发AI总结功能
-->
<template>
	<el-dialog
		v-model="visible"
		title="总结对话"
		width="500px"
		:close-on-click-modal="false"
		:close-on-press-escape="true"
		@close="handleClose"
	>
		<div class="summary-dialog-content">
			<div class="summary-description mb-4">
				<p class="text-gray-600 text-sm">
					总结功能会将当前对话内容进行压缩，保留重要信息。总结后的内容将替代之前的对话历史发送给AI。
				</p>
			</div>
			
			<div class="summary-input-section">
				<label class="block text-sm font-medium text-gray-700 mb-2">
					总结倾向
				</label>
				<el-input
					v-model="summaryPreference"
					type="textarea"
					:rows="3"
					placeholder="请输入总结倾向，例如：保留感受和感情、保留关键信息、简洁明了等..."
					maxlength="200"
					show-word-limit
				/>
			</div>
			
			<div class="summary-tips mt-4">
				<div class="tips-title text-sm font-medium text-gray-700 mb-2">提示：</div>
				<ul class="tips-list text-xs text-gray-500 space-y-1">
					<li>• 总结后可以删除总结消息来撤销总结</li>
					<li>• 如果有多个总结，将使用最后一个总结</li>
					<li>• 总结消息之后的内容会正常发送给AI</li>
				</ul>
			</div>
		</div>
		
		<template #footer>
			<div class="dialog-footer">
				<el-button @click="handleClose">取消</el-button>
				<el-button 
					type="primary" 
					@click="handleConfirm"
					:disabled="!summaryPreference.trim()"
				>
					确认总结
				</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script>
export default {
	name: 'SummaryDialog',
	props: {
		modelValue: {
			type: Boolean,
			default: false
		}
	},
	emits: ['update:modelValue', 'confirm'],
	data() {
		return {
			summaryPreference: ''
		};
	},
	computed: {
		visible: {
			get() {
				return this.modelValue;
			},
			set(value) {
				this.$emit('update:modelValue', value);
			}
		}
	},
	methods: {
		handleClose() {
			this.visible = false;
			this.summaryPreference = '';
		},
		handleConfirm() {
			if (this.summaryPreference.trim()) {
				this.$emit('confirm', this.summaryPreference.trim());
				this.handleClose();
			}
		}
	}
};
</script>

<style scoped>
.summary-dialog-content {
	padding: 0.5rem 0;
}

.summary-description {
	background-color: #f8f9fa;
	padding: 1rem;
	border-radius: 6px;
	border-left: 4px solid #007bff;
}

.summary-input-section {
	margin-bottom: 1rem;
}

.tips-title {
	color: #6b7280;
}

.tips-list {
	list-style: none;
	padding: 0;
}

.tips-list li {
	position: relative;
	padding-left: 0.5rem;
}

.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}
</style>
