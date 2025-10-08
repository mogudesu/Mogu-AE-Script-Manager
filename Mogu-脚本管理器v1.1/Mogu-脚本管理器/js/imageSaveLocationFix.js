/**
 * 图片保存位置设置修复器 - 专门解决图片保存位置丢失问题
 * Image Save Location Fix - Specifically fixes image save location persistence issue
 * 
 * 功能概述：
 * - 专门保护图片保存位置设置
 * - 多重存储确保设置不丢失
 * - 实时监控设置变化
 * - 自动恢复丢失的设置
 */

var ImageSaveLocationFix = {
    // 初始化状态
    initialized: false,
    
    // 当前设置缓存
    currentSettings: {
        imageSaveLocation: 'documents',  // 默认值
        customLocationPath: ''
    },
    
    // 存储键名
    storageKeys: {
        primary: 'mogu_image_save_location',
        backup: 'mogu_image_save_backup',
        timestamp: 'mogu_image_save_timestamp'
    },
    
    // 监控定时器
    monitorTimer: null,
    
    /**
     * 初始化图片保存位置修复器
     * 功能：图片保存修复器-初始化-01
     */
    init: function() {
        var self = this;
        
        console.log('ImageSaveLocationFix: 开始初始化图片保存位置修复器...');
        
        if (self.initialized) {
            console.log('ImageSaveLocationFix: 已经初始化过了');
            return;
        }
        
        // 加载现有设置
        self.loadSettings();
        
        // 应用设置到界面
        self.applySettingsToUI();
        
        // 监听界面变化
        self.setupUIListeners();
        
        // 启动监控
        self.startMonitoring();
        
        // 设置页面卸载时的保存
        self.setupUnloadHandler();
        
        self.initialized = true;
        console.log('ImageSaveLocationFix: 图片保存位置修复器初始化完成');
    },
    
    /**
     * 加载设置
     * 功能：图片保存修复器-加载-01
     */
    loadSettings: function() {
        var self = this;
        
        console.log('ImageSaveLocationFix: 开始加载图片保存位置设置...');
        
        // 尝试从多个存储位置加载
        var loadedSettings = null;
        
        // 1. 从 localStorage 加载
        try {
            var primaryData = localStorage.getItem(self.storageKeys.primary);
            if (primaryData) {
                loadedSettings = JSON.parse(primaryData);
                console.log('ImageSaveLocationFix: 从 localStorage 加载成功');
            }
        } catch (e) {
            console.warn('ImageSaveLocationFix: localStorage 加载失败:', e);
        }
        
        // 2. 如果主存储失败，尝试备份存储
        if (!loadedSettings) {
            try {
                var backupData = localStorage.getItem(self.storageKeys.backup);
                if (backupData) {
                    loadedSettings = JSON.parse(backupData);
                    console.log('ImageSaveLocationFix: 从备份存储加载成功');
                }
            } catch (e) {
                console.warn('ImageSaveLocationFix: 备份存储加载失败:', e);
            }
        }
        
        // 3. 如果都失败，尝试从 SettingsManager 加载
        if (!loadedSettings && typeof SettingsManager !== 'undefined' && SettingsManager.initialized) {
            try {
                var imageSaveLocation = SettingsManager.getSetting('imageSettings.defaultSavePath');
                if (imageSaveLocation) {
                    loadedSettings = {
                        imageSaveLocation: self.mapPathToLocation(imageSaveLocation),
                        customLocationPath: imageSaveLocation.startsWith('custom:') ? imageSaveLocation.substring(7) : ''
                    };
                    console.log('ImageSaveLocationFix: 从 SettingsManager 加载成功');
                }
            } catch (e) {
                console.warn('ImageSaveLocationFix: SettingsManager 加载失败:', e);
            }
        }
        
        // 4. 如果都失败，尝试从界面读取当前状态
        if (!loadedSettings) {
            loadedSettings = self.readSettingsFromUI();
            console.log('ImageSaveLocationFix: 从界面读取当前状态');
        }
        
        // 应用加载的设置
        if (loadedSettings) {
            self.currentSettings = loadedSettings;
            console.log('ImageSaveLocationFix: 设置加载完成:', self.currentSettings);
        } else {
            console.log('ImageSaveLocationFix: 使用默认设置');
        }
    },
    
    /**
     * 从界面读取当前设置
     * 功能：图片保存修复器-界面读取-01
     * @returns {Object} 当前界面设置
     */
    readSettingsFromUI: function() {
        try {
            var locationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
            var customPathInput = document.getElementById('customLocationPath');
            
            var selectedLocation = 'documents'; // 默认值
            for (var i = 0; i < locationRadios.length; i++) {
                if (locationRadios[i].checked) {
                    selectedLocation = locationRadios[i].value;
                    break;
                }
            }
            
            var customPath = customPathInput ? customPathInput.value : '';
            
            return {
                imageSaveLocation: selectedLocation,
                customLocationPath: customPath
            };
        } catch (e) {
            console.error('ImageSaveLocationFix: 从界面读取设置失败:', e);
            return null;
        }
    },
    
    /**
     * 将路径映射到位置类型
     * 功能：图片保存修复器-路径映射-01
     * @param {string} path - 路径字符串
     * @returns {string} 位置类型
     */
    mapPathToLocation: function(path) {
        if (!path) return 'documents';
        
        if (path === 'desktop') return 'desktop';
        if (path === 'documents') return 'documents';
        if (path === 'projectFile') return 'projectFile';
        if (path.startsWith('custom:')) return 'custom';
        
        // 如果是具体路径，判断为自定义
        if (path.includes('/') || path.includes('\\')) return 'custom';
        
        return 'documents';
    },
    
    /**
     * 应用设置到界面
     * 功能：图片保存修复器-界面应用-01
     */
    applySettingsToUI: function() {
        var self = this;
        
        try {
            console.log('ImageSaveLocationFix: 应用设置到界面:', self.currentSettings);
            
            // 设置单选按钮
            var locationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
            for (var i = 0; i < locationRadios.length; i++) {
                var radio = locationRadios[i];
                radio.checked = (radio.value === self.currentSettings.imageSaveLocation);
            }
            
            // 设置自定义路径
            var customPathInput = document.getElementById('customLocationPath');
            if (customPathInput) {
                customPathInput.value = self.currentSettings.customLocationPath || '';
            }
            
            // 显示/隐藏自定义路径容器
            var customContainer = document.getElementById('customLocationContainer');
            if (customContainer) {
                customContainer.style.display = (self.currentSettings.imageSaveLocation === 'custom') ? 'block' : 'none';
            }
            
            console.log('ImageSaveLocationFix: 界面设置应用完成');
        } catch (e) {
            console.error('ImageSaveLocationFix: 应用设置到界面失败:', e);
        }
    },
    
    /**
     * 设置界面监听器
     * 功能：图片保存修复器-监听器-01
     */
    setupUIListeners: function() {
        var self = this;
        
        try {
            // 监听单选按钮变化
            var locationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
            for (var i = 0; i < locationRadios.length; i++) {
                locationRadios[i].addEventListener('change', function() {
                    console.log('ImageSaveLocationFix: 检测到位置选择变化:', this.value);
                    self.currentSettings.imageSaveLocation = this.value;
                    
                    // 显示/隐藏自定义路径容器
                    var customContainer = document.getElementById('customLocationContainer');
                    if (customContainer) {
                        customContainer.style.display = (this.value === 'custom') ? 'block' : 'none';
                    }
                    
                    // 立即保存
                    self.saveSettings();
                });
            }
            
            // 监听自定义路径输入变化
            var customPathInput = document.getElementById('customLocationPath');
            if (customPathInput) {
                customPathInput.addEventListener('input', function() {
                    console.log('ImageSaveLocationFix: 检测到自定义路径变化:', this.value);
                    self.currentSettings.customLocationPath = this.value;
                    
                    // 延迟保存（避免频繁保存）
                    clearTimeout(self.saveTimeout);
                    self.saveTimeout = setTimeout(function() {
                        self.saveSettings();
                    }, 1000);
                });
                
                customPathInput.addEventListener('blur', function() {
                    // 失去焦点时立即保存
                    self.saveSettings();
                });
            }
            
            // 监听选择文件夹按钮
            var selectCustomBtn = document.getElementById('selectCustomLocationBtn');
            if (selectCustomBtn) {
                selectCustomBtn.addEventListener('click', function() {
                    // 延迟保存，等待路径选择完成
                    setTimeout(function() {
                        var customPathInput = document.getElementById('customLocationPath');
                        if (customPathInput) {
                            self.currentSettings.customLocationPath = customPathInput.value;
                            self.saveSettings();
                        }
                    }, 500);
                });
            }
            
            console.log('ImageSaveLocationFix: 界面监听器设置完成');
        } catch (e) {
            console.error('ImageSaveLocationFix: 设置界面监听器失败:', e);
        }
    },
    
    /**
     * 保存设置
     * 功能：图片保存修复器-保存-01
     */
    saveSettings: function() {
        var self = this;
        
        try {
            console.log('ImageSaveLocationFix: 开始保存图片保存位置设置:', self.currentSettings);
            
            var settingsData = JSON.stringify(self.currentSettings);
            var timestamp = new Date().toISOString();
            
            // 1. 保存到主存储
            try {
                localStorage.setItem(self.storageKeys.primary, settingsData);
                localStorage.setItem(self.storageKeys.timestamp, timestamp);
                console.log('ImageSaveLocationFix: 主存储保存成功');
            } catch (e) {
                console.error('ImageSaveLocationFix: 主存储保存失败:', e);
            }
            
            // 2. 保存到备份存储
            try {
                localStorage.setItem(self.storageKeys.backup, settingsData);
                console.log('ImageSaveLocationFix: 备份存储保存成功');
            } catch (e) {
                console.error('ImageSaveLocationFix: 备份存储保存失败:', e);
            }
            
            // 3. 同步到 SettingsManager（如果可用）
            if (typeof SettingsManager !== 'undefined' && SettingsManager.initialized) {
                try {
                    var pathValue = self.getPathValue();
                    SettingsManager.setSetting('imageSettings.defaultSavePath', pathValue, function(error) {
                        if (error) {
                            console.error('ImageSaveLocationFix: SettingsManager 同步失败:', error);
                        } else {
                            console.log('ImageSaveLocationFix: SettingsManager 同步成功');
                        }
                    });
                } catch (e) {
                    console.error('ImageSaveLocationFix: SettingsManager 同步异常:', e);
                }
            }
            
            // 4. 同步到 LocalDataManager（如果可用）
            if (typeof LocalDataManager !== 'undefined' && LocalDataManager.initialized) {
                try {
                    LocalDataManager.loadDataByType('main', function(error, mainData) {
                        if (!error && mainData) {
                            if (!mainData.userSettings) mainData.userSettings = {};
                            if (!mainData.userSettings.imageSettings) mainData.userSettings.imageSettings = {};
                            
                            mainData.userSettings.imageSettings.defaultSavePath = self.getPathValue();
                            mainData.userSettings.imageSettings.imageSaveLocation = self.currentSettings.imageSaveLocation;
                            mainData.userSettings.imageSettings.customLocationPath = self.currentSettings.customLocationPath;
                            
                            LocalDataManager.saveDataByType('main', mainData, function(saveError) {
                                if (saveError) {
                                    console.error('ImageSaveLocationFix: LocalDataManager 同步失败:', saveError);
                                } else {
                                    console.log('ImageSaveLocationFix: LocalDataManager 同步成功');
                                }
                            });
                        }
                    });
                } catch (e) {
                    console.error('ImageSaveLocationFix: LocalDataManager 同步异常:', e);
                }
            }
            
            console.log('ImageSaveLocationFix: 设置保存完成');
        } catch (e) {
            console.error('ImageSaveLocationFix: 保存设置失败:', e);
        }
    },
    
    /**
     * 获取路径值
     * 功能：图片保存修复器-路径值-01
     * @returns {string} 路径值
     */
    getPathValue: function() {
        var self = this;
        
        switch (self.currentSettings.imageSaveLocation) {
            case 'desktop':
                return 'desktop';
            case 'documents':
                return 'documents';
            case 'projectFile':
                return 'projectFile';
            case 'custom':
                return 'custom:' + (self.currentSettings.customLocationPath || '');
            default:
                return 'documents';
        }
    },
    
    /**
     * 启动监控
     * 功能：图片保存修复器-监控-01
     */
    startMonitoring: function() {
        var self = this;
        
        // 每5秒检查一次设置是否丢失
        self.monitorTimer = setInterval(function() {
            self.checkAndRestoreSettings();
        }, 5000);
        
        console.log('ImageSaveLocationFix: 监控已启动');
    },
    
    /**
     * 检查并恢复设置
     * 功能：图片保存修复器-检查恢复-01
     */
    checkAndRestoreSettings: function() {
        var self = this;
        
        try {
            // 检查界面设置是否与缓存一致
            var uiSettings = self.readSettingsFromUI();
            if (!uiSettings) return;
            
            var needRestore = false;
            
            // 检查位置选择是否丢失
            if (uiSettings.imageSaveLocation !== self.currentSettings.imageSaveLocation) {
                console.warn('ImageSaveLocationFix: 检测到位置选择丢失，当前:', uiSettings.imageSaveLocation, '应该是:', self.currentSettings.imageSaveLocation);
                needRestore = true;
            }
            
            // 检查自定义路径是否丢失
            if (self.currentSettings.imageSaveLocation === 'custom' && 
                uiSettings.customLocationPath !== self.currentSettings.customLocationPath) {
                console.warn('ImageSaveLocationFix: 检测到自定义路径丢失，当前:', uiSettings.customLocationPath, '应该是:', self.currentSettings.customLocationPath);
                needRestore = true;
            }
            
            // 如果需要恢复，应用设置到界面
            if (needRestore) {
                console.log('ImageSaveLocationFix: 正在恢复丢失的设置...');
                self.applySettingsToUI();
            }
        } catch (e) {
            console.error('ImageSaveLocationFix: 检查设置时出错:', e);
        }
    },
    
    /**
     * 设置页面卸载处理器
     * 功能：图片保存修复器-卸载处理-01
     */
    setupUnloadHandler: function() {
        var self = this;
        
        window.addEventListener('beforeunload', function() {
            console.log('ImageSaveLocationFix: 页面即将卸载，执行最终保存...');
            
            // 从界面读取最新设置
            var latestSettings = self.readSettingsFromUI();
            if (latestSettings) {
                self.currentSettings = latestSettings;
            }
            
            // 执行最终保存
            self.saveSettings();
            
            // 清理定时器
            if (self.monitorTimer) {
                clearInterval(self.monitorTimer);
            }
        });
    },
    
    /**
     * 强制保存当前界面设置
     * 功能：图片保存修复器-强制保存-01
     */
    forceSave: function() {
        var self = this;
        
        console.log('ImageSaveLocationFix: 执行强制保存...');
        
        // 从界面读取最新设置
        var latestSettings = self.readSettingsFromUI();
        if (latestSettings) {
            self.currentSettings = latestSettings;
        }
        
        // 立即保存
        self.saveSettings();
    },
    
    /**
     * 获取当前设置
     * 功能：图片保存修复器-获取设置-01
     * @returns {Object} 当前设置
     */
    getCurrentSettings: function() {
        return JSON.parse(JSON.stringify(this.currentSettings));
    },
    
    /**
     * 设置图片保存位置
     * 功能：图片保存修复器-设置位置-01
     * @param {string} location - 位置类型
     * @param {string} customPath - 自定义路径（可选）
     */
    setImageSaveLocation: function(location, customPath) {
        var self = this;
        
        console.log('ImageSaveLocationFix: 设置图片保存位置:', location, customPath);
        
        self.currentSettings.imageSaveLocation = location;
        if (customPath !== undefined) {
            self.currentSettings.customLocationPath = customPath;
        }
        
        // 应用到界面
        self.applySettingsToUI();
        
        // 保存设置
        self.saveSettings();
    }
};

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            ImageSaveLocationFix.init();
        }, 1000); // 延迟1秒确保其他脚本加载完成
    });
} else {
    setTimeout(function() {
        ImageSaveLocationFix.init();
    }, 1000);
}

// 导出到全局
window.ImageSaveLocationFix = ImageSaveLocationFix;