<!--
	5 分钟缓存倒计时组件
	在启用了 5m 缓存并发送消息后显示，倒计时 5 分钟。
	点击组件可自动向消息栏填入 "谢谢"，方便用户赶在缓存过期前续命。
	样式与缓存徽章保持一致：紫色(倒计时中) / 橙色(即将过期) / 白底灰字灰描边(已过期)
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
	border: none;
	border-radius: 8px;
	background: #805AD5;
	color: #fff;
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
	cursor: pointer;
	user-select: none;
	box-shadow: 0 2px 8px rgba(80, 90, 213, 0.28);
	transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}

.cache-countdown:hover {
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(80, 90, 213, 0.36);
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

/* 即将过期（≤60s）：橙色提醒 */
.cache-countdown.is-urgent {
	background: #F6AD55;
	box-shadow: 0 2px 8px rgba(246, 173, 85, 0.4);
	animation: cache-countdown-pulse 1s ease-in-out infinite;
}

.cache-countdown.is-urgent:hover {
	box-shadow: 0 4px 12px rgba(246, 173, 85, 0.5);
}

/* 已过期：白底灰字 + 灰描边，与自动缓存徽章一致 */
.cache-countdown.is-expired {
	background: #fff;
	color: #9ca3af;
	border: 1px solid #d1d5db;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	animation: none;
}

.cache-countdown.is-expired:hover {
	color: #6b7280;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

@keyframes cache-countdown-pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.72; }
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
