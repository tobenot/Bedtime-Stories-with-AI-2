# 与AI的睡前故事 项目开发手册

本手册面向对项目开发不太熟悉的程序员，详细介绍了项目背景、所需环境、如何本地部署、项目结构、开发注意事项及常见问题。按照以下步骤，你可以快速地了解并开始开发此项目。

---

## 1. 项目简介

与AI的睡前故事是一个轻量级的 AI 对话网页应用。  
主要技术栈包括：  
- **Vue 3**：前端框架  
- **Vite**：快速构建工具  
- **Element Plus**：UI 组件库  
- **Tailwind CSS**：样式解决方案  
- **Marked.js** 与 **Highlight.js**：用于 Markdown 渲染及代码高亮  
- **html2pdf.js**：用于 PDF 导出功能  

项目的核心功能包括：
- 真实流式对话体验（支持用户与 AI 聊天）
- 展示 AI 的"思考过程"
- 支持 Markdown 格式的内容展示（含代码高亮）
- 多对话管理及本地历史记录存储
- **多供应商预设管理**（硅基流动、Deepseek、火山引擎、OpenRouter、LMRouter、Google Gemini）
- **自定义预设**（用户可创建任意多个 OpenAI 兼容预设）
- **绘图模式**（AI 图像输出，按预设能力自动适配）
- 通过 Preset 注册表统一管理 API 配置

---

## 2. 环境要求

- **Node.js**：建议版本 v14 及以上  
- **包管理器**：npm 或 yarn

---

## 3. 本地部署步骤

### 3.1 克隆项目代码

使用 Git 克隆项目到本地：
```bash
git clone <项目仓库地址>
cd <项目目录>
```

### 3.2 安装依赖

确保你的系统上已经安装 Node.js，然后在项目根目录下执行：
```bash
npm install
```
或者，如果你使用 yarn：
```bash
yarn install
```

### 3.3 启动开发服务器

运行以下命令启动开发服务器，Vite 会启用热重载：
```bash
npm run dev
```
或
```bash
yarn dev
```
默认情况下，开发服务器将运行在 [http://localhost:3000](http://localhost:3000)。在浏览器中打开这个地址可以查看应用效果。

### 3.4 构建生产环境包

当开发完成、测试无误后，可以使用以下命令生成生产环境的构建包：
```bash
npm run build
```
或
```bash
yarn build
```
构建输出目录为 `dist`，此目录中的文件即部署到生产环境时使用的文件。

### 3.5 预览生产构建

你可以通过以下命令来预览构建后的效果：
```bash
npm run serve
```
或
```bash
yarn serve
```

---

## 4. 项目结构说明

- **根目录**
  - `index.html`  
    项目的入口 HTML 文件，加载 Vue 应用。
  - `vite.config.js`  
    Vite 的配置文件，定义了服务器端口及构建输出目录。

- **src/**  
  包含所有的前端源码，采用**微内核+插件化架构**：
  - `main.js`  
    Vue 应用入口，完成 Element Plus、Highlight.js 和 Marked.js 的全局配置。
  - `AppCore.vue`  
    微内核主应用，持有 `activePresetId`（唯一事实源），负责插件加载与全局状态管理。
  - `core/`  
    微内核核心代码：`aiService.js`（统一 AI 调用入口）、`pluginSystem.js`（插件系统）、`store.js`（全局状态）、`modelFetcher.js`（远端模型拉取）。
  - `config/presets/`  
    **Preset 注册表**：`builtin.js`（内置预设数据）、`index.js`（查询/CRUD/能力标记/模型列表派生）。所有供应商知识集中在这里。
  - `modes/`  
    模式插件目录：`StandardChatMode/`（标准对话）、`DrawMode/`（绘图模式）。
  - `shared/components/`  
    共享 UI 组件：`MessageBubble.vue`、`ChatInput.vue`、`MarkdownRenderer.vue`、`EmptyState.vue`。
  - `tools/`  
    工具插件目录：`ScriptSelectorTool/`（剧本选择器）。
  - `components/`  
    全局组件：`SettingsDrawer.vue`（含 Preset 选择器 + 自定义预设管理）、`HeaderBar.vue`、`ChatSidebar.vue` 等。
  - `utils/`  
    工具函数：`providers/`（协议驱动 `openaiCompatible.js` / `gemini.js`）、`keyManager.js`（按 presetId 分桶的 Key 管理）等。
  - `index.css`  
    全局样式文件，包含 Tailwind CSS 基础样式和自定义样式。

---

## 5. 开发注意事项

- **API 配置**  
  项目支持多供应商多预设。点击右上角"设置"按钮，可以选择内置预设（硅基流动、Deepseek、OpenRouter 等）或创建自定义预设。每个预设的 API Key 独立存储在浏览器本地。自定义预设还可以在"高级能力"中标记是否支持图像输出和推理。

- **组件开发**  
  - 新功能和自定义组件建议存放于 `src/components/` 目录下。  
  - 根据功能拆分组件，保持代码整洁和模块化。

- **Markdown 渲染与代码高亮**  
  - 应用使用 Marked.js 渲染 Markdown 文本，Highlight.js 用于代码块高亮。  
  - 可根据需要调整 `src/main.js` 中 Marked 的配置，以满足不同渲染需求。

- **样式管理**  
  - 项目中大量使用 Tailwind CSS 快速开发样式，并在 `src/index.css` 中引入自定义的类。  
  - 若需要调整界面风格，可在 Tailwind 配置文件 `tailwind.config.js` 或 `src/index.css` 中进行修改。

---

## 6. 部署到生产环境

1. 执行 `npm run build` 或 `yarn build` 后，将生成的 `dist` 目录部署到静态服务器（如 Nginx、Apache、Vercel、Netlify 等）。
2. 配置服务器解析 `index.html`，为前端路由提供支持。  
   例如，在 Nginx 中，可以通过如下配置实现：
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       root /path/to/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

## 6.1 使用 GitHub Pages 部署

如果你希望将项目部署到 GitHub Pages，可以按照以下步骤操作：

1. **修改 Vite 配置**  
   确保在 `vite.config.js` 中设置正确的 `base` 路径，例如：
   ```javascript
   export default defineConfig({
     base: '/Bedtime-Stories-with-AI/',
     // 其它配置...
   })
   ```

2. **配置部署脚本**  
   在 `package.json` 中添加部署脚本：
   ```json
   "deploy": "gh-pages -d dist"
   ```
   同时确保安装了 `gh-pages`：
   ```bash
   npm install --save-dev gh-pages
   ```

3. **执行部署**  
   先构建项目：
   ```bash
   npm run build
   ```
   然后运行部署命令：
   ```bash
   npm run deploy
   ```

4. **GitHub Pages 配置**  
   在 GitHub 仓库的 **Settings > Pages** 中，将**Source**（来源）设置为 `gh-pages` 分支。几分钟后，即可通过以下 URL 访问应用：
   ```
   https://<你的用户名>.github.io/Bedtime-Stories-with-AI/
   ```

---

## 7. 常见问题及排查方法

- **依赖安装问题**  
  - 请确保 Node.js 已正确安装并且版本满足要求。  
  - 如果安装失败，可以尝试删除 `node_modules` 和 `package-lock.json`（或 `yarn.lock`），然后重新运行安装命令。

- **启动开发服务器失败**  
  - 检查 3000 端口是否被占用（可修改 `vite.config.js` 中的端口配置）。
  - 查看控制台输出的错误信息，根据提示解决问题。

- **API 请求错误**  
  - 确保 API Key 已正确配置。
  - 使用浏览器开发者工具检查网络请求和响应数据。

- **构建失败**  
  - 确认所有依赖版本是否匹配，参考 `package.json` 中的依赖列表。  
  - 查阅 Vite 和 Vue 官方文档了解更多构建调试方法。

- **PDF 导出问题**  
  - 如果 PDF 导出不工作，可检查 `html2pdf.js` 的使用是否符合要求，确保所有相关 DOM 元素正确生成。

---

## 8. 总结

本开发手册为你详细介绍了 与AI的睡前故事 项目的背景、所需的技术环境、本地部署步骤、主要目录结构、开发和调试注意事项及生产环境部署方法。希望这份手册能帮助你快速上手并顺利开展开发工作。

如遇到任何问题，请查阅相关官方文档或向项目维护者寻求帮助。

祝你开发愉快！