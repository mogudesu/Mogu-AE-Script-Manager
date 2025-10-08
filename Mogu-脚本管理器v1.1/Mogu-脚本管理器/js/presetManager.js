/**
 * 预设管理器（前端桥接模块）
 * 职责：
 * - 与 ExtendScript 通信：扫描 AE 原生预设目录、应用预设（基础/偏移/最后帧）
 * - 提供简洁 API 给 UI 层：init、refresh、apply
 * 说明：
 * - 返回的预设列表为扁平数组（仅文件），包含 { name, path, rel, dir } 字段
 * - UI 层负责搜索与渲染
 */

var PresetManager = (function () {
  'use strict';

  var _cs = null;
  var _loaded = false;
  var _presets = [];
  var _root = '';

  function _ensureCS() {
    if (!_cs) _cs = new CSInterface();
    return _cs;
  }

  /**
   * decode可能被URI编码的字符串
   */
  function _safeDecode(str) {
    try {
      if (/%[0-9A-Fa-f]{2}/.test(str)) return decodeURIComponent(str);
      return str;
    } catch (e) {
      return str;
    }
  }

  /**
   * 将后端返回的树结构扁平化为文件列表
   * @param {Object|Array} node
   * @param {String} base
   * @param {Array} out
   */
  function _flatten(node, base, out) {
    if (!node) return;
    if (node instanceof Array) {
      for (var i = 0; i < node.length; i++) _flatten(node[i], base, out);
      return;
    }
    if (node.type === 'folder') {
      var next = node.children || [];
      var folderPath = base ? base + '/' + (node.name || '') : (node.name || '');
      for (var j = 0; j < next.length; j++) _flatten(next[j], folderPath, out);
    } else if (node.type === 'file') {
      var rel = (base ? base + '/' : '') + (node.name || '');
      var dir = base || '';
      
      // 清理路径格式
      rel = rel.replace(/\\/g, '/').replace(/^\/+/, '');
      dir = dir.replace(/\\/g, '/').replace(/^\/+/, '');
      
      out.push({
        name: node.name || '',
        path: node.path || '',
        rel: rel,
        dir: dir
      });
    }
  }

  /**
   * 扫描预设目录
   * @param {Function} cb (err, {root, list})
   */
  function refresh(cb) {
    var cs = _ensureCS();

    // 读取设置，优先使用自定义预设路径
    cs.evalScript('loadSettings()', function (settingsJson) {
      var customPath = '';
      try {
        var settings = settingsJson ? JSON.parse(settingsJson) : {};
        // 兼容多来源/多命名：presetFolderPath / presetsFolderPath / userSettings.presetFolderPath / mainData.presetFolderPath
        var fromSettings = settings.presetFolderPath || settings.presetsFolderPath;
        var fromUser = settings.userSettings && (settings.userSettings.presetFolderPath || settings.userSettings.presetsFolderPath);
        var fromMain = settings.main && (settings.main.presetFolderPath || settings.main.presetsFolderPath);
        customPath = fromSettings || fromUser || fromMain || '';
        // 安全解码与清理
        if (customPath && /%[0-9A-Fa-f]{2}/.test(customPath)) {
          try { customPath = decodeURIComponent(customPath); } catch (_) {}
        }
        if (typeof customPath === 'string') {
          customPath = customPath.replace(/^\s+|\s+$/g, '');
        }
      } catch (e) {
        customPath = '';
      }

      function handleResult(res) {
        try {
          if (!res || res === 'null' || res === 'undefined') {
            _loaded = true; _presets = []; _root = '';
            cb && cb(null, { root: '', list: [] });
            return;
          }
          var data = JSON.parse(res);
          _root = data.root || '';
          var flat = [];
          _flatten(data.tree || [], '', flat);
          _presets = flat.filter(function (it) {
            return /\.ffx$/i.test(it.name || it.path);
          }).map(function (it) {
            it.name = _safeDecode(it.name);
            it.rel = _safeDecode(it.rel);
            return it;
          });
          _loaded = true;
          cb && cb(null, { root: _root, list: _presets });
        } catch (e) {
          _loaded = true; _presets = []; _root = '';
          cb && cb(String(e), { root: '', list: [] });
        }
      }

      // 优先扫描用户自定义路径；失败则回退到内置/用户路径扫描
      if (customPath && String(customPath).replace(/^\s+|\s+$/g, '') !== '') {
        // 记录诊断日志，便于定位路径问题
        try { console.log('[PresetManager] 使用自定义预设路径扫描:', customPath); } catch (_) {}
        var escaped = String(customPath).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        cs.evalScript("scanPresetsAt('" + escaped + "')", function (res) {
          if (res && res !== 'null' && res !== 'undefined') {
            handleResult(res);
          } else {
            cs.evalScript('scanPresets()', function (res2) { handleResult(res2); });
          }
        });
      } else {
        cs.evalScript('scanPresets()', function (res) { handleResult(res); });
      }
    });
  }

  /**
   * 应用预设到选中图层
   * @param {String} presetPath 绝对路径
   * @param {String} mode 'base' | 'offset' | 'last'
   * @param {Function} cb (err, msg)
   */
  function apply(presetPath, mode, cb) {
    var cs = _ensureCS();
    if (!presetPath) {
      cb && cb('无效的预设路径', null);
      return;
    }
    var m = (mode === 'offset' || mode === 'last') ? mode : 'base';
    var escaped = presetPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var jsx = "applyPresetWithMode('" + escaped + "', '" + m + "')";
    cs.evalScript(jsx, function (res) {
      if (!res) return cb && cb(null, '');
      if (res.indexOf('Error:') === 0) return cb && cb(res.substring(6), null);
      cb && cb(null, res);
    });
  }

  function getList() {
    return _presets.slice(0);
  }

  function isLoaded() {
    return _loaded;
  }

  return {
    refresh: refresh,
    apply: apply,
    getList: getList,
    isLoaded: isLoaded
  };
})();