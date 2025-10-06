/**
 * 旧版AI服务 - 保持向后兼容
 * 现在所有调用都转发到新的核心AI服务
 * @deprecated 请使用 @/core/services/aiService 代替
 */

import { 
	callAiModel as coreCallAiModel,
	listModelsByProvider as coreListModelsByProvider,
	getProviderByApiUrl as coreGetProviderByApiUrl
} from '@/core/services/aiService';

// 向后兼容的导出
export const callAiModel = coreCallAiModel;
export const listModelsByProvider = coreListModelsByProvider;
export const getProviderByApiUrl = coreGetProviderByApiUrl;