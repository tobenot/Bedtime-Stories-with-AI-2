import { callModelDeepseek } from './providers/deepseek';
import { callModelGemini } from './providers/gemini';

function getProviderByModelName(model) {
	if (typeof model !== 'string' || !model) return null;
	if (model.startsWith('gemini-')) return 'gemini';
	if (model.startsWith('openai/')) return 'openai_compatible';
	if (model.startsWith('deepseek/')) return 'openai_compatible';
	if (model.startsWith('openrouter/')) return 'openai_compatible';
	if (model.startsWith('lmrouter/')) return 'openai_compatible';
	return null;
}

function normalizeApiUrl(apiUrl) {
	if (!apiUrl) return apiUrl;
	const trimmed = String(apiUrl).trim();
	if (!trimmed) return trimmed;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
	if (trimmed.startsWith('//')) return 'https:' + trimmed;
	if (trimmed.startsWith('/')) return trimmed;
	return 'https://' + trimmed;
}

function ensureCompletionsEndpoint(apiUrl) {
	if (!apiUrl) return apiUrl;
	const url = String(apiUrl).trim();
	if (!url) return url;
	// Preserve explicit streaming endpoints
	if (url.includes('/stream')) {
		return url;
	}
	
	// If the URL already contains a standard completions endpoint, return as is
	if (url.includes('/v1/chat/completions') || url.includes('/v3/chat/completions')) {
		return url;
	}

	// Route 神秘链接 paths to unified OpenAI-compatible endpoint per backend standard
	if (url.includes('/api/gemini') || url.includes('/api/deepseek') || url.includes('/api/')) {
		try {
			if (url.startsWith('http://') || url.startsWith('https://')) {
				const u = new URL(url);
				return `${u.origin}/api/v1/chat/completions`;
			}
		} catch (_) {}
		return '/api/v1/chat/completions';
	}
	
	// Remove trailing slash if present
	const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
	
	// Append the completions endpoint
	return cleanUrl + '/v1/chat/completions';
}

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

export async function callAiModel({ provider, apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk, featurePassword, useBackendProxy, geminiReasoningEffort }) {
	console.log('[DEBUG] callAiModel called:', {
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
	// Ensure all URLs have the completions endpoint for consistency
	const finalUrl = ensureCompletionsEndpoint(normalizedUrl);
	
	let effectiveProvider = provider;
	let finalModel = model;

	const providerFromModel = getProviderByModelName(model);

	if (providerFromModel) {
		effectiveProvider = providerFromModel;
		// Keep the prefix for all providers as it's needed for proper model identification
		// For backend proxy, the prefix is used for routing
		// For OpenRouter, the prefix is required for model identification
		// For direct connections, keeping the prefix is also clearer and more explicit
	}
	
	if (!effectiveProvider) {
		effectiveProvider = getProviderByApiUrl(finalUrl);
	}
	
	console.log('[DEBUG] Final URL:', finalUrl, 'Effective provider:', effectiveProvider, 'Final model:', finalModel);
	
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ apiUrl: finalUrl, apiKey, model: finalModel, messages, temperature, maxTokens, signal, onChunk, featurePassword, isBackendProxy: useBackendProxy, geminiReasoningEffort });
	}
	return callModelDeepseek({ apiUrl: finalUrl, apiKey, model: finalModel, messages, temperature, maxTokens, signal, onChunk, featurePassword, isBackendProxy: useBackendProxy, geminiReasoningEffort });
}

export function listModelsByProvider(provider, useBackendProxy = false, apiUrl = '') {
	if (provider === 'gemini') {
		if (useBackendProxy) {
			// 神秘链接使用的模型列表
			return [
				'gemini-2.5-flash',
				'gemini-2.5-flash-lite',
				'gemini-2.0-flash',
				'gemini-2.0-flash-lite',
				'gemini-2.5-pro'
			];
		} else {
			// 直连官方API使用的模型列表
			return [
				'gemini-2.0-flash-exp',
				'gemini-1.5-pro-002',
				'gemini-1.5-flash-002'
			];
		}
	}
	if (useBackendProxy) {
		// 神秘链接使用的DeepSeek模型列表
		return [
			'deepseek-chat',
			'deepseek-reasoner'
		];
	}

	// For direct connections, determine model list by apiUrl
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