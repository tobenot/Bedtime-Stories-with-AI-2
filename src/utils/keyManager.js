const KEY_STORAGE_PREFIX = 'bs2_api_keys';

function getApiUrlIdentifier(apiUrl) {
	if (!apiUrl) return 'default';
	
	const url = String(apiUrl).toLowerCase().trim();
	
	if (url.includes('siliconflow.cn')) return 'siliconflow';
	if (url.includes('deepseek.com')) return 'deepseek';
	if (url.includes('openrouter.ai')) return 'openrouter';
	if (url.includes('lmrouter.com')) return 'lmrouter';
	if (url.includes('volces.com')) return 'volces';
	if (url.includes('generativelanguage.googleapis.com')) return 'gemini_official';
	if (url.includes('/api/gemini')) return 'backend_gemini';
	if (url.includes('/api/deepseek')) return 'backend_deepseek';
	
	try {
		const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
		const domain = urlObj.hostname.replace(/^www\./, '');
		return domain.replace(/\./g, '_');
	} catch {
		return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
	}
}

export function loadAllApiKeys() {
	const keysJson = localStorage.getItem(KEY_STORAGE_PREFIX);
	if (!keysJson) return {};
	try {
		return JSON.parse(keysJson);
	} catch {
		return {};
	}
}

export function saveAllApiKeys(keysObject) {
	localStorage.setItem(KEY_STORAGE_PREFIX, JSON.stringify(keysObject));
}

export function getApiKeyForUrl(apiUrl) {
	const identifier = getApiUrlIdentifier(apiUrl);
	const allKeys = loadAllApiKeys();
	return allKeys[identifier] || '';
}

export function saveApiKeyForUrl(apiUrl, apiKey) {
	const identifier = getApiUrlIdentifier(apiUrl);
	const allKeys = loadAllApiKeys();
	
	if (apiKey && apiKey.trim()) {
		allKeys[identifier] = apiKey.trim();
	} else {
		delete allKeys[identifier];
	}
	
	saveAllApiKeys(allKeys);
}

// ── Phase 1B: 按 presetId 分桶 ──

/**
 * 按 presetId 获取 API Key
 * 优先从 presetId 桶读，回退到旧 URL 桶
 */
export function getApiKeyForPreset(presetId, fallbackUrl = '') {
	const allKeys = loadAllApiKeys();
	// 优先按 presetId 桶
	if (allKeys[presetId]) return allKeys[presetId];
	// 回退到旧 URL 桶
	if (fallbackUrl) {
		const urlId = getApiUrlIdentifier(fallbackUrl);
		if (allKeys[urlId]) return allKeys[urlId];
	}
	return '';
}

/**
 * 按 presetId 保存 API Key
 * 同时写入旧 URL 桶保持兼容
 */
export function saveApiKeyForPreset(presetId, apiKey, fallbackUrl = '') {
	const allKeys = loadAllApiKeys();
	if (apiKey && apiKey.trim()) {
		allKeys[presetId] = apiKey.trim();
		// 同时写旧桶保持兼容
		if (fallbackUrl) {
			const urlId = getApiUrlIdentifier(fallbackUrl);
			allKeys[urlId] = apiKey.trim();
		}
	} else {
		delete allKeys[presetId];
		if (fallbackUrl) {
			const urlId = getApiUrlIdentifier(fallbackUrl);
			delete allKeys[urlId];
		}
	}
	saveAllApiKeys(allKeys);
}

/**
 * 将旧的 URL 桶 key 迁移到 presetId 桶
 */
export function migrateKeyToPresetBucket(presetId, apiUrl) {
	const allKeys = loadAllApiKeys();
	const urlId = getApiUrlIdentifier(apiUrl);
	if (allKeys[urlId] && !allKeys[presetId]) {
		allKeys[presetId] = allKeys[urlId];
		saveAllApiKeys(allKeys);
		return true;
	}
	return false;
}

export function migrateOldApiKeys() {
	const allKeys = loadAllApiKeys();
	let migrated = false;

	const oldKeys = [
		{ key: 'bs2_openai_compatible_api_key', url: 'https://api.siliconflow.cn' },
		{ key: 'bs2_gemini_api_key', url: 'https://generativelanguage.googleapis.com' },
		{ key: 'deepseek_api_key', url: 'https://api.deepseek.com' },
		{ key: 'gemini_api_key', url: 'https://generativelanguage.googleapis.com' }
	];

	for (const { key, url } of oldKeys) {
		const oldValue = localStorage.getItem(key);
		if (oldValue) {
			const identifier = getApiUrlIdentifier(url);
			if (!allKeys[identifier]) {
				allKeys[identifier] = oldValue;
				migrated = true;
			}
		}
	}

	const savedApiUrl = localStorage.getItem('bs2_api_url');
	const savedApiKey = localStorage.getItem('bs2_openai_compatible_api_key');
	if (savedApiUrl && savedApiKey) {
		const identifier = getApiUrlIdentifier(savedApiUrl);
		if (!allKeys[identifier]) {
			allKeys[identifier] = savedApiKey;
			migrated = true;
		}
	}

	if (migrated) {
		saveAllApiKeys(allKeys);
	}

	return migrated;
}

export function exportApiKeys() {
	return loadAllApiKeys();
}

export function importApiKeys(keysObject) {
	if (typeof keysObject !== 'object' || keysObject === null) return false;
	saveAllApiKeys(keysObject);
	return true;
}

