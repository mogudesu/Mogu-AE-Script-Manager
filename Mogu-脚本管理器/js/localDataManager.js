// 鏈湴鏁版嵁绠＄悊鍣?- 灏嗘暟鎹瓨鍌ㄥ湪鑴氭湰鑷韩鐨刣ata鏂囦欢澶逛腑
// Local Data Manager - Store data in script's own data folder

var LocalDataManager = {
    // 鏁版嵁鏂囦欢澶硅矾寰?    dataFolderPath: null,
    dataFilePath: null,
    initialized: false,
    
    // 鏁版嵁鏂囦欢鍚嶉厤缃?    dataFiles: {
        main: 'settings.json',           // 涓昏缃枃浠?        scripts: 'scripts.json',         // 鑴氭湰璁剧疆
        categories: 'categories.json',   // 鍒嗙被鏁版嵁
        tags: 'tags.json',              // 鏍囩鏁版嵁
        backgrounds: 'backgrounds.json', // 鑳屾櫙璁剧疆
        layout: 'layout.json'           // 甯冨眬璁剧疆
    },
    
    // 榛樿鏁版嵁缁撴瀯
    defaultData: {
        main: {
            version: "2.0",
            language: "zh-CN", // 鏂板锛氳瑷€璁剧疆
            scriptsFolderPath: null,
            dataStorageFolderPath: null,
            autoReadSubfolders: false,
            lastSaved: null,
            dataStorageVersion: "local_v1"
        },
        scripts: {},
        categories: ["鍏ㄩ儴"],
        tags: [],
        backgrounds: {
            currentBackground: null,
            backgroundSettings: null
        },
        layout: {
            isGridLayout: false,
            currentScale: 1,
            presetScale: 1,
            sidebarWidthScript: 100,
            sidebarWidthPreset: 100,
            scriptOrder: []
        }
    },

    normalizeDataFolderPath: function(path) {
        try {
            if (path == null) return null;
            var p = String(path);
            p = p.replace(/\\/g, '/').trim();
            if (!p) return null;
            while (p.length > 1 && /\/$/.test(p)) p = p.slice(0, -1);
            return p;
        } catch (_) {
            return null;
        }
    },

    getPreferredDataFolderPath: function(extensionRootPath) {
        try {
            var self = this;
            function isDirWritable(dirPath, createIfMissing) {
                try {
                    if (!dirPath) return false;
                    if (!window.cep || !window.cep.fs) return false;
                    var p = self.normalizeDataFolderPath(dirPath);
                    if (!p) return false;

                    var st = null;
                    try { st = window.cep.fs.stat(p); } catch (_) { st = null; }
                    var isDir = !!(st && st.err === window.cep.fs.NO_ERROR && st.data && typeof st.data.isDirectory === 'function' && st.data.isDirectory());
                    if (!isDir) {
                        if (!createIfMissing) return false;
                        try {
                            var mk = window.cep.fs.makedir(p);
                            if (!mk || mk.err !== window.cep.fs.NO_ERROR) return false;
                        } catch (_) {
                            return false;
                        }
                        try { st = window.cep.fs.stat(p); } catch (_) { st = null; }
                        isDir = !!(st && st.err === window.cep.fs.NO_ERROR && st.data && typeof st.data.isDirectory === 'function' && st.data.isDirectory());
                        if (!isDir) return false;
                    }

                    if (typeof window.cep.fs.writeFile !== 'function') return false;
                    var testFile = p + '/.__mogu_write_test__.' + String(+new Date()) + '.tmp';
                    var w = window.cep.fs.writeFile(testFile, 'ok');
                    var ok = !!(w && w.err === window.cep.fs.NO_ERROR);
                    if (ok) {
                        try {
                            if (typeof window.cep.fs.deleteFile === 'function') window.cep.fs.deleteFile(testFile);
                            else if (typeof window.cep.fs.remove === 'function') window.cep.fs.remove(testFile);
                            else if (typeof window.cep.fs.delete === 'function') window.cep.fs.delete(testFile);
                        } catch (_) {}
                    }
                    return ok;
                } catch (_) {
                    return false;
                }
            }

            var candidates = [];
            var fromLS = null;
            try { fromLS = localStorage.getItem('mogu_data_storage_path'); } catch (_) { fromLS = null; }
            var lsPath = self.normalizeDataFolderPath(fromLS);

            try {
                if (!window.cep || !window.cep.fs || typeof window.cep.fs.readFile !== 'function') return null;
                if (typeof csInterface === 'undefined' || !csInterface || typeof csInterface.getSystemPath !== 'function') return null;
                var os = '';
                try { os = String(csInterface.getOSInformation ? csInterface.getOSInformation() : ''); } catch (_) { os = ''; }
                var isMac = os.indexOf('Mac') >= 0;
                var sep = isMac ? '/' : '\\';
                var userDir = csInterface.getSystemPath(SystemPath.USER_DATA);
                var extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
                var userConfig = userDir ? (String(userDir) + sep + 'MoguScriptManager' + sep + 'config.json') : null;
                var localConfig = extDir ? (String(extDir) + sep + 'data' + sep + 'config.json') : null;
                function shouldUseStoredPath(p, userDefault) {
                    try {
                        var v = self.normalizeDataFolderPath(p);
                        if (!v) return false;
                        var n = String(v).replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
                        var u = userDefault ? String(userDefault).replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase() : '';
                        var looksLikeUserDefault = n.indexOf('/appdata/roaming/moguscriptmanager/data') >= 0;
                        if (!looksLikeUserDefault) return true;
                        if (u && n === u) return true;
                        return false;
                    } catch (_) {
                        return false;
                    }
                }
                function readConfig(path) {
                    try {
                        if (!path) return null;
                        var r = window.cep.fs.readFile(path);
                        if (!r || r.err !== window.cep.fs.NO_ERROR) return null;
                        var raw = String(r.data || '').trim();
                        if (!raw) return null;
                        return JSON.parse(raw);
                    } catch (_) {
                        return null;
                    }
                }
                var cfg = readConfig(userConfig) || readConfig(localConfig);
                var cfgPath = cfg && (cfg.dataStorageFolderPath || cfg.dataFolderPath || cfg.storageFolderPath);
                var normalized = this.normalizeDataFolderPath(cfgPath);
                if (normalized) {
                    var userDataDefault = null;
                    try {
                        if (userDir) userDataDefault = self.normalizeDataFolderPath(String(userDir) + sep + 'MoguScriptManager' + sep + 'data');
                    } catch (_) { userDataDefault = null; }
                    if (shouldUseStoredPath(normalized, userDataDefault)) candidates.push(normalized);
                }

                try {
                    if (userDir) {
                        var userDataDefault = self.normalizeDataFolderPath(String(userDir) + sep + 'MoguScriptManager' + sep + 'data');
                        if (userDataDefault) candidates.push(userDataDefault);
                    }
                } catch (_) {}

                try {
                    var userDataDefaultForLS = null;
                    if (userDir) userDataDefaultForLS = self.normalizeDataFolderPath(String(userDir) + sep + 'MoguScriptManager' + sep + 'data');
                    if (lsPath && shouldUseStoredPath(lsPath, userDataDefaultForLS)) candidates.unshift(lsPath);
                } catch (_) {}
            } catch (_) {}

            var extDefault = self.normalizeDataFolderPath(extensionRootPath) ? (self.normalizeDataFolderPath(extensionRootPath) + "/data") : null;
            if (extDefault) candidates.push(extDefault);

            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                if (isDirWritable(c, true)) return self.normalizeDataFolderPath(c);
            }

            return extDefault;
        } catch (_) {
            return null;
        }
    },

    migrateKnownJsonFiles: function(oldFolderPath, newFolderPath) {
        try {
            if (!window.cep || !window.cep.fs) return;
            if (!oldFolderPath || !newFolderPath) return;
            var oldP = this.normalizeDataFolderPath(oldFolderPath);
            var newP = this.normalizeDataFolderPath(newFolderPath);
            if (!oldP || !newP || oldP === newP) return;
            var fileKeys = Object.keys(this.dataFiles || {});
            for (var i = 0; i < fileKeys.length; i++) {
                var key = fileKeys[i];
                var name = this.dataFiles[key];
                if (!name) continue;
                var src = oldP + "/" + name;
                var dst = newP + "/" + name;
                try {
                    var statDst = window.cep.fs.stat(dst);
                    if (statDst && statDst.err === window.cep.fs.NO_ERROR) continue;
                } catch (_) {}
                try {
                    var r = window.cep.fs.readFile(src);
                    if (!r || r.err !== window.cep.fs.NO_ERROR) continue;
                    var w = window.cep.fs.writeFile(dst, String(r.data || ''));
                    if (!w || w.err !== window.cep.fs.NO_ERROR) continue;
                } catch (_) {}
            }
        } catch (_) {}
    },

    setDataFolderPath: function(folderPath, callback) {
        var self = this;
        var cb = (typeof callback === 'function') ? callback : function() {};
        try {
            var normalized = self.normalizeDataFolderPath(folderPath);
            if (!normalized) { cb('鏃犳晥鐨勬暟鎹洰褰?); return; }
            try {
                if (window.cep && window.cep.fs) {
                    var st = window.cep.fs.stat(normalized);
                    var okDir = !!(st && st.err === window.cep.fs.NO_ERROR && st.data && typeof st.data.isDirectory === 'function' && st.data.isDirectory());
                    if (!okDir) {
                        var mk = window.cep.fs.makedir(normalized);
                        if (!mk || mk.err !== window.cep.fs.NO_ERROR) { cb('鏃犳硶鍒涘缓鏁版嵁鐩綍'); return; }
                    }
                    var testFile = normalized + '/.__mogu_write_test__.' + String(+new Date()) + '.tmp';
                    var w = window.cep.fs.writeFile(testFile, 'ok');
                    var writable = !!(w && w.err === window.cep.fs.NO_ERROR);
                    if (writable) {
                        try {
                            if (typeof window.cep.fs.deleteFile === 'function') window.cep.fs.deleteFile(testFile);
                            else if (typeof window.cep.fs.remove === 'function') window.cep.fs.remove(testFile);
                            else if (typeof window.cep.fs.delete === 'function') window.cep.fs.delete(testFile);
                        } catch (_) {}
                    }
                    if (!writable) { cb('鏁版嵁鐩綍涓嶅彲鍐?); return; }
                }
            } catch (_) {}
            var oldFolder = self.dataFolderPath;
            self.dataFolderPath = normalized;
            self.dataFilePath = self.dataFolderPath + "/" + self.dataFiles.main;
            try { window.dataStorageFolderPath = normalized; } catch (_) {}
            try { localStorage.setItem('mogu_data_storage_path', normalized); } catch (_) {}
            self.ensureDataFolder(function(err){
                if (!err) {
                    try { self.migrateKnownJsonFiles(oldFolder, normalized); } catch (_) {}
                }
                cb(err || null, true);
            });
        } catch (e) {
            cb(String(e));
        }
    },
    
    /**
     * 瀹夊叏瑙ｇ爜鏄剧ず鍚嶇О锛屽吋瀹瑰彲鑳界殑URI缂栫爜锛堝鍖呭惈%20锛?     * 鍔熻兘锛氭樉绀哄悕澶勭悊-宸ュ叿-01
     * @param {string} name - 杈撳叆鐨勬樉绀哄悕绉帮紝鍙兘涓烘湭缂栫爜鎴朥RI缂栫爜
     * @returns {string} 杩斿洖瀹夊叏瑙ｇ爜涓斿幓闄ら灏剧┖鐧藉悗鐨勫瓧绗︿覆锛涘鏃犳晥杈撳叆杩斿洖鍘熷€?     */
    safeDecodeDisplayName: function(name) {
        try {
            if (typeof name !== 'string') return name;
            var original = name;
            // 澶勭悊 application/x-www-form-urlencoded 涓殑鍔犲彿绌烘牸
            var maybeEncoded = original.indexOf('%') !== -1 || original.indexOf('+') !== -1;
            if (maybeEncoded) {
                var replaced = original.replace(/\+/g, ' ');
                // 浠呭綋瀛樺湪鍚堟硶鐨?XX搴忓垪鏃跺皾璇曡В鐮侊紝閬垮厤璇激
                var hasPctSeq = /%(?:[0-9A-Fa-f]{2})/.test(replaced);
                if (hasPctSeq) {
                    try {
                        var decoded = decodeURIComponent(replaced);
                        if (typeof decoded === 'string' && decoded.length > 0) {
                            return decoded.trim();
                        }
                    } catch (e) {
                        console.warn('鏄剧ず鍚嶅鐞?宸ュ叿-01: 瑙ｇ爜澶辫触锛屼娇鐢ㄥ師鍊?, e);
                        return original.trim();
                    }
                }
                return replaced.trim();
            }
            return original.trim();
        } catch (err) {
            console.warn('鏄剧ず鍚嶅鐞?宸ュ叿-01: 鏈煡閿欒锛岃繑鍥炲師鍊?, err);
            return name;
        }
    },
    
    // 鍒濆鍖栨湰鍦版暟鎹鐞嗗櫒
    init: function(callback, retryCount) {
        var self = this;
        retryCount = retryCount || 0;
        var maxRetries = 3;
        var retryDelay = 1000;
        
        console.log('LocalDataManager: 寮€濮嬪垵濮嬪寲... (灏濊瘯娆℃暟: ' + (retryCount + 1) + ')');
        
        if (self.initialized) {
            console.log('LocalDataManager: 宸茬粡鍒濆鍖栬繃浜?);
            if (callback) callback(null, true);
            return;
        }
        
        // 妫€娴婥EP鐜
        if (typeof csInterface === 'undefined') {
            var cepError = 'CEP鐜鏈氨缁紝csInterface瀵硅薄涓嶅瓨鍦?;
            console.error('LocalDataManager:', cepError);
            if (retryCount < maxRetries) {
                console.log('LocalDataManager: 绛夊緟CEP鐜灏辩华锛? + retryDelay + 'ms鍚庨噸璇?..');
                setTimeout(function() {
                    self.init(callback, retryCount + 1);
                }, retryDelay);
                return;
            }
            if (callback) callback(cepError);
            return;
        }
        
        // 妫€娴媍sInterface.evalScript鏄惁鍙敤
        if (typeof csInterface.evalScript !== 'function') {
            var evalError = 'csInterface.evalScript鏂规硶涓嶅彲鐢?;
            console.error('LocalDataManager:', evalError);
            if (callback) callback(evalError);
            return;
        }
        
        // 鑾峰彇鑴氭湰鎵╁睍鏍圭洰褰?        console.log('LocalDataManager: 灏濊瘯鑾峰彇鎵╁睍鏍硅矾寰?..');
        function getFallbackExtensionRootPath() {
            try {
                if (typeof csInterface !== 'undefined' && csInterface && typeof csInterface.getSystemPath === 'function'
                    && typeof SystemPath !== 'undefined' && SystemPath.EXTENSION) {
                    var ext = csInterface.getSystemPath(SystemPath.EXTENSION);
                    if (ext && String(ext).trim()) return String(ext);
                }
            } catch (_) {}
            try {
                if (typeof csInterface !== 'undefined' && csInterface && typeof csInterface.getSystemPath === 'function') {
                    var extDirect = csInterface.getSystemPath('extension');
                    if (extDirect && String(extDirect).trim()) return String(extDirect);
                }
            } catch (_) {}
            try {
                if (window.__adobe_cep__ && typeof window.__adobe_cep__.getSystemPath === 'function') {
                    var ext2 = window.__adobe_cep__.getSystemPath('extension');
                    if (ext2 && String(ext2).trim()) return String(ext2);
                }
            } catch (_) {}
            return '';
        }

        csInterface.evalScript('getExtensionRootPath()', function(result) {
            console.log('LocalDataManager: getExtensionRootPath() 杩斿洖:', result);
            if (!result || result === 'null' || result === 'undefined' || String(result).trim() === '') {
                var fallbackRoot = getFallbackExtensionRootPath();
                if (fallbackRoot) {
                    console.warn('LocalDataManager: getExtensionRootPath() empty, fallback to SystemPath.EXTENSION:', fallbackRoot);
                    result = JSON.stringify({ success: true, path: fallbackRoot, exists: true, fallback: true });
                }
            }

            
            if (!result || result === 'null' || result === 'undefined' || result.trim() === '') {
                var pathError = '鏃犳硶鑾峰彇鎵╁睍鏍硅矾寰?;
                console.error('LocalDataManager:', pathError, '杩斿洖鍊?', result);
                
                if (retryCount < maxRetries) {
                    console.log('LocalDataManager: 鑾峰彇璺緞澶辫触锛? + retryDelay + 'ms鍚庨噸璇?..');
                    setTimeout(function() {
                        self.init(callback, retryCount + 1);
                    }, retryDelay);
                    return;
                }
                
                if (callback) callback(pathError + '锛屽凡閲嶈瘯' + maxRetries + '娆?);
                return;
            }
            
            try {
                // 灏濊瘯瑙ｆ瀽JSON鍝嶅簲
                var pathInfo;
                try {
                    pathInfo = JSON.parse(result);
                    console.log('LocalDataManager: 瑙ｆ瀽璺緞淇℃伅:', pathInfo);
                } catch (parseError) {
                    // 濡傛灉涓嶆槸JSON鏍煎紡锛屽亣璁炬槸鐩存帴鐨勮矾寰勫瓧绗︿覆锛堝悜鍚庡吋瀹癸級
                    console.log('LocalDataManager: 浣跨敤鐩存帴璺緞鏍煎紡');
                    pathInfo = {
                        success: true,
                        path: result,
                        exists: true
                    };
                }
                
                if (!pathInfo || !pathInfo.success || !pathInfo.path) {
                    var fallbackRoot2 = getFallbackExtensionRootPath();
                    if (fallbackRoot2) {
                        console.warn('LocalDataManager: path info invalid, fallback to SystemPath.EXTENSION:', fallbackRoot2);
                        pathInfo = { success: true, path: fallbackRoot2, exists: true, fallback: true };
                    }
                }

                // 妫€鏌ヨ矾寰勮幏鍙栨槸鍚︽垚鍔?                if (!pathInfo.success) {
                    var pathError = '鑾峰彇鎵╁睍鏍硅矾寰勫け璐? ' + (pathInfo.error || pathInfo.message || '鏈煡閿欒');
                    console.error('LocalDataManager:', pathError);
                    
                    if (retryCount < maxRetries) {
                        console.log('LocalDataManager: 璺緞鑾峰彇澶辫触锛? + retryDelay + 'ms鍚庨噸璇?..');
                        setTimeout(function() {
                            self.init(callback, retryCount + 1);
                        }, retryDelay);
                        return;
                    }
                    
                    if (callback) callback(pathError + '锛屽凡閲嶈瘯' + maxRetries + '娆?);
                    return;
                }
                
                // 妫€鏌ヨ矾寰勬槸鍚﹀瓨鍦?                if (!pathInfo.exists) {
                    var existsError = '鎵╁睍鏍圭洰褰曚笉瀛樺湪: ' + pathInfo.path;
                    console.error('LocalDataManager:', existsError);
                    if (callback) callback(existsError);
                    return;
                }
                
                var extensionRootPath = pathInfo.path;
                console.log('LocalDataManager: 鎵╁睍鏍硅矾寰?', extensionRootPath);
                
                self.extensionRootPath = extensionRootPath;
                var defaultDataFolderPath = extensionRootPath + "/data";
                self.dataFolderPath = self.getPreferredDataFolderPath(extensionRootPath) || defaultDataFolderPath;
                self.dataFilePath = self.dataFolderPath + "/" + self.dataFiles.main;
                try { window.dataStorageFolderPath = self.dataFolderPath; } catch (_) {}
                try { localStorage.setItem('mogu_data_storage_path', String(self.dataFolderPath || '')); } catch (_) {}
                
                console.log('LocalDataManager: dataFolderPath =', self.dataFolderPath);
                console.log('LocalDataManager: dataFilePath =', self.dataFilePath);
                
                // 纭繚data鏂囦欢澶瑰瓨鍦?                self.ensureDataFolder(function(error) {
                    if (error) {
                        console.error('LocalDataManager: 鍒涘缓data鏂囦欢澶瑰け璐?', error);
                        if (callback) callback(error);
                        return;
                    }
                    
                    console.log('LocalDataManager: data鏂囦欢澶瑰垱寤烘垚鍔?);
                    try { self.migrateKnownJsonFiles(defaultDataFolderPath, self.dataFolderPath); } catch (_) {}
                    self.initialized = true;
                    console.log('鏈湴鏁版嵁绠＄悊鍣ㄥ垵濮嬪寲鎴愬姛锛屾暟鎹矾寰?', self.dataFolderPath);
                    
                    // 妫€鏌ユ槸鍚﹂渶瑕佷粠鏃х郴缁熻縼绉绘暟鎹?                    self.checkAndMigrateOldData(function(migrationError) {
                        if (migrationError) {
                            console.warn('LocalDataManager: 鏁版嵁杩佺Щ璀﹀憡:', migrationError);
                        } else {
                            console.log('LocalDataManager: 鏁版嵁杩佺Щ妫€鏌ュ畬鎴?);
                        }
                        console.log('LocalDataManager: 鍒濆鍖栧畬鎴?);
                        if (callback) callback(null, true);
                    });
                });
            } catch (processingError) {
                console.error('LocalDataManager: 璺緞澶勭悊澶辫触:', processingError);
                if (callback) callback('璺緞澶勭悊澶辫触: ' + processingError.message);
            }
        });
    },
    
    // 纭繚data鏂囦欢澶瑰瓨鍦?    ensureDataFolder: function(callback) {
        var self = this;
        console.log('LocalDataManager: 寮€濮嬬‘淇漝ata鏂囦欢澶瑰瓨鍦?', self.dataFolderPath);
        
        csInterface.evalScript('ensureDataFolder("' + self.dataFolderPath + '")', function(result) {
            console.log('LocalDataManager: ensureDataFolder() 杩斿洖:', result);
            
            if (result === "success") {
                console.log('LocalDataManager: data鏂囦欢澶圭‘淇濇垚鍔?);
                if (callback) callback(null);
            } else {
                var errorMsg = "鍒涘缓data鏂囦欢澶瑰け璐? " + result;
                console.error('LocalDataManager:', errorMsg);
                if (callback) callback(errorMsg);
            }
        });
    },
    
    // 鍔犺浇鎸囧畾绫诲瀷鐨勬暟鎹?    loadDataByType: function(dataType, callback) {
        var self = this;
        if (!self.initialized) {
            if (callback) callback("鏈湴鏁版嵁绠＄悊鍣ㄦ湭鍒濆鍖?);
            return;
        }
        
        var fileName = self.dataFiles[dataType];
        if (!fileName) {
            if (callback) callback("鏈煡鐨勬暟鎹被鍨? " + dataType);
            return;
        }
        
        var filePath = self.dataFolderPath + "/" + fileName;
        
        csInterface.evalScript('loadDataFromFile("' + filePath + '")', function(result) {
            try {
                if (result && result !== 'null' && result !== 'undefined' && result !== '{}') {
                    var data = JSON.parse(result);
                    if (callback) callback(null, data);
                } else {
                    // 杩斿洖榛樿鏁版嵁
                    var defaultData = self.defaultData[dataType];
                    if (callback) callback(null, JSON.parse(JSON.stringify(defaultData)));
                }
            } catch (e) {
                console.error('鍔犺浇鏁版嵁澶辫触 (' + dataType + '):', e);
                var defaultData = self.defaultData[dataType];
                if (callback) callback(null, JSON.parse(JSON.stringify(defaultData)));
            }
        });
    },
    
    // 淇濆瓨鎸囧畾绫诲瀷鐨勬暟鎹?    saveDataByType: function(dataType, data, callback) {
        var self = this;
        if (!self.initialized) {
            if (callback) callback("鏈湴鏁版嵁绠＄悊鍣ㄦ湭鍒濆鍖?);
            return;
        }
        
        var fileName = self.dataFiles[dataType];
        if (!fileName) {
            if (callback) callback("鏈煡鐨勬暟鎹被鍨? " + dataType);
            return;
        }
        
        try {
            // 娣诲姞淇濆瓨鏃堕棿鎴?            if (dataType === 'main') {
                data.lastSaved = new Date().toISOString();
            }
            
            var filePath = self.dataFolderPath + "/" + fileName;
            var dataStr = JSON.stringify(data, null, 2);
            var encodedData = encodeURIComponent(dataStr);
            
            csInterface.evalScript('saveDataToFile("' + filePath + '", "' + encodedData + '")', function(result) {
                if (result === "success") {
                    console.log('鏁版嵁淇濆瓨鎴愬姛 (' + dataType + '):', filePath);
                    if (callback) callback(null, true);
                } else {
                    console.error('鏁版嵁淇濆瓨澶辫触 (' + dataType + '):', result);
                    if (callback) callback("淇濆瓨澶辫触: " + result);
                }
            });
        } catch (e) {
            if (callback) callback("鏁版嵁搴忓垪鍖栧け璐? " + e.toString());
        }
    },
    
    // 鍔犺浇鎵€鏈夋暟鎹?    loadAllData: function(callback) {
        var self = this;
        var allData = {};
        var dataTypes = Object.keys(self.dataFiles);
        var completed = 0;
        var hasError = false;
        
        function checkComplete() {
            completed++;
            if (completed === dataTypes.length) {
                if (callback) callback(hasError ? "閮ㄥ垎鏁版嵁鍔犺浇澶辫触" : null, allData);
            }
        }
        
        dataTypes.forEach(function(dataType) {
            self.loadDataByType(dataType, function(error, data) {
                if (error) {
                    console.error('鍔犺浇鏁版嵁澶辫触 (' + dataType + '):', error);
                    hasError = true;
                    allData[dataType] = self.defaultData[dataType];
                } else {
                    allData[dataType] = data;
                }
                checkComplete();
            });
        });
    },
    
    // 淇濆瓨鎵€鏈夋暟鎹?    saveAllData: function(allData, callback) {
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
                        callback("閮ㄥ垎鏁版嵁淇濆瓨澶辫触: " + errors.join(', '));
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
                    console.error('淇濆瓨鏁版嵁澶辫触 (' + dataType + '):', error);
                    hasError = true;
                    errors.push(dataType + ': ' + error);
                }
                checkComplete();
            });
        });
    },
    
    // 鑾峰彇鑴氭湰璁剧疆
    getScriptSettings: function(scriptPath, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            var scriptSettings = scriptsData[scriptPath] || {
                category: "鍏ㄩ儴",
                tags: [],
                customName: null,
                description: null,
                imagePath: null,
                lastModified: null
            };
            
            // 鍔熻兘锛氭樉绀哄悕澶勭悊-璇诲彇-02
            try {
                if (scriptSettings && typeof scriptSettings.customName === 'string' && scriptSettings.customName) {
                    scriptSettings.customName = self.safeDecodeDisplayName(scriptSettings.customName);
                }
            } catch (e) {
                console.warn('鏄剧ず鍚嶅鐞?璇诲彇-02: 瀹夊叏瑙ｇ爜澶辫触锛屽拷鐣?, e);
            }
            
            if (callback) callback(null, scriptSettings);
        });
    },
    
    // 淇濆瓨鑴氭湰璁剧疆
    saveScriptSettings: function(scriptPath, settings, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 鍔熻兘锛氭樉绀哄悕澶勭悊-淇濆瓨-03
            var normalizedSettings = settings;
            try {
                if (settings && typeof settings === 'object') {
                    normalizedSettings = Object.assign({}, settings);
                    if (typeof normalizedSettings.customName === 'string') {
                        normalizedSettings.customName = self.safeDecodeDisplayName(normalizedSettings.customName);
                    }
                }
            } catch (e) {
                console.warn('鏄剧ず鍚嶅鐞?淇濆瓨-03: 瑙勮寖鍖栧け璐ワ紝鍥為€€涓哄師璁剧疆瀵硅薄', e);
                normalizedSettings = settings;
            }
            
            scriptsData[scriptPath] = normalizedSettings;
            
            self.saveDataByType('scripts', scriptsData, callback);
        });
    },
    
    // 鍒犻櫎鑴氭湰璁剧疆锛堝綋鑴氭湰琚垹闄ゆ椂璋冪敤锛?    removeScriptSettings: function(scriptPath, callback) {
        var self = this;
        self.loadDataByType('scripts', function(error, scriptsData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (scriptsData[scriptPath]) {
                delete scriptsData[scriptPath];
                console.log('宸叉竻鐞嗚剼鏈缃?', scriptPath);
                
                self.saveDataByType('scripts', scriptsData, callback);
            } else {
                if (callback) callback(null, true);
            }
        });
    },
    
    // 娓呯悊涓嶅瓨鍦ㄧ殑鑴氭湰璁剧疆
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
                    console.log('娓呯悊瀛ょ珛鑴氭湰璁剧疆:', scriptPath);
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
    
    // 浠庢棫鏁版嵁绯荤粺杩佺Щ鏁版嵁
    checkAndMigrateOldData: function(callback) {
        var self = this;
        
        // 妫€鏌ユ槸鍚﹀凡缁忚縼绉昏繃
        self.loadDataByType('main', function(error, mainData) {
            if (!error && mainData.dataStorageVersion === "local_v1") {
                // 宸茬粡鏄柊鐗堟湰锛屾棤闇€杩佺Щ
                if (callback) callback(null);
                return;
            }
            
            // 灏濊瘯浠庢棫鐨凞ataManager鍔犺浇鏁版嵁
            if (typeof DataManager !== 'undefined' && DataManager.loadData) {
                DataManager.init(function(initError) {
                    if (initError) {
                        console.log('鏃ф暟鎹郴缁熶笉鍙敤锛屼娇鐢ㄩ粯璁ゆ暟鎹?);
                        if (callback) callback(null);
                        return;
                    }
                    
                    DataManager.loadData(function(loadError, oldData) {
                        if (loadError || !oldData) {
                            console.log('鏃犳棫鏁版嵁闇€瑕佽縼绉?);
                            if (callback) callback(null);
                            return;
                        }
                        
                        console.log('寮€濮嬭縼绉绘棫鏁版嵁鍒版湰鍦板瓨鍌?..');
                        self.migrateFromOldData(oldData, callback);
                    });
                });
            } else {
                if (callback) callback(null);
            }
        });
    },
    
    // 鎵ц鏁版嵁杩佺Щ
    migrateFromOldData: function(oldData, callback) {
        var self = this;
        
        // 杞崲鏃ф暟鎹牸寮忓埌鏂版牸寮?        var newData = {
            main: {
                version: "2.0",
                scriptsFolderPath: oldData.scriptsFolderPath,
                autoReadSubfolders: oldData.autoReadSubfolders !== undefined ? oldData.autoReadSubfolders : true,
                lastSaved: new Date().toISOString(),
                dataStorageVersion: "local_v1"
            },
            scripts: oldData.scriptSettings || {},
            categories: oldData.categories || ["鍏ㄩ儴"],
            tags: oldData.allTags || [],
            backgrounds: {
                currentBackground: null,
                backgroundSettings: oldData.backgroundSettings
            },
            layout: {
                isGridLayout: oldData.layoutSettings ? oldData.layoutSettings.isGridLayout : false,
                currentScale: oldData.layoutSettings ? oldData.layoutSettings.currentScale : 1,
                // 杩佺Щ鍒扮嫭绔嬮敭
                sidebarWidthScript: (oldData.layoutSettings && typeof oldData.layoutSettings.sidebarWidthScript === 'number')
                    ? oldData.layoutSettings.sidebarWidthScript
                    : (oldData.layoutSettings ? oldData.layoutSettings.sidebarWidth : 100),
                sidebarWidthPreset: (oldData.layoutSettings && typeof oldData.layoutSettings.sidebarWidthPreset === 'number')
                    ? oldData.layoutSettings.sidebarWidthPreset
                    : (oldData.layoutSettings ? oldData.layoutSettings.sidebarWidth : 100),
                scriptOrder: oldData.scriptOrder || []
            }
        };
        
        // 淇濆瓨杩佺Щ鍚庣殑鏁版嵁
        self.saveAllData(newData, function(saveError) {
            if (saveError) {
                console.error('鏁版嵁杩佺Щ澶辫触:', saveError);
                if (callback) callback(saveError);
            } else {
                console.log('鏁版嵁杩佺Щ瀹屾垚');
                if (callback) callback(null);
            }
        });
    },
    
    // 鍒涘缓鏁版嵁澶囦唤
    createBackup: function(callback) {
        var self = this;
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        var backupFolderPath = self.dataFolderPath + "/backups/" + timestamp;
        
        csInterface.evalScript('createDataBackupFolder("' + self.dataFolderPath + '", "' + backupFolderPath + '")', function(result) {
            if (result === "success") {
                console.log('鏁版嵁澶囦唤鍒涘缓鎴愬姛:', backupFolderPath);
                if (callback) callback(null, backupFolderPath);
            } else {
                console.error('鏁版嵁澶囦唤澶辫触:', result);
                if (callback) callback("澶囦唤澶辫触: " + result);
            }
        });
    },
    
    // 鍏煎鎬ф柟娉曪細loadData - 鍔犺浇鍚堝苟鍚庣殑鏁版嵁锛堜笌鍘烡ataManager API鍏煎锛?    loadData: function(callback) {
        var self = this;
        self.loadAllData(function(error, allData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 灏嗗垎鏁ｇ殑鏁版嵁鍚堝苟涓哄崟涓€瀵硅薄锛屼繚鎸佷笌鍘烡ataManager鐨勫吋瀹规€?            var mergedData = {
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
                    presetScale: (typeof allData.layout.presetScale === 'number') ? allData.layout.presetScale : 1,
                    // 鐙珛瀹藉害閿紝缂哄け鏃跺洖閫€鍒版棫閿?                    sidebarWidthScript: (typeof allData.layout.sidebarWidthScript === 'number') ? allData.layout.sidebarWidthScript : allData.layout.sidebarWidth,
                    sidebarWidthPreset: (typeof allData.layout.sidebarWidthPreset === 'number') ? allData.layout.sidebarWidthPreset : allData.layout.sidebarWidth
                },
                scriptOrder: allData.layout.scriptOrder
            };
            
            if (callback) callback(null, mergedData);
        });
    },
    
    // 鍏煎鎬ф柟娉曪細saveData - 淇濆瓨鍚堝苟鍚庣殑鏁版嵁锛堜笌鍘烡ataManager API鍏煎锛?    saveData: function(mergedData, callback) {
        var self = this;
        
        try {
            // 灏嗗悎骞剁殑鏁版嵁鍒嗚В涓哄垎鏁ｇ殑鏁版嵁缁撴瀯
            var allData = {
                main: {
                    version: mergedData.version || "2.0",
                    scriptsFolderPath: mergedData.scriptsFolderPath,
                    autoReadSubfolders: mergedData.autoReadSubfolders !== undefined ? mergedData.autoReadSubfolders : true,
                    lastSaved: new Date().toISOString(),
                    dataStorageVersion: "local_v1"
                },
                scripts: mergedData.scriptSettings || {},
                categories: mergedData.categories || ["鍏ㄩ儴"],
                tags: mergedData.allTags || [],
                backgrounds: {
                    currentBackground: null,
                    backgroundSettings: mergedData.backgroundSettings
                },
                layout: {
                    isGridLayout: mergedData.layoutSettings ? mergedData.layoutSettings.isGridLayout : false,
                    currentScale: mergedData.layoutSettings ? mergedData.layoutSettings.currentScale : 1,
                    presetScale: (mergedData.layoutSettings && typeof mergedData.layoutSettings.presetScale === 'number')
                        ? mergedData.layoutSettings.presetScale
                        : 1,
                    sidebarWidthScript: (mergedData.layoutSettings && typeof mergedData.layoutSettings.sidebarWidthScript === 'number')
                        ? mergedData.layoutSettings.sidebarWidthScript
                        : 100,
                    sidebarWidthPreset: (mergedData.layoutSettings && typeof mergedData.layoutSettings.sidebarWidthPreset === 'number')
                        ? mergedData.layoutSettings.sidebarWidthPreset
                        : 100,
                    scriptOrder: mergedData.scriptOrder || []
                }
            };
            
            self.saveAllData(allData, callback);
        } catch (e) {
            if (callback) callback("鏁版嵁杞崲澶辫触: " + e.toString());
        }
    },
    
    // 鍏煎鎬ф柟娉曪細isAvailable - 妫€鏌ユ暟鎹鐞嗗櫒鏄惁鍙敤
    isAvailable: function() {
        return this.initialized;
    },
    
    // 鍏煎鎬ф柟娉曪細setData - 璁剧疆鐗瑰畾鏁版嵁椤?    setData: function(key, value, callback) {
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
    
    // 鍏煎鎬ф柟娉曪細getData - 鑾峰彇鐗瑰畾鏁版嵁椤?    getData: function(key, callback) {
        var self = this;
        self.loadData(function(error, data) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            if (callback) callback(null, data[key]);
        });
    },

    // 瀵煎嚭鎵€鏈夋暟鎹?    exportAllData: function(callback) {
        var self = this;
        self.loadAllData(function(error, allData) {
            if (error) {
                if (callback) callback(error);
                return;
            }
            
            // 绉婚櫎鏁忔劅淇℃伅
            var exportData = JSON.parse(JSON.stringify(allData));
            if (exportData.main && exportData.main.scriptsFolderPath) {
                delete exportData.main.scriptsFolderPath;
            }
            
            if (callback) callback(null, exportData);
        });
    },
    
    // 瀵煎叆鏁版嵁
    importAllData: function(importedData, callback) {
        var self = this;
        
        try {
            // 鍒涘缓澶囦唤
            self.createBackup(function(backupError) {
                if (backupError) {
                    console.warn('鍒涘缓澶囦唤澶辫触:', backupError);
                }
                
                // 鍔犺浇褰撳墠鏁版嵁
                self.loadAllData(function(loadError, currentData) {
                    if (loadError) {
                        if (callback) callback(loadError);
                        return;
                    }
                    
                    // 鍚堝苟瀵煎叆鏁版嵁锛屼繚鐣欏綋鍓嶇殑鑴氭湰鏂囦欢澶硅矾寰?                    var mergedData = JSON.parse(JSON.stringify(importedData));
                    if (currentData.main && currentData.main.scriptsFolderPath) {
                        mergedData.main.scriptsFolderPath = currentData.main.scriptsFolderPath;
                    }
                    mergedData.main.lastSaved = new Date().toISOString();
                    mergedData.main.dataStorageVersion = "local_v1";
                    
                    // 淇濆瓨鍚堝苟鍚庣殑鏁版嵁
                    self.saveAllData(mergedData, callback);
                });
            });
        } catch (e) {
            if (callback) callback("瀵煎叆澶辫触: " + e.toString());
        }
    }
};

// 瀵煎嚭鏈湴鏁版嵁绠＄悊鍣?if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalDataManager;
}
