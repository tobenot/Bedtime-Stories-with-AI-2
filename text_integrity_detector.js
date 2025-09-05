/**
 * 文本完整性检测器
 * 专门用于检测AI回复中的漏字、断句等问题
 */

class TextIntegrityDetector {
    constructor() {
        this.config = {
            // 语言模型配置
            expectedCharFrequency: this.getChineseCharFrequency(),
            commonWords: this.getCommonChineseWords(),
            
            // 检测阈值
            minSentenceLength: 3,
            maxSentenceLength: 200,
            suspiciousGapThreshold: 0.3, // 可疑间隔阈值
            
            // 分析参数
            contextWindow: 10, // 上下文窗口大小
            similarityThreshold: 0.7 // 相似度阈值
        };
        
        this.detectionHistory = [];
    }

    /**
     * 获取中文字符频率分布（简化版）
     */
    getChineseCharFrequency() {
        return {
            // 高频字符
            '的': 0.043, '一': 0.031, '是': 0.028, '在': 0.025, '不': 0.022,
            '了': 0.021, '有': 0.020, '和': 0.019, '人': 0.018, '这': 0.017,
            '中': 0.016, '大': 0.015, '为': 0.014, '上': 0.013, '个': 0.012,
            '国': 0.012, '我': 0.011, '以': 0.011, '要': 0.010, '他': 0.010,
            '时': 0.009, '来': 0.009, '用': 0.009, '们': 0.008, '生': 0.008,
            '到': 0.008, '作': 0.008, '地': 0.007, '于': 0.007, '出': 0.007,
            '就': 0.007, '分': 0.007, '对': 0.006, '成': 0.006, '会': 0.006
        };
    }

    /**
     * 获取常用中文词汇
     */
    getCommonChineseWords() {
        return [
            // 连词和介词
            '但是', '然而', '因此', '所以', '由于', '如果', '虽然', '尽管',
            '不过', '而且', '并且', '或者', '以及', '关于', '对于', '根据',
            
            // 常用动词
            '可以', '能够', '应该', '需要', '希望', '认为', '觉得', '发现',
            '显示', '表明', '说明', '证明', '提供', '包括', '含有', '具有',
            
            // 常用形容词
            '重要', '主要', '基本', '一般', '特别', '非常', '比较', '相当',
            '完全', '十分', '更加', '最好', '最大', '最小', '最多', '最少',
            
            // 时间词
            '现在', '目前', '当前', '以前', '之前', '以后', '之后', '同时',
            '首先', '然后', '最后', '接着', '随后', '此时', '那时', '平时'
        ];
    }

    /**
     * 主要检测方法
     * @param {string} text - 要检测的文本
     * @param {Array} chunks - 文本块数组（可选，用于流式分析）
     * @returns {Object} 检测结果
     */
    detectIntegrityIssues(text, chunks = null) {
        const result = {
            timestamp: Date.now(),
            originalText: text,
            textLength: text.length,
            issues: [],
            statistics: {},
            confidence: 1.0,
            recommendations: []
        };

        // 基础文本分析
        result.statistics = this.analyzeTextStatistics(text);
        
        // 语法结构检测
        const syntaxIssues = this.detectSyntaxIssues(text);
        result.issues.push(...syntaxIssues);

        // 语义连贯性检测
        const semanticIssues = this.detectSemanticIssues(text);
        result.issues.push(...semanticIssues);

        // 字符完整性检测
        const characterIssues = this.detectCharacterIssues(text);
        result.issues.push(...characterIssues);

        // 如果有chunks信息，进行流式分析
        if (chunks && chunks.length > 0) {
            const streamIssues = this.detectStreamingIssues(text, chunks);
            result.issues.push(...streamIssues);
        }

        // 计算置信度
        result.confidence = this.calculateConfidence(result.issues, result.statistics);

        // 生成修复建议
        result.recommendations = this.generateRepairRecommendations(result.issues);

        // 保存到历史记录
        this.detectionHistory.push(result);

        return result;
    }

    /**
     * 分析文本统计信息
     */
    analyzeTextStatistics(text) {
        const sentences = this.splitIntoSentences(text);
        const words = this.extractWords(text);
        const characters = text.split('');

        return {
            totalCharacters: text.length,
            totalSentences: sentences.length,
            totalWords: words.length,
            averageSentenceLength: sentences.length > 0 ? text.length / sentences.length : 0,
            averageWordLength: words.length > 0 ? 
                words.reduce((sum, word) => sum + word.length, 0) / words.length : 0,
            
            // 字符分布
            characterDistribution: this.analyzeCharacterDistribution(characters),
            
            // 句子长度分布
            sentenceLengths: sentences.map(s => s.length),
            
            // 词频分析
            wordFrequency: this.analyzeWordFrequency(words),
            
            // 标点符号使用
            punctuationUsage: this.analyzePunctuationUsage(text)
        };
    }

    /**
     * 检测语法结构问题
     */
    detectSyntaxIssues(text) {
        const issues = [];
        const sentences = this.splitIntoSentences(text);

        sentences.forEach((sentence, index) => {
            // 检测不完整的句子
            if (sentence.length < this.config.minSentenceLength) {
                issues.push({
                    type: 'incomplete_sentence',
                    severity: 'medium',
                    position: this.findSentencePosition(text, sentence, index),
                    description: `句子过短，可能不完整: "${sentence}"`,
                    sentence: sentence,
                    sentenceIndex: index
                });
            }

            // 检测异常长的句子
            if (sentence.length > this.config.maxSentenceLength) {
                issues.push({
                    type: 'overly_long_sentence',
                    severity: 'low',
                    position: this.findSentencePosition(text, sentence, index),
                    description: `句子过长，可能缺少标点: "${sentence.substring(0, 50)}..."`,
                    sentence: sentence,
                    sentenceIndex: index
                });
            }

            // 检测标点符号问题
            const punctuationIssues = this.checkPunctuationIntegrity(sentence);
            issues.push(...punctuationIssues.map(issue => ({
                ...issue,
                sentenceIndex: index,
                position: this.findSentencePosition(text, sentence, index)
            })));

            // 检测语法结构
            const grammarIssues = this.checkGrammarStructure(sentence);
            issues.push(...grammarIssues.map(issue => ({
                ...issue,
                sentenceIndex: index,
                position: this.findSentencePosition(text, sentence, index)
            })));
        });

        return issues;
    }

    /**
     * 检测语义连贯性问题
     */
    detectSemanticIssues(text) {
        const issues = [];
        const sentences = this.splitIntoSentences(text);

        for (let i = 1; i < sentences.length; i++) {
            const prevSentence = sentences[i - 1];
            const currentSentence = sentences[i];

            // 计算句子间的语义相似度
            const similarity = this.calculateSemanticSimilarity(prevSentence, currentSentence);

            if (similarity < this.config.similarityThreshold) {
                // 检查是否可能存在缺失的连接词或句子
                const connectionIssue = this.analyzeConnectionIssue(prevSentence, currentSentence);
                if (connectionIssue) {
                    issues.push({
                        type: 'semantic_gap',
                        severity: 'medium',
                        position: this.findSentencePosition(text, currentSentence, i),
                        description: `句子间语义连贯性较差，可能存在内容缺失`,
                        prevSentence: prevSentence,
                        currentSentence: currentSentence,
                        similarity: similarity,
                        sentenceIndex: i
                    });
                }
            }

            // 检测主题突变
            const topicShift = this.detectTopicShift(prevSentence, currentSentence);
            if (topicShift.isAbrupt) {
                issues.push({
                    type: 'abrupt_topic_shift',
                    severity: 'low',
                    position: this.findSentencePosition(text, currentSentence, i),
                    description: `主题转换过于突然，可能缺少过渡`,
                    topicShift: topicShift,
                    sentenceIndex: i
                });
            }
        }

        return issues;
    }

    /**
     * 检测字符完整性问题
     */
    detectCharacterIssues(text) {
        const issues = [];
        const characters = text.split('');

        // 检测异常字符组合
        for (let i = 0; i < characters.length - 1; i++) {
            const char = characters[i];
            const nextChar = characters[i + 1];

            // 检测可能的字符丢失
            if (this.isPossibleCharacterLoss(char, nextChar)) {
                issues.push({
                    type: 'possible_character_loss',
                    severity: 'high',
                    position: i,
                    description: `可能的字符丢失: "${char}${nextChar}"`,
                    context: this.getCharacterContext(text, i),
                    confidence: this.calculateCharacterLossConfidence(char, nextChar, text, i)
                });
            }

            // 检测编码问题
            if (this.isEncodingIssue(char)) {
                issues.push({
                    type: 'encoding_issue',
                    severity: 'medium',
                    position: i,
                    description: `可能的编码问题: "${char}"`,
                    context: this.getCharacterContext(text, i)
                });
            }
        }

        // 检测词汇完整性
        const words = this.extractWords(text);
        words.forEach((word, index) => {
            const wordIssues = this.checkWordIntegrity(word, index, text);
            issues.push(...wordIssues);
        });

        return issues;
    }

    /**
     * 检测流式传输问题
     */
    detectStreamingIssues(text, chunks) {
        const issues = [];

        // 重建流式传输过程
        let reconstructedText = '';
        const chunkBoundaries = [];

        chunks.forEach((chunk, index) => {
            chunkBoundaries.push({
                start: reconstructedText.length,
                end: reconstructedText.length + chunk.content.length,
                chunkIndex: index,
                timestamp: chunk.timestamp,
                size: chunk.size
            });
            reconstructedText += chunk.content;
        });

        // 检测块边界问题
        chunkBoundaries.forEach((boundary, index) => {
            if (index === 0) return;

            const prevBoundary = chunkBoundaries[index - 1];
            const boundaryText = text.substring(prevBoundary.end - 5, boundary.start + 5);

            // 检测可能的块丢失
            if (this.isPossibleChunkLoss(prevBoundary, boundary, text)) {
                issues.push({
                    type: 'possible_chunk_loss',
                    severity: 'high',
                    position: boundary.start,
                    description: '可能的数据块丢失',
                    chunkIndex: index,
                    context: boundaryText,
                    timingGap: boundary.timestamp - prevBoundary.timestamp
                });
            }

            // 检测块边界字符问题
            const boundaryIssues = this.checkChunkBoundaryIntegrity(text, boundary);
            issues.push(...boundaryIssues);
        });

        // 检测重建文本与原文本的差异
        if (reconstructedText !== text) {
            const diffAnalysis = this.analyzeTextDifference(reconstructedText, text);
            issues.push({
                type: 'reconstruction_mismatch',
                severity: 'critical',
                description: '重建文本与原文本不匹配',
                differences: diffAnalysis,
                reconstructedLength: reconstructedText.length,
                originalLength: text.length
            });
        }

        return issues;
    }

    /**
     * 辅助方法：分割句子
     */
    splitIntoSentences(text) {
        // 中文句子分割
        return text.split(/[。！？；\n]/).filter(s => s.trim().length > 0);
    }

    /**
     * 辅助方法：提取词汇
     */
    extractWords(text) {
        // 简化的中文分词
        return text.match(/[\u4e00-\u9fa5]+/g) || [];
    }

    /**
     * 辅助方法：分析字符分布
     */
    analyzeCharacterDistribution(characters) {
        const distribution = {};
        const total = characters.length;

        characters.forEach(char => {
            distribution[char] = (distribution[char] || 0) + 1;
        });

        // 转换为频率
        Object.keys(distribution).forEach(char => {
            distribution[char] = distribution[char] / total;
        });

        return distribution;
    }

    /**
     * 辅助方法：分析词频
     */
    analyzeWordFrequency(words) {
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        return frequency;
    }

    /**
     * 辅助方法：分析标点符号使用
     */
    analyzePunctuationUsage(text) {
        const punctuation = text.match(/[，。！？；：""''（）【】《》]/g) || [];
        const usage = {};
        punctuation.forEach(p => {
            usage[p] = (usage[p] || 0) + 1;
        });
        return usage;
    }

    /**
     * 辅助方法：检查标点符号完整性
     */
    checkPunctuationIntegrity(sentence) {
        const issues = [];
        
        // 检查配对标点符号
        const pairs = {
            '"': '"', ''': ''', '（': '）', '【': '】', '《': '》'
        };

        Object.entries(pairs).forEach(([open, close]) => {
            const openCount = (sentence.match(new RegExp(`\\${open}`, 'g')) || []).length;
            const closeCount = (sentence.match(new RegExp(`\\${close}`, 'g')) || []).length;

            if (openCount !== closeCount) {
                issues.push({
                    type: 'unmatched_punctuation',
                    severity: 'medium',
                    description: `不匹配的标点符号: ${open}${close}`,
                    openCount,
                    closeCount
                });
            }
        });

        return issues;
    }

    /**
     * 辅助方法：检查语法结构
     */
    checkGrammarStructure(sentence) {
        const issues = [];

        // 检查是否以标点符号开头
        if (/^[，。！？；：]/.test(sentence)) {
            issues.push({
                type: 'starts_with_punctuation',
                severity: 'high',
                description: '句子以标点符号开头，可能缺少前文'
            });
        }

        // 检查是否包含基本的语法成分
        const hasSubject = this.hasSubject(sentence);
        const hasPredicate = this.hasPredicate(sentence);

        if (!hasSubject && sentence.length > 10) {
            issues.push({
                type: 'missing_subject',
                severity: 'medium',
                description: '句子可能缺少主语'
            });
        }

        if (!hasPredicate && sentence.length > 10) {
            issues.push({
                type: 'missing_predicate',
                severity: 'medium',
                description: '句子可能缺少谓语'
            });
        }

        return issues;
    }

    /**
     * 辅助方法：计算语义相似度（简化版）
     */
    calculateSemanticSimilarity(sentence1, sentence2) {
        const words1 = this.extractWords(sentence1);
        const words2 = this.extractWords(sentence2);

        if (words1.length === 0 || words2.length === 0) return 0;

        const commonWords = words1.filter(word => words2.includes(word));
        return (2 * commonWords.length) / (words1.length + words2.length);
    }

    /**
     * 辅助方法：分析连接问题
     */
    analyzeConnectionIssue(prevSentence, currentSentence) {
        // 检查是否缺少连接词
        const connectionWords = ['但是', '然而', '因此', '所以', '而且', '并且'];
        const hasConnection = connectionWords.some(word => 
            currentSentence.includes(word) || prevSentence.includes(word)
        );

        const topicWords1 = this.extractTopicWords(prevSentence);
        const topicWords2 = this.extractTopicWords(currentSentence);
        const topicOverlap = topicWords1.filter(word => topicWords2.includes(word)).length;

        return !hasConnection && topicOverlap < 2;
    }

    /**
     * 辅助方法：检测主题转换
     */
    detectTopicShift(prevSentence, currentSentence) {
        const topicWords1 = this.extractTopicWords(prevSentence);
        const topicWords2 = this.extractTopicWords(currentSentence);
        
        const overlap = topicWords1.filter(word => topicWords2.includes(word)).length;
        const totalTopicWords = new Set([...topicWords1, ...topicWords2]).size;
        
        const continuity = totalTopicWords > 0 ? overlap / totalTopicWords : 0;
        
        return {
            isAbrupt: continuity < 0.3 && totalTopicWords > 3,
            continuity,
            topicWords1,
            topicWords2
        };
    }

    /**
     * 辅助方法：提取主题词
     */
    extractTopicWords(sentence) {
        const words = this.extractWords(sentence);
        // 过滤掉常用词，保留主题相关词汇
        const stopWords = ['的', '是', '在', '有', '和', '这', '那', '一个', '可以', '应该'];
        return words.filter(word => !stopWords.includes(word) && word.length > 1);
    }

    /**
     * 辅助方法：检测可能的字符丢失
     */
    isPossibleCharacterLoss(char, nextChar) {
        // 检测异常的字符组合
        const suspiciousPatterns = [
            /[，。！？][\u4e00-\u9fa5]/, // 标点后直接跟中文（可能缺少空格或其他字符）
            /[\u4e00-\u9fa5][，。！？][\u4e00-\u9fa5]/, // 中文-标点-中文的异常组合
            /[a-zA-Z][\u4e00-\u9fa5]/, // 英文字母直接跟中文
            /[\u4e00-\u9fa5][a-zA-Z]/ // 中文直接跟英文字母
        ];

        const combination = char + nextChar;
        return suspiciousPatterns.some(pattern => pattern.test(combination));
    }

    /**
     * 辅助方法：检测编码问题
     */
    isEncodingIssue(char) {
        const code = char.charCodeAt(0);
        // 检测可能的编码问题字符
        return (
            code === 65533 || // 替换字符 �
            (code >= 0xFFF0 && code <= 0xFFFF) || // 特殊区域
            char === '?' && /[\u4e00-\u9fa5]/.test(char) // 中文环境下的异常问号
        );
    }

    /**
     * 辅助方法：获取字符上下文
     */
    getCharacterContext(text, position) {
        const start = Math.max(0, position - this.config.contextWindow);
        const end = Math.min(text.length, position + this.config.contextWindow + 1);
        return text.substring(start, end);
    }

    /**
     * 辅助方法：计算字符丢失置信度
     */
    calculateCharacterLossConfidence(char, nextChar, text, position) {
        let confidence = 0.5; // 基础置信度

        // 基于字符频率调整
        const expectedFreq1 = this.config.expectedCharFrequency[char] || 0.001;
        const expectedFreq2 = this.config.expectedCharFrequency[nextChar] || 0.001;
        
        if (expectedFreq1 > 0.01 && expectedFreq2 > 0.01) {
            confidence += 0.2; // 高频字符组合更可疑
        }

        // 基于上下文调整
        const context = this.getCharacterContext(text, position);
        const contextWords = this.extractWords(context);
        const hasCommonWords = contextWords.some(word => 
            this.config.commonWords.includes(word)
        );

        if (hasCommonWords) {
            confidence += 0.2;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 辅助方法：检查词汇完整性
     */
    checkWordIntegrity(word, index, text) {
        const issues = [];

        // 检查是否是不完整的词
        if (word.length === 1 && this.isLikelyIncompleteWord(word, text)) {
            issues.push({
                type: 'incomplete_word',
                severity: 'medium',
                description: `可能不完整的词汇: "${word}"`,
                word: word,
                wordIndex: index,
                position: text.indexOf(word)
            });
        }

        // 检查是否是异常的词汇组合
        if (this.isAbnormalWordCombination(word)) {
            issues.push({
                type: 'abnormal_word',
                severity: 'low',
                description: `异常的词汇: "${word}"`,
                word: word,
                wordIndex: index,
                position: text.indexOf(word)
            });
        }

        return issues;
    }

    /**
     * 辅助方法：计算置信度
     */
    calculateConfidence(issues, statistics) {
        let confidence = 1.0;

        // 基于问题严重程度调整置信度
        issues.forEach(issue => {
            switch (issue.severity) {
                case 'critical':
                    confidence -= 0.3;
                    break;
                case 'high':
                    confidence -= 0.2;
                    break;
                case 'medium':
                    confidence -= 0.1;
                    break;
                case 'low':
                    confidence -= 0.05;
                    break;
            }
        });

        // 基于文本统计特征调整
        if (statistics.averageSentenceLength < 5) {
            confidence -= 0.1; // 句子过短可能有问题
        }

        if (statistics.totalSentences === 0) {
            confidence -= 0.2; // 没有完整句子
        }

        return Math.max(confidence, 0.0);
    }

    /**
     * 生成修复建议
     */
    generateRepairRecommendations(issues) {
        const recommendations = [];
        const issueTypes = [...new Set(issues.map(issue => issue.type))];

        issueTypes.forEach(type => {
            const typeIssues = issues.filter(issue => issue.type === type);
            
            switch (type) {
                case 'possible_character_loss':
                    recommendations.push({
                        type: 'character_recovery',
                        priority: 'high',
                        description: `检测到${typeIssues.length}个可能的字符丢失`,
                        actions: [
                            '检查网络传输稳定性',
                            '验证数据编码格式',
                            '实现字符级别的校验',
                            '考虑使用更可靠的传输协议'
                        ]
                    });
                    break;
                    
                case 'semantic_gap':
                    recommendations.push({
                        type: 'content_recovery',
                        priority: 'medium',
                        description: `检测到${typeIssues.length}个语义断层`,
                        actions: [
                            '检查是否有句子或段落丢失',
                            '验证流式传输的完整性',
                            '实现内容连贯性检查',
                            '考虑添加重传机制'
                        ]
                    });
                    break;
                    
                case 'possible_chunk_loss':
                    recommendations.push({
                        type: 'transmission_optimization',
                        priority: 'critical',
                        description: `检测到${typeIssues.length}个可能的数据块丢失`,
                        actions: [
                            '立即检查网络连接',
                            '实现数据块级别的校验和',
                            '添加自动重传机制',
                            '监控服务器性能'
                        ]
                    });
                    break;
            }
        });

        return recommendations;
    }

    // 更多辅助方法...
    hasSubject(sentence) {
        const subjectIndicators = ['我', '你', '他', '她', '它', '我们', '你们', '他们'];
        return subjectIndicators.some(indicator => sentence.includes(indicator));
    }

    hasPredicate(sentence) {
        const predicateIndicators = ['是', '有', '能', '会', '可以', '应该', '需要'];
        return predicateIndicators.some(indicator => sentence.includes(indicator));
    }

    isLikelyIncompleteWord(word, text) {
        // 简化的不完整词检测
        return word.length === 1 && /[\u4e00-\u9fa5]/.test(word);
    }

    isAbnormalWordCombination(word) {
        // 检测异常的词汇组合
        return word.length > 10 && !/[，。！？；：]/.test(word);
    }

    findSentencePosition(text, sentence, index) {
        return text.indexOf(sentence);
    }

    isPossibleChunkLoss(prevBoundary, boundary, text) {
        const gap = boundary.timestamp - prevBoundary.timestamp;
        return gap > 1000; // 超过1秒的间隔可能有问题
    }

    checkChunkBoundaryIntegrity(text, boundary) {
        // 检查块边界的字符完整性
        return [];
    }

    analyzeTextDifference(text1, text2) {
        return {
            lengthDiff: text2.length - text1.length,
            // 简化的差异分析
            summary: text1.length !== text2.length ? 'length_mismatch' : 'content_mismatch'
        };
    }

    /**
     * 获取检测历史统计
     */
    getDetectionStatistics() {
        if (this.detectionHistory.length === 0) {
            return { message: '暂无检测历史' };
        }

        const totalDetections = this.detectionHistory.length;
        const issuesFound = this.detectionHistory.filter(d => d.issues.length > 0).length;
        
        return {
            totalDetections,
            issuesFound,
            detectionRate: issuesFound / totalDetections,
            averageConfidence: this.detectionHistory.reduce((sum, d) => sum + d.confidence, 0) / totalDetections,
            commonIssueTypes: this.getCommonIssueTypes(),
            timeRange: {
                start: Math.min(...this.detectionHistory.map(d => d.timestamp)),
                end: Math.max(...this.detectionHistory.map(d => d.timestamp))
            }
        };
    }

    getCommonIssueTypes() {
        const allIssues = this.detectionHistory.flatMap(d => d.issues);
        const typeCount = {};
        
        allIssues.forEach(issue => {
            typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;
        });

        return Object.entries(typeCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextIntegrityDetector;
} else {
    window.TextIntegrityDetector = TextIntegrityDetector;
}