<template>
	<el-drawer v-model="innerShow" title="设置" direction="rtl" size="80%" :destroy-on-close="false" class="settings-drawer">
		<div class="settings-drawer p-4">
			<div class="mb-4 bg-blue-50 text-blue-600 p-2 rounded flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors" @click="$emit('show-changelog')">
				<span class="font-bold">✨ 查看版本更新日志</span>
				<el-icon><ArrowRight /></el-icon>
			</div>
			<el-form label-width="80px">
				<!-- Preset 选择器 -->
				<el-form-item label="接入预设">
					<el-select v-model="innerPresetId" class="w-full" placeholder="选择预设" @change="onPresetSelected">
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
					<div class="mt-1 text-gray-600 text-sm">
						{{ presetHint }}
					</div>
				</el-form-item>

				<!-- API Key（非 password authMode 才显示） -->
				<el-form-item v-if="!isCurrentPresetProxy" label="API Key">
					<el-input
						v-no-autofill
						v-model="innerApiKey"
						type="password"
						placeholder="请输入您的API Key"
						show-password
						autocomplete="new-password"
						data-form-type="other"
						data-lpignore="true"
						data-1p-ignore="true"
						data-bwignore="true"
						name="bs2-api-key-input"
					></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						{{ apiKeyHint }}
						<br/>
						💡 系统会为每个预设独立保存密钥，切换预设时会自动加载对应的密钥。
					</div>
				</el-form-item>

				<!-- 功能密码（代理预设才显示） -->
				<el-form-item v-if="isCurrentPresetProxy" label="功能密码">
					<el-input
						v-no-autofill
						v-model="innerFeaturePassword"
						type="password"
						placeholder="请输入功能密码"
						show-password
						autocomplete="new-password"
						data-form-type="other"
						data-lpignore="true"
						data-1p-ignore="true"
						data-bwignore="true"
						name="bs2-feature-password-input"
					></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						此密码用于访问后端代理的权限验证，请联系管理员获取
					</div>
				</el-form-item>

				<!-- 代理预设地址编辑 -->
				<el-form-item v-if="isCurrentPresetProxy" label="代理地址">
					<el-input v-model="innerProxyBaseUrl" placeholder="请输入代理完整地址"></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						当前代理预设的后端地址，修改后自动保存
					</div>
				</el-form-item>

				<el-divider></el-divider>

				<!-- 自定义预设管理按钮 -->
				<el-form-item label="自定义预设">
					<div style="display: flex; gap: 8px; flex-wrap: wrap;">
						<el-button size="small" type="primary" @click="showAddCustomPreset = true">新建自定义预设</el-button>
						<el-button v-if="isCurrentPresetCustom" size="small" @click="editCurrentCustomPreset">编辑当前预设</el-button>
						<el-button v-if="isCurrentPresetCustom" size="small" type="danger" @click="confirmDeleteCurrentPreset">删除当前预设</el-button>
					</div>
				</el-form-item>

				<el-divider></el-divider>

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
						控制Gemini模型的思考强度。此设置可能也适用于通过兼容OpenAI接口（如后端代理或OpenRouter）使用的Gemini模型。
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
						<el-button size="small" @click="$emit('export-recent-chat-archive')">导出最近80条对话</el-button>
						<el-button size="small" @click="$emit('export-chat-archive')">导出存档</el-button>
						<el-button size="small" @click="$emit('export-chat-titles')">导出对话标题列表</el-button>
						<el-button size="small" v-if="archiveCount > 0" @click="$emit('export-archived-chats')">导出归档 ({{ archiveCount }})</el-button>
						<el-button size="small" v-if="archiveCount > 0" @click="$emit('export-full-backup')">导出完整备份</el-button>
						<el-button size="small" type="warning" @click="$emit('repair-chat-data')">统一修复</el-button>
						<el-button size="small" type="primary" @click="$emit('import-chat-archive', 'merge')">导入存档（合并）</el-button>
						<el-button size="small" type="danger" @click="$emit('import-chat-archive', 'overwrite')">导入存档（覆盖）</el-button>
					</div>
					<div class="mt-1 text-gray-600 text-sm">
						导出当前对话生成的存档仅支持"合并"导入，不可覆盖。
					</div>
				</el-form-item>

				<el-form-item label="对话归档">
					<div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
						<el-button size="small" type="info" @click="confirmArchiveOldChats">
							📦 归档旧对话
						</el-button>
						<span class="text-gray-500 text-sm">当前 {{ chatCount }} 条对话，{{ archiveCount }} 条归档</span>
					</div>
					<div class="mt-1 text-gray-600 text-sm">
						将较早的对话移入归档区，保留最近 50 条。归档后仍可在侧边栏底部随时取回。
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
				<el-button link @click="$emit('show-author-info')" class="ml-2">
					<el-icon><InfoFilled /></el-icon>
				</el-button>
				作者: <a href="https://tobenot.top/" target="_blank" class="text-secondary hover:underline">tobenot</a> © 2025
			</div>
		</div>

		<!-- 新建/编辑自定义预设弹窗 -->
		<el-dialog
			v-model="showAddCustomPreset"
			:title="editingCustomPreset ? '编辑自定义预设' : '新建自定义预设'"
			width="480px"
			append-to-body
		>
			<el-form label-width="80px">
				<el-form-item label="预设名称">
					<el-input v-model="customPresetForm.label" placeholder="例如：我的中转站"></el-input>
				</el-form-item>
				<el-form-item label="API地址">
					<el-input v-model="customPresetForm.baseUrl" placeholder="例如：https://api.example.com/v1"></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						请填入 OpenAI 兼容格式的 API 地址（不含 /chat/completions）
					</div>
				</el-form-item>
				<el-form-item label="API Key">
					<el-input
						v-model="customPresetForm.apiKey"
						type="password"
						placeholder="填写后将保存到该预设"
						show-password
						autocomplete="new-password"
						data-form-type="other"
						data-lpignore="true"
						data-1p-ignore="true"
						data-bwignore="true"
					></el-input>
					<div class="mt-1 text-gray-600 text-sm">
						密钥将安全保存在浏览器本地，仅用于该预设
					</div>
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
						<div class="mt-2" style="display: flex; gap: 8px; align-items: center;">
							<el-button
								size="small"
								:loading="fetchingModels"
								:disabled="!customPresetForm.baseUrl"
								@click="fetchModelsForForm"
							>
								🔄 从服务器拉取
							</el-button>
							<span v-if="fetchModelStatus" class="text-sm" :class="fetchModelStatusClass">
								{{ fetchModelStatus }}
							</span>
						</div>
						<div class="mt-1 text-gray-600 text-sm">
							可以手动添加模型名，也可以填写 API 地址和 Key 后点击"从服务器拉取"自动获取
						</div>
					</div>
				</el-form-item>
				<el-divider content-position="left">高级能力</el-divider>
				<el-form-item label="图像输出">
					<div class="w-full">
						<el-switch v-model="customPresetForm.features.imageOutput"></el-switch>
						<div class="mt-1 text-gray-600 text-sm">
							开启后，绘图模式会把该预设识别为支持图像输出的候选预设。
						</div>
					</div>
				</el-form-item>
				<el-form-item label="推理标记">
					<div class="w-full">
						<el-switch v-model="customPresetForm.features.reasoning"></el-switch>
						<div class="mt-1 text-gray-600 text-sm">
							仅作为能力元数据保存，便于后续模式按预设能力做适配。
						</div>
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
			width="400px"
			append-to-body
		>
			<div class="mb-2 text-gray-700">
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
				<span v-if="fetchedModels.length > 20" class="text-gray-500 text-sm">
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
import { InfoFilled, ArrowRight } from '@element-plus/icons-vue'
import {
	DEFAULT_PRESET_FEATURES,
	getAllPresets,
	getPresetById,
	getPresetRuntimeBaseUrl,
	normalizePresetFeatures
} from '@/config/presets'
import { fetchModelsFromServer } from '@/core/services/modelFetcher'

function createEmptyCustomPresetForm() {
	return {
		label: '',
		baseUrl: '',
		apiKey: '',
		models: [],
		features: { ...DEFAULT_PRESET_FEATURES }
	};
}

export default {
	name: 'SettingsDrawer',
	components: { InfoFilled, ArrowRight },
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
		chatCount: { type: Number, default: 0 },
		archiveCount: { type: Number, default: 0 }
	},
	emits: [
		'update:modelValue',
		'update:apiKey', 'update:featurePassword',
		'update:temperature', 'update:maxTokens', 'update:model',
		'update:defaultHideReasoning', 'update:autoCollapseReasoning',
		'update:geminiReasoningEffort',
		'switch-preset', 'update:proxyBaseUrl',
		'create-custom-preset', 'update-custom-preset', 'delete-custom-preset',
		'export-chat-archive', 'export-current-chat-archive', 'export-recent-chat-archive',
		'export-chat-titles', 'export-archived-chats', 'export-full-backup',
		'repair-chat-data', 'import-chat-archive',
		'archive-old-chats',
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
			fetchedModels: []
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
		innerDefaultHideReasoning: {
			get() { return this.defaultHideReasoning },
			set(v) { this.$emit('update:defaultHideReasoning', v) }
		},
		innerAutoCollapseReasoning: {
			get() { return this.autoCollapseReasoning },
			set(v) { this.$emit('update:autoCollapseReasoning', v) }
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
			}
			return '自定义预设，请确保使用兼容 OpenAI 的接口格式';
		},
		apiKeyHint() {
			const preset = this.currentPreset;
			if (!preset) return '';
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
				features: this.normalizeFeatureFlags(preset.features)
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
			const { label, baseUrl, apiKey, models, features } = this.customPresetForm;
			if (!baseUrl || !baseUrl.trim()) {
				this.$message({ message: '请填写 API 地址', type: 'warning' });
				return;
			}
			if (this.editingCustomPreset) {
				this.$emit('update-custom-preset', {
					id: this.editingCustomPreset,
					label: label || `自定义预设 (${baseUrl})`,
					baseUrl: baseUrl.trim(),
					apiKey: apiKey || '',
					models: models || [],
					features: this.normalizeFeatureFlags(features)
				});
			} else {
				this.$emit('create-custom-preset', {
					label: label || `自定义预设 (${baseUrl})`,
					baseUrl: baseUrl.trim(),
					apiKey: apiKey || '',
					models: models || [],
					features: this.normalizeFeatureFlags(features)
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

		async fetchModelsForForm() {
			const { baseUrl, apiKey } = this.customPresetForm;
			if (!baseUrl || !baseUrl.trim()) {
				this.$message({ message: '请先填写 API 地址', type: 'warning' });
				return;
			}

			this.fetchingModels = true;
			this.fetchModelStatus = '正在拉取…';
			this.fetchModelStatusClass = 'text-blue-500';

			const result = await fetchModelsFromServer(baseUrl, apiKey);
			this.fetchingModels = false;

			if (result.success) {
				this.fetchModelStatus = `获取到 ${result.models.length} 个模型`;
				this.fetchModelStatusClass = 'text-green-600';
				this.fetchedModels = result.models;

				if (this.customPresetForm.models.length === 0) {
					this.customPresetForm.models = [...result.models];
					this.$message({ message: `已填入 ${result.models.length} 个模型`, type: 'success' });
				} else {
					this.showFetchConfirm = true;
				}
			} else {
				this.fetchModelStatus = result.error || '拉取失败';
				this.fetchModelStatusClass = 'text-red-500';
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
.changelog-entry-btn {
	width: 100%;
	margin-bottom: 16px;
}

:deep(.changelog-entry-btn.el-button) {
	justify-content: space-between;
}


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

.model-tags-container {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	align-items: center;
	min-height: 32px;
	padding: 4px;
	border: 1px solid #dcdfe6;
	border-radius: 4px;
	background: #fff;
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

.fetch-models-preview {
	max-height: 200px;
	overflow-y: auto;
	padding: 8px;
	background: #f5f7fa;
	border-radius: 4px;
	margin-top: 8px;
}
</style>
