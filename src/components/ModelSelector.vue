<template>
  <div class="model-selector bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
    <div class="flex items-center justify-center max-w-6xl mx-auto">
      <div class="flex items-center gap-3">
        <span class="text-sm text-primary font-medium">模型:</span>
        <el-select 
          :model-value="selectedModel" 
          @update:model-value="handleModelChange"
          placeholder="选择模型"
          class="model-select"
          size="small"
          style="min-width: 200px;"
        >
          <el-option
            v-for="modelOption in models"
            :key="modelOption"
            :label="getModelDisplayName(modelOption)"
            :value="modelOption"
          />
        </el-select>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ModelSelector',
  props: {
    selectedModel: {
      type: String,
      required: true
    },
    models: {
      type: Array,
      required: true
    }
  },
  emits: ['update:model'],
  methods: {
    handleModelChange(value) {
      this.$emit('update:model', value);
    },
    getModelDisplayName(model) {
      // 简化模型显示名称，去掉一些前缀
      if (model.startsWith('deepseek-ai/')) {
        return model.replace('deepseek-ai/', '');
      }
      if (model.startsWith('google/')) {
        return model.replace('google/', '');
      }
      if (model.startsWith('anthropic/')) {
        return model.replace('anthropic/', '');
      }
      if (model.startsWith('openai/')) {
        return model.replace('openai/', '');
      }
      if (model.startsWith('x-ai/')) {
        return model.replace('x-ai/', '');
      }
      if (model.startsWith('deepseek/')) {
        return model.replace('deepseek/', '');
      }
      return model;
    }
  }
}
</script>

<style scoped>
.model-selector {
  transition: all 0.2s ease;
  border-bottom: 1px solid #e5e7eb;
}

.model-select {
  --el-select-border-color-hover: #805AD5;
  --el-select-border-color: #d1d5db;
}

.model-select :deep(.el-input__wrapper) {
  border-radius: 6px;
  border: 1px solid #d1d5db;
  transition: all 0.2s ease;
}

.model-select :deep(.el-input__wrapper:hover) {
  border-color: #805AD5;
}

.model-select :deep(.el-input__wrapper.is-focus) {
  border-color: #805AD5;
  box-shadow: 0 0 0 2px rgba(128, 90, 213, 0.2);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .model-selector {
    padding: 12px 16px;
  }
  
  .model-select {
    min-width: 100% !important;
  }
}

@media (max-width: 480px) {
  .model-selector {
    padding: 8px 12px;
  }
  
  .model-selector > div > div {
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
}
</style>