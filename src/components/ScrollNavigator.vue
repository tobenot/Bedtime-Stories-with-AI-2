<template>
	<el-dialog
		v-model="visible"
		title="消息进度定位"
		width="90%"
		:max-width="500"
		:close-on-click-modal="true"
	>
		<div class="scroll-navigator">
			<div class="info-text mb-4 text-center">
				当前共有 <strong>{{ totalMessages }}</strong> 条消息
			</div>

			<div class="navigator-section mb-6">
				<div class="section-title mb-3">按百分比定位</div>
				<div class="flex items-center gap-3">
					<el-slider
						v-model="percentValue"
						:min="0"
						:max="100"
						:step="1"
						class="flex-1"
						@change="handlePercentChange"
					/>
					<el-input-number
						v-model="percentValue"
						:min="0"
						:max="100"
						:precision="0"
						:controls="false"
						class="w-20"
						@change="handlePercentChange"
					/>
					<span class="text-gray-600">%</span>
				</div>
			</div>

			<div class="navigator-section">
				<div class="section-title mb-3">按消息序号定位</div>
				<div class="flex items-center gap-3">
					<el-input-number
						v-model="indexValue"
						:min="1"
						:max="totalMessages"
						:precision="0"
						class="flex-1"
						placeholder="输入消息序号"
					/>
					<el-button type="primary" @click="handleIndexScroll">定位</el-button>
				</div>
				<div class="hint-text mt-2 text-sm text-gray-500">
					范围：1 - {{ totalMessages }}
				</div>
			</div>
		</div>
	</el-dialog>
</template>

<script>
export default {
	name: 'ScrollNavigator',
	props: {
		modelValue: {
			type: Boolean,
			default: false
		},
		totalMessages: {
			type: Number,
			default: 0
		},
		currentPercent: {
			type: Number,
			default: 0
		}
	},
	emits: ['update:modelValue', 'scroll-percent', 'scroll-index'],
	data() {
		return {
			percentValue: 0,
			indexValue: 1
		};
	},
	computed: {
		visible: {
			get() {
				return this.modelValue;
			},
			set(val) {
				this.$emit('update:modelValue', val);
			}
		}
	},
	watch: {
		currentPercent(newVal) {
			if (this.visible) {
				this.percentValue = Math.round(newVal);
			}
		},
		visible(newVal) {
			if (newVal) {
				this.percentValue = Math.round(this.currentPercent);
				this.indexValue = 1;
			}
		},
		totalMessages() {
			if (this.indexValue > this.totalMessages) {
				this.indexValue = Math.max(1, this.totalMessages);
			}
		}
	},
	methods: {
		handlePercentChange() {
			const clamped = Math.min(Math.max(this.percentValue, 0), 100);
			this.$emit('scroll-percent', clamped);
		},
		handleIndexScroll() {
			if (!this.totalMessages) {
				return;
			}
			const target = Math.min(Math.max(this.indexValue || 1, 1), this.totalMessages);
			this.$emit('scroll-index', target);
		}
	}
};
</script>

<style scoped>
.scroll-navigator {
	padding: 0.5rem 0;
}

.section-title {
	font-weight: 500;
	color: #333;
}

.hint-text {
	text-align: left;
}

.info-text {
	font-size: 1rem;
	color: #666;
}

.info-text strong {
	color: #409eff;
	font-weight: 600;
}
</style>
