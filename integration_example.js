/**
 * 集成示例 - 展示如何使用AI回复监控系统
 * 包含完整的使用流程和最佳实践
 */

// 引入必要的模块
// const AIResponseMonitor = require('./ai_response_monitor.js').AIResponseMonitor;
// const TextIntegrityDetector = require('./text_integrity_detector.js');
// const AIResponseMonitoringSystem = require('./monitoring_system.js');

/**
 * 完整的AI回复监控解决方案
 */
class AIResponseSolution {
    constructor(config = {}) {
        // 初始化各个组件
        this.responseMonitor = new AIResponseMonitor();
        this.integrityDetector = new TextIntegrityDetector();
        this.monitoringSystem = new AIResponseMonitoringSystem({
            alertThresholds: {
                characterLossRate: 0.02, // 2%字符丢失率告警
                semanticGapRate: 0.15,   // 15%语义断层率告警
                networkIssueRate: 0.1,   // 10%网络问题率告警
                confidenceThreshold: 0.7  // 70%置信度阈值
            },
            alertMethods: ['console', 'webhook'],
            webhookUrl: config.webhookUrl,
            autoRepair: true
        });
        
        this.config = {
            enableRealTimeMonitoring: config.enableRealTimeMonitoring || true,
            enableAutoAnalysis: config.enableAutoAnalysis || true,
            enableAlerting: config.enableAlerting || true,
            logLevel: config.logLevel || 'info'
        };
        
        this.sessionCounter = 0;
        this.isInitialized = false;
    }

    /**
     * 初始化系统
     */
    async initialize() {
        try {
            console.log('正在初始化AI回复监控解决方案...');
            
            // 启动监控系统
            if (this.config.enableRealTimeMonitoring) {
                this.monitoringSystem.startMonitoring();
            }
            
            this.isInitialized = true;
            console.log('AI回复监控解决方案初始化完成');
            
        } catch (error) {
            console.error('初始化失败:', error);
            throw error;
        }
    }

    /**
     * 监控AI回复流程
     * @param {string} prompt - 用户输入
     * @param {ReadableStream} responseStream - AI回复流
     * @param {Object} options - 选项
     */
    async monitorAIResponse(prompt, responseStream, options = {}) {
        if (!this.isInitialized) {
            throw new Error('系统未初始化，请先调用 initialize()');
        }
        
        const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
        
        console.log(`开始监控AI回复 [${sessionId}]`);
        
        try {
            // 1. 使用流式监控器监控传输过程
            const monitorResult = await this.responseMonitor.monitorResponse(
                sessionId, 
                prompt, 
                responseStream
            );
            
            // 2. 使用完整性检测器分析文本
            const integrityResult = this.integrityDetector.detectIntegrityIssues(
                monitorResult.session.finalResponse,
                monitorResult.session.chunks
            );
            
            // 3. 合并分析结果
            const combinedResult = this.combineAnalysisResults(
                monitorResult, 
                integrityResult
            );
            
            // 4. 添加到监控系统
            if (this.config.enableRealTimeMonitoring) {
                this.monitoringSystem.addMonitoringSession({
                    sessionId,
                    prompt,
                    startTime: monitorResult.session.startTime,
                    endTime: monitorResult.session.endTime,
                    finalResponse: monitorResult.session.finalResponse,
                    chunks: monitorResult.session.chunks,
                    analysis: combinedResult,
                    networkIssues: monitorResult.analysis.networkIssues,
                    errors: monitorResult.session.errors
                });
            }
            
            // 5. 记录日志
            this.logAnalysisResult(sessionId, combinedResult);
            
            return combinedResult;
            
        } catch (error) {
            console.error(`监控AI回复失败 [${sessionId}]:`, error);
            
            // 记录错误到监控系统
            if (this.config.enableRealTimeMonitoring) {
                this.monitoringSystem.addMonitoringSession({
                    sessionId,
                    prompt,
                    startTime: Date.now(),
                    errors: [{ message: error.message, timestamp: Date.now() }],
                    analysis: { confidence: 0, issues: [] }
                });
            }
            
            throw error;
        }
    }

    /**
     * 合并分析结果
     */
    combineAnalysisResults(monitorResult, integrityResult) {
        const allIssues = [
            ...monitorResult.analysis.potentialDataLoss,
            ...integrityResult.issues
        ];
        
        // 去重和优先级排序
        const uniqueIssues = this.deduplicateIssues(allIssues);
        const sortedIssues = uniqueIssues.sort((a, b) => {
            const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        });
        
        // 计算综合置信度
        const combinedConfidence = Math.min(
            monitorResult.analysis.streamingPattern.isConsistent ? 1 : 0.8,
            integrityResult.confidence
        );
        
        // 合并建议
        const combinedRecommendations = [
            ...monitorResult.recommendations,
            ...integrityResult.recommendations
        ];
        
        return {
            sessionId: monitorResult.session.sessionId,
            timestamp: Date.now(),
            confidence: combinedConfidence,
            issues: sortedIssues,
            statistics: {
                ...monitorResult.analysis.statistics,
                ...integrityResult.statistics
            },
            networkAnalysis: monitorResult.analysis,
            textAnalysis: integrityResult,
            recommendations: this.deduplicateRecommendations(combinedRecommendations),
            summary: this.generateAnalysisSummary(sortedIssues, combinedConfidence)
        };
    }

    /**
     * 去重问题
     */
    deduplicateIssues(issues) {
        const seen = new Set();
        return issues.filter(issue => {
            const key = `${issue.type}_${issue.position || 0}_${issue.description}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 去重建议
     */
    deduplicateRecommendations(recommendations) {
        const seen = new Set();
        return recommendations.filter(rec => {
            const key = rec.type || rec.category || rec.description;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 生成分析摘要
     */
    generateAnalysisSummary(issues, confidence) {
        const criticalIssues = issues.filter(i => i.severity === 'critical').length;
        const highIssues = issues.filter(i => i.severity === 'high').length;
        const mediumIssues = issues.filter(i => i.severity === 'medium').length;
        const lowIssues = issues.filter(i => i.severity === 'low').length;
        
        let status = 'healthy';
        let description = '回复质量良好，未发现明显问题';
        
        if (criticalIssues > 0) {
            status = 'critical';
            description = `发现${criticalIssues}个严重问题，需要立即处理`;
        } else if (highIssues > 0) {
            status = 'warning';
            description = `发现${highIssues}个高优先级问题，建议尽快处理`;
        } else if (mediumIssues > 0) {
            status = 'attention';
            description = `发现${mediumIssues}个中等问题，建议关注`;
        } else if (lowIssues > 0) {
            status = 'minor';
            description = `发现${lowIssues}个轻微问题，可选择性处理`;
        }
        
        return {
            status,
            description,
            confidence: confidence,
            issueCount: {
                critical: criticalIssues,
                high: highIssues,
                medium: mediumIssues,
                low: lowIssues,
                total: issues.length
            }
        };
    }

    /**
     * 记录分析日志
     */
    logAnalysisResult(sessionId, result) {
        const logLevel = this.config.logLevel;
        const summary = result.summary;
        
        const logMessage = `[${sessionId}] 状态: ${summary.status}, 置信度: ${(summary.confidence * 100).toFixed(1)}%, 问题: ${summary.issueCount.total}个`;
        
        switch (summary.status) {
            case 'critical':
                if (['error', 'warn', 'info', 'debug'].includes(logLevel)) {
                    console.error(logMessage);
                }
                break;
            case 'warning':
                if (['warn', 'info', 'debug'].includes(logLevel)) {
                    console.warn(logMessage);
                }
                break;
            default:
                if (['info', 'debug'].includes(logLevel)) {
                    console.log(logMessage);
                }
        }
        
        // 详细日志
        if (logLevel === 'debug' && result.issues.length > 0) {
            console.log('详细问题列表:');
            result.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. [${issue.severity}] ${issue.description}`);
            });
        }
    }

    /**
     * 批量分析历史数据
     */
    async analyzeHistoricalData(dataArray) {
        console.log(`开始批量分析 ${dataArray.length} 条历史数据...`);
        
        const results = [];
        const batchSize = 10; // 每批处理10条
        
        for (let i = 0; i < dataArray.length; i += batchSize) {
            const batch = dataArray.slice(i, i + batchSize);
            const batchPromises = batch.map(async (data, index) => {
                try {
                    // 模拟流式数据
                    const mockStream = this.createMockStream(data.response);
                    return await this.monitorAIResponse(data.prompt, mockStream, {
                        sessionId: `historical_${i + index}`
                    });
                } catch (error) {
                    console.error(`批量分析第 ${i + index + 1} 条数据失败:`, error);
                    return null;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(r => r !== null));
            
            // 避免过载
            if (i + batchSize < dataArray.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`批量分析完成，成功分析 ${results.length} 条数据`);
        return results;
    }

    /**
     * 创建模拟流（用于测试）
     */
    createMockStream(text) {
        return new ReadableStream({
            start(controller) {
                const chunks = text.match(/.{1,50}/g) || [text];
                let index = 0;
                
                const sendChunk = () => {
                    if (index >= chunks.length) {
                        controller.close();
                        return;
                    }
                    
                    controller.enqueue(new TextEncoder().encode(chunks[index++]));
                    setTimeout(sendChunk, 50 + Math.random() * 100);
                };
                
                sendChunk();
            }
        });
    }

    /**
     * 获取监控状态
     */
    getMonitoringStatus() {
        return {
            isInitialized: this.isInitialized,
            sessionCount: this.sessionCounter,
            monitoringSystem: this.monitoringSystem.getMonitoringStatus(),
            detectorStats: this.integrityDetector.getDetectionStatistics()
        };
    }

    /**
     * 生成监控报告
     */
    generateMonitoringReport(timeWindow) {
        const systemReport = this.monitoringSystem.generateDetailedReport(timeWindow);
        const detectorStats = this.integrityDetector.getDetectionStatistics();
        
        return {
            generatedAt: Date.now(),
            timeWindow: timeWindow,
            systemReport: systemReport,
            detectorStats: detectorStats,
            overallHealth: this.calculateOverallHealth(systemReport, detectorStats)
        };
    }

    /**
     * 计算整体健康度
     */
    calculateOverallHealth(systemReport, detectorStats) {
        const avgConfidence = systemReport.summary.averageConfidence || 1;
        const alertCount = systemReport.summary.totalAlerts || 0;
        const sessionCount = systemReport.summary.totalSessions || 1;
        
        const alertRate = alertCount / sessionCount;
        let healthScore = avgConfidence * 100;
        
        // 根据告警率调整健康分数
        if (alertRate > 0.1) healthScore -= 20;
        else if (alertRate > 0.05) healthScore -= 10;
        
        let healthLevel = 'excellent';
        if (healthScore < 60) healthLevel = 'poor';
        else if (healthScore < 75) healthLevel = 'fair';
        else if (healthScore < 90) healthLevel = 'good';
        
        return {
            score: Math.max(0, Math.min(100, healthScore)),
            level: healthLevel,
            avgConfidence: avgConfidence,
            alertRate: alertRate
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        console.log('正在清理监控系统资源...');
        
        if (this.monitoringSystem.isMonitoring) {
            this.monitoringSystem.stopMonitoring();
        }
        
        this.isInitialized = false;
        console.log('资源清理完成');
    }
}

/**
 * 使用示例
 */
async function demonstrateUsage() {
    console.log('=== AI回复监控系统使用示例 ===\n');
    
    // 1. 初始化系统
    const solution = new AIResponseSolution({
        enableRealTimeMonitoring: true,
        enableAutoAnalysis: true,
        webhookUrl: 'https://example.com/webhook',
        logLevel: 'info'
    });
    
    await solution.initialize();
    
    // 2. 模拟AI回复监控
    const testCases = [
        {
            prompt: '请介绍一下人工智能的发展历史',
            response: '人工智能的发展可以追溯到20世纪50年代。当时计算机科学家开始探索让机器模拟人类智能的可能性。经过几十年的发展，AI技术在各个领域都取得了突破性进展。'
        },
        {
            prompt: '什么是机器学习？',
            response: '机器学习是人工智能的一个重要分支，它让计算机能够从数据中自动学习和改进，而无需明确编程。通过算法和统计模型，机器可以识别模式并做出预测。' // 故意模拟一些问题
        }
    ];
    
    console.log('开始监控AI回复...\n');
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`测试案例 ${i + 1}:`);
        console.log(`提示: ${testCase.prompt}`);
        
        try {
            // 创建模拟流
            const mockStream = solution.createMockStream(testCase.response);
            
            // 监控回复
            const result = await solution.monitorAIResponse(testCase.prompt, mockStream);
            
            console.log(`分析结果: ${result.summary.description}`);
            console.log(`置信度: ${(result.confidence * 100).toFixed(1)}%`);
            
            if (result.issues.length > 0) {
                console.log('发现的问题:');
                result.issues.slice(0, 3).forEach((issue, index) => {
                    console.log(`  ${index + 1}. [${issue.severity}] ${issue.description}`);
                });
            }
            
            console.log('---\n');
            
        } catch (error) {
            console.error(`测试案例 ${i + 1} 失败:`, error.message);
        }
    }
    
    // 3. 生成监控报告
    console.log('生成监控报告...');
    const report = solution.generateMonitoringReport(60 * 60 * 1000); // 1小时
    console.log(`整体健康度: ${report.overallHealth.score.toFixed(1)}分 (${report.overallHealth.level})`);
    console.log(`平均置信度: ${(report.overallHealth.avgConfidence * 100).toFixed(1)}%`);
    console.log(`告警率: ${(report.overallHealth.alertRate * 100).toFixed(2)}%`);
    
    // 4. 清理资源
    solution.cleanup();
    
    console.log('\n=== 演示完成 ===');
}

/**
 * 快速集成指南
 */
function showIntegrationGuide() {
    console.log(`
=== AI回复监控系统集成指南 ===

1. 基础集成:
   const solution = new AIResponseSolution();
   await solution.initialize();

2. 监控AI回复:
   const result = await solution.monitorAIResponse(prompt, responseStream);

3. 配置告警:
   const solution = new AIResponseSolution({
     alertThresholds: {
       characterLossRate: 0.02,  // 2%字符丢失率
       confidenceThreshold: 0.7  // 70%置信度
     },
     alertMethods: ['console', 'webhook'],
     webhookUrl: 'your-webhook-url'
   });

4. 获取监控状态:
   const status = solution.getMonitoringStatus();

5. 生成报告:
   const report = solution.generateMonitoringReport();

6. 批量分析历史数据:
   const results = await solution.analyzeHistoricalData(dataArray);

7. 清理资源:
   solution.cleanup();

=== 最佳实践 ===

1. 网络优化:
   - 使用稳定的网络连接
   - 考虑使用CDN或更近的服务器
   - 实现重试机制

2. 监控配置:
   - 根据业务需求调整阈值
   - 设置合适的告警渠道
   - 定期检查监控状态

3. 数据管理:
   - 定期备份监控数据
   - 清理过期数据节省存储
   - 导出报告用于分析

4. 问题处理:
   - 及时响应高优先级告警
   - 分析问题模式寻找根本原因
   - 实施预防措施

更多详细信息请查看代码注释和文档。
`);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AIResponseSolution,
        demonstrateUsage,
        showIntegrationGuide
    };
} else {
    window.AIResponseSolution = AIResponseSolution;
    window.demonstrateUsage = demonstrateUsage;
    window.showIntegrationGuide = showIntegrationGuide;
}

// 如果直接运行此文件，执行演示
if (typeof require !== 'undefined' && require.main === module) {
    demonstrateUsage().catch(console.error);
}