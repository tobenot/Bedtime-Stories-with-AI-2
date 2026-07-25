import { createApp } from 'vue'
import AppCore from './AppCore.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './index.css' // Tailwind CSS 样式

import 'highlight.js/styles/github.css'
import { noAutofillDirective } from './utils/noAutofillDirective.js'

const app = createApp(AppCore)
app.directive('no-autofill', noAutofillDirective)

app.use(ElementPlus).mount('#app') 