<template>
	<div ref="root" class="markdown-renderer" v-html="compiled"></div>
</template>

<script>
import { renderMarkdown } from '@/utils/markdown'

export default {
	name: 'MarkdownRenderer',
	props: {
		content: { type: String, default: '' }
	},
	computed: {
		compiled() {
			return renderMarkdown(this.content)
		}
	}
}
</script>

<style scoped>
.markdown-renderer {
	max-width: 100%;
	word-break: break-word;
	overflow-wrap: anywhere;
}

.markdown-renderer table {
	width: 100%;
	border-collapse: collapse;
	margin: 1rem 0;
}

.markdown-renderer th,
.markdown-renderer td {
	border: 1px solid rgba(0,0,0,0.1);
	padding: 0.5rem;
	vertical-align: top;
}

.markdown-renderer pre {
	max-width: 100%;
	overflow-x: auto;
	background-color: rgba(0,0,0,0.05);
	padding: 0.75rem;
	border-radius: 0.5rem;
}

.markdown-renderer img {
	max-width: 100%;
	height: auto;
	display: block;
}
</style>

