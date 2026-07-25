/**
 * 主题（亮色/暗色）切换工具
 * - class 策略：在 <html> 上加/去 dark class
 * - 持久化：localStorage，key 为 'theme'（'light' | 'dark'）
 * - 初始值：localStorage > prefers-color-scheme > light
 */

const THEME_KEY = 'theme';

export function getStoredTheme() {
	try {
		const value = localStorage.getItem(THEME_KEY);
		return value === 'dark' || value === 'light' ? value : null;
	} catch (e) {
		return null;
	}
}

export function getInitialTheme() {
	const stored = getStoredTheme();
	if (stored) return stored;
	if (typeof window !== 'undefined' && window.matchMedia
		&& window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}

export function applyTheme(theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme) {
	const next = theme === 'dark' ? 'dark' : 'light';
	try {
		localStorage.setItem(THEME_KEY, next);
	} catch (e) {
		// localStorage 不可用时仅本次会话生效
	}
	applyTheme(next);
	return next;
}

export function toggleTheme() {
	const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	return setTheme(current === 'dark' ? 'light' : 'dark');
}

/** 应用启动时调用，避免主题闪烁 */
export function initTheme() {
	applyTheme(getInitialTheme());
}
