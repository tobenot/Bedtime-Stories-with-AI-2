<template>
	<el-drawer
		v-model="innerShow"
		direction="rtl"
		size="min(560px, 94vw)"
		:with-header="false"
		:destroy-on-close="false"
		class="settings-drawer"
	>
		<div class="settings-panel">
			<!-- 顶部栏：标题 + 更新日志入口 + 关闭 -->
			<header class="settings-header">
				<h2 class="settings-title">设置</h2>
				<div class="settings-header-actions">
					<button type="button" class="changelog-link" @click="$emit('show-changelog')">
						<span>✨ 更新日志</span>
						<el-icon><ArrowRight /></el-icon>
					</button>
					<button type="button" class="settings-close" aria-label="关闭设置" @click="innerShow = false">
						<el-icon><Close /></el-icon>
					</button>
				</div>
			</header>

			<div class="settings-body">
				<!-- ============ 接入 ============ -->
				<section class="settings-section">
					<div class="section-head">
						<div class="section-title">接入</div>
						<div class="section-desc">选择服务来源，配置密钥或功能密码</div>
					</div>
					<div class="section-body">
						<div class="setting-item">
							<div class="setting-label">接入预设</div>
							<el-select v-model="innerPresetId" class="w-full" placeholder="选择预设" filterable @change="onPresetSelected">
								<el-option-group label="直连预设">
									<el-option
										v-for="p in directPresets"
										:key="p.id"
										:label="p.label"
										:value="p.id"
									/>
								</el-option-group>
								<el-option-group label="后端代理">
									<el-option
										v-for="p in proxyPresets"
										:key="p.id"
										:label="p.label"
										:value="p.id"
									/>
								</el-option-group>
								<el-option-group v-if="customPresets.length > 0" label="自定义预设">
									<el-option
										v-for="p in customPresets"
										:key="p.id"
										:label="p.label"
										:value="p.id"
									/>
								</el-option-group>
							</el-select>
							<div class="setting-hint">{{ presetHint }}</div>
						</div>

						<!-- API Key（非 password authMode 才显示；免密钥预设可留空） -->
											<div v-if="!isCurrentPresetProxy" class="setting-item">
												<div class="setting-label">API Key</div>
												<SecretTextInput
													v-model="innerApiKey"
													:placeholder="apiKeyPlaceholder"
													field-name="bs2-field-a"
												/>
												<div class="setting-hint">
													{{ apiKeyHint }}
													<br />
													💡 系统会为每个预设独立保存密钥，切换预设时会自动加载对应的密钥。
												</div>
											</div>

						<!-- 邀请注册链接（预设配置了 affiliateUrl 时显示） -->
						<div
							v-if="!isCurrentPresetProxy && currentPreset && currentPreset.affiliateUrl"
							class="setting-item"
						>
							<div class="setting-label">邀请注册</div>
							<AffiliateLink :url="currentPreset.affiliateUrl" />
						</div>

						<!-- 功能密码（代理预设才显示） -->
						<div v-if="isCurrentPresetProxy" class="setting-item">
							<div class="setting-label">功能密码</div>
							<SecretTextInput
								v-model="innerFeaturePassword"
								placeholder="请输入功能密码"
								field-name="bs2-field-b"
							/>
							<div class="setting-hint">此密码用于访问后端代理的权限验证，请联系管理员获取</div>
						</div>

						<!-- 可编辑服务地址（代理预设 + 本机模型预设） -->
											<div v-if="showEditableBaseUrl" class="setting-item">
												<div class="setting-label">{{ isCurrentPresetProxy ? '代理地址' : '服务地址' }}</div>
												<el-input v-model="innerProxyBaseUrl" :placeholder="isCurrentPresetProxy ? '请输入代理完整地址' : '请输入本机 OpenAI 兼容地址（如 http://127.0.0.1:8090/v1）'" />
												<div class="setting-hint">
													{{ isCurrentPresetProxy
														? '当前代理预设的后端地址，修改后自动保存'
														: '修改服务地址后自动保存。本机/局域网 OpenAI 兼容服务需开启跨域(CORS)才能访问：Ollama、LM Studio 默认支持；其余（vLLM / llama.cpp / TabbyAPI 等）依据配置，必要时加 --cors origin * 或用本地反代。' }}
												</div>
											</div>

						<div class="setting-item">
							<div class="setting-label">自定义预设</div>
							<div class="button-row">
								<el-button size="small" type="primary" @click="showAddCustomPreset = true">新建自定义预设</el-button>
								<el-button v-if="isCurrentPresetCustom" size="small" @click="editCurrentCustomPreset">编辑当前预设</el-button>
								<el-button v-if="isCurrentPresetCustom" size="small" type="danger" plain @click="confirmDeleteCurrentPreset">删除当前预设</el-button>
							</div>
						</div>
					</div>
				</section>

				<!-- ============ 模型与生成 ============ -->
				<section class="settings-section">
					<div class="section-head">
						<div class="section-title">模型与生成</div>
						<div class="section-desc">模型选择、采样参数与接口格式</div>
					</div>
					<div class="section-body">
						<div class="setting-item">
							<div class="setting-label">选择模型</div>
							<el-select v-model="innerModel" class="w-full" placeholder="选择或输入模型" filterable allow-create default-first-option>
								<el-option
									v-for="item in models"
									:key="item"
									:label="item"
									:value="item"
								/>
							</el-select>
													<div v-if="canRefreshModels" class="button-row fetch-models-row">
														<el-button size="small" :loading="refreshingModels" :disabled="!currentPresetRuntimeBaseUrl" @click="refreshModelsForCurrentPreset">
															🔄 从服务器拉取模型
														</el-button>
														<span v-if="refreshModelStatus" class="fetch-model-status" :class="refreshModelStatusClass">
															{{ refreshModelStatus }}
														</span>
													</div>
													<div class="setting-hint">
														{{ modelSelectHint }}
													</div>
												</div>

						<div v-if="showRequestFormat" class="setting-item">
							<div class="setting-label">API 格式</div>
							<el-radio-group
								v-model="innerRequestFormat"
								:disabled="isRequestFormatLocked"
								size="small"
								class="request-format-group"
							>
								<el-radio-button label="auto">自动</el-radio-button>
								<el-radio-button label="chat_completions">Chat Completions</el-radio-button>
								<el-radio-button label="anthropic_messages">Anthropic Messages</el-radio-button>
								<el-radio-button label="responses">Responses</el-radio-button>
							</el-radio-group>
							<div class="setting-hint">{{ requestFormatHint }}</div>
						</div>

						<div v-if="showResponsesTools" class="setting-item">
							<div class="setting-label">Responses 工具</div>
							<div class="responses-tools-list">
								<div
									v-for="tool in responsesToolsUi"
									:key="tool.type"
									class="responses-tool-row"
									:class="{ 'is-unavailable': !tool.available }"
								>
									<el-switch
										:model-value="isResponsesToolEnabled(tool.type)"
										:disabled="!tool.available"
										size="small"
										@change="(on) => setResponsesToolEnabled(tool.type, on)"
									/>
									<span class="responses-tool-label">{{ tool.label }}</span>
									<span class="responses-tool-type">{{ tool.type }}</span>
									<span v-if="!tool.available && tool.unavailableHint" class="responses-tool-hint">
										{{ tool.unavailableHint }}
									</span>
								</div>
							</div>
							<div class="setting-hint">
								仅在 API 格式为 Responses 时生效。模型按需调用；DeepSeek 目前仅网络搜索可服务端执行。
							</div>
						</div>

						<div class="setting-item">
							<div class="setting-label">Gemini 思考强度</div>
							<el-radio-group v-model="innerGeminiReasoningEffort" size="small">
								<el-radio-button label="high">高</el-radio-button>
								<el-radio-button label="medium">中</el-radio-button>
								<el-radio-button label="low">低</el-radio-button>
								<el-radio-button label="off">关</el-radio-button>
							</el-radio-group>
							<div class="setting-hint">
								控制Gemini模型的思考强度。此设置可能也适用于通过兼容OpenAI接口（如后端代理或OpenRouter）使用的Gemini模型。
							</div>
						</div>

						<div class="setting-item">
							<div class="setting-item-head">
								<div class="setting-label">温度</div>
								<span class="setting-value">{{ Number(innerTemperature).toFixed(1) }}</span>
							</div>
							<el-slider
								class="custom-slider"
								v-model="innerTemperature"
								:min="0"
								:max="2"
								:step="0.1"
								show-tooltip
							/>
							<div class="setting-hint">
								温度参数决定回答的随机性。较低的温度（如0.3）使回答更确定，而较高的温度（如1）则使回答更具创造性和随机性。玩文游建议0.7，你可以进行尝试。
							</div>
						</div>

						<div class="setting-item">
							<div class="setting-item-head">
								<div class="setting-label">最大生成长度</div>
								<span class="setting-value">{{ innerMaxTokens }}</span>
							</div>
							<el-slider
								class="custom-slider"
								v-model="innerMaxTokens"
								:min="1024"
								:max="32768"
								:step="1024"
								show-tooltip
							/>
							<div class="setting-hint">
								最大生成长度(max_tokens)，限制模型单次生成内容的总量。默认值16384，如果遇到因长度问题导致的输出截断，可以尝试调高此值。注意，不同模型支持的最大值不同。
							</div>
						</div>
					</div>
				</section>

				<!-- ============ 对话显示 ============ -->
				<section class="settings-section">
					<div class="section-head">
						<div class="section-title">对话显示</div>
						<div class="section-desc">思考过程的展示方式</div>
					</div>
					<div class="section-body">
						<div class="switch-row">
							<div class="switch-row-text">
								<div class="switch-row-title">默认隐藏思考</div>
								<div class="switch-row-desc">开启后，助手的思考过程将默认隐藏，点击图标可展开/折叠。</div>
							</div>
							<el-switch v-model="innerDefaultHideReasoning" />
						</div>
						<div class="switch-row">
							<div class="switch-row-text">
								<div class="switch-row-title">自动折叠思考</div>
								<div class="switch-row-desc">开启后，每次发送新消息时，之前所有消息的思考过程将自动折叠。</div>
							</div>
							<el-switch v-model="innerAutoCollapseReasoning" />
						</div>
					</div>
				</section>

				<!-- ============ 数据管理 ============ -->
				<section class="settings-section">
					<div class="section-head">
						<div class="section-title">数据管理</div>
						<div class="section-desc">导出、导入与维护对话数据</div>
					</div>
					<div class="section-body">
						<div class="setting-item">
							<div class="setting-label">导出</div>
							<div class="button-row">
								<el-button size="small" @click="$emit('export-current-chat-archive')">导出当前对话</el-button>
								<el-button size="small" @click="$emit('export-recent-chat-archive')">导出最近80条对话</el-button>
								<el-button size="small" @click="$emit('export-chat-archive')">导出存档</el-button>
								<el-button size="small" @click="$emit('export-chat-titles')">导出对话标题列表</el-button>
								<el-button size="small" v-if="archiveCount > 0" @click="$emit('export-archived-chats')">导出归档 ({{ archiveCount }})</el-button>
								<el-button size="small" v-if="archiveCount > 0" @click="$emit('export-full-backup')">导出完整备份</el-button>
							</div>
							<div class="setting-hint">导出当前对话生成的存档仅支持"合并"导入，不可覆盖。</div>
						</div>

						<div class="setting-item">
							<div class="setting-label">导入 / 修复</div>
							<div class="button-row">
								<el-button size="small" type="primary" @click="$emit('import-chat-archive', 'merge')">导入存档（合并）</el-button>
								<el-button size="small" type="danger" plain @click="$emit('import-chat-archive', 'overwrite')">导入存档（覆盖）</el-button>
								<el-button size="small" type="warning" plain @click="$emit('repair-chat-data')">统一修复</el-button>
							</div>
						</div>

						<div class="setting-item">
							<div class="setting-item-head">
								<div class="setting-label">对话归档</div>
								<span class="setting-status">当前 {{ chatCount }} 条对话 · {{ archiveCount }} 条归档</span>
							</div>
							<el-button size="small" @click="confirmArchiveOldChats">📦 归档旧对话</el-button>
							<div class="setting-hint">将较早的对话移入归档区，保留最近 50 条。归档后仍可在侧边栏底部随时取回。</div>
						</div>

						<div class="setting-item">
							<div class="setting-label">数据迁移</div>
							<el-button size="small" @click="$emit('force-migrate')">重新尝试获取旧站存档</el-button>
							<div class="setting-hint">如果您在旧站（tobenot.top/migration-bs2）有存档，点击此按钮可尝试再次无缝获取并合并。</div>
						</div>

						<!-- 危险操作区 -->
						<div class="danger-zone">
							<div class="setting-item-head">
								<div class="setting-label danger-label">清空对话</div>
								<span class="setting-status">将删除热区 {{ chatCount }} 条与归档 {{ archiveCount }} 条</span>
							</div>
							<el-button
								size="small"
								type="danger"
								:disabled="chatCount + archiveCount <= 0"
								@click="confirmClearAllChats"
							>
								清空全部对话
							</el-button>
							<div class="setting-hint">不可恢复。请先用上方「导出完整备份」或「导出存档」留档。不会清除 API Key 等设置。</div>
						</div>
					</div>
				</section>

				<!-- ============ 小贴士 ============ -->
				<section class="settings-section">
					<div class="section-head">
						<div class="section-title">小贴士</div>
					</div>
					<div class="section-body">
						<ul class="tips-list">
							<li>电脑端可以使用 <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 发送消息。</li>
							<li>从现象中推测，硅基流动在单次回复中超过五分钟就会直接截断，可能会导致正文不完整。如果你遇到类似问题，可以尝试让它精简思考长度。</li>
						</ul>
					</div>
				</section>
			</div>

			<footer class="settings-footer">
				<el-button link @click="$emit('show-author-info')">
					<el-icon><InfoFilled /></el-icon>
				</el-button>
				作者: <a href="https://tobenot.top/" target="_blank" class="footer-link">tobenot</a> © 2025
			</footer>
		</div>

		<!-- 新建/编辑自定义预设弹窗 -->
		<el-dialog
			v-model="showAddCustomPreset"
			:title="editingCustomPreset ? '编辑自定义预设' : '新建自定义预设'"
			width="min(480px, 92vw)"
			append-to-body
		>
			<el-form label-position="top">
				<el-form-item label="预设名称">
					<el-input v-model="customPresetForm.label" placeholder="例如：我的中转站"></el-input>
				</el-form-item>
				<el-form-item label="API地址">
					<el-input v-model="customPresetForm.baseUrl" placeholder="例如：https://api.example.com/v1"></el-input>
					<div class="setting-hint">请填入 OpenAI 兼容格式的 API 地址（不含 /chat/completions）</div>
				</el-form-item>
				<el-form-item label="API Key">
					<SecretTextInput
						v-model="customPresetForm.apiKey"
						placeholder="填写后将保存到该预设"
						field-name="bs2-field-c"
					/>
					<div class="setting-hint">密钥将安全保存在浏览器本地，仅用于该预设</div>
				</el-form-item>
				<el-form-item label="邀请链接">
					<el-input
						v-model="customPresetForm.affiliateUrl"
						placeholder="可选，邀请注册链接（支持作者）"
					></el-input>
					<div class="setting-hint">填写后，使用该预设的用户会看到此邀请链接，方便获取 API Key 并支持你。</div>
				</el-form-item>
				<el-form-item label="模型列表">
					<div class="w-full">
						<div class="model-tags-container">
							<el-tag
								v-for="(tag, index) in customPresetForm.models"
								:key="index"
								closable
								size="small"
								class="model-tag"
								@close="removeModelTag(index)"
							>
								{{ tag }}
							</el-tag>
							<el-input
								v-if="modelInputVisible"
								ref="modelInputRef"
								v-model="modelInputValue"
								size="small"
								class="model-input"
								placeholder="输入模型名后回车"
								@keyup.enter="addModelTag"
								@blur="addModelTag"
							></el-input>
							<el-button v-else size="small" class="model-add-btn" @click="showModelInput">
								+ 添加模型
							</el-button>
						</div>
						<div class="button-row fetch-models-row">
							<el-button
								size="small"
								:loading="fetchingModels"
								:disabled="!customPresetForm.baseUrl"
								@click="fetchModelsForForm"
							>
								🔄 从服务器拉取
							</el-button>
							<span v-if="fetchModelStatus" class="fetch-model-status" :class="fetchModelStatusClass">
								{{ fetchModelStatus }}
							</span>
						</div>
						<div class="setting-hint">可以手动添加模型名，也可以填写 API 地址和 Key 后点击"从服务器拉取"自动获取</div>
					</div>
				</el-form-item>
				<el-form-item label="本机 / 免密钥端点">
					<div class="w-full">
						<el-switch :model-value="!customPresetForm.apiKeyRequired" @change="onKeylessToggle" :active-text="customPresetForm.apiKeyRequired ? '需密钥' : '免密钥'"></el-switch>
						<div class="setting-hint">打开后该预设无需 API Key 即可发送（面向本机或局域网免鉴权的 OpenAI 兼容服务，如 Ollama、LM Studio）。本机服务需开启跨域(CORS)。</div>
					</div>
				</el-form-item>
				<el-divider content-position="left">高级能力</el-divider>
				<el-form-item label="图像输出">
					<div class="w-full">
						<el-switch v-model="customPresetForm.features.imageOutput"></el-switch>
						<div class="setting-hint">开启后，绘图模式会把该预设识别为支持图像输出的候选预设。</div>
					</div>
				</el-form-item>
				<el-form-item label="推理标记">
					<div class="w-full">
						<el-switch v-model="customPresetForm.features.reasoning"></el-switch>
						<div class="setting-hint">仅作为能力元数据保存，便于后续模式按预设能力做适配。</div>
					</div>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showAddCustomPreset = false">取消</el-button>
				<el-button type="primary" @click="saveCustomPresetForm">保存</el-button>
			</template>
		</el-dialog>

		<!-- 模型拉取结果确认弹窗 -->
		<el-dialog
			v-model="showFetchConfirm"
			title="拉取到模型列表"
			width="min(400px, 92vw)"
			append-to-body
		>
			<div class="fetch-confirm-text">
				从服务器获取到 <strong>{{ fetchedModels.length }}</strong> 个模型，请选择操作方式：
			</div>
			<div class="fetch-models-preview">
				<el-tag
					v-for="(m, i) in fetchedModelsPreview"
					:key="i"
					size="small"
					type="info"
					class="mr-1 mb-1"
				>
					{{ m }}
				</el-tag>
				<span v-if="fetchedModels.length > 20" class="fetch-models-more">
					...等共 {{ fetchedModels.length }} 个
				</span>
			</div>
			<template #footer>
				<el-button @click="showFetchConfirm = false">取消</el-button>
				<el-button @click="applyFetchedModels('append')">追加到列表</el-button>
				<el-button type="primary" @click="applyFetchedModels('replace')">覆盖当前列表</el-button>
			</template>
		</el-dialog>
	</el-drawer>
</template>

<script>
import { InfoFilled, ArrowRight, Close } from '@element-plus/icons-vue'
import {
	DEFAULT_PRESET_FEATURES,
	getAllPresets,
	getPresetById,
	getPresetRuntimeBaseUrl,
	normalizePresetFeatures
} from '@/config/presets'
import { fetchModelsFromServer } from '@/core/services/modelFetcher'
import { normalizeRequestFormatPref, REQUEST_FORMAT } from '@/utils/requestFormat.js'
import {
	listResponsesToolsForUi,
	normalizeResponsesTools
} from '@/utils/responsesTools.js'
import SecretTextInput from './SecretTextInput.vue'
import AffiliateLink from './AffiliateLink.vue'

function createEmptyCustomPresetForm() {

	return {
		label: '',
		baseUrl: '',
		apiKey: '',
		models: [],
		features: { ...DEFAULT_PRESET_FEATURES },
		apiKeyRequired: true,
		affiliateUrl: ''
	};
}

export default {
	name: 'SettingsDrawer',
	components: { InfoFilled, ArrowRight, Close, SecretTextInput, AffiliateLink },

	props: {
		modelValue: { type: Boolean, default: false },
		activePresetId: { type: String, default: '' },
		apiKey: { type: String, default: '' },
		featurePassword: { type: String, default: '' },
		temperature: { type: Number, default: 0.7 },
		maxTokens: { type: Number, default: 16384 },
		model: { type: String, default: '' },
		defaultHideReasoning: { type: Boolean, default: false },
		autoCollapseReasoning: { type: Boolean, default: false },
		models: { type: Array, default: () => [] },
		geminiReasoningEffort: { type: String, default: 'high' },
		requestFormat: { type: String, default: 'auto' },
		responsesTools: { type: Array, default: () => [] },
		chatCount: { type: Number, default: 0 },
		archiveCount: { type: Number, default: 0 }
	},
	emits: [
		'update:modelValue',
		'update:apiKey', 'update:featurePassword',
		'update:temperature', 'update:maxTokens', 'update:model',
		'update:defaultHideReasoning', 'update:autoCollapseReasoning',
		'update:geminiReasoningEffort',
		'update:requestFormat',
		'update:responsesTools',
		'switch-preset', 'update:proxyBaseUrl',
		'models-fetched',
		'create-custom-preset', 'update-custom-preset', 'delete-custom-preset',
		'export-chat-archive', 'export-current-chat-archive', 'export-recent-chat-archive',
		'export-chat-titles', 'export-archived-chats', 'export-full-backup',
		'repair-chat-data', 'import-chat-archive',
		'archive-old-chats', 'clear-all-chats', 'force-migrate',
		'show-author-info', 'show-changelog'
	],
	data() {
		return {
			showAddCustomPreset: false,
			editingCustomPreset: null,
			presetRevision: 0,
			customPresetForm: createEmptyCustomPresetForm(),
			modelInputVisible: false,
			modelInputValue: '',
			fetchingModels: false,
			fetchModelStatus: '',
			fetchModelStatusClass: '',
			showFetchConfirm: false,
			fetchedModels: [],
			refreshingModels: false,
			refreshModelStatus: '',
			refreshModelStatusClass: ''
		};
	},
	computed: {
		innerShow: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		},
		innerPresetId: {
			get() { return this.activePresetId },
			set() { /* handled by onPresetSelected */ }
		},
		innerApiKey: {
			get() { return this.apiKey },
			set(v) { this.$emit('update:apiKey', v) }
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
		innerRequestFormat: {
			get() { return normalizeRequestFormatPref(this.requestFormat) },
			set(v) { this.$emit('update:requestFormat', normalizeRequestFormatPref(v)) }
		},
		innerDefaultHideReasoning: {
			get() { return this.defaultHideReasoning },
			set(v) { this.$emit('update:defaultHideReasoning', v) }
		},
		innerAutoCollapseReasoning: {
			get() { return this.autoCollapseReasoning },
			set(v) { this.$emit('update:autoCollapseReasoning', v) }
		},
		showRequestFormat() {
			return this.currentPreset?.protocol !== 'gemini';
		},
		isRequestFormatLocked() {
			return this.isCurrentPresetProxy;
		},
		showResponsesTools() {
			return this.showRequestFormat
				&& !this.isRequestFormatLocked
				&& this.innerRequestFormat === REQUEST_FORMAT.RESPONSES;
		},
		responsesToolsUi() {
			return listResponsesToolsForUi({
				apiUrl: this.currentPreset ? getPresetRuntimeBaseUrl(this.currentPreset) : '',
				presetId: this.activePresetId
			});
		},
		requestFormatHint() {
			if (this.isRequestFormatLocked) {
				return '后端代理固定使用 Chat Completions。Claude 手动缓存不可用；其余模型由中转自动缓存。';
			}
			const pref = this.innerRequestFormat;
			if (pref === REQUEST_FORMAT.CHAT_COMPLETIONS) {
				return '始终走 /v1/chat/completions。Claude 手动缓存不可用；其余模型由中转自动缓存。';
			}
			if (pref === REQUEST_FORMAT.ANTHROPIC_MESSAGES) {
				return '始终走 /v1/messages（Claude Code 同系）。需中转支持该端点；可启用 Claude 手动提示词缓存。';
			}
			if (pref === REQUEST_FORMAT.RESPONSES) {
				return '始终走 /v1/responses（OpenAI 推荐接口）。适合推理模型与结构化输出；需中转支持该端点。Claude 手动缓存不可用。';
			}
			return '自动：Claude 走 Anthropic Messages（可启用手动缓存），其余走 Chat Completions（中转自动缓存）。可手动选 Responses。';
		},
		innerProxyBaseUrl: {
			get() {
				const preset = this.currentPreset;
				if (!preset) return '';
				return getPresetRuntimeBaseUrl(preset);
			},
			set(v) {
				this.$emit('update:proxyBaseUrl', v);
			}
		},
		allPresets() {
			this.presetRevision;
			return getAllPresets();
		},
		directPresets() {
			return this.allPresets.filter(p => p.isBuiltin && p.authMode !== 'password');
		},
		proxyPresets() {
			return this.allPresets.filter(p => p.isBuiltin && p.authMode === 'password');
		},
		customPresets() {
			return this.allPresets.filter(p => !p.isBuiltin);
		},
		currentPreset() {
			this.presetRevision;
			return getPresetById(this.activePresetId);
		},
		isCurrentPresetProxy() {
			return this.currentPreset?.authMode === 'password';
		},
		isCurrentPresetCustom() {
			return this.currentPreset && !this.currentPreset.isBuiltin;
		},
		showEditableBaseUrl() {
			return !!this.currentPreset?.editableBaseUrl;
		},
		apiKeyPlaceholder() {
			return this.currentPreset?.apiKeyRequired === false ? '本机/免密钥端点，可留空' : '请输入您的API Key';
		},
		currentPresetRuntimeBaseUrl() {
			return this.currentPreset ? getPresetRuntimeBaseUrl(this.currentPreset) : '';
		},
		canRefreshModels() {
			const preset = this.currentPreset;
			return !!(preset && preset.protocol !== 'gemini' && preset.authMode !== 'password');
		},
		modelSelectHint() {
			if (this.currentPreset?.apiKeyRequired === false) {
				return '本机/免密钥端点：可直接输入该服务支持的模型名，或点上方「从服务器拉取模型」自动获取（本机服务需允许跨域访问 /models）。';
			}
			return '可以从列表中选择模型，或者直接输入自定义模型名称。对于自定义API端点，请输入该端点支持的模型名称。';
		},
		presetHint() {
			const preset = this.currentPreset;
			if (!preset) return '请选择一个接入预设';
			if (preset.authMode === 'password') {
				return `当前使用后端代理模式（${preset.label}），需要功能密码`;
			}
			if (preset.protocol === 'gemini') {
				return '当前使用 Google Gemini 直连，请使用 Google AI Studio 的 Key';
			}
			const url = getPresetRuntimeBaseUrl(preset);
			if (url.includes('api.siliconflow.cn')) {
				return '当前选择的是硅基流动接口 请使用硅基流动的Key';
			} else if (url.includes('api.deepseek.com')) {
				return '当前选择的是Deepseek官方接口 请使用Deepseek官网的Key';
			} else if (url.includes('ark.cn-beijing.volces.com')) {
				return '当前选择的是火山引擎接口 请使用火山引擎的Key';
			} else if (url.includes('openrouter.ai')) {
				return '当前选择的是OpenRouter接口 请使用OpenRouter的Key';
			} else if (url.includes('lmrouter.com')) {
				return '当前选择的是LMRouter接口 请使用LMRouter的Key';
			} else if (url.includes('opencode.ai')) {
				return '当前选择的是OpenCode接口 请使用OpenCode的Key';
			} else if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])/i.test(url)) {
				return '本机模型预设：确认本机 OpenAI 兼容服务已开启且允许跨域(CORS)，免密钥可留空直接发送。要用多个本机端口（如 8090、11434），可在「自定义预设」里每个端口新建一个预设。';
			}
			return '自定义预设，请确保使用兼容 OpenAI 的接口格式';
		},
		apiKeyHint() {
			const preset = this.currentPreset;
			if (!preset) return '';
			if (preset.apiKeyRequired === false) {
				return '本机/免密钥端点，通常无需密钥即可直接发送；如需鉴权仍可填写，将安全保存在浏览器中。';
			}
			if (preset.protocol === 'gemini') {
				return '请前往 Google AI Studio 获取 Key。输入后将安全地存储在您的浏览器中。';
			}
			const url = getPresetRuntimeBaseUrl(preset);
			if (url.includes('api.siliconflow.cn')) {
				return '请前往 硅基流动、Deepseek官网 或 OpenRouter 获取。输入后将安全地存储在您的浏览器中。';
			}
			return '输入后将安全地存储在您的浏览器中。';
		},
		fetchedModelsPreview() {
			return this.fetchedModels.slice(0, 20);
		}
	},
	methods: {
		isResponsesToolEnabled(type) {
			return normalizeResponsesTools(this.responsesTools).includes(type);
		},
		setResponsesToolEnabled(type, enabled) {
			const catalog = this.responsesToolsUi.find((t) => t.type === type);
			if (!catalog?.available) return;
			const current = normalizeResponsesTools(this.responsesTools);
			let next;
			if (enabled) {
				next = current.includes(type) ? current : [...current, type];
			} else {
				next = current.filter((t) => t !== type);
			}
			this.$emit('update:responsesTools', normalizeResponsesTools(next));
		},
		confirmArchiveOldChats() {
			const willArchive = Math.max(0, this.chatCount - 50);
			if (willArchive <= 0) {
				this.$message({ message: '当前对话数量不超过 50 条，无需归档', type: 'info', duration: 2000 });
				return;
			}
			this.$confirm(
				`将把最早的约 ${willArchive} 条对话移入归档区，保留最近 50 条。归档后可随时取回。`,
				'归档旧对话',
				{
					confirmButtonText: '确认归档',
					cancelButtonText: '取消',
					type: 'info',
					closeOnClickModal: false
				}
			).then(() => {
				this.$emit('archive-old-chats', 50);
			}).catch(() => {});
		},
		confirmClearAllChats() {
			const hotCount = this.chatCount;
			const archiveCount = this.archiveCount;
			const total = hotCount + archiveCount;
			if (total <= 0) {
				this.$message({ message: '当前没有可清空的对话', type: 'info', duration: 2000 });
				return;
			}

			this.$confirm(
				`将永久删除全部对话（热区 ${hotCount} 条 + 归档 ${archiveCount} 条），此操作不可恢复。建议先导出完整备份或导出存档。`,
				'清空全部对话',
				{
					confirmButtonText: '继续清空',
					cancelButtonText: '取消',
					type: 'warning',
					closeOnClickModal: false,
					distinguishCancelAndClose: true
				}
			).then(() => this.$prompt(
				'请输入「清空」以确认删除全部对话',
				'二次确认',
				{
					confirmButtonText: '确认清空',
					cancelButtonText: '取消',
					inputPattern: /^清空$/,
					inputErrorMessage: '请输入「清空」',
					inputPlaceholder: '清空',
					closeOnClickModal: false,
					distinguishCancelAndClose: true,
					type: 'error'
				}
			)).then(() => {
				this.$emit('clear-all-chats');
			}).catch(() => {});
		},
		emptyCustomPresetForm() {
			return createEmptyCustomPresetForm();
		},
		normalizeFeatureFlags(features) {
			return normalizePresetFeatures(features);
		},
		refreshPresetRegistry() {
			this.presetRevision += 1;
		},
		onPresetSelected(presetId) {
			this.$emit('switch-preset', presetId);
		},
		editCurrentCustomPreset() {
			const preset = this.currentPreset;
			if (!preset || preset.isBuiltin) return;
			this.editingCustomPreset = preset.id;
			this.customPresetForm = {
				label: preset.label,
				baseUrl: preset.baseUrl,
				apiKey: this.apiKey,
				models: [...(preset.models || [])],
				features: this.normalizeFeatureFlags(preset.features),
				apiKeyRequired: preset.apiKeyRequired !== false,
				affiliateUrl: preset.affiliateUrl || ''
			};
			this.showAddCustomPreset = true;
		},
		confirmDeleteCurrentPreset() {
			const preset = this.currentPreset;
			if (!preset || preset.isBuiltin) return;
			this.$confirm(`确定删除预设「${preset.label}」吗？删除后将切换到默认预设。`, '确认删除', {
				confirmButtonText: '删除',
				cancelButtonText: '取消',
				type: 'warning'
			}).then(() => {
				this.$emit('delete-custom-preset', preset.id);
				this.refreshPresetRegistry();
			}).catch(() => {});
		},
		saveCustomPresetForm() {
			const { label, baseUrl, apiKey, models, features, affiliateUrl, apiKeyRequired } = this.customPresetForm;
			if (!baseUrl || !baseUrl.trim()) {
				this.$message({ message: '请填写 API 地址', type: 'warning' });
				return;
			}
			// 本机/回环端点优先视为免密钥，无需用户手动开开关
			const isLocalBase = /^(?:https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|::1)(?:[/:]|$)/i.test(baseUrl.trim());
			const effectiveApiKeyRequired = apiKeyRequired !== false && !isLocalBase;
			if (isLocalBase && apiKeyRequired !== false) {
				this.$message({ message: '检测到本机端点，已自动设为免密钥', type: 'success', duration: 2500 });
			}
			if (this.editingCustomPreset) {
				this.$emit('update-custom-preset', {
					id: this.editingCustomPreset,
					label: label || `自定义预设 (${baseUrl})`,
					baseUrl: baseUrl.trim(),
					apiKey: apiKey || '',
					models: models || [],
					features: this.normalizeFeatureFlags(features),
					apiKeyRequired: effectiveApiKeyRequired,
					affiliateUrl: (affiliateUrl || '').trim()
				});
			} else {
				this.$emit('create-custom-preset', {
					label: label || `自定义预设 (${baseUrl})`,
					baseUrl: baseUrl.trim(),
					apiKey: apiKey || '',
					models: models || [],
					features: this.normalizeFeatureFlags(features),
					apiKeyRequired: effectiveApiKeyRequired,
					affiliateUrl: (affiliateUrl || '').trim()
				});
			}
			this.refreshPresetRegistry();
			this.showAddCustomPreset = false;
			this.editingCustomPreset = null;
			this.customPresetForm = this.emptyCustomPresetForm();
		},

		removeModelTag(index) {
			this.customPresetForm.models.splice(index, 1);
		},
		showModelInput() {
			this.modelInputVisible = true;
			this.$nextTick(() => {
				this.$refs.modelInputRef?.focus();
			});
		},
		addModelTag() {
			const val = this.modelInputValue.trim();
			if (val && !this.customPresetForm.models.includes(val)) {
				this.customPresetForm.models.push(val);
			}
			this.modelInputVisible = false;
			this.modelInputValue = '';
		},
		onKeylessToggle(keyless) {
			this.customPresetForm.apiKeyRequired = !keyless;
		},

		async fetchModelsForForm() {
			const { baseUrl, apiKey } = this.customPresetForm;
			if (!baseUrl || !baseUrl.trim()) {
				this.$message({ message: '请先填写 API 地址', type: 'warning' });
				return;
			}

			this.fetchingModels = true;
			this.fetchModelStatus = '正在拉取…';
			this.fetchModelStatusClass = 'is-loading';

			const result = await fetchModelsFromServer(baseUrl, apiKey);
			this.fetchingModels = false;

			if (result.success) {
				this.fetchModelStatus = `获取到 ${result.models.length} 个模型`;
				this.fetchModelStatusClass = 'is-success';
				this.fetchedModels = result.models;

				if (this.customPresetForm.models.length === 0) {
					this.customPresetForm.models = [...result.models];
					this.$message({ message: `已填入 ${result.models.length} 个模型`, type: 'success' });
				} else {
					this.showFetchConfirm = true;
				}
			} else {
				this.fetchModelStatus = result.error || '拉取失败';
				this.fetchModelStatusClass = 'is-error';
				this.$message({ message: result.error || '拉取失败，请手动填写', type: 'warning' });
			}
		},

		applyFetchedModels(mode) {
			if (mode === 'replace') {
				this.customPresetForm.models = [...this.fetchedModels];
			} else if (mode === 'append') {
				const merged = [...this.customPresetForm.models, ...this.fetchedModels];
				this.customPresetForm.models = [...new Set(merged)];
			}
			this.showFetchConfirm = false;
			this.fetchedModels = [];
			this.$message({ message: '模型列表已更新', type: 'success' });
		},
		async refreshModelsForCurrentPreset() {
			const base = this.currentPresetRuntimeBaseUrl;
			if (!base) {
				this.$message({ message: '请先填写服务地址', type: 'warning' });
				return;
			}
			this.refreshingModels = true;
			this.refreshModelStatus = '正在拉取…';
			this.refreshModelStatusClass = 'is-loading';

			const result = await fetchModelsFromServer(base, this.apiKey, { timeout: 12000 });
			this.refreshingModels = false;

			if (result.success && result.models.length > 0) {
				this.$emit('models-fetched', result.models);
				this.refreshModelStatus = `获取到 ${result.models.length} 个模型`;
				this.refreshModelStatusClass = 'is-success';
			} else {
				this.refreshModelStatus = result.error || '拉取失败';
				this.refreshModelStatusClass = 'is-error';
				this.$message({ message: result.error || '拉取失败，可手动输入模型名', type: 'warning' });
			}
		}
	},
	watch: {
		showAddCustomPreset(v) {
			if (!v) {
				this.editingCustomPreset = null;
				this.customPresetForm = this.emptyCustomPresetForm();
				this.fetchModelStatus = '';
				this.fetchModelStatusClass = '';
				this.modelInputVisible = false;
				this.modelInputValue = '';
				this.showFetchConfirm = false;
				this.fetchedModels = [];
			}
		}
	}
}
</script>

<style scoped>
/* ===== 整体布局：顶部栏 + 滚动区 + 底栏 ===== */
.settings-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: var(--bg-page);
}

:deep(.el-drawer__body) {
	padding: 0;
}

.settings-header {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 20px;
	background: var(--bg-card);
	border-bottom: 1px solid var(--border-color);
}
.settings-title {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
	color: var(--text-strong);
}
.settings-header-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}
.changelog-link {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 12px;
	font-size: 13px;
	color: var(--text-secondary);
	background: transparent;
	border: 1px solid var(--border-color-strong);
	border-radius: 999px;
	cursor: pointer;
	transition: color 0.2s, border-color 0.2s, background-color 0.2s;
}
.changelog-link:hover {
	color: #409eff;
	border-color: #409eff;
	background: rgba(64, 158, 255, 0.08);
}
.settings-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	font-size: 16px;
	color: var(--text-secondary);
	background: transparent;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	transition: color 0.2s, background-color 0.2s;
}
.settings-close:hover {
	color: var(--text-strong);
	background: var(--bg-elevated);
}

.settings-body {
	flex: 1;
	overflow-y: auto;
	padding: 16px 20px 24px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

/* ===== 分区卡片 ===== */
.settings-section {
	background: var(--bg-card);
	border: 1px solid var(--border-color);
	border-radius: 12px;
}
.section-head {
	padding: 12px 16px;
	border-bottom: 1px solid var(--border-color-soft);
}
.section-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--text-strong);
}
.section-desc {
	margin-top: 2px;
	font-size: 12px;
	color: var(--text-muted);
}
.section-body {
	padding: 4px 16px 12px;
}

/* ===== 设置项：标签在上、控件在下、说明文字垫底 ===== */
.setting-item {
	padding: 12px 0;
}
.setting-item + .setting-item {
	border-top: 1px solid var(--border-color-soft);
}
.setting-label {
	font-size: 13px;
	font-weight: 500;
	color: var(--text-main);
	margin-bottom: 8px;
}
.setting-item-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
}
.setting-item-head .setting-label {
	margin-bottom: 0;
}
.setting-hint {
	margin-top: 6px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--text-secondary);
}
.setting-value {
	flex-shrink: 0;
	padding: 1px 10px;
	font-size: 12px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	color: #409eff;
	background: rgba(64, 158, 255, 0.12);
	border-radius: 999px;
}
.setting-status {
	flex-shrink: 0;
	font-size: 12px;
	color: var(--text-muted);
}

.button-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
/* el-button 相邻时 EP 默认有 margin-left，与 gap 叠加会错位，统一清除 */
.button-row .el-button {
	margin-left: 0;
}

/* ===== 开关行：标题+描述在左，开关在右 ===== */
.switch-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 12px 0;
}
.switch-row + .switch-row {
	border-top: 1px solid var(--border-color-soft);
}
.switch-row-text {
	min-width: 0;
}
.switch-row-title {
	font-size: 13px;
	font-weight: 500;
	color: var(--text-main);
}
.switch-row-desc {
	margin-top: 2px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--text-secondary);
}

/* ===== 危险操作区 ===== */
.danger-zone {
	margin: 12px 0 4px;
	padding: 12px;
	border: 1px solid rgba(245, 108, 108, 0.4);
	border-radius: 8px;
	background: rgba(245, 108, 108, 0.06);
}
.danger-label {
	color: #f56c6c;
}

/* ===== 小贴士 ===== */
.tips-list {
	margin: 0;
	padding: 8px 0 4px 18px;
	font-size: 12px;
	line-height: 1.8;
	color: var(--text-secondary);
}
.tips-list kbd {
	padding: 1px 5px;
	font-size: 11px;
	font-family: inherit;
	color: var(--text-main);
	background: var(--bg-elevated);
	border: 1px solid var(--border-color-strong);
	border-radius: 4px;
}

/* ===== 底栏 ===== */
.settings-footer {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 10px 16px;
	font-size: 12px;
	color: var(--text-muted);
	background: var(--bg-card);
	border-top: 1px solid var(--border-color);
}
.footer-link {
	color: var(--text-secondary);
	text-decoration: none;
}
.footer-link:hover {
	color: #805ad5;
	text-decoration: underline;
}

/* ===== Responses 工具列表 ===== */
.request-format-group {
	display: flex;
	flex-wrap: wrap;
	row-gap: 6px;
}

.responses-tools-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
}
.responses-tool-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border: 1px solid var(--border-color-soft);
	border-radius: 8px;
}
.responses-tool-row.is-unavailable {
	opacity: 0.65;
}
.responses-tool-label {
	font-size: 13px;
	color: var(--text-main);
}
.responses-tool-type {
	font-size: 12px;
	color: var(--text-muted);
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.responses-tool-hint {
	flex-basis: 100%;
	padding-left: 44px;
	font-size: 12px;
	color: var(--text-muted);
	line-height: 1.4;
}

/* ===== 滑块 ===== */
.custom-slider {
	padding: 0 8px;
}
.custom-slider :deep(.el-slider__runway) {
	height: 8px;
	border-radius: 4px;
	background-color: var(--bg-elevated);
}
.custom-slider :deep(.el-slider__bar) {
	height: 8px;
	border-radius: 4px;
	background-color: #409eff;
}
.custom-slider :deep(.el-slider__button) {
	width: 16px;
	height: 16px;
	border-radius: 50%;
	border: none;
	background-color: #409eff;
	box-shadow: none;
}

/* ===== 预设弹窗：模型标签编辑器 ===== */
.model-tags-container {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	align-items: center;
	min-height: 32px;
	padding: 4px;
	border: 1px solid var(--border-color-strong);
	border-radius: 4px;
	background: var(--bg-input);
}
.model-tag {
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
}
.model-input {
	width: 160px;
	flex-shrink: 0;
}
.model-add-btn {
	flex-shrink: 0;
}
.fetch-models-row {
	margin-top: 8px;
	align-items: center;
}
.fetch-model-status {
	font-size: 12px;
}
.fetch-model-status.is-loading {
	color: #409eff;
}
.fetch-model-status.is-success {
	color: #67c23a;
}
.fetch-model-status.is-error {
	color: #f56c6c;
}

/* ===== 模型拉取确认弹窗 ===== */
.fetch-confirm-text {
	margin-bottom: 8px;
	font-size: 13px;
	color: var(--text-main);
}
.fetch-models-preview {
	max-height: 200px;
	overflow-y: auto;
	padding: 8px;
	background: var(--bg-subtle);
	border-radius: 4px;
}
.fetch-models-more {
	font-size: 12px;
	color: var(--text-muted);
}
</style>
