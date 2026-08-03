import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
	base: '/',
	plugins: [
		vue(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			includeAssets: ['logo.svg', 'apple-touch-icon.png'],
			manifest: {
				name: '与AI的睡前故事',
				short_name: '睡前故事',
				description: '综合 AI 对话网站，支持多模型智能聊天、AI 绘图与文字冒险游戏。纯浏览器运行，无需注册，会话本地保存。',
				theme_color: '#1E3A5F',
				background_color: '#f9fafb',
				display: 'standalone',
				lang: 'zh-CN',
				start_url: '/',
				scope: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [/^\/api/],
			},
		}),
	],
	server: {
		port: 3000
	},
	esbuild: {
		drop: ['console', 'debugger']
	},
	build: {
		outDir: 'dist',
		chunkSizeWarningLimit: 4096,
		rollupOptions: {
			output: {
				manualChunks: {
					vue: ['vue'],
					'element-plus': ['element-plus', '@element-plus/icons-vue'],
					markdown: ['markdown-it', 'highlight.js']
				}
			}
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	}
})
