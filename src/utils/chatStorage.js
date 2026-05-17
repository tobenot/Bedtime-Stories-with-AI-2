const CHAT_DB_NAME = 'bs2-chat-db';
const CHAT_DB_VERSION = 2;
const CHAT_STORE_NAME = 'kv';
const CHAT_ARCHIVE_STORE_NAME = 'chatArchive';
const CHAT_HISTORY_KEY = 'chat_history';
const CURRENT_CHAT_ID_KEY = 'current_chat_id';
const ARCHIVE_INDEX_KEY = 'archive_index';

const LEGACY_CHAT_HISTORY_KEY = 'bs2_chat_history';
const LEGACY_CURRENT_CHAT_ID_KEY = 'bs2_current_chat_id';

let openDbPromise = null;

/**
 * 将可能是 Vue 响应式 Proxy 的对象转为纯 POJO，防止 IDB 结构化克隆失败。
 * 使用 JSON 往返（round-trip）确保剥离所有不可序列化的内部属性。
 */
function toPlainObject(obj) {
	return JSON.parse(JSON.stringify(obj));
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
		request.onupgradeneeded = (event) => {
			const db = request.result;
			// v1: 创建 kv store
			if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
				db.createObjectStore(CHAT_STORE_NAME);
			}
			// v2: 创建 chatArchive store（冷区，每条对话独立存储）
			if (!db.objectStoreNames.contains(CHAT_ARCHIVE_STORE_NAME)) {
				db.createObjectStore(CHAT_ARCHIVE_STORE_NAME);
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
	const historyReq = store.get(CHAT_HISTORY_KEY);
	const currentIdReq = store.get(CURRENT_CHAT_ID_KEY);
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

function putCurrentChatIdToKvStore(store, savedCurrentChatId) {
	if (savedCurrentChatId) {
		store.put(String(savedCurrentChatId), CURRENT_CHAT_ID_KEY);
	} else {
		store.delete(CURRENT_CHAT_ID_KEY);
	}
}

function putArchiveIndexToKvStore(store, index) {
	store.put(Array.isArray(index) ? toPlainObject(index) : [], ARCHIVE_INDEX_KEY);
}

async function setValuesToIndexedDb(savedHistory, savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	store.put(savedHistory, CHAT_HISTORY_KEY);
	putCurrentChatIdToKvStore(store, savedCurrentChatId);
	await txDonePromise(tx);
}


async function removeValuesFromIndexedDb() {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	store.delete(CHAT_HISTORY_KEY);
	store.delete(CURRENT_CHAT_ID_KEY);
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

	const legacyHistory = safeGetLocalStorage(LEGACY_CHAT_HISTORY_KEY, '');
	const legacyCurrentChatId = safeGetLocalStorage(LEGACY_CURRENT_CHAT_ID_KEY, '');

	if (legacyHistory) {
		try {
			await setValuesToIndexedDb(legacyHistory, legacyCurrentChatId);
			safeRemoveLocalStorage(LEGACY_CHAT_HISTORY_KEY, '旧聊天存档');
			safeRemoveLocalStorage(LEGACY_CURRENT_CHAT_ID_KEY, '旧当前对话 ID');

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

export async function saveChatStorageData(savedHistory, savedCurrentChatId) {
	await setValuesToIndexedDb(savedHistory, savedCurrentChatId);
}

export async function saveCurrentChatIdStorageData(savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	putCurrentChatIdToKvStore(store, savedCurrentChatId);
	await txDonePromise(tx);
}


export async function clearChatStorageData() {
	await removeValuesFromIndexedDb();
}

// ── 归档对话（冷区）API ──

/** 写入一条归档对话 */
export async function putArchivedChat(chat) {
	const db = await openDb();
	const tx = db.transaction(CHAT_ARCHIVE_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	store.put(toPlainObject(chat), chat.id);
	await txDonePromise(tx);
}

/** 读取一条归档对话 */
export async function getArchivedChat(chatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_ARCHIVE_STORE_NAME, 'readonly');
	const store = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	const result = await requestToPromise(store.get(chatId));
	await txDonePromise(tx);
	return result || undefined;
}

/** 删除一条归档对话 */
export async function deleteArchivedChat(chatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_ARCHIVE_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	store.delete(chatId);
	await txDonePromise(tx);
}

/** 读取全部归档对话（仅用于"导出归档"和"完整备份"，低频） */
export async function getAllArchivedChats() {
	const db = await openDb();
	const tx = db.transaction(CHAT_ARCHIVE_STORE_NAME, 'readonly');
	const store = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	const result = await requestToPromise(store.getAll());
	await txDonePromise(tx);
	return Array.isArray(result) ? result : [];
}

// ── 归档索引 API ──

/** 读取归档索引 */
export async function loadArchiveIndex() {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readonly');
	const store = tx.objectStore(CHAT_STORE_NAME);
	const result = await requestToPromise(store.get(ARCHIVE_INDEX_KEY));
	await txDonePromise(tx);
	return Array.isArray(result) ? result : [];
}

/** 保存归档索引 */
export async function saveArchiveIndex(index) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	putArchiveIndexToKvStore(store, index);
	await txDonePromise(tx);
}

/** 原子归档单条对话：同时写入冷区、热区和归档索引 */
export async function archiveChatStorageData(chat, nextHotHistory, nextCurrentChatId, nextArchiveIndex) {
	const db = await openDb();
	const tx = db.transaction([CHAT_STORE_NAME, CHAT_ARCHIVE_STORE_NAME], 'readwrite');
	const kvStore = tx.objectStore(CHAT_STORE_NAME);
	const archiveStore = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	archiveStore.put(toPlainObject(chat), chat.id);
	kvStore.put(JSON.stringify(Array.isArray(nextHotHistory) ? nextHotHistory : []), CHAT_HISTORY_KEY);
	putCurrentChatIdToKvStore(kvStore, nextCurrentChatId);
	putArchiveIndexToKvStore(kvStore, nextArchiveIndex);
	await txDonePromise(tx);
}

/** 原子批量归档：同时写入多条冷区、热区和归档索引 */
export async function archiveChatsStorageData(chats, nextHotHistory, nextCurrentChatId, nextArchiveIndex) {
	const db = await openDb();
	const tx = db.transaction([CHAT_STORE_NAME, CHAT_ARCHIVE_STORE_NAME], 'readwrite');
	const kvStore = tx.objectStore(CHAT_STORE_NAME);
	const archiveStore = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	for (const chat of Array.isArray(chats) ? chats : []) {
		if (chat?.id) {
			archiveStore.put(toPlainObject(chat), chat.id);
		}
	}
	kvStore.put(JSON.stringify(Array.isArray(nextHotHistory) ? nextHotHistory : []), CHAT_HISTORY_KEY);
	putCurrentChatIdToKvStore(kvStore, nextCurrentChatId);
	putArchiveIndexToKvStore(kvStore, nextArchiveIndex);
	await txDonePromise(tx);
}

/** 原子取回对话：从冷区删除并同步写回热区与归档索引 */
export async function restoreChatFromArchiveStorageData(chatId, hotHistoryWithoutChat, nextCurrentChatId, nextArchiveIndex) {
	const db = await openDb();
	const tx = db.transaction([CHAT_STORE_NAME, CHAT_ARCHIVE_STORE_NAME], 'readwrite');
	const kvStore = tx.objectStore(CHAT_STORE_NAME);
	const archiveStore = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	const chat = await requestToPromise(archiveStore.get(chatId));
	if (!chat) {
		tx.abort();
		try {
			await txDonePromise(tx);
		} catch (_err) {
			// ignore abort error
		}
		return undefined;
	}
	const nextHotHistory = [...(Array.isArray(hotHistoryWithoutChat) ? hotHistoryWithoutChat : []), chat];
	kvStore.put(JSON.stringify(nextHotHistory), CHAT_HISTORY_KEY);
	putCurrentChatIdToKvStore(kvStore, nextCurrentChatId);
	putArchiveIndexToKvStore(kvStore, nextArchiveIndex);
	archiveStore.delete(chatId);
	await txDonePromise(tx);
	return chat;
}

/** 原子删除归档对话：同时删除冷区记录并更新归档索引 */
export async function deleteArchivedChatStorageData(chatId, nextArchiveIndex) {
	const db = await openDb();
	const tx = db.transaction([CHAT_STORE_NAME, CHAT_ARCHIVE_STORE_NAME], 'readwrite');
	const kvStore = tx.objectStore(CHAT_STORE_NAME);
	const archiveStore = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);
	archiveStore.delete(chatId);
	putArchiveIndexToKvStore(kvStore, nextArchiveIndex);
	await txDonePromise(tx);
}

/**
 * 原子全量恢复：一个事务中替换热区、冷区和索引（用于完整备份导入）
 * - 清空 chatArchive store 后逐条写入 archivedChats
 * - 覆盖 kv/chat_history、kv/current_chat_id、kv/archive_index
 */
export async function replaceAllStorageData({ hotHistory, archivedChats, archiveIndex, currentChatId }) {
	const db = await openDb();
	const tx = db.transaction([CHAT_STORE_NAME, CHAT_ARCHIVE_STORE_NAME], 'readwrite');
	const kvStore = tx.objectStore(CHAT_STORE_NAME);
	const archiveStore = tx.objectStore(CHAT_ARCHIVE_STORE_NAME);

	// 1. 清空冷区
	archiveStore.clear();

	// 2. 逐条写入冷区对话
	for (const chat of Array.isArray(archivedChats) ? archivedChats : []) {
		if (chat?.id) {
			archiveStore.put(toPlainObject(chat), chat.id);
		}
	}

	// 3. 写入热区
	kvStore.put(JSON.stringify(Array.isArray(hotHistory) ? hotHistory : []), CHAT_HISTORY_KEY);

	// 4. 写入 currentChatId
	putCurrentChatIdToKvStore(kvStore, currentChatId);

	// 5. 写入归档索引
	putArchiveIndexToKvStore(kvStore, archiveIndex);

	await txDonePromise(tx);
}


