import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './index.css' // Tailwind CSS 样式

import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import 'highlight.js/styles/github.css'
import html2pdf from 'html2pdf.js'

const app = createApp(App)

app.config.globalProperties.$html2pdf = html2pdf

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus).mount('#app') 