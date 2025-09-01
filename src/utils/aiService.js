import { callModelDeepseek } from './providers/deepseek';
import { callModelGemini } from './providers/gemini';

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
	
	// If the URL already contains a completions endpoint, return as is
	if (url.includes('/v1/chat/completions') || url.includes('/v3/chat/completions') || url.includes('/gemini') || url.includes('/deepseek')) {
		return url;
	}
	
	// Remove trailing slash if present
	const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
	
	// Append the completions endpoint
	return cleanUrl + '/v1/chat/completions';
}

export function getProviderByApiUrl(apiUrl) {
	const u = normalizeApiUrl(apiUrl) || '';
	if (!u) return 'deepseek';
	if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
	if (u.includes('/gemini')) return 'gemini';
	if (u.includes('/deepseek')) return 'deepseek';
	if (u.includes('siliconflow.cn')) return 'deepseek';
	if (u.includes('deepseek.com')) return 'deepseek';
	if (u.includes('volces.com')) return 'deepseek';
	return 'deepseek';
}

export async function callAiModel({ provider, apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
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
	const effectiveProvider = provider || getProviderByApiUrl(finalUrl);
	
	console.log('[DEBUG] Final URL:', finalUrl, 'Effective provider:', effectiveProvider);
	
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ apiUrl: finalUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
	}
	return callModelDeepseek({ apiUrl: finalUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
}

export function listModelsByProvider(provider, useBackendProxy = false) {
	if (provider === 'gemini') {
		if (useBackendProxy) {
			// 后端代理使用的模型列表
			return [
				'gemini-2.5-pro',
				'gemini-2.5-flash',
				'gemini-2.5-flash-lite',
				'gemini-2.0-flash',
				'gemini-2.0-flash-lite',
				'gemini-1.5-pro',
				'gemini-1.5-flash',
				'gemini-1.5-flash-8b'
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
		// 后端代理使用的DeepSeek模型列表
		return [
			'deepseek-chat',
			'deepseek-reasoner'
		];
	}
	// 直连官方API使用的DeepSeek模型列表
	return [
		'deepseek-ai/DeepSeek-R1',
		'deepseek-ai/DeepSeek-V3'
	];
}