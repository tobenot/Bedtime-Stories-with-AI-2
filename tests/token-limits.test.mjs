import {
	buildOpenAiTokenLimitFields,
	getBaseModelName,
	usesMaxCompletionTokens
} from '../src/utils/tokenLimits.js';

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function testModelDetection() {
	const cases = [
		['openai/gpt-5.4', true],
		['gpt-5.4-pro', true],
		['gpt-5.3-codex', true],
		['gpt-4.1-mini', true],
		['o3-mini', true],
		['o1-preview', true],
		['o4-mini', true],
		['gpt-4o', false],
		['gpt-4o-mini', false],
		['claude-sonnet-4-6', false],
		['gemini-2.5-flash', false]
	];

	for (const [model, expected] of cases) {
		assert(
			usesMaxCompletionTokens(model) === expected,
			`${model}: expected ${expected}, got ${usesMaxCompletionTokens(model)}`
		);
		assert(
			getBaseModelName(model) === model.toLowerCase().split('/').pop(),
			`${model}: base model name mismatch`
		);
	}
}

function testTokenLimitFields() {
	assert(
		buildOpenAiTokenLimitFields('gpt-5.4', 4096).max_completion_tokens === 4096,
		'gpt-5.4 should use max_completion_tokens'
	);
	assert(
		buildOpenAiTokenLimitFields('gpt-5.4', 4096).max_tokens === undefined,
		'gpt-5.4 should not include max_tokens'
	);
	assert(
		buildOpenAiTokenLimitFields('gpt-4o', 4096).max_tokens === 4096,
		'gpt-4o should use max_tokens'
	);
	assert(
		buildOpenAiTokenLimitFields('gpt-4o', 4096).max_completion_tokens === undefined,
		'gpt-4o should not include max_completion_tokens'
	);
	assert(
		buildOpenAiTokenLimitFields('gpt-5.4', 0).max_completion_tokens >= 16,
		'invalid maxTokens should fall back to a safe minimum'
	);
}

testModelDetection();
testTokenLimitFields();
console.log('token-limits tests passed');
