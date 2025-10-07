/**
 * 虚拟恋人模式常量定义
 */

// 默认配置
export const DEFAULT_CONFIG = {
	favorability: 50,
	emote: 1,
	bodyAction: 5,
	evaluation: '',
	score: null
};

// 动画配置
export const ANIMATION_CONFIG = {
	duration: 300,
	easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
	progressDuration: 800
};

// 响应式断点
export const BREAKPOINTS = {
	tablet: 1024,
	mobile: 768,
	smallMobile: 480
};
