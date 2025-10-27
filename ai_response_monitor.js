/**
 * AI回复监控和日志系统
 * 用于检测和分析AI回复中的漏字问题
 */

class AIResponseMonitor {
    constructor() {
        this.logs = [];
        this.config = {
            // 检测阈值
            minChunkSize: 10, // 最小数据块大小
            maxGapTime: 1000, // 最大间隔时间(ms)
            suspiciousGapThreshold: 500, // 可疑间隔阈值(ms)
            
            // 日志设置
            maxLogEntries: 10000,
            logToFile: true,
            logFilePath: './ai_response_logs.json'
        };
        
        // 初始化日志文件
        this.initializeLogging();
    }

    /**
     * 初始化日志系统
     */
    initializeLogging() {
        console.log('AI Response Monitor initialized');
        this.startTime = Date.now();
    }

    /**
     * 监控AI回复的流式传输
     * @param {string} sessionId - 会话ID
     * @param {string} prompt - 用户输入
     * @param {ReadableStream} responseStream - AI回复流
     */
    async monitorResponse(sessionId, prompt, responseStream) {
        const session = {
            sessionId,
            prompt,
            startTime: Date.now(),
            chunks: [],
            totalLength: 0,
            suspiciousGaps: [],
            networkEvents: [],
            finalResponse: '',
            isComplete: false,
            errors: []
        };

        console.log(`开始监控会话: ${sessionId}`);

        try {
            const reader = responseStream.getReader();
            let lastChunkTime = Date.now();
            let chunkIndex = 0;

            while (true) {
                const startRead = performance.now();
                const { done, value } = await reader.read();
                const endRead = performance.now();
                
                const currentTime = Date.now();
                const timeSinceLastChunk = currentTime - lastChunkTime;

                if (done) {
                    session.isComplete = true;
                    session.endTime = currentTime;
                    break;
                }

                // 记录数据块信息
                const chunk = {
                    index: chunkIndex++,
                    timestamp: currentTime,
                    size: value.length,
                    content: new TextDecoder().decode(value),
                    timeSinceLastChunk,
                    readLatency: endRead - startRead,
                    networkDelay: timeSinceLastChunk > this.config.suspiciousGapThreshold
                };

                session.chunks.push(chunk);
                session.totalLength += chunk.size;
                session.finalResponse += chunk.content;

                // 检测可疑的时间间隔
                if (timeSinceLastChunk > this.config.suspiciousGapThreshold) {
                    const suspiciousGap = {
                        chunkIndex,
                        gap: timeSinceLastChunk,
                        timestamp: currentTime,
                        beforeContent: session.chunks[chunkIndex - 1]?.content || '',
                        afterContent: chunk.content
                    };
                    session.suspiciousGaps.push(suspiciousGap);
                    
                    console.warn(`检测到可疑间隔: ${timeSinceLastChunk}ms at chunk ${chunkIndex}`);
                }

                // 检测异常小的数据块
                if (chunk.size < this.config.minChunkSize && chunk.size > 0) {
                    console.warn(`检测到异常小数据块: ${chunk.size} bytes at chunk ${chunkIndex}`);
                }

                lastChunkTime = currentTime;
            }

        } catch (error) {
            session.errors.push({
                timestamp: Date.now(),
                error: error.message,
                stack: error.stack
            });
            console.error('监控过程中发生错误:', error);
        }

        // 保存会话日志
        await this.saveSession(session);
        
        // 分析可能的漏字问题
        const analysis = this.analyzeSession(session);
        
        return {
            session,
            analysis,
            recommendations: this.generateRecommendations(analysis)
        };
    }

    /**
     * 分析会话数据，检测潜在的漏字问题
     */
    analyzeSession(session) {
        const analysis = {
            totalDuration: session.endTime - session.startTime,
            totalChunks: session.chunks.length,
            totalBytes: session.totalLength,
            averageChunkSize: session.totalLength / session.chunks.length,
            suspiciousGapsCount: session.suspiciousGaps.length,
            networkIssues: [],
            potentialDataLoss: [],
            streamingPattern: this.analyzeStreamingPattern(session.chunks)
        };

        // 检测网络问题模式
        session.chunks.forEach((chunk, index) => {
            // 检测异常长的间隔
            if (chunk.timeSinceLastChunk > this.config.maxGapTime) {
                analysis.networkIssues.push({
                    type: 'long_gap',
                    chunkIndex: index,
                    duration: chunk.timeSinceLastChunk,
                    severity: chunk.timeSinceLastChunk > 2000 ? 'high' : 'medium'
                });
            }

            // 检测读取延迟
            if (chunk.readLatency > 100) {
                analysis.networkIssues.push({
                    type: 'read_latency',
                    chunkIndex: index,
                    latency: chunk.readLatency,
                    severity: chunk.readLatency > 500 ? 'high' : 'low'
                });
            }

            // 检测可能的数据丢失
            if (chunk.size === 0) {
                analysis.potentialDataLoss.push({
                    type: 'empty_chunk',
                    chunkIndex: index,
                    timestamp: chunk.timestamp
                });
            }
        });

        // 计算统计信息
        analysis.statistics = {
            avgTimeBetweenChunks: session.chunks.reduce((sum, chunk) => 
                sum + chunk.timeSinceLastChunk, 0) / session.chunks.length,
            maxGap: Math.max(...session.chunks.map(c => c.timeSinceLastChunk)),
            minChunkSize: Math.min(...session.chunks.map(c => c.size)),
            maxChunkSize: Math.max(...session.chunks.map(c => c.size))
        };

        return analysis;
    }

    /**
     * 分析流式传输模式
     */
    analyzeStreamingPattern(chunks) {
        const pattern = {
            isConsistent: true,
            irregularities: [],
            chunkSizeVariation: 0,
            timingVariation: 0
        };

        if (chunks.length < 2) return pattern;

        const sizes = chunks.map(c => c.size);
        const timings = chunks.slice(1).map(c => c.timeSinceLastChunk);

        // 计算变异系数
        const avgSize = sizes.reduce((a, b) => a + b) / sizes.length;
        const sizeVariance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
        pattern.chunkSizeVariation = Math.sqrt(sizeVariance) / avgSize;

        const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
        const timingVariance = timings.reduce((sum, timing) => sum + Math.pow(timing - avgTiming, 2), 0) / timings.length;
        pattern.timingVariation = Math.sqrt(timingVariance) / avgTiming;

        // 检测不规律性
        chunks.forEach((chunk, index) => {
            if (index === 0) return;
            
            const prevChunk = chunks[index - 1];
            const sizeRatio = chunk.size / prevChunk.size;
            const timingRatio = chunk.timeSinceLastChunk / prevChunk.timeSinceLastChunk;

            if (sizeRatio > 3 || sizeRatio < 0.3) {
                pattern.irregularities.push({
                    type: 'size_jump',
                    chunkIndex: index,
                    ratio: sizeRatio
                });
            }

            if (timingRatio > 3 || timingRatio < 0.3) {
                pattern.irregularities.push({
                    type: 'timing_jump',
                    chunkIndex: index,
                    ratio: timingRatio
                });
            }
        });

        pattern.isConsistent = pattern.irregularities.length < chunks.length * 0.1;
        return pattern;
    }

    /**
     * 生成问题诊断建议
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.suspiciousGapsCount > 0) {
            recommendations.push({
                type: 'network_optimization',
                priority: 'high',
                issue: `检测到${analysis.suspiciousGapsCount}个可疑的网络间隔`,
                suggestions: [
                    '检查网络连接稳定性',
                    '考虑使用CDN或更近的服务器',
                    '实现客户端重试机制',
                    '增加网络超时设置'
                ]
            });
        }

        if (analysis.networkIssues.length > 0) {
            const highSeverityIssues = analysis.networkIssues.filter(i => i.severity === 'high');
            if (highSeverityIssues.length > 0) {
                recommendations.push({
                    type: 'connection_quality',
                    priority: 'high',
                    issue: `检测到${highSeverityIssues.length}个高严重性网络问题`,
                    suggestions: [
                        '检查防火墙和代理设置',
                        '监控带宽使用情况',
                        '考虑使用HTTP/2或HTTP/3',
                        '实现断点续传机制'
                    ]
                });
            }
        }

        if (analysis.potentialDataLoss.length > 0) {
            recommendations.push({
                type: 'data_integrity',
                priority: 'critical',
                issue: `检测到${analysis.potentialDataLoss.length}个可能的数据丢失点`,
                suggestions: [
                    '实现数据完整性校验',
                    '添加重传机制',
                    '使用更可靠的传输协议',
                    '增加客户端缓冲'
                ]
            });
        }

        if (!analysis.streamingPattern.isConsistent) {
            recommendations.push({
                type: 'streaming_optimization',
                priority: 'medium',
                issue: '流式传输模式不一致',
                suggestions: [
                    '优化服务器端流式输出',
                    '调整数据块大小',
                    '实现自适应传输策略',
                    '监控服务器负载'
                ]
            });
        }

        return recommendations;
    }

    /**
     * 保存会话日志
     */
    async saveSession(session) {
        this.logs.push({
            ...session,
            savedAt: Date.now()
        });

        // 限制日志数量
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }

        if (this.config.logToFile) {
            try {
                const fs = require('fs').promises;
                await fs.writeFile(
                    this.config.logFilePath,
                    JSON.stringify(this.logs, null, 2)
                );
            } catch (error) {
                console.error('保存日志文件失败:', error);
            }
        }
    }

    /**
     * 获取统计报告
     */
    getStatisticsReport() {
        if (this.logs.length === 0) {
            return { message: '暂无数据' };
        }

        const completeSessions = this.logs.filter(log => log.isComplete);
        const totalSessions = completeSessions.length;

        const report = {
            totalSessions,
            timeRange: {
                start: Math.min(...this.logs.map(log => log.startTime)),
                end: Math.max(...this.logs.map(log => log.endTime || log.startTime))
            },
            averageResponseTime: completeSessions.reduce((sum, session) => 
                sum + (session.endTime - session.startTime), 0) / totalSessions,
            
            networkIssueFrequency: {
                sessionsWithGaps: this.logs.filter(log => log.suspiciousGaps.length > 0).length,
                averageGapsPerSession: this.logs.reduce((sum, log) => 
                    sum + log.suspiciousGaps.length, 0) / totalSessions,
                totalSuspiciousGaps: this.logs.reduce((sum, log) => 
                    sum + log.suspiciousGaps.length, 0)
            },

            dataTransmission: {
                averageTotalBytes: this.logs.reduce((sum, log) => 
                    sum + log.totalLength, 0) / totalSessions,
                averageChunksPerSession: this.logs.reduce((sum, log) => 
                    sum + log.chunks.length, 0) / totalSessions
            },

            errorRate: {
                sessionsWithErrors: this.logs.filter(log => log.errors.length > 0).length,
                totalErrors: this.logs.reduce((sum, log) => sum + log.errors.length, 0)
            }
        };

        return report;
    }

    /**
     * 导出详细日志用于分析
     */
    exportLogs(format = 'json') {
        const exportData = {
            exportTime: Date.now(),
            config: this.config,
            statistics: this.getStatisticsReport(),
            sessions: this.logs
        };

        if (format === 'csv') {
            return this.convertToCSV(exportData.sessions);
        }

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 转换为CSV格式
     */
    convertToCSV(sessions) {
        const headers = [
            'sessionId', 'startTime', 'endTime', 'totalDuration',
            'totalChunks', 'totalBytes', 'suspiciousGapsCount',
            'averageChunkSize', 'maxGap', 'hasErrors'
        ];

        const rows = sessions.map(session => [
            session.sessionId,
            session.startTime,
            session.endTime || '',
            session.endTime ? session.endTime - session.startTime : '',
            session.chunks.length,
            session.totalLength,
            session.suspiciousGaps.length,
            session.totalLength / session.chunks.length,
            Math.max(...session.chunks.map(c => c.timeSinceLastChunk)),
            session.errors.length > 0
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}

// 使用示例和测试代码
class AIResponseTester {
    constructor() {
        this.monitor = new AIResponseMonitor();
    }

    /**
     * 模拟AI回复流用于测试
     */
    createMockResponseStream(text, options = {}) {
        const {
            chunkSize = 50,
            baseDelay = 100,
            networkIssues = false,
            dataLoss = false
        } = options;

        return new ReadableStream({
            start(controller) {
                let index = 0;
                const chunks = [];
                
                // 将文本分块
                while (index < text.length) {
                    const size = Math.min(chunkSize + Math.random() * 20 - 10, text.length - index);
                    chunks.push(text.slice(index, index + size));
                    index += size;
                }

                let chunkIndex = 0;
                
                const sendNextChunk = () => {
                    if (chunkIndex >= chunks.length) {
                        controller.close();
                        return;
                    }

                    let delay = baseDelay + Math.random() * 50;
                    
                    // 模拟网络问题
                    if (networkIssues && Math.random() < 0.1) {
                        delay += 500 + Math.random() * 1000; // 额外延迟
                    }

                    // 模拟数据丢失
                    if (dataLoss && Math.random() < 0.05) {
                        // 跳过这个数据块
                        chunkIndex++;
                        setTimeout(sendNextChunk, delay);
                        return;
                    }

                    setTimeout(() => {
                        const chunk = chunks[chunkIndex++];
                        controller.enqueue(new TextEncoder().encode(chunk));
                        sendNextChunk();
                    }, delay);
                };

                sendNextChunk();
            }
        });
    }

    /**
     * 运行测试
     */
    async runTest() {
        const testText = "这是一个测试AI回复的长文本。它包含了多个句子和段落，用来模拟真实的AI回复场景。我们需要检测在传输过程中是否会出现字符丢失的情况。网络问题可能导致数据包丢失，从而造成回复内容不完整。通过监控和日志系统，我们可以准确定位问题发生的位置和原因。";

        console.log('开始测试...');

        // 测试正常情况
        console.log('\n=== 测试1: 正常传输 ===');
        const normalStream = this.createMockResponseStream(testText);
        const normalResult = await this.monitor.monitorResponse('test-1', '测试提示', normalStream);
        console.log('分析结果:', normalResult.analysis.statistics);

        // 测试网络问题
        console.log('\n=== 测试2: 网络问题 ===');
        const networkIssueStream = this.createMockResponseStream(testText, { networkIssues: true });
        const networkResult = await this.monitor.monitorResponse('test-2', '测试提示', networkIssueStream);
        console.log('可疑间隔数量:', networkResult.analysis.suspiciousGapsCount);
        console.log('网络问题数量:', networkResult.analysis.networkIssues.length);

        // 测试数据丢失
        console.log('\n=== 测试3: 数据丢失 ===');
        const dataLossStream = this.createMockResponseStream(testText, { dataLoss: true });
        const dataLossResult = await this.monitor.monitorResponse('test-3', '测试提示', dataLossStream);
        console.log('潜在数据丢失:', dataLossResult.analysis.potentialDataLoss.length);

        // 生成统计报告
        console.log('\n=== 统计报告 ===');
        const report = this.monitor.getStatisticsReport();
        console.log(JSON.stringify(report, null, 2));

        // 生成建议
        console.log('\n=== 建议 ===');
        [normalResult, networkResult, dataLossResult].forEach((result, index) => {
            console.log(`测试${index + 1}建议:`, result.recommendations);
        });
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIResponseMonitor, AIResponseTester };
} else {
    window.AIResponseMonitor = AIResponseMonitor;
    window.AIResponseTester = AIResponseTester;
}