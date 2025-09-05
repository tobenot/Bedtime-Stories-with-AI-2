import { db, getMeta, setMeta, upsertConversation, replaceMessagesForChat, listConversations } from './db';

const META_MIGRATED_KEY = 'migrated_to_idb_v1';

function safeParse(json, fallback) {
	try { return JSON.parse(json); } catch { return fallback; }
}

export async function detectOldData() {
	const existing = localStorage.getItem('bs2_chat_history');
	return !!existing;
}

export async function migrateIfNeeded() {
	// If already migrated, skip
	const migrated = await getMeta(META_MIGRATED_KEY, false);
	if (migrated) return { skipped: true };

	// If IndexedDB unavailable, throw so caller can fallback
	if (typeof window === 'undefined' || !('indexedDB' in window)) {
		throw new Error('IndexedDB not supported');
	}

	const raw = localStorage.getItem('bs2_chat_history');
	if (!raw) {
		await setMeta(META_MIGRATED_KEY, true);
		return { skipped: true };
	}
	const chats = safeParse(raw, []);
	if (!Array.isArray(chats)) {
		await setMeta(META_MIGRATED_KEY, true);
		return { skipped: true };
	}

	await db.transaction('rw', db.conversations, db.messages, async () => {
		for (const chat of chats) {
			if (!chat || chat.id == null) continue;
			const conversation = {
				id: chat.id,
				title: chat.title || '新对话',
				createdAt: chat.createdAt || new Date().toISOString(),
			};
			await upsertConversation(conversation);
			const msgs = Array.isArray(chat.messages) ? chat.messages : [];
			await replaceMessagesForChat(conversation.id, msgs);
		}
	});

	await setMeta(META_MIGRATED_KEY, true);
	return { migrated: true, conversations: await listConversations() };
}

export async function loadChatsFromDb() {
	const conversations = await listConversations();
	const results = [];
	for (const c of conversations) {
		const msgs = await db.messages.where('chatId').equals(c.id).sortBy('timestamp');
		results.push({ id: c.id, title: c.title, createdAt: c.createdAt, messages: msgs });
	}
	return results;
}

