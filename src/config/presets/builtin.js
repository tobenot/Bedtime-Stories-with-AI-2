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
 * - features:        能力标记，如 imageOutput / reasoning
 * - affiliateUrl:    邀请注册链接（可选）。配置后，使用此预设的用户会看到该链接，
 *                     方便获取 API Key 并支持作者，通常为带邀请码的注册地址。
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
		affiliateUrl: 'https://cloud.siliconflow.cn/i/M9KJQRfy',
	},
	{
		id: 'builtin_deepseek',
		label: 'Deepseek 官方',
		protocol: 'openai',
		baseUrl: 'https://api.deepseek.com/v1',
		models: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
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
		affiliateUrl: 'https://volcengine.com/L/bndW-k_NhiI/',
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
		features: {
			imageOutput: true,
			reasoning: true,
		},
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
		id: 'builtin_laozhang',
		label: '老张API',
		protocol: 'openai',
		baseUrl: 'https://api.laozhang.ai/v1',
		models: [
			// OpenAI
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-4.1',
			'gpt-4.1-mini',
			'o3',
			'o3-mini',
			'o4-mini',
			// Claude
			'claude-3-5-sonnet-latest',
			'claude-3-7-sonnet-latest',
			'claude-sonnet-4-20250514',
			'claude-sonnet-4-5-20250929',
			// Gemini
			'gemini-2.5-flash',
			'gemini-2.5-pro',
			// DeepSeek
			'deepseek-chat',
			'deepseek-r1',
			// Grok
			'grok-3-latest',
			'grok-3-mini-latest',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		affiliateUrl: 'https://api2.laozhang.ai/register/?aff_code=cDWj',
	},
	{
		id: 'builtin_aihubmix',
		label: 'AIHubMix',
		protocol: 'openai',
		baseUrl: 'https://aihubmix.com/v1',
		models: [
			'gpt-4o-mini',
			'gpt-4o',
			'gpt-4o-search-preview',
		],
		isBuiltin: true,
		authMode: 'apiKey',
	},
	{
		id: 'builtin_opencode',
		label: 'OpenCode',
		protocol: 'openai',
		baseUrl: 'https://opencode.ai/zen/go/v1',
		models: [],
		isBuiltin: true,
		authMode: 'apiKey',
		affiliateUrl: 'https://opencode.ai/go?ref=7AXCCYE8S0',
	},
	{
		id: 'builtin_gemini',
		label: 'Google Gemini',
		protocol: 'gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		models: [
			'gemini-2.5-flash',
			'gemini-2.5-flash-lite',
			'gemini-2.5-pro',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-2.0-flash-exp',
			'gemini-1.5-pro-002',
			'gemini-1.5-flash-002'
		],
		isBuiltin: true,
		authMode: 'apiKey',
		features: {
			imageOutput: true,
			reasoning: true,
		},
	},

	// ── 海外官方直连（邀请码待补）──
	{
		id: 'builtin_openai',
		label: 'OpenAI 官方',
		protocol: 'openai',
		baseUrl: 'https://api.openai.com/v1',
		models: [
			'gpt-5.4',
			'gpt-5.3',
			'gpt-5.2',
			'gpt-4o',
			'gpt-4o-mini',
			'o3',
			'o3-mini',
			'o4-mini',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补（OpenAI 无 API 返佣，仅 API Key）
	},
	{
		id: 'builtin_anthropic',
		label: 'Anthropic 官方',
		protocol: 'openai',
		baseUrl: 'https://api.anthropic.com',
		models: [
			'claude-opus-4.7',
			'claude-opus-4.6',
			'claude-sonnet-4.6',
			'claude-sonnet-4.5',
			'claude-3-7-sonnet-latest',
			'claude-3-5-haiku-latest',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补（Anthropic 无 API 返佣，仅 API Key）
	},
	{
		id: 'builtin_xai',
		label: 'xAI (Grok) 官方',
		protocol: 'openai',
		baseUrl: 'https://api.x.ai/v1',
		models: [
			'grok-4',
			'grok-4-mini',
			'grok-3-latest',
			'grok-3-mini-latest',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补
	},

	// ── 国内官方直连（邀请码待补）──
	{
		id: 'builtin_zhipu',
		label: '智谱 AI',
		protocol: 'openai',
		baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
		models: [
			'glm-5.1',
			'glm-5',
			'glm-4.7',
			'glm-4.7-plus',
			'glm-4.5',
			'glm-4.5-air',
			'glm-4-flash',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补（智谱有 API 返佣，待确认）
	},
	{
		id: 'builtin_moonshot',
		label: 'Kimi (Moonshot)',
		protocol: 'openai',
		baseUrl: 'https://api.moonshot.cn/v1',
		models: [
			'kimi-k2.6',
			'kimi-k2',
			'kimi-k2-turbo',
			'moonshot-v1-128k',
			'moonshot-v1-32k',
			'moonshot-v1-8k',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补（Kimi 有推广返佣，待确认）
	},
	{
		id: 'builtin_dashscope',
		label: '阿里云百炼',
		protocol: 'openai',
		baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		models: [
			'qwen3.6-plus',
			'qwen3.5-plus',
			'qwen3-plus',
			'qwen-max',
			'qwen-plus',
			'qwen-turbo',
			'qwen3-flash',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补（走云大使返佣）
	},
	{
		id: 'builtin_hunyuan',
		label: '腾讯混元',
		protocol: 'openai',
		baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
		models: [
			'hunyuan-turbo-latest',
			'hunyuan-standard-latest',
			'hunyuan-lite',
			'hunyuan-pro',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补
	},
	{
		id: 'builtin_qianfan',
		label: '百度千帆',
		protocol: 'openai',
		baseUrl: 'https://qianfan.baidubce.com/v2',
		models: [
			'ernie-4.5-turbo-128k',
			'ernie-4.5-8k',
			'ernie-4.0-8k',
			'ernie-4.0-turbo-8k',
			'ernie-3.5-8k',
			'ernie-lite-8k',
			'ernie-speed-128k',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补
	},
	{
		id: 'builtin_spark',
		label: '讯飞星火',
		protocol: 'openai',
		baseUrl: 'https://spark-api-open.xf-yun.com/v1',
		models: [
			'4.0Ultra',
			'4.0Max',
			'3.5Max',
			'generalv3.5',
			'generalv3',
			'pro-128k',
			'lite',
		],
		isBuiltin: true,
		authMode: 'apiKey',
		// affiliateUrl 待补
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
