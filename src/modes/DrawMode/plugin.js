/**
 * 绘图模式插件配置
 */

import DrawMode from './index.vue';

export default {
	id: 'draw-mode',
	name: '绘图模式',
	description: '基于 Gemini 2.5 的图像生成模式，支持多轮对话修改图片',
	icon: 'Picture',
	version: '1.0.0',
	author: 'tobenot',
	component: DrawMode,
	config: {
		supportReasoning: false,
		supportStreaming: false, // 图片生成通常为非流式
		supportMultiTurn: true,
		// 移除 defaultModel 强制限制，允许用户选择
	}
};

