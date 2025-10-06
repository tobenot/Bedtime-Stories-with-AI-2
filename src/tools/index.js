/**
 * 工具注册中心
 * 所有工具插件都在这里注册
 */

import { toolRegistry } from '@/core/pluginSystem';
import ScriptSelectorTool from './ScriptSelectorTool/tool';

// 注册所有工具
export function registerAllTools() {
	console.log('[Tools] Registering all tools...');
	
	// 注册剧本选择器工具
	toolRegistry.register(ScriptSelectorTool);
	
	// 未来可以在这里注册更多工具：
	// toolRegistry.register(DiceRollerTool);
	// toolRegistry.register(ImageGeneratorTool);
	// toolRegistry.register(CodeRunnerTool);
	
	console.log('[Tools] All tools registered:', toolRegistry.getAll().map(t => t.name));
}

/**
 * 获取所有可用的工具
 */
export function getAllTools() {
	return toolRegistry.getAll();
}

/**
 * 根据ID获取工具
 */
export function getToolById(id) {
	return toolRegistry.getById(id);
}

/**
 * 获取与指定模式兼容的工具
 */
export function getToolsForMode(modeId) {
	return toolRegistry.getAll().filter(tool => {
		if (!tool.compatibleModes) return true; // 没有限制则兼容所有模式
		return tool.compatibleModes.includes(modeId);
	});
}

