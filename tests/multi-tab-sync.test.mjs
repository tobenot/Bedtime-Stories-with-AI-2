/**
 * 多页签同步逻辑测试
 *
 * 覆盖两块核心逻辑（见 src/utils/multiTabSync.js）：
 * 1. mergeHistoryKeepingCurrent —— 锁内合并规则
 *    - 保留本地当前对话（对象引用不变，流式不中断）
 *    - 其余一律以远程 blob 为准
 *    - 远程缺失且非本地的对话随其消失（删除/归档传播）
 * 2. findOtherTabHoldingChat —— 心跳所有权（复制页签冲突检测）
 *    - 无心跳 / 不匹配 / 过期 / 自己 → null
 *    - 他人存活持有 → 返回 tabId
 */

import assert from 'node:assert';

// Node 无 localStorage，注入最小 stub（multiTabSync 顶层不用 localStorage，函数内运行时读取）
const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null,
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

import {
  mergeHistoryKeepingCurrent,
  findOtherTabHoldingChat,
  updateTabHeartbeat,
  clearTabHeartbeat,
  HEARTBEAT_TTL_MS,
} from '../src/utils/multiTabSync.js';

function chat(id, createdAtMs, title) {
  return { id, title: title ?? '对话' + id, messages: [], createdAtMs, createdAt: new Date(createdAtMs).toISOString() };
}

console.log('=== 多页签同步逻辑测试 ===\n');
console.log('--- 合并规则（mergeHistoryKeepingCurrent） ---\n');

// 1. 保留当前对话（同对象引用），其余采用远程
const localCurrent = chat('x', 3000, '本地X');
const localStale = chat('y', 2000, '本地Y旧');
const local = [localCurrent, localStale];
const remoteNewY = chat('y', 2500, '远程Y新');
const remoteOther = chat('z', 1000, '远程Z');
const merged = mergeHistoryKeepingCurrent(local, [remoteNewY, remoteOther], 'x');
assert(merged.find(c => c.id === 'x') === localCurrent, '测试1a失败：当前对话必须保留本地对象引用');
assert(merged.find(c => c.id === 'y') === remoteNewY, '测试1b失败：非当前对话采用远程版本');
assert(merged.find(c => c.id === 'z') === remoteOther, '测试1c失败：远程新增对话被采纳');
assert(merged.length === 3, '测试1d失败：合并后数量应为3');

// 2. 远程缺失且非本地的本地对话 → 消失（删除/归档传播）
const merged2 = mergeHistoryKeepingCurrent([localCurrent, localStale], [remoteOther], 'x');
assert(merged2.find(c => c.id === 'y') === undefined, '测试2a失败：远程缺失的非当前对话应消失');
assert(merged2.length === 2, '测试2b失败：删除传播后数量应为2');

// 3. 远程也有"当前对话"的不同版本 → 忽略远程版本，保留本地（不重复）
const remoteCurrent = chat('x', 3500, '远程X新');
const merged3 = mergeHistoryKeepingCurrent([localCurrent, localStale], [remoteCurrent, remoteOther], 'x');
assert(merged3.find(c => c.id === 'x') === localCurrent, '测试3a失败：远程的当前对话版本被忽略');
assert(merged3.length === 2, '测试3b失败：远程当前对话不重复添加');

// 4. 无当前对话（currentChatId 为空/指向不存在）→ 全部采用远程
const merged4 = mergeHistoryKeepingCurrent([localCurrent, localStale], [remoteNewY, remoteOther], null);
assert(merged4.length === 2, '测试4a失败：无当前对话时应全部采用远程');
assert(merged4.every(c => c.id === 'y' || c.id === 'z'), '测试4b失败：无当前对话时不含本地独有');

// 5. 结果按创建时间倒序
assert(merged[0].id === 'x' && merged[1].id === 'y' && merged[2].id === 'z', '测试5失败：合并结果应按创建时间倒序');

// 6. 输入非法时兜底
assert(mergeHistoryKeepingCurrent(null, [remoteOther], 'x').length === 1, '测试6a失败：本地非数组应兜底为空');
assert(mergeHistoryKeepingCurrent([localCurrent], null, 'x').length === 1, '测试6b失败：远程非数组应兜底为空');

console.log('--- 心跳所有权（findOtherTabHoldingChat） ---\n');

// 7. 无心跳 → null
store.clear();
assert(findOtherTabHoldingChat('chat1', 'tab-me') === null, '测试7失败：无心跳应返回 null');

// 8. 他人存活持有 → 返回持有者 tabId
updateTabHeartbeat('tab-other', 'chat1');
assert(findOtherTabHoldingChat('chat1', 'tab-me') === 'tab-other', '测试8失败：应返回持有者 tabId');

// 9. 持有不同对话 → null
assert(findOtherTabHoldingChat('chat2', 'tab-me') === null, '测试9失败：不匹配对话应返回 null');

// 10. 排除自己：仅自己的心跳持有 → null；自己的心跳不遮蔽他人
store.clear();
updateTabHeartbeat('tab-me', 'chat1');
assert(findOtherTabHoldingChat('chat1', 'tab-me') === null, '测试10a失败：仅有自己的心跳应返回 null');
updateTabHeartbeat('tab-other', 'chat1');
assert(findOtherTabHoldingChat('chat1', 'tab-me') === 'tab-other', '测试10b失败：他人持有应优先返回');

// 11. 过期心跳视为已离开
store.clear();
store.set('bs2_tab_tab-old', JSON.stringify({ chatId: 'chat1', ts: Date.now() - HEARTBEAT_TTL_MS - 1 }));
assert(findOtherTabHoldingChat('chat1', 'tab-me') === null, '测试11失败：过期心跳应视为离开');

// 12. 心跳条目可清除
clearTabHeartbeat('tab-other');
assert(store.has('bs2_tab_tab-other') === false, '测试12失败：清除后不应再有该心跳条目');

console.log('\n=== 所有测试通过 ===\n');
