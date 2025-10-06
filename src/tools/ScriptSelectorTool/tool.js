/**
 * 剧本选择器工具配置
 */

import ScriptSelectorTool from './index.vue';

export default {
	id: 'script-selector',
	name: '剧本选择器',
	description: '选择预设的剧本作为对话开始',
	icon: 'Document',
	version: '1.0.0',
	component: ScriptSelectorTool,
	// 适用的模式
	compatibleModes: ['standard-chat'],
	// 工具处理函数
	handler: (context, script) => {
		// 返回处理后的内容，将被插入到输入框
		return script;
	}
};

