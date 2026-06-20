import confirmUseScript from '@/utils/scriptPreview.js';
import { exportChatToPDF } from '@/utils/pdfExporter';

export const uiMethods = {
	toggleSidebar() {
		this.showSidebar = !this.showSidebar;
	},
	handleResize() {
		const desktop = window.innerWidth >= 768;
		if (desktop !== this.isDesktop) {
			this.isDesktop = desktop;
			this.showSidebar = desktop;
		}
	},
	scrollToBottomManual() {
		if (this.$refs.currentMode?.scrollToBottomManual) {
			this.$refs.currentMode.scrollToBottomManual();
		}
	},
	focusInput() {
		if (this.$refs.currentMode?.focus) {
			this.$refs.currentMode.focus();
		}
	},
	/** 启用 5m 缓存并发送消息后，启动 5 分钟倒计时 */
	startCacheCountdown() {
		this._clearCacheCountdownExpiredTimer();
		this.cacheCountdownEndsAt = Date.now() + 5 * 60 * 1000;
		this.cacheCountdownRemaining = 5 * 60;
		if (!this._cacheCountdownInterval) {
			this._cacheCountdownInterval = setInterval(this.tickCacheCountdown, 1000);
		}
	},
	/** 停止倒计时并隐藏组件 */
	stopCacheCountdown() {
		this.cacheCountdownEndsAt = 0;
		this.cacheCountdownRemaining = 0;
		if (this._cacheCountdownInterval) {
			clearInterval(this._cacheCountdownInterval);
			this._cacheCountdownInterval = null;
		}
		this._clearCacheCountdownExpiredTimer();
	},
	tickCacheCountdown() {
		if (!this.cacheCountdownEndsAt) {
			return;
		}
		const remaining = Math.max(0, Math.ceil((this.cacheCountdownEndsAt - Date.now()) / 1000));
		this.cacheCountdownRemaining = remaining;
		if (remaining <= 0 && !this._cacheCountdownExpiredTimer) {
			// 过期后保留“已过期”状态 15 秒，随后自动隐藏
			this._cacheCountdownExpiredTimer = setTimeout(() => {
				this._cacheCountdownExpiredTimer = null;
				this.stopCacheCountdown();
			}, 15000);
		}
	},
	_clearCacheCountdownExpiredTimer() {
		if (this._cacheCountdownExpiredTimer) {
			clearTimeout(this._cacheCountdownExpiredTimer);
			this._cacheCountdownExpiredTimer = null;
		}
	},
	/** 点击倒计时：填入“谢谢”并聚焦输入框 */
	onCacheCountdownClick() {
		if (this.$refs.currentMode) {
			this.$refs.currentMode.inputMessage = '谢谢';
			this.focusInput();
		}
	},
	async copyMessage(content) {
		try {
			await navigator.clipboard.writeText(content);
			this.$message({ message: '复制成功', type: 'success', duration: 2000 });
		} catch (err) {
			this.$message({ message: '复制失败', type: 'error', duration: 2000 });
		}
	},
	async exportToPDF() {
		try {
			await exportChatToPDF(this.currentChat);
			this.$message({ message: 'PDF导出成功', type: 'success', duration: 2000 });
		} catch (error) {
			console.error('PDF 导出失败:', error);
			this.$message({ message: 'PDF导出失败', type: 'error', duration: 2000 });
		}
	},
	handleToolboxCommand(command) {
		console.log('[AppCore] Toolbox command:', command);
		if (command === 'configureChatProtection') {
			if (this.currentChatId) {
				this.configureChatProtection(this.currentChatId);
			} else {
				console.warn('[AppCore] 无法设置对话密码：没有当前对话');
				this.$message({ message: '请先选择一个对话', type: 'warning', duration: 2000 });
			}
		} else if (command === 'removeChatProtection') {
			if (this.currentChatId) {
				this.removeChatProtection(this.currentChatId);
			} else {
				console.warn('[AppCore] 无法取消对话密码：没有当前对话');
				this.$message({ message: '请先选择一个对话', type: 'warning', duration: 2000 });
			}
		} else if (command === 'localScriptEditor') {
			this.showLocalScriptEditor = true;
		} else if (command === 'exportTxtNovel') {
			this.showTxtNovelExporter = !this.showTxtNovelExporter;
		} else if (command === 'markdownTool') {
			this.showMarkdownTool = true;
		} else if (command === 'scrollNavigator') {
			this.updateScrollStats();
			this.showScrollNavigator = true;
		}
	},
	updateScrollStats() {
		const stats = this.$refs.currentMode?.getScrollStats?.();
		if (stats && typeof stats.percent === 'number') {
			this.currentScrollPercent = Math.round(stats.percent);
		}
	},
	onScrollProgress(percent) {
		if (typeof percent !== 'number') {
			return;
		}
		this.currentScrollPercent = Math.round(percent);
	},
	scrollByPercent(percent) {
		const clamped = Math.min(Math.max(percent, 0), 100);
		console.log('[AppCore] Scroll locator percent', { percent: clamped, totalMessages: this.messageCount });
		if (this.$refs.currentMode?.scrollByPercent) {
			this.$refs.currentMode.scrollByPercent(clamped);
		}
	},
	scrollToMessageIndex(index) {
		const count = this.messageCount;
		if (!count) {
			return;
		}
		const target = Math.min(Math.max(parseInt(index, 10) || 1, 1), count);
		console.log('[AppCore] Scroll locator index', { target, totalMessages: count });
		if (this.$refs.currentMode?.scrollToMessageIndex) {
			this.$refs.currentMode.scrollToMessageIndex(target);
		}
	},
	selectScript(script) {
		confirmUseScript(script)
			.then(finalScript => {
				if (this.$refs.currentMode) {
					this.$refs.currentMode.inputMessage = finalScript;
					this.focusInput();
				}
				this.showScriptPanel = false;
			})
			.catch(error => {
				console.warn('剧本选择已取消或发生错误:', error);
			});
	},
	openExternalLink(url) {
		window.open(url, '_blank');
	}
};
