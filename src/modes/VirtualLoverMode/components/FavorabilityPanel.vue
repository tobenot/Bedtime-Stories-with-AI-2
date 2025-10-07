<!--
	好感度面板组件
	显示彩彩的好感度状态
-->
<template>
	<div class="favorability-panel">
		<div class="panel-header">
			<h3 class="text-lg font-semibold text-gray-800">彩彩的好感度</h3>
		</div>
		
		<div class="favorability-display">
			<div class="favorability-bar">
				<div 
					class="favorability-fill"
					:style="{ width: favorabilityPercentage + '%' }"
				></div>
			</div>
			<div class="favorability-text">
				<span class="favorability-value">{{ favorability }}</span>
				<span class="favorability-label">{{ favorabilityLabel }}</span>
			</div>
		</div>
		
		<div v-if="lastChange" class="favorability-change">
			<span :class="changeClass">
				{{ lastChange > 0 ? '+' : '' }}{{ lastChange }}
			</span>
		</div>
	</div>
</template>

<script>
export default {
	name: 'FavorabilityPanel',
	props: {
		favorability: {
			type: Number,
			default: 50
		},
		lastChange: {
			type: Number,
			default: null
		}
	},
	computed: {
		favorabilityPercentage() {
			return Math.min(Math.max(this.favorability, 0), 100);
		},
		favorabilityLabel() {
			if (this.favorability >= 90) return '深爱';
			if (this.favorability >= 80) return '很喜欢';
			if (this.favorability >= 70) return '喜欢';
			if (this.favorability >= 60) return '有好感';
			if (this.favorability >= 40) return '普通';
			if (this.favorability >= 20) return '冷淡';
			return '讨厌';
		},
		changeClass() {
			if (this.lastChange > 0) return 'text-green-600 font-semibold';
			if (this.lastChange < 0) return 'text-red-600 font-semibold';
			return 'text-gray-500';
		}
	}
};
</script>

<style scoped>
.favorability-panel {
	background: linear-gradient(135deg, #fef7f0 0%, #fdf2e9 100%);
	border-radius: 12px;
	padding: 16px;
	border: 1px solid #f3e8d3;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.panel-header {
	margin-bottom: 12px;
	text-align: center;
}

.favorability-display {
	margin-bottom: 8px;
}

.favorability-bar {
	width: 100%;
	height: 12px;
	background-color: #e5e7eb;
	border-radius: 6px;
	overflow: hidden;
	margin-bottom: 8px;
}

.favorability-fill {
	height: 100%;
	background: linear-gradient(90deg, #f59e0b 0%, #f97316 50%, #ef4444 100%);
	transition: width 0.5s ease;
}

.favorability-text {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.favorability-value {
	font-size: 18px;
	font-weight: bold;
	color: #374151;
}

.favorability-label {
	font-size: 14px;
	color: #6b7280;
}

.favorability-change {
	text-align: center;
	font-size: 16px;
	animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
	0% { opacity: 0; transform: translateY(-10px); }
	20% { opacity: 1; transform: translateY(0); }
	80% { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(-10px); }
}
</style>
