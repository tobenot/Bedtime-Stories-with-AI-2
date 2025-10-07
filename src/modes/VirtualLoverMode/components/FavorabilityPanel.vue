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
import { getFavorabilityLevel } from '../utils/helpers.js';

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
			return getFavorabilityLevel(this.favorability);
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
@import '../styles/index.css';
</style>
