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
 * 断点策略（单断点，符合 Anthropic 官方推荐）：
 *   数组最后一条是本次动态输入（每轮变化，不缓存）；
 *   在「稳定前缀的终点」= 倒数第二条消息上打断点，
 *   把从开头到该处的整段历史缓存，下一轮即可命中（增量写入、全量读取）。
 *   单条消息（首轮）时，在 index 0 打断点为下一轮播种。
 *
 * 为什么只打一个断点：Anthropic 总是匹配最长的已缓存前缀，
 * 若在 index 0 再打一个断点，它会是 length-2 断点的严格前缀，
 * 永远不会被读取 → 只会产生一次无效写入（GameMode 的超大静态前缀尤其浪费）。
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

	// 单断点：稳定前缀的终点。
	// 长度 >= 2 时 = 倒数第二条（最后一条是本次动态输入）；
	// 单条消息（首轮）时 = index 0，为本轮唯一消息播种，供下一轮命中。
	const breakpointIndex = messages.length >= 2 ? messages.length - 2 : 0;

	return messages.map((msg, i) => {
		if (i !== breakpointIndex) return msg;
		return {
			...msg,
			content: markMessageContent(msg?.content, cacheControl)
		};
	});
}
