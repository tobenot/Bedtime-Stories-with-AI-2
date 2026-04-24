/**
 * 模型列表拉取服务
 * 
 * Phase 3: 提供 fetchModelsFromServer() 函数，
 * 通过 GET {baseUrl}/models 拉取远端模型列表。
 * 
 * 设计原则：
 * - 这是辅助功能，不是强依赖
 * - 拉取失败时，仍然允许手动维护模型列表
 * - 拉到之后，也允许继续人工编辑
 */

import { normalizeBaseUrl } from '@/config/presets';

/**
 * 从远端服务器拉取模型列表
 * 
 * @param {string} baseUrl - API 基础地址（如 https://api.siliconflow.cn/v1）
 * @param {string} apiKey - API Key（用于 Bearer token 认证）
 * @param {Object} [options] - 可选配置
 * @param {number} [options.timeout=15000] - 超时时间（毫秒）
 * @param {AbortSignal} [options.signal] - 取消信号
 * @returns {Promise<{ success: boolean, models: string[], error?: string }>}
 */
export async function fetchModelsFromServer(baseUrl, apiKey, options = {}) {
	const { timeout = 15000, signal } = options;

	const normalizedUrl = normalizeBaseUrl(baseUrl);
	if (!normalizedUrl) {
		return { success: false, models: [], error: '请先填写 API 地址' };
	}

	// 拼接 /models 端点
	const modelsUrl = buildModelsEndpoint(normalizedUrl);

	console.log('[ModelFetcher] Fetching models from:', modelsUrl);

	// 创建超时控制
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	// 如果外部传入了 signal，也监听它
	if (signal) {
		signal.addEventListener('abort', () => controller.abort());
	}

	try {
		const headers = {
			'Accept': 'application/json',
		};

		// 仅在提供了 apiKey 时添加 Authorization 头
		if (apiKey && apiKey.trim()) {
			headers['Authorization'] = `Bearer ${apiKey.trim()}`;
		}

		const response = await fetch(modelsUrl, {
			method: 'GET',
			headers,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const statusText = response.statusText || `HTTP ${response.status}`;
			if (response.status === 401 || response.status === 403) {
				return { success: false, models: [], error: `认证失败（${statusText}），请检查 API Key 是否正确` };
			}
			if (response.status === 404) {
				return { success: false, models: [], error: `该服务不支持 /models 端点（404）` };
			}
			return { success: false, models: [], error: `请求失败：${statusText}` };
		}

		const data = await response.json();
		const models = extractModelIds(data);

		if (models.length === 0) {
			return { success: false, models: [], error: '服务器返回了数据，但未能解析出模型列表' };
		}

		console.log(`[ModelFetcher] Successfully fetched ${models.length} models`);
		return { success: true, models };

	} catch (err) {
		clearTimeout(timeoutId);

		if (err.name === 'AbortError') {
			return { success: false, models: [], error: '请求超时或已取消' };
		}

		console.error('[ModelFetcher] Fetch error:', err);
		return { success: false, models: [], error: `网络错误：${err.message}` };
	}
}

/**
 * 拼接 /models 端点
 * 
 * 处理各种 baseUrl 格式：
 * - https://api.siliconflow.cn/v1 → https://api.siliconflow.cn/v1/models
 * - https://example.com/api/v1   → https://example.com/api/v1/models
 */
function buildModelsEndpoint(baseUrl) {
	const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	return `${cleanUrl}/models`;
}

/**
 * 从各种格式的响应中提取模型 ID 列表
 * 
 * 兼容格式：
 * 1. OpenAI 标准:  { data: [{ id: 'gpt-4o' }, ...] }
 * 2. 某些网关:      { models: [{ id: 'gpt-4o' }, ...] }
 * 3. 某些网关:      { models: ['gpt-4o', ...] }
 * 4. 纯数组:        [{ id: 'gpt-4o' }, ...]
 * 5. 字符串数组:    ['gpt-4o', ...]
 * 6. 某些网关:      { data: ['gpt-4o', ...] }
 * 7. object 字段:   { object: 'list', data: [...] }  (标准 OpenAI 完整格式)
 */
function extractModelIds(responseData) {
	if (!responseData) return [];

	// 尝试多种提取路径
	const candidates = [
		responseData.data,          // OpenAI 标准 / new-api / one-api
		responseData.models,        // 某些网关格式
		responseData,               // 直接返回数组
	];

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			const ids = candidate
				.map(item => {
					if (typeof item === 'string') return item;
					if (item && typeof item === 'object' && typeof item.id === 'string') return item.id;
					if (item && typeof item === 'object' && typeof item.name === 'string') return item.name;
					return null;
				})
				.filter(id => id && id.trim().length > 0);

			if (ids.length > 0) {
				// 去重但保留服务端原始顺序，避免打乱默认模型优先级
				return [...new Set(ids)];
			}

		}
	}

	return [];
}
