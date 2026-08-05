<template>
	<el-dialog v-model="innerShow" title="更新日志" width="min(640px, 92vw)" class="changelog-dialog">
		<div class="changelog-content">
			<MarkdownRenderer :content="changelogMarkdown" />
		</div>
	</el-dialog>
</template>

<script>
import MarkdownRenderer from './MarkdownRenderer.vue'
import { changelogData } from '@/config/changelog.js'

export default {
	name: 'ChangelogDialog',
	components: { MarkdownRenderer },
	props: {
		modelValue: { type: Boolean, default: false }
	},
	data() {
		return {
			changelogMarkdown: changelogData
		}
	},
	computed: {
		innerShow: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		}
	}
}
</script>

<style scoped>
.changelog-content {
	max-height: 62vh;
	overflow-y: auto;
	padding: 4px 20px 16px;
	font-size: 13.5px;
	line-height: 1.75;
	color: var(--text-main);
}

/* 标题：一级标题压底分隔线，月份标题带左侧强调条，形成清晰节奏 */
.changelog-content :deep(h1) {
	margin: 0 0 12px;
	padding-bottom: 10px;
	font-size: 17px;
	font-weight: 600;
	color: var(--text-strong);
	border-bottom: 1px solid var(--border-color);
}
.changelog-content :deep(h2) {
	margin: 22px 0 8px;
	padding-left: 9px;
	font-size: 14.5px;
	font-weight: 600;
	color: var(--text-strong);
	border-left: 3px solid #805ad5;
}
.changelog-content :deep(h3) {
	margin: 14px 0 6px;
	font-size: 13.5px;
	font-weight: 600;
	color: var(--text-strong);
}

/* 列表与段落：条目间留出呼吸感，嵌套列表缩进收敛 */
.changelog-content :deep(p) {
	margin: 6px 0;
}
.changelog-content :deep(ul),
.changelog-content :deep(ol) {
	margin: 6px 0;
	padding-left: 20px;
}
.changelog-content :deep(li) {
	margin: 4px 0;
}
.changelog-content :deep(li > ul),
.changelog-content :deep(li > ol) {
	margin: 2px 0;
}
.changelog-content :deep(li::marker) {
	color: var(--text-muted);
}

/* 行内代码与强调 */
.changelog-content :deep(code) {
	padding: 1px 5px;
	font-size: 0.86em;
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	background: var(--bg-elevated);
	border-radius: 4px;
}
.changelog-content :deep(strong) {
	color: var(--text-strong);
}
</style>
