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
		
		return cleaned;
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

