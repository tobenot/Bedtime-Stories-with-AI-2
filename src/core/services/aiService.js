/**
 * 核心AI服务
 * 提供统一的AI接口调用能力，支持多种AI提供商
 * 这是微内核架构的核心服务之一
 */

import { callModelDeepseek } from '@/utils/providers/deepseek';
import { callModelGemini } from '@/utils/providers/gemini';

/**
 * 根据模型名称推断提供商
 */
function getProviderByModelName(model) {
	if (typeof model !== 'string' || !model) return null;
	if (model.startsWith('gemini-')) return 'gemini';
	if (model.startsWith('openai/')) return 'openai_compatible';
	if (model.startsWith('deepseek/')) return 'openai_compatible';
	if (model.startsWith('openrouter/')) return 'openai_compatible';
	if (model.startsWith('lmrouter/')) return 'openai_compatible';
	return null;
}

/**
 * 规范化API URL
 */
function normalizeApiUrl(apiUrl) {
	if (!apiUrl) return apiUrl;
	const trimmed = String(apiUrl).trim();
	if (!trimmed) return trimmed;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
	if (trimmed.startsWith('//')) return 'https:' + trimmed;
	if (trimmed.startsWith('/')) return trimmed;
	return 'https://' + trimmed;
}

/**
 * 确保API URL包含completions端点
 */
function ensureCompletionsEndpoint(apiUrl) {
	if (!apiUrl) return apiUrl;
	const url = String(apiUrl).trim();
	if (!url) return url;
	
	// 保留显式的流式端点
	if (url.includes('/stream')) {
		return url;
	}
	
	// 如果URL已经包含标准completions端点，原样返回
	if (url.includes('/v1/chat/completions') || url.includes('/v3/chat/completions')) {
		return url;
	}

	// 神秘链接路径路由到统一的OpenAI兼容端点
	if (url.includes('/api/gemini') || url.includes('/api/deepseek') || url.includes('/api/')) {
		try {
			if (url.startsWith('http://') || url.startsWith('https://')) {
				const u = new URL(url);
				return `${u.origin}/api/v1/chat/completions`;
			}
		} catch (_) {}
		return '/api/v1/chat/completions';
	}
	
	// 移除尾部斜杠
	const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
	
	// 附加completions端点
	return cleanUrl + '/v1/chat/completions';
}

/**
 * 根据API URL推断提供商
 */
export function getProviderByApiUrl(apiUrl) {
	const u = normalizeApiUrl(apiUrl) || '';
	if (!u) return 'openai_compatible';
	if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
	if (u.includes('/gemini')) return 'gemini';
	if (u.includes('/deepseek')) return 'openai_compatible';
	if (u.includes('siliconflow.cn')) return 'openai_compatible';
	if (u.includes('deepseek.com')) return 'openai_compatible';
	if (u.includes('volces.com')) return 'openai_compatible';
	if (u.includes('openrouter.ai')) return 'openai_compatible';
	if (u.includes('lmrouter.com')) return 'openai_compatible';
	return 'openai_compatible';
}

/**
 * 核心AI调用方法
 * @param {Object} options - 配置选项
 * @param {string} options.provider - AI提供商
 * @param {string} options.apiUrl - API地址
 * @param {string} options.apiKey - API密钥
 * @param {string} options.model - 模型名称
 * @param {Array} options.messages - 消息数组
 * @param {number} options.temperature - 温度参数
 * @param {number} options.maxTokens - 最大token数
 * @param {AbortSignal} options.signal - 取消信号
 * @param {Function} options.onChunk - 流式返回回调
 * @param {string} options.featurePassword - 功能密码
 * @param {boolean} options.useBackendProxy - 是否使用后端代理
 * @param {string} options.geminiReasoningEffort - Gemini推理强度
 */
export async function callAiModel({ 
	provider, 
	apiUrl, 
	apiKey, 
	model, 
	messages, 
	temperature = 0.7, 
	maxTokens = 4096, 
	signal, 
	onChunk, 
	featurePassword, 
	useBackendProxy, 
	geminiReasoningEffort 
}) {
	console.log('[Core AI Service] callAiModel called:', {
		provider,
		apiUrl,
		hasApiKey: !!apiKey,
		model,
		messagesCount: messages.length,
		temperature,
		maxTokens,
		hasSignal: !!signal,
		hasOnChunk: typeof onChunk === 'function'
	});
	
	const normalizedUrl = normalizeApiUrl(apiUrl);
	const finalUrl = ensureCompletionsEndpoint(normalizedUrl);
	
	let effectiveProvider = provider;
	let finalModel = model;

	const providerFromModel = getProviderByModelName(model);

	if (providerFromModel) {
		effectiveProvider = providerFromModel;
	}
	
	if (!effectiveProvider) {
		effectiveProvider = getProviderByApiUrl(finalUrl);
	}
	
	console.log('[Core AI Service] Final URL:', finalUrl, 'Effective provider:', effectiveProvider, 'Final model:', finalModel);
	
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ 
			apiUrl: finalUrl, 
			apiKey, 
			model: finalModel, 
			messages, 
			temperature, 
			maxTokens, 
			signal, 
			onChunk, 
			featurePassword, 
			isBackendProxy: useBackendProxy, 
			geminiReasoningEffort 
		});
	}
	
	return callModelDeepseek({ 
		apiUrl: finalUrl, 
		apiKey, 
		model: finalModel, 
		messages, 
		temperature, 
		maxTokens, 
		signal, 
		onChunk, 
		featurePassword, 
		isBackendProxy: useBackendProxy, 
		geminiReasoningEffort 
	});
}

/**
 * 根据提供商和配置列出可用模型
 */
export function listModelsByProvider(provider, useBackendProxy = false, apiUrl = '') {
	if (provider === 'gemini') {
		if (useBackendProxy) {
			return [
				'gemini-2.5-flash',
				'gemini-2.5-flash-lite',
				'gemini-2.0-flash',
				'gemini-2.0-flash-lite',
				'gemini-2.5-pro'
			];
		} else {
			return [
				'gemini-2.0-flash-exp',
				'gemini-1.5-pro-002',
				'gemini-1.5-flash-002'
			];
		}
	}
	
	if (useBackendProxy) {
		return [
			'deepseek-chat',
			'deepseek-reasoner'
		];
	}

	const u = normalizeApiUrl(apiUrl) || '';
	if (u.includes('openrouter.ai')) {
		return [
			'google/gemini-2.5-flash-lite',
			'google/gemini-2.5-flash',
			'google/gemini-2.5-pro',
			'anthropic/claude-sonnet-4',
			'anthropic/claude-3.5-sonnet',
			'anthropic/claude-opus-4.1',
			'openai/gpt-4.1-mini',
			'openai/gpt-5',
			'openai/gpt-4o-mini',
			'x-ai/grok-code-fast-1',
			'deepseek/deepseek-chat-v3.1:free',
			'deepseek/deepseek-chat-v3-0324',
			'deepseek/deepseek-r1-0528:free'
		];
	}
	
	if (u.includes('lmrouter.com')) {
		return [
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-3.5-turbo',
			'claude-3.5-sonnet',
			'claude-3-opus',
			'gemini-pro',
			'gemini-1.5-pro'
		];
	}

	if (u.includes('siliconflow.cn')) {
		return [
			'deepseek-ai/DeepSeek-R1',
			'deepseek-ai/DeepSeek-V3'
		];
	}

	if (u.includes('deepseek.com')) {
		return [
			'deepseek-chat',
			'deepseek-reasoner'
		];
	}

	return [];
}

