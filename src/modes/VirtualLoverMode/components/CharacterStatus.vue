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
export default {
	name: 'CharacterStatus',
	props: {
		emote: {
			type: Number,
			default: 1
		},
		bodyAction: {
			type: Number,
			default: 5
		},
		evaluation: {
			type: String,
			default: ''
		},
		score: {
			type: Number,
			default: null
		}
	},
	computed: {
		emotionIcon() {
			const emotionMap = {
				1: '😊', // Smile(Idle)
				2: '😑', // Squint
				3: '😌', // Enjoy
				4: '🤩', // Excited
				5: '😢', // Sad
				6: '😳', // Embarrassed
				7: '😮', // Surprised
				8: '😠'  // Angry
			};
			return emotionMap[this.emote] || '😊';
		},
		emotionText() {
			const emotionMap = {
				1: '微笑',
				2: '眯眼',
				3: '享受',
				4: '兴奋',
				5: '难过',
				6: '害羞',
				7: '惊讶',
				8: '生气'
			};
			return emotionMap[this.emote] || '微笑';
		},
		actionIcon() {
			const actionMap = {
				0: '💫', // Idle2
				1: '✨', // Idle3
				2: '🎩', // Hold the witch hat
				3: '🎨', // Successful wave brush
				4: '💔', // Failed wave brush
				5: '🌟'  // Idle
			};
			return actionMap[this.bodyAction] || '🌟';
		},
		actionText() {
			const actionMap = {
				0: '休息中',
				1: '思考中',
				2: '整理帽子',
				3: '挥舞画笔',
				4: '画笔掉落',
				5: '待机中'
			};
			return actionMap[this.bodyAction] || '待机中';
		}
	}
};
</script>

<style scoped>
.character-status {
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	border-radius: 12px;
	padding: 16px;
	border: 1px solid #bae6fd;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.status-header {
	margin-bottom: 12px;
	text-align: center;
}

.status-content {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.emotion-display,
.action-display {
	display: flex;
	align-items: center;
	gap: 8px;
}

.emotion-icon,
.action-icon {
	font-size: 24px;
	width: 32px;
	text-align: center;
}

.emotion-text,
.action-text {
	font-size: 14px;
	color: #374151;
	font-weight: 500;
}

.evaluation-display,
.score-display {
	background: rgba(255, 255, 255, 0.6);
	border-radius: 8px;
	padding: 8px;
}

.evaluation-label,
.score-label {
	font-size: 12px;
	color: #6b7280;
	margin-bottom: 4px;
}

.evaluation-text {
	font-size: 13px;
	color: #374151;
	font-style: italic;
}

.score-stars {
	display: flex;
	gap: 2px;
}

.star {
	font-size: 16px;
	color: #d1d5db;
	transition: color 0.3s ease;
}

.star.active {
	color: #fbbf24;
}
</style>
