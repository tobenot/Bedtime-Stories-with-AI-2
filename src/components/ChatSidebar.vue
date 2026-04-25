<template>
	<div>
		<div class="sidebar w-96 flex flex-col h-full" :class="modelValue ? 'hidden md:flex' : 'hidden'">
			<div class="sidebar-header p-4 border-b flex-shrink-0">
				<el-button class="btn-primary w-full mb-3" @click="$emit('create-new-chat')">
					<el-icon><Plus /></el-icon> 新对话
				</el-button>
				<el-input
					v-model="searchQuery"
					placeholder="搜索对话标题..."
					clearable
					class="w-full"
				>
					<template #prefix>
						<el-icon><Search /></el-icon>
					</template>
				</el-input>
			</div>
			<!-- 聊天主列表 + 归档区：两块都在同一滚动容器，但归档展开后归档区独立虚拟滚动 -->
			<div class="chat-list-wrapper flex-1 flex flex-col min-h-0">
				<div
					class="chat-list p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200"
					:class="showArchive && archiveIndex.length > 0 ? 'chat-list--shrink' : 'chat-list--full'"
				>
					<ChatItem
						v-for="chat in filteredChatHistory"
						:key="chat.id"
						:chat="chat"
						:active="currentChatId === chat.id"
						@switch="$emit('switch-chat', $event)"
						@delete="$emit('delete-chat', $event)"
						@update-title="$emit('update-title', $event)"
						@archive="$emit('archive-chat', $event)"
					/>
					<div v-if="filteredChatHistory.length === 0" class="text-center text-gray-400 py-8">
						未找到匹配的对话
					</div>
				</div>

				<!-- 归档区域 -->
				<div v-if="archiveIndex.length > 0" class="archive-section flex flex-col flex-shrink-0" :class="showArchive ? 'archive-section--open' : ''">
					<div class="archive-header flex items-center gap-2 cursor-pointer py-2 px-4 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0" @click="showArchive = !showArchive">
						<el-icon :class="showArchive ? 'rotate-90' : ''" class="transition-transform duration-200"><ArrowRight /></el-icon>
						<span class="text-sm font-medium">📦 归档 ({{ archiveIndex.length }})</span>
					</div>
					<div v-if="showArchive" class="archive-body flex flex-col min-h-0 flex-1 px-4 pb-3">
						<el-input
							v-if="archiveIndex.length > 5"
							v-model="archiveSearchQuery"
							placeholder="搜索归档标题..."
							clearable
							size="small"
							class="mb-2 flex-shrink-0"
						>
							<template #prefix>
								<el-icon><Search /></el-icon>
							</template>
						</el-input>
						<div v-if="filteredArchiveIndex.length === 0 && archiveSearchQuery" class="text-center text-gray-400 py-4 text-sm">
							未找到匹配的归档对话
						</div>
						<VirtualList
							v-else
							class="archive-virtual-list scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200"
							:items="filteredArchiveIndex"
							:item-height="ARCHIVE_ITEM_HEIGHT"
							:reset-key="archiveSearchQuery"
							key-field="id"
						>

							<template #default="{ item }">
								<div class="archive-item" :title="item.title || '新对话'">
									<span class="archive-icon" aria-hidden="true">📁</span>
									<span class="archive-item-title">{{ item.title || '新对话' }}</span>
									<button
										type="button"
										class="archive-action archive-action--restore"
										:title="'取回'"
										@click="confirmRestore(item)"
									>↩</button>
									<button
										type="button"
										class="archive-action archive-action--delete"
										:title="'删除'"
										@click="confirmDeleteArchived(item)"
									>✕</button>
								</div>
							</template>
						</VirtualList>
					</div>
				</div>
			</div>
			<div class="related-links p-4 border-t mt-2 flex-shrink-0">
				<div class="flex flex-col gap-2">
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top')">
						<el-icon><Collection /></el-icon> 作者博客
					</el-button>
				</div>
			</div>
		</div>

		<div class="sidebar fixed left-0 w-96 bg-gray-50 border-r flex flex-col md:hidden z-50 top-16 bottom-0" v-show="modelValue">
			<div class="sidebar-header p-4 border-b flex-shrink-0">
				<el-button class="btn-primary w-full mb-3" @click="handleCreateMobile">
					<el-icon><Plus /></el-icon> 新对话
				</el-button>
				<el-input
					v-model="searchQuery"
					placeholder="搜索对话标题..."
					clearable
					class="w-full"
				>
					<template #prefix>
						<el-icon><Search /></el-icon>
					</template>
				</el-input>
			</div>
			<div class="chat-list-wrapper flex-1 flex flex-col min-h-0">
				<div
					class="chat-list p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200"
					:class="showArchive && archiveIndex.length > 0 ? 'chat-list--shrink' : 'chat-list--full'"
				>
					<ChatItem
						v-for="chat in filteredChatHistory"
						:key="chat.id"
						:chat="chat"
						:active="currentChatId === chat.id"
						@switch="handleMobileSwitch"
						@delete="$emit('delete-chat', $event)"
						@update-title="$emit('update-title', $event)"
						@archive="$emit('archive-chat', $event)"
					/>
					<div v-if="filteredChatHistory.length === 0" class="text-center text-gray-400 py-8">
						未找到匹配的对话
					</div>
				</div>

				<!-- 移动端归档区域 -->
				<div v-if="archiveIndex.length > 0" class="archive-section flex flex-col flex-shrink-0" :class="showArchive ? 'archive-section--open' : ''">
					<div class="archive-header flex items-center gap-2 cursor-pointer py-2 px-4 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0" @click="showArchive = !showArchive">
						<el-icon :class="showArchive ? 'rotate-90' : ''" class="transition-transform duration-200"><ArrowRight /></el-icon>
						<span class="text-sm font-medium">📦 归档 ({{ archiveIndex.length }})</span>
					</div>
					<div v-if="showArchive" class="archive-body flex flex-col min-h-0 flex-1 px-4 pb-3">
						<el-input
							v-if="archiveIndex.length > 5"
							v-model="archiveSearchQuery"
							placeholder="搜索归档标题..."
							clearable
							size="small"
							class="mb-2 flex-shrink-0"
						>
							<template #prefix>
								<el-icon><Search /></el-icon>
							</template>
						</el-input>
						<div v-if="filteredArchiveIndex.length === 0 && archiveSearchQuery" class="text-center text-gray-400 py-4 text-sm">
							未找到匹配的归档对话
						</div>
						<VirtualList
							v-else
							class="archive-virtual-list scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200"
							:items="filteredArchiveIndex"
							:item-height="ARCHIVE_ITEM_HEIGHT"
							:reset-key="archiveSearchQuery"
							key-field="id"
						>

							<template #default="{ item }">
								<div class="archive-item" :title="item.title || '新对话'">
									<span class="archive-icon" aria-hidden="true">📁</span>
									<span class="archive-item-title">{{ item.title || '新对话' }}</span>
									<button
										type="button"
										class="archive-action archive-action--restore"
										:title="'取回'"
										@click="confirmRestore(item)"
									>↩</button>
									<button
										type="button"
										class="archive-action archive-action--delete"
										:title="'删除'"
										@click="confirmDeleteArchived(item)"
									>✕</button>
								</div>
							</template>
						</VirtualList>
					</div>
				</div>
			</div>
			<div class="related-links p-4 border-t mt-2 flex-shrink-0">
				<div class="flex flex-col gap-2">
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top')">
						<el-icon><Collection /></el-icon> 作者博客
					</el-button>
				</div>
			</div>
		</div>

		<div class="sidebar-overlay fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" v-if="modelValue" @click="$emit('update:modelValue', false)"></div>
	</div>
</template>

<script>
import { Plus, Collection, Search, ArrowRight } from '@element-plus/icons-vue'
import ChatItem from './ChatItem.vue'
import VirtualList from './VirtualList.vue'

// 固定行高（px），包含行间距。虚拟滚动要求稳定高度。
const ARCHIVE_ITEM_HEIGHT = 40

export default {
	name: 'ChatSidebar',
	components: {
		ChatItem,
		VirtualList,
		Plus,
		Collection,
		Search,
		ArrowRight
	},
	props: {
		chatHistory: { type: Array, required: true },
		currentChatId: { type: [String, Number], required: true },
		modelValue: { type: Boolean, default: false },
		archiveIndex: { type: Array, default: () => [] }
	},
	emits: [
		'create-new-chat', 'switch-chat', 'delete-chat', 'update-title',
		'open-external-link', 'update:modelValue',
		'archive-chat', 'restore-chat', 'delete-archived-chat'
	],
	data() {
		return {
			searchQuery: '',
			showArchive: false,
			archiveSearchQuery: '',
			ARCHIVE_ITEM_HEIGHT
		}
	},
	computed: {
		filteredChatHistory() {
			if (!this.searchQuery || !this.searchQuery.trim()) {
				return this.chatHistory
			}
			const query = this.searchQuery.trim().toLowerCase()
			return this.chatHistory.filter(chat => {
				const title = (chat.title || '新对话').toLowerCase()
				return title.includes(query)
			})
		},
		filteredArchiveIndex() {
			if (!this.archiveSearchQuery || !this.archiveSearchQuery.trim()) {
				return this.archiveIndex
			}
			const query = this.archiveSearchQuery.trim().toLowerCase()
			return this.archiveIndex.filter(item => {
				const title = (item.title || '新对话').toLowerCase()
				return title.includes(query)
			})
		}
	},
	methods: {
		handleMobileSwitch(id) {
			this.$emit('switch-chat', id)
			this.$emit('update:modelValue', false)
		},
		handleCreateMobile() {
			this.$emit('create-new-chat')
			this.$emit('update:modelValue', false)
		},
		confirmRestore(item) {
			this.$confirm(
				`取回「${item.title || '新对话'}」到对话列表？`,
				'取回归档对话',
				{
					confirmButtonText: '取回',
					cancelButtonText: '取消',
					type: 'info',
					closeOnClickModal: false
				}
			).then(() => {
				this.$emit('restore-chat', item.id)
			}).catch(() => {})
		},
		confirmDeleteArchived(item) {
			this.$confirm(
				`确定永久删除归档对话「${item.title || '新对话'}」？此操作不可恢复。`,
				'删除归档对话',
				{
					confirmButtonText: '删除',
					cancelButtonText: '取消',
					type: 'warning',
					closeOnClickModal: false
				}
			).then(() => {
				this.$emit('delete-archived-chat', item.id)
			}).catch(() => {})
		}
	}
}
</script>

<style scoped>
/* 主聊天列表滚动区；归档展开时让出空间给归档区 */
.chat-list {
	overflow-y: auto;
	min-height: 0;
}
.chat-list--full {
	flex: 1 1 auto;
}
.chat-list--shrink {
	/* 归档展开时热区占上半部分，归档区占下半部分；用 flex basis 约束 */
	flex: 1 1 40%;
	min-height: 96px;
}

.archive-section {
	border-top: 1px dashed #e5e7eb;
	padding-top: 0.25rem;
}
.archive-section--open {
	/* 归档展开时占据剩余空间；为虚拟滚动提供确定高度 */
	flex: 1 1 60%;
	min-height: 200px;
}

.archive-header .el-icon {
	font-size: 12px;
}

/* 虚拟滚动容器需要确定高度，由 archive-body 的 flex:1 + min-h-0 提供 */
.archive-virtual-list {
	flex: 1 1 auto;
	min-height: 0;
}

/* 归档项：纯 DOM，尽量轻 */
.archive-item {
	height: 32px;           /* 与 ARCHIVE_ITEM_HEIGHT(40) 协同：32 内容 + 8 间距（由 margin 留出） */
	margin-bottom: 8px;
	padding: 0 8px;
	border-radius: 6px;
	background: #f3f4f6;
	color: #4b5563;
	font-size: 13px;
	display: flex;
	align-items: center;
	gap: 6px;
	transition: background-color 0.15s;
}
.archive-item:hover {
	background: #e5e7eb;
}
.archive-icon {
	flex-shrink: 0;
	font-size: 14px;
	opacity: 0.7;
}
.archive-item-title {
	flex: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.archive-action {
	flex-shrink: 0;
	width: 22px;
	height: 22px;
	border-radius: 4px;
	border: none;
	background: transparent;
	cursor: pointer;
	font-size: 13px;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: #9ca3af;
	transition: background-color 0.15s, color 0.15s;
	padding: 0;
}
.archive-action:hover {
	background: rgba(0, 0, 0, 0.06);
}
.archive-action--restore:hover {
	color: #3b82f6;
}
.archive-action--delete:hover {
	color: #ef4444;
}

.rotate-90 {
	transform: rotate(90deg);
}
</style>
