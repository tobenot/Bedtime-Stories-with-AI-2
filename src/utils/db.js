import Dexie from 'dexie';

// Database schema:
// - conversations: { id (number|string), title (string), createdAt (string) }
// - messages: { id (string), chatId (number|string), role (string), content (string), reasoning_content (string|undefined), isReasoningCollapsed (boolean|undefined), timestamp (string) }
// - meta: { key (string primary), value (any) }

class ChatDatabase extends Dexie {
	conversations;
	messages;
	meta;

	constructor() {
		super('bs2_chat_db');
		this.version(1).stores({
			conversations: 'id, createdAt',
			messages: 'id, chatId, timestamp',
			meta: 'key'
		});
		this.conversations = this.table('conversations');
		this.messages = this.table('messages');
		this.meta = this.table('meta');
	}
}

export const db = new ChatDatabase();

// Meta helpers
export async function getMeta(key, defaultValue = null) {
	const rec = await db.meta.get(key);
	return rec ? rec.value : defaultValue;
}

export async function setMeta(key, value) {
	await db.meta.put({ key, value });
}

// Conversations
export async function listConversations() {
	return db.conversations.orderBy('createdAt').reverse().toArray();
}

export async function getConversation(id) {
	return db.conversations.get(id);
}

export async function upsertConversation(conversation) {
	await db.conversations.put(conversation);
}

export async function deleteConversation(id) {
	await db.transaction('rw', db.messages, db.conversations, async () => {
		await db.messages.where('chatId').equals(id).delete();
		await db.conversations.delete(id);
	});
}

// Messages
export async function listMessagesByChat(chatId) {
	return db.messages.where('chatId').equals(chatId).sortBy('timestamp');
}

export async function replaceMessagesForChat(chatId, messages) {
	await db.transaction('rw', db.messages, async () => {
		await db.messages.where('chatId').equals(chatId).delete();
		if (Array.isArray(messages) && messages.length > 0) {
			await db.messages.bulkPut(messages.map((m, idx) => ({
				id: m.id || `${chatId}-${idx}-${Date.now()}`,
				chatId,
				role: m.role,
				content: m.content,
				reasoning_content: m.reasoning_content,
				isReasoningCollapsed: m.isReasoningCollapsed,
				timestamp: m.timestamp || new Date().toISOString(),
			})));
		}
	});
}

export async function appendMessage(chatId, message) {
	const msg = {
		id: message.id || `${chatId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		chatId,
		role: message.role,
		content: message.content,
		reasoning_content: message.reasoning_content,
		isReasoningCollapsed: message.isReasoningCollapsed,
		timestamp: message.timestamp || new Date().toISOString(),
	};
	await db.messages.put(msg);
	return msg;
}

export async function deleteMessage(messageId) {
	await db.messages.delete(messageId);
}

// Export/Import helpers (skeleton for later stages)
export async function exportAllData() {
	const [conversations, messages, meta] = await Promise.all([
		db.conversations.toArray(),
		db.messages.toArray(),
		db.meta.toArray()
	]);
	return { conversations, messages, meta };
}

export async function clearAllData() {
	await db.transaction('rw', db.conversations, db.messages, db.meta, async () => {
		await db.messages.clear();
		await db.conversations.clear();
		await db.meta.clear();
	});
}

