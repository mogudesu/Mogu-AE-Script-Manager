/**
 * 预设视图 UI 与交互
 * 功能要点：
 * - 右下角"预设/脚本"切换：切换 body.show-preset 类，控制脚本区右移与预设区显示
 * - 预设视图：搜索、模式（基础/偏移/最后帧）、列表、双击应用
 * - 与 PresetManager 桥接：扫描 & 应用
 * - 支持网格/列表布局切换，与脚本列表保持一致的样式风格
 * - 预设模式下左侧显示预设文件夹分类，支持新建/删除分类文件夹
 * 注意：
 * - 偏移/最后帧仅对基础变换属性（位置/缩放/旋转/不透明度/锚点）生效；其它按"基础模式"应用
 */
(function () {
  'use strict';

  var els = {
    panel: null,
    toggleBtn: null,
    search: null,
    refresh: null,
    layoutToggle: null,
    modes: null,
    list: null,
    help: null
  };

  var state = {
    inited: false,
    allPresets: [],
    filtered: [],
    mode: 'base', // 'base' | 'offset' | 'last'
    grid: false,   // 预设列表的网格/列表模式
    silentLayout: false, // 初始渲染阶段静默应用布局与缩放，避免跳动
    presetFolders: [], // 预设文件夹分类列表
    currentPresetCategory: '全部', // 当前选中的预设分类
    presetRoot: '', // 预设根目录路径
    dragSortManager: null, // 拖拽排序管理器实例
    // 单次动画守卫：切换到预设视图时，分类与卡片淡入只执行一次
    shouldAnimatePresetCardsOnce: false,
    // 首次扫描渲染完成标记：仅第一次进入预设视图时进行扫描与分类渲染
    initialScanDone: false,
    // 网格类名一次性应用标记：避免在拖动过程中逐项重复写入类名
    _gridClassApplied: false
  };

  function $(id) { return document.getElementById(id); }

  // 统一获取当前顶栏搜索关键字（脚本/预设视图共享）
  function getCurrentSearchKeyword() {
    try {
      var si = document.getElementById('searchInput');
      var v = si ? String(si.value).trim().toLowerCase() : '';
      if (!v && typeof window.searchKeyword === 'string') {
        v = String(window.searchKeyword).trim().toLowerCase();
      }
      return v || '';
    } catch (_) {
      return '';
    }
  }

  // [预设界面-UI构建]+[功能名称]+[详细描述] 确保预设界面UI已构建并初始化
  function ensureUI() {
    if (state.inited) return;

    // 容器
    els.panel = $('presetPanel');
    if (!els.panel) return;

    // 构建内部结构 - 添加 preset-layout 容器确保正确的高度计算
    els.panel.innerHTML = [
      '<div class="preset-layout">',
        '<div class="preset-toolbar">',
          '<div class="preset-modes" title="应用模式：基础/偏移/最后帧">',
            '<button class="preset-mode-btn active" data-mode="base" title="直接应用预设的绝对值">基础</button>',
            '<button class="preset-mode-btn" data-mode="offset" title="在当前属性值基础上叠加动画变化量">偏移</button>',
            '<button class="preset-mode-btn" data-mode="last" title="动画终点保持当前属性值，起点按轨迹反推">最后帧</button>',
          '</div>',
          // [预设界面-工具栏]+[步骤]+[1] 添加刷新与布局切换按钮，保持与脚本界面一致
          '<div class="preset-actions-group">',
            '<button id="preset-refresh" class="btn btn-mini" title="刷新预设列表">刷新</button>',
            '<button id="preset-layout-toggle" class="btn btn-mini" title="在网格与列表之间切换">网格</button>',
          '</div>',
        '</div>',
        '<div id="presetList" class="preset-list script-list preset-container"></div>',
      '</div>'
    ].join('');

    // 绑定元素
    els.list = $('presetList');
    els.refresh = $('preset-refresh');
    els.layoutToggle = $('preset-layout-toggle');
    // 顶栏搜索输入（与脚本视图共享），用于刷新/分类切换时保留过滤
    els.search = $('searchInput');

    // 模式切换 - 改为按钮点击事件
    var modeButtons = els.panel.querySelectorAll('.preset-mode-btn');
    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        // 移除所有按钮的激活状态
        modeButtons.forEach(function (b) {
          b.classList.remove('active');
        });
        // 激活当前点击的按钮
        this.classList.add('active');
        // 更新状态
        state.mode = this.getAttribute('data-mode');
      });
    });

    // [预设界面-事件绑定]+[步骤]+[2] 绑定刷新和布局切换事件
    bindEvents();
    
    // [预设界面-布局偏好]+[步骤]+[1] 加载保存的布局偏好
    loadLayoutPreference();

    state.inited = true;
  }

  // [预设界面-过滤功能]+[功能名称]+[详细描述] 根据关键字和分类过滤预设列表
  function applyFilter(q) {
    var baseList = state.allPresets.slice(0);
    
    console.log('开始过滤，总预设数量:', baseList.length);
    console.log('当前分类:', state.currentPresetCategory);
    
    // 先按分类过滤
    if (state.currentPresetCategory !== '全部') {
      console.log('开始分类过滤...');
      
      baseList = baseList.filter(function (it) {
        var dir = (it.dir || '');
        var rel = (it.rel || '');
        var category = state.currentPresetCategory;
        
        // 解码目录名称和分类名称以处理URL编码
        var originalDir = dir;
        var originalCategory = category;
        
        try {
          if (dir.indexOf('%') !== -1) {
            dir = decodeURIComponent(dir);
          }
          if (category.indexOf('%') !== -1) {
            category = decodeURIComponent(category);
          }
        } catch (e) {
          // 解码失败时使用原始字符串
        }
        
        // 多种匹配策略
        var matches = false;
        
        // 策略1: 直接匹配目录名
        if (dir === category || originalDir === originalCategory) {
          matches = true;
        }
        
        // 策略2: 目录路径以分类名开头
        if (!matches) {
          var dirLower = dir.toLowerCase();
          var categoryLower = category.toLowerCase();
          if (dirLower.indexOf(categoryLower + '/') === 0 || 
              dirLower.indexOf(categoryLower + '\\') === 0 ||
              dirLower === categoryLower) {
            matches = true;
          }
        }
        
        // 策略3: 检查相对路径是否包含分类名
        if (!matches) {
          var relLower = rel.toLowerCase();
          var categoryLower = category.toLowerCase();
          if (relLower.indexOf(categoryLower + '/') === 0 || 
              relLower.indexOf(categoryLower + '\\') === 0) {
            matches = true;
          }
        }
        
        // 策略4: 检查路径的第一级目录
        if (!matches) {
          var firstDir = '';
          if (dir) {
            firstDir = dir.split(/[\/\\]/)[0];
          } else if (rel) {
            firstDir = rel.split(/[\/\\]/)[0];
          }
          
          if (firstDir && (firstDir === category || firstDir.toLowerCase() === category.toLowerCase())) {
            matches = true;
          }
        }
        
        if (matches) {
          console.log('匹配预设:', it.name, '目录:', dir, '相对路径:', rel);
        }
        
        return matches;
      });
      
      console.log('分类过滤后预设数量:', baseList.length);
    }
    
    // 再按标签过滤（与脚本一致，采用“同时包含”AND逻辑）
    try {
      var active = (window.activeTags && Array.isArray(window.activeTags)) ? window.activeTags.slice(0) : [];
      if (active.length > 0) {
        baseList = baseList.filter(function(it){
          var presetIdentifier = it.path;
          var presetTags = getPresetSetting(presetIdentifier, 'tags') || [];
          // AND 逻辑：所有active标签都需要存在于presetTags中
          for (var i = 0; i < active.length; i++) {
            var tagRequired = active[i];
            var has = false;
            for (var j = 0; j < presetTags.length; j++) {
              if (presetTags[j] === tagRequired) { has = true; break; }
            }
            if (!has) return false;
          }
          return true;
        });
      }
    } catch(_) {}

    // 再按关键字过滤
    if (!q) {
      state.filtered = baseList;
      return;
    }
    state.filtered = baseList.filter(function (it) {
      var name = (it.name || '').toLowerCase();
      var rel = (it.rel || '').toLowerCase();
      return name.indexOf(q) !== -1 || rel.indexOf(q) !== -1;
    });
    
    console.log('最终过滤后预设数量:', state.filtered.length);
  }

  // [预设界面-渲染列表]+[功能名称]+[详细描述] 渲染预设列表，支持网格和列表两种布局模式
  function renderList() {
    if (!els.list) return;
    if (!state.filtered || state.filtered.length === 0) {
      els.list.innerHTML = '<div class="preset-empty">未找到预设；可点击"刷新"重新扫描</div>';
      return;
    }

    var html = [];
    for (var i = 0; i < state.filtered.length; i++) {
      var it = state.filtered[i];
      
      // [预设界面-渲染列表]+[步骤]+[0] 获取预设的自定义设置
      var presetIdentifier = it.path; // 使用完整路径作为唯一标识符
      var displayName = getPresetSetting(presetIdentifier, 'displayName') || it.name;
      var description = getPresetSetting(presetIdentifier, 'description') || '预设文件';
      var imagePath = getPresetSetting(presetIdentifier, 'imagePath') || '';
      var presetTags = getPresetSetting(presetIdentifier, 'tags') || [];
      
      // [预设界面-渲染列表]+[步骤]+[1] 构建预设预览图片，支持自定义图片
      var previewHtml = '';
      if (imagePath) {
        previewHtml = '<img src="' + escapeHtml(imagePath) + '" alt="' + escapeHtml(displayName) + '" class="preset-preview-image">';
      } else {
        previewHtml = '<div class="preset-preview-placeholder">✨</div>';
      }
      
      // [预设界面-渲染列表]+[步骤]+[2] 构建标签HTML - 只显示用户添加的自定义标签
      var tagsHtml = '';
      if (presetTags.length > 0) {
        presetTags.forEach(function(tag) {
          // [预设标签-着色映射]+[步骤]+[0] 忽略空白标签，并为每个标签计算稳定颜色
          var t = (tag == null ? '' : String(tag)).trim();
          if (!t) return;
          var col = getTagColor(t);
          tagsHtml += '<span class="preset-tag script-tag" data-tag="' + escapeHtml(t) + '" style="--tag-bg:' + col.bg + ';--tag-text:' + col.text + ';--tag-border:' + col.border + ';">' + escapeHtml(t) + '</span>';
        });
      }
      // 如果没有自定义标签，不显示任何标签
      
      // [预设界面-渲染列表]+[步骤]+[3] 使用与脚本列表相同的HTML结构和类名，但显示自定义名称，预览图片在顶部，标签在底部
      // [预设界面-修复标签位移]+[功能名称]+[详细描述] 将标签放在预设信息容器内部，避免影响整体布局
      var tagsSection = tagsHtml ? '<div class="preset-tags script-tags">' + tagsHtml + '</div>' : '';
      
      // [预设界面-拖拽支持]+[功能名称]+[详细描述] 为预设卡片添加拖拽所需的类名和数据属性
      var presetId = 'preset_' + i + '_' + (it.name || '').replace(/[^a-zA-Z0-9]/g, '_');
      
      var extraClasses = (state.grid ? ' grid-mode' : '') + (state.shouldAnimatePresetCardsOnce ? ' preset-card-fade-prepare' : '');
      html.push(
        '<div class="preset-item preset-card', extraClasses, '" data-idx="', i, '" data-preset-id="', presetId, '" data-preset-path="', escapeHtml(it.path), '" title="', escapeHtml(it.rel), '">',
          '<div class="preset-info script-info">',
            '<div class="preset-name script-name">', escapeHtml(displayName), '</div>',
            '<div class="preset-description script-description">', escapeHtml(description), '</div>',
            '<div class="preset-path script-path">/', escapeHtml(it.rel), '</div>',
            tagsSection,
          '</div>',
          '<div class="preset-preview-window">' + previewHtml + '</div>',
        '</div>'
      );
    }
    els.list.innerHTML = html.join('');

    // [预设界面-初始状态]+[步骤]+[1] 首次切换到预设视图时，卡片已在HTML中带有淡入准备类，避免刷新闪现

    // [预设界面-重复窗口清理]+[步骤]+[1] 移除旧的 script-category 预览节点与左侧旧预览/图标容器，避免重复窗口
    try {
      var oldNodes = els.list.querySelectorAll('.script-category, .script-category-grid, .script-category-list, .preset-preview, .script-preview, .preset-icon, .script-icon');
      oldNodes.forEach(function(n){ n.remove(); });
    } catch (_) {}

    // [预设界面-布局切换]+[步骤]+[2] 渲染后应用当前布局和网格设置
    applyLayout();
    
    // [预设界面-缩放应用延迟]+[功能名称]+[详细描述] 延迟应用缩放，确保DOM已完全渲染
    setTimeout(function() {
      applyScaleToPresetItems();
    }, 50);

    // [预设界面-预览布局应用]+[功能名称]+[详细描述] 根据卡片高度计算预览窗口宽度(16:9)与信息区右侧留白
    setTimeout(function(){
      if (typeof updatePreviewWindowLayout === 'function') {
        updatePreviewWindowLayout();
      }
    }, 60);

    // [预设界面-拖拽排序初始化]+[功能名称]+[详细描述] 初始化拖拽排序功能
    setTimeout(function() {
      initPresetDragSort();
      // [预设界面-拖拽排序加载]+[功能名称]+[详细描述] 加载保存的预设排序
      loadPresetOrder();
    }, 100);

    // [预设界面-事件绑定]+[步骤]+[1] 绑定双击事件应用预设
    var nodes = els.list.querySelectorAll('.preset-item');
    nodes.forEach(function (n) {
      n.addEventListener('dblclick', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var item = state.filtered[idx];
        if (!item) return;
        doApply(item.path, state.mode);
      });
      
      // [预设界面-右键菜单]+[功能名称]+[详细描述] 为预设卡片添加右键菜单
      n.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var item = state.filtered[idx];
        if (!item) return;
        showPresetContextMenu(e, item);
      });
    });
  }

  // [预设界面-布局切换]+[功能名称]+[详细描述] 根据state.grid为列表容器切换网格/列表样式
  function applyLayout() {
    if (!els.list) return;
    
    // [预设界面-布局切换]+[步骤]+[3-1] 进入布局冻结，禁用过渡动画，避免短暂错位
    els.list.classList.add('layout-freeze');
    
    if (state.grid) {
      // [预设界面-布局切换]+[步骤]+[3-2] 网格模式：统一使用与脚本模式相同的类名
      els.list.classList.add('grid-layout');
      var items = els.list.querySelectorAll('.preset-item');
      items.forEach(function(item) {
        // 统一使用grid-mode类名，与脚本模式保持一致
        item.classList.add('grid-mode');
        // 移除列表模式的样式类
        item.classList.remove('list-mode');
      });
      // [预设界面-列表初始化标记]+[步骤]+[1] 切换到网格时重置列表项初始化标记
      state._listItemStylesInitialized = false;
      // 切换到网格布局：需要重新一次性应用网格类名
      state._gridClassApplied = false;
    } else {
      // [预设界面-布局切换]+[步骤]+[3-3] 列表模式：移除网格相关类
      els.list.classList.remove('grid-layout');
      var items = els.list.querySelectorAll('.preset-item');
      items.forEach(function(item) {
        // 移除网格模式类，添加列表模式类
        item.classList.remove('grid-mode');
        item.classList.add('list-mode');
      });
      // [预设界面-列表初始化标记]+[步骤]+[2] 进入列表布局，标记需要一次性初始化逐项样式与容器样式
      state._listItemStylesInitialized = false;
      state._listContainerInitialized = false;
      // 切换到列表布局：重置网格类应用标记
      state._gridClassApplied = false;
    }
    
    // [预设界面-布局切换]+[步骤]+[3-4] 同步重算并快速解除冻结，避免短暂错位
    try { 
      var fast = !!state.silentLayout; 
      applyScaleToPresetItems(fast); 
      if (!fast && typeof updatePreviewWindowLayout === 'function') {
        updatePreviewWindowLayout();
      }
    } catch (_) {}
    setTimeout(function() {
      if (els.list) {
        els.list.classList.remove('layout-freeze');
      }
    }, 60);
  }

  // [预设界面-网格布局]+[功能名称]+[详细描述] 动态计算并设置网格布局参数
  // [预设界面-缩放应用]+[功能名称]+[详细描述] 依据右下角大小滑块，统一缩放预设卡片尺寸和网格行列
  // [预设界面-缩放应用V2]+[功能名称]+[详细描述] 支持轻量/强制两条路径，减少列表模式拖动卡顿
  // fastMode=true：轻量路径，仅更新容器CSS变量，不重算预览、不做逐项样式写入
  // fastMode=false（默认）：完整路径，必要时初始化列表项样式并重算预览
  function applyScaleToPresetItems(fastMode) {
    if (!els.list) return;
    var slider = document.getElementById('sizeSlider');
    var scale = slider ? parseFloat(slider.value) : 1;

    // 新增：根据滑块值计算字体与间距缩放（设置上下限避免过小/过大导致可读性问题）
    var fontScale = Math.min(1.12, Math.max(0.85, scale));
    var spacingScale = Math.min(1.08, Math.max(0.80, scale));
    els.list.style.setProperty('--preset-font-scale', String(fontScale));
    els.list.style.setProperty('--preset-spacing-scale', String(spacingScale));

    // [预设界面-缩放状态保存]+[功能名称]+[详细描述] 缩放状态在滑块change事件中持久化，避免频繁写入造成卡顿

    var items = els.list.querySelectorAll('.preset-item');
    
    // [预设界面-批量DOM优化]+[步骤]+[1] 使用文档片段减少重排次数
    var fragment = document.createDocumentFragment();
    var needsFragmentUpdate = false;
    
    if (state.grid) {
      // [预设界面-网格缩放优化]+[功能名称]+[详细描述] 优化网格缩放算法，实现丝滑的实时重排和紧密对齐
      // FLIP动画：仅在松开滑块后的完整刷新中使用，拖动期间禁用以避免卡顿
      var useFlip = !fastMode; // fastMode(拖动中) 不使用FLIP，完整刷新时启用
      var oldRects = null;
      if (useFlip) {
        oldRects = [];
        for (var oi = 0; oi < items.length; oi++) {
          var oEl = items[oi];
          oldRects.push({ el: oEl, rect: oEl.getBoundingClientRect() });
        }
      }

      // 网格模式：拖动时也实时重算列数与行高，保证左上对齐与紧密排布
      var baseItemWidth = 72;
      var baseItemHeight = 96;
      var minGap = 2;

      var scaledItemWidth = baseItemWidth * scale;
      var scaledItemHeight = baseItemHeight * scale;

      // 更新缩放变量（字体/间距已在上方设置），并实时更新容器布局变量
      els.list.style.setProperty('--grid-scale', scale);

      var containerWidth = els.list.clientWidth;
      var itemsPerRow = Math.max(1, Math.floor((containerWidth + minGap) / (scaledItemWidth + minGap)));

      // [预设界面-网格缩放优化]+[步骤]+[1] 优化网格布局计算，确保卡片紧密贴合
      // 计算实际可用宽度，确保卡片完全填充容器
      var actualItemWidth = Math.floor((containerWidth - (itemsPerRow - 1) * minGap) / itemsPerRow);
      actualItemWidth = Math.max(actualItemWidth, scaledItemWidth * 0.8); // 防止过度压缩

      // 不论是否 fastMode，都更新容器CSS变量与grid模板，从而在拖动中即时重新排布
      els.list.style.setProperty('--grid-columns', String(itemsPerRow));
      els.list.style.setProperty('--grid-item-width', Math.round(actualItemWidth) + 'px');
      els.list.style.setProperty('--grid-item-height', Math.round(scaledItemHeight) + 'px');
      els.list.style.setProperty('--grid-gap', minGap + 'px');

      // [预设界面-网格缩放优化]+[步骤]+[2] 应用优化的网格布局，确保左上角对齐和紧密排列
      els.list.style.display = 'grid';
      els.list.style.gridTemplateColumns = 'repeat(' + itemsPerRow + ', ' + Math.round(actualItemWidth) + 'px)';
      els.list.style.gridAutoRows = Math.round(scaledItemHeight) + 'px';
      els.list.style.gap = minGap + 'px';
      els.list.style.justifyContent = 'start';
      els.list.style.alignContent = 'start';
      els.list.style.justifyItems = 'stretch'; // 确保卡片填充网格单元
      els.list.style.alignItems = 'stretch';

      // [预设界面-网格缩放优化]+[步骤]+[3] 执行优化的FLIP动画，实现丝滑的位置过渡
      if (useFlip) {
        // 强制一次回流以确保新布局已应用
        void els.list.offsetWidth;
        for (var ni = 0; ni < items.length; ni++) {
          var nEl = items[ni];
          var newRect = nEl.getBoundingClientRect();
          var oldRect = oldRects[ni] && oldRects[ni].rect;
          if (!oldRect) continue;
          var dx = oldRect.left - newRect.left;
          var dy = oldRect.top - newRect.top;
          if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) { // 降低位移阈值，更敏感的动画触发
            nEl.style.willChange = 'transform';
            nEl.style.transition = 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)'; // 调慢FLIP动画，与CSS保持一致
            nEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          }
        }
        requestAnimationFrame(function() {
          for (var ri = 0; ri < items.length; ri++) {
            var rEl = items[ri];
            // 过渡到新位置
            rEl.style.transform = 'translate(0,0)';
          }
          // 清理动画状态
          setTimeout(function() {
            for (var ci = 0; ci < items.length; ci++) {
              var cEl = items[ci];
              cEl.style.willChange = '';
              cEl.style.transition = '';
            }
          }, 120); // 延长清理时间，与动画时长匹配
        });
      }

      // 仅在首次或非轻量路径下统一应用网格类名，避免拖动时逐项写入造成卡顿
      if (!state._gridClassApplied || !fastMode) {
        for (var gi = 0; gi < items.length; gi++) {
          var it = items[gi];
          if (!it.classList.contains('grid-mode')) {
            it.classList.add('grid-mode');
          }
        }
        state._gridClassApplied = true;
      }
    } else {
      // 列表模式：卡片宽度始终100%，只缩放高度和内部元素，确保卡片始终紧密联系
      
      // [预设界面-批量DOM优化]+[步骤]+[4] 容器样式仅在列表初始化时重置一次
      if (!state._listContainerInitialized) {
        var containerResetStyles = {
          display: 'block',
          gridTemplateColumns: '',
          gridTemplateRows: '',
          gridAutoRows: '',
          gap: '',
          justifyContent: '',
          alignContent: '',
          justifyItems: '',
          alignItems: ''
        };
        Object.assign(els.list.style, containerResetStyles);
        state._listContainerInitialized = true;
      }

      // 使用CSS变量控制缩放，只影响高度和内部元素
      els.list.style.setProperty('--preset-scale', scale);

      // 根据高度反推右侧预览宽度（16:9），为信息区预留 padding-right
      var itemHeight = Math.round(60 * scale);
      var previewWidth = Math.max(48, Math.round((itemHeight - 8) * 16 / 9));
      var previewPadding = previewWidth + 8;
      els.list.style.setProperty('--preview-width', previewPadding + 'px');

      // 轻量路径：拖动过程中不做逐项样式写入，仅依赖容器CSS变量驱动视觉缩放
      // 完整路径：仅在列表布局初始化时执行逐项样式复位，避免每次缩放都写入
      var needItemInit = !state._listItemStylesInitialized;
      if (!fastMode && needItemInit) {
        var itemResetStyles = {
          position: '',
          transform: '',
          transformOrigin: '',
          width: '100%',
          maxWidth: '100%',
          height: '',
          boxSizing: '',
          display: '',
          alignItems: '',
          overflow: '',
          margin: '',
          marginBottom: '',
          marginTop: '',
          padding: ''
        };
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          item.classList.remove('grid-mode');
          Object.assign(item.style, itemResetStyles);

          var info = item.querySelector('.preset-info');
          if (info) {
            info.style.order = '';
            info.style.textAlign = 'left';
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            info.style.alignItems = 'flex-start';
          }
          var nameEl = item.querySelector('.preset-name');
          var pathEl = item.querySelector('.preset-path');
          var descEl = item.querySelector('.preset-description');
          var tagsEl = item.querySelector('.preset-tags');
          if (nameEl) {
            nameEl.style.order = '1';
            nameEl.style.textAlign = 'left';
            nameEl.style.display = 'block';
            nameEl.style.webkitLineClamp = '';
            nameEl.style.webkitBoxOrient = '';
            nameEl.style.whiteSpace = '';
          }
          if (pathEl) {
            pathEl.style.order = '2';
            pathEl.style.textAlign = 'left';
            pathEl.style.display = 'block';
          }
          if (descEl) {
            descEl.style.order = '3';
            descEl.style.textAlign = 'left';
            descEl.style.display = 'none';
          }
          if (tagsEl) {
            tagsEl.style.order = '4';
            tagsEl.style.textAlign = 'left';
            tagsEl.style.display = 'block';
            tagsEl.style.whiteSpace = '';
            tagsEl.style.overflow = '';
            tagsEl.style.textOverflow = '';
          }
          item.style.alignItems = 'flex-start';
          item.style.display = 'flex';
          item.style.flexDirection = 'row';
        }
        state._listItemStylesInitialized = true;
      }
    }

    // [预设界面-滚动修复]+[功能名称]+[详细描述] 确保滚动容器正确设置
    if (els.list) {
      els.list.style.overflowY = 'auto';
      els.list.style.overflowX = 'hidden';
    }

    // [预设界面-预览布局应用]+[步骤]+[2] 缩放后重新计算预览窗口尺寸与信息区留白（轻量路径跳过）
    if (!fastMode && typeof updatePreviewWindowLayout === 'function') {
      updatePreviewWindowLayout();
    }
  }

  // [预设界面-超轻量缩放函数]+[功能名称]+[详细描述] 超轻量级缩放函数，仅更新CSS变量，完全跳过DOM遍历
  function applyScaleToPresetItemsUltraFast(scale) {
    /**
     * 功能：超轻量级缩放更新，专为滑块拖动优化
     * - 仅更新容器级CSS变量，完全跳过DOM遍历和逐项样式设置
     * - 不执行FLIP动画、不查询元素尺寸、不重新计算布局
     * - 依赖CSS变量驱动视觉缩放，最大化性能
     */
    if (!els.list) return;

    // 仅更新核心CSS变量
    var fontScale = Math.min(1.12, Math.max(0.85, scale));
    var spacingScale = Math.min(1.08, Math.max(0.80, scale));
    
    els.list.style.setProperty('--preset-scale', scale);
    els.list.style.setProperty('--preset-font-scale', String(fontScale));
    els.list.style.setProperty('--preset-spacing-scale', String(spacingScale));
    
    if (state.grid) {
      els.list.style.setProperty('--grid-scale', scale);
    } else {
      // 列表模式：仅更新预览宽度变量
      var itemHeight = Math.round(60 * scale);
      var previewWidth = Math.max(48, Math.round((itemHeight - 8) * 16 / 9));
      var previewPadding = previewWidth + 8;
      els.list.style.setProperty('--preview-width', previewPadding + 'px');
    }
  }

  // [预设界面-预览布局计算轻量版]+[功能名称]+[详细描述] 轻量级预览窗口更新，仅调整尺寸和留白，避免DOM重排
  function updatePreviewWindowLayoutFast() {
    /**
     * 功能：轻量级预览窗口更新，专为滑块拖动优化
     * - 仅更新预览窗口宽度和信息区留白
     * - 跳过DOM查询和重复窗口清理
     * - 使用缓存的元素引用
     * 参数：无
     * 返回：无
     */
    try {
      if (!els || !els.list || state.grid) return; // 仅列表模式需要
      
      var items = els.list.querySelectorAll('.preset-item');
      if (!items || !items.length) return;

      items.forEach(function(item) {
        var info = item.querySelector('.preset-info');
        var preview = item.querySelector('.preset-preview-window');
        if (!preview || !info) return;

        // 快速计算：使用固定比例而非getBoundingClientRect
        var itemHeight = item.offsetHeight || 60;
        var usableHeight = Math.max(0, itemHeight - 8); // 固定上下边距
        var targetWidth = Math.round(usableHeight * 16 / 9);
        var width = Math.max(64, Math.min(180, targetWidth));

        // 仅更新关键样式属性
        preview.style.width = width + 'px';
        info.style.paddingRight = (width + 12) + 'px';
      });
    } catch (e) {
      // 出错时回退到完整更新
      if (typeof updatePreviewWindowLayout === 'function') {
        updatePreviewWindowLayout();
      }
    }
  }

  // [预设界面-预览布局计算]+[功能名称]+[详细描述] 计算并应用预览窗口宽度与信息区留白，保证与卡片等高、16:9比例
  function updatePreviewWindowLayout() {
    /**
     * 功能：
     * - 为每个 .preset-item 的 .preset-preview-window 设置宽度，使其与卡片高度等高并保持 16:9 比例
     * - 为 .preset-info 设置 padding-right，避免文字被预览窗口遮挡
     * - 清理同一个卡片内重复的预览窗口，仅保留第一个
     * 参数：无（直接读取 DOM）
     * 返回：无
     */
    try {
      if (!els || !els.list) return;
      var list = els.list;
      var items = list.querySelectorAll('.preset-item');
      if (!items || !items.length) return;

      // [预设界面-重复窗口清理]+[步骤]+[2] 在布局计算前兜底移除左侧旧容器，防止异步注入造成重复预览
      try {
        var legacy = list.querySelectorAll('.preset-preview, .script-preview, .preset-icon, .script-icon');
        legacy.forEach(function(n){ n.remove(); });
      } catch (_) {}

      items.forEach(function(item) {
        var info = item.querySelector('.preset-info');
        var previews = item.querySelectorAll('.preset-preview-window');
        if (!previews || previews.length === 0) return;

        // 仅保留第一个预览窗口，移除其余的重复节点
        for (var i = 1; i < previews.length; i++) {
          try { previews[i].remove(); } catch (_) {}
        }
        var preview = previews[0];
        if (!preview) return;

        // 计算卡片可用高度（与 top/bottom 一致），与预览窗口等高
        var rect = item.getBoundingClientRect();
        var padTop = state.grid ? 3 : 4;
        var padBottom = state.grid ? 3 : 4;
        var usableHeight = Math.max(0, rect.height - (padTop + padBottom));

        // 不再因标签高度调整宽度计算，始终以卡片可用高度推导宽度（保持与未添加标签时一致的效果）
        var baseHeight = Math.max(0, usableHeight);

        // 16:9 宽度计算，并限定边界
        var targetWidth = Math.round(baseHeight * 16 / 9);
        var minW = state.grid ? 48 : 64;
        var maxW = state.grid ? 120 : 180;
        var width = Math.max(minW, Math.min(maxW, targetWidth));

        // 额外保护：不超过卡片可用宽度的 42%，避免覆盖过多文本
        try {
          var itemInnerW = item.clientWidth || rect.width;
          if (state.grid) {
            width = Math.min(width, Math.floor((itemInnerW - 24) * 0.42));
          }
        } catch (_) {}

        // 应用到预览窗口：列表模式计算宽度；网格模式使用流式宽度并移除绝对定位
        preview.style.setProperty('min-width', (state.grid ? '0' : (width + 'px')), 'important');
        preview.style.setProperty('max-width', (state.grid ? 'none' : (width + 'px')), 'important');
        preview.style.setProperty('width', (state.grid ? '100%' : (width + 'px')), 'important');

        if (state.grid) {
          // 网格模式：顶部流式排列，不再使用绝对定位，固定16:9比例
          preview.style.setProperty('position', 'relative', 'important');
          preview.style.setProperty('top', 'auto', 'important');
          preview.style.setProperty('right', 'auto', 'important');
          preview.style.setProperty('bottom', 'auto', 'important');
          preview.style.setProperty('aspect-ratio', '16 / 9', 'important');

          // 预设卡片容器改为纵向排列，预览在上、名称居中、标签在下
          try {
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.alignItems = 'center';

            var nameEl = item.querySelector('.preset-name');
            var tagsEl = item.querySelector('.preset-tags');

            if (preview) preview.style.order = '1';
            if (info) info.style.order = '2';
            if (nameEl) nameEl.style.order = '2';
            if (tagsEl) tagsEl.style.order = '3';

            // 名称两行收敛
            if (nameEl) {
              nameEl.style.display = '-webkit-box';
              nameEl.style.webkitLineClamp = '2';
              nameEl.style.webkitBoxOrient = 'vertical';
              nameEl.style.overflow = 'hidden';
              nameEl.style.textOverflow = 'ellipsis';
              nameEl.style.whiteSpace = 'normal';
              nameEl.style.textAlign = 'center';
            }

            // 标签单行收敛
            if (tagsEl) {
              tagsEl.style.whiteSpace = 'nowrap';
              tagsEl.style.overflow = 'hidden';
              tagsEl.style.textOverflow = 'ellipsis';
              tagsEl.style.alignSelf = 'center';
            }
          } catch (_) {}
        } else {
          // 列表模式：保持靠右并且上下贴边，绝对定位保证高度等于卡片高度，同时重置任何居中样式
          try { item.style.setProperty('position', 'relative', 'important'); } catch (_) {}
          preview.style.setProperty('position', 'absolute', 'important');
          preview.style.setProperty('right', '4px', 'important');
          preview.style.setProperty('top', '4px', 'important');
          preview.style.setProperty('bottom', '4px', 'important');
          preview.style.setProperty('aspect-ratio', 'auto', 'important');
          preview.style.setProperty('z-index', '1', 'important');

          // 重置列表模式的文本与对齐，避免切换后出现居中与排序错误
          try {
            item.style.alignItems = 'flex-start';
            item.style.display = 'flex';
            item.style.flexDirection = 'row';
            
            // [预设界面-列表模式DOM顺序修复]+[步骤]+[8] 确保信息区正确的flex布局和顺序
            if (info) {
              info.style.display = 'flex';
              info.style.flexDirection = 'column';
              info.style.alignItems = 'flex-start';
              info.style.order = '';
            }
            
            var nameEl = item.querySelector('.preset-name');
            var pathEl = item.querySelector('.preset-path');
            var descEl = item.querySelector('.preset-description');
            var tagsEl = item.querySelector('.preset-tags');
            
            if (nameEl) {
              nameEl.style.order = '1';
              nameEl.style.textAlign = 'left';
              nameEl.style.display = 'block';
              nameEl.style.webkitLineClamp = '';
              nameEl.style.webkitBoxOrient = '';
              nameEl.style.whiteSpace = '';
            }
            if (pathEl) {
              pathEl.style.order = '2';
              pathEl.style.textAlign = 'left';
              pathEl.style.display = 'block';
            }
            if (descEl) {
              descEl.style.order = '3';
              descEl.style.textAlign = 'left';
              descEl.style.display = 'none'; // 列表模式隐藏描述
            }
            if (tagsEl) {
              tagsEl.style.order = '4';
              tagsEl.style.textAlign = 'left';
              tagsEl.style.display = 'block';
              tagsEl.style.whiteSpace = '';
              tagsEl.style.overflow = '';
              tagsEl.style.textOverflow = '';
            }
          } catch (_) {}
        }

        // [预设界面-预览窗口修复]+[步骤]+[3] 若内部有媒体元素，确保自适应容器尺寸
        try {
          var media = preview.querySelector('img, video, canvas');
          if (media) {
            media.style.width = '100%';
            media.style.height = '100%';
            media.style.objectFit = 'contain';
          }
        } catch (_) {}

        // 信息区留白：网格模式不需要右侧留白，列表模式保持略大于预览宽度
        if (info) {
          var pad = state.grid ? 0 : (width + 12);
          info.style.setProperty('padding-right', pad + 'px', 'important');
        }
      });
    } catch (e) {
      try { console.warn('updatePreviewWindowLayout error:', e); } catch (_) {}
    }
  }

  // [预设界面-网格布局]+[功能名称]+[详细描述] 动态计算并设置网格布局参数（调用缩放函数内聚）
  function updateGridLayout() {
    if (!els.list || !state.grid) return;
    // 网格模式下改为复用统一缩放逻辑，自动带出列数/间距/行高
    applyScaleToPresetItems();
  }

  // [预设界面-事件绑定]+[功能名称]+[详细描述] 统一绑定预设界面的所有事件处理器
  function bindEvents() {
    // [预设界面-事件绑定]+[步骤]+[1] 绑定刷新按钮事件
    if (els.refresh) {
      els.refresh.removeEventListener('click', handleRefresh); // 防止重复绑定
      els.refresh.addEventListener('click', handleRefresh);
    }
    
    // [预设界面-事件绑定]+[步骤]+[2] 绑定布局切换按钮事件
    if (els.layoutToggle) {
      els.layoutToggle.removeEventListener('click', handleLayoutToggle); // 防止重复绑定
      els.layoutToggle.addEventListener('click', handleLayoutToggle);
    }

    // [预设界面-事件绑定]+[步骤]+[2-1] 绑定右下角大小滑块，复用脚本的同一滑块以控制预设
    var sizeSlider = document.getElementById('sizeSlider');
    if (sizeSlider) {
      // 先移除旧的处理器，避免重复绑定导致计算多次触发
      if (state._presetSliderInput) {
        sizeSlider.removeEventListener('input', state._presetSliderInput);
      }
      if (state._presetSliderChange) {
        sizeSlider.removeEventListener('change', state._presetSliderChange);
      }

      // [预设界面-滑块响应优化V3]+[步骤]+[1] 大幅降低更新频率，减少计算负担
      var rafId = null;
      var lastScale = null;
      var lastUpdateTime = 0;
      var minUpdateInterval = 16; // 提升到60fps，获得更流畅的动画效果

      // 输入事件处理器（仅预设模式下生效）
      state._presetSliderInput = function() {
        if (!document.body.classList.contains('show-preset')) return; // 非预设模式下不处理
        var currentScale = parseFloat(this.value);
        var now = performance.now();

        // [预设界面-滑块响应优化V5]+[步骤]+[2] 降低变化阈值，提高动画响应敏感度
        var threshold = 0.008; // 大幅降低阈值，让动画更加细腻流畅
        if (lastScale !== null && Math.abs(currentScale - lastScale) < threshold) return;
        
        // [预设界面-滑块响应优化V5]+[步骤]+[3] 时间节流：60fps更新频率
        if (now - lastUpdateTime < minUpdateInterval && rafId) return;
        
        lastScale = currentScale;
        lastUpdateTime = now;

        // [预设界面-滑块响应优化V5]+[步骤]+[4] 高性能rAF节流：同一帧内只执行一次
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(function() {
          rafId = null;
          // [预设界面-滑块优化V5]+[步骤]+[1] 超流畅实时缩放：保持缩放状态但允许丝滑过渡
          if (!state._scalingActive) startScaling(); // 确保缩放状态激活
          applyScaleToPresetItems(true); // fastMode=true，跳过FLIP动画但保持实时缩放
        });
      };

      // change事件处理器（仅预设模式下生效）
      state._presetSliderChange = function() {
        if (!document.body.classList.contains('show-preset')) return; // 非预设模式下不处理
        var val = parseFloat(this.value);
        if (!isNaN(val) && val > 0) {
          try { localStorage.setItem('mogu_preset_scale', val.toString()); } catch (_) {}
          // 长期持久化：写入完整持久化系统
          try {
            if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.initialized) {
              SettingsPersistenceComplete.settingsCache = SettingsPersistenceComplete.settingsCache || {};
              SettingsPersistenceComplete.settingsCache.presetScale = val;
              SettingsPersistenceComplete.saveAllSettings(function(){
                try { console.log('SettingsPersistenceComplete: 已保存 presetScale=', val); } catch(_) {}
              });
            }
          } catch (_) {}
          // 结束缩放状态，恢复过渡动画并执行完整刷新
          endScaling();
        }
      };

      // 自适应更新频率：统一降低频率减少计算负担
      var minUpdateInterval = 25; // 统一40fps，大幅减少计算负担
      sizeSlider.addEventListener('input', state._presetSliderInput);
      sizeSlider.addEventListener('change', state._presetSliderChange);

      // [预设界面-滑块拖动生命周期V5]+[步骤]+[1] 开始拖动：启用超流畅缩放模式
      var startScaling = function() {
        if (!document.body.classList.contains('show-preset')) return;
        state._scalingActive = true;
        if (els.list) {
          els.list.classList.add('scaling-active');
          // 启用硬件加速和布局优化
          els.list.style.contain = 'layout paint style';
          els.list.style.willChange = 'grid-template-columns, grid-auto-rows';
        }
      };
      // [预设界面-滑块拖动生命周期V5]+[步骤]+[2] 结束拖动：恢复完整样式，执行完整刷新
      var endScaling = function() {
        if (!state._scalingActive) return;
        state._scalingActive = false;
        if (els.list) {
          els.list.classList.remove('scaling-active');
          // 恢复默认样式
          els.list.style.contain = '';
          els.list.style.willChange = '';
        }
        // 执行完整刷新，包含FLIP动画
        try { applyScaleToPresetItems(false); } catch (_) {}
        try { if (typeof updatePreviewWindowLayout === 'function') updatePreviewWindowLayout(); } catch (_) {}
      };
      sizeSlider.addEventListener('mousedown', startScaling);
      sizeSlider.addEventListener('touchstart', startScaling, { passive: true });
      document.addEventListener('mouseup', endScaling);
      document.addEventListener('touchend', endScaling, { passive: true });

      // [预设界面-缩放状态恢复]+[步骤]+[1] 仅在预设模式下恢复保存的缩放状态，避免切回脚本模式被覆盖
      try {
        if (document.body.classList.contains('show-preset')) {
          var savedScale = localStorage.getItem('mogu_preset_scale');
          if (savedScale !== null) {
            var scale = parseFloat(savedScale);
            if (!isNaN(scale) && scale > 0) {
              sizeSlider.value = scale;
              // 同步应用缩放，无需延迟，确保初始布局稳定
              applyScaleToPresetItems();
            }
          }
        }
      } catch (_) {}
    }

    // [预设界面-滚动事件绑定]+[功能名称]+[详细描述] 绑定滚动事件，确保预设列表可以滚动
    if (els.list) {
      // 移除可能存在的旧事件监听器
      els.list.removeEventListener('wheel', handlePresetListScroll);
      els.list.addEventListener('wheel', handlePresetListScroll, { passive: false });
    }
    
    // [预设界面-事件绑定]+[步骤]+[3] 绑定窗口大小变化事件，用于响应式网格布局
    window.removeEventListener('resize', handleResize); // 防止重复绑定
    window.addEventListener('resize', handleResize);

    // [预设界面-搜索框绑定]+[功能名称]+[详细描述] 绑定顶部搜索框，支持预设搜索
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
      // [预设界面-搜索框绑定]+[步骤]+[1] 创建预设搜索处理器
      function presetSearchHandler() {
        if (document.body.classList.contains('show-preset')) {
          var keyword = searchInput.value.trim().toLowerCase();
          applyFilter(keyword);
          renderList();
        }
      }
      
      // [预设界面-搜索框绑定]+[步骤]+[2] 监听预设模式切换，动态绑定搜索事件
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            var isPresetMode = document.body.classList.contains('show-preset');
            
            if (isPresetMode) {
              // 切换到预设模式：绑定预设搜索
              searchInput.addEventListener('input', presetSearchHandler);
            } else {
              // 切换到脚本模式：移除预设搜索
              searchInput.removeEventListener('input', presetSearchHandler);
            }
          }
        });
      });
      
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // [预设界面-刷新处理]+[功能名称]+[详细描述] 处理刷新按钮点击事件
  function handleRefresh() {
    scanAndRender(true);
  }

  // [预设界面-布局切换处理]+[功能名称]+[详细描述] 处理布局切换按钮点击事件
  function handleLayoutToggle() {
    state.grid = !state.grid;
    applyLayout();
    // 布局切换后立即根据滑块值重算尺寸与列行，避免网格底部空白
    applyScaleToPresetItems();
    
    // [预设界面-布局切换处理]+[步骤]+[1] 更新按钮文本
    if (els.layoutToggle) {
      els.layoutToggle.textContent = state.grid ? '列表' : '网格';
    }
    
    // [预设界面-布局切换处理]+[步骤]+[2] 保存布局偏好到本地存储
    try {
      localStorage.setItem('mogu_preset_grid_layout', state.grid ? 'true' : 'false');
    } catch (_) {}
    // 长期持久化：写入完整持久化系统
    try {
      if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.initialized) {
        SettingsPersistenceComplete.settingsCache = SettingsPersistenceComplete.settingsCache || {};
        SettingsPersistenceComplete.settingsCache.isGridLayout = !!state.grid;
        SettingsPersistenceComplete.saveAllSettings(function(){
          try { console.log('SettingsPersistenceComplete: 已保存 isGridLayout=', !!state.grid); } catch(_) {}
        });
      }
    } catch (_) {}
  }

  // [预设界面-窗口大小变化处理]+[功能名称]+[详细描述] 处理窗口大小变化，更新网格布局
  function handleResize() {
    if (state.grid && els.list) {
      // [预设界面-窗口大小变化处理]+[步骤]+[1] 添加调整大小动画类
      els.list.classList.add('grid-resizing');
      
      // [预设界面-窗口大小变化处理]+[步骤]+[2] 重新计算网格布局
      updateGridLayout();
      
      // [预设界面-窗口大小变化处理]+[步骤]+[2-1] 同步更新预览窗口尺寸与信息区留白
      if (typeof updatePreviewWindowLayout === 'function') {
        updatePreviewWindowLayout();
      }
      
      // [预设界面-窗口大小变化处理]+[步骤]+[3] 延迟移除调整大小动画类
      setTimeout(function() {
        if (els.list) {
          els.list.classList.remove('grid-resizing');
        }
      }, 220); // 缩短移除延时以更快恢复交互
    }
  }

  // [预设界面-滚动处理]+[功能名称]+[详细描述] 处理预设列表的滚动事件
  function handlePresetListScroll(e) {
    // 让浏览器自然处理滚动，移除手动干预
    // 只需要确保容器有正确的滚动设置即可
    return true;
  }

  // [预设界面-布局偏好]+[功能名称]+[详细描述] 从本地存储加载布局偏好设置
  function loadLayoutPreference() {
    try {
      var saved = null;
      // 优先从长期持久化缓存读取
      if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.settingsCache && SettingsPersistenceComplete.settingsCache.isGridLayout !== undefined) {
        saved = SettingsPersistenceComplete.settingsCache.isGridLayout ? 'true' : 'false';
      } else {
        saved = localStorage.getItem('mogu_preset_grid_layout');
      }
      if (saved !== null) {
        state.grid = saved === 'true';
        if (els.layoutToggle) {
          els.layoutToggle.textContent = state.grid ? '列表' : '网格';
        }
      }
    } catch (_) {}
  }

  // [预设界面-应用预设]+[功能名称]+[详细描述] 应用选中的预设到当前图层
  // [预设界面-应用预设后焦点处理]+[功能名称]+[详细描述]
  // 在应用预设成功后，主动移除面板焦点并激活 AE，使 Ctrl+Z 撤销 AE 动画而不是输入文本
  function defocusAndActivateAE() {
    try {
      // 1) 模糊顶部搜索输入与当前活动元素
      var si = document.getElementById('searchInput');
      if (si && typeof si.blur === 'function') si.blur();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        // 避免 blur 自身造成异常循环
        try {
          if (document.activeElement !== document.body) {
            document.activeElement.blur();
          }
        } catch (_) {}
      }
      // 2) 立即将 AE 激活到前台（将键盘事件交给 AE）
      var cs = new CSInterface();
      // 小延时保障 WebView 完成 blur，再激活 AE
      setTimeout(function() {
        try { cs.evalScript('bringAEToFront()', function(){}); } catch(_) {}
      }, 30);
    } catch (e) {
      try { console.warn('defocusAndActivateAE 失败:', e); } catch (_) {}
    }
  }

  function doApply(absPath, mode) {
    if (!window.PresetManager || !PresetManager.apply) {
      safeNotify('预设应用失败：PresetManager不可用', true);
      return;
    }
    PresetManager.apply(absPath, mode, function (err, msg) {
      if (err) return safeNotify('应用预设失败：' + err, true);
      // 成功不弹窗，保持流程顺畅
      try { console.log('应用预设完成:', msg || 'ok'); } catch (_) {}
      // 关键：移除面板焦点并激活 AE，让 Ctrl+Z 作用于 AE 撤销栈
      defocusAndActivateAE();
    });
  }

  // [预设界面-扫描渲染]+[功能名称]+[详细描述] 扫描预设文件夹并渲染列表和分类
  function scanAndRender(force) {
    if (!window.PresetManager || !PresetManager.refresh) {
      safeNotify('预设扫描失败：PresetManager不可用', true);
      return;
    }
    PresetManager.refresh(function (err, data) {
      if (err) {
        safeNotify('扫描预设失败：' + err, true);
        return;
      }
      state.allPresets = (data && data.list) ? data.list : [];
      state.presetRoot = (data && data.root) ? data.root : '';
      
      // [预设界面-文件夹分类提取]+[功能名称]+[详细描述] 从预设列表中提取文件夹分类
      extractPresetFolders();
      
      // [预设界面-分类界面更新]+[功能名称]+[详细描述] 更新左侧分类显示
      updatePresetCategoryUI();
      
      // 刷新后保留当前搜索关键字过滤结果
      applyFilter(getCurrentSearchKeyword());
      renderList();
      
      // [动画时机修复]+[步骤]+[1] 确保内容渲染完成后再触发动画
      // [时序修复]+[步骤]+[5] 优化动画触发时机，确保分类和卡片同步显示
      setTimeout(function() {
        // [时序修复]+[步骤]+[6] 只在首次切换时触发动画，避免重复播放
        if (state.shouldAnimatePresetCategoryOnce || state.shouldAnimatePresetCardsOnce) {
          // [时序修复]+[步骤]+[7] 分类动画：确保分类已加载完成后再触发
          if (state.shouldAnimatePresetCategoryOnce) {
            var categoryList = document.getElementById('categoryList');
            if (categoryList) {
              categoryList.classList.remove('category-fadeout', 'category-switching', 'category-fadein');
              if (!categoryList.classList.contains('category-fadein-prepare')) {
                categoryList.classList.add('category-fadein-prepare');
              }
              categoryList.offsetHeight; // 强制重绘
              setTimeout(function() {
                categoryList.classList.remove('category-fadeout', 'category-fadein-prepare');
                categoryList.classList.add('category-fadein');
                setTimeout(function() {
                  categoryList.classList.remove('category-fadein');
                }, 300);
              }, 50);
              state.shouldAnimatePresetCategoryOnce = false;
            }
          }
          
          // [时序修复]+[步骤]+[8] 卡片动画：等待分类动画开始后再触发，确保同步
          setTimeout(function() {
            // 展示列表容器，但卡片仍处于淡入准备状态，避免刷新闪现
            if (els.list) {
              els.list.classList.add('preset-list-show');
            }
            if (state.shouldAnimatePresetCardsOnce && els.list) {
              var cards = els.list.querySelectorAll('.preset-item.preset-card');
              if (cards.length > 0) {
                // 先清理所有动画状态，准备重新开始
                cards.forEach(function(card){
                  card.classList.remove('preset-card-fade');
                  card.classList.add('preset-card-fade-prepare');
                  card.style.transitionDelay = '';
                });
                void els.list.offsetHeight; // 强制重绘
                // 在卡片进入准备状态后再显示列表容器，避免出现->消失的闪现
                try {
                  els.list.style.visibility = 'visible';
                  els.list.style.opacity = '';
                } catch (_) {}
                
                // 应用错开的淡入动画
                cards.forEach(function(card, idx){
                  var delayMs = Math.min(200, idx * 30);
                  card.style.transitionDelay = (delayMs / 1000) + 's';
                  card.classList.remove('preset-card-fade-prepare');
                  card.classList.add('preset-card-fade');
                });
                
                // 动画完成后清理状态
                setTimeout(function(){
                  cards.forEach(function(card){
                    card.classList.remove('preset-card-fade');
                    card.style.transitionDelay = '';
                  });
                  state.shouldAnimatePresetCardsOnce = false;
                }, 700);
              } else {
                // 如果没有找到卡片，重置动画标志
                state.shouldAnimatePresetCardsOnce = false;
              }
            }
          }, 100); // 延迟100ms，等待分类动画开始
        }
      }, 200); // [时序修复] 增加延迟，确保DOM完全更新后再触发动画
    });
  }

  // [预设界面-文件夹分类提取]+[功能名称]+[详细描述] 从预设根目录中提取直接子文件夹作为分类
  function extractPresetFolders() {
    var folders = ['全部'];
    // [性能优化]+[步骤]+[1] 如果已存在缓存的分类且未强制刷新，则直接使用，避免重复扫描
    try {
      if (!state.forceRescanPresetFolders && Array.isArray(state.presetFolders) && state.presetFolders.length > 0) {
        return;
      }
    } catch (_) {}
    
    if (!state.presetRoot) {
      state.presetFolders = folders;
      return;
    }
    
    try {
      // 使用CSInterface调用ExtendScript获取预设根目录下的子文件夹
      var cs = new CSInterface();
      var escapedPath = state.presetRoot.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      
      cs.evalScript("getPresetSubFolders('" + escapedPath + "')", function(result) {
        if (result && result.indexOf('Error:') !== 0) {
          try {
            var subFolders = JSON.parse(result);
            if (Array.isArray(subFolders) && subFolders.length > 0) {
              // 只使用子文件夹作为分类，不包含根目录本身
              state.presetFolders = ['全部'].concat(subFolders);
            } else {
              // 如果没有子文件夹，使用降级处理
              extractPresetFoldersFromList();
            }
          } catch (e) {
            console.log('解析预设子文件夹失败:', e);
            extractPresetFoldersFromList();
          }
        } else {
          console.log('获取预设子文件夹失败:', result);
          extractPresetFoldersFromList();
        }
        
        // 缓存标记：分类已准备好，后续切换不再重复拉取
        try { state.forceRescanPresetFolders = false; } catch (_) {}
        updatePresetCategoryUI();
      });
    } catch (e) {
      console.log('调用ExtendScript失败:', e);
      extractPresetFoldersFromList();
    }
  }
  
  // [预设界面-降级处理]+[功能名称]+[详细描述] 从预设列表中提取顶级文件夹作为分类（降级处理）
  function extractPresetFoldersFromList() {
    var folders = ['全部'];
    var seen = {};
    
    state.allPresets.forEach(function (preset) {
      var dir = preset.dir || '';
      if (dir && !seen[dir]) {
        seen[dir] = true;
        // 提取顶级文件夹名称
        var topFolder = dir.split('/')[0];
        if (topFolder && folders.indexOf(topFolder) === -1) {
          folders.push(topFolder);
        }
      }
    });
    
    state.presetFolders = folders;
  }

  // [预设界面-分类界面更新]+[功能名称]+[详细描述] 更新左侧分类显示为预设文件夹
  function updatePresetCategoryUI() {
    var categoryList = document.getElementById('categoryList');
    var addCategoryBtn = document.getElementById('addCategoryBtn');
    var sidebarHeader = document.querySelector('.sidebar-header');
    
    if (!categoryList) return;
    
    // [预设界面-分类界面更新]+[步骤]+[1] 更新侧栏标题
    if (sidebarHeader) {
      sidebarHeader.textContent = '预设分类';
    }
    
    // [单次动画守卫]+[步骤]+[2] 清理动画状态类，但保留首次淡入的准备状态
    var animateOnce = false;
    try { animateOnce = !!state.shouldAnimatePresetCategoryOnce; } catch (_) {}
    categoryList.classList.remove('category-loading', 'category-fadeout', 'category-switching', 'category-fadein');
    if (!animateOnce) {
      categoryList.classList.remove('category-fadein-prepare');
    }
    // 强制重绘，确保状态清理完成
    categoryList.offsetHeight;
    var presetSig = (state.presetFolders || []).join('|');
    
    // [预设界面-分类界面更新]+[步骤]+[2] 清空并重新填充分类列表
    categoryList.innerHTML = '';
    
    state.presetFolders.forEach(function (folder) {
      var item = document.createElement('div');
      item.className = 'category-item';
      if (folder === state.currentPresetCategory) {
        item.classList.add('active');
      }
      
      // 解码文件夹名称以正确显示
      var displayName = folder;
      try {
        if (folder.indexOf('%') !== -1) {
          displayName = decodeURIComponent(folder);
        }
      } catch (e) {
        // 解码失败时使用原始名称
        displayName = folder;
      }
      
      item.textContent = displayName;
      // 保存原始文件夹名称用于匹配
      item.setAttribute('data-folder-name', folder);
      
      // [预设界面-分类点击事件]+[功能名称]+[详细描述] 绑定预设分类点击事件
      item.addEventListener('click', function () {
        // 移除所有激活状态
        var items = categoryList.querySelectorAll('.category-item');
        items.forEach(function (i) { i.classList.remove('active'); });
        
        // 激活当前项
        this.classList.add('active');
        
        // 使用原始文件夹名称进行匹配
        var originalFolderName = this.getAttribute('data-folder-name') || folder;
        state.currentPresetCategory = originalFolderName;
        
        // 添加调试信息
        console.log('选择预设分类:', originalFolderName);
        console.log('显示名称:', this.textContent);
        console.log('当前预设总数:', state.allPresets.length);
        
        // 显示所有预设的目录信息用于调试
        if (state.allPresets.length > 0) {
          console.log('所有预设的目录信息:');
          var dirInfo = {};
          state.allPresets.forEach(function(preset) {
            var dir = preset.dir || '(空)';
            if (!dirInfo[dir]) {
              dirInfo[dir] = [];
            }
            dirInfo[dir].push(preset.name);
          });
          
          for (var dir in dirInfo) {
            console.log('目录 "' + dir + '":', dirInfo[dir].length + '个预设');
          }
        }
        
        // 重新过滤和渲染，保留当前搜索关键字
        applyFilter(getCurrentSearchKeyword());
        
        console.log('过滤后预设数量:', state.filtered.length);
        if (state.filtered.length > 0) {
          console.log('前3个预设示例:', state.filtered.slice(0, 3).map(function(p) {
            return { name: p.name, dir: p.dir, rel: p.rel };
          }));
        }
        
        renderList();
      });
      
      // [预设界面-分类右键菜单]+[功能名称]+[详细描述] 为非"全部"分类添加右键菜单
      if (folder !== '全部') {
        item.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          var originalFolderName = this.getAttribute('data-folder-name') || folder;
          showPresetCategoryContextMenu(e, originalFolderName);
        });
      }
      
      categoryList.appendChild(item);
    });
    
    // [预设界面-新建分类按钮]+[功能名称]+[详细描述] 更新新建分类按钮功能
    if (addCategoryBtn) {
      // 移除旧的事件监听器
      var newBtn = addCategoryBtn.cloneNode(true);
      addCategoryBtn.parentNode.replaceChild(newBtn, addCategoryBtn);
      
      // 添加新的事件监听器
      newBtn.addEventListener('click', showAddPresetCategoryDialog);
    }
    
    // [单次动画守卫]+[步骤]+[3] 仅在首次切换到预设时执行淡入动画：保留准备类，等待scanAndRender触发
    if (animateOnce) {
      categoryList.classList.add('category-fadein-prepare');
    }
    // 动画逻辑统一在scanAndRender中处理，确保在内容完全加载后触发
    try { state._lastPresetFoldersSignature = presetSig; } catch (_) {}
  }

  // [预设视图切换]+[功能名称]+[详细描述] 在预设视图和脚本视图之间切换
  function togglePresetView() {
    var body = document.body;
    var on = !body.classList.contains('show-preset');
    
    // [预设切换动效优化]+[步骤]+[1] 添加切换状态类，启用动画性能优化
    body.classList.add('preset-switching');
    
    // [预设切换按钮-动画效果]+[步骤]+[2] 切换视图状态与按钮动画
    if (on) {
      // 初始化设置持久化系统（若未初始化），用于长期保存布局与缩放
      try {
        if (window.SettingsPersistenceComplete && !SettingsPersistenceComplete.initialized) {
          SettingsPersistenceComplete.init(function(){
            try { console.log('SettingsPersistenceComplete: 预设视图初始化完成'); } catch(_) {}
          });
        }
      } catch (_) {}
      body.classList.add('show-preset');
      // 切入预设视图：仅首次进入触发淡入动画，其后保持静态避免闪烁
      try {
        var firstEnter = !state.initialScanDone;
        state.shouldAnimatePresetCategoryOnce = !!firstEnter;
        state.shouldAnimatePresetCardsOnce = !!firstEnter;
      } catch (_) {}
      if (els.toggleBtn) {
        els.toggleBtn.textContent = '脚本';
        els.toggleBtn.title = '切换回脚本视图';
        els.toggleBtn.classList.add('active');
      }
      // [预设/脚本切换]+[步骤]+[1] 顶部搜索占位符切换为"搜索预设..."
      try {
        var si = document.getElementById('searchInput');
        if (si) si.placeholder = '搜索预设...';
      } catch (_) {}
      
      // [预设界面-分类切换]+[功能名称]+[详细描述] 切换左侧分类为预设文件夹分类
      switchToPresetCategories();
      
      // [预设界面-初始布局修复]+[步骤]+[0] 进入预设模式时启用静默布局，避免初始跳动
      state.silentLayout = true;
      
      // [预设界面-初始布局修复]+[步骤]+[1] 确保UI构建完成后立即应用布局状态，避免跳变
      ensureUI();
      
      // [预设界面-初始布局修复]+[步骤]+[2] 同步应用布局和缩放状态，避免异步导致的跳动
      // 立即应用布局模式
      applyLayout();
      
      // 立即应用保存的缩放状态
      var sizeSlider = document.getElementById('sizeSlider');
      if (sizeSlider) {
        try {
          var savedScale = null;
          // 优先从长期持久化缓存读取
          if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.settingsCache && SettingsPersistenceComplete.settingsCache.presetScale !== undefined) {
            savedScale = SettingsPersistenceComplete.settingsCache.presetScale;
          } else {
            savedScale = localStorage.getItem('mogu_preset_scale');
          }
          if (savedScale !== null) {
            var scale = typeof savedScale === 'string' ? parseFloat(savedScale) : Number(savedScale);
            if (!isNaN(scale) && scale > 0) {
              sizeSlider.value = scale;
              // [预设界面-初始布局修复]+[步骤]+[3] 同步应用缩放，避免延迟跳变
              applyScaleToPresetItems();
            }
          }
        } catch (_) {}
      }
      
      // [预设界面-初始布局修复]+[步骤]+[4] 尽快触发扫描与渲染（仅首次），其后避免重复刷新造成闪烁
      setTimeout(function() {
        if (!state.initialScanDone) {
          scanAndRender(false);
          state.initialScanDone = true;
        } else {
          // 非首次进入：保持现有分类与列表，不清空、不隐藏，避免闪烁
          if (els.list) {
            els.list.classList.add('preset-list-show');
          }
        }
        // [预设界面-初始布局修复]+[步骤]+[5] 渲染流程结束后关闭静默布局
        state.silentLayout = false;
      }, 0);
      
      // [预设切换动效优化]+[步骤]+[2] 动画完成后移除切换状态类
      setTimeout(function() {
        body.classList.remove('preset-switching');
      }, 180); // 进一步缩短等待时间以提升切换速度
    
    } else {
      body.classList.remove('show-preset');
      // 标记：刚切回脚本模式，用于抑制脚本卡片初次进入时的过渡动画
      try { window.justEnteredScriptMode = Date.now(); } catch (_) {}
      if (els.toggleBtn) {
        els.toggleBtn.textContent = '预设';
        els.toggleBtn.title = '切换到预设视图';
        els.toggleBtn.classList.remove('active');
      }
      // [预设/脚本切换]+[步骤]+[2] 顶部搜索占位符切换回"搜索脚本..."
      try {
        var si2 = document.getElementById('searchInput');
        if (si2) si2.placeholder = '搜索脚本...';
      } catch (_) {}
      
      // [预设界面-分类切换]+[功能名称]+[详细描述] 切换回脚本分类
      switchToScriptCategories();

      // 切回脚本视图时恢复脚本界面的独立缩放滑块值
      try {
        var scriptSlider = document.getElementById('sizeSlider');
        if (scriptSlider) {
          var scriptSaved = null;
          if (window.SettingsPersistenceComplete && SettingsPersistenceComplete.settingsCache && SettingsPersistenceComplete.settingsCache.currentScale !== undefined) {
            scriptSaved = SettingsPersistenceComplete.settingsCache.currentScale;
          } else {
            scriptSaved = localStorage.getItem('mogu_ui_scale');
          }
          if (scriptSaved !== null) {
            var s = typeof scriptSaved === 'string' ? parseFloat(scriptSaved) : Number(scriptSaved);
            if (!isNaN(s) && s > 0) {
              scriptSlider.value = s;
            }
          }
        }
      } catch (_) {}

      // 切回脚本视图时，依据当前搜索框文本立即应用脚本过滤
      try {
        var siVal = '';
        var siNode = document.getElementById('searchInput');
        if (siNode) {
          siVal = (siNode.value || '').trim();
        }
        if (typeof window.populateScriptList === 'function') {
          // 同步脚本侧关键字，再刷新列表
          try { window.searchKeyword = siVal; } catch(_) {}
          window.populateScriptList();
        }
      } catch(_) {}
      
      // [预设切换动效优化]+[步骤]+[3] 切换回脚本视图时也需要移除切换状态类
      setTimeout(function() {
        body.classList.remove('preset-switching');
      }, 450); // 稍短一些，因为脚本视图切换更快
    }
  }

  // [预设界面-分类切换]+[功能名称]+[详细描述] 切换到预设分类模式
  function switchToPresetCategories() {
    var sidebarHeader = document.querySelector('.sidebar-header');
    var categoryList = document.getElementById('categoryList');
    var list = els && els.list ? els.list : document.querySelector('.preset-list');
    
    // [时序修复]+[步骤]+[1] 移除重复的动画标志设置，避免与togglePresetView冲突
    // 动画标志已在togglePresetView中设置，此处不再重复设置
    
    // [闪烁修复]+[步骤]+[1] 清理所有可能冲突的动画状态类
    // 若已经完成首次扫描渲染：仍需更新左侧为预设文件夹分类，避免残留脚本分类
    if (state.initialScanDone) {
      if (sidebarHeader) {
        sidebarHeader.textContent = '预设分类';
      }
      if (list) {
        list.classList.add('preset-list-show');
      }
      // 始终刷新分类UI为本地预设文件夹
      try {
        if (!state.presetFolders || state.presetFolders.length === 0) {
          extractPresetFolders();
        }
        updatePresetCategoryUI();
      } catch (_) {}
    } else {
      if (categoryList) {
        categoryList.classList.remove('category-switching', 'category-fadein', 'category-fadein-prepare', 'category-loading');
        // 强制重绘，确保状态清理完成
        categoryList.offsetHeight;
        categoryList.classList.add('category-fadeout');
      }
    }
    
    // [时序修复]+[步骤]+[2] 立即更新标题并进入空白初始状态
    if (sidebarHeader) {
      sidebarHeader.textContent = '预设分类';
    }
    
    // [空白初始状态]+[步骤]+[1] 切换后不显示任何内容，等待动画展示
    if (!state.initialScanDone) {
      if (categoryList) {
        categoryList.innerHTML = '';
        categoryList.classList.remove('category-loading');
        categoryList.classList.add('category-fadein-prepare');
      }
      // [空白初始状态]+[步骤]+[2] 隐藏预设列表容器，等待动画展示（仅首次）
      if (list) {
        list.classList.remove('preset-list-show');
      }
    }
    
    // [时序修复]+[步骤]+[4] 移除scanAndRender调用，统一由togglePresetView处理
    // scanAndRender调用已移至togglePresetView中统一处理，避免重复调用
  }

  // [预设界面-分类切换]+[功能名称]+[详细描述] 切换回脚本分类模式
  function switchToScriptCategories() {
    var sidebarHeader = document.querySelector('.sidebar-header');
    var categoryList = document.getElementById('categoryList');
    var addCategoryBtn = document.getElementById('addCategoryBtn');
    
    // [闪烁修复]+[步骤]+[3] 清理所有预设相关的动画状态类
    if (categoryList) {
      categoryList.classList.remove('category-fadeout', 'category-fadein', 'category-fadein-prepare', 'category-loading');
      // 强制重绘，确保状态清理完成
      categoryList.offsetHeight;
      categoryList.classList.add('category-switching');
    }
    
    if (sidebarHeader) {
      sidebarHeader.textContent = '分类';
    }
    
    // [预设界面-分类切换]+[步骤]+[1] 恢复脚本分类功能
    if (window.populateCategoryList && typeof window.populateCategoryList === 'function') {
      window.populateCategoryList();
    }
    
    // [预设界面-分类切换]+[步骤]+[2] 恢复新建分类按钮的脚本功能
    if (addCategoryBtn && window.showAddCategoryDialog) {
      var newBtn = addCategoryBtn.cloneNode(true);
      addCategoryBtn.parentNode.replaceChild(newBtn, addCategoryBtn);
      newBtn.addEventListener('click', window.showAddCategoryDialog);
    }
    
    // [分类切换动效优化]+[步骤]+[4] 延迟移除切换状态，确保动画完成
    setTimeout(function() {
      if (categoryList) {
        categoryList.classList.remove('category-switching');
      }
    }, 300);
  }

  // [预设界面-预设右键菜单]+[功能名称]+[详细描述] 显示预设卡片的右键菜单
  function showPresetContextMenu(event, presetItem) {
    // [预设界面-预设右键菜单]+[步骤]+[0] 先清除所有现有的右键菜单
    hideAllContextMenus();
    
    // 创建右键菜单
    var menu = document.createElement('div');
    menu.className = 'context-menu preset-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    var settingsItem = document.createElement('div');
    settingsItem.className = 'menu-item';
    settingsItem.textContent = '预设设置';
    settingsItem.addEventListener('click', function () {
      showPresetSettingsDialog(presetItem);
      hideAllContextMenus();
    });
    
    menu.appendChild(settingsItem);
    document.body.appendChild(menu);
    
    // [预设界面-预设右键菜单]+[步骤]+[1] 点击其他地方关闭菜单
    setTimeout(function () {
      document.addEventListener('click', function closeMenu() {
        hideAllContextMenus();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  }

  // [预设界面-分类右键菜单]+[功能名称]+[详细描述] 显示预设分类的右键菜单
  function showPresetCategoryContextMenu(event, categoryName) {
    // [预设界面-分类右键菜单]+[步骤]+[0] 先清除所有现有的右键菜单
    hideAllContextMenus();
    
    // 创建右键菜单
    var menu = document.createElement('div');
    menu.className = 'context-menu preset-category-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    var renameItem = document.createElement('div');
    renameItem.className = 'menu-item';
    renameItem.textContent = '重命名分类';
    renameItem.addEventListener('click', function () {
      showRenamePresetCategoryDialog(categoryName);
      hideAllContextMenus();
    });
    
    var deleteItem = document.createElement('div');
    deleteItem.className = 'menu-item';
    deleteItem.textContent = '删除分类';
    deleteItem.addEventListener('click', function () {
      deletePresetCategory(categoryName);
      hideAllContextMenus();
    });
    
    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // [预设界面-分类右键菜单]+[步骤]+[1] 点击其他地方关闭菜单
    setTimeout(function () {
      document.addEventListener('click', function closeMenu() {
        hideAllContextMenus();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  }

  // [预设界面-隐藏所有右键菜单]+[功能名称]+[详细描述] 隐藏所有现有的右键菜单
  function hideAllContextMenus() {
    var menus = document.querySelectorAll('.context-menu');
    menus.forEach(function(menu) {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    });
  }

  // [预设界面-新建分类对话框]+[功能名称]+[详细描述] 显示新建预设分类对话框
  function showAddPresetCategoryDialog() {
    if (!state.presetRoot) {
      safeNotify('无法创建预设分类：未找到预设根目录', true);
      return;
    }
    
    var content = `
      <div class="dialog-header">添加预设分类</div>
      <div class="dialog-group">
        <label>分类名称:</label>
        <input type="text" id="presetCategoryNameInput" placeholder="输入分类名称">
      </div>
      <div class="dialog-description">将在预设根目录下创建对应的文件夹</div>
      <div class="dialog-actions">
        <button onclick="addPresetCategory()" class="btn-primary">确定</button>
        <button onclick="hideDialog()" class="btn-secondary">取消</button>
      </div>
    `;
    
    if (window.showDialog && typeof window.showDialog === 'function') {
      window.showDialog(content);
    } else {
      // 简单的替代实现
      var name = prompt('请输入预设分类名称:');
      if (name && name.trim()) {
        addPresetCategory(name.trim());
      }
    }
    
    setTimeout(function () {
      var input = document.getElementById('presetCategoryNameInput');
      if (input) input.focus();
    }, 100);
  }

  // [预设界面-新建分类]+[功能名称]+[详细描述] 创建新的预设分类文件夹
  function addPresetCategory(categoryName) {
    if (!categoryName) {
      var input = document.getElementById('presetCategoryNameInput');
      categoryName = input ? input.value.trim() : '';
    }
    
    if (!categoryName) {
      safeNotify('请输入分类名称', true);
      return;
    }
    
    if (state.presetFolders.indexOf(categoryName) !== -1) {
      safeNotify('分类已存在', true);
      return;
    }
    
    // [预设界面-新建分类]+[步骤]+[1] 调用ExtendScript创建文件夹
    var cs = new CSInterface();
    var folderPath = state.presetRoot + '/' + categoryName;
    var escapedPath = folderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    cs.evalScript("createPresetFolder('" + escapedPath + "')", function (result) {
      if (result && result.indexOf('Error:') === 0) {
        safeNotify('创建分类失败：' + result.substring(6), true);
        return;
      }
      
      // [预设界面-新建分类]+[步骤]+[2] 更新本地分类列表
      state.presetFolders.push(categoryName);
      updatePresetCategoryUI();
      
      // [预设界面-新建分类]+[步骤]+[3] 关闭对话框
      if (window.hideDialog && typeof window.hideDialog === 'function') {
        window.hideDialog();
      }
      
      safeNotify('预设分类创建成功：' + categoryName, false);
    });
  }

  // [预设界面-删除分类]+[功能名称]+[详细描述] 删除预设分类文件夹
  function deletePresetCategory(categoryName) {
    if (!confirm('确定要删除预设分类 "' + categoryName + '" 吗？\n\n注意：这将删除对应的文件夹及其中的所有预设文件！')) {
      return;
    }
    
    // [预设界面-删除分类]+[步骤]+[1] 调用ExtendScript删除文件夹
    var cs = new CSInterface();
    var folderPath = state.presetRoot + '/' + categoryName;
    var escapedPath = folderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    cs.evalScript("deletePresetFolder('" + escapedPath + "')", function (result) {
      if (result && result.indexOf('Error:') === 0) {
        safeNotify('删除分类失败：' + result.substring(6), true);
        return;
      }
      
      // [预设界面-删除分类]+[步骤]+[2] 更新本地分类列表
      var index = state.presetFolders.indexOf(categoryName);
      if (index !== -1) {
        state.presetFolders.splice(index, 1);
      }
      
      // [预设界面-删除分类]+[步骤]+[3] 如果当前选中的是被删除的分类，切换到"全部"
      if (state.currentPresetCategory === categoryName) {
        state.currentPresetCategory = '全部';
      }
      
      updatePresetCategoryUI();
      
      // [预设界面-删除分类]+[步骤]+[4] 重新扫描预设
      scanAndRender(true);
      
      safeNotify('预设分类删除成功：' + categoryName, false);
    });
  }

  // [预设界面-切换按钮绑定]+[功能名称]+[详细描述] 绑定预设/脚本切换按钮事件
  function bindToggleButton() {
    els.toggleBtn = $('presetToggleBtn');
    if (els.toggleBtn) {
      // [预设切换按钮-动画效果]+[步骤]+[1] 添加开关切换动画逻辑
      els.toggleBtn.addEventListener('click', function() {
        // 添加切换动画效果
        this.classList.add('active');
        
        // 延迟执行切换逻辑，让动画先开始
        setTimeout(() => {
          togglePresetView();
          
          // 根据当前状态更新按钮样式
          const isShowingPreset = document.body.classList.contains('show-preset');
          if (isShowingPreset) {
            this.classList.add('active');
          } else {
            this.classList.remove('active');
          }
        }, 50);
      });
    }
  }

  // [预设界面-安全通知]+[功能名称]+[详细描述] 安全地显示通知消息
  function safeNotify(msg, isErr) {
    try {
      if (typeof window.showNotification === 'function') {
        window.showNotification(msg, !!isErr);
      } else if (typeof window.showCustomAlert === 'function') {
        window.showCustomAlert(msg, !!isErr);
      } else {
        console[(isErr ? 'error' : 'log')](msg);
      }
    } catch (_) {}
  }

  // [预设界面-HTML转义]+[功能名称]+[详细描述] 转义HTML特殊字符防止XSS攻击
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c];
    });
  }

  /**
   * [预设标签-着色映射]+[步骤]+[1]
   * 将标签名标准化（去除首尾空格、统一为小写），保证颜色映射一致性
   * @param {string} tag 原始标签名
   * @returns {string} 标准化标签名
   */
  function normalizeTag(tag) {
    try { return String(tag || '').trim().toLowerCase(); } catch (_) { return ''; }
  }

  /**
   * [预设标签-着色映射]+[步骤]+[2]
   * 生成稳定的32位哈希值（FNV-1a 变体），用于映射色相
   * @param {string} str 输入字符串
   * @returns {number} 哈希值
   */
  function hashString32(str) {
    var s = normalizeTag(str);
    var h = 2166136261 >>> 0; // FNV-1a offset basis
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; // *16777619
    }
    return h >>> 0;
  }

  /**
   * [预设标签-着色映射]+[步骤]+[3] 限制范围
   */
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /**
   * [预设标签-着色映射]+[步骤]+[4] 组合HSL为CSS字符串
   */
  function hslCss(h, s, l) { return 'hsl(' + Math.round(h) + 'deg ' + Math.round(s) + '% ' + Math.round(l) + '%)'; }

  /**
   * [预设标签-着色映射]+[步骤]+[5] 根据亮度选择文字颜色
   */
  function pickTextColorForHsl(h, s, l) { return (l >= 58) ? '#111' : '#fff'; }

  /**
   * [预设标签-着色映射]+[步骤]+[6]
   * 根据标签名获取稳定的颜色方案（背景/边框/文本）
   * @param {string} tag 标签名
   * @returns {{bg:string,text:string,border:string}}
   */
  function getTagColor(tag) {
    var hv = hashString32(tag);
    var h = hv % 360;  // 色相
    var s = 62;        // 饱和度
    var l = 40;        // 亮度
    var bg = hslCss(h, s, l);
    var border = hslCss(h, s * 0.9, clamp(l + 18, 20, 85));
    var text = pickTextColorForHsl(h, s, l);
    return { bg: bg, text: text, border: border };
  }

  // [预设界面-初始化]+[功能名称]+[详细描述] 初始化预设界面的所有功能
  // [全局快捷键重定向]+[功能名称]+[详细描述]
  // 禁用面板内的 Ctrl/Cmd+Z/Y 文本撤销，将其重定向到 AE 的撤销/重做
  function installGlobalUndoRedirect() {
    try {
      if (window.__undoRedirectInstalled__) return;
      window.__undoRedirectInstalled__ = true;
      var cs = new CSInterface();

      function isModifierHeld(evt) {
        // Windows: Ctrl；macOS: Meta（Cmd）
        return !!(evt.ctrlKey || evt.metaKey);
      }

      function handleKeydown(e) {
        // 只在具有 Z/Y 的组合键时处理
        var key = (e.key || '').toLowerCase();
        var isZ = key === 'z';
        var isY = key === 'y';

        if (isModifierHeld(e) && (isZ || isY)) {
          // 阻止浏览器/输入框的撤销/重做
          e.preventDefault();
          e.stopPropagation();

          // 先让当前活动元素失焦，避免后续输入法/浏览器再次拦截
          try {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
              document.activeElement.blur();
            }
          } catch (_) {}

          // 调用 AE 执行撤销/重做；失败则至少前置 AE 窗口
          var cmd = isZ ? 'performAeUndo()' : 'performAeRedo()';
          cs.evalScript(cmd, function(res) {
            // 若命令异常，仍尝试前置 AE 窗口
            if (!res || (typeof res === 'string' && res.indexOf('Error:') === 0)) {
              try { cs.evalScript('bringAEToFront()', function(){}); } catch(_) {}
            }
          });
        }
      }

      // 捕获阶段监听，优先拦截
      window.addEventListener('keydown', handleKeydown, true);
    } catch (e) {
      try { console.warn('installGlobalUndoRedirect 失败:', e); } catch (_) {}
    }
  }

  function init() {
    bindToggleButton();
    installGlobalUndoRedirect();
    
    // [预设界面-初始化]+[步骤]+[0] 加载预设设置
    loadPresetSettings();
    
    // [预设界面-拖拽排序管理器初始化]+[功能名称]+[详细描述] 初始化拖拽排序管理器
    setTimeout(function() {
      if (typeof initPresetDragSort === 'function') {
        initPresetDragSort();
        console.log('预设拖拽排序功能已启用');
      }
    }, 300);
    
    // [预设切换按钮-动画效果]+[步骤]+[3] 初始化时设置正确的按钮状态
    setTimeout(function() {
      if (els.toggleBtn) {
        const isShowingPreset = document.body.classList.contains('show-preset');
        if (isShowingPreset) {
          els.toggleBtn.classList.add('active');
          els.toggleBtn.textContent = '脚本';
          els.toggleBtn.title = '切换回脚本视图';
        } else {
          els.toggleBtn.classList.remove('active');
          els.toggleBtn.textContent = '预设';
          els.toggleBtn.title = '切换到预设视图';
        }
      }
    }, 100);
    
    // [预设界面-初始化]+[步骤]+[1] 若初始即显示预设视图，保证UI就绪
    if (document.body.classList.contains('show-preset')) {
      ensureUI();
      scanAndRender(false);
    }
    
    // [预设界面-对外接口]+[步骤]+[1] 对外暴露：根据关键字过滤预设列表（供顶栏搜索框等调用）
    try {
      window.filterPresetByKeyword = function (keyword) {
        var q = (keyword || '').trim().toLowerCase();
        applyFilter(q);
        renderList();
      };
      
      // [预设界面-对外接口]+[步骤]+[2] 暴露预设分类切换功能
      window.switchPresetCategory = function (categoryName) {
        if (state.presetFolders.indexOf(categoryName) !== -1) {
          state.currentPresetCategory = categoryName;
          // 分类切换后保留当前搜索关键字
          applyFilter(getCurrentSearchKeyword());
          renderList();
          updatePresetCategoryUI();
        }
      };
      
      // [预设界面-对外接口]+[步骤]+[3] 暴露当前预设状态查询
      window.getPresetState = function () {
        return {
          isPresetMode: document.body.classList.contains('show-preset'),
          currentCategory: state.currentPresetCategory,
          categories: state.presetFolders.slice(0),
          presetCount: state.allPresets.length,
          filteredCount: state.filtered.length
        };
      };
    } catch (_) {}
  }

  // [预设界面-预设设置相关函数]+[功能名称]+[详细描述] 预设设置相关的辅助函数

  // [预设界面-预设设置存储]+[功能名称]+[详细描述] 预设设置存储对象
  var presetSettings = {};

  // [预设界面-加载预设设置]+[功能名称]+[详细描述] 从本地存储加载预设设置
  function loadPresetSettings() {
    try {
      var saved = localStorage.getItem('mogu_preset_settings');
      if (saved) {
        presetSettings = JSON.parse(saved);
        console.log('预设设置加载成功，共', Object.keys(presetSettings).length, '个预设有自定义设置');
      }
    } catch (e) {
      console.log('加载预设设置失败:', e);
      presetSettings = {};
    }
  }

  // [预设界面-获取预设设置]+[功能名称]+[详细描述] 获取预设的特定设置
  function getPresetSetting(presetIdentifier, key) {
    if (presetSettings[presetIdentifier] && presetSettings[presetIdentifier][key] !== undefined) {
      return presetSettings[presetIdentifier][key];
    }
    return null;
  }

  // [预设界面-设置预设设置]+[功能名称]+[详细描述] 设置预设的特定设置
  function setPresetSetting(presetIdentifier, key, value) {
    if (!presetSettings[presetIdentifier]) {
      presetSettings[presetIdentifier] = {};
    }
    presetSettings[presetIdentifier][key] = value;
  }

  // [预设界面-预设设置对话框]+[功能名称]+[详细描述] 显示预设设置对话框
  function showPresetSettingsDialog(presetItem) {
    var presetIdentifier = presetItem.path; // 使用完整路径作为唯一标识符
    var displayName = getPresetSetting(presetIdentifier, 'displayName') || presetItem.name;
    var description = getPresetSetting(presetIdentifier, 'description') || '';
    var imagePath = getPresetSetting(presetIdentifier, 'imagePath') || '';
    
    // [预设界面-预设设置对话框]+[步骤]+[0] 根据预设文件路径自动识别分类
    var autoDetectedCategory = detectPresetCategory(presetItem);
    var category = getPresetSetting(presetIdentifier, 'category') || autoDetectedCategory;
    var presetTags = getPresetSetting(presetIdentifier, 'tags') || [];
    
    // [预设界面-预设设置对话框]+[步骤]+[1] 构建分类选项
    var categoryOptions = '';
    categoryOptions += '<option value="">无分类</option>';
    state.presetFolders.forEach(function(cat) {
      if (cat !== '全部') {
        var selected = cat === category ? 'selected' : '';
        categoryOptions += '<option value="' + escapeHtml(cat) + '" ' + selected + '>' + escapeHtml(cat) + '</option>';
      }
    });
    
    // [预设界面-预设设置对话框]+[步骤]+[2] 构建标签按钮（与脚本共用标签系统）
    var tagButtons = '';
    if (window.allTags && Array.isArray(window.allTags)) {
      window.allTags.forEach(function(tag) {
        var active = presetTags.indexOf(tag) !== -1 ? 'active' : '';
        tagButtons += '<button class="tag-button ' + active + '" data-tag="' + escapeHtml(tag) + '" onclick="togglePresetTag(this)">' + escapeHtml(tag) + '</button>';
      });
    }
    
    var content = [
      '<div class="dialog-header">预设设置 - ' + escapeHtml(presetItem.name) + '</div>',
      '<div class="dialog-content">',
        '<div class="dialog-group">',
          '<label>显示名称:</label>',
          '<input type="text" id="presetDisplayName" value="' + escapeHtml(displayName) + '">',
        '</div>',
        '<div class="dialog-group">',
          '<label>描述:</label>',
          '<textarea id="presetDescription">' + escapeHtml(description) + '</textarea>',
        '</div>',
        '<div class="dialog-group">',
          '<label>预览图片路径:</label>',
          '<input type="text" id="presetImagePath" value="' + escapeHtml(imagePath) + '" placeholder="图片文件路径或链接">',
          '<button class="btn btn-small" onclick="selectPresetImageFile()">选择图片</button>',
          '<div class="dialog-hint">设置后将在预设卡片的预览区域显示</div>',
        '</div>',
        '<div class="dialog-group">',
          '<label>分类:</label>',
          '<select id="presetCategory">' + categoryOptions + '</select>',
        '</div>',
        '<div class="dialog-group">',
          '<label>标签:</label>',
          '<div id="presetTagsContainer" class="tags-panel">' + tagButtons + '</div>',
          '<div style="margin-top: 10px;">',
            '<input type="text" id="newPresetTagInput" placeholder="添加新标签">',
            '<button class="btn btn-small" onclick="addNewTagToPreset()">+</button>',
          '</div>',
        '</div>',
      '</div>',
      '<div class="dialog-buttons">',
        '<button class="btn" onclick="hideDialog()">取消</button>',
        '<button class="btn" onclick="savePresetSettings(\'' + presetIdentifier.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\', \'' + presetItem.name.replace(/'/g, "\\'") + '\')">保存</button>',
      '</div>'
    ].join('');
    
    if (window.showDialog && typeof window.showDialog === 'function') {
      window.showDialog(content);
    } else {
      safeNotify('无法显示设置对话框：showDialog函数不可用', true);
    }
  }

  // [预设界面-重命名分类对话框]+[功能名称]+[详细描述] 显示重命名预设分类对话框
  function showRenamePresetCategoryDialog(categoryName) {
    var content = [
      '<div class="dialog-header">重命名预设分类</div>',
      '<div class="dialog-group">',
        '<label>分类名称:</label>',
        '<input type="text" id="renameCategoryNameInput" value="' + escapeHtml(categoryName) + '">',
      '</div>',
      '<div class="dialog-description">注意：本地对应的预设文件夹名称也会跟着改变</div>',
      '<div class="dialog-actions">',
        '<button onclick="renamePresetCategory(\'' + categoryName.replace(/'/g, "\\'") + '\')" class="btn-primary">确定</button>',
        '<button onclick="hideDialog()" class="btn-secondary">取消</button>',
      '</div>'
    ].join('');
    
    if (window.showDialog && typeof window.showDialog === 'function') {
      window.showDialog(content);
    } else {
      // 简单的替代实现
      var newName = prompt('请输入新的分类名称:', categoryName);
      if (newName && newName.trim() && newName !== categoryName) {
        renamePresetCategory(categoryName, newName.trim());
      }
    }
    
    setTimeout(function () {
      var input = document.getElementById('renameCategoryNameInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }

  // [预设界面-重命名分类]+[功能名称]+[详细描述] 重命名预设分类文件夹
  function renamePresetCategory(oldName, newName) {
    if (!newName) {
      var input = document.getElementById('renameCategoryNameInput');
      newName = input ? input.value.trim() : '';
    }
    
    if (!newName || newName === oldName) {
      if (window.hideDialog && typeof window.hideDialog === 'function') {
        window.hideDialog();
      }
      return;
    }
    
    if (state.presetFolders.indexOf(newName) !== -1) {
      safeNotify('分类名称已存在', true);
      return;
    }
    
    // [预设界面-重命名分类]+[步骤]+[1] 调用ExtendScript重命名文件夹
    var cs = new CSInterface();
    var oldFolderPath = state.presetRoot + '/' + oldName;
    var newFolderPath = state.presetRoot + '/' + newName;
    var escapedOldPath = oldFolderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var escapedNewPath = newFolderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    cs.evalScript("renamePresetFolder('" + escapedOldPath + "', '" + escapedNewPath + "')", function (result) {
      if (result && result.indexOf('Error:') === 0) {
        safeNotify('重命名分类失败：' + result.substring(6), true);
        return;
      }
      
      // [预设界面-重命名分类]+[步骤]+[2] 更新本地分类列表
      var index = state.presetFolders.indexOf(oldName);
      if (index !== -1) {
        state.presetFolders[index] = newName;
      }
      
      // [预设界面-重命名分类]+[步骤]+[3] 如果当前选中的是被重命名的分类，更新当前分类
      if (state.currentPresetCategory === oldName) {
        state.currentPresetCategory = newName;
      }
      
      updatePresetCategoryUI();
      
      // [预设界面-重命名分类]+[步骤]+[4] 重新扫描预设
      scanAndRender(true);
      
      // [预设界面-重命名分类]+[步骤]+[5] 关闭对话框
      if (window.hideDialog && typeof window.hideDialog === 'function') {
        window.hideDialog();
      }
      
      safeNotify('预设分类重命名成功：' + oldName + ' → ' + newName, false);
    });
  }

  // [预设界面-全局函数暴露]+[功能名称]+[详细描述] 暴露必要的函数供HTML调用
  window.addPresetCategory = addPresetCategory;
  window.renamePresetCategory = renamePresetCategory;
  window.togglePresetTag = togglePresetTag;
  window.addNewTagToPreset = addNewTagToPreset;
  window.selectPresetImageFile = selectPresetImageFile;
  window.savePresetSettings = savePresetSettings;

  // [预设界面-拖拽排序初始化函数]+[功能名称]+[详细描述] 初始化预设卡片的拖拽排序功能
  function initPresetDragSort() {
    // 这个函数现在由全局的 dragSort.js 处理
    // 只需要加载保存的排序
    setTimeout(function() {
      loadPresetOrder();
    }, 100);
    
    console.log('预设拖拽排序初始化完成');
  }

  // [预设界面-拖拽排序保存函数]+[功能名称]+[详细描述] 保存当前预设的排序到本地存储
  function savePresetOrder() {
    if (!els.list) return;
    
    var presetCards = els.list.querySelectorAll('.preset-card');
    var orderData = [];
    
    presetCards.forEach(function(card, index) {
      var presetId = card.dataset.presetId;
      var presetPath = card.dataset.presetPath;
      if (presetId) {
        orderData.push({
          id: presetId,
          path: presetPath,
          position: index
        });
      }
    });
    
    try {
      localStorage.setItem('mogu_preset_order', JSON.stringify(orderData));
      console.log('预设排序已保存:', orderData.length, '个预设');
    } catch (e) {
      console.error('保存预设排序失败:', e);
    }
  }

  // [预设界面-拖拽排序加载函数]+[功能名称]+[详细描述] 从本地存储加载预设排序
  function loadPresetOrder() {
    try {
      var savedOrder = localStorage.getItem('mogu_preset_order');
      if (!savedOrder || !els.list) return;
      
      var orderData = JSON.parse(savedOrder);
      var presetCards = els.list.querySelectorAll('.preset-card');
      var cardMap = new Map();
      
      // 创建预设ID到卡片元素的映射
      presetCards.forEach(function(card) {
        var presetId = card.dataset.presetId;
        if (presetId) {
          cardMap.set(presetId, card);
        }
      });
      
      // 按保存的顺序重新排列预设卡片
      orderData
        .sort(function(a, b) { return a.position - b.position; })
        .forEach(function(item) {
          var card = cardMap.get(item.id);
          if (card && els.list.contains(card)) {
            els.list.appendChild(card);
          }
        });
      
      console.log('预设排序已恢复:', orderData.length, '个预设');
    } catch (e) {
      console.error('加载预设排序失败:', e);
    }
  }

  // [预设界面-对外接口扩展]+[功能名称]+[详细描述] 暴露拖拽排序相关的接口
  window.savePresetOrder = savePresetOrder;
  window.loadPresetOrder = loadPresetOrder;
  window.initPresetDragSort = initPresetDragSort;

  // [预设界面-预设标签切换]+[功能名称]+[详细描述] 切换预设标签的激活状态
  function togglePresetTag(button) {
    button.classList.toggle('active');
  }

  // [预设界面-添加新标签到预设]+[功能名称]+[详细描述] 为预设添加新标签
  function addNewTagToPreset() {
    var newTag = document.getElementById('newPresetTagInput').value.trim();
    if (newTag) {
      if (window.allTags && window.allTags.indexOf(newTag) === -1) {
        window.allTags.push(newTag);
        // 立即更新主界面的标签面板
        if (window.populateTagsPanel && typeof window.populateTagsPanel === 'function') {
          window.populateTagsPanel();
        }
      }
      
      var container = document.getElementById('presetTagsContainer');
      if (container) {
        var button = document.createElement('button');
        button.className = 'tag-button active';
        button.setAttribute('data-tag', newTag);
        button.setAttribute('onclick', 'togglePresetTag(this)');
        button.textContent = newTag;
        container.appendChild(button);
      }
      
      document.getElementById('newPresetTagInput').value = '';
    }
  }

  // [预设界面-选择预设图片文件]+[功能名称]+[详细描述] 选择预设的预览图片文件
  function selectPresetImageFile() {
    var cs = new CSInterface();
    cs.evalScript('selectImageFile()', function(result) {
      if (result && result !== 'null' && result !== 'undefined') {
        var input = document.getElementById('presetImagePath');
        if (input) {
          input.value = result;
        }
      }
    });
  }



  // [预设界面-预设分类检测]+[功能名称]+[详细描述] 根据预设文件路径自动检测分类
  function detectPresetCategory(presetItem) {
    if (!presetItem || !presetItem.rel) {
      return '';
    }
    
    // [预设界面-预设分类检测]+[步骤]+[1] 从相对路径中提取第一级目录作为分类
    var relativePath = presetItem.rel;
    var pathParts = relativePath.split(/[\/\\]/);
    
    // [预设界面-预设分类检测]+[步骤]+[2] 如果路径包含子目录，第一个部分就是分类
    if (pathParts.length > 1) {
      var detectedCategory = pathParts[0];
      
      // [预设界面-预设分类检测]+[步骤]+[3] 处理URL编码的分类名称
      try {
        if (detectedCategory.indexOf('%') !== -1) {
          detectedCategory = decodeURIComponent(detectedCategory);
        }
      } catch (e) {
        // 解码失败时使用原始名称
      }
      
      return detectedCategory;
    }
    
    return ''; // 根目录下的预设没有分类
  }

  // [预设界面-保存预设设置]+[功能名称]+[详细描述] 保存预设的所有设置
  function savePresetSettings(presetPath, presetName) {
    var displayName = document.getElementById('presetDisplayName').value.trim();
    var description = document.getElementById('presetDescription').value.trim();
    var imagePath = document.getElementById('presetImagePath').value.trim();
    var category = document.getElementById('presetCategory').value;
    
    var selectedTags = [];
    var activeButtons = document.querySelectorAll('#presetTagsContainer .tag-button.active');
    activeButtons.forEach(function(button) {
      selectedTags.push(button.getAttribute('data-tag'));
    });
    
    var presetIdentifier = presetPath; // 使用完整路径作为唯一标识符
    
    // [预设界面-保存预设设置]+[步骤]+[0] 获取当前预设的实际分类（基于文件路径）
    var currentPresetItem = null;
    for (var i = 0; i < state.allPresets.length; i++) {
      if (state.allPresets[i].path === presetPath) {
        currentPresetItem = state.allPresets[i];
        break;
      }
    }
    
    var currentCategory = currentPresetItem ? detectPresetCategory(currentPresetItem) : '';
    
    setPresetSetting(presetIdentifier, 'displayName', displayName);
    setPresetSetting(presetIdentifier, 'description', description);
    setPresetSetting(presetIdentifier, 'imagePath', imagePath);
    setPresetSetting(presetIdentifier, 'category', category);
    setPresetSetting(presetIdentifier, 'tags', selectedTags);
    
    // [预设界面-保存预设设置]+[步骤]+[1] 如果修改了分类，需要移动预设文件
    if (category !== currentCategory && category !== '') {
      // 调用ExtendScript移动预设文件到新分类文件夹
      var cs = new CSInterface();
      var sourcePath = presetPath;
      var targetFolderPath = state.presetRoot + '/' + category;
      var escapedSourcePath = sourcePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var escapedTargetPath = targetFolderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      
      cs.evalScript("movePresetToCategory('" + escapedSourcePath + "', '" + escapedTargetPath + "')", function (result) {
        if (result && result.indexOf('Error:') === 0) {
          safeNotify('移动预设文件失败：' + result.substring(6), true);
        } else {
          safeNotify('预设设置保存成功，文件已移动到新分类', false);
          
          // 重新扫描预设以反映文件移动
          scanAndRender(true);
        }
      });
    } else if (category === '' && currentCategory !== '') {
      // [预设界面-保存预设设置]+[步骤]+[2] 如果将分类设置为空，移动到根目录
      var cs = new CSInterface();
      var sourcePath = presetPath;
      var targetFolderPath = state.presetRoot;
      var escapedSourcePath = sourcePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var escapedTargetPath = targetFolderPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      
      cs.evalScript("movePresetToCategory('" + escapedSourcePath + "', '" + escapedTargetPath + "')", function (result) {
        if (result && result.indexOf('Error:') === 0) {
          safeNotify('移动预设文件失败：' + result.substring(6), true);
        } else {
          safeNotify('预设设置保存成功，文件已移动到根目录', false);
          
          // 重新扫描预设以反映文件移动
          scanAndRender(true);
        }
      });
    } else {
      safeNotify('预设设置保存成功', false);
    }
    
    // 保存设置到本地存储或数据管理器
    try {
      localStorage.setItem('mogu_preset_settings', JSON.stringify(presetSettings));
    } catch (e) {
      console.log('保存预设设置到本地存储失败:', e);
    }
    
    // 更新主界面的标签面板以反映新添加的标签
    if (window.populateTagsPanel && typeof window.populateTagsPanel === 'function') {
      window.populateTagsPanel();
    }
    
    // 重新渲染预设列表以反映设置变更
    renderList();
    
    if (window.hideDialog && typeof window.hideDialog === 'function') {
      window.hideDialog();
    }
  }

  // [预设界面-启动]+[步骤]+[1] 根据文档加载状态启动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();