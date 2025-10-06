/**
 * 标准对话模式插件配置
 */

import StandardChatMode from './index.vue';

export default {
	id: 'standard-chat',
	name: '标准对话',
	description: '经典的AI对话模式，支持多轮对话、思考过程展示等功能',
	icon: 'ChatDotRound',
	version: '1.0.0',
	author: 'tobenot',
	component: StandardChatMode,
	config: {
		// 插件默认配置
		supportReasoning: true,
		supportStreaming: true,
		supportMultiTurn: true
	}
};

