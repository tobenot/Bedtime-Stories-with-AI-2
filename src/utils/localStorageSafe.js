export function safeGetLocalStorage(key, fallback = '') {
	try {
		const value = localStorage.getItem(key);
		return value === null ? fallback : value;
	} catch (error) {
		console.warn('[localStorageSafe] 读取 localStorage 失败', { key, error: error?.message || String(error) });
		return fallback;
	}
}

export function safeSetLocalStorage(key, value, label = key) {
	try {
		localStorage.setItem(key, String(value ?? ''));
		return true;
	} catch (error) {
		console.warn('[localStorageSafe] 写入 localStorage 失败，已阻止流程被中断', {
			key,
			label,
			error: error?.message || String(error),
			size: String(value ?? '').length
		});
		return false;
	}
}

export function safeRemoveLocalStorage(key, label = key) {
	try {
		localStorage.removeItem(key);
		return true;
	} catch (error) {
		console.warn('[localStorageSafe] 删除 localStorage 失败，已阻止流程被中断', {
			key,
			label,
			error: error?.message || String(error)
		});
		return false;
	}
}

export function safeParseJson(raw, fallback) {
	try {
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}

export function safeSetJsonLocalStorage(key, value, label = key) {
	try {
		return safeSetLocalStorage(key, JSON.stringify(value), label);
	} catch (error) {
		console.warn('[localStorageSafe] 序列化 localStorage 数据失败，已阻止流程被中断', {
			key,
			label,
			error: error?.message || String(error)
		});
		return false;
	}
}
