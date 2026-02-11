import { getChatStorageTabId } from './chatStorage';

const CHAT_LOCK_KEY = 'bs2_chat_locks_v1';
const CHAT_LOCK_CHANNEL = 'bs2-chat-locks';
const CHAT_LOCK_TTL_MS = 30000;
const CHAT_LOCK_HEARTBEAT_MS = 10000;
const CHAT_LOCK_NAME = 'bs2-chat-lock-write';

let channelInstance = null;

function getNow() {
	return Date.now();
}

function parseLocks(raw) {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function getLocksFromStorage() {
	if (typeof localStorage === 'undefined') {
		return {};
	}
	return parseLocks(localStorage.getItem(CHAT_LOCK_KEY));
}

function setLocksToStorage(locks) {
	if (typeof localStorage === 'undefined') {
		return;
	}
	localStorage.setItem(CHAT_LOCK_KEY, JSON.stringify(locks));
}

function isLockActive(lock, now) {
	if (!lock || typeof lock !== 'object') return false;
	const updatedAt = typeof lock.updatedAt === 'number' ? lock.updatedAt : 0;
	return now - updatedAt <= CHAT_LOCK_TTL_MS;
}

function cleanupExpiredLocks(locks, now) {
	let changed = false;
	const next = { ...locks };
	for (const [chatId, lock] of Object.entries(next)) {
		if (!isLockActive(lock, now)) {
			delete next[chatId];
			changed = true;
		}
	}
	return { changed, locks: next };
}

function getChannel() {
	if (typeof BroadcastChannel === 'undefined') {
		return null;
	}
	if (!channelInstance) {
		channelInstance = new BroadcastChannel(CHAT_LOCK_CHANNEL);
	}
	return channelInstance;
}

function emitLockEvent(type, payload = {}) {
	const channel = getChannel();
	if (!channel) return;
	channel.postMessage({
		type,
		at: getNow(),
		...payload
	});
}

async function runWithWriteLock(task) {
	const lockApi = typeof navigator !== 'undefined' ? navigator?.locks : null;
	if (lockApi && typeof lockApi.request === 'function') {
		return lockApi.request(CHAT_LOCK_NAME, () => task());
	}
	return task();
}

export function getChatLockHeartbeatIntervalMs() {
	return CHAT_LOCK_HEARTBEAT_MS;
}

export async function tryAcquireChatLock(chatId, title = '') {
	const normalizedChatId = chatId ? String(chatId) : '';
	if (!normalizedChatId) {
		return { ok: false, reason: 'invalid_chat_id' };
	}
	const tabId = getChatStorageTabId();
	return runWithWriteLock(async () => {
		const now = getNow();
		const currentLocks = getLocksFromStorage();
		const cleaned = cleanupExpiredLocks(currentLocks, now);
		const activeLocks = cleaned.locks;
		const existing = activeLocks[normalizedChatId];
		if (existing && existing.tabId && existing.tabId !== tabId) {
			return {
				ok: false,
				reason: 'locked_by_other_tab',
				lock: existing
			};
		}
		activeLocks[normalizedChatId] = {
			chatId: normalizedChatId,
			chatTitle: title ? String(title) : '',
			tabId,
			updatedAt: now
		};
		setLocksToStorage(activeLocks);
		emitLockEvent('chat_lock_updated', { chatId: normalizedChatId, tabId });
		return {
			ok: true,
			lock: activeLocks[normalizedChatId]
		};
	});
}

export async function refreshChatLock(chatId, title = '') {
	const normalizedChatId = chatId ? String(chatId) : '';
	if (!normalizedChatId) return false;
	const tabId = getChatStorageTabId();
	return runWithWriteLock(async () => {
		const now = getNow();
		const currentLocks = getLocksFromStorage();
		const cleaned = cleanupExpiredLocks(currentLocks, now);
		const activeLocks = cleaned.locks;
		const lock = activeLocks[normalizedChatId];
		if (!lock || lock.tabId !== tabId) {
			return false;
		}
		activeLocks[normalizedChatId] = {
			...lock,
			chatTitle: title ? String(title) : lock.chatTitle || '',
			updatedAt: now
		};
		setLocksToStorage(activeLocks);
		return true;
	});
}

export async function releaseChatLock(chatId) {
	const normalizedChatId = chatId ? String(chatId) : '';
	if (!normalizedChatId) return false;
	const tabId = getChatStorageTabId();
	return runWithWriteLock(async () => {
		const now = getNow();
		const currentLocks = getLocksFromStorage();
		const cleaned = cleanupExpiredLocks(currentLocks, now);
		const activeLocks = cleaned.locks;
		const lock = activeLocks[normalizedChatId];
		if (!lock || lock.tabId !== tabId) {
			return false;
		}
		delete activeLocks[normalizedChatId];
		setLocksToStorage(activeLocks);
		emitLockEvent('chat_lock_released', { chatId: normalizedChatId, tabId });
		return true;
	});
}

export async function releaseAllOwnedChatLocks() {
	const tabId = getChatStorageTabId();
	return runWithWriteLock(async () => {
		const now = getNow();
		const currentLocks = getLocksFromStorage();
		const cleaned = cleanupExpiredLocks(currentLocks, now);
		const activeLocks = cleaned.locks;
		let changed = false;
		for (const [chatId, lock] of Object.entries(activeLocks)) {
			if (lock?.tabId === tabId) {
				delete activeLocks[chatId];
				changed = true;
			}
		}
		if (changed || cleaned.changed) {
			setLocksToStorage(activeLocks);
			emitLockEvent('chat_lock_release_all', { tabId });
		}
		return changed;
	});
}

export function releaseAllOwnedChatLocksSync() {
	if (typeof localStorage === 'undefined') return;
	const tabId = getChatStorageTabId();
	const now = getNow();
	const currentLocks = getLocksFromStorage();
	const cleaned = cleanupExpiredLocks(currentLocks, now);
	const activeLocks = cleaned.locks;
	let changed = false;
	for (const [chatId, lock] of Object.entries(activeLocks)) {
		if (lock?.tabId === tabId) {
			delete activeLocks[chatId];
			changed = true;
		}
	}
	if (changed || cleaned.changed) {
		setLocksToStorage(activeLocks);
	}
}

export function subscribeChatLockEvents(handler) {
	const channel = getChannel();
	if (!channel || typeof handler !== 'function') {
		return () => {};
	}
	const listener = (event) => {
		handler(event?.data || null);
	};
	channel.addEventListener('message', listener);
	return () => {
		channel.removeEventListener('message', listener);
	};
}
