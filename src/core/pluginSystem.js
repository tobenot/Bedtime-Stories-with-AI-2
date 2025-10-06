/**
 * 插件系统核心
 * 负责插件的注册、加载和管理
 */

class PluginSystem {
	constructor() {
		this.plugins = new Map();
		this.activePlugin = null;
	}

	/**
	 * 注册一个插件
	 * @param {Object} plugin - 插件对象
	 * @param {string} plugin.id - 插件唯一标识
	 * @param {string} plugin.name - 插件显示名称
	 * @param {string} plugin.description - 插件描述
	 * @param {string} plugin.icon - 插件图标
	 * @param {Object} plugin.component - Vue组件
	 * @param {Object} plugin.config - 插件配置
	 */
	register(plugin) {
		if (!plugin.id) {
			throw new Error('Plugin must have an id');
		}
		if (!plugin.component) {
			throw new Error('Plugin must have a component');
		}
		
		console.log('[Plugin System] Registering plugin:', plugin.id);
		this.plugins.set(plugin.id, plugin);
	}

	/**
	 * 获取所有已注册的插件
	 */
	getAll() {
		return Array.from(this.plugins.values());
	}

	/**
	 * 根据ID获取插件
	 */
	getById(id) {
		return this.plugins.get(id);
	}

	/**
	 * 设置当前激活的插件
	 */
	setActive(id) {
		const plugin = this.plugins.get(id);
		if (!plugin) {
			console.warn('[Plugin System] Plugin not found:', id);
			return false;
		}
		this.activePlugin = id;
		console.log('[Plugin System] Active plugin set to:', id);
		return true;
	}

	/**
	 * 获取当前激活的插件
	 */
	getActive() {
		if (!this.activePlugin) return null;
		return this.plugins.get(this.activePlugin);
	}

	/**
	 * 获取当前激活的插件ID
	 */
	getActiveId() {
		return this.activePlugin;
	}

	/**
	 * 卸载插件
	 */
	unregister(id) {
		console.log('[Plugin System] Unregistering plugin:', id);
		return this.plugins.delete(id);
	}
}

// 创建单例实例
export const pluginSystem = new PluginSystem();

/**
 * 工具注册表
 * 管理可插拔的工具（骰子、生图等）
 */
class ToolRegistry {
	constructor() {
		this.tools = new Map();
	}

	/**
	 * 注册一个工具
	 * @param {Object} tool - 工具对象
	 * @param {string} tool.id - 工具唯一标识
	 * @param {string} tool.name - 工具显示名称
	 * @param {string} tool.icon - 工具图标
	 * @param {Object} tool.component - Vue组件
	 * @param {Function} tool.handler - 工具处理函数
	 */
	register(tool) {
		if (!tool.id) {
			throw new Error('Tool must have an id');
		}
		console.log('[Tool Registry] Registering tool:', tool.id);
		this.tools.set(tool.id, tool);
	}

	/**
	 * 获取所有已注册的工具
	 */
	getAll() {
		return Array.from(this.tools.values());
	}

	/**
	 * 根据ID获取工具
	 */
	getById(id) {
		return this.tools.get(id);
	}

	/**
	 * 卸载工具
	 */
	unregister(id) {
		console.log('[Tool Registry] Unregistering tool:', id);
		return this.tools.delete(id);
	}
}

// 创建工具注册表单例
export const toolRegistry = new ToolRegistry();

