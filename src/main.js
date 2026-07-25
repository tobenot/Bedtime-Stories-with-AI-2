import { createApp } from 'vue'
import AppCore from './AppCore.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css' // Element Plus 暗色变量（html.dark 生效）
import './index.css' // Tailwind CSS 样式

import { initTheme } from './utils/theme.js'
import { noAutofillDirective } from './utils/noAutofillDirective.js'

// 挂载前应用主题，避免暗色模式下首屏闪烁
initTheme()

const app = createApp(AppCore)
app.directive('no-autofill', noAutofillDirective)

app.use(ElementPlus).mount('#app') 