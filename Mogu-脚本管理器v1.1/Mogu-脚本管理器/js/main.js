// Mogu Script Launcher CEP Extension
// Main JavaScript file

// Global variables
var csInterface = new CSInterface();
var scriptsFolderPath = null;
var presetFolderPath = null;
var scriptFiles = [];
var scriptSettings = {};
var categories = ["全部"];
var currentCategory = "全部";
var searchKeyword = "";
var allTags = [];
var activeTags = [];
var scriptOrder = []; // 新增：脚本拖拽顺序存储
var aeVersionInfo = null; // AE版本信息

// DOM elements
var settingsBtn, settingsModal, closeBtnSettings, selectFolderPathBtn, folderPathInput, confirmFolderPathBtn;
var backgroundModal, closeBtnBackground, backgroundFileInput, selectBackgroundBtn, clearBackgroundBtn;
var backgroundPreview, previewImage, previewVideo, blurSlider, brightnessSlider, opacitySlider, cardOpacitySlider, applyBackgroundBtn;
var imageEditor, imageCanvas, cropBox, backgroundFitRadios;
var blurValue, brightnessValue, opacityValue, cardOpacityValue;
var currentBackgroundFile = null;
var backgroundSettings = { 
    blur: 0, 
    brightness: 0, 
    opacity: 50, 
    cardOpacity: 80,
    fit: 'cover',
    customPosition: { x: 0, y: 0, width: 100, height: 100, scale: 1 }
};
var searchInput, clearSearchBtn;
var tagsPanel, addTagBtn, categoryList, addCategoryBtn, scriptList;
var contextMenu, dialogOverlay, layoutToggleBtn, sizeSlider, sidebarResizer, exportBtn, importBtn;
var prevThemeBtn, nextThemeBtn, currentThemeDisplay;
var isGridLayout = false;
var currentScale = 1;

// 图片编辑器拖拽相关变量
var isDragging = false;
var isResizing = false;
var dragStartX = 0;
var dragStartY = 0;
var resizeDirection = '';
var lastMoveTime = 0;
var moveThrottle = 16; // 约60fps的节流
var draggedElement = null;
var draggedType = null;
var currentTheme = 'dark';

// Clipboard import settings
var clipboardImportEnabled = true;
var imageSaveLocation = 'documents';
var customLocationPath = '';
var clipboardImportElements = {};

// Display control settings
var showCategoryInCard = true;
var showTagsInCard = true;
var displayControlElements = {};

// Available themes
var availableThemes = [
    { name: 'dark', icon: '🌙', title: '暗色主题' },
    { name: 'neumorphism', icon: '🎨', title: '轻拟物主题' },
    { name: 'cute', icon: '🎀', title: '可爱风主题' },
    { name: 'handdrawn', icon: '🎭', title: '手绘风主题' },
    { name: 'glassmorphism-dark', icon: '🔮', title: '深色毛玻璃主题' }
];
var currentThemeIndex = 0;

// Theme switching functions
function switchToNextTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % availableThemes.length;
    applyTheme(availableThemes[currentThemeIndex]);
}

function switchToPreviousTheme() {
    currentThemeIndex = (currentThemeIndex - 1 + availableThemes.length) % availableThemes.length;
    applyTheme(availableThemes[currentThemeIndex]);
}

function applyTheme(theme) {
    currentTheme = theme.name;
    
    // Update current theme display
    currentThemeDisplay.innerHTML = theme.icon;
    currentThemeDisplay.title = '当前主题：' + theme.title;
    
    // Remove existing theme classes
    document.body.classList.remove('theme-dark', 'theme-neumorphism', 'theme-cute', 'theme-handdrawn', 'theme-glassmorphism-dark');
    
    // Apply theme-specific styles
    if (theme.name === 'dark') {
        document.body.classList.add('theme-dark');
    } else if (theme.name === 'neumorphism') {
        document.body.classList.add('theme-neumorphism');
    } else if (theme.name === 'cute') {
        document.body.classList.add('theme-cute');
    } else if (theme.name === 'handdrawn') {
        document.body.classList.add('theme-handdrawn');
    } else if (theme.name === 'glassmorphism-dark') {
        document.body.classList.add('theme-glassmorphism-dark');
    } else {
        // Other themes will show a placeholder message
        showCustomAlert(theme.title + '将在后续版本中实现', false);
        // Revert to dark theme
        setTimeout(function() {
            currentThemeIndex = 0;
            applyTheme(availableThemes[0]);
        }, 100);
        return;
    }
    
    // Re-apply card opacity and UI opacity for the new theme if background is active
    if (document.body.classList.contains('has-background')) {
        // Re-apply card opacity with current settings
        if (typeof backgroundSettings !== 'undefined' && backgroundSettings.cardOpacity) {
            applyCardOpacity(backgroundSettings.cardOpacity);
        }
        // Re-apply UI opacity with current settings
        if (typeof backgroundSettings !== 'undefined' && backgroundSettings.opacity) {
            applyUIOpacity(backgroundSettings.opacity);
        }
    }
    
    // 强制重新渲染脚本列表以确保主题样式正确应用到所有脚本卡片
    setTimeout(function() {
        if (typeof populateScriptList === 'function') {
            populateScriptList();
        }
    }, 100);
    
    // Save theme preference
    saveSettings();
}

function initializeTheme() {
    // Find current theme index
    for (var i = 0; i < availableThemes.length; i++) {
        if (availableThemes[i].name === currentTheme) {
            currentThemeIndex = i;
            break;
        }
    }
    
    // Ensure body has default theme class
    if (!document.body.classList.contains('theme-dark') && !document.body.classList.contains('theme-neumorphism') && !document.body.classList.contains('theme-cute') && !document.body.classList.contains('theme-handdrawn') && !document.body.classList.contains('theme-glassmorphism-dark')) {
        document.body.classList.add('theme-dark');
    }
    
    // Apply current theme
    applyTheme(availableThemes[currentThemeIndex]);
}

// AE版本兼容性检查
function checkAECompatibility() {
    csInterface.evalScript('getAEVersionInfo()', function(result) {
        try {
            aeVersionInfo = JSON.parse(result);
            console.log('AE版本信息:', aeVersionInfo);
            
            if (aeVersionInfo.isLegacyVersion) {
                console.log('检测到旧版本AE (版本 ' + aeVersionInfo.version + ')，启用兼容性模式');
                enableLegacyCompatibilityMode();
            } else {
                console.log('检测到新版本AE (版本 ' + aeVersionInfo.version + ')，使用标准模式');
            }
        } catch (e) {
            console.error('获取AE版本信息失败:', e);
            // 默认启用兼容性模式以确保稳定性
            enableLegacyCompatibilityMode();
        }
    });
}

// 启用旧版本兼容性模式
function enableLegacyCompatibilityMode() {
    console.log('启用AE兼容性模式');
    // 为旧版本AE添加特殊处理
    // 可以在这里添加特定的兼容性处理逻辑
    // 例如：调整剪贴板处理方式、修改API调用等
    
    // 标记为兼容性模式
    window.legacyMode = true;
}

// Initialize the extension
function init() {
    console.log('Init function called');
    // Get DOM elements
    settingsBtn = document.getElementById('settingsBtn');
    settingsModal = document.getElementById('settingsModal');
    closeBtnSettings = document.getElementById('closeBtnSettings');
    selectFolderPathBtn = document.getElementById('selectFolderPathBtn');
    folderPathInput = document.getElementById('folderPathInput');
    confirmFolderPathBtn = document.getElementById('confirmFolderPathBtn');

    // Preset folder elements
    presetFolderPathInput = document.getElementById('presetFolderPathInput');
    selectPresetFolderPathBtn = document.getElementById('selectPresetFolderPathBtn');
    confirmPresetFolderPathBtn = document.getElementById('confirmPresetFolderPathBtn');
    searchInput = document.getElementById('searchInput');
    clearSearchBtn = document.getElementById('clearSearchBtn');
    tagsPanel = document.getElementById('tagsPanel');
    addTagBtn = document.getElementById('addTagBtn');
    categoryList = document.getElementById('categoryList');
    addCategoryBtn = document.getElementById('addCategoryBtn');
    scriptList = document.getElementById('scriptList');
    contextMenu = document.getElementById('contextMenu');
    dialogOverlay = document.getElementById('dialogOverlay');
    layoutToggleBtn = document.getElementById('layoutToggleBtn');
    sizeSlider = document.getElementById('sizeSlider');
    sidebarResizer = document.getElementById('sidebarResizer');
    exportBtn = document.getElementById('exportBtn');
    importBtn = document.getElementById('importBtn');
    prevThemeBtn = document.getElementById('prevThemeBtn');
    nextThemeBtn = document.getElementById('nextThemeBtn');
    currentThemeDisplay = document.getElementById('currentThemeDisplay');
    
    // Background setting elements
    backgroundModal = document.getElementById('backgroundModal');
    closeBtnBackground = document.getElementById('closeBtnBackground');
    backgroundFileInput = document.getElementById('backgroundFileInput');
    selectBackgroundBtn = document.getElementById('selectBackgroundBtn');
    clearBackgroundBtn = document.getElementById('clearBackgroundBtn');
    backgroundPreview = document.getElementById('backgroundPreview');
    previewImage = document.getElementById('previewImage');
    previewVideo = document.getElementById('previewVideo');
    blurSlider = document.getElementById('blurSlider');
    brightnessSlider = document.getElementById('brightnessSlider');
    opacitySlider = document.getElementById('opacitySlider');
    cardOpacitySlider = document.getElementById('cardOpacitySlider');
    applyBackgroundBtn = document.getElementById('applyBackgroundBtn');
    console.log('applyBackgroundBtn element:', applyBackgroundBtn);
    blurValue = document.getElementById('blurValue');
    brightnessValue = document.getElementById('brightnessValue');
    opacityValue = document.getElementById('opacityValue');
    cardOpacityValue = document.getElementById('cardOpacityValue');
    
    // Image editor elements
    imageEditor = document.getElementById('imageEditor');
    imageCanvas = document.getElementById('imageCanvas');
    cropBox = document.getElementById('cropBox');
    backgroundFitRadios = document.querySelectorAll('input[name="backgroundFit"]');
    
    // Clipboard import elements
    clipboardImportElements.enabledCheckbox = document.getElementById('clipboardImportEnabled');
    clipboardImportElements.saveLocationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
    clipboardImportElements.customLocationContainer = document.getElementById('customLocationContainer');
    clipboardImportElements.customLocationPath = document.getElementById('customLocationPath');
    clipboardImportElements.selectCustomLocationBtn = document.getElementById('selectCustomLocationBtn');
    
    // Display control elements
    displayControlElements.showCategoryCheckbox = document.getElementById('showCategoryCheckbox');
    displayControlElements.showTagsCheckbox = document.getElementById('showTagsCheckbox');

    // Set up event listeners
    setupEventListeners();
    
    // 检查AE版本兼容性
    checkAECompatibility();
    
    // Load saved settings (异步操作，在回调中处理UI初始化)
    // 主题会在loadSettings中被应用
    loadSettings();
    
    // 如果没有保存的主题设置，则使用默认主题
    if (!currentTheme) {
        initializeTheme();
    }
    
    // Initialize clipboard import settings
    loadClipboardImportSettings({});
}

// Set up event listeners
function setupEventListeners() {
    // Settings modal
    settingsBtn.addEventListener('click', showSettingsModal);
    
    // 功能检测按钮
    const runDiagnosticsBtn = document.getElementById('runDiagnosticsBtn');
    const closeDiagnosticsBtn = document.getElementById('closeDiagnosticsBtn');
    const retryDiagnosticsBtn = document.getElementById('retryDiagnosticsBtn');
    const exportDiagnosticsBtn = document.getElementById('exportDiagnosticsBtn');
    
    if (runDiagnosticsBtn) {
        runDiagnosticsBtn.addEventListener('click', runSystemDiagnostics);
    }
    if (closeDiagnosticsBtn) {
        closeDiagnosticsBtn.addEventListener('click', hideDiagnosticsModal);
    }
    if (retryDiagnosticsBtn) {
        retryDiagnosticsBtn.addEventListener('click', runSystemDiagnostics);
    }
    if (exportDiagnosticsBtn) {
        exportDiagnosticsBtn.addEventListener('click', exportDiagnosticsReport);
    }
    
    // 禁用设置按钮的拖拽功能
    settingsBtn.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });
    settingsBtn.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    closeBtnSettings.addEventListener('click', hideSettingsModal);
    selectFolderPathBtn.addEventListener('click', selectScriptsFolder);
    if (confirmFolderPathBtn) {
        confirmFolderPathBtn.addEventListener('click', confirmFolderPathFromInput);
    }
    if (folderPathInput) {
        folderPathInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmFolderPathFromInput();
            }
        });
    }

    // Preset folder events
    if (selectPresetFolderPathBtn) {
        selectPresetFolderPathBtn.addEventListener('click', selectPresetFolderPath);
    }
    if (confirmPresetFolderPathBtn) {
        confirmPresetFolderPathBtn.addEventListener('click', confirmPresetFolderPathFromInput);
    }
    if (presetFolderPathInput) {
        presetFolderPathInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPresetFolderPathFromInput();
            }
        });
    }
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            hideSettingsModal();
        }
    });
    
    // Search functionality with debounce to prevent flickering
    var searchTimeout;
    searchInput.addEventListener('input', function() {
        var inputValue = this.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
            // 同步关键字到脚本侧状态，保证跨视图一致
            searchKeyword = inputValue;
            // [顶栏搜索切换]+[步骤]+[1] 根据当前视图切换搜索行为
            if (document.body.classList.contains('show-preset') && typeof window.filterPresetByKeyword === 'function') {
                window.filterPresetByKeyword(inputValue);
            } else {
                populateScriptList();
            }
        }, 150); // 150ms debounce delay
    });
    
    clearSearchBtn.addEventListener('click', function() {
        searchInput.value = '';
        // 同步关键字到脚本侧状态，保证跨视图一致
        searchKeyword = '';
        // [顶栏搜索切换]+[步骤]+[2] 清空时也根据当前视图调用对应刷新
        if (document.body.classList.contains('show-preset') && typeof window.filterPresetByKeyword === 'function') {
            window.filterPresetByKeyword('');
        } else {
            populateScriptList();
        }
    });
    
    // Tags
    addTagBtn.addEventListener('click', showAddTagDialog);
    
    // Categories
    addCategoryBtn.addEventListener('click', showAddCategoryDialog);
    
    // Context menu
    document.addEventListener('click', hideAllContextMenus);
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    
    // Dialog overlay
    dialogOverlay.addEventListener('click', function(e) {
        if (e.target === dialogOverlay) {
            hideDialog();
        }
    });
    
    // Layout toggle
    layoutToggleBtn.addEventListener('click', toggleLayout);
    
    // Size slider
    sizeSlider.addEventListener('input', function() {
        // [脚本界面-滑块守卫]+[步骤]+[1] 仅在脚本模式下响应，避免与预设模式重复计算
        if (document.body.classList.contains('show-preset')) return;
        currentScale = parseFloat(this.value);
        applyScaleToScriptItems();
    });

    // Persist script view scale independently
    sizeSlider.addEventListener('change', function() {
        if (document.body.classList.contains('show-preset')) return; // 仅脚本模式
        var val = parseFloat(this.value);
        if (!isNaN(val) && val > 0) {
            currentScale = val;
            // 本地存储
            try { localStorage.setItem('mogu_ui_scale', val.toString()); } catch (_) {}
            // 完整持久化系统
            try {
                if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.initialized) {
                    SettingsPersistenceComplete.settingsCache = SettingsPersistenceComplete.settingsCache || {};
                    SettingsPersistenceComplete.settingsCache.currentScale = val;
                    SettingsPersistenceComplete.saveAllSettings(function(){
                        try { console.log('SettingsPersistenceComplete: 已保存脚本界面 currentScale=', val); } catch(_) {}
                    });
                }
            } catch (_) {}
            applyScaleToScriptItems();
        }
    });
    
    // Sidebar resizer
    setupSidebarResizer();
    
    // Window resize listener for grid layout adaptation
    window.addEventListener('resize', function() {
        // [脚本界面-滑块守卫]+[步骤]+[2] 预设模式下不处理脚本区的网格自适应，避免双重计算
        if (document.body.classList.contains('show-preset')) return;
        if (isGridLayout) {
            // Debounce resize events to avoid excessive recalculations
            clearTimeout(window.resizeTimeout);
            window.resizeTimeout = setTimeout(function() {
                // Add smooth transition class before layout change
                scriptList.classList.add('grid-resizing');
                applyScaleToScriptItems();
                
                // Remove transition class after animation
                setTimeout(function() {
                    scriptList.classList.remove('grid-resizing');
                }, 450);
            }, 150);
        }
    });
    
    // Import/Export buttons
    exportBtn.addEventListener('click', exportSettings);
    importBtn.addEventListener('click', importSettings);
    
    // Theme switcher
    prevThemeBtn.addEventListener('click', function() {
        switchToPreviousTheme();
    });
    nextThemeBtn.addEventListener('click', function() {
        switchToNextTheme();
    });
    currentThemeDisplay.addEventListener('click', function() {
        showBackgroundModal();
    });
    
    // Background setting modal
    closeBtnBackground.addEventListener('click', hideBackgroundModal);
    selectBackgroundBtn.addEventListener('click', function() {
        backgroundFileInput.click();
    });
    backgroundFileInput.addEventListener('change', handleBackgroundFileSelect);
    clearBackgroundBtn.addEventListener('click', clearBackground);
    blurSlider.addEventListener('input', updateBlurValue);
    brightnessSlider.addEventListener('input', updateBrightnessValue);
    opacitySlider.addEventListener('input', updateOpacityValue);
    cardOpacitySlider.addEventListener('input', updateCardOpacityValue);
    applyBackgroundBtn.addEventListener('click', applyBackgroundSettings);
    console.log('Event listener added to applyBackgroundBtn');
    
    // Background fit options
    backgroundFitRadios.forEach(function(radio) {
        radio.addEventListener('change', handleBackgroundFitChange);
    });
    
    // Image editor events
    setupImageEditorEvents();
    
    // Close background modal when clicking outside
    backgroundModal.addEventListener('click', function(e) {
        if (e.target === backgroundModal) {
            hideBackgroundModal();
        }
    });
    
    // Drag and drop
    setupDragAndDrop();
    
    // Clipboard import settings
    setupClipboardImportListeners();
    
    // Display control settings
    setupDisplayControlListeners();
    
    // Auto read subfolders setting
    setupAutoReadSubfoldersListener();
    
    // Global clipboard paste listener
    document.addEventListener('paste', handleClipboardPaste);
    
    // Global keyboard listener for Ctrl+V
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'v' && clipboardImportEnabled) {
            // Let the paste event handle it
        }
    });
}

// Select scripts folder
function selectScriptsFolder() {
    csInterface.evalScript('selectFolder()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            scriptsFolderPath = result;
            if (folderPathInput) {
                folderPathInput.value = scriptsFolderPath;
            }
            saveSettings();
            populateScriptList();
            hideSettingsModal();
        }
    });
}

function selectPresetFolderPath() {
    csInterface.evalScript('selectFolder()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            presetFolderPath = result;
            if (presetFolderPathInput) {
                presetFolderPathInput.value = presetFolderPath;
            }
            saveSettings();
        }
    });
}

// 直接输入路径并确认保存
function confirmFolderPathFromInput() {
    try {
        if (!folderPathInput) return;
        var inputPath = (folderPathInput.value || '').trim();
        if (!inputPath) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('请输入有效的文件夹路径', true);
            } else {
                console.warn('请输入有效的文件夹路径');
            }
            return;
        }
        // 使用ExtendScript验证路径是否存在且为文件夹
        var safePath = inputPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        var jsx = 'try{var f=new Folder("' + safePath + '");var r={exists:f.exists,fsName:f.fsName};JSON.stringify(r);}catch(e){JSON.stringify({error:String(e)})}';
        csInterface.evalScript(jsx, function(res) {
            try {
                var info = null;
                if (res && res !== 'null' && res !== 'undefined') {
                    info = JSON.parse(res);
                }
                if (info && info.exists) {
                    scriptsFolderPath = info.fsName || inputPath;
                    folderPathInput.value = scriptsFolderPath;
                    saveSettings();
                    populateScriptList();
                    if (typeof showNotification === 'function') {
                        showNotification('脚本路径已保存', false);
                    } else {
                        console.log('脚本路径已保存:', scriptsFolderPath);
                    }
                } else {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('路径不存在或不可访问，请检查后重试', true);
                    } else {
                        console.error('路径不存在或不可访问:', inputPath);
                    }
                }
            } catch (e) {
                console.error('验证路径解析失败:', e, res);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('验证路径失败：' + e.message, true);
                }
            }
        });
    } catch (err) {
        console.error('confirmFolderPathFromInput 异常:', err);
    }
}

function confirmPresetFolderPathFromInput() {
    try {
        if (!presetFolderPathInput) return;
        var inputPath = (presetFolderPathInput.value || '').trim();
        if (!inputPath) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('请输入有效的预设文件夹路径', true);
            } else {
                console.warn('请输入有效的预设文件夹路径');
            }
            return;
        }
        var safePath = inputPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        var jsx = 'try{var f=new Folder("' + safePath + '");var r={exists:f.exists,fsName:f.fsName};JSON.stringify(r);}catch(e){JSON.stringify({error:String(e)})}';
        csInterface.evalScript(jsx, function(res) {
            try {
                var info = null;
                if (res && res !== 'null' && res !== 'undefined') {
                    info = JSON.parse(res);
                }
                if (info && info.exists) {
                    presetFolderPath = info.fsName || inputPath;
                    if (presetFolderPathInput) {
                        presetFolderPathInput.value = presetFolderPath;
                    }
                    saveSettings();
                    if (typeof showNotification === 'function') {
                        showNotification('预设路径已保存', false);
                    } else {
                        console.log('预设路径已保存:', presetFolderPath);
                    }
                } else {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('路径不存在或不可访问，请检查后重试', true);
                    } else {
                        console.error('路径不存在或不可访问:', inputPath);
                    }
                }
            } catch (e) {
                console.error('验证路径解析失败:', e, res);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('验证路径失败：' + e.message, true);
                }
            }
        });
    } catch (err) {
        console.error('confirmPresetFolderPathFromInput 异常:', err);
    }
}
    
// Populate script list
function populateScriptList() {
    if (!scriptsFolderPath) {
        scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">请先选择脚本文件夹</div></div></div>';
        return;
    }
    
    // 添加调试日志
    console.log('populateScriptList: 开始加载脚本列表');
    console.log('populateScriptList: DataManager状态 - 存在:', typeof DataManager !== 'undefined', '初始化:', typeof DataManager !== 'undefined' ? DataManager.initialized : false);
    
    // 获取autoReadSubfolders设置的通用函数
    function loadScriptsWithSettings(includeSubfolders) {
        console.log('populateScriptList: 使用设置 includeSubfolders =', includeSubfolders);
        
        var scriptCall = 'getScriptFiles("' + scriptsFolderPath.replace(/\\/g, '\\\\') + '", ' + includeSubfolders + ')';
        csInterface.evalScript(scriptCall, function(result) {
            if (result && result !== 'null' && result !== 'undefined') {
                try {
                    scriptFiles = JSON.parse(result);
                    console.log('populateScriptList: 成功加载', scriptFiles.length, '个脚本文件');
                    renderScriptList();
                    // Apply scale and spacing after rendering
                    setTimeout(function() {
                        applyScaleToScriptItems();
                    }, 10);
                } catch (e) {
                    console.error('Error parsing script files:', e);
                    scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">解析脚本文件失败</div></div></div>';
                }
            } else {
                scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">未找到脚本文件</div></div></div>';
            }
        });
    }
    
    // 尝试从多个来源获取autoReadSubfolders设置
    function getAutoReadSubfoldersSettings(callback) {
        var includeSubfolders = true; // 默认值
        
        // 方法1：优先从UI元素获取当前状态（确保实时更新）
        var autoReadSubfoldersCheckbox = document.getElementById('autoReadSubfolders');
        if (autoReadSubfoldersCheckbox) {
            includeSubfolders = autoReadSubfoldersCheckbox.checked;
            console.log('populateScriptList: 从UI元素获取设置值 =', includeSubfolders, '(优先级最高)');
            callback(includeSubfolders);
            return;
        }
        
        // 方法2：尝试从DataManager获取
        if (typeof DataManager !== 'undefined' && DataManager.initialized) {
            console.log('populateScriptList: 从DataManager获取设置');
            DataManager.loadData(function(error, data) {
                if (!error && data && data.hasOwnProperty('autoReadSubfolders')) {
                    includeSubfolders = data.autoReadSubfolders;
                    console.log('populateScriptList: DataManager设置值 =', includeSubfolders);
                } else {
                    console.log('populateScriptList: DataManager中未找到autoReadSubfolders设置，使用默认值');
                }
                callback(includeSubfolders);
            });
            return;
        }
        
        // 方法3：尝试从localStorage获取（如果有的话）
        try {
            var savedSettings = localStorage.getItem('moguScriptLauncher_settings');
            if (savedSettings) {
                var settings = JSON.parse(savedSettings);
                if (settings.hasOwnProperty('autoReadSubfolders')) {
                    includeSubfolders = settings.autoReadSubfolders;
                    console.log('populateScriptList: 从localStorage获取设置值 =', includeSubfolders);
                    callback(includeSubfolders);
                    return;
                }
            }
        } catch (e) {
            console.log('populateScriptList: localStorage读取失败:', e);
        }
        
        // 方法4：使用默认值
        console.log('populateScriptList: 所有方法都失败，使用默认值 =', includeSubfolders);
        callback(includeSubfolders);
    }
    
    // 获取设置并加载脚本
    getAutoReadSubfoldersSettings(function(includeSubfolders) {
        loadScriptsWithSettings(includeSubfolders);
    });
}

// 字符串工具：尝试对可能被URI编码的字符串进行安全解码
// 目的：修复列表中脚本名显示为 AE%20Export%20Spine%20JSON.jsx 等百分号编码形式
// 说明：仅当检测到存在%XX序列时才尝试decodeURIComponent，失败则回退原值
function decodePossiblyEncoded(str) {
    try {
        if (!str || typeof str !== 'string') return str;
        if (/%[0-9A-Fa-f]{2}/.test(str)) {
            return decodeURIComponent(str);
        }
        return str;
    } catch (e) {
        // 解码失败时返回原值，避免打断渲染流程
        return str;
    }
}

// Render script list
function renderScriptList() {
    scriptList.innerHTML = '';
    
    var filteredScripts = scriptFiles.filter(function(script) {
        var scriptIdentifier = script.path; // Use full path as unique identifier
        
        // Category filter
        var scriptCategory = getScriptSetting(scriptIdentifier, 'category') || '';
        if (currentCategory !== '全部' && scriptCategory !== currentCategory) {
            return false;
        }
        
        // Search filter
        if (searchKeyword) {
            var displayName = getScriptSetting(scriptIdentifier, 'displayName') || script.name;
            // 修复：对可能被URI编码的显示名做一次安全解码，再参与搜索匹配
            displayName = decodePossiblyEncoded(displayName);
            if (displayName.toLowerCase().indexOf(searchKeyword.toLowerCase()) === -1) {
                return false;
            }
        }
        
        // Tag filter (AND logic)
        if (activeTags.length > 0) {
            var scriptTags = getScriptSetting(scriptIdentifier, 'tags') || [];
            var tagMatch = true;
            for (var i = 0; i < activeTags.length; i++) {
                var hasTag = false;
                for (var j = 0; j < scriptTags.length; j++) {
                    if (scriptTags[j] === activeTags[i]) {
                        hasTag = true;
                        break;
                    }
                }
                if (!hasTag) {
                    tagMatch = false;
                    break;
                }
            }
            if (!tagMatch) {
                return false;
            }
        }
        
        return true;
    });
    
    if (filteredScripts.length === 0) {
        scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">没有找到匹配的脚本</div></div></div>';
        return;
    }

    // Sort scripts according to scriptOrder
    if (scriptOrder.length > 0) {
        filteredScripts.sort(function(a, b) {
            var indexA = scriptOrder.indexOf(a.name);
            var indexB = scriptOrder.indexOf(b.name);
            
            // If both scripts are in the order array, sort by their position
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // If only one script is in the order array, prioritize it
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // If neither script is in the order array, maintain original order
            return 0;
        });
    }

    filteredScripts.forEach(function(script) {
        var scriptItem = createScriptItem(script);
        scriptList.appendChild(scriptItem);
    });
    
    // Apply scale and spacing after all items are added
    setTimeout(function() {
        applyScaleToScriptItems();
    }, 10);
}

// Create script item element
function createScriptItem(script) {
    var item = document.createElement('div');
    item.className = 'script-item';
    item.dataset.scriptPath = script.path;
    item.dataset.scriptName = script.name;
    
    var scriptIdentifier = script.path; // Use full path as unique identifier
    var displayName = getScriptSetting(scriptIdentifier, 'displayName') || script.name;
    // 修复：对可能被URI编码的显示名做一次安全解码，用于界面展示
    displayName = decodePossiblyEncoded(displayName);
    var description = getScriptSetting(scriptIdentifier, 'description') || '';
    var imagePath = getScriptSetting(scriptIdentifier, 'imagePath') || '';
    var category = getScriptSetting(scriptIdentifier, 'category') || '';
    var tags = getScriptSetting(scriptIdentifier, 'tags') || [];
    
    // Create icon
    var iconDiv = document.createElement('div');
    iconDiv.className = 'script-icon';
    if (imagePath) {
        var img = document.createElement('img');
        img.src = imagePath;
        img.alt = displayName;
        iconDiv.appendChild(img);
    } else {
        iconDiv.textContent = '📄';
    }
    
    // Create info container
    var infoDiv = document.createElement('div');
    infoDiv.className = 'script-info';
    
    // Create name
    var nameDiv = document.createElement('div');
    nameDiv.className = 'script-name';
    nameDiv.textContent = displayName;
    infoDiv.appendChild(nameDiv);
    
    // Create category and tags row for list mode
    var metaDiv = document.createElement('div');
    metaDiv.className = 'script-meta';
    
    // Add category to meta row (only for list mode)
    if (category && showCategoryInCard) {
        var categorySpan = document.createElement('span');
        categorySpan.className = 'script-category script-category-list';
        categorySpan.textContent = category;
        categorySpan.title = category;
        metaDiv.appendChild(categorySpan);
    }
    
    infoDiv.appendChild(metaDiv);
    
    // Create description
    var descDiv = document.createElement('div');
    descDiv.className = 'script-description';
    descDiv.textContent = description;
    infoDiv.appendChild(descDiv);
    
    // Create tags
    if (tags.length > 0 && showTagsInCard) {
        var tagsDiv = document.createElement('div');
        tagsDiv.className = 'script-tags';
        
        tags.forEach(function(tag) {
            var tagSpan = document.createElement('span');
            tagSpan.className = 'script-tag';
            tagSpan.textContent = tag;
            tagsDiv.appendChild(tagSpan);
        });
        
        infoDiv.appendChild(tagsDiv);
    }
    
    // Assemble the item
    item.appendChild(iconDiv);
    item.appendChild(infoDiv);
    
    // Add category tag in top-right corner for both grid and list modes
    if (category && showCategoryInCard) {
        // Grid mode category
        var categoryGridDiv = document.createElement('div');
        categoryGridDiv.className = 'script-category script-category-grid';
        categoryGridDiv.textContent = category;
        categoryGridDiv.title = category;
        item.appendChild(categoryGridDiv);
        
        // List mode category (on image)
        var categoryListDiv = document.createElement('div');
        categoryListDiv.className = 'script-category script-category-list';
        categoryListDiv.textContent = category;
        categoryListDiv.title = category;
        item.appendChild(categoryListDiv);
    }
    
    // Double click to run script
    item.addEventListener('dblclick', function() {
        runScript(script.path);
    });
    
    // Right click for context menu
    item.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showContextMenu(e, script);
    });
    
    // Add hover tooltip for description
    if (description) {
        item.title = description;
    }
    
    // Make script draggable
    makeScriptDraggable(item, script.name);
    
    // Apply current scale
    item.style.transform = 'scale(' + currentScale + ')';
    item.style.transformOrigin = isGridLayout ? 'center top' : 'left center';
    
    return item;
}

// Run script
function runScript(scriptPath) {
    csInterface.evalScript('runScript("' + scriptPath.replace(/\\/g, '\\\\') + '")', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            console.log('Script result:', result);
            if (result.indexOf('错误') !== -1 || result.indexOf('失败') !== -1 || result.indexOf('Error') !== -1) {
                showCustomAlert(result, true);
            }
        }
    });
}

// Hide all context menus
function hideAllContextMenus() {
    // Hide the fixed script context menu
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    
    // Remove all dynamically created context menus
    var dynamicMenus = document.querySelectorAll('.context-menu[style*="position: fixed"]');
    dynamicMenus.forEach(function(menu) {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    });
}

// Show context menu
function showContextMenu(event, script) {
    // Hide all existing menus first
    hideAllContextMenus();
    
    var settingsMenuItem = document.getElementById('settingsMenuItem');
    var feedbackMenuItem = document.getElementById('feedbackMenuItem');
    
    settingsMenuItem.onclick = function() {
        hideContextMenu();
        showScriptSettingsDialog(script);
    };
    
    feedbackMenuItem.onclick = function() {
        hideContextMenu();
        csInterface.openURLInDefaultBrowser('https://space.bilibili.com/45311091?spm_id_from=333.1387.fans.user_card.click');
    };
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
}

// Hide context menu (for backward compatibility)
function hideContextMenu() {
    hideAllContextMenus();
}

// Populate category list
function populateCategoryList() {
    categoryList.innerHTML = '';
    
    categories.forEach(function(category) {
        var item = document.createElement('div');
        item.className = 'category-item';
        if (category === currentCategory) {
            item.classList.add('active');
        }
        item.textContent = category;
        
        item.addEventListener('click', function() {
            // Remove active class from all items
            var items = categoryList.querySelectorAll('.category-item');
            items.forEach(function(i) { i.classList.remove('active'); });
            
            // Add active class to clicked item
            this.classList.add('active');
            currentCategory = category;
            populateScriptList();
        });
        
        // Right click for category menu (except "全部")
        if (category !== '全部') {
            item.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showCategoryContextMenu(e, category);
            });
        }
        
        // Make category draggable
        makeCategoryDraggable(item, category);
        
        categoryList.appendChild(item);
    });
}

// Show category context menu
function showCategoryContextMenu(event, category) {
    // Hide all existing menus first
    hideAllContextMenus();
    
    var menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.zIndex = '1001';
    
    var editItem = document.createElement('div');
    editItem.className = 'menu-item';
    editItem.textContent = '编辑';
    editItem.onclick = function() {
        hideAllContextMenus();
        showEditCategoryDialog(category);
    };
    
    var deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = '删除';
    deleteItem.onclick = function() {
        hideAllContextMenus();
        deleteCategory(category);
    };
    
    var feedbackItem = document.createElement('div');
    feedbackItem.className = 'menu-item';
    feedbackItem.textContent = '反馈/建议';
    feedbackItem.onclick = function() {
        hideAllContextMenus();
        csInterface.openURLInDefaultBrowser('https://space.bilibili.com/45311091?spm_id_from=333.1387.fans.user_card.click');
    };
    
    menu.appendChild(editItem);
    menu.appendChild(deleteItem);
    menu.appendChild(feedbackItem);
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    setTimeout(function() {
        document.addEventListener('click', function removeMenu() {
            hideAllContextMenus();
            document.removeEventListener('click', removeMenu);
        });
    }, 10);
}

// Show tag context menu
function showTagContextMenu(event, tag) {
    // Hide all existing menus first
    hideAllContextMenus();
    
    var menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.zIndex = '1001';
    
    var editItem = document.createElement('div');
    editItem.className = 'menu-item';
    editItem.textContent = '编辑';
    editItem.onclick = function() {
        hideAllContextMenus();
        showEditTagDialog(tag);
    };
    
    var deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = '删除';
    deleteItem.onclick = function() {
        hideAllContextMenus();
        deleteTag(tag);
    };
    
    var feedbackItem = document.createElement('div');
    feedbackItem.className = 'menu-item';
    feedbackItem.textContent = '反馈/建议';
    feedbackItem.onclick = function() {
        hideAllContextMenus();
        csInterface.openURLInDefaultBrowser('https://space.bilibili.com/45311091?spm_id_from=333.1387.fans.user_card.click');
    };
    
    menu.appendChild(editItem);
    menu.appendChild(deleteItem);
    menu.appendChild(feedbackItem);
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    setTimeout(function() {
        document.addEventListener('click', function removeMenu() {
            hideAllContextMenus();
            document.removeEventListener('click', removeMenu);
        });
    }, 10);
}

// Populate tags panel
function populateTagsPanel() {
    tagsPanel.innerHTML = '';
    
    allTags.forEach(function(tag) {
        var tagButton = document.createElement('button');
        tagButton.className = 'tag-button';
        if (activeTags.indexOf(tag) !== -1) {
            tagButton.classList.add('active');
        }
        
        var tagText = document.createElement('span');
        tagText.textContent = tag;
        
        tagButton.appendChild(tagText);
        
        tagButton.onclick = function() {
            toggleTag(tag);
        };
        
        // Add right-click context menu for editing and deleting
        tagButton.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showTagContextMenu(e, tag);
        });
        
        tagsPanel.appendChild(tagButton);
    });
}

// Toggle tag active state
function toggleTag(tag) {
    var index = activeTags.indexOf(tag);
    if (index !== -1) {
        activeTags.splice(index, 1);
    } else {
        activeTags.push(tag);
    }
    populateTagsPanel();
    // 根据当前视图刷新对应列表
    if (document.body.classList.contains('show-preset') && typeof window.filterPresetByKeyword === 'function') {
        var si = document.getElementById('searchInput');
        var q = si ? (si.value || '') : '';
        window.filterPresetByKeyword(q);
    } else {
        populateScriptList();
    }
}

// Delete tag
function deleteTag(tag) {
    if (confirm('确定要删除标签 "' + tag + '" 吗？')) {
        var index = allTags.indexOf(tag);
        if (index !== -1) {
            allTags.splice(index, 1);
        }
        
        var activeIndex = activeTags.indexOf(tag);
        if (activeIndex !== -1) {
            activeTags.splice(activeIndex, 1);
        }
        
        // Remove tag from all scripts
        for (var scriptName in scriptSettings) {
            var tags = scriptSettings[scriptName].tags || [];
            var tagIndex = tags.indexOf(tag);
            if (tagIndex !== -1) {
                tags.splice(tagIndex, 1);
                scriptSettings[scriptName].tags = tags;
            }
        }
        
        saveSettings();
        populateTagsPanel();
        populateScriptList();
    }
}

// Delete category
function deleteCategory(category) {
    if (confirm('确定要删除分类 "' + category + '" 吗？\n\n属于此分类的脚本将移动到无分类状态。')) {
        // Remove category from list
        var index = categories.indexOf(category);
        if (index !== -1) {
            categories.splice(index, 1);
        }
        
        // Move scripts from deleted category to blank category
        for (var scriptName in scriptSettings) {
            if (scriptSettings[scriptName].category === category) {
                scriptSettings[scriptName].category = '';
            }
        }
        
        // If current category was deleted, switch to "全部"
        if (currentCategory === category) {
            currentCategory = '全部';
        }
        
        saveSettings();
        populateCategoryList();
        populateScriptList();
    }
}

// Get script setting
function getScriptSetting(scriptIdentifier, key) {
    if (scriptSettings[scriptIdentifier] && scriptSettings[scriptIdentifier][key] !== undefined) {
        return scriptSettings[scriptIdentifier][key];
    }
    return null;
}

// Set script setting
function setScriptSetting(scriptIdentifier, key, value) {
    if (!scriptSettings[scriptIdentifier]) {
        scriptSettings[scriptIdentifier] = {};
    }
    scriptSettings[scriptIdentifier][key] = value;
}

// Save settings using DataManager
function saveSettings() {
    // Get current sidebar width
    var sidebar = document.getElementById('sidebar');
    var currentSidebarWidth = sidebar ? (parseInt(sidebar.style.width) || 100) : 100;
    
    var settings = {
        version: "1.0",
        scriptsFolderPath: scriptsFolderPath,
        presetFolderPath: presetFolderPath,
        scriptSettings: scriptSettings,
            categories: categories,
            allTags: allTags,
            scriptOrder: scriptOrder, // 保存脚本顺序
        layoutSettings: {
            isGridLayout: isGridLayout,
            currentScale: currentScale,
            sidebarWidth: currentSidebarWidth
        },
        theme: currentTheme
    };
    
    // Add background settings from localStorage
    try {
        var backgroundData = localStorage.getItem('backgroundSettings');
        if (backgroundData) {
            settings.backgroundSettings = JSON.parse(backgroundData);
        }
    } catch (e) {
        console.warn('无法加载背景设置:', e);
    }
    
    // Add clipboard import settings
    settings = saveClipboardImportSettings(settings);
    
    // Add display control settings
    settings.displayControl = {
        showCategoryInCard: showCategoryInCard,
        showTagsInCard: showTagsInCard
    };
    
    // Add autoReadSubfolders setting
    var autoReadSubfoldersCheckbox = document.getElementById('autoReadSubfolders');
    if (autoReadSubfoldersCheckbox) {
        settings.autoReadSubfolders = autoReadSubfoldersCheckbox.checked;
    } else {
        settings.autoReadSubfolders = true; // Default to true if checkbox not found
    }
    
    // Use DataManager for better persistence
    var settingsStr = JSON.stringify(settings).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (typeof DataManager !== 'undefined' && DataManager.saveData && DataManager.initialized) {
        DataManager.saveData(settings, function(error, success) {
            if (error) {
                console.error('设置保存失败:', error);
                // 同步到ExtendScript侧（保持PresetManager.refresh可读取）
                csInterface.evalScript('saveSettings(\'' + settingsStr + '\')');
            } else {
                console.log('设置保存成功');
                // 成功后也同步写入ExtendScript侧的moguBar_settings.txt
                try { csInterface.evalScript('saveSettings(\'' + settingsStr + '\')'); } catch (syncErr) { console.warn('同步ExtendScript设置失败:', syncErr); }
            }
        });
    } else {
        // 传统方式：直接写入ExtendScript侧
        csInterface.evalScript('saveSettings(\'' + settingsStr + '\')');
    }
}

// Load settings using DataManager
function loadSettings() {
    // Initialize DataManager first
    if (typeof DataManager !== 'undefined') {
        DataManager.init(function(initError, success) {
            if (initError) {
                console.error('DataManager初始化失败:', initError);
                loadSettingsLegacy();
                return;
            }
            
            DataManager.loadData(function(loadError, settings) {
                if (loadError) {
                    console.error('设置加载失败，使用传统方法:', loadError);
                    loadSettingsLegacy();
                    return;
                }
                
                // Apply loaded settings
                scriptsFolderPath = settings.scriptsFolderPath || null;
                presetFolderPath = settings.presetFolderPath || null;
                scriptSettings = settings.scriptSettings || {};
                categories = settings.categories || ['全部'];
                allTags = settings.allTags || [];
                scriptOrder = settings.scriptOrder || []; // 加载脚本顺序
                
                console.log('DataManager加载的设置:', {
                    scriptsFolderPath: scriptsFolderPath,
                    categoriesCount: categories.length,
                    tagsCount: allTags.length
                });
                
                // Load layout settings
                if (settings.layoutSettings) {
                    isGridLayout = settings.layoutSettings.isGridLayout || false;
                    currentScale = settings.layoutSettings.currentScale || 1;
                    
                    // Update UI elements
                    if (layoutToggleBtn) {
                        layoutToggleBtn.textContent = isGridLayout ? '列表' : '网格';
                    }
                    if (sizeSlider) {
                        sizeSlider.value = currentScale;
                    }
                    
                    // Apply sidebar width
                    if (settings.layoutSettings.sidebarWidth) {
                        var sidebar = document.getElementById('sidebar');
                        if (sidebar) {
                            sidebar.style.width = settings.layoutSettings.sidebarWidth + 'px';
                        }
                    }
                }
                
                // Load theme settings
                if (settings.theme) {
                    currentTheme = settings.theme;
                    // 应用加载的主题
                    initializeTheme();
                }
                
                // Initialize display control settings with defaults
                showCategoryInCard = true;
                showTagsInCard = true;
                
                // Update UI if elements exist
                if (displayControlElements.showCategoryCheckbox) {
                    displayControlElements.showCategoryCheckbox.checked = showCategoryInCard;
                }
                if (displayControlElements.showTagsCheckbox) {
                    displayControlElements.showTagsCheckbox.checked = showTagsInCard;
                }
                
                // Load clipboard import settings
                loadClipboardImportSettings(settings);
                
                // Load display control settings
                if (settings.displayControl) {
                    showCategoryInCard = settings.displayControl.showCategoryInCard !== false; // Default to true
                    showTagsInCard = settings.displayControl.showTagsInCard !== false; // Default to true
                    
                    // Update UI
                    if (displayControlElements.showCategoryCheckbox) {
                        displayControlElements.showCategoryCheckbox.checked = showCategoryInCard;
                    }
                    if (displayControlElements.showTagsCheckbox) {
                        displayControlElements.showTagsCheckbox.checked = showTagsInCard;
                    }
                }
                
                // Load autoReadSubfolders setting
                var autoReadSubfoldersCheckbox = document.getElementById('autoReadSubfolders');
                if (autoReadSubfoldersCheckbox) {
                    // 正确处理布尔值，如果未设置则默认为true
                    var autoReadSubfolders = settings.autoReadSubfolders !== undefined ? settings.autoReadSubfolders : true;
                    autoReadSubfoldersCheckbox.checked = autoReadSubfolders;
                    console.log('加载autoReadSubfolders设置:', autoReadSubfolders);
                }
                
                // Load background settings to localStorage
                if (settings.backgroundSettings) {
                    try {
                        localStorage.setItem('backgroundSettings', JSON.stringify(settings.backgroundSettings));
                        // Apply background settings
                        setTimeout(function() {
                            loadBackgroundSettings();
                        }, 100);
                    } catch (e) {
                        console.warn('无法恢复背景设置:', e);
                    }
                }
                
                // Ensure "全部" category always exists
                if (categories.indexOf('全部') === -1) {
                    categories.unshift('全部');
                }
                
                // Initialize UI after loading settings
                populateCategoryList();
                populateTagsPanel();
                
                // Update UI after loading - 确保在autoReadSubfolders设置加载后再调用populateScriptList
                if (scriptsFolderPath) {
                    if (folderPathInput) { folderPathInput.value = scriptsFolderPath; }
                    if (presetFolderPath && typeof presetFolderPathInput !== 'undefined' && presetFolderPathInput) {
                        presetFolderPathInput.value = presetFolderPath;
                    }
                    // 延迟执行以确保DOM完全加载和设置正确应用
                    setTimeout(function() {
                        console.log('初始化-步骤-1: 开始加载脚本列表，autoReadSubfolders设置已加载');
                        populateScriptList();
                        // 添加重试机制，确保脚本列表正确显示
                        setTimeout(function() {
                            if (scriptList.innerHTML.indexOf('没有找到匹配的脚本') !== -1 || 
                                scriptList.innerHTML.indexOf('未找到脚本文件') !== -1) {
                                console.log('初始化-步骤-2: 脚本列表显示异常，尝试重新加载');
                                populateScriptList();
                            }
                        }, 500);
                    }, 300); // 增加延迟时间确保设置完全应用
                } else {
                    // 确保显示默认消息
                    setTimeout(function() {
                        if (!scriptsFolderPath) {
                            scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">请先选择脚本文件夹</div></div></div>';
                        }
                    }, 200);
                }
                
                // Apply layout state after loading with delay to ensure DOM is ready
                setTimeout(function() {
                    if (isGridLayout) {
                        scriptList.classList.add('grid-layout');
                    } else {
                        scriptList.classList.remove('grid-layout');
                    }
                    applyScaleToScriptItems();
                }, 0);
                
                console.log('设置加载成功');
            });
        });
    } else {
        loadSettingsLegacy();
    }
}

// Initialize basic UI when no settings are available
function initializeBasicUI() {
    // 确保基本分类存在
    if (categories.indexOf('全部') === -1) {
        categories.unshift('全部');
    }
    
    // 初始化UI组件
    populateCategoryList();
    populateTagsPanel();
    
    // 显示默认消息
    if (!scriptsFolderPath) {
        scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">请先选择脚本文件夹</div></div></div>';
    }
    
    // 应用默认布局状态
    setTimeout(function() {
        if (isGridLayout) {
            scriptList.classList.add('grid-layout');
        } else {
            scriptList.classList.remove('grid-layout');
        }
        applyScaleToScriptItems();
    }, 0);
    
    console.log('基本UI初始化完成');
}

// Legacy settings loading function
function loadSettingsLegacy() {
    csInterface.evalScript('loadSettings()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            try {
                var settings = JSON.parse(result);
                scriptsFolderPath = settings.scriptsFolderPath || null;
                presetFolderPath = settings.presetFolderPath || null;
                scriptSettings = settings.scriptSettings || {};
                categories = settings.categories || ['全部'];
                allTags = settings.allTags || [];
                scriptOrder = settings.scriptOrder || []; // 加载脚本顺序
                
                console.log('Legacy方式加载的设置:', {
                    scriptsFolderPath: scriptsFolderPath,
                    categoriesCount: categories.length,
                    tagsCount: allTags.length
                });
                
                // Load theme settings
                if (settings.theme) {
                    currentTheme = settings.theme;
                    // 应用加载的主题
                    initializeTheme();
                }
                
                // Load autoReadSubfolders setting
                var autoReadSubfoldersCheckbox = document.getElementById('autoReadSubfolders');
                if (autoReadSubfoldersCheckbox) {
                    // 正确处理布尔值，如果未设置则默认为true
                    var autoReadSubfolders = settings.autoReadSubfolders !== undefined ? settings.autoReadSubfolders : true;
                    autoReadSubfoldersCheckbox.checked = autoReadSubfolders;
                    console.log('Legacy方式加载autoReadSubfolders设置:', autoReadSubfolders);
                }
                
                if (categories.indexOf('全部') === -1) {
                    categories.unshift('全部');
                }
                
                // Initialize UI after loading settings
                populateCategoryList();
                populateTagsPanel();
                
                    if (scriptsFolderPath) {
                    if (folderPathInput) { folderPathInput.value = scriptsFolderPath; }
                    if (presetFolderPath && typeof presetFolderPathInput !== 'undefined' && presetFolderPathInput) {
                        presetFolderPathInput.value = presetFolderPath;
                    }
                    // 延迟执行以确保autoReadSubfolders设置正确应用
                    setTimeout(function() {
                        console.log('Legacy初始化-步骤-1: 开始加载脚本列表，autoReadSubfolders设置已加载');
                        populateScriptList();
                    }, 300); // 增加延迟确保设置完全应用
                }
                
                // Apply layout state after loading with delay to ensure DOM is ready
                setTimeout(function() {
                    if (isGridLayout) {
                        scriptList.classList.add('grid-layout');
                    } else {
                        scriptList.classList.remove('grid-layout');
                    }
                    applyScaleToScriptItems();
                }, 0);
            } catch (e) {
                console.error('Error loading settings:', e);
                // 即使加载失败也要初始化基本UI
                initializeBasicUI();
            }
        } else {
            // 没有找到设置文件时也要初始化基本UI
            console.log('未找到设置文件，使用默认设置');
            initializeBasicUI();
        }
    });
}

// Show dialog
function showDialog(content) {
    document.getElementById('dialogContent').innerHTML = content;
    dialogOverlay.style.display = 'flex';
}

// Hide dialog
function hideDialog() {
    // 检测当前对话框类型并自动保存
    var dialogContent = document.getElementById('dialogContent');
    if (dialogContent && dialogContent.innerHTML) {
        var content = dialogContent.innerHTML;
        
        // 检测脚本设置对话框
        if (content.indexOf('脚本设置 -') !== -1) {
            console.log('检测到脚本设置对话框关闭，尝试自动保存');
            // 尝试自动保存脚本设置
            try {
                var displayNameInput = document.getElementById('scriptDisplayName');
                var descriptionInput = document.getElementById('scriptDescription');
                var imagePathInput = document.getElementById('scriptImagePath');
                var categorySelect = document.getElementById('scriptCategory');
                
                if (displayNameInput && descriptionInput && imagePathInput && categorySelect) {
                    // 从对话框标题中提取脚本路径信息
                    var headerElement = dialogContent.querySelector('.dialog-header');
                    if (headerElement) {
                        var headerText = headerElement.textContent;
                        var scriptName = headerText.replace('脚本设置 - ', '');
                        
                        // 查找对应的脚本对象
                        var targetScript = null;
                        if (typeof scriptFiles !== 'undefined' && scriptFiles) {
                            for (var i = 0; i < scriptFiles.length; i++) {
                                if (scriptFiles[i].name === scriptName) {
                                    targetScript = scriptFiles[i];
                                    break;
                                }
                            }
                        }
                        
                        if (targetScript) {
                            console.log('找到目标脚本，执行自动保存:', targetScript.name);
                            
                            var displayName = displayNameInput.value.trim();
                            var description = descriptionInput.value.trim();
                            var imagePath = imagePathInput.value.trim();
                            var category = categorySelect.value;
                            
                            var selectedTags = [];
                            var activeButtons = document.querySelectorAll('#scriptTagsContainer .tag-button.active');
                            activeButtons.forEach(function(button) {
                                selectedTags.push(button.getAttribute('data-tag'));
                            });
                            
                            var scriptIdentifier = targetScript.path;
                            setScriptSetting(scriptIdentifier, 'displayName', displayName);
                            setScriptSetting(scriptIdentifier, 'description', description);
                            setScriptSetting(scriptIdentifier, 'imagePath', imagePath);
                            setScriptSetting(scriptIdentifier, 'category', category);
                            setScriptSetting(scriptIdentifier, 'tags', selectedTags);
                            
                            saveSettings();
                            populateScriptList();
                            populateTagsPanel();
                            console.log('脚本设置自动保存完成');
                        }
                    }
                }
            } catch (e) {
                console.error('脚本设置自动保存失败:', e);
            }
        }
        // 检测添加新标签对话框
        else if (content.indexOf('添加新标签') !== -1) {
            console.log('检测到添加新标签对话框关闭，尝试自动保存');
            try {
                var tagNameInput = document.getElementById('tagNameInput');
                if (tagNameInput) {
                    var tagName = tagNameInput.value.trim();
                    if (tagName && allTags.indexOf(tagName) === -1) {
                        allTags.push(tagName);
                        saveSettings();
                        populateTagsPanel();
                        console.log('新标签自动保存完成:', tagName);
                    }
                }
            } catch (e) {
                console.error('新标签自动保存失败:', e);
            }
        }
        // 检测标签编辑对话框
        else if (content.indexOf('编辑标签') !== -1) {
            console.log('检测到标签编辑对话框关闭，尝试自动保存');
            try {
                var editTagInput = document.getElementById('editTagNameInput');
                if (editTagInput) {
                    var newTag = editTagInput.value.trim();
                    var headerElement = dialogContent.querySelector('.dialog-header');
                    if (headerElement && newTag) {
                        // 从按钮的onclick属性中提取旧标签名
                        var saveButton = dialogContent.querySelector('button[onclick*="updateTag"]');
                        if (saveButton) {
                            var onclickAttr = saveButton.getAttribute('onclick');
                            var oldTagMatch = onclickAttr.match(/updateTag\('([^']+)'\)/);
                            if (oldTagMatch) {
                                var oldTag = oldTagMatch[1];
                                if (newTag !== oldTag && allTags.indexOf(newTag) === -1) {
                                    // 执行标签更新逻辑
                                    var index = allTags.indexOf(oldTag);
                                    if (index !== -1) {
                                        allTags[index] = newTag;
                                    }
                                    
                                    var activeIndex = activeTags.indexOf(oldTag);
                                    if (activeIndex !== -1) {
                                        activeTags[activeIndex] = newTag;
                                    }
                                    
                                    for (var scriptName in scriptSettings) {
                                        var tags = scriptSettings[scriptName].tags || [];
                                        var tagIndex = tags.indexOf(oldTag);
                                        if (tagIndex !== -1) {
                                            tags[tagIndex] = newTag;
                                            scriptSettings[scriptName].tags = tags;
                                        }
                                    }
                                    
                                    saveSettings();
                                    populateTagsPanel();
                                    populateScriptList();
                                    console.log('标签编辑自动保存完成');
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('标签编辑自动保存失败:', e);
            }
        }
        // 检测添加新分类对话框
        else if (content.indexOf('添加新分类') !== -1) {
            console.log('检测到添加新分类对话框关闭，尝试自动保存');
            try {
                var categoryNameInput = document.getElementById('categoryNameInput');
                if (categoryNameInput) {
                    var categoryName = categoryNameInput.value.trim();
                    if (categoryName && categories.indexOf(categoryName) === -1) {
                        categories.push(categoryName);
                        saveSettings();
                        populateCategoryList();
                        console.log('新分类自动保存完成:', categoryName);
                    }
                }
            } catch (e) {
                console.error('新分类自动保存失败:', e);
            }
        }
        // 检测分类编辑对话框
        else if (content.indexOf('编辑分类') !== -1) {
            console.log('检测到分类编辑对话框关闭，尝试自动保存');
            try {
                var editCategoryInput = document.getElementById('editCategoryNameInput');
                if (editCategoryInput) {
                    var newName = editCategoryInput.value.trim();
                    if (newName) {
                        // 从按钮的onclick属性中提取旧分类名
                        var saveButton = dialogContent.querySelector('button[onclick*="editCategory"]');
                        if (saveButton) {
                            var onclickAttr = saveButton.getAttribute('onclick');
                            var oldNameMatch = onclickAttr.match(/editCategory\('([^']+)'\)/);
                            if (oldNameMatch) {
                                var oldName = oldNameMatch[1];
                                if (newName !== oldName && categories.indexOf(newName) === -1) {
                                    var index = categories.indexOf(oldName);
                                    if (index !== -1) {
                                        categories[index] = newName;
                                    }
                                    
                                    for (var scriptName in scriptSettings) {
                                        if (scriptSettings[scriptName].category === oldName) {
                                            scriptSettings[scriptName].category = newName;
                                        }
                                    }
                                    
                                    if (currentCategory === oldName) {
                                        currentCategory = newName;
                                    }
                                    
                                    saveSettings();
                                    populateCategoryList();
                                    populateScriptList();
                                    console.log('分类编辑自动保存完成');
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('分类编辑自动保存失败:', e);
            }
        }
    }
    
    dialogOverlay.style.display = 'none';
}

// Show add tag dialog
function showAddTagDialog() {
    var content = `
        <div class="dialog-header">添加新标签</div>
        <div class="dialog-group">
            <label>标签名称:</label>
            <input type="text" id="tagNameInput" placeholder="输入标签名称">
        </div>
        <div class="dialog-buttons">
            <button class="btn" onclick="hideDialog()">取消</button>
            <button class="btn" onclick="addTag()">添加</button>
        </div>
    `;
    showDialog(content);
    
    setTimeout(function() {
        document.getElementById('tagNameInput').focus();
    }, 100);
}

// Add tag
function addTag() {
    var tagName = document.getElementById('tagNameInput').value.trim();
    if (tagName && allTags.indexOf(tagName) === -1) {
        allTags.push(tagName);
        saveSettings();
        populateTagsPanel();
        hideDialog();
    }
}

// Show edit tag dialog
function showEditTagDialog(oldTag) {
    var content = `
        <div class="dialog-header">编辑标签</div>
        <div class="dialog-group">
            <label>标签名称:</label>
            <input type="text" id="editTagNameInput" value="${oldTag}" placeholder="输入新的标签名称">
        </div>
        <div class="dialog-buttons">
            <button class="btn" onclick="hideDialog()">取消</button>
            <button class="btn" onclick="updateTag('${oldTag}')">保存</button>
        </div>
    `;
    showDialog(content);
    
    // Focus and select the input
    setTimeout(function() {
        var input = document.getElementById('editTagNameInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

// Update tag name
function updateTag(oldTag) {
    var newTag = document.getElementById('editTagNameInput').value.trim();
    if (newTag && newTag !== oldTag && allTags.indexOf(newTag) === -1) {
        // Update in allTags array
        var index = allTags.indexOf(oldTag);
        if (index !== -1) {
            allTags[index] = newTag;
        }
        
        // Update in activeTags array
        var activeIndex = activeTags.indexOf(oldTag);
        if (activeIndex !== -1) {
            activeTags[activeIndex] = newTag;
        }
        
        // Update in all script settings
        for (var scriptName in scriptSettings) {
            var tags = scriptSettings[scriptName].tags || [];
            var tagIndex = tags.indexOf(oldTag);
            if (tagIndex !== -1) {
                tags[tagIndex] = newTag;
                scriptSettings[scriptName].tags = tags;
            }
        }
        
        saveSettings();
        populateTagsPanel();
        populateScriptList();
        hideDialog();
    } else if (newTag === oldTag) {
        hideDialog();
    } else if (!newTag) {
        showCustomAlert('标签名称不能为空', true);
    } else {
        showCustomAlert('标签名称已存在', true);
    }
}

// Show add category dialog
function showAddCategoryDialog() {
    var content = `
        <div class="dialog-header">添加新分类</div>
        <div class="dialog-group">
            <label>分类名称:</label>
            <input type="text" id="categoryNameInput" placeholder="输入分类名称">
        </div>
        <div class="dialog-buttons">
            <button class="btn" onclick="hideDialog()">取消</button>
            <button class="btn" onclick="addCategory()">添加</button>
        </div>
    `;
    showDialog(content);
    
    setTimeout(function() {
        document.getElementById('categoryNameInput').focus();
    }, 100);
}

// Add category
function addCategory() {
    var categoryName = document.getElementById('categoryNameInput').value.trim();
    if (categoryName && categories.indexOf(categoryName) === -1) {
        categories.push(categoryName);
        saveSettings();
        populateCategoryList();
        hideDialog();
    }
}

// Show edit category dialog
function showEditCategoryDialog(oldName) {
    var content = `
        <div class="dialog-header">编辑分类</div>
        <div class="dialog-group">
            <label>分类名称:</label>
            <input type="text" id="editCategoryNameInput" value="${oldName}">
        </div>
        <div class="dialog-buttons">
            <button class="btn" onclick="hideDialog()">取消</button>
            <button class="btn" onclick="editCategory('${oldName}')">保存</button>
        </div>
    `;
    showDialog(content);
    
    setTimeout(function() {
        var input = document.getElementById('editCategoryNameInput');
        input.focus();
        input.select();
    }, 100);
}

// Edit category
function editCategory(oldName) {
    var newName = document.getElementById('editCategoryNameInput').value.trim();
    if (newName && newName !== oldName && categories.indexOf(newName) === -1) {
        var index = categories.indexOf(oldName);
        if (index !== -1) {
            categories[index] = newName;
        }
        
        // Update script settings
        for (var scriptName in scriptSettings) {
            if (scriptSettings[scriptName].category === oldName) {
                scriptSettings[scriptName].category = newName;
            }
        }
        
        if (currentCategory === oldName) {
            currentCategory = newName;
        }
        
        saveSettings();
        populateCategoryList();
        populateScriptList();
        hideDialog();
    }
}

// Show script settings dialog
function showScriptSettingsDialog(script) {
    var scriptIdentifier = script.path; // Use full path as unique identifier
    var displayName = getScriptSetting(scriptIdentifier, 'displayName') || script.name;
    var description = getScriptSetting(scriptIdentifier, 'description') || '';
    var imagePath = getScriptSetting(scriptIdentifier, 'imagePath') || '';
    var category = getScriptSetting(scriptIdentifier, 'category') || '';
    var scriptTags = getScriptSetting(scriptIdentifier, 'tags') || [];
    
    var categoryOptions = '';
    categoryOptions += '<option value="">无分类</option>';
    categories.forEach(function(cat) {
        if (cat !== '全部') {
            var selected = cat === category ? 'selected' : '';
            categoryOptions += `<option value="${cat}" ${selected}>${cat}</option>`;
        }
    });
    
    var tagButtons = '';
    allTags.forEach(function(tag) {
        var active = scriptTags.indexOf(tag) !== -1 ? 'active' : '';
        tagButtons += `<button class="tag-button ${active}" data-tag="${tag}" onclick="toggleScriptTag(this)">${tag}</button>`;
    });
    
    var content = `
        <div class="dialog-header">脚本设置 - ${script.name}</div>
        <div class="dialog-group">
            <label>显示名称:</label>
            <input type="text" id="scriptDisplayName" value="${displayName}">
        </div>
        <div class="dialog-group">
            <label>描述:</label>
            <textarea id="scriptDescription">${description}</textarea>
        </div>
        <div class="dialog-group">
            <label>预览图片路径:</label>
            <input type="text" id="scriptImagePath" value="${imagePath}" placeholder="图片文件路径">
            <button class="btn btn-small" onclick="selectImageFile()">选择图片</button>
        </div>
        <div class="dialog-group">
            <label>分类:</label>
            <select id="scriptCategory">${categoryOptions}</select>
        </div>
        <div class="dialog-group">
            <label>标签:</label>
            <div id="scriptTagsContainer" class="tags-panel">${tagButtons}</div>
            <div style="margin-top: 10px;">
                <input type="text" id="newTagInput" placeholder="添加新标签">
                <button class="btn btn-small" onclick="addNewTagToScript()">+</button>
            </div>
        </div>
        <div class="dialog-buttons">
            <button class="btn" onclick="hideDialog()">取消</button>
            <button class="btn" onclick="saveScriptSettings('${script.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${script.name.replace(/'/g, "\\'")}')"}>保存</button>
        </div>
    `;
    showDialog(content);
}

// Select image file
function selectImageFile() {
    csInterface.evalScript('selectImageFile()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            document.getElementById('scriptImagePath').value = result;
        }
    });
}

// Toggle script tag
function toggleScriptTag(button) {
    button.classList.toggle('active');
}

// Add new tag to script
function addNewTagToScript() {
    var newTag = document.getElementById('newTagInput').value.trim();
    if (newTag) {
        if (allTags.indexOf(newTag) === -1) {
            allTags.push(newTag);
            // 立即更新主界面的标签面板
            populateTagsPanel();
        }
        
        var container = document.getElementById('scriptTagsContainer');
        var button = document.createElement('button');
        button.className = 'tag-button active';
        button.setAttribute('data-tag', newTag);
        button.setAttribute('onclick', 'toggleScriptTag(this)');
        button.textContent = newTag;
        container.appendChild(button);
        
        document.getElementById('newTagInput').value = '';
    }
}

// Save script settings
function saveScriptSettings(scriptPath, scriptName) {
    var displayName = document.getElementById('scriptDisplayName').value.trim();
    var description = document.getElementById('scriptDescription').value.trim();
    var imagePath = document.getElementById('scriptImagePath').value.trim();
    var category = document.getElementById('scriptCategory').value;
    
    var selectedTags = [];
    var activeButtons = document.querySelectorAll('#scriptTagsContainer .tag-button.active');
    activeButtons.forEach(function(button) {
        selectedTags.push(button.getAttribute('data-tag'));
    });
    
    var scriptIdentifier = scriptPath; // Use full path as unique identifier
    setScriptSetting(scriptIdentifier, 'displayName', displayName);
    setScriptSetting(scriptIdentifier, 'description', description);
    setScriptSetting(scriptIdentifier, 'imagePath', imagePath);
    setScriptSetting(scriptIdentifier, 'category', category);
    setScriptSetting(scriptIdentifier, 'tags', selectedTags);
    
    saveSettings();
    populateScriptList();
    // 更新主界面的标签面板以反映新添加的标签
    populateTagsPanel();
    hideDialog();
}

// Toggle layout between list and grid
function toggleLayout() {
    isGridLayout = !isGridLayout;
    if (isGridLayout) {
        scriptList.classList.add('grid-layout');
        layoutToggleBtn.textContent = '列表';
    } else {
        scriptList.classList.remove('grid-layout');
        layoutToggleBtn.textContent = '网格';
    }
    applyScaleToScriptItems();
    
    // Save layout preference
    saveSettings();
}

// Apply scale to script items with rigid body physics simulation
function applyScaleToScriptItems() {
    var items = scriptList.querySelectorAll('.script-item');
    
    if (isGridLayout) {
        // 在切回脚本模式的首次布局应用时，关闭进入动画以避免“双次弹跳”
        var suppressTransition = (typeof window !== 'undefined' && typeof window.justEnteredScriptMode === 'number')
            ? (Date.now() - window.justEnteredScriptMode < 800)
            : false;
        // For grid layout - items snap to grid positions, aligned top-left
        var baseItemWidth = 80;
        var baseItemHeight = 120; // Increased base height to show tags
        var scaledItemWidth = baseItemWidth * currentScale;
        var containerWidth = scriptList.clientWidth;
        
        // Calculate items per row with minimal gap for tight packing
        var minGap = 2;
        var itemsPerRow = Math.floor((containerWidth + minGap) / (scaledItemWidth + minGap));
        itemsPerRow = Math.max(1, itemsPerRow);
        
        // Use fixed height for grid mode with space for colorful tags
        var maxHeight = 120; // Increased height for better tag display
        
        var scaledItemHeight = maxHeight * currentScale;
        
        // Add transitioning class for smooth animation（如需抑制则跳过）
        if (!suppressTransition) {
            scriptList.classList.add('grid-transitioning');
        }
        
        // Use CSS Grid for perfect alignment with consistent spacing
        scriptList.style.display = 'grid';
        scriptList.style.gridTemplateColumns = 'repeat(' + itemsPerRow + ', ' + scaledItemWidth + 'px)';
        scriptList.style.gridTemplateRows = 'repeat(auto, ' + scaledItemHeight + 'px)';
        scriptList.style.gap = minGap + 'px';
        scriptList.style.justifyContent = 'start';
        scriptList.style.alignContent = 'start';
        scriptList.style.justifyItems = 'stretch';
        scriptList.style.alignItems = 'stretch';
        scriptList.style.gridAutoRows = scaledItemHeight + 'px';
        
        // Remove transitioning class after animation completes（若抑制则无需移除）
        if (!suppressTransition) {
            setTimeout(function() {
                scriptList.classList.remove('grid-transitioning');
            }, 400);
        }

        // 清除“刚进入脚本模式”标记，避免后续正常动画被持续抑制
        if (suppressTransition && typeof window !== 'undefined') {
            try { window.justEnteredScriptMode = null; } catch (_) {}
        }
        
        for (var i = 0; i < items.length; i++) {
            items[i].style.transform = 'scale(' + currentScale + ')';
            items[i].style.transformOrigin = 'top left';
            items[i].style.width = baseItemWidth + 'px';
            items[i].style.height = maxHeight + 'px';
            items[i].style.margin = '0';
            items[i].style.position = 'relative';
            items[i].classList.add('grid-mode');
        }
    } else {
        // For list layout - items snap together with no gaps
        scriptList.style.display = 'block';
        scriptList.style.flexDirection = '';
        scriptList.style.gridTemplateColumns = '';
        scriptList.style.gridTemplateRows = '';
        scriptList.style.gap = '';
        scriptList.style.justifyContent = '';
        scriptList.style.alignContent = '';
        scriptList.style.justifyItems = '';
        scriptList.style.alignItems = '';
        
        // Get the base height of items - increased for better layout
        var baseItemHeight = 64;
        var scaledHeight = baseItemHeight * currentScale;
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            
            // Remove grid mode class
            item.classList.remove('grid-mode');
            
            // Reset all positioning
            item.style.position = 'relative';
            item.style.transform = 'scale(' + currentScale + ')';
            item.style.transformOrigin = 'top left';
            
            // Calculate scaled width to fit container
            var scaledWidth = (100 / currentScale) + '%';
            item.style.width = scaledWidth;
            item.style.maxWidth = scaledWidth;
            
            item.style.height = baseItemHeight + 'px';
            item.style.boxSizing = 'border-box';
            item.style.margin = '0';
            item.style.marginBottom = '3px';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.overflow = 'hidden';
            
            // Calculate the offset needed to make items touch
            var scaleOffset = (1 - currentScale) * baseItemHeight;
            
            // Apply negative margin to close gaps between scaled items, but keep minimum spacing
            if (i > 0) {
                var adjustedMargin = Math.max(-scaleOffset + 3, 0);
                item.style.marginTop = (-scaleOffset + 3) + 'px';
            }
        }
    }
}

// Setup sidebar resizer
function setupSidebarResizer() {
    var sidebar = document.getElementById('sidebar');
    
    // Load saved sidebar width
    loadSidebarWidth();
    
    sidebarResizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        var rect = sidebar.getBoundingClientRect();
        var newWidth = e.clientX - rect.left;
        
        if (newWidth >= 40 && newWidth <= 300) {
            sidebar.style.width = newWidth + 'px';
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        
        // Save sidebar width when resizing stops
        saveSidebarWidth();
    }
}

// Load sidebar width from data
function loadSidebarWidth() {
    DataManager.loadData(function(error, data) {
        if (!error && data && data.layoutSettings && data.layoutSettings.sidebarWidth) {
            var sidebar = document.getElementById('sidebar');
            sidebar.style.width = data.layoutSettings.sidebarWidth + 'px';
        }
    });
}

// Save sidebar width to data
function saveSidebarWidth() {
    var sidebar = document.getElementById('sidebar');
    var currentWidth = parseInt(sidebar.style.width) || 100;
    
    DataManager.loadData(function(error, data) {
        if (!error && data) {
            if (!data.layoutSettings) {
                data.layoutSettings = {};
            }
            data.layoutSettings.sidebarWidth = currentWidth;
            
            DataManager.saveData(data, function(saveError) {
                if (saveError) {
                    console.error('保存侧栏宽度失败:', saveError);
                }
            });
        }
    });
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    // Add drag and drop support for script list container
    scriptList.addEventListener('dragover', function(e) {
        if (draggedType === 'script') {
            e.preventDefault();
            
            // Check if we're dragging over empty space
            var target = e.target;
            if (target === scriptList || target.classList.contains('script-list')) {
                // Find the best insertion position based on mouse position
                var insertPosition = findInsertPositionFromMouse(e.clientX, e.clientY);
                
                // Animate items to show where the dragged item will be inserted
                animateItemsForEmptyAreaDrop(draggedElement, insertPosition);
            }
        } else {
            // Handle file drag over
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            // Add visual feedback for file drag
            if (!scriptList.classList.contains('file-drag-over')) {
                scriptList.classList.add('file-drag-over');
            }
        }
    });
    
    scriptList.addEventListener('dragleave', function(e) {
        // Remove visual feedback when leaving the drop zone
        if (!scriptList.contains(e.relatedTarget)) {
            scriptList.classList.remove('file-drag-over');
        }
    });
    
    scriptList.addEventListener('drop', function(e) {
        // Remove visual feedback
        scriptList.classList.remove('file-drag-over');
        
        if (draggedType === 'script') {
            e.preventDefault();
            
            var target = e.target;
            if (target === scriptList || target.classList.contains('script-list')) {
                // Find insertion position based on mouse position
                var insertPosition = findInsertPositionFromMouse(e.clientX, e.clientY);
                var allItems = Array.from(scriptList.children);
                
                if (insertPosition >= allItems.length) {
                    scriptList.appendChild(draggedElement);
                } else {
                    scriptList.insertBefore(draggedElement, allItems[insertPosition]);
                }
                
                // Update scriptOrder array
                updateScriptOrder();
                
                // Clean up all drag states
                var allItems = scriptList.querySelectorAll('.script-item');
                allItems.forEach(function(item) {
                    item.classList.remove('drag-over', 'drag-shifting');
                });
            }
        } else {
            // Handle file drop
            e.preventDefault();
            
            var files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleFileDrop(files);
            }
        }
    });
    
    // Add global drag and drop support for external files from browsers
    // This ensures files can be dropped anywhere in the CEP panel
    document.addEventListener('dragover', function(e) {
        // Check if this is an external file drag (not internal script reordering)
        if (!draggedType || draggedType !== 'script') {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            // Debug: Log dragover event
            console.log('拖拽检测 - dragover事件触发', {
                draggedType: draggedType,
                dataTransfer: e.dataTransfer,
                files: e.dataTransfer.files ? e.dataTransfer.files.length : 0,
                types: e.dataTransfer.types
            });
            
            // Add visual feedback to the entire panel
            if (!document.body.classList.contains('global-file-drag-over')) {
                document.body.classList.add('global-file-drag-over');
                console.log('拖拽检测 - 添加全局拖拽视觉反馈');
            }
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        // Only remove feedback if we're leaving the entire document
        if (e.clientX === 0 && e.clientY === 0) {
            document.body.classList.remove('global-file-drag-over');
            console.log('拖拽检测 - 移除全局拖拽视觉反馈');
        }
    });
    
    document.addEventListener('drop', function(e) {
        console.log('拖拽检测 - drop事件触发', {
            draggedType: draggedType,
            dataTransfer: e.dataTransfer,
            files: e.dataTransfer.files ? e.dataTransfer.files.length : 0,
            types: e.dataTransfer.types,
            clipboardImportEnabled: clipboardImportEnabled
        });
        
        // Remove global visual feedback
        document.body.classList.remove('global-file-drag-over');
        
        // Only handle external file drops (not internal script reordering)
        if (!draggedType || draggedType !== 'script') {
            e.preventDefault();
            
            var files = e.dataTransfer.files;
            if (files && files.length > 0) {
                console.log('拖拽检测 - 检测到文件拖拽:', files.length, '个文件');
                
                // 显示调试信息弹窗
                var debugInfo = '拖拽调试信息:\n';
                debugInfo += '文件数量: ' + files.length + '\n';
                debugInfo += '剪贴板导入功能: ' + (clipboardImportEnabled ? '已启用' : '已禁用') + '\n';
                
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    debugInfo += '文件' + (i + 1) + ': ' + file.name + '\n';
                    debugInfo += '  类型: ' + file.type + '\n';
                    debugInfo += '  大小: ' + (file.size / 1024).toFixed(2) + ' KB\n';
                }
                
                // 记录调试信息到控制台
                console.log('文件拖拽调试信息:', debugInfo);
                
                // 继续处理文件拖拽
                handleFileDrop(files);
            } else {
                console.log('拖拽检测 - 未检测到文件，检查是否为URL拖拽');
                
                // 检查是否为URL拖拽（从浏览器拖拽图片链接）
                var types = e.dataTransfer.types;
                if (types && (types.indexOf('text/uri-list') !== -1 || types.indexOf('text/html') !== -1)) {
                    console.log('检测到URL拖拽，尝试提取图片URL');
                    
                    var urlData = '';
                    var htmlData = '';
                    
                    try {
                        if (types.indexOf('text/uri-list') !== -1) {
                            urlData = e.dataTransfer.getData('text/uri-list');
                        }
                        if (types.indexOf('text/html') !== -1) {
                            htmlData = e.dataTransfer.getData('text/html');
                        }
                    } catch (error) {
                        console.log('获取拖拽数据失败:', error);
                    }
                    
                    // 记录URL拖拽调试信息到控制台
                    console.log('URL拖拽调试信息:');
                    console.log('URL数据:', urlData || '无');
                    console.log('HTML数据长度:', htmlData ? htmlData.length : 0);
                    console.log('dataTransfer.types:', types.join(', '));
                    
                    // 尝试从URL或HTML中提取图片链接
                    var imageUrl = extractImageUrl(urlData, htmlData);
                    if (imageUrl) {
                        console.log('提取到图片URL:', imageUrl);
                        handleImageUrlDrop(imageUrl);
                    } else {
                        console.log('未能提取到有效的图片URL');
                        
                        // 检查是否为BASE64数据
                        var textData = '';
                        try {
                            if (types.indexOf('text/plain') !== -1) {
                                textData = e.dataTransfer.getData('text/plain');
                            }
                        } catch (error) {
                            console.log('获取文本数据失败:', error);
                        }
                        
                        if (textData && isBase64ImageData(textData)) {
                            console.log('检测到BASE64图片数据');
                            handleBase64Drop(textData);
                        } else {
                            showNotification('拖拽失败', '未能提取到有效的图片URL或BASE64数据，请尝试直接拖拽图片文件', 'error');
                        }
                    }
                } else {
                    // 记录无文件的调试信息到控制台
                    console.log('拖拽调试信息: 未检测到文件');
                    console.log('dataTransfer.files:', e.dataTransfer.files ? e.dataTransfer.files.length : 'null');
                    console.log('dataTransfer.types:', e.dataTransfer.types ? e.dataTransfer.types.join(', ') : 'null');
                }
            }
        } else {
            console.log('拖拽检测 - 内部脚本拖拽，跳过文件处理');
        }
    });
}

// Make category items draggable (except "全部")
function makeCategoryDraggable(element, categoryName) {
    if (categoryName === '全部') return;
    
    element.classList.add('draggable');
    element.draggable = true;
    
    element.addEventListener('dragstart', function(e) {
        draggedElement = element;
        draggedType = 'category';
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    
    element.addEventListener('dragend', function(e) {
        element.classList.remove('dragging');
        draggedElement = null;
        draggedType = null;
    });
    
    element.addEventListener('dragover', function(e) {
        if (draggedType === 'category' && draggedElement !== element) {
            e.preventDefault();
            element.classList.add('drag-over');
        }
    });
    
    element.addEventListener('dragleave', function(e) {
        element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', function(e) {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        if (draggedType === 'category' && draggedElement !== element) {
            var draggedIndex = Array.from(categoryList.children).indexOf(draggedElement);
            var targetIndex = Array.from(categoryList.children).indexOf(element);
            
            if (draggedIndex > 0 && targetIndex > 0) { // Skip "全部"
                var draggedCategory = categories[draggedIndex];
                categories.splice(draggedIndex, 1);
                categories.splice(targetIndex, 0, draggedCategory);
                
                saveSettings();
                populateCategoryList();
            }
        }
    });
}

// Make script items draggable
function makeScriptDraggable(element, scriptName) {
    element.classList.add('draggable');
    element.draggable = true;
    
    element.addEventListener('dragstart', function(e) {
        draggedElement = element;
        draggedType = 'script';
        element.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        // Store original positions for smooth animation
        var parent = element.parentNode;
        var allItems = Array.from(parent.children);
        allItems.forEach(function(item, index) {
            var rect = item.getBoundingClientRect();
            item.dataset.originalIndex = index;
            item.dataset.originalTop = rect.top;
            item.dataset.originalLeft = rect.left;
        });
    });
    
    element.addEventListener('dragend', function(e) {
        element.classList.remove('dragging');
        
        // Remove all drag effects
        var allItems = document.querySelectorAll('.script-item');
        allItems.forEach(function(item) {
            item.classList.remove('drag-over', 'drag-shifting');
            item.style.transform = 'scale(' + currentScale + ')';
            item.style.transition = '';
            delete item.dataset.originalIndex;
            delete item.dataset.originalTop;
            delete item.dataset.originalLeft;
            delete item.dataset.currentDragTarget;
        });
        
        draggedElement = null;
        draggedType = null;
        
        // Re-apply scale to maintain consistency
        setTimeout(function() {
            applyScaleToScriptItems();
        }, 100);
    });
    
    element.addEventListener('dragover', function(e) {
        if (draggedType === 'script' && draggedElement !== element) {
            e.preventDefault();
            
            var parent = element.parentNode;
            var allItems = Array.from(parent.children);
            var draggedIndex = allItems.indexOf(draggedElement);
            var targetIndex = allItems.indexOf(element);
            
            // Prevent animation if already targeting the same element
            if (element.dataset.currentDragTarget === 'true') {
                return;
            }
            
            // Clear previous drag-over states
            allItems.forEach(function(item) {
                item.classList.remove('drag-over');
                delete item.dataset.currentDragTarget;
            });
            
            element.classList.add('drag-over');
            element.dataset.currentDragTarget = 'true';
            
            // Animate other items to make space
            animateItemsForDrop(draggedElement, element, draggedIndex, targetIndex);
        }
    });
    
    element.addEventListener('drop', function(e) {
        e.preventDefault();
        
        if (draggedType === 'script' && draggedElement !== element) {
            var parent = element.parentNode;
            var allItems = Array.from(parent.children);
            var draggedIndex = allItems.indexOf(draggedElement);
            var targetIndex = allItems.indexOf(element);
            
            if (draggedIndex !== targetIndex) {
                // Determine insert position
                var insertBefore = draggedIndex > targetIndex ? element : element.nextSibling;
                
                // Actually move the element in DOM
                parent.insertBefore(draggedElement, insertBefore);
                
                // Update scriptOrder array
                updateScriptOrder();
            }
        }
        
        // Clean up all drag states
        var allItems = document.querySelectorAll('.script-item');
        allItems.forEach(function(item) {
            item.classList.remove('drag-over', 'drag-shifting');
            delete item.dataset.currentDragTarget;
        });
    });
}

// Update script order based on current DOM order
function updateScriptOrder() {
    var allItems = Array.from(scriptList.children);
    scriptOrder = [];
    
    allItems.forEach(function(item) {
        var scriptName = item.dataset.scriptName;
        if (scriptName) {
            scriptOrder.push(scriptName);
        }
    });
    
    // Save the updated order
    saveSettings();
    
    console.log('脚本顺序已更新:', scriptOrder);
}

// Find the best insertion position based on mouse coordinates
function findInsertPositionFromMouse(mouseX, mouseY) {
    var allItems = Array.from(scriptList.children);
    var insertPosition = allItems.length; // Default to end
    
    for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        if (item === draggedElement) continue;
        
        var rect = item.getBoundingClientRect();
        
        if (isGridLayout) {
            // For grid layout, check if mouse is in the top-left quadrant of the item
            if (mouseY < rect.top + rect.height / 2) {
                if (mouseX < rect.left + rect.width / 2) {
                    insertPosition = i;
                    break;
                }
            }
        } else {
            // For list layout, check if mouse is above the middle of the item
            if (mouseY < rect.top + rect.height / 2) {
                insertPosition = i;
                break;
            }
        }
    }
    
    return insertPosition;
}

// Animate items for empty area drop
function animateItemsForEmptyAreaDrop(draggedElement, insertPosition) {
    var allItems = Array.from(scriptList.children);
    var draggedIndex = allItems.indexOf(draggedElement);
    
    allItems.forEach(function(item, currentIndex) {
        if (item === draggedElement) return;
        
        item.classList.remove('drag-shifting');
        
        var shouldShift = false;
        var shiftDirection = 0;
        
        if (draggedIndex < insertPosition) {
            // Moving down: items between draggedIndex and insertPosition should move up
            if (currentIndex > draggedIndex && currentIndex < insertPosition) {
                shouldShift = true;
                shiftDirection = -1;
            }
        } else {
            // Moving up: items between insertPosition and draggedIndex should move down
            if (currentIndex >= insertPosition && currentIndex < draggedIndex) {
                shouldShift = true;
                shiftDirection = 1;
            }
        }
        
        if (shouldShift) {
            item.classList.add('drag-shifting');
            
            if (isGridLayout) {
                var itemRect = item.getBoundingClientRect();
                var parentRect = scriptList.getBoundingClientRect();
                var itemsPerRow = Math.floor(parentRect.width / itemRect.width);
                
                var moveX = 0;
                var moveY = 0;
                
                if (shiftDirection === 1) {
                    if ((currentIndex + 1) % itemsPerRow === 0) {
                        moveX = -(itemsPerRow - 1) * itemRect.width;
                        moveY = itemRect.height;
                    } else {
                        moveX = itemRect.width;
                    }
                } else {
                    if (currentIndex % itemsPerRow === 0) {
                        moveX = (itemsPerRow - 1) * itemRect.width;
                        moveY = -itemRect.height;
                    } else {
                        moveX = -itemRect.width;
                    }
                }
                
                item.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px) scale(' + currentScale + ')';
            } else {
                var itemHeight = item.getBoundingClientRect().height;
                var moveY = shiftDirection * itemHeight;
                item.style.transform = 'translateY(' + moveY + 'px) scale(' + currentScale + ')';
            }
            
            item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        } else {
            item.style.transform = 'scale(' + currentScale + ')';
            item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }
    });
}

// Animate items to make space for drop
function animateItemsForDrop(draggedElement, targetElement, draggedIndex, targetIndex) {
    var parent = targetElement.parentNode;
    var allItems = Array.from(parent.children);
    
    allItems.forEach(function(item, currentIndex) {
        if (item === draggedElement) return;
        
        item.classList.remove('drag-shifting');
        
        var shouldShift = false;
        var shiftDirection = 0;
        
        if (draggedIndex < targetIndex) {
            // Dragging down: items between draggedIndex and targetIndex should move up
            if (currentIndex > draggedIndex && currentIndex <= targetIndex) {
                shouldShift = true;
                shiftDirection = -1;
            }
        } else {
            // Dragging up: items between targetIndex and draggedIndex should move down
            if (currentIndex >= targetIndex && currentIndex < draggedIndex) {
                shouldShift = true;
                shiftDirection = 1;
            }
        }
        
        if (shouldShift) {
            item.classList.add('drag-shifting');
            
            if (isGridLayout) {
                // For grid layout, calculate grid-based movement
                var itemRect = item.getBoundingClientRect();
                var parentRect = parent.getBoundingClientRect();
                var itemsPerRow = Math.floor(parentRect.width / itemRect.width);
                
                var moveX = 0;
                var moveY = 0;
                
                if (shiftDirection === 1) {
                    // Move to next position
                    if ((currentIndex + 1) % itemsPerRow === 0) {
                        moveX = -(itemsPerRow - 1) * itemRect.width;
                        moveY = itemRect.height;
                    } else {
                        moveX = itemRect.width;
                    }
                } else {
                    // Move to previous position
                    if (currentIndex % itemsPerRow === 0) {
                        moveX = (itemsPerRow - 1) * itemRect.width;
                        moveY = -itemRect.height;
                    } else {
                        moveX = -itemRect.width;
                    }
                }
                
                item.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px) scale(' + currentScale + ')';
            } else {
                // For list layout, move vertically
                var itemHeight = item.getBoundingClientRect().height;
                var moveY = shiftDirection * itemHeight;
                item.style.transform = 'translateY(' + moveY + 'px) scale(' + currentScale + ')';
            }
            
            item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        } else {
            item.style.transform = 'scale(' + currentScale + ')';
            item.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }
    });
}

// Export settings
function exportSettings() {
    if (typeof DataManager !== 'undefined' && DataManager.initialized) {
        DataManager.loadData(function(error, data) {
            if (error) {
                showCustomAlert('导出失败: ' + error, true);
                return;
            }
            
            // 获取当前主题设置
            var activeThemeElement = document.querySelector('.theme-item.active');
            var currentThemeData = {
                theme: currentTheme || 'dark',
                themeTitle: activeThemeElement ? activeThemeElement.getAttribute('data-theme') : 'dark'
            };
            
            // 获取当前背景设置（从localStorage获取最新的背景设置）
            var currentBackgroundData = null;
            try {
                var savedBgSettings = localStorage.getItem('backgroundSettings');
                if (savedBgSettings) {
                    currentBackgroundData = JSON.parse(savedBgSettings);
                }
            } catch (e) {
                console.error('Failed to load background settings from localStorage:', e);
                currentBackgroundData = data.backgroundSettings || null;
            }
            
            // 创建导出数据
            var exportData = {
                version: data.version,
                scriptSettings: data.scriptSettings || {},
                categories: data.categories || ['全部'],
                allTags: data.allTags || [],
                layoutSettings: data.layoutSettings || {
                    isGridLayout: false,
                    currentScale: 1
                },
                scriptsFolderPath: data.scriptsFolderPath || '',
                themeSettings: currentThemeData,
                backgroundSettings: currentBackgroundData,
                displayControl: data.displayControl || {
                    showCategoryInCard: true,
                    showTagsInCard: true
                },
                clipboardImportSettings: data.clipboardImportSettings || {
                    enabled: false,
                    autoImport: false,
                    saveToProject: true,
                    compressionQuality: 0.8
                },
                autoReadSubfolders: data.autoReadSubfolders !== undefined ? data.autoReadSubfolders : true, // Default to true
                exportTime: new Date().toISOString()
            };
            
            // 使用ExtendScript创建压缩包导出
            var exportDataStr = encodeURIComponent(JSON.stringify(exportData, null, 2));
            csInterface.evalScript('exportScriptsAndSettings("' + exportDataStr + '")', function(result) {
                if (result && result !== 'null' && result !== 'undefined') {
                    if (result.indexOf('Error:') === 0) {
                        showCustomAlert('导出失败: ' + result.substring(6), true);
                    } else {
                        showCustomAlert('导出成功！文件已保存到: ' + result, false);
                    }
                } else {
                    showCustomAlert('导出失败，请检查脚本文件夹路径是否正确', true);
                }
            });
        });
    } else {
        showCustomAlert('数据管理器未初始化，无法导出设置', true);
    }
}

// Import settings
function importSettings() {
    // 使用AE脚本的文件选择对话框来获取完整路径
    csInterface.evalScript('importSettings()', function(result) {
        if (!result || result === 'null' || result === 'undefined') {
            return;
        }
        
        if (result.indexOf('Error:') === 0) {
            showCustomAlert('导入失败: ' + result.substring(6), true);
            return;
        }
        
        try {
            // 解析AE脚本返回的结果
            var importResult = JSON.parse(result);
            var importData = importResult.data;
            var importFilePath = importResult.filePath;
            var importDir = importResult.importDir; // 直接使用AE脚本返回的目录路径
            
            // 验证导入数据格式
            if (!importData.version || !importData.scriptSettings) {
                showCustomAlert('导入文件格式无效', true);
                return;
            }
            
            console.log('导入设置：文件路径信息');
            console.log('原始文件路径:', importFilePath);
            console.log('导入目录:', importDir);
            
            // 继续处理导入数据
            processImportData(importData, importDir);
            
        } catch (e) {
            showCustomAlert('解析导入结果失败: ' + e.message, true);
        }
    });
}

function processImportData(importData, importDir) {
    if (typeof DataManager !== 'undefined' && DataManager.initialized) {
        DataManager.loadData(function(loadError, currentData) {
            if (loadError) {
                showCustomAlert('加载当前数据失败: ' + loadError, true);
                return;
            }
            
            // 处理脚本设置中的图片路径
            var processedScriptSettings = {};
            
            // 获取新脚本文件夹路径 - 确保使用正确的路径分隔符
            var newScriptsPath = importDir ? importDir.replace(/\//g, '\\') + '\\scripts' : currentData.scriptsFolderPath;
            
            console.log('导入设置：新脚本文件夹路径:', newScriptsPath);
            
            // 处理脚本设置映射
            for (var oldScriptName in importData.scriptSettings) {
                var setting = JSON.parse(JSON.stringify(importData.scriptSettings[oldScriptName]));
                
                // 如果有图片路径且是相对路径，转换为绝对路径
                if (setting.imagePath && setting.imagePath.indexOf('./images/') === 0 && importDir) {
                    var imageName = setting.imagePath.replace('./images/', '');
                    setting.imagePath = importDir + '\\images\\' + imageName;
                }
                
                // 提取纯文件名（使用path.basename的逻辑）
                var scriptFileName = oldScriptName;
                var lastSlash = Math.max(oldScriptName.lastIndexOf('/'), oldScriptName.lastIndexOf('\\'));
                if (lastSlash > -1) {
                    scriptFileName = oldScriptName.substring(lastSlash + 1);
                }
                
                // 标准化新脚本路径为Windows格式（getScriptFiles返回的是Windows路径）
                var normalizedScriptsPath = newScriptsPath.replace(/\//g, '\\');
                
                // 构建新的脚本键值（完整的Windows路径格式，与getScriptFiles返回的path一致）
                var newScriptKey = normalizedScriptsPath + '\\' + scriptFileName;
                
                // 设置多种键值格式以确保兼容性
                processedScriptSettings[newScriptKey] = setting;
                processedScriptSettings[scriptFileName] = setting;
                
                // 也添加Unix风格路径作为备选
                var unixStyleKey = newScriptsPath.replace(/\\/g, '/') + '/' + scriptFileName;
                processedScriptSettings[unixStyleKey] = setting;
                
                // 如果原始键值不同，也保留它
                if (oldScriptName !== newScriptKey && oldScriptName !== scriptFileName && oldScriptName !== unixStyleKey) {
                    processedScriptSettings[oldScriptName] = setting;
                }
            }
            
            // 处理背景设置中的图片路径
            var processedBackgroundSettings = null;
            if (importData.backgroundSettings) {
                processedBackgroundSettings = JSON.parse(JSON.stringify(importData.backgroundSettings));
                
                // 如果有背景文件路径且是相对路径，转换为绝对路径
                if (processedBackgroundSettings.filePath && 
                    processedBackgroundSettings.filePath.indexOf('./backgrounds/') === 0 && 
                    importDir) {
                    var bgFileName = processedBackgroundSettings.filePath.replace('./backgrounds/', '');
                    var fullPath = importDir.replace(/\//g, '\\') + '\\backgrounds\\' + bgFileName;
                    
                    console.log('导入设置：处理背景文件路径');
                    console.log('原始路径:', processedBackgroundSettings.filePath);
                    console.log('完整路径:', fullPath);
                    
                    // 直接使用文件路径而不是Base64编码
                    try {
                        // 验证文件是否存在
                        csInterface.evalScript('getFilePath("' + fullPath.replace(/\\/g, '\\\\') + '")', function(pathResult) {
                            console.log('背景文件验证结果:', pathResult);
                            if (pathResult && pathResult !== 'null' && pathResult !== 'undefined' && !pathResult.startsWith('Error:')) {
                                processedBackgroundSettings.filePath = pathResult;
                                processedBackgroundSettings.fileName = bgFileName;
                                // 尝试从文件扩展名推断文件类型
                                var ext = bgFileName.toLowerCase().split('.').pop();
                                if (ext === 'mp4' || ext === 'webm' || ext === 'mov') {
                                    processedBackgroundSettings.fileType = 'video/' + ext;
                                } else if (ext === 'jpg' || ext === 'jpeg') {
                                    processedBackgroundSettings.fileType = 'image/jpeg';
                                } else if (ext === 'png') {
                                    processedBackgroundSettings.fileType = 'image/png';
                                } else if (ext === 'gif') {
                                    processedBackgroundSettings.fileType = 'image/gif';
                                } else if (ext === 'webp') {
                                    processedBackgroundSettings.fileType = 'image/webp';
                                } else if (ext === 'avif') {
                                    processedBackgroundSettings.fileType = 'image/avif';
                                } else if (ext === 'bmp') {
                                    processedBackgroundSettings.fileType = 'image/bmp';
                                } else if (ext === 'tiff' || ext === 'tif') {
                                    processedBackgroundSettings.fileType = 'image/tiff';
                                } else if (ext === 'svg') {
                                    processedBackgroundSettings.fileType = 'image/svg+xml';
                                } else if (ext === 'jfif') {
                                    processedBackgroundSettings.fileType = 'image/jfif';
                                } else {
                                    processedBackgroundSettings.fileType = 'image/' + ext;
                                }
                                console.log('背景设置处理完成:', processedBackgroundSettings);
                                // 在背景文件验证完成后继续处理数据合并和保存
                                continueImportProcess(importData, importDir, currentData, processedScriptSettings, processedBackgroundSettings);
                            } else {
                                console.log('背景文件不存在，跳过背景设置');
                                processedBackgroundSettings = null; // 如果文件不存在，不应用背景
                                // 即使背景文件验证失败，也继续导入其他设置
                                continueImportProcess(importData, importDir, currentData, processedScriptSettings, processedBackgroundSettings);
                            }
                        });
                        
                        // 如果需要处理背景文件，直接返回，等待异步回调
                        return;
                    } catch (e) {
                        console.error('背景文件验证异常:', e);
                        processedBackgroundSettings = null;
                    }
                } else {
                    console.log('背景设置无需路径转换或无导入目录');
                }
            }
            
            // 如果没有背景设置需要处理，直接继续导入流程
            continueImportProcess(importData, importDir, currentData, processedScriptSettings, processedBackgroundSettings);
        });
    } else {
        showCustomAlert('数据管理器未初始化，无法导入设置', true);
    }
}

// 继续导入流程函数
function continueImportProcess(importData, importDir, currentData, processedScriptSettings, processedBackgroundSettings) {
    try {
        // 合并脚本设置
        if (processedScriptSettings) {
            console.log('导入设置：合并脚本设置');
            for (var scriptName in processedScriptSettings) {
                currentData.scriptSettings[scriptName] = processedScriptSettings[scriptName];
            }
        }
        
        // 更新脚本文件夹路径
        if (importDir) {
            var newScriptsPath = importDir.replace(/\//g, '\\') + '\\scripts';
            console.log('导入设置：更新脚本文件夹路径');
            console.log('新脚本路径:', newScriptsPath);
            
            currentData.scriptsFolderPath = newScriptsPath;
        }
        
        // 应用背景设置
        if (processedBackgroundSettings) {
            console.log('导入设置：应用背景设置');
            
            // 将背景设置添加到currentData中
            currentData.backgroundSettings = processedBackgroundSettings;
            
            // 更新背景设置
            backgroundSettings = processedBackgroundSettings;
            
            // 保存背景设置到localStorage
            localStorage.setItem('backgroundSettings', JSON.stringify(backgroundSettings));
            
            // 应用背景到界面
            applyBackgroundSettings(processedBackgroundSettings);
        }
        
        // 保存合并后的数据
        console.log('导入设置：保存合并后的数据');
        
        DataManager.saveData(currentData, function(error, success) {
            if (error) {
                console.error('导入设置：数据保存失败:', error);
                showCustomAlert('设置导入失败：数据保存错误 - ' + error, true);
            } else {
                console.log('导入设置：数据保存成功，开始更新UI');
                
                try {
                    // 更新全局变量
                    scriptsFolderPath = currentData.scriptsFolderPath;
                    scriptSettings = currentData.scriptSettings || {};
                    categories = currentData.categories || ['全部'];
                    allTags = currentData.allTags || [];
                    
                    // 更新UI显示
                    if (scriptsFolderPath && folderPathInput) {
                        folderPathInput.value = scriptsFolderPath;
                    }
                    
                    // 重新填充分类和标签
                    if (typeof populateCategoryList === 'function') {
                        populateCategoryList();
                    }
                    if (typeof populateTagsPanel === 'function') {
                        populateTagsPanel();
                    }
                    
                    // 重新加载脚本列表
                    if (typeof populateScriptList === 'function') {
                        populateScriptList();
                    }
                    
                    // 应用背景设置
                    if (currentData.backgroundSettings) {
                        try {
                            localStorage.setItem('backgroundSettings', JSON.stringify(currentData.backgroundSettings));
                            
                            // 重新应用背景
                            if (typeof applyBackgroundSettings === 'function') {
                                applyBackgroundSettings(currentData.backgroundSettings);
                            } else if (typeof loadBackgroundSettings === 'function') {
                                loadBackgroundSettings();
                            }
                        } catch (bgError) {
                            console.error('背景设置应用失败:', bgError);
                        }
                    } else {
                        // 尝试从processedBackgroundSettings获取
                        if (typeof processedBackgroundSettings !== 'undefined' && processedBackgroundSettings) {
                            try {
                                localStorage.setItem('backgroundSettings', JSON.stringify(processedBackgroundSettings));
                                if (typeof applyBackgroundSettings === 'function') {
                                    applyBackgroundSettings(processedBackgroundSettings);
                                } else if (typeof loadBackgroundSettings === 'function') {
                                    loadBackgroundSettings();
                                }
                            } catch (bgError) {
                                console.error('备用背景设置应用失败:', bgError);
                            }
                        }
                    }
                    
                    // 使用安全的方式调用showCustomAlert
                    if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert('设置导入成功！', false);
                    } else if (typeof showCustomAlert === 'function') {
                        showCustomAlert('设置导入成功！', false);
                    } 
                } catch (uiError) {
                    console.error('UI更新过程中出错:', uiError);
                    
                    // 使用安全的方式显示错误
                    if (typeof window.showCustomAlert === 'function') {
                        window.showCustomAlert('导入成功，但UI更新时出现错误：' + uiError.message, true);
                    } else if (typeof showCustomAlert === 'function') {
                        showCustomAlert('导入成功，但UI更新时出现错误：' + uiError.message, true);
                    } else {
                        console.error('导入成功，但UI更新时出现错误：' + uiError.message);
                        showCustomAlert('导入成功，但UI更新时出现错误：' + uiError.message, true);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('导入设置：continueImportProcess执行出错:', error);
        showCustomAlert('设置导入失败：' + error.message, true);
    }
}

// Background setting functions
function showBackgroundModal() {
    backgroundModal.style.display = 'flex';
    // Load current background settings
    loadBackgroundSettings();
    
    // Initialize background fit options
    var fitOption = backgroundSettings.fit || 'cover';
    var fitRadio = document.querySelector('input[name="backgroundFit"][value="' + fitOption + '"]');
    if (fitRadio) {
        fitRadio.checked = true;
    }
    
    // Show/hide image editor based on fit option
    if (fitOption === 'custom') {
        showImageEditor();
    } else {
        hideImageEditor();
    }
}

function hideBackgroundModal() {
    // 移除自动保存逻辑，因为现在由"应用设置"按钮专门处理
    console.log('背景设置窗口关闭');
    backgroundModal.style.display = 'none';
}

function handleBackgroundFileSelect(event) {
    var file = event.target.files[0];
    if (file) {
        var fileType = file.type;
        var fileName = file.name.toLowerCase();
        
        // Check if file is supported format
        if (fileType.startsWith('image/') || fileType.startsWith('video/') || 
            fileName.endsWith('.gif') || fileName.endsWith('.mp4')) {
            
            // Store file with path information
            currentBackgroundFile = {
                name: file.name,
                type: file.type,
                size: file.size,
                path: file.path || file.webkitRelativePath || '',
                lastModified: file.lastModified,
                _originalFile: file
            };
            
            // Create object URL for preview (temporary, not stored)
            var fileUrl = URL.createObjectURL(file);
            
            // Clear previous preview
            previewImage.style.display = 'none';
            previewVideo.style.display = 'none';
            
            if (fileType.startsWith('video/') || fileName.endsWith('.mp4')) {
                // Video file
                previewVideo.src = fileUrl;
                previewVideo.style.display = 'block';
                previewVideo.loop = true;
                previewVideo.muted = true;
                previewVideo.play();
            } else {
                // Image file (including GIF)
                previewImage.src = fileUrl;
                previewImage.style.display = 'block';
            }
            
            backgroundPreview.style.display = 'block';
        } else {
            showCustomAlert('不支持的文件格式。请选择 JPG、PNG、GIF 或 MP4 文件。', true);
        }
    }
}

function clearBackground() {
    currentBackgroundFile = null;
    backgroundPreview.style.display = 'none';
    previewImage.src = '';
    previewVideo.src = '';
    previewImage.style.display = 'none';
    previewVideo.style.display = 'none';
    backgroundFileInput.value = '';
}

function updateBlurValue() {
    var value = blurSlider.value;
    blurValue.textContent = value + 'px';
    backgroundSettings.blur = parseInt(value);
    updatePreviewEffects();
}

function updateBrightnessValue() {
    var value = brightnessSlider.value;
    brightnessValue.textContent = value + '%';
    backgroundSettings.brightness = parseInt(value);
    updatePreviewEffects();
}

function updateOpacityValue() {
    var value = opacitySlider.value;
    opacityValue.textContent = value + '%';
    backgroundSettings.opacity = parseInt(value);
    // 实时应用透明度到界面元素
    applyUIOpacity(value);
}

function updateCardOpacityValue() {
    var value = cardOpacitySlider.value;
    cardOpacityValue.textContent = value + '%';
    backgroundSettings.cardOpacity = parseInt(value);
    // 实时应用脚本卡片透明度
    applyCardOpacity(value);
}

// 处理背景填充方式变化
function handleBackgroundFitChange() {
    var selectedFit = document.querySelector('input[name="backgroundFit"]:checked').value;
    backgroundSettings.fit = selectedFit;
    
    if (selectedFit === 'custom') {
        // 显示图片编辑器
        showImageEditor();
    } else {
        // 隐藏图片编辑器
        hideImageEditor();
        // 重置自定义位置
        backgroundSettings.customPosition = { x: 0, y: 0, width: 100, height: 100, scale: 1 };
    }
    
    // 更新预览
    updateBackgroundPreview();
}

// 显示图片编辑器
function showImageEditor() {
    if (imageEditor) {
        imageEditor.style.display = 'flex';
        
        // 设置背景图片到画布
        var imageUrl = '';
        if (currentBackgroundFile) {
            // 如果有当前选择的文件，使用文件数据
            if (currentBackgroundFile._savedData) {
                imageUrl = currentBackgroundFile._savedData;
            } else {
                // 读取文件数据
                var reader = new FileReader();
                reader.onload = function(e) {
                    currentBackgroundFile._savedData = e.target.result;
                    imageCanvas.style.backgroundImage = 'url(' + e.target.result + ')';
                    initializeCropBox();
                };
                reader.readAsDataURL(currentBackgroundFile);
                return;
            }
        } else {
            // 如果没有当前文件，尝试使用已保存的背景设置
            var savedSettings = localStorage.getItem('backgroundSettings');
            if (savedSettings) {
                try {
                    var bgData = JSON.parse(savedSettings);
                    if (bgData.fileData) {
                        imageUrl = bgData.fileData;
                    }
                } catch (e) {
                    console.error('Failed to load saved background:', e);
                }
            }
        }
        
        if (imageUrl) {
            imageCanvas.style.backgroundImage = 'url(' + imageUrl + ')';
            // 初始化裁剪框位置
            setTimeout(function() {
                initializeCropBox();
            }, 100);
        }
    }
}

// 隐藏图片编辑器
function hideImageEditor() {
    if (imageEditor) {
        imageEditor.style.display = 'none';
    }
}

// 初始化裁剪框
function initializeCropBox() {
    if (!cropBox || !imageCanvas) return;
    
    var pos = backgroundSettings.customPosition;
    var canvasRect = imageCanvas.getBoundingClientRect();
    
    // 确保画布有有效的尺寸
    if (canvasRect.width === 0 || canvasRect.height === 0) {
        // 延迟初始化，等待画布渲染完成
        setTimeout(function() {
            initializeCropBox();
        }, 100);
        return;
    }
    
    // 获取图片实际显示区域
    var imageDisplayPromise = getImageDisplayArea();
    if (imageDisplayPromise && typeof imageDisplayPromise.then === 'function') {
        imageDisplayPromise.then(function(imageArea) {
            // 基于图片实际显示区域计算裁剪框位置
            var left = imageArea.left + (pos.x / 100 * imageArea.width);
            var top = imageArea.top + (pos.y / 100 * imageArea.height);
            var width = Math.max(30, pos.width / 100 * imageArea.width);
            var height = Math.max(30, pos.height / 100 * imageArea.height);
            
            // 确保裁剪框在图片显示区域内
            left = Math.max(imageArea.left, Math.min(imageArea.left + imageArea.width - width, left));
            top = Math.max(imageArea.top, Math.min(imageArea.top + imageArea.height - height, top));
            
            cropBox.style.left = left + 'px';
            cropBox.style.top = top + 'px';
            cropBox.style.width = width + 'px';
            cropBox.style.height = height + 'px';
            
            // 确保裁剪框可见
            cropBox.style.display = 'block';
            cropBox.style.position = 'absolute';
            cropBox.style.pointerEvents = 'auto';
        });
    } else {
        // 降级处理：基于整个画布计算
        var left = Math.max(0, Math.min(canvasRect.width - 30, (pos.x / 100 * canvasRect.width)));
        var top = Math.max(0, Math.min(canvasRect.height - 30, (pos.y / 100 * canvasRect.height)));
        var width = Math.max(30, Math.min(canvasRect.width - left, (pos.width / 100 * canvasRect.width)));
        var height = Math.max(30, Math.min(canvasRect.height - top, (pos.height / 100 * canvasRect.height)));
        
        cropBox.style.left = left + 'px';
        cropBox.style.top = top + 'px';
        cropBox.style.width = width + 'px';
        cropBox.style.height = height + 'px';
        
        // 确保裁剪框可见
        cropBox.style.display = 'block';
        cropBox.style.position = 'absolute';
        cropBox.style.pointerEvents = 'auto';
    }
}

// 设置图片编辑器事件
function setupImageEditorEvents() {
    if (!cropBox) return;
    
    // 移除之前的事件监听器，避免重复绑定
    document.removeEventListener('mousemove', handleImageEditorMouseMove);
    document.removeEventListener('mouseup', handleImageEditorMouseUp);
    
    // 拖拽手柄事件
    var resizeHandles = cropBox.querySelectorAll('.resize-handle');
    resizeHandles.forEach(function(handle) {
        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeDirection = handle.dataset.direction;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastMoveTime = 0; // 重置节流计时器
            
            // 清除之前的初始位置缓存
            window.initialCropPosition = null;
            
            // 添加鼠标样式
            document.body.style.cursor = getResizeCursor(resizeDirection);
        });
    });
    
    // 边框拖拽事件
    var edgeHandles = cropBox.querySelectorAll('.edge-handle');
    edgeHandles.forEach(function(handle) {
        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeDirection = handle.dataset.direction;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastMoveTime = 0; // 重置节流计时器
            
            // 清除之前的初始位置缓存
            window.initialCropPosition = null;
            
            // 添加鼠标样式
            document.body.style.cursor = getResizeCursor(resizeDirection);
        });
    });
    
    // 移动手柄事件
    var moveHandle = cropBox.querySelector('.move-handle');
    if (moveHandle) {
        moveHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastMoveTime = 0; // 重置节流计时器
            
            // 清除之前的初始位置缓存
            window.initialCropPosition = null;
            
            // 添加移动鼠标样式
            document.body.style.cursor = 'move';
        });
    }
    
    // 裁剪框本身的拖拽事件（作为备用）
    cropBox.addEventListener('mousedown', function(e) {
        // 只有当点击的是裁剪框本身，而不是手柄时才触发
        if (e.target === cropBox) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastMoveTime = 0;
            
            // 清除之前的初始位置缓存
            window.initialCropPosition = null;
            
            document.body.style.cursor = 'move';
        }
    });
    
    // 全局鼠标事件
    document.addEventListener('mousemove', handleImageEditorMouseMove);
    document.addEventListener('mouseup', handleImageEditorMouseUp);
    
    // 窗口大小变化时重新初始化裁剪框
    var resizeTimeout;
    window.addEventListener('resize', function() {
        if (imageEditor && imageEditor.style.display !== 'none') {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                initializeCropBox();
            }, 100);
        }
    });
}

// 获取调整大小时的鼠标样式
function getResizeCursor(direction) {
    switch (direction) {
        case 'nw':
        case 'se':
            return 'nw-resize';
        case 'ne':
        case 'sw':
            return 'ne-resize';
        case 'n':
        case 's':
            return 'ns-resize';
        case 'w':
        case 'e':
            return 'ew-resize';
        default:
            return 'default';
    }
}

// 处理图片编辑器鼠标移动
function handleImageEditorMouseMove(e) {
    if (!isDragging && !isResizing) return;
    
    // 节流处理，提升性能
    var currentTime = Date.now();
    if (currentTime - lastMoveTime < moveThrottle) {
        return;
    }
    lastMoveTime = currentTime;
    
    e.preventDefault();
    
    var deltaX = e.clientX - dragStartX;
    var deltaY = e.clientY - dragStartY;
    var canvasRect = imageCanvas.getBoundingClientRect();
    
    if (isDragging) {
        // 移动裁剪框 - 基于初始位置计算
        if (!window.initialCropPosition) {
            // 如果没有初始位置，获取当前位置作为基准
            var currentRect = cropBox.getBoundingClientRect();
            window.initialCropPosition = {
                left: currentRect.left - canvasRect.left,
                top: currentRect.top - canvasRect.top,
                width: currentRect.width,
                height: currentRect.height
            };
        }
        
        var newLeft = window.initialCropPosition.left + deltaX;
        var newTop = window.initialCropPosition.top + deltaY;
        
        // 获取图片实际显示区域进行边界检测
        var imageDisplayPromise = getImageDisplayArea();
        if (imageDisplayPromise && typeof imageDisplayPromise.then === 'function') {
            imageDisplayPromise.then(function(imageArea) {
                // 确保不超出图片显示区域边界
                newLeft = Math.max(imageArea.left, Math.min(imageArea.left + imageArea.width - window.initialCropPosition.width, newLeft));
                newTop = Math.max(imageArea.top, Math.min(imageArea.top + imageArea.height - window.initialCropPosition.height, newTop));
                
                cropBox.style.left = newLeft + 'px';
                cropBox.style.top = newTop + 'px';
            });
        } else {
            // 降级处理：基于整个画布边界
            newLeft = Math.max(0, Math.min(canvasRect.width - window.initialCropPosition.width, newLeft));
            newTop = Math.max(0, Math.min(canvasRect.height - window.initialCropPosition.height, newTop));
            
            cropBox.style.left = newLeft + 'px';
            cropBox.style.top = newTop + 'px';
        }
        
    } else if (isResizing) {
        // 调整裁剪框大小 - 基于初始位置和尺寸计算
        if (!window.initialCropPosition) {
            var currentRect = cropBox.getBoundingClientRect();
            window.initialCropPosition = {
                left: currentRect.left - canvasRect.left,
                top: currentRect.top - canvasRect.top,
                width: currentRect.width,
                height: currentRect.height
            };
        }
        resizeCropBoxWithImageBounds(deltaX, deltaY, canvasRect, window.initialCropPosition);
    }
    
    // 延迟更新背景设置，避免频繁计算
    clearTimeout(window.updatePositionTimer);
    window.updatePositionTimer = setTimeout(function() {
        updateCustomPosition();
    }, 50);
}

// 处理图片编辑器鼠标释放
function handleImageEditorMouseUp(e) {
    if (isDragging || isResizing) {
        // 确保最终更新位置
        clearTimeout(window.updatePositionTimer);
        updateCustomPosition();
        
        // 重置拖拽状态
        isDragging = false;
        isResizing = false;
        resizeDirection = '';
        
        // 清除初始位置缓存
        window.initialCropPosition = null;
        
        // 恢复默认鼠标样式
        document.body.style.cursor = 'default';
        
        // 重置节流计时器
        lastMoveTime = 0;
    }
}

// 基于图片实际显示区域调整裁剪框大小
function resizeCropBoxWithImageBounds(deltaX, deltaY, canvasRect, initialPosition) {
    var imageDisplayPromise = getImageDisplayArea();
    if (imageDisplayPromise && typeof imageDisplayPromise.then === 'function') {
        imageDisplayPromise.then(function(imageArea) {
            resizeCropBoxInternal(deltaX, deltaY, imageArea, initialPosition);
        });
    } else {
        // 降级处理：使用整个画布区域
        var fallbackArea = {
            left: 0,
            top: 0,
            width: canvasRect.width,
            height: canvasRect.height
        };
        resizeCropBoxInternal(deltaX, deltaY, fallbackArea, initialPosition);
    }
}

// 调整裁剪框大小的内部实现
function resizeCropBoxInternal(deltaX, deltaY, boundaryArea, initialPosition) {
    var currentLeft = initialPosition.left;
    var currentTop = initialPosition.top;
    var currentWidth = initialPosition.width;
    var currentHeight = initialPosition.height;
    
    var newLeft = currentLeft;
    var newTop = currentTop;
    var newWidth = currentWidth;
    var newHeight = currentHeight;
    
    // 最小尺寸限制
    var minSize = 30;
    
    switch (resizeDirection) {
        case 'nw': // 左上角
            var proposedLeft = currentLeft + deltaX;
            var proposedTop = currentTop + deltaY;
            var proposedWidth = currentWidth - deltaX;
            var proposedHeight = currentHeight - deltaY;
            
            // 检查最小尺寸和边界 - 宽度
            if (proposedWidth >= minSize && proposedLeft >= boundaryArea.left) {
                newLeft = proposedLeft;
                newWidth = proposedWidth;
            } else if (proposedLeft < boundaryArea.left) {
                // 如果超出左边界，调整到边界位置
                newLeft = boundaryArea.left;
                newWidth = currentLeft + currentWidth - boundaryArea.left;
            }
            
            // 检查最小尺寸和边界 - 高度
            if (proposedHeight >= minSize && proposedTop >= boundaryArea.top) {
                newTop = proposedTop;
                newHeight = proposedHeight;
            } else if (proposedTop < boundaryArea.top) {
                // 如果超出上边界，调整到边界位置
                newTop = boundaryArea.top;
                newHeight = currentTop + currentHeight - boundaryArea.top;
            }
            break;
            
        case 'ne': // 右上角
            var proposedTop = currentTop + deltaY;
            var proposedWidth = currentWidth + deltaX;
            var proposedHeight = currentHeight - deltaY;
            
            // 检查高度边界
            if (proposedHeight >= minSize && proposedTop >= boundaryArea.top) {
                newTop = proposedTop;
                newHeight = proposedHeight;
            } else if (proposedTop < boundaryArea.top) {
                // 如果超出上边界，调整到边界位置
                newTop = boundaryArea.top;
                newHeight = currentTop + currentHeight - boundaryArea.top;
            }
            
            // 检查宽度边界
            if (proposedWidth >= minSize && currentLeft + proposedWidth <= boundaryArea.left + boundaryArea.width) {
                newWidth = proposedWidth;
            } else if (currentLeft + proposedWidth > boundaryArea.left + boundaryArea.width) {
                // 如果超出右边界，调整到边界位置
                newWidth = boundaryArea.left + boundaryArea.width - currentLeft;
            }
            break;
            
        case 'sw': // 左下角
            var proposedLeft = currentLeft + deltaX;
            var proposedWidth = currentWidth - deltaX;
            var proposedHeight = currentHeight + deltaY;
            
            // 检查宽度边界
            if (proposedWidth >= minSize && proposedLeft >= boundaryArea.left) {
                newLeft = proposedLeft;
                newWidth = proposedWidth;
            } else if (proposedLeft < boundaryArea.left) {
                // 如果超出左边界，调整到边界位置
                newLeft = boundaryArea.left;
                newWidth = currentLeft + currentWidth - boundaryArea.left;
            }
            
            // 检查高度边界
            if (proposedHeight >= minSize && currentTop + proposedHeight <= boundaryArea.top + boundaryArea.height) {
                newHeight = proposedHeight;
            } else if (currentTop + proposedHeight > boundaryArea.top + boundaryArea.height) {
                // 如果超出下边界，调整到边界位置
                newHeight = boundaryArea.top + boundaryArea.height - currentTop;
            }
            break;
            
        case 'se': // 右下角
            var proposedWidth = currentWidth + deltaX;
            var proposedHeight = currentHeight + deltaY;
            
            // 检查宽度边界
            if (proposedWidth >= minSize && currentLeft + proposedWidth <= boundaryArea.left + boundaryArea.width) {
                newWidth = proposedWidth;
            } else if (currentLeft + proposedWidth > boundaryArea.left + boundaryArea.width) {
                // 如果超出右边界，调整到边界位置
                newWidth = boundaryArea.left + boundaryArea.width - currentLeft;
            }
            
            // 检查高度边界
            if (proposedHeight >= minSize && currentTop + proposedHeight <= boundaryArea.top + boundaryArea.height) {
                newHeight = proposedHeight;
            } else if (currentTop + proposedHeight > boundaryArea.top + boundaryArea.height) {
                // 如果超出下边界，调整到边界位置
                newHeight = boundaryArea.top + boundaryArea.height - currentTop;
            }
            break;
            
        case 'n': // 上边
            var proposedTop = currentTop + deltaY;
            var proposedHeight = currentHeight - deltaY;
            
            // 确保不超出上边界且满足最小高度
            if (proposedHeight >= minSize && proposedTop >= boundaryArea.top) {
                newTop = proposedTop;
                newHeight = proposedHeight;
            } else if (proposedTop < boundaryArea.top) {
                // 如果超出上边界，调整到边界位置
                newTop = boundaryArea.top;
                newHeight = currentTop + currentHeight - boundaryArea.top;
            }
            break;
            
        case 's': // 下边
            var proposedHeight = currentHeight + deltaY;
            
            if (proposedHeight >= minSize && currentTop + proposedHeight <= boundaryArea.top + boundaryArea.height) {
                newHeight = proposedHeight;
            } else if (currentTop + proposedHeight > boundaryArea.top + boundaryArea.height) {
                // 如果超出下边界，调整到边界位置
                newHeight = boundaryArea.top + boundaryArea.height - currentTop;
            }
            break;
            
        case 'w': // 左边
            var proposedLeft = currentLeft + deltaX;
            var proposedWidth = currentWidth - deltaX;
            
            // 确保不超出左边界且满足最小宽度
            if (proposedWidth >= minSize && proposedLeft >= boundaryArea.left) {
                newLeft = proposedLeft;
                newWidth = proposedWidth;
            } else if (proposedLeft < boundaryArea.left) {
                // 如果超出左边界，调整到边界位置
                newLeft = boundaryArea.left;
                newWidth = currentLeft + currentWidth - boundaryArea.left;
            }
            break;
            
        case 'e': // 右边
            var proposedWidth = currentWidth + deltaX;
            
            if (proposedWidth >= minSize && currentLeft + proposedWidth <= boundaryArea.left + boundaryArea.width) {
                newWidth = proposedWidth;
            } else if (currentLeft + proposedWidth > boundaryArea.left + boundaryArea.width) {
                // 如果超出右边界，调整到边界位置
                newWidth = boundaryArea.left + boundaryArea.width - currentLeft;
            }
            break;
    }
    
    // 应用新的位置和尺寸
    cropBox.style.left = newLeft + 'px';
    cropBox.style.top = newTop + 'px';
    cropBox.style.width = newWidth + 'px';
    cropBox.style.height = newHeight + 'px';
}

// 更新自定义位置设置
// 计算图片在画布中的实际显示区域
function getImageDisplayArea() {
    if (!imageCanvas) return null;
    
    var canvasRect = imageCanvas.getBoundingClientRect();
    var canvasWidth = canvasRect.width;
    var canvasHeight = canvasRect.height;
    
    // 获取背景图片的原始尺寸
    var backgroundImage = imageCanvas.style.backgroundImage;
    if (!backgroundImage || backgroundImage === 'none') {
        return {
            left: 0,
            top: 0,
            width: canvasWidth,
            height: canvasHeight
        };
    }
    
    // 创建临时图片元素来获取原始尺寸
    return new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() {
            var imgWidth = img.naturalWidth;
            var imgHeight = img.naturalHeight;
            
            // 计算contain模式下的实际显示尺寸
            var scaleX = canvasWidth / imgWidth;
            var scaleY = canvasHeight / imgHeight;
            var scale = Math.min(scaleX, scaleY);
            
            var displayWidth = imgWidth * scale;
            var displayHeight = imgHeight * scale;
            
            // 计算居中显示的偏移
            var offsetX = (canvasWidth - displayWidth) / 2;
            var offsetY = (canvasHeight - displayHeight) / 2;
            
            resolve({
                left: offsetX,
                top: offsetY,
                width: displayWidth,
                height: displayHeight
            });
        };
        
        // 从backgroundImage中提取URL
        var urlMatch = backgroundImage.match(/url\(["']?([^"'\)]+)["']?\)/);
        if (urlMatch) {
            img.src = urlMatch[1];
        } else {
            // 如果无法获取图片，返回整个画布区域
            resolve({
                left: 0,
                top: 0,
                width: canvasWidth,
                height: canvasHeight
            });
        }
    });
}

function updateCustomPosition() {
    if (!cropBox || !imageCanvas) return;
    
    var canvasRect = imageCanvas.getBoundingClientRect();
    var cropRect = cropBox.getBoundingClientRect();
    
    // 获取图片实际显示区域
    var imageDisplayPromise = getImageDisplayArea();
    if (imageDisplayPromise && typeof imageDisplayPromise.then === 'function') {
        imageDisplayPromise.then(function(imageArea) {
            // 基于图片实际显示区域计算相对位置
            var relativeLeft = cropRect.left - canvasRect.left - imageArea.left;
            var relativeTop = cropRect.top - canvasRect.top - imageArea.top;
            
            backgroundSettings.customPosition = {
                x: (relativeLeft / imageArea.width) * 100,
                y: (relativeTop / imageArea.height) * 100,
                width: (cropRect.width / imageArea.width) * 100,
                height: (cropRect.height / imageArea.height) * 100,
                scale: 1
            };
        });
    } else {
        // 降级处理：基于整个画布计算
        backgroundSettings.customPosition = {
            x: ((cropRect.left - canvasRect.left) / canvasRect.width) * 100,
            y: ((cropRect.top - canvasRect.top) / canvasRect.height) * 100,
            width: (cropRect.width / canvasRect.width) * 100,
            height: (cropRect.height / canvasRect.height) * 100,
            scale: 1
        };
    }
}

// 更新背景预览
function updateBackgroundPreview() {
    if (!currentBackgroundFile) return;
    
    var fit = backgroundSettings.fit;
    var customPos = backgroundSettings.customPosition;
    
    // 更新预览图片的样式
    if (previewImage && previewImage.style.display !== 'none') {
        switch (fit) {
            case 'cover':
                previewImage.style.objectFit = 'cover';
                previewImage.style.objectPosition = 'center';
                break;
            case 'contain':
                previewImage.style.objectFit = 'contain';
                previewImage.style.objectPosition = 'center';
                break;
            case 'fill':
                previewImage.style.objectFit = 'fill';
                previewImage.style.objectPosition = 'center';
                break;
            case 'custom':
                previewImage.style.objectFit = 'none';
                previewImage.style.objectPosition = customPos.x + '% ' + customPos.y + '%';
                previewImage.style.transform = 'scale(' + (customPos.scale || 1) + ')';
                break;
        }
    }
    
    // 更新预览视频的样式
    if (previewVideo && previewVideo.style.display !== 'none') {
        switch (fit) {
            case 'cover':
                previewVideo.style.objectFit = 'cover';
                previewVideo.style.objectPosition = 'center';
                break;
            case 'contain':
                previewVideo.style.objectFit = 'contain';
                previewVideo.style.objectPosition = 'center';
                break;
            case 'fill':
                previewVideo.style.objectFit = 'fill';
                previewVideo.style.objectPosition = 'center';
                break;
            case 'custom':
                previewVideo.style.objectFit = 'none';
                previewVideo.style.objectPosition = customPos.x + '% ' + customPos.y + '%';
                previewVideo.style.transform = 'scale(' + (customPos.scale || 1) + ')';
                break;
        }
    }
}

// 应用UI透明度
function applyUIOpacity(opacityPercent) {
    var opacity = opacityPercent / 100;
    
    // 获取当前主题
    var currentThemeClass = '';
    if (document.body.classList.contains('theme-neumorphism')) {
        currentThemeClass = 'theme-neumorphism';
    } else if (document.body.classList.contains('theme-cute')) {
        currentThemeClass = 'theme-cute';
    } else if (document.body.classList.contains('theme-handdrawn')) {
        currentThemeClass = 'theme-handdrawn';
    } else if (document.body.classList.contains('theme-glassmorphism-dark')) {
        currentThemeClass = 'theme-glassmorphism-dark';
    }
    
    // 动态创建或更新CSS样式
    var styleId = 'dynamic-ui-opacity';
    var existingStyle = document.getElementById(styleId);
    if (existingStyle) {
        existingStyle.remove();
    }
    
    var style = document.createElement('style');
    style.id = styleId;
    
    var css = '';
    
    // 根据不同主题设置透明度
    if (currentThemeClass === 'theme-neumorphism') {
        css += `
            body.has-background.theme-neumorphism .main-content,
            body.has-background.theme-neumorphism .script-list,
            body.has-background.theme-neumorphism .sidebar {
                background: rgba(248, 249, 250, ${opacity}) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-cute') {
        css += `
            body.has-background.theme-cute .main-content,
            body.has-background.theme-cute .script-list,
            body.has-background.theme-cute .sidebar {
                background: rgba(254, 247, 247, ${opacity}) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-handdrawn') {
        css += `
            body.has-background.theme-handdrawn .main-content,
            body.has-background.theme-handdrawn .script-list,
            body.has-background.theme-handdrawn .sidebar {
                background: rgba(248, 244, 236, ${opacity}) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-glassmorphism-dark') {
        css += `
            body.has-background.theme-glassmorphism-dark .script-list {
                background: rgba(15, 15, 25, ${opacity * 0.3}) !important;
            }
            body.has-background.theme-glassmorphism-dark .sidebar {
                background: rgba(15, 15, 25, ${opacity * 0.4}) !important;
            }
        `;
    } else {
        // 默认暗色主题
        css += `
            body.has-background .main-content,
            body.has-background .script-list,
            body.has-background .sidebar {
                background-color: rgba(30, 30, 35, ${opacity * 0.9}) !important;
            }
        `;
    }
    
    // 添加通用的顶部和底部控制区域透明度
    css += `
        body.has-background .top-controls,
        body.has-background .bottom-controls-compact {
            background-color: rgba(20, 20, 20, ${opacity * 0.8}) !important;
        }
    `;
    
    style.textContent = css;
    document.head.appendChild(style);
}

// 应用脚本卡片透明度
function applyCardOpacity(opacityPercent) {
    var opacity = opacityPercent / 100;
    
    // 获取当前主题
    var currentThemeClass = '';
    if (document.body.classList.contains('theme-neumorphism')) {
        currentThemeClass = 'theme-neumorphism';
    } else if (document.body.classList.contains('theme-cute')) {
        currentThemeClass = 'theme-cute';
    } else if (document.body.classList.contains('theme-handdrawn')) {
        currentThemeClass = 'theme-handdrawn';
    } else if (document.body.classList.contains('theme-glassmorphism-dark')) {
        currentThemeClass = 'theme-glassmorphism-dark';
    }
    
    // 动态创建或更新CSS样式
    var styleId = 'dynamic-card-opacity';
    var existingStyle = document.getElementById(styleId);
    if (existingStyle) {
        existingStyle.remove();
    }
    
    var style = document.createElement('style');
    style.id = styleId;
    
    var css = '';
    
    // 根据不同主题设置脚本卡片透明度
    if (currentThemeClass === 'theme-neumorphism') {
        css += `
            body.has-background.theme-neumorphism .script-item {
                background: linear-gradient(145deg, rgba(248, 249, 250, ${opacity}), rgba(240, 242, 245, ${opacity * 0.9})) !important;
            }
            body.has-background.theme-neumorphism .script-item:hover {
                background: linear-gradient(145deg, rgba(241, 243, 244, ${opacity}), rgba(248, 249, 250, ${opacity * 0.95})) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-cute') {
        css += `
            body.has-background.theme-cute .script-item {
                background: linear-gradient(145deg, rgba(254, 247, 247, ${opacity}), rgba(252, 231, 243, ${opacity * 0.9})) !important;
            }
            body.has-background.theme-cute .script-item:hover {
                background: linear-gradient(145deg, rgba(252, 231, 243, ${opacity}), rgba(254, 247, 247, ${opacity * 0.95})) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-handdrawn') {
        css += `
            body.has-background.theme-handdrawn .script-item {
                background: linear-gradient(145deg, rgba(248, 244, 236, ${opacity}), rgba(245, 241, 232, ${opacity * 0.9})) !important;
            }
            body.has-background.theme-handdrawn .script-item:hover {
                background: linear-gradient(145deg, rgba(245, 241, 232, ${opacity}), rgba(248, 244, 236, ${opacity * 0.95})) !important;
            }
        `;
    } else if (currentThemeClass === 'theme-glassmorphism-dark') {
        css += `
            body.has-background.theme-glassmorphism-dark .script-item {
                background: rgba(20, 25, 40, ${opacity * 0.6}) !important;
                backdrop-filter: blur(10px) !important;
            }
            body.has-background.theme-glassmorphism-dark .script-item:hover {
                background: rgba(30, 35, 50, ${opacity * 0.7}) !important;
            }
        `;
    } else {
        // 默认暗色主题
        css += `
            body.has-background .script-item {
                background: linear-gradient(145deg, rgba(20, 20, 20, ${opacity}), rgba(30, 30, 30, ${opacity * 0.8})) !important;
            }
            body.has-background .script-item:hover {
                background: linear-gradient(145deg, rgba(35, 35, 35, ${opacity * 0.95}), rgba(45, 45, 45, ${opacity * 0.9})) !important;
            }
        `;
    }
    
    style.textContent = css;
    document.head.appendChild(style);
}

function updatePreviewEffects() {
    var blur = backgroundSettings.blur;
    var brightness = backgroundSettings.brightness;
    
    // Apply blur effect
    var blurFilter = blur > 0 ? 'blur(' + blur + 'px)' : 'none';
    
    // Calculate brightness overlay
    var overlay = '';
    if (brightness < 0) {
        // Darker (black overlay)
        var opacity = Math.abs(brightness) / 100;
        overlay = 'linear-gradient(rgba(0,0,0,' + opacity + '), rgba(0,0,0,' + opacity + '))';
    } else if (brightness > 0) {
        // Brighter (white overlay)
        var opacity = brightness / 100;
        overlay = 'linear-gradient(rgba(255,255,255,' + opacity + '), rgba(255,255,255,' + opacity + '))';
    }
    
    if (previewImage.style.display === 'block') {
        previewImage.style.filter = blurFilter;
        if (overlay) {
            previewImage.style.background = overlay + ', url(' + previewImage.src + ')';
            previewImage.style.backgroundSize = 'cover';
            previewImage.style.backgroundPosition = 'center';
        }
    }
    
    if (previewVideo.style.display === 'block') {
        previewVideo.style.filter = blurFilter;
        if (overlay) {
            previewVideo.parentElement.style.background = overlay;
        }
    }
}

// 专用的背景设置保存函数，避免触发完整的设置重新加载
function saveBackgroundSettingsOnly() {
    console.log('背景设置应用-步骤4: 开始保存背景设置（仅背景设置）');
    
    try {
        // 只保存背景相关的设置到DataManager，避免触发完整的UI重建
        if (typeof DataManager !== 'undefined' && DataManager.isAvailable()) {
            // 获取当前的背景设置
            var savedBackgroundSettings = localStorage.getItem('backgroundSettings');
            if (savedBackgroundSettings) {
                // 只更新背景设置部分
                DataManager.setData('backgroundSettings', savedBackgroundSettings);
                console.log('背景设置应用-步骤5: 背景设置已保存到DataManager');
            }
        } else {
            console.log('背景设置应用-步骤5: DataManager不可用，背景设置已保存到localStorage');
        }
    } catch (error) {
        console.error('保存背景设置时出错:', error);
    }
}

function applyBackgroundSettings(backgroundSettingsData) {
    console.log('背景设置应用-步骤1: applyBackgroundSettings函数开始执行');
    console.log('背景设置应用-步骤2: currentBackgroundFile:', currentBackgroundFile);
    console.log('背景设置应用-步骤3: backgroundSettingsData:', backgroundSettingsData);
    
    // 如果传入了背景设置数据，优先使用传入的数据重建currentBackgroundFile
    if (backgroundSettingsData && backgroundSettingsData.fileName && backgroundSettingsData.filePath) {
        // 重建currentBackgroundFile
        currentBackgroundFile = {
            name: backgroundSettingsData.fileName,
            type: backgroundSettingsData.fileType,
            size: backgroundSettingsData.fileSize || 0,
            path: backgroundSettingsData.filePath,
            lastModified: backgroundSettingsData.lastModified || Date.now(),
            _isFromStorage: true,
            _savedPath: backgroundSettingsData.filePath,
            _savedData: backgroundSettingsData.fileData
        };
    }
    
    if (currentBackgroundFile) {
        // Check if this is a virtual file object from storage
        if (currentBackgroundFile._isFromStorage) {
            // Use saved data directly
            var backgroundData = {
                    filePath: currentBackgroundFile._savedPath,
                    fileData: currentBackgroundFile._savedData, // Keep for backward compatibility
                    fileName: currentBackgroundFile.name,
                    fileType: currentBackgroundFile.type,
                    blur: backgroundSettings.blur,
                    brightness: backgroundSettings.brightness,
                    opacity: backgroundSettings.opacity,
                    cardOpacity: backgroundSettings.cardOpacity,
                    fit: backgroundSettings.fit,
                    customPosition: backgroundSettings.customPosition
                };
            
            // Save to localStorage
            localStorage.setItem('backgroundSettings', JSON.stringify(backgroundData));
            
            // Apply to body
            applyBackgroundToBody(backgroundData);
            
            // 只保存背景设置，避免触发完整的设置重新加载
            saveBackgroundSettingsOnly();
            
            hideBackgroundModal();
        } else {
            // No file size limit - allow any size video or image as background
            // Use file path directly without Base64 encoding
            var filePath = '';
            if (currentBackgroundFile.path) {
                filePath = currentBackgroundFile.path;
            } else if (currentBackgroundFile._originalFile && currentBackgroundFile._originalFile.path) {
                filePath = currentBackgroundFile._originalFile.path;
            } else if (currentBackgroundFile.webkitRelativePath) {
                filePath = currentBackgroundFile.webkitRelativePath;
            }
            
            var backgroundData = {
                filePath: filePath,
                fileName: currentBackgroundFile.name,
                fileType: currentBackgroundFile.type,
                fileSize: currentBackgroundFile.size,
                lastModified: currentBackgroundFile.lastModified,
                blur: backgroundSettings.blur,
                brightness: backgroundSettings.brightness,
                opacity: backgroundSettings.opacity,
                cardOpacity: backgroundSettings.cardOpacity,
                fit: backgroundSettings.fit,
                customPosition: backgroundSettings.customPosition
            };
            
            // 如果没有有效的文件路径，尝试获取文件的完整路径
            if (!backgroundData.filePath && currentBackgroundFile._originalFile) {
                // 对于本地文件，尝试通过文件选择器获取路径
                try {
                    var fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.webkitdirectory = false;
                    // 注意：由于安全限制，我们无法直接获取文件的完整路径
                    // 但我们可以保存文件名，在导出时提醒用户
                    console.log('背景文件路径为空，将保存文件名用于导出');
                } catch (e) {
                    console.warn('无法获取文件路径:', e);
                }
            }
            
            try {
                // Save to localStorage (much smaller now)
                var settingsData = JSON.stringify(backgroundData);
                localStorage.setItem('backgroundSettings', settingsData);
                
                // Apply to body
                applyBackgroundToBody(backgroundData);
                
                // 只保存背景设置，避免触发完整的设置重新加载
                saveBackgroundSettingsOnly();
                
                hideBackgroundModal();
            } catch (e) {
                showCustomAlert('保存背景设置失败：' + e.message, true);
            }
        }
    } else {
        // Clear background
        localStorage.removeItem('backgroundSettings');
        clearBodyBackground();
        
        // 只保存背景设置的清除状态，避免触发完整的设置重新加载
        saveBackgroundSettingsOnly();
        
        hideBackgroundModal();
    }
}

function loadBackgroundSettings() {
    var savedSettings = localStorage.getItem('backgroundSettings');
    
    if (savedSettings) {
        try {
            var backgroundData = JSON.parse(savedSettings);
            
            backgroundSettings.blur = backgroundData.blur || 0;
            backgroundSettings.brightness = backgroundData.brightness || 0;
            backgroundSettings.opacity = backgroundData.opacity || 50;
            backgroundSettings.cardOpacity = backgroundData.cardOpacity || 80;
            backgroundSettings.fit = backgroundData.fit || 'cover';
            backgroundSettings.customPosition = backgroundData.customPosition || { x: 0, y: 0, width: 100, height: 100, scale: 1 };
            
            // Update sliders
            blurSlider.value = backgroundSettings.blur;
            brightnessSlider.value = backgroundSettings.brightness;
            opacitySlider.value = backgroundSettings.opacity;
            cardOpacitySlider.value = backgroundSettings.cardOpacity;
            blurValue.textContent = backgroundSettings.blur + 'px';
            brightnessValue.textContent = backgroundSettings.brightness + '%';
            opacityValue.textContent = backgroundSettings.opacity + '%';
            cardOpacityValue.textContent = backgroundSettings.cardOpacity + '%';
            
            // Show preview
            if (backgroundData.filePath) {
                var fileType = backgroundData.fileType || '';
                var fileName = backgroundData.fileName || '';
                var fileSrc = backgroundData.filePath;
                
                // Create a virtual file object from saved data to enable apply functionality
                // This allows users to re-apply existing background settings
                currentBackgroundFile = {
                    name: backgroundData.fileName,
                    type: backgroundData.fileType,
                    size: backgroundData.fileSize || 0,
                    path: backgroundData.filePath,
                    lastModified: backgroundData.lastModified || Date.now(),
                    // Add a flag to indicate this is loaded from storage
                    _isFromStorage: true,
                    _savedPath: backgroundData.filePath
                };
                
                previewImage.style.display = 'none';
                previewVideo.style.display = 'none';
                
                if (fileType.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4')) {
                    previewVideo.src = fileSrc;
                    previewVideo.style.display = 'block';
                    previewVideo.loop = true;
                    previewVideo.muted = true;
                    previewVideo.play();
                } else {
                    previewImage.src = fileSrc;
                    previewImage.style.display = 'block';
                }
                
                backgroundPreview.style.display = 'block';
                updatePreviewEffects();
            }
        } catch (e) {
            console.error('Failed to load background settings:', e);
        }
    } else {
        // Reset to defaults
        backgroundSettings.blur = 0;
        backgroundSettings.brightness = 0;
        backgroundSettings.opacity = 50;
        backgroundSettings.cardOpacity = 80;
        blurSlider.value = 0;
        brightnessSlider.value = 0;
        opacitySlider.value = 50;
        cardOpacitySlider.value = 80;
        blurValue.textContent = '0px';
        brightnessValue.textContent = '0%';
        opacityValue.textContent = '50%';
        cardOpacityValue.textContent = '80%';
        clearBackground();
    }
}

function applyBackgroundToBody(backgroundData) {
    console.log('背景设置应用-步骤6: 开始应用背景到页面');
    var startTime = performance.now();
    
    var body = document.body;
    var fileType = backgroundData.fileType || '';
    var fileName = backgroundData.fileName || '';
    
    // Get existing background container
    var bgContainer = document.querySelector('.background-container');
    if (!bgContainer) {
        // Create background container if it doesn't exist
        bgContainer = document.createElement('div');
        bgContainer.className = 'background-container';
        bgContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
        `;
        body.insertBefore(bgContainer, body.firstChild);
    }
    
    // Get background elements (create if they don't exist)
    var backgroundImage = document.getElementById('backgroundImage');
    var backgroundVideo = document.getElementById('backgroundVideo');
    var backgroundOverlay = document.querySelector('.background-overlay');
    
    // Create background elements if they don't exist
    if (!backgroundImage) {
        backgroundImage = document.createElement('img');
        backgroundImage.id = 'backgroundImage';
        bgContainer.appendChild(backgroundImage);
    }
    if (!backgroundVideo) {
        backgroundVideo = document.createElement('video');
        backgroundVideo.id = 'backgroundVideo';
        backgroundVideo.loop = true;
        backgroundVideo.muted = true;
        backgroundVideo.autoplay = true;
        bgContainer.appendChild(backgroundVideo);
    }
    if (!backgroundOverlay) {
        backgroundOverlay = document.createElement('div');
        backgroundOverlay.className = 'background-overlay';
        backgroundOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;
        bgContainer.appendChild(backgroundOverlay);
    }
    
    // Reset all background elements
    backgroundImage.style.display = 'none';
    backgroundImage.src = '';
    backgroundVideo.style.display = 'none';
    backgroundVideo.src = '';
    backgroundOverlay.style.display = 'none';
    
    var blur = backgroundData.blur || 0;
    var brightness = backgroundData.brightness || 0;
    var fit = backgroundData.fit || 'cover';
    var customPos = backgroundData.customPosition || { x: 0, y: 0, width: 100, height: 100, scale: 1 };
    
    // Apply blur filter
    var blurFilter = blur > 0 ? 'blur(' + blur + 'px)' : 'none';
    
    // Determine object-fit and object-position based on fit setting
    var objectFit, objectPosition, transform;
    switch (fit) {
        case 'contain':
            objectFit = 'contain';
            objectPosition = 'center';
            transform = '';
            break;
        case 'fill':
            objectFit = 'fill';
            objectPosition = 'center';
            transform = '';
            break;
        case 'custom':
            objectFit = 'none';
            objectPosition = customPos.x + '% ' + customPos.y + '%';
            transform = 'scale(' + (customPos.scale || 1) + ')';
            break;
        default: // 'cover'
            objectFit = 'cover';
            objectPosition = 'center';
            transform = '';
            break;
    }
    
    var fileSrc = backgroundData.filePath || backgroundData.fileData; // Support both new and old format
    
    if (!fileSrc) {
        return;
    }
    
    if (fileType.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4')) {
        // Video background
        if (backgroundVideo) {
            backgroundVideo.src = fileSrc;
            backgroundVideo.style.cssText = `
                display: block;
                width: 100%;
                height: 100%;
                object-fit: ${objectFit};
                object-position: ${objectPosition};
                transform: ${transform};
                filter: ${blurFilter};
            `;
        }
    } else {
        // Image background (including GIF)
        if (backgroundImage) {
            backgroundImage.src = fileSrc;
            backgroundImage.style.cssText = `
                display: block;
                width: 100%;
                height: 100%;
                object-fit: ${objectFit};
                object-position: ${objectPosition};
                transform: ${transform};
                filter: ${blurFilter};
            `;
        }
    }
    
    // Add brightness overlay
    if (brightness !== 0 && backgroundOverlay) {
        var overlayColor, overlayOpacity;
        
        if (brightness < 0) {
            // Darker (black overlay)
            overlayColor = '0,0,0';
            overlayOpacity = Math.abs(brightness) / 100;
        } else {
            // Brighter (white overlay)
            overlayColor = '255,255,255';
            overlayOpacity = brightness / 100;
        }
        
        backgroundOverlay.style.cssText = `
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(${overlayColor}, ${overlayOpacity});
            pointer-events: none;
        `;
    }
    
    // Add has-background class to body
    body.classList.add('has-background');
    
    // Apply UI opacity if specified
    var opacity = backgroundData.opacity;
    if (opacity !== undefined && opacity !== null) {
        applyUIOpacity(opacity);
    }
    
    // Apply card opacity if specified
    var cardOpacity = backgroundData.cardOpacity;
    if (cardOpacity !== undefined && cardOpacity !== null) {
        applyCardOpacity(cardOpacity);
    }
    
    var endTime = performance.now();
    console.log('背景设置应用-步骤7: 背景应用完成，耗时:', (endTime - startTime).toFixed(2), 'ms');
}

function clearBodyBackground() {
    // Get background elements
    var backgroundImage = document.getElementById('backgroundImage');
    var backgroundVideo = document.getElementById('backgroundVideo');
    var backgroundOverlay = document.querySelector('.background-overlay');
    
    // Hide and clear background elements
    if (backgroundImage) {
        backgroundImage.style.display = 'none';
        backgroundImage.src = '';
    }
    if (backgroundVideo) {
        backgroundVideo.style.display = 'none';
        backgroundVideo.src = '';
    }
    if (backgroundOverlay) {
        backgroundOverlay.style.display = 'none';
    }
    
    // Remove has-background class from body
    document.body.classList.remove('has-background');
    
    // Remove dynamic opacity styles
    var dynamicStyle = document.getElementById('dynamic-ui-opacity');
    if (dynamicStyle) {
        dynamicStyle.remove();
    }
    
    // Remove dynamic card opacity styles
    var dynamicCardOpacityStyle = document.getElementById('dynamic-card-opacity');
    if (dynamicCardOpacityStyle) {
        dynamicCardOpacityStyle.remove();
    }
}

// Load background on page load
function initializeBackground() {
    var savedSettings = localStorage.getItem('backgroundSettings');
    if (savedSettings) {
        try {
            var backgroundData = JSON.parse(savedSettings);
            applyBackgroundToBody(backgroundData);
        } catch (e) {
            console.error('Failed to initialize background:', e);
        }
    }
}

// Call initialize background after DOM is loaded
// Call initialize background after DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackground);
} else {
    initializeBackground();
}

// Clipboard import functions
function setupClipboardImportListeners() {
    // Enable/disable checkbox
    if (clipboardImportElements.enabledCheckbox) {
        clipboardImportElements.enabledCheckbox.addEventListener('change', function() {
            clipboardImportEnabled = this.checked;
            saveSettings();
        });
    }
    
    // Save location radio buttons
    if (clipboardImportElements.saveLocationRadios) {
        clipboardImportElements.saveLocationRadios.forEach(function(radio) {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    imageSaveLocation = this.value;
                    
                    // Show/hide custom location input
                    if (clipboardImportElements.customLocationContainer) {
                        if (this.value === 'custom') {
                            clipboardImportElements.customLocationContainer.style.display = 'flex';
                        } else {
                            clipboardImportElements.customLocationContainer.style.display = 'none';
                        }
                    }
                    
                    saveSettings();
                }
            });
        });
    }
    
    // Custom location path input
    if (clipboardImportElements.customLocationPath) {
        clipboardImportElements.customLocationPath.addEventListener('input', function() {
            customLocationPath = this.value;
            saveSettings();
        });
    }
    
    // Select custom location button
    if (clipboardImportElements.selectCustomLocationBtn) {
        clipboardImportElements.selectCustomLocationBtn.addEventListener('click', function() {
            csInterface.evalScript('selectFolder()', function(result) {
                if (result && result !== 'null' && result !== 'undefined') {
                    customLocationPath = result;
                    if (clipboardImportElements.customLocationPath) {
                        clipboardImportElements.customLocationPath.value = customLocationPath;
                    }
                    saveSettings();
                }
            });
        });
    }
}

function setupDisplayControlListeners() {
    // Show category checkbox
    if (displayControlElements.showCategoryCheckbox) {
        displayControlElements.showCategoryCheckbox.addEventListener('change', function() {
            showCategoryInCard = this.checked;
            saveSettings();
            populateScriptList(); // Refresh script list to apply changes
        });
    }
    
    // Show tags checkbox
    if (displayControlElements.showTagsCheckbox) {
        displayControlElements.showTagsCheckbox.addEventListener('change', function() {
            showTagsInCard = this.checked;
            saveSettings();
            populateScriptList(); // Refresh script list to apply changes
        });
    }
}

function setupAutoReadSubfoldersListener() {
    var autoReadSubfoldersCheckbox = document.getElementById('autoReadSubfolders');
    if (autoReadSubfoldersCheckbox) {
        autoReadSubfoldersCheckbox.addEventListener('change', function() {
            console.log('实时更新-步骤-1: autoReadSubfolders复选框状态变化为:', autoReadSubfoldersCheckbox.checked);
            
            // 保存设置到DataManager
            if (typeof DataManager !== 'undefined' && DataManager.initialized) {
                DataManager.loadData(function(error, data) {
                    if (!error && data) {
                        data.autoReadSubfolders = autoReadSubfoldersCheckbox.checked;
                        console.log('实时更新-步骤-2: 开始保存设置到DataManager');
                        DataManager.saveData(data, function(saveError) {
                            if (!saveError) {
                                console.log('实时更新-步骤-3: 设置保存成功，开始更新脚本列表');
                                // 确保设置保存完成后再更新脚本列表
                                setTimeout(function() {
                                    console.log('实时更新-步骤-4: 调用populateScriptList更新显示');
                                    populateScriptList();
                                }, 100); // 短暂延迟确保设置完全保存
                            } else {
                                console.error('实时更新-错误: 保存autoReadSubfolders设置失败:', saveError);
                            }
                        });
                    } else {
                        console.error('实时更新-错误: 无法加载DataManager数据:', error);
                    }
                });
            } else {
                // 如果DataManager不可用，直接更新脚本列表（使用UI状态）
                console.log('实时更新-备用方案: DataManager不可用，直接更新脚本列表');
                setTimeout(function() {
                    populateScriptList();
                }, 50);
            }
        });
    }
}

// Handle clipboard paste event
function handleClipboardPaste(e) {
    if (!clipboardImportEnabled) {
        return;
    }
    
    var clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) {
        return;
    }
    
    var items = clipboardData.items;
    if (!items) {
        return;
    }
    
    // Look for image in clipboard
    var foundImage = false;
    
    // Debug: log all clipboard items
    console.log('剪贴板项目数量:', items.length);
    for (var j = 0; j < items.length; j++) {
        console.log('项目 ' + j + ':', items[j].type, items[j].kind);
    }
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.type && item.type.indexOf('image') !== -1) {
            e.preventDefault();
            
            var blob = item.getAsFile();
            if (blob) {
                console.log('检测到剪贴板图片，开始处理...');
                processClipboardImage(blob);
                foundImage = true;
            }
            break;
        }
    }
    
    if (!foundImage) {
        console.log('剪贴板中没有找到图片数据');
    }
}



// 通过base64数据的文件头检测文件格式
function detectFileFormatFromBase64(base64String) {
    try {
        // 解码前几个字节来检查文件头
        var binaryString = atob(base64String.substring(0, 32)); // 只解码前32个字符对应的字节
        var bytes = [];
        for (var i = 0; i < Math.min(binaryString.length, 16); i++) {
            bytes.push(binaryString.charCodeAt(i));
        }
        
        console.log('文件头字节:', bytes.map(function(b) { return '0x' + b.toString(16).toUpperCase(); }).join(' '));
        
        // 检查各种文件格式的魔数（文件头）
        if (bytes.length >= 3) {
            // GIF格式: GIF87a 或 GIF89a
            if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
                console.log('检测到GIF文件头');
                return '.gif';
            }
            
            // JPEG格式: FF D8 FF
            if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                console.log('检测到JPEG文件头');
                return '.jpg';
            }
            
            // PNG格式: 89 50 4E 47
            if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                console.log('检测到PNG文件头');
                return '.png';
            }
            
            // WebP格式: 检查RIFF...WEBP
            if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
                // 需要检查更多字节来确认是WebP
                if (base64String.length > 16) {
                    var longerBinary = atob(base64String.substring(0, 64));
                    if (longerBinary.indexOf('WEBP') !== -1) {
                        console.log('检测到WebP文件头');
                        return '.webp';
                    }
                }
            }
            
            // BMP格式: BM
            if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
                console.log('检测到BMP文件头');
                return '.bmp';
            }
            
            // TIFF格式: II* (little endian) 或 MM* (big endian)
            if (bytes.length >= 4) {
                if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
                    (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) {
                    console.log('检测到TIFF文件头');
                    return '.tiff';
                }
            }
            
            // PDF格式: %PDF
            if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                console.log('检测到PDF文件头');
                return '.pdf';
            }
            
            // SVG格式: 检查XML声明或<svg标签
            if (base64String.length > 32) {
                var longerBinary = atob(base64String.substring(0, 128));
                if (longerBinary.indexOf('<svg') !== -1 || longerBinary.indexOf('<?xml') !== -1) {
                    console.log('检测到SVG文件头');
                    return '.svg';
                }
            }
            
            // EPS格式: %!PS-Adobe
            if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x21 && bytes[2] === 0x50 && bytes[3] === 0x53) {
                console.log('检测到EPS文件头');
                return '.eps';
            }
            
            // AVIF格式: 检查ftyp...avif
            if (bytes.length >= 8) {
                if (base64String.length > 32) {
                    var longerBinary = atob(base64String.substring(0, 64));
                    if (longerBinary.indexOf('ftyp') !== -1 && longerBinary.indexOf('avif') !== -1) {
                        console.log('检测到AVIF文件头');
                        return '.avif';
                    }
                }
            }
        }
        
        console.log('未能通过文件头识别格式');
        return null;
    } catch (e) {
        console.log('文件头检测出错:', e);
        return null;
    }
}

// Process clipboard image
function processClipboardImage(blob) {
    console.log('步骤4：开始处理图片 - 文件大小: ' + blob.size + ' bytes，MIME类型: ' + blob.type);
    
    console.log('开始处理剪贴板图片，大小: ' + blob.size + ' bytes，类型: ' + blob.type);
    console.log('Blob详细信息:', {
        size: blob.size,
        type: blob.type,
        lastModified: blob.lastModified,
        name: blob.name || '未知'
    });
    
    // Detect file format from MIME type
    var fileExtension = '.png'; // default
    var mimeType = blob.type;
    
    // 详细的格式检测逻辑
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        fileExtension = '.jpg';
        console.log('检测为JPEG格式');
    } else if (mimeType === 'image/gif') {
        fileExtension = '.gif';
        console.log('检测为GIF格式');
    } else if (mimeType === 'image/png') {
        fileExtension = '.png';
        console.log('检测为PNG格式');
    } else if (mimeType === 'image/webp') {
        fileExtension = '.webp';
        console.log('检测为WebP格式');
    } else if (mimeType === 'image/avif') {
        fileExtension = '.avif';
        console.log('检测为AVIF格式');
    } else if (mimeType === 'image/bmp') {
        fileExtension = '.bmp';
        console.log('检测为BMP格式');
    } else if (mimeType === 'image/tiff') {
        fileExtension = '.tiff';
        console.log('检测为TIFF格式');
    } else if (mimeType === 'image/svg+xml') {
        fileExtension = '.svg';
        console.log('检测为SVG格式');
    } else if (mimeType === 'image/jfif' || mimeType === 'image/x-jfif') {
        fileExtension = '.jfif';
        console.log('检测为JFIF格式');
    } else if (mimeType === 'application/postscript' || mimeType === 'application/eps') {
        fileExtension = '.eps';
        console.log('检测为EPS格式');
    } else if (mimeType === 'application/illustrator') {
        fileExtension = '.ai';
        console.log('检测为AI格式');
    } else if (mimeType === 'application/x-coreldraw') {
        fileExtension = '.cdr';
        console.log('检测为CDR格式');
    } else if (mimeType === 'application/pdf') {
        fileExtension = '.pdf';
        console.log('检测为PDF格式');
    } else if (mimeType === 'video/mp4') {
        fileExtension = '.mp4';
        console.log('检测为MP4格式');
    } else if (mimeType.indexOf('image/x-') === 0) {
        // RAW格式通常以image/x-开头
        if (mimeType.indexOf('canon') !== -1) {
            fileExtension = '.cr2';
            console.log('检测为Canon RAW格式');
        } else if (mimeType.indexOf('nikon') !== -1) {
            fileExtension = '.nef';
            console.log('检测为Nikon RAW格式');
        } else if (mimeType.indexOf('sony') !== -1) {
            fileExtension = '.arw';
            console.log('检测为Sony RAW格式');
        } else if (mimeType.indexOf('adobe') !== -1) {
            fileExtension = '.dng';
            console.log('检测为Adobe DNG格式');
        } else {
            fileExtension = '.raw';
            console.log('检测为通用RAW格式');
        }
    } else {
        console.log('未知格式，使用默认PNG: ' + mimeType);
    }
    
    console.log('最终确定文件格式: ' + fileExtension);
    
    console.log('步骤5：确定文件格式 - 检测到文件格式: ' + fileExtension + '，MIME类型: ' + mimeType);
    
    // Create a temporary file URL for the blob
    var fileUrl = URL.createObjectURL(blob);
    
    console.log('步骤6：创建临时URL - 临时URL已创建: ' + fileUrl.substring(0, 50) + '...');
    
    // Determine save location
    var saveLocation;
    switch (imageSaveLocation) {
        case 'desktop':
            saveLocation = 'desktop';
            break;
        case 'documents':
            saveLocation = 'documents';
            break;
        case 'projectFile':
            saveLocation = 'project';
            break;
        case 'custom':
            saveLocation = 'custom';
            break;
        default:
            saveLocation = 'documents'; // Default to documents
    }
    
    console.log('步骤7：确定保存位置 - 保存位置: ' + saveLocation + '，设置值: ' + imageSaveLocation);
    
    // Generate a unique filename
    var timestamp = new Date().getTime();
    var fileName = 'clipboard_image_' + timestamp + fileExtension;
    
    console.log('步骤8：生成文件名 - 文件名: ' + fileName + '，时间戳: ' + timestamp);
    
    // Escape custom path if needed
    var escapedCustomPath = customLocationPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                              .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    
    // Show progress indicator
    var progressDiv = document.createElement('div');
    progressDiv.id = 'importProgress';
    progressDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
    progressDiv.innerHTML = '正在保存并导入图片，请稍候...<br><div style="width: 200px; height: 4px; background: #333; margin-top: 10px; border-radius: 2px;"><div id="progressBar" style="width: 0%; height: 100%; background: #4CAF50; border-radius: 2px; transition: width 0.3s;"></div></div>';
    document.body.appendChild(progressDiv);
    
    console.log('步骤9：显示进度条 - 导入进度条已显示，开始进度动画');
    
    // Animate progress bar
    var progressBar = document.getElementById('progressBar');
    var progress = 0;
    var progressInterval = setInterval(function() {
        progress += Math.random() * 3 + 1;
        if (progress <= 100) {
            progressBar.style.width = progress + '%';
        }
    }, 150);
    
    console.log('步骤10：进度条动画启动 - 进度条动画已启动，目标进度: 100%，间隔: 150ms');
    
    // Save blob to temporary file and then import to AE
    var reader = new FileReader();
    reader.onload = function(e) {
        var arrayBuffer = e.target.result;
        var fileSize = arrayBuffer ? arrayBuffer.byteLength : 0;
        console.log('步骤11：文件读取完成 - 文件已读取为ArrayBuffer，大小: ' + fileSize + ' bytes');
        
        if (!arrayBuffer) {
            console.error('文件读取失败 - 无法读取文件内容，ArrayBuffer为空');
            clearInterval(progressInterval);
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            showCustomAlert('文件读取失败，请重试', true);
            return;
        }
        
        // Convert ArrayBuffer to base64 for AE script
        var uint8Array = new Uint8Array(arrayBuffer);
        var binaryString = '';
        for (var i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        var base64Data = btoa(binaryString);
        
        console.log('步骤12：转换为base64 - ArrayBuffer已转换为base64，长度: ' + base64Data.length + ' 字符');
        
        // 验证base64数据
        if (!base64Data || base64Data.length === 0) {
            console.error('base64转换失败 - base64数据为空，无法继续');
            clearInterval(progressInterval);
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            showCustomAlert('图片数据转换失败，请重试', true);
            return;
        }
        
        console.log('图片数据已转换为base64，长度: ' + base64Data.length);
        console.log('步骤13：准备调用AE脚本 - 使用saveAndImportClipboardImage函数导入图片');
        
        // 使用JSON编码来安全传递base64数据
        var scriptParams = {
            base64Data: base64Data,
            saveLocation: saveLocation,
            customPath: escapedCustomPath,
            fileExtension: fileExtension
        };
        
        // 将参数编码为JSON字符串
        var encodedParams = encodeURIComponent(JSON.stringify(scriptParams));
        
        // Call AE script with encoded parameters
        var scriptCall = "saveAndImportClipboardImageFromJson('" + encodedParams + "')";
        
        console.log('调用AE脚本导入剪贴板图片，使用JSON编码传递参数');
        console.log('步骤14：调用AE脚本 - 脚本调用: saveAndImportClipboardImageFromJson\\n参数编码长度: ' + encodedParams.length + ' 字符\\n原始base64长度: ' + base64Data.length + ' 字符\\n保存位置: ' + saveLocation + '\\n文件扩展名: ' + fileExtension);
        console.log('开始执行AE脚本 - 即将调用csInterface.evalScript，等待AE响应...');
        
        // 检查csInterface是否可用
        if (!csInterface) {
            console.error('CEP接口错误 - csInterface未定义，无法与AE通信');
            clearInterval(progressInterval);
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            showCustomAlert('CEP接口错误，无法与AE通信', true);
            return;
        }
        
        // 添加脚本执行状态跟踪
        var scriptStartTime = Date.now();
        var scriptCompleted = false;
        
        // 每5秒检查一次脚本执行状态
        var statusCheckInterval = setInterval(function() {
            if (!scriptCompleted) {
                var elapsedTime = Math.round((Date.now() - scriptStartTime) / 1000);
                console.log('脚本执行状态 - AE脚本执行中... 已等待 ' + elapsedTime + ' 秒');
            } else {
                clearInterval(statusCheckInterval);
            }
        }, 5000);
        
        // Set timeout
        var timeoutId = setTimeout(function() {
            if (!scriptCompleted) {
                scriptCompleted = true;
                clearInterval(statusCheckInterval);
                console.error('导入超时 - AE脚本调用超时（30秒）');
                
                clearInterval(progressInterval);
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
                console.log('导入操作超时');
                showCustomAlert('导入操作超时，请检查AE是否正常运行', true);
            }
        }, 30000); // 30 second timeout
        
        csInterface.evalScript(scriptCall, function(result) {
            scriptCompleted = true;
            clearInterval(statusCheckInterval);
            
            var executionTime = Math.round((Date.now() - scriptStartTime) / 1000);
            console.log('=== AE脚本执行完成，耗时: ' + executionTime + ' 秒 ===');
            console.log('步骤15：AE脚本返回结果 - AE脚本执行完成，耗时: ' + executionTime + ' 秒\\n返回结果长度: ' + (result ? result.length : 0) + ' 字符\\n返回内容: ' + (result || '无返回内容'));
            
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
            
            // Complete progress bar
            progressBar.style.width = '100%';
            
            console.log('AE脚本返回结果: ' + result);
            
            // Remove progress dialog after a short delay
            setTimeout(function() {
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
            }, 500);
            
            console.log('步骤16：清理进度条 - 进度条已移除，开始清理URL');
            
            // Clean up blob URL
            URL.revokeObjectURL(fileUrl);
            console.log('步骤17：清理URL成功 - Blob URL已释放');
            console.log('Blob URL已清理');
            
            // Process result
            if (result && result.trim() !== '') {
                console.log('AE脚本返回结果: ' + result);
                
                // ctrl v 导入图片检测弹窗 - AE脚本结果处理
                console.log('AE脚本结果处理 - 返回结果: ' + result);
                
                // Check if result indicates success or error
                if (result.indexOf('Success:') === 0) {
                    console.log('图片导入成功: ' + result);
                    
                    // ctrl v 导入图片检测弹窗 - 步骤18：导入成功
                    console.log('步骤18：导入成功 - 图片已成功导入到AE项目中: ' + result.substring(8));
                    
                   
                } else if (result.indexOf('Error:') === 0) {
                    console.log('图片导入失败: ' + result);
                    
                    // ctrl v 导入图片检测弹窗 - 导入失败
                    console.error('导入失败 - AE脚本返回错误: ' + result.substring(6));
                    
                    // 显示错误通知
                    showCustomAlert('图片导入失败：\\n' + result.substring(6), true);
                } else {
                    console.log('未知的AE脚本返回格式: ' + result);
                    
                    // ctrl v 导入图片检测弹窗 - 未知格式
                    console.log('未知格式 - 无法识别的AE脚本返回格式: ' + result);
                    
                    // 显示警告通知
                    showCustomAlert('AE脚本返回了未知格式的结果：\\n' + result, true);
                }
            } else {
                // ctrl v 导入图片检测弹窗 - 无返回结果
                console.error('无返回结果 - AE脚本没有返回有效结果，可能执行失败');
                
                // 显示错误通知
                showCustomAlert('AE脚本执行失败，没有返回结果', true);
            }
            
            // 自定义确认弹窗系统
function showCustomConfirm(message, onConfirm, onCancel) {
    // 移除旧的弹窗
    var oldAlert = document.getElementById('customAlert');
    if (oldAlert) {
        document.body.removeChild(oldAlert);
    }
    
    // 创建弹窗容器
    var alertOverlay = document.createElement('div');
    alertOverlay.id = 'customAlert';
    alertOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    // 创建弹窗内容
    var alertBox = document.createElement('div');
    alertBox.style.cssText = `
        background: linear-gradient(145deg, rgba(15, 15, 15, 0.95), rgba(25, 25, 25, 0.9));
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(138, 43, 226, 0.2);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(138, 43, 226, 0.3);
        min-width: 300px;
        max-width: 80vw;
        padding: 24px;
        color: #e0e0e0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        animation: slideIn 0.3s ease;
    `;
    
    // 创建消息内容
    var messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
        text-align: center;
    `;
    messageDiv.textContent = message;
    
    // 创建按钮容器
    var buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
    `;
    
    // 创建取消按钮
    var cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
        flex: 1;
        padding: 12px;
        background: linear-gradient(145deg, #6c757d, #5a6268);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
    `;
    
    // 创建确定按钮
    var confirmButton = document.createElement('button');
    confirmButton.textContent = '确定';
    confirmButton.style.cssText = `
        flex: 1;
        padding: 12px;
        background: linear-gradient(145deg, #8a2be2, #7b1fa2);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
    `;
    
    function closeDialog(callback) {
        alertOverlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(function() {
            if (document.body.contains(alertOverlay)) {
                document.body.removeChild(alertOverlay);
            }
            if (callback) callback();
        }, 300);
    }
    
    cancelButton.onclick = function() {
        closeDialog(onCancel);
    };
    
    confirmButton.onclick = function() {
        closeDialog(onConfirm);
    };
    
    // 添加悬停效果
    [cancelButton, confirmButton].forEach(function(btn) {
        btn.onmouseover = function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        };
        
        btn.onmouseout = function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        };
    });
    
    // 组装弹窗
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    alertBox.appendChild(messageDiv);
    alertBox.appendChild(buttonContainer);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
}

// 自定义弹窗系统
function showCustomAlert(message, isError, callback) {
    // 移除旧的弹窗
    var oldAlert = document.getElementById('customAlert');
    if (oldAlert) {
        document.body.removeChild(oldAlert);
    }
    
    // 创建弹窗容器
    var alertOverlay = document.createElement('div');
    alertOverlay.id = 'customAlert';
    alertOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    // 创建弹窗内容
    var alertBox = document.createElement('div');
    alertBox.style.cssText = `
        background: linear-gradient(145deg, rgba(15, 15, 15, 0.95), rgba(25, 25, 25, 0.9));
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(138, 43, 226, 0.2);
        backdrop-filter: blur(20px);
        border: 1px solid ${isError ? 'rgba(220, 53, 69, 0.5)' : 'rgba(138, 43, 226, 0.3)'};
        min-width: 300px;
        max-width: 80vw;
        padding: 24px;
        color: #e0e0e0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        animation: slideIn 0.3s ease;
    `;
    
    // 创建消息内容
    var messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
        text-align: center;
    `;
    messageDiv.textContent = message;
    
    // 创建确定按钮
    var okButton = document.createElement('button');
    okButton.textContent = '确定';
    okButton.style.cssText = `
        width: 100%;
        padding: 12px;
        background: linear-gradient(145deg, ${isError ? '#dc3545' : '#8a2be2'}, ${isError ? '#c82333' : '#7b1fa2'});
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
    `;
    
    okButton.onmouseover = function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    };
    
    okButton.onmouseout = function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    };
    
    okButton.onclick = function() {
        alertOverlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(function() {
            if (document.body.contains(alertOverlay)) {
                document.body.removeChild(alertOverlay);
            }
            if (callback) callback();
        }, 300);
    };
    
    // 组装弹窗
    alertBox.appendChild(messageDiv);
    alertBox.appendChild(okButton);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
    
    // 添加CSS动画
    if (!document.getElementById('customAlertStyles')) {
        var style = document.createElement('style');
        style.id = 'customAlertStyles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideIn {
                from { transform: scale(0.8) translateY(-20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// 使用非阻塞通知替代alert
function showNotification(message, isError) {
                // 移除旧的通知
                var oldNotification = document.getElementById('clipboardNotification');
                if (oldNotification) {
                    document.body.removeChild(oldNotification);
                }
                
                // 创建新通知
                var notification = document.createElement('div');
                notification.id = 'clipboardNotification';
                notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: ' + 
                    (isError ? 'rgba(220,53,69,0.9)' : 'rgba(40,167,69,0.9)') + 
                    '; color: white; padding: 12px 20px; border-radius: 4px; z-index: 10000; ' +
                    'font-family: Arial, sans-serif; max-width: 80%; box-shadow: 0 4px 8px rgba(0,0,0,0.2); ' +
                    'transition: opacity 0.5s ease-in-out;';
                notification.innerHTML = message;
                
                document.body.appendChild(notification);
                
                // 自动关闭通知
                setTimeout(function() {
                    notification.style.opacity = '0';
                    setTimeout(function() {
                        if (document.body.contains(notification)) {
                            document.body.removeChild(notification);
                        }
                    }, 500);
                }, 5000);
            }
            
            // 延迟处理结果，避免与AE对话框冲突
            setTimeout(function() {
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
                
                if (result && result.indexOf('Error:') === 0) {
                    showNotification('导入图片失败: ' + result.substring(6), true);
                } else if (result && result.indexOf('导入图片失败:') === 0) {
                    showNotification(result, true);
                } else if (result && result.indexOf('Base64解码失败:') === 0) {
                    showNotification('图片处理失败: ' + result, true);
                } else if (result && result.indexOf('文件写入失败:') === 0) {
                    showNotification('文件保存失败: ' + result, true);
                } else if (result && result.indexOf('导入AE失败:') === 0) {
                    showNotification('AE导入失败: ' + result, true);
                } else if (result && result.length > 0) {
                    showNotification('图片导入成功: ' + result, false);
                } else {
                    showNotification('图片导入完成', false);
                }
            }, 500); // Small delay to show 100% progress
        });
    };
    
    reader.onerror = function() {
        // ctrl v 导入图片检测弹窗 - 文件读取错误
        console.error('文件读取错误 - 无法读取剪贴板图片数据');
        
        clearInterval(progressInterval);
        if (document.body.contains(progressDiv)) {
            document.body.removeChild(progressDiv);
        }
        
        showCustomAlert('读取剪贴板图片失败', true);
    };
    
    // ctrl v 导入图片检测弹窗 - 步骤19：开始读取文件
    console.log('步骤19：开始读取文件 - 开始将Blob数据转换为ArrayBuffer格式');
    
    reader.readAsArrayBuffer(blob);
}

// Load clipboard import settings
function loadClipboardImportSettings(settings) {
    if (settings.clipboardImport) {
        clipboardImportEnabled = settings.clipboardImport.enabled !== false; // Default to true
        imageSaveLocation = settings.clipboardImport.saveLocation || 'documents';
        customLocationPath = settings.clipboardImport.customPath || '';
        
        // Update UI
        if (clipboardImportElements.enabledCheckbox) {
            clipboardImportElements.enabledCheckbox.checked = clipboardImportEnabled;
        }
        
        if (clipboardImportElements.saveLocationRadios) {
            clipboardImportElements.saveLocationRadios.forEach(function(radio) {
                if (radio.value === imageSaveLocation) {
                    radio.checked = true;
                    
                    // Show custom location container if needed
                    if (imageSaveLocation === 'custom' && clipboardImportElements.customLocationContainer) {
                        clipboardImportElements.customLocationContainer.style.display = 'flex';
                    }
                }
            });
        }
        
        if (clipboardImportElements.customLocationPath) {
            clipboardImportElements.customLocationPath.value = customLocationPath;
        }
    }
}

// Save clipboard import settings
function saveClipboardImportSettings(settings) {
    settings.clipboardImport = {
        enabled: clipboardImportEnabled,
        saveLocation: imageSaveLocation,
        customPath: customLocationPath
    };
    return settings;
}

// Settings modal functions
function showSettingsModal() {
    settingsModal.style.display = 'flex';
}

function hideSettingsModal() {
    // 自动保存设置
    console.log('设置窗口关闭，自动保存设置');
    saveSettings();
    settingsModal.style.display = 'none';
}

// Handle file drop for drag and drop import
function handleFileDrop(files) {
    console.log('handleFileDrop函数被调用', {
        filesCount: files.length,
        clipboardImportEnabled: clipboardImportEnabled
    });
    
    // 显示详细的调试信息弹窗
    var handleDebugInfo = 'handleFileDrop调试信息:\n';
    handleDebugInfo += '函数被调用: 是\n';
    handleDebugInfo += '文件数量: ' + files.length + '\n';
    handleDebugInfo += '剪贴板导入功能: ' + (clipboardImportEnabled ? '已启用' : '已禁用') + '\n';
    
    if (!clipboardImportEnabled) {
        handleDebugInfo += '错误: 剪贴板导入功能已禁用\n';
        handleDebugInfo += '解决方案: 请在设置中启用剪贴板图片导入功能';
        
        console.log('handleFileDrop调试信息:', handleDebugInfo);
        
        showCustomAlert('文件拖拽导入功能已禁用，请在设置中启用剪贴板图片导入功能', true);
        return;
    }
    
    console.log('handleFileDrop调试信息:', handleDebugInfo);
    
    // Process each dropped file
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        
        // Check if file type is supported
        var supportedTypes = [
            'image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif',
            'image/bmp', 'image/tiff', 'image/svg+xml', 'image/jfif', 'image/x-jfif',
            'application/postscript', 'application/eps', 'application/illustrator',
            'application/x-coreldraw', 'application/pdf', 'image/x-canon-cr2',
            'image/x-canon-crw', 'image/x-nikon-nef', 'image/x-sony-arw',
            'image/x-adobe-dng', 'image/x-panasonic-raw', 'video/mp4'
        ];
        
        var isSupported = supportedTypes.some(function(type) {
            return file.type === type;
        });
        
        // Also check file extension as fallback
        if (!isSupported) {
            var fileName = file.name.toLowerCase();
            var supportedExtensions = [
                '.gif', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.bmp', '.tiff', '.tif',
                '.svg', '.jfif', '.jpe', '.eps', '.ai', '.cdr', '.pdf', '.mp4',
                // RAW formats
                '.cr2', '.cr3', '.crw', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.dng',
                '.orf', '.rw2', '.pef', '.raf', '.3fr', '.fff', '.dcr', '.kdc', '.mrw',
                '.mos', '.raw', '.rwl', '.iiq', '.erf', '.mef', '.nksc', '.ari'
            ];
            isSupported = supportedExtensions.some(function(ext) {
                return fileName.endsWith(ext);
            });
        }
        
        if (isSupported) {
            console.log('处理拖拽文件:', file.name, '类型:', file.type, '大小:', file.size);
            processDroppedFile(file);
        } else {
            showCustomAlert('不支持的文件格式: ' + file.name + '\n支持的格式: PNG, JPG, WEBP, JFIF, AVIF, GIF, SVG, EPS, AI, CDR, TIFF, PDF, BMP, RAW等', true);
        }
    }
}

// Check if text data is BASE64 image data
function isBase64ImageData(textData) {
    if (!textData || typeof textData !== 'string') {
        return false;
    }
    
    // Remove whitespace and newlines
    var cleanData = textData.replace(/\s/g, '');
    
    // Check for data URL format (data:image/...;base64,...)
    var dataUrlPattern = /^data:image\/(png|jpg|jpeg|gif|webp|avif|bmp|tiff|svg\+xml|jfif);base64,([A-Za-z0-9+/=]+)$/;
    if (dataUrlPattern.test(cleanData)) {
        console.log('检测到data URL格式的BASE64图片');
        return true;
    }
    
    // Check for pure BASE64 string (without data URL prefix)
    // BASE64 should be at least 100 characters for a meaningful image
    if (cleanData.length >= 100) {
        // Check if it's valid BASE64 format
        var base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        if (base64Pattern.test(cleanData)) {
            // Try to decode a small portion to verify it's valid BASE64
            try {
                var testDecode = atob(cleanData.substring(0, 32));
                // Check for common image file headers in the decoded data
                var bytes = [];
                for (var i = 0; i < Math.min(testDecode.length, 8); i++) {
                    bytes.push(testDecode.charCodeAt(i));
                }
                
                // Check for image file signatures
                if (bytes.length >= 3) {
                    // PNG: 89 50 4E 47
                    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                        console.log('检测到PNG格式的BASE64数据');
                        return true;
                    }
                    // JPEG: FF D8 FF
                    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                        console.log('检测到JPEG格式的BASE64数据');
                        return true;
                    }
                    // GIF: 47 49 46
                    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
                        console.log('检测到GIF格式的BASE64数据');
                        return true;
                    }
                    // BMP: 42 4D
                    if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
                        console.log('检测到BMP格式的BASE64数据');
                        return true;
                    }
                    // WebP: RIFF...WEBP (check for RIFF header)
                    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
                        console.log('检测到WebP格式的BASE64数据');
                        return true;
                    }
                }
            } catch (e) {
                console.log('BASE64解码测试失败:', e);
                return false;
            }
        }
    }
    
    return false;
}

// Handle BASE64 image data drop
function handleBase64Drop(base64Data) {
    console.log('开始处理BASE64图片数据拖拽');
    
    if (!clipboardImportEnabled) {
        console.log('剪贴板导入功能已禁用');
        showNotification('功能未启用', '请在设置中启用"剪贴板导入"功能后再试', 'warning');
        return;
    }
    
    try {
        // Clean the BASE64 data
        var cleanBase64 = base64Data.replace(/\s/g, '');
        var actualBase64 = '';
        var detectedFormat = '.png'; // default
        
        // Check if it's a data URL format
        var dataUrlPattern = /^data:image\/(png|jpg|jpeg|gif|webp|avif|bmp|tiff|svg\+xml|jfif);base64,([A-Za-z0-9+/=]+)$/;
        var dataUrlMatch = dataUrlPattern.exec(cleanBase64);
        
        if (dataUrlMatch) {
            // Extract format and BASE64 data from data URL
            var mimeType = dataUrlMatch[1];
            actualBase64 = dataUrlMatch[2];
            
            // Map MIME type to file extension
            switch (mimeType) {
                case 'png': detectedFormat = '.png'; break;
                case 'jpg':
                case 'jpeg': detectedFormat = '.jpg'; break;
                case 'gif': detectedFormat = '.gif'; break;
                case 'webp': detectedFormat = '.webp'; break;
                case 'avif': detectedFormat = '.avif'; break;
                case 'bmp': detectedFormat = '.bmp'; break;
                case 'tiff': detectedFormat = '.tiff'; break;
                case 'svg+xml': detectedFormat = '.svg'; break;
                case 'jfif': detectedFormat = '.jfif'; break;
                default: detectedFormat = '.png'; break;
            }
            
            console.log('检测到data URL格式，MIME类型:', mimeType, '文件格式:', detectedFormat);
        } else {
            // Assume it's pure BASE64 data, try to detect format from file header
            actualBase64 = cleanBase64;
            detectedFormat = detectFileFormatFromBase64(actualBase64) || '.png';
            console.log('检测到纯BASE64数据，推测格式:', detectedFormat);
        }
        
        // Validate BASE64 data
        if (!actualBase64 || actualBase64.length < 100) {
            throw new Error('BASE64数据太短或无效');
        }
        
        // Generate filename
        var timestamp = new Date().getTime();
        var fileName = 'base64_image_' + timestamp + detectedFormat;
        
        console.log('BASE64数据处理完成:', {
            originalLength: base64Data.length,
            cleanedLength: actualBase64.length,
            detectedFormat: detectedFormat,
            fileName: fileName
        });
        
        // Show progress dialog
        var progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(30, 30, 30, 0.95);
            padding: 30px;
            border-radius: 12px;
            z-index: 10001;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(138, 43, 226, 0.3);
            min-width: 300px;
            color: #e0e0e0;
            font-family: 'Inter', 'Segoe UI', sans-serif;
        `;
        
        progressDiv.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 16px; font-weight: 500;">正在处理BASE64图片...</div>
            <div style="margin-bottom: 10px; font-size: 14px; color: #b0b0b0;">${fileName}</div>
            <div style="margin-bottom: 15px; font-size: 12px; color: #888;">BASE64数据 • ${detectedFormat.substring(1).toUpperCase()}</div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div id="base64Progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #8a2be2, #9d4edd); transition: width 0.3s ease;"></div>
            </div>
            <div id="base64ProgressText" style="margin-top: 10px; font-size: 12px; color: #888;">正在解析数据...</div>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">保持原始格式导入</div>
        `;
        
        document.body.appendChild(progressDiv);
        
        var progressBar = document.getElementById('base64Progress');
        var progressText = document.getElementById('base64ProgressText');
        
        // Animate progress
        var progress = 0;
        var progressInterval = setInterval(function() {
            progress += Math.random() * 10 + 5;
            if (progress <= 90) {
                progressBar.style.width = progress + '%';
                progressText.textContent = '处理中: ' + Math.round(progress) + '%';
            }
        }, 100);
        
        // Determine save location - 修复保存位置设置不生效的问题
        var saveLocation;
        
        // 优先从设置界面获取当前选中的保存位置
        var saveLocationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
        var currentSaveLocation = 'documents'; // 默认值
        
        for (var i = 0; i < saveLocationRadios.length; i++) {
            if (saveLocationRadios[i].checked) {
                currentSaveLocation = saveLocationRadios[i].value;
                break;
            }
        }
        
        console.log('从设置界面获取的保存位置:', currentSaveLocation);
        
        switch (currentSaveLocation) {
            case 'desktop': saveLocation = 'desktop'; break;
            case 'documents': saveLocation = 'documents'; break;
            case 'projectFile': saveLocation = 'project'; break;
            case 'custom': saveLocation = 'custom'; break;
            default: saveLocation = 'documents'; break;
        }
        
        console.log('最终确定的保存位置:', saveLocation);
        
        // Escape custom path if needed
        var escapedCustomPath = customLocationPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                                  .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        
        // Prepare parameters for AE script
        var params = {
            base64Data: actualBase64,
            saveLocation: saveLocation,
            customPath: escapedCustomPath,
            fileExtension: detectedFormat,
            fileName: fileName
        };
        
        var encodedParams = encodeURIComponent(JSON.stringify(params));
        
        console.log('调用AE脚本处理BASE64数据:', {
            saveLocation: saveLocation,
            fileExtension: detectedFormat,
            fileName: fileName,
            base64Length: actualBase64.length
        });
        
        // Call AE script
        csInterface.evalScript('saveAndImportClipboardImageFromJson(\'' + encodedParams + '\')', function(result) {
            clearInterval(progressInterval);
            
            // Complete progress
            progressBar.style.width = '100%';
            progressText.textContent = '完成: 100%';
            
            setTimeout(function() {
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
                
                if (result && result.indexOf('Error:') === 0) {
                    showNotification('BASE64图片导入失败: ' + result.substring(6), true);
                } else if (result && result.indexOf('Base64解码失败:') === 0) {
                    showNotification('BASE64数据处理失败: ' + result, true);
                } else if (result && result.length > 0) {
                    showNotification('BASE64图片导入成功: ' + result, false);
                } else {
                    showNotification('BASE64图片导入完成', false);
                }
            }, 500);
        });
        
    } catch (error) {
        console.error('BASE64数据处理失败:', error);
        showNotification('BASE64数据处理失败: ' + error.message, true);
    }
}
function extractImageUrl(urlData, htmlData) {
    console.log('开始提取图片URL，urlData:', urlData, 'htmlData长度:', htmlData ? htmlData.length : 0);
    
    var imageUrl = null;
    var debugInfo = 'URL提取调试信息:\n';
    debugInfo += 'URL数据: ' + (urlData || '无') + '\n';
    debugInfo += 'HTML数据长度: ' + (htmlData ? htmlData.length : 0) + '\n';
    
    // 首先尝试从URL数据中提取
    if (urlData && urlData.trim()) {
        var urls = urlData.split('\n');
        debugInfo += '检测到 ' + urls.length + ' 个URL\n';
        
        for (var i = 0; i < urls.length; i++) {
            var url = urls[i].trim();
            debugInfo += 'URL' + (i + 1) + ': ' + url + '\n';
            
            if (url && isImageUrl(url)) {
                imageUrl = url;
                debugInfo += '✓ 识别为图片URL: ' + imageUrl + '\n';
                console.log('从URL数据中提取到图片链接:', imageUrl);
                break;
            } else {
                debugInfo += '✗ 不是图片URL\n';
            }
        }
    } else {
        debugInfo += '无URL数据\n';
    }
    
    // 输出URL检测调试信息到控制台
    console.log('URL检测调试信息:', debugInfo);
    
    // 如果URL数据中没有找到，尝试从HTML数据中提取
    if (!imageUrl && htmlData) {
        console.log('尝试从HTML数据中提取图片URL');
        
        // 使用正则表达式匹配img标签的src属性
        var imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        var match;
        
        while ((match = imgRegex.exec(htmlData)) !== null) {
            var src = match[1];
            if (isImageUrl(src)) {
                imageUrl = src;
                console.log('从HTML数据中提取到图片链接:', imageUrl);
                break;
            }
        }
        
        // 如果img标签中没有找到，尝试查找其他可能的图片URL
        if (!imageUrl) {
            var urlRegex = /https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|gif|webp|bmp|tiff)(?:\?[^\s<>"']*)?/gi;
            while ((match = urlRegex.exec(htmlData)) !== null) {
                if (isImageUrl(match[0])) {
                    imageUrl = match[0];
                    console.log('从HTML中的URL模式提取到图片链接:', imageUrl);
                    break;
                }
            }
        }
    }
    
    return imageUrl;
}

// Check if URL is likely an image
function isImageUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    // 移除查询参数进行检查
    var urlWithoutQuery = url.split('?')[0].toLowerCase();
    
    // 检查常见的图片文件扩展名
    var imageExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.tif',
        '.svg', '.jfif', '.jpe', '.eps', '.ai', '.cdr', '.pdf',
        // RAW formats
        '.cr2', '.cr3', '.crw', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.dng',
        '.orf', '.rw2', '.pef', '.raf', '.3fr', '.fff', '.dcr', '.kdc', '.mrw',
        '.mos', '.raw', '.rwl', '.iiq', '.erf', '.mef', '.nksc', '.ari'
    ];
    
    for (var i = 0; i < imageExtensions.length; i++) {
        if (urlWithoutQuery.endsWith(imageExtensions[i])) {
            return true;
        }
    }
    
    // 检查常见的图片托管服务域名模式
    var imageHostPatterns = [
        'imgur.com',
        'i.imgur.com',
        'images.unsplash.com',
        'cdn.pixabay.com',
        'images.pexels.com',
        'i.redd.it',
        'media.giphy.com',
        'gd-hbimg.huaban.com',  // 花瓣网图片服务
        'hbimg.huaban.com',     // 花瓣网图片服务
        'img.huaban.com',       // 花瓣网图片服务
        'pic.huaban.com'        // 花瓣网图片服务
    ];
    
    for (var i = 0; i < imageHostPatterns.length; i++) {
        if (url.indexOf(imageHostPatterns[i]) !== -1) {
            return true;
        }
    }
    
    // 检查URL是否包含图片相关的路径模式
    // 一些图片服务使用特殊的URL格式，没有明显的文件扩展名
    var imagePathPatterns = [
        /\/[a-f0-9]{20,}/i,  // 长哈希值路径（如花瓣网）
        /\/img\//i,          // 包含img路径
        /\/image\//i,        // 包含image路径
        /\/photo\//i,        // 包含photo路径
        /\/pic\//i,          // 包含pic路径
        /_fw\d+$/i,          // 以_fw数字结尾（花瓣网格式）
        /_\d+x\d+/i          // 包含尺寸信息
    ];
    
    for (var i = 0; i < imagePathPatterns.length; i++) {
        if (imagePathPatterns[i].test(url)) {
            return true;
        }
    }
    
    return false;
}

// Handle image URL drop (download and save to local file, then import)
function handleImageUrlDrop(imageUrl) {
    console.log('开始处理图片URL拖拽:', imageUrl);
    
    // AE检测系统 - URL拖拽
    var aeDetectionInfo = performAEDetection('URL拖拽');
    if (!aeDetectionInfo.isConnected) {
        return;
    }
    
    if (!clipboardImportEnabled) {
        console.log('剪贴板导入功能已禁用');
        showNotification('功能未启用', '请在设置中启用"剪贴板导入"功能后再试', 'warning');
        return;
    }
    
    console.log('开始处理图片URL:', imageUrl);
    
    // 确定文件扩展名
    var fileExtension = '.png'; // 默认扩展名
    var urlLower = imageUrl.toLowerCase();
    
    if (urlLower.indexOf('.jpg') !== -1 || urlLower.indexOf('.jpeg') !== -1) {
        fileExtension = '.jpg';
    } else if (urlLower.indexOf('.png') !== -1) {
        fileExtension = '.png';
    } else if (urlLower.indexOf('.gif') !== -1) {
        fileExtension = '.gif';
    } else if (urlLower.indexOf('.webp') !== -1) {
        fileExtension = '.webp';
    } else if (urlLower.indexOf('.avif') !== -1) {
        fileExtension = '.avif';
    } else if (urlLower.indexOf('.bmp') !== -1) {
        fileExtension = '.bmp';
    } else if (urlLower.indexOf('.tiff') !== -1 || urlLower.indexOf('.tif') !== -1) {
        fileExtension = '.tiff';
    } else if (urlLower.indexOf('.svg') !== -1) {
        fileExtension = '.svg';
    } else if (urlLower.indexOf('.jfif') !== -1 || urlLower.indexOf('.jpe') !== -1) {
        fileExtension = '.jfif';
    } else if (urlLower.indexOf('.eps') !== -1) {
        fileExtension = '.eps';
    } else if (urlLower.indexOf('.ai') !== -1) {
        fileExtension = '.ai';
    } else if (urlLower.indexOf('.cdr') !== -1) {
        fileExtension = '.cdr';
    } else if (urlLower.indexOf('.pdf') !== -1) {
        fileExtension = '.pdf';
    } else if (urlLower.indexOf('.cr2') !== -1 || urlLower.indexOf('.cr3') !== -1 || urlLower.indexOf('.crw') !== -1) {
        fileExtension = '.cr2';
    } else if (urlLower.indexOf('.nef') !== -1 || urlLower.indexOf('.nrw') !== -1) {
        fileExtension = '.nef';
    } else if (urlLower.indexOf('.arw') !== -1 || urlLower.indexOf('.srf') !== -1 || urlLower.indexOf('.sr2') !== -1) {
        fileExtension = '.arw';
    } else if (urlLower.indexOf('.dng') !== -1) {
        fileExtension = '.dng';
    } else if (urlLower.indexOf('.raw') !== -1) {
        fileExtension = '.raw';
    } else {
        // 对于没有明显扩展名的URL，尝试从Content-Type判断，默认使用.jpg
        fileExtension = '.jpg';
    }
    
    console.log('文件扩展名检测:', fileExtension, 'URL:', imageUrl.substring(0, 80) + '...');
    
    // 显示进度对话框
    var progressDiv = document.createElement('div');
    
    console.log('创建进度对话框元素');
    
    try {
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(30, 30, 30, 0.95);
            padding: 30px;
            border-radius: 12px;
            z-index: 10001;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(138, 43, 226, 0.3);
            min-width: 300px;
            color: #e0e0e0;
            font-family: 'Inter', 'Segoe UI', sans-serif;
        `;
        
        console.log('样式设置成功');
        
    } catch (e) {
        console.error('样式设置失败:', e.message);
        showNotification('错误', '无法创建下载进度界面', 'error');
        return;
    }
    
    var fileName = 'dragged_image_' + new Date().getTime() + fileExtension;
    
    console.log('文件名生成:', fileName);
    
    try {
        progressDiv.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 16px; font-weight: 500;">正在下载图片...</div>
            <div style="margin-bottom: 10px; font-size: 14px; color: #b0b0b0;">${fileName}</div>
            <div style="margin-bottom: 15px; font-size: 12px; color: #888;">从URL下载 • ${fileExtension.substring(1).toUpperCase()}</div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div id="downloadProgress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #8a2be2, #9d4edd); transition: width 0.3s ease;"></div>
            </div>
            <div id="downloadProgressText" style="margin-top: 10px; font-size: 12px; color: #888;">正在连接...</div>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">保持原始格式导入</div>
        `;
        
        console.log('innerHTML设置成功');
        
    } catch (e) {
        console.error('innerHTML设置失败:', e.message, '尝试备用方案');
        
        // 尝试使用传统字符串拼接方式
        try {
            progressDiv.innerHTML = 
                '<div style="margin-bottom: 20px; font-size: 16px; font-weight: 500;">正在下载图片...</div>' +
                '<div style="margin-bottom: 10px; font-size: 14px; color: #b0b0b0;">' + fileName + '</div>' +
                '<div style="margin-bottom: 15px; font-size: 12px; color: #888;">从URL下载 • ' + fileExtension.substring(1).toUpperCase() + '</div>' +
                '<div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">' +
                    '<div id="downloadProgress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #8a2be2, #9d4edd); transition: width 0.3s ease;"></div>' +
                '</div>' +
                '<div id="downloadProgressText" style="margin-top: 10px; font-size: 12px; color: #888;">正在连接...</div>' +
                '<div style="margin-top: 8px; font-size: 11px; color: #666;">保持原始格式导入</div>';
            
            console.log('备用方案成功');
                  
        } catch (e2) {
            console.error('备用方案也失败:', e2.message);
            showNotification('错误', '无法创建下载界面', 'error');
            return;
        }
    }
    
    try {
        document.body.appendChild(progressDiv);
        console.log('进度对话框添加到页面成功');
        
    } catch (e) {
        console.error('添加到页面失败:', e.message);
        showNotification('错误', '无法显示下载进度', 'error');
        return;
    }
    
    var progressBar = document.getElementById('downloadProgress');
    var progressText = document.getElementById('downloadProgressText');
    
    if (!progressBar || !progressText) {
        console.error('无法获取进度条元素', 'progressBar:', !!progressBar, 'progressText:', !!progressText);
        showNotification('错误', '下载界面初始化失败', 'error');
        return;
    }
    
    console.log('进度条元素获取成功');
    
    // 使用XMLHttpRequest下载图片
    var xhr = new XMLHttpRequest();
    
    try {
        xhr.open('GET', imageUrl, true);
        xhr.responseType = 'blob';
        
        console.log('XMLHttpRequest初始化成功');
        
    } catch (e) {
        console.error('XMLHttpRequest初始化失败:', e.message);
        if (document.body.contains(progressDiv)) {
            document.body.removeChild(progressDiv);
        }
        showNotification('错误', '无法开始下载', 'error');
        return;
    }
    
    // 监听下载进度
    xhr.onprogress = function(event) {
        try {
            console.log('下载进度:', event.loaded, '/', event.total);
            
            if (event.lengthComputable) {
                var percentComplete = (event.loaded / event.total) * 100;
                
                console.log('进度百分比:', percentComplete + '%');
                
                try {
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = '下载中: ' + Math.round(percentComplete) + '%';
                } catch (e) {
                    console.error('进度条更新失败:', e.message);
                }
                
            } else {
                // 如果无法计算进度，显示动画
                var progress = parseInt(progressBar.style.width) || 0;
                progress += 5;
                if (progress > 90) progress = 20;
                
                try {
                    progressBar.style.width = progress + '%';
                    progressText.textContent = '下载中...';
                } catch (e) {
                    console.error('动画模式更新失败:', e.message);
                }
            }
            
        } catch (e) {
            console.error('下载进度更新失败:', e.message);
        }
    };
    
    xhr.onload = function() {
        try {
            console.log('下载完成，状态:', xhr.status);
            
            if (xhr.status === 200) {
                progressBar.style.width = '100%';
                progressText.textContent = '下载完成，正在保存...';
                
                var blob = xhr.response;
                console.log('文件下载成功，大小:', blob.size, 'bytes，类型:', blob.type);
                
                // 从响应头或blob类型确定实际文件格式
                var actualType = blob.type;
                var actualExtension = fileExtension;
            
            if (actualType) {
                if (actualType === 'image/jpeg' || actualType === 'image/jpg') {
                    actualExtension = '.jpg';
                } else if (actualType === 'image/png') {
                    actualExtension = '.png';
                } else if (actualType === 'image/gif') {
                    actualExtension = '.gif';
                } else if (actualType === 'image/webp') {
                    actualExtension = '.webp';
                } else if (actualType === 'image/avif') {
                    actualExtension = '.avif';
                }
            }
            
            // 更新文件名
            var actualFileName = 'dragged_image_' + new Date().getTime() + actualExtension;
            
            // 记录文件大小信息（已移除大小限制）
            console.log('下载的图片大小:', (blob.size / (1024 * 1024)).toFixed(2) + ' MB');
            
            // 使用CEP的文件系统API保存blob到临时文件
            var tempFileName = 'temp_url_image_' + Date.now() + actualExtension;
            var tempFilePath;
            
            try {
                // 获取系统临时目录
                if (window.cep && window.cep.fs) {
                    // 使用CEP文件系统API
                    var tempDir = window.cep.fs.getTempDir ? window.cep.fs.getTempDir() : 'C:\\temp\\';
                    tempFilePath = tempDir + (tempDir.endsWith('\\') ? '' : '\\') + tempFileName;
                } else {
                    // 备用方案：使用固定临时目录
                    tempFilePath = 'C:\\temp\\' + tempFileName;
                }
                
                console.log('临时文件路径:', tempFilePath);
                
            } catch (e) {
                console.error('临时文件路径确定失败:', e.message, '使用备用路径');
                tempFilePath = 'C:\\temp\\' + tempFileName;
            }
            
            // 转换blob为ArrayBuffer并保存到文件
            var reader = new FileReader();
            reader.onload = function() {
                try {
                    var arrayBuffer = reader.result;
                    var uint8Array = new Uint8Array(arrayBuffer);
                    
                    console.log('数据转换完成，大小:', uint8Array.length, 'bytes');
                    
                    // 将Uint8Array转换为base64字符串，然后保存
                    var binaryString = '';
                    for (var i = 0; i < uint8Array.length; i++) {
                        binaryString += String.fromCharCode(uint8Array[i]);
                    }
                    var base64String = btoa(binaryString);
                    
                    console.log('Base64转换完成，长度:', base64String.length, '字符');
                    
                    // 调用AE脚本来保存文件（因为前端无法直接写文件）
                    var saveFileScript = "saveBase64ToFile('" + 
                        base64String.replace(/'/g, "\\'") + "', '" + 
                        tempFilePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')";
                    
                    csInterface.evalScript(saveFileScript, function(saveResult) {
                        try {
                            if (saveResult && saveResult.indexOf('Error:') === 0) {
                                if (document.body.contains(progressDiv)) {
                                    document.body.removeChild(progressDiv);
                                }
                                console.error('临时文件保存失败:', saveResult);
                                showNotification('图片处理失败', '无法保存临时文件: ' + saveResult.substring(6), 'error');
                                return;
                            }
                            
                            console.log('图片保存到临时文件:', tempFilePath);
                            
                            // 获取当前剪贴板导入设置
                            var saveLocation = localStorage.getItem('clipboardSaveLocation') || 'documents';
                            var customPath = localStorage.getItem('clipboardCustomPath') || '';
                            
                            // 更新进度条到90%
                            var downloadProgress = progressDiv.querySelector('#downloadProgress');
                            var downloadProgressText = progressDiv.querySelector('#downloadProgressText');
                            if (downloadProgress && downloadProgressText) {
                                downloadProgress.style.width = '90%';
                                downloadProgressText.textContent = '90% - 正在导入到AE...';
                            }
                            
                            console.log('图片下载成功，开始导入到AE:', actualFileName, (blob.size / 1024).toFixed(2) + ' KB');
                            
                            // 转义参数
                            var escapedFilePath = tempFilePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                                             .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
                            var escapedSaveLocation = saveLocation.replace(/'/g, "\\'")
                                                                 .replace(/\\/g, '\\\\');
                            var escapedCustomPath = customPath.replace(/'/g, "\\'")
                                                              .replace(/\\/g, '\\\\');
                            var escapedExtension = actualExtension.replace(/'/g, "\\'")
                                                                 .replace(/\\/g, '\\\\');
                            
                            // 使用新的直接文件导入方法（无Base64）
                            var scriptCall = "importFileDirectly('" + escapedFilePath + "', '" + 
                                           escapedSaveLocation + "', '" + escapedCustomPath + "', '" + 
                                           escapedExtension + "')";
                            
                            console.log('调用AE脚本（直接导入）:', scriptCall.substring(0, 100) + '...');
                            
                            // 设置超时
                            var timeoutId = setTimeout(function() {
                                console.log('AE脚本执行超时');
                                // 清理临时文件
                                csInterface.evalScript("deleteFile('" + escapedFilePath + "')", function() {});
                                showNotification('导入超时', '图片导入操作超时，请检查AE是否响应', 'error');
                            }, 60000); // 1分钟超时
                            
                            csInterface.evalScript(scriptCall, function(result) {
                                clearTimeout(timeoutId);
                                console.log('AE脚本执行结果:', result);
                                
                                // 清理临时文件
                                csInterface.evalScript("deleteFile('" + escapedFilePath + "')", function(deleteResult) {
                                    if (deleteResult && deleteResult.indexOf('Error:') !== 0) {
                                        console.log('临时文件已清理:', tempFilePath);
                                    } else {
                                        console.log('清理临时文件失败:', deleteResult);
                                    }
                                });
                                
                                // 完成进度条并移除
                                if (downloadProgress && downloadProgressText) {
                                    downloadProgress.style.width = '100%';
                                    downloadProgressText.textContent = '100% - 导入完成';
                                }
                                
                                setTimeout(function() {
                                    if (document.body.contains(progressDiv)) {
                                        document.body.removeChild(progressDiv);
                                    }
                                    
                                    if (result && result.indexOf('Error:') === 0) {
                                        showNotification('导入失败', result.substring(6), 'error');
                                    } else if (result && result.indexOf('Success:') === 0) {
                                        showNotification('导入成功', result.substring(8), 'success');
                                    } else {
                                        showNotification('导入完成', '图片已成功导入到After Effects', 'success');
                                    }
                                }, 500);
                            });
                            
                        } catch (e) {
                            console.error('文件保存后处理失败:', e.message);
                            
                            if (document.body.contains(progressDiv)) {
                                document.body.removeChild(progressDiv);
                            }
                            showNotification('图片处理失败', '文件保存后处理失败', 'error');
                        }
                    });
                    
                } catch (e) {
                    console.error('数据处理失败:', e.message);
                    
                    if (document.body.contains(progressDiv)) {
                        document.body.removeChild(progressDiv);
                    }
                    showNotification('图片处理失败', '数据转换失败', 'error');
                }
            };
            
            reader.onerror = function() {
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
                console.error('FileReader读取失败: 无法将下载的图片转换为ArrayBuffer格式');
                showNotification('图片处理失败', '无法读取下载的图片文件', 'error');
            };
            
            try {
                console.log('开始FileReader读取，blob大小:', blob.size, 'bytes');
                reader.readAsArrayBuffer(blob);
                
            } catch (e) {
                console.error('FileReader启动失败:', e.message);
                
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
                showNotification('图片处理失败', 'FileReader启动失败', 'error');
            }
            
        } else {
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            console.error('HTTP请求失败:', xhr.status, imageUrl);
            showNotification('下载失败', '无法下载图片，状态码: ' + xhr.status, 'error');
        }
        
        } catch (e) {
            console.error('下载处理失败:', e.message);
            
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            showNotification('图片处理失败', '处理下载的图片时发生错误', 'error');
        }
    };
    
    xhr.onerror = function() {
        try {
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            console.error('网络请求失败:', imageUrl);
            showNotification('网络错误', '无法连接到图片服务器，请检查网络连接或尝试拖拽本地图片文件', 'error');
            
        } catch (e) {
            console.error('网络错误处理失败:', e.message);
        }
    };
    
    try {
        console.log('发送XMLHttpRequest，URL:', imageUrl.substring(0, 50) + '...');
        
        // 开始下载
        xhr.send();
        
    } catch (e) {
        console.error('xhr.send()调用失败:', e.message);
        
        if (document.body.contains(progressDiv)) {
            document.body.removeChild(progressDiv);
        }
        showNotification('请求发送失败', '无法发送下载请求', 'error');
    }
}

// Note: processImageFromBase64 function removed - no longer using Base64 processing

// Process individual dropped file
function processDroppedFile(file) {
    console.log('开始处理拖拽文件，大小: ' + file.size + ' bytes，类型: ' + file.type);
    console.log('文件详细信息:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        path: file.path || 'N/A'
    });
    
    // 文件拖拽开始处理
    
    // AE弹窗检测系统 - 文件拖拽
    var aeDetectionInfo = performAEDetection('文件拖拽');
    if (!aeDetectionInfo.isConnected) {
        console.log('AE连接失败，无法处理文件拖拽');
        return;
    }
    
    // 显示processDroppedFile调试信息
    var processDebugInfo = 'processDroppedFile调试信息:\n';
    processDebugInfo += '文件名: ' + file.name + '\n';
    processDebugInfo += '文件大小: ' + (file.size / 1024).toFixed(2) + ' KB\n';
    processDebugInfo += '文件类型: ' + file.type + '\n';
    processDebugInfo += '文件路径: ' + (file.path || 'N/A') + '\n';
    processDebugInfo += 'AE连接状态: ' + (aeDetectionInfo.isConnected ? '已连接' : '未连接') + '\n';
    processDebugInfo += 'AE版本: ' + aeDetectionInfo.version + '\n';
    processDebugInfo += '开始处理文件...';
    
    console.log('processDroppedFile调试信息:', processDebugInfo);
    
    // Determine file extension from MIME type or filename
    var fileExtension = '.png'; // Default fallback
    
    // First try to get extension from MIME type
    if (file.type === 'image/gif') {
        fileExtension = '.gif';
        console.log('检测到MIME类型: image/gif，设置扩展名为 .gif');
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        fileExtension = '.jpg';
        console.log('检测到MIME类型: ' + file.type + '，设置扩展名为 .jpg');
    } else if (file.type === 'image/png') {
        fileExtension = '.png';
        console.log('检测到MIME类型: image/png，设置扩展名为 .png');
    } else if (file.type === 'image/webp') {
        fileExtension = '.webp';
        console.log('检测到MIME类型: image/webp，设置扩展名为 .webp');
    } else if (file.type === 'image/avif') {
        fileExtension = '.avif';
        console.log('检测到MIME类型: image/avif，设置扩展名为 .avif');
    } else if (file.type === 'video/mp4') {
        fileExtension = '.mp4';
        console.log('检测到MIME类型: video/mp4，设置扩展名为 .mp4');
    } else if (file.type === 'image/bmp') {
        fileExtension = '.bmp';
        console.log('检测到MIME类型: image/bmp，设置扩展名为 .bmp');
    } else if (file.type === 'image/tiff') {
        fileExtension = '.tiff';
        console.log('检测到MIME类型: image/tiff，设置扩展名为 .tiff');
    } else if (file.type === 'image/svg+xml') {
        fileExtension = '.svg';
        console.log('检测到MIME类型: image/svg+xml，设置扩展名为 .svg');
    } else if (file.type === 'image/jfif') {
        fileExtension = '.jfif';
        console.log('检测到MIME类型: image/jfif，设置扩展名为 .jfif');
    } else if (file.type === 'application/postscript') {
        fileExtension = '.eps';
        console.log('检测到MIME类型: application/postscript，设置扩展名为 .eps');
    } else if (file.type === 'application/pdf') {
        fileExtension = '.pdf';
        console.log('检测到MIME类型: application/pdf，设置扩展名为 .pdf');
    } else {
        // Fallback to filename extension
        var fileName = file.name.toLowerCase();
        if (fileName.endsWith('.gif')) {
            fileExtension = '.gif';
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            fileExtension = '.jpg';
        } else if (fileName.endsWith('.png')) {
            fileExtension = '.png';
        } else if (fileName.endsWith('.webp')) {
            fileExtension = '.webp';
        } else if (fileName.endsWith('.avif')) {
            fileExtension = '.avif';
        } else if (fileName.endsWith('.mp4')) {
            fileExtension = '.mp4';
        } else if (fileName.endsWith('.bmp')) {
            fileExtension = '.bmp';
        } else if (fileName.endsWith('.tiff') || fileName.endsWith('.tif')) {
            fileExtension = '.tiff';
        } else if (fileName.endsWith('.svg')) {
            fileExtension = '.svg';
        } else if (fileName.endsWith('.jfif') || fileName.endsWith('.jpe')) {
            fileExtension = '.jfif';
        } else if (fileName.endsWith('.eps')) {
            fileExtension = '.eps';
        } else if (fileName.endsWith('.ai')) {
            fileExtension = '.ai';
        } else if (fileName.endsWith('.cdr')) {
            fileExtension = '.cdr';
        } else if (fileName.endsWith('.pdf')) {
            fileExtension = '.pdf';
        } else if (fileName.endsWith('.cr2') || fileName.endsWith('.nef') || fileName.endsWith('.arw') || 
                   fileName.endsWith('.dng') || fileName.endsWith('.orf') || fileName.endsWith('.rw2') ||
                   fileName.endsWith('.pef') || fileName.endsWith('.srw') || fileName.endsWith('.x3f') ||
                   fileName.endsWith('.raf') || fileName.endsWith('.3fr') || fileName.endsWith('.fff') ||
                   fileName.endsWith('.dcr') || fileName.endsWith('.kdc') || fileName.endsWith('.srf') ||
                   fileName.endsWith('.mrw') || fileName.endsWith('.raw')) {
            // RAW formats - keep original extension
            var rawExt = fileName.substring(fileName.lastIndexOf('.'));
            fileExtension = rawExt;
        }
        console.log('从文件名检测扩展名: ' + fileExtension);
    }
    
    console.log('最终使用的文件扩展名: ' + fileExtension);
        
    // Show progress dialog
    var progressDiv = document.createElement('div');
    progressDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(30, 30, 30, 0.95);
        padding: 30px;
        border-radius: 12px;
        z-index: 10001;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(138, 43, 226, 0.3);
        min-width: 300px;
        color: #e0e0e0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
    `;
    
    // Format file size for display
    var fileSizeText = '';
    if (file.size < 1024) {
        fileSizeText = file.size + ' B';
    } else if (file.size < 1024 * 1024) {
        fileSizeText = (file.size / 1024).toFixed(1) + ' KB';
    } else {
        fileSizeText = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    var fileSizeMB = file.size / (1024 * 1024);
    progressDiv.innerHTML = `
        <div style="margin-bottom: 20px; font-size: 16px; font-weight: 500;">正在导入文件...</div>
        <div style="margin-bottom: 10px; font-size: 14px; color: #b0b0b0;">${file.name}</div>
        <div style="margin-bottom: 15px; font-size: 12px; color: #888;">${fileSizeText} • ${fileExtension.substring(1).toUpperCase()}</div>
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div id="importProgress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #8a2be2, #9d4edd); transition: width 0.3s ease;"></div>
        </div>
        <div id="progressText" style="margin-top: 10px; font-size: 12px; color: #888;">0%</div>
        ${fileSizeMB > 5 ? '<div style="margin-top: 8px; font-size: 11px; color: #666;">大文件处理中，请耐心等待...</div>' : ''}
    `;
    
    document.body.appendChild(progressDiv);
        
    // Animate progress with optimized updates
    var progressBar = document.getElementById('importProgress');
    var progressText = document.getElementById('progressText');
    var progress = 0;
    var updateCount = 0;
    
    var updateInterval = 150;
    var progressIncrement = 5;
    
    var progressInterval = setInterval(function() {
        updateCount++;
        progress += Math.random() * progressIncrement + 2;
        
        if (progress > 85) progress = 85; // Keep some room for completion
        
        progressBar.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '%';
    }, updateInterval);
    
    // Get current import settings from settings window
    var imageSaveLocationRadio = document.querySelector('input[name="imageSaveLocation"]:checked');
    var saveLocation = imageSaveLocationRadio ? imageSaveLocationRadio.value : 'documents';
    var customPath = document.getElementById('customLocationPath') ? document.getElementById('customLocationPath').value : '';
    
    console.log('使用设置窗口的保存位置: ' + saveLocation + ', 自定义路径: ' + customPath);
    
    // Get file path - for dropped files, we need to use the file path if available
    var filePath = '';
    if (file.path) {
        filePath = file.path;
    } else {
        // For files without direct path access, we'll need to save them temporarily
        console.log('文件没有直接路径访问权限，将创建临时文件');
    }
    
    // Escape parameters for safe transmission
    var escapedFilePath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                 .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    var escapedCustomPath = customPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                      .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    
    // Set timeout based on file size
    var timeoutDuration = Math.max(30000, fileSizeMB * 2000); // Minimum 30s, +2s per MB (faster than Base64)
    if (fileSizeMB > 20) timeoutDuration = 120000; // 2 minutes for very large files
    
    console.log('文件大小: ' + fileSizeMB.toFixed(2) + 'MB，设置超时时间: ' + (timeoutDuration/1000) + '秒');
    
    var isCompleted = false;
    var timeoutId = setTimeout(function() {
        if (!isCompleted) {
            clearInterval(progressInterval);
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            showNotification('文件导入超时，请尝试较小的文件或检查AE是否响应', true);
        }
    }, timeoutDuration);
    
    // Call AE script to import the file with file path - 使用新的直接导入方法
    var scriptCall;
    if (filePath) {
        scriptCall = "importFileDirectly('" + escapedFilePath + "', '" + saveLocation + "', '" + escapedCustomPath + "', '" + fileExtension + "')";
        console.log('调用AE脚本直接导入拖拽文件（无Base64），保存位置: ' + saveLocation + '，文件路径: ' + filePath);
    } else {
        // Fallback to Base64 for files without path access
        var reader = new FileReader();
        reader.onload = function(e) {
            var base64Data = e.target.result;
            var base64 = base64Data.split(',')[1];
            var escapedBase64 = base64.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                     .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
            
            scriptCall = "saveAndImportClipboardImage('" + escapedBase64 + "', '" + saveLocation + "', '" + escapedCustomPath + "', '" + fileExtension + "')";
            console.log('调用AE脚本导入拖拽文件（Base64备用），保存位置: ' + saveLocation + '，扩展名: ' + fileExtension);
            
            executeImportScript();
        };
        reader.readAsDataURL(file);
        return;
    }
    
    function executeImportScript() {
        // AE脚本执行前检测
        var preExecutionInfo = performAEDetection('脚本执行前');
        
        // 显示AE脚本调用调试信息
        var aeDebugInfo = 'AE脚本调用调试信息:\n';
        aeDebugInfo += '保存位置: ' + saveLocation + '\n';
        aeDebugInfo += '自定义路径: ' + customPath + '\n';
        aeDebugInfo += '文件扩展名: ' + fileExtension + '\n';
        aeDebugInfo += '文件路径: ' + (filePath || 'Base64备用') + '\n';
        aeDebugInfo += 'AE连接状态: ' + (preExecutionInfo.isConnected ? '已连接' : '未连接') + '\n';
        aeDebugInfo += 'AE版本: ' + preExecutionInfo.version + '\n';
        aeDebugInfo += '脚本调用: ' + scriptCall.substring(0, 50) + '...\n';
        aeDebugInfo += '即将调用AE脚本...';
        
        console.log('AE脚本调用调试信息:', aeDebugInfo);
        
        csInterface.evalScript(scriptCall, function(result) {
            isCompleted = true;
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
            
            // AE脚本执行后检测
            var postExecutionInfo = performAEDetection('脚本执行后');
            
            // 显示AE脚本执行结果调试信息
            var resultDebugInfo = 'AE脚本执行结果调试信息:\n';
            resultDebugInfo += '返回结果: ' + (result || '(空结果)') + '\n';
            resultDebugInfo += '结果类型: ' + typeof result + '\n';
            resultDebugInfo += '结果长度: ' + (result ? result.length : 0) + '\n';
            resultDebugInfo += '执行后AE状态: ' + (postExecutionInfo.isConnected ? '正常' : '异常') + '\n';
            resultDebugInfo += '脚本执行完成';
            
            console.log('AE脚本执行结果调试信息:', resultDebugInfo);
            
            console.log('AE脚本执行完成，返回结果:', result);
            
            // Complete progress
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
            
            // Remove progress dialog after a short delay
            setTimeout(function() {
                if (document.body.contains(progressDiv)) {
                    document.body.removeChild(progressDiv);
                }
            }, 500);
            
            // Process result
            if (result && result.trim() !== '') {
                try {
                    var resultObj = JSON.parse(result);
                    if (resultObj.success) {
                        console.log('文件导入成功');
                        showNotification('文件导入完成', false);
                    } else {
                        console.log('文件导入失败: ' + resultObj.error);
                        showNotification('导入失败: ' + resultObj.error, true);
                    }
                } catch (e) {
                    // Handle non-JSON responses
                    if (result.indexOf('Error:') === 0) {
                        showNotification('导入文件失败: ' + result.substring(6), true);
                    } else if (result.indexOf('导入文件失败:') === 0) {
                        showNotification(result, true);
                    } else if (result.indexOf('导入图片失败:') === 0) {
                        showNotification(result, true);
                    } else if (result.indexOf('Base64解码失败:') === 0) {
                        showNotification('文件处理失败: ' + result, true);
                    } else if (result.indexOf('文件写入失败:') === 0) {
                        showNotification('文件保存失败: ' + result, true);
                    } else if (result.indexOf('导入AE失败:') === 0) {
                        showNotification('AE导入失败: ' + result, true);
                    } else {
                        showNotification(result || '文件导入完成', false);
                    }
                }
            } else {
                showNotification('文件导入完成', false);
            }
        });
    }
    
    // Execute the import script
    if (filePath) {
        executeImportScript();
    }
}

// AE弹窗检测系统核心函数
function performAEDetection(context) {
    var detectionInfo = {
        context: context,
        timestamp: new Date().toLocaleString(),
        isConnected: false,
        version: 'unknown',
        hostEnvironment: null,
        csInterfaceStatus: 'unknown',
        errors: []
    };
    
    try {
        // 检测CSInterface是否可用
        if (typeof csInterface === 'undefined') {
            detectionInfo.errors.push('CSInterface未定义');
            detectionInfo.csInterfaceStatus = '未定义';
            return detectionInfo;
        }
        
        detectionInfo.csInterfaceStatus = '已定义';
        
        // 获取主机环境信息
        try {
            var hostEnv = csInterface.getHostEnvironment();
            if (hostEnv) {
                detectionInfo.hostEnvironment = hostEnv;
                detectionInfo.isConnected = true;
                
                if (hostEnv.appVersion) {
                    detectionInfo.version = hostEnv.appVersion;
                }
                
                if (hostEnv.appName) {
                    detectionInfo.appName = hostEnv.appName;
                }
            } else {
                detectionInfo.errors.push('无法获取主机环境');
            }
        } catch (e) {
            detectionInfo.errors.push('获取主机环境失败: ' + e.message);
        }
        
        // 测试简单脚本执行
        try {
            csInterface.evalScript('app.version', function(result) {
                if (result && result.trim() !== '') {
                    detectionInfo.scriptTestResult = result;
                    detectionInfo.scriptExecutionWorking = true;
                } else {
                    detectionInfo.scriptExecutionWorking = false;
                    detectionInfo.errors.push('脚本执行测试失败');
                }
            });
        } catch (e) {
            detectionInfo.errors.push('脚本执行测试异常: ' + e.message);
            detectionInfo.scriptExecutionWorking = false;
        }
        
    } catch (e) {
        detectionInfo.errors.push('AE检测过程异常: ' + e.message);
    }
    
    return detectionInfo;
}

// 弹窗函数已删除

// 功能检测系统
function runSystemDiagnostics() {
    console.log('开始运行系统功能检测...');
    showDiagnosticsModal();
    
    const progressDiv = document.getElementById('diagnosticsProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultsDiv = document.getElementById('diagnosticsResults');
    const retryBtn = document.getElementById('retryDiagnosticsBtn');
    const exportBtn = document.getElementById('exportDiagnosticsBtn');
    
    // 显示进度条
    progressDiv.style.display = 'block';
    resultsDiv.innerHTML = '';
    retryBtn.style.display = 'none';
    exportBtn.style.display = 'none';
    
    const diagnosticTests = [
        { name: 'CSInterface连接检测', test: testCSInterface },
        { name: 'AE版本检测', test: testAEVersion },
        { name: '脚本执行权限检测', test: testScriptExecution },
        { name: '文件系统访问检测', test: testFileSystemAccess },
        { name: '脚本文件夹路径检测', test: testScriptFolderPath },
        { name: '数据管理器检测', test: testDataManager },
        { name: '设置保存/加载检测', test: testSettingsSystem },
        { name: '剪贴板功能检测', test: testClipboardFeatures },
        { name: '背景设置检测', test: testBackgroundSettings },
        { name: '导入/导出功能检测', test: testImportExport }
    ];
    
    let currentTest = 0;
    const results = [];
    
    function runNextTest() {
        if (currentTest >= diagnosticTests.length) {
            // 所有测试完成
            progressFill.style.width = '100%';
            progressText.textContent = '检测完成';
            
            setTimeout(() => {
                progressDiv.style.display = 'none';
                displayDiagnosticsResults(results);
                retryBtn.style.display = 'inline-block';
                exportBtn.style.display = 'inline-block';
            }, 500);
            return;
        }
        
        const test = diagnosticTests[currentTest];
        const progress = ((currentTest + 1) / diagnosticTests.length) * 100;
        
        progressFill.style.width = progress + '%';
        progressText.textContent = `正在检测: ${test.name} (${Math.round(progress)}%)`;
        
        // 运行测试
        test.test().then(result => {
            results.push({
                name: test.name,
                ...result
            });
            currentTest++;
            setTimeout(runNextTest, 300); // 添加延迟以显示进度
        }).catch(error => {
            results.push({
                name: test.name,
                status: 'error',
                message: '测试执行失败',
                details: error.message || error.toString()
            });
            currentTest++;
            setTimeout(runNextTest, 300);
        });
    }
    
    runNextTest();
}

function showDiagnosticsModal() {
    const modal = document.getElementById('diagnosticsModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideDiagnosticsModal() {
    const modal = document.getElementById('diagnosticsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function displayDiagnosticsResults(results) {
    const resultsDiv = document.getElementById('diagnosticsResults');
    
    // 统计结果
    const stats = {
        success: results.filter(r => r.status === 'success').length,
        warning: results.filter(r => r.status === 'warning').length,
        error: results.filter(r => r.status === 'error').length,
        info: results.filter(r => r.status === 'info').length
    };
    
    // 创建摘要
    const summaryHTML = `
        <div class="diagnostics-summary">
            <div class="summary-stats">
                <div class="stat-item success">
                    <span>✓</span>
                    <span>${stats.success} 正常</span>
                </div>
                <div class="stat-item warning">
                    <span>⚠</span>
                    <span>${stats.warning} 警告</span>
                </div>
                <div class="stat-item error">
                    <span>✗</span>
                    <span>${stats.error} 错误</span>
                </div>
                <div class="stat-item info">
                    <span>ℹ</span>
                    <span>${stats.info} 信息</span>
                </div>
            </div>
        </div>
    `;
    
    // 创建详细结果
    const resultsHTML = results.map(result => {
        const iconMap = {
            success: '✓',
            warning: '⚠',
            error: '✗',
            info: 'ℹ'
        };
        
        return `
            <div class="diagnostic-item ${result.status}">
                <div class="diagnostic-icon">${iconMap[result.status] || '?'}</div>
                <div class="diagnostic-content">
                    <div class="diagnostic-title">${result.name}</div>
                    <div class="diagnostic-description">${result.message}</div>
                    ${result.details ? `<div class="diagnostic-details">${result.details}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    resultsDiv.innerHTML = summaryHTML + resultsHTML;
    
    // 保存结果用于导出
    window.lastDiagnosticsResults = {
        timestamp: new Date().toLocaleString(),
        stats: stats,
        results: results
    };
}

// 各种检测函数
function testCSInterface() {
    return new Promise((resolve) => {
        try {
            if (typeof csInterface === 'undefined') {
                resolve({
                    status: 'error',
                    message: 'CSInterface未定义',
                    details: '无法找到Adobe CEP的CSInterface对象，可能是扩展未正确加载'
                });
                return;
            }
            
            const hostEnv = csInterface.getHostEnvironment();
            if (hostEnv) {
                resolve({
                    status: 'success',
                    message: 'CSInterface连接正常',
                    details: `主机应用: ${hostEnv.appName || 'Unknown'}\n版本: ${hostEnv.appVersion || 'Unknown'}`
                });
            } else {
                resolve({
                    status: 'error',
                    message: 'CSInterface连接失败',
                    details: '无法获取主机环境信息，可能AE未正确启动或CEP服务异常'
                });
            }
        } catch (error) {
            resolve({
                status: 'error',
                message: 'CSInterface检测异常',
                details: error.message
            });
        }
    });
}

function testAEVersion() {
    return new Promise((resolve) => {
        try {
            csInterface.evalScript('app.version', function(result) {
                if (result && result.trim() !== '') {
                    const version = result.trim();
                    let status = 'success';
                    let message = `AE版本: ${version}`;
                    let details = '';
                    
                    // 检查版本兼容性
                    if (version.startsWith('24.5')) {
                        status = 'warning';
                        message += ' (已知兼容性问题)';
                        details = 'AE 24.5版本存在路径读取问题，可能无法正常发现脚本文件';
                    } else if (version.startsWith('25.')) {
                        status = 'warning';
                        message += ' (需要重新设置)';
                        details = 'AE 2025版本每次打开可能需要重新设置脚本目录';
                    }
                    
                    resolve({ status, message, details });
                } else {
                    resolve({
                        status: 'error',
                        message: '无法获取AE版本',
                        details: '脚本执行返回空结果，可能是脚本执行权限问题'
                    });
                }
            });
        } catch (error) {
            resolve({
                status: 'error',
                message: 'AE版本检测失败',
                details: error.message
            });
        }
    });
}

function testScriptExecution() {
    return new Promise((resolve) => {
        try {
            csInterface.evalScript('typeof app', function(result) {
                if (result && result.trim() === 'object') {
                    resolve({
                        status: 'success',
                        message: '脚本执行权限正常',
                        details: 'ExtendScript可以正常访问AE应用对象'
                    });
                } else {
                    resolve({
                        status: 'error',
                        message: '脚本执行权限异常',
                        details: `返回结果: ${result || '(空)'}\n可能是脚本执行被禁用或AE应用对象不可访问`
                    });
                }
            });
        } catch (error) {
            resolve({
                status: 'error',
                message: '脚本执行测试失败',
                details: error.message
            });
        }
    });
}

function testFileSystemAccess() {
    return new Promise((resolve) => {
        try {
            csInterface.evalScript('Folder.desktop.exists', function(result) {
                if (result && result.trim() === 'true') {
                    resolve({
                        status: 'success',
                        message: '文件系统访问正常',
                        details: '可以正常访问文件系统对象'
                    });
                } else {
                    resolve({
                        status: 'error',
                        message: '文件系统访问异常',
                        details: `返回结果: ${result || '(空)'}\n无法访问文件系统，可能是权限限制`
                    });
                }
            });
        } catch (error) {
            resolve({
                status: 'error',
                message: '文件系统访问测试失败',
                details: error.message
            });
        }
    });
}

function testScriptFolderPath() {
    return new Promise((resolve) => {
        if (!scriptsFolderPath) {
            resolve({
                status: 'warning',
                message: '脚本文件夹路径未设置',
                details: '请在设置中选择脚本文件夹路径'
            });
            return;
        }
        
        console.log('testScriptFolderPath: 检测路径:', scriptsFolderPath);
        
        try {
            // 对路径进行安全处理，避免特殊字符导致的问题
            const safePath = scriptsFolderPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            console.log('testScriptFolderPath: 安全处理后路径:', safePath);
            
            const testScript = `
                try {
                    var folder = new Folder("${safePath}");
                    var result = {
                        exists: folder.exists,
                        path: folder.fsName,
                        canRead: folder.exists ? true : false,
                        success: true
                    };
                    JSON.stringify(result);
                } catch (e) {
                    JSON.stringify({
                        success: false,
                        error: e.toString(),
                        message: "ExtendScript执行异常"
                    });
                }
            `;
            
            csInterface.evalScript(testScript, function(result) {
                console.log('testScriptFolderPath: ExtendScript返回:', result);
                
                try {
                    // 检查返回结果是否为空或无效
                    if (!result || result.trim() === '' || result === 'null' || result === 'undefined') {
                        resolve({
                            status: 'error',
                            message: '脚本文件夹检测失败',
                            details: 'ExtendScript返回空结果，可能原因：\n1. 脚本执行权限不足\n2. 路径包含特殊字符\n3. AE版本兼容性问题\n4. CEP通信异常'
                        });
                        return;
                    }
                    
                    // 尝试解析JSON结果
                    let folderInfo;
                    try {
                        folderInfo = JSON.parse(result);
                        console.log('testScriptFolderPath: 解析成功:', folderInfo);
                    } catch (parseError) {
                        console.error('testScriptFolderPath: JSON解析失败:', parseError);
                        resolve({
                            status: 'error',
                            message: '脚本文件夹检测失败',
                            details: `返回结果解析失败:\n原始结果: ${result}\n解析错误: ${parseError.message}\n\n可能原因：\n1. ExtendScript返回格式异常\n2. 路径包含特殊字符导致JSON格式错误\n3. AE版本兼容性问题\n4. 字符编码问题`
                        });
                        return;
                    }
                    
                    // 检查解析结果的有效性
                    if (!folderInfo || typeof folderInfo !== 'object') {
                        resolve({
                            status: 'error',
                            message: '脚本文件夹检测失败',
                            details: `解析结果无效: ${JSON.stringify(folderInfo)}`
                        });
                        return;
                    }
                    
                    // 检查ExtendScript执行是否成功
                    if (folderInfo.success === false) {
                        resolve({
                            status: 'error',
                            message: '脚本文件夹检测失败',
                            details: `ExtendScript执行异常: ${folderInfo.error || folderInfo.message}\n路径: ${scriptsFolderPath}`
                        });
                        return;
                    }
                    
                    // 处理检测结果
                    if (folderInfo.exists === true) {
                        resolve({
                            status: 'success',
                            message: '脚本文件夹路径有效',
                            details: `路径: ${folderInfo.path || scriptsFolderPath}\n可以正常访问该文件夹\n文件夹存在: ${folderInfo.exists}\n可读取: ${folderInfo.canRead}`
                        });
                    } else {
                        resolve({
                            status: 'error',
                            message: '脚本文件夹路径无效',
                            details: `路径: ${scriptsFolderPath}\n文件夹不存在或无法访问\n检测结果: ${JSON.stringify(folderInfo)}`
                        });
                    }
                } catch (e) {
                    console.error('testScriptFolderPath: 处理异常:', e);
                    resolve({
                        status: 'error',
                        message: '脚本文件夹检测异常',
                        details: `检测过程出错: ${e.message}\n原始返回: ${result}`
                    });
                }
            });
        } catch (error) {
            console.error('testScriptFolderPath: 外层异常:', error);
            resolve({
                status: 'error',
                message: '脚本文件夹检测异常',
                details: `初始化检测失败: ${error.message}`
            });
        }
    });
}

function testDataManager() {
    return new Promise((resolve) => {
        try {
            console.log('testDataManager: 开始检测DataManager');
            
            // 检查DataManager是否已定义
            if (typeof DataManager === 'undefined') {
                console.log('testDataManager: DataManager未定义');
                resolve({
                    status: 'error',
                    message: 'DataManager未定义',
                    details: 'DataManager对象不存在，数据管理功能不可用\n可能原因：\n1. localDataManager.js未正确加载\n2. 脚本加载顺序问题\n3. 文件路径错误'
                });
                return;
            }
            
            console.log('testDataManager: DataManager已定义，检查初始化状态');
            console.log('testDataManager: DataManager.initialized =', DataManager.initialized);
            console.log('testDataManager: DataManager.isInitializing =', DataManager.isInitializing);
            
            // 检查是否正在初始化
            if (DataManager.isInitializing) {
                console.log('testDataManager: DataManager正在初始化中');
                resolve({
                    status: 'warning',
                    message: 'DataManager正在初始化',
                    details: 'DataManager存在但正在初始化过程中，请稍后重试\n如果长时间停留在此状态，可能存在初始化问题'
                });
                return;
            }
            
            // 检查是否已初始化
            if (!DataManager.initialized) {
                console.log('testDataManager: DataManager未初始化');
                
                // 尝试获取更多初始化状态信息
                let initDetails = 'DataManager存在但未完成初始化';
                if (typeof DataManager.getInitializationStatus === 'function') {
                    try {
                        const status = DataManager.getInitializationStatus();
                        initDetails += `\n初始化状态: ${JSON.stringify(status)}`;
                    } catch (e) {
                        initDetails += `\n无法获取初始化状态: ${e.message}`;
                    }
                }
                
                // 检查是否有初始化错误
                if (DataManager.initializationError) {
                    initDetails += `\n初始化错误: ${DataManager.initializationError}`;
                }
                
                resolve({
                    status: 'warning',
                    message: 'DataManager未初始化',
                    details: initDetails + '\n\n可能原因：\n1. CEP环境检测失败\n2. ExtendScript通信异常\n3. 文件系统权限不足\n4. 扩展根目录获取失败'
                });
                return;
            }
            
            console.log('testDataManager: DataManager已正确初始化');
            
            // 进一步验证DataManager功能
            let functionalityDetails = 'DataManager已正确初始化并可用';
            
            // 检查关键方法是否存在
            const requiredMethods = ['loadData', 'saveData', 'loadDataByType', 'saveDataByType'];
            const missingMethods = requiredMethods.filter(method => typeof DataManager[method] !== 'function');
            
            if (missingMethods.length > 0) {
                resolve({
                    status: 'warning',
                    message: 'DataManager功能不完整',
                    details: `DataManager已初始化但缺少关键方法: ${missingMethods.join(', ')}`
                });
                return;
            }
            
            // 测试新添加的方法
            try {
                console.log('testDataManager: 测试loadDataByType方法');
                DataManager.loadDataByType('main', function(error, data) {
                    if (error) {
                        console.log('testDataManager: loadDataByType测试失败:', error);
                    } else {
                        console.log('testDataManager: loadDataByType测试成功');
                    }
                });
            } catch (e) {
                console.log('testDataManager: loadDataByType方法调用异常:', e);
            }
            
            // 检查数据文件夹状态
            if (DataManager.dataFolderPath) {
                functionalityDetails += `\n数据文件夹: ${DataManager.dataFolderPath}`;
            }
            
            // 检查扩展根目录
            if (DataManager.extensionRootPath) {
                functionalityDetails += `\n扩展根目录: ${DataManager.extensionRootPath}`;
            }
            
            resolve({
                status: 'success',
                message: 'DataManager正常',
                details: functionalityDetails
            });
            
        } catch (error) {
            console.error('testDataManager: 检测异常:', error);
            resolve({
                status: 'error',
                message: 'DataManager检测失败',
                details: `检测过程出错: ${error.message}\n堆栈: ${error.stack}`
            });
        }
    });
}

function testSettingsSystem() {
    return new Promise((resolve) => {
        try {
            if (typeof DataManager !== 'undefined' && DataManager.initialized) {
                DataManager.loadData(function(error, data) {
                    if (error) {
                        resolve({
                            status: 'error',
                            message: '设置加载失败',
                            details: error.message || error.toString()
                        });
                    } else {
                        resolve({
                            status: 'success',
                            message: '设置系统正常',
                            details: `已加载设置数据，包含 ${Object.keys(data || {}).length} 个配置项`
                        });
                    }
                });
            } else {
                resolve({
                    status: 'warning',
                    message: '设置系统不可用',
                    details: 'DataManager未初始化，无法测试设置系统'
                });
            }
        } catch (error) {
            resolve({
                status: 'error',
                message: '设置系统检测失败',
                details: error.message
            });
        }
    });
}

function testClipboardFeatures() {
    return new Promise((resolve) => {
        try {
            const clipboardEnabled = document.getElementById('clipboardImportEnabled');
            if (clipboardEnabled) {
                const isEnabled = clipboardEnabled.checked;
                resolve({
                    status: isEnabled ? 'success' : 'info',
                    message: `剪贴板功能${isEnabled ? '已启用' : '已禁用'}`,
                    details: isEnabled ? '剪贴板导入功能可用' : '剪贴板导入功能已在设置中禁用'
                });
            } else {
                resolve({
                    status: 'warning',
                    message: '剪贴板设置元素未找到',
                    details: '无法检测剪贴板功能状态'
                });
            }
        } catch (error) {
            resolve({
                status: 'error',
                message: '剪贴板功能检测失败',
                details: error.message
            });
        }
    });
}

function testBackgroundSettings() {
    return new Promise((resolve) => {
        try {
            if (typeof DataManager !== 'undefined' && DataManager.initialized) {
                DataManager.loadData(function(error, data) {
                    if (error) {
                        resolve({
                            status: 'warning',
                            message: '背景设置检测失败',
                            details: '无法加载背景设置数据'
                        });
                    } else {
                        const hasBackground = data && data.backgroundSettings && data.backgroundSettings.backgroundImage;
                        resolve({
                            status: 'success',
                            message: hasBackground ? '背景设置已配置' : '背景设置未配置',
                            details: hasBackground ? '已设置自定义背景' : '使用默认背景设置'
                        });
                    }
                });
            } else {
                resolve({
                    status: 'warning',
                    message: '背景设置不可用',
                    details: 'DataManager未初始化，无法检测背景设置'
                });
            }
        } catch (error) {
            resolve({
                status: 'error',
                message: '背景设置检测失败',
                details: error.message
            });
        }
    });
}

function testImportExport() {
    return new Promise((resolve) => {
        try {
            const exportBtn = document.getElementById('exportBtn');
            const importBtn = document.getElementById('importBtn');
            
            if (exportBtn && importBtn) {
                resolve({
                    status: 'success',
                    message: '导入/导出功能可用',
                    details: '导入和导出按钮已正确加载'
                });
            } else {
                resolve({
                    status: 'warning',
                    message: '导入/导出按钮未找到',
                    details: '部分导入/导出功能可能不可用'
                });
            }
        } catch (error) {
            resolve({
                status: 'error',
                message: '导入/导出功能检测失败',
                details: error.message
            });
        }
    });
}

function exportDiagnosticsReport() {
    if (!window.lastDiagnosticsResults) {
        showNotification('没有可导出的检测结果', true);
        return;
    }
    
    const results = window.lastDiagnosticsResults;
    const reportContent = `脚本管理器功能检测报告
生成时间: ${results.timestamp}

=== 检测摘要 ===
✓ 正常: ${results.stats.success}
⚠ 警告: ${results.stats.warning}
✗ 错误: ${results.stats.error}
ℹ 信息: ${results.stats.info}

=== 详细结果 ===
${results.results.map(result => {
    const statusIcon = {
        success: '✓',
        warning: '⚠',
        error: '✗',
        info: 'ℹ'
    }[result.status] || '?';
    
    return `${statusIcon} ${result.name}
   状态: ${result.message}
   ${result.details ? `详情: ${result.details.replace(/\n/g, '\n   ')}` : ''}`;
}).join('\n\n')}

=== 系统信息 ===
用户代理: ${navigator.userAgent}
时间戳: ${new Date().toISOString()}
`;
    
    // 创建下载链接
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `脚本管理器检测报告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('检测报告已导出', false);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);