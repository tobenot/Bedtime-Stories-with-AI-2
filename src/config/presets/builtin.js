/**
 * 内置预设注册表
 * 
 * 这是所有内置 API 预设的唯一数据源。
 * 新增或修改内置供应商时，只需要修改本文件。
 * 
 * 字段说明：
 * - id:              预设唯一标识
 * - label:           UI 展示名称
 * - protocol:        协议类型 'openai' | 'gemini'
 * - baseUrl:         协议基础前缀（不含 /chat/completions 等动作端点）
 * - models:          预设模型列表
 * - isBuiltin:       是否为内置预设（始终为 true）
 * - authMode:        认证方式 'apiKey' | 'password'
 * - editableBaseUrl: 是否允许用户编辑 baseUrl（仅代理预设为 true）
 */

export const BUILTIN_PRESETS = [
	// ── 直连预设 ──
	{
		id: 'builtin_siliconflow',
		label: '硅基流动',
		protocol: 'openai',
		baseUrl: 'https://api.siliconflow.cn/v1',
		models: [
			'deepseek-ai/DeepSeek-R1',
			'deepseek-ai/DeepSeek-V3'
		],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_deepseek',
		label: 'Deepseek 官方',
		protocol: 'openai',
		baseUrl: 'https://api.deepseek.com/v1',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_volces',
		label: '火山引擎',
		protocol: 'openai',
		baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
		models: [],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_openrouter',
		label: 'OpenRouter',
		protocol: 'openai',
		baseUrl: 'https://openrouter.ai/api/v1',
		models: [
			'google/gemini-2.5-flash-lite',
			'google/gemini-2.5-flash',
			'google/gemini-2.5-pro',
			'google/gemini-3-flash-preview',
			'google/gemini-3.1-pro-preview',
			'google/gemini-3.1-flash-image-preview',
			'anthropic/claude-sonnet-4.5',
			'anthropic/claude-sonnet-4.6',
			'anthropic/claude-3.5-sonnet',
			'anthropic/claude-opus-4.6',
			'anthropic/claude-opus-4.7',
			'openai/gpt-5.2',
			'openai/gpt-5.2-codex',
			'openai/gpt-5.3',
			'openai/gpt-5.3-codex',
			'openai/gpt-5.4',
			'openai/gpt-5.4-pro',
			'x-ai/grok-4.20',
			'z-ai/glm-5.1',
			'minimax/minimax-m2.7',
			'qwen/qwen3.6-plus',
			'moonshotai/kimi-k2.6',
			'deepseek/deepseek-chat-v3.1:free',
			'deepseek/deepseek-chat-v3-0324',
			'deepseek/deepseek-r1-0528',
			'deepseek/deepseek-r1-0528:free',
			'deepseek/deepseek-v3.2',
			'deepseek/deepseek-v3.2-speciale',
			'deepseek/deepseek-v4-flash',
			'deepseek/deepseek-v4-pro'
		],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_lmrouter',
		label: 'LMRouter',
		protocol: 'openai',
		baseUrl: 'https://api.lmrouter.com/openai/v1',
		models: [
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-3.5-turbo',
			'claude-3.5-sonnet',
			'claude-3-opus',
			'gemini-pro',
			'gemini-1.5-pro'
		],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_gemini',
		label: 'Google Gemini',
		protocol: 'gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		models: [
			'gemini-2.0-flash-exp',
			'gemini-1.5-pro-002',
			'gemini-1.5-flash-002'
		],
		isBuiltin: true,
		authMode: 'apiKey',
	},

	// ── 代理预设 ──
	{
		id: 'builtin_backend_openai',
		label: 'OpenAI 后端代理',
		protocol: 'openai',
		baseUrl: '/api/deepseek/stream',
		models: [
			'deepseek-chat',
			'deepseek-reasoner'
		],
		isBuiltin: true,
		authMode: 'password',
		editableBaseUrl: true,
	},
	{
		id: 'builtin_backend_gemini',
		label: 'Gemini 后端代理',
		protocol: 'gemini',
		baseUrl: '/api/gemini/stream',
		models: [
			'gemini-2.5-flash',
			'gemini-2.5-flash-lite',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-2.5-pro'
		],
		isBuiltin: true,
		authMode: 'password',
		editableBaseUrl: true,
	},
];
