<template>
	<el-input
		:model-value="modelValue"
		type="text"
		:placeholder="placeholder"
		:name="fieldName"
		autocomplete="off"
		data-form-type="other"
		data-lpignore="true"
		data-1p-ignore="true"
		data-bwignore="true"
		:class="['secret-text-input', { 'is-secret-visible': isVisible }]"
		@update:model-value="updateValue"
		@keydown.enter="emitEnter"

	>
		<template #suffix>
			<button
				type="button"
				class="secret-text-input__toggle"
				:aria-label="isVisible ? '隐藏内容' : '显示内容'"
				@mousedown.prevent
				@click="isVisible = !isVisible"
			>
				<el-icon>
					<component :is="isVisible ? Hide : View" />
				</el-icon>
			</button>
		</template>
	</el-input>
</template>

<script>
import { Hide, View } from '@element-plus/icons-vue';

export default {
	name: 'SecretTextInput',
	components: { Hide, View },
	props: {
		modelValue: { type: String, default: '' },
		placeholder: { type: String, default: '' },
		fieldName: { type: String, default: 'bs2-neutral-field' }
	},
	emits: ['update:modelValue', 'enter'],
	data() {
		return {
			isVisible: false,
			Hide,
			View
		};
	},
	methods: {
		updateValue(value) {
			if (value === this.modelValue) return;
			this.$emit('update:modelValue', value);
		},
		emitEnter(event) {
			this.$emit('enter', event);
		}
	}

};
</script>

<style scoped>
.secret-text-input:not(.is-secret-visible) :deep(.el-input__inner) {
	-webkit-text-security: disc;
	text-security: disc;
}

.secret-text-input__toggle {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	padding: 0;
	border: none;
	background: transparent;
	color: #909399;
	cursor: pointer;
}

.secret-text-input__toggle:hover {
	color: #606266;
}
</style>
