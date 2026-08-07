/**
 * 多页签协调
 *
 * 解决"多个浏览器标签页同时对话"的三个问题（原生 API，无新依赖）：
 * 1. 防覆盖：Web Locks 把"读→合并→写"串行化，见 chatMethods.tryPersistChatHistory
 * 2. 实时同步：BroadcastChannel 广播保存事件，被动页签重读 blob 合并到内存
 * 3. 复制页签冲突：localStorage 心跳记录"每个页签当前对话的所有权"，新页签启动时不抢占他人对话
 *
 * 合并语义：每个对话同一时刻只有一个活跃写者（流式页签），因此合并规则取最简——
 * 保留本地当前对话（含对象引用，流式不中断），其余一律以远程 blob 为准。
 */
import { safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage } from './localStorageSafe.js';
import { sortChatsByCreatedTime } from './chatData.js';

export const HEARTBEAT_PREFIX = 'bs2_tab_';
export const HEARTBEAT_TTL_MS = 15000;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const CHANNEL_NAME = 'bs2-multitab';

export function generateTabId() {
	return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let channel = null;
/** 获取 BroadcastChannel 单例；浏览器不支持时返回 null（降级为不做实时同步） */
export function getMultiTabChannel() {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
	return channel;
}

// ── 心跳：记录"哪个页签正持有哪个对话" ──

export function updateTabHeartbeat(tabId, chatId) {
	if (!tabId) return;
	safeSetLocalStorage(HEARTBEAT_PREFIX + tabId, JSON.stringify({ chatId: chatId || null, ts: Date.now() }), '页签心跳');
}

export function clearTabHeartbeat(tabId) {
	if (!tabId) return;
	safeRemoveLocalStorage(HEARTBEAT_PREFIX + tabId, '页签心跳');
}

/** 返回持有指定对话的其它存活页签 tabId；无则返回 null。过期（TTL 内无心跳）视为已离开。 */
export function findOtherTabHoldingChat(chatId, excludeTabId) {
	if (chatId == null) return null;
	const target = String(chatId);
	const now = Date.now();
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key || !key.startsWith(HEARTBEAT_PREFIX)) continue;
		const tabId = key.slice(HEARTBEAT_PREFIX.length);
		if (tabId === excludeTabId) continue;
		const raw = safeGetLocalStorage(key, '');
		if (!raw) continue;
		let hb = null;
		try { hb = JSON.parse(raw); } catch (err) { continue; }
		if (!hb || hb.chatId == null || String(hb.chatId) !== target) continue;
		if (now - (Number(hb.ts) || 0) > HEARTBEAT_TTL_MS) continue;
		return tabId;
	}
	return null;
}

// ── 合并 ──

/**
 * 合并远程历史到本地。
 * - 本地当前对话：保留本地对象引用（流式/编辑中的 mutation 不受影响）
 * - 其余对话：一律以远程为准；远程缺失且非本地的对话 = 已在其它页签删除/归档，随其消失
 * - deletedChatIds（Set）：本页签已删除的对话 id，即使远程还残留也绝不复活（deleteChat 后旧 blob 仍含该对话）
 * - 结果按创建时间倒序，与 chatHistory 的既有排序一致
 */
export function mergeHistoryKeepingCurrent(localHistory, remoteHistory, currentChatId, deletedChatIds = null) {
	const local = Array.isArray(localHistory) ? localHistory : [];
	const remote = Array.isArray(remoteHistory) ? remoteHistory : [];
	const currentId = currentChatId != null ? String(currentChatId) : null;

	const excluded = deletedChatIds ? new Set([...deletedChatIds].map(String)) : null;
	const localCurrent = currentId ? local.find(c => c && String(c.id) === currentId) : undefined;

	const merged = [];
	const seen = new Set();
	if (localCurrent) {
		merged.push(localCurrent);
		seen.add(String(localCurrent.id));
	}
	for (const chat of remote) {
		if (!chat || chat.id == null) continue;
		const id = String(chat.id);
		if (excluded && excluded.has(id)) continue;
		if (seen.has(id)) continue;
		merged.push(chat);
		seen.add(id);
	}
	return sortChatsByCreatedTime(merged);
}
