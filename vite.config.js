import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
	base: '/Bedtime-Stories-with-AI-2/',
	plugins: [vue()],
	server: {
		port: 3000
	},
	build: {
		outDir: 'dist',
		chunkSizeWarningLimit: 4096,
		rollupOptions: {
			output: {
				manualChunks: {
					vue: ['vue'],
					'element-plus': ['element-plus', '@element-plus/icons-vue'],
					markdown: ['marked', 'markdown-it', 'highlight.js']
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