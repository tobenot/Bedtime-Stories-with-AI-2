<template>
	<el-drawer v-model="innerShow" title="设置" direction="rtl" size="80%" :destroy-on-close="false" class="settings-drawer">
		<div class="settings-drawer p-4">
			<el-form label-width="80px">
				<el-form-item label="提供商">
					<el-radio-group v-model="innerProvider">
						<el-radio-button label="openai_compatible">兼容OpenAI</el-radio-button>
						<el-radio-button label="gemini">Gemini</el-radio-button>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-if="!innerUseBackendProxy" label="API Key">
					<el-input
						v-model="innerApiKey"
						type="password"
						placeholder="请输入您的API Key"
						show-password
						autocomplete="off"
					></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						<span v-if="innerProvider === 'openai_compatible'">
							请前往&nbsp;
							<a href="https://cloud.siliconflow.cn/i/M9KJQRfy" target="_blank" class="text-secondary underline">硅基流动</a>
							、 <a href="https://platform.deepseek.com/" target="_blank" class="text-secondary underline">Deepseek官网</a>
							或 <a href="https://openrouter.ai/keys" target="_blank" class="text-secondary underline">OpenRouter</a> 获取。
						</span>
						<span v-else>
							请前往 <a href="https://makersuite.google.com/app/apikey" target="_blank" class="text-secondary underline">Google AI Studio</a> 获取。
						</span>
						输入后将安全地存储在您的浏览器中。
						<br/>
						💡 系统会为每个API端点独立保存密钥，切换端点时会自动加载对应的密钥。
					</div>
				</el-form-item>

				<el-form-item v-if="!innerUseBackendProxy" label="API 接口">
					<el-select
						v-model="innerApiUrl"
						filterable
						allow-create
						placeholder="请选择或输入API接口"
					>
						<el-option
							v-for="option in apiUrlOptions"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>
					<div class="mt-1 text-gray-600 text-sm">
						{{ apiUrlHint }}
					</div>
				</el-form-item>

				<el-divider></el-divider>
				<el-form-item label="神秘链接">
					<el-switch v-model="innerUseBackendProxy" active-color="#409EFF" inactive-color="#dcdfe6"></el-switch>
				</el-form-item>
				<el-form-item v-if="innerUseBackendProxy" label="Deepseek神秘链接">
					<el-input v-model="innerBackendUrlDeepseek" placeholder="请输入Deepseek神秘链接完整地址（支持 https://... ）"></el-input>
				</el-form-item>
				<el-form-item v-if="innerUseBackendProxy" label="Gemini神秘链接">
					<el-input v-model="innerBackendUrlGemini" placeholder="请输入Gemini神秘链接完整地址（支持 https://... ）"></el-input>
				</el-form-item>
				
				<el-form-item v-if="innerUseBackendProxy" label="功能密码">
					<el-input
						v-model="innerFeaturePassword"
						type="password"
						placeholder="请输入神秘链接功能密码"
						show-password
						autocomplete="off"
						data-form-type="other"
						data-lpignore="true"
						name="feature-password"
					></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						此密码用于访问神秘链接的权限验证，请联系管理员获取
					</div>
				</el-form-item>

				<el-form-item label="温度">
					<el-slider
						class="custom-slider"
						v-model="innerTemperature"
						:min="0"
						:max="2"
						:step="0.1"
						show-tooltip
					></el-slider>
					<div class="mt-1 text-gray-600 text-sm">
						温度参数决定回答的随机性。较低的温度（如0.3）使回答更确定，而较高的温度（如1）则使回答更具创造性和随机性。玩文游建议0.7，你可以进行尝试。
					</div>
				</el-form-item>

				<el-form-item label="最大长度">
					<el-slider
						class="custom-slider"
						v-model="innerMaxTokens"
						:min="1024"
						:max="32768"
						:step="1024"
						show-tooltip
					></el-slider>
					<div class="mt-1 text-gray-600 text-sm">
						最大生成长度(max_tokens)，限制模型单次生成内容的总量。默认值16384，如果遇到因长度问题导致的输出截断，可以尝试调高此值。注意，不同模型支持的最大值不同。
					</div>
				</el-form-item>

				<el-form-item label="选择模型">
					<el-select v-model="innerModel" class="w-full" placeholder="选择或输入模型" filterable allow-create default-first-option>
						<el-option
							v-for="item in models"
							:key="item"
							:label="item"
							:value="item"
						/>
					</el-select>
					<div class="mt-1 text-gray-600 text-sm">
						可以从列表中选择模型，或者直接输入自定义模型名称。对于自定义API端点，请输入该端点支持的模型名称。
					</div>
				</el-form-item>

				<el-form-item label="Gemini思考">
					<el-radio-group v-model="innerGeminiReasoningEffort">
						<el-radio-button label="high">高</el-radio-button>
						<el-radio-button label="medium">中</el-radio-button>
						<el-radio-button label="low">低</el-radio-button>
						<el-radio-button label="off">关</el-radio-button>
					</el-radio-group>
					<div class="mt-1 text-gray-600 text-sm">
						控制Gemini模型的思考强度。此设置可能也适用于通过兼容OpenAI接口（如神秘链接或OpenRouter）使用的Gemini模型。
					</div>
				</el-form-item>

				<el-form-item label="隐藏思考">
					<el-switch
						v-model="innerDefaultHideReasoning"
						active-color="#409EFF"
						inactive-color="#dcdfe6"
					></el-switch>
					<div class="mt-1 text-gray-600 text-sm">
						&nbsp;&nbsp;开启后，助手的思考过程将默认隐藏，点击图标可展开/折叠。
					</div>
				</el-form-item>

				<el-form-item label="自动折叠">
					<el-switch
						v-model="innerAutoCollapseReasoning"
						active-color="#409EFF"
						inactive-color="#dcdfe6"
					></el-switch>
					<div class="mt-1 text-gray-600 text-sm">
						&nbsp;&nbsp;开启后，每次发送新消息时，之前所有消息的思考过程将自动折叠。
					</div>
				</el-form-item>

				<el-divider></el-divider>
				<el-form-item label="对话存档">
					<div style="display: flex; gap: 10px; flex-wrap: wrap;">
						<el-button size="small" @click="$emit('export-current-chat-archive')">导出当前对话</el-button>
						<el-button size="small" @click="$emit('export-chat-archive')">导出存档</el-button>
						<el-button size="small" @click="$emit('export-chat-titles')">导出对话标题列表</el-button>
						<el-button size="small" type="primary" @click="$emit('import-chat-archive', 'merge')">导入存档（合并）</el-button>
						<el-button size="small" type="danger" @click="$emit('import-chat-archive', 'overwrite')">导入存档（覆盖）</el-button>
					</div>
					<div class="mt-1 text-gray-600 text-sm">
						导出当前对话生成的存档仅支持“合并”导入，不可覆盖。
					</div>
				</el-form-item>
			</el-form>
			<div class="mt-1 text-gray-600 text-sm">
				电脑端可以使用Ctrl+Enter发送消息
			</div>
			<div class="mt-1 text-gray-600 text-sm">
				从现象中推测，硅基流动在单次回复中超过五分钟就会直接截断，可能会导致正文不完整。如果你遇到类似问题，可以尝试让它精简思考长度。
			</div>
			<br>
			<div class="footer p-4 bg-white border-t text-center text-gray-600 text-sm">
				<el-button type="link" @click="$emit('show-author-info')" class="ml-2">
					<el-icon><InfoFilled /></el-icon>
				</el-button>
				作者: <a href="https://tobenot.top/" target="_blank" class="text-secondary hover:underline">tobenot</a> © 2025
			</div>
		</div>
	</el-drawer>
</template>

<script>
import { InfoFilled } from '@element-plus/icons-vue'

export default {
	name: 'SettingsDrawer',
	components: { InfoFilled },
	props: {
		modelValue: { type: Boolean, default: false },
		provider: { type: String, default: 'deepseek' },
		apiKey: { type: String, default: '' },
		apiUrl: { type: String, default: '' },
		useBackendProxy: { type: Boolean, default: false },
		backendUrlDeepseek: { type: String, default: '' },
		backendUrlGemini: { type: String, default: '' },
		featurePassword: { type: String, default: '' },
		temperature: { type: Number, default: 0.7 },
		maxTokens: { type: Number, default: 16384 },
		model: { type: String, default: '' },
		defaultHideReasoning: { type: Boolean, default: false },
		autoCollapseReasoning: { type: Boolean, default: false },
		models: { type: Array, default: () => [] },
		apiUrlOptions: { type: Array, default: () => [] },
		geminiReasoningEffort: { type: String, default: 'high' }
	},
	emits: ['update:modelValue', 'update:provider', 'update:apiKey', 'update:apiUrl', 'update:useBackendProxy', 'update:backendUrlDeepseek', 'update:backendUrlGemini', 'update:featurePassword', 'update:temperature', 'update:maxTokens', 'update:model', 'update:defaultHideReasoning', 'update:autoCollapseReasoning', 'update:geminiReasoningEffort', 'export-chat-archive', 'export-current-chat-archive', 'export-chat-titles', 'import-chat-archive', 'show-author-info'],
	computed: {
		innerShow: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		},
		innerProvider: {
			get() { return this.provider },
			set(v) { this.$emit('update:provider', v) }
		},
		innerApiKey: {
			get() { return this.apiKey },
			set(v) { this.$emit('update:apiKey', v) }
		},
		innerApiUrl: {
			get() { return this.apiUrl },
			set(v) { this.$emit('update:apiUrl', v) }
		},
		innerUseBackendProxy: {
			get() { return this.useBackendProxy },
			set(v) { this.$emit('update:useBackendProxy', v) }
		},
		innerBackendUrlDeepseek: {
			get() { return this.backendUrlDeepseek },
			set(v) { this.$emit('update:backendUrlDeepseek', v) }
		},
		innerBackendUrlGemini: {
			get() { return this.backendUrlGemini },
			set(v) { this.$emit('update:backendUrlGemini', v) }
		},
		innerFeaturePassword: {
			get() { return this.featurePassword },
			set(v) { this.$emit('update:featurePassword', v) }
		},
		innerTemperature: {
			get() { return this.temperature },
			set(v) { this.$emit('update:temperature', v) }
		},
		innerMaxTokens: {
			get() { return this.maxTokens },
			set(v) { this.$emit('update:maxTokens', v) }
		},
		innerModel: {
			get() { return this.model },
			set(v) { this.$emit('update:model', v) }
		},
		innerGeminiReasoningEffort: {
			get() { return this.geminiReasoningEffort },
			set(v) { this.$emit('update:geminiReasoningEffort', v) }
		},
		innerDefaultHideReasoning: {
			get() { return this.defaultHideReasoning },
			set(v) { this.$emit('update:defaultHideReasoning', v) }
		},
		innerAutoCollapseReasoning: {
			get() { return this.autoCollapseReasoning },
			set(v) { this.$emit('update:autoCollapseReasoning', v) }
		},
		apiUrlHint() {
			if (this.apiUrl === 'https://api.siliconflow.cn/v1/chat/completions') {
				return '当前选择的是硅基流动接口 请使用硅基流动的Key'
			} else if (this.apiUrl === 'https://api.deepseek.com/v1/chat/completions') {
				return '当前选择的是Deepseek官方接口 请使用Deepseek官网的Key'
			} else if (this.apiUrl === 'https://ark.cn-beijing.volces.com/api/v3/chat/completions') {
				return '当前选择的是火山引擎接口 请使用火山引擎的Key'
			} else if (this.apiUrl === 'https://openrouter.ai/api/v1/chat/completions') {
				return '当前选择的是OpenRouter接口 请使用OpenRouter的Key'
			} else if (this.apiUrl === 'https://api.lmrouter.com/openai/v1' || (this.apiUrl && this.apiUrl.includes('lmrouter.com'))) {
				return '当前选择的是LMRouter接口 请使用LMRouter的Key 并在模型列表中输入或选择对应的模型名称'
			} else if (this.apiUrl && this.apiUrl.includes('/gemini')) {
				return '当前选择的是神秘链接的Gemini接口，请使用你的Gemini Key或服务端配置的Key'
			} else if (this.apiUrl && this.apiUrl.includes('/deepseek')) {
				return '当前选择的是神秘链接的DeepSeek接口，请使用你的DeepSeek Key或服务端配置的Key'
			} else if (this.apiUrl) {
				return '自定义API端点，请确保使用兼容OpenAI的接口格式，并在模型列表中输入正确的模型名称'
			} else {
				return ''
			}
		}
	}
}
</script>

<style scoped>
.custom-slider .el-slider__runway {
	height: 8px;
	border-radius: 4px;
	background-color: #dcdfe6;
}
.custom-slider .el-slider__bar {
	height: 8px;
	border-radius: 4px;
	background-color: #409EFF;
}
.custom-slider .el-slider__button {
	width: 16px;
	height: 16px;
	border-radius: 50%;
	border: none;
	background-color: #409EFF;
	box-shadow: none;
}
</style>
