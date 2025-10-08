/**
 * [预设拖拽排序管理器]+[功能名称]+[详细描述] 专门处理预设卡片的拖拽排序功能
 * 提供长按拖拽、位置交换、永久保存等完整的拖拽排序体验
 * 
 * 主要功能：
 * - 长按检测和拖拽启动
 * - 平滑的拖拽动画和视觉反馈
 * - 实时位置检测和占位符显示
 * - 拖拽完成后的排序保存
 * - 支持网格和列表两种布局模式
 */
class PresetDragSortManager {
    constructor() {
        // [拖拽管理器-初始化参数]+[功能名称]+[详细描述] 拖拽行为的核心参数配置
        this.longPressDelay = 180;         // 长按延迟时间（毫秒）- 快速响应
        this.dragThreshold = 6;            // 拖拽阈值（像素）- 防止误触
        
        // [拖拽管理器-状态变量]+[功能名称]+[详细描述] 跟踪拖拽过程中的各种状态
        this.isDragging = false;           // 是否正在拖拽
        this.dragElement = null;           // 当前拖拽的元素
        this.dragClone = null;             // 拖拽时的克隆元素
        this.placeholder = null;           // 占位符元素
        this.longPressTimer = null;        // 长按定时器
        this.startX = 0;                   // 开始拖拽的X坐标
        this.startY = 0;                   // 开始拖拽的Y坐标
        this.startTime = 0;                // 开始时间戳
        this.originalOrder = [];           // 原始排序

        // [网格拖拽-稳定索引]+[功能名称]+[详细描述] 在边界附近保持索引稳定，避免抽搐
        this.lastGridIndex = null;         // 最近稳定的目标索引
        this.lastGridIndexTs = 0;          // 最近稳定索引时间戳
        
        // [拖拽管理器-事件绑定]+[功能名称]+[详细描述] 绑定所有必要的事件监听器
        this.bindEvents();
    }

    /**
     * [拖拽管理器-事件绑定]+[功能名称]+[详细描述] 绑定拖拽相关的所有事件监听器
     * 支持鼠标和触摸事件，确保跨设备兼容性
     */
    bindEvents() {
        // 鼠标事件
        document.addEventListener('mousedown', this.handleStart.bind(this));
        document.addEventListener('mousemove', this.handleMove.bind(this));
        document.addEventListener('mouseup', this.handleEnd.bind(this));
        
        // 触摸事件
        document.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleEnd.bind(this));
        
        // 防止默认的拖拽行为
        document.addEventListener('dragstart', (e) => {
            if (e.target.closest('.preset-card, .preset-item')) {
                e.preventDefault();
            }
        });
        
        // 防止选择文本
        document.addEventListener('selectstart', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });
    }

    /**
     * [拖拽管理器-开始处理]+[功能名称]+[详细描述] 处理拖拽开始事件
     * 检测是否在预设卡片上开始长按，初始化拖拽准备状态
     */
    handleStart(e) {
        // 检查是否在预设模式下
        if (!document.body.classList.contains('show-preset')) return;
        
        // 查找预设卡片元素
        const presetCard = e.target.closest('.preset-card, .preset-item');
        if (!presetCard || this.isDragging) return;

        // 检查是否在预设列表容器内
        const presetContainer = presetCard.closest('.preset-container, .preset-list');
        if (!presetContainer) return;

        // 忽略在按钮或链接上的点击
        if (e.target.closest('button, a, .preset-actions, .actions')) return;

        // 获取坐标（兼容触摸和鼠标事件）
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 初始化拖拽状态
        this.startX = clientX;
        this.startY = clientY;
        this.startTime = Date.now();
        this.dragElement = presetCard;

        // 立即添加长按视觉反馈
        presetCard.classList.add('long-press-active');

        // 设置长按定时器
        this.longPressTimer = setTimeout(() => {
            if (this.dragElement === presetCard) {
                this.startDrag(presetCard, clientX, clientY);
            }
        }, this.longPressDelay);

        // 阻止默认行为
        e.preventDefault();
    }

    /**
     * [拖拽管理器-移动处理]+[功能名称]+[详细描述] 处理拖拽移动事件
     * 更新拖拽元素位置和检测放置目标
     */
    handleMove(e) {
        if (!this.dragElement) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 如果还没开始拖拽，检查移动距离
        if (!this.isDragging) {
            const deltaX = Math.abs(clientX - this.startX);
            const deltaY = Math.abs(clientY - this.startY);
            const timeElapsed = Date.now() - this.startTime;
            
            // 如果移动距离超过阈值且时间不足，取消长按
            if ((deltaX > this.dragThreshold || deltaY > this.dragThreshold) && timeElapsed < this.longPressDelay * 0.7) {
                this.cancelLongPress();
                return;
            }
            
            // 如果时间足够且有移动，立即开始拖拽
            if (timeElapsed > this.longPressDelay * 0.6 && (deltaX > 3 || deltaY > 3)) {
                clearTimeout(this.longPressTimer);
                this.startDrag(this.dragElement, clientX, clientY);
                return;
            }
            
            return;
        }

        // 更新拖拽克隆元素位置（视口坐标），使用指针与元素的偏移保证跟随
        if (this.dragClone) {
            const rect = this.dragClone.getBoundingClientRect();
            const left = clientX - (this.pointerOffsetX || rect.width / 2);
            const top = clientY - (this.pointerOffsetY || rect.height / 2);
            this.dragClone.style.left = Math.round(left) + 'px';
            this.dragClone.style.top = Math.round(top) + 'px';
        }

        // 检测放置目标
        this.detectDropTarget(clientX, clientY);

        e.preventDefault();
    }

    /**
     * [拖拽管理器-结束处理]+[功能名称]+[详细描述] 处理拖拽结束事件
     * 完成拖拽操作或取消拖拽状态
     */
    handleEnd(e) {
        if (this.isDragging) {
            this.completeDrag();
        } else {
            this.cancelLongPress();
        }
    }

    /**
     * [拖拽管理器-开始拖拽]+[功能名称]+[详细描述] 正式开始拖拽操作
     * 创建拖拽克隆元素，让被拖拽元素脱离文档流，其他元素自动填补空位
     */
    startDrag(element, clientX, clientY) {
        this.isDragging = true;
        
        // 移除长按样式
        element.classList.remove('long-press-active');
        
        // 记录原始顺序（在移除元素之前）
        this.recordOriginalOrder();
        
        // 预计算指针与元素左上角的偏移，确保拖拽克隆与鼠标精准对齐
        const startRect = element.getBoundingClientRect();
        this.pointerOffsetX = clientX - startRect.left;
        this.pointerOffsetY = clientY - startRect.top;

        // 创建拖拽克隆元素（使用指针偏移与滚动偏移进行定位）
        this.createDragClone(element, clientX, clientY);
        
        // 创建占位符并插入到原位置
        this.createPlaceholder(element);
        
        // 将原始元素从文档流中移除，让其他元素自动填补空位
        // 使用绝对定位让元素脱离文档流，但保持在DOM中以便后续操作
        const rect = element.getBoundingClientRect();
        // [预设拖拽-原位释放]+[步骤]+[1] 直接隐藏原元素以释放占位，避免半透明覆盖与“向上移动一层”问题
        element.style.display = 'none';
        // 缓存尺寸信息供占位符使用
        element.dataset.dragWidth = String(rect.width);
        element.dataset.dragHeight = String(rect.height);
        
        // 添加拖拽模式样式到容器
        const container = element.closest('.preset-container, .preset-list');
        if (container) {
            container.classList.add('drag-mode');
            // 冻结布局过渡，避免拖拽过程中网格重排导致跳动
            container.classList.add('layout-freeze');
        }
        
        console.log('开始拖拽预设卡片，原位置已释放');
    }

    /**
     * [拖拽管理器-创建克隆]+[功能名称]+[详细描述] 创建拖拽时的克隆元素
     * 克隆原始元素并设置为跟随鼠标的浮动状态，统一与脚本模式的拖拽效果
     */
    createDragClone(element, clientX, clientY) {
        // 克隆原始元素
        this.dragClone = element.cloneNode(true);
        
        // 获取原始元素的尺寸和样式
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        
        // 设置克隆元素样式 - 使用视口坐标，避免滚动偏移造成错位
        this.dragClone.style.position = 'fixed';
        var left = clientX - (this.pointerOffsetX || rect.width / 2);
        var top = clientY - (this.pointerOffsetY || rect.height / 2);
        this.dragClone.style.left = Math.round(left) + 'px';
        this.dragClone.style.top = Math.round(top) + 'px';
        this.dragClone.style.width = rect.width + 'px';
        this.dragClone.style.height = rect.height + 'px';
        this.dragClone.style.zIndex = '1000';
        this.dragClone.style.pointerEvents = 'none';
        this.dragClone.style.opacity = '0.95';
        this.dragClone.style.transform = 'scale(1.02)';
        this.dragClone.style.boxShadow = '0 8px 24px rgba(138, 43, 226, 0.5)';
        this.dragClone.style.border = '2px solid rgba(138, 43, 226, 0.8)';
        this.dragClone.style.borderRadius = computedStyle.borderRadius;
        this.dragClone.style.backgroundColor = computedStyle.backgroundColor;
        this.dragClone.style.transition = 'none';
        this.dragClone.style.willChange = 'transform, left, top';
        this.dragClone.style.backfaceVisibility = 'hidden';
        this.dragClone.style.perspective = '1000px';
        
        // 添加拖拽标识类
        this.dragClone.classList.add('drag-clone');
        
        // 移除克隆元素中的交互元素
        const interactiveElements = this.dragClone.querySelectorAll('button, a, input, select, textarea');
        interactiveElements.forEach(el => {
            el.style.pointerEvents = 'none';
        });
        
        // 添加到文档中
        document.body.appendChild(this.dragClone);
    }

    /**
     * [拖拽管理器-创建占位符]+[功能名称]+[详细描述] 创建占位符元素
     * 在原位置显示拖拽目标区域
     */
    createPlaceholder(element) {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'drag-placeholder';
        
        // 获取原始元素尺寸
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        
        // [预设拖拽-占位符尺寸]+[步骤]+[1] 在网格模式下解析容器的列宽与行高，确保占位符与网格完全对齐
        var container = element.closest('.preset-container, .preset-list');
        var containerStyle = container ? window.getComputedStyle(container) : null;
        var gridCols = containerStyle ? (container.style.gridTemplateColumns || containerStyle.getPropertyValue('grid-template-columns')) : '';
        var gridAutoRows = containerStyle ? (container.style.gridAutoRows || containerStyle.getPropertyValue('grid-auto-rows')) : '';
        
        function parseTrackSize(value) {
            if (!value) return null;
            // 兼容 repeat(n, Xpx) 或多个值的情况，优先取第一个轨道宽度
            try {
                var m = value.match(/([0-9]+\.?[0-9]*)px/);
                return m ? parseFloat(m[1]) : null;
            } catch (_) {
                return null;
            }
        }
        
        var colW = parseTrackSize(gridCols);
        var rowH = parseTrackSize(gridAutoRows);
        
        // [预设拖拽-占位符尺寸]+[步骤]+[2] 回退到 dataset/rect，保证在列表模式或样式缺失时也稳定
        var phW = (colW && colW > 0) ? colW : (element.dataset.dragWidth ? parseFloat(element.dataset.dragWidth) : rect.width);
        var phH = (rowH && rowH > 0) ? rowH : (element.dataset.dragHeight ? parseFloat(element.dataset.dragHeight) : rect.height);
        
        // [预设拖拽-占位符样式]+[步骤]+[3] 设置占位符尺寸与基本样式（无边距，边框半径复用卡片）- 统一与脚本模式
        this.placeholder.style.height = Math.round(phH) + 'px';
        this.placeholder.style.width = Math.round(phW) + 'px';
        this.placeholder.style.margin = computedStyle.margin;
        this.placeholder.style.borderRadius = computedStyle.borderRadius;
        this.placeholder.style.background = 'linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(138, 43, 226, 0.08))';
        this.placeholder.style.border = '2px dashed rgba(138, 43, 226, 0.6)';
        this.placeholder.style.display = 'flex';
        this.placeholder.style.alignItems = 'center';
        this.placeholder.style.justifyContent = 'center';
        this.placeholder.style.boxSizing = 'border-box';
        this.placeholder.style.animation = 'placeholderPulse 2s ease-in-out infinite';
        this.placeholder.innerHTML = '<div class="placeholder-text">放置到此处</div>';
        
        // 在原元素位置插入占位符
        element.parentNode.insertBefore(this.placeholder, element);
    }

    /**
     * [拖拽管理器-检测目标]+[功能名称]+[详细描述] 检测拖拽放置目标
     * 根据鼠标位置更新占位符位置，修复位置偏移问题
     */
    detectDropTarget(clientX, clientY) {
        // 临时隐藏拖拽克隆以获取下方元素
        if (this.dragClone) {
            this.dragClone.style.display = 'none';
        }
        
        const elementBelow = document.elementFromPoint(clientX, clientY);
        
        if (this.dragClone) {
            this.dragClone.style.display = 'block';
        }

        const container = this.dragElement.closest('.preset-container, .preset-list');
        if (!container) return;

        // 获取容器内所有预设卡片（排除正在拖拽的元素和占位符）
        const allCards = Array.from(container.querySelectorAll('.preset-card, .preset-item'))
            .filter(card => card !== this.dragElement && !card.classList.contains('drag-placeholder'));

        // 如果没有其他卡片，直接返回
        if (allCards.length === 0) return;

        let insertPosition = null;
        let referenceElement = null;
        const isGridLayout = (() => {
            try {
                const cs = getComputedStyle(container);
                return (cs && cs.display === 'grid');
            } catch (_) { return false; }
        })();

        // 在网格模式下，直接用容器的网格指标计算目标索引，避免因重排导致的跳动
        if (isGridLayout) {
            const cs = getComputedStyle(container);
            // 读取 CSS 变量（由预设UI设置）
            let colsVar = cs.getPropertyValue('--grid-columns').trim();
            let itemWVar = cs.getPropertyValue('--grid-item-width').trim();
            let itemHVar = cs.getPropertyValue('--grid-item-height').trim();
            let gapVar = cs.getPropertyValue('--grid-gap').trim();

            // 解析列数
            let columns = parseInt(colsVar, 10);
            if (!columns || columns <= 0) {
                // 解析 gridTemplateColumns，例如 'repeat(4, 180px)'
                const gtc = cs.gridTemplateColumns || '';
                const m = gtc.match(/repeat\((\d+)\s*,/);
                columns = m ? parseInt(m[1], 10) : Math.max(1, Math.floor(container.clientWidth / (allCards[0]?.getBoundingClientRect().width || 100)));
            }

            // 解析尺寸与间距
            const parsePx = v => {
                const n = parseFloat(v);
                return isFinite(n) ? n : undefined;
            };
            let cellW = parsePx(itemWVar) ?? (allCards[0]?.getBoundingClientRect().width || 100);
            let rowH  = parsePx(itemHVar) ?? (allCards[0]?.getBoundingClientRect().height || 80);
            let gap   = parsePx(gapVar)    ?? (parsePx(cs.gap) ?? 2);

            const contRect = container.getBoundingClientRect();
            const localX = clientX - contRect.left + (container.scrollLeft || 0);
            const localY = clientY - contRect.top  + (container.scrollTop  || 0);

            // 计算列与行
            const totalCellW = cellW + gap;
            const totalRowH  = rowH + gap;
            let col = Math.floor(localX / Math.max(1, totalCellW));
            let row = Math.floor(localY / Math.max(1, totalRowH));
            col = Math.min(Math.max(col, 0), Math.max(columns - 1, 0));
            if (row < 0) row = 0;

            // 计算单元内偏移，用于边缘死区判断（避免在边缘来回抖动）
            const colStart = col * totalCellW;
            const rowStart = row * totalRowH;
            const dx = localX - colStart;
            const dy = localY - rowStart;
            const edgeX = Math.min(12, totalCellW * 0.25);
            const edgeY = Math.min(12, totalRowH * 0.25);
            const nearEdge = (dx < edgeX) || ((totalCellW - dx) < edgeX) || (dy < edgeY) || ((totalRowH - dy) < edgeY);

            // 候选索引
            const candidateIndex = Math.max(0, row * columns + col);

            // 边缘附近保持“粘性”到上一次稳定索引，减少抽搐
            let index;
            if (nearEdge && this.lastGridIndex != null) {
                index = this.lastGridIndex;
            } else {
                index = candidateIndex;
                this.lastGridIndex = index;
                this.lastGridIndexTs = Date.now();
            }

            // 依据 DOM 顺序决定目标元素
            referenceElement = allCards[Math.min(index, allCards.length - 1)] || null;
            insertPosition = 'before';
        } else {
            // 非网格模式：使用指针下方元素与垂直中心逻辑
            const targetBelow = elementBelow && elementBelow.closest ? elementBelow.closest('.preset-card, .preset-item') : null;
            if (targetBelow && allCards.includes(targetBelow)) {
                const rect = targetBelow.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                referenceElement = targetBelow;
                insertPosition = (clientY < centerY) ? 'before' : 'after';
            } else {
                // 回退：选择离指针最近的卡片（二维距离）
                let closestCard = null;
                let closestDist = Infinity;
                for (let i = 0; i < allCards.length; i++) {
                    const c = allCards[i];
                    const r = c.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const dx = clientX - cx;
                    const dy = clientY - cy;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < closestDist) { closestDist = d; closestCard = c; }
                }
                if (closestCard) {
                    const r2 = closestCard.getBoundingClientRect();
                    const centerY2 = r2.top + r2.height / 2;
                    referenceElement = closestCard;
                    insertPosition = (clientY < centerY2) ? 'before' : 'after';
                }
            }
        }

        // 优先使用指针下方的卡片，保证与视觉直觉一致
        const targetBelow = elementBelow && elementBelow.closest ? elementBelow.closest('.preset-card, .preset-item') : null;
        if (targetBelow && allCards.includes(targetBelow)) {
            const rect = targetBelow.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            referenceElement = targetBelow;
            // 网格模式按水平方向决定前后，列表模式按垂直方向决定前后
            if (isGridLayout) {
                insertPosition = (clientX < centerX) ? 'before' : 'after';
            } else {
                insertPosition = (clientY < centerY) ? 'before' : 'after';
            }
        } else {
            // 回退：选择离指针最近的卡片（二维距离），避免只按Y轴导致错位
            let closestCard = null;
            let closestDist = Infinity;
            for (let i = 0; i < allCards.length; i++) {
                const c = allCards[i];
                const r = c.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const dx = clientX - cx;
                const dy = clientY - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < closestDist) { closestDist = d; closestCard = c; }
            }
            if (closestCard) {
                const r2 = closestCard.getBoundingClientRect();
                const centerX2 = r2.left + r2.width / 2;
                const centerY2 = r2.top + r2.height / 2;
                referenceElement = closestCard;
                if (isGridLayout) {
                    insertPosition = (clientX < centerX2) ? 'before' : 'after';
                } else {
                    insertPosition = (clientY < centerY2) ? 'before' : 'after';
                }
            }
        }

        // 如果没有找到垂直重叠的卡片，找最接近的卡片
        if (!referenceElement) {
            let closestCard = null;
            let closestDistance = Infinity;
            
            for (let i = 0; i < allCards.length; i++) {
                const card = allCards[i];
                const rect = card.getBoundingClientRect();
                const cardCenterX = rect.left + rect.width / 2;
                const cardCenterY = rect.top + rect.height / 2;
                // 在网格模式下优先考虑水平距离，列表模式使用垂直距离
                const distance = isGridLayout ? Math.abs(clientX - cardCenterX) : Math.abs(clientY - cardCenterY);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCard = card;
                }
            }
            
            if (closestCard) {
                const rect = closestCard.getBoundingClientRect();
                const cardCenterX = rect.left + rect.width / 2;
                const cardCenterY = rect.top + rect.height / 2;
                
                referenceElement = closestCard;
                insertPosition = isGridLayout ? (clientX < cardCenterX ? 'before' : 'after') : (clientY < cardCenterY ? 'before' : 'after');
            }
        }

        // 移动占位符到计算出的位置
        if (referenceElement && insertPosition) {
            let targetPosition = null;
            
            if (insertPosition === 'before') {
                targetPosition = referenceElement;
            } else {
                // 使用 nextElementSibling 跳过可能的文本节点，避免错位
                targetPosition = referenceElement.nextElementSibling;
            }
            
            // 只有当占位符不在目标位置时才移动
            if (this.placeholder.nextElementSibling !== targetPosition && 
                this.placeholder !== targetPosition) {
                
                if (targetPosition) {
                    container.insertBefore(this.placeholder, targetPosition);
                } else {
                    container.appendChild(this.placeholder);
                }
                
                // 添加视觉反馈
                referenceElement.classList.add('drag-over');
                setTimeout(() => {
                    referenceElement.classList.remove('drag-over');
                }, 200);
                
                console.log('占位符移动到新位置，参考元素:', referenceElement.dataset.presetName || referenceElement.textContent.trim().substring(0, 20));
            }
        }
    }

    /**
     * [拖拽管理器-完成拖拽]+[功能名称]+[详细描述] 完成拖拽操作
     * 将拖拽元素放置到占位符位置并保存新顺序
     */
    completeDrag() {
        if (!this.placeholder || !this.dragElement) return;

        // 恢复原始元素的样式，让它重新进入文档流
        this.dragElement.style.display = '';
        this.dragElement.style.position = '';
        this.dragElement.style.left = '';
        this.dragElement.style.top = '';
        this.dragElement.style.width = '';
        this.dragElement.style.height = '';
        this.dragElement.style.opacity = '';
        this.dragElement.style.transform = '';
        this.dragElement.style.pointerEvents = '';
        this.dragElement.style.zIndex = '';

        // 将拖拽元素放置到占位符位置
        this.placeholder.parentNode.insertBefore(this.dragElement, this.placeholder);
        
        // 移除占位符
        this.placeholder.remove();
        this.placeholder = null;

        // 移除拖拽克隆
        if (this.dragClone) {
            this.dragClone.remove();
            this.dragClone = null;
        }

        // 保存新的排序
        this.saveNewOrder();

        // 清理状态
        this.cleanup();

        // [拖拽管理器-布局刷新]+[步骤]+[1] 拖拽完成后触发布局轻量刷新，避免占位符移除后的卡片重叠
        try {
            if (typeof window.applyScaleToPresetItems === 'function') {
                window.applyScaleToPresetItems();
            } else if (typeof applyScaleToPresetItems === 'function') {
                applyScaleToPresetItems();
            }
            // 同步更新预览窗口尺寸
            if (typeof window.updatePreviewWindowLayout === 'function') {
                window.updatePreviewWindowLayout();
            } else if (typeof updatePreviewWindowLayout === 'function') {
                updatePreviewWindowLayout();
            }
        } catch (e) {
            try { console.warn('拖拽完成后刷新布局出错:', e); } catch (_) {}
        }

        console.log('拖拽排序完成');
    }

    /**
     * [拖拽管理器-取消长按]+[功能名称]+[详细描述] 取消长按操作
     * 清理长按状态和视觉反馈
     */
    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        if (this.dragElement) {
            this.dragElement.classList.remove('long-press-active');
            // 确保元素样式被重置
            this.dragElement.style.display = '';
            this.dragElement.style.position = '';
            this.dragElement.style.opacity = '';
            this.dragElement.style.transform = '';
            this.dragElement = null;
        }

        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
    }

    /**
     * [拖拽管理器-清理状态]+[功能名称]+[详细描述] 清理拖拽相关的所有状态
     * 重置所有变量和移除临时元素
     */
    cleanup() {
        // 移除容器的拖拽模式样式和过渡效果
        const containers = document.querySelectorAll('.drag-mode');
        containers.forEach(container => {
            container.classList.remove('drag-mode');
            container.classList.remove('layout-freeze');
        });

        // 如果拖拽元素还存在，确保恢复其样式
        if (this.dragElement) {
            this.dragElement.style.display = '';
            this.dragElement.style.position = '';
            this.dragElement.style.left = '';
            this.dragElement.style.top = '';
            this.dragElement.style.width = '';
            this.dragElement.style.height = '';
            this.dragElement.style.opacity = '';
            this.dragElement.style.transform = '';
            this.dragElement.style.pointerEvents = '';
            this.dragElement.style.zIndex = '';
        }

        // 清理所有状态
        this.isDragging = false;
        this.dragElement = null;
        this.dragClone = null;
        this.placeholder = null;
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
        this.lastGridIndex = null;
        this.lastGridIndexTs = 0;
        
        // 清理长按定时器
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    /**
     * [拖拽管理器-记录原始排序]+[功能名称]+[详细描述] 记录原始排序
     * 用于撤销操作或错误恢复
     */
    recordOriginalOrder() {
        const container = this.dragElement.closest('.preset-container, .preset-list');
        if (!container) return;

        const presetCards = container.querySelectorAll('.preset-card, .preset-item');
        this.originalOrder = Array.from(presetCards).map(card => {
            return {
                element: card,
                id: card.dataset.presetId || card.dataset.id,
                name: card.dataset.presetName || card.querySelector('.preset-name')?.textContent
            };
        });
    }

    /**
     * [拖拽管理器-保存新排序]+[功能名称]+[详细描述] 保存新的排序到本地存储
     * 实现排序的持久化保存
     */
    saveNewOrder() {
        const container = this.dragElement.closest('.preset-container, .preset-list');
        if (!container) return;

        const presetCards = container.querySelectorAll('.preset-card, .preset-item');
        const newOrder = Array.from(presetCards).map((card, index) => {
            return {
                id: card.dataset.presetId || card.dataset.id,
                name: card.dataset.presetName || card.querySelector('.preset-name')?.textContent,
                order: index
            };
        });

        // 保存到本地存储
        try {
            localStorage.setItem('mogu_preset_order', JSON.stringify(newOrder));
            console.log('预设排序已保存:', newOrder);
        } catch (error) {
            console.error('保存预设排序失败:', error);
        }
    }

    /**
     * [拖拽管理器-加载排序]+[功能名称]+[详细描述] 从本地存储加载排序
     * 应用程序启动时恢复之前保存的排序
     */
    loadSavedOrder() {
        try {
            const savedOrder = localStorage.getItem('mogu_preset_order');
            if (!savedOrder) return;

            const orderData = JSON.parse(savedOrder);
            this.applySavedOrder(orderData);
        } catch (error) {
            console.error('加载预设排序失败:', error);
        }
    }

    /**
     * [拖拽管理器-应用排序]+[功能名称]+[详细描述] 应用保存的排序
     * 根据保存的顺序重新排列预设卡片
     */
    applySavedOrder(orderData) {
        const containers = document.querySelectorAll('.preset-container, .preset-list');
        
        containers.forEach(container => {
            const presetCards = Array.from(container.querySelectorAll('.preset-card, .preset-item'));
            
            // 按保存的顺序排序
            presetCards.sort((a, b) => {
                const aId = a.dataset.presetId || a.dataset.id;
                const bId = b.dataset.presetId || b.dataset.id;
                
                const aOrder = orderData.find(item => item.id === aId)?.order ?? 999;
                const bOrder = orderData.find(item => item.id === bId)?.order ?? 999;
                
                return aOrder - bOrder;
            });
            
            // 重新插入到容器中
            presetCards.forEach(card => {
                container.appendChild(card);
            });
        });
    }
}

// [拖拽管理器-全局实例]+[功能名称]+[详细描述] 创建全局拖拽管理器实例
// 确保整个应用只有一个拖拽管理器
let presetDragManager = null;

/**
 * [拖拽管理器-初始化函数]+[功能名称]+[详细描述] 初始化预设拖拽功能
 * 在预设UI加载完成后调用此函数启用拖拽
 */
function initPresetDragSort() {
    if (!presetDragManager) {
        presetDragManager = new PresetDragSortManager();
        
        // 加载保存的排序
        setTimeout(() => {
            presetDragManager.loadSavedOrder();
        }, 100);
        
        console.log('预设拖拽排序功能已初始化');
    }
}

/**
 * [拖拽管理器-销毁函数]+[功能名称]+[详细描述] 销毁预设拖拽功能
 * 清理所有事件监听器和状态
 */
function destroyPresetDragSort() {
    if (presetDragManager) {
        presetDragManager.cleanup();
        presetDragManager = null;
        console.log('预设拖拽排序功能已销毁');
    }
}

// [拖拽管理器-自动初始化]+[功能名称]+[详细描述] 页面加载完成后自动初始化
// 确保DOM准备就绪后启动拖拽功能
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPresetDragSort);
} else {
    initPresetDragSort();
}

// [拖拽管理器-全局导出]+[功能名称]+[详细描述] 导出到全局作用域
// 供其他模块调用和管理
window.initPresetDragSort = initPresetDragSort;
window.destroyPresetDragSort = destroyPresetDragSort;
window.presetDragManager = presetDragManager;