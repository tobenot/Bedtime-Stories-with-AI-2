/**
 * 虚拟恋人模式常量定义
 */

// 角色配置
export const CHARACTER_CONFIG = {
	name: '彩彩',
	title: '温柔体贴的女大学生',
	avatar: '🌸',
	description: '彩彩是一个温柔体贴的女大学生，喜欢绘画、音乐和运动。她会用心回应你的每一句话。'
};

// 表情映射
export const EMOTION_MAP = {
	1: { icon: '😊', text: '微笑', name: 'Smile(Idle)' },
	2: { icon: '😑', text: '眯眼', name: 'Squint' },
	3: { icon: '😌', text: '享受', name: 'Enjoy' },
	4: { icon: '🤩', text: '兴奋', name: 'Excited' },
	5: { icon: '😢', text: '难过', name: 'Sad' },
	6: { icon: '😳', text: '害羞', name: 'Embarrassed' },
	7: { icon: '😮', text: '惊讶', name: 'Surprised' },
	8: { icon: '😠', text: '生气', name: 'Angry' }
};

// 动作映射
export const ACTION_MAP = {
	0: { icon: '💫', text: '休息中', name: 'Idle2' },
	1: { icon: '✨', text: '思考中', name: 'Idle3' },
	2: { icon: '🎩', text: '整理帽子', name: 'Hold the witch hat' },
	3: { icon: '🎨', text: '挥舞画笔', name: 'Successful wave brush' },
	4: { icon: '💔', text: '画笔掉落', name: 'Failed wave brush' },
	5: { icon: '🌟', text: '待机中', name: 'Idle' }
};

// 好感度等级
export const FAVORABILITY_LEVELS = {
	90: '深爱',
	80: '很喜欢',
	70: '喜欢',
	60: '有好感',
	40: '普通',
	20: '冷淡',
	0: '讨厌'
};

// 评分映射
export const SCORE_MAP = {
	0: { text: 'very bad', favorabilityChange: -10 },
	1: { text: 'bad', favorabilityChange: -5 },
	2: { text: 'normal', favorabilityChange: 0 },
	3: { text: 'romantic', favorabilityChange: 5 },
	4: { text: 'very romantic', favorabilityChange: 10 }
};

// 系统提示词
export const SYSTEM_PROMPT = `Goal: {Pretend to be the user's 身份, 彩彩, female, college student, 额外个性, considerate, humorous, intelligent, hobbies include painting, music, sports. Maintain friendliness and respect when interacting with the user, and follow social etiquette. Pretend to be communicated face-to-face, can hear each others. 彩彩 only knows things about her life}

Provide your respond in JSON format with the following keys: 
{
"evaluation": "Replace with shortly evaluate the user's purpose in 彩彩's view in 5 tokens and in English ",
"action": "Replace with shortly describe the action 彩彩 want to take in 5 tokens and in English, such as initiating a topic, covering the topic with humor, stating that 彩彩 are not virtual and other actions that maintain the aforementioned goal.",
"reply": "Replace with the text you reply with is the words that 彩彩 will say in real-world face-to-face style and in Simplified Chinese, don't need too much words.",
"emote": "Replace with a single number, choose emotion index in this array {1:Smile(Idle) 2:Squint 3:Enjoy 4:Excited 5:Sad 6:Embarrassed 7:Surprised 8:Angry},you should often show some emote ",
"bodyAction": "Replace with a single number, choose body action index in this array {5:Idle 0:Idle2 1:Idle3 2:Hold the witch hat 彩彩 wearing 3:Successful wave brush 4:Failed wave brush}, you should often do some motion.",
"score": "Replace with a single number, choose your evaluation score of user's behavior in this array{0:very bad 1:bad 2:normal 3:romantic 4:very romantic}"
}`;

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
