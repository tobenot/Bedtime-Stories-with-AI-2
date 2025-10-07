<template>
	<div class="input-footer p-4 glass-effect border-t border-secondary/20">
		<el-row :gutter="10">
			<el-col :span="20">
				<el-input
					class="input-area"
					ref="messageInput"
					v-model="innerValue"
					type="textarea"
					:autosize="{ minRows: 2, maxRows: 10 }"
					:disabled="!canSend"
					placeholder="输入你的消息... (不稳定版本，随时可能大更新或出bug，请多在右上角设置备份对话记录)"
					@keydown.ctrl.enter.prevent="onSend"
				></el-input>
			</el-col>
			<el-col :span="4">
				<el-button class="btn-primary w-full h-full" :disabled="!canSend" @click="onButton">
					<template v-if="isLoading">
						<i class="el-icon-loading" style="margin-right: 8px;"></i>
						取消
					</template>
					<template v-else>
						发送
					</template>
				</el-button>
			</el-col>
		</el-row>
		<el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon class="mt-2"></el-alert>
	</div>
</template>

<script>
export default {
	name: 'InputFooter',
	props: {
		modelValue: { type: String, default: '' },
		apiKey: { type: String, default: '' },
		useBackendProxy: { type: Boolean, default: false },
		isLoading: { type: Boolean, default: false },
		errorMessage: { type: String, default: '' }
	},
	emits: ['update:modelValue', 'send', 'cancel', 'focus-input'],
	computed: {
		innerValue: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		},
		canSend() {
			// 如果使用后端代理，不需要API Key
			if (this.useBackendProxy) {
				return true;
			}
			// 否则需要API Key
			return !!this.apiKey;
		}
	},
	methods: {
		onSend() {
			this.$emit('send')
		},
		onButton() {
			if (this.isLoading) this.$emit('cancel')
			else this.$emit('send')
		},
		focus() {
			this.$refs.messageInput.focus()
		}
	}
}
</script>

<style scoped>
</style>


