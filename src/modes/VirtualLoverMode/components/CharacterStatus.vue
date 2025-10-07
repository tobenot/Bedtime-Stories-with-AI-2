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
		message: {
			type: Object,
			default: null
		}
	},
	computed: {
		messageData() {
			if (!this.message || !this.message.content) {
				return { emote: 1, bodyAction: 5, evaluation: '', score: null };
			}
			
			try {
				return JSON.parse(this.message.content);
			} catch (e) {
				return { emote: 1, bodyAction: 5, evaluation: '', score: null };
			}
		},
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
			return emotionMap[this.messageData.emote] || '😊';
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
			return emotionMap[this.messageData.emote] || '微笑';
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
			return actionMap[this.messageData.bodyAction] || '🌟';
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
			return actionMap[this.messageData.bodyAction] || '待机中';
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
.character-status {
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	border-radius: 16px;
	padding: 20px;
	border: 1px solid #bae6fd;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	backdrop-filter: blur(10px);
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
}

.character-status::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), transparent);
	pointer-events: none;
}

.character-status:hover {
	transform: translateY(-2px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.status-header {
	margin-bottom: 16px;
	text-align: center;
	position: relative;
	z-index: 1;
}

.status-header h3 {
	font-size: 18px;
	font-weight: 600;
	color: #374151;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.status-content {
	display: flex;
	flex-direction: column;
	gap: 16px;
	position: relative;
	z-index: 1;
}

.emotion-display,
.action-display {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px;
	background: rgba(255, 255, 255, 0.4);
	border-radius: 12px;
	backdrop-filter: blur(5px);
	transition: all 0.3s ease;
}

.emotion-display:hover,
.action-display:hover {
	background: rgba(255, 255, 255, 0.6);
	transform: translateX(4px);
}

.emotion-icon,
.action-icon {
	font-size: 28px;
	width: 40px;
	text-align: center;
	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	transition: transform 0.3s ease;
}

.emotion-display:hover .emotion-icon,
.action-display:hover .action-icon {
	transform: scale(1.1);
}

.emotion-text,
.action-text {
	font-size: 14px;
	color: #374151;
	font-weight: 600;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.evaluation-display,
.score-display {
	background: rgba(255, 255, 255, 0.7);
	border-radius: 12px;
	padding: 12px;
	backdrop-filter: blur(5px);
	border: 1px solid rgba(255, 255, 255, 0.3);
	transition: all 0.3s ease;
}

.evaluation-display:hover,
.score-display:hover {
	background: rgba(255, 255, 255, 0.9);
	transform: translateY(-2px);
}

.evaluation-label,
.score-label {
	font-size: 12px;
	color: #6b7280;
	margin-bottom: 6px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.evaluation-text {
	font-size: 13px;
	color: #374151;
	font-style: italic;
	font-weight: 500;
	line-height: 1.4;
}

.score-stars {
	display: flex;
	gap: 4px;
	justify-content: center;
}

.star {
	font-size: 18px;
	color: #d1d5db;
	transition: all 0.3s ease;
	filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.star:hover {
	transform: scale(1.2);
}

.star.active {
	color: #fbbf24;
	text-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
	animation: starGlow 2s ease-in-out infinite;
}

@keyframes starGlow {
	0%, 100% { text-shadow: 0 0 8px rgba(251, 191, 36, 0.5); }
	50% { text-shadow: 0 0 16px rgba(251, 191, 36, 0.8); }
}

/* 移动端适配 */
@media (max-width: 768px) {
	.character-status {
		padding: 16px;
		border-radius: 12px;
		min-width: 240px;
	}
	
	.status-header h3 {
		font-size: 16px;
	}
	
	.emotion-display,
	.action-display {
		padding: 6px;
		gap: 8px;
	}
	
	.emotion-icon,
	.action-icon {
		font-size: 24px;
		width: 32px;
	}
	
	.emotion-text,
	.action-text {
		font-size: 13px;
	}
	
	.evaluation-display,
	.score-display {
		padding: 10px;
	}
	
	.evaluation-text {
		font-size: 12px;
	}
	
	.star {
		font-size: 16px;
	}
}

@media (max-width: 480px) {
	.character-status {
		padding: 12px;
		border-radius: 8px;
		min-width: 200px;
	}
	
	.status-header h3 {
		font-size: 14px;
	}
	
	.status-content {
		gap: 12px;
	}
	
	.emotion-display,
	.action-display {
		padding: 4px;
		gap: 6px;
	}
	
	.emotion-icon,
	.action-icon {
		font-size: 20px;
		width: 28px;
	}
	
	.emotion-text,
	.action-text {
		font-size: 12px;
	}
	
	.evaluation-display,
	.score-display {
		padding: 8px;
	}
	
	.evaluation-label,
	.score-label {
		font-size: 11px;
	}
	
	.evaluation-text {
		font-size: 11px;
	}
	
	.star {
		font-size: 14px;
	}
}
</style>
