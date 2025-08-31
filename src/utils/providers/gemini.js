export async function callModelGemini({ apiUrl, apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	const isDirectGoogle = !apiUrl || apiUrl.includes('generativelanguage.googleapis.com');

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

	const headers = isDirectGoogle
		? { 'Content-Type': 'application/json' }
		: {
			'Content-Type': 'application/json',
			'Authorization': apiKey ? `Bearer ${apiKey}` : undefined,
			'x-api-key': apiKey || undefined
		};

	const response = await fetch(finalUrl, {
		method: 'POST',
		headers,
		signal,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
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

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = decoder.decode(value);
		const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
		for (const line of lines) {
			if (line === 'data: [DONE]' || line === '[DONE]') continue;
			let jsonStr = line;
			if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
			if (!jsonStr) continue;
			try {
				const data = JSON.parse(jsonStr);
				if (data.candidates?.[0]?.content?.parts) {
					for (const part of data.candidates[0].content.parts) {
						if (part.text) newMessage.content += part.text;
					}
				} else if (data.choices?.[0]?.delta?.content !== undefined) {
					newMessage.content += data.choices[0].delta.content || '';
				} else if (typeof data.text === 'string') {
					newMessage.content += data.text;
				}
				if (typeof onChunk === 'function') onChunk(newMessage);
			} catch (err) {
				console.error('Gemini流数据解析错误:', err, '原始:', line);
			}
		}
	}
	return newMessage;
}
