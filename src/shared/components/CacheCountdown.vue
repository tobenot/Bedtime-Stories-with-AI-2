<!--
	5 分钟缓存倒计时组件
	在启用了 5m 缓存并发送消息后显示，倒计时 5 分钟。
	点击组件可自动向消息栏填入 "谢谢"，方便用户赶在缓存过期前续命。
	灰底白字，用描边颜色区分状态：紫色(倒计时中) / 橙色(即将过期) / 红色(已过期)
-->
<template>
	<transition name="cache-countdown-fade">
		<button
			v-if="active"
			class="cache-countdown"
			:class="{ 'is-urgent': urgent, 'is-expired': expired }"
			type="button"
			:title="tipText"
			@click="$emit('click')"
		>
			<svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="13" r="8" />
				<path d="M12 9v4l2.5 2.5" />
				<path d="M9 2h6" />
			</svg>
			<span class="cc-text">{{ displayText }}</span>
		</button>
	</transition>
</template>

<script>
export default {
	name: 'CacheCountdown',
	props: {
		// 是否显示
		active: {
			type: Boolean,
			default: false
		},
		// 剩余秒数
		remaining: {
			type: Number,
			default: 0
		}
	},
	emits: ['click'],
	computed: {
		expired() {
			return this.remaining <= 0;
		},
		urgent() {
			return !this.expired && this.remaining <= 60;
		},
		formatted() {
			const total = Math.max(0, this.remaining);
			const m = Math.floor(total / 60);
			const s = total % 60;
			return `${m}:${String(s).padStart(2, '0')}`;
		},
		displayText() {
			return this.expired ? '缓存已过期' : this.formatted;
		},
		tipText() {
			return this.expired
				? '5 分钟缓存已过期，点击填入“谢谢”'
				: '5 分钟缓存倒计时，点击填入“谢谢”以赶在过期前发送';
		}
	}
};
</script>

<style scoped>
.cache-countdown {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 11px;
	border: 1px solid #805AD5;
	border-radius: 8px;
	background: #6b7280;
	color: #fff;
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
	cursor: pointer;
	user-select: none;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}

.cache-countdown:hover {
	transform: translateY(-1px);
	color: #fff;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cache-countdown:active {
	transform: translateY(0);
}

.cc-icon {
	width: 14px;
	height: 14px;
	flex-shrink: 0;
}

.cc-text {
	font-variant-numeric: tabular-nums;
	letter-spacing: 0.3px;
}

/* 即将过期（≤60s）：橙色描边，文字加深，不做闪烁 */
.cache-countdown.is-urgent {
	border-color: #F6AD55;
	color: #fff;
	background: #4b5563;
}

/* 已过期：红色描边 + 弱化底色 */
.cache-countdown.is-expired {
	background: #9ca3af;
	color: #fff;
	border-color: #ef4444;
}

.cache-countdown.is-expired:hover {
	color: #fff;
}

/* 移动端：放大尺寸，保证点击区域 */
@media (max-width: 768px) {
	.cache-countdown {
		padding: 7px 14px;
		font-size: 14px;
		border-radius: 10px;
	}

	.cc-icon {
		width: 16px;
		height: 16px;
	}
}

.cache-countdown-fade-enter-active,
.cache-countdown-fade-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.cache-countdown-fade-enter-from,
.cache-countdown-fade-leave-to {
	opacity: 0;
	transform: translateY(6px);
}
</style>
