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
		if (command === 'copyChat') {
			this.copyCurrentChat();
		} else if (command === 'configureChatProtection') {
			if (this.currentChatId) {
				this.configureChatProtection(this.currentChatId);
			} else {
				console.warn('[AppCore] 无法设置对话密码：没有当前对话');
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
