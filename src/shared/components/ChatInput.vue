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
					@keydown.ctrl.enter.exact.prevent="onSend"
					@keydown.ctrl.shift.enter.exact.prevent="onSendNoReply"
				></el-input>
			</el-col>
			<el-col :span="4">
				<template v-if="isLoading">
					<el-button 
						class="btn-primary w-full h-full" 
						:disabled="disabled" 
						@click="onButton"
					>
						<i class="el-icon-loading" style="margin-right: 8px;"></i>
						{{ cancelText }}
					</el-button>
				</template>
				<template v-else-if="enableSendWithoutReply">
					<div class="send-group h-full">
						<el-button 
							class="btn-primary send-main"
							:disabled="disabled"
							@click="onSend"
						>
							{{ sendText }}
						</el-button>
						<el-dropdown trigger="click" @command="onSendCommand">
							<el-button class="send-dropdown" :disabled="disabled">
								▼
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item command="no-reply">仅发送，不触发回复</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</div>
				</template>
				<template v-else>
					<el-button 
						class="btn-primary w-full h-full" 
						:disabled="disabled" 
						@click="onButton"
					>
						{{ sendText }}
					</el-button>
				</template>
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
			default: '输入你的消息... (不稳定版本，随时可能大更新或出bug，请多在右上角设置备份对话记录)'
		},
		sendText: {
			type: String,
			default: '发送'
		},
		cancelText: {
			type: String,
			default: '取消'
		},
		enableSendWithoutReply: {
			type: Boolean,
			default: false
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
		onSend(mode = 'normal') {
			this.$emit('send', mode);
		},
		onSendNoReply() {
			if (!this.enableSendWithoutReply) {
				return;
			}
			this.onSend('no-reply');
		},
		onSendCommand(command) {
			if (command === 'no-reply') {
				this.onSendNoReply();
			}
		},
		onButton() {
			if (this.isLoading) {
				this.$emit('cancel');
			} else {
				this.onSend();
			}
		},
		focus() {
			this.$refs.messageInput.focus();
		}
	}
};
</script>

<style scoped>
.chat-input {
	padding-bottom: calc(1rem + env(safe-area-inset-bottom));
	position: relative;
	z-index: 10;
	background-color: white;
	flex-shrink: 0;
}

.input-area {
	position: relative;
	z-index: 1;
}

.input-area :deep(.el-textarea__inner) {
	resize: none;
	overflow-y: auto;
	max-height: 200px;
}

.send-group {
	display: flex;
	align-items: stretch;
	gap: 6px;
	height: 100%;
}

.send-main {
	flex: 1;
	height: 100%;
}

.send-dropdown {
	height: 100%;
	width: 34px;
	padding: 0;
}
</style>

