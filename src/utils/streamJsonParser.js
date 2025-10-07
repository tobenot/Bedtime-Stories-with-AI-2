export class StreamJsonParser {
	constructor() {
		this.buffer = '';
		this.lastExtractedContent = '';
	}

	reset() {
		this.buffer = '';
		this.lastExtractedContent = '';
	}

	appendChunk(newContent) {
		if (this.buffer && newContent.startsWith(this.buffer.substring(0, 50))) {
			this.buffer = newContent;
		} else if (this.buffer.length > 0 && newContent.length > this.buffer.length && 
				   newContent.includes(this.buffer.substring(0, Math.min(30, this.buffer.length)))) {
			this.buffer = newContent;
		} else {
			this.buffer += newContent;
		}
	}

	cleanJsonText(jsonText) {
		let cleaned = jsonText.trim();
		
		cleaned = cleaned.replace(/```json/gi, '');
		cleaned = cleaned.replace(/```/g, '');
		cleaned = cleaned.trim();
		
		const firstBraceIndex = cleaned.indexOf('{');
		if (firstBraceIndex !== -1) {
			let braceCount = 0;
			let endIndex = firstBraceIndex;
			
			for (let i = firstBraceIndex; i < cleaned.length; i++) {
				if (cleaned[i] === '{') {
					braceCount++;
				} else if (cleaned[i] === '}') {
					braceCount--;
					if (braceCount === 0) {
						endIndex = i;
						break;
					}
				}
			}
			
			if (braceCount === 0) {
				cleaned = cleaned.substring(firstBraceIndex, endIndex + 1);
			}
		}
		
		cleaned = this.normalizeQuotesInJsonStrings(cleaned);
		
		return cleaned;
	}

	normalizeQuotesInJsonStrings(jsonText) {
		let result = '';
		let i = 0;
		
		while (i < jsonText.length) {
			if (jsonText[i] === '"') {
				result += '"';
				i++;
				
				let stringContent = '';
				let escaped = false;
				
				while (i < jsonText.length) {
					const char = jsonText[i];
					const charCode = jsonText.charCodeAt(i);
					
					if (escaped) {
						stringContent += char;
						escaped = false;
						i++;
						continue;
					}
					
					if (char === '\\') {
						stringContent += char;
						escaped = true;
						i++;
						continue;
					}
					
					if (char === '"') {
						const nextChar = jsonText[i + 1];
						if (nextChar === ',' || nextChar === '\n' || nextChar === '\r' || nextChar === '}' || nextChar === ' ' || nextChar === ':') {
							result += stringContent + '"';
							i++;
							break;
						} else {
							stringContent += '\\"';
							i++;
							continue;
						}
					}
					
					if (charCode === 0x201C || charCode === 0x201D) {
						stringContent += '\'';
					} else if (charCode === 0x2018 || charCode === 0x2019) {
						stringContent += '\'';
					} else if (charCode === 0xFF02) {
						stringContent += '\'';
					} else {
						stringContent += char;
					}
					
					i++;
				}
			} else {
				result += jsonText[i];
				i++;
			}
		}
		
		return result;
	}

	tryParse() {
		try {
			const cleaned = this.cleanJsonText(this.buffer);
			return JSON.parse(cleaned);
		} catch (e) {
			return null;
		}
	}

	parseComplete() {
		const cleaned = this.cleanJsonText(this.buffer);
		return JSON.parse(cleaned);
	}

	getBuffer() {
		return this.buffer;
	}

	extractField(data, fieldName, defaultValue = '') {
		return data?.[fieldName] || defaultValue;
	}
}

export function createStreamJsonParser() {
	return new StreamJsonParser();
}

