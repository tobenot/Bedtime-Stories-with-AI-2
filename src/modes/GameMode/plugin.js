import GameMode from './index.vue';

export default {
	id: 'game-mode',
	name: '游戏模式',
	description: '通用文本游戏运行时，通过机制包决定状态、工具和触发器',
	icon: 'Trophy',
	version: '1.0.0',
	author: 'tobenot',
	component: GameMode,
	config: {
		supportReasoning: false,
		supportStreaming: false,
		supportMultiTurn: true
	}
};
