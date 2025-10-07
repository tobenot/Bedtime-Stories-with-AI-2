<!--
	消息控制按钮组件
	提供复制、编辑、删除、重新生成等功能
-->
<template>
	<div class="message-controls flex gap-2">
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
		
		<el-tooltip v-if="message.role === 'assistant' && !isTyping" content="总结对话" placement="top">
			<el-button class="btn-summary" @click="$emit('summary')">
				<el-icon style="font-size: 1.6rem;"><DocumentCopy /></el-icon>
			</el-button>
		</el-tooltip>
		
		<el-tooltip v-if="!isTyping || !isLast" content="删除" placement="top">
			<el-button class="btn-delete" @click="$emit('delete')">
				<el-icon style="font-size: 1.6rem;"><Delete /></el-icon>
			</el-button>
		</el-tooltip>
	</div>
</template>

<script>
import { CopyDocument, Edit, Refresh, Delete, DocumentCopy } from '@element-plus/icons-vue';

export default {
	name: 'MessageControls',
	components: {
		CopyDocument,
		Edit,
		Refresh,
		Delete,
		DocumentCopy
	},
	props: {
		message: {
			type: Object,
			required: true
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
	emits: ['copy', 'edit', 'regenerate', 'delete', 'toggle-reasoning', 'summary']
};
</script>

<style scoped>
</style>

