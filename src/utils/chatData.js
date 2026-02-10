function randomHex(length) {
	let result = '';
	while (result.length < length) {
		result += Math.floor(Math.random() * 16).toString(16);
	}
	return result.slice(0, length);
}

export function createUuid() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}
	return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${randomHex(3)}-${randomHex(12)}`;
}

function parseTimestampMs(value) {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		if (value < 1e11) {
			return Math.floor(value * 1000);
		}
		return Math.floor(value);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return null;
		if (/^\d+$/.test(trimmed)) {
			const numeric = Number(trimmed);
			if (Number.isFinite(numeric) && numeric > 0) {
				if (numeric < 1e11) {
					return Math.floor(numeric * 1000);
				}
				return Math.floor(numeric);
			}
		}
		const fromDate = Date.parse(trimmed);
		if (Number.isFinite(fromDate)) {
			return fromDate;
		}
	}
	return null;
}

function pickChatTimestampMs(chat, fallbackMs) {
	const candidates = [
		chat?.createdAtMs,
		chat?.createdAt,
		chat?.timestamp,
		chat?.created_at,
		chat?.id
	];
	for (const candidate of candidates) {
		const parsed = parseTimestampMs(candidate);
		if (parsed) return parsed;
	}
	return fallbackMs;
}

function cloneMessageWithUuid(message) {
	const cloned = JSON.parse(JSON.stringify(message || {}));
	cloned.id = createUuid();
	return cloned;
}

export function cloneMessagesWithNewIds(messages = []) {
	return (Array.isArray(messages) ? messages : []).map(cloneMessageWithUuid);
}

export function sortChatsByCreatedTime(chats = []) {
	return [...chats].sort((a, b) => {
		const aTime = parseTimestampMs(a?.createdAtMs) ?? parseTimestampMs(a?.createdAt) ?? 0;
		const bTime = parseTimestampMs(b?.createdAtMs) ?? parseTimestampMs(b?.createdAt) ?? 0;
		return bTime - aTime;
	});
}

export function normalizeAndRepairChats(rawChats = []) {
	const source = Array.isArray(rawChats) ? rawChats : [];
	const now = Date.now();
	const idMap = {};
	const chatIdSet = new Set();
	const messageIdSet = new Set();
	let changed = false;
	let repairedChatCount = 0;
	let repairedMessageCount = 0;

	const repaired = source.map((chat, index) => {
		const cloned = JSON.parse(JSON.stringify(chat || {}));
		const fallbackMs = now - Math.max(source.length - index, 1);
		const createdAtMs = pickChatTimestampMs(cloned, fallbackMs);
		const oldChatId = cloned.id;
		let chatChanged = false;

		let nextChatId = typeof cloned.id === 'string' ? cloned.id : '';
		if (!nextChatId || chatIdSet.has(nextChatId)) {
			nextChatId = createUuid();
			chatChanged = true;
		}
		chatIdSet.add(nextChatId);
		cloned.id = nextChatId;
		if (oldChatId !== undefined && oldChatId !== null && String(oldChatId) !== nextChatId) {
			idMap[String(oldChatId)] = nextChatId;
		}

		const iso = new Date(createdAtMs).toISOString();
		if (cloned.createdAt !== iso) {
			cloned.createdAt = iso;
			chatChanged = true;
		}
		if (cloned.createdAtMs !== createdAtMs) {
			cloned.createdAtMs = createdAtMs;
			chatChanged = true;
		}

		const sourceMessages = Array.isArray(cloned.messages) ? cloned.messages : [];
		const repairedMessages = sourceMessages.map((msg, msgIndex) => {
			const nextMsg = { ...(msg || {}) };
			const fallbackMessageMs = createdAtMs + msgIndex;
			const messageCreatedAtMs = parseTimestampMs(nextMsg.createdAtMs) ?? parseTimestampMs(nextMsg.createdAt) ?? fallbackMessageMs;
			const messageIso = new Date(messageCreatedAtMs).toISOString();
			let messageChanged = false;

			let messageId = typeof nextMsg.id === 'string' ? nextMsg.id : '';
			if (!messageId || messageIdSet.has(messageId)) {
				messageId = createUuid();
				messageChanged = true;
			}
			messageIdSet.add(messageId);
			if (nextMsg.id !== messageId) {
				nextMsg.id = messageId;
				messageChanged = true;
			}
			if (nextMsg.createdAt !== messageIso) {
				nextMsg.createdAt = messageIso;
				messageChanged = true;
			}
			if (nextMsg.createdAtMs !== messageCreatedAtMs) {
				nextMsg.createdAtMs = messageCreatedAtMs;
				messageChanged = true;
			}
			if (messageChanged) {
				repairedMessageCount += 1;
				chatChanged = true;
			}
			return nextMsg;
		});

		if (!Array.isArray(cloned.messages) || cloned.messages.length !== repairedMessages.length) {
			chatChanged = true;
		}
		cloned.messages = repairedMessages;
		if (chatChanged) {
			repairedChatCount += 1;
			changed = true;
		}
		return cloned;
	});

	return {
		chats: sortChatsByCreatedTime(repaired),
		idMap,
		changed,
		stats: {
			totalChats: repaired.length,
			repairedChatCount,
			repairedMessageCount
		}
	};
}
