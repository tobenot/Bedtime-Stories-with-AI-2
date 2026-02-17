const CHAT_DB_NAME = 'bs2-chat-db';
const CHAT_DB_VERSION = 1;
const CHAT_STORE_NAME = 'kv';
const CHAT_HISTORY_KEY = 'chat_history';
const CURRENT_CHAT_ID_KEY = 'current_chat_id';

const LEGACY_CHAT_HISTORY_KEY = 'bs2_chat_history';
const LEGACY_CURRENT_CHAT_ID_KEY = 'bs2_current_chat_id';

let openDbPromise = null;

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

async function setValuesToIndexedDb(savedHistory, savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	store.put(savedHistory, CHAT_HISTORY_KEY);
	if (savedCurrentChatId) {
		store.put(String(savedCurrentChatId), CURRENT_CHAT_ID_KEY);
	} else {
		store.delete(CURRENT_CHAT_ID_KEY);
	}
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

export async function saveChatStorageData(savedHistory, savedCurrentChatId) {
	await setValuesToIndexedDb(savedHistory, savedCurrentChatId);
}

export async function saveCurrentChatIdStorageData(savedCurrentChatId) {
	const db = await openDb();
	const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
	const store = tx.objectStore(CHAT_STORE_NAME);
	if (savedCurrentChatId) {
		store.put(String(savedCurrentChatId), CURRENT_CHAT_ID_KEY);
	} else {
		store.delete(CURRENT_CHAT_ID_KEY);
	}
	await txDonePromise(tx);
}

export async function clearChatStorageData() {
	await removeValuesFromIndexedDb();
}

