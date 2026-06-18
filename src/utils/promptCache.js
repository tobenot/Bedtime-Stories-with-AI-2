/**
 * 提示词缓存（Prompt Caching）工具
 *
 * 为兼容 OpenAI 格式的请求注入 Anthropic 风格的 cache_control 标记，
 * 让 Claude 等支持缓存的模型（含透明转发中转站）命中 Prompt Cache。
 *
 * ── 计费说明（消除「断点越多越贵」的误解）────────────────────────────
 *
 * 计费只看「实际被缓存/读取的 token 数」，与断点数量无关：
 *   cache_creation（写入）：首次写或过期重写，1.25x(5m) / 2x(1h)
 *   cache_read（命中读取）：0.1x
 *   未缓存部分：正常价
 *
 * 多打一个断点本身零额外费用。唯一隐性成本：每个断点触发一次「前缀
 * 写入」。若某断点的前缀后续不会被读取（死缓存），那次写入才亏。
 *
 * ── 混合 TTL ─────────────────────────────────────────────────────────
 *
 * cache_control 逐块设置，每个断点可有独立 ttl。因此同一次请求可混合：
 *   大日记消息 → { type:'ephemeral', ttl:'1h' }   长存活，慢思考不丢
 *   近期消息   → { type:'ephemeral' }             5m，便宜写入
 *
 * ── 断点来源：手动 + 自动填充 ────────────────────────────────────────
 *
 * Anthropic 限制：单请求最多 4 个 cache_control 断点，超过返回 400。
 *
 * 1) 手动断点（用户在消息上标记，存于 message.cacheBreakpoint）
 *    - 每条消息可标 '5m' | '1h'，自带 TTL，始终生效（即使全局关闭）
 *    - 用户显式选择，优先级最高
 *
 * 2) 自动断点（全局开关 cacheTtl 控制是否填充、用什么 TTL）
 *    - 全局 '' / 'off' → 不填充自动断点
 *    - 全局 '5m' / '1h' → 用该 TTL 填充剩余名额：
 *        a) 倒数第二条（稳定前缀终点，多轮增量缓存关键）
 *        b) 中段等分断点（覆盖分叉点，最小间距避免紧邻冗余）
 *
 * 手动优先；总数裁剪到 ≤ MAX_BREAKPOINTS，自动断点按「靠后优先」让位。
 *
 * 注：手动标记存为消息的可选字段，老对话无此字段 = 无手动点，零迁移。
 *
 * 注意：返回新数组，不修改调用方原始消息。
 */

/**
 * Anthropic 单次请求的 cache_control 断点上限，超过返回 400。
 */
export const MAX_BREAKPOINTS = 4;

/**
 * 根据 TTL 构造 cache_control 对象；关闭/无值时返回 null
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
 * 取消息的手动缓存点 TTL（'5m' | '1h'），无则 null
 */
function getManualTtl(message) {
	const ttl = message?.cacheBreakpoint;
	return ttl === '5m' || ttl === '1h' ? ttl : null;
}

/**
 * 计算自动断点候选索引（倒数第二条 + 中段等分），不含已是手动的位置。
 * 仅作为「全局填充」用，返回的索引仅供调用方按需填充。
 *
 * @param {number} length - 消息总数
 * @param {Set<number>} exclude - 已被手动断点占用的索引
 * @returns {number[]} 自动断点候选索引（升序）
 */
function computeAutoCandidateIndices(length, exclude) {
	if (length <= 1) return [];

	const candidates = [];
	const tailIdx = length - 2;
	if (tailIdx >= 0 && !exclude.has(tailIdx)) candidates.push(tailIdx);

	if (length > 2) {
		const lo = 1;
		const hi = length - 3;
		if (hi >= lo) {
			const remaining = MAX_BREAKPOINTS - candidates.length - exclude.size;
			if (remaining > 0) {
				const span = hi - lo + 1;
				const slots = Math.min(remaining, span);
				// 最小间距：避免紧邻断点（短断点是长断点的冗余前缀）
				const minGap = Math.max(1, Math.ceil(length / (slots + 2)));
				for (let k = 1; k <= slots; k++) {
					const idx = lo + Math.round((span - 1) * (k / (slots + 1)));
					if (idx < 0 || idx >= tailIdx) continue;
					if (exclude.has(idx) || candidates.includes(idx)) continue;
					const tooClose = [...exclude, ...candidates].some(existing => Math.abs(existing - idx) < minGap);
					if (tooClose) continue;
					candidates.push(idx);
				}
			}
		}
	}

	return candidates.sort((a, b) => a - b);
}

/**
 * 对消息数组应用缓存标记（手动 TTL + 全局自动填充）
 *
 * @param {Array} messages - OpenAI 格式消息数组（可带 message.cacheBreakpoint）
 * @param {string} cacheTtl - 全局开关：'' | 'off' | '5m' | '1h'
 * @returns {Array} 新的消息数组
 */
export function applyPromptCacheControl(messages, cacheTtl) {
	if (!Array.isArray(messages) || messages.length === 0) return messages;

	const globalControl = buildCacheControl(cacheTtl); // null = 全局关闭

	// 1) 手动断点：每条消息自带 TTL（排除最后一条动态输入）
	const ttlByIndex = new Map(); // index -> cache_control 对象
	const manualSet = new Set();
	for (let i = 0; i < messages.length - 1; i++) {
		const ttl = getManualTtl(messages[i]);
		if (ttl) {
			ttlByIndex.set(i, buildCacheControl(ttl));
			manualSet.add(i);
		}
	}

	// 全局关闭且无手动点 → 直接返回
	if (!globalControl && ttlByIndex.size === 0) return messages;

	// 2) 自动填充剩余名额（仅全局开启时）
	if (globalControl) {
		const autoIndices = computeAutoCandidateIndices(messages.length, manualSet);
		for (const idx of autoIndices) {
			if (!ttlByIndex.has(idx)) ttlByIndex.set(idx, globalControl);
		}
	}

	// 3) 裁剪到 MAX_BREAKPOINTS：手动全保留，剩余名额给最靠后的自动断点
	let entries = [...ttlByIndex.entries()];
	if (entries.length > MAX_BREAKPOINTS) {
		const manualEntries = entries.filter(([idx]) => manualSet.has(idx));
		const autoEntries = entries.filter(([idx]) => !manualSet.has(idx));
		// 手动若本身超限（用户标了 >4 个，极少见），保留靠后的
		const manualKeep = manualEntries.slice(-Math.min(manualEntries.length, MAX_BREAKPOINTS));
		const autoKeep = autoEntries.slice(-(MAX_BREAKPOINTS - manualKeep.length));
		entries = [...manualKeep, ...autoKeep];
	}

	const breakpointTtl = new Map(entries);

	// 4) 应用：每条断点消息用自己的 cache_control（支持混合 TTL）
	return messages.map((msg, i) => {
		if (!breakpointTtl.has(i)) return msg;
		return {
			...msg,
			content: markMessageContent(msg?.content, breakpointTtl.get(i))
		};
	});
}
