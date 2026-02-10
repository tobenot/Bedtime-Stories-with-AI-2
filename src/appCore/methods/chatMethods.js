import { pluginSystem } from '@/core/pluginSystem';
import { MAX_TITLE_LENGTH } from '@/config/constants.js';
import { createUuid, cloneMessagesWithNewIds, normalizeAndRepairChats, sortChatsByCreatedTime } from '@/utils/chatData';
import { createPasswordProof, verifyPasswordProof } from '@/utils/secureArchive.js';
import { generateUniqueBranchTitle } from '@/utils/archive.js';
import { loadChatStorageData, saveChatStorageData, saveCurrentChatIdStorageData, clearChatStorageData } from '@/utils/chatStorage';

export const chatMethods = {
	enqueueChatStorageTask(taskFactory) {
		if (!this._chatStorageQueue) {
			this._chatStorageQueue = Promise.resolve();
		}
		const nextTask = this._chatStorageQueue.then(() => taskFactory());
		this._chatStorageQueue = nextTask.catch(() => {});
		return nextTask;
	},
	persistCurrentChatId(chatId) {
		const normalizedChatId = chatId ? String(chatId) : null;
		this.enqueueChatStorageTask(() => saveCurrentChatIdStorageData(normalizedChatId))
			.catch((error) => {
				console.warn('[AppCore] 当前对话ID写入失败', {
					chatId: normalizedChatId,
					error: error?.message || String(error)
				});
			});
	},
	async tryPersistChatHistory(historyToSave) {
		const serialized = JSON.stringify(historyToSave);
		const currentChatIdToSave = this.currentChatId ? String(this.currentChatId) : null;
		await this.enqueueChatStorageTask(() => saveChatStorageData(serialized, currentChatIdToSave));
		return serialized.length;
	},
	notifyChatSaveFailure(error) {
		const errorText = error?.message || String(error) || '未知错误';
		const signature = `${error?.name || 'Error'}|${errorText}`;
		if (this._chatSaveFailureSignature === signature) {
			return;
		}
		this._chatSaveFailureSignature = signature;
		console.error('[AppCore] 对话保存失败', {
			error: errorText,
			chatId: this.currentChatId,
			chatCount: Array.isArray(this.chatHistory) ? this.chatHistory.length : 0
		});
		this.$message({
			message: `存档保存失败：${errorText}。请立即通过右上角设置按钮下方的"导出存档"功能备份数据，避免数据丢失。`,
			type: 'error',
			duration: 8000,
			showClose: true
		});
	},
	notifyChatSaveRecovered() {
		if (!this._chatSaveFailureSignature) {
			return;
		}
		console.log('[AppCore] 对话保存恢复正常');
		this._chatSaveFailureSignature = null;
		this.$message({
			message: '存档保存已恢复',
			type: 'success',
			duration: 2000
		});
	},
	createMessage(role, content, extra = {}) {
		const now = Date.now();
		return {
			id: createUuid(),
			role,
			content,
			createdAt: new Date(now).toISOString(),
			createdAtMs: now,
			...extra
		};
	},
	createChatRecord({ title = '新对话', messages = [], mode = this.activeMode } = {}) {
		const now = Date.now();
		return {
			id: createUuid(),
			title,
			isTitleManuallyEdited: false,
			messages,
			createdAt: new Date(now).toISOString(),
			createdAtMs: now,
			mode
		};
	},
	syncCurrentChatIdAfterRepair(savedCurrentChatId, idMap) {
		if (!this.chatHistory.length) {
			this.currentChatId = null;
			return;
		}
		const mappedCurrentId = savedCurrentChatId ? (idMap[String(savedCurrentChatId)] || String(savedCurrentChatId)) : null;
		const found = mappedCurrentId ? this.chatHistory.find(chat => chat.id === mappedCurrentId) : null;
		this.currentChatId = found ? found.id : this.chatHistory[0].id;
		this.persistCurrentChatId(this.currentChatId);
	},
	async loadChatHistory() {
		const storageData = await loadChatStorageData();
		const savedHistory = storageData.savedHistory;
		if (savedHistory) {
			try {
				const parsedHistory = JSON.parse(savedHistory);
				const savedCurrentChatId = storageData.savedCurrentChatId;
				const repaired = normalizeAndRepairChats(parsedHistory);
				this.chatHistory = repaired.chats;
				this.syncCurrentChatIdAfterRepair(savedCurrentChatId, repaired.idMap);
				console.log('[AppCore] 聊天历史加载完成', {
					source: storageData.source,
					chatCount: this.chatHistory.length
				});
				if (repaired.changed) {
					console.log('[AppCore] 对话数据自动修复完成', repaired.stats);
					this.saveChatHistory();
				}
				if (this.chatHistory.length > 0) {
					const currentChat = this.chatHistory.find(chat => chat.id === this.currentChatId);
					if (currentChat?.mode) {
						const resolvedMode = this.resolveAvailableMode(currentChat.mode);
						const modeChanged = currentChat.mode !== resolvedMode;
						this.activeMode = resolvedMode;
						if (modeChanged) {
							console.log('[AppCore] Chat mode unavailable, fallback to standard-chat:', currentChat.mode);
						}
						currentChat.mode = resolvedMode;
						pluginSystem.setActive(resolvedMode);
						if (modeChanged) {
							this.saveChatHistory();
						}
					} else {
						this.activeMode = 'standard-chat';
						pluginSystem.setActive('standard-chat');
					}
				}
			} catch (error) {
				console.error('[AppCore] 读取对话历史失败，已重置并创建新对话', error);
				await this.enqueueChatStorageTask(() => clearChatStorageData());
				this.chatHistory = [];
				this.currentChatId = null;
			}
		}
		if (!this.currentChatId) {
			this.createNewChat();
		}
	},
	createNewChat() {
		const newChat = this.createChatRecord({
			title: '新对话',
			messages: [],
			mode: this.activeMode
		});
		this.chatHistory.push(newChat);
		this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
		this.currentChatId = newChat.id;
		this.persistCurrentChatId(newChat.id);
		this.saveChatHistory();
		if (!this.isDesktop) this.showSidebar = false;
	},
	switchChat(chatId) {
		this.currentChatId = chatId;
		this.unlockPasswordInput = '';
		this.persistCurrentChatId(chatId);
		const chat = this.chatHistory.find(c => c.id === chatId);
		if (chat?.mode) {
			const resolvedMode = this.resolveAvailableMode(chat.mode);
			const modeChanged = chat.mode !== resolvedMode;
			this.activeMode = resolvedMode;
			if (modeChanged) {
				console.log('[AppCore] Switch chat mode unavailable, fallback to standard-chat:', chat.mode);
			}
			chat.mode = resolvedMode;
			pluginSystem.setActive(resolvedMode);
			if (modeChanged) {
				this.saveChatHistory();
			}
		} else {
			this.activeMode = 'standard-chat';
			pluginSystem.setActive('standard-chat');
		}
		if (!this.isDesktop) this.showSidebar = false;
	},
	deleteChat(chatId) {
		const index = this.chatHistory.findIndex(chat => chat.id === chatId);
		if (index !== -1) {
			this.chatHistory.splice(index, 1);
			if (this.verifiedProtectedChatId === chatId) {
				this.verifiedProtectedChatId = null;
			}
			this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
			if (this.chatHistory.length === 0) {
				this.createNewChat();
			} else if (this.currentChatId === chatId) {
				this.currentChatId = this.chatHistory[0].id;
				this.persistCurrentChatId(this.currentChatId);
			}
			this.saveChatHistory();
		}
	},
	isChatProtected(chat) {
		return Boolean(chat?.protection?.enabled);
	},
	async unlockCurrentChat() {
		try {
			const chat = this.currentChat;
			if (!chat || !this.isChatProtected(chat)) {
				console.warn('[AppCore] 无法解锁对话：当前对话未启用密码');
				this.$message({ message: '当前对话未启用密码', type: 'warning', duration: 2000 });
				return;
			}
			const input = typeof this.unlockPasswordInput === 'string' ? this.unlockPasswordInput.trim() : '';
			if (!input) {
				this.$message({ message: '请输入密码', type: 'warning', duration: 2000 });
				return;
			}
			const passed = await verifyPasswordProof(input, chat.protection);
			if (!passed) {
				console.warn('[AppCore] 对话解锁失败，校验不通过', { chatId: chat.id });
				this.$message({ message: '密码错误', type: 'error', duration: 2000 });
				return;
			}
			this.verifiedProtectedChatId = chat.id;
			this.unlockPasswordInput = '';
			console.log('[AppCore] 对话解锁成功', { chatId: chat.id });
			this.$message({ message: '对话已解锁', type: 'success', duration: 2000 });
		} catch (error) {
			console.error('[AppCore] 解锁对话时出错', error);
			this.$message({ message: '解锁失败：' + (error.message || '未知错误'), type: 'error', duration: 3000 });
		}
	},
	async removeChatProtection(chatId) {
		try {
			const chat = this.chatHistory.find(c => c.id === chatId);
			if (!chat) {
				console.warn('[AppCore] 无法取消对话密码：找不到对话', { chatId });
				this.$message({ message: '找不到指定的对话', type: 'error', duration: 2000 });
				return;
			}
			if (!this.isChatProtected(chat)) {
				this.$message({ message: '当前对话未设置密码', type: 'warning', duration: 2000 });
				return;
			}
			const removePassword = await this.promptPassword('移除对话密码', `请输入"${chat.title || '新对话'}"的当前密码`);
			if (removePassword === null) {
				return;
			}
			const passed = await verifyPasswordProof(removePassword, chat.protection);
			if (!passed) {
				console.warn('[AppCore] 移除对话密码失败，校验不通过', { chatId: chat.id });
				this.$message({ message: '密码错误，无法移除', type: 'error', duration: 2000 });
				return;
			}
			delete chat.protection;
			if (this.verifiedProtectedChatId === chat.id) {
				this.verifiedProtectedChatId = null;
			}
			this.unlockPasswordInput = '';
			this.saveChatHistory();
			console.log('[AppCore] 已移除对话密码', { chatId: chat.id });
			this.$message({ message: '已移除对话密码', type: 'success', duration: 2000 });
		} catch (error) {
			console.error('[AppCore] 移除对话密码时出错', error);
			this.$message({ message: '操作失败：' + (error.message || '未知错误'), type: 'error', duration: 3000 });
		}
	},
	async configureChatProtection(chatId) {
		try {
			const chat = this.chatHistory.find(c => c.id === chatId);
			if (!chat) {
				console.warn('[AppCore] 无法设置对话密码：找不到对话', { chatId });
				this.$message({ message: '找不到指定的对话', type: 'error', duration: 2000 });
				return;
			}
			if (!this.isChatProtected(chat)) {
				const password = await this.promptPassword('设置对话密码', `为"${chat.title || '新对话'}"设置密码`);
				if (password === null) {
					return;
				}
				chat.protection = {
					enabled: true,
					...(await createPasswordProof(password))
				};
				if (this.currentChatId === chat.id) {
					this.verifiedProtectedChatId = chat.id;
				}
				this.saveChatHistory();
				console.log('[AppCore] 已设置对话密码', { chatId: chat.id });
				this.$message({ message: '已设置对话密码', type: 'success', duration: 2000 });
				return;
			}
			this.$message({ message: '当前对话已设置密码，请使用“取消对话密码”', type: 'warning', duration: 2500 });
		} catch (error) {
			console.error('[AppCore] 设置对话密码时出错', error);
			this.$message({ message: '操作失败：' + (error.message || '未知错误'), type: 'error', duration: 3000 });
		}
	},
	async saveChatHistory() {
		this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
		try {
			await this.tryPersistChatHistory(this.chatHistory);
			this.notifyChatSaveRecovered();
		} catch (error) {
			this.notifyChatSaveFailure(error);
		}
	},
	changeChatTitle({ id, title }) {
		const chat = this.chatHistory.find(c => c.id === id);
		if (chat) {
			const hasTitleChanged = chat.title !== title;
			chat.title = title;
			if (hasTitleChanged) {
				chat.isTitleManuallyEdited = true;
				console.log('[AppCore] 对话标题已手动修改', { chatId: id, title });
			}
			this.saveChatHistory();
		}
	},
	async requestEditCurrentChatTitle() {
		if (!this.currentChat) {
			console.warn('[AppCore] 无法修改标题：当前没有选中对话');
			return;
		}
		const currentTitle = this.currentChat.title || '新对话';
		console.log('[AppCore] 触发快捷修改当前对话标题', { chatId: this.currentChat.id });
		try {
			const { value } = await this.$prompt('请输入新的对话标题', '修改对话标题', {
				confirmButtonText: '确定',
				cancelButtonText: '取消',
				inputValue: currentTitle,
				inputPlaceholder: '请输入标题',
				closeOnClickModal: false
			});
			const trimmedTitle = String(value || '').trim();
			if (!trimmedTitle) {
				this.$message({ message: '标题不能为空', type: 'warning', duration: 2000 });
				return;
			}
			const finalTitle = trimmedTitle.length > MAX_TITLE_LENGTH
				? trimmedTitle.slice(0, MAX_TITLE_LENGTH)
				: trimmedTitle;
			if (finalTitle === currentTitle) {
				return;
			}
			this.changeChatTitle({ id: this.currentChat.id, title: finalTitle });
		} catch (error) {
			if (error === 'cancel' || error === 'close') {
				console.log('[AppCore] 用户取消快捷修改对话标题', { chatId: this.currentChat.id });
				return;
			}
			console.error('[AppCore] 快捷修改对话标题失败', error);
			this.$message({ message: '修改标题失败', type: 'error', duration: 2000 });
		}
	},
	forkChatAt(index) {
		if (!this.currentChat) return;
		const messagesToKeep = this.currentChat.messages.slice(0, index + 1);
		const newChat = this.createChatRecord({
			title: this.generateBranchTitle(this.currentChat.title),
			messages: cloneMessagesWithNewIds(messagesToKeep),
			mode: this.currentChat.mode || this.activeMode
		});
		if (this.isChatProtected(this.currentChat)) {
			newChat.protection = { ...this.currentChat.protection };
			console.log('[AppCore] 分支对话继承密码保护', { sourceChatId: this.currentChat.id, branchChatId: newChat.id });
		}
		if (this.currentChat.isTitleManuallyEdited) {
			newChat.isTitleManuallyEdited = true;
			console.log('[AppCore] 分支对话继承标题手动编辑状态', { sourceChatId: this.currentChat.id, branchChatId: newChat.id });
		}
		this.chatHistory.push(newChat);
		this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
		this.currentChatId = newChat.id;
		this.persistCurrentChatId(newChat.id);
		this.saveChatHistory();
		this.$message({ message: '已从此处分叉对话', type: 'success', duration: 2000 });
	},
	generateBranchTitle(originalTitle) {
		return generateUniqueBranchTitle(originalTitle, true);
	},
	enableEditMessage(index) {
		this.editingMessage = {
			index: index,
			content: this.currentChat.messages[index].content
		};
		this.showEditDialog = true;
	},
	saveEditedMessageDialog(editedContent) {
		if (editedContent) {
			this.currentChat.messages[this.editingMessage.index].content = editedContent;
			this.saveChatHistory();
			this.$message({ message: '消息已更新', type: 'success', duration: 2000 });
			this.showEditDialog = false;
			this.editingMessage = { index: null, content: '' };
		}
	},
	confirmRegenerateMessage() {
		if (!this.currentChat || this.currentChat.messages.length === 0) return;
		const lastMessage = this.currentChat.messages[this.currentChat.messages.length - 1];
		if (lastMessage.role === 'assistant') {
			this.currentChat.messages.pop();
			this.saveChatHistory();
		}
		if (this.$refs.currentMode && this.$refs.currentMode.handleSend) {
			for (let i = this.currentChat.messages.length - 1; i >= 0; i--) {
				if (this.currentChat.messages[i].role === 'user') {
					this.$refs.currentMode.inputMessage = this.currentChat.messages[i].content;
					this.currentChat.messages.splice(i, 1);
					this.$refs.currentMode.handleSend();
					break;
				}
			}
		}
	},
	confirmDeleteMessage(index) {
		this.$confirm('确定删除这条消息吗？', '确认删除', {
			confirmButtonText: '删除',
			cancelButtonText: '取消',
			type: 'warning',
			closeOnClickModal: false
		}).then(() => {
			this.currentChat.messages.splice(index, 1);
			this.saveChatHistory();
			this.$message({ message: '消息已删除', type: 'success', duration: 2000 });
		}).catch(() => {});
	},
	toggleReasoning(index) {
		this.currentChat.messages[index].isReasoningCollapsed = !this.currentChat.messages[index].isReasoningCollapsed;
		this.saveChatHistory();
	},
	toggleMessageCollapse(index) {
		if (this.currentChat && this.currentChat.messages[index]) {
			this.currentChat.messages[index].isCollapsed = !this.currentChat.messages[index].isCollapsed;
			this.saveChatHistory();
		}
	}
};
