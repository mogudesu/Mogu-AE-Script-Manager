// Mogu Script Launcher CEP Extension
// Main JavaScript file

// Global variables
var csInterface = new CSInterface();
var scriptsFolderPath = null;
var scriptFiles = [];
var scriptSettings = {};
var categories = ["全部"];
var currentCategory = "全部";
var searchKeyword = "";
var allTags = [];
var activeTags = [];

// DOM elements
var settingsBtn, settingsModal, closeBtnSettings, selectFolderPathBtn, folderPathDisplay;
var backgroundModal, closeBtnBackground, backgroundFileInput, selectBackgroundBtn, clearBackgroundBtn;
var backgroundPreview, previewImage, previewVideo, blurSlider, brightnessSlider, applyBackgroundBtn;
var blurValue, brightnessValue;
var currentBackgroundFile = null;
var backgroundSettings = { blur: 0, brightness: 0 };
var searchInput, clearSearchBtn;
var tagsPanel, addTagBtn, categoryList, addCategoryBtn, scriptList;
var contextMenu, dialogOverlay, layoutToggleBtn, sizeSlider, sidebarResizer, exportBtn, importBtn;
var prevThemeBtn, nextThemeBtn, currentThemeDisplay;
var isGridLayout = false;
var currentScale = 1;
var isResizing = false;
var draggedElement = null;
var draggedType = null;
var currentTheme = 'dark';

// Clipboard import settings
var clipboardImportEnabled = true;
var imageSaveLocation = 'documents';
var customLocationPath = '';
var clipboardImportElements = {};

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

// Initialize the extension
function init() {
    // Get DOM elements
    settingsBtn = document.getElementById('settingsBtn');
    settingsModal = document.getElementById('settingsModal');
    closeBtnSettings = document.getElementById('closeBtnSettings');
    selectFolderPathBtn = document.getElementById('selectFolderPathBtn');
    folderPathDisplay = document.getElementById('folderPathDisplay');
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
    applyBackgroundBtn = document.getElementById('applyBackgroundBtn');
    blurValue = document.getElementById('blurValue');
    brightnessValue = document.getElementById('brightnessValue');
    
    // Clipboard import elements
    clipboardImportElements.enabledCheckbox = document.getElementById('clipboardImportEnabled');
    clipboardImportElements.saveLocationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
    clipboardImportElements.customLocationContainer = document.getElementById('customLocationContainer');
    clipboardImportElements.customLocationPath = document.getElementById('customLocationPath');
    clipboardImportElements.selectCustomLocationBtn = document.getElementById('selectCustomLocationBtn');

    // Set up event listeners
    setupEventListeners();
    
    // Load saved settings
    loadSettings();
    
    // Initialize theme
    initializeTheme();
    
    // Initialize UI
    populateCategoryList();
    populateTagsPanel();
    
    if (scriptsFolderPath) {
        folderPathDisplay.textContent = scriptsFolderPath;
        populateScriptList();
        // Apply layout state after populating script list
        setTimeout(function() {
            if (isGridLayout) {
                scriptList.classList.add('grid-layout');
            } else {
                scriptList.classList.remove('grid-layout');
            }
            applyScaleToScriptItems();
        }, 0);
    }
    
    // Initialize clipboard import settings
    loadClipboardImportSettings({});
}

// Set up event listeners
function setupEventListeners() {
    // Settings modal
    settingsBtn.addEventListener('click', showSettingsModal);
    closeBtnSettings.addEventListener('click', hideSettingsModal);
    selectFolderPathBtn.addEventListener('click', selectScriptsFolder);
    
    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            hideSettingsModal();
        }
    });
    
    // Search functionality
    searchInput.addEventListener('input', function() {
        searchKeyword = this.value;
        populateScriptList();
    });
    
    clearSearchBtn.addEventListener('click', function() {
        searchInput.value = '';
        searchKeyword = '';
        populateScriptList();
    });
    
    // Tags
    addTagBtn.addEventListener('click', showAddTagDialog);
    
    // Categories
    addCategoryBtn.addEventListener('click', showAddCategoryDialog);
    
    // Context menu
    document.addEventListener('click', hideContextMenu);
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
        currentScale = parseFloat(this.value);
        applyScaleToScriptItems();
    });
    
    // Sidebar resizer
    setupSidebarResizer();
    
    // Window resize listener for grid layout adaptation
    window.addEventListener('resize', function() {
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
    applyBackgroundBtn.addEventListener('click', applyBackgroundSettings);
    
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
            folderPathDisplay.textContent = scriptsFolderPath;
            saveSettings();
            populateScriptList();
            hideSettingsModal();
        }
    });
}

// Populate script list
function populateScriptList() {
    if (!scriptsFolderPath) {
        scriptList.innerHTML = '<div class="script-item"><div class="script-info"><div class="script-name">请先选择脚本文件夹</div></div></div>';
        return;
    }
    
    csInterface.evalScript('getScriptFiles("' + scriptsFolderPath.replace(/\\/g, '\\\\') + '")', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            try {
                scriptFiles = JSON.parse(result);
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

// Render script list
function renderScriptList() {
    scriptList.innerHTML = '';
    
    var filteredScripts = scriptFiles.filter(function(script) {
        // Category filter
        var scriptCategory = getScriptSetting(script.name, 'category') || '';
        if (currentCategory !== '全部' && scriptCategory !== currentCategory) {
            return false;
        }
        
        // Search filter
        if (searchKeyword) {
            var displayName = getScriptSetting(script.name, 'displayName') || script.name;
            if (displayName.toLowerCase().indexOf(searchKeyword.toLowerCase()) === -1) {
                return false;
            }
        }
        
        // Tag filter (AND logic)
        if (activeTags.length > 0) {
            var scriptTags = getScriptSetting(script.name, 'tags') || [];
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
    
    var displayName = getScriptSetting(script.name, 'displayName') || script.name;
    var description = getScriptSetting(script.name, 'description') || '';
    var imagePath = getScriptSetting(script.name, 'imagePath') || '';
    var category = getScriptSetting(script.name, 'category') || '';
    var tags = getScriptSetting(script.name, 'tags') || [];
    
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
    if (category) {
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
    if (tags.length > 0) {
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
    if (category) {
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

// Show context menu
function showContextMenu(event, script) {
    var settingsMenuItem = document.getElementById('settingsMenuItem');
    
    settingsMenuItem.onclick = function() {
        hideContextMenu();
        showScriptSettingsDialog(script);
    };
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
}

// Hide context menu
function hideContextMenu() {
    contextMenu.style.display = 'none';
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
        document.body.removeChild(menu);
        showEditCategoryDialog(category);
    };
    
    var deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = '删除';
    deleteItem.onclick = function() {
        document.body.removeChild(menu);
        deleteCategory(category);
    };
    
    menu.appendChild(editItem);
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    setTimeout(function() {
        document.addEventListener('click', function removeMenu() {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
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
        
        var deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-tag';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            deleteTag(tag);
        };
        
        tagButton.appendChild(tagText);
        tagButton.appendChild(deleteBtn);
        
        tagButton.onclick = function() {
            toggleTag(tag);
        };
        
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
    populateScriptList();
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
function getScriptSetting(scriptName, key) {
    if (scriptSettings[scriptName] && scriptSettings[scriptName][key] !== undefined) {
        return scriptSettings[scriptName][key];
    }
    return null;
}

// Set script setting
function setScriptSetting(scriptName, key, value) {
    if (!scriptSettings[scriptName]) {
        scriptSettings[scriptName] = {};
    }
    scriptSettings[scriptName][key] = value;
}

// Save settings using DataManager
function saveSettings() {
    // Get current sidebar width
    var sidebar = document.getElementById('sidebar');
    var currentSidebarWidth = sidebar ? (parseInt(sidebar.style.width) || 100) : 100;
    
    var settings = {
        version: "1.0",
        scriptsFolderPath: scriptsFolderPath,
        scriptSettings: scriptSettings,
        categories: categories,
        allTags: allTags,
        layoutSettings: {
            isGridLayout: isGridLayout,
            currentScale: currentScale,
            sidebarWidth: currentSidebarWidth
        },
        theme: currentTheme
    };
    
    // Add clipboard import settings
    settings = saveClipboardImportSettings(settings);
    
    // Use DataManager for better persistence
    if (typeof DataManager !== 'undefined' && DataManager.saveData && DataManager.initialized) {
        DataManager.saveData(settings, function(error, success) {
            if (error) {
                console.error('设置保存失败:', error);
                // Fallback to legacy method
                var settingsStr = JSON.stringify(settings).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                csInterface.evalScript('saveSettings(\'' + settingsStr + '\')');
            } else {
                console.log('设置保存成功');
            }
        });
    } else {
        // Fallback to legacy method
        var settingsStr = JSON.stringify(settings).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
                scriptSettings = settings.scriptSettings || {};
                categories = settings.categories || ['全部'];
                allTags = settings.allTags || [];
                
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
                }
                
                // Load clipboard import settings
                loadClipboardImportSettings(settings);
                
                // Ensure "全部" category always exists
                if (categories.indexOf('全部') === -1) {
                    categories.unshift('全部');
                }
                
                // Update UI after loading
                if (scriptsFolderPath) {
                    folderPathDisplay.textContent = scriptsFolderPath;
                    populateScriptList();
                }
                populateCategoryList();
                populateTagsPanel();
                
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

// Legacy settings loading function
function loadSettingsLegacy() {
    csInterface.evalScript('loadSettings()', function(result) {
        if (result && result !== 'null' && result !== 'undefined') {
            try {
                var settings = JSON.parse(result);
                scriptsFolderPath = settings.scriptsFolderPath || null;
                scriptSettings = settings.scriptSettings || {};
                categories = settings.categories || ['全部'];
                allTags = settings.allTags || [];
                
                // Load theme settings
                if (settings.theme) {
                    currentTheme = settings.theme;
                }
                
                if (categories.indexOf('全部') === -1) {
                    categories.unshift('全部');
                }
                
                if (scriptsFolderPath) {
                    folderPathDisplay.textContent = scriptsFolderPath;
                    populateScriptList();
                }
                populateCategoryList();
                populateTagsPanel();
            } catch (e) {
                console.error('Error loading settings:', e);
            }
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
    var displayName = getScriptSetting(script.name, 'displayName') || script.name;
    var description = getScriptSetting(script.name, 'description') || '';
    var imagePath = getScriptSetting(script.name, 'imagePath') || '';
    var category = getScriptSetting(script.name, 'category') || '';
    var scriptTags = getScriptSetting(script.name, 'tags') || [];
    
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
            <button class="btn" onclick="saveScriptSettings('${script.name}')">保存</button>
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
function saveScriptSettings(scriptName) {
    var displayName = document.getElementById('scriptDisplayName').value.trim();
    var description = document.getElementById('scriptDescription').value.trim();
    var imagePath = document.getElementById('scriptImagePath').value.trim();
    var category = document.getElementById('scriptCategory').value;
    
    var selectedTags = [];
    var activeButtons = document.querySelectorAll('#scriptTagsContainer .tag-button.active');
    activeButtons.forEach(function(button) {
        selectedTags.push(button.getAttribute('data-tag'));
    });
    
    setScriptSetting(scriptName, 'displayName', displayName);
    setScriptSetting(scriptName, 'description', description);
    setScriptSetting(scriptName, 'imagePath', imagePath);
    setScriptSetting(scriptName, 'category', category);
    setScriptSetting(scriptName, 'tags', selectedTags);
    
    saveSettings();
    populateScriptList();
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
        
        // Add transitioning class for smooth animation
        scriptList.classList.add('grid-transitioning');
        
        // Use CSS Grid for perfect alignment
        scriptList.style.display = 'grid';
        scriptList.style.gridTemplateColumns = 'repeat(' + itemsPerRow + ', ' + scaledItemWidth + 'px)';
        scriptList.style.gridTemplateRows = 'repeat(auto-fit, ' + scaledItemHeight + 'px)';
        scriptList.style.gap = minGap + 'px';
        scriptList.style.justifyContent = 'start';
        scriptList.style.alignContent = 'start';
        scriptList.style.justifyItems = 'start';
        scriptList.style.alignItems = 'start';
        
        // Remove transitioning class after animation completes
        setTimeout(function() {
            scriptList.classList.remove('grid-transitioning');
        }, 400);
        
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
        }
    });
    
    scriptList.addEventListener('drop', function(e) {
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
                
                // Clean up all drag states
                var allItems = scriptList.querySelectorAll('.script-item');
                allItems.forEach(function(item) {
                    item.classList.remove('drag-over', 'drag-shifting');
                });
            }
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
            
            // 获取当前背景设置（直接从数据中获取，而不是从DOM中提取）
            var currentBackgroundData = data.backgroundSettings || null;
            
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
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var importData = JSON.parse(e.target.result);
                
                // 验证导入数据格式
                if (!importData.version || !importData.scriptSettings) {
                    showCustomAlert('导入文件格式无效', true);
                    return;
                }
                
                // 确认导入
                showCustomConfirm('导入设置将覆盖当前的分类、标签和布局设置，是否继续？', function() {
                    // 确认导入
                    if (typeof DataManager !== 'undefined' && DataManager.initialized) {
                        DataManager.loadData(function(loadError, currentData) {
                            if (loadError) {
                                showCustomAlert('加载当前数据失败: ' + loadError, true);
                                return;
                            }
                            
                            // 获取导入文件的目录路径
                            var importFilePath = file.path || file.webkitRelativePath || '';
                            var importDir = '';
                            if (importFilePath) {
                                // 从文件路径中提取目录路径
                                var lastSlash = Math.max(importFilePath.lastIndexOf('/'), importFilePath.lastIndexOf('\\'));
                                if (lastSlash > -1) {
                                    importDir = importFilePath.substring(0, lastSlash);
                                }
                            }
                            
                            // 处理脚本设置中的图片路径
                            var processedScriptSettings = {};
                            for (var scriptName in importData.scriptSettings) {
                                var setting = JSON.parse(JSON.stringify(importData.scriptSettings[scriptName]));
                                
                                // 如果有图片路径且是相对路径，转换为绝对路径
                                if (setting.imagePath && setting.imagePath.indexOf('./images/') === 0 && importDir) {
                                    var imageName = setting.imagePath.replace('./images/', '');
                                    setting.imagePath = importDir + '/images/' + imageName;
                                }
                                
                                processedScriptSettings[scriptName] = setting;
                            }
                            
                            // 处理背景设置中的图片路径
                            var processedBackgroundSettings = null;
                            if (importData.backgroundSettings) {
                                processedBackgroundSettings = JSON.parse(JSON.stringify(importData.backgroundSettings));
                                
                                // 如果有背景文件路径且是相对路径，转换为绝对路径
                                if (processedBackgroundSettings.fileData && 
                                    processedBackgroundSettings.fileData.indexOf('./backgrounds/') === 0 && 
                                    importDir) {
                                    var bgFileName = processedBackgroundSettings.fileData.replace('./backgrounds/', '');
                                    processedBackgroundSettings.fileData = importDir + '/backgrounds/' + bgFileName;
                                }
                            }
                            
                            // 设置脚本文件夹路径为导入目录下的scripts文件夹
                            var scriptsPath = importDir ? importDir + '/scripts' : currentData.scriptsFolderPath;
                            
                            // 合并数据
                            var mergedData = {
                                version: importData.version,
                                scriptsFolderPath: scriptsPath,
                                scriptSettings: processedScriptSettings,
                                categories: importData.categories || ['全部'],
                                allTags: importData.allTags || [],
                                layoutSettings: importData.layoutSettings || {
                                    isGridLayout: false,
                                    currentScale: 1,
                                    sidebarWidth: 100
                                },
                                themeSettings: importData.themeSettings || null,
                                backgroundSettings: processedBackgroundSettings || null
                            };
                            
                            DataManager.saveData(mergedData, function(saveError, success) {
                                if (saveError) {
                                    showCustomAlert('导入失败: ' + saveError, true);
                                } else {
                                    // 应用导入的主题设置
                                    if (importData.themeSettings && importData.themeSettings.theme) {
                                        currentTheme = importData.themeSettings.theme;
                                        applyTheme(currentTheme);
                                    }
                                    
                                    // 应用导入的背景设置
                                    if (processedBackgroundSettings) {
                                        setTimeout(function() {
                                            applyBackgroundToBody(processedBackgroundSettings);
                                        }, 500);
                                    }
                                    
                                    showCustomAlert('导入成功！页面将刷新以应用新设置。', false, function() {
                                         location.reload();
                                     });
                                }
                            });
                        });
                    } else {
                        showCustomAlert('数据管理器未初始化，无法导入设置', true);
                    }
                }, function() {
                    // 取消导入，不执行任何操作
                });
            } catch (e) {
                showCustomAlert('导入文件解析失败: ' + e.message, true);
            }
        }
    };
    input.click();
}

// Background setting functions
function showBackgroundModal() {
    backgroundModal.style.display = 'flex';
    // Load current background settings
    loadBackgroundSettings();
}

function hideBackgroundModal() {
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
            
            currentBackgroundFile = file;
            var reader = new FileReader();
            
            reader.onload = function(e) {
                var fileUrl = e.target.result;
                
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
            };
            
            reader.readAsDataURL(file);
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

function applyBackgroundSettings() {
    if (currentBackgroundFile) {
        // Save background file and settings
        var reader = new FileReader();
        reader.onload = function(e) {
            var backgroundData = {
                fileData: e.target.result,
                fileName: currentBackgroundFile.name,
                fileType: currentBackgroundFile.type,
                blur: backgroundSettings.blur,
                brightness: backgroundSettings.brightness
            };
            
            // Save to localStorage
            localStorage.setItem('backgroundSettings', JSON.stringify(backgroundData));
            
            // Apply to body
            applyBackgroundToBody(backgroundData);
            
            hideBackgroundModal();
        };
        reader.readAsDataURL(currentBackgroundFile);
    } else {
        // Clear background
        localStorage.removeItem('backgroundSettings');
        clearBodyBackground();
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
            
            // Update sliders
            blurSlider.value = backgroundSettings.blur;
            brightnessSlider.value = backgroundSettings.brightness;
            blurValue.textContent = backgroundSettings.blur + 'px';
            brightnessValue.textContent = backgroundSettings.brightness + '%';
            
            // Show preview
            if (backgroundData.fileData) {
                var fileType = backgroundData.fileType || '';
                var fileName = backgroundData.fileName || '';
                
                previewImage.style.display = 'none';
                previewVideo.style.display = 'none';
                
                if (fileType.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4')) {
                    previewVideo.src = backgroundData.fileData;
                    previewVideo.style.display = 'block';
                    previewVideo.loop = true;
                    previewVideo.muted = true;
                    previewVideo.play();
                } else {
                    previewImage.src = backgroundData.fileData;
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
        blurSlider.value = 0;
        brightnessSlider.value = 0;
        blurValue.textContent = '0px';
        brightnessValue.textContent = '0%';
        clearBackground();
    }
}

function applyBackgroundToBody(backgroundData) {
    var body = document.body;
    var fileType = backgroundData.fileType || '';
    var fileName = backgroundData.fileName || '';
    
    // Remove existing background elements
    var existingBg = document.getElementById('background-container');
    if (existingBg) {
        existingBg.remove();
    }
    
    // Create background container
    var bgContainer = document.createElement('div');
    bgContainer.id = 'background-container';
    bgContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        overflow: hidden;
    `;
    
    var blur = backgroundData.blur || 0;
    var brightness = backgroundData.brightness || 0;
    
    // Apply blur filter
    var blurFilter = blur > 0 ? 'blur(' + blur + 'px)' : 'none';
    
    if (fileType.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4')) {
        // Video background
        var video = document.createElement('video');
        video.src = backgroundData.fileData;
        video.loop = true;
        video.muted = true;
        video.autoplay = true;
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: ${blurFilter};
        `;
        bgContainer.appendChild(video);
    } else {
        // Image background
        var img = document.createElement('div');
        img.style.cssText = `
            width: 100%;
            height: 100%;
            background-image: url(${backgroundData.fileData});
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            filter: ${blurFilter};
        `;
        bgContainer.appendChild(img);
    }
    
    // Add brightness overlay
    if (brightness !== 0) {
        var overlay = document.createElement('div');
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
        
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(${overlayColor}, ${overlayOpacity});
            pointer-events: none;
        `;
        bgContainer.appendChild(overlay);
    }
    
    body.insertBefore(bgContainer, body.firstChild);
    
    // Add has-background class to body
    body.classList.add('has-background');
}

function clearBodyBackground() {
    var existingBg = document.getElementById('background-container');
    if (existingBg) {
        existingBg.remove();
    }
    
    // Remove has-background class from body
    document.body.classList.remove('has-background');
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

// Process clipboard image
function processClipboardImage(blob) {
    console.log('开始处理剪贴板图片，大小: ' + blob.size + ' bytes');
    
    // Convert blob to base64
    var reader = new FileReader();
    reader.onload = function(e) {
        var base64Data = e.target.result;
        
        // Extract base64 string without data URL prefix
        var base64String = base64Data.split(',')[1];
        
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
        
        // Escape base64 string for safe transmission
        var escapedBase64 = base64String.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                       .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        
        // Escape custom path if needed
        var escapedCustomPath = customLocationPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                                                  .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
        
        // Show progress indicator
        var progressDiv = document.createElement('div');
        progressDiv.id = 'importProgress';
        progressDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
        progressDiv.innerHTML = '正在导入图片，请稍候...<br><div style="width: 200px; height: 4px; background: #333; margin-top: 10px; border-radius: 2px;"><div id="progressBar" style="width: 0%; height: 100%; background: #4CAF50; border-radius: 2px; transition: width 0.3s;"></div></div>';
        document.body.appendChild(progressDiv);
        
        // Animate progress bar with slower updates
        var progressBar = document.getElementById('progressBar');
        var progress = 0;
        var progressInterval = setInterval(function() {
            progress += 1;
            if (progress <= 85) {
                progressBar.style.width = progress + '%';
            }
        }, 200); // Slower progress updates
        
        // Call AE script to import image with timeout handling
        var scriptCall = "importClipboardImage('" + escapedBase64 + "', '" + saveLocation + "', '" + escapedCustomPath + "')";
        
        console.log('调用AE脚本导入图片，保存位置: ' + saveLocation);
        
        // Set a longer timeout for large images
        var timeoutId = setTimeout(function() {
            clearInterval(progressInterval);
            if (document.body.contains(progressDiv)) {
                document.body.removeChild(progressDiv);
            }
            console.log('导入操作超时');
            // Don't show alert immediately, let the script finish if it's still running
        }, 60000); // 60 second timeout
        
        csInterface.evalScript(scriptCall, function(result) {
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
            
            // Complete progress bar
            progressBar.style.width = '100%';
            
            console.log('AE脚本返回结果: ' + result);
            
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
        showCustomAlert('读取剪贴板图片失败', true);
    };
    
    reader.readAsDataURL(blob);
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
    settingsModal.style.display = 'none';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);