<template>
	<el-dialog
		v-model="innerShow"
		title="编辑消息"
		width="80%"
		:before-close="handleClose"
		@opened="handleOpened"
	>
		<el-input
			ref="editInput"
			v-model="innerContent"
			type="textarea"
			:rows="10"
			:autosize="{ minRows: 10, maxRows: 20 }"
			placeholder="编辑消息内容..."
		></el-input>
		<template #footer>
			<span class="dialog-footer">
				<el-button @click="handleClose">取消</el-button>
				<el-button type="primary" @click="handleSave">保存</el-button>
			</span>
		</template>
	</el-dialog>
</template>

<script>
export default {
	name: 'EditMessageDialog',
	props: {
		modelValue: { type: Boolean, default: false },
		content: { type: String, default: '' }
	},
	emits: ['update:modelValue', 'update:content', 'save'],
	computed: {
		innerShow: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		},
		innerContent: {
			get() { return this.content },
			set(v) { this.$emit('update:content', v) }
		}
	},
	methods: {
		handleClose() {
			this.$emit('update:modelValue', false)
			this.$emit('update:content', '')
		},
		handleSave() {
			const editedContent = this.innerContent.trim()
			if (editedContent) {
				this.$emit('save', editedContent)
			} else {
				this.$message({
					message: '消息内容不能为空',
					type: 'warning',
					duration: 2000
				})
			}
		},
		handleOpened() {
			this.$nextTick(() => {
				const textarea = this.$refs.editInput.$el.querySelector('textarea')
				if (textarea) {
					textarea.scrollTop = textarea.scrollHeight
					textarea.setSelectionRange(textarea.value.length, textarea.value.length)
					textarea.focus()
				}
			})
		}
	}
}
</script>

<style scoped>
</style>
