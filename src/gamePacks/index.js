import { BUILTIN_GAME_PACKS } from './builtin';

const CUSTOM_GAME_PACKS_KEY = 'bs2_custom_game_packs';
const ACTIVE_GAME_PACK_KEY = 'bs2_active_game_pack_id';
const SUPPORTED_TOOL_TYPES = ['dice', 'table', 'encounter', 'stateCheck', 'patchState'];
const DEFAULT_VISIBILITY = ['ai', 'manual', 'trigger'];

function normalizeUiItems(items) {
	return (Array.isArray(items) ? items : [])
		.map(item => ({
			type: item?.type || 'text',
			label: item?.label || item?.path || '字段',
			path: item?.path || '',
			maxPath: item?.maxPath || ''
		}))
		.filter(item => item.path);
}

/** 归一化 visibility 数组。保留所有字符串值，未声明时使用默认值。 */
function normalizeVisibility(visibility) {
	if (Array.isArray(visibility) && visibility.length) {
		return [...new Set(visibility.filter(value => typeof value === 'string' && value.length > 0))];
	}
	return [...DEFAULT_VISIBILITY];
}

function normalizeToolConfig(tool) {
	const config = tool?.config && typeof tool.config === 'object' ? { ...tool.config } : {};
	if (tool?.notation && !config.notation) config.notation = tool.notation;
	if (Array.isArray(tool?.entries) && !config.entries) config.entries = tool.entries;
	return config;
}

function normalizeTools(tools) {
	return (Array.isArray(tools) ? tools : [])
		.map(tool => {
			const type = SUPPORTED_TOOL_TYPES.includes(tool?.type) ? tool.type : 'dice';
			return {
				...tool,
				id: String(tool?.id || '').trim(),
				type,
				label: tool?.label || tool?.id || '工具',
				description: tool?.description || '',
				visibility: normalizeVisibility(tool?.visibility),
				inputSchema: tool?.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : {},
				config: normalizeToolConfig(tool),
				entries: Array.isArray(tool?.entries) ? tool.entries : []
			};
		})
		.filter(tool => tool.id);
}

function normalizeTriggers(triggers) {
	return (Array.isArray(triggers) ? triggers : [])
		.map(trigger => ({
			id: String(trigger?.id || '').trim(),
			label: trigger?.label || trigger?.id || '触发器',
			toolId: String(trigger?.toolId || '').trim(),
			conditions: Array.isArray(trigger?.conditions) ? trigger.conditions : [],
			input: trigger?.input && typeof trigger.input === 'object' ? trigger.input : {},
			once: Boolean(trigger?.once),
			cooldownTurns: trigger?.cooldownTurns === undefined ? undefined : Number(trigger.cooldownTurns),
			maxRuns: trigger?.maxRuns === undefined ? undefined : Number(trigger.maxRuns)
		}))
		.filter(trigger => trigger.id && trigger.toolId);
}

export function normalizeGamePack(pack, source = 'custom') {
	if (!pack || typeof pack !== 'object') return null;
	const id = String(pack.id || '').trim();
	if (!id) return null;
	return {
		id,
		title: pack.title || id,
		version: Number(pack.version || 1),
		description: pack.description || '',
		source,
		turnPath: pack.turnPath || 'world.turn',
		instructions: {
			narrator: pack.instructions?.narrator || pack.prompts?.host || pack.prompts?.narrator || pack.prompt || '',
			rules: pack.instructions?.rules || pack.prompts?.rules || ''
		},
		models: pack.models && typeof pack.models === 'object' ? pack.models : {},
		toolResultVisibility: pack.toolResultVisibility || 'visible',
		initialState: pack.initialState && typeof pack.initialState === 'object' ? pack.initialState : {},
		ui: normalizeUiItems(pack.ui),
		pools: pack.pools && typeof pack.pools === 'object' ? pack.pools : {},
		tools: normalizeTools(pack.tools),
		triggers: normalizeTriggers(pack.triggers),
		openingMessage: pack.openingMessage || ''
	};
}

export function getAllBuiltinGamePacks() {
	return BUILTIN_GAME_PACKS
		.map(pack => normalizeGamePack(pack, 'builtin'))
		.filter(Boolean);
}

export function loadCustomGamePacks() {
	try {
		const raw = localStorage.getItem(CUSTOM_GAME_PACKS_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return (Array.isArray(parsed) ? parsed : [])
			.map(pack => normalizeGamePack(pack, 'custom'))
			.filter(Boolean);
	} catch {
		return [];
	}
}

export function saveCustomGamePacks(packs) {
	const normalized = (Array.isArray(packs) ? packs : [])
		.map(pack => normalizeGamePack(pack, 'custom'))
		.filter(Boolean);
	localStorage.setItem(CUSTOM_GAME_PACKS_KEY, JSON.stringify(normalized));
	return normalized;
}

export function getAllGamePacks() {
	return [...getAllBuiltinGamePacks(), ...loadCustomGamePacks()];
}

export function getGamePackById(id) {
	return getAllGamePacks().find(pack => pack.id === id) || null;
}

export function importGamePacks(rawData, mode = 'merge') {
	const source = Array.isArray(rawData) ? rawData : [rawData];
	const imported = source
		.map(pack => normalizeGamePack(pack, 'custom'))
		.filter(Boolean);
	if (!imported.length) return [];

	if (mode === 'overwrite') {
		saveCustomGamePacks(imported);
		return imported;
	}

	const existing = loadCustomGamePacks();
	const byId = new Map(existing.map(pack => [pack.id, pack]));
	for (const pack of imported) {
		byId.set(pack.id, pack);
	}
	saveCustomGamePacks(Array.from(byId.values()));
	return imported;
}

export function loadActiveGamePackId() {
	return localStorage.getItem(ACTIVE_GAME_PACK_KEY) || 'builtin_dnd_adventure';
}

export function saveActiveGamePackId(id) {
	localStorage.setItem(ACTIVE_GAME_PACK_KEY, id);
}
