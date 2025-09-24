import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
	html: true,
	breaks: true,
	linkify: true,
	typographer: true,
	highlight(code, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return `<pre class="hljs"><code>${md.utils.escapeHtml(hljs.highlight(code, { language: lang }).value)}</code></pre>`
			} catch (e) {}
		}
		return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
	}
})

export function renderMarkdown(content) {
	return md.render(content || '')
}

