<!--
	角色状态显示组件
	显示彩彩的表情和动作状态
-->
<template>
	<div class="character-status">
		<div class="status-header">
			<h3 class="text-lg font-semibold text-gray-800">彩彩的状态</h3>
		</div>
		
		<div class="status-content">
			<div class="emotion-display">
				<div class="emotion-icon">
					{{ emotionIcon }}
				</div>
				<div class="emotion-text">{{ emotionText }}</div>
			</div>
			
			<div class="action-display">
				<div class="action-icon">
					{{ actionIcon }}
				</div>
				<div class="action-text">{{ actionText }}</div>
			</div>
			
			<div v-if="evaluation" class="evaluation-display">
				<div class="evaluation-label">彩彩的想法：</div>
				<div class="evaluation-text">{{ evaluation }}</div>
			</div>
			
			<div v-if="score !== null" class="score-display">
				<div class="score-label">评价：</div>
				<div class="score-stars">
					<span 
						v-for="i in 5" 
						:key="i"
						class="star"
						:class="{ active: i <= score }"
					>
						★
					</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { parseCharacterState, getEmotionInfo, getActionInfo } from '../utils/helpers.js';

export default {
	name: 'CharacterStatus',
	props: {
		message: {
			type: Object,
			default: null
		}
	},
	computed: {
		messageData() {
			return parseCharacterState(this.message);
		},
		emotionIcon() {
			return getEmotionInfo(this.messageData.emote).icon;
		},
		emotionText() {
			return getEmotionInfo(this.messageData.emote).text;
		},
		actionIcon() {
			return getActionInfo(this.messageData.bodyAction).icon;
		},
		actionText() {
			return getActionInfo(this.messageData.bodyAction).text;
		},
		evaluation() {
			return this.messageData.evaluation || '';
		},
		score() {
			return this.messageData.score ?? null;
		}
	}
};
</script>

<style scoped>
@import '../styles/index.css';
</style>
