/**
 * PWA 更新提示（registerType: 'prompt'）
 *
 * 监听 Service Worker 更新：检测到「有新版本」时置 available=true，
 * 由上层 UI 展示「发现新版本 → 点击刷新」浮条，用户确认后再触发 skipWaiting + 刷新。
 * 好处：不再被旧缓存默默卡住，也不在用户正使用/正输入时突然强制刷新。
 */
import { reactive } from 'vue'
import { registerSW } from 'virtual:pwa-register'

export const pwaUpdateState = reactive({
	// 是否有新版本待应用
	available: false,
	// 用户点「刷新」后执行：skipWaiting + reload
	refresh: null,
});

const OFFLINE_TIP_KEY = 'bs2_pwa_offline_tip';

export function initPwaUpdate() {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

	registerSW({
		immediate: true,
		onNeedRefresh(updateSW) {
			pwaUpdateState.available = true;
			pwaUpdateState.refresh = () => {
				pwaUpdateState.available = false;
				updateSW(true); // skipWaiting + reload
			};
		},
		onOfflineReady() {
			// 首次离线就绪只提示一次
			try {
				if (!window.localStorage.getItem(OFFLINE_TIP_KEY)) {
					window.localStorage.setItem(OFFLINE_TIP_KEY, '1');
					window.dispatchEvent(new Event('bs2-pwa-offline-ready'));
				}
			} catch (_) { /* ignore */ }
		},
	});
}