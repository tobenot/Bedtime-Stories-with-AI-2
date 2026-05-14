<template>
	<div class="game-mode">
		<aside class="game-panel" :class="{ 'panel-open': mobilePanelOpen }">
			<div class="panel-block">
				<div class="panel-title">机制包</div>
				<el-select
					v-model="activePackId"
					class="w-full"
					placeholder="选择机制包"
					:disabled="messages.length > 0"
					@change="handlePackChange"
				>
					<el-option-group label="内置">
						<el-option
							v-for="pack in builtinPacks"
							:key="pack.id"
							:label="pack.title"
							:value="pack.id"
						/>
					</el-option-group>
					<el-option-group v-if="customPacks.length" label="导入">
						<el-option
							v-for="pack in customPacks"
							:key="pack.id"
							:label="pack.title"
							:value="pack.id"
						/>
					</el-option-group>
				</el-select>
				<div class="panel-help">
					{{ currentPack?.description || '导入机制包后，状态、工具和触发器会按包声明显示。' }}
				</div>
				<div class="panel-actions">
					<el-button size="small" @click="openImportFile('merge')">导入包</el-button>
					<el-button size="small" @click="exportCurrentPack">导出当前包</el-button>
				</div>
				<input
					ref="importFile"
					type="file"
					accept=".json,application/json"
					style="display: none;"
					@change="handleImportFile"
				/>
			</div>

			<div class="panel-block">
				<div class="panel-title">状态</div>
				<template v-if="currentPack?.ui?.length">
					<div
						v-for="item in currentPack.ui"
						:key="`${item.type}-${item.path}`"
						class="state-item"
					>
						<div class="state-label">{{ item.label }}</div>
						<div v-if="item.type === 'stat'" class="state-stat">
							<div class="state-stat-text">{{ formatPathValue(item.path) }} / {{ formatPathValue(item.maxPath) }}</div>
							<div class="state-bar">
								<div class="state-bar-fill" :style="{ width: `${getStatPercent(item)}%` }"></div>
							</div>
						</div>
						<div v-else-if="item.type === 'list'" class="state-list">
							<template v-if="getListValue(item.path).length">
								<el-tag
									v-for="entry in getListValue(item.path)"
									:key="entry"
									size="small"
									effect="plain"
								>
									{{ entry }}
								</el-tag>
							</template>
							<span v-else class="state-empty">空</span>
						</div>
						<div v-else class="state-value">{{ formatPathValue(item.path) }}</div>
					</div>
				</template>
				<div v-else class="panel-help">当前机制包没有声明状态面板。</div>
			</div>

			<div class="panel-block">
				<div class="panel-title">包工具</div>
				<template v-if="manualTools.length">
					<el-button
						v-for="tool in manualTools"
						:key="tool.id"
						size="small"
						class="tool-button"
						@click="runManualTool(tool.id)"
					>
						{{ tool.label }}
					</el-button>
				</template>
				<div v-else class="panel-help">当前机制包没有声明可手动执行的工具。</div>
				<div class="panel-actions" style="margin-top: 0.5rem; border-top: 1px solid #f3f4f6; padding-top: 0.5rem;">
					<el-button
						size="small"
						:disabled="messages.length < 2 || isLoading"
						@click="undoLastTurn"
					>
						↩ 回退上一回合
					</el-button>
				</div>
			</div>

			<div class="panel-block">
				<div class="panel-title">运行日志</div>
				<div class="log-toolbar">
					<el-switch
						:model-value="logSettings.enabled"
						size="small"
						inline-prompt
						active-text="开"
						inactive-text="关"
						@change="value => updateLogSetting('enabled', value)"
					/>
					<el-select
						v-model="logFilterLevel"
						size="small"
						class="log-level-select"
					>
						<el-option label="全部" value="all" />
						<el-option label="Debug+" value="debug" />
						<el-option label="Info+" value="info" />
						<el-option label="Warn+" value="warn" />
						<el-option label="Error" value="error" />
					</el-select>
				</div>
				<div class="log-toolbar">
					<el-switch
						:model-value="logSettings.consoleMirror"
						size="small"
						active-text="Console"
						@change="value => updateLogSetting('consoleMirror', value)"
					/>
					<el-button size="small" text @click="clearGameLogs">清空</el-button>
				</div>
				<div class="panel-help">共 {{ gameLogs.length }} 条，当前显示 {{ filteredGameLogs.length }} 条。</div>
				<div v-if="filteredGameLogs.length" class="log-list">
					<div v-for="entry in filteredGameLogs" :key="entry.id" class="log-item">
						<div class="log-item-head">
							<el-tag size="small" :type="getLogType(entry.level)">{{ String(entry.level || 'debug').toUpperCase() }}</el-tag>
							<span class="log-time">{{ formatLogTime(entry.time) }}</span>
						</div>
						<div class="log-summary">{{ entry.summary || entry.event || '运行日志' }}</div>
						<details v-if="entry.detail" class="log-detail">
							<summary>详情</summary>
							<pre>{{ formatLogDetail(entry.detail) }}</pre>
						</details>
					</div>
				</div>
				<div v-else class="panel-help">暂无符合筛选条件的日志。</div>
			</div>
		</aside>

		<!-- 移动端遮罩 -->
		<div
			v-if="mobilePanelOpen"
			class="mobile-overlay"
			@click="mobilePanelOpen = false"
		></div>

		<div class="game-chat">
			<!-- 移动端顶部状态摘要条 -->
			<div class="mobile-status-bar" @click="mobilePanelOpen = !mobilePanelOpen">
				<div class="status-bar-content">
					<div class="status-bar-header">
						<span class="status-bar-pack">{{ currentPack?.title || '未选择' }}</span>
						<span class="status-bar-toggle" :class="{ 'toggle-open': mobilePanelOpen }">▼</span>
					</div>
					<div v-if="statusBarItems.length" class="status-bar-items">
						<span
							v-for="item in statusBarItems"
							:key="item.path"
							class="status-bar-item"
							:class="{ 'status-bar-item--stat': item.type === 'stat' }"
						>
							<span class="status-bar-item-label">{{ item.label }}</span>
							<span class="status-bar-item-value">{{ item.value }}</span>
						</span>
					</div>
				</div>
			</div>

			<el-main ref="container" class="message-list" @scroll="handleScroll">
				<template v-if="!hasValidAuth && !messages.length">
					<el-alert type="info" :closable="false" show-icon>
						<template #title>
							<div class="text-lg font-semibold text-primary">
								{{ isBackendProxy ? '当前是后端代理模式，需要配置连接信息' : '请先设置 API Key' }}
							</div>
						</template>
						<template #default>
							<div class="text-base text-customGray">
								点击右上角
								<el-button type="link" class="inline-block text-blue-500 p-0" @click="$emit('open-settings')">
									设置
								</el-button>
								配置接入信息。
							</div>
						</template>
					</el-alert>
				</template>

				<EmptyState
					v-else-if="!messages.length"
					title="开始文本游戏"
					:description="emptyDescription"
				>
					<template #actions>
						<el-button class="btn-small" @click="insertOpeningMessage">使用机制包开场</el-button>
						<el-button class="btn-small ml-2" @click="$emit('focus-input')">手动输入</el-button>
					</template>
				</EmptyState>

				<template v-else>
					<div
						v-for="(msg, index) in messages"
						:key="msg.id || index"
						class="mb-6 flex flex-col"
						:class="msg.role === 'user' ? 'items-end' : 'items-start'"
					>
						<MessageBubble
							:role="msg.role"
							:content="msg.content"
							:reasoning-content="msg.reasoning_content"
							:is-reasoning-collapsed="msg.isReasoningCollapsed"
							:is-collapsed="msg.isCollapsed"
						>
							<template #controls="{ message }">
								<MessageControls
									:message="message"
									:index="index"
									:is-last="index === messages.length - 1"
									:is-typing="isTyping"
									@copy="$emit('copy-message', message.content)"
									@edit="$emit('edit-message', index)"
									@regenerate="$emit('regenerate-message')"
									@delete="$emit('delete-message', index)"
									@toggle-reasoning="$emit('toggle-reasoning', index)"
									@fork="$emit('fork-chat', index)"
									@toggle-collapse="toggleMessageCollapse(index)"
								/>
							</template>
						</MessageBubble>
					</div>

					<div v-if="isTyping" class="message-bubble assistant-message">
						<div class="typing-loading-block">
							<div class="typing-indicator">
								<div class="dot" style="animation-delay: 0s"></div>
								<div class="dot" style="animation-delay: 0.2s"></div>
								<div class="dot" style="animation-delay: 0.4s"></div>
							</div>
							<transition name="loading-msg-fade">
								<div v-if="currentLoadingMessage" :key="currentLoadingMessage" class="typing-loading-message">
									{{ currentLoadingMessage }}
								</div>
							</transition>
						</div>
					</div>
				</template>
			</el-main>

			<ChatInput
				v-model="inputMessage"
				:disabled="!hasValidAuth"
				:is-loading="isLoading"
				:error-message="errorMessage"
				placeholder="输入你的行动..."
				@send="handleSend"
				@cancel="handleCancel"
				ref="inputRef"
			/>
		</div>
	</div>
</template>

<script>
import { ElMessage } from 'element-plus';
import MessageBubble from '@/shared/components/MessageBubble.vue';
import ChatInput from '@/shared/components/ChatInput.vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import MessageControls from '@/modes/StandardChatMode/components/MessageControls.vue';
import { callAiModel } from '@/core/services/aiService';
import { createUuid } from '@/utils/chatData';
import {
	getAllGamePacks,
	getGamePackById,
	importGamePacks,
	loadActiveGamePackId,
	saveActiveGamePackId
} from '@/gamePacks';
import {
	applyStatePatch,
	buildGameAssistantContent,
	buildGamePrefixMessage,
	buildGameTurnSuffixMessage,
	createDefaultGameState,
	createStateSnapshot,
	executeGameTool,
	findLatestSnapshot,
	formatToolResults,
	getByPath,
	incrementTurn,
	restoreStateFromSnapshot,
	runGameTriggers,
	safeParseGameResponse
} from '@/utils/gamePackRuntime';

export default {
	name: 'GameMode',
	components: {
		MessageBubble,
		ChatInput,
		EmptyState,
		MessageControls
	},
	props: {
		config: {
			type: Object,
			default: () => ({})
		},
		chat: {
			type: Object,
			default: null
		}
	},
	emits: [
		'open-settings',
		'focus-input',
		'copy-message',
		'edit-message',
		'regenerate-message',
		'delete-message',
		'toggle-reasoning',
		'update-chat',
		'scroll-bottom-changed',
		'scroll-progress',
		'fork-chat'
	],
	data() {
		return {
			inputMessage: '',
			isLoading: false,
			isTyping: false,
			errorMessage: '',
			abortController: null,
			isAtBottom: true,
			activePackId: loadActiveGamePackId(),
			packRevision: 0,
			importMode: 'merge',
			mobilePanelOpen: false,
			logFilterLevel: 'all',
			currentLoadingMessage: '',
			loadingMessageTimer: null
		};
	},
	computed: {
		apiKey() {
			return this.config.apiKey || '';
		},
		isBackendProxy() {
			return this.config.isBackendProxy || false;
		},
		hasValidAuth() {
			return this.isBackendProxy || !!this.apiKey;
		},
		messages() {
			return this.chat?.messages || [];
		},
		allPacks() {
			this.packRevision;
			return getAllGamePacks();
		},
		builtinPacks() {
			return this.allPacks.filter(pack => pack.source === 'builtin');
		},
		customPacks() {
			return this.allPacks.filter(pack => pack.source === 'custom');
		},
		currentPack() {
			this.packRevision;
			return getGamePackById(this.activePackId) || this.allPacks[0] || null;
		},
		manualTools() {
			return (this.currentPack?.tools || []).filter(tool => (tool.visibility || []).includes('manual'));
		},
		gameData() {
			return this.chat?.metadata?.gameMode || {};
		},
		gameState() {
			return this.gameData.state || {};
		},
		logSettings() {
			const settings = this.gameData.logSettings || {};
			return {
				enabled: settings.enabled !== false,
				consoleMirror: Boolean(settings.consoleMirror),
				minLevel: settings.minLevel || 'debug',
				maxEntries: Number(settings.maxEntries || 300)
			};
		},
		gameLogs() {
			return Array.isArray(this.gameData.logs) ? this.gameData.logs : [];
		},
		filteredGameLogs() {
			const order = { debug: 0, info: 1, warn: 2, error: 3 };
			const minByFilter = this.logFilterLevel === 'all' ? -1 : (order[this.logFilterLevel] ?? -1);
			const list = this.gameLogs.filter(item => {
				const level = order[item?.level] ?? 0;
				return level >= minByFilter;
			});
			return [...list].reverse().slice(0, 120);
		},
		emptyDescription() {
			const packName = this.currentPack?.title || '未选择机制包';
			return `当前机制包：${packName}。机制包决定状态面板、工具和触发器。`;
		},
		statusBarItems() {
			const pack = this.currentPack;
			if (!pack) return [];
			// 优先使用机制包声明的 mobileStatusBar
			const barDef = pack.mobileStatusBar;
			if (Array.isArray(barDef) && barDef.length) {
				return barDef.map(item => {
					let value;
					if (item.type === 'stat') {
						const cur = getByPath(this.gameState, item.path, 0);
						const max = getByPath(this.gameState, item.maxPath, 0);
						value = `${cur}/${max}`;
					} else if (item.type === 'list') {
						const list = getByPath(this.gameState, item.path, []);
						value = Array.isArray(list) ? (list.length ? list.join('、') : '空') : String(list);
					} else {
						value = this.formatPathValue(item.path);
					}
					return { path: item.path, label: item.label, value, type: item.type || 'text' };
				});
			}
			// 回退：从 ui 中取 stat 和 text 类型，最多 4 个
			if (!pack.ui?.length) return [];
			return pack.ui
				.filter(item => item.type === 'stat' || item.type === 'text')
				.slice(0, 4)
				.map(item => {
					let value;
					if (item.type === 'stat') {
						const cur = getByPath(this.gameState, item.path, 0);
						const max = getByPath(this.gameState, item.maxPath, 0);
						value = `${cur}/${max}`;
					} else {
						value = this.formatPathValue(item.path);
					}
					return { path: item.path, label: item.label, value, type: item.type || 'text' };
				});
		}
	},
	watch: {
		chat: {
			handler() {
				this.syncPackFromChat();
			},
			immediate: true
		},
		isTyping(newVal) {
			if (newVal) {
				this.startLoadingMessages();
			} else {
				this.stopLoadingMessages();
			}
		}
	},
	mounted() {
		this.ensureGameMetadata();
	},
	beforeUnmount() {
		this.stopLoadingMessages();
	},
	methods: {
		startLoadingMessages() {
			this.stopLoadingMessages();
			const msgs = this.currentPack?.loadingMessages;
			if (!msgs || !msgs.length) {
				this.currentLoadingMessage = '';
				return;
			}
			// 立即显示随机一条
			this.currentLoadingMessage = msgs[Math.floor(Math.random() * msgs.length)];
			// 每 4 秒换一条（避开当前这条）
			this.loadingMessageTimer = setInterval(() => {
				if (msgs.length <= 1) return;
				let next;
				do {
					next = msgs[Math.floor(Math.random() * msgs.length)];
				} while (next === this.currentLoadingMessage && msgs.length > 1);
				this.currentLoadingMessage = next;
			}, 4000);
		},
		stopLoadingMessages() {
			if (this.loadingMessageTimer) {
				clearInterval(this.loadingMessageTimer);
				this.loadingMessageTimer = null;
			}
			this.currentLoadingMessage = '';
		},
		createMessage(role, content, extra = {}) {
			return {
				id: createUuid(),
				role,
				content,
				createdAt: new Date().toISOString(),
				createdAtMs: Date.now(),
				...extra
			};
		},
		updateLogSetting(key, value) {
			this.ensureGameMetadata();
			if (!this.gameData.logSettings || typeof this.gameData.logSettings !== 'object') {
				this.gameData.logSettings = {};
			}
			this.gameData.logSettings[key] = value;
			this.$emit('update-chat');
		},
		clearGameLogs() {
			this.ensureGameMetadata();
			this.gameData.logs = [];
			this.$emit('update-chat');
		},
		pushGameLog(level, event, summary, detail = {}, options = {}) {
			this.ensureGameMetadata();
			const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
			const currentLevel = String(level || 'debug');
			const minLevel = this.logSettings.minLevel || 'debug';
			if ((levelOrder[currentLevel] ?? 0) < (levelOrder[minLevel] ?? 0)) return;
			if (this.logSettings.enabled === false && !options.force) return;
			if (!Array.isArray(this.gameData.logs)) this.gameData.logs = [];
			const maxEntries = Math.max(50, Number(this.logSettings.maxEntries || 300));
			const entry = {
				id: createUuid(),
				time: new Date().toISOString(),
				turn: Number(getByPath(this.gameState, this.currentPack?.turnPath || 'world.turn', 0)) || 0,
				level: currentLevel,
				event: event || 'runtime.event',
				summary: summary || '',
				detail: detail && typeof detail === 'object' ? JSON.parse(JSON.stringify(detail)) : detail
			};
			this.gameData.logs.push(entry);
			if (this.gameData.logs.length > maxEntries) {
				this.gameData.logs.splice(0, this.gameData.logs.length - maxEntries);
			}
			if (this.logSettings.consoleMirror) {
				const prefix = `[GameMode:${entry.level}] ${entry.event}`;
				if (entry.level === 'error') console.error(prefix, entry.summary, entry.detail);
				else if (entry.level === 'warn') console.warn(prefix, entry.summary, entry.detail);
				else if (entry.level === 'info') console.info(prefix, entry.summary, entry.detail);
				else console.log(prefix, entry.summary, entry.detail);
			}
			if (!options.silent) this.$emit('update-chat');
		},
		getRuntimeLogger(source = 'runtime') {
			return ({ level = 'debug', event = 'runtime.event', summary = '', detail = {} } = {}) => {
				this.pushGameLog(level, event, summary, { source, ...detail }, { silent: true });
			};
		},
		getLogType(level) {
			if (level === 'error') return 'danger';
			if (level === 'warn') return 'warning';
			if (level === 'info') return 'success';
			return 'info';
		},
		formatLogTime(isoString) {
			if (!isoString) return '--:--:--';
			const date = new Date(isoString);
			if (Number.isNaN(date.getTime())) return '--:--:--';
			return date.toLocaleTimeString('zh-CN', { hour12: false });
		},
		formatLogDetail(detail) {
			if (detail === undefined || detail === null) return '';
			if (typeof detail === 'string') return detail;
			try {
				return JSON.stringify(detail, null, 2);
			} catch {
				return String(detail);
			}
		},
		syncPackFromChat() {
			const packId = this.chat?.metadata?.gameMode?.packId;
			if (packId && getGamePackById(packId)) {
				this.activePackId = packId;
				saveActiveGamePackId(packId);
			}
			this.ensureGameMetadata();
		},
		ensureGameMetadata(force = false) {
			if (!this.chat) return;
			if (!this.chat.metadata) {
				this.chat.metadata = {};
			}
			const pack = this.currentPack;
			if (!pack) return;
			const existing = this.chat.metadata.gameMode;
			if (!existing || force) {
				this.chat.metadata.gameMode = {
					packId: pack.id,
					state: createDefaultGameState(pack),
					triggerState: {},
					randomState: {},
					logs: [],
					logSettings: {
						enabled: true,
						consoleMirror: false,
						minLevel: 'debug',
						maxEntries: 300
					}
				};
				this.$emit('update-chat');
				return;
			}
			let changed = false;
			if (!existing.state) {
				existing.state = createDefaultGameState(pack);
				changed = true;
			}
			if (!existing.triggerState) {
				existing.triggerState = {};
				changed = true;
			}
			if (!existing.randomState) {
				existing.randomState = {};
				changed = true;
			}
			if (!Array.isArray(existing.logs)) {
				existing.logs = [];
				changed = true;
			}
			if (!existing.logSettings || typeof existing.logSettings !== 'object') {
				existing.logSettings = {};
				changed = true;
			}
			if (existing.logSettings.enabled === undefined) {
				existing.logSettings.enabled = true;
				changed = true;
			}
			if (existing.logSettings.consoleMirror === undefined) {
				existing.logSettings.consoleMirror = false;
				changed = true;
			}
			if (!existing.logSettings.minLevel) {
				existing.logSettings.minLevel = 'debug';
				changed = true;
			}
			if (!existing.logSettings.maxEntries) {
				existing.logSettings.maxEntries = 300;
				changed = true;
			}
			if (!existing.packId) {
				existing.packId = pack.id;
				changed = true;
			}
			if (changed) {
				this.$emit('update-chat');
			}
		},
		handlePackChange(packId) {
			if (this.messages.length > 0) {
				ElMessage.warning('当前对话已有消息，请新建对话后切换机制包');
				this.activePackId = this.gameData.packId || loadActiveGamePackId();
				this.pushGameLog('warn', 'pack.change.blocked', '已有消息，阻止切换机制包', { targetPackId: packId });
				return;
			}
			saveActiveGamePackId(packId);
			this.ensureGameMetadata(true);
			this.pushGameLog('info', 'pack.change', `已切换机制包：${packId}`, { packId });
			ElMessage.success('机制包已切换');
		},
		insertOpeningMessage() {
			this.ensureGameMetadata();
			if (!this.currentPack?.openingMessage) {
				ElMessage.info('当前机制包没有开场文本');
				return;
			}
			this.chat.messages.push(this.createMessage('assistant', this.currentPack.openingMessage, {
				metadata: {
					gameEvent: {
						type: 'opening',
						packId: this.currentPack.id,
						stateSnapshot: createStateSnapshot(this.gameData)
					}
				}
			}));
			this.$emit('update-chat');
			this.scrollToBottom();
		},
		openImportFile(mode) {
			this.importMode = mode;
			this.$refs.importFile?.click();
		},
		handleImportFile(event) {
			const file = event.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const parsed = JSON.parse(e.target.result);
					const packs = importGamePacks(parsed, this.importMode);
					this.packRevision += 1;
					if (packs.length > 0) {
						if (!this.messages.length) {
							this.activePackId = packs[packs.length - 1].id;
							saveActiveGamePackId(this.activePackId);
							this.ensureGameMetadata(true);
						} else {
							this.activePackId = this.gameData.packId || this.activePackId;
						}
						ElMessage.success(`已导入 ${packs.length} 个机制包`);
					}
				} catch (error) {
					ElMessage.error(`机制包导入失败：${error.message || '格式错误'}`);
				}
			};
			reader.readAsText(file);
			event.target.value = '';
		},
		exportCurrentPack() {
			if (!this.currentPack) return;
			const data = JSON.stringify(this.currentPack, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `game_pack_${this.currentPack.id}.json`;
			a.click();
			URL.revokeObjectURL(url);
		},
		formatPathValue(path) {
			return this.formatValue(getByPath(this.gameState, path, ''));
		},
		formatValue(value) {
			if (Array.isArray(value)) return value.length ? value.join('、') : '空';
			if (value && typeof value === 'object') return JSON.stringify(value);
			if (value === undefined || value === null || value === '') return '空';
			return String(value);
		},
		getListValue(path) {
			const value = getByPath(this.gameState, path, []);
			if (Array.isArray(value)) return value.map(item => this.formatValue(item));
			if (value === undefined || value === null || value === '') return [];
			return [this.formatValue(value)];
		},
		getStatPercent(item) {
			const current = Number(getByPath(this.gameState, item.path, 0)) || 0;
			const max = Number(getByPath(this.gameState, item.maxPath, 0)) || 0;
			if (max <= 0) return 0;
			return Math.min(100, Math.max(0, (current / max) * 100));
		},
		runManualTool(toolId) {
			this.ensureGameMetadata();
			this.pushGameLog('info', 'tool.manual.request', `手动执行工具：${toolId}`, { toolId });
			const result = executeGameTool({
				pack: this.currentPack,
				state: this.gameState,
				logger: this.getRuntimeLogger('manualTool'),
				request: {
					requestId: createUuid(),
					source: 'manual',
					toolId,
					reason: '玩家手动执行',
					input: {}
				}
			});
			const content = formatToolResults([{ label: result.label, result }]);
			this.chat.messages.push(this.createMessage('assistant', content, {
				metadata: {
					gameEvent: {
						phase: 'manual',
						type: 'manualTool',
						toolId,
						ok: result.ok,
						toolResults: [result],
						stateChanges: result.changes || [],
						stateSnapshot: createStateSnapshot(this.gameData)
					}
				}
			}));
			this.pushGameLog(result.ok ? 'info' : 'warn', 'tool.manual.done', `${toolId} 执行${result.ok ? '成功' : '失败'}`, {
				toolId,
				ok: result.ok,
				changes: result.changes || [],
				error: result.error || null
			});
			this.$emit('update-chat');
			this.scrollToBottom();
		},
		async handleSend() {
			if (!this.inputMessage.trim() || this.isLoading) return;
			this.ensureGameMetadata();
			const pack = this.currentPack;
			if (!pack) {
				this.errorMessage = '请先选择机制包';
				this.pushGameLog('error', 'turn.start.failed', '回合启动失败：未选择机制包');
				return;
			}

			const userInput = this.inputMessage.trim();
			this.pushGameLog('info', 'turn.start', '玩家发起新回合', {
				packId: pack.id,
				playerInput: userInput
			});
			const userMessage = this.createMessage('user', userInput);
			this.chat.messages.push(userMessage);
			this.inputMessage = '';
			this.isLoading = true;
			this.isTyping = true;
			this.errorMessage = '';
			this.$emit('update-chat');

			const state = this.gameState;
			const turn = incrementTurn(state, pack);
			const triggerState = this.gameData.triggerState || {};
			this.gameData.triggerState = triggerState;
			const triggerResults = runGameTriggers(pack, state, triggerState);

			const assistantMessage = this.createMessage('assistant', '');
			this.chat.messages.push(assistantMessage);
			this.$emit('update-chat');

			try {
				this.abortController = new AbortController();
				const maxToolRounds = 3;
				const maxToolCalls = 8;
				const toolResults = [];
				const aiResponses = [];
				let parsed = null;
				let rawContent = '';
				let forceFinal = false;

				for (let round = 0; round < maxToolRounds; round += 1) {
					const result = await this.callGameAi(pack, state, triggerResults, toolResults, forceFinal);
					rawContent = result?.content || '';
					const currentParsed = safeParseGameResponse(rawContent);
					aiResponses.push(currentParsed || { phase: 'plain', content: rawContent });
					if (!currentParsed) {
						parsed = null;
						break;
					}

					const requests = Array.isArray(currentParsed.toolRequests) ? currentParsed.toolRequests : [];
					const phase = currentParsed.phase || (requests.length && !currentParsed.narration ? 'tool_request' : 'final');
					if (phase === 'tool_request' && requests.length && !forceFinal) {
						const remainingCalls = maxToolCalls - toolResults.length;
						if (remainingCalls <= 0 || round >= maxToolRounds - 1) {
							forceFinal = true;
							continue;
						}
						toolResults.push(...this.runRequestedTools(requests.slice(0, remainingCalls)));
						forceFinal = toolResults.length >= maxToolCalls || round + 1 >= maxToolRounds - 1;
						continue;
					}

					parsed = { ...currentParsed, phase: 'final' };
					break;
				}

				if (!parsed) {
					assistantMessage.content = rawContent || '主持人没有返回内容。';
					assistantMessage.metadata = {
						gameEvent: {
							phase: 'plain',
							type: 'plainResponse',
							turn,
							triggerResults,
							toolResults,
							aiResponses,
							stateSnapshot: createStateSnapshot(this.gameData)
						}
					};
				} else {
					const patchChanges = applyStatePatch(state, parsed.statePatch || {}, { source: 'ai:final' });
					const triggerChanges = triggerResults.flatMap(item => item.result?.changes || []);
					const toolChanges = toolResults.flatMap(item => item.changes || []);
					const changes = [...triggerChanges, ...toolChanges, ...patchChanges];
					assistantMessage.content = buildGameAssistantContent({
						narration: parsed.narration || '',
						choices: parsed.choices || [],
						toolResults: [...triggerResults, ...toolResults],
						changes,
						toolResultVisibility: pack.toolResultVisibility || 'visible'
					});
					assistantMessage.metadata = {
						gameEvent: {
							phase: 'final',
							type: 'gameResponse',
							turn,
							response: parsed,
							toolRequests: aiResponses.flatMap(response => response.toolRequests || []),
							toolResults,
							triggerResults,
							stateChanges: changes,
							changes,
							choices: parsed.choices || [],
							aiResponses,
							stateSnapshot: createStateSnapshot(this.gameData)
						}
					};
				}
				this.chat.messages = [...this.chat.messages];
				this.$emit('update-chat');
				if (this.chat.messages.length <= 3 && this.chat.title === '新对话') {
					this.chat.title = userInput.substring(0, 20) + (userInput.length > 20 ? '...' : '');
					this.$emit('update-chat');
				}
			} catch (error) {
				const isAbort = error?.name === 'AbortError';
				assistantMessage.content = isAbort ? '已取消，未生成更多内容。' : '主持人回复中断，未生成更多内容。';
				this.errorMessage = isAbort ? '已取消' : (error.message || '发送失败，请重试');
				this.inputMessage = userInput;
				this.chat.messages = [...this.chat.messages];
				this.pushGameLog(isAbort ? 'warn' : 'error', 'turn.error', isAbort ? '回合被取消' : '回合执行异常', {
					error: error?.message || String(error),
					aborted: isAbort
				});
				this.$emit('update-chat');
			} finally {
				this.isLoading = false;
				this.isTyping = false;
				this.abortController = null;
				this.scrollToBottom();
			}
		},
		async callGameAi(pack, state, triggerResults, toolResults, forceFinal = false, playerInput = '') {
			if (!this.abortController) {
				throw new DOMException('Request was aborted', 'AbortError');
			}
			const baseHistory = this.chat.messages.slice(0, -1)
				.filter(message => message.content)
				.map(message => ({
					role: message.role,
					content: message.content
				}));
			const lastUserIndex = [...baseHistory].reverse().findIndex(message => message.role === 'user');
			const currentUserIndex = lastUserIndex < 0 ? -1 : baseHistory.length - 1 - lastUserIndex;
			const historyWithoutCurrentInput = currentUserIndex >= 0 ? baseHistory.slice(0, currentUserIndex) : baseHistory;
			const currentInputText = playerInput || (currentUserIndex >= 0 ? baseHistory[currentUserIndex]?.content : '');

			const prefixMessage = buildGamePrefixMessage(pack);
			const suffixMessage = buildGameTurnSuffixMessage({
				state,
				triggerResults,
				toolResults,
				forceFinal,
				playerInput: currentInputText
			});
			this.pushGameLog('debug', 'prompt.suffix', '已组合提示词后缀', {
				suffix: suffixMessage,
				forceFinal,
				triggerCount: Array.isArray(triggerResults) ? triggerResults.length : 0,
				toolCount: Array.isArray(toolResults) ? toolResults.length : 0
			}, { silent: true });
			const messagesForAi = [
				{
					role: 'user',
					content: prefixMessage
				},
				...historyWithoutCurrentInput,
				{
					role: 'user',
					content: suffixMessage
				}
			];
			return callAiModel({
				provider: this.config.provider,
				apiUrl: this.config.apiUrl,
				apiKey: this.config.apiKey,
				model: this.config.model,
				messages: messagesForAi,
				temperature: this.config.temperature,
				maxTokens: this.config.maxTokens,
				signal: this.abortController.signal,
				featurePassword: this.config.featurePassword,
				isBackendProxy: this.isBackendProxy,
				geminiReasoningEffort: this.config.geminiReasoningEffort,
				stream: false
			});
		},
		runRequestedTools(requests) {
			const results = [];
			for (const request of Array.isArray(requests) ? requests : []) {
				const toolId = request?.toolId || request?.tool;
				this.pushGameLog('debug', 'tool.ai.request', `AI 请求工具：${toolId}`, {
					toolId,
					reason: request?.reason || '',
					input: request?.input || {}
				}, { silent: true });
				const result = executeGameTool({
					pack: this.currentPack,
					state: this.gameState,
					logger: this.getRuntimeLogger('aiTool'),
					request: {
						requestId: request?.requestId || createUuid(),
						source: 'ai',
						toolId,
						reason: request?.reason || '',
						input: request?.input || {}
					}
				});
				results.push({
					...result,
					label: request?.reason ? `${result.label}（${request.reason}）` : result.label
				});
			}
			return results;
		},
		handleCancel() {
			if (this.abortController) {
				this.abortController.abort();
			}
		},
		focus() {
			this.$refs.inputRef?.focus();
		},
		handleScroll() {
			this.emitScrollState();
		},
		emitScrollState() {
			let container = this.$refs.container;
			if (container && container.$el) container = container.$el;
			if (!container) return;
			const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
			this.isAtBottom = distanceFromBottom <= 50;
			this.$emit('scroll-bottom-changed', distanceFromBottom > 150);
			const maxScroll = container.scrollHeight - container.clientHeight;
			const percent = maxScroll > 0 ? (container.scrollTop / maxScroll) * 100 : 0;
			this.$emit('scroll-progress', Math.min(Math.max(percent, 0), 100));
		},
		scrollToBottom() {
			this.$nextTick(() => {
				let container = this.$refs.container;
				if (container && container.$el) container = container.$el;
				if (!container) return;
				container.scrollTop = container.scrollHeight;
				this.emitScrollState();
			});
		},
		scrollToBottomManual() {
			let container = this.$refs.container;
			if (container && container.$el) container = container.$el;
			if (!container) return;
			container.scrollTop = container.scrollHeight;
			this.emitScrollState();
		},
		getScrollStats() {
			let container = this.$refs.container;
			if (container && container.$el) container = container.$el;
			if (!container) return { percent: 0 };
			const maxScroll = container.scrollHeight - container.clientHeight;
			const percent = maxScroll > 0 ? (container.scrollTop / maxScroll) * 100 : 0;
			return { percent: Math.min(Math.max(percent, 0), 100) };
		},
		toggleMessageCollapse(index) {
			if (!this.messages[index]) return;
			this.messages[index].isCollapsed = !this.messages[index].isCollapsed;
			this.$emit('update-chat');
		},
		undoLastTurn() {
			if (!this.chat || this.isLoading) return;
			const msgs = this.chat.messages;
			if (msgs.length < 2) {
				ElMessage.warning('没有可以回退的回合');
				return;
			}

			// 找到最后一条 assistant 消息的索引
			let lastAssistantIdx = -1;
			for (let i = msgs.length - 1; i >= 0; i -= 1) {
				if (msgs[i].role === 'assistant') {
					lastAssistantIdx = i;
					break;
				}
			}
			if (lastAssistantIdx < 0) {
				ElMessage.warning('没有可以回退的回合');
				return;
			}

			// 需要恢复到 lastAssistantIdx 之前的最近快照
			const found = findLatestSnapshot(msgs, lastAssistantIdx - 1);
			if (found) {
				restoreStateFromSnapshot(this.gameData, found.snapshot);
				this.pushGameLog('info', 'state.undo', `回退状态到消息 #${found.index}`, {
					restoredFromIndex: found.index
				}, { silent: true });
			} else {
				// 没有历史快照，回退到 initialState
				const pack = this.currentPack;
				if (pack) {
					this.gameData.state = createDefaultGameState(pack);
					this.gameData.triggerState = {};
					this.pushGameLog('warn', 'state.undo.fallback', '无历史快照，已回退到初始状态', {}, { silent: true });
				}
			}

			// 删除从 lastAssistantIdx 开始到末尾的所有消息（包含其前面紧邻的 user 消息）
			let removeFrom = lastAssistantIdx;
			if (removeFrom > 0 && msgs[removeFrom - 1]?.role === 'user') {
				removeFrom -= 1;
			}
			msgs.splice(removeFrom);
			this.chat.messages = [...msgs];
			this.$emit('update-chat');
			ElMessage.success('已回退到上一回合');
			this.scrollToBottom();
		}
	}
};
</script>

<style scoped>
.game-mode {
	display: flex;
	height: 100%;
	overflow: hidden;
	background: #f9fafb;
}

.game-panel {
	width: 18rem;
	flex-shrink: 0;
	overflow-y: auto;
	border-right: 1px solid #e5e7eb;
	background: #ffffff;
	padding: 0.75rem;
}

.panel-block {
	border: 1px solid #e5e7eb;
	border-radius: 0.75rem;
	background: #ffffff;
	padding: 0.75rem;
	margin-bottom: 0.75rem;
}

.panel-title {
	font-size: 0.95rem;
	font-weight: 600;
	color: #111827;
	margin-bottom: 0.5rem;
}

.panel-help {
	font-size: 0.8rem;
	color: #6b7280;
	line-height: 1.5;
	margin-top: 0.5rem;
}

.panel-actions {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
	margin-top: 0.75rem;
}

.state-item {
	padding: 0.5rem 0;
	border-bottom: 1px solid #f3f4f6;
}

.state-item:last-child {
	border-bottom: none;
}

.state-label {
	font-size: 0.8rem;
	color: #6b7280;
	margin-bottom: 0.25rem;
}

.state-value,
.state-stat-text {
	font-size: 0.92rem;
	color: #111827;
	word-break: break-word;
}

.state-bar {
	width: 100%;
	height: 0.45rem;
	background: #e5e7eb;
	border-radius: 999px;
	overflow: hidden;
	margin-top: 0.3rem;
}

.state-bar-fill {
	height: 100%;
	background: #2563eb;
	border-radius: 999px;
}

.state-list {
	display: flex;
	gap: 0.35rem;
	flex-wrap: wrap;
}

.state-empty {
	color: #9ca3af;
	font-size: 0.85rem;
}

.tool-button {
	margin: 0 0.35rem 0.35rem 0;
}

.log-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	margin-bottom: 0.5rem;
}

.log-level-select {
	min-width: 110px;
	max-width: 130px;
}

.log-list {
	max-height: 16rem;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
	margin-top: 0.5rem;
}

.log-item {
	border: 1px solid #e5e7eb;
	border-radius: 0.5rem;
	padding: 0.45rem 0.55rem;
	background: #f8fafc;
}

.log-item-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	margin-bottom: 0.25rem;
}

.log-time {
	font-size: 0.75rem;
	color: #64748b;
	white-space: nowrap;
}

.log-summary {
	font-size: 0.8rem;
	line-height: 1.45;
	color: #1f2937;
	word-break: break-word;
}

.log-detail {
	margin-top: 0.3rem;
}

.log-detail summary {
	font-size: 0.75rem;
	color: #2563eb;
	cursor: pointer;
	user-select: none;
}

.log-detail pre {
	margin-top: 0.3rem;
	background: #0f172a;
	color: #e2e8f0;
	border-radius: 0.4rem;
	padding: 0.45rem;
	font-size: 0.72rem;
	line-height: 1.4;
	overflow-x: auto;
	white-space: pre-wrap;
	word-break: break-word;
}

.game-chat {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: #ffffff;
}

.message-list {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 1.25rem;
}

.typing-loading-block {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.typing-indicator {
	display: flex;
	gap: 4px;
}

.typing-loading-message {
	font-size: 0.82rem;
	color: #8b8b9e;
	font-style: italic;
	line-height: 1.4;
	max-width: 320px;
	letter-spacing: 0.02em;
}

.loading-msg-fade-enter-active {
	transition: opacity 0.5s ease, transform 0.5s ease;
}
.loading-msg-fade-leave-active {
	transition: opacity 0.3s ease, transform 0.3s ease;
}
.loading-msg-fade-enter-from {
	opacity: 0;
	transform: translateY(4px);
}
.loading-msg-fade-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

.dot {
	width: 8px;
	height: 8px;
	background-color: #999;
	border-radius: 50%;
	animation: typing 1.4s infinite;
}

@keyframes typing {
	0%, 60%, 100% {
		transform: translateY(0);
		opacity: 0.7;
	}
	30% {
		transform: translateY(-10px);
		opacity: 1;
	}
}

/* 移动端遮罩 */
.mobile-overlay {
	display: none;
}

/* 移动端状态摘要条 */
.mobile-status-bar {
	display: none;
}

@media (max-width: 768px) {
	.game-mode {
		flex-direction: column;
		position: relative;
	}

	/* 面板改为从顶部滑入的抽屉 */
	.game-panel {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		width: 100%;
		max-height: 70vh;
		border-right: none;
		border-bottom: 1px solid #e5e7eb;
		z-index: 100;
		transform: translateY(-100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: none;
		overflow-y: auto;
	}

	.game-panel.panel-open {
		transform: translateY(0);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
	}

	/* 遮罩层 */
	.mobile-overlay {
		display: block;
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 99;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* 顶部状态摘要条 */
	.mobile-status-bar {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border-bottom: 1px solid #e5e7eb;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		flex-shrink: 0;
	}

	.mobile-status-bar:active {
		background: #f1f5f9;
	}

	.status-bar-content {
		width: 100%;
	}

	.status-bar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.status-bar-pack {
		font-size: 0.8rem;
		font-weight: 600;
		color: #1e293b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-bar-toggle {
		font-size: 0.6rem;
		color: #64748b;
		transition: transform 0.3s ease;
		flex-shrink: 0;
		margin-left: 0.5rem;
	}

	.status-bar-toggle.toggle-open {
		transform: rotate(180deg);
	}

	.status-bar-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.6rem;
	}

	.status-bar-item {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.75rem;
		color: #475569;
		line-height: 1.4;
	}

	.status-bar-item-label {
		color: #64748b;
	}

	.status-bar-item-value {
		color: #1e293b;
		font-weight: 500;
	}

	.status-bar-item--stat .status-bar-item-value {
		color: #2563eb;
		font-weight: 600;
	}

	/* 消息区占满剩余空间 */
	.game-chat {
		flex: 1;
		min-height: 0;
	}

	.message-list {
		padding: 0.75rem;
	}
}
</style>
