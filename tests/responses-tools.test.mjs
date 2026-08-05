import {
	buildResponsesToolsPayload,
	filterEnabledResponsesTools,
	isDeepSeekResponsesHost,
	isOpenAiResponsesHost,
	listResponsesToolsForUi,
	normalizeResponsesTools,
	RESPONSES_TOOL,
	supportsHostedWebSearch
} from '../src/utils/responsesTools.js';

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function testNormalize() {
	assert(
		JSON.stringify(normalizeResponsesTools(['web_search', 'web_search', 'file_search', ''])) === '["web_search"]',
		'normalize should keep only BYOK tools and dedupe'
	);
	assert(
		JSON.stringify(normalizeResponsesTools('["web_search"]')) === '["web_search"]',
		'normalize should accept JSON string'
	);
}

function testHostDetection() {
	assert(isDeepSeekResponsesHost('https://api.deepseek.com/v1', 'builtin_deepseek'), 'deepseek preset');
	assert(isDeepSeekResponsesHost('https://api.deepseek.com', ''), 'deepseek url');
	assert(!isDeepSeekResponsesHost('https://openrouter.ai/api/v1', 'builtin_openrouter'), 'openrouter is not deepseek');
	assert(isOpenAiResponsesHost('https://api.openai.com/v1'), 'openai url');
	assert(!isOpenAiResponsesHost('https://api.deepseek.com/v1'), 'deepseek is not openai');
}

function testUiAvailability() {
	const deepseek = listResponsesToolsForUi({
		apiUrl: 'https://api.deepseek.com/v1',
		presetId: 'builtin_deepseek'
	});
	const web = deepseek.find((t) => t.type === RESPONSES_TOOL.WEB_SEARCH);
	const file = deepseek.find((t) => t.type === RESPONSES_TOOL.FILE_SEARCH);
	assert(web?.available === true, 'deepseek web_search available');
	assert(file?.available === false, 'file_search unavailable on deepseek');

	const silicon = listResponsesToolsForUi({
		apiUrl: 'https://api.siliconflow.cn/v1',
		presetId: 'builtin_siliconflow'
	});
	assert(
		silicon.find((t) => t.type === RESPONSES_TOOL.WEB_SEARCH)?.available === false,
		'siliconflow web_search unavailable'
	);
	assert(supportsHostedWebSearch({ apiUrl: 'https://api.openai.com/v1' }) === true, 'openai supports web search');
}

function testPayload() {
	const payload = buildResponsesToolsPayload(
		['web_search', 'file_search'],
		{ apiUrl: 'https://api.deepseek.com/v1', presetId: 'builtin_deepseek' }
	);
	assert(JSON.stringify(payload) === '[{"type":"web_search"}]', 'payload only web_search');

	const filtered = filterEnabledResponsesTools(
		['web_search'],
		{ apiUrl: 'https://api.siliconflow.cn/v1' }
	);
	assert(filtered.length === 0, 'unavailable tools filtered out');
	assert(
		buildResponsesToolsPayload(['web_search'], { apiUrl: 'https://api.siliconflow.cn/v1' }) === undefined,
		'empty payload is undefined'
	);
}

testNormalize();
testHostDetection();
testUiAvailability();
testPayload();
console.log('responses-tools.test.mjs: ok');
