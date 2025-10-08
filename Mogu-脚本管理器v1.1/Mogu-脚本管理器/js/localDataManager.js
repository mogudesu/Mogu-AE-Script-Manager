// 本地数据管理器 - 将数据存储在脚本自身的data文件夹中
// Local Data Manager - Store data in script's own data folder

var LocalDataManager = {
    // 数据文件夹路径
    dataFolderPath: null,
    dataFilePath: null,
    initialized: false,
    
    // 数据文件名配置
    dataFiles: {
        main: 'settings.json',           // 主设置文件
        scripts: 'scripts.json',         // 脚本设置
        categories: 'categories.json',   // 分类数据
        tags: 'tags.json',              // 标签数据
        backgrounds: 'backgrounds.json', // 背景设置
        layout: 'layout.json'           // 布局设置
    },
    
    // 默认数据结构
    defaultData: {
        main: {
            version: "2.0",
            scriptsFolderPath: null,
            autoReadSubfolders: false,
            lastSaved: null,
            dataStorageVersion: "local_v1"
        },
        scripts: {},
        categories: ["全部"],
        tags: [],
        backgrounds: {
            currentBackground: null,
            backgroundSettings: null
        },
        layout: {
            isGridLayout: false,
            currentScale: 1,
            sidebarWidth: 100,
            scriptOrder: []
        }
    },
    
    /**
     * 安全解码显示名称，兼容可能的URI编码（如包含%20）
     * 功能：显示名处理-工具-01
     * @param {string} name - 输入的显示名称，可能为未编码或URI编码
     * @returns {string} 返回安全解码且去除首尾空白后的字符串；对无效输入返回原值
     */
    safeDecodeDisplayName: function(name) {
        try {
            if (typeof name !== 'string') return name;
            var original = name;
            // 处理 application/x-www-form-urlencoded 中的加号空格
            var maybeEncoded = original.indexOf('%') !== -1 || original.indexOf('+') !== -1;
            if (maybeEncoded) {
                var replaced = original.replace(/\+/g, ' ');
                // 仅当存在合法的%XX序列时尝试解码，避免误伤
                var hasPctSeq = /%(?:[0-9A-Fa-f]{2})/.test(replaced);
                if (hasPctSeq) {
                    try {
                        var decoded = decodeURIComponent(replaced);
                        if (typeof decoded === 'string' && decoded.length > 0) {
                            return decoded.trim();
                        }
                    } catch (e) {
                        console.warn('显示名处理-工具-01: 解码失败，使用原值', e);
                        return original.trim();
                    }
                }
                return replaced.trim();
            }
            return original.trim();
        } catch (err) {
            console.warn('显示名处理-工具-01: 未知错误，返回原值', err);
            return name;
        }
    },
    
    // 初始化本地数据管理器
    init: function(callback, retryCount) {
        var self = this;
        retryCount = retryCount || 0;
        var maxRetries = 3;
        var retryDelay = 1000;
        
        console.log('LocalDataManager: 开始初始化... (尝试次数: ' + (retryCount + 1) + ')');
        
        if (self.initialized) {
            console.log('LocalDataManager: 已经初始化过了');
            if (callback) callback(null, true);
            return;
        }
        
        // 检测CEP环境
        if (typeof csInterface === 'undefined') {
            var cepError = 'CEP环境未就绪，csInterface对象不存在';
            console.error('LocalDataManager:', cepError);
            if (retryCount < maxRetries) {
                console.log('LocalDataManager: 等待CEP环境就绪，' + retryDelay + 'ms后重试...');
                setTimeout(function() {
                    self.init(callback, retryCount + 1);
                }, retryDelay);
                return;
            }
            if (callback) callback(cepError);
            return;
        }
        
        // 检测csInterface.evalScript是否可用
        if (typeof csInterface.evalScript !== 'function') {
            var evalError = 'csInterface.evalScript方法不可用';
            console.error('LocalDataManager:', evalError);
            if (callback) callback(evalError);
            return;
        }
        
        // 获取脚本扩展根目录
        console.log('LocalDataManager: 尝试获取扩展根路径...');
        csInterface.evalScript('getExtensionRootPath()', function(result) {
            console.log('LocalDataManager: getExtensionRootPath() 返回:', result);
            
            if (!result || result === 'null' || result === 'undefined' || result.trim() === '') {
                var pathError = '无法获取扩展根路径';
                console.error('LocalDataManager:', pathError, '返回值:', result);
                
                if (retryCount < maxRetries) {
                    console.log('LocalDataManager: 获取路径失败，' + retryDelay + 'ms后重试...');
                    setTimeout(function() {
                        self.init(callback, retryCount + 1);
                    }, retryDelay);
                    return;
                }
                
                if (callback) callback(pathError + '，已重试' + maxRetries + '次');
                return;
            }
            
            try {
                // 尝试解析JSON响应
                var pathInfo;
                try {
                    pathInfo = JSON.parse(result);
                    console.log('LocalDataManager: 解析路径信息:', pathInfo);
                } catch (parseError) {
                    // 如果不是JSON格式，假设是直接的路径字符串（向后兼容）
                    console.log('LocalDataManager: 使用直接路径格式');
                    pathInfo = {
                        success: true,
                        path: result,
                        exists: true
                    };
                }
                
                // 检查路径获取是否成功
                if (!pathInfo.success) {
                    var pathError = '获取扩展根路径失败: ' + (pathInfo.error || pathInfo.message || '未知错误');
                    console.error('LocalDataManager:', pathError);
                    
                    if (retryCount < maxRetries) {
                        console.log('LocalDataManager: 路径获取失败，' + retryDelay + 'ms后重试...');
                        setTimeout(function() {
                            self.init(callback, retryCount + 1);
                        }, retryDelay);
                        return;
                    }
                    
                    if (callback) callback(pathError + '，已重试' + maxRetries + '次');
                    return;
                }
                
                // 检查路径是否存在
                if (!pathInfo.exists) {
                    var existsError = '扩展根目录不存在: ' + pathInfo.path;
                    console.error('LocalDataManager:', existsError);
                    if (callback) callback(existsError);
                    return;
                }
                
                var extensionRootPath = pathInfo.path;
                console.log('LocalDataManager: 扩展根路径:', extensionRootPath);
                
                self.extensionRootPath = extensionRootPath;
                self.dataFolderPath = extensionRootPath + "/data";
                self.dataFilePath = self.dataFolderPath + "/" + self.dataFiles.main;
                
                console.log('LocalDataManager: dataFolderPath =', self.dataFolderPath);
                console.log('LocalDataManager: dataFilePath =', self.dataFilePath);
                
                // 确保data文件夹存在
                self.ensureDataFolder(function(error) {
                    if (error) {
                        console.error('LocalDataManager: 创建data文件夹失败:', error);
                        if (callback) callback(error);
                        return;
                    }
                    
                    console.log('LocalDataManager: data文件夹创建成功');
                    self.initialized = true;
                    console.log('本地数据管理器初始化成功，数据路径:', self.dataFolderPath);
                    
                    // 检查是否需要从旧系统迁移数据
                    self.checkAndMigrateOldData(function(migrationError) {
                        if (migrationError) {
                            console.warn('LocalDataManager: 数据迁移警告:', migrationError);
                        } else {
                            console.log('LocalDataManager: 数据迁移检查完成');
                        }
                        console.log('LocalDataManager: 初始化完成');
                        if (callback) callback(null, true);
                    });
                });
            } catch (processingError) {
                console.error('LocalDataManager: 路径处理失败:', processingError);
                if (callback) callback('路径处理失败: ' + processingError.message);
            }
        });
    },
    
    // 确保data文件夹存在
    ensureDataFolder: function(callback) {
        var self = this;
        console.log('LocalDataManager: 开始确保data文件夹存在:', self.dataFolderPath);
        
        csInterface.evalScript('ensureDataFolder("' + self.dataFolderPath + '")', function(result) {
            console.log('LocalDataManager: ensureDataFolder() 返回:', result);
            
            if (result === "success") {
                console.log('LocalDataManager: data文件夹确保成功');
                if (callback) callback(null);
            } else {
                var errorMsg = "创建data文件夹失败: " + result;
                console.error('LocalDataManager:', errorMsg);
                if (callback) callback(errorMsg);
            }
        });
    },
    
    // 加载指定类型的数据
    loadDataByType: function(dataType, callback) {
        var self = this;
        if (!self.initialized) {
            if (callback) callback("本地数据管理器未初始化");
            return;
        }
        
        var fileName = self.dataFiles[dataType];
        if (!fileName) {
            if (callback) callback("未知的数据类型: " + dataType);
            return;
        }
        
        var filePath = self.dataFolderPath + "/" + fileName;
        
        csInterface.evalScript('loadDataFromFile("' + filePath + '")', function(result) {
            try {
                if (result && result !== 'null' && result !== 'undefined' && result !== '{}') {
                    var data = JSON.parse(result);
                    if (callback) callback(null, data);
                } else {
                    // 返回默认数据
                    var defaultData = self.defaultData[dataType];
                    if (callback) callback(null, JSON.parse(JSON.stringify(defaultData)));
                }
            } catch (e) {
                console.error('加载数据失败 (' + dataType + '):', e);
                var defaultData = self.defaultData[dataType];
                if (callback) callback(null, JSON.parse(JSON.stringify(defaultData)));
            }
        });
    },
    
    // 保存指定类型的数据
    saveDataByType: function(dataType, data, callback) {
        var self = this;
        if (!self.initialized) {
            if (callback) callback("本地数据管理器未初始化");
            return;
        }
        
        var fileName = self.dataFiles[dataType];
        if (!fileName) {
            if (callback) callback("未知的数据类型: " + dataType);
            return;
        }
        
        try {
            // 添加保存时间戳
            if (dataType === 'main') {
                data.lastSaved = new Date().toISOString();
            }
            
            var filePath = self.dataFolderPath + "/" + fileName;
            var dataStr = JSON.stringify(data, null, 2);
            var encodedData = encodeURIComponent(dataStr);
            
            csInterface.evalScript('saveDataToFile("' + filePath + '", "' + encodedData + '")', function(result) {
                if (result === "success") {
                    console.log('数据保存成功 (' + dataType + '):', filePath);
                    if (callback) callback(null, true);
                } else {
                    console.error('数据保存失败 (' + dataType + '):', result);
                    if (callback) callback("保存失败: " + result);
                }
            });
        } catch (e) {
            if (callback) callback("数据序列化失败: " + e.toString());
        }
    },
    
    // 加载所有数据
    loadAllData: function(callback) {
        var self = this;
        var allData = {};
        var dataTypes = Object.keys(self.dataFiles);
        var completed = 0;
        var hasError = false;
        
        function checkComplete() {
            completed++;
            if (completed === dataTypes.length) {
                if (callback) callback(hasError ? "部分数据加载失败" : null, allData);
            }
        }
        
        dataTypes.forEach(function(dataType) {
            self.loadDataByType(dataType, function(error, data) {
                if (error) {
                    console.error('加载数据失败 (' + dataType + '):', error);
                    hasError = true;
                    allData[dataType] = self.defaultData[dataType];
                } else {
                    allData[dataType] = data;
                }
                checkComplete();
            });
        });
    },
    
    // 保存所有数据
    saveAllData: function(allData, callback) {
        var self = this;
        var dataTypes = Object.keys(self.dataFiles);
        var completed = 0;
        var hasError = false;
        var errors = [];
        
        function checkComplete() {
            completed++;
            if (completed === dataTypes.length) {
                if (callback) {
                    if (hasError) {
                        callback("部分数据保存失败: " + errors.join(', '));
                    } else {
                        callback(null, true);
                    }
                }
            }
        }
        
        dataTypes.forEach(function(dataType) {
            var data = allData[dataType] || self.defaultData[dataType];
            self.saveDataByType(dataType, data, function(error) {
                if (error) {
                    console.error('保存数据失败 (' + dataType + '):', error);
                    hasError = true;
                    errors.push(dataType + ': ' + error);
                }
                checkComplete();
            });
        });
    },
    
    // 获取脚本设置
    getScriptSettings: function(scriptPath, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            var scriptSettings = scriptsData[scriptPath] || {
                category: "全部",
                tags: [],
                customName: null,
                description: null,
                imagePath: null,
                lastModified: null
            };
            
            // 功能：显示名处理-读取-02
            try {
                if (scriptSettings && typeof scriptSettings.customName === 'string' && scriptSettings.customName) {
                    scriptSettings.customName = self.safeDecodeDisplayName(scriptSettings.customName);
                }
            } catch (e) {
                console.warn('显示名处理-读取-02: 安全解码失败，忽略', e);
            }
            
            if (callback) callback(null, scriptSettings);
        });
    },
    
    // 保存脚本设置
    saveScriptSettings: function(scriptPath, settings, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 功能：显示名处理-保存-03
            var normalizedSettings = settings;
            try {
                if (settings && typeof settings === 'object') {
                    normalizedSettings = Object.assign({}, settings);
                    if (typeof normalizedSettings.customName === 'string') {
                        normalizedSettings.customName = self.safeDecodeDisplayName(normalizedSettings.customName);
                    }
                }
            } catch (e) {
                console.warn('显示名处理-保存-03: 规范化失败，回退为原设置对象', e);
                normalizedSettings = settings;
            }
            
            scriptsData[scriptPath] = normalizedSettings;
            
            self.saveDataByType('scripts', scriptsData, callback);
        });
    },
    
    // 删除脚本设置（当脚本被删除时调用）
    removeScriptSettings: function(scriptPath, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (scriptsData[scriptPath]) {
                delete scriptsData[scriptPath];
                console.log('已清理脚本设置:', scriptPath);
                
                self.saveDataByType('scripts', scriptsData, callback);
            } else {
                if (callback) callback(null, true);
            }
        });
    },
    
    // 清理不存在的脚本设置
    cleanupOrphanedScriptSettings: function(existingScriptPaths, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            var cleaned = false;
            var scriptPaths = Object.keys(scriptsData);
            
            scriptPaths.forEach(function(scriptPath) {
                if (existingScriptPaths.indexOf(scriptPath) === -1) {
                    delete scriptsData[scriptPath];
                    cleaned = true;
                    console.log('清理孤立脚本设置:', scriptPath);
                }
            });
            
            if (cleaned) {
                self.saveDataByType('scripts', scriptsData, function(saveError) {
                    if (callback) callback(saveError, cleaned);
                });
            } else {
                if (callback) callback(null, false);
            }
        });
    },
    
    // 从旧数据系统迁移数据
    checkAndMigrateOldData: function(callback) {
        var self = this;
        
        // 检查是否已经迁移过
        self.loadDataByType('main', function(error, mainData) {
            if (!error && mainData.dataStorageVersion === "local_v1") {
                // 已经是新版本，无需迁移
                if (callback) callback(null);
                return;
            }
            
            // 尝试从旧的DataManager加载数据
            if (typeof DataManager !== 'undefined' && DataManager.loadData) {
                DataManager.init(function(initError) {
                    if (initError) {
                        console.log('旧数据系统不可用，使用默认数据');
                        if (callback) callback(null);
                        return;
                    }
                    
                    DataManager.loadData(function(loadError, oldData) {
                        if (loadError || !oldData) {
                            console.log('无旧数据需要迁移');
                            if (callback) callback(null);
                            return;
                        }
                        
                        console.log('开始迁移旧数据到本地存储...');
                        self.migrateFromOldData(oldData, callback);
                    });
                });
            } else {
                if (callback) callback(null);
            }
        });
    },
    
    // 执行数据迁移
    migrateFromOldData: function(oldData, callback) {
        var self = this;
        
        // 转换旧数据格式到新格式
        var newData = {
            main: {
                version: "2.0",
                scriptsFolderPath: oldData.scriptsFolderPath,
                autoReadSubfolders: oldData.autoReadSubfolders !== undefined ? oldData.autoReadSubfolders : true,
                lastSaved: new Date().toISOString(),
                dataStorageVersion: "local_v1"
            },
            scripts: oldData.scriptSettings || {},
            categories: oldData.categories || ["全部"],
            tags: oldData.allTags || [],
            backgrounds: {
                currentBackground: null,
                backgroundSettings: oldData.backgroundSettings
            },
            layout: {
                isGridLayout: oldData.layoutSettings ? oldData.layoutSettings.isGridLayout : false,
                currentScale: oldData.layoutSettings ? oldData.layoutSettings.currentScale : 1,
                sidebarWidth: oldData.layoutSettings ? oldData.layoutSettings.sidebarWidth : 100,
                scriptOrder: oldData.scriptOrder || []
            }
        };
        
        // 保存迁移后的数据
        self.saveAllData(newData, function(saveError) {
            if (saveError) {
                console.error('数据迁移失败:', saveError);
                if (callback) callback(saveError);
            } else {
                console.log('数据迁移完成');
                if (callback) callback(null);
            }
        });
    },
    
    // 创建数据备份
    createBackup: function(callback) {
        var self = this;
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        var backupFolderPath = self.dataFolderPath + "/backups/" + timestamp;
        
        csInterface.evalScript('createDataBackupFolder("' + self.dataFolderPath + '", "' + backupFolderPath + '")', function(result) {
            if (result === "success") {
                console.log('数据备份创建成功:', backupFolderPath);
                if (callback) callback(null, backupFolderPath);
            } else {
                console.error('数据备份失败:', result);
                if (callback) callback("备份失败: " + result);
            }
        });
    },
    
    // 兼容性方法：loadData - 加载合并后的数据（与原DataManager API兼容）
    loadData: function(callback) {
        var self = this;
        self.loadAllData(function(error, allData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 将分散的数据合并为单一对象，保持与原DataManager的兼容性
            var mergedData = {
                version: allData.main.version,
                scriptsFolderPath: allData.main.scriptsFolderPath,
                autoReadSubfolders: allData.main.autoReadSubfolders,
                lastSaved: allData.main.lastSaved,
                dataStorageVersion: allData.main.dataStorageVersion,
                
                scriptSettings: allData.scripts,
                categories: allData.categories,
                allTags: allData.tags,
                backgroundSettings: allData.backgrounds.backgroundSettings,
                
                layoutSettings: {
                    isGridLayout: allData.layout.isGridLayout,
                    currentScale: allData.layout.currentScale,
                    sidebarWidth: allData.layout.sidebarWidth
                },
                scriptOrder: allData.layout.scriptOrder
            };
            
            if (callback) callback(null, mergedData);
        });
    },
    
    // 兼容性方法：saveData - 保存合并后的数据（与原DataManager API兼容）
    saveData: function(mergedData, callback) {
        var self = this;
        
        try {
            // 将合并的数据分解为分散的数据结构
            var allData = {
                main: {
                    version: mergedData.version || "2.0",
                    scriptsFolderPath: mergedData.scriptsFolderPath,
                    autoReadSubfolders: mergedData.autoReadSubfolders !== undefined ? mergedData.autoReadSubfolders : true,
                    lastSaved: new Date().toISOString(),
                    dataStorageVersion: "local_v1"
                },
                scripts: mergedData.scriptSettings || {},
                categories: mergedData.categories || ["全部"],
                tags: mergedData.allTags || [],
                backgrounds: {
                    currentBackground: null,
                    backgroundSettings: mergedData.backgroundSettings
                },
                layout: {
                    isGridLayout: mergedData.layoutSettings ? mergedData.layoutSettings.isGridLayout : false,
                    currentScale: mergedData.layoutSettings ? mergedData.layoutSettings.currentScale : 1,
                    sidebarWidth: mergedData.layoutSettings ? mergedData.layoutSettings.sidebarWidth : 100,
                    scriptOrder: mergedData.scriptOrder || []
                }
            };
            
            self.saveAllData(allData, callback);
        } catch (e) {
            if (callback) callback("数据转换失败: " + e.toString());
        }
    },
    
    // 兼容性方法：isAvailable - 检查数据管理器是否可用
    isAvailable: function() {
        return this.initialized;
    },
    
    // 兼容性方法：setData - 设置特定数据项
    setData: function(key, value, callback) {
        var self = this;
        self.loadData(function(error, data) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            data[key] = value;
            self.saveData(data, callback);
        });
    },
    
    // 兼容性方法：getData - 获取特定数据项
    getData: function(key, callback) {
        var self = this;
        self.loadData(function(error, data) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (callback) callback(null, data[key]);
        });
    },

    // 导出所有数据
    exportAllData: function(callback) {
        var self = this;
        self.loadAllData(function(error, allData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 移除敏感信息
            var exportData = JSON.parse(JSON.stringify(allData));
            if (exportData.main && exportData.main.scriptsFolderPath) {
                delete exportData.main.scriptsFolderPath;
            }
            
            if (callback) callback(null, exportData);
        });
    },
    
    // 导入数据
    importAllData: function(importedData, callback) {
        var self = this;
        
        try {
            // 创建备份
            self.createBackup(function(backupError) {
                if (backupError) {
                    console.warn('创建备份失败:', backupError);
                }
                
                // 加载当前数据
                self.loadAllData(function(loadError, currentData) {
                    if (loadError) {
                        if (callback) callback(loadError);
                        return;
                    }
                    
                    // 合并导入数据，保留当前的脚本文件夹路径
                    var mergedData = JSON.parse(JSON.stringify(importedData));
                    if (currentData.main && currentData.main.scriptsFolderPath) {
                        mergedData.main.scriptsFolderPath = currentData.main.scriptsFolderPath;
                    }
                    mergedData.main.lastSaved = new Date().toISOString();
                    mergedData.main.dataStorageVersion = "local_v1";
                    
                    // 保存合并后的数据
                    self.saveAllData(mergedData, callback);
                });
            });
        } catch (e) {
            if (callback) callback("导入失败: " + e.toString());
        }
    }
};

// 导出本地数据管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalDataManager;
}