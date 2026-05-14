import { createUuid } from '@/utils/chatData';

const SUPPORTED_TOOL_TYPES = ['dice', 'table', 'encounter', 'stateCheck', 'patchState'];
const DEFAULT_VISIBILITY = ['ai', 'manual', 'trigger'];

export function cloneData(value) {
	if (value === undefined) return undefined;
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

function normalizePatchOperations(patch) {
	if (!patch) return [];
	if (Array.isArray(patch)) {
		return patch
			.map(operation => ({
				path: operation?.path,
				value: operation?.value
			}))
			.filter(operation => operation.path);
	}
	if (typeof patch !== 'object') return [];
	return Object.entries(patch).map(([path, value]) => ({ path, value }));
}

export function applyStatePatch(state, patch, options = {}) {
	if (!state || !patch) return [];
	const source = typeof options === 'string' ? options : options?.source;
	const changes = [];
	for (const operation of normalizePatchOperations(patch)) {
		const previous = cloneData(getByPath(state, operation.path, null));
		const nextValue = cloneData(operation.value);
		setByPath(state, operation.path, nextValue);
		changes.push({
			path: operation.path,
			from: previous,
			to: nextValue,
			...(source ? { source } : {})
		});
	}
	return changes;
}

/** 将 patch 操作合并到 target 对象，后写覆盖前写。数组值整体替换而非追加。 */
function mergePatch(target, patch) {
	for (const operation of normalizePatchOperations(patch)) {
		target[operation.path] = cloneData(operation.value);
	}
	return target;
}

export function incrementTurn(state, pack) {
	const turnPath = pack?.turnPath || 'world.turn';
	const currentTurn = Number(getByPath(state, turnPath, 0)) || 0;
	setByPath(state, turnPath, currentTurn + 1);
	return currentTurn + 1;
}

export function rollDice(notation = '1d20', extraModifier = 0) {
	const match = String(notation).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
	if (!match) {
		throw new Error(`不支持的骰子表达式：${notation}`);
	}
	const count = Math.max(1, parseInt(match[1] || '1', 10));
	const sides = Math.max(2, parseInt(match[2], 10));
	const notationModifier = parseInt(match[3] || '0', 10);
	const inputModifier = Number(extraModifier || 0) || 0;
	const modifier = notationModifier + inputModifier;
	const rolls = [];
	for (let i = 0; i < count; i += 1) {
		rolls.push(Math.floor(Math.random() * sides) + 1);
	}
	const rawTotal = rolls.reduce((sum, value) => sum + value, 0);
	return {
		notation: `${count}d${sides}${notationModifier ? (notationModifier > 0 ? `+${notationModifier}` : `${notationModifier}`) : ''}`,
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

function getToolConfig(tool) {
	return tool?.config && typeof tool.config === 'object' ? tool.config : {};
}

function getToolVisibility(tool) {
	return Array.isArray(tool?.visibility) && tool.visibility.length ? tool.visibility : DEFAULT_VISIBILITY;
}

function canUseTool(tool, source) {
	return getToolVisibility(tool).includes(source || 'ai');
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

function normalizeConditions(value) {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

function evaluateConditions(conditions, state) {
	return normalizeConditions(conditions).every(condition => {
		if (!condition?.path) return true;
		const value = getByPath(state, condition.path, null);
		return compareValues(value, condition.op || 'eq', condition.value);
	});
}

function toArray(value) {
	if (Array.isArray(value)) return value;
	if (value === undefined || value === null || value === '') return [];
	return [value];
}

function getEntryTags(entry) {
	return toArray(entry?.tags).map(tag => String(tag));
}

function collectTagsFromValue(value) {
	if (Array.isArray(value)) return value.flatMap(item => collectTagsFromValue(item));
	if (value && typeof value === 'object') {
		const directTags = getEntryTags(value);
		if (directTags.length) return directTags;
		return Object.values(value).flatMap(item => collectTagsFromValue(item));
	}
	return [];
}

function filterEntries(entries, state, { tags = [], preferTags = [] } = {}) {
	let available = (Array.isArray(entries) ? entries : [])
		.filter(entry => (Number(entry?.weight ?? 1) || 0) > 0)
		.filter(entry => evaluateConditions(entry.conditions || entry.condition, state));
	const requiredTags = toArray(tags).map(tag => String(tag));
	if (requiredTags.length) {
		const matched = available.filter(entry => {
			const entryTags = getEntryTags(entry);
			return requiredTags.every(tag => entryTags.includes(tag));
		});
		if (matched.length) available = matched;
	}
	const preferredTags = toArray(preferTags).map(tag => String(tag));
	if (preferredTags.length) {
		const matched = available.filter(entry => {
			const entryTags = getEntryTags(entry);
			return preferredTags.some(tag => entryTags.includes(tag));
		});
		if (matched.length) available = matched;
	}
	return available;
}

function getEntriesFromSpec(pack, tool, spec = {}) {
	const config = getToolConfig(tool);
	const poolId = spec.pool || config.pool;
	if (poolId) return pack?.pools?.[poolId] || [];
	if (Array.isArray(spec.entries)) return spec.entries;
	if (Array.isArray(config.entries)) return config.entries;
	if (Array.isArray(tool?.entries)) return tool.entries;
	return [];
}

function normalizeCount(count) {
	if (count && typeof count === 'object') {
		const min = Math.max(0, Number(count.min ?? 1) || 0);
		const max = Math.max(min, Number(count.max ?? min) || min);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
	return Math.max(1, Number(count ?? 1) || 1);
}

function simplifyEntry(entry) {
	if (!entry) return null;
	return cloneData(entry);
}

function stripEntryRuntimeFields(value) {
	if (Array.isArray(value)) return value.map(item => stripEntryRuntimeFields(item));
	if (!value || typeof value !== 'object') return value;
	const stripped = cloneData(value);
	delete stripped.traits;
	return stripped;
}

function normalizeTraitSpec(spec) {
	if (Array.isArray(spec)) return { entries: spec, mode: 'override', _implicit: true };
	if (spec && typeof spec === 'object') {
		const _implicit = !spec.mode;
		const mode = spec.mode || 'override';
		return { ...spec, mode, _implicit };
	}
	return null;
}

function rollEntryTraits({ pack, state, input, traits, priorRolls }) {
	const rolls = {};
	const modes = {};
	const implicitOverrides = new Set();
	const patch = {};
	const tags = [];
	if (!traits || typeof traits !== 'object' || Array.isArray(traits)) return { rolls, modes, implicitOverrides, patch, tags };
	for (const [slot, traitSpec] of Object.entries(traits)) {
		const spec = normalizeTraitSpec(traitSpec);
		if (!spec || !isRollSpec(spec)) continue;
		modes[slot] = spec.mode;
		if (spec._implicit && spec.mode === 'override') implicitOverrides.add(slot);
		// merge 模式不在此处抽取，留给 encounter 循环合并全局池后统一抽
		if (spec.mode === 'merge') continue;
		const picked = pickEntries({ pack, tool: null, spec, state, input, priorRolls: { ...priorRolls, ...rolls } });
		if (picked.omitted || !picked.entries.length) continue;
		const value = picked.entries.length === 1 ? picked.entries[0] : picked.entries;
		rolls[slot] = stripEntryRuntimeFields(value);
		mergePatch(patch, picked.patch);
		tags.push(...picked.tags);
	}
	return { rolls, modes, implicitOverrides, patch, tags: [...new Set(tags)] };
}

function pickEntries({ pack, tool, spec, state, input = {}, priorRolls = {} }) {

	if (spec?.chance !== undefined && Math.random() > Number(spec.chance)) {
		return { omitted: true, entries: [], patch: {}, tags: [] };
	}
	const entries = getEntriesFromSpec(pack, tool, spec);
	const tags = toArray(input.tags);
	const preferTags = [];
	for (const source of toArray(spec?.matchTagsFrom)) {
		if (priorRolls[source]) {
			preferTags.push(...collectTagsFromValue(priorRolls[source]));
		}
	}

	if (spec?.tagsFromState) {
		preferTags.push(...toArray(getByPath(state, spec.tagsFromState, null)));
	}
	let available = filterEntries(entries, state, { tags, preferTags });
	const count = normalizeCount(spec?.count ?? 1);
	const replacement = spec?.replacement !== false;
	const selected = [];
	const patch = {};
	const selectedTags = [];
	for (let i = 0; i < count && available.length; i += 1) {
		const entry = pickWeightedEntry(available);
		if (!entry) break;
		selected.push(simplifyEntry(entry));
		mergePatch(patch, entry.patch);
		selectedTags.push(...getEntryTags(entry));
		if (!replacement) {
			available = available.filter(candidate => candidate !== entry && (candidate.id === undefined || candidate.id !== entry.id));
		}
	}
	return {
		omitted: false,
		entries: selected,
		patch,
		tags: [...new Set(selectedTags)]
	};
}

function isRollSpec(spec) {
	return Boolean(spec?.pool || spec?.entries || spec?.chance !== undefined || spec?.matchTagsFrom || spec?.tagsFromState);
}

/** 递归执行 subroll 规格，maxDepth 防止循环引用导致栈溢出 */
function rollSubrollSpecs({ pack, state, input, specs, priorRolls, depth = 0 }) {
	const MAX_SUBROLL_DEPTH = 6;
	const rolls = {};
	const patch = {};
	const tags = [];
	if (depth >= MAX_SUBROLL_DEPTH) return { rolls, patch, tags };
	for (const [slot, spec] of Object.entries(specs || {})) {
		if (isRollSpec(spec)) {
			const picked = pickEntries({ pack, tool: null, spec, state, input, priorRolls: { ...priorRolls, ...rolls } });
			if (picked.omitted || !picked.entries.length) continue;
			rolls[slot] = picked.entries.length === 1 ? picked.entries[0] : picked.entries;
			mergePatch(patch, picked.patch);
			tags.push(...picked.tags);
			continue;
		}
		if (spec && typeof spec === 'object') {
			const nested = rollSubrollSpecs({ pack, state, input, specs: spec, priorRolls: { ...priorRolls, ...rolls }, depth: depth + 1 });
			if (Object.keys(nested.rolls).length) rolls[slot] = nested.rolls;
			mergePatch(patch, nested.patch);
			tags.push(...nested.tags);
		}
	}
	return { rolls, patch, tags: [...new Set(tags)] };
}

function resolveTemplateValue(scope, path) {
	const parts = path.split('.').filter(Boolean);
	let current = scope;
	for (const part of parts) {
		if (Array.isArray(current)) {
			current = current.map(item => item?.[part]).filter(value => value !== undefined && value !== null);
		} else {
			current = current?.[part];
		}
		if (current === undefined || current === null) return undefined;
	}
	if (Array.isArray(current)) return current.map(item => formatValue(item)).join('、');
	return current;
}

function renderTemplate(template, scope) {
	if (!template) return '';
	return String(template).replace(/\{\{\s*([^}|]+)(?:\|([^}]*))?\s*\}\}/g, (_, rawPath, fallback = '') => {
		const value = resolveTemplateValue(scope, rawPath.trim());
		if (value === undefined || value === null || value === '') return fallback;
		return formatValue(value);
	});
}

function formatEntryText(value) {
	if (Array.isArray(value)) return value.map(formatEntryText).filter(Boolean).join('、');
	return value?.text || value?.label || value?.id || '';
}

function createToolResult({ request, tool, ok = true, displayText = '', data = {}, patch = {}, changes = [], error = null }) {
	return {
		requestId: request?.requestId || createUuid(),
		toolId: request?.toolId || tool?.id || '',
		type: tool?.type || 'unknown',
		label: tool?.label || request?.toolId || '工具',
		source: request?.source || 'ai',
		reason: request?.reason || '',
		ok,
		displayText,
		text: displayText,
		data,
		patch,
		changes,
		...(error ? { error } : {})
	};
}

function createToolFailure(request, code, message, tool = null) {
	return createToolResult({
		request,
		tool,
		ok: false,
		displayText: `工具执行失败：${message}`,
		data: {},
		patch: {},
		changes: [],
		error: { code, message }
	});
}

function emitRuntimeLog(logger, payload) {
	if (typeof logger !== 'function') return;
	try {
		logger(payload);
	} catch {
		// 忽略日志回调错误，避免影响主流程
	}
}

function executeDiceTool({ tool, state, request }) {
	const config = getToolConfig(tool);
	const input = request.input || {};
	const notation = input.notation || config.notation || tool.notation || '1d20';
	const dice = rollDice(notation, input.modifier);
	const difficulty = input.difficulty ?? config.difficulty;
	const hasDifficulty = difficulty !== undefined && difficulty !== null && difficulty !== '';
	const outcome = hasDifficulty ? (dice.total >= Number(difficulty) ? 'success' : 'failure') : undefined;
	const patch = outcome && config.patchByOutcome?.[outcome] ? config.patchByOutcome[outcome] : {};
	const changes = applyStatePatch(state, patch, { source: `tool:${tool.id}` });
	const difficultyText = hasDifficulty ? `，难度 ${difficulty}，${outcome === 'success' ? '成功' : '失败'}` : '';
	const modifierText = dice.modifier ? `，修正 ${dice.modifier}` : '';
	return createToolResult({
		request,
		tool,
		displayText: `${tool.label || tool.id}：${dice.notation} = ${dice.total}（${dice.rolls.join(', ')}${modifierText}）${difficultyText}`,
		data: {
			...dice,
			...(hasDifficulty ? { difficulty: Number(difficulty), outcome } : {})
		},
		patch,
		changes
	});
}

function executeTableTool({ pack, tool, state, request }) {
	const config = getToolConfig(tool);
	const input = request.input || {};
	const spec = {
		entries: tool.entries,
		...config,
		count: input.count ?? config.count
	};
	const picked = pickEntries({ pack, tool, spec, state, input });
	if (!picked.entries.length) {
		return createToolFailure(request, 'TABLE_EMPTY', `随机表没有可用条目：${tool.label || tool.id}`, tool);
	}
	const entry = picked.entries.length === 1 ? picked.entries[0] : picked.entries;
	let rolls = {};
	let patch = { ...picked.patch };
	let subrollTags = [];
	if (!Array.isArray(entry) && entry?.subrolls && typeof entry.subrolls === 'object') {
		const subrolls = rollSubrollSpecs({ pack, state, input, specs: entry.subrolls, priorRolls: {} });
		rolls = subrolls.rolls;
		patch = mergePatch(patch, subrolls.patch);
		subrollTags = subrolls.tags;
	}
	const scope = { entry, rolls, ...rolls };
	const displayBody = renderTemplate(config.template || (!Array.isArray(entry) && entry?.template), scope) || formatEntryText(entry);
	const changes = applyStatePatch(state, patch, { source: `tool:${tool.id}` });
	return createToolResult({
		request,
		tool,
		displayText: `${tool.label || tool.id}：${displayBody}`,
		data: {
			entry,
			rolls,
			tags: [...new Set([...picked.tags, ...subrollTags, ...Object.values(rolls).flatMap(roll => collectTagsFromValue(roll))])]
		},
		patch,
		changes
	});
}

function executeEncounterTool({ pack, tool, state, request }) {
	const config = getToolConfig(tool);
	const input = request.input || {};
	const rollSpecs = config.rolls && typeof config.rolls === 'object' ? config.rolls : {};
	const rolls = {};
	const omitted = [];
	const tags = [];
	let patch = {};
	let traitModes = {};
	let traitImplicitOverrides = new Set();
	for (const [slot, spec] of Object.entries(rollSpecs)) {
		const traitMode = traitModes[slot];
		// override: 完全用私有版本替换全局槽位
		if (traitMode === 'override' && rolls.actorTraits && rolls.actorTraits[slot]) {
			if (traitImplicitOverrides.has(slot)) {
				console.warn(
					`[GamePack] actor traits 维度 "${slot}" 未声明 mode 却与全局槽位同名，已隐式覆盖全局池。` +
					`如果这是预期行为，请显式设置 mode: "override"；如不想覆盖请改用 mode: "extra" 或换个名称。`
				);
			}
			rolls[slot] = rolls.actorTraits[slot];
			continue;
		}
		// merge: 私有词条注入全局池，一起加权抽取
		let mergeEntries = null;
		if (traitMode === 'merge' && rolls._actorTraitSpecs?.[slot]) {
			const traitSpec = normalizeTraitSpec(rolls._actorTraitSpecs[slot]);
			if (traitSpec?.entries) {
				mergeEntries = traitSpec.entries;
			}
		}
		// extra 或无同名维度: 不影响全局槽位，正常走全局池
		let finalSpec = spec;
		if (mergeEntries) {
			const globalEntries = getEntriesFromSpec(pack, null, spec);
			finalSpec = { ...spec, pool: undefined, entries: [...globalEntries, ...mergeEntries] };
		}
		const picked = pickEntries({ pack, tool: null, spec: finalSpec, state, input, priorRolls: rolls });
		if (picked.omitted) {
			omitted.push(slot);
			continue;
		}
		if (!picked.entries.length) {
			omitted.push(slot);
			continue;
		}
		const value = picked.entries.length === 1 ? picked.entries[0] : picked.entries;
		rolls[slot] = stripEntryRuntimeFields(value);
		patch = mergePatch(patch, picked.patch);
		tags.push(...picked.tags);
		if (slot === 'actor' && !Array.isArray(value) && !Object.prototype.hasOwnProperty.call(rollSpecs, 'actorTraits')) {
			const actorTraits = rollEntryTraits({ pack, state, input, traits: value?.traits, priorRolls: rolls });
			if (Object.keys(actorTraits.rolls).length) {
				rolls.actorTraits = actorTraits.rolls;
				rolls._actorTraitSpecs = value?.traits;
				traitModes = actorTraits.modes;
				traitImplicitOverrides = actorTraits.implicitOverrides;
				patch = mergePatch(patch, actorTraits.patch);
				tags.push(...actorTraits.tags);
			}
		}
	}
	// 清理内部辅助字段
	delete rolls._actorTraitSpecs;
	const displayBody = renderTemplate(config.template, rolls)
		|| Object.entries(rolls).map(([slot, value]) => `${slot}：${formatEntryText(value)}`).join('；')
		|| '没有抽到可用遭遇';
	const changes = applyStatePatch(state, patch, { source: `tool:${tool.id}` });
	return createToolResult({
		request,
		tool,
		displayText: `${tool.label || tool.id}：${displayBody}`,
		data: {
			rolls,
			tags: [...new Set(tags)],
			omitted
		},
		patch,
		changes
	});
}

function executeStateCheckTool({ tool, state, request }) {
	const config = getToolConfig(tool);
	const input = request.input || {};
	const path = input.path || config.path;
	const op = input.op || config.op || 'eq';
	const expected = input.value ?? config.value;
	const actual = getByPath(state, path, null);
	const passed = compareValues(actual, op, expected);
	return createToolResult({
		request,
		tool,
		displayText: `${tool.label || tool.id}：${path} ${op} ${formatValue(expected)}，当前 ${formatValue(actual)}，${passed ? '通过' : '未通过'}`,
		data: { passed, actual, op, expected, path }
	});
}

function filterPatchByAllowedPaths(patch, allowedPaths = []) {
	if (!allowedPaths.length) return patch;
	const filtered = {};
	for (const operation of normalizePatchOperations(patch)) {
		if (allowedPaths.some(path => operation.path === path || operation.path.startsWith(`${path}.`))) {
			filtered[operation.path] = operation.value;
		}
	}
	return filtered;
}

function executePatchStateTool({ tool, state, request }) {
	const config = getToolConfig(tool);
	const input = request.input || {};
	let patch = { ...(config.patch || {}) };
	if (config.allowInputPatch && input.patch && request.source !== 'ai') {
		patch = mergePatch(patch, filterPatchByAllowedPaths(input.patch, toArray(config.allowedPaths)));
	}
	const changes = applyStatePatch(state, patch, { source: `tool:${tool.id}` });
	return createToolResult({
		request,
		tool,
		displayText: `${tool.label || tool.id}：已更新 ${changes.length} 项状态`,
		data: { changedPaths: changes.map(change => change.path) },
		patch,
		changes
	});
}

function normalizeRuntimeOptions(toolOrOptions, legacyState, legacyContext = {}) {
	if (toolOrOptions?.request || toolOrOptions?.pack || toolOrOptions?.tool) {
		const pack = toolOrOptions.pack || legacyContext.pack || {};
		const request = {
			requestId: toolOrOptions.request?.requestId || createUuid(),
			source: toolOrOptions.request?.source || 'ai',
			toolId: toolOrOptions.request?.toolId || toolOrOptions.request?.tool || toolOrOptions.tool?.id,
			reason: toolOrOptions.request?.reason || '',
			input: toolOrOptions.request?.input || {}
		};
		return {
			pack,
			state: toolOrOptions.state || legacyState || {},
			request,
			context: toolOrOptions.context || {},
			tool: toolOrOptions.tool || getToolsById(pack)[request.toolId],
			logger: toolOrOptions.logger || toolOrOptions.context?.logger || legacyContext.logger
		};
	}
	const tool = toolOrOptions;
	return {
		pack: legacyContext.pack || {},
		state: legacyState || {},
		request: {
			requestId: legacyContext.requestId || createUuid(),
			source: legacyContext.source || 'manual',
			toolId: legacyContext.toolId || tool?.id,
			reason: legacyContext.reason || '',
			input: legacyContext.input || {}
		},
		context: legacyContext,
		tool,
		logger: legacyContext.logger
	};
}

export function executeGameTool(toolOrOptions, legacyState, legacyContext = {}) {
	const options = normalizeRuntimeOptions(toolOrOptions, legacyState, legacyContext);
	const { pack, state, request, tool, logger } = options;
	if (!tool) {
		const failure = createToolFailure(request, 'TOOL_NOT_FOUND', `工具不存在：${request.toolId || '未知工具'}`);
		emitRuntimeLog(logger, {
			level: 'error',
			event: 'tool.not_found',
			summary: `工具不存在：${request.toolId || '未知工具'}`,
			detail: { request }
		});
		return failure;
	}
	if (!SUPPORTED_TOOL_TYPES.includes(tool.type)) {
		const failure = createToolFailure(request, 'UNSUPPORTED_TOOL_TYPE', `工具类型不受支持：${tool.type}`, tool);
		emitRuntimeLog(logger, {
			level: 'error',
			event: 'tool.unsupported',
			summary: `工具类型不受支持：${tool.type}`,
			detail: { request, tool: { id: tool.id, type: tool.type } }
		});
		return failure;
	}
	if (!canUseTool(tool, request.source)) {
		const failure = createToolFailure(request, 'TOOL_FORBIDDEN', `当前来源无权执行工具：${tool.id}`, tool);
		emitRuntimeLog(logger, {
			level: 'warn',
			event: 'tool.forbidden',
			summary: `来源 ${request.source} 无权执行工具 ${tool.id}`,
			detail: { request, tool: { id: tool.id, visibility: tool.visibility } }
		});
		return failure;
	}
	try {
		emitRuntimeLog(logger, {
			level: 'debug',
			event: 'tool.execute.start',
			summary: `执行工具 ${tool.id}`,
			detail: { request, tool: { id: tool.id, type: tool.type } }
		});
		let result = null;
		if (tool.type === 'dice') result = executeDiceTool({ pack, tool, state, request });
		if (tool.type === 'table') result = executeTableTool({ pack, tool, state, request });
		if (tool.type === 'encounter') result = executeEncounterTool({ pack, tool, state, request });
		if (tool.type === 'stateCheck') result = executeStateCheckTool({ pack, tool, state, request });
		if (tool.type === 'patchState') result = executePatchStateTool({ pack, tool, state, request });
		if (result) {
			emitRuntimeLog(logger, {
				level: result.ok ? 'info' : 'warn',
				event: 'tool.execute.done',
				summary: `${tool.id} 执行${result.ok ? '成功' : '失败'}，状态变更 ${result.changes?.length || 0} 项`,
				detail: {
					request,
					tool: { id: tool.id, type: tool.type },
					result: {
						ok: result.ok,
						displayText: result.displayText,
						changes: result.changes,
						error: result.error
					}
				}
			});
			return result;
		}
	} catch (error) {
		emitRuntimeLog(logger, {
			level: 'error',
			event: 'tool.execute.error',
			summary: `${tool.id} 执行异常：${error.message || '未知错误'}`,
			detail: { request, tool: { id: tool.id, type: tool.type }, error: error.message || String(error) }
		});
		return createToolFailure(request, 'TOOL_EXECUTION_FAILED', error.message || '工具执行失败', tool);
	}
	const fallback = createToolFailure(request, 'UNSUPPORTED_TOOL_TYPE', `工具类型不受支持：${tool.type}`, tool);
	emitRuntimeLog(logger, {
		level: 'error',
		event: 'tool.unsupported',
		summary: `工具类型不受支持：${tool.type}`,
		detail: { request, tool: { id: tool.id, type: tool.type } }
	});
	return fallback;
}

export function shouldRunTrigger(trigger, state, triggerState = {}, pack = null) {
	const conditions = Array.isArray(trigger?.conditions) ? trigger.conditions : [];
	if (!conditions.length) return false;
	const record = triggerState?.[trigger.id] || {};
	if (trigger.once && record.runCount > 0) return false;
	if (trigger.maxRuns && Number(record.runCount || 0) >= Number(trigger.maxRuns)) return false;
	if (trigger.cooldownTurns && record.lastRunTurn !== undefined) {
		const currentTurn = Number(getByPath(state, pack?.turnPath || 'world.turn', 0)) || 0;
		if (currentTurn - Number(record.lastRunTurn) < Number(trigger.cooldownTurns)) return false;
	}
	return evaluateConditions(conditions, state);
}

export function runGameTriggers(pack, state, triggerState = {}, runtimeOptions = {}) {
	const logger = typeof runtimeOptions === 'function' ? runtimeOptions : runtimeOptions?.logger;
	const results = [];
	for (const trigger of pack?.triggers || []) {
		if (!shouldRunTrigger(trigger, state, triggerState, pack)) continue;
		const request = {
			requestId: createUuid(),
			source: 'trigger',
			toolId: trigger.toolId,
			reason: trigger.label || trigger.id,
			input: trigger.input || {}
		};
		emitRuntimeLog(logger, {
			level: 'debug',
			event: 'trigger.fire',
			summary: `触发器执行：${trigger.id}`,
			detail: {
				trigger: {
					id: trigger.id,
					label: trigger.label,
					toolId: trigger.toolId
				},
				request
			}
		});
		const result = executeGameTool({ pack, state, request, context: { trigger }, logger });
		results.push({
			triggerId: trigger.id,
			label: trigger.label || result.label,
			result
		});
		const currentTurn = Number(getByPath(state, pack?.turnPath || 'world.turn', 0)) || 0;
		const record = triggerState[trigger.id] || { runCount: 0 };
		triggerState[trigger.id] = {
			...record,
			runCount: Number(record.runCount || 0) + 1,
			lastRunTurn: currentTurn
		};
		emitRuntimeLog(logger, {
			level: result.ok ? 'info' : 'warn',
			event: 'trigger.done',
			summary: `触发器 ${trigger.id} 执行${result.ok ? '成功' : '失败'}`,
			detail: {
				triggerId: trigger.id,
				requestId: request.requestId,
				ok: result.ok,
				changes: result.changes || [],
				error: result.error || null
			}
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




function formatValue(value) {
	if (Array.isArray(value)) return value.map(item => formatValue(item)).join('、');
	if (value && typeof value === 'object') return JSON.stringify(value);
	if (value === undefined || value === null || value === '') return '空';
	return String(value);
}

function normalizeToolResultItem(item) {
	return item?.result || item;
}

export function formatToolResults(results = []) {
	return results
		.map(item => {
			const result = normalizeToolResultItem(item);
			const label = item?.label || result?.label || '工具结果';
			const text = result?.displayText || result?.text || result?.error?.message || '';
			return `【${label}】\n${text}`;
		})
		.filter(Boolean)
		.join('\n\n');
}

function formatStateChanges(changes = []) {
	if (!changes.length) return '';
	return [
		'【状态变化】',
		...changes.map(change => `${change.path}：${formatValue(change.from)} → ${formatValue(change.to)}`)
	].join('\n');
}

function formatChoices(choices = []) {
	const normalized = Array.isArray(choices) ? choices.filter(Boolean) : [];
	if (!normalized.length) return '';
	return [
		'【可选行动】',
		...normalized.map((choice, index) => `${index + 1}. ${choice}`)
	].join('\n');
}

export function buildGameAssistantContent({ narration, choices, toolResults, changes, toolResultVisibility = 'visible' }) {
	const resultText = toolResultVisibility === 'hidden' ? '' : formatToolResults(toolResults);
	return [
		narration || '',
		resultText,
		formatStateChanges(changes),
		formatChoices(choices)
	].filter(Boolean).join('\n\n');
}

function getNormalizedPackInstructions(pack) {
	return {
		narrator: pack?.instructions?.narrator || pack?.prompts?.host || pack?.prompts?.narrator || pack?.prompt || '',
		style: pack?.instructions?.style || '',
		rules: pack?.instructions?.rules || pack?.prompts?.rules || ''
	};
}

function buildAiToolDefinitions(pack) {
	return (pack?.tools || [])
		.filter(tool => getToolVisibility(tool).includes('ai'))
		.map(tool => {
			const config = getToolConfig(tool);
			// 只向 AI 暴露结构描述，不传递完整 entries/pool 数据以节省 token
			const safeConfig = { ...config };
			delete safeConfig.entries;
			return {
				id: tool.id,
				type: tool.type,
				label: tool.label,
				description: tool.description || '',
				inputSchema: tool.inputSchema || {},
				config: safeConfig
			};
		});
}

export function buildGamePrefixMessage(pack) {
	const instructions = getNormalizedPackInstructions(pack);
	const responseSchema = {
		phase: 'tool_request 或 final',
		toolRequests: [{ toolId: '工具ID', reason: '为什么需要工具', input: [{ key: '参数名', value: '参数值' }] }],
		narration: 'phase=final 时给玩家看的正文（禁止写可选行动/选项列表）；tool_request 时留空字符串',
		choices: ['phase=final 时的可选行动，允许为空数组'],
		statePatch: [{ path: 'path.to.value', value: 'phase=final 时的新值，允许为空数组' }]
	};

	const tools = buildAiToolDefinitions(pack);
	return [
		instructions.narrator,
		instructions.rules,
		'你是文本游戏主持人。根据玩家输入推进游戏。',
		'只能返回 JSON，不要包裹 Markdown 代码块。',
		'如果需要检定、随机表或其他工具，先返回 phase=tool_request，不要编造工具结果。',
		'当已有工具结果足以裁定，或不需要工具时，返回 phase=final。final 必须基于真实工具结果，不能请求工具。',
		'phase=final 时，narration 只写叙事正文，不要包含“可选行动/选项/choices”等列表；所有建议行动必须仅放在 choices 数组。',
		'toolRequests.input 使用键值数组；无参数时返回空数组。statePatch 使用 { path, value } 数组；无状态变化时返回空数组。',

		`返回格式：${JSON.stringify(responseSchema)}`,
		`当前机制包：${pack?.title || pack?.id || '未命名机制包'}`,
		tools.length ? `可请求工具定义：${JSON.stringify(tools)}` : '当前没有可供 AI 请求的工具。'
	].filter(Boolean).join('\n\n');
}

export function buildGameTurnSuffixMessage({ state, triggerResults = [], toolResults = [], forceFinal = false, playerInput = '' } = {}) {
	return [
		`当前状态：${JSON.stringify(state || {})}`,
		triggerResults.length ? `本回合触发器结果：${JSON.stringify(triggerResults.map(item => item.result || item))}` : '',
		toolResults.length ? `本回合已执行工具结果：${JSON.stringify(toolResults)}` : '',
		forceFinal ? '本回合工具调用次数已达上限。不要再请求工具，必须基于已有结果返回 phase=final。' : '',
		playerInput ? `玩家行动：${playerInput}` : ''
	].filter(Boolean).join('\n\n');
}

// ── 状态快照 ──

/**
 * 创建当前游戏状态的完整快照。
 * @param {object} gameData - chat.metadata.gameMode 对象
 * @returns {{ state: object, triggerState: object }}
 */
export function createStateSnapshot(gameData) {
	return {
		state: cloneData(gameData?.state || {}),
		triggerState: cloneData(gameData?.triggerState || {})
	};
}

/**
 * 从快照恢复游戏状态，直接写入 gameData。
 * @param {object} gameData - chat.metadata.gameMode 对象（会被就地修改）
 * @param {{ state: object, triggerState: object }} snapshot
 * @returns {boolean} 是否成功恢复
 */
export function restoreStateFromSnapshot(gameData, snapshot) {
	if (!gameData || !snapshot?.state) return false;
	gameData.state = cloneData(snapshot.state);
	if (snapshot.triggerState) {
		gameData.triggerState = cloneData(snapshot.triggerState);
	}
	return true;
}

/**
 * 在消息数组中从 endIndex（含）向前查找最近一条带 stateSnapshot 的 assistant 消息。
 * @param {Array} messages - 消息数组
 * @param {number} endIndex - 搜索截止索引（含），默认最后一条
 * @returns {{ snapshot: object, index: number } | null}
 */
export function findLatestSnapshot(messages, endIndex) {
	if (!Array.isArray(messages) || !messages.length) return null;
	const end = endIndex !== undefined ? Math.min(endIndex, messages.length - 1) : messages.length - 1;
	for (let i = end; i >= 0; i -= 1) {
		const snap = messages[i]?.metadata?.gameEvent?.stateSnapshot;
		if (snap?.state) {
			return { snapshot: snap, index: i };
		}
	}
	return null;
}

