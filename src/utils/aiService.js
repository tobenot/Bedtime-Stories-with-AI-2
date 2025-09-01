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
	if (url.includes('/v1/chat/completions') || url.includes('/v3/chat/completions') || url.includes('/gemini')) {
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
	if (u.includes('siliconflow.cn')) return 'deepseek';
	if (u.includes('deepseek.com')) return 'deepseek';
	if (u.includes('volces.com')) return 'deepseek';
	if (u.includes('tyo.tobenot.top')) return 'deepseek';
	return 'deepseek';
}

export async function callAiModel({ provider, apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	const normalizedUrl = normalizeApiUrl(apiUrl);
	// Ensure all URLs have the completions endpoint for consistency
	const finalUrl = ensureCompletionsEndpoint(normalizedUrl);
	const effectiveProvider = provider || getProviderByApiUrl(finalUrl);
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ apiUrl: finalUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
	}
	return callModelDeepseek({ apiUrl: finalUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
}

export function listModelsByProvider(provider) {
	if (provider === 'gemini') {
		return [
			'gemini-2.0-flash-exp',
			'gemini-1.5-pro-002',
			'gemini-1.5-flash-002'
		];
	}
	return [
		'deepseek-ai/DeepSeek-R1',
		'deepseek-ai/DeepSeek-V3'
	];
}