/**
 * 拖拽导入功能修复补丁
 * 
 * 修复问题：
 * 1. 文件保存位置设置不生效 - 拖入图片还是导入到了文档文件夹
 * 2. 浏览器搜图拖入无法导入AE - 比如bing的图片无法拖动导入
 * 
 * 解决方案：
 * 1. 修复保存位置读取逻辑，确保从设置界面正确获取用户选择的保存位置
 * 2. 增强浏览器图片拖拽支持，处理跨域和数据格式问题
 */

(function() {
    'use strict';
    
    console.log('[拖拽修复补丁] 开始加载');
    
    /**
     * 获取当前设置的文件保存位置
     * @returns {Object} 包含saveLocation和customPath的对象
     */
    function getCurrentSaveSettings() {
        var saveLocation = 'documents'; // 默认值
        var customPath = '';
        
        // 从设置界面获取当前选中的保存位置
        var saveLocationRadios = document.querySelectorAll('input[name="imageSaveLocation"]');
        for (var i = 0; i < saveLocationRadios.length; i++) {
            if (saveLocationRadios[i].checked) {
                saveLocation = saveLocationRadios[i].value;
                break;
            }
        }
        
        // 如果选择了自定义位置，获取自定义路径
        if (saveLocation === 'custom') {
            var customPathInput = document.getElementById('customLocationPath');
            if (customPathInput && customPathInput.value.trim()) {
                customPath = customPathInput.value.trim();
            }
        }
        
        console.log('[拖拽修复补丁] 获取保存设置:', {
            saveLocation: saveLocation,
            customPath: customPath
        });
        
        return {
            saveLocation: saveLocation,
            customPath: customPath
        };
    }
    
    /**
     * 修复后的文件拖拽处理函数
     * @param {FileList} files 拖拽的文件列表
     */
    function handleFileDropFixed(files) {
        console.log('[拖拽修复补丁] handleFileDropFixed函数开始执行，文件数量:', files.length);
        
        if (!files || files.length === 0) {
            console.log('[拖拽修复补丁] 没有文件被拖拽');
            return;
        }
        
        // 检查剪贴板导入功能是否启用
        var clipboardImportEnabled = document.getElementById('clipboardImportEnabled');
        if (!clipboardImportEnabled || !clipboardImportEnabled.checked) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('图片/视频导入功能已禁用，请在设置中启用', true);
            }
            return;
        }
        
        var file = files[0]; // 只处理第一个文件
        console.log('[拖拽修复补丁] 处理文件:', {
            name: file.name,
            type: file.type,
            size: file.size
        });
        
        // 检查文件类型
        var supportedTypes = [
            'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 
            'image/webp', 'image/avif', 'image/bmp', 'image/tiff',
            'video/mp4'
        ];
        
        if (!supportedTypes.includes(file.type)) {
            console.log('[拖拽修复补丁] 不支持的文件类型:', file.type);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('不支持的文件格式。支持的格式: PNG, JPG, GIF, WebP, AVIF, BMP, TIFF, MP4', true);
            }
            return;
        }
        
        // 获取当前保存设置
        var saveSettings = getCurrentSaveSettings();
        var saveLocation = saveSettings.saveLocation;
        var customPath = saveSettings.customPath;
        
        // 验证自定义路径
        if (saveLocation === 'custom' && !customPath) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('请先在设置中配置自定义保存路径', true);
            }
            return;
        }
        
        // 显示处理消息
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('正在处理文件...', false);
        }
        
        // 转换文件为base64格式以兼容CEP
        var reader = new FileReader();
        reader.onload = function(e) {
            console.log('[拖拽修复补丁] 文件读取完成，开始导入到AE');
            
            var base64Data = e.target.result;
            var fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            // 调用AE脚本导入文件
            importToAfterEffects(base64Data, saveLocation, customPath, fileExtension);
        };
        
        reader.onerror = function() {
            console.error('[拖拽修复补丁] 文件读取失败');
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('文件读取失败', true);
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    /**
     * 导入文件到After Effects
     * @param {string} base64Data Base64编码的文件数据
     * @param {string} saveLocation 保存位置
     * @param {string} customPath 自定义路径
     * @param {string} fileExtension 文件扩展名
     */
    function importToAfterEffects(base64Data, saveLocation, customPath, fileExtension) {
        // 映射保存位置值
        var mappedSaveLocation;
        switch (saveLocation) {
            case 'desktop':
                mappedSaveLocation = 'desktop';
                break;
            case 'documents':
                mappedSaveLocation = 'documents';
                break;
            case 'projectFile':
                mappedSaveLocation = 'project';
                break;
            case 'custom':
                mappedSaveLocation = 'custom';
                break;
            default:
                mappedSaveLocation = 'documents';
        }
        
        console.log('[拖拽修复补丁] 准备调用AE脚本:', {
            saveLocation: mappedSaveLocation,
            customPath: customPath,
            fileExtension: fileExtension,
            base64Length: base64Data.length
        });
        
        // 构建参数对象
        var params = {
            base64Data: base64Data,
            saveLocation: mappedSaveLocation,
            customPath: customPath,
            fileExtension: fileExtension
        };
        
        // 编码参数为JSON字符串
        var encodedParams = encodeURIComponent(JSON.stringify(params));
        
        // 调用AE脚本
        var scriptCall = 'saveAndImportClipboardImageFromJson("' + encodedParams + '")';
        
        if (typeof csInterface !== 'undefined' && csInterface.evalScript) {
            csInterface.evalScript(scriptCall, function(result) {
                console.log('[拖拽修复补丁] AE脚本执行结果:', result);
                
                if (result && result.indexOf('Success:') === 0) {
                    var message = result.replace('Success:', '');
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('导入成功: ' + message, false);
                    }
                } else if (result && result.indexOf('Error:') === 0) {
                    var errorMessage = result.replace('Error:', '');
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('导入失败: ' + errorMessage, true);
                    }
                } else {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('导入失败: ' + (result || '未知错误'), true);
                    }
                }
            });
        } else {
            console.error('[拖拽修复补丁] csInterface不可用');
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('CEP接口不可用，无法导入文件', true);
            }
        }
    }
    
    /**
     * 增强的浏览器图片拖拽处理
     * 处理从浏览器拖拽的图片，包括跨域图片
     */
    function handleBrowserImageDrop(e) {
        console.log('[拖拽修复补丁] 处理浏览器图片拖拽');
        
        // 检查是否有HTML数据（可能包含图片URL）
        var htmlData = e.dataTransfer.getData('text/html');
        var urlData = e.dataTransfer.getData('text/uri-list');
        var textData = e.dataTransfer.getData('text/plain');
        
        console.log('[拖拽修复补丁] 拖拽数据:', {
            html: htmlData ? htmlData.substring(0, 200) + '...' : null,
            url: urlData,
            text: textData
        });
        
        // 尝试从HTML中提取图片URL
        var imageUrl = null;
        if (htmlData) {
            var imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (imgMatch) {
                imageUrl = imgMatch[1];
            }
        }
        
        // 如果没有从HTML中找到，尝试URL数据
        if (!imageUrl && urlData) {
            imageUrl = urlData;
        }
        
        // 如果没有找到URL，尝试文本数据
        if (!imageUrl && textData && (textData.startsWith('http') || textData.startsWith('https'))) {
            imageUrl = textData;
        }
        
        if (imageUrl) {
            console.log('[拖拽修复补丁] 找到图片URL:', imageUrl);
            downloadAndImportImage(imageUrl);
        } else {
            console.log('[拖拽修复补丁] 未找到有效的图片URL');
        }
    }
    
    /**
     * 下载并导入网络图片
     * @param {string} imageUrl 图片URL
     */
    function downloadAndImportImage(imageUrl) {
        console.log('[拖拽修复补丁] 开始下载图片:', imageUrl);
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('正在下载网络图片...', false);
        }
        
        // 创建一个隐藏的图片元素来下载图片
        var img = new Image();
        img.crossOrigin = 'anonymous'; // 尝试跨域访问
        
        img.onload = function() {
            console.log('[拖拽修复补丁] 图片下载成功，开始转换为base64');
            
            try {
                // 创建canvas来转换图片为base64
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0);
                
                // 转换为base64
                var base64Data = canvas.toDataURL('image/png');
                
                // 获取保存设置
                var saveSettings = getCurrentSaveSettings();
                
                // 导入到AE
                importToAfterEffects(base64Data, saveSettings.saveLocation, saveSettings.customPath, '.png');
                
            } catch (error) {
                console.error('[拖拽修复补丁] 图片转换失败:', error);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('图片转换失败，可能是跨域限制: ' + error.message, true);
                }
            }
        };
        
        img.onerror = function() {
            console.error('[拖拽修复补丁] 图片下载失败');
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('图片下载失败，可能是跨域限制或网络问题', true);
            }
        };
        
        img.src = imageUrl;
    }
    
    /**
     * 安装修复补丁
     */
    function installFix() {
        console.log('[拖拽修复补丁] 开始安装修复补丁');
        
        // 等待DOM加载完成
        function waitForDOM() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', installEventListeners);
            } else {
                installEventListeners();
            }
        }
        
        function installEventListeners() {
            console.log('[拖拽修复补丁] 安装事件监听器');
            
            // 重写全局的handleFileDrop函数
            if (typeof window.handleFileDrop === 'function') {
                console.log('[拖拽修复补丁] 备份原始handleFileDrop函数');
                window.originalHandleFileDrop = window.handleFileDrop;
            }
            
            // 安装修复后的函数
            window.handleFileDrop = handleFileDropFixed;
            
            // 增强全局拖拽事件处理
            document.addEventListener('drop', function(e) {
                console.log('[拖拽修复补丁] 全局drop事件触发');
                
                // 如果没有文件但有其他数据，尝试处理浏览器图片拖拽
                if ((!e.dataTransfer.files || e.dataTransfer.files.length === 0) && 
                    (e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/uri-list'))) {
                    e.preventDefault();
                    handleBrowserImageDrop(e);
                }
            }, true);
            
            console.log('[拖拽修复补丁] 修复补丁安装完成');
        }
        
        waitForDOM();
    }
    
    // 立即安装修复补丁
    installFix();
    
    console.log('[拖拽修复补丁] 补丁加载完成');
})();