/**
 * 提示词缓存（Prompt Caching）工具
 *
 * 为兼容 OpenAI 格式的请求注入 Anthropic 风格的 cache_control 标记，
 * 让 Claude 等支持缓存的模型（含透明转发中转站）命中 Prompt Cache。
 *
 * ── 计费说明 ──────────────────────────────────────────────────────────
 *
 * 计费只看「实际被缓存/读取的 token 数」，与断点数量无关：
 *   cache_creation（写入）：首次写或过期重写，1.25x(5m) / 2x(1h)
 *   cache_read（命中读取）：0.1x
 *   未缓存部分：正常价
 *
 * ── 混合 TTL ──────────────────────────────────────────────────────────
 *
 * cache_control 逐块设置，每个断点可有独立 ttl。同一次请求可混合：
 *   大日记消息 → { type:'ephemeral', ttl:'1h' }   长存活，慢思考不丢
 *   近期消息   → { type:'ephemeral' }             5m，便宜写入
 *
 * ── 断点策略：4 个固定角色（用满 Anthropic 上限）─────────────────────
 *
 * Anthropic 限制：单请求最多 4 个 cache_control 断点，超过返回 400。
 *
 * 请求形态：messages = [...稳定历史, 本次动态输入]（最后一条 = 刚发的用户消息）
 *
 * 4 个断点角色（按索引升序）：
 *
 *   1) 起点（index 0）
 *      缓存最早的稳定内容（大日记/设定的开头）。
 *
 *   2) 长内容终点 =「最后一条长消息」（或用户手动覆盖点）
 *      把从开头到该处的整段长稳定内容整体缓存。
 *      日记场景核心：前几条超长消息一次性缓存，后续分叉/继续都命中。
 *      用户可在任意一条消息手动标 cacheBreakpoint（5m/1h）覆盖此角色
 *      ——「整个对话只能有一个手动点」，自带 TTL。无手动点时自动取
 *      最后一条长消息。
 *
 *   3) 倒数第二条（length-2，本次动态输入的前一条）
 *      服务「继续发新消息」：下次请求前缀 [..倒数第二] 不变 → 命中。
 *
 *   4) 最后一条（length-1，本次刚发的用户消息）
 *      服务「重发刚才那条」（对 AI 回复不满意，重发相同内容）：
 *      重发时最后一条内容不变 → [..最后一条] 整段命中。
 *
 * 注：断点 2 与手动点互斥（手动覆盖自动长消息点）；角色 1/3/4 为自动。
 *     手动点始终生效（即使全局关闭）；自动点仅全局开启时填充，用全局 TTL。
 *     手动标记存为消息可选字段，老对话无此字段 = 无手动点，零迁移。
 *
 * 注意：返回新数组，不修改调用方原始消息。
 */

/**
 * Anthropic 单次请求的 cache_control 断点上限，超过返回 400。
 */
export const MAX_BREAKPOINTS = 4;

/**
 * 触发「长消息」判定的字符阈值。按 ~4 char/token 估算，
 * 1500 字符 ≈ 375 token，略高于 Anthropic 缓存最小有效长度。
 */
const LONG_MESSAGE_CHAR_THRESHOLD = 1500;

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
 * 估算消息内容的字符长度（兼容字符串与 content 数组）
 */
function estimateContentLength(content) {
	if (typeof content === 'string') return content.length;
	if (Array.isArray(content)) {
		return content.reduce((sum, block) => {
			if (typeof block?.text === 'string') return sum + block.text.length;
			if (typeof block === 'string') return sum + block.length;
			return sum;
		}, 0);
	}
	return 0;
}

/**
 * 取消息的手动缓存点 TTL（'5m' | '1h'），无则 null
 */
function getManualTtl(message) {
	const ttl = message?.cacheBreakpoint;
	return ttl === '5m' || ttl === '1h' ? ttl : null;
}

/**
 * 找「最后一条长消息」索引：在 [0, length-2] 范围内（排除本次动态输入），
 * 取内容长度 ≥ 阈值的最后一条。无长消息返回 -1。
 */
function findLastLongMessageIndex(messages) {
	for (let i = messages.length - 2; i >= 0; i--) {
		if (estimateContentLength(messages[i]?.content) >= LONG_MESSAGE_CHAR_THRESHOLD) {
			return i;
		}
	}
	return -1;
}

/**
 * 对消息数组应用缓存标记（4 角色断点 + 手动覆盖 + 全局 TTL）
 *
 * @param {Array} messages - OpenAI 格式消息数组（可带 message.cacheBreakpoint）
 * @param {string} cacheTtl - 全局开关：'' | 'off' | '5m' | '1h'
 * @returns {Array} 新的消息数组
 */
export function applyPromptCacheControl(messages, cacheTtl) {
	if (!Array.isArray(messages) || messages.length === 0) return messages;

	const globalControl = buildCacheControl(cacheTtl); // null = 全局关闭
	const length = messages.length;

	// ── 角色 2：手动覆盖点 / 自动长消息终点 ──
	// 手动点自带 TTL，始终生效；一个对话最多一个手动点（取最后一条标记的）。
	const ttlByIndex = new Map(); // index -> { control, manual: boolean }
	let manualIndex = -1;
	for (let i = 0; i < length - 1; i++) {
		const ttl = getManualTtl(messages[i]);
		if (ttl) {
			manualIndex = i; // 取最后一个手动点（约定：对话内一个）
			ttlByIndex.set(i, { control: buildCacheControl(ttl), manual: true });
		}
	}

	// 全局关闭且无手动点 → 直接返回
	if (!globalControl && ttlByIndex.size === 0) return messages;

	// ── 自动点（仅全局开启时）──────────────────────────────────────
	if (globalControl) {
		const auto = []; // {idx, role} 角色用于裁剪优先级

		// 角色 1：起点
		if (length >= 1) auto.push({ idx: 0, role: 1 });

		// 角色 2（自动版）：最后一条长消息（手动点存在时跳过，避免重复）
		if (manualIndex < 0) {
			const longIdx = findLastLongMessageIndex(messages);
			if (longIdx > 0) auto.push({ idx: longIdx, role: 2 });
		}

		// 角色 3：倒数第二条（服务「继续发新消息」）
		const tail2 = length - 2;
		if (tail2 >= 0) auto.push({ idx: tail2, role: 3 });

		// 角色 4：最后一条（服务「重发刚才那条」）
		// 仅当 >= 2 条时才有意义（单条时与角色1重合）
		const tail1 = length - 1;
		if (tail1 >= 1) auto.push({ idx: tail1, role: 4 });

		// 合并入 ttlByIndex（手动点已占用的索引跳过）
		for (const { idx } of auto) {
			if (ttlByIndex.has(idx)) continue;
			ttlByIndex.set(idx, { control: globalControl, manual: false });
		}
	}

	// ── 裁剪到 MAX_BREAKPOINTS ──
	// 优先级：手动点 > 角色3(增量) > 角色4(重发) > 角色2(长内容) > 角色1(起点)
	let entries = [...ttlByIndex.entries()]; // [idx, {control, manual}]
	const roleOf = (idx) => {
		if (idx === manualIndex) return 0;
		if (idx === length - 2) return 3;
		if (idx === length - 1) return 4;
		// 角色2/1 用顺序推断：非末尾的非手动点
		return 2;
	};
	if (entries.length > MAX_BREAKPOINTS) {
		// 手动点必保留；其余按角色优先级保留，再按索引就近
		const manual = entries.filter(([, v]) => v.manual);
		const auto = entries.filter(([, v]) => !v.manual)
			.sort((a, b) => roleOf(a[0]) - roleOf(b[0]) || a[0] - b[0]);
		const autoKeep = auto.slice(0, MAX_BREAKPOINTS - manual.length);
		entries = [...manual, ...autoKeep];
	}

	// ── 应用 ──
	return messages.map((msg, i) => {
		const entry = ttlByIndex.get(i);
		// entries 裁剪后，需确认该索引仍在保留集合内
		if (!entry || !entries.some(([idx]) => idx === i)) return msg;
		return {
			...msg,
			content: markMessageContent(msg?.content, entry.control)
		};
	});
}

/**
 * 判定某条消息是否会被「自动」标记为缓存断点（供 UI 显示自动样式）。
 *
 * 与 applyPromptCacheControl 的自动角色一致：
 *   - index 0（起点）
 *   - 最后一条长消息（无手动点时）
 *   - 倒数第二条（length-2）
 *   - 最后一条（length-1，仅 length>=2）
 *
 * 注意：这是「该消息是否会成为自动断点」的判定，不含手动点。
 * 全局开关关闭时自动断点不会实际生效，但 UI 可据此显示「将被缓存」。
 *
 * @param {Array} messages
 * @param {number} index
 * @returns {boolean}
 */
export function isAutoBreakpoint(messages, index) {
	if (!Array.isArray(messages) || messages.length === 0) return false;
	const length = messages.length;
	if (index < 0 || index >= length) return false;

	// 角色 3 / 4：末尾两条
	if (index === length - 2) return true;
	if (length >= 2 && index === length - 1) return true;

	// 存在手动点时，自动长消息角色被覆盖
	const hasManual = messages.some((m, i) => i < length - 1 && getManualTtl(m));
	if (hasManual) return index === 0; // 仅角色1仍为自动

	// 角色 1：起点
	if (index === 0) return true;

	// 角色 2：最后一条长消息
	const longIdx = findLastLongMessageIndex(messages);
	return index === longIdx && longIdx > 0;
}
