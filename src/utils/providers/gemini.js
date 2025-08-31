export async function callModelGemini({ apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, onChunk }) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

	const contents = [
		{
			role: 'user',
			parts: messages.map(m => ({ text: `${m.role === 'user' ? '用户' : '助手'}: ${m.content}` }))
		}
	];

	const requestBody = {
		contents,
		generationConfig: {
			temperature,
			maxOutputTokens: maxTokens
		}
	};

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
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
		const lines = chunk.split('\n').filter(line => line.startsWith('data:'));
		for (const line of lines) {
			const payload = line.slice(5).trim();
			if (!payload || payload === '[DONE]') continue;
			try {
				const data = JSON.parse(payload);
				const parts = data.candidates?.[0]?.content?.parts || [];
				for (const part of parts) {
					if (part.text) newMessage.content += part.text;
				}
				if (typeof onChunk === 'function') onChunk(newMessage);
			} catch (err) {
				console.error('Gemini流数据解析错误:', err, '原始:', line);
			}
		}
	}
	return newMessage;
}

