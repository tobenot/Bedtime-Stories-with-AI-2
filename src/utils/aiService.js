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

export function getProviderByApiUrl(apiUrl) {
	const u = normalizeApiUrl(apiUrl) || '';
	if (!u) return 'deepseek';
	if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
	if (u.includes('/gemini')) return 'gemini';
	if (u.includes('siliconflow.cn')) return 'deepseek';
	if (u.includes('deepseek.com')) return 'deepseek';
	if (u.includes('volces.com')) return 'deepseek';
	return 'deepseek';
}

export async function callAiModel({ provider, apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	const normalizedUrl = normalizeApiUrl(apiUrl);
	const effectiveProvider = provider || getProviderByApiUrl(normalizedUrl);
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ apiUrl: normalizedUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
	}
	return callModelDeepseek({ apiUrl: normalizedUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
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