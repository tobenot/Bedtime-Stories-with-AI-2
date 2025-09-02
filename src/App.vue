<!-- 是Vue3！！ -->
<template>
  <div class="app-container flex h-screen">
    <ChatSidebar
      v-model="showSidebar"
      :chat-history="chatHistory"
      :current-chat-id="currentChatId"
      @create-new-chat="createNewChat"
      @switch-chat="switchChat"
      @delete-chat="deleteChat"
      @update-title="changeChatTitle"
      @open-external-link="openExternalLink"
    />

    <!-- 主内容区 -->
    <div class="main-content flex-1 flex flex-col">
      <HeaderBar
        :title="currentChat?.title || '与AI的睡前故事 2'"
        :can-export="!!currentChat?.messages?.length"
        @toggle-sidebar="toggleSidebar"
        @toolbox-command="handleToolboxCommand"
        @export-pdf="exportToPDF"
        @open-settings="showSettings = true"
      />

      <MessageList
        ref="messageList"
        :messages="currentChat?.messages"
        :api-key="apiKey"
        :use-backend-proxy="useBackendProxy"
        :is-typing="isTyping"
        :render-markdown="renderMarkdown"
        :show-sidebar="showSidebar"
        @toggle-reasoning="toggleReasoning"
        @copy-message="copyMessage"
        @edit-message="enableEditMessage"
        @regenerate-message="confirmRegenerateMessage"
        @delete-message="confirmDeleteMessage"
        @open-settings="showSettings = true"
        @scroll-bottom-changed="showScrollToBottom = $event"
        @focus-input="focusInput"
        @open-script-panel="openScriptPanel"
      />

      <InputFooter
        ref="inputFooter"
        v-model="inputMessage"
        :api-key="apiKey"
        :use-backend-proxy="useBackendProxy"
        :is-loading="isLoading"
        :error-message="errorMessage"
        @send="sendMessage"
        @cancel="cancelRequest"
      />
    </div>

    <!-- 新增：滚动到底部悬浮按钮 -->
    <button
      v-if="showScrollToBottom"
      @click="scrollToBottomManual"
      class="fixed bottom-40 right-10 w-12 h-12 bg-gray-200 rounded-full shadow-neumorphic flex items-center justify-center focus:outline-none z-50"
      title="滚动到底部"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  <SettingsDrawer
    v-model="showSettings"
    :provider="provider"
    :api-key="apiKey"
    :api-url="apiUrl"
    :use-backend-proxy="useBackendProxy"
    :backend-url-deepseek="backendUrlDeepseek"
    :backend-url-gemini="backendUrlGemini"
    :temperature="temperature"
    :model="model"
    :default-hide-reasoning="defaultHideReasoning"
    :auto-collapse-reasoning="autoCollapseReasoning"
    :models="models"
    :api-url-options="apiUrlOptions"
    @update:provider="provider = $event; onProviderChanged()"
    @update:api-key="apiKey = $event; saveApiKey()"
    @update:api-url="apiUrl = $event; saveApiUrl()"
    @update:useBackendProxy="useBackendProxy = $event; saveUseBackendProxy(); onProviderChanged()"
    @update:backendUrlDeepseek="backendUrlDeepseek = $event; saveBackendUrls(); onProviderChanged()"
    @update:backendUrlGemini="backendUrlGemini = $event; saveBackendUrls(); onProviderChanged()"
    @update:temperature="temperature = $event; saveTemperature()"
    @update:model="model = $event; saveModel()"
    @update:default-hide-reasoning="defaultHideReasoning = $event; saveDefaultHideReasoning()"
    @update:auto-collapse-reasoning="autoCollapseReasoning = $event; saveAutoCollapseReasoning()"
    @export-chat-archive="exportChatArchive"
    @import-chat-archive="importChatArchive"
    @show-author-info="showAuthorInfo = true"
  />

  <AuthorDialog v-model="showAuthorInfo" />

  <!-- 使用剧本选择器 -->
  <ScriptSelector v-model="showScriptPanel" :scripts="scripts" @script-selected="selectScript" />

  <!-- 新增：本地剧本编辑器 -->
  <LocalScriptEditor v-model="showLocalScriptEditor" @script-selected="selectScript" />

  <!-- 新增：隐藏的文件上传控件，用于导入存档 -->
  <input
    type="file"
    ref="importFile"
    style="display: none;"
    accept=".json"
    @change="handleImportFile"
  />

  <EditMessageDialog
    v-model="showEditDialog"
    :content="editingMessage.content"
    @update:content="editingMessage.content = $event"
    @save="saveEditedMessageDialog"
  />

  <!-- 新增：导出txt小说组件 -->
  <TxtNovelExporter :modelValue.sync="showTxtNovelExporter" :chat="currentChat" />

  <!-- 新增：Markdown处理工具 -->
  <MarkdownTool v-model="showMarkdownTool" />
</template>

<script>
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';
import ChatSidebar from './components/ChatSidebar.vue';
import HeaderBar from './components/HeaderBar.vue';
import MessageList from './components/MessageList.vue';
import InputFooter from './components/InputFooter.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import AuthorDialog from './components/AuthorDialog.vue';
import EditMessageDialog from './components/EditMessageDialog.vue';
import ScriptSelector from './components/ScriptSelector.vue';
import LocalScriptEditor from './components/LocalScriptEditor.vue';
import TxtNovelExporter from './components/TxtNovelExporter.vue';
import MarkdownTool from './components/MarkdownTool.vue';
import scripts from './config/scripts.js';
import { exportChatToPDF } from './utils/pdfExporter';
import { MAX_TITLE_LENGTH, COPY_SUFFIX, BRANCH_SUFFIX } from '@/config/constants.js';
import { parseArchiveJson, mergeImportedChats } from '@/utils/archive.js';
import confirmUseScript from './utils/scriptPreview.js';
import { callAiModel, listModelsByProvider } from '@/utils/aiService';

export default {
  components: {
    ChatSidebar,
    HeaderBar,
    MessageList,
    InputFooter,
    SettingsDrawer,
    AuthorDialog,
    EditMessageDialog,
    ScriptSelector,
    LocalScriptEditor,
    TxtNovelExporter,
    MarkdownTool,
  },
  data() {
    return {
      messages: [],
      inputMessage: '',
      provider: localStorage.getItem('bs2_provider') || localStorage.getItem('provider') || 'deepseek',
      model: localStorage.getItem('bs2_model') || localStorage.getItem('model') || 'deepseek-ai/DeepSeek-R1',
      models: [],
      temperature: localStorage.getItem('bs2_temperature')
        ? parseFloat(localStorage.getItem('bs2_temperature'))
        : localStorage.getItem('temperature')
        ? parseFloat(localStorage.getItem('temperature'))
        : 0.7,
      isLoading: false,
      isTyping: false,
      errorMessage: '',
      apiKey: localStorage.getItem('bs2_deepseek_api_key') || localStorage.getItem('bs2_gemini_api_key') || localStorage.getItem('deepseek_api_key') || localStorage.getItem('gemini_api_key') || '',
      showSettings: false,
      showSidebar: false,
      chatHistory: [],
      currentChatId: null,
      showAuthorInfo: false,
      showScriptPanel: false,
      showLocalScriptEditor: false,
      showMarkdownTool: false,
      scripts: scripts,
      defaultHideReasoning: JSON.parse(localStorage.getItem('bs2_default_hide_reasoning') || localStorage.getItem('default_hide_reasoning') || 'false'),
      autoCollapseReasoning: JSON.parse(localStorage.getItem('bs2_auto_collapse_reasoning') || localStorage.getItem('auto_collapse_reasoning') || 'false'),
      useBackendProxy: JSON.parse(localStorage.getItem('bs2_use_backend_proxy') || 'false'),
      backendUrlDeepseek: localStorage.getItem('bs2_backend_url_deepseek') || '/api/deepseek/stream',
      backendUrlGemini: localStorage.getItem('bs2_backend_url_gemini') || '/api/gemini/stream',
      editingMessageIndex: null,
      importMode: null,
      apiUrl: localStorage.getItem('bs2_api_url') || localStorage.getItem('api_url') || 'https://api.siliconflow.cn/v1/chat/completions',
      apiUrlOptions: [
        { label: '硅基流动', value: 'https://api.siliconflow.cn/v1/chat/completions' },
        { label: '官方', value: 'https://api.deepseek.com/v1/chat/completions' },
        { label: '火山引擎', value: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' }
      ],
      showScrollToBottom: false,
      abortController: null,
      cancelled: false,
      showEditDialog: false,
      editingMessage: {
        index: null,
        content: ''
      },
      showTxtNovelExporter: false,
    }
  },
  computed: {
    currentChat() {
      return this.chatHistory.find(chat => chat.id === this.currentChatId)
    },
    apiUrlHint() {
      if (this.apiUrl === 'https://api.siliconflow.cn/v1/chat/completions') {
        return '当前选择的是硅基流动接口 请使用硅基流动的Key';
      } else if (this.apiUrl === 'https://api.deepseek.com/v1/chat/completions') {
        return '当前选择的是Deepseek官方接口 请使用Deepseek官网的Key';
      } else if (this.apiUrl === 'https://ark.cn-beijing.volces.com/api/v3/chat/completions') {
        return '当前选择的是火山引擎接口 请使用火山引擎的Key';
      } else if (this.apiUrl && this.apiUrl.includes('/gemini')) {
        return '当前选择的是后端代理的Gemini接口，请使用你的Gemini Key或服务端配置的Key';
      } else if (this.apiUrl && this.apiUrl.includes('/deepseek')) {
        return '当前选择的是后端代理的DeepSeek接口，请使用你的DeepSeek Key或服务端配置的Key';
      } else {
        return '';
      }
    },
    effectiveModel() {
      // 如果使用后端代理，直接返回模型名称，不需要转换
      if (this.useBackendProxy) {
        return this.model;
      }
      
      if (this.apiUrl === 'https://api.deepseek.com/v1/chat/completions') {
        if (this.model === 'deepseek-ai/DeepSeek-R1') {
          return 'deepseek-reasoner';
        } else if (this.model === 'deepseek-ai/DeepSeek-V3') {
          return 'deepseek-chat';
        }
      } else if (this.apiUrl === 'https://ark.cn-beijing.volces.com/api/v3/chat/completions') {
        if (this.model === 'deepseek-ai/DeepSeek-R1') {
          return 'deepseek-r1-250120';
        } else if (this.model === 'deepseek-ai/DeepSeek-V3') {
          return 'deepseek-v3-241226';
        }
      }
      return this.model;
    }
  },
  created() {
    const savedHistory = localStorage.getItem('bs2_chat_history')
    if (savedHistory) {
      this.chatHistory = JSON.parse(savedHistory)
      if (this.chatHistory.length > 0) {
        this.currentChatId = this.chatHistory[0].id
      }
    }
    if (!this.currentChatId) {
      this.createNewChat()
    }
    this.models = listModelsByProvider(this.provider, this.useBackendProxy);
    if (this.provider === 'gemini' && !this.model) this.model = this.models[0];
    // 对于 DeepSeek，如果模型不在列表中，也选择第一个
    if (this.provider === 'deepseek' && !this.models.includes(this.model)) this.model = this.models[0];
    // 若启用了后端代理，初始化时强制将 apiUrl 指向后端代理地址，避免误用直连官方地址
    if (this.useBackendProxy) {
      this.apiUrl = this.provider === 'gemini' ? this.backendUrlGemini : this.backendUrlDeepseek;
      this.apiKey = '';
    }
  },
  mounted() {
    // 滚动监听现在由 MessageList 组件处理
  },
  unmounted() {
    // 清理工作现在由各组件自己处理
  },
  watch: {
    showSidebar(newVal) {
      document.body.style.overflow = newVal ? 'hidden' : '';
    },
    useBackendProxy() {
      // 当后端代理设置改变时，重新加载模型列表
      this.models = listModelsByProvider(this.provider, this.useBackendProxy);
      // 如果当前选择的模型不在新的模型列表中，选择第一个
      if (!this.models.includes(this.model)) {
        this.model = this.models[0];
      }
    }
  },
  methods: {
    saveApiKey() {
      if (this.provider === 'gemini') {
        localStorage.setItem('bs2_gemini_api_key', this.apiKey)
      } else {
        localStorage.setItem('bs2_deepseek_api_key', this.apiKey)
      }
    },
    onProviderChanged() {
      localStorage.setItem('bs2_provider', this.provider);
      this.models = listModelsByProvider(this.provider, this.useBackendProxy);
      if (this.provider === 'gemini') {
        this.apiUrl = this.useBackendProxy ? this.backendUrlGemini : '';
        this.apiKey = this.useBackendProxy ? '' : (localStorage.getItem('bs2_gemini_api_key') || localStorage.getItem('gemini_api_key') || '');
        if (!this.models.includes(this.model)) this.model = this.models[0];
      } else {
        this.apiUrl = this.useBackendProxy
          ? this.backendUrlDeepseek
          : (localStorage.getItem('bs2_api_url') || localStorage.getItem('api_url') || 'https://api.siliconflow.cn/v1/chat/completions');
        this.apiKey = this.useBackendProxy ? '' : (localStorage.getItem('bs2_deepseek_api_key') || localStorage.getItem('deepseek_api_key') || '');
        if (!this.models.includes(this.model)) this.model = this.models[0];
      }
    },
    saveApiUrl() {
      localStorage.setItem('bs2_api_url', this.apiUrl);
    },
    saveUseBackendProxy() {
      localStorage.setItem('bs2_use_backend_proxy', JSON.stringify(this.useBackendProxy));
    },
    saveBackendUrls() {
      localStorage.setItem('bs2_backend_url_deepseek', this.backendUrlDeepseek);
      localStorage.setItem('bs2_backend_url_gemini', this.backendUrlGemini);
    },
    saveModel() {
      localStorage.setItem('bs2_model', this.model)
    },
    saveDefaultHideReasoning() {
      localStorage.setItem('bs2_default_hide_reasoning', JSON.stringify(this.defaultHideReasoning));
    },
    saveAutoCollapseReasoning() {
      localStorage.setItem('bs2_auto_collapse_reasoning', JSON.stringify(this.autoCollapseReasoning));
    },
    createNewChat() {
      const newChat = {
        id: Date.now(),
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString()
      }
      this.chatHistory.unshift(newChat)
      this.currentChatId = newChat.id
      this.saveChatHistory()
      this.showSidebar = false
    },
    switchChat(chatId) {
      this.currentChatId = chatId;
      this.showSidebar = false;
      this.$nextTick(() => {
        this.handleContainerScroll();
      });
    },
    deleteChat(chatId) {
      const index = this.chatHistory.findIndex(chat => chat.id === chatId)
      if (index !== -1) {
        this.chatHistory.splice(index, 1)
        if (this.chatHistory.length === 0) {
          this.createNewChat()
        } else {
          this.currentChatId = this.chatHistory[0].id
        }
        this.saveChatHistory()
      }
    },
    saveChatHistory() {
      localStorage.setItem('bs2_chat_history', JSON.stringify(this.chatHistory))
    },
    focusInput() {
      this.$refs.inputFooter.focus()
    },
    updateChatTitle(message) {
      if (!this.currentChat.title || this.currentChat.title === '新对话') {
        this.currentChat.title = message.slice(0, 10) + (message.length > 10 ? '...' : '')
        this.saveChatHistory()
      }
    },
    toggleReasoning(index) {
      this.currentChat.messages[index].isReasoningCollapsed =
        !this.currentChat.messages[index].isReasoningCollapsed;
      this.saveChatHistory();
    },
    scrollToBottom() {
      if (this.$refs.messageList) {
        this.$refs.messageList.scrollToBottom();
      }
    },
    async sendMessage(isRegenerate = false) {
      console.log('[DEBUG] sendMessage called, isRegenerate:', isRegenerate);
      console.log('[DEBUG] Current state - isLoading:', this.isLoading, 'inputMessage:', this.inputMessage);
      console.log('[DEBUG] Backend proxy mode:', this.useBackendProxy);
      
      this.abortController = new AbortController();
      
      if (isRegenerate) {
        console.log('[DEBUG] Regenerating message, removing assistant messages');
        while (
          this.currentChat.messages.length > 0 &&
          this.currentChat.messages[this.currentChat.messages.length - 1].role !== 'user'
        ) {
          this.currentChat.messages.pop();
        }
        this.saveChatHistory();
      } else {
        if (!this.inputMessage.trim() || this.isLoading) {
          console.log('[DEBUG] Early return - empty message or loading');
          return;
        }
        const message = this.inputMessage.trim();
        console.log('[DEBUG] Sending user message:', message);
        this.inputMessage = '';
        this.updateChatTitle(message);
        const userMessage = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        };
        this.currentChat.messages.push(userMessage);
        console.log('[DEBUG] User message added to chat, total messages:', this.currentChat.messages.length);
      }

      if (this.autoCollapseReasoning && !isRegenerate) {
        this.currentChat.messages.forEach(msg => {
          if (msg.role === 'assistant' && !msg.isReasoningCollapsed) {
            msg.isReasoningCollapsed = true;
          }
        });
      }

      // 整理当前对话中的消息
      const requestMessages = this.currentChat.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      console.log('[DEBUG] Request messages prepared:', requestMessages);

      try {
        this.isLoading = true;
        this.isTyping = true;
        this.errorMessage = '';
        console.log('[DEBUG] Starting AI request with provider:', this.provider);

        // 创建 assistant 消息用于实时展示，但暂不直接插入到聊天记录中，
        // 确保传给 AI 的消息最后一条为用户消息，等首次接收到流数据时再插入 assistant 消息。
        const assistantMessage = {
          role: 'assistant',
          content: '',
          reasoning_content: '',
          isReasoningCollapsed: this.defaultHideReasoning,
          timestamp: new Date().toISOString()
        };
        let assistantMessagePushed = false;
        console.log('[DEBUG] Assistant message template created:', assistantMessage);

        // 调用工具类发起 AI 模型请求（流式返回）
        const requestStartedAt = Date.now();
        const finalModelToUse = this.provider === 'gemini'
          ? (this.useBackendProxy ? `${this.model}-streaming:thinking` : this.model)
          : this.effectiveModel;
        console.log('[DEBUG] Final model for request:', finalModelToUse, 'apiUrl:', this.apiUrl, 'useBackendProxy:', this.useBackendProxy);

        let onChunkCount = 0;
        let firstChunkTimer = setTimeout(() => {
          console.warn('[DEBUG] No first chunk within 8000ms', {
            provider: this.provider,
            apiUrl: this.apiUrl,
            model: finalModelToUse,
            useBackendProxy: this.useBackendProxy,
            elapsedMs: Date.now() - requestStartedAt
          });
        }, 8000);
        console.log('[DEBUG] First-chunk watchdog started for 8000ms');

        await callAiModel({
          provider: this.provider,
          apiUrl: this.apiUrl,
          apiKey: this.apiKey,
          model: finalModelToUse,
          messages: requestMessages,
          temperature: this.temperature,
          maxTokens: 4096,
          signal: this.abortController.signal,
          onChunk: (updatedMessage) => {
            onChunkCount += 1;
            if (firstChunkTimer) {
              clearTimeout(firstChunkTimer);
              firstChunkTimer = null;
              console.log('[DEBUG] First chunk watchdog cleared at onChunk #', onChunkCount, 'latency (ms):', Date.now() - requestStartedAt);
            }
            const contentLen = (updatedMessage && updatedMessage.content) ? updatedMessage.content.length : 0;
            const reasoningLen = (updatedMessage && updatedMessage.reasoning_content) ? updatedMessage.reasoning_content.length : 0;
            console.log('[DEBUG] onChunk #', onChunkCount, 'contentLen:', contentLen, 'reasoningLen:', reasoningLen);

            // 当首次收到数据时，将 assistant 消息插入到聊天记录中
            if (!assistantMessagePushed) {
              console.log('[DEBUG] First chunk received, pushing assistant message to chat');
              this.currentChat.messages.push(assistantMessage);
              assistantMessagePushed = true;
            }
            Object.assign(assistantMessage, updatedMessage);
            this.currentChat.messages = [...this.currentChat.messages];
            this.scrollToBottom();
          }
        });
        if (firstChunkTimer) {
          clearTimeout(firstChunkTimer);
          firstChunkTimer = null;
          console.log('[DEBUG] First-chunk watchdog cleared in success completion');
        }
        console.log('[DEBUG] AI request completed successfully');
        this.saveChatHistory();
      } catch (error) {
        console.error('[DEBUG] AI request failed:', error);
        if (error.name === 'AbortError') {
          console.log('[DEBUG] Request was aborted');
          this.$message({
            message: '生成已取消',
            type: 'info',
            duration: 2000
          });
        } else {
          console.error('[DEBUG] Request error details:', error.message);
          this.errorMessage = `请求失败: ${error.message}`;
          if (this.currentChat.messages.length > 0 &&
              this.currentChat.messages[this.currentChat.messages.length - 1].role === 'assistant') {
            console.log('[DEBUG] Removing last assistant message due to error');
            this.currentChat.messages.pop();
          }
        }
      } finally {
        // 确保在异常路径也清理首块计时器
        try {
          if (typeof firstChunkTimer !== 'undefined' && firstChunkTimer) {
            clearTimeout(firstChunkTimer);
            console.log('[DEBUG] First-chunk watchdog cleared in finally');
          }
        } catch (_) {}
        console.log('[DEBUG] sendMessage finally block - setting loading states to false');
        this.isLoading = false;
        this.isTyping = false;
      }
    },
    renderMarkdown(content) {
      if (!content) return '';
      try {
        const renderer = new marked.Renderer();
        renderer.del = (text) => `~${text}~`;
        return marked.parse(content, { renderer });
      } catch (error) {
        console.error('Markdown 渲染错误:', error);
        return content;
      }
    },
    async copyMessage(content) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(content);
          this.$message({
            message: '复制成功',
            type: 'success',
            duration: 2000
          });
        } catch (err) {
          this.fallbackCopy(content);
        }
      } else {
        this.fallbackCopy(content);
      }
    },
    fallbackCopy(content) {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          this.$message({
            message: '复制成功',
            type: 'success',
            duration: 2000
          });
        } else {
          this.$message({
            message: '复制失败，请手动复制或使用编辑功能然后全选复制',
            type: 'error',
            duration: 2000
          });
        }
      } catch (error) {
        this.$message({
          message: '复制失败，请手动复制或使用编辑功能然后全选复制',
          type: 'error',
          duration: 2000
        });
      }
      document.body.removeChild(textarea);
    },
    async exportToPDF() {
      try {
        await exportChatToPDF(this.currentChat, this.renderMarkdown);
        this.$message({
          message: 'PDF导出成功',
          type: 'success',
          duration: 2000
        });
      } catch (error) {
        console.error('PDF 导出失败:', error);
        this.$message({
          message: 'PDF导出失败',
          type: 'error',
          duration: 2000
        });
      }
    },
    confirmDelete() {
      console.log('confirmDelete called for chat id =', this.currentChatId)
      this.$confirm('确定删除该对话吗？', '确认删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          console.log('User confirmed delete')
          this.deleteChat(this.currentChatId)
        })
        .catch(() => {
          console.log('User canceled delete')
        })
    },

    openScriptPanel() {
      console.log('[App] openScriptPanel clicked, setting showScriptPanel to true');
      this.showScriptPanel = true;
    },
    selectScript(script) {
      console.log('[App] script selected:', script);
      confirmUseScript(script)
        .then(finalScript => {
          this.inputMessage = finalScript;
          this.showScriptPanel = false;
          this.$nextTick(() => {
            this.focusInput();
          });
        })
        .catch(error => {
          console.warn('剧本选择已取消或发生错误:', error);
        });
    },
    joinGroup(groupName) {
      let url = ''
      if (groupName === '软件群') {
        url = 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=PIlY1ohFyAaT_kUWnu3MBV0I4B5bKkth&authKey=VAPHwBjqO27MTXwN5k9OsZAp9BulERgk5DHA2Wo%2BxZKbz1RAgjCXXK9NHM3PZ0T0&noverify=0&group_code=1028832603'
      } else if (groupName === '作者粉丝群') {
        url = 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=wnanEY5EFnmZkgsxB8Ekm3_rF0wEfC-m&authKey=unYZXpjELI9S9BFaLyKZssgbItkEPNnDcaYJ0jOn7Vdk4UGJZNw97wBpML6QW8hV&noverify=0&group_code=1028122611'
      }
      if (url) {
        window.open(url, '_blank')
      }
    },
    confirmDeleteMessage(index) {
      this.$confirm('确定删除这条消息吗？', '确认删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.deleteMessage(index);
        this.$message({
          message: '消息已删除',
          type: 'success',
          duration: 2000
        });
      }).catch(() => {
      });
    },
    deleteMessage(index) {
      this.currentChat.messages.splice(index, 1);
      this.saveChatHistory();
    },
    enableEditMessage(index) {
      this.editingMessage = {
        index: index,
        content: this.currentChat.messages[index].content
      };
      this.showEditDialog = true;
    },

    saveEditedMessageDialog(editedContent) {
      if (editedContent) {
        this.currentChat.messages[this.editingMessage.index].content = editedContent;
        this.saveChatHistory();
        this.$message({
          message: '消息已更新',
          type: 'success',
          duration: 2000
        });
        this.showEditDialog = false;
        this.editingMessage = { index: null, content: '' };
      }
    },
    confirmRegenerateMessage() {
      const messages = this.currentChat && this.currentChat.messages ? this.currentChat.messages : [];
      if (messages.length === 0) return;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        this.sendMessage(true);
        return;
      }
      this.$confirm(
        '确定重新生成这条消息吗？目前这里与官方APP不一样，此操作将永久删除当前消息。',
        '确认重新生成',
        {
          confirmButtonText: '重新生成',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
        .then(() => {
          this.sendMessage(true);
        })
        .catch(() => {
        });
    },
    exportChatArchive() {
      try {
        const jsonData = JSON.stringify(this.chatHistory, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.$message({
          message: '存档已导出',
          type: 'success',
          duration: 2000
        });
      } catch (error) {
        this.$message({
          message: '导出存档失败',
          type: 'error',
          duration: 2000
        });
      }
    },
    importChatArchive(mode) {
      this.importMode = mode;
      this.$refs.importFile.click();
    },
    handleImportFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        let importedData = null;
        try {
          importedData = parseArchiveJson(e.target.result);
        } catch (err) {
          this.$message({
            message: '无法解析文件，请确认文件格式正确。',
            type: 'error',
            duration: 2000
          });
          return;
        }
        if (this.importMode === 'overwrite') {
          this.chatHistory = importedData;
          if (this.chatHistory.length > 0) {
            this.currentChatId = this.chatHistory[0].id;
          } else {
            this.createNewChat();
          }
          this.$message({
            message: '存档已覆盖',
            type: 'success',
            duration: 2000
          });
        } else if (this.importMode === 'merge') {
          mergeImportedChats(importedData, this.chatHistory);
          if (!this.currentChatId && this.chatHistory.length > 0) {
            this.currentChatId = this.chatHistory[0].id;
          }
          this.$message({
            message: '存档已合并',
            type: 'success',
            duration: 2000
          });
        }
        this.saveChatHistory();
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    changeChatTitle({ id, title }) {
      const chat = this.chatHistory.find(c => c.id === id);
      if (chat) {
        chat.title = title;
        this.saveChatHistory();
      }
    },
    toggleSidebar() {
      this.showSidebar = !this.showSidebar;
    },
    saveTemperature() {
      localStorage.setItem('bs2_temperature', this.temperature.toString());
    },
    handleContainerScroll() {
      // 这个方法现在由 MessageList 组件处理
    },
    scrollToBottomManual() {
      if (this.$refs.messageList) {
        this.$refs.messageList.scrollToBottomManual();
      }
    },

    cancelRequest() {
      this.cancelled = true;
      if (this.abortController) {
        this.abortController.abort();
      }
    },
    handleToolboxCommand(command) {
      console.log("Received toolbox command:", command);
      if (command === 'copyChat') {
        this.copyCurrentChat();
      } else if (command === 'localScriptEditor') {
        this.showLocalScriptEditor = true;
      } else if (command === 'exportTxtNovel') {
        this.showTxtNovelExporter = false;
        this.$nextTick(() => {
          this.showTxtNovelExporter = true;
        });
      } else if (command === 'markdownTool') {
        this.showMarkdownTool = true;
      }
    },
    generateCopyTitle(originalTitle) {
      let baseTitle = originalTitle;
      while (baseTitle.endsWith(COPY_SUFFIX)) {
        baseTitle = baseTitle.slice(0, -COPY_SUFFIX.length);
      }
      if (baseTitle.length > MAX_TITLE_LENGTH - COPY_SUFFIX.length) {
        baseTitle = baseTitle.slice(0, MAX_TITLE_LENGTH - COPY_SUFFIX.length);
      }
      return baseTitle + COPY_SUFFIX;
    },
    copyCurrentChat() {
      if (!this.currentChat) return;
      const newChat = {
        id: Date.now(),
        title: this.generateCopyTitle(this.currentChat.title),
        messages: JSON.parse(JSON.stringify(this.currentChat.messages)),
        createdAt: new Date().toISOString()
      };
      this.chatHistory.unshift(newChat);
      this.currentChatId = newChat.id;
      this.saveChatHistory();
      this.$message({
        message: '对话已复制',
        type: 'success',
        duration: 2000
      });
    },

    openExternalLink(url) {
      window.open(url, '_blank');
    },
  }
}
</script>

<style src="./index.css"></style>

<style>
.reasoning-body.collapsed {
  display: none;
}

.qq-groups .el-button {
  margin-bottom: 10px;
}
.qq-groups .el-button:last-child {
  margin-bottom: 0;
}
</style> 