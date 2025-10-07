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
		let inString = false;
		let escapeNext = false;
		let replacedCount = 0;
		
		for (let i = 0; i < jsonText.length; i++) {
			const char = jsonText[i];
			const charCode = jsonText.charCodeAt(i);
			
			if (escapeNext) {
				result += char;
				escapeNext = false;
				continue;
			}
			
			if (char === '\\') {
				result += char;
				escapeNext = true;
				continue;
			}
			
			if (char === '"') {
				inString = !inString;
				result += char;
				continue;
			}
			
			if (inString && (charCode === 0x201C || charCode === 0x201D)) {
				console.log(`[StreamJsonParser] 替换中文双引号 ${char} (0x${charCode.toString(16)}) -> '`);
				result += '\'';
				replacedCount++;
			} else if (inString && (charCode === 0x2018 || charCode === 0x2019)) {
				console.log(`[StreamJsonParser] 替换中文单引号 ${char} (0x${charCode.toString(16)}) -> '`);
				result += '\'';
				replacedCount++;
			} else if (inString && charCode === 0xFF02) {
				console.log(`[StreamJsonParser] 替换全角引号 ${char} (0x${charCode.toString(16)}) -> '`);
				result += '\'';
				replacedCount++;
			} else {
				result += char;
			}
		}
		
		if (replacedCount > 0) {
			console.log(`[StreamJsonParser] 共替换了 ${replacedCount} 个中文引号`);
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

