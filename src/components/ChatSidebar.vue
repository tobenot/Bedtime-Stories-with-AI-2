<template>
	<div>
		<div class="sidebar w-96 flex flex-col h-full scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200" :class="modelValue ? 'hidden md:flex' : 'hidden'">
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
			<div class="chat-list flex-1 overflow-y-auto p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 min-h-0">
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

				<!-- 归档区域 -->
				<div v-if="archiveIndex.length > 0" class="archive-section mt-4">
					<div class="archive-header flex items-center gap-2 cursor-pointer py-2 px-1 text-gray-500 hover:text-gray-700 transition-colors" @click="showArchive = !showArchive">
						<el-icon :class="showArchive ? 'rotate-90' : ''" class="transition-transform duration-200"><ArrowRight /></el-icon>
						<span class="text-sm font-medium">📦 归档 ({{ archiveIndex.length }})</span>
					</div>
					<div v-if="showArchive" class="archive-list">
						<!-- 归档区搜索 -->
						<el-input
							v-if="archiveIndex.length > 5"
							v-model="archiveSearchQuery"
							placeholder="搜索归档标题..."
							clearable
							size="small"
							class="mb-2"
						>
							<template #prefix>
								<el-icon><Search /></el-icon>
							</template>
						</el-input>
						<div
							v-for="item in filteredArchiveIndex"
							:key="item.id"
							class="archive-item p-2 mb-1 rounded-lg bg-gray-100 text-gray-600 text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors"
						>
							<el-icon class="text-gray-400 flex-shrink-0"><FolderOpened /></el-icon>
							<span class="flex-1 archive-item-title">{{ item.title || '新对话' }}</span>
							<el-tooltip content="取回" placement="top">
								<el-button type="text" size="small" @click="confirmRestore(item)">
									<el-icon class="text-blue-500"><RefreshRight /></el-icon>
								</el-button>
							</el-tooltip>
							<el-tooltip content="删除" placement="top">
								<el-button type="text" size="small" @click="confirmDeleteArchived(item)">
									<el-icon class="text-red-400"><Delete /></el-icon>
								</el-button>
							</el-tooltip>
						</div>
						<div v-if="filteredArchiveIndex.length === 0 && archiveSearchQuery" class="text-center text-gray-400 py-4 text-sm">
							未找到匹配的归档对话
						</div>
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
			<div class="chat-list flex-1 overflow-y-auto p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 min-h-0">
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

				<!-- 移动端归档区域 -->
				<div v-if="archiveIndex.length > 0" class="archive-section mt-4">
					<div class="archive-header flex items-center gap-2 cursor-pointer py-2 px-1 text-gray-500 hover:text-gray-700 transition-colors" @click="showArchive = !showArchive">
						<el-icon :class="showArchive ? 'rotate-90' : ''" class="transition-transform duration-200"><ArrowRight /></el-icon>
						<span class="text-sm font-medium">📦 归档 ({{ archiveIndex.length }})</span>
					</div>
					<div v-if="showArchive" class="archive-list">
						<el-input
							v-if="archiveIndex.length > 5"
							v-model="archiveSearchQuery"
							placeholder="搜索归档标题..."
							clearable
							size="small"
							class="mb-2"
						>
							<template #prefix>
								<el-icon><Search /></el-icon>
							</template>
						</el-input>
						<div
							v-for="item in filteredArchiveIndex"
							:key="item.id"
							class="archive-item p-2 mb-1 rounded-lg bg-gray-100 text-gray-600 text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors"
						>
							<el-icon class="text-gray-400 flex-shrink-0"><FolderOpened /></el-icon>
							<span class="flex-1 archive-item-title">{{ item.title || '新对话' }}</span>
							<el-tooltip content="取回" placement="top">
								<el-button type="text" size="small" @click="confirmRestore(item)">
									<el-icon class="text-blue-500"><RefreshRight /></el-icon>
								</el-button>
							</el-tooltip>
							<el-tooltip content="删除" placement="top">
								<el-button type="text" size="small" @click="confirmDeleteArchived(item)">
									<el-icon class="text-red-400"><Delete /></el-icon>
								</el-button>
							</el-tooltip>
						</div>
						<div v-if="filteredArchiveIndex.length === 0 && archiveSearchQuery" class="text-center text-gray-400 py-4 text-sm">
							未找到匹配的归档对话
						</div>
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
import { Plus, Collection, Search, ArrowRight, Delete, FolderOpened, RefreshRight } from '@element-plus/icons-vue'
import ChatItem from './ChatItem.vue'

export default {
	name: 'ChatSidebar',
	components: { 
		ChatItem, 
		Plus, 
		Collection,
		Search,
		ArrowRight,
		Delete,
		FolderOpened,
		RefreshRight
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
			archiveSearchQuery: ''
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
.archive-section {
	border-top: 1px dashed #e5e7eb;
	padding-top: 0.5rem;
}

.archive-header .el-icon {
	font-size: 12px;
}

.archive-item-title {
	white-space: normal;
	word-break: break-all;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.rotate-90 {
	transform: rotate(90deg);
}
</style>


