/**
 * 快速集成脚本 - 一键集成增强版设置系统
 * Quick Integration Script - One-click integration of enhanced settings system
 * 
 * 使用方法：
 * 1. 在主HTML文件中引入此脚本
 * 2. 调用 QuickIntegration.integrate() 即可自动集成
 * 3. 无需修改现有代码，完全向后兼容
 */

var QuickIntegration = {
    // 集成状态
    integrated: false,
    
    // 集成配置
    config: {
        autoInit: true,           // 自动初始化
        enableBackup: true,       // 启用备份功能
        enablePersistence: true,  // 启用持久化
        enableMonitoring: true,   // 启用监控
        logLevel: 'info'         // 日志级别: 'debug', 'info', 'warn', 'error'
    },
    
    /**
     * 一键集成增强版设置系统
     * 功能：快速集成-主入口-01
     * @param {Object} options - 集成选项
     * @param {Function} callback - 集成完成回调
     */
    integrate: function(options, callback) {
        var self = this;
        
        // 处理参数
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        // 合并配置
        if (options) {
            for (var key in options) {
                if (self.config.hasOwnProperty(key)) {
                    self.config[key] = options[key];
                }
            }
        }
        
        self.log('开始一键集成增强版设置系统...', 'info');
        
        if (self.integrated) {
            self.log('系统已经集成过了', 'warn');
            if (callback) callback(null, true);
            return;
        }
        
        // 检查依赖
        self.checkDependencies(function(depError, depResult) {
            if (depError) {
                self.log('依赖检查失败: ' + depError, 'error');
                if (callback) callback(depError);
                return;
            }
            
            self.log('依赖检查完成: ' + JSON.stringify(depResult), 'debug');
            
            // 执行集成步骤
            self.executeIntegrationSteps(function(integrationError, result) {
                if (integrationError) {
                    self.log('集成失败: ' + integrationError, 'error');
                    if (callback) callback(integrationError);
                } else {
                    self.integrated = true;
                    self.log('增强版设置系统集成完成！', 'info');
                    if (callback) callback(null, result);
                }
            });
        });
    },
    
    /**
     * 检查依赖组件
     * 功能：快速集成-依赖检查-01
     * @param {Function} callback - 检查完成回调
     */
    checkDependencies: function(callback) {
        var self = this;
        var dependencies = {
            required: {
                LocalDataManager: typeof LocalDataManager !== 'undefined',
                SettingsManager: typeof SettingsManager !== 'undefined'
            },
            optional: {
                SettingsPersistence: typeof SettingsPersistence !== 'undefined',
                SettingsEnhanced: typeof SettingsEnhanced !== 'undefined',
                SettingsBackup: typeof SettingsBackup !== 'undefined',
                SettingsIntegration: typeof SettingsIntegration !== 'undefined'
            }
        };
        
        // 检查必需依赖
        var missingRequired = [];
        for (var dep in dependencies.required) {
            if (!dependencies.required[dep]) {
                missingRequired.push(dep);
            }
        }
        
        if (missingRequired.length > 0) {
            var error = '缺少必需依赖: ' + missingRequired.join(', ');
            if (callback) callback(error);
            return;
        }
        
        // 检查可选依赖
        var availableOptional = [];
        for (var optDep in dependencies.optional) {
            if (dependencies.optional[optDep]) {
                availableOptional.push(optDep);
            }
        }
        
        self.log('可用的增强组件: ' + availableOptional.join(', '), 'info');
        
        if (callback) callback(null, {
            required: dependencies.required,
            optional: dependencies.optional,
            availableCount: availableOptional.length
        });
    },
    
    /**
     * 执行集成步骤
     * 功能：快速集成-执行步骤-01
     * @param {Function} callback - 执行完成回调
     */
    executeIntegrationSteps: function(callback) {
        var self = this;
        var steps = [];
        var results = {};
        
        // 定义集成步骤
        if (self.config.enablePersistence && typeof SettingsIntegration !== 'undefined') {
            steps.push({
                name: 'initIntegration',
                description: '初始化设置系统集成',
                execute: function(stepCallback) {
                    SettingsIntegration.init(stepCallback);
                }
            });
        } else {
            // 回退方案：直接初始化各个组件
            if (typeof SettingsPersistence !== 'undefined') {
                steps.push({
                    name: 'initPersistence',
                    description: '初始化持久化管理器',
                    execute: function(stepCallback) {
                        SettingsPersistence.init(stepCallback);
                    }
                });
            }
            
            if (typeof SettingsEnhanced !== 'undefined') {
                steps.push({
                    name: 'initEnhanced',
                    description: '初始化增强设置管理器',
                    execute: function(stepCallback) {
                        SettingsEnhanced.init(stepCallback);
                    }
                });
            }
            
            if (self.config.enableBackup && typeof SettingsBackup !== 'undefined') {
                steps.push({
                    name: 'initBackup',
                    description: '初始化备份管理器',
                    execute: function(stepCallback) {
                        SettingsBackup.init(stepCallback);
                    }
                });
            }
        }
        
        // 添加后处理步骤
        steps.push({
            name: 'setupGlobalInterface',
            description: '设置全局接口',
            execute: function(stepCallback) {
                self.setupGlobalInterface(stepCallback);
            }
        });
        
        if (self.config.enableMonitoring) {
            steps.push({
                name: 'setupMonitoring',
                description: '设置监控',
                execute: function(stepCallback) {
                    self.setupMonitoring(stepCallback);
                }
            });
        }
        
        // 执行步骤
        self.executeStepsSequentially(steps, 0, results, callback);
    },
    
    /**
     * 顺序执行步骤
     * 功能：快速集成-顺序执行-01
     * @param {Array} steps - 步骤列表
     * @param {number} index - 当前步骤索引
     * @param {Object} results - 结果对象
     * @param {Function} callback - 完成回调
     */
    executeStepsSequentially: function(steps, index, results, callback) {
        var self = this;
        
        if (index >= steps.length) {
            // 所有步骤完成
            if (callback) callback(null, results);
            return;
        }
        
        var step = steps[index];
        self.log('执行步骤: ' + step.description, 'info');
        
        try {
            step.execute(function(error, result) {
                results[step.name] = {
                    success: !error,
                    error: error,
                    result: result
                };
                
                if (error) {
                    self.log('步骤失败: ' + step.description + ' - ' + error, 'warn');
                } else {
                    self.log('步骤完成: ' + step.description, 'debug');
                }
                
                // 继续下一步（即使当前步骤失败）
                self.executeStepsSequentially(steps, index + 1, results, callback);
            });
        } catch (e) {
            self.log('步骤异常: ' + step.description + ' - ' + e.message, 'error');
            results[step.name] = {
                success: false,
                error: e.message,
                result: null
            };
            
            // 继续下一步
            self.executeStepsSequentially(steps, index + 1, results, callback);
        }
    },
    
    /**
     * 设置全局接口
     * 功能：快速集成-全局接口-01
     * @param {Function} callback - 设置完成回调
     */
    setupGlobalInterface: function(callback) {
        var self = this;
        
        try {
            // 创建简化的全局接口
            if (typeof window !== 'undefined') {
                window.MoguSettingsQuick = {
                    // 获取设置
                    get: function(path, defaultValue) {
                        if (typeof MoguSettings !== 'undefined') {
                            return MoguSettings.get(path, defaultValue);
                        } else if (typeof SettingsEnhanced !== 'undefined') {
                            return SettingsEnhanced.getSetting(path, defaultValue);
                        } else if (typeof SettingsManager !== 'undefined') {
                            return SettingsManager.getSetting(path, defaultValue);
                        }
                        return defaultValue;
                    },
                    
                    // 设置值
                    set: function(path, value, callback) {
                        if (typeof MoguSettings !== 'undefined') {
                            return MoguSettings.set(path, value, callback);
                        } else if (typeof SettingsEnhanced !== 'undefined') {
                            return SettingsEnhanced.setSetting(path, value, callback);
                        } else if (typeof SettingsManager !== 'undefined') {
                            return SettingsManager.setSetting(path, value, callback);
                        } else if (callback) {
                            callback('无可用的设置管理器');
                        }
                    },
                    
                    // 获取关键设置（专门解决您的问题）
                    getCriticalSettings: function() {
                        return {
                            enableSubfolders: this.get('scriptPath.enableSubfolders', true),
                            imageSavePath: this.get('imageSettings.defaultSavePath', null),
                            gridLayout: this.get('ui.gridLayout', false),
                            uiScale: this.get('ui.scale', 1.0)
                        };
                    },
                    
                    // 设置关键设置
                    setCriticalSettings: function(settings, callback) {
                        var self = this;
                        var settingsToUpdate = {};
                        
                        if (settings.enableSubfolders !== undefined) {
                            settingsToUpdate['scriptPath.enableSubfolders'] = settings.enableSubfolders;
                        }
                        if (settings.imageSavePath !== undefined) {
                            settingsToUpdate['imageSettings.defaultSavePath'] = settings.imageSavePath;
                        }
                        if (settings.gridLayout !== undefined) {
                            settingsToUpdate['ui.gridLayout'] = settings.gridLayout;
                        }
                        if (settings.uiScale !== undefined) {
                            settingsToUpdate['ui.scale'] = settings.uiScale;
                        }
                        
                        if (typeof MoguSettings !== 'undefined' && MoguSettings.setMultiple) {
                            MoguSettings.setMultiple(settingsToUpdate, callback);
                        } else {
                            // 逐个设置
                            var paths = Object.keys(settingsToUpdate);
                            var completed = 0;
                            var errors = [];
                            
                            if (paths.length === 0) {
                                if (callback) callback(null, []);
                                return;
                            }
                            
                            paths.forEach(function(path) {
                                self.set(path, settingsToUpdate[path], function(error) {
                                    if (error) errors.push(error);
                                    completed++;
                                    
                                    if (completed === paths.length) {
                                        if (callback) {
                                            callback(errors.length > 0 ? errors.join('; ') : null, paths);
                                        }
                                    }
                                });
                            });
                        }
                    },
                    
                    // 强制保存所有设置
                    forceSave: function(callback) {
                        if (typeof SettingsIntegration !== 'undefined' && SettingsIntegration.forceSyncAllSettings) {
                            SettingsIntegration.forceSyncAllSettings(callback);
                        } else if (typeof SettingsEnhanced !== 'undefined' && SettingsEnhanced.saveSettingsImmediate) {
                            SettingsEnhanced.saveSettingsImmediate(callback);
                        } else if (typeof SettingsManager !== 'undefined' && SettingsManager.saveSettingsImmediate) {
                            SettingsManager.saveSettingsImmediate(callback);
                        } else if (callback) {
                            callback('无可用的保存方法');
                        }
                    },
                    
                    // 获取系统状态
                    getStatus: function() {
                        var status = {
                            integrated: QuickIntegration.integrated,
                            availableManagers: {
                                MoguSettings: typeof MoguSettings !== 'undefined',
                                SettingsEnhanced: typeof SettingsEnhanced !== 'undefined',
                                SettingsManager: typeof SettingsManager !== 'undefined',
                                SettingsIntegration: typeof SettingsIntegration !== 'undefined'
                            }
                        };
                        
                        if (typeof SettingsIntegration !== 'undefined' && SettingsIntegration.getIntegrationStatus) {
                            status.integrationDetails = SettingsIntegration.getIntegrationStatus();
                        }
                        
                        return status;
                    }
                };
                
                self.log('全局接口 MoguSettingsQuick 已创建', 'info');
            }
            
            if (callback) callback(null, true);
        } catch (e) {
            self.log('设置全局接口失败: ' + e.message, 'error');
            if (callback) callback(e.message);
        }
    },
    
    /**
     * 设置监控
     * 功能：快速集成-监控设置-01
     * @param {Function} callback - 设置完成回调
     */
    setupMonitoring: function(callback) {
        var self = this;
        
        try {
            // 监控关键设置变化
            if (typeof MoguSettings !== 'undefined' && MoguSettings.addListener) {
                MoguSettings.addListener(function(changeEvent) {
                    self.log('设置变化监控: ' + changeEvent.path + ' = ' + changeEvent.newValue, 'debug');
                    
                    // 特别关注关键设置
                    var criticalPaths = [
                        'scriptPath.enableSubfolders',
                        'imageSettings.defaultSavePath',
                        'ui.gridLayout',
                        'ui.scale'
                    ];
                    
                    if (criticalPaths.indexOf(changeEvent.path) !== -1) {
                        self.log('关键设置变化: ' + changeEvent.path + ' = ' + changeEvent.newValue, 'info');
                    }
                });
            }
            
            // 定期健康检查
            setInterval(function() {
                self.performHealthCheck();
            }, 60000); // 每分钟检查一次
            
            self.log('监控系统已启动', 'info');
            if (callback) callback(null, true);
        } catch (e) {
            self.log('设置监控失败: ' + e.message, 'error');
            if (callback) callback(e.message);
        }
    },
    
    /**
     * 执行健康检查
     * 功能：快速集成-健康检查-01
     */
    performHealthCheck: function() {
        var self = this;
        
        try {
            // 检查关键设置是否还存在
            if (typeof window !== 'undefined' && window.MoguSettingsQuick) {
                var criticalSettings = window.MoguSettingsQuick.getCriticalSettings();
                
                // 检查是否有设置丢失
                var issues = [];
                if (criticalSettings.enableSubfolders === undefined) {
                    issues.push('子文件夹设置丢失');
                }
                if (criticalSettings.imageSavePath === undefined) {
                    issues.push('图片保存路径设置丢失');
                }
                
                if (issues.length > 0) {
                    self.log('健康检查发现问题: ' + issues.join(', '), 'warn');
                    
                    // 尝试修复
                    self.repairCriticalSettings();
                } else {
                    self.log('健康检查通过', 'debug');
                }
            }
        } catch (e) {
            self.log('健康检查异常: ' + e.message, 'error');
        }
    },
    
    /**
     * 修复关键设置
     * 功能：快速集成-设置修复-01
     */
    repairCriticalSettings: function() {
        var self = this;
        
        self.log('开始修复关键设置...', 'info');
        
        if (typeof window !== 'undefined' && window.MoguSettingsQuick) {
            var defaultSettings = {
                enableSubfolders: true,
                imageSavePath: null,
                gridLayout: false,
                uiScale: 1.0
            };
            
            window.MoguSettingsQuick.setCriticalSettings(defaultSettings, function(error) {
                if (error) {
                    self.log('关键设置修复失败: ' + error, 'error');
                } else {
                    self.log('关键设置修复完成', 'info');
                }
            });
        }
    },
    
    /**
     * 日志输出
     * 功能：快速集成-日志-01
     * @param {string} message - 日志消息
     * @param {string} level - 日志级别
     */
    log: function(message, level) {
        var self = this;
        level = level || 'info';
        
        var logLevels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        };
        
        var currentLevel = logLevels[self.config.logLevel] || 1;
        var messageLevel = logLevels[level] || 1;
        
        if (messageLevel >= currentLevel) {
            var prefix = '[QuickIntegration]';
            var timestamp = new Date().toLocaleTimeString();
            var fullMessage = prefix + ' [' + timestamp + '] ' + level.toUpperCase() + ': ' + message;
            
            switch (level) {
                case 'error':
                    console.error(fullMessage);
                    break;
                case 'warn':
                    console.warn(fullMessage);
                    break;
                case 'debug':
                    console.debug(fullMessage);
                    break;
                default:
                    console.log(fullMessage);
            }
        }
    },
    
    /**
     * 获取集成状态
     * 功能：快速集成-状态获取-01
     * @returns {Object} 集成状态
     */
    getStatus: function() {
        var self = this;
        
        return {
            integrated: self.integrated,
            config: self.config,
            availableComponents: {
                LocalDataManager: typeof LocalDataManager !== 'undefined',
                SettingsManager: typeof SettingsManager !== 'undefined',
                SettingsPersistence: typeof SettingsPersistence !== 'undefined',
                SettingsEnhanced: typeof SettingsEnhanced !== 'undefined',
                SettingsBackup: typeof SettingsBackup !== 'undefined',
                SettingsIntegration: typeof SettingsIntegration !== 'undefined'
            },
            globalInterface: typeof window !== 'undefined' && typeof window.MoguSettingsQuick !== 'undefined'
        };
    }
};

// 自动集成（如果配置了自动初始化）
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        if (QuickIntegration.config.autoInit) {
            // 延迟一点时间确保其他脚本加载完成
            setTimeout(function() {
                QuickIntegration.integrate(function(error, result) {
                    if (error) {
                        console.warn('[QuickIntegration] 自动集成失败:', error);
                    } else {
                        console.log('[QuickIntegration] 自动集成成功');
                    }
                });
            }, 1000);
        }
    });
}

// 导出快速集成器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickIntegration;
}