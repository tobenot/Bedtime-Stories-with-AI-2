import { parseArchiveJson, mergeImportedChats } from '@/utils/archive.js';
import { normalizeAndRepairChats, sortChatsByCreatedTime } from '@/utils/chatData';
import { encryptTextWithPassword, decryptTextWithPassword } from '@/utils/secureArchive.js';

export const archiveMethods = {
	async promptPassword(title, message) {
		try {
			const inputName = `bs2_password_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
			const { value } = await this.$prompt(message, title, {
				inputType: 'password',
				inputValue: '',
				inputPlaceholder: '请输入密码',
				confirmButtonText: '确定',
				cancelButtonText: '取消',
				closeOnClickModal: false,
				closeOnPressEscape: true,
				showClose: true,
				inputAttributes: {
					name: inputName,
					autocomplete: 'new-password',
					autocorrect: 'off',
					autocapitalize: 'off',
					spellcheck: 'false',
					'data-form-type': 'other',
					'data-lpignore': 'true',
					'data-1p-ignore': 'true',
					'data-bwignore': 'true'
				}
			});
			const password = typeof value === 'string' ? value.trim() : '';
			if (!password) {
				this.$message({ message: '密码不能为空', type: 'warning', duration: 2000 });
				return null;
			}
			return password;
		} catch (err) {
			return null;
		}
	},
	async prepareExportContent(payload) {
		let shouldEncrypt = false;
		try {
			await this.$confirm('是否为本次导出设置密码？', '导出选项', {
				confirmButtonText: '加密导出',
				cancelButtonText: '明文导出',
				distinguishCancelAndClose: true,
				type: 'warning',
				closeOnClickModal: false
			});
			shouldEncrypt = true;
		} catch (action) {
			if (action === 'close') {
				return null;
			}
		}
		const jsonData = JSON.stringify(payload, null, 2);
		if (!shouldEncrypt) {
			console.log('[AppCore] 导出明文存档');
			return jsonData;
		}
		const password = await this.promptPassword('加密导出', '请输入导出密码');
		if (password === null) {
			return null;
		}
		const startedAt = performance.now();
		const encryptedPayload = await encryptTextWithPassword(jsonData, password);
		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log('[AppCore] 导出加密存档', {
			compression: encryptedPayload?.compression || 'none',
			originalSize: encryptedPayload?.originalSize ?? null,
			compressedSize: encryptedPayload?.compressedSize ?? null,
			elapsedMs
		});
		return JSON.stringify(encryptedPayload, null, 2);
	},
	async exportChatArchive() {
		try {
			const payload = {
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'full',
					totalChats: Array.isArray(this.chatHistory) ? this.chatHistory.length : 0
				},
				chatHistory: this.chatHistory
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_history_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: '存档已导出', type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出存档失败', type: 'error', duration: 2000 });
		}
	},
	exportChatTitles() {
		try {
			const chats = Array.isArray(this.chatHistory) ? this.chatHistory : [];
			const lines = chats.map(c => (c.title && c.title.trim()) ? c.title.trim() : '新对话');
			const text = lines.join('\n');
			const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_titles_${new Date().toISOString().slice(0, 10)}.txt`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: '对话标题列表已导出', type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出对话标题列表失败', type: 'error', duration: 2000 });
		}
	},
	async exportCurrentChatArchive() {
		if (!this.currentChat) {
			this.$message({ message: '暂无当前对话可导出', type: 'warning', duration: 2000 });
			return;
		}
		try {
			const payload = {
				singleChatOnly: true,
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'single',
					totalChats: 1,
					currentChatId: this.currentChat.id
				},
				chatHistory: [JSON.parse(JSON.stringify(this.currentChat))]
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_current_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: '当前对话已导出', type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出当前对话失败', type: 'error', duration: 2000 });
		}
	},
	importChatArchive(mode) {
		this.importMode = mode;
		this.$refs.importFile.click();
	},
	async parseImportedArchiveText(rawText) {
		const parsed = JSON.parse(rawText);
		if (!parsed?.encrypted) {
			return parseArchiveJson(rawText);
		}
		const password = await this.promptPassword('导入加密存档', '请输入导入密码');
		if (password === null) {
			throw new Error('import_cancelled');
		}
		const startedAt = performance.now();
		const decryptedText = await decryptTextWithPassword(parsed, password);
		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log('[AppCore] 已解密导入存档', {
			compression: parsed?.compression || 'none',
			originalSize: parsed?.originalSize ?? null,
			compressedSize: parsed?.compressedSize ?? null,
			elapsedMs
		});
		return parseArchiveJson(decryptedText);
	},
	repairChatData() {
		const repaired = normalizeAndRepairChats(this.chatHistory);
		this.chatHistory = repaired.chats;
		this.syncCurrentChatIdAfterRepair(this.currentChatId, repaired.idMap);
		this.saveChatHistory();
		console.log('[AppCore] 手动统一修复完成', repaired.stats);
		this.$message({
			message: `统一修复完成：修复对话 ${repaired.stats.repairedChatCount} 条，修复消息 ${repaired.stats.repairedMessageCount} 条`,
			type: 'success',
			duration: 2500
		});
	},
	handleImportFile(event) {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async (e) => {
			let importedData = null;
			try {
				importedData = await this.parseImportedArchiveText(e.target.result);
			} catch (err) {
				if (err?.message === 'import_cancelled') {
					return;
				}
				this.$message({ message: '无法解析文件或密码错误，请确认后重试。', type: 'error', duration: 2000 });
				return;
			}
			const { chats, singleChatOnly } = importedData;
			const normalizedImported = normalizeAndRepairChats(chats).chats;
			if (this.importMode === 'overwrite') {
				if (singleChatOnly) {
					this.$message({ message: '单个对话存档仅支持合并导入，禁止覆盖。', type: 'warning', duration: 2500 });
					return;
				}
				this.chatHistory = sortChatsByCreatedTime(normalizedImported);
				if (this.chatHistory.length > 0) {
					this.currentChatId = this.chatHistory[0].id;
					this.persistCurrentChatId(this.currentChatId);
				} else {
					this.createNewChat();
				}
				this.$message({ message: '存档已覆盖', type: 'success', duration: 2000 });
			} else if (this.importMode === 'merge') {
				mergeImportedChats(normalizedImported, this.chatHistory);
				const repairedMerged = normalizeAndRepairChats(this.chatHistory);
				this.chatHistory = repairedMerged.chats;
				if (!this.currentChatId && this.chatHistory.length > 0) {
					this.currentChatId = this.chatHistory[0].id;
					this.persistCurrentChatId(this.currentChatId);
				}
				this.$message({ message: '存档已合并', type: 'success', duration: 2000 });
			}
			this.saveChatHistory();
		};
		reader.readAsText(file);
		event.target.value = '';
	}
};
