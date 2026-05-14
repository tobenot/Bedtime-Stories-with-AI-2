import { createUuid } from '@/utils/chatData';

const SUPPORTED_TOOL_TYPES = ['dice', 'table'];

export function cloneData(value) {
	return JSON.parse(JSON.stringify(value ?? null));
}

export function createDefaultGameState(pack) {
	return cloneData(pack?.initialState || {});
}

export function getByPath(source, path, fallback = undefined) {
	if (!path || typeof path !== 'string') return fallback;
	const parts = path.split('.').filter(Boolean);
	let current = source;
	for (const part of parts) {
		if (current === null || current === undefined) return fallback;
		current = current[part];
	}
	return current === undefined ? fallback : current;
}

export function setByPath(target, path, value) {
	if (!path || typeof path !== 'string') return;
	const parts = path.split('.').filter(Boolean);
	if (!parts.length) return;
	let current = target;
	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];
		if (!current[part] || typeof current[part] !== 'object') {
			current[part] = {};
		}
		current = current[part];
	}
	current[parts[parts.length - 1]] = value;
}

export function applyStatePatch(state, patch) {
	if (!patch) return [];
	const changes = [];
	const operations = Array.isArray(patch)
		? patch
		: Object.entries(patch).map(([path, value]) => ({ path, value }));

	for (const operation of operations) {
		if (!operation?.path) continue;
		const previous = getByPath(state, operation.path, null);
		const nextValue = operation.value;
		setByPath(state, operation.path, nextValue);
		changes.push({
			path: operation.path,
			from: previous,
			to: nextValue
		});
	}
	return changes;
}

export function incrementTurn(state, pack) {
	const turnPath = pack?.turnPath || 'world.turn';
	const currentTurn = Number(getByPath(state, turnPath, 0)) || 0;
	setByPath(state, turnPath, currentTurn + 1);
	return currentTurn + 1;
}

export function rollDice(notation = '1d20') {
	const match = String(notation).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
	if (!match) {
		throw new Error(`不支持的骰子表达式：${notation}`);
	}
	const count = Math.max(1, parseInt(match[1] || '1', 10));
	const sides = Math.max(2, parseInt(match[2], 10));
	const modifier = parseInt(match[3] || '0', 10);
	const rolls = [];
	for (let i = 0; i < count; i += 1) {
		rolls.push(Math.floor(Math.random() * sides) + 1);
	}
	const rawTotal = rolls.reduce((sum, value) => sum + value, 0);
	return {
		notation: `${count}d${sides}${modifier ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : ''}`,
		rolls,
		modifier,
		total: rawTotal + modifier
	};
}

export function pickWeightedEntry(entries = []) {
	const normalizedEntries = entries
		.map(entry => ({
			...entry,
			weight: Math.max(0, Number(entry?.weight ?? 1) || 0)
		}))
		.filter(entry => entry.weight > 0);
	const totalWeight = normalizedEntries.reduce((sum, entry) => sum + entry.weight, 0);
	if (!totalWeight) return null;
	let cursor = Math.random() * totalWeight;
	for (const entry of normalizedEntries) {
		cursor -= entry.weight;
		if (cursor <= 0) return entry;
	}
	return normalizedEntries[normalizedEntries.length - 1] || null;
}

export function executeGameTool(tool, state) {
	if (!tool || !SUPPORTED_TOOL_TYPES.includes(tool.type)) {
		throw new Error('机制包工具不存在或类型不受支持');
	}
	if (tool.type === 'dice') {
		const result = rollDice(tool.notation || '1d20');
		return {
			id: createUuid(),
			toolId: tool.id,
			type: 'dice',
			label: tool.label || tool.id,
			text: `${tool.label || tool.id}：${result.notation} = ${result.total} (${result.rolls.join(', ')}${result.modifier ? `, 修正 ${result.modifier}` : ''})`,
			result
		};
	}

	const entry = pickWeightedEntry(tool.entries || []);
	if (!entry) {
		throw new Error(`随机表没有可用条目：${tool.label || tool.id}`);
	}
	const changes = applyStatePatch(state, entry.patch);
	return {
		id: createUuid(),
		toolId: tool.id,
		type: 'table',
		label: tool.label || tool.id,
		text: `${tool.label || tool.id}：${entry.text || entry.label || '未命名结果'}`,
		entry,
		changes
	};
}

function compareValues(left, op, right) {
	if (op === 'eq') return left === right;
	if (op === 'neq') return left !== right;
	if (op === 'gt') return Number(left) > Number(right);
	if (op === 'gte') return Number(left) >= Number(right);
	if (op === 'lt') return Number(left) < Number(right);
	if (op === 'lte') return Number(left) <= Number(right);
	if (op === 'truthy') return Boolean(left);
	if (op === 'falsy') return !left;
	if (op === 'includes') return Array.isArray(left) ? left.includes(right) : String(left || '').includes(String(right));
	if (op === 'every') {
		const number = Number(left);
		const interval = Number(right);
		return interval > 0 && number > 0 && number % interval === 0;
	}
	return false;
}

export function shouldRunTrigger(trigger, state) {
	const conditions = Array.isArray(trigger?.conditions) ? trigger.conditions : [];
	if (!conditions.length) return false;
	return conditions.every(condition => {
		const value = getByPath(state, condition.path, null);
		return compareValues(value, condition.op || 'eq', condition.value);
	});
}

export function runGameTriggers(pack, state) {
	const toolsById = getToolsById(pack);
	const results = [];
	for (const trigger of pack?.triggers || []) {
		if (!shouldRunTrigger(trigger, state)) continue;
		const tool = toolsById[trigger.toolId];
		if (!tool) continue;
		const result = executeGameTool(tool, state);
		results.push({
			triggerId: trigger.id,
			label: trigger.label || result.label,
			result
		});
	}
	return results;
}

export function getToolsById(pack) {
	const tools = Array.isArray(pack?.tools) ? pack.tools : [];
	return tools.reduce((map, tool) => {
		if (tool?.id) map[tool.id] = tool;
		return map;
	}, {});
}

export function safeParseGameResponse(text) {
	const raw = String(text || '').trim();
	if (!raw) return null;
	const withoutFence = raw
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/```$/i, '')
		.trim();
	const firstBrace = withoutFence.indexOf('{');
	const lastBrace = withoutFence.lastIndexOf('}');
	if (firstBrace < 0 || lastBrace < firstBrace) return null;
	return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
}

function formatValue(value) {
	if (Array.isArray(value)) return value.join('、');
	if (value && typeof value === 'object') return JSON.stringify(value);
	if (value === undefined || value === null || value === '') return '空';
	return String(value);
}

export function formatToolResults(results = []) {
	return results
		.map(item => `【${item.label || '工具结果'}】\n${item.result?.text || item.text || ''}`)
		.join('\n\n');
}

export function formatStateChanges(changes = []) {
	if (!changes.length) return '';
	return [
		'【状态变化】',
		...changes.map(change => `${change.path}：${formatValue(change.from)} → ${formatValue(change.to)}`)
	].join('\n');
}

export function formatChoices(choices = []) {
	const normalized = Array.isArray(choices) ? choices.filter(Boolean) : [];
	if (!normalized.length) return '';
	return [
		'【可选行动】',
		...normalized.map((choice, index) => `${index + 1}. ${choice}`)
	].join('\n');
}

export function buildGameAssistantContent({ narration, choices, toolResults, changes }) {
	return [
		narration || '',
		formatToolResults(toolResults),
		formatStateChanges(changes),
		formatChoices(choices)
	].filter(Boolean).join('\n\n');
}

export function buildGameSystemPrompt(pack, state, triggerResults = []) {
	const responseSchema = {
		narration: '给玩家看的正文',
		choices: ['可选行动，允许为空数组'],
		statePatch: { 'path.to.value': '新值，允许为空对象' },
		toolRequests: [{ toolId: '工具ID', reason: '为什么需要工具' }]
	};
	const tools = (pack?.tools || []).map(tool => ({
		id: tool.id,
		type: tool.type,
		label: tool.label,
		notation: tool.notation
	}));
	return [
		pack?.prompts?.host || pack?.prompt || '',
		pack?.prompts?.rules || '',
		'你是文本游戏主持人。根据玩家输入推进游戏。',
		'只能返回 JSON，不要包裹 Markdown 代码块。',
		`返回格式：${JSON.stringify(responseSchema)}`,
		`当前机制包：${pack?.title || pack?.id || '未命名机制包'}`,
		`当前状态：${JSON.stringify(state || {})}`,
		tools.length ? `可请求工具：${JSON.stringify(tools)}` : '当前机制包没有声明工具。',
		triggerResults.length ? `本回合已触发事件：${triggerResults.map(item => item.result?.text).filter(Boolean).join('；')}` : ''
	].filter(Boolean).join('\n\n');
}
