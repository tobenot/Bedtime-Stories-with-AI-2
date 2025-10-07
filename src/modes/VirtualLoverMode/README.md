# 虚拟恋人模式

## 文件结构

```
VirtualLoverMode/
├── index.vue                 # 主组件
├── plugin.js                 # 插件配置
├── components/               # 子组件
│   ├── CharacterStatus.vue   # 角色状态组件
│   └── FavorabilityPanel.vue # 好感度面板组件
├── styles/                   # 样式文件
│   ├── index.css            # 样式入口文件
│   ├── mixins.css           # 样式混入和工具类
│   ├── virtual-lover.css    # 主样式
│   ├── favorability-panel.css # 好感度面板样式
│   └── character-status.css # 角色状态样式
├── utils/                    # 工具函数
│   ├── constants.js         # 常量定义
│   └── helpers.js           # 工具函数
└── README.md                # 说明文档
```

## 架构优化

### 1. 样式与逻辑分离
- **样式文件独立**: 所有样式都提取到独立的CSS文件中
- **样式混入**: 创建了可复用的样式混入和工具类
- **统一入口**: 通过 `styles/index.css` 统一管理所有样式

### 2. 工具函数模块化
- **常量定义**: 将角色配置、表情映射、动作映射等提取到 `constants.js`
- **工具函数**: 将数据处理、状态管理等逻辑提取到 `helpers.js`
- **可复用性**: 工具函数可以在多个组件中复用

### 3. 组件结构优化
- **主组件简化**: 移除内联样式，使用工具函数处理逻辑
- **子组件优化**: 子组件也使用工具函数，减少重复代码
- **配置驱动**: 通过配置文件管理角色信息，便于维护

## 主要特性

### 响应式设计
- 支持桌面、平板、手机多种屏幕尺寸
- 横屏手机特殊适配
- 移动端快捷操作按钮

### 视觉设计
- 毛玻璃效果
- 渐变背景
- 平滑动画过渡
- 悬停交互效果

### 功能特性
- 好感度系统
- 角色状态显示
- 实时打字指示器
- 流式输出支持

## 使用说明

### 样式定制
可以通过修改 `styles/` 目录下的CSS文件来自定义样式：

- `mixins.css`: 添加新的样式混入和工具类
- `virtual-lover.css`: 修改主布局样式
- `favorability-panel.css`: 自定义好感度面板样式
- `character-status.css`: 自定义角色状态样式

### 配置修改
可以通过修改 `utils/constants.js` 来调整配置：

- `CHARACTER_CONFIG`: 角色基本信息
- `EMOTION_MAP`: 表情映射
- `ACTION_MAP`: 动作映射
- `FAVORABILITY_LEVELS`: 好感度等级
- `SYSTEM_PROMPT`: AI系统提示词

### 功能扩展
可以通过修改 `utils/helpers.js` 来添加新的工具函数：

- 数据处理函数
- 状态管理函数
- 动画控制函数
- 其他辅助函数

## 开发建议

1. **样式修改**: 优先使用样式混入和工具类，避免重复代码
2. **逻辑处理**: 将复杂逻辑提取到工具函数中，保持组件简洁
3. **配置管理**: 使用常量文件管理配置，便于维护和修改
4. **响应式设计**: 考虑不同屏幕尺寸的用户体验
5. **性能优化**: 合理使用防抖和节流函数

## 兼容性

- Vue 3.x
- Element Plus
- 现代浏览器 (Chrome, Firefox, Safari, Edge)
- 移动端浏览器
