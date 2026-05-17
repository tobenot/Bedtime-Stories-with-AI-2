const KEY_STORAGE_PREFIX = 'bs2_api_keys';
const MAX_API_KEY_LENGTH = 16384;
const MAX_BUCKET_NAME_LENGTH = 128;

function isQuotaExceededError(error) {
	return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
}

function isAcceptableApiKeyValue(value) {
	return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_API_KEY_LENGTH;
}

function sanitizeApiKeyBuckets(keysObject) {
	if (!keysObject || typeof keysObject !== 'object') return {};
	const sanitized = {};
	for (const [rawKey, rawValue] of Object.entries(keysObject)) {
		const key = String(rawKey || '').trim();
		if (!key || key.length > MAX_BUCKET_NAME_LENGTH) continue;
		if (!isAcceptableApiKeyValue(rawValue)) continue;
		sanitized[key] = rawValue.trim();
	}
	return sanitized;
}

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
		return sanitizeApiKeyBuckets(JSON.parse(keysJson));
	} catch {
		return {};
	}
}

export function saveAllApiKeys(keysObject) {
	const sanitized = sanitizeApiKeyBuckets(keysObject);
	const serialized = JSON.stringify(sanitized);
	try {
		localStorage.setItem(KEY_STORAGE_PREFIX, serialized);
		return true;
	} catch (error) {
		console.warn('[keyManager] API Key 存储失败，已阻止启动流程被中断', {
			error: error?.message || String(error),
			quotaExceeded: isQuotaExceededError(error),
			bucketCount: Object.keys(sanitized).length,
			size: serialized.length
		});
		return false;
	}
}


export function getApiKeyForUrl(apiUrl) {
	const identifier = getApiUrlIdentifier(apiUrl);
	const allKeys = loadAllApiKeys();
	return allKeys[identifier] || '';
}

export function saveApiKeyForUrl(apiUrl, apiKey) {
	const identifier = getApiUrlIdentifier(apiUrl);
	const allKeys = loadAllApiKeys();
	const nextValue = isAcceptableApiKeyValue(apiKey) ? apiKey.trim() : '';

	if (nextValue) {
		if (allKeys[identifier] === nextValue) return true;
		allKeys[identifier] = nextValue;
	} else {
		if (!Object.prototype.hasOwnProperty.call(allKeys, identifier)) return true;
		delete allKeys[identifier];
	}

	return saveAllApiKeys(allKeys);
}


// ── Phase 1B: 按 presetId 分桶 ──

/**
 * 按 presetId 获取 API Key
 * 注意：Preset 体系下只读取 presetId 桶，避免相同 baseUrl 的不同预设串 key。
 */
export function getApiKeyForPreset(presetId) {
	const allKeys = loadAllApiKeys();
	return allKeys[presetId] || '';
}

/**
 * 按 presetId 保存 API Key
 * 注意：Preset 主流程只写 presetId 桶；URL 桶仅保留给旧数据迁移。
 */
export function saveApiKeyForPreset(presetId, apiKey) {
	const bucketId = String(presetId || '').trim();
	if (!bucketId) return false;
	const allKeys = loadAllApiKeys();
	const nextValue = isAcceptableApiKeyValue(apiKey) ? apiKey.trim() : '';
	if (nextValue) {
		if (allKeys[bucketId] === nextValue) return true;
		allKeys[bucketId] = nextValue;
	} else {
		if (!Object.prototype.hasOwnProperty.call(allKeys, bucketId)) return true;
		delete allKeys[bucketId];
	}
	return saveAllApiKeys(allKeys);
}


export function deleteApiKeyForPresetBucket(presetId, fallbackUrl = '') {
	const allKeys = loadAllApiKeys();
	let changed = false;

	if (Object.prototype.hasOwnProperty.call(allKeys, presetId)) {
		delete allKeys[presetId];
		changed = true;
	}

	if (fallbackUrl) {
		const urlId = getApiUrlIdentifier(fallbackUrl);
		if (Object.prototype.hasOwnProperty.call(allKeys, urlId)) {
			delete allKeys[urlId];
			changed = true;
		}
	}

	if (changed) {
		saveAllApiKeys(allKeys);
	}
}

/**
 * 将旧的 URL 桶 key 迁移到 presetId 桶
 */
export function migrateKeyToPresetBucket(presetId, apiUrl) {
	const allKeys = loadAllApiKeys();
	const urlId = getApiUrlIdentifier(apiUrl);
	let changed = false;
	if (allKeys[urlId] && !allKeys[presetId]) {
		allKeys[presetId] = allKeys[urlId];
		changed = true;
	}
	// URL 桶只作为旧数据迁移来源，迁移后删除，避免切换预设时持续重复占用 localStorage。
	if (Object.prototype.hasOwnProperty.call(allKeys, urlId)) {
		delete allKeys[urlId];
		changed = true;
	}
	return changed ? saveAllApiKeys(allKeys) : false;
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
		if (isAcceptableApiKeyValue(oldValue)) {
			const identifier = getApiUrlIdentifier(url);
			if (!allKeys[identifier]) {
				allKeys[identifier] = oldValue.trim();
				migrated = true;
			}
		}
	}


	const savedApiUrl = localStorage.getItem('bs2_api_url');
	const savedApiKey = localStorage.getItem('bs2_openai_compatible_api_key');
	if (savedApiUrl && isAcceptableApiKeyValue(savedApiKey)) {
		const identifier = getApiUrlIdentifier(savedApiUrl);
		if (!allKeys[identifier]) {
			allKeys[identifier] = savedApiKey.trim();
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
