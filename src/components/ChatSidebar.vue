<template>
	<div>
		<div class="sidebar w-96 flex-col scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200" :class="modelValue ? 'hidden md:flex' : 'hidden'">
			<div class="sidebar-header p-4 border-b">
				<el-button class="btn-primary w-full" @click="$emit('create-new-chat')">
					<el-icon><Plus /></el-icon> 新对话
				</el-button>
			</div>
			<div class="chat-list flex-1 overflow-y-auto p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200">
				<ChatItem
					v-for="chat in chatHistory"
					:key="chat.id"
					:chat="chat"
					:active="currentChatId === chat.id"
					@switch="$emit('switch-chat', $event)"
					@delete="$emit('delete-chat', $event)"
					@update-title="$emit('update-title', $event)"
				/>
			</div>
			<div class="related-links p-4 border-t mt-2">
				<h3 class="text-md font-semibold text-gray-700 mb-3">相关链接</h3>
				<div class="flex flex-col gap-2">
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.itch.io/beyond-books')">
						<el-icon><VideoPlay /></el-icon> AI剧本杀游戏
					</el-button>
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top/Epitaph/')">
						<el-icon><Collection /></el-icon> 作者作品集
					</el-button>
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top/Bedtime-Stories-with-AI-2/')">
						<el-icon><Promotion /></el-icon> 访问新版（不稳定）
					</el-button>
				</div>
			</div>
		</div>

		<div class="sidebar fixed left-0 w-96 bg-gray-50 border-r flex flex-col md:hidden z-50 top-16 bottom-0" v-show="modelValue">
			<div class="sidebar-header p-4 border-b">
				<el-button class="btn-primary w-full" @click="handleCreateMobile">
					<el-icon><Plus /></el-icon> 新对话
				</el-button>
			</div>
			<div class="chat-list flex-1 overflow-y-auto p-4 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200">
				<ChatItem
					v-for="chat in chatHistory"
					:key="chat.id"
					:chat="chat"
					:active="currentChatId === chat.id"
					@switch="handleMobileSwitch"
					@delete="$emit('delete-chat', $event)"
					@update-title="$emit('update-title', $event)"
				/>
			</div>
			<div class="related-links p-4 border-t mt-2">
				<h3 class="text-md font-semibold text-gray-700 mb-3">相关链接</h3>
				<div class="flex flex-col gap-2">
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.itch.io/beyond-books')">
						<el-icon><VideoPlay /></el-icon> AI剧本杀游戏
					</el-button>
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top/Epitaph/')">
						<el-icon><Collection /></el-icon> 作者作品集
					</el-button>
					<el-button class="btn-small" @click="$emit('open-external-link', 'https://tobenot.top/Bedtime-Stories-with-AI-2/')">
						<el-icon><Promotion /></el-icon> 访问新版（不稳定）
					</el-button>
				</div>
			</div>
		</div>

		<div class="sidebar-overlay fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" v-if="modelValue" @click="$emit('update:modelValue', false)"></div>
	</div>
</template>

<script>
import { Plus, VideoPlay, Collection, Promotion } from '@element-plus/icons-vue'
import ChatItem from './ChatItem.vue'

export default {
	name: 'ChatSidebar',
	components: { 
		ChatItem, 
		Plus, 
		VideoPlay, 
		Collection, 
		Promotion 
	},
	props: {
		chatHistory: { type: Array, required: true },
		currentChatId: { type: [String, Number], required: true },
		modelValue: { type: Boolean, default: false }
	},
	emits: ['create-new-chat', 'switch-chat', 'delete-chat', 'update-title', 'open-external-link', 'update:modelValue'],
	methods: {
		handleMobileSwitch(id) {
			this.$emit('switch-chat', id)
			this.$emit('update:modelValue', false)
		},
		handleCreateMobile() {
			this.$emit('create-new-chat')
			this.$emit('update:modelValue', false)
		}
	}
}
</script>

<style scoped>
</style>


