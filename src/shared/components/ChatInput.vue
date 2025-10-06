<!--
	可复用的输入组件
	提供消息输入和发送功能
-->
<template>
	<div class="chat-input p-4 glass-effect border-t border-secondary/20">
		<!-- 工具栏插槽 -->
		<div v-if="$slots.toolbar" class="toolbar mb-2">
			<slot name="toolbar"></slot>
		</div>
		
		<el-row :gutter="10">
			<el-col :span="20">
				<el-input
					class="input-area"
					ref="messageInput"
					v-model="innerValue"
					type="textarea"
					:autosize="{ minRows: 2, maxRows: 10 }"
					:disabled="disabled"
					:placeholder="placeholder"
					@keydown.ctrl.enter.prevent="onSend"
				></el-input>
			</el-col>
			<el-col :span="4">
				<el-button 
					class="btn-primary w-full h-full" 
					:disabled="disabled" 
					@click="onButton"
				>
					<template v-if="isLoading">
						<i class="el-icon-loading" style="margin-right: 8px;"></i>
						{{ cancelText }}
					</template>
					<template v-else>
						{{ sendText }}
					</template>
				</el-button>
			</el-col>
		</el-row>
		
		<el-alert 
			v-if="errorMessage" 
			:title="errorMessage" 
			type="error" 
			show-icon 
			class="mt-2"
		></el-alert>
	</div>
</template>

<script>
export default {
	name: 'ChatInput',
	props: {
		modelValue: { 
			type: String, 
			default: '' 
		},
		disabled: { 
			type: Boolean, 
			default: false 
		},
		isLoading: { 
			type: Boolean, 
			default: false 
		},
		errorMessage: { 
			type: String, 
			default: '' 
		},
		placeholder: {
			type: String,
			default: '输入你的消息...'
		},
		sendText: {
			type: String,
			default: '发送'
		},
		cancelText: {
			type: String,
			default: '取消'
		}
	},
	emits: ['update:modelValue', 'send', 'cancel'],
	computed: {
		innerValue: {
			get() { 
				return this.modelValue;
			},
			set(v) { 
				this.$emit('update:modelValue', v);
			}
		}
	},
	methods: {
		onSend() {
			this.$emit('send');
		},
		onButton() {
			if (this.isLoading) {
				this.$emit('cancel');
			} else {
				this.$emit('send');
			}
		},
		focus() {
			this.$refs.messageInput.focus();
		}
	}
};
</script>

<style scoped>
</style>

