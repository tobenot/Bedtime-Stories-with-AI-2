/**
 * 虚拟恋人模式工具函数
 */

import { EMOTION_MAP, ACTION_MAP, FAVORABILITY_LEVELS, SCORE_MAP } from './constants.js';

/**
 * 获取表情信息
 * @param {number} emoteId - 表情ID
 * @returns {Object} 表情信息
 */
export function getEmotionInfo(emoteId) {
	return EMOTION_MAP[emoteId] || EMOTION_MAP[1];
}

/**
 * 获取动作信息
 * @param {number} actionId - 动作ID
 * @returns {Object} 动作信息
 */
export function getActionInfo(actionId) {
	return ACTION_MAP[actionId] || ACTION_MAP[5];
}

/**
 * 获取好感度等级
 * @param {number} favorability - 好感度值
 * @returns {string} 好感度等级
 */
export function getFavorabilityLevel(favorability) {
	const levels = Object.keys(FAVORABILITY_LEVELS)
		.map(Number)
		.sort((a, b) => b - a);
	
	for (const level of levels) {
		if (favorability >= level) {
			return FAVORABILITY_LEVELS[level];
		}
	}
	
	return FAVORABILITY_LEVELS[0];
}

/**
 * 计算好感度变化
 * @param {number} score - 评分
 * @returns {number} 好感度变化值
 */
export function calculateFavorabilityChange(score) {
	const scoreInfo = SCORE_MAP[score];
	return scoreInfo ? scoreInfo.favorabilityChange : 0;
}

/**
 * 解析消息内容
 * @param {Object} message - 消息对象
 * @returns {string} 显示内容
 */
export function parseMessageContent(message) {
	if (message.role === 'user') {
		return message.content;
	}
	
	try {
		const data = JSON.parse(message.content);
		return data.reply || data.content || '彩彩正在思考中...';
	} catch (e) {
		return '彩彩正在思考中...';
	}
}

/**
 * 解析角色状态数据
 * @param {Object} message - 消息对象
 * @returns {Object} 角色状态数据
 */
export function parseCharacterState(message) {
	if (!message || !message.content) {
		return { emote: 1, bodyAction: 5, evaluation: '', score: null };
	}
	
	try {
		return JSON.parse(message.content);
	} catch (e) {
		return { emote: 1, bodyAction: 5, evaluation: '', score: null };
	}
}

/**
 * 保存角色数据到聊天元数据
 * @param {Object} chat - 聊天对象
 * @param {Object} loverData - 恋人数据
 */
export function saveLoverData(chat, loverData) {
	if (!chat.metadata) {
		chat.metadata = {};
	}
	
	// 确保好感度在有效范围内
	loverData.favorability = Math.min(Math.max(loverData.favorability, 0), 100);
	chat.metadata.loverData = { ...loverData };
}

/**
 * 保存角色状态到聊天元数据
 * @param {Object} chat - 聊天对象
 * @param {Object} characterState - 角色状态
 */
export function saveCharacterState(chat, characterState) {
	if (!chat.metadata) {
		chat.metadata = {};
	}
	
	chat.metadata.lastCharacterState = {
		emote: characterState.emote.toString(),
		bodyAction: characterState.bodyAction.toString(),
		evaluation: characterState.evaluation,
		score: characterState.score?.toString() ?? null
	};
}

/**
 * 从聊天元数据加载恋人数据
 * @param {Object} chat - 聊天对象
 * @param {Object} defaultData - 默认数据
 * @returns {Object} 恋人数据
 */
export function loadLoverData(chat, defaultData) {
	if (chat.metadata?.loverData) {
		return { ...defaultData, ...chat.metadata.loverData };
	}
	return defaultData;
}

/**
 * 从聊天元数据加载角色状态
 * @param {Object} chat - 聊天对象
 * @returns {Object} 角色状态
 */
export function loadCharacterState(chat) {
	if (chat.metadata?.lastCharacterState) {
		const state = chat.metadata.lastCharacterState;
		return {
			emote: parseInt(state.emote) || 1,
			bodyAction: parseInt(state.bodyAction) || 5,
			evaluation: state.evaluation || '',
			score: parseInt(state.score) ?? null
		};
	}
	return { emote: 1, bodyAction: 5, evaluation: '', score: null };
}

/**
 * 检查是否在底部
 * @param {Event} event - 滚动事件
 * @returns {boolean} 是否在底部
 */
export function isAtBottom(event) {
	const { scrollTop, scrollHeight, clientHeight } = event.target;
	return scrollHeight - scrollTop - clientHeight < 50;
}

/**
 * 滚动到底部
 * @param {HTMLElement} container - 容器元素
 */
export function scrollToBottom(container) {
	if (container) {
		container.scrollTop = container.scrollHeight;
	}
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
	let timeoutId;
	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(this, args), delay);
	};
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
	let inThrottle;
	return function (...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(date) {
	return new Intl.DateTimeFormat('zh-CN', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).format(date);
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
export function deepClone(obj) {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	
	if (obj instanceof Date) {
		return new Date(obj.getTime());
	}
	
	if (obj instanceof Array) {
		return obj.map(item => deepClone(item));
	}
	
	if (typeof obj === 'object') {
		const clonedObj = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				clonedObj[key] = deepClone(obj[key]);
			}
		}
		return clonedObj;
	}
}
