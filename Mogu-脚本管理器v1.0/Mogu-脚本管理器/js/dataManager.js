// Data Manager - 专门处理数据持久化的模块
// 类似RTFX资产包的数据管理方式

// 数据管理器对象
var DataManager = {
    // 数据文件路径
    dataFilePath: null,
    initialized: false,
    
    // 默认数据结构
    defaultData: {
        version: "1.0",
        scriptsFolderPath: null,
        scriptSettings: {},
        categories: ["全部"],
        allTags: [],
        layoutSettings: {
            isGridLayout: false,
            currentScale: 1,
            sidebarWidth: 100
        },
        lastSaved: null
    },
    
    // 初始化数据管理器
    init: function(callback) {
        var self = this;
        if (self.initialized) {
            if (callback) callback(null, true);
            return;
        }
        
        csInterface.evalScript('getExtensionDataPath()', function(result) {
            if (result && result !== 'null') {
                self.dataFilePath = result + "/moguBar_data.json";
                self.initialized = true;
                if (callback) callback(null, true);
            } else {
                if (callback) callback("无法获取扩展数据路径");
            }
        });
    },
    
    // 加载数据
    loadData: function(callback) {
        var self = this;
        if (!self.initialized || !self.dataFilePath) {
            if (callback) callback("数据管理器未初始化");
            return;
        }
        
        csInterface.evalScript('loadDataFromFile("' + self.dataFilePath + '")', function(result) {
            try {
                if (result && result !== 'null' && result !== 'undefined' && result !== '{}') {
                    var data = JSON.parse(result);
                    
                    // 数据版本兼容性检查
                    if (!data.version) {
                        data = self.migrateOldData(data);
                    }
                    
                    // 合并默认数据，确保所有字段都存在
                    data = self.mergeWithDefaults(data);
                    
                    if (callback) callback(null, data);
                } else {
                    // 如果没有数据文件，返回默认数据
                    if (callback) callback(null, JSON.parse(JSON.stringify(self.defaultData)));
                }
            } catch (e) {
                console.error('加载数据失败:', e);
                // 数据损坏时返回默认数据
                if (callback) callback(null, JSON.parse(JSON.stringify(self.defaultData)));
            }
        });
    },
    
    // 保存数据
    saveData: function(data, callback) {
        var self = this;
        if (!self.initialized || !self.dataFilePath) {
            if (callback) callback("数据管理器未初始化");
            return;
        }
        
        try {
            // 添加保存时间戳
            data.lastSaved = new Date().toISOString();
            
            // 数据验证
            if (!self.validateData(data)) {
                if (callback) callback("数据验证失败");
                return;
            }
            
            var dataStr = JSON.stringify(data, null, 2);
            // 使用encodeURIComponent来安全传递JSON数据
            var encodedData = encodeURIComponent(dataStr);
            
            csInterface.evalScript('saveDataToFile("' + self.dataFilePath + '", "' + encodedData + '")', function(result) {
                if (result === "success") {
                    if (callback) callback(null, true);
                } else {
                    if (callback) callback("保存失败: " + result);
                }
            });
        } catch (e) {
            if (callback) callback("数据序列化失败: " + e.toString());
        }
    },
    
    // 数据验证
    validateData: function(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.categories || !Array.isArray(data.categories)) return false;
        if (!data.allTags || !Array.isArray(data.allTags)) return false;
        if (!data.scriptSettings || typeof data.scriptSettings !== 'object') return false;
        return true;
    },
    
    // 合并默认数据
    mergeWithDefaults: function(data) {
        var merged = JSON.parse(JSON.stringify(this.defaultData));
        
        // 递归合并对象
        function deepMerge(target, source) {
            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        if (!target[key] || typeof target[key] !== 'object') {
                            target[key] = {};
                        }
                        deepMerge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        }
        
        deepMerge(merged, data);
        return merged;
    },
    
    // 迁移旧数据格式
    migrateOldData: function(oldData) {
        var newData = JSON.parse(JSON.stringify(this.defaultData));
        
        // 迁移旧字段
        if (oldData.scriptsFolderPath) newData.scriptsFolderPath = oldData.scriptsFolderPath;
        if (oldData.scriptSettings) newData.scriptSettings = oldData.scriptSettings;
        if (oldData.categories) newData.categories = oldData.categories;
        if (oldData.allTags) newData.allTags = oldData.allTags;
        
        return newData;
    },
    
    // 创建数据备份
    createBackup: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            var backupPath = self.dataFilePath.replace('.json', '_backup_' + Date.now() + '.json');
            csInterface.evalScript('createDataBackup("' + self.dataFilePath + '", "' + backupPath + '")', function(result) {
                if (result === "success") {
                    resolve(backupPath);
                } else {
                    reject("备份失败: " + result);
                }
            });
        });
    },
    
    // 导出数据
    exportData: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            self.loadData().then(function(data) {
                // 移除敏感信息
                var exportData = JSON.parse(JSON.stringify(data));
                delete exportData.scriptsFolderPath; // 路径可能包含用户信息
                
                resolve(exportData);
            }).catch(reject);
        });
    },
    
    // 导入数据
    importData: function(importedData) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // 验证导入数据
                if (!self.validateData(importedData)) {
                    reject("导入数据格式无效");
                    return;
                }
                
                // 创建备份
                self.createBackup().then(function() {
                    // 合并导入数据
                    return self.loadData();
                }).then(function(currentData) {
                    var mergedData = self.mergeWithDefaults(importedData);
                    // 保留当前的文件夹路径
                    mergedData.scriptsFolderPath = currentData.scriptsFolderPath;
                    
                    return self.saveData(mergedData);
                }).then(function() {
                    resolve(true);
                }).catch(reject);
            } catch (e) {
                reject("导入失败: " + e.toString());
            }
        });
    }
};

// 导出数据管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}