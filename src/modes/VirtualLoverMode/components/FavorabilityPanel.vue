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
	border-radius: 16px;
	padding: 20px;
	border: 1px solid #f3e8d3;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	backdrop-filter: blur(10px);
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
}

.favorability-panel::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), transparent);
	pointer-events: none;
}

.favorability-panel:hover {
	transform: translateY(-2px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.panel-header {
	margin-bottom: 16px;
	text-align: center;
	position: relative;
	z-index: 1;
}

.panel-header h3 {
	font-size: 18px;
	font-weight: 600;
	color: #374151;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.favorability-display {
	margin-bottom: 12px;
	position: relative;
	z-index: 1;
}

.favorability-bar {
	width: 100%;
	height: 16px;
	background: linear-gradient(90deg, #e5e7eb 0%, #d1d5db 100%);
	border-radius: 8px;
	overflow: hidden;
	margin-bottom: 12px;
	box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	position: relative;
}

.favorability-bar::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
	animation: shimmer 2s infinite;
}

.favorability-fill {
	height: 100%;
	background: linear-gradient(90deg, #f59e0b 0%, #f97316 30%, #ef4444 70%, #dc2626 100%);
	transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;
}

.favorability-fill::after {
	content: '';
	position: absolute;
	top: 0;
	left: -100%;
	width: 100%;
	height: 100%;
	background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
	animation: progressShine 1.5s ease-in-out;
}

.favorability-text {
	display: flex;
	justify-content: space-between;
	align-items: center;
	position: relative;
	z-index: 1;
}

.favorability-value {
	font-size: 20px;
	font-weight: 700;
	color: #374151;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.favorability-label {
	font-size: 14px;
	color: #6b7280;
	font-weight: 500;
	background: rgba(255, 255, 255, 0.6);
	padding: 4px 8px;
	border-radius: 12px;
	backdrop-filter: blur(5px);
}

.favorability-change {
	text-align: center;
	font-size: 18px;
	font-weight: 600;
	animation: fadeInOut 2s ease-in-out;
	position: relative;
	z-index: 1;
}

@keyframes fadeInOut {
	0% { opacity: 0; transform: translateY(-10px) scale(0.8); }
	20% { opacity: 1; transform: translateY(0) scale(1.1); }
	80% { opacity: 1; transform: translateY(0) scale(1); }
	100% { opacity: 0; transform: translateY(-10px) scale(0.8); }
}

@keyframes shimmer {
	0% { transform: translateX(-100%); }
	100% { transform: translateX(100%); }
}

@keyframes progressShine {
	0% { left: -100%; }
	100% { left: 100%; }
}

/* 移动端适配 */
@media (max-width: 768px) {
	.favorability-panel {
		padding: 16px;
		border-radius: 12px;
		min-width: 240px;
	}
	
	.panel-header h3 {
		font-size: 16px;
	}
	
	.favorability-value {
		font-size: 18px;
	}
	
	.favorability-label {
		font-size: 12px;
		padding: 3px 6px;
	}
	
	.favorability-change {
		font-size: 16px;
	}
}

@media (max-width: 480px) {
	.favorability-panel {
		padding: 12px;
		border-radius: 8px;
		min-width: 200px;
	}
	
	.panel-header h3 {
		font-size: 14px;
	}
	
	.favorability-bar {
		height: 12px;
	}
	
	.favorability-value {
		font-size: 16px;
	}
	
	.favorability-label {
		font-size: 11px;
		padding: 2px 4px;
	}
	
	.favorability-change {
		font-size: 14px;
	}
}
</style>
