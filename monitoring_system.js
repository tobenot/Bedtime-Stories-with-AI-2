/**
 * AI回复监控和告警系统
 * 实时监控AI回复质量，自动检测问题并发送告警
 */

class AIResponseMonitoringSystem {
    constructor(config = {}) {
        this.config = {
            // 监控配置
            monitoringInterval: config.monitoringInterval || 5000, // 5秒检查一次
            alertThresholds: {
                characterLossRate: config.characterLossRate || 0.02, // 2%字符丢失率
                semanticGapRate: config.semanticGapRate || 0.15, // 15%语义断层率
                networkIssueRate: config.networkIssueRate || 0.1, // 10%网络问题率
                confidenceThreshold: config.confidenceThreshold || 0.7, // 70%置信度阈值
                responseTimeThreshold: config.responseTimeThreshold || 30000 // 30秒响应时间阈值
            },
            
            // 告警配置
            alertMethods: config.alertMethods || ['console', 'email', 'webhook'],
            alertCooldown: config.alertCooldown || 300000, // 5分钟冷却时间
            emailConfig: config.emailConfig || null,
            webhookUrl: config.webhookUrl || null,
            
            // 数据保存配置
            dataRetention: config.dataRetention || 7 * 24 * 60 * 60 * 1000, // 7天
            backupInterval: config.backupInterval || 60 * 60 * 1000, // 1小时备份一次
            
            // 自动修复配置
            autoRepair: config.autoRepair || false,
            repairStrategies: config.repairStrategies || ['retry', 'fallback']
        };
        
        this.monitoringData = {
            sessions: [],
            alerts: [],
            statistics: {
                totalSessions: 0,
                totalIssues: 0,
                averageConfidence: 1.0,
                networkIssues: 0,
                lastUpdate: Date.now()
            }
        };
        
        this.alertHistory = new Map(); // 用于防止重复告警
        this.isMonitoring = false;
        this.monitoringTimer = null;
        
        // 初始化组件
        this.initializeComponents();
    }

    /**
     * 初始化监控系统
     */
    initializeComponents() {
        console.log('AI Response Monitoring System initialized');
        
        // 加载历史数据
        this.loadHistoricalData();
        
        // 设置定期备份
        setInterval(() => {
            this.backupData();
        }, this.config.backupInterval);
        
        // 设置数据清理
        setInterval(() => {
            this.cleanupOldData();
        }, 24 * 60 * 60 * 1000); // 每天清理一次
    }

    /**
     * 开始监控
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('监控已在运行中');
            return;
        }
        
        this.isMonitoring = true;
        console.log('开始AI回复监控...');
        
        this.monitoringTimer = setInterval(() => {
            this.performMonitoringCheck();
        }, this.config.monitoringInterval);
        
        // 发送监控启动通知
        this.sendAlert({
            type: 'system',
            severity: 'info',
            message: 'AI回复监控系统已启动',
            timestamp: Date.now()
        });
    }

    /**
     * 停止监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('监控未在运行');
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        console.log('AI回复监控已停止');
        
        // 发送监控停止通知
        this.sendAlert({
            type: 'system',
            severity: 'warning',
            message: 'AI回复监控系统已停止',
            timestamp: Date.now()
        });
    }

    /**
     * 执行监控检查
     */
    performMonitoringCheck() {
        try {
            // 计算最新统计数据
            this.updateStatistics();
            
            // 检查各种阈值
            this.checkThresholds();
            
            // 检查系统健康状态
            this.checkSystemHealth();
            
            // 更新最后检查时间
            this.monitoringData.statistics.lastUpdate = Date.now();
            
        } catch (error) {
            console.error('监控检查过程中发生错误:', error);
            this.sendAlert({
                type: 'system',
                severity: 'error',
                message: `监控检查失败: ${error.message}`,
                timestamp: Date.now(),
                error: error
            });
        }
    }

    /**
     * 更新统计数据
     */
    updateStatistics() {
        const recentSessions = this.getRecentSessions(60 * 60 * 1000); // 最近1小时
        
        if (recentSessions.length === 0) {
            return;
        }
        
        const stats = this.monitoringData.statistics;
        
        // 基本统计
        stats.totalSessions = this.monitoringData.sessions.length;
        stats.totalIssues = recentSessions.reduce((sum, session) => 
            sum + (session.analysis?.issues?.length || 0), 0);
        
        // 平均置信度
        const confidenceSum = recentSessions.reduce((sum, session) => 
            sum + (session.analysis?.confidence || 1), 0);
        stats.averageConfidence = confidenceSum / recentSessions.length;
        
        // 网络问题统计
        stats.networkIssues = recentSessions.reduce((sum, session) => 
            sum + (session.networkIssues?.length || 0), 0);
        
        // 问题类型分布
        stats.issueTypeDistribution = this.calculateIssueTypeDistribution(recentSessions);
        
        // 响应时间统计
        stats.responseTimeStats = this.calculateResponseTimeStats(recentSessions);
    }

    /**
     * 检查阈值
     */
    checkThresholds() {
        const recentSessions = this.getRecentSessions(60 * 60 * 1000);
        if (recentSessions.length === 0) return;
        
        const stats = this.monitoringData.statistics;
        const thresholds = this.config.alertThresholds;
        
        // 检查字符丢失率
        const characterLossRate = this.calculateCharacterLossRate(recentSessions);
        if (characterLossRate > thresholds.characterLossRate) {
            this.sendAlert({
                type: 'character_loss',
                severity: 'high',
                message: `字符丢失率过高: ${(characterLossRate * 100).toFixed(2)}%`,
                threshold: thresholds.characterLossRate,
                currentValue: characterLossRate,
                timestamp: Date.now()
            });
        }
        
        // 检查语义断层率
        const semanticGapRate = this.calculateSemanticGapRate(recentSessions);
        if (semanticGapRate > thresholds.semanticGapRate) {
            this.sendAlert({
                type: 'semantic_gap',
                severity: 'medium',
                message: `语义断层率过高: ${(semanticGapRate * 100).toFixed(2)}%`,
                threshold: thresholds.semanticGapRate,
                currentValue: semanticGapRate,
                timestamp: Date.now()
            });
        }
        
        // 检查网络问题率
        const networkIssueRate = this.calculateNetworkIssueRate(recentSessions);
        if (networkIssueRate > thresholds.networkIssueRate) {
            this.sendAlert({
                type: 'network_issue',
                severity: 'high',
                message: `网络问题率过高: ${(networkIssueRate * 100).toFixed(2)}%`,
                threshold: thresholds.networkIssueRate,
                currentValue: networkIssueRate,
                timestamp: Date.now()
            });
        }
        
        // 检查置信度
        if (stats.averageConfidence < thresholds.confidenceThreshold) {
            this.sendAlert({
                type: 'low_confidence',
                severity: 'medium',
                message: `平均置信度过低: ${(stats.averageConfidence * 100).toFixed(1)}%`,
                threshold: thresholds.confidenceThreshold,
                currentValue: stats.averageConfidence,
                timestamp: Date.now()
            });
        }
        
        // 检查响应时间
        const avgResponseTime = stats.responseTimeStats?.average || 0;
        if (avgResponseTime > thresholds.responseTimeThreshold) {
            this.sendAlert({
                type: 'slow_response',
                severity: 'medium',
                message: `平均响应时间过长: ${(avgResponseTime / 1000).toFixed(1)}秒`,
                threshold: thresholds.responseTimeThreshold,
                currentValue: avgResponseTime,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 检查系统健康状态
     */
    checkSystemHealth() {
        const now = Date.now();
        const recentSessions = this.getRecentSessions(10 * 60 * 1000); // 最近10分钟
        
        // 检查是否有新的会话
        if (recentSessions.length === 0) {
            this.sendAlert({
                type: 'no_activity',
                severity: 'warning',
                message: '最近10分钟内没有AI回复活动',
                timestamp: now
            });
        }
        
        // 检查错误率
        const errorSessions = recentSessions.filter(session => 
            session.errors && session.errors.length > 0);
        const errorRate = errorSessions.length / recentSessions.length;
        
        if (errorRate > 0.1) { // 10%错误率
            this.sendAlert({
                type: 'high_error_rate',
                severity: 'high',
                message: `错误率过高: ${(errorRate * 100).toFixed(1)}%`,
                timestamp: now
            });
        }
        
        // 检查内存使用
        if (this.monitoringData.sessions.length > 10000) {
            this.sendAlert({
                type: 'memory_usage',
                severity: 'warning',
                message: '监控数据占用内存过多，建议清理历史数据',
                timestamp: now
            });
        }
    }

    /**
     * 发送告警
     */
    async sendAlert(alert) {
        // 检查冷却时间
        const alertKey = `${alert.type}_${alert.severity}`;
        const lastAlert = this.alertHistory.get(alertKey);
        
        if (lastAlert && (Date.now() - lastAlert) < this.config.alertCooldown) {
            return; // 在冷却时间内，不重复发送
        }
        
        // 记录告警
        this.monitoringData.alerts.push(alert);
        this.alertHistory.set(alertKey, Date.now());
        
        // 发送到各个渠道
        const methods = this.config.alertMethods;
        
        if (methods.includes('console')) {
            this.sendConsoleAlert(alert);
        }
        
        if (methods.includes('email') && this.config.emailConfig) {
            await this.sendEmailAlert(alert);
        }
        
        if (methods.includes('webhook') && this.config.webhookUrl) {
            await this.sendWebhookAlert(alert);
        }
        
        // 触发自动修复
        if (this.config.autoRepair && alert.severity === 'high') {
            this.attemptAutoRepair(alert);
        }
    }

    /**
     * 控制台告警
     */
    sendConsoleAlert(alert) {
        const timestamp = new Date(alert.timestamp).toLocaleString();
        const message = `[${timestamp}] ${alert.severity.toUpperCase()}: ${alert.message}`;
        
        switch (alert.severity) {
            case 'error':
            case 'high':
                console.error(message);
                break;
            case 'warning':
            case 'medium':
                console.warn(message);
                break;
            default:
                console.log(message);
        }
    }

    /**
     * 邮件告警
     */
    async sendEmailAlert(alert) {
        try {
            // 这里应该集成实际的邮件服务
            console.log('发送邮件告警:', alert);
            
            // 示例邮件内容
            const emailContent = {
                to: this.config.emailConfig.recipients,
                subject: `AI回复监控告警 - ${alert.severity}`,
                body: `
                    告警时间: ${new Date(alert.timestamp).toLocaleString()}
                    告警类型: ${alert.type}
                    严重程度: ${alert.severity}
                    告警信息: ${alert.message}
                    
                    ${alert.threshold ? `阈值: ${alert.threshold}` : ''}
                    ${alert.currentValue ? `当前值: ${alert.currentValue}` : ''}
                `
            };
            
            // 实际发送邮件的代码应该在这里
            // await emailService.send(emailContent);
            
        } catch (error) {
            console.error('发送邮件告警失败:', error);
        }
    }

    /**
     * Webhook告警
     */
    async sendWebhookAlert(alert) {
        try {
            const payload = {
                timestamp: alert.timestamp,
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                threshold: alert.threshold,
                currentValue: alert.currentValue,
                system: 'AI Response Monitor'
            };
            
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Webhook请求失败: ${response.status}`);
            }
            
        } catch (error) {
            console.error('发送Webhook告警失败:', error);
        }
    }

    /**
     * 尝试自动修复
     */
    attemptAutoRepair(alert) {
        console.log('尝试自动修复:', alert.type);
        
        const strategies = this.config.repairStrategies;
        
        switch (alert.type) {
            case 'network_issue':
                if (strategies.includes('retry')) {
                    console.log('执行网络重试策略');
                    // 实现网络重试逻辑
                }
                break;
                
            case 'character_loss':
                if (strategies.includes('fallback')) {
                    console.log('执行字符丢失回退策略');
                    // 实现回退策略
                }
                break;
                
            default:
                console.log('暂无自动修复策略');
        }
    }

    /**
     * 添加监控会话
     */
    addMonitoringSession(sessionData) {
        // 添加时间戳
        sessionData.addedAt = Date.now();
        
        // 存储会话数据
        this.monitoringData.sessions.push(sessionData);
        
        // 立即分析会话
        this.analyzeSession(sessionData);
        
        // 限制内存使用
        if (this.monitoringData.sessions.length > 10000) {
            this.monitoringData.sessions = this.monitoringData.sessions.slice(-5000);
        }
    }

    /**
     * 分析会话数据
     */
    analyzeSession(sessionData) {
        // 检查是否有严重问题
        const issues = sessionData.analysis?.issues || [];
        const criticalIssues = issues.filter(issue => issue.severity === 'critical');
        
        if (criticalIssues.length > 0) {
            this.sendAlert({
                type: 'critical_issue',
                severity: 'critical',
                message: `检测到严重问题: ${criticalIssues.map(i => i.description).join(', ')}`,
                sessionId: sessionData.sessionId,
                timestamp: Date.now()
            });
        }
        
        // 检查置信度
        if (sessionData.analysis?.confidence < 0.5) {
            this.sendAlert({
                type: 'very_low_confidence',
                severity: 'high',
                message: `会话置信度极低: ${(sessionData.analysis.confidence * 100).toFixed(1)}%`,
                sessionId: sessionData.sessionId,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取最近的会话
     */
    getRecentSessions(timeWindow) {
        const cutoff = Date.now() - timeWindow;
        return this.monitoringData.sessions.filter(session => 
            session.addedAt > cutoff);
    }

    /**
     * 计算字符丢失率
     */
    calculateCharacterLossRate(sessions) {
        if (sessions.length === 0) return 0;
        
        const sessionsWithLoss = sessions.filter(session => {
            const issues = session.analysis?.issues || [];
            return issues.some(issue => issue.type === 'possible_character_loss');
        });
        
        return sessionsWithLoss.length / sessions.length;
    }

    /**
     * 计算语义断层率
     */
    calculateSemanticGapRate(sessions) {
        if (sessions.length === 0) return 0;
        
        const sessionsWithGaps = sessions.filter(session => {
            const issues = session.analysis?.issues || [];
            return issues.some(issue => issue.type === 'semantic_gap');
        });
        
        return sessionsWithGaps.length / sessions.length;
    }

    /**
     * 计算网络问题率
     */
    calculateNetworkIssueRate(sessions) {
        if (sessions.length === 0) return 0;
        
        const sessionsWithNetworkIssues = sessions.filter(session => 
            session.networkIssues && session.networkIssues.length > 0);
        
        return sessionsWithNetworkIssues.length / sessions.length;
    }

    /**
     * 计算问题类型分布
     */
    calculateIssueTypeDistribution(sessions) {
        const distribution = {};
        
        sessions.forEach(session => {
            const issues = session.analysis?.issues || [];
            issues.forEach(issue => {
                distribution[issue.type] = (distribution[issue.type] || 0) + 1;
            });
        });
        
        return distribution;
    }

    /**
     * 计算响应时间统计
     */
    calculateResponseTimeStats(sessions) {
        const responseTimes = sessions
            .filter(session => session.endTime && session.startTime)
            .map(session => session.endTime - session.startTime);
        
        if (responseTimes.length === 0) return null;
        
        const sorted = responseTimes.sort((a, b) => a - b);
        
        return {
            average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.floor(sorted.length * 0.95)]
        };
    }

    /**
     * 备份数据
     */
    backupData() {
        try {
            const backup = {
                timestamp: Date.now(),
                data: this.monitoringData
            };
            
            // 在实际应用中，这里应该保存到持久化存储
            console.log('数据备份完成:', backup.timestamp);
            
        } catch (error) {
            console.error('数据备份失败:', error);
        }
    }

    /**
     * 加载历史数据
     */
    loadHistoricalData() {
        try {
            // 在实际应用中，这里应该从持久化存储加载数据
            console.log('加载历史数据...');
            
        } catch (error) {
            console.error('加载历史数据失败:', error);
        }
    }

    /**
     * 清理旧数据
     */
    cleanupOldData() {
        const cutoff = Date.now() - this.config.dataRetention;
        
        // 清理旧会话
        const originalSessionCount = this.monitoringData.sessions.length;
        this.monitoringData.sessions = this.monitoringData.sessions.filter(
            session => session.addedAt > cutoff
        );
        
        // 清理旧告警
        const originalAlertCount = this.monitoringData.alerts.length;
        this.monitoringData.alerts = this.monitoringData.alerts.filter(
            alert => alert.timestamp > cutoff
        );
        
        const cleanedSessions = originalSessionCount - this.monitoringData.sessions.length;
        const cleanedAlerts = originalAlertCount - this.monitoringData.alerts.length;
        
        if (cleanedSessions > 0 || cleanedAlerts > 0) {
            console.log(`数据清理完成: 删除了 ${cleanedSessions} 个会话, ${cleanedAlerts} 个告警`);
        }
    }

    /**
     * 获取监控状态
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            lastUpdate: this.monitoringData.statistics.lastUpdate,
            statistics: this.monitoringData.statistics,
            recentAlerts: this.monitoringData.alerts.slice(-10),
            config: this.config
        };
    }

    /**
     * 获取详细报告
     */
    generateDetailedReport(timeWindow = 24 * 60 * 60 * 1000) { // 默认24小时
        const recentSessions = this.getRecentSessions(timeWindow);
        const recentAlerts = this.monitoringData.alerts.filter(
            alert => alert.timestamp > Date.now() - timeWindow
        );
        
        return {
            timeWindow: timeWindow,
            generatedAt: Date.now(),
            summary: {
                totalSessions: recentSessions.length,
                totalAlerts: recentAlerts.length,
                averageConfidence: this.monitoringData.statistics.averageConfidence,
                issueTypeDistribution: this.calculateIssueTypeDistribution(recentSessions),
                responseTimeStats: this.calculateResponseTimeStats(recentSessions)
            },
            sessions: recentSessions,
            alerts: recentAlerts,
            recommendations: this.generateRecommendations(recentSessions, recentAlerts)
        };
    }

    /**
     * 生成建议
     */
    generateRecommendations(sessions, alerts) {
        const recommendations = [];
        
        // 基于告警生成建议
        const alertTypes = [...new Set(alerts.map(alert => alert.type))];
        
        if (alertTypes.includes('character_loss')) {
            recommendations.push({
                priority: 'high',
                category: 'network',
                title: '优化网络传输',
                description: '检测到字符丢失问题，建议检查网络连接稳定性',
                actions: [
                    '检查网络连接质量',
                    '考虑使用更可靠的传输协议',
                    '实现数据完整性校验',
                    '添加重传机制'
                ]
            });
        }
        
        if (alertTypes.includes('slow_response')) {
            recommendations.push({
                priority: 'medium',
                category: 'performance',
                title: '提升响应速度',
                description: '检测到响应时间过长，建议优化性能',
                actions: [
                    '检查服务器性能',
                    '优化AI模型推理速度',
                    '考虑使用CDN加速',
                    '实现响应缓存机制'
                ]
            });
        }
        
        return recommendations;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIResponseMonitoringSystem;
} else {
    window.AIResponseMonitoringSystem = AIResponseMonitoringSystem;
}