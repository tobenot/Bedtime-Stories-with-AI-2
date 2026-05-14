const JSON_PRIMITIVE_SCHEMA = {
	anyOf: [
		{ type: 'string' },
		{ type: 'number' },
		{ type: 'integer' },
		{ type: 'boolean' },
		{ type: 'null' }
	]
};

const JSON_PATCH_VALUE_SCHEMA = {
	anyOf: [
		...JSON_PRIMITIVE_SCHEMA.anyOf,
		{
			type: 'array',
			items: JSON_PRIMITIVE_SCHEMA
		}
	]
};

const GAME_RESPONSE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		phase: {
			type: 'string',
			enum: ['tool_request', 'final']
		},
		toolRequests: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					toolId: { type: 'string' },
					reason: { type: 'string' },
					input: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							properties: {
								key: { type: 'string' },
								value: JSON_PATCH_VALUE_SCHEMA
							},
							required: ['key', 'value']
						}
					}
				},
				required: ['toolId', 'reason', 'input']
			}
		},
		narration: { type: 'string' },
		choices: {
			type: 'array',
			items: { type: 'string' }
		},
		statePatch: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					path: { type: 'string' },
					value: JSON_PATCH_VALUE_SCHEMA
				},
				required: ['path', 'value']
			}
		}
	},
	required: ['phase', 'toolRequests', 'narration', 'choices', 'statePatch']
};

function isDirectGemini({ provider, apiUrl, model } = {}) {
	const providerText = String(provider || '').toLowerCase();
	const apiUrlText = String(apiUrl || '').toLowerCase();
	const modelText = String(model || '').toLowerCase();
	return providerText === 'gemini'
		|| apiUrlText.includes('generativelanguage.googleapis.com')
		|| apiUrlText.includes('/gemini')
		|| modelText.startsWith('gemini-');
}

export function buildGameResponseExtraBody({ provider, apiUrl, model, mode = 'json_schema' } = {}) {
	if (mode === 'none' || isDirectGemini({ provider, apiUrl, model })) return {};
	if (mode === 'json_object') {
		return {
			response_format: { type: 'json_object' }
		};
	}
	return {
		response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'game_mode_response',
				strict: true,
				schema: GAME_RESPONSE_SCHEMA
			}
		}
	};
}


export function hasGameResponseFormat(extraBody) {
	return Boolean(extraBody?.response_format);
}

export function isResponseFormatUnsupportedError(error) {
	const message = String(error?.message || error || '').toLowerCase();
	return message.includes('response_format')
		|| message.includes('json_schema')
		|| message.includes('structured output')
		|| message.includes('structured outputs')
		|| message.includes('unsupported parameter')
		|| message.includes('invalid schema')
		|| message.includes('not support');
}
