/**
 * 虚拟恋人模式插件配置
 */

import VirtualLoverMode from './index.vue';

export default {
	id: 'virtual-lover',
	name: '虚拟恋人',
	description: '与彩彩的对话，体验虚拟恋人的温馨互动',
	icon: 'ChatDotRound',
	version: '1.0.0',
	author: 'tobenot',
	component: VirtualLoverMode,
	config: {
		supportReasoning: false,
		supportStreaming: true,
		supportMultiTurn: true,
		requiresJsonResponse: true
	}
};
