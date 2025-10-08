/*
 * 全局概述：
 * 本段代码为 ExtendScript 环境提供 JSON polyfill，确保在缺失或不完整的 JSON 对象时，
 * JSON.stringify 与 JSON.parse 依然可用，避免 CEP evalScript 调用出现“返回空结果”的问题。
 * 该 polyfill 仅覆盖常用场景（对象、数组、字符串、数字、布尔、null），
 * 并提供基础的循环引用防护与错误处理。
 */

/**
 * 安全的字符串转义函数，用于 JSON 序列化
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 已按 JSON 要求转义的字符串（不包含外层引号）
 */
function __jsonEscapeString__(str) {
    // ExtendScript 为 ES3 级别，不支持复杂特性，这里使用最基础的替换
    return String(str)
        .replace(/\\/g, "\\\\")
        .replace(/\"/g, "\\\"")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

/**
 * 轻量版 JSON.stringify 实现
 * - 支持：Object、Array、String、Number、Boolean、null
 * - 特性：基础循环引用检测（遇到循环时以 null 代替）
 * @param {*} value - 需要序列化的值
 * @returns {string} - JSON 字符串
 */
function __safeJSONStringify__(value) {
    var stack = [];

    function serialize(val) {
        var type = typeof val;

        if (val === null) return "null";
        if (type === "string") return '"' + __jsonEscapeString__(val) + '"';
        if (type === "number") return isFinite(val) ? String(val) : "null";
        if (type === "boolean") return val ? "true" : "false";

        // 对象与数组
        if (type === "object") {
            // 循环引用防护
            for (var i = 0; i < stack.length; i++) {
                if (stack[i] === val) {
                    return "null"; // 避免抛错，直接以 null 代替
                }
            }
            stack.push(val);

            if (val instanceof Array) {
                var arr = [];
                for (var j = 0; j < val.length; j++) {
                    arr.push(serialize(val[j]));
                }
                stack.pop();
                return "[" + arr.join(",") + "]";
            }

            // 纯对象：仅序列化可枚举自有属性
            var props = [];
            for (var key in val) {
                if (val.hasOwnProperty && !val.hasOwnProperty(key)) continue;
                var v = serialize(val[key]);
                if (typeof v !== "undefined") {
                    props.push('"' + __jsonEscapeString__(key) + '"' + ":" + v);
                }
            }
            stack.pop();
            return "{" + props.join(",") + "}";
        }

        // 其他类型（如 undefined、function、xml、File/Folder 等），JSON 规范中会被忽略或转为 null
        return undefined;
    }

    return serialize(value);
}

/**
 * 轻量版 JSON.parse 实现
 * - 使用 ExtendScript 的 eval 作为兜底解析器，外层增加括号防止语法歧义
 * - 仅在原生 JSON.parse 不存在或不可用时启用
 * @param {string} text - JSON 字符串
 * @returns {*} - 解析后的值
 */
function __safeJSONParse__(text) {
    if (typeof text !== "string") {
        throw new Error("JSON.parse 输入必须为字符串");
    }
    // 基础健壮性：去除 BOM 与首尾空白
    var s = text.replace(/^\uFEFF/, "");
    // 注意：使用 eval 解析的前提是文本来自可信任的 ExtendScript 内部序列化结果
    return eval("(" + s + ")");
}

// 挂载 polyfill（仅在 JSON 不可用或不完整时生效）
try {
    if (typeof JSON === "undefined" || !JSON || !JSON.stringify || !JSON.parse) {
        // 若宿主不存在 JSON 或接口不全，则创建并挂载
        var __JSON__ = (typeof JSON === "object") ? JSON : {};
        if (!__JSON__.stringify) __JSON__.stringify = __safeJSONStringify__;
        if (!__JSON__.parse) __JSON__.parse = __safeJSONParse__;
        JSON = __JSON__;
        try { $.writeln("[JSON polyfill] 已启用: 使用内置轻量实现"); } catch (logErr) {}
    } else {
        try { $.writeln("[JSON polyfill] 原生 JSON 可用，无需启用 polyfill"); } catch (logOk) {}
    }
} catch (polyErr) {
    // 即使 polyfill 失败，也不应阻断脚本执行
    try { $.writeln("[JSON polyfill] 启用失败: " + polyErr); } catch (logErr2) {}
}

// Run script file
function runScript(scriptPath) {
    try {
        var file = new File(scriptPath);
        if (file.exists) {
            app.beginUndoGroup("运行脚本: " + file.displayName);
            $.evalFile(file.fsName);
            app.endUndoGroup();
            return "脚本运行成功";
        } else {
            return "错误: 脚本文件不存在";
        }
    } catch (e) {
        app.endUndoGroup();
        var errorMsg = "运行脚本失败: " + e.toString();
        if (e.line) {
            errorMsg += " (行号: " + e.line + ")";
        }
        return errorMsg;
    }
}

// Get extension data path
function getExtensionDataPath() {
    try {
        var extensionFolder = new File($.fileName).parent.parent;
        return extensionFolder.fsName;
    } catch (e) {
        return null;
    }
}

// Save data to file with better error handling
function saveDataToFile(filePath, dataJson) {
    try {
        var dataFile = new File(filePath);
        
        // Create directory if it doesn't exist
        if (!dataFile.parent.exists) {
            dataFile.parent.create();
        }
        
        // Decode the JSON string if it was encoded
        var decodedData = decodeURIComponent(dataJson);
        
        // Write data to file with UTF-8 encoding
        dataFile.encoding = "UTF-8";
        dataFile.open("w");
        dataFile.write(decodedData);
        dataFile.close();
        
        return "success";
    } catch (e) {
        return "保存数据失败: " + e.toString();
    }
}

// Load data from file with better error handling
function loadDataFromFile(filePath) {
    try {
        var dataFile = new File(filePath);
        
        if (dataFile.exists) {
            dataFile.encoding = "UTF-8";
            dataFile.open("r");
            var content = dataFile.read();
            dataFile.close();
            return content;
        } else {
            return "{}";
        }
    } catch (e) {
        return "{}";
    }
}

// Create data backup
function createDataBackup(sourcePath, backupPath) {
    try {
        var sourceFile = new File(sourcePath);
        var backupFile = new File(backupPath);
        
        if (sourceFile.exists) {
            sourceFile.copy(backupFile);
            return "success";
        } else {
            return "源文件不存在";
        }
    } catch (e) {
        return "备份失败: " + e.toString();
    }
}

/**
 * CEP 首选项读写包装
 * 注意：值以字符串存储，前端可传入 encodeURIComponent(JSON.stringify(value))
 */
function getPreference(key) {
    try {
        var ns = "MOGU_Settings";
        if (app && app.settings && app.settings.haveSetting(ns, key)) {
            return app.settings.getSetting(ns, key);
        }
        return "";
    } catch (e) {
        return "";
    }
}

function setPreference(key, valueEncoded) {
    try {
        var ns = "MOGU_Settings";
        var val = decodeURIComponent(valueEncoded);
        if (app && app.settings) {
            app.settings.saveSetting(ns, key, val);
            return "success";
        }
        return "Error: AE settings 不可用";
    } catch (e) {
        return "Error:" + e.toString();
    }
}

/**
 * 将 AE 前台激活，确保键盘事件（如 Ctrl+Z）由 AE 接收
 * 返回：'ok' 或 'Error:...'
 */
function bringAEToFront() {
    try {
        app.activate();
        return "ok";
    } catch (e) {
        return "Error:" + e.toString();
    }
}

/**
 * 执行 AE 撤销命令（Undo）
 * - 前置 AE 窗口，确保后续键盘事件归 AE
 * - 使用菜单命令执行撤销（常用ID：16），不同版本如有异常将返回 Error
 */
function performAeUndo() {
    try {
        app.activate();
        // 撤销命令ID：16（AE 菜单命令）
        app.executeCommand(16);
        return "ok";
    } catch (e) {
        return "Error:" + e.toString();
    }
}

/**
 * 执行 AE 重做命令（Redo）
 * - 前置 AE 窗口
 * - 使用菜单命令执行重做（常用ID：17）
 */
function performAeRedo() {
    try {
        app.activate();
        // 重做命令ID：17（AE 菜单命令）
        app.executeCommand(17);
        return "ok";
    } catch (e) {
        return "Error:" + e.toString();
    }
}

// Legacy functions for backward compatibility
function saveSettings(settingsJson) {
    try {
        var settings = JSON.parse(settingsJson);
        var success = false;
        
        // 1) 优先保存到 DataManager 的主数据文件（与 CEP 前端一致）
        try {
            var extensionFolder = new File($.fileName).parent.parent;
            var dataFolder = new Folder(extensionFolder.fsName + "/data");
            if (!dataFolder.exists) dataFolder.create();
            
            var dataFile = new File(dataFolder.fsName + "/moguBar_data.json");
            var data = {};
            
            // 如果数据文件已存在，先读取现有数据
            if (dataFile.exists) {
                try {
                    dataFile.open("r");
                    var existingContent = dataFile.read();
                    dataFile.close();
                    data = JSON.parse(existingContent);
                } catch (eRead) {
                    data = {}; // 读取失败时使用空对象
                }
            }
            
            // 更新数据文件中的设置
            if (settings.scriptsFolderPath !== undefined) data.scriptsFolderPath = settings.scriptsFolderPath;
            if (settings.autoReadSubfolders !== undefined) data.autoReadSubfolders = settings.autoReadSubfolders;
            if (settings.presetFolderPath !== undefined) data.presetFolderPath = settings.presetFolderPath;
            if (settings.presetsFolderPath !== undefined) data.presetsFolderPath = settings.presetsFolderPath;

            // 新增：图片保存位置与自定义路径（clipboardImport）
            try {
                if (!data.clipboardImport) data.clipboardImport = {};
                if (settings.imageSaveLocation !== undefined) {
                    data.clipboardImport.saveLocation = settings.imageSaveLocation;
                }
                if (settings.imageCustomPath !== undefined) {
                    // 兼容中文路径，保持原样，不做 URL 编码存储
                    data.clipboardImport.customPath = settings.imageCustomPath;
                }
            } catch (_) {}
            
            // 确保 userSettings 对象存在
            if (!data.userSettings) data.userSettings = {};
            if (settings.presetFolderPath !== undefined) {
                data.userSettings.presetFolderPath = settings.presetFolderPath;
            }
            // 同步保存到 userSettings.clipboardImport（供前端快速读取）
            try {
                if (!data.userSettings.clipboardImport) data.userSettings.clipboardImport = {};
                if (settings.imageSaveLocation !== undefined) {
                    data.userSettings.clipboardImport.saveLocation = settings.imageSaveLocation;
                }
                if (settings.imageCustomPath !== undefined) {
                    data.userSettings.clipboardImport.customPath = settings.imageCustomPath;
                }
            } catch (_) {}
            
            // 更新时间戳
            data.lastSaved = new Date().toISOString();
            
            // 写入数据文件
            dataFile.open("w");
            dataFile.write(JSON.stringify(data, null, 2));
            dataFile.close();
            success = true;
        } catch (eData) {
            // 数据文件保存失败，继续尝试其他方式
        }
        
        // 2) 保存预设路径到 AE 首选项（参考 jsx 脚本的做法）
        try {
            if (settings.presetFolderPath && app && app.settings) {
                app.settings.saveSetting("MOGU_PresetManager", "libraryPath", settings.presetFolderPath);
                success = true;
            }
            // 新增：图片保存位置与自定义路径保存到 CEP 首选项（便于跨会话持久化）
            try {
                if (settings.imageSaveLocation !== undefined) {
                    var v1 = encodeURIComponent(JSON.stringify(settings.imageSaveLocation));
                    setPreference("mogu_image_save_path", v1);
                }
                if (settings.imageCustomPath !== undefined) {
                    var v2 = encodeURIComponent(JSON.stringify(settings.imageCustomPath));
                    setPreference("mogu_image_custom_path", v2);
                }
            } catch (_) {}
        } catch (ePrefs) {
            // AE 首选项保存失败，忽略
        }
        
        // 3) 回退到原有的 settings 文件
        try {
            var extensionFolder2 = new File($.fileName).parent.parent;
            var settingsFile = new File(extensionFolder2.fsName + "/moguBar_settings.txt");
            settingsFile.open("w");
            settingsFile.write(settingsJson);
            settingsFile.close();
            success = true;
        } catch (eOld) {
            // 旧设置文件保存失败
        }
        
        return success ? "设置保存成功" : "保存设置失败";
    } catch (e) {
        return "保存设置失败: " + e.toString();
    }
}

function loadSettings() {
    try {
        var settings = {};
        
        // 1) 优先从 DataManager 的主数据文件读取（与 CEP 前端一致）
        try {
            var extensionFolder = new File($.fileName).parent.parent;
            var dataFile = new File(extensionFolder.fsName + "/data/moguBar_data.json");
            if (dataFile.exists) {
                dataFile.open("r");
                var dataContent = dataFile.read();
                dataFile.close();
                var data = JSON.parse(dataContent);
                if (data) {
                    // 映射主要设置字段
                    if (data.scriptsFolderPath) settings.scriptsFolderPath = data.scriptsFolderPath;
                    if (data.autoReadSubfolders !== undefined) settings.autoReadSubfolders = data.autoReadSubfolders;
                    // 关键：预设路径的多种可能键名
                    if (data.presetFolderPath) settings.presetFolderPath = data.presetFolderPath;
                    if (data.presetsFolderPath) settings.presetsFolderPath = data.presetsFolderPath;
                    // 从用户设置中读取预设路径
                    if (data.userSettings && data.userSettings.presetFolderPath) {
                        settings.presetFolderPath = data.userSettings.presetFolderPath;
                    }

                    // 新增：读取 clipboardImport（图片保存位置与自定义路径）
                    try {
                        if (data.clipboardImport) {
                            if (data.clipboardImport.saveLocation) {
                                settings.imageSaveLocation = data.clipboardImport.saveLocation;
                            }
                            if (data.clipboardImport.customPath) {
                                settings.imageCustomPath = data.clipboardImport.customPath;
                            }
                        }
                        if (data.userSettings && data.userSettings.clipboardImport) {
                            if (settings.imageSaveLocation === undefined && data.userSettings.clipboardImport.saveLocation) {
                                settings.imageSaveLocation = data.userSettings.clipboardImport.saveLocation;
                            }
                            if (settings.imageCustomPath === undefined && data.userSettings.clipboardImport.customPath) {
                                settings.imageCustomPath = data.userSettings.clipboardImport.customPath;
                            }
                        }
                    } catch (_) {}
                }
            }
        } catch (eData) {
            // 数据文件读取失败，继续尝试其他来源
        }
        
        // 2) 回退到原有的 settings 文件
        try {
            var extensionFolder2 = new File($.fileName).parent.parent;
            var settingsFile = new File(extensionFolder2.fsName + "/moguBar_settings.txt");
            if (settingsFile.exists) {
                settingsFile.open("r");
                var content = settingsFile.read();
                settingsFile.close();
                var oldSettings = JSON.parse(content);
                if (oldSettings) {
                    // 合并旧设置，但不覆盖已有的新设置
                    for (var key in oldSettings) {
                        if (!settings.hasOwnProperty(key)) {
                            settings[key] = oldSettings[key];
                        }
                    }
                }
            }
        } catch (eOld) {
            // 旧设置文件读取失败，忽略
        }
        
        // 3) 从 AE 首选项读取预设路径（参考 jsx 脚本的做法）
        try {
            if (app && app.settings && app.settings.haveSetting("MOGU_PresetManager", "libraryPath")) {
                var prefPath = app.settings.getSetting("MOGU_PresetManager", "libraryPath");
                if (prefPath && prefPath.length && !settings.presetFolderPath) {
                    settings.presetFolderPath = prefPath;
                }
            }
            // 新增：从 CEP 首选项读取图片保存位置与自定义路径
            try {
                var v1 = getPreference("mogu_image_save_path");
                if (v1) {
                    try { settings.imageSaveLocation = JSON.parse(v1); } catch (_) {}
                }
                var v2 = getPreference("mogu_image_custom_path");
                if (v2) {
                    try { settings.imageCustomPath = JSON.parse(v2); } catch (_) {}
                }
            } catch (_) {}
        } catch (ePrefs) {
            // AE 首选项读取失败，忽略
        }
        
        return JSON.stringify(settings);
    } catch (e) {
        return "{}";
    }
}

// Get script file information
function getScriptInfo(scriptPath) {
    try {
        var file = new File(scriptPath);
        if (file.exists) {
            return JSON.stringify({
                name: file.displayName,
                path: file.fsName,
                size: file.length,
                modified: file.modified.toString(),
                exists: true
            });
        } else {
            return JSON.stringify({
                exists: false,
                error: "文件不存在"
            });
        }
    } catch (e) {
        return JSON.stringify({
            exists: false,
            error: e.toString()
        });
    }
}

// Check if file exists
function fileExists(filePath) {
    try {
        var file = new File(filePath);
        return file.exists;
    } catch (e) {
        return false;
    }
}

// Get After Effects version info
function getAEVersionInfo() {
    try {
        var versionString = app.version;
        var majorVersion = parseInt(versionString.split('.')[0]);
        
        return JSON.stringify({
            version: versionString,
            buildNumber: app.buildNumber,
            majorVersion: majorVersion,
            language: app.isoLanguage,
            isLegacyVersion: majorVersion < 24 // AE2024及以上为新版本
        });
    } catch (e) {
        return JSON.stringify({
            error: e.toString(),
            version: "unknown",
            majorVersion: 0,
            isLegacyVersion: true
        });
    }
}

function getAEInfo() {
    try {
        return JSON.stringify({
            version: app.version,
            buildNumber: app.buildNumber,
            language: app.isoLanguage
        });
    } catch (e) {
        return JSON.stringify({
            error: e.toString()
        });
    }
}

// Utility function to escape JSON strings
function escapeJsonString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
}

// Get file path and validate file existence
function getFilePath(filePath) {
    try {
        var file = new File(filePath);
        if (!file.exists) {
            return "Error:文件不存在";
        }
        
        // Return the absolute file path
        return file.fsName;
    } catch (e) {
        return "Error:" + e.toString();
    }
}

/**
 * [预设文件夹管理-创建文件夹]+[功能名称]+[详细描述] 在预设根目录下创建新的分类文件夹
 * @param {String} folderPath - 要创建的文件夹完整路径
 * @returns {String} 成功返回空字符串，失败返回"Error: 错误信息"
 */
function createPresetFolder(folderPath) {
    try {
        if (!folderPath || typeof folderPath !== 'string') {
            return 'Error: 无效的文件夹路径';
        }
        
        // [预设文件夹管理-创建文件夹]+[步骤]+[1] 解码路径，处理中文和特殊字符
        var decoded = folderPath;
        try {
            decoded = decodeURIComponent(folderPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
        }
        
        // [预设文件夹管理-创建文件夹]+[步骤]+[2] 创建文件夹对象
        var folder = new Folder(decoded);
        
        // [预设文件夹管理-创建文件夹]+[步骤]+[3] 检查文件夹是否已存在
        if (folder.exists) {
            return 'Error: 文件夹已存在';
        }
        
        // [预设文件夹管理-创建文件夹]+[步骤]+[4] 创建文件夹
        var success = folder.create();
        if (!success) {
            return 'Error: 文件夹创建失败，请检查路径和权限';
        }
        
        // [预设文件夹管理-创建文件夹]+[步骤]+[5] 验证创建结果
        if (!folder.exists) {
            return 'Error: 文件夹创建后验证失败';
        }
        
        return ''; // 成功
        
    } catch (e) {
        return 'Error: ' + e.toString();
    }
}

/**
 * [预设文件夹管理-删除文件夹]+[功能名称]+[详细描述] 删除预设分类文件夹及其内容
 * @param {String} folderPath - 要删除的文件夹完整路径
 * @returns {String} 成功返回空字符串，失败返回"Error: 错误信息"
 */
function deletePresetFolder(folderPath) {
    try {
        if (!folderPath || typeof folderPath !== 'string') {
            return 'Error: 无效的文件夹路径';
        }
        
        // [预设文件夹管理-删除文件夹]+[步骤]+[1] 解码路径，处理中文和特殊字符
        var decoded = folderPath;
        try {
            decoded = decodeURIComponent(folderPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
        }
        
        // [预设文件夹管理-删除文件夹]+[步骤]+[2] 创建文件夹对象
        var folder = new Folder(decoded);
        
        // [预设文件夹管理-删除文件夹]+[步骤]+[3] 检查文件夹是否存在
        if (!folder.exists) {
            return 'Error: 文件夹不存在';
        }
        
        // [预设文件夹管理-删除文件夹]+[步骤]+[4] 递归删除文件夹内容
        var success = deleteFolderRecursive(folder);
        if (!success) {
            return 'Error: 文件夹删除失败，请检查权限或文件是否被占用';
        }
        
        return ''; // 成功
        
    } catch (e) {
        return 'Error: ' + e.toString();
    }
}

/**
 * [预设文件夹管理-递归删除]+[功能名称]+[详细描述] 递归删除文件夹及其所有内容
 * @param {Folder} folder - 要删除的文件夹对象
 * @returns {Boolean} 删除成功返回true，失败返回false
 */
function deleteFolderRecursive(folder) {
    try {
        if (!folder || !folder.exists) {
            return true; // 文件夹不存在，视为删除成功
        }
        
        // [预设文件夹管理-递归删除]+[步骤]+[1] 获取文件夹内容
        var items = folder.getFiles();
        
        // [预设文件夹管理-递归删除]+[步骤]+[2] 递归删除所有子项
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            
            if (item instanceof Folder) {
                // [预设文件夹管理-递归删除]+[步骤]+[2-1] 递归删除子文件夹
                if (!deleteFolderRecursive(item)) {
                    return false;
                }
            } else if (item instanceof File) {
                // [预设文件夹管理-递归删除]+[步骤]+[2-2] 删除文件
                if (!item.remove()) {
                    return false;
                }
            }
        }
        
        // [预设文件夹管理-递归删除]+[步骤]+[3] 删除空文件夹
        return folder.remove();
        
    } catch (e) {
        return false;
    }
}

// Test function to verify ExtendScript communication
function testConnection() {
    return "ExtendScript连接成功 - " + new Date().toString();
}

/**
 * [预设文件夹管理-安全删除]+[功能名称]+[详细描述] 安全删除预设分类文件夹（先移动文件再删除文件夹）
 * @param {String} folderPath - 要删除的文件夹完整路径
 * @param {String} rootPath - 预设根目录路径
 * @returns {String} 成功返回空字符串，失败返回"Error: 错误信息"
 */
function deletePresetFolderSafely(folderPath, rootPath) {
    try {
        if (!folderPath || typeof folderPath !== 'string') {
            return 'Error: 无效的文件夹路径';
        }
        
        if (!rootPath || typeof rootPath !== 'string') {
            return 'Error: 无效的根目录路径';
        }
        
        // [预设文件夹管理-安全删除]+[步骤]+[1] 解码路径
        var decodedFolderPath = folderPath;
        var decodedRootPath = rootPath;
        try {
            decodedFolderPath = decodeURIComponent(folderPath);
            decodedRootPath = decodeURIComponent(rootPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
        }
        
        // [预设文件夹管理-安全删除]+[步骤]+[2] 创建文件夹对象
        var folder = new Folder(decodedFolderPath);
        var rootFolder = new Folder(decodedRootPath);
        
        // [预设文件夹管理-安全删除]+[步骤]+[3] 检查文件夹是否存在
        if (!folder.exists) {
            return 'Error: 文件夹不存在';
        }
        
        if (!rootFolder.exists) {
            return 'Error: 根目录不存在';
        }
        
        // [预设文件夹管理-安全删除]+[步骤]+[4] 移动文件夹中的所有预设文件到根目录
        var files = folder.getFiles("*.ffx");
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file instanceof File) {
                var targetPath = rootFolder.fsName + "/" + file.name;
                var targetFile = new File(targetPath);
                
                // 如果目标文件已存在，生成新名称
                var counter = 1;
                while (targetFile.exists) {
                    var baseName = file.name.replace(/\.ffx$/i, '');
                    var newName = baseName + '_' + counter + '.ffx';
                    targetPath = rootFolder.fsName + "/" + newName;
                    targetFile = new File(targetPath);
                    counter++;
                }
                
                // 移动文件
                if (!file.copy(targetFile)) {
                    return 'Error: 无法移动预设文件 ' + file.name;
                }
                
                // 删除原文件
                file.remove();
            }
        }
        
        // [预设文件夹管理-安全删除]+[步骤]+[5] 删除空文件夹
        var success = folder.remove();
        if (!success) {
            return 'Error: 文件夹删除失败，请检查权限';
        }
        
        return ''; // 成功
        
    } catch (e) {
        return 'Error: ' + e.toString();
    }
}

/**
 * [预设文件夹管理-重命名文件夹]+[功能名称]+[详细描述] 重命名预设分类文件夹
 * @param {String} oldPath - 原文件夹完整路径
 * @param {String} newPath - 新文件夹完整路径
 * @returns {String} 成功返回空字符串，失败返回"Error: 错误信息"
 */
function renamePresetFolder(oldPath, newPath) {
    try {
        if (!oldPath || typeof oldPath !== 'string') {
            return 'Error: 无效的原文件夹路径';
        }
        
        if (!newPath || typeof newPath !== 'string') {
            return 'Error: 无效的新文件夹路径';
        }
        
        // [预设文件夹管理-重命名文件夹]+[步骤]+[1] 解码路径
        var decodedOldPath = oldPath;
        var decodedNewPath = newPath;
        try {
            decodedOldPath = decodeURIComponent(oldPath);
            decodedNewPath = decodeURIComponent(newPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
        }
        
        // [预设文件夹管理-重命名文件夹]+[步骤]+[2] 创建文件夹对象
        var oldFolder = new Folder(decodedOldPath);
        var newFolder = new Folder(decodedNewPath);
        
        // [预设文件夹管理-重命名文件夹]+[步骤]+[3] 检查原文件夹是否存在
        if (!oldFolder.exists) {
            return 'Error: 原文件夹不存在';
        }
        
        // [预设文件夹管理-重命名文件夹]+[步骤]+[4] 检查新文件夹是否已存在
        if (newFolder.exists) {
            return 'Error: 目标文件夹已存在';
        }
        
        // [预设文件夹管理-重命名文件夹]+[步骤]+[5] 重命名文件夹
        var success = oldFolder.rename(newFolder.name);
        if (!success) {
            return 'Error: 文件夹重命名失败，请检查权限';
        }
        
        return ''; // 成功
        
    } catch (e) {
        return 'Error: ' + e.toString();
    }
}

/**
 * [预设文件管理-移动到分类]+[功能名称]+[详细描述] 移动预设文件到指定分类文件夹
 * @param {String} presetPath - 预设文件完整路径
 * @param {String} targetFolderPath - 目标分类文件夹路径
 * @returns {String} 成功返回空字符串，失败返回"Error: 错误信息"
 */
function movePresetToCategory(presetPath, targetFolderPath) {
    try {
        if (!presetPath || typeof presetPath !== 'string') {
            return 'Error: 无效的预设文件路径';
        }
        
        if (!targetFolderPath || typeof targetFolderPath !== 'string') {
            return 'Error: 无效的目标文件夹路径';
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[1] 解码路径
        var decodedPresetPath = presetPath;
        var decodedTargetPath = targetFolderPath;
        try {
            decodedPresetPath = decodeURIComponent(presetPath);
            decodedTargetPath = decodeURIComponent(targetFolderPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[2] 创建文件和文件夹对象
        var presetFile = new File(decodedPresetPath);
        var targetFolder = new Folder(decodedTargetPath);
        
        // [预设文件管理-移动到分类]+[步骤]+[3] 检查预设文件是否存在
        if (!presetFile.exists) {
            return 'Error: 预设文件不存在';
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[4] 确保目标文件夹存在
        if (!targetFolder.exists) {
            if (!targetFolder.create()) {
                return 'Error: 无法创建目标文件夹';
            }
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[5] 构建目标文件路径
        var targetFilePath = targetFolder.fsName + "/" + presetFile.name;
        var targetFile = new File(targetFilePath);
        
        // [预设文件管理-移动到分类]+[步骤]+[6] 如果目标文件已存在，生成新名称
        var counter = 1;
        while (targetFile.exists) {
            var baseName = presetFile.name.replace(/\.ffx$/i, '');
            var extension = presetFile.name.match(/\.ffx$/i) ? presetFile.name.match(/\.ffx$/i)[0] : '.ffx';
            var newName = baseName + '_' + counter + extension;
            targetFilePath = targetFolder.fsName + "/" + newName;
            targetFile = new File(targetFilePath);
            counter++;
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[7] 复制文件到目标位置
        if (!presetFile.copy(targetFile)) {
            return 'Error: 无法复制预设文件到目标位置';
        }
        
        // [预设文件管理-移动到分类]+[步骤]+[8] 删除原文件
        if (!presetFile.remove()) {
            // 如果删除原文件失败，尝试删除已复制的文件以保持一致性
            targetFile.remove();
            return 'Error: 无法删除原预设文件';
        }
        
        return ''; // 成功
        
    } catch (e) {
        return 'Error: ' + e.toString();
    }
}

// Get system info
function getSystemInfo() {
    try {
        return JSON.stringify({
            os: $.os,
            version: $.version,
            buildDate: $.buildDate,
            locale: $.locale
        });
    } catch (e) {
        return JSON.stringify({
            error: e.toString()
        });
    }
}

// Clear all settings (for debugging)
function clearAllSettings() {
    try {
        app.settings.saveSetting(SCRIPT_NAME, SCRIPTS_PATH_KEY, "");
        app.settings.saveSetting(SCRIPT_NAME, SCRIPT_SETTINGS_KEY, "");
        app.settings.saveSetting(SCRIPT_NAME, CATEGORIES_KEY, "");
        app.settings.saveSetting(SCRIPT_NAME, TAGS_KEY, "");
        return "所有设置已清除";
    } catch (e) {
        return "清除设置失败: " + e.toString();
    }
}

// Export settings to file
function exportSettings() {
    try {
        var settings = loadSettings();
        var file = File.saveDialog("导出设置", "JSON文件:*.json");
        if (file) {
            file.open("w");
            file.write(settings);
            file.close();
            return "设置导出成功: " + file.fsName;
        }
        return "导出已取消";
    } catch (e) {
        return "导出设置失败: " + e.toString();
    }
}

// Import settings from file
function importSettings() {
    try {
        var file = File.openDialog("导入设置", "JSON文件:*.json");
        if (file && file.exists) {
            file.open("r");
            var content = file.read();
            file.close();
            
            // Validate JSON
            var settings = JSON.parse(content);
            
            // 获取导入文件的目录路径 - 确保使用Windows路径分隔符
            var importDir = file.parent.fsName;
            // 确保路径使用反斜杠（Windows格式）
            importDir = importDir.replace(/\//g, '\\');
            
            // 处理脚本设置中的图片路径
            if (settings.scriptSettings) {
                for (var scriptName in settings.scriptSettings) {
                    var setting = settings.scriptSettings[scriptName];
                    
                    // 如果有图片路径且是相对路径，转换为绝对路径
                    if (setting.imagePath && setting.imagePath.indexOf('./images/') === 0) {
                        var imageName = setting.imagePath.replace('./images/', '');
                        setting.imagePath = importDir + "\\images\\" + imageName;
                    }
                }
            }
            
            // 设置脚本文件夹路径为导入目录下的scripts文件夹
            if (importDir) {
                settings.scriptsFolderPath = importDir + "\\scripts";
            }
            
            // Save processed settings
            saveSettings(JSON.stringify(settings));
            
            // 返回包含数据和文件路径的结果
            var result = {
                data: settings,
                filePath: file.fsName,
                importDir: importDir
            };
            
            var resultString = JSON.stringify(result);
            
            return resultString;
        }
        
        return null;
    } catch (e) {
        return "Error:" + e.toString();
    }
}

// Import clipboard image to After Effects with optimized performance
// Import image from URL (save to local file first, then import)
// This function is kept for backward compatibility and redirects to saveAndImportClipboardImage
function importImageFromUrl(base64Data, saveLocation, customPath, fileExtension, fileName, fileSize) {
    // 记录调试信息到控制台
    $.writeln('AE脚本importImageFromUrl开始执行（重定向到saveAndImportClipboardImage）');
    $.writeln('base64Data长度: ' + (base64Data ? base64Data.length : '未定义'));
    $.writeln('saveLocation: ' + (saveLocation || '未定义'));
    $.writeln('fileName: ' + (fileName || '未定义'));
    $.writeln('fileSize: ' + (fileSize || '未定义') + ' bytes');
    
    // Redirect to the new unified function
    return saveAndImportClipboardImage(base64Data, saveLocation, customPath, fileExtension);
}



// 新增：直接文件导入函数（不使用Base64）- 推荐方法
function importFileDirectly(filePath, saveLocation, customPath, fileExtension) {
    $.writeln('=== AE脚本importFileDirectly开始执行（无Base64方法） ===');
    
    var aeVersion = parseFloat(app.version);
    var isAE2023 = aeVersion >= 23.0 && aeVersion < 24.0;
    
    // Begin undo group
    app.beginUndoGroup("Import File Directly");
    
    try {
        // 步骤1: 检查源文件
        $.writeln('步骤1: 检查源文件');
        var sourceFile = new File(filePath);
        
        if (!sourceFile.exists) {
            app.endUndoGroup();
            return "Error:源文件不存在: " + filePath;
        }
        
        // 步骤2: 确定保存路径
        $.writeln('步骤2: 确定保存路径');
        var savePath;
        switch (saveLocation) {
            case 'desktop':
                savePath = Folder.desktop.fsName;
                break;
            case 'documents':
                savePath = Folder.myDocuments.fsName;
                break;
            case 'project':
                if (app.project.file) {
                    savePath = app.project.file.parent.fsName;
                } else {
                    savePath = Folder.desktop.fsName;
                }
                break;
            case 'custom':
                if (customPath && customPath !== '') {
                    var customFolder = new Folder(customPath);
                    if (customFolder.exists) {
                        savePath = customPath;
                    } else {
                        savePath = Folder.desktop.fsName;
                    }
                } else {
                    savePath = Folder.desktop.fsName;
                }
                break;
            default:
                savePath = Folder.desktop.fsName;
        }
        
        // 步骤3: 生成目标文件路径
        var timestamp = new Date().getTime();
        var extension = fileExtension || '.png';
        var fileName = "imported_file_" + timestamp + extension;
        var targetPath = savePath + "\\" + fileName;
        var targetFile = new File(targetPath);
        
        // 步骤4: 复制文件（如果需要）
        var fileToImport = sourceFile;
        if (sourceFile.fsName !== targetPath) {
            $.writeln('步骤4: 复制文件到目标位置');
            
            try {
                if (isAE2023) {
                    // AE2023使用分块复制
                    sourceFile.encoding = "BINARY";
                    targetFile.encoding = "BINARY";
                    
                    if (!sourceFile.open("r")) {
                        app.endUndoGroup();
                        return "Error:无法打开源文件进行读取";
                    }
                    
                    if (!targetFile.open("w")) {
                        sourceFile.close();
                        app.endUndoGroup();
                        return "Error:无法打开目标文件进行写入";
                    }
                    
                    var chunkSize = 8192;
                    var totalSize = sourceFile.length;
                    var copiedSize = 0;
                    var chunkCount = 0;
                    
                    while (!sourceFile.eof) {
                        var chunk = sourceFile.read(chunkSize);
                        if (chunk) {
                            targetFile.write(chunk);
                            copiedSize += chunk.length;
                            chunkCount++;
                            
                            // 减少进度显示频率，每1000个块显示一次
                            if (chunkCount % 1000 === 0) {
                                $.sleep(1);
                            }
                        }
                    }
                    
                    sourceFile.close();
                    targetFile.close();
                    
                } else {
                    // 标准复制
                    if (!sourceFile.copy(targetFile)) {
                        app.endUndoGroup();
                        return "Error:文件复制失败";
                    }
                }
                
                fileToImport = targetFile;
                
            } catch (copyError) {
                app.endUndoGroup();
                return "Error:文件复制失败: " + copyError.toString();
            }
        } else {
            $.writeln('步骤4: 直接使用源文件（无需复制）');
        }
        
        // 步骤5: 导入到AE
        $.writeln('步骤5: 开始导入文件到AE');
        
        var footage;
        try {
            var importOptions = new ImportOptions(fileToImport);
            footage = app.project.importFile(importOptions);
            
            if (isAE2023) {
                $.sleep(2);
            } else {
                $.sleep(1);
            }
            
        } catch (importError) {
            app.endUndoGroup();
            return "Error:AE导入失败: " + importError.toString();
        }
        
        // 步骤6: 添加到活动合成
        $.writeln('步骤6: 检查活动合成');
        var activeComp = app.project.activeItem;
        
        if (activeComp && activeComp instanceof CompItem) {
            try {
                var layer = activeComp.layers.add(footage);
                
                // 居中图层
                layer.transform.position.setValue([
                    activeComp.width / 2,
                    activeComp.height / 2
                ]);
                
                // 缩放适配
                var scaleX = activeComp.width / footage.width;
                var scaleY = activeComp.height / footage.height;
                var scale = Math.min(scaleX, scaleY, 1.0) * 100;
                
                if (scale < 100) {
                    layer.transform.scale.setValue([scale, scale]);
                }
                
                layer.startTime = activeComp.time;
                
                app.endUndoGroup();
                return "Success:文件已成功导入并添加到合成: " + activeComp.name;
                
            } catch (layerError) {
                app.endUndoGroup();
                return "Error:图层添加失败: " + layerError.toString();
            }
        } else {
            app.endUndoGroup();
            return "Success:文件已成功导入到项目: " + footage.name;
        }
        
    } catch (error) {
        app.endUndoGroup();
        return "Error:处理失败: " + error.toString();
    }
}

// New function to save and import clipboard image from base64 data
// Import file directly from file path (preferred method)
function importFileFromPath(filePath, saveLocation, customPath, fileExtension) {
    // 记录调试信息到控制台
    $.writeln('=== AE脚本importFileFromPath开始执行 ===');
    $.writeln('filePath: ' + (filePath || '未定义'));
    $.writeln('saveLocation: ' + (saveLocation || '未定义'));
    $.writeln('customPath: ' + (customPath || '未定义'));
    $.writeln('fileExtension: ' + (fileExtension || '未定义'));
    
    // AE版本检测
    var aeVersion = parseFloat(app.version);
    var isAE2023 = aeVersion >= 23.0 && aeVersion < 24.0;
    
    // Begin undo group to prevent UI blocking and ensure atomic operation
    app.beginUndoGroup("Import Dropped File");
    $.writeln('步骤1: 开始撤销组');
    
    try {
        // Check if file exists
        $.writeln('步骤2: 检查源文件是否存在');
        var sourceFile = new File(filePath);
        if (!sourceFile.exists) {
            $.writeln('错误: 源文件不存在 - ' + filePath);
            app.endUndoGroup();
            return "Error:源文件不存在: " + filePath;
        }
        $.writeln('步骤2完成: 源文件存在，大小: ' + sourceFile.length + ' bytes');
        
        // Determine save path based on location setting - 修复保存位置逻辑
        $.writeln('步骤3: 确定保存路径');
        var savePath;
        $.writeln('步骤3.1: saveLocation = ' + saveLocation + ', customPath = ' + customPath);
        
        switch (saveLocation) {
            case 'desktop':
                savePath = Folder.desktop.fsName;
                $.writeln('步骤3.2: 使用桌面路径');
                break;
            case 'documents':
                savePath = Folder.myDocuments.fsName;
                $.writeln('步骤3.2: 使用文档路径');
                break;
            case 'project':
                if (app.project.file) {
                    savePath = app.project.file.parent.fsName;
                    $.writeln('步骤3.2: 使用项目文件路径');
                } else {
                    savePath = Folder.desktop.fsName; // Fallback to desktop
                    $.writeln('步骤3.2: 项目未保存，回退到桌面');
                }
                break;
            case 'custom':
                if (customPath && customPath !== '') {
                    // 解码自定义路径
                    var decodedCustomPath = customPath;
                    try {
                        decodedCustomPath = decodeURIComponent(customPath);
                        $.writeln('步骤3.2: 自定义路径解码成功: ' + decodedCustomPath);
                    } catch (e) {
                        decodedCustomPath = customPath;
                        $.writeln('步骤3.2: 自定义路径无需解码: ' + decodedCustomPath);
                    }
                    
                    var customFolder = new Folder(decodedCustomPath);
                    if (customFolder.exists) {
                        savePath = decodedCustomPath;
                        $.writeln('步骤3.2: 使用现有自定义路径');
                    } else {
                        // 尝试创建目录
                        try {
                            if (customFolder.create()) {
                                savePath = decodedCustomPath;
                                $.writeln('步骤3.2: 创建并使用自定义路径');
                            } else {
                                savePath = Folder.desktop.fsName;
                                $.writeln('步骤3.2: 自定义路径创建失败，回退到桌面');
                            }
                        } catch (createError) {
                            savePath = Folder.desktop.fsName;
                            $.writeln('步骤3.2: 自定义路径创建异常，回退到桌面');
                        }
                    }
                } else {
                    savePath = Folder.desktop.fsName; // Fallback to desktop
                    $.writeln('步骤3.2: 自定义路径为空，回退到桌面');
                }
                break;
            default:
                savePath = Folder.desktop.fsName;
                $.writeln('步骤3.2: 使用默认桌面路径');
        }
        $.writeln('步骤3完成: 保存路径确定为 - ' + savePath);
        
        // Generate unique filename with proper extension
        $.writeln('步骤4: 生成目标文件名');
        var timestamp = new Date().getTime();
        var extension = fileExtension || '.png'; // Default to .png if not provided
        var fileName = "dropped_file_" + timestamp + extension;
        // 使用Windows路径分隔符
        var targetPath = savePath + "\\" + fileName;
        $.writeln('步骤4完成: 目标文件路径 - ' + targetPath);
        
        // Copy file to target location
        $.writeln('步骤5: 开始复制文件');
        var targetFile = new File(targetPath);
        
        // 确保目标目录存在
        if (!targetFile.parent.exists) {
            try {
                targetFile.parent.create();
            } catch (dirError) {
                app.endUndoGroup();
                return "Error:无法创建目标目录: " + dirError.toString();
            }
        }
        
        try {
            // 对于AE 2023，使用更安全的文件复制方法
            if (isAE2023) {
                // 打开源文件读取
                sourceFile.encoding = "BINARY";
                if (!sourceFile.open("r")) {
                    app.endUndoGroup();
                    return "Error:无法打开源文件: " + sourceFile.fsName;
                }
                
                // 打开目标文件写入
                targetFile.encoding = "BINARY";
                if (!targetFile.open("w")) {
                    sourceFile.close();
                    app.endUndoGroup();
                    return "Error:无法打开目标文件: " + targetFile.fsName;
                }
                
                // 分块复制文件内容
                var chunkSize = 8192; // 8KB chunks
                var totalSize = sourceFile.length;
                var copiedSize = 0;
                var chunkCount = 0;
                
                while (!sourceFile.eof) {
                    var chunk = sourceFile.read(chunkSize);
                    if (chunk) {
                        targetFile.write(chunk);
                        copiedSize += chunk.length;
                        chunkCount++;
                        
                        // 每50个分块显示一次进度
                        if (chunkCount % 50 === 0) {
                            var progress = Math.round((copiedSize / totalSize) * 100);
                            $.sleep(1); // 短暂暂停
                        }
                    }
                }
                
                sourceFile.close();
                targetFile.close();
                
            } else {
                // 标准复制方法
                if (!sourceFile.copy(targetFile)) {
                    $.writeln('错误: 文件复制失败');
                    app.endUndoGroup();
                    return "Error:文件复制失败: " + filePath + " -> " + targetPath;
                }
            }
            
            $.writeln('步骤5完成: 文件复制成功');
                  
        } catch (copyError) {
            $.writeln('错误: 文件复制异常 - ' + copyError.toString());
            app.endUndoGroup();
            return "Error:文件复制异常: " + copyError.toString();
        }
        
        // Import the copied file to After Effects
        $.writeln('步骤6: 开始导入文件到AE');
        var footage;
        
        try {
            var importOptions = new ImportOptions(targetFile);
            
            footage = app.project.importFile(importOptions);
            $.writeln('步骤6完成: 文件导入成功，素材名称: ' + footage.name);
            
            // 添加暂停，让导入操作完成
            if (isAE2023) {
                $.sleep(2); // AE2023需要更多时间
            } else {
                $.sleep(1);
            }
        } catch (importError) {
            $.writeln('错误: 导入AE失败 - ' + importError.toString());
            app.endUndoGroup();
            return "Error:导入AE失败: " + importError.toString();
        }
        
        // Add to active composition if one exists, otherwise just import to project
        $.writeln('步骤7: 检查活动合成');
        var activeComp = app.project.activeItem;
        
        if (activeComp && activeComp instanceof CompItem) {
            $.writeln('步骤7: 找到活动合成，开始添加图层');
            
            try {
                var layer = activeComp.layers.add(footage);
                $.writeln('步骤7.1: 图层添加成功');
                
                // 添加暂停，让图层添加操作完成
                if (isAE2023) {
                    $.sleep(2); // AE2023需要更多时间
                } else {
                    $.sleep(1);
                }
                
                // Center the layer in the composition
                var compWidth = activeComp.width;
                var compHeight = activeComp.height;
                var layerWidth = footage.width;
                var layerHeight = footage.height;
                
                layer.transform.position.setValue([
                    compWidth / 2,
                    compHeight / 2
                ]);
                $.writeln('步骤7.2: 图层位置设置完成');
                
                // 添加暂停，让位置设置操作完成
                $.sleep(1);
                
                // Scale to fit if the image is larger than the composition
                var scaleX = compWidth / layerWidth;
                var scaleY = compHeight / layerHeight;
                var scale = Math.min(scaleX, scaleY, 1.0) * 100; // Don't scale up, only down
                
                if (scale < 100) {
                    layer.transform.scale.setValue([scale, scale]);
                    $.writeln('步骤7.3: 图层缩放设置完成，缩放比例: ' + scale + '%');
                    // 添加暂停，让缩放操作完成
                    $.sleep(1);
                }
                
                layer.startTime = activeComp.time;
                $.writeln('步骤7.4: 图层时间设置完成');
                app.endUndoGroup();
                $.writeln('=== 成功完成，返回结果 ===');
                return "Success:拖拽文件已成功导入并添加到当前合成: " + activeComp.name + 
                       " (" + layerWidth + "x" + layerHeight + ")";
            } catch (layerError) {
                $.writeln('错误: 添加图层失败 - ' + layerError.toString());
                app.endUndoGroup();
                return "Error:添加图层失败: " + layerError.toString();
            }
        } else {
            $.writeln('步骤7: 没有活动合成，仅导入到项目');
            app.endUndoGroup();
            $.writeln('=== 成功完成，返回结果 ===');
            return "Success:拖拽文件已成功导入到项目: " + footage.name + 
                   " (" + footage.width + "x" + footage.height + ")";
        }
        
    } catch (error) {
        $.writeln('错误: 处理失败 - ' + error.toString());
        app.endUndoGroup();
        return "Error:处理失败: " + error.toString();
    }
}

function saveAndImportClipboardImageFromJson(encodedParamsJson) {
    // 记录调试信息到控制台
    $.writeln('=== AE脚本saveAndImportClipboardImageFromJson开始执行 ===');
    $.writeln('encodedParamsJson长度: ' + (encodedParamsJson ? encodedParamsJson.length : '未定义'));
    
    try {
        // 解码JSON参数
        var decodedJson = decodeURIComponent(encodedParamsJson);
        $.writeln('解码后JSON长度: ' + decodedJson.length);
        
        var params = JSON.parse(decodedJson);
        $.writeln('JSON解析成功');
        $.writeln('base64Data长度: ' + (params.base64Data ? params.base64Data.length : '未定义'));
        $.writeln('saveLocation: ' + (params.saveLocation || '未定义'));
        $.writeln('customPath: ' + (params.customPath || '未定义'));
        $.writeln('fileExtension: ' + (params.fileExtension || '未定义'));
        
        // 调用原始函数
        return saveAndImportClipboardImage(
            params.base64Data,
            params.saveLocation,
            params.customPath,
            params.fileExtension
        );
        
    } catch (error) {
        $.writeln('JSON参数处理失败: ' + error.toString());
        return "Error:JSON参数处理失败: " + error.toString();
    }
}

function saveAndImportClipboardImage(base64Data, saveLocation, customPath, fileExtension) {
    // 记录调试信息到控制台
    $.writeln('AE脚本saveAndImportClipboardImage开始执行');
    $.writeln('base64Data长度: ' + (base64Data ? base64Data.length : '未定义'));
    $.writeln('saveLocation: ' + (saveLocation || '未定义'));
    $.writeln('fileExtension: ' + (fileExtension || '未定义'));
    
    // Begin undo group to prevent UI blocking and ensure atomic operation
    app.beginUndoGroup("Import Clipboard Image");
    
    try {
        // Remove data URL prefix if present
        var imageData = base64Data;
        if (imageData.indexOf('data:image/') === 0) {
            imageData = imageData.split(',')[1];
        }
        
        // Determine save path based on location setting - 修复保存位置逻辑
        var savePath;
        $.writeln('ExtendScript: 处理保存位置设置 - saveLocation: ' + saveLocation + ', customPath: ' + customPath);
        
        switch (saveLocation) {
            case 'desktop':
                savePath = Folder.desktop.fsName;
                $.writeln('ExtendScript: 使用桌面路径: ' + savePath);
                break;
            case 'documents':
                savePath = Folder.myDocuments.fsName;
                $.writeln('ExtendScript: 使用文档路径: ' + savePath);
                break;
            case 'project':
                if (app.project.file) {
                    savePath = app.project.file.parent.fsName;
                    $.writeln('ExtendScript: 使用项目文件路径: ' + savePath);
                } else {
                    savePath = Folder.desktop.fsName;
                    $.writeln('ExtendScript: 项目未保存，回退到桌面路径: ' + savePath);
                }
                break;
            case 'custom':
                if (customPath && customPath !== '') {
                    // 解码自定义路径（如果被编码了）
                    var decodedCustomPath = customPath;
                    try {
                        decodedCustomPath = decodeURIComponent(customPath);
                    } catch (e) {
                        // 如果解码失败，使用原始路径
                        decodedCustomPath = customPath;
                    }
                    
                    var customFolder = new Folder(decodedCustomPath);
                    if (customFolder.exists) {
                        savePath = decodedCustomPath;
                        $.writeln('ExtendScript: 使用自定义路径: ' + savePath);
                    } else {
                        // 尝试创建自定义目录
                        try {
                            if (customFolder.create()) {
                                savePath = decodedCustomPath;
                                $.writeln('ExtendScript: 创建并使用自定义路径: ' + savePath);
                            } else {
                                savePath = Folder.desktop.fsName;
                                $.writeln('ExtendScript: 自定义路径创建失败，回退到桌面: ' + savePath);
                            }
                        } catch (createError) {
                            savePath = Folder.desktop.fsName;
                            $.writeln('ExtendScript: 自定义路径创建异常，回退到桌面: ' + savePath);
                        }
                    }
                } else {
                    savePath = Folder.desktop.fsName;
                    $.writeln('ExtendScript: 自定义路径为空，回退到桌面: ' + savePath);
                }
                break;
            default:
                savePath = Folder.desktop.fsName;
                $.writeln('ExtendScript: 使用默认桌面路径: ' + savePath);
        }
        
        $.writeln('ExtendScript: 最终确定的保存路径: ' + savePath);
        
        // Generate unique filename with proper extension
        var timestamp = new Date().getTime();
        var extension = fileExtension || '.png'; // Default to .png if not provided
        var fileName = "clipboard_image_" + timestamp + extension;
        var filePath = savePath + "/" + fileName;
        
        // 记录Base64数据格式信息到控制台
        $.writeln('数据长度: ' + imageData.length);
        $.writeln('文件扩展名: ' + extension);
        
        // Create file and write base64 data with optimized processing
        var file = new File(filePath);
        file.encoding = "BINARY";
        file.open("w");
        
        // Convert base64 to binary using optimized method for large files
        var binaryData = "";
        try {
            // Manual base64 decode with larger chunks for better performance
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var result = "";
            var i = 0;
            var chunkSize = 8192; // Increased chunk size for better performance
            var processedChunks = 0;
            
            // Clean the base64 string
            imageData = imageData.replace(/[^A-Za-z0-9+\/=]/g, "");
            
            // Process in larger chunks with periodic yield
            while (i < imageData.length) {
                var chunkEnd = Math.min(i + chunkSize, imageData.length);
                var chunkResult = "";
                
                while (i < chunkEnd && i < imageData.length) {
                    var encoded1 = chars.indexOf(imageData.charAt(i++));
                    var encoded2 = chars.indexOf(imageData.charAt(i++));
                    var encoded3 = chars.indexOf(imageData.charAt(i++));
                    var encoded4 = chars.indexOf(imageData.charAt(i++));
                    
                    if (encoded1 === -1 || encoded2 === -1) break;
                    
                    var bitmap = (encoded1 << 18) | (encoded2 << 12) | 
                               ((encoded3 === -1 ? 0 : encoded3) << 6) | 
                               (encoded4 === -1 ? 0 : encoded4);
                    
                    chunkResult += String.fromCharCode((bitmap >> 16) & 255);
                    if (encoded3 !== -1 && imageData.charAt(i-2) !== '=') {
                        chunkResult += String.fromCharCode((bitmap >> 8) & 255);
                    }
                    if (encoded4 !== -1 && imageData.charAt(i-1) !== '=') {
                        chunkResult += String.fromCharCode(bitmap & 255);
                    }
                }
                
                result += chunkResult;
                processedChunks++;
                
                // Yield control every 100 chunks to prevent UI blocking
                if (processedChunks % 100 === 0) {
                    $.sleep(1); // Brief pause to allow UI updates
                }
            }
            binaryData = result;
        } catch (decodeError) {
            file.close();
            app.endUndoGroup();
            return "Error:Base64解码失败: " + decodeError.toString();
        }
        
        // Write binary data in optimized chunks
        try {
            var writeChunkSize = 16384; // Increased to 16KB chunks for better performance
            var totalLength = binaryData.length;
            var written = 0;
            var writtenChunks = 0;
            
            while (written < totalLength) {
                var chunkEnd = Math.min(written + writeChunkSize, totalLength);
                var chunk = binaryData.substring(written, chunkEnd);
                file.write(chunk);
                written = chunkEnd;
                writtenChunks++;
                
                // Yield control every 100 chunks to prevent UI blocking
                if (writtenChunks % 100 === 0) {
                    $.sleep(1); // Brief pause to allow UI updates
                }
            }
        } catch (writeError) {
            file.close();
            app.endUndoGroup();
            return "Error:文件写入失败: " + writeError.toString();
        }
        
        file.close();
        
        // 添加短暂暂停，让系统处理文件写入操作
        $.sleep(2);
        
        // Import the file to After Effects with error handling
        var footage;
        try {
            var importOptions = new ImportOptions(file);
            footage = app.project.importFile(importOptions);
            
            // 添加暂停，让导入操作完成
            $.sleep(1);
        } catch (importError) {
            app.endUndoGroup();
            return "Error:导入AE失败: " + importError.toString();
        }
        
        // Add to active composition if one exists, otherwise just import to project
        var activeComp = app.project.activeItem;
        if (activeComp && activeComp instanceof CompItem) {
            try {
                var layer = activeComp.layers.add(footage);
                
                // 添加暂停，让图层添加操作完成
                $.sleep(1);
                
                // Center the layer in the composition
                var compWidth = activeComp.width;
                var compHeight = activeComp.height;
                var layerWidth = footage.width;
                var layerHeight = footage.height;
                
                layer.transform.position.setValue([
                    compWidth / 2,
                    compHeight / 2
                ]);
                
                // 添加暂停，让位置设置操作完成
                $.sleep(1);
                
                // Scale to fit if the image is larger than the composition
                var scaleX = compWidth / layerWidth;
                var scaleY = compHeight / layerHeight;
                var scale = Math.min(scaleX, scaleY, 1.0) * 100; // Don't scale up, only down
                
                if (scale < 100) {
                    layer.transform.scale.setValue([scale, scale]);
                    // 添加暂停，让缩放操作完成
                    $.sleep(1);
                }
                
                layer.startTime = activeComp.time;
                app.endUndoGroup();
                return "Success:剪贴板图片已成功导入并添加到当前合成: " + activeComp.name + 
                       " (" + layerWidth + "x" + layerHeight + ")";
            } catch (layerError) {
                app.endUndoGroup();
                return "Error:添加图层失败: " + layerError.toString();
            }
        } else {
            app.endUndoGroup();
            return "Success:剪贴板图片已成功导入到项目: " + footage.name + 
                   " (" + footage.width + "x" + footage.height + ")";
        }
        
    } catch (error) {
        app.endUndoGroup();
        return "Error:处理失败: " + error.toString();
    }
}

// Original clipboard import function (keep for backward compatibility)
function importClipboardImage(base64Data, saveLocation, customPath, fileExtension) {
    // 记录调试信息到控制台
    $.writeln('AE脚本importClipboardImage开始执行');
    $.writeln('base64Data长度: ' + (base64Data ? base64Data.length : '未定义'));
    $.writeln('saveLocation: ' + (saveLocation || '未定义'));
    $.writeln('fileExtension: ' + (fileExtension || '未定义'));
    
    // Begin undo group to prevent UI blocking and ensure atomic operation
    app.beginUndoGroup("Import Dragged File");
    
    try {
        // Remove data URL prefix if present
        var imageData = base64Data;
        if (imageData.indexOf('data:image/') === 0) {
            imageData = imageData.split(',')[1];
        }
        
        // Determine save path based on location setting
        var savePath;
        switch (saveLocation) {
            case 'desktop':
                savePath = Folder.desktop.fsName;
                break;
            case 'documents':
                savePath = Folder.myDocuments.fsName;
                break;
            case 'project':
                if (app.project.file) {
                    savePath = app.project.file.parent.fsName;
                } else {
                    savePath = Folder.desktop.fsName; // Fallback to desktop
                }
                break;
            case 'custom':
                if (customPath && customPath !== '') {
                    var customFolder = new Folder(customPath);
                    if (customFolder.exists) {
                        savePath = customPath;
                    } else {
                        savePath = Folder.desktop.fsName; // Fallback to desktop
                    }
                } else {
                    savePath = Folder.desktop.fsName; // Fallback to desktop
                }
                break;
            default:
                savePath = Folder.desktop.fsName;
        }
        
        // Generate unique filename with proper extension
        var timestamp = new Date().getTime();
        var extension = fileExtension || '.png'; // Default to .png if not provided
        var fileName = "dragged_file_" + timestamp + extension;
        var filePath = savePath + "/" + fileName;
        
        // 记录Base64数据格式信息到控制台
        $.writeln('数据长度: ' + imageData.length);
        $.writeln('文件扩展名: ' + extension);
        
        // Create file and write base64 data with optimized processing
        var file = new File(filePath);
        file.encoding = "BINARY";
        file.open("w");
        
        // Convert base64 to binary using optimized method for large files
        var binaryData = "";
        try {
            // Use ExtendScript's built-in base64 decode if available, otherwise manual decode
            if (typeof $.global.decodeBase64 === 'function') {
                // Use built-in function if available (faster)
                binaryData = $.global.decodeBase64(imageData);
            } else {
                // Manual base64 decode with larger chunks for better performance
                var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                var result = "";
                var i = 0;
                var chunkSize = 8192; // Increased chunk size for better performance
                var processedChunks = 0;
                
                // Clean the base64 string
                imageData = imageData.replace(/[^A-Za-z0-9+\/=]/g, "");
                
                // Process in larger chunks with periodic yield
                while (i < imageData.length) {
                    var chunkEnd = Math.min(i + chunkSize, imageData.length);
                    var chunkResult = "";
                    
                    while (i < chunkEnd && i < imageData.length) {
                        var encoded1 = chars.indexOf(imageData.charAt(i++));
                        var encoded2 = chars.indexOf(imageData.charAt(i++));
                        var encoded3 = chars.indexOf(imageData.charAt(i++));
                        var encoded4 = chars.indexOf(imageData.charAt(i++));
                        
                        if (encoded1 === -1 || encoded2 === -1) break;
                        
                        var bitmap = (encoded1 << 18) | (encoded2 << 12) | 
                                   ((encoded3 === -1 ? 0 : encoded3) << 6) | 
                                   (encoded4 === -1 ? 0 : encoded4);
                        
                        chunkResult += String.fromCharCode((bitmap >> 16) & 255);
                        if (encoded3 !== -1 && imageData.charAt(i-2) !== '=') {
                            chunkResult += String.fromCharCode((bitmap >> 8) & 255);
                        }
                        if (encoded4 !== -1 && imageData.charAt(i-1) !== '=') {
                            chunkResult += String.fromCharCode(bitmap & 255);
                        }
                    }
                    
                    result += chunkResult;
                    processedChunks++;
                    
                    // Yield control every 100 chunks to prevent UI blocking
                    if (processedChunks % 100 === 0) {
                        $.sleep(1); // Brief pause to allow UI updates
                    }
                }
                binaryData = result;
            }
        } catch (decodeError) {
            file.close();
            app.endUndoGroup();
            return "Base64解码失败: " + decodeError.toString();
        }
        
        // Write binary data in optimized chunks
        try {
            var writeChunkSize = 16384; // Increased to 16KB chunks for better performance
            var totalLength = binaryData.length;
            var written = 0;
            var writtenChunks = 0;
            
            while (written < totalLength) {
                var chunkEnd = Math.min(written + writeChunkSize, totalLength);
                var chunk = binaryData.substring(written, chunkEnd);
                file.write(chunk);
                written = chunkEnd;
                writtenChunks++;
                
                // Yield control every 100 chunks to prevent UI blocking
                if (writtenChunks % 100 === 0) {
                    $.sleep(1); // Brief pause to allow UI updates
                }
            }
        } catch (writeError) {
            file.close();
            app.endUndoGroup();
            return "文件写入失败: " + writeError.toString();
        }
        
        file.close();
        
        // 添加短暂暂停，让系统处理文件写入操作
        $.sleep(2);
        
        // Import the file to After Effects with error handling
        var footage;
        try {
            var importOptions = new ImportOptions(file);
            footage = app.project.importFile(importOptions);
            
            // 添加暂停，让导入操作完成
            $.sleep(1);
        } catch (importError) {
            app.endUndoGroup();
            return "导入AE失败: " + importError.toString();
        }
        
        // Add to active composition if one exists, otherwise just import to project
        var activeComp = app.project.activeItem;
        if (activeComp && activeComp instanceof CompItem) {
            try {
                var layer = activeComp.layers.add(footage);
                
                // 添加暂停，让图层添加操作完成
                $.sleep(1);
                
                layer.startTime = activeComp.time;
                app.endUndoGroup();
                return "文件已成功导入到合成: " + activeComp.name;
            } catch (layerError) {
                // If adding to comp fails, still return success for project import
                app.endUndoGroup();
                return "文件已成功导入到项目窗口";
            }
        } else {
            app.endUndoGroup();
            return "文件已成功导入到项目窗口";
        }
        
    } catch (e) {
        app.endUndoGroup();
        return "导入文件失败: " + e.toString();
    }
}

// Save base64 data to file (for CEP compatibility)
function saveBase64ToFile(base64Data, filePath) {
    try {
        // AE版本检测
        var aeVersion = parseFloat(app.version);
        var isAE2023 = aeVersion >= 23.0 && aeVersion < 24.0;
        
        // Remove data URL prefix if present
        var imageData = base64Data;
        if (imageData.indexOf('data:image/') === 0) {
            imageData = imageData.split(',')[1];
        }
        
        // Create file and write base64 data
        var file = new File(filePath);
        
        // Ensure parent directory exists
        if (!file.parent.exists) {
            file.parent.create();
        }
        
        file.encoding = "BINARY";
        file.open("w");
        
        // Convert base64 to binary
        var binaryData = "";
        try {
            // 优化的Base64解码 - 针对AE2023性能优化
            if (isAE2023) {
                // AE2023使用分块解码，每次处理更大的块
                var chunkSize = 40000; // 每次处理40000字符
                var totalChars = imageData.length;
                var processedChars = 0;
                var result = "";
                
                while (processedChars < totalChars) {
                    var chunkEnd = Math.min(processedChars + chunkSize, totalChars);
                    var chunk = imageData.substring(processedChars, chunkEnd);
                    
                    // 确保块以4的倍数结尾（Base64要求）
                    var remainder = chunk.length % 4;
                    if (remainder !== 0 && chunkEnd < totalChars) {
                        var adjustment = 4 - remainder;
                        chunkEnd = Math.min(chunkEnd + adjustment, totalChars);
                        chunk = imageData.substring(processedChars, chunkEnd);
                    }
                    
                    // 解码当前块
                    var chunkResult = "";
                    for (var i = 0; i < chunk.length; i += 4) {
                        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                        var encoded1 = chars.indexOf(chunk.charAt(i));
                        var encoded2 = chars.indexOf(chunk.charAt(i + 1));
                        var encoded3 = chars.indexOf(chunk.charAt(i + 2));
                        var encoded4 = chars.indexOf(chunk.charAt(i + 3));
                        
                        if (encoded1 === -1 || encoded2 === -1) break;
                        
                        var bitmap = (encoded1 << 18) | (encoded2 << 12) | 
                                   ((encoded3 === -1 ? 0 : encoded3) << 6) | 
                                   (encoded4 === -1 ? 0 : encoded4);
                        
                        chunkResult += String.fromCharCode((bitmap >> 16) & 255);
                        if (encoded3 !== -1 && chunk.charAt(i + 2) !== '=') {
                            chunkResult += String.fromCharCode((bitmap >> 8) & 255);
                        }
                        if (encoded4 !== -1 && chunk.charAt(i + 3) !== '=') {
                            chunkResult += String.fromCharCode(bitmap & 255);
                        }
                    }
                    
                    result += chunkResult;
                    processedChars = chunkEnd;
                    
                    $.sleep(10); // 每个块后暂停10毫秒
                }
                
                binaryData = result;
                
            } else {
                // 其他版本使用标准解码
                var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                var result = "";
                var i = 0;
                
                while (i < imageData.length) {
                    var encoded1 = chars.indexOf(imageData.charAt(i++));
                    var encoded2 = chars.indexOf(imageData.charAt(i++));
                    var encoded3 = chars.indexOf(imageData.charAt(i++));
                    var encoded4 = chars.indexOf(imageData.charAt(i++));
                    
                    if (encoded1 === -1 || encoded2 === -1) break;
                    
                    var bitmap = (encoded1 << 18) | (encoded2 << 12) | 
                               ((encoded3 === -1 ? 0 : encoded3) << 6) | 
                               (encoded4 === -1 ? 0 : encoded4);
                    
                    result += String.fromCharCode((bitmap >> 16) & 255);
                    if (encoded3 !== -1 && imageData.charAt(i-2) !== '=') {
                        result += String.fromCharCode((bitmap >> 8) & 255);
                    }
                    if (encoded4 !== -1 && imageData.charAt(i-1) !== '=') {
                        result += String.fromCharCode(bitmap & 255);
                    }
                }
                
                binaryData = result;
            }
                  
        } catch (decodeError) {
            file.close();
            return "Error:Base64解码失败: " + decodeError.toString();
        }
        
        // Write binary data
        try {
            if (isAE2023) {
                // AE2023使用分块写入策略
                var chunkSize = 8192; // 8KB chunks for AE2023
                var totalLength = binaryData.length;
                var written = 0;
                var chunkCount = 0;
                
                while (written < totalLength) {
                    var chunkEnd = Math.min(written + chunkSize, totalLength);
                    var chunk = binaryData.substring(written, chunkEnd);
                    
                    file.write(chunk);
                    written = chunkEnd;
                    chunkCount++;
                    
                    // AE2023需要更频繁的暂停
                    if (chunkCount % 10 === 0) {
                        $.sleep(5); // 每10个分块暂停5毫秒
                    }
                }
                      
            } else {
                // 其他版本使用标准写入
                file.write(binaryData);
            }
            
        } catch (writeError) {
            file.close();
            return "Error:文件写入失败: " + writeError.toString();
        }
        
        file.close();
        
        // Verify file was created
        if (file.exists) {
            var fileSize = file.length;
            return "Success:文件保存成功: " + filePath;
        } else {
            return "Error:文件保存失败，文件不存在";
        }
        
    } catch (e) {
        return "Error:保存文件失败: " + e.toString();
    }
}

// Delete file (for CEP compatibility)
function deleteFile(filePath) {
    try {
        var file = new File(filePath);
        if (file.exists) {
            var success = file.remove();
            if (success) {
                return "Success:文件删除成功: " + filePath;
            } else {
                return "Error:文件删除失败: " + filePath;
            }
        } else {
            return "Success:文件不存在，无需删除: " + filePath;
        }
    } catch (e) {
        return "Error:删除文件失败: " + e.toString();
    }
}

// Check if folder exists (for diagnostics)
function checkFolderExists(folderPath) {
    try {
        // 添加调试信息
        $.writeln("[AE版本兼容性检测] 开始检测文件夹: " + folderPath);
        $.writeln("[AE版本兼容性检测] AE版本: " + app.version);
        
        // 解码路径（如果是编码的）
        var decodedPath = folderPath;
        try {
            decodedPath = decodeURIComponent(folderPath);
            $.writeln("[AE版本兼容性检测] 路径解码成功: " + decodedPath);
        } catch (decodeError) {
            // 如果解码失败，使用原始路径
            decodedPath = folderPath;
            $.writeln("[AE版本兼容性检测] 路径解码失败，使用原始路径: " + decodedPath);
        }
        
        var folder = new Folder(decodedPath);
        var result = {
            exists: folder.exists,
            path: folder.fsName,
            canRead: false,
            success: true,
            aeVersion: app.version,
            debugInfo: "文件夹检测完成"
        };
        
        $.writeln("[AE版本兼容性检测] 文件夹存在状态: " + folder.exists);
        
        // 如果文件夹存在，测试读取权限
        if (folder.exists) {
            try {
                var items = folder.getFiles();
                result.canRead = true;
                result.itemCount = items ? items.length : 0;
                $.writeln("[AE版本兼容性检测] 文件夹可读，包含 " + result.itemCount + " 个项目");
            } catch (readError) {
                result.canRead = false;
                result.readError = readError.toString();
                $.writeln("[AE版本兼容性检测] 文件夹读取失败: " + readError.toString());
            }
        } else {
            $.writeln("[AE版本兼容性检测] 文件夹不存在或无法访问");
        }
        
        var jsonResult = JSON.stringify(result);
        $.writeln("[AE版本兼容性检测] 返回结果: " + jsonResult);
        return jsonResult;
        
    } catch (e) {
        var errorResult = {
            success: false,
            error: e.toString(),
            message: "ExtendScript执行异常",
            originalPath: folderPath,
            aeVersion: app.version,
            debugInfo: "检测过程中发生异常"
        };
        
        $.writeln("[AE版本兼容性检测] 异常: " + e.toString());
        var jsonErrorResult = JSON.stringify(errorResult);
        $.writeln("[AE版本兼容性检测] 错误结果: " + jsonErrorResult);
        return jsonErrorResult;
    }
}

// Get extension root path (for LocalDataManager)
function getExtensionRootPath() {
    try {
        // 获取当前ExtendScript文件的路径
        var currentFile = new File($.fileName);
        // 向上两级目录到达扩展根目录 (jsx -> 扩展根目录)
        var extensionRoot = currentFile.parent.parent;
        
        return JSON.stringify({
            success: true,
            path: extensionRoot.fsName,
            exists: extensionRoot.exists
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: e.toString(),
            message: "获取扩展根目录失败"
        });
    }
}

// Ensure data folder exists
function ensureDataFolder(folderPath) {
    try {
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            if (folder.create()) {
                return "success";
            } else {
                return "创建文件夹失败";
            }
        }
        return "success";
    } catch (e) {
        return "创建文件夹异常: " + e.toString();
    }
}

// Load data from file
function loadDataFromFile(filePath) {
    try {
        var file = new File(filePath);
        if (!file.exists) {
            return "{}";
        }
        
        file.encoding = "UTF-8";
        file.open("r");
        var content = file.read();
        file.close();
        
        return content || "{}";
    } catch (e) {
        return "{}";
    }
}

// Save data to file
function saveDataToFile(filePath, encodedData) {
    try {
        var file = new File(filePath);
        
        // Ensure parent directory exists
        if (!file.parent.exists) {
            file.parent.create();
        }
        
        // Decode the data
        var data = decodeURIComponent(encodedData);
        
        file.encoding = "UTF-8";
        file.open("w");
        file.write(data);
        file.close();
        
        return "success";
    } catch (e) {
        return "保存文件失败: " + e.toString();
    }
}

/**
 * 选择脚本文件夹
 * 功能：弹出系统文件夹选择对话框，返回用户选择的文件夹路径（平台本地格式）
 * 返回：字符串（选中则为绝对路径，取消则为空字符串""）
 * 调用方：main.js -> csInterface.evalScript('selectFolder()')
 */
/**
 * 选择脚本文件夹（增强版）
 * 功能：在必要时尝试将 AE 置前、解除可能的对话框抑制，并设置起始目录，以提升弹窗的稳定性
 * 参数：
 *  - defaultPath（可选）：string，期望的初始浏览目录（不存在时自动忽略）
 * 返回：字符串（选中则为绝对路径，取消则为空字符串""）
 * 调用方：main.js -> csInterface.evalScript('selectFolder()')（兼容无参调用）
 */
function selectFolder(defaultPath) {
    // 步骤 SelectFolder-准备-01：尽可能将 AE 置于前台，避免系统对话框被遮挡
    try { if (BridgeTalk && BridgeTalk.bringToFront) { BridgeTalk.bringToFront('aftereffects'); } } catch (_) {}
    try { if (app && app.activate) { app.activate(); } } catch (_) {}

    // 步骤 SelectFolder-准备-02：尝试结束可能的“抑制对话框”状态（若接口不可用将忽略）
    try { if (app && app.endSuppressDialogs) { app.endSuppressDialogs(false); } } catch (_) {}

    // 步骤 SelectFolder-准备-03：设置起始目录（若传入 defaultPath 且有效）
    try {
        if (defaultPath && typeof defaultPath === 'string' && defaultPath.length > 0) {
            var startFolder = new Folder(defaultPath);
            if (startFolder && startFolder.exists) {
                Folder.current = startFolder; // 通过设置 Folder.current 指定对话框初始位置
            }
        }
    } catch (_) {}

    // 步骤 SelectFolder-弹窗-04：打开系统文件夹选择对话框
    try {
        var folder = Folder.selectDialog("请选择脚本文件夹");
        if (folder) {
            // 使用 fsName 获取平台原生格式路径（Windows为反斜杠，macOS为正斜杠）
            return folder.fsName;
        }
        return "";
    } catch (e) {
        try { $.writeln('[selectFolder] Error: ' + e); } catch (_) {}
        return "";
    }
}

/**
 * 获取指定目录下的脚本文件列表
 * 参数：
 *  - folderPath: string，脚本根目录的本地绝对路径
 *  - includeSubfolders: boolean，是否递归包含子目录（也兼容字符串"true"/"false"）
 * 返回：JSON字符串（数组），形如：[{ name: string, path: string }]
 * 调用方：main.js -> getScriptFiles(path, includeSubfolders)
 */
function getScriptFiles(folderPath, includeSubfolders) {
    try {
        if (!folderPath || typeof folderPath !== 'string') {
            return JSON.stringify([]);
        }
        var root = new Folder(folderPath);
        if (!root || !root.exists) {
            return JSON.stringify([]);
        }

        // 兼容字符串形式的布尔值
        var recursive = includeSubfolders === true || includeSubfolders === 'true';

        // 允许的脚本扩展名
        var allow = { '.jsx': true, '.jsxbin': true };

        // 工具：提取扩展名（小写）
        function getExtLower(name) {
            var idx = name.lastIndexOf('.');
            return idx >= 0 ? name.substring(idx).toLowerCase() : '';
        }

        var results = [];
        function walk(dir) {
            var items = dir.getFiles();
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it instanceof Folder) {
                    if (recursive) {
                        walk(it);
                    }
                } else if (it instanceof File) {
                    var ext = getExtLower(it.name);
                    if (allow[ext]) {
                        results.push({ name: it.name, path: it.fsName });
                    }
                }
            }
        }

        walk(root);
        return JSON.stringify(results);
    } catch (e) {
        try { $.writeln('[getScriptFiles] Error: ' + e); } catch (_) {}
        return JSON.stringify([]);
    }
}

/**
 * 选择图片文件
 * 功能：弹出文件选择对话框以选择图片，返回所选文件的本地路径
 * 返回：字符串（选中则为绝对路径，取消则为空字符串""）
 * 调用方：main.js 中脚本设置使用 csInterface.evalScript('selectImageFile()')
 */
function selectImageFile() {
    try {
        var file = File.openDialog("选择图片文件", "图片文件:*.png;*.jpg;*.jpeg;*.gif;*.bmp");
        if (file) {
            return file.fsName;
        }
        return "";
    } catch (e) {
        try { $.writeln('[selectImageFile] Error: ' + e); } catch (_) {}
        return "";
    }
}

/**
 * 定位AE预设目录（内置/用户）
 * 返回：{ internal: Folder|null, user: Folder|null }
 */
function findPresetFolders() {
    var result = { internal: null, user: null };
    try {
        // 内置预设（Windows常见路径）：C:\Program Files\Adobe\Adobe After Effects *\Support Files\Presets
        // 尝试在“C:\Program Files\Adobe”下查找“Adobe After Effects*”目录
        var pf = new Folder(Folder.commonFiles.parent.fsName + "/Adobe");
        if (pf && pf.exists) {
            var items = pf.getFiles(function (f) {
                return (f instanceof Folder) && /^Adobe After Effects/i.test(f.name);
            });
            if (items && items.length > 0) {
                // 取第一个匹配
                var aeDir = items[0];
                var presets = new Folder(aeDir.fsName + "/Support Files/Presets");
                if (presets.exists) result.internal = presets;
            }
        }
    } catch (e1) {}

    try {
        // 用户预设（常见）：我的文档/Adobe/After Effects <year>/User Presets
        var major = parseInt(String(app.version).split(".")[0], 10) || 0;
        // 2024/2025 等
        var userBase = new Folder(Folder.myDocuments.fsName + "/Adobe");
        if (userBase.exists) {
            var children = userBase.getFiles(function (f) {
                return (f instanceof Folder) && /^After Effects/i.test(f.name);
            });
            // 选择年份/版本号最大的一个
            var pick = null, pickYear = -1;
            for (var i = 0; i < children.length; i++) {
                var name = children[i].name; // After Effects 2025
                var m = /(\d{4}|\d+\.\d+)/.exec(name);
                var yr = m ? parseInt(m[1], 10) : -1;
                if (yr > pickYear) { pickYear = yr; pick = children[i]; }
            }
            if (pick) {
                var up = new Folder(pick.fsName + "/User Presets");
                if (up.exists) result.user = up;
            }
        }
    } catch (e2) {}

    return result;
}

/**
 * 递归扫描预设目录，返回目录树
 * 返回：JSON字符串 { root: string, tree: Array<node> }
 * node: { type:'folder'|'file', name, path?, children? }
 */
function scanPresets() {
    function scanFolder(folder) {
        var out = [];
        try {
            var items = folder.getFiles();
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it instanceof Folder) {
                    out.push({
                        type: 'folder',
                        name: it.name,
                        children: scanFolder(it)
                    });
                } else if (it instanceof File) {
                    if (/\.ffx$/i.test(it.name)) {
                        out.push({
                            type: 'file',
                            name: it.name,
                            path: it.fsName
                        });
                    }
                }
            }
        } catch (e) {}
        return out;
    }

    try {
        var roots = findPresetFolders();
        var tree = [];
        if (roots.internal && roots.internal.exists) {
            tree.push({
                type: 'folder',
                name: '内置预设',
                children: scanFolder(roots.internal)
            });
        }
        if (roots.user && roots.user.exists) {
            tree.push({
                type: 'folder',
                name: '用户预设',
                children: scanFolder(roots.user)
            });
        }
        var rootPath = (roots.internal && roots.internal.exists) ? roots.internal.fsName : '';
        return JSON.stringify({ root: rootPath, tree: tree });
    } catch (e) {
        return JSON.stringify({ root: '', tree: [] });
    }
}

/**
 * 将数组/数字做向量加法
 */
function addValue(a, b) {
    if (a == null) return b;
    if (b == null) return a;
    if (typeof a === 'number' && typeof b === 'number') return a + b;
    var len = Math.min(a.length || 0, b.length || 0);
    var r = [];
    for (var i = 0; i < len; i++) r[i] = a[i] + b[i];
    return r;
}
/**
 * 计算差值 b - a
 */
function subValue(b, a) {
    if (b == null) return null;
    if (a == null) return b;
    if (typeof a === 'number' && typeof b === 'number') return b - a;
    var len = Math.min((b.length || 0), (a.length || 0));
    var r = [];
    for (var i = 0; i < len; i++) r[i] = b[i] - a[i];
    return r;
}
/**
 * 复制值
 */
function cloneValue(v) {
    if (v == null) return v;
    if (typeof v === 'number') return v;
    var r = [];
    for (var i = 0; i < v.length; i++) r[i] = v[i];
    return r;
}

/**
 * 判断是否为可做数值运算的值（数字或数值数组）
 */
function isNumericValue(v) {
    if (v == null) return false;
    if (typeof v === 'number') return true;
    // 颜色、位移、缩放等通常为数值数组
    if (typeof v.length === 'number' && v.length > 0 && typeof v[0] === 'number') return true;
    return false;
}

/**
 * 复制关键帧的插值/缓动/空间切线等信息
 */
function addKeyframeWithRef(dstProp, tNew, vNew, srcProp, kSrc) {
    try {
        dstProp.setValueAtTime(tNew, vNew);
        var ki = dstProp.nearestKeyIndex(tNew);
        if (!ki || Math.abs(dstProp.keyTime(ki) - tNew) > 1e-4) return;

        // 复制插值类型
        try {
            var inType = (srcProp.keyInInterpolationType) ? srcProp.keyInInterpolationType(kSrc) : null;
            var outType = (srcProp.keyOutInterpolationType) ? srcProp.keyOutInterpolationType(kSrc) : null;
            if (inType && outType && dstProp.setInterpolationTypeAtKey) {
                dstProp.setInterpolationTypeAtKey(ki, inType, outType);
            }
        } catch (eInt) {}

        // 复制时间缓动
        try {
            var inEase = (srcProp.keyInTemporalEase) ? srcProp.keyInTemporalEase(kSrc) : null;
            var outEase = (srcProp.keyOutTemporalEase) ? srcProp.keyOutTemporalEase(kSrc) : null;
            if (inEase && outEase && dstProp.setTemporalEaseAtKey) {
                dstProp.setTemporalEaseAtKey(ki, inEase, outEase);
            }
        } catch (eEase) {}

        // 复制空间切线/自动贝塞尔
        try {
            if (srcProp.isSpatial && dstProp.isSpatial) {
                var inTan = (srcProp.keyInSpatialTangent) ? srcProp.keyInSpatialTangent(kSrc) : null;
                var outTan = (srcProp.keyOutSpatialTangent) ? srcProp.keyOutSpatialTangent(kSrc) : null;
                if (inTan && outTan && dstProp.setSpatialTangentsAtKey) {
                    dstProp.setSpatialTangentsAtKey(ki, inTan, outTan);
                }
                var autoIn = (srcProp.keySpatialAutoBezier) ? srcProp.keySpatialAutoBezier(kSrc) : null;
                var autoOut = (srcProp.keySpatialAutoBezier) ? srcProp.keySpatialAutoBezier(kSrc) : null;
                if (dstProp.setSpatialAutoBezierAtKey && autoIn != null && autoOut != null) {
                    // AE 没有分 in/out 的空间自动贝塞尔设置，通常统一设置
                    dstProp.setSpatialAutoBezierAtKey(ki, autoIn || autoOut);
                }
            }
        } catch (eSp) {}
    } catch (e) {}
}

/**
 * 收集临时图层上的“叶子属性”动画信息（含顶层路径与效果/蒙版组标识）
 */
function collectAnimatedLeafProps(layer) {
    var out = [];
    function pushAnimated(prop, pathTopMatchName, groupRef) {
        try {
            if (!prop || typeof prop.numKeys !== 'number' || prop.numKeys < 1) return;
            var minT = prop.keyTime(1);
            var maxT = prop.keyTime(prop.numKeys);
            var item = {
                prop: prop,
                minTime: minT,
                maxTime: maxT,
                pathTopMatchName: pathTopMatchName,
                effectMatchName: (groupRef && groupRef.matchName) ? groupRef.matchName : null,
                isEffect: pathTopMatchName === "ADBE Effect Parade" || (groupRef && groupRef.matchName && /^ADBE/.test(groupRef.matchName)),
                isMask: pathTopMatchName === "ADBE Mask Parade" || (groupRef && groupRef.matchName === "ADBE Mask Group"),
                maskName: (groupRef && groupRef.name) ? groupRef.name : null
            };
            out.push(item);
        } catch (e) {}
    }

    function traverse(group, pathTopMatchName, groupRef) {
        if (!group) return;
        try {
            if (typeof group.numProperties === 'number' && group.numProperties > 0) {
                for (var i = 1; i <= group.numProperties; i++) {
                    var child = group.property(i);
                    if (!child) continue;
                    // 如果是属性组，继续递归；否则收集关键帧属性
                    if (typeof child.numProperties === 'number' && child.numProperties > 0) {
                        // 子组作为 groupRef 传递，即效果/蒙版/样式的具体组
                        traverse(child, pathTopMatchName, child);
                    } else {
                        pushAnimated(child, pathTopMatchName, groupRef);
                    }
                }
            } else {
                // 叶子属性（无子属性）
                pushAnimated(group, pathTopMatchName, groupRef);
            }
        } catch (e) {}
    }

    try {
        // 变换
        var tGroup = layer.property("ADBE Transform Group");
        if (tGroup) traverse(tGroup, "ADBE Transform Group", null);
        // 效果
        var eParade = layer.property("ADBE Effect Parade");
        if (eParade) {
            for (var ei = 1; ei <= eParade.numProperties; ei++) {
                var eff = eParade.property(ei);
                traverse(eff, "ADBE Effect Parade", eff);
            }
        }
        // 蒙版
        var mParade = layer.property("ADBE Mask Parade");
        if (mParade) {
            for (var mi = 1; mi <= mParade.numProperties; mi++) {
                var mask = mParade.property(mi);
                traverse(mask, "ADBE Mask Parade", mask);
            }
        }
        // 图层样式
        var sParade = layer.property("ADBE Layer Styles");
        if (sParade) {
            for (var si = 1; si <= sParade.numProperties; si++) {
                var style = sParade.property(si);
                traverse(style, "ADBE Layer Styles", style);
            }
        }
    } catch (eAll) {}

    return out;
}

/**
 * 在目标图层上依据临时属性定位/创建对应属性（Transform/Effects/Masks/Layer Styles）
 */
function findOrCreateTargetProperty(layer, srcItem) {
    var p = srcItem.prop;
    // 变换属性
    if (srcItem.pathTopMatchName === "ADBE Transform Group") {
        var tGroup = layer.property("ADBE Transform Group");
        if (!tGroup) return null;
        try { return tGroup.property(p.matchName); } catch (e) { return null; }
    }
    // 效果属性
    if (srcItem.pathTopMatchName === "ADBE Effect Parade" || srcItem.isEffect) {
        var eParade = layer.property("ADBE Effect Parade");
        if (!eParade) return null;
        var eff = null;
        for (var i = 1; i <= eParade.numProperties; i++) {
            var g = eParade.property(i);
            if (g && g.matchName === srcItem.effectMatchName) { eff = g; break; }
        }
        if (!eff && srcItem.effectMatchName) {
            try { eff = eParade.addProperty(srcItem.effectMatchName); } catch (e0) { eff = null; }
        }
        if (!eff) return null;
        try { return eff.property(p.matchName); } catch (e1) { return null; }
    }
    // 蒙版属性（按名称匹配/创建组）
    if (srcItem.pathTopMatchName === "ADBE Mask Parade" || srcItem.isMask) {
        var mParade = layer.property("ADBE Mask Parade");
        if (!mParade) return null;
        var mask = null;
        for (var j = 1; j <= mParade.numProperties; j++) {
            var mg = mParade.property(j);
            if (mg && mg.name === srcItem.maskName) { mask = mg; break; }
        }
        if (!mask) {
            try { mask = mParade.addProperty("ADBE Mask Atom"); } catch (e2) { mask = null; }
            try { if (mask && srcItem.maskName) mask.name = srcItem.maskName; } catch (e3) {}
        }
        if (!mask) return null;
        try { return mask.property(p.matchName); } catch (e4) { return null; }
    }
    // 图层样式
    if (srcItem.pathTopMatchName === "ADBE Layer Styles") {
        var sParade = layer.property("ADBE Layer Styles");
        if (!sParade) return null;
        var sty = null;
        for (var si = 1; si <= sParade.numProperties; si++) {
            var sg = sParade.property(si);
            if (sg && sg.matchName === srcItem.effectMatchName) { sty = sg; break; }
        }
        if (!sty && srcItem.effectMatchName) {
            try { sty = sParade.addProperty(srcItem.effectMatchName); } catch (e5) { sty = null; }
        }
        // 确保样式组启用（部分 AE 版本需要显式启用样式组，否则视觉上像被“删除”）
        try { if (sty) sty.enabled = true; } catch (eEnable) {}
        if (!sty) return null;
        // 首选按 matchName 获取子属性，失败则按显示名称回退匹配
        var child = null;
        try { child = sty.property(p.matchName); } catch (e6) { child = null; }
        if (!child) {
            try {
                for (var ci = 1; ci <= sty.numProperties; ci++) {
                    var cprop = sty.property(ci);
                    if (cprop && cprop.name === p.name) { child = cprop; break; }
                }
            } catch (eNameFind) { child = null; }
        }
        return child;
    }
    return null;
}

/**
 * 获取图层的基础变换属性句柄
 */
function getTransformProps(layer) {
    var t = layer.property("ADBE Transform Group");
    if (!t) return null;
    return {
        anchor: t.property("ADBE Anchor Point"),
        position: t.property("ADBE Position"),
        scale: t.property("ADBE Scale"),
        rotation: t.property("ADBE Rotate Z"),
        opacity: t.property("ADBE Opacity"),
        // 3D层/摄像机相关
        orientation: t.property("ADBE Orientation"),
        rotateX: t.property("ADBE Rotate X"),
        rotateY: t.property("ADBE Rotate Y"),
        rotateZ: t.property("ADBE Rotate Z"),
        pointOfInterest: t.property("ADBE Point of Interest"),
        direction: t.property("ADBE Direction")
    };
}

/**
 * 从属性采集关键帧序列（时间与值）
 * 返回：{ times:[], values:[], t0: Number, tLast: Number } 或 null
 */
function collectKeys(prop) {
    try {
        if (!prop || prop.numKeys < 1) return null;
        var n = prop.numKeys;
        var times = [], values = [];
        for (var i = 1; i <= n; i++) {
            times.push(prop.keyTime(i));
            values.push(cloneValue(prop.keyValue(i)));
        }
        var t0 = times[0];
        var tLast = times[times.length - 1];
        return { times: times, values: values, t0: t0, tLast: tLast };
    } catch (e) {
        return null;
    }
}

/**
 * 清除目标属性在时间窗口 [tStart, tEnd] 内的关键帧
 */
function clearKeysInRange(prop, tStart, tEnd) {
    if (!prop || prop.numKeys < 1) return;
    // 倒序删除
    for (var i = prop.numKeys; i >= 1; i--) {
        var kt = prop.keyTime(i);
        if (kt >= tStart - 1e-4 && kt <= tEnd + 1e-4) {
            try { prop.removeKey(i); } catch (e) {}
        }
    }
}

/**
 * 将关键帧写入目标属性（线性），times/values已是绝对时间和值
 */
function writeKeys(prop, times, values) {
    if (!prop || !times || !values) return;
    for (var i = 0; i < times.length; i++) {
        try {
            prop.setValueAtTime(times[i], values[i]);
        } catch (e) {}
    }
}

/**
 * 获取某个属性组下一级子组的名称列表（用于对比新增组）
 */
function getChildGroupNames(group) {
    var names = [];
    try {
        if (!group || typeof group.numProperties !== 'number') return names;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (!p) continue;
            // 以名称作为标识
            names.push(p.name);
        }
    } catch (e) {}
    return names;
}

/**
 * 递归位移属性或属性组中的所有关键帧时间（不改变插值和数值）
 * 注意：通过重新写入关键帧的方式实现时间平移
 */
function shiftKeysRecursive(propOrGroup, delta) {
    if (!propOrGroup) return;
    try {
        if (typeof propOrGroup.numProperties === 'number' && propOrGroup.numProperties > 0) {
            // 属性组，递归遍历
            for (var i = 1; i <= propOrGroup.numProperties; i++) {
                var child = propOrGroup.property(i);
                shiftKeysRecursive(child, delta);
            }
            return;
        }
        // 普通属性：如果存在关键帧则整体平移
        if (typeof propOrGroup.numKeys === 'number' && propOrGroup.numKeys > 0) {
            var n = propOrGroup.numKeys;
            var times = [], values = [];
            for (var k = 1; k <= n; k++) {
                times.push(propOrGroup.keyTime(k) + delta);
                values.push(cloneValue(propOrGroup.keyValue(k)));
            }
            // 先清空原关键帧
            for (var r = propOrGroup.numKeys; r >= 1; r--) {
                try { propOrGroup.removeKey(r); } catch (eR) {}
            }
            // 再写入平移后的关键帧
            for (var w = 0; w < times.length; w++) {
                try { propOrGroup.setValueAtTime(times[w], values[w]); } catch (eW) {}
            }
        }
    } catch (e) {}
}

/**
 * 从指定路径递归扫描 .ffx 预设（自定义路径优先）
 * 参数: folderPath(String) - 用户在设置中保存的预设根目录
 * 返回: JSON字符串 { root: string, tree: Array<node> }
 * 说明:
 * - 严格递归扫描所有子文件夹
 * - 仅收集 .ffx（大小写不敏感）
 * - 兼容中文/空格路径（尝试解码后再访问）
 * - 返回结构与 scanPresets() 保持一致，便于前端复用
 */
function scanPresetsAt(folderPath) {
    function scanFolder(folder) {
        var out = [];
        try {
            var items = folder.getFiles();
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it instanceof Folder) {
                    out.push({
                        type: 'folder',
                        name: it.name,
                        children: scanFolder(it)
                    });
                } else if (it instanceof File) {
                    if (/\.ffx$/i.test(it.name)) {
                        out.push({
                            type: 'file',
                            name: it.name,
                            path: it.fsName
                        });
                    }
                }
            }
        } catch (e) {
            // 忽略不可读目录或权限异常，继续递归其他分支
        }
        return out;
    }

    try {
        var decoded = folderPath;
        try { decoded = decodeURIComponent(folderPath); } catch (_) { decoded = folderPath; }
        var root = new Folder(decoded);
        if (!root || !root.exists) {
            return JSON.stringify({ root: '', tree: [] });
        }
        
        // 直接扫描根目录的内容，不包装在额外的根节点中
        var tree = scanFolder(root);
        return JSON.stringify({ root: root.fsName, tree: tree });
    } catch (e) {
        return JSON.stringify({ root: '', tree: [] });
    }
}

/**
 * 应用预设（基础/偏移/最后帧）
 * - 基础：直接 layer.applyPreset
 * - 偏移/最后帧：通过傀儡图层读取基础变换关键帧，在当前时间写入目标图层
 */
function applyPresetWithMode(presetPath, mode) {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return "Error:请先选择一个合成";
        }
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            return "Error:请先选择至少一个图层";
        }
        var preset = new File(presetPath);
        if (!preset.exists) {
            return "Error:预设文件不存在";
        }

        var now = comp.time;
        var m = (mode === 'offset' || mode === 'last') ? mode : 'base';
        app.beginUndoGroup("应用预设(" + m + ")");

        if (m === 'base') {
            // 直接应用
            for (var i = 0; i < sel.length; i++) {
                try { sel[i].applyPreset(preset); } catch (eBase) {}
            }
            app.endUndoGroup();
            return "OK";
        }
        // 简化实现：
        // 1) 先直接应用预设到目标图层（让效果/样式/蒙版按AE原生方式创建）
        // 2) 非基础属性（效果/蒙版/样式）仅做“时间平移”到当前时间
        // 3) 基础属性（位置/缩放/旋转/不透明度）做“数值偏移 + 时间平移”，使首帧对齐到应用时刻的原始值

        function toTimeSet(prop) {
            var set = {};
            try {
                if (!prop || prop.numKeys < 1) return set;
                for (var i = 1; i <= prop.numKeys; i++) {
                    var t = prop.keyTime(i);
                    set[t.toFixed(5)] = true;
                }
            } catch (e) {}
            return set;
        }

        function diffNames(afterArr, beforeArr) {
            var setB = {};
            for (var i = 0; i < (beforeArr || []).length; i++) setB[beforeArr[i]] = true;
            var out = [];
            for (var j = 0; j < (afterArr || []).length; j++) if (!setB[afterArr[j]]) out.push(afterArr[j]);
            return out;
        }

        function findGroupByName(parent, name) {
            if (!parent) return null;
            try {
                for (var i = 1; i <= parent.numProperties; i++) {
                    var g = parent.property(i);
                    if (g && g.name === name) return g;
                }
            } catch (e) {}
            return null;
        }

        function findMinKeyTimeInGroup(group) {
            var minT = null;
            function walk(g) {
                if (!g) return;
                try {
                    if (typeof g.numProperties === 'number' && g.numProperties > 0) {
                        for (var i = 1; i <= g.numProperties; i++) walk(g.property(i));
                    } else {
                        if (typeof g.numKeys === 'number' && g.numKeys > 0) {
                            var t0 = g.keyTime(1);
                            if (minT == null || t0 < minT) minT = t0;
                        }
                    }
                } catch (e) {}
            }
            walk(group);
            return minT;
        }

        function removeKeyAtTime(prop, time) {
            if (!prop || typeof prop.numKeys !== 'number') return;
            for (var i = 1; i <= prop.numKeys; i++) {
                try {
                    var t = prop.keyTime(i);
                    if (Math.abs(t - time) < 1e-4) { prop.removeKey(i); break; }
                } catch (e) {}
            }
        }

        if (m === 'offset') {
        for (var li = 0; li < sel.length; li++) {
            var layer = sel[li];

            // 记录应用预设前的基础变换属性当前值（作为偏移基线）
            var baseMap = {};
            var tProps = getTransformProps(layer);
            function cacheBase(prop) {
                if (!prop) return;
                var key = prop.matchName;
                try { baseMap[key] = prop.valueAtTime(now, false); } catch (eV) { baseMap[key] = prop.value; }
            }
            // 仅对指定基础属性做偏移（锚点不偏移）
            cacheBase(tProps && tProps.position);
            cacheBase(tProps && tProps.scale);
            cacheBase(tProps && tProps.rotation);
            cacheBase(tProps && tProps.opacity);

            // 记录预设应用前各基础属性已有关键帧时间，用于识别“新增加的关键帧”
            var beforeTimes = {};
            function recordBefore(prop) {
                if (!prop) return;
                beforeTimes[prop.matchName] = toTimeSet(prop);
            }
            recordBefore(tProps && tProps.position);
            recordBefore(tProps && tProps.scale);
            recordBefore(tProps && tProps.rotation);
            recordBefore(tProps && tProps.opacity);

            // 记录预设应用前效果/蒙版/样式组名称，用于识别新增组
            var eParade = layer.property("ADBE Effect Parade");
            var mParade = layer.property("ADBE Mask Parade");
            var sParade = layer.property("ADBE Layer Styles");
            var beforeE = getChildGroupNames(eParade);
            var beforeM = getChildGroupNames(mParade);
            var beforeS = getChildGroupNames(sParade);

            // 应用预设（让AE创建所有组和关键帧）
            // 为避免 AE 在多图层同时应用预设时发生冲突/崩溃，强制逐层“独占选择”应用
            var __prevSelRefs = [];
            try {
                for (var si = 1; si <= comp.numLayers; si++) {
                    var lyrSi = comp.layer(si);
                    __prevSelRefs.push({ layer: lyrSi, selected: !!(lyrSi && lyrSi.selected) });
                    try { lyrSi.selected = false; } catch (_) {}
                }
                try { layer.selected = true; } catch (_) {}
            } catch (_) {}

            try { layer.applyPreset(preset); } catch (eApply) {}
            // 轻微等待，给 AE 时间完成内部预设应用，降低崩溃概率
            try { $.sleep(1); } catch (_) {}

            // 获取应用后组名称并计算新增组
            eParade = layer.property("ADBE Effect Parade");
            mParade = layer.property("ADBE Mask Parade");
            sParade = layer.property("ADBE Layer Styles");
            var afterE = getChildGroupNames(eParade);
            var afterM = getChildGroupNames(mParade);
            var afterS = getChildGroupNames(sParade);
            var newE = diffNames(afterE, beforeE);
            var newM = diffNames(afterM, beforeM);
            var newS = diffNames(afterS, beforeS);

            // 计算“新增关键帧”的最早时间 gMin（非基础属性），以便统一时间平移到 now
            var gMin = null;

            function updateMinFromNewKeys(prop, beforeSet) {
                if (!prop) return;
                try {
                    if (prop.numKeys < 1) return;
                    for (var i = 1; i <= prop.numKeys; i++) {
                        var t = prop.keyTime(i);
                        var tag = t.toFixed(5);
                        if (!beforeSet || !beforeSet[tag]) {
                            if (gMin == null || t < gMin) gMin = t;
                        }
                    }
                } catch (e) {}
            }

            updateMinFromNewKeys(tProps && tProps.position, beforeTimes[tProps && tProps.position ? tProps.position.matchName : ""]);
            updateMinFromNewKeys(tProps && tProps.scale, beforeTimes[tProps && tProps.scale ? tProps.scale.matchName : ""]);
            updateMinFromNewKeys(tProps && tProps.rotation, beforeTimes[tProps && tProps.rotation ? tProps.rotation.matchName : ""]);
            updateMinFromNewKeys(tProps && tProps.opacity, beforeTimes[tProps && tProps.opacity ? tProps.opacity.matchName : ""]);

            function updateMinFromNewGroupNames(parent, names) {
                if (!parent || !names || names.length === 0) return;
                for (var i = 0; i < names.length; i++) {
                    var grp = findGroupByName(parent, names[i]);
                    var t0 = findMinKeyTimeInGroup(grp);
                    if (t0 != null && (gMin == null || t0 < gMin)) gMin = t0;
                }
            }

            updateMinFromNewGroupNames(eParade, newE);
            updateMinFromNewGroupNames(mParade, newM);
            updateMinFromNewGroupNames(sParade, newS);

            if (gMin == null) {
                // 若非基础属性没有新增关键帧，则跳过组时间平移，但继续处理基础属性
            }

            var delta = (gMin != null) ? (now - gMin) : 0;

            // 先平移新增的效果/蒙版/样式组关键帧的时间
            function shiftNewGroups(parent, names, d) {
                if (!parent || !names || names.length === 0 || Math.abs(d) < 1e-8) return;
                for (var i = 0; i < names.length; i++) {
                    var grp = findGroupByName(parent, names[i]);
                    shiftKeysRecursive(grp, d);
                }
            }

            shiftNewGroups(eParade, newE, delta);
            shiftNewGroups(mParade, newM, delta);
            shiftNewGroups(sParade, newS, delta);

            // 创建临时图层读取预设的基础属性关键帧（避免与原有关键帧时间重叠导致误判）
            var tmp = comp.layers.addSolid([0,0,0], "__MOGU_TMP_TRANS__", comp.width, comp.height, comp.pixelAspect, comp.duration);
            tmp.enabled = false; tmp.shy = true; tmp.locked = true; try { tmp.threeDLayer = true; } catch (e3D) {}
            try { tmp.applyPreset(preset); } catch (eTmpTrans) {}

            var tmpT = tmp.property("ADBE Transform Group");
            var tmpMap = {
                "ADBE Anchor Point": tmpT ? tmpT.property("ADBE Anchor Point") : null,
                "ADBE Position": tmpT ? tmpT.property("ADBE Position") : null,
                "ADBE Scale": tmpT ? tmpT.property("ADBE Scale") : null,
                "ADBE Rotate Z": tmpT ? tmpT.property("ADBE Rotate Z") : null,
                "ADBE Opacity": tmpT ? tmpT.property("ADBE Opacity") : null,
                "ADBE Orientation": tmpT ? tmpT.property("ADBE Orientation") : null,
                "ADBE Rotate X": tmpT ? tmpT.property("ADBE Rotate X") : null,
                "ADBE Rotate Y": tmpT ? tmpT.property("ADBE Rotate Y") : null
            };

            // 偏移模式：基础属性按“全局首帧”整体时间偏移（取临时图层各基础属性首帧的最小值）
            var gStartBaseTmp = null;
            try {
                for (var _k in tmpMap) {
                    var _sp = tmpMap[_k];
                    if (_sp && _sp.numKeys > 0) {
                        var _tFirst = _sp.keyTime(1);
                        if (gStartBaseTmp == null || _tFirst < gStartBaseTmp) gStartBaseTmp = _tFirst;
                    }
                }
            } catch (e_gs) {}

            function processTransformFromTmp(dstProp, srcProp) {
                if (!dstProp || !srcProp || srcProp.numKeys < 1) return;
                try {
                    // 移除目标属性中“新增的预设关键帧”（仅删除应用预设后新增的时间点）
                    var beforeSet = beforeTimes[dstProp.matchName] || {};
                    for (var i = dstProp.numKeys; i >= 1; i--) {
                        var tDel = dstProp.keyTime(i);
                        if (!beforeSet[tDel.toFixed(5)]) { try { dstProp.removeKey(i); } catch (eDel) {} }
                    }

                    // 偏移基线
                    var baseVal = baseMap[dstProp.matchName];
                    if (typeof baseVal === 'undefined') {
                        try { baseVal = dstProp.valueAtTime(now, false); } catch (eB) { baseVal = dstProp.value; }
                    }

                    // 源首帧值；时间以“全局首帧”作为参照，确保整体排列
                    var t0Global = gStartBaseTmp != null ? gStartBaseTmp : srcProp.keyTime(1);
                    var v0 = srcProp.keyValue(1);

                    // 写入偏移后的关键帧
                    for (var k = 1; k <= srcProp.numKeys; k++) {
                        var tSrc = srcProp.keyTime(k);
                        var vSrc = srcProp.keyValue(k);
                        var deltaVal = isNumericValue(vSrc) ? subValue(vSrc, v0) : vSrc;
                        var vNew = isNumericValue(vSrc) ? addValue(baseVal, deltaVal) : vSrc;
                        var tNew = now + (tSrc - t0Global);
                        addKeyframeWithRef(dstProp, tNew, vNew, srcProp, k);
                    }

                    // 仅当该属性的首帧就是“全局首帧”时，才在 now 写入起始关键帧，保证整体排列
                    if (srcProp.numKeys && srcProp.keyTime(1) === t0Global) {
                        try {
                            var nk = dstProp.nearestKeyIndex ? dstProp.nearestKeyIndex(now) : 0;
                            var hasNow = false;
                            if (nk) {
                                var tn = dstProp.keyTime(nk);
                                hasNow = Math.abs(tn - now) < 1e-4;
                            }
                            if (!hasNow) { addKeyframeWithRef(dstProp, now, baseVal, srcProp, 1); }
                        } catch (eStart) { try { dstProp.setValueAtTime(now, baseVal); } catch (eSet) {} }
                    }
                } catch (ePT) {}
            }

            // 平移非基础属性组后的关键帧时间
            shiftNewGroups(eParade, newE, delta);
            shiftNewGroups(mParade, newM, delta);
            shiftNewGroups(sParade, newS, delta);

            // 处理基础属性（从临时图层读取、按当前值偏移）
            processTransformFromTmp(tProps && tProps.anchor, tmpMap["ADBE Anchor Point"]);
            processTransformFromTmp(tProps && tProps.position, tmpMap["ADBE Position"]);
            processTransformFromTmp(tProps && tProps.scale, tmpMap["ADBE Scale"]);
            processTransformFromTmp(tProps && tProps.rotation, tmpMap["ADBE Rotate Z"]);
            processTransformFromTmp(tProps && tProps.opacity, tmpMap["ADBE Opacity"]);
            // 3D层附加属性
            processTransformFromTmp(tProps && tProps.orientation, tmpMap["ADBE Orientation"]);
            processTransformFromTmp(tProps && tProps.rotateX, tmpMap["ADBE Rotate X"]);
            processTransformFromTmp(tProps && tProps.rotateY, tmpMap["ADBE Rotate Y"]);
            processTransformFromTmp(tProps && tProps.rotateZ, tmpMap["ADBE Rotate Z"]);

            // 摄像机专属属性：临时固态层无法读取，改用目标层“新增关键帧”方式处理
            // 计算摄像机属性新增关键帧的“全局首帧”时间（POI/Direction一起评估）
            var camGlobalStart = null;
            try {
                var _camProps = [tProps && tProps.pointOfInterest, tProps && tProps.direction];
                for (var ci = 0; ci < _camProps.length; ci++) {
                    var cp = _camProps[ci]; if (!cp || cp.numKeys < 1) continue;
                    var beforeSetCP = beforeTimes[cp.matchName] || {};
                    for (var kcp = 1; kcp <= cp.numKeys; kcp++) {
                        var tcp = cp.keyTime(kcp); var tagcp = tcp.toFixed(5);
                        if (!beforeSetCP[tagcp]) { if (camGlobalStart == null || tcp < camGlobalStart) camGlobalStart = tcp; }
                    }
                }
            } catch (eCamStart) {}
            function processTransformFromTargetNewKeys(dstProp) {
                if (!dstProp) return;
                try {
                    var n = dstProp.numKeys;
                    if (n < 1) return;
                    var beforeSet = beforeTimes[dstProp.matchName] || {};
                    var newKeys = [];
                    var propMinNew = null;
                    for (var i = 1; i <= n; i++) {
                        var t = dstProp.keyTime(i);
                        var tag = t.toFixed(5);
                        if (!beforeSet[tag]) {
                            var v = dstProp.keyValue(i);
                            newKeys.push({ index: i, time: t, value: v });
                            if (propMinNew == null || t < propMinNew) propMinNew = t;
                        }
                    }
                    if (newKeys.length === 0) return;

                    var baseVal = baseMap[dstProp.matchName];
                    if (typeof baseVal === 'undefined') {
                        try { baseVal = dstProp.valueAtTime(now, false); } catch (eB) { baseVal = dstProp.value; }
                    }

                    var startVal = newKeys[0].value;
                    var refStart = camGlobalStart != null ? camGlobalStart : propMinNew;
                    var deltaProp = now - refStart;

                    // 写入偏移后的关键帧
                    for (var k = 0; k < newKeys.length; k++) {
                        var orig = newKeys[k];
                        var deltaVal = isNumericValue(orig.value) ? subValue(orig.value, startVal) : orig.value;
                        var vNew = isNumericValue(orig.value) ? addValue(baseVal, deltaVal) : orig.value;
                        var tNew = orig.time + deltaProp;
                        addKeyframeWithRef(dstProp, tNew, vNew, dstProp, orig.index);
                    }

                    // 起始关键帧：仅当该属性的新增首帧就是摄像机“全局首帧”时写入
                    if (propMinNew === refStart) {
                        try {
                            var nk = dstProp.nearestKeyIndex ? dstProp.nearestKeyIndex(now) : 0;
                            var hasNow = false;
                            if (nk) { var tn = dstProp.keyTime(nk); hasNow = Math.abs(tn - now) < 1e-4; }
                            if (!hasNow) { addKeyframeWithRef(dstProp, now, baseVal, dstProp, newKeys[0].index); }
                        } catch (eStart2) { try { dstProp.setValueAtTime(now, baseVal); } catch (eSet2) {} }
                    }

                    // 删除原新增关键帧
                    for (var r = 0; r < newKeys.length; r++) {
                        removeKeyAtTime(dstProp, newKeys[r].time);
                    }
                } catch (eCam) {}
            }

            processTransformFromTargetNewKeys(tProps && tProps.pointOfInterest);
            processTransformFromTargetNewKeys(tProps && tProps.direction);

            // 清理临时图层
            try { tmp.locked = false; tmp.shy = false; tmp.enabled = true; } catch (eAdj2) {}
            try { tmp.remove(); } catch (eRem2) {}

            // 恢复之前的选择状态
            try {
                for (var rsi = 0; rsi < __prevSelRefs.length; rsi++) {
                    var itemRef = __prevSelRefs[rsi];
                    if (itemRef && itemRef.layer) {
                        try { itemRef.layer.selected = itemRef.selected; } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        } else {
            // 最后一帧模式：以当前时间的基础属性值作为预设动画的“最后一帧”，并将新增关键帧整体对齐到当前时间的结束点
            function findMaxKeyTimeInGroup(group) {
                var maxT = null;
                function walk(g) {
                    if (!g) return;
                    try {
                        if (typeof g.numProperties === 'number' && g.numProperties > 0) {
                            for (var i = 1; i <= g.numProperties; i++) walk(g.property(i));
                        } else {
                            if (typeof g.numKeys === 'number' && g.numKeys > 0) {
                                var tN = g.keyTime(g.numKeys);
                                if (maxT == null || tN > maxT) maxT = tN;
                            }
                        }
                    } catch (e) {}
                }
                walk(group);
                return maxT;
            }

            for (var li2 = 0; li2 < sel.length; li2++) {
                var layer2 = sel[li2];

                var baseMap2 = {};
                var tProps2 = getTransformProps(layer2);
                function cacheBase2(prop) { if (!prop) return; var key = prop.matchName; try { baseMap2[key] = prop.valueAtTime(now, false); } catch (eV2) { baseMap2[key] = prop.value; } }
                cacheBase2(tProps2 && tProps2.anchor);
                cacheBase2(tProps2 && tProps2.position);
                cacheBase2(tProps2 && tProps2.scale);
                cacheBase2(tProps2 && tProps2.rotation);
                cacheBase2(tProps2 && tProps2.opacity);
                cacheBase2(tProps2 && tProps2.orientation);
                cacheBase2(tProps2 && tProps2.rotateX);
                cacheBase2(tProps2 && tProps2.rotateY);
                cacheBase2(tProps2 && tProps2.rotateZ);
                cacheBase2(tProps2 && tProps2.pointOfInterest);
                cacheBase2(tProps2 && tProps2.direction);

                var beforeTimes2 = {};
                function recordBefore2(prop) { if (!prop) return; beforeTimes2[prop.matchName] = toTimeSet(prop); }
                recordBefore2(tProps2 && tProps2.anchor);
                recordBefore2(tProps2 && tProps2.position);
                recordBefore2(tProps2 && tProps2.scale);
                recordBefore2(tProps2 && tProps2.rotation);
                recordBefore2(tProps2 && tProps2.opacity);
                recordBefore2(tProps2 && tProps2.orientation);
                recordBefore2(tProps2 && tProps2.rotateX);
                recordBefore2(tProps2 && tProps2.rotateY);
                recordBefore2(tProps2 && tProps2.rotateZ);
                recordBefore2(tProps2 && tProps2.pointOfInterest);
                recordBefore2(tProps2 && tProps2.direction);

                var e2 = layer2.property("ADBE Effect Parade");
                var m2 = layer2.property("ADBE Mask Parade");
                var s2 = layer2.property("ADBE Layer Styles");
                var beforeE2 = getChildGroupNames(e2);
                var beforeM2 = getChildGroupNames(m2);
                var beforeS2 = getChildGroupNames(s2);

                // 记录应用预设前：效果/蒙版/图层样式各子组中“叶子属性”的关键帧时间集合
                function forEachLeafProp(group, cb) {
                    if (!group) return;
                    try {
                        if (typeof group.numProperties === 'number' && group.numProperties > 0) {
                            for (var i = 1; i <= group.numProperties; i++) {
                                var child = group.property(i);
                                // 递归遍历到叶子属性
                                if (child && typeof child.numProperties === 'number' && child.numProperties > 0) {
                                    forEachLeafProp(child, cb);
                                } else {
                                    cb(child);
                                }
                            }
                        }
                    } catch (e) {}
                }

                function buildBeforeLeafTimeMap(parent) {
                    var map = {};
                    if (!parent) return map;
                    try {
                        for (var i = 1; i <= parent.numProperties; i++) {
                            var g = parent.property(i);
                            if (!g) continue;
                            var gName = g.name;
                            var leafTimes = {};
                            forEachLeafProp(g, function(prop){ if (prop) { leafTimes[prop.matchName] = toTimeSet(prop); } });
                            map[gName] = leafTimes;
                        }
                    } catch (e) {}
                    return map;
                }

                var beforeLeafEMap = buildBeforeLeafTimeMap(e2);
                var beforeLeafMMap = buildBeforeLeafTimeMap(m2);
                var beforeLeafSMap = buildBeforeLeafTimeMap(s2);

                // 为避免 AE 在多图层同时应用预设时发生冲突/崩溃，强制逐层“独占选择”应用
                var __prevSelRefs = [];
                try {
                    for (var si = 1; si <= comp.numLayers; si++) {
                        var lyrSi = comp.layer(si);
                        __prevSelRefs.push({ layer: lyrSi, selected: !!(lyrSi && lyrSi.selected) });
                        try { lyrSi.selected = false; } catch (_) {}
                    }
                    try { layer2.selected = true; } catch (_) {}
                } catch (_) {}

                try { layer2.applyPreset(preset); } catch (eApply2) {}
                // 轻微等待，给 AE 时间完成内部预设应用，降低崩溃概率
                try { $.sleep(1); } catch (_) {}

                e2 = layer2.property("ADBE Effect Parade");
                m2 = layer2.property("ADBE Mask Parade");
                s2 = layer2.property("ADBE Layer Styles");
                var afterE2 = getChildGroupNames(e2);
                var afterM2 = getChildGroupNames(m2);
                var afterS2 = getChildGroupNames(s2);
                var newE2 = diffNames(afterE2, beforeE2);
                var newM2 = diffNames(afterM2, beforeM2);
                var newS2 = diffNames(afterS2, beforeS2);

                var gMax2 = null;
                function updateMaxFromNewGroup(parent, names) {
                    if (!parent || !names || names.length === 0) return;
                    for (var i = 0; i < names.length; i++) {
                        var grp = findGroupByName(parent, names[i]);
                        var tLast = findMaxKeyTimeInGroup(grp);
                        if (tLast != null && (gMax2 == null || tLast > gMax2)) gMax2 = tLast;
                    }
                }
                updateMaxFromNewGroup(e2, newE2);
                updateMaxFromNewGroup(m2, newM2);
                updateMaxFromNewGroup(s2, newS2);

                // 计算“已存在组但新增了关键帧”的全局末帧时间（用于整体偏移）
                function computeExistingGroupsMaxNew(parent, beforeLeafMap, excludeNames) {
                    var excludeSet = {}; for (var i = 0; i < (excludeNames || []).length; i++) excludeSet[excludeNames[i]] = true;
                    var gMax = null;
                    if (!parent) return gMax;
                    try {
                        for (var gi = 1; gi <= parent.numProperties; gi++) {
                            var grp = parent.property(gi);
                            if (!grp) continue;
                            var gName = grp.name; if (excludeSet[gName]) continue;
                            var beforeLeaf = beforeLeafMap[gName] || {};
                            // 遍历叶子属性，找出新增关键帧的最大时间
                            (function forEachLeafPropLocal(group){
                                if (!group) return;
                                if (typeof group.numProperties === 'number' && group.numProperties > 0) {
                                    for (var ci = 1; ci <= group.numProperties; ci++) forEachLeafPropLocal(group.property(ci));
                                } else {
                                    var prop = group;
                                    if (!prop || typeof prop.numKeys !== 'number' || prop.numKeys < 1) return;
                                    var beforeSet = beforeLeaf[prop.matchName] || {};
                                    for (var k = 1; k <= prop.numKeys; k++) {
                                        var t = prop.keyTime(k); var tag = t.toFixed(5);
                                        if (!beforeSet[tag]) { if (gMax == null || t > gMax) gMax = t; }
                                    }
                                }
                            })(grp);
                        }
                    } catch (e) {}
                    return gMax;
                }

                var gMaxExistE = computeExistingGroupsMaxNew(e2, beforeLeafEMap, newE2);
                var gMaxExistM = computeExistingGroupsMaxNew(m2, beforeLeafMMap, newM2);
                var gMaxExistS = computeExistingGroupsMaxNew(s2, beforeLeafSMap, newS2);

                // 全局末帧：取“新建组的末帧”和“现有组新增关键帧的末帧”中的最大值
                var globalMax = gMax2;
                if (gMaxExistE != null && (globalMax == null || gMaxExistE > globalMax)) globalMax = gMaxExistE;
                if (gMaxExistM != null && (globalMax == null || gMaxExistM > globalMax)) globalMax = gMaxExistM;
                if (gMaxExistS != null && (globalMax == null || gMaxExistS > globalMax)) globalMax = gMaxExistS;
                var deltaAll = (globalMax != null) ? (now - globalMax) : 0;

                function shiftNewGroups2(parent, names, d) { if (!parent || !names || names.length === 0 || Math.abs(d) < 1e-8) return; for (var i = 0; i < names.length; i++) { var grp = findGroupByName(parent, names[i]); shiftKeysRecursive(grp, d); } }
                shiftNewGroups2(e2, newE2, deltaAll);
                shiftNewGroups2(m2, newM2, deltaAll);
                shiftNewGroups2(s2, newS2, deltaAll);

                // 对“已存在的组但新增了关键帧”的情况：仅整体平移这些新增关键帧（不影响原有关键帧）
                function shiftNewKeysInExistingGroups(parent, beforeLeafMap, excludeNames, dGlobal) {
                    if (!parent) return;
                    var excludeSet = {};
                    for (var i = 0; i < (excludeNames || []).length; i++) excludeSet[excludeNames[i]] = true;
                    try {
                        for (var gi = 1; gi <= parent.numProperties; gi++) {
                            var grp = parent.property(gi);
                            if (!grp) continue;
                            var gName = grp.name;
                            if (excludeSet[gName]) continue; // 新增组已整体平移，跳过

                            var beforeLeaf = beforeLeafMap[gName] || {};
                            var groupNewKeys = []; // {prop, index, time, value}

                            // 收集该组内所有叶子属性的“新增关键帧”
                            forEachLeafProp(grp, function(prop){
                                if (!prop || typeof prop.numKeys !== 'number' || prop.numKeys < 1) return;
                                var beforeSet = beforeLeaf[prop.matchName] || {};
                                for (var k = 1; k <= prop.numKeys; k++) {
                                    var t = prop.keyTime(k);
                                    var tag = t.toFixed(5);
                                    if (!beforeSet[tag]) {
                                        var v = prop.keyValue(k);
                                        groupNewKeys.push({ prop: prop, index: k, time: t, value: v });
                                    }
                                }
                            });

                            if (groupNewKeys.length === 0) continue;
                            var d = dGlobal;
                            if (Math.abs(d) < 1e-8) continue;

                            // 整体平移：先写入偏移后的副本，再删除原新增关键帧
                            for (var nk = 0; nk < groupNewKeys.length; nk++) {
                                var item = groupNewKeys[nk];
                                var tNew = item.time + d;
                                // 效果/样式/蒙版的叶子属性仅做时间平移，数值保持不变
                                try { addKeyframeWithRef(item.prop, tNew, item.value, item.prop, item.index); } catch (eAdd) {}
                            }
                            for (var rk = 0; rk < groupNewKeys.length; rk++) {
                                try { removeKeyAtTime(groupNewKeys[rk].prop, groupNewKeys[rk].time); } catch (eRm) {}
                            }
                        }
                    } catch (eG) {}
                }

                shiftNewKeysInExistingGroups(e2, beforeLeafEMap, newE2, deltaAll);
                shiftNewKeysInExistingGroups(m2, beforeLeafMMap, newM2, deltaAll);
                shiftNewKeysInExistingGroups(s2, beforeLeafSMap, newS2, deltaAll);

                // 临时图层读取基础属性关键帧（以末帧对齐）
                var tmp2 = comp.layers.addSolid([0,0,0], "__MOGU_TMP_LAST__", comp.width, comp.height, comp.pixelAspect, comp.duration);
                tmp2.enabled = false; tmp2.shy = true; tmp2.locked = true; try { tmp2.threeDLayer = true; } catch (e3DL) {}
                try { tmp2.applyPreset(preset); } catch (eTmp2) {}
                var tmpT2 = tmp2.property("ADBE Transform Group");
                var tmpMap2 = {
                    "ADBE Anchor Point": tmpT2 ? tmpT2.property("ADBE Anchor Point") : null,
                    "ADBE Position": tmpT2 ? tmpT2.property("ADBE Position") : null,
                    "ADBE Scale": tmpT2 ? tmpT2.property("ADBE Scale") : null,
                    "ADBE Rotate Z": tmpT2 ? tmpT2.property("ADBE Rotate Z") : null,
                    "ADBE Opacity": tmpT2 ? tmpT2.property("ADBE Opacity") : null,
                    "ADBE Orientation": tmpT2 ? tmpT2.property("ADBE Orientation") : null,
                    "ADBE Rotate X": tmpT2 ? tmpT2.property("ADBE Rotate X") : null,
                    "ADBE Rotate Y": tmpT2 ? tmpT2.property("ADBE Rotate Y") : null,
                    "ADBE Rotate Z": tmpT2 ? tmpT2.property("ADBE Rotate Z") : null
                };

                // 以“全局末帧”作为最后帧模式的整体时间参照（临时图层各基础属性末帧的最大值）
                var gEndBaseTmp2 = null;
                try {
                    for (var gk in tmpMap2) {
                        var sp2 = tmpMap2[gk];
                        if (sp2 && sp2.numKeys > 0) {
                            var tLast2 = sp2.keyTime(sp2.numKeys);
                            if (gEndBaseTmp2 == null || tLast2 > gEndBaseTmp2) gEndBaseTmp2 = tLast2;
                        }
                    }
                } catch (eGE2) {}

                function clearNewPresetKeys2(dstProp, beforeSet) {
                    if (!dstProp) return;
                    try { for (var i = dstProp.numKeys; i >= 1; i--) { var tDel = dstProp.keyTime(i); if (!beforeSet || !beforeSet[tDel.toFixed(5)]) { try { dstProp.removeKey(i); } catch (eDel2) {} } } } catch (eCl) {}
                }

                function processTransformFromTmpLast(dstProp, srcProp) {
                    if (!dstProp || !srcProp || srcProp.numKeys < 1) return;
                    try {
                        clearNewPresetKeys2(dstProp, beforeTimes2[dstProp.matchName]);
                        var baseVal = baseMap2[dstProp.matchName];
                        if (typeof baseVal === 'undefined') { try { baseVal = dstProp.valueAtTime(now, false); } catch (eB2) { baseVal = dstProp.value; } }
                        var tRefGlobal = gEndBaseTmp2 != null ? gEndBaseTmp2 : srcProp.keyTime(srcProp.numKeys);
                        var vRef = srcProp.keyValue(srcProp.numKeys);
                        for (var k = 1; k <= srcProp.numKeys; k++) {
                            var tSrc = srcProp.keyTime(k);
                            var vSrc = srcProp.keyValue(k);
                            var deltaVal = isNumericValue(vSrc) ? subValue(vSrc, vRef) : vSrc;
                            var vNew = isNumericValue(vSrc) ? addValue(baseVal, deltaVal) : vSrc;
                            var tNew = now + (tSrc - tRefGlobal);
                            addKeyframeWithRef(dstProp, tNew, vNew, srcProp, k);
                        }
                        // 仅当该属性的末帧就是“全局末帧”时，才在 now 写入末帧对齐关键帧，保证整体排列
                        if (srcProp.numKeys && srcProp.keyTime(srcProp.numKeys) === tRefGlobal) {
                            try { var nk = dstProp.nearestKeyIndex ? dstProp.nearestKeyIndex(now) : 0; var hasNow = false; if (nk) { var tn = dstProp.keyTime(nk); hasNow = Math.abs(tn - now) < 1e-4; } if (!hasNow) { addKeyframeWithRef(dstProp, now, baseVal, srcProp, srcProp.numKeys); } } catch (eEndSet) { try { dstProp.setValueAtTime(now, baseVal); } catch (eSetEnd) {} }
                        }
                    } catch (ePL) {}
                }

                processTransformFromTmpLast(tProps2 && tProps2.anchor, tmpMap2["ADBE Anchor Point"]);
                processTransformFromTmpLast(tProps2 && tProps2.position, tmpMap2["ADBE Position"]);
                processTransformFromTmpLast(tProps2 && tProps2.scale, tmpMap2["ADBE Scale"]);
                processTransformFromTmpLast(tProps2 && tProps2.rotation, tmpMap2["ADBE Rotate Z"]);
                processTransformFromTmpLast(tProps2 && tProps2.opacity, tmpMap2["ADBE Opacity"]);
                processTransformFromTmpLast(tProps2 && tProps2.orientation, tmpMap2["ADBE Orientation"]);
                processTransformFromTmpLast(tProps2 && tProps2.rotateX, tmpMap2["ADBE Rotate X"]);
                processTransformFromTmpLast(tProps2 && tProps2.rotateY, tmpMap2["ADBE Rotate Y"]);
                processTransformFromTmpLast(tProps2 && tProps2.rotateZ, tmpMap2["ADBE Rotate Z"]);

                // 摄像机属性新增关键帧的“全局末帧”（POI/Direction一起评估）
                var camGlobalEnd = null;
                try {
                    var camProps2 = [tProps2 && tProps2.pointOfInterest, tProps2 && tProps2.direction];
                    for (var ci2 = 0; ci2 < camProps2.length; ci2++) {
                        var cp = camProps2[ci2]; if (!cp || cp.numKeys < 1) continue;
                        var beforeSetCam = beforeTimes2[cp.matchName] || {};
                        for (var kc = 1; kc <= cp.numKeys; kc++) {
                            var tc = cp.keyTime(kc); var tagc = tc.toFixed(5);
                            if (!beforeSetCam[tagc]) { if (camGlobalEnd == null || tc > camGlobalEnd) camGlobalEnd = tc; }
                        }
                    }
                } catch (eCamGE) {}

                function processTransformFromTargetNewKeysLast(dstProp) {
                    if (!dstProp) return;
                    try {
                        var n = dstProp.numKeys; if (n < 1) return;
                        var beforeSet = beforeTimes2[dstProp.matchName] || {};
                        var newKeys = []; var propMaxNew = null;
                        for (var i = 1; i <= n; i++) {
                            var t = dstProp.keyTime(i); var tag = t.toFixed(5);
                            if (!beforeSet[tag]) { var v = dstProp.keyValue(i); newKeys.push({ index: i, time: t, value: v }); if (propMaxNew == null || t > propMaxNew) propMaxNew = t; }
                        }
                        if (newKeys.length === 0) return;
                        var baseVal = baseMap2[dstProp.matchName]; if (typeof baseVal === 'undefined') { try { baseVal = dstProp.valueAtTime(now, false); } catch (eB3) { baseVal = dstProp.value; } }
                        var endVal = newKeys[newKeys.length - 1].value; var refEnd = camGlobalEnd != null ? camGlobalEnd : propMaxNew; var deltaProp = now - refEnd;
                        for (var k = 0; k < newKeys.length; k++) { var orig = newKeys[k]; var deltaVal = isNumericValue(orig.value) ? subValue(orig.value, endVal) : orig.value; var vNew = isNumericValue(orig.value) ? addValue(baseVal, deltaVal) : orig.value; var tNew = orig.time + deltaProp; addKeyframeWithRef(dstProp, tNew, vNew, dstProp, orig.index); }
                        // 末帧对齐：仅当该属性的新增末帧就是摄像机“全局末帧”时写入 now
                        try { if (propMaxNew === refEnd) { var nk = dstProp.nearestKeyIndex ? dstProp.nearestKeyIndex(now) : 0; var hasNow = false; if (nk) { var tn = dstProp.keyTime(nk); hasNow = Math.abs(tn - now) < 1e-4; } if (!hasNow) { addKeyframeWithRef(dstProp, now, baseVal, dstProp, newKeys[newKeys.length - 1].index); } } } catch (eStart4) { try { dstProp.setValueAtTime(now, baseVal); } catch (eSet4) {} }
                        for (var r = 0; r < newKeys.length; r++) { removeKeyAtTime(dstProp, newKeys[r].time); }
                    } catch (eCamLast) {}
                }

                processTransformFromTargetNewKeysLast(tProps2 && tProps2.pointOfInterest);
                processTransformFromTargetNewKeysLast(tProps2 && tProps2.direction);

                try { tmp2.locked = false; tmp2.shy = false; tmp2.enabled = true; } catch (_) {}
                try { tmp2.remove(); } catch (_) {}

                // 恢复之前的选择状态
                try {
                    for (var rsi = 0; rsi < __prevSelRefs.length; rsi++) {
                        var itemRef = __prevSelRefs[rsi];
                        if (itemRef && itemRef.layer) {
                            try { itemRef.layer.selected = itemRef.selected; } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
        }

        app.endUndoGroup();
        return "OK";
    } catch (e) {
        try { app.endUndoGroup(); } catch (_) {}
        return "Error:" + e.toString();
    }
}

/**
 * [预设管理器-获取子文件夹]+[功能名称]+[详细描述] 获取指定路径下的直接子文件夹列表
 * @param {String} rootPath - 预设根目录路径
 * @returns {String} JSON字符串数组，包含子文件夹名称列表
 */
function getPresetSubFolders(rootPath) {
    try {
        if (!rootPath || typeof rootPath !== 'string') {
            return "Error: 无效的根目录路径";
        }
        
        // [预设管理器-获取子文件夹]+[步骤]+[1] 解码路径，处理中文和特殊字符
        var decoded = rootPath;
        try {
            decoded = decodeURIComponent(rootPath);
        } catch (e) {
            // 如果解码失败，使用原始路径
            decoded = rootPath;
        }
        
        // [预设管理器-获取子文件夹]+[步骤]+[2] 创建文件夹对象
        var rootFolder = new Folder(decoded);
        if (!rootFolder.exists) {
            return "Error: 根目录不存在";
        }
        
        // [预设管理器-获取子文件夹]+[步骤]+[3] 获取所有文件和文件夹
        var subFolders = [];
        var files = rootFolder.getFiles();
        
        // [预设管理器-获取子文件夹]+[步骤]+[4] 筛选出文件夹并处理中文名称
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file instanceof Folder) {
                // 确保文件夹名称正确编码，避免中文显示问题
                var folderName = file.name;
                try {
                    // 如果名称包含非ASCII字符，进行URL编码以确保传输安全
                    if (/[^\x00-\x7F]/.test(folderName)) {
                        folderName = encodeURIComponent(folderName);
                    }
                } catch (e) {
                    // 编码失败时使用原始名称
                }
                subFolders.push(folderName);
            }
        }
        
        // [预设管理器-获取子文件夹]+[步骤]+[5] 返回JSON格式的文件夹名称列表
        return JSON.stringify(subFolders);
        
    } catch (e) {
        return "Error: " + e.toString();
    }
}
