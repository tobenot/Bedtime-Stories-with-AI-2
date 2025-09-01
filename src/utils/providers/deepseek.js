export async function callModelDeepseek({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	console.log('[DEBUG] callModelDeepseek called:', {
		apiUrl,
		hasApiKey: !!apiKey,
		model,
		messagesCount: messages.length,
		temperature,
		maxTokens
	});
	
	const requestBody = {
		model,
		messages,
		stream: true,
		temperature,
		max_tokens: maxTokens
	};

	const isOfficial = typeof apiUrl === 'string' && (
		apiUrl.includes('siliconflow.cn') ||
		apiUrl.includes('deepseek.com') ||
		apiUrl.includes('volces.com')
	);

	const isBackendProxy = typeof apiUrl === 'string' && (
		apiUrl.includes('/deepseek') || 
		apiUrl.startsWith('/api/')
	);
	
	console.log('[DEBUG] DeepSeek request details:', {
		isOfficial,
		isBackendProxy,
		requestBody
	});

	const headers = { 'Content-Type': 'application/json' };
	if (isOfficial && apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
	if ((isBackendProxy || apiUrl.startsWith('/api/')) && apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
		headers['x-api-key'] = apiKey;
	}
	
	console.log('[DEBUG] Request headers:', headers);

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	console.log('[DEBUG] Response status:', response.status, response.statusText);

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[DEBUG] API request failed:', response.status, errorText);
		throw new Error(`API请求失败: ${response.status} - ${errorText}`);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString()
	};

	console.log('[DEBUG] Starting to read response stream');
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let chunkCount = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			console.log('[DEBUG] Stream finished, total chunks processed:', chunkCount);
			break;
		}
		chunkCount++;
		const chunk = decoder.decode(value);
		const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
		console.log('[DEBUG] Chunk', chunkCount, 'received, lines:', lines.length);
		
		for (const line of lines) {
			if (line === 'data: [DONE]' || line === '[DONE]') {
				console.log('[DEBUG] Stream end marker received');
				continue;
			}
			let jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);
				console.log('[DEBUG] Parsed data:', data);
				
				if (data.choices?.[0]?.delta?.reasoning_content !== undefined) {
					newMessage.reasoning_content += data.choices[0].delta.reasoning_content || '';
					console.log('[DEBUG] Updated reasoning_content, length:', newMessage.reasoning_content.length);
				}
				if (data.choices?.[0]?.delta?.content !== undefined) {
					newMessage.content += data.choices[0].delta.content || '';
					console.log('[DEBUG] Updated content, length:', newMessage.content.length);
				}
				if (typeof data.text === 'string') {
					newMessage.content += data.text;
					console.log('[DEBUG] Updated content with text, length:', newMessage.content.length);
				}
				if (typeof onChunk === 'function') {
					console.log('[DEBUG] Calling onChunk callback');
					onChunk(newMessage);
				}
			} catch (error) {
				console.error('[DEBUG] Data parsing error:', error, 'Original data:', line);
			}
		}
	}
	console.log('[DEBUG] Final message:', newMessage);
	return newMessage;
}

