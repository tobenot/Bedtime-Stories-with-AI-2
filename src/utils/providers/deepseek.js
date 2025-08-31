export async function callModelDeepseek({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
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

	const headers = { 'Content-Type': 'application/json' };
	if (isOfficial && apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API请求失败: ${response.status} - ${errorText}`);
	}

	const newMessage = {
		role: 'assistant',
		content: '',
		reasoning_content: '',
		timestamp: new Date().toISOString()
	};

	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = decoder.decode(value);
		const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
		for (const line of lines) {
			if (line === 'data: [DONE]' || line === '[DONE]') continue;
			let jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);
				if (data.choices?.[0]?.delta?.reasoning_content !== undefined) {
					newMessage.reasoning_content += data.choices[0].delta.reasoning_content || '';
				}
				if (data.choices?.[0]?.delta?.content !== undefined) {
					newMessage.content += data.choices[0].delta.content || '';
				}
				if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (typeof onChunk === 'function') onChunk(newMessage);
			} catch (error) {
				console.error('数据解析错误:', error, '原始数据:', line);
			}
		}
	}
	return newMessage;
}

