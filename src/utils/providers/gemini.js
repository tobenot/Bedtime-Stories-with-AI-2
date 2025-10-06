export async function callModelGemini({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk, featurePassword, isBackendProxy, geminiReasoningEffort, httpReferer, xTitle }) {
	console.log('[DEBUG] callModelGemini called:', {
		apiUrl,
		hasApiKey: !!apiKey,
		model,
		messagesCount: messages.length,
		temperature,
		maxTokens
	});

	const startedAtMs = Date.now();
	if (signal && typeof signal.addEventListener === 'function') {
		signal.addEventListener('abort', () => {
			console.warn('[DEBUG] Gemini fetch aborted by signal at', new Date().toISOString());
		}, { once: true });
	}

	const isDirectGoogle = !apiUrl || apiUrl.includes('generativelanguage.googleapis.com');

	// Build request body depending on endpoint type
	let requestBody;
	if (isDirectGoogle) {
		const contents = messages.map(m => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content }]
		}));
		requestBody = {
			model,
			contents,
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens
			},
			stream: true
		};
	} else {
		// OpenAI-compatible chat.completions payload
		requestBody = {
			model,
			messages: messages.map(m => ({ role: m.role, content: m.content })),
			stream: true,
			temperature,
			max_tokens: maxTokens
		};
	}
	if (!isDirectGoogle && geminiReasoningEffort && geminiReasoningEffort !== 'off') {
		requestBody.reasoning = {
			effort: geminiReasoningEffort
		};
	}

	const finalUrl = isDirectGoogle
		? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
		: apiUrl;

	const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
	
	if (isBackendProxy) {
		// 后端代理模式：不添加Authorization头，避免覆盖后端配置的真实API Key
		// 只添加用于前端用户认证的自定义头
		if (apiKey) {
			headers['x-api-key'] = apiKey;
		}
		if (featurePassword && featurePassword.trim()) {
			headers['X-Feature-Password'] = featurePassword;
		}
	} else if (!isDirectGoogle) {
		// 直连模式：非直连Google的OpenAI兼容API
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
		// LMRouter需要的特殊头
		if (httpReferer && httpReferer.trim()) {
			headers['HTTP-Referer'] = httpReferer;
		}
		if (xTitle && xTitle.trim()) {
			headers['X-Title'] = xTitle;
		}
	}

	const response = await fetch(finalUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[DEBUG] Gemini request failed:', response.status, errorText);
		throw new Error(`Gemini请求失败: ${response.status} - ${errorText}`);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString()
	};

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let chunkCount = 0;
	let buffer = '';
	let firstByteAtMs = null;
	let firstParsedAtMs = null;
	let onChunkCalls = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunkCount++;
		if (chunkCount === 1) {
			firstByteAtMs = Date.now();
		}
		const chunk = decoder.decode(value, { stream: true });
		buffer += chunk;
		let idx;
		while ((idx = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);

			if (!line) continue;

			if (line === 'data: [DONE]' || line === '[DONE]') {
				continue;
			}
			
			if (!line.startsWith('data:')) continue;

			const payload = line.slice(5).trim();
			if (!payload) continue;
			
			try {
				const data = JSON.parse(payload);

				if (data.error) {
					console.error('[DEBUG] Gemini API error:', data.error);
					throw new Error(`Gemini API错误: ${data.error.message || data.error.type || '未知错误'}`);
				}

				if (!firstParsedAtMs) {
					firstParsedAtMs = Date.now();
				}
				if (data.candidates?.[0]?.content?.parts) {
					for (const part of data.candidates[0].content.parts) {
						if (part.text) {
							newMessage.content += part.text;
						}
					}
				} else if (data.choices?.[0]?.delta) {
					const delta = data.choices[0].delta;
					if (delta?.reasoning_content !== undefined) {
						newMessage.reasoning_content += delta.reasoning_content || '';
					}
					// Heuristic: when transitioning from reasoning to normal content, ensure
					// reasoning ends with a visible paragraph break (two newlines) so that
					// Markdown renders as intended.
					if (delta?.content !== undefined) {
						if (newMessage.reasoning_content && !newMessage.reasoning_content.endsWith('\n\n')) {
							newMessage.reasoning_content += newMessage.reasoning_content.endsWith('\n') ? '\n' : '\n\n';
						}
						newMessage.content += delta.content || '';
					}
				} else if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (typeof onChunk === 'function') {
					onChunkCalls++;
					onChunk({ ...newMessage });
				}
			} catch (err) {
				console.error('[DEBUG] Gemini data parsing error:', err, 'Original payload:', payload);
				if (err.message && err.message.includes('Gemini API错误:')) {
					throw err;
				}
			}
		}
	}
	return newMessage;
}
