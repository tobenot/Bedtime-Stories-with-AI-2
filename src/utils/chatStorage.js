const CHAT_DB_NAME = 'bs2-chat-db';
const CHAT_DB_VERSION = 1;
const CHAT_STORE_NAME = 'kv';
const CHAT_HISTORY_KEY = 'chat_history';
const CURRENT_CHAT_ID_PREFIX = 'current_chat_id:';
const TAB_ID_KEY = 'bs2_tab_id';
const STORAGE_LOCK_NAME = 'bs2-chat-storage-lock';
const LEGACY_CHAT_HISTORY_KEY = 'bs2_chat_history';
const LEGACY_CURRENT_CHAT_ID_KEY = 'bs2_current_chat_id';

let openDbPromise = null;
let cachedTabId = null;

function createTabId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function getTabId() {
	if (cachedTabId) {
		return cachedTabId;
	}
	if (typeof sessionStorage === 'undefined') {
		cachedTabId = createTabId();
		return cachedTabId;
	}
	const existing = sessionStorage.getItem(TAB_ID_KEY);
	if (existing) {
		cachedTabId = existing;
		return cachedTabId;
	}
	const next = createTabId();
	sessionStorage.setItem(TAB_ID_KEY, next);
	cachedTabId = next;
	return cachedTabId;
}

export function getChatStorageTabId() {
	return getTabId();
}

function getCurrentChatIdKey() {
	return `${CURRENT_CHAT_ID_PREFIX}${getTabId()}`;
}

function parseTimestampMs(value) {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value < 1e11 ? Math.floor(value * 1000) : Math.floor(value);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return null;
		if (/^\d+$/.test(trimmed)) {
			const numeric = Number(trimmed);
			if (Number.isFinite(numeric) && numeric > 0) {
				return numeric < 1e11 ? Math.floor(numeric * 1000) : Math.floor(numeric);
			}
		}
		const parsed = Date.parse(trimmed);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return null;
}

function toChatList(raw) {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toMessageList(chat) {
	return Array.isArray(chat?.messages) ? chat.messages : [];
}

function getMessageScore(message) {
	const createdMs = parseTimestampMs(message?.createdAtMs) ?? parseTimestampMs(message?.createdAt) ?? 0;
	const contentLen = typeof message?.content === 'string' ? message.content.length : 0;
	const reasoningLen = typeof message?.reasoning_content === 'string' ? message.reasoning_content.length : 0;
	return { createdMs, contentLen: contentLen + reasoningLen };
}

function shouldReplaceMessage(nextMessage, currentMessage) {
	if (!currentMessage) return true;
	const nextScore = getMessageScore(nextMessage);
	const currentScore = getMessageScore(currentMessage);
	if (nextScore.createdMs !== currentScore.createdMs) {
		return nextScore.createdMs > currentScore.createdMs;
	}
	if (nextScore.contentLen !== currentScore.contentLen) {
		return nextScore.contentLen > currentScore.contentLen;
	}
	return true;
}

function mergeMessages(firstChat, secondChat) {
	const mergedMap = new Map();
	const attach = (messages) => {
		for (const message of messages) {
			if (!message || typeof message !== 'object') {
				continue;
			}
			const messageId = typeof message.id === 'string' && message.id ? message.id : null;
			if (!messageId) {
				continue;
			}
			const current = mergedMap.get(messageId);
			if (shouldReplaceMessage(message, current)) {
				mergedMap.set(messageId, message);
			}
		}
	};
	attach(toMessageList(firstChat));
	attach(toMessageList(secondChat));
	return Array.from(mergedMap.values()).sort((a, b) => {
		const aTime = parseTimestampMs(a?.createdAtMs) ?? parseTimestampMs(a?.createdAt) ?? 0;
		const bTime = parseTimestampMs(b?.createdAtMs) ?? parseTimestampMs(b?.createdAt) ?? 0;
		if (aTime !== bTime) {
			return aTime - bTime;
		}
		return String(a?.id || '').localeCompare(String(b?.id || ''));
	});
}

function getChatActivityMs(chat) {
	const chatTime = parseTimestampMs(chat?.createdAtMs) ?? parseTimestampMs(chat?.createdAt) ?? 0;
	let latest = chatTime;
	for (const message of toMessageList(chat)) {
		const msgTime = parseTimestampMs(message?.createdAtMs) ?? parseTimestampMs(message?.createdAt) ?? 0;
		if (msgTime > latest) {
			latest = msgTime;
		}
	}
	return latest;
}

function choosePreferredChat(nextChat, currentChat) {
	if (!currentChat) return nextChat;
	const nextActivity = getChatActivityMs(nextChat);
	const currentActivity = getChatActivityMs(currentChat);
	if (nextActivity !== currentActivity) {
		return nextActivity > currentActivity ? nextChat : currentChat;
	}
	const nextMessageCount = toMessageList(nextChat).length;
	const currentMessageCount = toMessageList(currentChat).length;
	if (nextMessageCount !== currentMessageCount) {
		return nextMessageCount > currentMessageCount ? nextChat : currentChat;
	}
	return nextChat;
}

function mergeChatRecords(existingChat, incomingChat) {
	const preferred = choosePreferredChat(incomingChat, existingChat);
	const base = {
		...(existingChat || {}),
		...(incomingChat || {}),
		...(preferred || {})
	};
	base.messages = mergeMessages(existingChat, incomingChat);
	return base;
}

function sortChats(chats) {
	return [...chats].sort((a, b) => {
		const aTime = parseTimestampMs(a?.createdAtMs) ?? parseTimestampMs(a?.createdAt) ?? 0;
		const bTime = parseTimestampMs(b?.createdAtMs) ?? parseTimestampMs(b?.createdAt) ?? 0;
		if (aTime !== bTime) {
			return bTime - aTime;
		}
		return String(b?.id || '').localeCompare(String(a?.id || ''));
	});
}

function toDeletedSet(deletedChatIds) {
	if (deletedChatIds instanceof Set) return deletedChatIds.size ? deletedChatIds : null;
	if (Array.isArray(deletedChatIds) && deletedChatIds.length) return new Set(deletedChatIds);
	return null;
}

function mergeChatHistoryStrings(existingRaw, incomingRaw, deletedChatIds = null) {
	const existing = toChatList(existingRaw);
	const incoming = toChatList(incomingRaw);
	const deletedSet = toDeletedSet(deletedChatIds);
	if (!existing.length) return JSON.stringify(sortChats(incoming));
	if (!incoming.length && !deletedSet) return JSON.stringify(sortChats(existing));
	const mergedMap = new Map();
	for (const chat of existing) {
		if (!chat || typeof chat !== 'object') continue;
		const chatId = typeof chat.id === 'string' && chat.id ? chat.id : null;
		if (!chatId) continue;
		if (deletedSet?.has(chatId)) continue;
		mergedMap.set(chatId, chat);
	}
	for (const chat of incoming) {
		if (!chat || typeof chat !== 'object') continue;
		const chatId = typeof chat.id === 'string' && chat.id ? chat.id : null;
		if (!chatId) continue;
		if (deletedSet?.has(chatId)) continue;
		const existingChat = mergedMap.get(chatId);
		mergedMap.set(chatId, mergeChatRecords(existingChat, chat));
	}
	return JSON.stringify(sortChats(Array.from(mergedMap.values())));
}

async function runWithStorageLock(task) {
	const lockApi = typeof navigator !== 'undefined' ? navigator?.locks : null;
	if (lockApi && typeof lockApi.request === 'function') {
		return lockApi.request(STORAGE_LOCK_NAME, () => task());
	}
	return task();
}

function requestToPromise(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
	});
}

function txDonePromise(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
		tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
	});
}

function openDb() {
	if (openDbPromise) {
		return openDbPromise;
	}
	openDbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB unavailable'));
			return;
		}
		const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
				db.createObjectStore(CHAT_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
	});
	return openDbPromise;
}

async function getValuesFromIndexedDb() {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readonly');
	const store = tx.objectStore(CHAT_STORE_NAME);
	const currentChatIdKey = getCurrentChatIdKey();
	const historyReq = store.get(CHAT_HISTORY_KEY);
	const currentIdReq = store.get(currentChatIdKey);
	const [history, currentChatId] = await Promise.all([
		requestToPromise(historyReq),
		requestToPromise(currentIdReq)
	]);
	await txDonePromise(tx);
	return {
		savedHistory: typeof history === 'string' ? history : null,
		savedCurrentChatId: typeof currentChatId === 'string' ? currentChatId : null
	};
}

async function setValuesToIndexedDb(savedHistory, savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	const currentChatIdKey = getCurrentChatIdKey();
	store.put(savedHistory, CHAT_HISTORY_KEY);
	if (savedCurrentChatId) {
		store.put(String(savedCurrentChatId), currentChatIdKey);
	} else {
		store.delete(currentChatIdKey);
	}
	await txDonePromise(tx);
}

const LEGACY_INDEXED_CURRENT_CHAT_ID_KEY = 'current_chat_id';

async function removeValuesFromIndexedDb() {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	const currentChatIdKey = getCurrentChatIdKey();
	store.delete(CHAT_HISTORY_KEY);
	store.delete(currentChatIdKey);
	store.delete(LEGACY_INDEXED_CURRENT_CHAT_ID_KEY);
	await txDonePromise(tx);
}

export async function loadChatStorageData() {
	let canAccessIndexedDb = true;
	try {
		const indexed = await getValuesFromIndexedDb();
		if (indexed.savedHistory) {
			return {
				...indexed,
				source: 'indexeddb'
			};
		}
	} catch (error) {
		canAccessIndexedDb = false;
		console.error('[ChatStorage] 读取 IndexedDB 失败', error);
	}

	if (!canAccessIndexedDb) {
		return {
			savedHistory: null,
			savedCurrentChatId: null,
			source: 'empty'
		};
	}

	const legacyHistory = localStorage.getItem(LEGACY_CHAT_HISTORY_KEY);
	const legacyCurrentChatId = localStorage.getItem(LEGACY_CURRENT_CHAT_ID_KEY);
	if (legacyHistory) {
		try {
			await setValuesToIndexedDb(legacyHistory, legacyCurrentChatId);
			localStorage.removeItem(LEGACY_CHAT_HISTORY_KEY);
			localStorage.removeItem(LEGACY_CURRENT_CHAT_ID_KEY);
			console.log('[ChatStorage] 已将聊天存档从 localStorage 迁移到 IndexedDB');
			return {
				savedHistory: legacyHistory,
				savedCurrentChatId: legacyCurrentChatId,
				source: 'localstorage_migrated'
			};
		} catch (error) {
			console.error('[ChatStorage] 迁移到 IndexedDB 失败', error);
		}
	}

	return {
		savedHistory: null,
		savedCurrentChatId: null,
		source: 'empty'
	};
}

export async function saveChatStorageData(savedHistory, savedCurrentChatId, deletedChatIds = null) {
	await runWithStorageLock(async () => {
		const latest = await getValuesFromIndexedDb();
		const mergedHistory = mergeChatHistoryStrings(latest.savedHistory, savedHistory, deletedChatIds);
		await setValuesToIndexedDb(mergedHistory, savedCurrentChatId);
	});
}

export async function saveCurrentChatIdStorageData(savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	const currentChatIdKey = getCurrentChatIdKey();
	if (savedCurrentChatId) {
		store.put(String(savedCurrentChatId), currentChatIdKey);
	} else {
		store.delete(currentChatIdKey);
	}
	await txDonePromise(tx);
}

export async function clearChatStorageData() {
	await removeValuesFromIndexedDb();
}

