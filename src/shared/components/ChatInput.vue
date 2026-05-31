<!--
	可复用的输入组件
	提供消息输入和发送功能
-->
<template>
	<div
		class="chat-input p-4 glass-effect border-t border-secondary/20"
		:class="{ 'is-mobile': isMobile }"
	>
		<!-- 工具栏插槽 -->
		<div v-if="$slots.toolbar" class="toolbar mb-2">
			<slot name="toolbar"></slot>
		</div>

		<!-- 桌面端布局：输入框 + 按钮在同一行 -->
		<el-row v-if="!isMobile" :gutter="10">
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

		<!-- 移动端布局：输入框占满一行，按钮在下方一行并排显示 -->
		<template v-else>
			<el-input
				class="input-area mobile-input"
				ref="messageInput"
				v-model="innerValue"
				type="textarea"
				:autosize="{ minRows: 2, maxRows: 8 }"
				:disabled="disabled"
				:placeholder="placeholder"
				@keydown.ctrl.enter.exact.prevent="onSend"
				@keydown.ctrl.shift.enter.exact.prevent="onSendNoReply"
			></el-input>
			<div class="mobile-actions">
				<template v-if="isLoading">
					<el-button
						class="btn-primary mobile-btn mobile-btn-cancel"
						:disabled="disabled"
						@click="onButton"
					>
						<i class="el-icon-loading" style="margin-right: 6px;"></i>
						{{ cancelText }}
					</el-button>
				</template>
				<template v-else>
					<el-button
						class="btn-primary mobile-btn mobile-btn-send"
						:disabled="disabled"
						@click="onSend"
					>
						{{ sendText }}
					</el-button>
					<el-button
						v-if="enableSendWithoutReply"
						class="mobile-btn mobile-btn-no-reply"
						:disabled="disabled"
						@click="onSendNoReply"
						title="仅发送用户消息，不触发AI回复"
					>
						仅发送
					</el-button>
				</template>
			</div>
		</template>

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
	data() {
		return {
			isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false
		};
	},
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
	mounted() {
		this._handleResize = () => {
			const next = window.innerWidth < 768;
			if (next !== this.isMobile) {
				this.isMobile = next;
			}
		};
		window.addEventListener('resize', this._handleResize);
	},
	unmounted() {
		if (this._handleResize) {
			window.removeEventListener('resize', this._handleResize);
			this._handleResize = null;
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

/* 移动端样式 */
.chat-input.is-mobile {
	padding: 0.75rem;
	padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
}

.mobile-input :deep(.el-textarea__inner) {
	max-height: 160px;
}

.mobile-actions {
	display: flex;
	align-items: stretch;
	gap: 8px;
	margin-top: 0.5rem;
}

.mobile-actions .mobile-btn {
	flex: 1;
	min-height: 40px;
	margin: 0;
}

/* 主发送按钮占据更多空间 */
.mobile-actions .mobile-btn-send {
	flex: 2;
}

.mobile-actions .mobile-btn-no-reply {
	flex: 1;
	font-size: 0.875rem;
}

.mobile-actions .mobile-btn-cancel {
	flex: 1;
}
</style>

