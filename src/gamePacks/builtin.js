export const BUILTIN_GAME_PACKS = [
	{
		id: 'builtin_dnd_adventure',
		title: 'DND 跑团基础包',
		version: 1,
		description: 'D20 检定、生命值、金币、背包、荒野随机遭遇。',
		turnPath: 'world.turn',
		prompts: {
			host: '你是 DND 风格文本跑团主持人。你负责环境、NPC、战斗和检定时机。玩家没有明确要求时，不要替玩家做决定。',
			rules: '当行动存在不确定性时，可以请求 rollD20。荒野、地城、危险区域可以结合已触发的随机遭遇推进。状态变化写入 statePatch。'
		},
		initialState: {
			player: {
				name: '冒险者',
				hp: 12,
				maxHp: 12,
				gold: 10,
				inventory: ['短剑', '火把', '干粮']
			},
			world: {
				turn: 0,
				location: '边境村庄',
				locationTag: 'town',
				quest: '寻找失踪的商队',
				flags: {}
			}
		},
		ui: [
			{ type: 'stat', label: '生命值', path: 'player.hp', maxPath: 'player.maxHp' },
			{ type: 'text', label: '地点', path: 'world.location' },
			{ type: 'text', label: '任务', path: 'world.quest' },
			{ type: 'text', label: '金币', path: 'player.gold' },
			{ type: 'list', label: '背包', path: 'player.inventory' }
		],
		tools: [
			{
				id: 'rollD20',
				type: 'dice',
				label: 'D20 检定',
				notation: '1d20'
			},
			{
				id: 'wildEncounter',
				type: 'table',
				label: '荒野遭遇',
				entries: [
					{ weight: 5, text: '林间传来脚步声，一队哥布林正在争抢商队货箱。' },
					{ weight: 3, text: '一名受伤商人靠在树下，请求玩家护送他回村。' },
					{ weight: 2, text: '道路中央出现一枚发光符文，周围的鸟兽全部安静下来。' }
				]
			}
		],
		triggers: [
			{
				id: 'wild-every-3-turns',
				label: '荒野随机遭遇',
				toolId: 'wildEncounter',
				conditions: [
					{ path: 'world.locationTag', op: 'eq', value: 'wild' },
					{ path: 'world.turn', op: 'every', value: 3 }
				]
			}
		],
		openingMessage: '你来到边境村庄。最近一支商队在北方森林失踪，村长愿意支付金币请人调查。你可以先询问村民、采购补给，或直接前往森林。'
	},
	{
		id: 'builtin_coc_investigation',
		title: 'COC 调查基础包',
		version: 1,
		description: '理智、线索、调查检定、异常事件表。',
		turnPath: 'world.turn',
		prompts: {
			host: '你是 COC 风格调查主持人。你负责线索、氛围、NPC 和异常事件。保持信息递进，不要提前揭露真相。',
			rules: '当玩家调查、聆听、说服、潜行或面对未知现象时，可以请求对应 D100 检定。理智变化写入 statePatch。'
		},
		initialState: {
			investigator: {
				name: '调查员',
				hp: 10,
				maxHp: 10,
				sanity: 55,
				maxSanity: 55,
				clues: []
			},
			world: {
				turn: 0,
				location: '雾港镇旅馆',
				locationTag: 'town',
				case: '雾港镇失踪案',
				flags: {}
			}
		},
		ui: [
			{ type: 'stat', label: '生命值', path: 'investigator.hp', maxPath: 'investigator.maxHp' },
			{ type: 'stat', label: '理智', path: 'investigator.sanity', maxPath: 'investigator.maxSanity' },
			{ type: 'text', label: '地点', path: 'world.location' },
			{ type: 'text', label: '案件', path: 'world.case' },
			{ type: 'list', label: '线索', path: 'investigator.clues' }
		],
		tools: [
			{
				id: 'rollD100',
				type: 'dice',
				label: 'D100 检定',
				notation: '1d100'
			},
			{
				id: 'strangeEvent',
				type: 'table',
				label: '异常事件',
				entries: [
					{ weight: 4, text: '窗外的雾气短暂凝成一张陌生人的脸。' },
					{ weight: 3, text: '旅馆走廊尽头响起湿漉漉的脚步声，但没有人出现。' },
					{ weight: 2, text: '一页被撕下的航海日志从门缝下滑进房间。', patch: { 'investigator.clues': ['航海日志残页'] } }
				]
			}
		],
		triggers: [
			{
				id: 'night-strange-event',
				label: '夜间异常事件',
				toolId: 'strangeEvent',
				conditions: [
					{ path: 'world.locationTag', op: 'eq', value: 'night' },
					{ path: 'world.turn', op: 'every', value: 2 }
				]
			}
		],
		openingMessage: '雾港镇连续三晚有人失踪。你抵达镇上唯一的旅馆时，老板递来一把潮湿的钥匙，并说上一位住进这个房间的人再也没有回来。'
	}
];
