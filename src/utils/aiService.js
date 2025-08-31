import { callModelDeepseek } from './providers/deepseek';
import { callModelGemini } from './providers/gemini';

export function getProviderByApiUrl(apiUrl) {
	if (!apiUrl) return 'deepseek';
	if (apiUrl.includes('generativelanguage.googleapis.com')) return 'gemini';
	if (apiUrl.includes('/gemini')) return 'gemini';
	if (apiUrl.includes('siliconflow.cn')) return 'deepseek';
	if (apiUrl.includes('deepseek.com')) return 'deepseek';
	if (apiUrl.includes('volces.com')) return 'deepseek';
	return 'deepseek';
}

export async function callAiModel({ provider, apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	const effectiveProvider = provider || getProviderByApiUrl(apiUrl);
	if (effectiveProvider === 'gemini') {
		return callModelGemini({ apiUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
	}
	return callModelDeepseek({ apiUrl, apiKey, model, messages, temperature, maxTokens, signal, onChunk });
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