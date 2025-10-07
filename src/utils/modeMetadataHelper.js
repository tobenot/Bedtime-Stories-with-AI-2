export class ModeMetadataManager {
	constructor(chat, metadataKey) {
		this.chat = chat;
		this.metadataKey = metadataKey;
		this.ensureMetadata();
	}

	ensureMetadata() {
		if (!this.chat.metadata) {
			this.chat.metadata = {};
		}
		if (!this.chat.metadata[this.metadataKey]) {
			this.chat.metadata[this.metadataKey] = {};
		}
	}

	get(key, defaultValue = null) {
		this.ensureMetadata();
		return this.chat.metadata[this.metadataKey][key] ?? defaultValue;
	}

	set(key, value) {
		this.ensureMetadata();
		this.chat.metadata[this.metadataKey][key] = value;
	}

	setAll(data) {
		this.ensureMetadata();
		this.chat.metadata[this.metadataKey] = { ...this.chat.metadata[this.metadataKey], ...data };
	}

	getAll() {
		this.ensureMetadata();
		return this.chat.metadata[this.metadataKey];
	}

	clear() {
		this.ensureMetadata();
		this.chat.metadata[this.metadataKey] = {};
	}

	has(key) {
		this.ensureMetadata();
		return key in this.chat.metadata[this.metadataKey];
	}
}

export function createMetadataManager(chat, metadataKey) {
	return new ModeMetadataManager(chat, metadataKey);
}

export function loadMetadata(chat, metadataKey, defaultData = {}) {
	if (!chat.metadata?.[metadataKey]) {
		return defaultData;
	}
	return { ...defaultData, ...chat.metadata[metadataKey] };
}

export function saveMetadata(chat, metadataKey, data) {
	if (!chat.metadata) {
		chat.metadata = {};
	}
	chat.metadata[metadataKey] = data;
}

