export async function callModelDeepseek({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk, featurePassword, isBackendProxy, geminiReasoningEffort, stream = true, extraBody = {} }) {
	
	const requestBody = {
		model,
		messages,
		stream,
		temperature,
		max_tokens: maxTokens,
		...extraBody
	};

	if (model && model.includes('gemini') && geminiReasoningEffort && geminiReasoningEffort !== 'off') {
		requestBody.reasoning = {
			effort: geminiReasoningEffort
		};
	}

	const headers = { 'Content-Type': 'application/json' };
	
	if (isBackendProxy) {
		// 后端代理模式：不添加Authorization头，避免覆盖后端配置的真实API Key
		// 只添加用于前端用户认证的自定义头
		if (apiKey) {
			headers['x-api-key'] = apiKey;
		}
		if (featurePassword && featurePassword.trim()) {
			headers['X-Feature-Password'] = featurePassword;
		}
	} else {
		// 直连模式：对于所有OpenAI兼容的API，只要有apiKey就添加Authorization头
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
	}

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[DEBUG] API request failed:', response.status, errorText);
		throw new Error(`API请求失败: ${response.status} - ${errorText}`);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString(),
		images: [] // Support for images
	};

	if (!stream) {
		const data = await response.json();
		if (data.error) {
			throw new Error(`API错误: ${data.error.message || data.error.type || '未知错误'}`);
		}
		const choice = data.choices?.[0];
		if (choice) {
			newMessage.content = choice.message?.content || '';
			if (choice.message?.reasoning_content) {
				newMessage.reasoning_content = choice.message.reasoning_content;
			}
			// Handle OpenRouter Gemini image response
			if (choice.message?.images) {
				newMessage.images = choice.message.images;
			}
		}
		return newMessage;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let chunkCount = 0;
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunkCount++;
		const chunk = decoder.decode(value, { stream: true });
		buffer += chunk;
		let idx;
		while ((idx = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (!line) continue;
			if (line.startsWith(':')) continue;
			if (line === 'data: [DONE]' || line === '[DONE]') {
				continue;
			}
			let jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);

				if (data.error) {
					console.error('[DEBUG] DeepSeek API error:', data.error);
					throw new Error(`DeepSeek API错误: ${data.error.message || data.error.type || '未知错误'}`);
				}

				if (data.choices?.[0]?.delta?.reasoning_content !== undefined) {
					newMessage.reasoning_content += data.choices[0].delta.reasoning_content || '';
				} else if (data.choices?.[0]?.delta?.reasoning !== undefined) {
					const reasoningText = data.choices[0].delta.reasoning || '';
					newMessage.reasoning_content += reasoningText.replace(/\\n/g, '\n');
				}
				if (data.choices?.[0]?.delta?.content !== undefined) {
					newMessage.content += data.choices[0].delta.content || '';
				}
				if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (typeof onChunk === 'function') {
					onChunk({ ...newMessage });
				}
			} catch (error) {
				console.error('[DEBUG] Data parsing error:', error, 'Original data:', line);
				if (error.message && error.message.includes('DeepSeek API错误:')) {
					throw error;
				}
			}
		}
	}
	return newMessage;
}

