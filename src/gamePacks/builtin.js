export const BUILTIN_GAME_PACKS = [
	{
		id: 'builtin_dnd_adventure',
		title: 'DND 跑团基础包',
		version: 202605150212,
		description: 'D20 检定、生命值、金币、背包、组合式荒野随机遭遇。',
		turnPath: 'world.turn',
		toolResultVisibility: 'visible',
		prompts: {
			host: '你是 DND 风格文本跑团主持人。你负责环境、NPC、战斗和检定时机。玩家没有明确要求时，不要替玩家做决定。',
			rules: '当行动存在不确定性时，可以请求 rollD20。荒野、地城、危险区域可以结合触发器或 randomEncounter 的真实结果推进。状态变化写入 final 的 statePatch。'
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
				alertLevel: 0,
				flags: {}
			}
		},
		ui: [
			{ type: 'stat', label: '生命值', path: 'player.hp', maxPath: 'player.maxHp' },
			{ type: 'text', label: '地点', path: 'world.location' },
			{ type: 'text', label: '任务', path: 'world.quest' },
			{ type: 'text', label: '警戒', path: 'world.alertLevel' },
			{ type: 'text', label: '金币', path: 'player.gold' },
			{ type: 'list', label: '背包', path: 'player.inventory' }
		],
		mobileStatusBar: [
			{ type: 'stat', label: 'HP', path: 'player.hp', maxPath: 'player.maxHp' },
			{ type: 'text', label: '金币', path: 'player.gold' },
			{ type: 'text', label: '地点', path: 'world.location' },
			{ type: 'text', label: '任务', path: 'world.quest' }
		],
		pools: {
			'encounter.category': [
				{ id: 'npc', weight: 4, text: 'NPC', tags: ['npc'] },
				{ id: 'beast', weight: 3, text: '野兽', tags: ['beast', 'hostile'] },
				{ id: 'mystery', weight: 2, text: '异象', tags: ['mystery'] }
			],
			'encounter.actor': [
				{ id: 'merchant', weight: 3, text: '迷路商人', tags: ['npc', 'neutral', 'road'] },
				{ id: 'scout', weight: 2, text: '受伤斥候', tags: ['npc', 'ally', 'wild'] },
				{ id: 'wolf', weight: 3, text: '饥饿的狼', tags: ['beast', 'hostile', 'wild'] },
				{
					id: 'slime',
					weight: 2,
					text: '林间史莱姆',
					tags: ['beast', 'hostile', 'wild'],
					traits: {
						surface: [
							{ weight: 3, text: '表面覆满黏液', tags: ['sticky'] },
							{ weight: 2, text: '表面干燥硬化', tags: ['dry', 'armored'] },
							{ weight: 1, text: '体内泛着酸性绿光', tags: ['acid', 'dangerous'], patch: { 'world.alertLevel': 1 } }
						],
						intent: {
							mode: 'override',
							entries: [
								{ weight: 3, text: '缓慢蠕动觅食' },
								{ weight: 2, text: '正在吞噬一具残骸' },
								{ weight: 2, text: '正在分裂', patch: { 'encounter.enemyCount': 2 } },
								{ weight: 1, text: '腐蚀脚下的石板路面', tags: ['acid'] }
							]
						}
					}
				},
				{ id: 'goblin', weight: 2, text: '翻找货箱的哥布林', tags: ['npc', 'hostile', 'wild'] },
				{ id: 'rune', weight: 1, text: '漂浮的发光符文', tags: ['mystery', 'magic'] }
			],

			'encounter.intent': [
				{ weight: 3, text: '正在寻找失物', tags: ['npc'] },
				{ weight: 2, text: '正在追踪血迹', tags: ['wild'] },
				{ weight: 2, text: '试图埋伏过路者', tags: ['hostile'], patch: { 'world.alertLevel': 1 } },
				{ weight: 1, text: '指向失踪商队的线索', tags: ['mystery'], patch: { 'world.flags.hasCaravanLead': true } }
			],
			'encounter.complication': [
				{ weight: 3, text: '它/他没有说出全部真相' },
				{ weight: 2, text: '附近还有埋伏', patch: { 'world.alertLevel': 2 } },
				{ weight: 1, text: '暴雨即将冲掉所有踪迹' }
			],
			'encounter.reward': [
				{ weight: 4, text: '少量补给' },
				{ weight: 2, text: '旧地图的一角', patch: { 'player.inventory': ['旧地图残片'] } },
				{ weight: 1, text: '被诅咒的护符', tags: ['rare', 'cursed'], patch: { 'world.flags.cursedCharmSeen': true } }
			],
			'encounter.location': [
				{ weight: 3, text: '泥泞小路', tags: ['wild'] },
				{ weight: 2, text: '废弃营火', tags: ['wild'] },
				{ weight: 1, text: '长满苔藓的石碑', tags: ['magic', 'wild'] }
			]
		},
		tools: [
			{
				id: 'rollD20',
				type: 'dice',
				label: 'D20 检定',
				description: '用于能力检定、攻击检定或豁免检定。',
				visibility: ['ai', 'manual'],
				inputSchema: { reason: 'string', difficulty: 'number?', modifier: 'number?' },
				config: { notation: '1d20' }
			},
			{
				id: 'randomEncounter',
				type: 'encounter',
				label: '随机遭遇',
				description: '从多个随机池抽取地点、对象、意图、复杂因素和奖励。',
				visibility: ['ai', 'manual', 'trigger'],
				config: {
					template: '{{locationDetail.text}}附近，{{actor.text}}正在{{intent.text}}。单位特征：{{actorTraits.surface.text|无特殊状态}}。复杂因素：{{complication.text|暂无}}。可能收益：{{reward.text|暂无}}。',
					rolls: {
						category: { pool: 'encounter.category' },
						locationDetail: { pool: 'encounter.location', tagsFromState: 'world.locationTag' },
						actor: { pool: 'encounter.actor', matchTagsFrom: 'category' },
						intent: { pool: 'encounter.intent', matchTagsFrom: ['actor', 'actorTraits'] },
						complication: { pool: 'encounter.complication', chance: 0.5 },
						reward: { pool: 'encounter.reward', chance: 0.35 }
					}
				}

			}
		],
		triggers: [
			{
				id: 'wild-every-3-turns',
				label: '荒野随机遭遇',
				toolId: 'randomEncounter',
				cooldownTurns: 1,
				conditions: [
					{ path: 'world.locationTag', op: 'eq', value: 'wild' },
					{ path: 'world.turn', op: 'every', value: 3 }
				]
			}
		],
		openingMessage: '你来到边境村庄。最近一支商队在北方森林失踪，村长愿意支付金币请人调查。你可以先询问村民、采购补给，或直接前往森林。',
		loadingMessages: [
			'主持人正在翻阅怪物图鉴……',
			'前方的迷雾逐渐散去……',
			'骰子在桌面上旋转不止……',
			'酒馆的吟游诗人正在低声吟唱……',
			'远处传来了奇怪的声响……',
			'NPC 们在讨论最近的传闻……',
			'地图上出现了新的标记……',
			'你的火把发出噼啪的声响……',
			'冒险者公会的公告栏更新了……',
			'命运的齿轮开始转动……',
			'有什么东西在暗处注视着你……',
			'空气中弥漫着冒险的气息……'
		]
	},
	{
		id: 'builtin_coc_investigation',
		title: 'COC 调查基础包',
		version: 202605150212,
		description: '理智、线索、调查检定、条件随机表和状态检查。',
		turnPath: 'world.turn',
		toolResultVisibility: 'visible',
		instructions: {
			narrator: '你是 COC 风格调查主持人。你负责线索、氛围、NPC 和异常事件。保持信息递进，不要提前揭露真相。',
			rules: '当玩家调查、聆听、说服、潜行或面对未知现象时，可以请求 rollD100。异常事件必须基于 strangeEvent 的真实结果。理智变化写入 final 的 statePatch。'
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
		mobileStatusBar: [
			{ type: 'stat', label: 'HP', path: 'investigator.hp', maxPath: 'investigator.maxHp' },
			{ type: 'stat', label: 'SAN', path: 'investigator.sanity', maxPath: 'investigator.maxSanity' },
			{ type: 'text', label: '地点', path: 'world.location' },
			{ type: 'text', label: '案件', path: 'world.case' },
			{ type: 'list', label: '线索', path: 'investigator.clues' }
		],
		tools: [
			{
				id: 'rollD100',
				type: 'dice',
				label: 'D100 检定',
				description: '用于调查、聆听、说服、潜行等百分骰检定。',
				visibility: ['ai', 'manual'],
				inputSchema: { reason: 'string', difficulty: 'number?', modifier: 'number?' },
				config: { notation: '1d100' }
			},
			{
				id: 'strangeEvent',
				type: 'table',
				label: '异常事件',
				description: '根据当前地点标签抽取可用异常事件。',
				visibility: ['ai', 'manual', 'trigger'],
				entries: [
					{ weight: 4, text: '窗外的雾气短暂凝成一张陌生人的脸。' },
					{ weight: 3, text: '旅馆走廊尽头响起湿漉漉的脚步声，但没有人出现。', conditions: [{ path: 'world.locationTag', op: 'neq', value: 'day' }] },
					{ weight: 2, text: '一页被撕下的航海日志从门缝下滑进房间。', patch: { 'investigator.clues': ['航海日志残页'] } },
					{ weight: 1, text: '镜子里短暂映出码头方向的黑色船影。', tags: ['vision'], patch: { 'world.flags.blackShipSeen': true } }
				]
			},
			{
				id: 'checkSanityLow',
				type: 'stateCheck',
				label: '检查理智危险',
				visibility: ['ai', 'trigger'],
				config: {
					path: 'investigator.sanity',
					op: 'lte',
					value: 20
				}
			}
		],
		triggers: [
			{
				id: 'night-strange-event',
				label: '夜间异常事件',
				toolId: 'strangeEvent',
				maxRuns: 4,
				conditions: [
					{ path: 'world.locationTag', op: 'eq', value: 'night' },
					{ path: 'world.turn', op: 'every', value: 2 }
				]
			},
			{
				id: 'low-sanity-warning',
				label: '理智危险检查',
				toolId: 'checkSanityLow',
				cooldownTurns: 3,
				conditions: [
					{ path: 'investigator.sanity', op: 'lte', value: 20 }
				]
			}
		],
		openingMessage: '雾港镇连续三晚有人失踪。你抵达镇上唯一的旅馆时，老板递来一把潮湿的钥匙，并说上一位住进这个房间的人再也没有回来。',
		loadingMessages: [
			'走廊尽头传来了湿漉漉的脚步声……',
			'调查员翻开了泛黄的案件档案……',
			'窗外的雾气似乎更浓了……',
			'你感到一阵不安的寒意……',
			'旧报纸上的某条消息引起了注意……',
			'隔壁房间传来低沉的呢喃……',
			'镇上的钟楼敲响了不祥的钟声……',
			'你注意到墙角的影子似乎在移动……',
			'远处的海面上浮现出模糊的轮廓……',
			'一页被撕下的日记从书架后掉落……',
			'灯火忽明忽暗，仿佛有什么在靠近……',
			'真相藏在理智所不能触及的深处……'
		]
	}
];
