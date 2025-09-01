export async function callModelGemini({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	console.log('[DEBUG] callModelGemini called:', {
		apiUrl,
		hasApiKey: !!apiKey,
		model,
		messagesCount: messages.length,
		temperature,
		maxTokens
	});
	
	const isDirectGoogle = !apiUrl || apiUrl.includes('generativelanguage.googleapis.com');
	const isBackendProxy = typeof apiUrl === 'string' && (
		apiUrl.includes('/gemini') || 
		apiUrl.startsWith('/api/')
	);
	
	console.log('[DEBUG] Gemini request details:', {
		isDirectGoogle,
		isBackendProxy
	});

	const contents = messages.map(m => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const requestBody = {
		model,
		contents,
		generationConfig: {
			temperature,
			maxOutputTokens: maxTokens
		},
		stream: true
	};

	const finalUrl = isDirectGoogle
		? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
		: apiUrl;
		
	console.log('[DEBUG] Final Gemini URL:', finalUrl);

	const headers = { 'Content-Type': 'application/json' };
	if (!isDirectGoogle && apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
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

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			console.log('[DEBUG] Gemini stream finished, total chunks processed:', chunkCount);
			break;
		}
		chunkCount++;
		const chunk = decoder.decode(value);
		const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
		console.log('[DEBUG] Gemini chunk', chunkCount, 'received, lines:', lines.length);
		
		for (const line of lines) {
			if (line === 'data: [DONE]' || line === '[DONE]') {
				console.log('[DEBUG] Gemini stream end marker received');
				continue;
			}
			let jsonStr = line;
			if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);
				console.log('[DEBUG] Gemini parsed data:', data);
				
				if (data.candidates?.[0]?.content?.parts) {
					for (const part of data.candidates[0].content.parts) {
						if (part.text) {
							newMessage.content += part.text;
							console.log('[DEBUG] Updated Gemini content with part.text, length:', newMessage.content.length);
						}
					}
				} else if (data.choices?.[0]?.delta?.content !== undefined) {
					newMessage.content += data.choices[0].delta.content || '';
					console.log('[DEBUG] Updated Gemini content with delta, length:', newMessage.content.length);
				} else if (typeof data.text === 'string') {
					newMessage.content += data.text;
					console.log('[DEBUG] Updated Gemini content with text, length:', newMessage.content.length);
				}
				if (typeof onChunk === 'function') {
					console.log('[DEBUG] Calling Gemini onChunk callback');
					onChunk(newMessage);
				}
			} catch (err) {
				console.error('[DEBUG] Gemini data parsing error:', err, 'Original:', line);
			}
		}
	}
	console.log('[DEBUG] Final Gemini message:', newMessage);
	return newMessage;
}
