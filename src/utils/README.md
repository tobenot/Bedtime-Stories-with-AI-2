# Utils 工具库

本目录包含项目中可复用的工具函数和类。

## 模式开发工具 (Mode Helpers)

位于 `modeHelpers.js`，专为插件模式开发提供的实用工具集。

### 快速导入

```javascript
import { 
  createStreamJsonParser,
  createThrottle,
  createScrollManager,
  createMetadataManager,
  createAbortManager 
} from '@/utils/modeHelpers';
```

### 工具列表

| 工具 | 文件 | 用途 |
|------|------|------|
| StreamJsonParser | streamJsonParser.js | 解析流式JSON响应 |
| ThrottleManager | throttleHelper.js | 节流控制，优化性能 |
| ScrollManager | scrollHelper.js | 统一滚动管理 |
| ModeMetadataManager | modeMetadataHelper.js | 模式数据持久化 |
| AbortManager | abortHelper.js | 请求取消管理 |

## 其他工具

- **aiService.js** - AI服务调用（已废弃，请使用 `@/core/services/aiService`）
- **archive.js** - 对话存档导入导出
- **keyManager.js** - API密钥管理
- **markdown.js** - Markdown渲染工具
- **pdfExporter.js** - PDF导出
- **txtExporter.js** - TXT导出
- **scriptPreview.js** - 剧本预览

## 提供商工具

位于 `providers/` 目录：
- **deepseek.js** - Deepseek API支持
- **gemini.js** - Gemini API支持

## 使用场景

### 开发新模式插件时

推荐使用以下工具简化开发：

1. **流式JSON解析** - 当AI需要返回结构化数据时
2. **节流管理** - 优化流式更新的性能
3. **元数据管理** - 保存模式特定状态（好感度、等级等）
4. **中止管理** - 统一处理请求取消

### 处理用户交互时

- **滚动管理** - 自动滚动到底部，显示滚动按钮
- **键盘管理** - 快捷键处理（TODO）

## 文档

- [模式开发工具使用指南](../../docs/模式开发工具使用指南.md)
- [工具使用示例](../../docs/工具使用示例.md)

## 添加新工具

1. 在 `src/utils/` 创建新文件
2. 导出类和创建函数
3. 在 `modeHelpers.js` 中统一导出
4. 更新本README和使用指南

## 示例代码

```javascript
export default {
  name: 'MyMode',
  data() {
    return {
      jsonParser: createStreamJsonParser(),
      throttleManager: createThrottle(50),
      abortManager: createAbortManager()
    };
  },
  mounted() {
    this.metadataManager = createMetadataManager(this.chat, 'myModeData');
  },
  methods: {
    async handleSend() {
      this.jsonParser.reset();
      const controller = this.abortManager.create();
      
      await callAiModel({
        signal: controller.signal,
        onChunk: (chunk) => {
          this.jsonParser.appendChunk(chunk.content);
          this.throttleManager.execute(() => this.updateUI());
        }
      });
      
      const data = this.jsonParser.parseComplete();
      this.metadataManager.set('lastData', data);
    }
  }
};
```

