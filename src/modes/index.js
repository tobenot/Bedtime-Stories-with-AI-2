/**
 * 模式插件注册中心
 * 所有模式插件都在这里注册
 */

import { pluginSystem } from '@/core/pluginSystem';
import StandardChatMode from './StandardChatMode/plugin';
import DrawMode from './DrawMode/plugin';

// 注册所有模式插件
export function registerAllModes() {
	console.log('[Modes] Registering all mode plugins...');
	
	// 注册标准对话模式
	pluginSystem.register(StandardChatMode);
	
	// 注册绘图模式
	pluginSystem.register(DrawMode);
	
	// 未来可以在这里注册更多模式：
	// pluginSystem.register(GameMode);
	// pluginSystem.register(NovelMode);
	
	console.log('[Modes] All modes registered:', pluginSystem.getAll().map(m => m.name));
}

/**
 * 获取所有可用的模式
 */
export function getAllModes() {
	return pluginSystem.getAll();
}

/**
 * 根据ID获取模式
 */
export function getModeById(id) {
	return pluginSystem.getById(id);
}

