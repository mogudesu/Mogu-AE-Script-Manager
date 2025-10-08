/**
 * AE CEP脚本设置持久化完整解决方案
 * Complete Settings Persistence Solution for AE CEP Scripts
 * 
 * 解决问题：
 * 1. 动态读取脚本路径子文件夹设置经常丢失
 * 2. 拖入图片的文件保存位置设置经常丢失
 * 3. 其他用户配置无法长期保存
 * 
 * 解决方案：
 * - 多重存储备份机制
 * - 实时设置监控和保存
 * - 自动恢复和修复功能
 * - 与现有系统无缝集成
 */

var SettingsPersistenceComplete = {
    // 初始化状态
    initialized: false,
    
    // 设置缓存
    settingsCache: null,
    
    // 关键设置配置（经常丢失的设置）
    criticalSettings: {
        // 脚本路径子文件夹开关
        scriptSubfolders: {
            key: 'autoReadSubfolders',
            storageKey: 'mogu_script_subfolders',
            description: '是否开启动态读取脚本路径子文件夹',
            type: 'boolean',
            default: false
        },
        
        // 图片保存位置
        imageSavePath: {
            key: 'imageSaveLocation',
            storageKey: 'mogu_image_save_path',
            description: '拖入图片的文件保存位置',
            type: 'string',
            default: ''
        },

        // 图片保存自定义路径
        imageCustomPath: {
            key: 'imageCustomPath',
            storageKey: 'mogu_image_custom_path',
            description: '拖入图片的自定义保存路径',
            type: 'string',
            default: ''
        },
        
        // 脚本文件夹路径
        scriptFolderPath: {
            key: 'scriptsFolderPath',
            storageKey: 'mogu_scripts_folder_path',
            description: '脚本文件夹路径',
            type: 'string',
            default: null
        },
        
        // 界面布局设置
        gridLayout: {
            key: 'isGridLayout',
            storageKey: 'mogu_grid_layout',
            description: '网格布局开关',
            type: 'boolean',
            default: false
        },
        
        // 界面缩放
        uiScale: {
            key: 'currentScale',
            storageKey: 'mogu_ui_scale',
            description: '界面缩放比例',
            type: 'number',
            default: 1.0
        },

        // 预设界面缩放（独立于脚本界面）
        presetScale: {
            key: 'presetScale',
            storageKey: 'mogu_preset_scale',
            description: '预设界面卡片缩放比例',
            type: 'number',
            default: 1.0
        },
        
        // 预设文件夹路径（新增：确保与预设扫描逻辑一致）
        presetFolderPath: {
            key: 'presetFolderPath',
            storageKey: 'mogu_preset_folder_path',
            description: '预设文件夹路径',
            type: 'string',
            default: ''
        }
    },
    
    // 存储方式配置
    storageConfig: {
        // 存储优先级（从高到低）
        priority: ['cepPrefs', 'localStorage', 'fileStorage', 'sessionStorage'],
        // 自动保存间隔
        autoSaveInterval: 2000,
        // 验证间隔
        validationInterval: 10000,
        // 最大重试次数
        maxRetries: 3
    },
    
    // 定时器
    autoSaveTimer: null,
    validationTimer: null,
    
    /**
     * 初始化完整持久化系统
     * 功能：完整持久化-初始化-01
     * @param {Function} callback - 初始化完成回调
     */
    init: function(callback) {
        var self = this;
        
        console.log('SettingsPersistenceComplete: 开始初始化完整持久化系统...');
        
        if (self.initialized) {
            console.log('SettingsPersistenceComplete: 已经初始化过了');
            if (callback) callback(null, true);
            return;
        }
        
        // 检查环境
        self.checkEnvironment(function(envError) {
            if (envError) {
                console.warn('SettingsPersistenceComplete: 环境检查警告:', envError);
            }
            
            // 加载现有设置
            self.loadAllSettings(function(loadError, settings) {
                if (loadError) {
                    console.warn('SettingsPersistenceComplete: 加载设置失败，使用默认设置:', loadError);
                    settings = self.getDefaultSettings();
                }
                
                self.settingsCache = settings;
                
                // 验证关键设置
                self.validateCriticalSettings();
                
                // 立即保存一次确保数据完整性
                self.saveAllSettings(function(saveError) {
                    if (saveError) {
                        console.warn('SettingsPersistenceComplete: 初始保存失败:', saveError);
                    }
                    
                    // 启动自动保存和监控
                    self.startAutoSave();
                    self.startValidation();
                    
                    // 集成到现有系统
                    self.integrateWithExistingSystems();
                    
                    // 设置页面卸载处理
                    self.setupUnloadHandler();
                    
                    self.initialized = true;
                    console.log('SettingsPersistenceComplete: 完整持久化系统初始化完成');
                    
                    if (callback) callback(null, true);
                });
            });
        });
    },
    
    /**
     * 检查环境
     * 功能：完整持久化-环境检查-01
     * @param {Function} callback - 检查完成回调
     */
    checkEnvironment: function(callback) {
        var self = this;
        var warnings = [];
        
        // 检查CEP环境
        if (typeof csInterface === 'undefined') {
            warnings.push('CEP环境不可用');
        }
        
        // 检查localStorage
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('test_key', 'test_value');
                localStorage.removeItem('test_key');
            } else {
                warnings.push('localStorage不可用');
            }
        } catch (e) {
            warnings.push('localStorage访问受限: ' + e.message);
        }
        
        // 检查LocalDataManager
        if (typeof LocalDataManager === 'undefined') {
            warnings.push('LocalDataManager不可用');
        } else if (!LocalDataManager.initialized) {
            warnings.push('LocalDataManager未初始化');
        }
        
        if (warnings.length > 0) {
            if (callback) callback('环境检查发现问题: ' + warnings.join(', '));
        } else {
            if (callback) callback(null);
        }
    },
    
    /**
     * 获取默认设置
     * 功能：完整持久化-默认设置-01
     * @returns {Object} 默认设置对象
     */
    getDefaultSettings: function() {
        var self = this;
        var settings = {};
        
        // 根据关键设置配置生成默认值
        for (var settingName in self.criticalSettings) {
            var config = self.criticalSettings[settingName];
            settings[config.key] = config.default;
        }
        
        // 添加元数据
        settings._metadata = {
            version: '1.0',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            source: 'default'
        };
        
        return settings;
    },
    
    /**
     * 加载所有设置
     * 功能：完整持久化-加载设置-01
     * @param {Function} callback - 加载完成回调
     */
    loadAllSettings: function(callback) {
        var self = this;
        var loadedSettings = {};
        var loadResults = {};
        
        console.log('SettingsPersistenceComplete: 开始从多个存储位置加载设置...');
        
        // 尝试从各个存储位置加载
        var storageTypes = self.storageConfig.priority;
        var loadCount = 0;
        
        function tryNextStorage(index) {
            if (index >= storageTypes.length) {
                // 所有存储位置都尝试完毕，选择最佳结果
                var bestSettings = self.selectBestSettings(loadResults);
                if (callback) callback(null, bestSettings);
                return;
            }
            
            var storageType = storageTypes[index];
            self.loadFromStorage(storageType, function(error, settings) {
                loadResults[storageType] = {
                    error: error,
                    settings: settings,
                    valid: !error && self.isValidSettings(settings)
                };
                
                if (!error && settings) {
                    console.log('SettingsPersistenceComplete: 从', storageType, '加载成功');
                } else {
                    console.warn('SettingsPersistenceComplete: 从', storageType, '加载失败:', error);
                }
                
                tryNextStorage(index + 1);
            });
        }
        
        tryNextStorage(0);
    },
    
    /**
     * 从指定存储加载设置
     * 功能：完整持久化-存储加载-01
     * @param {string} storageType - 存储类型
     * @param {Function} callback - 加载完成回调
     */
    loadFromStorage: function(storageType, callback) {
        var self = this;
        
        switch (storageType) {
            case 'cepPrefs':
                self.loadFromCEPPrefs(callback);
                break;
            case 'localStorage':
                self.loadFromLocalStorage(callback);
                break;
            case 'fileStorage':
                self.loadFromFileStorage(callback);
                break;
            case 'sessionStorage':
                self.loadFromSessionStorage(callback);
                break;
            default:
                if (callback) callback('未知的存储类型: ' + storageType);
        }
    },
    
    /**
     * 从CEP首选项加载
     * 功能：完整持久化-CEP加载-01
     * @param {Function} callback - 加载完成回调
     */
    loadFromCEPPrefs: function(callback) {
        var self = this;
        
        if (typeof csInterface === 'undefined') {
            if (callback) callback('CEP环境不可用');
            return;
        }
        
        var settings = {};
        var loadCount = 0;
        var totalLoads = Object.keys(self.criticalSettings).length;
        
        if (totalLoads === 0) {
            if (callback) callback(null, settings);
            return;
        }
        
        function checkLoadComplete() {
            loadCount++;
            if (loadCount >= totalLoads) {
                // 添加元数据
                settings._metadata = {
                    version: '1.0',
                    lastModified: new Date().toISOString(),
                    source: 'cepPrefs'
                };
                if (callback) callback(null, settings);
            }
        }
        
        // 逐个加载关键设置
        for (var settingName in self.criticalSettings) {
            var config = self.criticalSettings[settingName];
            
            (function(config) {
                csInterface.evalScript('getPreference("' + config.storageKey + '")', function(result) {
                    if (result && result !== 'null' && result !== 'undefined') {
                        try {
                            var value = JSON.parse(result);
                            settings[config.key] = value;
                        } catch (e) {
                            // 如果不是JSON，直接使用字符串值
                            settings[config.key] = result;
                        }
                    } else {
                        settings[config.key] = config.default;
                    }
                    checkLoadComplete();
                });
            })(config);
        }
    },
    
    /**
     * 从localStorage加载
     * 功能：完整持久化-localStorage加载-01
     * @param {Function} callback - 加载完成回调
     */
    loadFromLocalStorage: function(callback) {
        var self = this;
        
        try {
            if (typeof localStorage === 'undefined') {
                if (callback) callback('localStorage不可用');
                return;
            }
            
            var settings = {};
            
            // 逐个加载关键设置
            for (var settingName in self.criticalSettings) {
                var config = self.criticalSettings[settingName];
                var storedValue = localStorage.getItem(config.storageKey);
                
                if (storedValue !== null) {
                    try {
                        settings[config.key] = JSON.parse(storedValue);
                    } catch (e) {
                        settings[config.key] = storedValue;
                    }
                } else {
                    settings[config.key] = config.default;
                }
            }
            
            // 添加元数据
            settings._metadata = {
                version: '1.0',
                lastModified: new Date().toISOString(),
                source: 'localStorage'
            };
            
            console.log('SettingsPersistenceComplete: localStorage加载完成');
            if (callback) callback(null, settings);
            
        } catch (e) {
            console.error('SettingsPersistenceComplete: localStorage加载异常:', e);
            if (callback) callback(e.message);
        }
    },
    
    /**
     * 从文件存储加载
     * 功能：完整持久化-文件加载-01
     * @param {Function} callback - 加载完成回调
     */
    loadFromFileStorage: function(callback) {
        var self = this;
        
        if (typeof LocalDataManager === 'undefined' || !LocalDataManager.initialized) {
            if (callback) callback('LocalDataManager不可用');
            return;
        }
        
        // 从主数据文件加载
        LocalDataManager.loadDataByType('main', function(error, mainData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (!mainData) {
                if (callback) callback('主数据文件为空');
                return;
            }
            
            var settings = {};
            
            // 映射主数据到设置格式
            if (mainData.autoReadSubfolders !== undefined) {
                settings.autoReadSubfolders = mainData.autoReadSubfolders;
            }
            if (mainData.scriptsFolderPath !== undefined) {
                settings.scriptsFolderPath = mainData.scriptsFolderPath;
            }
            // 新增：读取主数据中的预设路径
            if (mainData.presetFolderPath !== undefined) {
                settings.presetFolderPath = mainData.presetFolderPath;
            } else if (mainData.presetsFolderPath !== undefined) {
                settings.presetFolderPath = mainData.presetsFolderPath;
            }
            
            // 从布局数据加载界面设置
            LocalDataManager.loadDataByType('layout', function(layoutError, layoutData) {
                if (!layoutError && layoutData) {
                    if (layoutData.isGridLayout !== undefined) {
                        settings.isGridLayout = layoutData.isGridLayout;
                    }
                    if (layoutData.currentScale !== undefined) {
                        settings.currentScale = layoutData.currentScale;
                    }
                }
                
                // 读取 clipboardImport（图片保存位置与自定义路径）
                try {
                    if (mainData.clipboardImport) {
                        if (mainData.clipboardImport.saveLocation !== undefined) {
                            settings.imageSaveLocation = mainData.clipboardImport.saveLocation;
                        }
                        if (mainData.clipboardImport.customPath !== undefined) {
                            settings.imageCustomPath = mainData.clipboardImport.customPath;
                        }
                    }
                    // 兼容 userSettings
                    if (mainData.userSettings && mainData.userSettings.clipboardImport) {
                        if (settings.imageSaveLocation === undefined && mainData.userSettings.clipboardImport.saveLocation !== undefined) {
                            settings.imageSaveLocation = mainData.userSettings.clipboardImport.saveLocation;
                        }
                        if (settings.imageCustomPath === undefined && mainData.userSettings.clipboardImport.customPath !== undefined) {
                            settings.imageCustomPath = mainData.userSettings.clipboardImport.customPath;
                        }
                    }
                } catch (eClip) {
                    console.warn('SettingsPersistenceComplete: 读取clipboardImport失败', eClip);
                }

                // 填充缺失的默认值
                for (var settingName in self.criticalSettings) {
                    var config = self.criticalSettings[settingName];
                    if (settings[config.key] === undefined) {
                        settings[config.key] = config.default;
                    }
                }
                
                // 添加元数据
                settings._metadata = {
                    version: '1.0',
                    lastModified: mainData.lastSaved || new Date().toISOString(),
                    source: 'fileStorage'
                };
                
                console.log('SettingsPersistenceComplete: 文件存储加载完成');
                if (callback) callback(null, settings);
            });
        });
    },
    
    /**
     * 从sessionStorage加载
     * 功能：完整持久化-sessionStorage加载-01
     * @param {Function} callback - 加载完成回调
     */
    loadFromSessionStorage: function(callback) {
        var self = this;
        
        try {
            if (typeof sessionStorage === 'undefined') {
                if (callback) callback('sessionStorage不可用');
                return;
            }
            
            var settings = {};
            
            // 逐个加载关键设置
            for (var settingName in self.criticalSettings) {
                var config = self.criticalSettings[settingName];
                var storedValue = sessionStorage.getItem(config.storageKey);
                
                if (storedValue !== null) {
                    try {
                        settings[config.key] = JSON.parse(storedValue);
                    } catch (e) {
                        settings[config.key] = storedValue;
                    }
                } else {
                    settings[config.key] = config.default;
                }
            }
            
            // 添加元数据
            settings._metadata = {
                version: '1.0',
                lastModified: new Date().toISOString(),
                source: 'sessionStorage'
            };
            
            console.log('SettingsPersistenceComplete: sessionStorage加载完成');
            if (callback) callback(null, settings);
            
        } catch (e) {
            console.error('SettingsPersistenceComplete: sessionStorage加载异常:', e);
            if (callback) callback(e.message);
        }
    },
    
    /**
     * 选择最佳设置
     * 功能：完整持久化-最佳选择-01
     * @param {Object} loadResults - 各存储位置的加载结果
     * @returns {Object} 最佳设置对象
     */
    selectBestSettings: function(loadResults) {
        var self = this;
        
        console.log('SettingsPersistenceComplete: 选择最佳设置...');
        
        // 按优先级选择第一个有效的设置
        var storageTypes = self.storageConfig.priority;
        
        for (var i = 0; i < storageTypes.length; i++) {
            var storageType = storageTypes[i];
            var result = loadResults[storageType];
            
            if (result && result.valid && result.settings) {
                console.log('SettingsPersistenceComplete: 选择', storageType, '作为最佳设置源');
                return result.settings;
            }
        }
        
        // 如果没有有效设置，使用默认设置
        console.log('SettingsPersistenceComplete: 没有有效设置，使用默认设置');
        return self.getDefaultSettings();
    },
    
    /**
     * 验证设置是否有效
     * 功能：完整持久化-设置验证-01
     * @param {Object} settings - 要验证的设置
     * @returns {boolean} 是否有效
     */
    isValidSettings: function(settings) {
        var self = this;
        
        if (!settings || typeof settings !== 'object') {
            return false;
        }
        
        // 检查是否包含关键设置
        var hasValidSettings = false;
        for (var settingName in self.criticalSettings) {
            var config = self.criticalSettings[settingName];
            if (settings.hasOwnProperty(config.key)) {
                hasValidSettings = true;
                break;
            }
        }
        
        return hasValidSettings;
    },
    
    /**
     * 验证关键设置
     * 功能：完整持久化-关键验证-01
     */
    validateCriticalSettings: function() {
        var self = this;
        
        console.log('SettingsPersistenceComplete: 验证关键设置...');
        
        var fixed = false;
        var fixedItems = [];
        
        for (var settingName in self.criticalSettings) {
            var config = self.criticalSettings[settingName];
            var currentValue = self.settingsCache[config.key];
            
            // 检查是否缺失或无效
            if (currentValue === undefined || currentValue === null) {
                console.log('SettingsPersistenceComplete: 修复缺失设置:', config.key);
                self.settingsCache[config.key] = config.default;
                fixed = true;
                fixedItems.push(config.key);
            } else {
                // 类型验证
                var expectedType = config.type;
                var actualType = typeof currentValue;
                
                if (expectedType === 'boolean' && actualType !== 'boolean') {
                    console.log('SettingsPersistenceComplete: 修复布尔类型设置:', config.key);
                    self.settingsCache[config.key] = config.default;
                    fixed = true;
                    fixedItems.push(config.key);
                } else if (expectedType === 'number' && (actualType !== 'number' || isNaN(currentValue))) {
                    console.log('SettingsPersistenceComplete: 修复数值类型设置:', config.key);
                    self.settingsCache[config.key] = config.default;
                    fixed = true;
                    fixedItems.push(config.key);
                } else if (expectedType === 'string' && actualType !== 'string' && currentValue !== null) {
                    console.log('SettingsPersistenceComplete: 修复字符串类型设置:', config.key);
                    self.settingsCache[config.key] = config.default;
                    fixed = true;
                    fixedItems.push(config.key);
                }
            }
        }
        
        if (fixed) {
            console.log('SettingsPersistenceComplete: 关键设置已修复，项目:', fixedItems);
            // 更新元数据
            if (self.settingsCache._metadata) {
                self.settingsCache._metadata.lastModified = new Date().toISOString();
            }
        } else {
            console.log('SettingsPersistenceComplete: 关键设置验证通过');
        }
    },
    
    /**
     * 保存所有设置
     * 功能：完整持久化-保存设置-01
     * @param {Function} callback - 保存完成回调
     */
    saveAllSettings: function(callback) {
        var self = this;
        
        if (!self.settingsCache) {
            if (callback) callback('无设置数据需要保存');
            return;
        }
        
        console.log('SettingsPersistenceComplete: 开始保存所有设置...');
        
        // 更新时间戳
        if (self.settingsCache._metadata) {
            self.settingsCache._metadata.lastModified = new Date().toISOString();
        }
        
        var storageTypes = self.storageConfig.priority;
        var saveResults = {};
        var saveCount = 0;
        var hasSuccess = false;
        
        function checkSaveComplete() {
            saveCount++;
            if (saveCount >= storageTypes.length) {
                var successCount = Object.keys(saveResults).filter(function(key) {
                    return saveResults[key] === true;
                }).length;
                
                if (successCount > 0) {
                    hasSuccess = true;
                    console.log('SettingsPersistenceComplete: 成功保存到', successCount, '个存储位置');
                    if (callback) callback(null, saveResults);
                } else {
                    console.error('SettingsPersistenceComplete: 所有存储位置保存都失败了');
                    if (callback) callback('所有存储位置保存都失败了', saveResults);
                }
            }
        }
        
        // 并行保存到所有存储位置
        storageTypes.forEach(function(storageType) {
            self.saveToStorage(storageType, function(error) {
                saveResults[storageType] = !error;
                if (error) {
                    console.warn('SettingsPersistenceComplete: 保存到', storageType, '失败:', error);
                } else {
                    console.log('SettingsPersistenceComplete: 保存到', storageType, '成功');
                }
                checkSaveComplete();
            });
        });
    },
    
    /**
     * 保存到指定存储
     * 功能：完整持久化-存储保存-01
     * @param {string} storageType - 存储类型
     * @param {Function} callback - 保存完成回调
     */
    saveToStorage: function(storageType, callback) {
        var self = this;
        
        switch (storageType) {
            case 'cepPrefs':
                self.saveToCEPPrefs(callback);
                break;
            case 'localStorage':
                self.saveToLocalStorage(callback);
                break;
            case 'fileStorage':
                self.saveToFileStorage(callback);
                break;
            case 'sessionStorage':
                self.saveToSessionStorage(callback);
                break;
            default:
                if (callback) callback('未知的存储类型: ' + storageType);
        }
    },
    
    /**
     * 保存到CEP首选项
     * 功能：完整持久化-CEP保存-01
     * @param {Function} callback - 保存完成回调
     */
    saveToCEPPrefs: function(callback) {
        var self = this;
        
        if (typeof csInterface === 'undefined') {
            if (callback) callback('CEP环境不可用');
            return;
        }
        
        var saveCount = 0;
        var totalSaves = Object.keys(self.criticalSettings).length;
        var hasError = false;
        var errors = [];
        
        if (totalSaves === 0) {
            if (callback) callback(null);
            return;
        }
        
        function checkSaveComplete() {
            saveCount++;
            if (saveCount >= totalSaves) {
                if (hasError) {
                    if (callback) callback('部分CEP首选项保存失败: ' + errors.join(', '));
                } else {
                    console.log('SettingsPersistenceComplete: CEP首选项保存完成');
                    if (callback) callback(null);
                }
            }
        }
        
        // 逐个保存关键设置
        for (var settingName in self.criticalSettings) {
            var config = self.criticalSettings[settingName];
            var value = self.settingsCache[config.key];
            
            (function(config, value) {
                var valueStr = JSON.stringify(value);
                csInterface.evalScript('setPreference("' + config.storageKey + '", "' + encodeURIComponent(valueStr) + '")', function(result) {
                    if (result !== 'success') {
                        hasError = true;
                        errors.push(config.key + ': ' + result);
                        console.warn('SettingsPersistenceComplete: CEP首选项保存失败:', config.key, result);
                    }
                    checkSaveComplete();
                });
            })(config, value);
        }
    },
    
    /**
     * 保存到localStorage
     * 功能：完整持久化-localStorage保存-01
     * @param {Function} callback - 保存完成回调
     */
    saveToLocalStorage: function(callback) {
        var self = this;
        
        try {
            if (typeof localStorage === 'undefined') {
                if (callback) callback('localStorage不可用');
                return;
            }
            
            // 逐个保存关键设置
            for (var settingName in self.criticalSettings) {
                var config = self.criticalSettings[settingName];
                var value = self.settingsCache[config.key];
                
                localStorage.setItem(config.storageKey, JSON.stringify(value));
            }
            
            // 保存完整设置作为备份
            localStorage.setItem('mogu_complete_settings', JSON.stringify(self.settingsCache));
            localStorage.setItem('mogu_complete_settings_timestamp', new Date().toISOString());
            
            console.log('SettingsPersistenceComplete: localStorage保存完成');
            if (callback) callback(null);
            
        } catch (e) {
            console.error('SettingsPersistenceComplete: localStorage保存异常:', e);
            if (callback) callback(e.message);
        }
    },
    
    /**
     * 保存到文件存储
     * 功能：完整持久化-文件保存-01
     * @param {Function} callback - 保存完成回调
     */
    saveToFileStorage: function(callback) {
        var self = this;
        
        if (typeof LocalDataManager === 'undefined' || !LocalDataManager.initialized) {
            if (callback) callback('LocalDataManager不可用');
            return;
        }
        
        // 加载主数据并更新
        LocalDataManager.loadDataByType('main', function(error, mainData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (!mainData) {
                mainData = {};
            }
            
            // 更新主数据中的关键设置
            if (self.settingsCache.autoReadSubfolders !== undefined) {
                mainData.autoReadSubfolders = self.settingsCache.autoReadSubfolders;
            }
            if (self.settingsCache.scriptsFolderPath !== undefined) {
                mainData.scriptsFolderPath = self.settingsCache.scriptsFolderPath;
            }
            // 新增：写回预设路径到主数据，保证 PresetManager 可读
            if (self.settingsCache.presetFolderPath !== undefined) {
                mainData.presetFolderPath = self.settingsCache.presetFolderPath;
            }
            
            // 保存完整设置到主数据
            mainData.userSettings = self.settingsCache;

            // 写回 clipboardImport 到主数据（确保长期持久化）
            try {
                if (!mainData.clipboardImport) mainData.clipboardImport = {};
                if (self.settingsCache.imageSaveLocation !== undefined) {
                    mainData.clipboardImport.saveLocation = self.settingsCache.imageSaveLocation;
                }
                if (self.settingsCache.imageCustomPath !== undefined) {
                    mainData.clipboardImport.customPath = self.settingsCache.imageCustomPath;
                }
                // userSettings 同步（便于前端快速读取）
                if (!mainData.userSettings.clipboardImport) mainData.userSettings.clipboardImport = {};
                if (self.settingsCache.imageSaveLocation !== undefined) {
                    mainData.userSettings.clipboardImport.saveLocation = self.settingsCache.imageSaveLocation;
                }
                if (self.settingsCache.imageCustomPath !== undefined) {
                    mainData.userSettings.clipboardImport.customPath = self.settingsCache.imageCustomPath;
                }
            } catch (eClipSave) {
                console.warn('SettingsPersistenceComplete: 写回clipboardImport失败', eClipSave);
            }
            
            LocalDataManager.saveDataByType('main', mainData, function(mainSaveError) {
                if (mainSaveError) {
                    if (callback) callback(mainSaveError);
                    return;
                }
                
                // 更新布局数据
                LocalDataManager.loadDataByType('layout', function(layoutError, layoutData) {
                    if (!layoutData) {
                        layoutData = {};
                    }
                    
                    if (self.settingsCache.isGridLayout !== undefined) {
                        layoutData.isGridLayout = self.settingsCache.isGridLayout;
                    }
                    if (self.settingsCache.currentScale !== undefined) {
                        layoutData.currentScale = self.settingsCache.currentScale;
                    }
                    if (self.settingsCache.presetScale !== undefined) {
                        layoutData.presetScale = self.settingsCache.presetScale;
                    }
                    
                    LocalDataManager.saveDataByType('layout', layoutData, function(layoutSaveError) {
                        if (layoutSaveError) {
                            if (callback) callback(layoutSaveError);
                            return;
                        }
                        
                        console.log('SettingsPersistenceComplete: 文件存储保存完成');
                        if (callback) callback(null);
                    });
                });
            });
        });
    }
}; // 补齐对象字面量闭合

// 将对象挂到全局，供其他模块访问
if (typeof window !== 'undefined') {
    window.SettingsPersistenceComplete = SettingsPersistenceComplete;
}
// CommonJS 兼容（若在测试环境或打包中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsPersistenceComplete;
}