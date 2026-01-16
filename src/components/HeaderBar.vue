<template>
	<div class="header sticky top-0 z-50 bg-primary text-white border-b border-primary-light">
		<!-- 标题和操作按钮行 -->
		<div class="flex items-center gap-3 p-4">
			<button class="menu-button text-white flex-shrink-0" @click="$emit('toggle-sidebar')" title="切换侧边栏">
				<el-icon><Expand /></el-icon>
			</button>
			<div class="flex-1 min-w-0">
				<h2 class="text-lg text-white font-medium truncate">{{ title }}</h2>
			</div>
			<div class="header-actions flex items-center gap-2 md:gap-4 flex-shrink-0">
				<el-dropdown trigger="click" @command="$emit('toolbox-command', $event)">
					<template #default>
						<button class="header-action-button">
							<el-icon><Briefcase /></el-icon>
						</button>
					</template>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item command="copyChat">复制对话(开if线)</el-dropdown-item>
							<el-dropdown-item command="localScriptEditor">本地剧本编辑器</el-dropdown-item>
							<el-dropdown-item command="exportTxtNovel">导出txt小说</el-dropdown-item>
							<el-dropdown-item command="markdownTool">去星号（Markdown处理工具） </el-dropdown-item>
							<el-dropdown-item command="scrollNavigator">消息进度定位</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
				<button class="header-action-button" @click="$emit('export-pdf')" :disabled="!canExport">
					<el-icon><Printer /></el-icon>
				</button>
				<button class="header-action-button" @click="$emit('open-settings')">
					<el-icon><Setting /></el-icon>
				</button>
			</div>
		</div>
	</div>
</template>

<script>
import { Briefcase, Setting, Expand, Printer } from '@element-plus/icons-vue'

export default {
	name: 'HeaderBar',
	components: { Briefcase, Setting, Expand, Printer },
	props: {
		title: { type: String, default: '' },
		canExport: { type: Boolean, default: false }
	},
	emits: ['toggle-sidebar', 'toolbox-command', 'export-pdf', 'open-settings'],
	methods: {
	}
}
</script>

<style scoped>
</style>


