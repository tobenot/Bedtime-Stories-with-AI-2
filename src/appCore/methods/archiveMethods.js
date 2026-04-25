import { parseArchiveJson, mergeImportedChats } from '@/utils/archive.js';
import { normalizeAndRepairChats, sortChatsByCreatedTime } from '@/utils/chatData';
import { encryptTextWithPassword, decryptTextWithPassword } from '@/utils/secureArchive.js';
import { patchInputNoAutofill } from '@/utils/noAutofillDirective.js';
import { getAllArchivedChats, replaceAllStorageData } from '@/utils/chatStorage';

export const archiveMethods = {
	async promptPassword(title, message) {
		try {
			const inputName = `bs2_password_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
			const promptPromise = this.$prompt(message, title, {
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
					readonly: 'readonly',
					autocomplete: 'new-password',
					'data-form-type': 'other',
					'data-lpignore': 'true',
					'data-1p-ignore': 'true',
					'data-bwignore': 'true'
				}
			});
			setTimeout(() => {
				const input = document.querySelector('.el-message-box input[type="password"]');
				patchInputNoAutofill(input);
			}, 50);
			const { value } = await promptPromise;
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
		this.showPasswordTip(password, '导出密码');
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
	async exportRecentChatArchive() {
		try {
			const recentLimit = 80;
			const chats = Array.isArray(this.chatHistory) ? this.chatHistory : [];
			const recentChats = sortChatsByCreatedTime(chats).slice(0, recentLimit);
			const payload = {
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'recent',
					totalChats: recentChats.length,
					recentLimit
				},
				chatHistory: JSON.parse(JSON.stringify(recentChats))
			};
			console.log('[AppCore] 导出最近对话存档', {
				recentLimit,
				exportedCount: recentChats.length,
				totalCount: chats.length
			});
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_recent_${recentLimit}_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: `最近${recentLimit}条对话已导出`, type: 'success', duration: 2000 });
		} catch (error) {
			this.$message({ message: '导出最近对话失败', type: 'error', duration: 2000 });
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

			// ── 完整备份（冷热分离版本）的导入路径 ──
			if (importedData.isFullBackup) {
				await this.handleFullBackupImport(importedData);
				return;
			}

			// ── 普通存档导入路径（热区操作，逻辑不变） ──
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
	},

	/**
	 * 完整备份导入：冷热分区原子恢复
	 * - 覆盖模式：直接替换热区、冷区、索引、currentChatId
	 * - 合并模式：热区合并到当前热区，冷区合并到当前冷区（按 ID 去重）
	 */
	async handleFullBackupImport(importedData) {
		const { chats: hotChats, archivedChats, archiveIndex: importedArchiveIndex, currentChatId: importedCurrentChatId } = importedData;

		const normalizedHot = normalizeAndRepairChats(hotChats || []).chats;
		const normalizedCold = normalizeAndRepairChats(archivedChats || []).chats;

		if (this.importMode === 'overwrite') {
			// 覆盖模式：原子替换全部数据
			const sortedHot = sortChatsByCreatedTime(normalizedHot);

			// 从冷区对话构建归档索引（优先用备份里的索引，但要确保与实际冷区对话一致）
			const rebuiltArchiveIndex = normalizedCold.map(chat => ({
				id: chat.id,
				title: chat.title || '新对话',
				createdAtMs: chat.createdAtMs || Date.now()
			}));
			// 补上备份索引中存在但冷区对话也存在的条目的额外字段（如果有）
			const importedIndexMap = new Map(
				(Array.isArray(importedArchiveIndex) ? importedArchiveIndex : [])
					.filter(item => item?.id)
					.map(item => [item.id, item])
			);
			const finalArchiveIndex = sortChatsByCreatedTime(
				rebuiltArchiveIndex.map(item => {
					const fromImported = importedIndexMap.get(item.id);
					return fromImported ? { ...item, ...fromImported } : item;
				})
			);

			// 确定 currentChatId
			const nextCurrentChatId = (importedCurrentChatId && sortedHot.some(c => c.id === importedCurrentChatId))
				? importedCurrentChatId
				: (sortedHot[0]?.id || null);

			try {
				await this.enqueueChatStorageTask(() => replaceAllStorageData({
					hotHistory: sortedHot,
					archivedChats: normalizedCold,
					archiveIndex: finalArchiveIndex,
					currentChatId: nextCurrentChatId
				}));

				// 更新内存状态
				this.chatHistory = sortedHot;
				this.archiveIndex = finalArchiveIndex;
				if (nextCurrentChatId) {
					this.currentChatId = nextCurrentChatId;
				} else {
					this.createNewChat();
				}

				const hotCount = sortedHot.length;
				const coldCount = normalizedCold.length;
				this.$message({
					message: `完整备份已覆盖恢复（热区 ${hotCount} 条 + 冷区 ${coldCount} 条）`,
					type: 'success',
					duration: 2500
				});
				console.log('[AppCore] 完整备份覆盖恢复完成', { hotCount, coldCount, currentChatId: nextCurrentChatId });
			} catch (err) {
				console.error('[AppCore] 完整备份覆盖恢复失败', err);
				this.$message({ message: '完整备份恢复失败：' + (err.message || '未知错误'), type: 'error', duration: 3000 });
			}
		} else if (this.importMode === 'merge') {
			// 合并模式：热区合并到当前热区，冷区合并到当前冷区
			try {
				// 1. 合并热区
				mergeImportedChats(normalizedHot, this.chatHistory);
				const repairedMerged = normalizeAndRepairChats(this.chatHistory);
				this.chatHistory = repairedMerged.chats;

				// 2. 合并冷区：读取当前冷区全部对话，按 ID 去重合并
				const existingCold = await getAllArchivedChats();
				const existingColdMap = new Map(
					(existingCold || []).filter(c => c?.id).map(c => [c.id, c])
				);

				// 将导入的冷区对话合并进来（已有的保留，新的追加）
				for (const chat of normalizedCold) {
					if (chat?.id && !existingColdMap.has(chat.id)) {
						existingColdMap.set(chat.id, chat);
					}
				}
				const mergedCold = Array.from(existingColdMap.values());

				// 3. 重建归档索引
				const mergedArchiveIndex = sortChatsByCreatedTime(
					mergedCold.map(chat => ({
						id: chat.id,
						title: chat.title || '新对话',
						createdAtMs: chat.createdAtMs || Date.now()
					}))
				);

				// 4. 确定 currentChatId
				const nextCurrentChatId = this.currentChatId || (this.chatHistory[0]?.id || null);

				// 5. 原子写入
				await this.enqueueChatStorageTask(() => replaceAllStorageData({
					hotHistory: this.chatHistory,
					archivedChats: mergedCold,
					archiveIndex: mergedArchiveIndex,
					currentChatId: nextCurrentChatId
				}));

				// 6. 更新内存
				this.archiveIndex = mergedArchiveIndex;
				if (!this.currentChatId && this.chatHistory.length > 0) {
					this.currentChatId = this.chatHistory[0].id;
				}

				const hotCount = this.chatHistory.length;
				const coldCount = mergedCold.length;
				this.$message({
					message: `完整备份已合并（热区 ${hotCount} 条 + 冷区 ${coldCount} 条）`,
					type: 'success',
					duration: 2500
				});
				console.log('[AppCore] 完整备份合并完成', { hotCount, coldCount });
			} catch (err) {
				console.error('[AppCore] 完整备份合并失败', err);
				this.$message({ message: '完整备份合并失败：' + (err.message || '未知错误'), type: 'error', duration: 3000 });
			}
		}
	},

	// ── 冷热分离：导出归档 / 完整备份 ──

	/** 导出归档对话（仅冷区） */
	async exportArchivedChats() {
		try {
			const archivedChats = await getAllArchivedChats();
			if (!archivedChats || archivedChats.length === 0) {
				this.$message({ message: '归档区没有对话可导出', type: 'warning', duration: 2000 });
				return;
			}
			const payload = {
				meta: {
					version: 1,
					exportedAt: new Date().toISOString(),
					type: 'archive',
					totalChats: archivedChats.length
				},
				chatHistory: archivedChats
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_archive_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: `已导出 ${archivedChats.length} 条归档对话`, type: 'success', duration: 2000 });
		} catch (error) {
			console.error('[AppCore] 导出归档对话失败', error);
			this.$message({ message: '导出归档失败', type: 'error', duration: 2000 });
		}
	},

	/** 导出完整备份（冷热分离） */
	async exportFullBackup() {
		try {
			const archivedChats = await getAllArchivedChats();
			const hotChats = Array.isArray(this.chatHistory) ? JSON.parse(JSON.stringify(this.chatHistory)) : [];
			const archiveIndex = Array.isArray(this.archiveIndex) ? JSON.parse(JSON.stringify(this.archiveIndex)) : [];
			const currentChatId = this.currentChatId || null;
			const totalCount = hotChats.length + (archivedChats ? archivedChats.length : 0);
			const payload = {
				meta: {
					version: 2,
					exportedAt: new Date().toISOString(),
					type: 'full_backup',
					totalChats: totalCount,
					hotCount: hotChats.length,
					archiveCount: archivedChats ? archivedChats.length : 0
				},
				hotChats,
				archivedChats: archivedChats || [],
				archiveIndex,
				currentChatId
			};
			const jsonData = await this.prepareExportContent(payload);
			if (jsonData === null) {
				return;
			}
			const blob = new Blob([jsonData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `chat_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			this.$message({ message: `完整备份已导出（热区 ${hotChats.length} 条 + 冷区 ${archivedChats ? archivedChats.length : 0} 条）`, type: 'success', duration: 2000 });
		} catch (error) {
			console.error('[AppCore] 完整备份导出失败', error);
			this.$message({ message: '完整备份导出失败', type: 'error', duration: 2000 });
		}
	}
};
