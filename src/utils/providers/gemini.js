export async function callModelGemini({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
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
	const isBackendProxy = typeof apiUrl === 'string' && (
		apiUrl.includes('/gemini') || 
		apiUrl.startsWith('/api/')
	);
	
	console.log('[DEBUG] Gemini request details:', {
		isDirectGoogle,
		isBackendProxy
	});

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

	const finalUrl = isDirectGoogle
		? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
		: apiUrl;
		
	console.log('[DEBUG] Final Gemini URL:', finalUrl);

	const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
	if (!isDirectGoogle && apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
		headers['x-api-key'] = apiKey;
	}
		
	console.log('[DEBUG] Gemini request headers:', headers);

	const response = await fetch(finalUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	console.log('[DEBUG] Gemini response status:', response.status, response.statusText);

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

	console.log('[DEBUG] Starting to read Gemini response stream');
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
			console.log('[DEBUG] Gemini stream finished, total chunks processed:', chunkCount);
			break;
		}
		chunkCount++;
		if (chunkCount === 1) {
			firstByteAtMs = Date.now();
			console.log('[DEBUG] Gemini first byte latency (ms):', firstByteAtMs - startedAtMs);
		}
		// Normalize newlines to simplify SSE parsing
		const chunk = decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
		buffer += chunk;
		// Process complete SSE events separated by a blank line
		let sepIdx;
		while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
			const eventBlock = buffer.slice(0, sepIdx);
			buffer = buffer.slice(sepIdx + 2);
			const lines = eventBlock.split('\n').map(l => l.trim()).filter(Boolean);
			if (lines.length === 0) continue;
			let dataLines = [];
			for (const l of lines) {
				if (l.startsWith(':')) continue; // comment
				if (l.startsWith('event:')) {
					console.log('[DEBUG] Gemini SSE event type:', l);
					continue;
				}
				if (l === 'data: [DONE]' || l === '[DONE]') {
					console.log('[DEBUG] Gemini stream end marker received');
					continue;
				}
				if (l.startsWith('data:')) dataLines.push(l.slice(5).trim());
			}
			if (dataLines.length === 0) continue;
			const payload = dataLines.join('\n');
			if (!payload) continue;
			try {
				const data = JSON.parse(payload);
				console.log('[DEBUG] Gemini parsed data:', data);
				if (!firstParsedAtMs) {
					firstParsedAtMs = Date.now();
					console.log('[DEBUG] Gemini first parsed event latency (ms):', firstParsedAtMs - startedAtMs);
				}
				if (data.candidates?.[0]?.content?.parts) {
					for (const part of data.candidates[0].content.parts) {
						if (part.text) {
							newMessage.content += part.text;
						}
					}
				} else if (data.choices?.[0]?.delta) {
					const delta = data.choices[0].delta || {};
					if (typeof delta.content === 'string') newMessage.content += delta.content;
					if (typeof delta.reasoning_content === 'string') newMessage.reasoning_content = (newMessage.reasoning_content || '') + delta.reasoning_content;
				} else if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (typeof onChunk === 'function') {
					onChunkCalls++;
					onChunk({ ...newMessage });
				}
			} catch (err) {
				console.error('[DEBUG] Gemini data parsing error:', err, 'Original payload:', payload);
			}
		}
	}
	console.log('[DEBUG] Final Gemini message:', newMessage);
	console.log('[DEBUG] Gemini stream summary:', {
		chunksRead: chunkCount,
		onChunkCalls,
		firstByteDeltaMs: firstByteAtMs ? (firstByteAtMs - startedAtMs) : null,
		firstParsedDeltaMs: firstParsedAtMs ? (firstParsedAtMs - startedAtMs) : null,
		totalDurationMs: Date.now() - startedAtMs
	});
	return newMessage;
}
