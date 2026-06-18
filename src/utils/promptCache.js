/**
 * 提示词缓存（Prompt Caching）工具
 *
 * 为兼容 OpenAI 格式的请求注入 Anthropic 风格的 cache_control 标记，
 * 让 Claude 等支持缓存的模型（含透明转发中转站）命中 Prompt Cache。
 *
 * - 关闭：不做任何改动
 * - 5m：cache_control = { type: 'ephemeral' }（Anthropic 默认 5 分钟）
 * - 1h：cache_control = { type: 'ephemeral', ttl: '1h' }
 *
 * 标记策略（最多 2 个断点，远低于 Anthropic 4 个上限）：
 *   1. 首条消息（前缀起点）—— 对 GameMode 等带超大静态前缀的场景尤其有效
 *   2. 倒数第二条消息（稳定前缀终点，紧邻本次动态输入之前）—— 多轮对话命中关键
 *
 * 不变更的动态部分：最后一条消息（本次新输入）。
 *
 * 注意：返回新数组，不修改调用方原始消息。
 */

/**
 * 根据 TTL 构造 cache_control 对象；关闭时返回 null
 */
export function buildCacheControl(cacheTtl) {
	if (!cacheTtl || cacheTtl === 'off') return null;
	const cc = { type: 'ephemeral' };
	if (cacheTtl === '1h') cc.ttl = '1h';
	return cc; // '5m' 或其它真值 → 默认 ephemeral（5 分钟）
}

/**
 * 给单个消息的 content 附加 cache_control
 * - 字符串 content → 转为 content 数组，标记唯一块
 * - 数组 content → 标记最后一块
 */
function markMessageContent(content, cacheControl) {
	if (typeof content === 'string') {
		return [{ type: 'text', text: content, cache_control: cacheControl }];
	}
	if (Array.isArray(content)) {
		if (content.length === 0) {
			return [{ type: 'text', text: '', cache_control: cacheControl }];
		}
		return content.map((block, idx) => idx === content.length - 1
			? { ...block, cache_control: cacheControl }
			: block);
	}
	return content;
}

/**
 * 对消息数组应用缓存标记
 * @param {Array} messages - OpenAI 格式消息数组
 * @param {string} cacheTtl - '' | 'off' | '5m' | '1h'
 * @returns {Array} 新的消息数组
 */
export function applyPromptCacheControl(messages, cacheTtl) {
	const cacheControl = buildCacheControl(cacheTtl);
	if (!cacheControl || !Array.isArray(messages) || messages.length === 0) {
		return messages;
	}

	const indices = new Set();
	indices.add(0); // 前缀起点
	if (messages.length >= 3) {
		indices.add(messages.length - 2); // 稳定前缀终点（动态输入之前）
	}

	return messages.map((msg, i) => {
		if (!indices.has(i)) return msg;
		return {
			...msg,
			content: markMessageContent(msg?.content, cacheControl)
		};
	});
}
