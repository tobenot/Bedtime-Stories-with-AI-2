<!--
	角色选择器组件
	用于在空对话状态下选择虚拟恋人角色
-->
<template>
	<div class="character-selector">
		<h3 class="selector-title">选择你的虚拟恋人</h3>
		<div class="character-grid">
			<div 
				v-for="(character, key) in availableCharacters"
				:key="key"
				class="character-card"
				:class="{ active: currentCharacterKey === key }"
				@click="handleCharacterSelect(key)"
			>
				<div class="character-avatar-large">
					<span class="avatar-emoji-large">{{ character.avatar }}</span>
				</div>
				<div class="character-info">
					<h4 class="character-name">{{ character.name }}</h4>
					<p class="character-title">{{ character.title }}</p>
					<p class="character-description">{{ character.description }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { characters } from '../characters/index.js';

export default {
	name: 'CharacterSelector',
	props: {
		currentCharacterKey: {
			type: String,
			required: true
		}
	},
	computed: {
		availableCharacters() {
			return characters;
		}
	},
	methods: {
		handleCharacterSelect(characterKey) {
			if (this.currentCharacterKey === characterKey) {
				return;
			}
			
			console.log('[CharacterSelector] 选择角色:', characterKey);
			this.$emit('character-selected', characterKey);
		}
	}
};
</script>

<style scoped>
/* 角色选择器样式 */
.character-selector {
	margin-top: 2rem;
	padding: 1.5rem;
	background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
	border-radius: 16px;
	border: 1px solid rgba(0, 0, 0, 0.05);
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.selector-title {
	text-align: center;
	font-size: 1.25rem;
	font-weight: 600;
	color: #1e293b;
	margin-bottom: 1.5rem;
	background: linear-gradient(135deg, #3b82f6, #8b5cf6);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.character-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 1rem;
	max-width: 1000px;
	margin: 0 auto;
}

.character-card {
	display: flex;
	align-items: center;
	padding: 1rem;
	background: white;
	border-radius: 12px;
	border: 2px solid transparent;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.character-card:hover {
	transform: translateY(-2px);
	box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
	border-color: rgba(59, 130, 246, 0.3);
}

.character-card.active {
	border-color: #3b82f6;
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
}

.character-avatar-large {
	width: 60px;
	height: 60px;
	border-radius: 50%;
	background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 1rem;
	flex-shrink: 0;
}

.avatar-emoji-large {
	font-size: 2rem;
	line-height: 1;
}

.character-info {
	flex: 1;
	min-width: 0;
}

.character-name {
	font-size: 1.1rem;
	font-weight: 600;
	color: #1e293b;
	margin: 0 0 0.25rem 0;
}

.character-title {
	font-size: 0.875rem;
	color: #64748b;
	margin: 0 0 0.5rem 0;
	font-weight: 500;
}

.character-description {
	font-size: 0.8rem;
	color: #64748b;
	line-height: 1.4;
	margin: 0;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.character-grid {
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	
	.character-card {
		padding: 0.75rem;
	}
	
	.character-avatar-large {
		width: 50px;
		height: 50px;
		margin-right: 0.75rem;
	}
	
	.avatar-emoji-large {
		font-size: 1.5rem;
	}
	
	.character-name {
		font-size: 1rem;
	}
	
	.character-title {
		font-size: 0.8rem;
	}
	
	.character-description {
		font-size: 0.75rem;
	}
}
</style>
