<template>
	<el-dialog v-model="innerShow" title="更新日志" width="90%" :max-width="600" class="changelog-dialog">
		<div class="changelog-content p-4 max-h-[60vh] overflow-y-auto">
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
	/* 自定义一些样式以提升阅读体验 */
	line-height: 1.6;
}
</style>
