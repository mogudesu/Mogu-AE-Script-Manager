﻿(function () {
    const nodeRequire = window.require || (typeof require !== 'undefined' ? require : null);
    const fs = nodeRequire ? nodeRequire('fs') : null;
    const path = nodeRequire ? nodeRequire('path') : null;
    const os = nodeRequire ? nodeRequire('os') : null;
    const cepFs = (window.cep && window.cep.fs) ? window.cep.fs : null;

    // Initialize CSInterface
    const csInterface = new CSInterface();
    const extensionDir = csInterface.getSystemPath(SystemPath.EXTENSION);
    const userDataDir = csInterface.getSystemPath(SystemPath.USER_DATA);

    // Default to UserData/MoguScriptManager/data/workflows
    const workflowStorageDir = path
        ? path.join(userDataDir, 'MoguScriptManager', 'data', 'workflows')
        : (userDataDir + "/MoguScriptManager/data/workflows").replace(/\//g, "\\");

    // Legacy storage (inside the script folder) for migration
    const legacyWorkflowStorageDir = path
        ? path.join(extensionDir, 'data', 'workflows')
        : (extensionDir + "/data/workflows").replace(/\//g, "\\");

    // Helper for File System operations
    const fsHelper = {
        existsSync: (p) => {
            if (fs) return fs.existsSync(p);
            if (cepFs) {
                const res = cepFs.stat(p);
                return res.err === 0; // 0 means success
            }
            return false;
        },
        mkdirSync: (p) => {
            if (fs) {
                if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
            } else if (cepFs) {
                cepFs.makedir(p);
            }
        },
        readdirSync: (p) => {
            if (fs) return fs.readdirSync(p);
            if (cepFs) {
                const res = cepFs.readdir(p);
                if (res.err === 0) return res.data;
                return [];
            }
            return [];
        },
        readFileSync: (p) => {
            if (fs) return fs.readFileSync(p, 'utf-8');
            if (cepFs) {
                const res = cepFs.readFile(p, cep.encoding.UTF8);
                if (res.err === 0) return res.data;
                throw new Error("Read file error: " + res.err);
            }
            return "";
        },
        writeFileSync: (p, data) => {
            if (fs) fs.writeFileSync(p, data);
            else if (cepFs) {
                cepFs.writeFile(p, data);
            }
        },
        unlinkSync: (p) => {
            if (fs) fs.unlinkSync(p);
            else if (cepFs) {
                cepFs.deleteFile(p);
            }
        },
        join: (...args) => {
            if (path) return path.join(...args);
            return args.join("/").replace(/\\/g, "/");
        },
        basename: (p) => {
            if (path) return path.basename(p);
            const s = String(p).replace(/[\\\/]$/, '');
            return s.substring(s.lastIndexOf('/') + 1);
        }
    };

    let currentWorkflow = null;
    let currentWorkflowPath = null;
    let currentNodeList = [];
    let comfyUiUrl = localStorage.getItem('comfyui_url') || "http://127.0.0.1:8188";
    const clientId = "cep_client_" + Date.now();

    let panel, statusDiv, generateBtn, cancelBtn, batchCountInput, nodeListEl, nodeSearchInput;
    let loraList = []; // Cache available LoRAs
    let canGenerateWorkflow = false;
    let isGenerating = false;
    let cancelRequested = false;
    let activePromptId = null;
    let activeWaitAbort = null;
    let comfyLangBound = false;

    // Store user-defined custom parameters: [{nodeId, key, label, type, options, groupId, mediaType, inputMode}]
    let customParamConfig = [];
    let customMappingGroups = []; // [{ id, name }]
    let outputNodeIds = []; // IDs of nodes set as output
    let pendingGroupName = null;
    let currentWorkflowFormat = { kind: 'unsupported', supported: false, message: '' };
    let saveTimeout = null;

    const PARAM_MAPPING_LOG_PREFIX = '[ComfyUI Param Mapping]';
    const UNSUPPORTED_WORKFLOW_MESSAGE = '当前工作流结构不兼容，请使用 API Format 导出';
    const NUMERIC_SCHEMA_TYPES = new Set(['INT', 'INTEGER', 'FLOAT', 'DOUBLE', 'NUMBER']);
    const BOOLEAN_SCHEMA_TYPES = new Set(['BOOLEAN', 'BOOL']);
    const STRING_SCHEMA_TYPES = new Set(['STRING', 'TEXT']);
    const NON_EDITABLE_SCHEMA_TYPES = new Set([
        'MODEL', 'VAE', 'CLIP', 'CONDITIONING', 'LATENT', 'MASK', 'NOISE', 'SIGMAS',
        'SAMPLER', 'GUIDER', 'CONTROL_NET', 'CLIP_VISION', 'STYLE_MODEL', 'UPSCALE_MODEL',
        'BBOX', 'SEGS', 'PIPE', 'GLIGEN', 'TAESD', 'UNET', 'FEATURES'
    ]);
    const MEDIA_NODE_HINTS = {
        image: [/LoadImage/i, /ImageLoader/i, /ImageUpload/i, /LoadImageMask/i],
        audio: [/LoadAudio/i, /AudioUpload/i],
        video: [/LoadVideo/i, /VideoUpload/i, /VHS_/i]
    };
    const MEDIA_ACCEPT_MAP = {
        image: 'image/*',
        audio: 'audio/*',
        video: 'video/*,image/gif'
    };
    const EXTENSION_MIME_MAP = Object.freeze({
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.tif': 'image/tiff',
        '.tiff': 'image/tiff',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo'
    });
    const MEDIA_FALLBACK_MIME = Object.freeze({
        image: 'image/png',
        audio: 'audio/mpeg',
        video: 'video/mp4'
    });
    const WORKFLOW_ADVANCED_COLLAPSED_KEY = 'comfyui_workflow_advanced_collapsed';
    const COMFY_MASK_EDITOR_DEFAULT_BRUSH = 28;
    const COMFY_MASK_EDITOR_MAX_HISTORY = 20;
    const COMFY_MASK_EDITOR_TEMP_DIR = path
        ? path.join(userDataDir, 'MoguScriptManager', 'data', 'comfyui_masks')
        : (userDataDir + "/MoguScriptManager/data/comfyui_masks").replace(/\//g, "\\");
    const comfyMaskDraftStore = {};
    const COMFY_PROMPT_STORE_KEY = 'modelscope_prompt_store';
    const COMFY_LLM_API_BASE_URL = 'https://api-inference.modelscope.cn/v1/';
    const COMFY_DEFAULT_SYSTEM_PROMPT = [
        '# Role: AI Visual Prompt Optimizer',
        '',
        'You are a professional prompt optimizer for image generation models.',
        'Turn short user ideas into vivid, structured prompts with clear subject, scene, lighting, color, style, and composition.',
        '',
        'Output rules:',
        '1. Output only the optimized prompt text.',
        '2. No explanations.',
        '3. Keep wording fluent and specific.'
    ].join('\n');

    function getComfyLang() {
        try {
            if (window.I18n && typeof window.I18n.getLanguage === 'function') {
                return String(window.I18n.getLanguage() || 'zh-CN');
            }
            return String(localStorage.getItem('preferredLanguage') || 'zh-CN');
        } catch (e) {
            return 'zh-CN';
        }
    }

    function tc(key, zhFallback, enFallback, params) {
        try {
            if (window.I18n && typeof window.I18n.t === 'function') {
                const value = window.I18n.t(key, params);
                if (value && value !== key) return value;
            }
        } catch (e) { }
        const lang = getComfyLang();
        return String(lang).toLowerCase().indexOf('en') === 0 ? (enFallback || zhFallback || key) : (zhFallback || enFallback || key);
    }

    function ensureComfyMaskTempDir() {
        try {
            fsHelper.mkdirSync(COMFY_MASK_EDITOR_TEMP_DIR);
        } catch (e) {
            console.warn('创建遮罩临时目录失败', e);
        }
        return COMFY_MASK_EDITOR_TEMP_DIR;
    }

    function sanitizeMaskFileName(name, fallback = 'mask') {
        const raw = String(name || '').trim();
        const base = raw ? raw.replace(/\.[^.]+$/, '') : fallback;
        const safe = base
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        return (safe || fallback).substring(0, 72);
    }

    function buildMaskDraftKey(nodeId, inputKey = 'image') {
        return `maskdraft_${String(nodeId || '').trim()}_${String(inputKey || 'image').trim()}`;
    }

    function setMaskDraft(draftKey, payload) {
        if (!draftKey) return;
        comfyMaskDraftStore[draftKey] = payload || null;
    }

    function getMaskDraft(draftKey) {
        if (!draftKey) return null;
        return comfyMaskDraftStore[draftKey] || null;
    }

    function clearMaskDraft(draftKey) {
        if (!draftKey) return;
        if (Object.prototype.hasOwnProperty.call(comfyMaskDraftStore, draftKey)) {
            delete comfyMaskDraftStore[draftKey];
        }
    }

    function hasStandaloneMaskInputNode(workflow) {
        const nodes = getWorkflowNodes(workflow || currentWorkflow);
        if (!nodes) return false;
        return Object.values(nodes).some(node => {
            if (!node || typeof node !== 'object') return false;
            return String(node.class_type || '') === 'LoadImageMask';
        });
    }

    function normalizeComfyApiKey(key) {
        let value = String(key || '').trim();
        if (!value) return '';
        value = value.replace(/^["']|["']$/g, '');
        if (/^bearer\s+/i.test(value)) value = value.replace(/^bearer\s+/i, '');
        return value.trim();
    }

    function normalizeComfyPromptStoreType(type) {
        return String(type || '').toLowerCase() === 'negative' ? 'negative' : 'prompt';
    }

    function isComfyPromptStoreTypeMatch(itemType, expectedType) {
        return normalizeComfyPromptStoreType(itemType) === normalizeComfyPromptStoreType(expectedType);
    }

    function getComfyPromptStoreList() {
        try {
            const raw = localStorage.getItem(COMFY_PROMPT_STORE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter(item => item && item.id && item.name && item.type && typeof item.content === 'string')
                .map(item => ({
                    ...item,
                    type: normalizeComfyPromptStoreType(item.type)
                }));
        } catch (e) {
            return [];
        }
    }

    function saveComfyPromptStoreList(list) {
        localStorage.setItem(COMFY_PROMPT_STORE_KEY, JSON.stringify(list || []));
        try {
            const evt = new CustomEvent('ms-prompt-store-updated');
            document.dispatchEvent(evt);
        } catch (e) { }
    }

    function isComfyPromptLikeParam(paramConfig, node, valueType, mode, hasOptions, isDirectoryPathParam, mediaType) {
        if (mediaType || hasOptions || isDirectoryPathParam) return false;
        if (mode === 'file' || mode === 'select' || mode === 'slider' || mode === 'boolean' || mode === 'path') return false;
        if (valueType && valueType !== 'string') return false;

        const keyLower = String(paramConfig && paramConfig.key ? paramConfig.key : '').toLowerCase();
        const labelLower = String(paramConfig && paramConfig.label ? paramConfig.label : '').toLowerCase();
        const nodeType = String(node && node.class_type ? node.class_type : '').toLowerCase();

        if (keyLower === 'text') return true;
        if (/(^|_)(prompt|positive|negative|caption|instruction)(_|$)/.test(keyLower)) return true;
        if (labelLower.includes('提示词') || labelLower.includes('prompt')) return true;
        if (/cliptextencode|textencode|prompt|conditioning/.test(nodeType)) return true;
        return false;
    }

    function detectComfyPromptType(paramConfig, node) {
        const keyLower = String(paramConfig && paramConfig.key ? paramConfig.key : '').toLowerCase();
        const labelLower = String(paramConfig && paramConfig.label ? paramConfig.label : '').toLowerCase();
        const nodeType = String(node && node.class_type ? node.class_type : '').toLowerCase();
        if (keyLower.includes('negative') || labelLower.includes('负向') || labelLower.includes('反向') || nodeType.includes('negative')) {
            return 'negative';
        }
        return 'prompt';
    }

    function setComfyPromptFieldValue(fieldEl, nextValue) {
        if (!fieldEl) return;
        fieldEl.value = nextValue;
        fieldEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function appendComfyPromptText(fieldEl, additionText) {
        if (!fieldEl) return;
        const text = String(additionText || '').trim();
        if (!text) return;
        const current = String(fieldEl.value || '').trim();
        const next = current ? `${current}, ${text}` : `${text}, `;
        setComfyPromptFieldValue(fieldEl, next);
    }

    function openComfyPromptSaveModal(fieldEl, promptType) {
        if (!fieldEl) return;
        const content = String(fieldEl.value || '').trim();
        if (!content) {
            notifyUser(tc('comfyui.prompt.empty', '提示词为空，无法保存', 'Prompt is empty and cannot be saved'), 'warning', tc('comfyui.save_failed', '保存失败', 'Save failed'));
            return;
        }

        const modalId = 'comfy-prompt-save-modal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'dialog-overlay';
        modal.innerHTML = `
            <div class="dialog-card" style="width: 420px; max-width: 92%;">
                <div class="dialog-header">
                    <h3>${tc('comfyui.prompt.save_title', '保存提示词', 'Save Prompt')}</h3>
                    <button class="btn-close" id="comfy-prompt-save-close">×</button>
                </div>
                <div class="dialog-body">
                    <div style="margin-bottom: 10px; font-size: 12px; opacity: 0.7;">${tc('comfyui.prompt.type', '类型', 'Type')}: ${normalizeComfyPromptStoreType(promptType) === 'negative' ? tc('comfyui.prompt.negative', '负向提示词', 'Negative Prompt') : tc('comfyui.prompt.positive', '正向提示词', 'Positive Prompt')}</div>
                    <input type="text" id="comfy-prompt-save-name" class="settings-input" placeholder="${tc('comfyui.name_placeholder', '请输入名称', 'Enter name')}">
                </div>
                <div class="dialog-footer">
                    <button class="btn-secondary" id="comfy-prompt-save-cancel">${tc('dialog.cancel', '取消', 'Cancel')}</button>
                    <button class="btn-primary" id="comfy-prompt-save-confirm">${tc('settings.save', '保存', 'Save')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => {
            const dom = document.getElementById(modalId);
            if (dom) dom.remove();
        };
        document.getElementById('comfy-prompt-save-close').addEventListener('click', close);
        document.getElementById('comfy-prompt-save-cancel').addEventListener('click', close);
        document.getElementById('comfy-prompt-save-confirm').addEventListener('click', () => {
            const nameEl = document.getElementById('comfy-prompt-save-name');
            const name = nameEl ? String(nameEl.value || '').trim() : '';
            if (!name) {
                notifyUser(tc('comfyui.name_required', '请输入名称', 'Please enter a name'), 'warning', tc('comfyui.save_failed', '保存失败', 'Save failed'));
                return;
            }

            const list = getComfyPromptStoreList();
            const normalizedType = normalizeComfyPromptStoreType(promptType);
            const existed = list.find(item => item.name === name && isComfyPromptStoreTypeMatch(item.type, normalizedType));
            const nextItem = {
                id: existed ? existed.id : `cp_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                name,
                type: normalizedType,
                content,
                updatedAt: Date.now()
            };
            if (existed) {
                const idx = list.indexOf(existed);
                list[idx] = nextItem;
            } else {
                list.push(nextItem);
            }
            saveComfyPromptStoreList(list);
            notifyUser(tc('comfyui.prompt.saved', '提示词已保存', 'Prompt saved'), 'success');
            close();
        });
    }

    function openComfyPromptLoadModal(fieldEl, promptType) {
        if (!fieldEl) return;
        const modalId = 'comfy-prompt-load-modal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'dialog-overlay';
        modal.innerHTML = `
            <div class="dialog-card" style="width: 520px; max-width: 94%;">
                <div class="dialog-header">
                    <h3>${tc('comfyui.prompt.load_title', '加载提示词', 'Load Prompt')}</h3>
                    <button class="btn-close" id="comfy-prompt-load-close">×</button>
                </div>
                <div class="dialog-body">
                    <input type="text" id="comfy-prompt-load-search" class="settings-input" placeholder="${tc('comfyui.prompt.search', '搜索名称或内容', 'Search by name or content')}" style="margin-bottom: 10px;">
                    <div id="comfy-prompt-load-list" style="max-height: 320px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;"></div>
                </div>
                <div class="dialog-footer">
                    <button class="btn-secondary" id="comfy-prompt-load-cancel">${tc('diag.close', '关闭', 'Close')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => {
            const dom = document.getElementById(modalId);
            if (dom) dom.remove();
        };
        document.getElementById('comfy-prompt-load-close').addEventListener('click', close);
        document.getElementById('comfy-prompt-load-cancel').addEventListener('click', close);

        const renderList = (keyword) => {
            const listEl = document.getElementById('comfy-prompt-load-list');
            if (!listEl) return;
            listEl.innerHTML = '';
            const all = getComfyPromptStoreList().filter(item => isComfyPromptStoreTypeMatch(item.type, promptType));
            const kw = String(keyword || '').trim().toLowerCase();
            const filtered = kw ? all.filter(item => (`${item.name} ${item.content}`).toLowerCase().indexOf(kw) >= 0) : all;
            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding:10px; text-align:center; opacity:0.6;';
                empty.textContent = tc('comfyui.prompt.none', '暂无可用提示词', 'No prompt available');
                listEl.appendChild(empty);
                return;
            }
            filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            filtered.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:8px 10px; border-bottom:1px solid var(--border-color); cursor:pointer;';
                row.innerHTML = `
                    <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(item.name)}</div>
                    <div style="font-size:12px; opacity:0.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.content)}</div>
                `;
                row.addEventListener('click', () => {
                    setComfyPromptFieldValue(fieldEl, item.content || '');
                    notifyUser(tc('comfyui.prompt.loaded', '提示词已加载', 'Prompt loaded'), 'success');
                    close();
                });
                listEl.appendChild(row);
            });
        };

        renderList('');
        const searchEl = document.getElementById('comfy-prompt-load-search');
        if (searchEl) searchEl.addEventListener('input', () => renderList(searchEl.value));
    }

    async function polishComfyPromptText(rawPrompt, isNegative = false) {
        const prompt = String(rawPrompt || '').trim();
        if (!prompt) throw new Error(isNegative
            ? tc('comfyui.prompt.negative_required', '请输入负向提示词', 'Please enter a negative prompt')
            : tc('comfyui.prompt.required', '请输入提示词', 'Please enter a prompt'));

        const apiKey = normalizeComfyApiKey(localStorage.getItem('modelscope_api_key') || '');
        if (!apiKey) throw new Error(tc('comfyui.ms_key_required', '请先在设置中配置 ModelScope API Key', 'Please configure a ModelScope API Key in settings first'));

        let systemPrompt = localStorage.getItem('modelscope_llm_system_prompt') || COMFY_DEFAULT_SYSTEM_PROMPT;
        if (isNegative) {
            systemPrompt += ' The user provides a Negative Prompt. Optimize it to better exclude unwanted elements. Output ONLY the optimized negative prompt in English.';
        }

        const response = await fetch(`${COMFY_LLM_API_BASE_URL}chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'ZhipuAI/GLM-5',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const raw = await response.text();
            let message = `请求失败(${response.status})`;
            try {
                const errJson = JSON.parse(raw);
                message = errJson.message || errJson.error || errJson.Message || message;
            } catch (e) {
                if (raw) message = raw;
            }
            throw new Error(message);
        }

        const data = await response.json();
        const result = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';
        const normalized = String(result || '').trim();
        if (!normalized) throw new Error('润色结果为空');
        return normalized;
    }

    async function polishComfyPromptField(fieldEl, isNegative, actionBtn = null) {
        if (!fieldEl) return;
        const original = String(fieldEl.value || '').trim();
        if (!original) {
            notifyUser(
                isNegative ? tc('comfyui.prompt.negative_required', '请先输入负向提示词', 'Please enter a negative prompt first') : tc('comfyui.prompt.required', '请先输入提示词', 'Please enter a prompt first'),
                'warning',
                tc('comfyui.prompt.polish_failed', '润色失败', 'Polish failed')
            );
            return;
        }
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.classList.add('is-loading');
        }
        const previousStatus = statusDiv ? statusDiv.textContent : '';
        try {
            if (statusDiv) statusDiv.textContent = isNegative
                ? tc('comfyui.prompt.polishing_negative', '正在润色负向提示词...', 'Polishing negative prompt...')
                : tc('comfyui.prompt.polishing', '正在润色提示词...', 'Polishing prompt...');
            const polished = await polishComfyPromptText(original, !!isNegative);
            setComfyPromptFieldValue(fieldEl, polished);
            notifyUser(
                isNegative ? tc('comfyui.prompt.polished_negative', '负向提示词已润色', 'Negative prompt polished') : tc('comfyui.prompt.polished', '提示词已润色', 'Prompt polished'),
                'success'
            );
        } catch (e) {
            notifyUser(
                tc('comfyui.prompt.polish_failed_detail', '润色失败: {msg}', 'Polish failed: {msg}', { msg: e.message }),
                'error',
                tc('comfyui.prompt.polish_failed', '润色失败', 'Polish failed')
            );
        } finally {
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.classList.remove('is-loading');
            }
            if (statusDiv) statusDiv.textContent = previousStatus || tc('comfyui.status.ready', '就绪', 'Ready');
        }
    }

    function openComfyAnglePromptModal(fieldEl) {
        if (!fieldEl) return;
        const msMgr = window.ModelScopeManager;
        if (!msMgr || typeof msMgr.anglePrompt_step1_1_openModal !== 'function') {
            notifyUser(
                tc('comfyui.prompt.angle_require_modelscope', '角度提示词依赖 ModelScope 模块，请先打开一次 ModelScope 面板', 'Angle prompt requires ModelScope. Open the ModelScope panel once first.'),
                'warning',
                tc('comfyui.unavailable', '功能不可用', 'Unavailable')
            );
            return;
        }

        const originalApply = msMgr.anglePrompt_step1_5_applyPrompt;
        const replacementApply = function (spec) {
            try {
                const text = typeof msMgr.anglePrompt_step1_4_getPromptText === 'function'
                    ? msMgr.anglePrompt_step1_4_getPromptText(spec)
                    : '';
                if (text) appendComfyPromptText(fieldEl, text);
                notifyUser(tc('comfyui.prompt.angle_added', '角度提示词已添加', 'Angle prompt added'), 'success');
            } catch (e) {
                notifyUser(
                    tc('comfyui.prompt.angle_failed_detail', '角度提示词失败: {msg}', 'Angle prompt failed: {msg}', { msg: e.message }),
                    'error',
                    tc('comfyui.prompt.angle', '角度提示词', 'Angle Prompt')
                );
            }
        };
        msMgr.anglePrompt_step1_5_applyPrompt = replacementApply;

        const restore = () => {
            if (msMgr.anglePrompt_step1_5_applyPrompt === replacementApply) {
                msMgr.anglePrompt_step1_5_applyPrompt = originalApply;
            }
        };

        try {
            msMgr.anglePrompt_step1_1_openModal();
            const modal = document.getElementById('ms-angle-prompt-modal');
            if (!modal) {
                restore();
                return;
            }
            ['ms-angle-close', 'ms-angle-cancel', 'ms-angle-apply'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', () => setTimeout(restore, 0), { once: true });
            });
            const observer = new MutationObserver(() => {
                if (!document.getElementById('ms-angle-prompt-modal')) {
                    restore();
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {
            restore();
            notifyUser(
                tc('comfyui.prompt.angle_failed_detail', '角度提示词失败: {msg}', 'Angle prompt failed: {msg}', { msg: e.message }),
                'error',
                tc('comfyui.prompt.angle', '角度提示词', 'Angle Prompt')
            );
        }
    }

    function hasUsableFileBytes(fileObj) {
        if (!fileObj || typeof fileObj !== 'object') return false;
        if (typeof fileObj.size !== 'number') return true;
        return fileObj.size > 0;
    }

    async function resolveMaskEditorImageSource(fileObj, localPath = '') {
        const pathCandidate = normalizeLocalPath(localPath) || getLocalPathFromFile(fileObj);
        const hasFile = fileObj && hasUsableFileBytes(fileObj);
        if (hasFile) {
            const fileUrl = URL.createObjectURL(fileObj);
            return {
                sourceName: fileObj.name || 'image',
                sourceUrl: fileUrl,
                cleanup: () => {
                    try { URL.revokeObjectURL(fileUrl); } catch (e) { }
                }
            };
        }
        if (pathCandidate) {
            if (!fsHelper.existsSync(pathCandidate)) {
                throw new Error('图片文件不存在，请重新选择');
            }
            return {
                sourceName: fsHelper.basename(pathCandidate),
                sourcePath: pathCandidate,
                sourceUrl: `${pathToFileUrl(pathCandidate)}?t=${Date.now()}`,
                cleanup: () => { }
            };
        }
        throw new Error('请先选择用于绘制遮罩的图片');
    }

    async function applyMaskBlobToFileInput(fileInput, blob, sourceName = 'mask') {
        if (!fileInput) throw new Error('遮罩输入控件不存在');
        if (!blob) throw new Error('遮罩数据为空');

        const safeBase = sanitizeMaskFileName(sourceName, 'mask');
        const fileName = `${safeBase}_mask_${Date.now()}.png`;

        if (typeof File === 'function' && typeof DataTransfer === 'function') {
            try {
                const fileObj = new File([blob], fileName, { type: 'image/png' });
                const dt = new DataTransfer();
                dt.items.add(fileObj);
                fileInput.files = dt.files;
                if (fileInput.dataset) fileInput.dataset.localPath = '';
                return { mode: 'file', file: fileObj, fileName };
            } catch (e) {
                console.warn('回填遮罩到文件输入失败，准备降级到本地路径模式', e);
            }
        }

        const canWriteBinary = !!(fs && typeof fs.writeFileSync === 'function' && typeof Buffer !== 'undefined');
        if (!canWriteBinary || typeof blob.arrayBuffer !== 'function') {
            throw new Error('当前环境不支持遮罩文件回填，请手动导入遮罩');
        }

        const dir = ensureComfyMaskTempDir();
        const fullPath = fsHelper.join(dir, fileName);
        const arrayBuffer = await blob.arrayBuffer();
        fs.writeFileSync(fullPath, Buffer.from(arrayBuffer));
        if (fileInput.dataset) fileInput.dataset.localPath = fullPath;
        try { fileInput.value = ''; } catch (e) { }
        return { mode: 'path', path: fullPath, fileName };
    }

    function comfyLoadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('加载图片失败，请确认路径可访问'));
            img.src = url;
        });
    }

    async function openComfyMaskEditor(options = {}) {
        const sourceUrl = String(options.sourceUrl || '').trim();
        if (!sourceUrl) throw new Error('遮罩编辑器缺少图片来源');

        const baseImage = await comfyLoadImage(sourceUrl);
        const imgWidth = Math.max(1, Number(baseImage.naturalWidth || baseImage.width || 1));
        const imgHeight = Math.max(1, Number(baseImage.naturalHeight || baseImage.height || 1));

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'comfyui-mask-editor-overlay';
            const titleText = escapeHtml(options.title || '绘制遮罩');
            const sourceName = escapeHtml(options.sourceName || '当前图片');
            const brushInit = Number.isFinite(options.brushSize) ? Number(options.brushSize) : COMFY_MASK_EDITOR_DEFAULT_BRUSH;
            const featherInit = Number.isFinite(options.feather) ? Math.max(0, Number(options.feather)) : 0;
            const invertInit = !!options.invert;

            overlay.innerHTML = `
                <div class="comfyui-mask-editor-dialog">
                    <div class="comfyui-mask-editor-header">
                        <div>
                            <div class="comfyui-mask-editor-title">${titleText}</div>
                            <div class="comfyui-mask-editor-subtitle">${sourceName} · ${imgWidth}×${imgHeight}</div>
                        </div>
                        <button type="button" class="comfyui-mask-editor-close" title="关闭">×</button>
                    </div>
                    <div class="comfyui-mask-editor-controls">
                        <button type="button" class="comfyui-mask-editor-tool active" data-tool="brush">画笔</button>
                        <button type="button" class="comfyui-mask-editor-tool" data-tool="erase">橡皮</button>
                        <button type="button" class="comfyui-mask-editor-undo">撤销</button>
                        <button type="button" class="comfyui-mask-editor-clear">清空</button>
                        <label class="comfyui-mask-editor-inline">
                            笔刷
                            <input class="comfyui-mask-editor-brush" type="range" min="2" max="256" step="1" value="${escapeHtml(String(Math.max(2, Math.min(256, brushInit))))}">
                            <span class="comfyui-mask-editor-brush-val">${escapeHtml(String(Math.round(Math.max(2, Math.min(256, brushInit)))))}</span>
                        </label>
                        <label class="comfyui-mask-editor-inline">
                            羽化
                            <input class="comfyui-mask-editor-feather" type="number" min="0" max="64" step="1" value="${escapeHtml(String(Math.max(0, Math.min(64, featherInit))))}">
                        </label>
                        <label class="comfyui-mask-editor-inline comfyui-mask-editor-inline-check">
                            <input class="comfyui-mask-editor-invert" type="checkbox" ${invertInit ? 'checked' : ''}>
                            反向遮罩
                        </label>
                    </div>
                    <div class="comfyui-mask-editor-stage-wrap">
                        <div class="comfyui-mask-editor-stage">
                            <canvas class="comfyui-mask-editor-base"></canvas>
                            <canvas class="comfyui-mask-editor-mask"></canvas>
                        </div>
                    </div>
                    <div class="comfyui-mask-editor-footer">
                        <div class="comfyui-mask-editor-tip">提示: 红色区域为遮罩，保存后会生成黑白 PNG 遮罩。</div>
                        <div class="comfyui-mask-editor-actions">
                            <button type="button" class="comfyui-btn comfyui-btn-secondary comfyui-mask-editor-cancel">取消</button>
                            <button type="button" class="comfyui-btn comfyui-btn-primary comfyui-mask-editor-apply">应用遮罩</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const dialog = overlay.querySelector('.comfyui-mask-editor-dialog');
            const baseCanvas = overlay.querySelector('.comfyui-mask-editor-base');
            const maskCanvas = overlay.querySelector('.comfyui-mask-editor-mask');
            const stageEl = overlay.querySelector('.comfyui-mask-editor-stage');
            const closeBtn = overlay.querySelector('.comfyui-mask-editor-close');
            const cancelBtn = overlay.querySelector('.comfyui-mask-editor-cancel');
            const applyBtn = overlay.querySelector('.comfyui-mask-editor-apply');
            const clearBtn = overlay.querySelector('.comfyui-mask-editor-clear');
            const undoBtn = overlay.querySelector('.comfyui-mask-editor-undo');
            const brushRange = overlay.querySelector('.comfyui-mask-editor-brush');
            const brushVal = overlay.querySelector('.comfyui-mask-editor-brush-val');
            const featherInput = overlay.querySelector('.comfyui-mask-editor-feather');
            const invertInput = overlay.querySelector('.comfyui-mask-editor-invert');
            const toolButtons = Array.from(overlay.querySelectorAll('.comfyui-mask-editor-tool'));
            if (!dialog || !baseCanvas || !maskCanvas || !applyBtn || !cancelBtn || !closeBtn) {
                overlay.remove();
                resolve(null);
                return;
            }

            stageEl.style.width = `${imgWidth}px`;
            stageEl.style.height = `${imgHeight}px`;
            baseCanvas.width = imgWidth;
            baseCanvas.height = imgHeight;
            maskCanvas.width = imgWidth;
            maskCanvas.height = imgHeight;

            const baseCtx = baseCanvas.getContext('2d');
            const maskCtx = maskCanvas.getContext('2d');
            if (!baseCtx || !maskCtx) {
                overlay.remove();
                resolve(null);
                return;
            }
            baseCtx.drawImage(baseImage, 0, 0, imgWidth, imgHeight);

            let tool = 'brush';
            let drawing = false;
            let lastPoint = null;
            let history = [];
            let resolved = false;
            const clampBrushValue = () => {
                const val = Number(brushRange ? brushRange.value : COMFY_MASK_EDITOR_DEFAULT_BRUSH);
                return Math.max(2, Math.min(256, Number.isFinite(val) ? val : COMFY_MASK_EDITOR_DEFAULT_BRUSH));
            };
            const getFeatherValue = () => {
                const val = Number(featherInput ? featherInput.value : 0);
                return Math.max(0, Math.min(64, Number.isFinite(val) ? val : 0));
            };

            const updateToolButtons = () => {
                toolButtons.forEach(btn => {
                    const btnTool = btn.getAttribute('data-tool');
                    btn.classList.toggle('active', btnTool === tool);
                });
            };

            const pushHistory = () => {
                try {
                    history.push(maskCtx.getImageData(0, 0, imgWidth, imgHeight));
                    if (history.length > COMFY_MASK_EDITOR_MAX_HISTORY) history.shift();
                } catch (e) {
                    console.warn('记录遮罩历史失败', e);
                }
            };

            const restoreLastHistory = () => {
                if (!history.length) return;
                const snapshot = history.pop();
                if (!snapshot) return;
                maskCtx.putImageData(snapshot, 0, 0);
            };

            const getCanvasPoint = (evt) => {
                const rect = maskCanvas.getBoundingClientRect();
                if (!rect || !rect.width || !rect.height) return null;
                const clientX = evt.touches && evt.touches.length ? evt.touches[0].clientX : evt.clientX;
                const clientY = evt.touches && evt.touches.length ? evt.touches[0].clientY : evt.clientY;
                const x = (clientX - rect.left) * (imgWidth / rect.width);
                const y = (clientY - rect.top) * (imgHeight / rect.height);
                return {
                    x: Math.max(0, Math.min(imgWidth, x)),
                    y: Math.max(0, Math.min(imgHeight, y))
                };
            };

            const drawSegment = (from, to) => {
                if (!from || !to) return;
                maskCtx.save();
                maskCtx.lineCap = 'round';
                maskCtx.lineJoin = 'round';
                maskCtx.lineWidth = clampBrushValue();
                if (tool === 'erase') {
                    maskCtx.globalCompositeOperation = 'destination-out';
                    maskCtx.strokeStyle = 'rgba(0,0,0,1)';
                } else {
                    maskCtx.globalCompositeOperation = 'source-over';
                    maskCtx.strokeStyle = 'rgba(255, 64, 64, 0.55)';
                }
                maskCtx.beginPath();
                maskCtx.moveTo(from.x, from.y);
                maskCtx.lineTo(to.x, to.y);
                maskCtx.stroke();
                maskCtx.restore();
            };

            const drawDot = (point) => {
                if (!point) return;
                maskCtx.save();
                if (tool === 'erase') {
                    maskCtx.globalCompositeOperation = 'destination-out';
                    maskCtx.fillStyle = 'rgba(0,0,0,1)';
                } else {
                    maskCtx.globalCompositeOperation = 'source-over';
                    maskCtx.fillStyle = 'rgba(255,64,64,0.55)';
                }
                maskCtx.beginPath();
                maskCtx.arc(point.x, point.y, clampBrushValue() / 2, 0, Math.PI * 2);
                maskCtx.fill();
                maskCtx.restore();
            };

            const startDrawing = (evt) => {
                evt.preventDefault();
                const point = getCanvasPoint(evt);
                if (!point) return;
                pushHistory();
                drawing = true;
                lastPoint = point;
                drawDot(point);
            };

            const moveDrawing = (evt) => {
                if (!drawing) return;
                evt.preventDefault();
                const point = getCanvasPoint(evt);
                if (!point || !lastPoint) return;
                drawSegment(lastPoint, point);
                lastPoint = point;
            };

            const stopDrawing = () => {
                drawing = false;
                lastPoint = null;
            };

            const closeEditor = (result) => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener('mouseup', stopDrawing);
                document.removeEventListener('mousemove', moveDrawing);
                document.removeEventListener('touchend', stopDrawing);
                document.removeEventListener('touchmove', moveDrawing);
                overlay.remove();
                resolve(result);
            };

            const applyInitialMask = async () => {
                const initialMaskDataUrl = String(options.initialMaskDataUrl || '').trim();
                if (!initialMaskDataUrl) return;
                try {
                    const presetMask = await comfyLoadImage(initialMaskDataUrl);
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = imgWidth;
                    tempCanvas.height = imgHeight;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (!tempCtx) return;
                    tempCtx.drawImage(presetMask, 0, 0, imgWidth, imgHeight);
                    const src = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
                    const dst = maskCtx.createImageData(imgWidth, imgHeight);
                    for (let i = 0; i < src.data.length; i += 4) {
                        const alpha = src.data[i + 3];
                        const red = src.data[i];
                        const green = src.data[i + 1];
                        const blue = src.data[i + 2];
                        const grayLike = Math.abs(red - green) < 3 && Math.abs(red - blue) < 3;
                        const maskValue = (alpha >= 250)
                            ? (grayLike ? red : 255)
                            : alpha;
                        if (!maskValue) continue;
                        dst.data[i] = 255;
                        dst.data[i + 1] = 64;
                        dst.data[i + 2] = 64;
                        dst.data[i + 3] = Math.max(0, Math.min(255, maskValue));
                    }
                    maskCtx.putImageData(dst, 0, 0);
                } catch (e) {
                    console.warn('恢复历史遮罩失败', e);
                }
            };

            const exportMask = async () => {
                const sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = imgWidth;
                sourceCanvas.height = imgHeight;
                const sourceCtx = sourceCanvas.getContext('2d');
                if (!sourceCtx) throw new Error('无法导出遮罩');
                sourceCtx.drawImage(maskCanvas, 0, 0);

                const feather = getFeatherValue();
                let finalCanvas = sourceCanvas;
                if (feather > 0) {
                    const blurCanvas = document.createElement('canvas');
                    blurCanvas.width = imgWidth;
                    blurCanvas.height = imgHeight;
                    const blurCtx = blurCanvas.getContext('2d');
                    if (blurCtx) {
                        blurCtx.filter = `blur(${feather}px)`;
                        blurCtx.drawImage(sourceCanvas, 0, 0);
                        blurCtx.filter = 'none';
                        finalCanvas = blurCanvas;
                    }
                }

                const finalCtx = finalCanvas.getContext('2d');
                if (!finalCtx) throw new Error('遮罩导出失败');
                const srcData = finalCtx.getImageData(0, 0, imgWidth, imgHeight);
                const outCanvas = document.createElement('canvas');
                outCanvas.width = imgWidth;
                outCanvas.height = imgHeight;
                const outCtx = outCanvas.getContext('2d');
                if (!outCtx) throw new Error('遮罩导出失败');
                const outData = outCtx.createImageData(imgWidth, imgHeight);
                const invert = !!(invertInput && invertInput.checked);
                for (let i = 0; i < srcData.data.length; i += 4) {
                    const alpha = srcData.data[i + 3];
                    let value = Math.max(0, Math.min(255, alpha));
                    if (invert) value = 255 - value;
                    outData.data[i] = value;
                    outData.data[i + 1] = value;
                    outData.data[i + 2] = value;
                    outData.data[i + 3] = value;
                }
                outCtx.putImageData(outData, 0, 0);

                const maskBlob = await new Promise((resolveBlob) => outCanvas.toBlob(resolveBlob, 'image/png'));
                if (!maskBlob) throw new Error('遮罩导出失败');

                const imageCanvas = document.createElement('canvas');
                imageCanvas.width = imgWidth;
                imageCanvas.height = imgHeight;
                const imageCtx = imageCanvas.getContext('2d');
                if (!imageCtx) throw new Error('遮罩导出失败');
                imageCtx.drawImage(baseImage, 0, 0, imgWidth, imgHeight);
                const imageData = imageCtx.getImageData(0, 0, imgWidth, imgHeight);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i + 3] = 255 - outData.data[i];
                }
                imageCtx.putImageData(imageData, 0, 0);
                const imageBlob = await new Promise((resolveBlob) => imageCanvas.toBlob(resolveBlob, 'image/png'));
                if (!imageBlob) throw new Error('遮罩导出失败');

                const editorCanvas = document.createElement('canvas');
                editorCanvas.width = imgWidth;
                editorCanvas.height = imgHeight;
                const editorCtx = editorCanvas.getContext('2d');
                if (!editorCtx) throw new Error('遮罩导出失败');
                const editorData = editorCtx.createImageData(imgWidth, imgHeight);
                for (let i = 0; i < outData.data.length; i += 4) {
                    const v = outData.data[i];
                    editorData.data[i] = 255;
                    editorData.data[i + 1] = 64;
                    editorData.data[i + 2] = 64;
                    editorData.data[i + 3] = v;
                }
                editorCtx.putImageData(editorData, 0, 0);

                return {
                    maskBlob,
                    imageBlob,
                    maskDataUrl: outCanvas.toDataURL('image/png'),
                    editorMaskDataUrl: editorCanvas.toDataURL('image/png'),
                    settings: {
                        feather,
                        invert,
                        brushSize: clampBrushValue()
                    }
                };
            };

            toolButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const nextTool = btn.getAttribute('data-tool');
                    if (!nextTool) return;
                    tool = nextTool;
                    updateToolButtons();
                });
            });

            if (brushRange && brushVal) {
                const syncBrush = () => {
                    brushVal.textContent = String(Math.round(clampBrushValue()));
                };
                brushRange.addEventListener('input', syncBrush);
                syncBrush();
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    pushHistory();
                    maskCtx.clearRect(0, 0, imgWidth, imgHeight);
                });
            }

            if (undoBtn) {
                undoBtn.addEventListener('click', restoreLastHistory);
            }

            maskCanvas.addEventListener('mousedown', startDrawing);
            maskCanvas.addEventListener('touchstart', startDrawing, { passive: false });
            document.addEventListener('mousemove', moveDrawing);
            document.addEventListener('touchmove', moveDrawing, { passive: false });
            document.addEventListener('mouseup', stopDrawing);
            document.addEventListener('touchend', stopDrawing);

            closeBtn.addEventListener('click', () => closeEditor(null));
            cancelBtn.addEventListener('click', () => closeEditor(null));
            overlay.addEventListener('click', (evt) => {
                if (evt.target === overlay) closeEditor(null);
            });
            applyBtn.addEventListener('click', async () => {
                try {
                    const result = await exportMask();
                    closeEditor(result);
                } catch (e) {
                    notifyUser(`导出遮罩失败: ${e.message}`, 'error', '遮罩导出失败');
                }
            });

            applyInitialMask();
        });
    }

    function getFileExtension(fileName) {
        const raw = String(fileName || '').trim();
        const dotIndex = raw.lastIndexOf('.');
        if (dotIndex < 0) return '';
        return raw.substring(dotIndex).toLowerCase();
    }

    function normalizeUploadFilename(rawName, mediaType = 'image') {
        let name = String(rawName || '').trim();
        if (!name) name = `input_${Date.now()}`;

        // Remove query/hash suffix if caller passed URL-like text.
        name = name.split('?')[0].split('#')[0];

        // Keep basename only; guard against absolute paths, drive letters and traversal.
        if (path && typeof path.basename === 'function') {
            try {
                name = path.basename(name);
            } catch (e) {
                name = name.replace(/^.*[\\\/]/, '');
            }
        } else {
            name = name.replace(/^.*[\\\/]/, '');
        }

        name = name
            .replace(/^[a-zA-Z]:/, '')
            .replace(/[\\\/]/g, '_')
            .replace(/[:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!name || name === '.' || name === '..') {
            name = `input_${Date.now()}`;
        }

        if (!getFileExtension(name)) {
            const ext = mediaType === 'audio' ? '.mp3' : mediaType === 'video' ? '.mp4' : '.png';
            name += ext;
        }

        return name;
    }

    function inferMimeType(fileName, mediaType = '') {
        const ext = getFileExtension(fileName);
        if (ext && EXTENSION_MIME_MAP[ext]) return EXTENSION_MIME_MAP[ext];
        return MEDIA_FALLBACK_MIME[mediaType] || '';
    }

    function getMediaAccept(mediaType) {
        return MEDIA_ACCEPT_MAP[mediaType] || 'image/*';
    }

    function getMediaDisplayName(mediaType) {
        if (mediaType === 'audio') return '音频';
        if (mediaType === 'video') return '视频';
        return '图片';
    }

    function getCustomFileSourceOptions(mediaType) {
        if (mediaType === 'image') {
            return [
                { value: 'file', label: '本地文件' },
                { value: 'layer', label: 'AE选中图层' },
                { value: 'frame', label: 'AE当前画面' }
            ];
        }
        if (mediaType === 'audio') {
            return [
                { value: 'file', label: '本地音频' },
                { value: 'layer', label: 'AE音频图层' }
            ];
        }
        if (mediaType === 'video') {
            return [
                { value: 'file', label: '本地视频' },
                { value: 'layer', label: 'AE视频图层' }
            ];
        }
        return [
            { value: 'file', label: '本地文件' },
            { value: 'layer', label: 'AE选中图层' }
        ];
    }

    function getCustomFileSourceHint(source, mediaType) {
        const mediaName = getMediaDisplayName(mediaType);
        if (source === 'layer') {
            if (mediaType === 'audio') return `已选择 AE 音频图层，将使用该图层音频`;
            if (mediaType === 'video') return `已选择 AE 视频图层，将使用该图层画面`;
            return `已选择 AE 图层来源，生成时将上传该${mediaName}文件`;
        }
        if (source === 'frame') return '已选择 AE 当前画面来源，生成时将使用该截图';
        return `支持拖拽或点击选择本地${mediaName}文件`;
    }

    function normalizeCustomParamLabel(label, key) {
        const text = String(label || '').trim();
        if (text) return text;
        return String(key || '未命名参数');
    }

    function getNodeDisplayName(node, nodeId) {
        if (!node || typeof node !== 'object') return `Node ${nodeId}`;
        if (node._meta && node._meta.title) return String(node._meta.title);
        if (node.class_type) return String(node.class_type);
        return `Node ${nodeId}`;
    }

    function buildDefaultParamLabel(node, nodeId, key) {
        const nodeName = getNodeDisplayName(node, nodeId);
        const keyName = String(key || '').trim();
        if (!nodeName) return keyName;
        if (!keyName) return nodeName;
        if (nodeName.toLowerCase() === keyName.toLowerCase()) return keyName;
        return `${nodeName} · ${keyName}`;
    }

    function pathToFileUrl(filePath) {
        const raw = String(filePath || '').trim();
        if (!raw) return '';
        const normalized = raw.replace(/\\/g, '/');
        const encoded = encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F');
        if (/^[a-zA-Z]:\//.test(normalized)) return `file:///${encoded}`;
        if (normalized.startsWith('/')) return `file://${encoded}`;
        return `file:///${encoded}`;
    }

    function fileUrlToLocalPath(fileUrl) {
        const value = String(fileUrl || '').trim();
        if (!value) return '';
        if (!/^file:/i.test(value)) return '';
        let decoded = value;
        try {
            decoded = decodeURI(value);
        } catch (e) {
            decoded = value;
        }
        decoded = decoded.replace(/^file:\/\/\/?/i, '');
        decoded = decoded.split('?')[0].split('#')[0];
        decoded = decoded.replace(/\//g, '\\');
        if (/^[a-zA-Z]:\\/.test(decoded) || decoded.startsWith('\\\\')) return decoded;
        return '';
    }

    function normalizeLocalPath(rawPath) {
        const trimmed = String(rawPath || '').trim().replace(/^['"]+|['"]+$/g, '');
        if (!trimmed) return '';
        if (/^file:/i.test(trimmed)) return fileUrlToLocalPath(trimmed);
        const normalized = trimmed.replace(/\//g, '\\');
        if (/^[a-zA-Z]:\\/.test(normalized) || normalized.startsWith('\\\\')) return normalized;
        return '';
    }

    function isDirectoryLikeKey(key) {
        const keyLower = String(key || '').toLowerCase();
        if (!keyLower) return false;
        if (keyLower === 'dir' || keyLower === 'directory' || keyLower === 'folder') return true;
        if (/(^|_)(dir|directory|folder)(_|$)/.test(keyLower)) return true;
        if (keyLower.endsWith('dir') || keyLower.endsWith('directory') || keyLower.endsWith('folder')) return true;
        return false;
    }

    function isDirectoryLikeParam(key, rawType = '') {
        const typeLower = String(rawType || '').toLowerCase();
        if (isDirectoryLikeKey(key)) return true;
        if (!typeLower) return false;
        return typeLower.includes('directory') || typeLower.includes('folder') || typeLower === 'dir';
    }

    function dirnameLocalPath(localPath) {
        const normalized = String(localPath || '').replace(/[\\\/]+$/, '');
        if (!normalized) return '';
        if (path && typeof path.dirname === 'function') {
            try {
                return path.dirname(normalized);
            } catch (e) { }
        }
        const slashIndex = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
        return slashIndex > 0 ? normalized.substring(0, slashIndex) : normalized;
    }

    function normalizePathForNodeInput(rawPath, key = '') {
        const normalizedPath = normalizeLocalPath(rawPath) || String(rawPath || '').trim();
        if (!normalizedPath) return '';
        if (!isDirectoryLikeKey(key)) return normalizedPath;

        let pathValue = normalizedPath.replace(/[\\\/]+$/, '');
        if (!pathValue) return normalizedPath;

        if (fs && typeof fs.statSync === 'function') {
            try {
                const stat = fs.statSync(pathValue);
                if (stat && typeof stat.isFile === 'function' && stat.isFile()) {
                    return dirnameLocalPath(pathValue);
                }
                return pathValue;
            } catch (e) { }
        }

        if (/\.[^\\\/]{1,8}$/.test(pathValue)) {
            return dirnameLocalPath(pathValue);
        }
        return pathValue;
    }

    function isLocalAbsolutePathValue(value) {
        return !!normalizeLocalPath(value);
    }

    function extractFirstLocalPath(rawText) {
        if (!rawText) return '';
        const lines = String(rawText)
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        for (const line of lines) {
            if (line.startsWith('#')) continue;
            const fromUrl = fileUrlToLocalPath(line);
            if (fromUrl) return fromUrl;
            const fromPath = normalizeLocalPath(line);
            if (fromPath) return fromPath;
        }
        return '';
    }

    function getLocalPathFromFile(fileObj) {
        if (!fileObj || typeof fileObj !== 'object') return '';
        if (typeof fileObj.path === 'string' && fileObj.path.trim()) {
            return normalizeLocalPath(fileObj.path);
        }
        return '';
    }

    function extractLocalPathFromDataTransfer(dataTransfer) {
        if (!dataTransfer) return '';

        try {
            if (dataTransfer.files && dataTransfer.files.length > 0) {
                const directPath = getLocalPathFromFile(dataTransfer.files[0]);
                if (directPath) return directPath;
            }
        } catch (e) { }

        const readType = (type) => {
            try {
                return dataTransfer.getData(type) || '';
            } catch (e) {
                return '';
            }
        };

        const fromUri = extractFirstLocalPath(readType('text/uri-list'));
        if (fromUri) return fromUri;

        const fromPlain = extractFirstLocalPath(readType('text/plain'));
        if (fromPlain) return fromPlain;

        const html = readType('text/html');
        if (html) {
            const fileUrlMatches = html.match(/file:\/\/\/?[^"'\s<>]+/gi);
            if (fileUrlMatches && fileUrlMatches.length > 0) {
                const fromHtml = extractFirstLocalPath(fileUrlMatches.join('\n'));
                if (fromHtml) return fromHtml;
            }
        }

        return '';
    }

    function getFileSizeFromPath(localPath) {
        if (!localPath) return 0;
        if (fs && typeof fs.statSync === 'function') {
            try {
                const stat = fs.statSync(localPath);
                if (stat && typeof stat.size === 'number' && isFinite(stat.size)) {
                    return Math.max(0, stat.size);
                }
            } catch (e) { }
        }
        return 0;
    }

    function syncSelectTitle(selectEl) {
        if (!selectEl || !selectEl.options) return;
        const idx = selectEl.selectedIndex;
        if (idx < 0 || !selectEl.options[idx]) {
            selectEl.title = '';
            return;
        }
        const txt = String(selectEl.options[idx].textContent || '').trim();
        selectEl.title = txt;
    }

    function bindSelectTitleSync(rootEl) {
        if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
        rootEl.querySelectorAll('select').forEach(sel => {
            syncSelectTitle(sel);
            if (sel.dataset && sel.dataset.titleSyncBound === '1') return;
            sel.addEventListener('change', () => syncSelectTitle(sel));
            if (sel.dataset) sel.dataset.titleSyncBound = '1';
        });
    }

    function hasFileLikeDataTransfer(dataTransfer) {
        if (!dataTransfer) return false;
        const types = dataTransfer.types ? Array.from(dataTransfer.types) : [];
        if (dataTransfer.files && dataTransfer.files.length > 0) return true;
        if (types.includes('Files')) return true;
        if (types.includes('text/uri-list') || types.includes('text/html') || types.includes('text/plain')) return true;
        return false;
    }

    function scheduleSaveWorkflow() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (currentWorkflowPath && currentWorkflow) {
                try {
                    fsHelper.writeFileSync(currentWorkflowPath, JSON.stringify(currentWorkflow, null, 2));
                    // console.log("Workflow auto-saved");
                } catch (e) {
                    console.error("Auto-save failed", e);
                }
            }
        }, 1000);
    }

    const nodeInfoCache = {};

    async function fetchNodeObjectInfo(nodeType) {
        if (!comfyUiUrl) return null;
        if (nodeInfoCache[nodeType]) return nodeInfoCache[nodeType];
        try {
            const response = await fetch(`${comfyUiUrl}/object_info/${nodeType}`);
            if (response.ok) {
                const data = await response.json();
                nodeInfoCache[nodeType] = data[nodeType];
                return nodeInfoCache[nodeType];
            }
        } catch (e) {
            console.error("Failed to fetch node info for " + nodeType, e);
        }
        return null;
    }

    function init() {
        if (!document.getElementById('comfyui-panel')) {
            createPanel();
        }
        if (!comfyLangBound) {
            comfyLangBound = true;
            window.addEventListener('language:changed', () => {
                applyComfyPanelLanguage();
                try {
                    if (window.CozeManager && window.CozeManager.render) window.CozeManager.render();
                } catch (e) { }
                try {
                    if (window.ModelScopeManager && window.ModelScopeManager.updateSettings) window.ModelScopeManager.updateSettings();
                } catch (e) { }
            });
        }

        // Ensure storage directory exists
        fsHelper.mkdirSync(workflowStorageDir);

        // Migrate old workflows from extensionDir
        try {
            if (fsHelper.existsSync(legacyWorkflowStorageDir)) {
                const oldFiles = fsHelper.readdirSync(legacyWorkflowStorageDir).filter(f => f.toLowerCase().endsWith('.json'));
                oldFiles.forEach(f => {
                    const oldPath = fsHelper.join(legacyWorkflowStorageDir, f);
                    const newPath = fsHelper.join(workflowStorageDir, f);
                    if (!fsHelper.existsSync(newPath)) {
                        // Read from old, write to new
                        const content = fsHelper.readFileSync(oldPath);
                        fsHelper.writeFileSync(newPath, content);
                    }
                });
            }
        } catch (e) {
            console.error("Migration of comfyui workflows failed", e);
        }

        panel = document.getElementById('comfyui-panel');
        statusDiv = document.getElementById('comfyui-status');
        generateBtn = document.getElementById('comfyui-generate-btn');
        cancelBtn = document.getElementById('comfyui-cancel-btn');
        batchCountInput = document.getElementById('comfyui-batch-count');
        nodeListEl = document.getElementById('comfyui-node-list');
        nodeSearchInput = document.getElementById('comfyui-node-search');
        canGenerateWorkflow = !!generateBtn && !generateBtn.disabled;
        bindSelectTitleSync(panel);
        bindPanelDragSafetyGuard();

        const btn = document.getElementById('aiFunctionBtn');
        if (btn) {
            btn.onclick = togglePanel;
        }

        document.getElementById('comfyui-close-btn').addEventListener('click', closePanel);

        const workflowAdvancedToggleBtn = document.getElementById('comfyui-workflow-advanced-toggle');
        if (workflowAdvancedToggleBtn) {
            workflowAdvancedToggleBtn.addEventListener('click', () => {
                const advancedEl = document.getElementById('comfyui-workflow-advanced');
                const isCollapsed = !advancedEl || advancedEl.classList.contains('collapsed');
                setWorkflowAdvancedCollapsed(!isCollapsed, true);
            });
        }
        const collapsedByDefault = localStorage.getItem(WORKFLOW_ADVANCED_COLLAPSED_KEY) !== '0';
        setWorkflowAdvancedCollapsed(collapsedByDefault, false);

        // Drag and Drop for Workflow JSON
        const dropZone = document.getElementById('comfyui-workflow-drop');
        if (dropZone) {
            const titleEl = dropZone.querySelector('.comfyui-drop-zone-title');
            const defaultTitle = dropZone.getAttribute('data-default-title') || tc('comfyui.workflow.drop', '拖入 .json 工作流文件', 'Drop .json workflow file');
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
                if (titleEl) titleEl.textContent = tc('comfyui.workflow.drop_release', '松开以导入工作流', 'Release to import workflow');
            });
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                if (titleEl) titleEl.textContent = defaultTitle;
            });
            dropZone.addEventListener('drop', handleWorkflowDrop);
            dropZone.addEventListener('click', () => document.getElementById('comfyui-file-upload-hidden').click());
        }
        document.getElementById('comfyui-file-upload-hidden').addEventListener('change', handleWorkflowFileSelect);

        if (generateBtn) {
            generateBtn.addEventListener('click', handleGenerate);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancelGenerate);
        }
        if (batchCountInput) {
            batchCountInput.addEventListener('change', () => {
                batchCountInput.value = String(getBatchSubmitCount(batchCountInput.value));
            });
            makeComfyNumericScrubbable(batchCountInput, { step: 1, sensitivity: 0.5 });
        }
        refreshActionButtons();

        document.getElementById('comfyui-refresh-btn').addEventListener('click', () => refreshWorkflowList());
        document.getElementById('comfyui-workflow-select').addEventListener('change', handleWorkflowSelect);
        document.getElementById('comfyui-check-btn').addEventListener('click', checkComfyUIStatus);

        // Delete button
        document.getElementById('comfyui-delete-workflow-btn').addEventListener('click', handleDeleteWorkflow);

        // Config section toggle
        const configToggleBtn = document.getElementById('comfyui-config-toggle-btn');
        if (configToggleBtn) {
            configToggleBtn.addEventListener('click', () => {
                const configSection = document.getElementById('comfyui-config-section');
                const arrow = configToggleBtn.querySelector('.toggle-arrow');
                if (configSection) {
                    configSection.classList.toggle('expanded');
                    if (arrow) arrow.textContent = configSection.classList.contains('expanded') ? '▲' : '▼';
                }
            });
        }

        // Node search
        if (nodeSearchInput) {
            nodeSearchInput.addEventListener('input', (e) => {
                renderNodeList(currentNodeList, e.target.value);
            });
        }

        // Node list card buttons (delegated)
        if (nodeListEl) {
            nodeListEl.addEventListener('click', (e) => {
                const exposeBtn = e.target.closest('.comfyui-expose-param-btn');
                const outputBtn = e.target.closest('.comfyui-set-output-btn');
                if (exposeBtn) {
                    const id = exposeBtn.getAttribute('data-id');
                    pendingGroupName = null;
                    showParamPicker(id);
                } else if (outputBtn) {
                    const id = outputBtn.getAttribute('data-id');
                    toggleOutputNode(id);
                }
            });
        }

        const urlInput = document.getElementById('comfyui-url-input');
        if (urlInput) {
            urlInput.addEventListener('change', (e) => {
                comfyUiUrl = e.target.value.replace(/\/$/, '');
                localStorage.setItem('comfyui_url', comfyUiUrl);
                fetchLoraList();
            });
        }

        refreshWorkflowList();
        fetchLoraList();
    }

    function bindPanelDragSafetyGuard() {
        if (!panel || panel.__comfyDragGuardBound) return;
        panel.__comfyDragGuardBound = true;

        let dragDepth = 0;
        const resetState = () => {
            dragDepth = 0;
            panel.classList.remove('comfyui-panel-file-dragover');
        };

        panel.addEventListener('dragenter', (e) => {
            if (!panel.classList.contains('visible')) return;
            if (!hasFileLikeDataTransfer(e.dataTransfer)) return;
            e.preventDefault();
            dragDepth += 1;
            panel.classList.add('comfyui-panel-file-dragover');
        });

        panel.addEventListener('dragover', (e) => {
            if (!panel.classList.contains('visible')) return;
            if (!hasFileLikeDataTransfer(e.dataTransfer)) return;
            e.preventDefault();
            panel.classList.add('comfyui-panel-file-dragover');
        });

        panel.addEventListener('dragleave', (e) => {
            if (!panel.classList.contains('visible')) return;
            e.preventDefault();
            if (dragDepth > 0) {
                dragDepth -= 1;
            }
            const related = e.relatedTarget || null;
            if (dragDepth === 0 || !panel.contains(related)) {
                panel.classList.remove('comfyui-panel-file-dragover');
            }
        });

        panel.addEventListener('drop', (e) => {
            if (!panel.classList.contains('visible')) return;
            if (hasFileLikeDataTransfer(e.dataTransfer)) e.preventDefault();
            resetState();
        });

        panel.addEventListener('dragend', resetState);
    }

    function togglePanel() {
        if (panel.classList.contains('visible')) {
            closePanel();
            // Re-enable global drag-and-drop
            window.globalDragAndDropEnabled = true;
        } else {
            panel.style.display = 'flex';
            panel.offsetHeight; // Force reflow
            panel.classList.add('visible');
            // Disable global drag-and-drop
            window.globalDragAndDropEnabled = false;
        }
    }

    function closePanel() {
        panel.classList.remove('visible');
        panel.classList.remove('comfyui-panel-file-dragover');
        setTimeout(() => {
            panel.style.display = 'none';
        }, 350);
        // Re-enable global drag-and-drop
        window.globalDragAndDropEnabled = true;
    }

    function setWorkflowAdvancedCollapsed(collapsed, persist = true) {
        const advancedEl = document.getElementById('comfyui-workflow-advanced');
        const toggleBtn = document.getElementById('comfyui-workflow-advanced-toggle');
        if (!advancedEl || !toggleBtn) return;

        advancedEl.classList.toggle('collapsed', !!collapsed);
        advancedEl.classList.toggle('expanded', !collapsed);

        const arrow = toggleBtn.querySelector('.toggle-arrow');
        const label = toggleBtn.querySelector('.toggle-label');
        if (arrow) arrow.textContent = collapsed ? '▼' : '▲';
        if (label) label.textContent = collapsed
            ? tc('comfyui.workflow.expand', '展开设置', 'Expand settings')
            : tc('comfyui.workflow.collapse', '收起设置', 'Collapse settings');
        toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

        if (persist) {
            localStorage.setItem(WORKFLOW_ADVANCED_COLLAPSED_KEY, collapsed ? '1' : '0');
        }
    }

    function applyComfyPanelLanguage() {
        const panelEl = document.getElementById('comfyui-panel');
        if (!panelEl) return;

        const titleEl = panelEl.querySelector('.comfyui-title');
        if (titleEl) titleEl.textContent = tc('comfyui.title', 'AI 创作中心', 'AI Creative Center');

        const modelscopeTab = panelEl.querySelector('.ai-module-tab[data-module="modelscope"]');
        if (modelscopeTab) modelscopeTab.setAttribute('title', tc('comfyui.tab.modelscope_title', 'ModelScope 魔搭', 'ModelScope'));
        const comfyTab = panelEl.querySelector('.ai-module-tab[data-module="comfyui"]');
        if (comfyTab) comfyTab.setAttribute('title', tc('comfyui.tab.workflow_title', 'ComfyUI 工作流', 'ComfyUI Workflow'));
        const volcTab = panelEl.querySelector('.ai-module-tab[data-module="volcengine"]');
        if (volcTab) {
            volcTab.setAttribute('title', tc('comfyui.tab.voice_title', 'AI 配音 (火山引擎)', 'AI Voice (Volcengine)'));
            const text = volcTab.querySelector('.tab-text');
            if (text) text.textContent = tc('comfyui.tab.voice', '配音', 'Voice');
        }
        const cozeTab = panelEl.querySelector('.ai-module-tab[data-module="coze"]');
        if (cozeTab) {
            cozeTab.setAttribute('title', tc('comfyui.tab.coze_title', 'Coze 扣子', 'Coze'));
            const text = cozeTab.querySelector('.tab-text');
            if (text) text.textContent = tc('comfyui.tab.coze', '扣子', 'Coze');
        }

        const dragTip = panelEl.querySelector('.comfyui-global-drag-tip');
        if (dragTip) dragTip.textContent = tc('comfyui.drag_tip', '检测到文件拖拽，请拖到参数文件框或工作流导入框后松开', 'File drag detected. Drop into a parameter file box or workflow import area.');

        const workflowSectionTitle = panelEl.querySelector('.comfyui-workflow-section .comfyui-section-title');
        if (workflowSectionTitle) workflowSectionTitle.textContent = tc('comfyui.workflow.section', '工作流', 'Workflow');

        const select = document.getElementById('comfyui-workflow-select');
        if (select && select.options && select.options.length > 0 && !select.value) {
            select.options[0].text = tc('comfyui.workflow.select_placeholder', '-- 请选择工作流 --', '-- Select workflow --');
        }

        const urlLabel = panelEl.querySelector('label[for="comfyui-url-input"]') || panelEl.querySelector('#comfyui-workflow-advanced .comfyui-row .comfyui-label');
        if (urlLabel && urlLabel.textContent.indexOf('ComfyUI') >= 0) {
            urlLabel.textContent = tc('comfyui.workflow.url', 'ComfyUI 地址:', 'ComfyUI URL:');
        }

        const labels = panelEl.querySelectorAll('#comfyui-workflow-advanced .comfyui-label');
        if (labels && labels[1]) labels[1].textContent = tc('comfyui.workflow.manage', '工作流管理:', 'Workflow Management:');

        const refreshBtn = document.getElementById('comfyui-refresh-btn');
        if (refreshBtn) refreshBtn.setAttribute('title', tc('ui.refresh.title', '刷新列表', 'Refresh list'));
        const deleteBtn = document.getElementById('comfyui-delete-workflow-btn');
        if (deleteBtn) deleteBtn.setAttribute('title', tc('comfyui.workflow.delete_current', '删除当前工作流', 'Delete current workflow'));
        const checkBtn = document.getElementById('comfyui-check-btn');
        if (checkBtn) checkBtn.textContent = tc('comfyui.workflow.check', '检测连接', 'Check Connection');

        const dropZone = document.getElementById('comfyui-workflow-drop');
        if (dropZone) {
            const dropTitleText = tc('comfyui.workflow.drop', '拖入 .json 工作流文件', 'Drop .json workflow file');
            dropZone.setAttribute('data-default-title', dropTitleText);
            const dropTitle = dropZone.querySelector('.comfyui-drop-zone-title');
            if (dropTitle && !dropZone.classList.contains('drag-over')) dropTitle.textContent = dropTitleText;
            const dropSub = dropZone.querySelector('.comfyui-drop-zone-sub');
            if (dropSub) dropSub.textContent = tc('comfyui.workflow.pick', '或点击这里选择文件', 'or click to choose file');
        }

        const useModeTitle = document.querySelector('#comfyui-use-mode-section .comfyui-section-title');
        if (useModeTitle) useModeTitle.textContent = tc('comfyui.params.title', '参数配置', 'Parameters');

        const configToggleLabel = document.querySelector('#comfyui-config-toggle-btn .toggle-label');
        if (configToggleLabel) configToggleLabel.textContent = tc('comfyui.mapping.title', '编辑节点映射', 'Edit Mapping');

        const nodeSearch = document.getElementById('comfyui-node-search');
        if (nodeSearch) nodeSearch.setAttribute('placeholder', tc('comfyui.node.search', '🔍 搜索节点名称/类型/ID', '🔍 Search node name/type/ID'));

        const nodeHint = document.querySelector('#comfyui-config-section > div:last-child');
        if (nodeHint) nodeHint.textContent = tc('comfyui.node.hint', '点击 ➕ 暴露参数到使用区 · 点击 🚩 设定输出节点', 'Click ➕ to expose params to use-mode · Click 🚩 to set output nodes');

        const batchLabel = document.querySelector('.comfyui-batch-label');
        if (batchLabel) batchLabel.textContent = tc('comfyui.batch', '次数', 'Count');
        const batchInput = document.getElementById('comfyui-batch-count');
        if (batchInput) batchInput.setAttribute('title', tc('comfyui.batch.title', '批量提交次数', 'Batch submission count'));
        const genBtn = document.getElementById('comfyui-generate-btn');
        if (genBtn) genBtn.textContent = tc('comfyui.generate_import', '生成并导入', 'Generate & Import');
        const cancelBtnEl = document.getElementById('comfyui-cancel-btn');
        if (cancelBtnEl) cancelBtnEl.textContent = tc('comfyui.cancel', '取消任务', 'Cancel');

        const advancedEl = document.getElementById('comfyui-workflow-advanced');
        const collapsed = !advancedEl || advancedEl.classList.contains('collapsed');
        setWorkflowAdvancedCollapsed(collapsed, false);
    }

    function createPanel() {
        const html = `
        <div id="comfyui-panel" class="comfyui-panel" style="display: none;">
            <div class="comfyui-header">
                <span class="comfyui-title">${tc('comfyui.title', 'AI 创作中心', 'AI Creative Center')}</span>
                <button id="comfyui-close-btn" class="comfyui-btn-secondary" style="background:transparent; border:none; color:#aaa; font-size:20px; cursor:pointer;">×</button>
            </div>
            
            <div class="ai-module-tabs-wrapper">
                <div class="ai-module-tabs">
                    <div class="ai-module-tab active" data-module="modelscope" title="ModelScope 魔搭">
                        <span class="tab-icon">🎨</span>
                        <span class="tab-text">ModelScope</span>
                    </div>
                    <div class="ai-module-tab" data-module="comfyui" title="${tc('comfyui.tab.workflow_title', 'ComfyUI 工作流', 'ComfyUI Workflow')}">
                        <span class="tab-icon">🧩</span>
                        <span class="tab-text">ComfyUI</span>
                    </div>
                    <div class="ai-module-tab" data-module="volcengine" title="${tc('comfyui.tab.voice_title', 'AI 配音 (火山引擎)', 'AI Voice (Volcengine)')}">
                        <span class="tab-icon">🎙️</span>
                        <span class="tab-text">${tc('comfyui.tab.voice', '配音', 'Voice')}</span>
                    </div>
                    <div class="ai-module-tab" data-module="coze" title="${tc('comfyui.tab.coze_title', 'Coze 扣子', 'Coze')}">
                        <span class="tab-icon">🤖</span>
                        <span class="tab-text">${tc('comfyui.tab.coze', '扣子', 'Coze')}</span>
                    </div>
                </div>
            </div>

            <div class="comfyui-content" id="ai-module-container" style="padding: 0; display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                
                <!-- ComfyUI Module -->
                <div id="module-comfyui" class="ai-module" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding: 16px;">
                    <div class="comfyui-global-drag-tip">
                        ${tc('comfyui.drag_tip', '检测到文件拖拽，请拖到参数文件框或工作流导入框后松开', 'File drag detected. Drop into a parameter file box or workflow import area.')}
                    </div>

                    <div class="comfyui-section comfyui-workflow-section">
                        <div class="comfyui-section-title">${tc('comfyui.workflow.section', '工作流', 'Workflow')}</div>
                        <div class="comfyui-row comfyui-workflow-main-row">
                            <select id="comfyui-workflow-select" class="comfyui-select">
                                <option value="">${tc('comfyui.workflow.select_placeholder', '-- 请选择工作流 --', '-- Select workflow --')}</option>
                            </select>
                            <button id="comfyui-workflow-advanced-toggle" class="comfyui-btn comfyui-btn-secondary comfyui-workflow-advanced-toggle" type="button" aria-expanded="false">
                                <span class="toggle-label">${tc('comfyui.workflow.expand', '展开设置', 'Expand settings')}</span>
                                <span class="toggle-arrow">▼</span>
                            </button>
                        </div>
                        <div id="comfyui-workflow-advanced" class="comfyui-workflow-advanced collapsed">
                            <div class="comfyui-row">
                                <label class="comfyui-label">${tc('comfyui.workflow.url', 'ComfyUI 地址:', 'ComfyUI URL:')}</label>
                                <input type="text" id="comfyui-url-input" value="${comfyUiUrl}" class="comfyui-input">
                            </div>
                            <div class="comfyui-row comfyui-workflow-actions-row">
                                <label class="comfyui-label">${tc('comfyui.workflow.manage', '工作流管理:', 'Workflow Management:')}</label>
                                <div class="comfyui-workflow-action-buttons">
                                    <button id="comfyui-refresh-btn" class="comfyui-btn comfyui-btn-secondary" title="${tc('ui.refresh.title', '刷新列表', 'Refresh list')}">↻</button>
                                    <button id="comfyui-delete-workflow-btn" class="comfyui-btn comfyui-btn-secondary" title="${tc('comfyui.workflow.delete_current', '删除当前工作流', 'Delete current workflow')}" style="color:#f87171;">🗑️</button>
                                    <button id="comfyui-check-btn" class="comfyui-btn comfyui-btn-secondary">${tc('comfyui.workflow.check', '检测连接', 'Check Connection')}</button>
                                </div>
                            </div>
                            <div id="comfyui-workflow-drop" class="comfyui-drop-zone" data-default-title="${tc('comfyui.workflow.drop', '拖入 .json 工作流文件', 'Drop .json workflow file')}">
                                <div class="comfyui-drop-zone-title">${tc('comfyui.workflow.drop', '拖入 .json 工作流文件', 'Drop .json workflow file')}</div>
                                <div class="comfyui-drop-zone-sub">${tc('comfyui.workflow.pick', '或点击这里选择文件', 'or click to choose file')}</div>
                                <input type="file" id="comfyui-file-upload-hidden" accept=".json" style="display:none;">
                            </div>
                        </div>
                    </div>
                    
                    <!-- === 区段 A: 使用区 (Use Mode) === -->
                    <div id="comfyui-use-mode-section" class="comfyui-section" style="display:none;">
                        <div class="comfyui-section-title">${tc('comfyui.params.title', '参数配置', 'Parameters')}</div>
                        <div id="comfyui-dynamic-params" class="comfyui-dynamic-params">
                            <div class="comfyui-empty-params">
                                <span>🎛️</span>
                                <p>${tc('comfyui.params.empty', '暂无自定义参数', 'No custom parameters')}</p>
                                <small>${tc('comfyui.params.empty_hint', '请展开下方"编辑节点映射"，在节点卡片上点击 ➕ 设为参数', 'Expand "Edit Mapping" below and click ➕ on node cards to expose parameters')}</small>
                            </div>
                        </div>
                    </div>

                    <!-- === 区段 B: 配置区 (Config Mode) === -->
                    <div class="comfyui-config-toggle-wrap" id="comfyui-config-toggle-wrap" style="display:none;">
                        <button id="comfyui-config-toggle-btn" class="comfyui-config-toggle-btn">
                            <span class="toggle-icon">⚙️</span>
                            <span class="toggle-label">${tc('comfyui.mapping.title', '编辑节点映射', 'Edit Mapping')}</span>
                            <span class="toggle-arrow">▼</span>
                        </button>
                    </div>

                    <div id="comfyui-config-section" class="comfyui-config-section">
                        <div class="comfyui-row" style="margin-bottom:8px;">
                            <input id="comfyui-node-search" type="text" class="comfyui-input" placeholder="${tc('comfyui.node.search', '🔍 搜索节点名称/类型/ID', '🔍 Search node name/type/ID')}">
                        </div>
                        <div class="comfyui-node-list" id="comfyui-node-list"></div>
                        <div style="margin-top:8px; font-size:11px; color:var(--comfyui-text-muted); text-align:center;">
                            ${tc('comfyui.node.hint', '点击 ➕ 暴露参数到使用区 · 点击 🚩 设定输出节点', 'Click ➕ to expose params to use-mode · Click 🚩 to set output nodes')}
                        </div>
                    </div>


                    <div class="comfyui-status" id="comfyui-status" style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px;">${tc('comfyui.status.ready', '就绪', 'Ready')}</div>

                    <div class="comfyui-preview" id="comfyui-preview-box" style="display:none; margin-top:10px; text-align:center;">
                        <img id="comfyui-result-img" style="max-width:100%; max-height:200px; border-radius:4px; border:1px solid #444;">
                    </div>

                    <div class="comfyui-footer" style="padding:16px 0 0 0; margin-top: auto; border-top:1px solid rgba(255,255,255,0.08);">
                        <div class="comfyui-generate-actions">
                            <label class="comfyui-batch-label" for="comfyui-batch-count">${tc('comfyui.batch', '次数', 'Count')}</label>
                            <input id="comfyui-batch-count" type="number" class="comfyui-input comfyui-batch-input" min="1" max="99" step="1" value="1" title="${tc('comfyui.batch.title', '批量提交次数', 'Batch submission count')}">
                            <button id="comfyui-generate-btn" class="comfyui-btn comfyui-btn-primary comfyui-generate-main-btn" disabled>${tc('comfyui.generate_import', '生成并导入', 'Generate & Import')}</button>
                            <button id="comfyui-cancel-btn" class="comfyui-btn comfyui-btn-danger" disabled>${tc('comfyui.cancel', '取消任务', 'Cancel')}</button>
                        </div>
                    </div>
                </div>

                <!-- ModelScope Module -->
                <div id="module-modelscope" class="ai-module active" style="display:block; flex-direction:column; flex:1; overflow-y:auto;">
                    <!-- ModelScope Content will be injected here -->
                </div>

                <!-- Volcengine Module -->
                <div id="module-volcengine" class="ai-module" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding: 16px;">
                    <!-- Volcengine Content will be injected here -->
                </div>

                <!-- Coze Module -->
                <div id="module-coze" class="ai-module" style="display:none; flex-direction:column; flex:1; overflow-y:auto; padding: 16px;">
                    <!-- Coze Content will be injected here -->
                </div>
            </div>
        </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstElementChild);
        applyComfyPanelLanguage();

        // Bind Module Tabs
        const tabs = document.querySelectorAll('.ai-module-tab');
        const modules = document.querySelectorAll('.ai-module');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.module;

                // Update Tabs
                tabs.forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');

                // Update Modules
                modules.forEach(m => {
                    m.style.display = 'none';
                    m.classList.remove('active');
                });

                const targetModule = document.getElementById('module-' + target);
                if (targetModule) {
                    targetModule.style.display = (target === 'comfyui') ? 'flex' : 'block'; // Flex for comfyui to keep layout
                    targetModule.classList.add('active');
                }

                // Initialize ModelScope if needed
                if (target === 'modelscope' && window.ModelScopeManager && !window.ModelScopeManager.container) {
                    window.ModelScopeManager.init(document.getElementById('module-modelscope'));
                }

                // Initialize Volcengine if needed
                if (target === 'volcengine' && window.VolcengineManager && !window.VolcengineManager.container) {
                    window.VolcengineManager.init(document.getElementById('module-volcengine'));
                }

                // Initialize Coze if needed
                if (target === 'coze' && window.CozeManager && !window.CozeManager.container) {
                    window.CozeManager.init(document.getElementById('module-coze'));
                }
            });
        });

        if (window.ModelScopeManager && !window.ModelScopeManager.container) {
            const moduleEl = document.getElementById('module-modelscope');
            if (moduleEl) window.ModelScopeManager.init(moduleEl);
        }
    }

    // --- Workflow Management ---

    function handleWorkflowDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const zone = document.getElementById('comfyui-workflow-drop');
        if (zone) {
            zone.classList.remove('drag-over');
            const titleEl = zone.querySelector('.comfyui-drop-zone-title');
            const defaultTitle = zone.getAttribute('data-default-title') || tc('comfyui.workflow.drop', '拖入 .json 工作流文件', 'Drop .json workflow file');
            if (titleEl) titleEl.textContent = defaultTitle;
        }

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            saveWorkflowFile(files[0]);
        }
    }

    function handleWorkflowFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            saveWorkflowFile(file);
        }
    }

    function saveWorkflowFile(file) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            setStatusMessage(tc('comfyui.error.json_only', '错误: 仅支持 .json 文件', 'Error: only .json files are supported'));
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const content = e.target.result;
                const json = JSON.parse(content);
                const workflowFormat = getWorkflowFormatInfo(json);

                if (!workflowFormat.supported) {
                    notifyUser(
                        workflowFormat.message,
                        'warning',
                        workflowFormat.kind === 'ui_workflow'
                            ? tc('comfyui.workflow.format_warn', '工作流格式警告', 'Workflow Format Warning')
                            : tc('comfyui.workflow.format_unsupported', '工作流格式不支持', 'Workflow format unsupported')
                    );
                }

                const targetPath = fsHelper.join(workflowStorageDir, file.name);
                fsHelper.writeFileSync(targetPath, content);

                const savedMessage = workflowFormat.supported
                    ? tc('comfyui.workflow.saved', '工作流已保存: {name}', 'Workflow saved: {name}', { name: file.name })
                    : tc('comfyui.workflow.saved_pending', '工作流已保存（待转换）: {name}', 'Workflow saved (needs conversion): {name}', { name: file.name });
                setStatusMessage(savedMessage);
                refreshWorkflowList(targetPath);
            } catch (err) {
                const message = tc('comfyui.save_failed_detail', '保存失败: {msg}', 'Save failed: {msg}', { msg: err.message });
                setStatusMessage(message);
                notifyUser(err.message, 'error', tc('comfyui.save_failed', '保存失败', 'Save failed'));
                logParamMapping('保存工作流失败', err);
            }
        };
        reader.readAsText(file);
    }
    function handleDeleteWorkflow() {
        const sel = document.getElementById('comfyui-workflow-select');
        const filePath = sel.value;
        if (!filePath) return;

        const doDelete = () => {
            try {
                fsHelper.unlinkSync(filePath);
                statusDiv.textContent = tc('comfyui.workflow.deleted', '已删除工作流', 'Workflow deleted');
                refreshWorkflowList();
                document.getElementById('comfyui-use-mode-section').style.display = 'none';
                document.getElementById('comfyui-config-toggle-wrap').style.display = 'none';
                document.getElementById('comfyui-config-section').classList.remove('expanded');
                currentWorkflow = null;
                currentWorkflowPath = null;
                currentWorkflowFormat = { kind: 'unsupported', supported: false, message: '' };
                customParamConfig = [];
                customMappingGroups = [];
                outputNodeIds = [];
            } catch (e) {
                statusDiv.textContent = tc('comfyui.delete_failed_detail', '删除失败: {msg}', 'Delete failed: {msg}', { msg: e.message });
            }
        };

        if (typeof DialogManager !== 'undefined' && DialogManager.showConfirm) {
            DialogManager.showConfirm(
                tc('comfyui.workflow.delete_title', '删除工作流', 'Delete Workflow'),
                tc('comfyui.workflow.delete_confirm', '确定要删除此工作流吗?', 'Are you sure you want to delete this workflow?'),
                (confirmed) => {
                if (!confirmed) return;
                doDelete();
            });
        } else {
            if (confirm(tc('comfyui.workflow.delete_confirm', '确定要删除此工作流吗?', 'Are you sure you want to delete this workflow?'))) {
                doDelete();
            }
        }
    }

    function refreshWorkflowList(selectPath = null) {
        const sel = document.getElementById('comfyui-workflow-select');
        sel.innerHTML = `<option value="">${tc('comfyui.workflow.select_placeholder', '-- 请选择工作流 --', '-- Select workflow --')}</option>`;

        try {
            if (!fsHelper.existsSync(workflowStorageDir)) {
                fsHelper.mkdirSync(workflowStorageDir);
            }

            const files = fsHelper.readdirSync(workflowStorageDir).filter(f => f.toLowerCase().endsWith('.json'));

            if (files.length === 0) {
                const opt = document.createElement('option');
                opt.text = tc('comfyui.workflow.empty', '(暂无工作流，请拖入 JSON 文件)', '(No workflows. Please drop a JSON file)');
                sel.appendChild(opt);
            } else {
                files.forEach(f => {
                    const fullPath = fsHelper.join(workflowStorageDir, f);
                    const opt = document.createElement('option');
                    opt.value = fullPath;
                    let displayName = f.replace('.json', '');
                    try {
                        const fileContent = fsHelper.readFileSync(fullPath);
                        const formatInfo = getWorkflowFormatInfo(JSON.parse(fileContent));
                        if (!formatInfo.supported) displayName += ' [待转换]';
                    } catch (ex) {
                        displayName += ' [读取失败]';
                    }
                    opt.textContent = displayName;
                    if (selectPath && fullPath === selectPath) opt.selected = true;
                    sel.appendChild(opt);
                });
            }

            if (selectPath) {
                // Trigger load if we auto-selected
                handleWorkflowSelect({ target: { value: selectPath } });
            }
            bindSelectTitleSync(sel.parentElement || document);

        } catch (e) {
            statusDiv.textContent = "列表刷新失败: " + e.message;
            console.error(e);
        }
    }

    function handleWorkflowSelect(e) {
        const filePath = e.target.value;
        if (!filePath) return;

        try {
            const content = fsHelper.readFileSync(filePath);
            currentWorkflow = JSON.parse(content);
            currentWorkflowPath = filePath;
            currentWorkflowFormat = getWorkflowFormatInfo(currentWorkflow);

            customParamConfig = [];
            customMappingGroups = [];
            outputNodeIds = [];

            const workflowKey = "comfyui_mapping_" + fsHelper.basename(filePath);
            const savedMapping = localStorage.getItem(workflowKey);
            if (savedMapping) {
                try {
                    const map = JSON.parse(savedMapping);
                    if (map.customParams) customParamConfig = map.customParams;
                    if (map.customGroups) customMappingGroups = map.customGroups;
                    if (map.outputNodeIds) outputNodeIds = map.outputNodeIds;
                } catch (ex) {
                    logParamMapping('加载映射配置失败', ex);
                }
            }

            // Normalize saved mappings (media/transfer/input mode) across versions.
            if (Array.isArray(customParamConfig)) {
                customParamConfig.forEach(param => {
                    if (!param || typeof param !== 'object') return;
                    const node = getWorkflowNode(currentWorkflow, param.nodeId);
                    const nextMediaType = detectMediaType(param.key, node, null, param.rawType || '');
                    const nextTransferMode = detectInputTransferMode(param.key, node, null, param.rawType || '');
                    const isDirectoryParam = isDirectoryLikeParam(param.key, param.rawType || '') && nextTransferMode === 'path';
                    if (nextMediaType !== param.mediaType) {
                        param.mediaType = nextMediaType;
                    }
                    param.transferMode = nextTransferMode;

                    if (isDirectoryParam) {
                        param.inputMode = 'path';
                        param.fileSource = '';
                    } else if (nextMediaType && (!param.inputMode || param.inputMode === 'text')) {
                        param.inputMode = 'file';
                    } else if (!nextMediaType && (param.inputMode === 'file' || param.inputMode === 'path')) {
                        param.inputMode = 'text';
                    }

                    if (param.inputMode !== 'file') {
                        param.fileSource = '';
                    } else if (!param.fileSource) {
                        param.fileSource = 'file';
                    }
                });
            }

            updateWorkflowAvailability(currentWorkflowFormat);

            if (!currentWorkflowFormat.supported) {
                currentNodeList = [];
                renderNodeList(currentNodeList, '');
                renderUseModeParams(currentWorkflow);
                canGenerateWorkflow = false;
                refreshActionButtons();
                notifyUser(currentWorkflowFormat.message, 'warning', '工作流格式不支持');
                setStatusMessage(tc('comfyui.workflow.loaded_pending', '工作流已加载（待转换）: {name}', 'Workflow loaded (needs conversion): {name}', { name: fsHelper.basename(filePath) }));
                return;
            }

            parseNodes(currentWorkflow);
            renderUseModeParams(currentWorkflow);
            canGenerateWorkflow = true;
            refreshActionButtons();
            setStatusMessage(tc(
                'comfyui.workflow.loaded',
                '工作流已加载: {name}{suffix}',
                'Workflow loaded: {name}{suffix}',
                { name: fsHelper.basename(filePath), suffix: savedMapping ? tc('comfyui.workflow.loaded_config_suffix', ' (已加载配置)', ' (mapping loaded)') : '' }
            ));
        } catch (err) {
            currentWorkflowFormat = { kind: 'unsupported', supported: false, message: '' };
            canGenerateWorkflow = false;
            refreshActionButtons();
            setStatusMessage(tc('comfyui.load_failed_detail', '加载失败: {msg}', 'Load failed: {msg}', { msg: err.message }));
            logParamMapping('加载工作流失败', err);
        }
    }
    // --- Parameter Detection & UI ---

    function renderUseModeParams(workflow) {
        const container = document.getElementById('comfyui-dynamic-params');
        if (!container) return;
        container.innerHTML = '';

        const nodes = getWorkflowNodes(workflow);
        if (!nodes) {
            if (currentWorkflowFormat && !currentWorkflowFormat.supported) {
                renderUnsupportedWorkflowState(currentWorkflowFormat.message);
            } else {
                renderEmptyState(container, tc('comfyui.params.none', '暂无参数', 'No parameters'), tc('comfyui.params.none_hint', '在节点卡片上点击 ➕ 设为参数', 'Click ➕ on node cards to expose parameters'), '🎛️');
            }
            return;
        }

        const parts = [];
        const mappedLoraNameParams = customParamConfig
            .map((p, i) => ({ ...p, originalIndex: i }))
            .filter(p => p && p.key === 'lora_name');
        const mappedLoraNodeIds = new Set(mappedLoraNameParams.map(p => String(p.nodeId)));
        const isMappedLoraParam = (param) => {
            if (!param) return false;
            if (!mappedLoraNodeIds.has(String(param.nodeId))) return false;
            return param.key === 'lora_name';
        };

        if (mappedLoraNameParams.length > 0) {
            let loraHtml = `<div class="comfyui-param-group"><div class="comfyui-param-group-title">LoRA 模型</div>`;
            let loraRendered = 0;

            mappedLoraNameParams.forEach(param => {
                const node = getWorkflowNode(workflow, param.nodeId);
                if (!node || !node.inputs) return;

                const loraName = resolveParamValue(node, param);
                const strength = node.inputs.strength_model !== undefined
                    ? node.inputs.strength_model
                    : (node.inputs.strength_clip !== undefined ? node.inputs.strength_clip : 1.0);
                const mappedOptions = Array.isArray(param.options) ? param.options.map(item => String(item)) : [];
                const optionList = mappedOptions.length > 0 ? mappedOptions : loraList;

                let optionsHtml = `<option value="">-- 关闭 --</option>`;
                if (optionList.length > 0) {
                    optionsHtml += optionList.map(l => `<option value="${escapeHtml(l)}" ${l === loraName ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
                } else if (loraName) {
                    optionsHtml += `<option value="${escapeHtml(loraName)}" selected>${escapeHtml(loraName)}</option>`;
                }

                const displayLabel = normalizeCustomParamLabel(param.label, param.key);
                loraHtml += `<div style="margin-bottom:6px; background:rgba(0,0,0,0.15); padding:6px; border-radius:4px;">
                    <div class="comfyui-custom-param-head" style="margin-bottom:4px;">
                        <div class="comfyui-custom-param-title-wrap">
                            <span class="comfyui-param-label comfyui-custom-param-title">${escapeHtml(displayLabel)}</span>
                            <span class="comfyui-custom-param-meta">Node #${escapeHtml(param.nodeId)} / lora_name</span>
                        </div>
                        <div class="comfyui-custom-param-actions">
                            <button type="button" class="comfyui-btn-icon comfyui-remove-param-btn" data-idx="${param.originalIndex}" title="移除参数">移除</button>
                        </div>
                    </div>
                    <select class="comfyui-select comfyui-lora-select" data-node="${escapeHtml(param.nodeId)}" data-current="${escapeHtml(loraName || '')}">${optionsHtml}</select>
                    <div style="display:flex; align-items:center; gap:4px; margin-top:4px;">
                        <label class="comfyui-label" style="flex:0 0 auto;">强度:</label>
                        <input type="number" class="comfyui-input" step="0.05" min="0" max="2" value="${strength}" data-node="${escapeHtml(param.nodeId)}" data-type="strength">
                    </div>
                </div>`;
                loraRendered += 1;
            });

            loraHtml += `</div>`;
            if (loraRendered > 0) {
                parts.push(loraHtml);
            }
        }

        if (customParamConfig.length > 0) {
            const renderParam = (p, idx) => {
                const node = getWorkflowNode(workflow, p.nodeId);
                if (!node) return '';

                const value = resolveParamValue(node, p);
                const mediaType = p.mediaType || detectMediaType(p.key, node);
                const isDirectoryKey = isDirectoryLikeParam(p.key, p.rawType || '');
                const transferMode = isDirectoryKey ? 'path' : (p.transferMode || detectInputTransferMode(p.key, node));
                if (p.transferMode !== transferMode) p.transferMode = transferMode;
                const isDirectoryPathParam = isDirectoryKey && transferMode === 'path';
                const hasOptions = Array.isArray(p.options) && p.options.length > 0;
                const valueType = p.valueType || inferValueTypeFromValue(value) || (hasOptions ? 'enum' : 'string');
                let mode = p.inputMode || (mediaType ? 'file' : (hasOptions ? 'select' : 'text'));
                if (isDirectoryPathParam) mode = 'path';
                if (valueType === 'boolean') mode = 'boolean';
                if (valueType === 'number' && !mode) mode = 'number';

                let inputHtml = '';
                if (valueType === 'boolean') {
                    inputHtml = `<label class="comfyui-toggle-switch">
                        <input type="checkbox" class="comfyui-custom-param" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="boolean" ${coerceBooleanValue(value) ? 'checked' : ''}>
                        <span class="comfyui-toggle-slider"></span>
                        <span class="comfyui-toggle-label">${coerceBooleanValue(value) ? '开启' : '关闭'}</span>
                    </label>`;
                } else if (mode === 'slider' && valueType === 'number') {
                    const min = p.min !== undefined ? p.min : 0;
                    const max = p.max !== undefined ? p.max : 1;
                    const step = p.step !== undefined ? p.step : 0.01;
                    const safeVal = value !== undefined && value !== null ? Number(value) : min;
                    inputHtml = `<div class="comfyui-slider-container">
                        <input type="range" class="comfyui-slider-range comfyui-custom-param" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="number" min="${min}" max="${max}" step="${step}" value="${safeVal}">
                        <input type="number" class="comfyui-input comfyui-slider-input comfyui-custom-param" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="number" min="${min}" max="${max}" step="${step}" value="${safeVal}">
                    </div>`;
                } else if (mode === 'select' && hasOptions) {
                    const currentValue = value !== undefined && value !== null ? String(value) : '';
                    const opts = p.options.map(o => {
                        const optionValue = String(o);
                        return `<option value="${escapeHtml(optionValue)}" ${optionValue === currentValue ? 'selected' : ''}>${escapeHtml(optionValue)}</option>`;
                    }).join('');
                    inputHtml = `<select class="comfyui-select comfyui-custom-param" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="${escapeHtml(valueType)}">${opts}</select>`;
                } else if (isDirectoryPathParam) {
                    const currentPath = value !== undefined && value !== null ? String(value) : '';
                    inputHtml = `<div class="comfyui-custom-file-panel comfyui-custom-path-panel" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}">
                        <div class="comfyui-custom-file-toolbar">
                            <span class="comfyui-custom-file-caption">目录路径输入</span>
                            <div class="comfyui-custom-file-toolbar-right">
                                <button type="button" class="comfyui-btn-icon comfyui-custom-path-pick">选择目录</button>
                                <button type="button" class="comfyui-btn-icon comfyui-custom-path-clear">清空</button>
                            </div>
                        </div>
                        <div class="comfyui-custom-path-drop">
                            <input type="text" class="comfyui-input comfyui-custom-path-input" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" value="${escapeHtml(currentPath)}" placeholder="输入或拖入目录路径">
                        </div>
                        <div class="comfyui-custom-file-source-hint">该节点将处理此目录下的素材文件</div>
                    </div>`;
                } else if (mode === 'file' && mediaType) {
                    const accept = getMediaAccept(mediaType);
                    const sourceOptions = getCustomFileSourceOptions(mediaType);
                    const defaultSource = sourceOptions.some(option => option.value === p.fileSource) ? p.fileSource : 'file';
                    const sourceButtons = sourceOptions.map(option => {
                        const active = option.value === defaultSource ? 'active' : '';
                        return `<button type="button" class="comfyui-btn-icon comfyui-custom-source-btn ${active}" data-source="${option.value}" data-idx="${idx}">${option.label}</button>`;
                    }).join('');
                    const dropHint = `点击或拖入${getMediaDisplayName(mediaType)}文件`;
                    const transferHint = transferMode === 'path'
                        ? `已选择路径传输，生成时将传输本地${getMediaDisplayName(mediaType)}路径`
                        : getCustomFileSourceHint(defaultSource, mediaType);
                    const maskButtonHtml = mediaType === 'image'
                        ? `<button type="button" class="comfyui-btn-icon comfyui-custom-mask-btn" title="在图片上绘制遮罩">绘制遮罩</button>`
                        : '';
                    p.fileSource = defaultSource;
                    inputHtml = `<div class="comfyui-custom-file-panel" data-idx="${idx}" data-media="${escapeHtml(mediaType)}" data-source="${escapeHtml(defaultSource)}">
                        <div class="comfyui-custom-file-toolbar">
                            <span class="comfyui-custom-file-caption">${escapeHtml(getMediaDisplayName(mediaType))}输入</span>
                            <div class="comfyui-custom-file-toolbar-right">
                                ${sourceButtons}
                                ${maskButtonHtml}
                                <button type="button" class="comfyui-btn-icon comfyui-custom-file-clear" title="清空已选文件">清空</button>
                            </div>
                        </div>
                        <div class="comfyui-custom-file-drop" data-idx="${idx}" data-default-hint="${escapeHtml(dropHint)}">
                            <span class="comfyui-file-drop-hint">${escapeHtml(dropHint)}</span>
                            <span class="comfyui-custom-file-info"></span>
                        </div>
                        <div class="comfyui-custom-file-preview is-hidden">
                            <img class="comfyui-custom-file-preview-image" alt="" style="display:none;">
                            <audio class="comfyui-custom-file-preview-audio" style="display:none; width:100%;" controls></audio>
                            <video class="comfyui-custom-file-preview-video" style="display:none; width:100%; border-radius:6px;" controls></video>
                        </div>
                        <div class="comfyui-custom-file-source-hint">${escapeHtml(transferHint)}</div>
                        <input type="file" class="comfyui-custom-file" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-media="${escapeHtml(mediaType)}" accept="${accept}" style="display:none;">
                        <input type="hidden" class="comfyui-custom-source-path" value="">
                    </div>`;
                } else {
                    const safeVal = value !== undefined && value !== null ? escapeHtml(String(value)) : '';
                    const isPromptLike = isComfyPromptLikeParam(p, node, valueType, mode, hasOptions, isDirectoryPathParam, mediaType);
                    if (isPromptLike) {
                        const promptType = detectComfyPromptType(p, node);
                        inputHtml = `<div class="comfyui-prompt-editor" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-prompt-type="${escapeHtml(promptType)}">
                            <textarea class="comfyui-input comfyui-custom-param comfyui-custom-prompt" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="${escapeHtml(valueType)}" rows="3" placeholder="${escapeHtml(tc('comfyui.prompt.input_placeholder', '输入提示词...', 'Enter prompt...'))}">${safeVal}</textarea>
                            <div class="comfyui-prompt-actions">
                                <button type="button" class="comfyui-prompt-action-btn" data-action="angle" title="${escapeHtml(tc('comfyui.prompt.angle', '角度提示词', 'Angle Prompt'))}">🧭</button>
                                <button type="button" class="comfyui-prompt-action-btn" data-action="save" title="${escapeHtml(tc('comfyui.prompt.save_title', '保存提示词', 'Save Prompt'))}">💾</button>
                                <button type="button" class="comfyui-prompt-action-btn" data-action="load" title="${escapeHtml(tc('comfyui.prompt.load_title', '加载提示词', 'Load Prompt'))}">📂</button>
                                <button type="button" class="comfyui-prompt-action-btn" data-action="polish" title="${escapeHtml(tc('comfyui.prompt.polish', 'AI 润色', 'AI Polish'))}">🪄</button>
                            </div>
                        </div>`;
                    } else {
                        const inputType = valueType === 'number' ? 'number' : 'text';
                        inputHtml = `<input type="${inputType}" class="comfyui-input comfyui-custom-param" data-node="${escapeHtml(p.nodeId)}" data-key="${escapeHtml(p.key)}" data-value-type="${escapeHtml(valueType)}" value="${safeVal}" placeholder="${escapeHtml(p.key)}">`;
                    }
                }

                const displayLabel = normalizeCustomParamLabel(p.label, p.key);
                if (displayLabel !== p.label) p.label = displayLabel;
                if (isDirectoryPathParam) {
                    p.inputMode = 'path';
                    p.fileSource = '';
                }
                let modeHtml = '';
                if (!isDirectoryPathParam && (mediaType || hasOptions || valueType === 'number')) {
                    const modeOptions = [];
                    if (hasOptions) modeOptions.push({ v: 'select', t: tc('comfyui.mode.select', '下拉选项', 'Select options') });
                    if (mediaType) modeOptions.push({ v: 'file', t: tc('comfyui.mode.file', '文件输入', 'File input') });
                    if (valueType === 'number') {
                        modeOptions.push({ v: 'number', t: tc('comfyui.mode.number', '数字输入', 'Number input') });
                        modeOptions.push({ v: 'slider', t: tc('comfyui.mode.slider', '滑块控制', 'Slider control') });
                    }
                    if (modeOptions.length === 0) modeOptions.push({ v: 'text', t: tc('comfyui.mode.text', '文本输入', 'Text input') });

                    const modeOpts = modeOptions.map(o => `<option value="${o.v}" ${o.v === mode ? 'selected' : ''}>${o.t}</option>`).join('');
                    modeHtml = `<select class="comfyui-select comfyui-custom-mode" data-idx="${idx}">${modeOpts}</select>`;
                }

                return `<div class="comfyui-custom-param-row compact">
                    <div class="comfyui-custom-param-header-compact">
                        <span class="comfyui-param-label-compact" title="Node #${escapeHtml(p.nodeId)} / ${escapeHtml(p.key)}">${escapeHtml(displayLabel)}</span>
                        <div class="comfyui-custom-param-actions-compact">
                            ${modeHtml}
                            <button type="button" class="comfyui-btn-icon comfyui-edit-param-btn" data-idx="${idx}" title="设置">⚙</button>
                            <button type="button" class="comfyui-btn-icon comfyui-remove-param-btn" data-idx="${idx}" title="移除">×</button>
                        </div>
                    </div>
                    <div class="comfyui-custom-param-body-compact">
                        ${inputHtml}
                    </div>
                </div>`;
            };

            customMappingGroups.forEach(g => {
                const groupParams = customParamConfig
                    .map((p, i) => ({ ...p, originalIndex: i }))
                    .filter(p => p.groupId === g.id && !isMappedLoraParam(p));
                if (groupParams.length === 0) return;
                let gHtml = `<div class="comfyui-param-group">
                    <div class="comfyui-param-group-title comfyui-param-group-title-row">
                        <span>${escapeHtml(g.name)}</span>
                        <button type="button" class="comfyui-btn-icon comfyui-remove-group-btn" data-group-id="${escapeHtml(g.id)}" title="删除组">删除组</button>
                    </div>`;
                groupParams.forEach(p => { gHtml += renderParam(p, p.originalIndex); });
                gHtml += `</div>`;
                parts.push(gHtml);
            });

            const ungrouped = customParamConfig
                .map((p, i) => ({ ...p, originalIndex: i }))
                .filter(p => !p.groupId && !isMappedLoraParam(p));

            if (ungrouped.length > 0) {
                // Group by Node ID
                const nodeGroups = {};
                ungrouped.forEach(p => {
                    if (!nodeGroups[p.nodeId]) nodeGroups[p.nodeId] = [];
                    nodeGroups[p.nodeId].push(p);
                });

                // Render each node group
                Object.keys(nodeGroups).forEach(nodeId => {
                    const nodeParams = nodeGroups[nodeId];
                    const node = getWorkflowNode(workflow, nodeId);
                    const nodeTitle = getNodeDisplayName(node, nodeId);

                    let groupHtml = `<div class="comfyui-param-group comfyui-node-group">
                        <div class="comfyui-param-group-title comfyui-node-group-title">
                            <span class="comfyui-node-title-text">${escapeHtml(nodeTitle)}</span>
                            <span class="comfyui-node-id-tag">#${escapeHtml(nodeId)}</span>
                        </div>
                        <div class="comfyui-node-group-content">`;

                    nodeParams.forEach(p => {
                        groupHtml += renderParam(p, p.originalIndex);
                    });

                    groupHtml += `</div></div>`;
                    parts.push(groupHtml);
                });
            }
        }

        if (parts.length > 0) {
            container.innerHTML = parts.join('');
        } else {
            renderEmptyState(container, tc('comfyui.params.none', '暂无参数', 'No parameters'), tc('comfyui.params.none_hint', '在节点卡片上点击 ➕ 设为参数', 'Click ➕ on node cards to expose parameters'), '🎛️');
        }
        bindSelectTitleSync(container);

        container.querySelectorAll('.comfyui-lora-select').forEach(el => {
            el.addEventListener('change', (e) => {
                const nodeId = e.target.getAttribute('data-node');
                updateCurrentWorkflowInput(nodeId, 'lora_name', e.target.value);
            });
        });

        container.querySelectorAll('input[data-type="strength"]').forEach(el => {
            el.addEventListener('change', (e) => {
                const nodeId = e.target.getAttribute('data-node');
                const val = parseFloat(e.target.value);
                const node = getWorkflowNode(currentWorkflow, nodeId);
                if (!node || !node.inputs) {
                    notifyUser(`参数写回失败: 节点 #${nodeId} 不存在`, 'error', '配置失效');
                    return;
                }

                let updated = false;
                if (node.inputs.strength_model !== undefined) {
                    setWorkflowNodeInput(currentWorkflow, nodeId, 'strength_model', val);
                    updated = true;
                }
                if (node.inputs.strength_clip !== undefined) {
                    setWorkflowNodeInput(currentWorkflow, nodeId, 'strength_clip', val);
                    updated = true;
                }
                if (updated) scheduleSaveWorkflow();
            });
        });

        container.querySelectorAll('.comfyui-custom-mode').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                if (!isNaN(idx) && customParamConfig[idx]) {
                    customParamConfig[idx].inputMode = e.target.value;
                    renderUseModeParams(currentWorkflow);
                    saveMappingConfig();
                }
            });
        });

        container.querySelectorAll('.comfyui-custom-param').forEach(el => {
            const nodeId = el.getAttribute('data-node');
            const key = el.getAttribute('data-key');
            const valueType = el.getAttribute('data-value-type') || '';
            const param = customParamConfig.find(p => String(p.nodeId) === nodeId && p.key === key);

            // Apply scrubbable to number inputs (excluding sliders ranges)
            if ((valueType === 'number' || el.type === 'number') && !el.classList.contains('comfyui-slider-range')) {
                const step = (param && param.step !== undefined) ? param.step : (el.step ? parseFloat(el.step) : (valueType === 'number' ? 0.01 : 1));
                makeComfyNumericScrubbable(el, { step: step, sensitivity: 0.5 });
            }

            el.addEventListener('input', (e) => {
                const nodeId = e.target.getAttribute('data-node');
                const key = e.target.getAttribute('data-key');
                const valueType = e.target.getAttribute('data-value-type') || '';

                // Sync slider inputs
                if (el.classList.contains('comfyui-slider-range') || el.classList.contains('comfyui-slider-input')) {
                    const parent = el.closest('.comfyui-slider-container');
                    if (parent) {
                        const range = parent.querySelector('.comfyui-slider-range');
                        const number = parent.querySelector('.comfyui-slider-input');
                        if (range && number && e.target === range) number.value = range.value;
                        if (range && number && e.target === number) range.value = number.value;
                    }
                }

                let val = e.target.value;
                if (e.target.type === 'checkbox') {
                    val = e.target.checked;
                    const label = e.target.parentElement ? e.target.parentElement.querySelector('.comfyui-toggle-label') : null;
                    if (label) label.textContent = val ? '开启' : '关闭';
                } else if (valueType === 'number' || e.target.type === 'number' || e.target.type === 'range') {
                    val = e.target.value === '' ? '' : Number(e.target.value);
                }
                updateCurrentWorkflowInput(nodeId, key, val);
            });
        });

        container.querySelectorAll('.comfyui-prompt-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const editor = btn.closest('.comfyui-prompt-editor');
                if (!editor) return;
                const fieldEl = editor.querySelector('.comfyui-custom-prompt');
                if (!fieldEl) return;
                const promptType = editor.getAttribute('data-prompt-type') || 'prompt';

                if (action === 'save') {
                    openComfyPromptSaveModal(fieldEl, promptType);
                    return;
                }
                if (action === 'load') {
                    openComfyPromptLoadModal(fieldEl, promptType);
                    return;
                }
                if (action === 'angle') {
                    openComfyAnglePromptModal(fieldEl);
                    return;
                }
                if (action === 'polish') {
                    await polishComfyPromptField(fieldEl, promptType === 'negative', btn);
                }
            });
        });

        container.querySelectorAll('.comfyui-edit-param-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (isNaN(idx)) return;
                showCustomParamSettings(idx);
            });
        });

        container.querySelectorAll('.comfyui-custom-file-panel').forEach(panelEl => {
            const idx = parseInt(panelEl.getAttribute('data-idx'), 10);
            const mediaType = panelEl.getAttribute('data-media') || 'image';
            const drop = panelEl.querySelector('.comfyui-custom-file-drop');
            const fileInput = panelEl.querySelector('.comfyui-custom-file');
            const info = panelEl.querySelector('.comfyui-custom-file-info');
            const hint = panelEl.querySelector('.comfyui-file-drop-hint');
            const sourceHint = panelEl.querySelector('.comfyui-custom-file-source-hint');
            const sourceButtons = panelEl.querySelectorAll('.comfyui-custom-source-btn');
            const clearBtn = panelEl.querySelector('.comfyui-custom-file-clear');
            const maskBtn = panelEl.querySelector('.comfyui-custom-mask-btn');
            const sourcePathInput = panelEl.querySelector('.comfyui-custom-source-path');
            const previewWrap = panelEl.querySelector('.comfyui-custom-file-preview');
            const previewImg = panelEl.querySelector('.comfyui-custom-file-preview-image');
            const previewAudio = panelEl.querySelector('.comfyui-custom-file-preview-audio');
            const previewVideo = panelEl.querySelector('.comfyui-custom-file-preview-video');
            if (!fileInput || !drop) return;

            const defaultHint = drop.getAttribute('data-default-hint') || `点击或拖入${getMediaDisplayName(mediaType)}文件`;
            let previewUrl = null;

            const cleanupPreviewUrl = () => {
                if (previewUrl) {
                    try { URL.revokeObjectURL(previewUrl); } catch (e) { }
                    previewUrl = null;
                }
            };

            const hidePreview = () => {
                cleanupPreviewUrl();
                if (previewImg) {
                    previewImg.style.display = 'none';
                    previewImg.src = '';
                }
                if (previewAudio) {
                    previewAudio.style.display = 'none';
                    previewAudio.src = '';
                }
                if (previewVideo) {
                    previewVideo.style.display = 'none';
                    previewVideo.src = '';
                }
                if (previewWrap) previewWrap.classList.add('is-hidden');
            };

            const getPathKind = (pathValue) => {
                const lower = String(pathValue || '').toLowerCase();
                if (/\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(lower)) return 'audio';
                if (/\.(mp4|mov|webm|mkv|avi|gif)$/i.test(lower)) return 'video';
                if (/\.(png|jpg|jpeg|webp|gif|bmp|tif|tiff)$/i.test(lower)) return 'image';
                return mediaType;
            };

            const showPreview = (url, kind) => {
                if (!previewWrap) return;
                hidePreview();
                if (!url) return;
                if (kind === 'audio') {
                    if (previewAudio) {
                        previewAudio.src = url;
                        previewAudio.style.display = 'block';
                    }
                } else if (kind === 'video') {
                    if (previewVideo) {
                        previewVideo.src = url;
                        previewVideo.style.display = 'block';
                    }
                } else {
                    if (previewImg) {
                        previewImg.src = url;
                        previewImg.style.display = 'block';
                    }
                }
                previewWrap.classList.remove('is-hidden');
            };

            const getSource = () => panelEl.getAttribute('data-source') || 'file';
            const getSourcePath = () => sourcePathInput ? sourcePathInput.value : '';
            const panelTransferMode = (!isNaN(idx) && customParamConfig[idx] && customParamConfig[idx].transferMode)
                ? customParamConfig[idx].transferMode
                : 'upload';
            const getPanelSourceHint = (source) => {
                if (panelTransferMode === 'path') {
                    return `已选择路径传输，生成时将传输本地${getMediaDisplayName(mediaType)}路径`;
                }
                return getCustomFileSourceHint(source, mediaType);
            };
            const detectFileKind = (fileObj) => {
                const mime = (fileObj && fileObj.type ? fileObj.type : '').toLowerCase();
                const lowerName = String(fileObj && fileObj.name ? fileObj.name : '').toLowerCase();
                return mime.startsWith('audio/')
                    ? 'audio'
                    : mime.startsWith('video/')
                        ? 'video'
                        : /\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(lowerName)
                            ? 'audio'
                            : /\.(mp4|mov|webm|mkv|avi|gif)$/i.test(lowerName)
                                ? 'video'
                                : 'image';
            };
            const showPreviewFromPath = (localPath, kind = '') => {
                if (!localPath) {
                    hidePreview();
                    return;
                }
                const resolvedKind = kind || getPathKind(localPath);
                const pathUrl = `${pathToFileUrl(localPath)}?t=${Date.now()}`;
                showPreview(pathUrl, resolvedKind);
            };

            const persistSource = (source) => {
                if (!isNaN(idx) && customParamConfig[idx]) {
                    customParamConfig[idx].fileSource = source;
                }
            };

            const setSource = (source, save = false) => {
                panelEl.setAttribute('data-source', source);
                panelEl.classList.toggle('source-file', source === 'file');
                panelEl.classList.toggle('source-layer', source === 'layer');
                panelEl.classList.toggle('source-frame', source === 'frame');
                sourceButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-source') === source);
                });
                drop.classList.toggle('is-hidden', source !== 'file');
                if (sourceHint) sourceHint.textContent = getPanelSourceHint(source);
                persistSource(source);
                if (source === 'file' && sourcePathInput) {
                    sourcePathInput.value = '';
                }
                if (save) saveMappingConfig();
            };
            const resolveMaskSourceDescriptor = async () => {
                const source = getSource();
                if (source === 'file') {
                    const selectedFile = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
                    const fallbackPath = (sourcePathInput && sourcePathInput.value) || (fileInput.dataset ? fileInput.dataset.localPath || '' : '');
                    return resolveMaskEditorImageSource(selectedFile, fallbackPath);
                }
                if (source === 'layer') {
                    let localPath = getSourcePath();
                    if (!localPath) {
                        statusDiv.textContent = '正在读取 AE 选中图层...';
                        const res = await evalScript('getSelectedLayerSource()');
                        const obj = JSON.parse(res);
                        if (obj.error) throw new Error(obj.error);
                        localPath = obj.path;
                    }
                    return resolveMaskEditorImageSource(null, localPath);
                }
                if (source === 'frame') {
                    let framePath = getSourcePath();
                    if (!framePath) {
                        statusDiv.textContent = '正在截取 AE 当前画面...';
                        framePath = await captureCurrentAeFramePath();
                    }
                    return resolveMaskEditorImageSource(null, framePath);
                }
                throw new Error('当前来源不支持遮罩绘制');
            };
            const applyMaskResultToPanel = async (maskResult, sourceLabel = '') => {
                if (!maskResult) return;
                const nodeId = fileInput.getAttribute('data-node') || 'node';
                const key = fileInput.getAttribute('data-key') || 'image';
                const keyLower = String(key || '').toLowerCase();
                const mappedNode = (!isNaN(idx) && customParamConfig[idx])
                    ? getWorkflowNode(currentWorkflow, customParamConfig[idx].nodeId)
                    : null;
                const nodeType = mappedNode && mappedNode.class_type ? String(mappedNode.class_type) : '';
                const maskOnly = keyLower.includes('mask') || /LoadImageMask/i.test(nodeType);
                const payloadBlob = maskOnly
                    ? (maskResult.maskBlob || maskResult.imageBlob)
                    : (maskResult.imageBlob || maskResult.maskBlob);
                if (!payloadBlob) throw new Error('遮罩导出失败');
                const fallbackName = `${sourceLabel || nodeId}_${key}`;
                const applyRes = await applyMaskBlobToFileInput(fileInput, payloadBlob, fallbackName);
                setSource('file', true);
                if (sourcePathInput) {
                    sourcePathInput.value = applyRes.mode === 'path' ? (applyRes.path || '') : '';
                }
                if (panelEl.dataset) {
                    panelEl.dataset.maskDataUrl = maskResult.editorMaskDataUrl || maskResult.maskDataUrl || '';
                    panelEl.dataset.maskSettings = JSON.stringify(maskResult.settings || {});
                }
                if (applyRes.mode === 'file' && fileInput.files && fileInput.files.length > 0) {
                    cleanupPreviewUrl();
                    const fileObj = fileInput.files[0];
                    const nextPreviewUrl = URL.createObjectURL(fileObj);
                    showPreview(nextPreviewUrl, detectFileKind(fileObj));
                    previewUrl = nextPreviewUrl;
                } else if (applyRes.path) {
                    showPreviewFromPath(applyRes.path, 'image');
                } else {
                    hidePreview();
                }
                updateInfoState();
                statusDiv.textContent = '遮罩已更新，可直接生成';
            };

            const updateInfoState = () => {
                const source = getSource();
                const hasFile = !!(fileInput.files && fileInput.files.length > 0);
                const sourcePath = getSourcePath();
                const hasPathFallback = source === 'file' && !!sourcePath;
                const hasMedia = source === 'file' ? (hasFile || hasPathFallback) : !!sourcePath;
                panelEl.classList.toggle('has-file', hasMedia);
                if (info) {
                    if (source === 'file') {
                        info.textContent = hasFile
                            ? fileInput.files[0].name
                            : (hasPathFallback ? fsHelper.basename(sourcePath) : '');
                    } else {
                        info.textContent = sourcePath ? fsHelper.basename(sourcePath) : '';
                    }
                    info.classList.toggle('has-file', hasMedia);
                }
                if (hint) {
                    if (source === 'file') {
                        hint.textContent = hasMedia ? tc('comfyui.file.ready', '文件已就绪，可直接生成', 'File ready, you can generate now') : defaultHint;
                    } else if (source === 'frame') {
                        hint.textContent = sourcePath
                            ? tc('comfyui.file.frame_ready', '已截取 AE 当前画面', 'AE current frame captured')
                            : tc('comfyui.file.frame_pick', '点击 AE当前画面 获取截图', 'Click AE Current Frame to capture');
                    } else {
                        hint.textContent = sourcePath
                            ? tc('comfyui.file.layer_ready', '已绑定 AE 选中图层', 'AE selected layer linked')
                            : tc('comfyui.file.layer_pick', '点击 AE选中图层 获取素材', 'Click AE Selected Layer to get source');
                    }
                }
                if (clearBtn) clearBtn.style.display = hasMedia ? 'inline-flex' : 'none';
            };

            drop.addEventListener('click', () => {
                setSource('file', true);
                fileInput.click();
            });

            drop.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setSource('file', false);
                drop.classList.add('drag-over');
                panelEl.classList.add('drag-over');
                if (hint) hint.textContent = tc('comfyui.file.release_upload', '松开以上传文件', 'Release to upload file');
            });

            drop.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                drop.classList.remove('drag-over');
                panelEl.classList.remove('drag-over');
                updateInfoState();
            });

            drop.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setSource('file', true);
                if (sourcePathInput) sourcePathInput.value = '';
                drop.classList.remove('drag-over');
                panelEl.classList.remove('drag-over');
                const droppedPath = extractLocalPathFromDataTransfer(e.dataTransfer);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    try {
                        fileInput.files = e.dataTransfer.files;
                    } catch (assignError) {
                        console.warn('拖拽文件赋值失败，改用路径模式', assignError);
                    }
                }
                const file = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
                const filePath = getLocalPathFromFile(file) || droppedPath;
                const fallbackToPath = filePath && (!file || !hasUsableFileBytes(file));

                if (fallbackToPath) {
                    if (sourcePathInput) sourcePathInput.value = filePath;
                    showPreviewFromPath(filePath);
                } else if (file) {
                    cleanupPreviewUrl();
                    const nextPreviewUrl = URL.createObjectURL(file);
                    showPreview(nextPreviewUrl, detectFileKind(file));
                    previewUrl = nextPreviewUrl;
                } else if (filePath) {
                    if (sourcePathInput) sourcePathInput.value = filePath;
                    showPreviewFromPath(filePath);
                } else {
                    hidePreview();
                }
                if (panelEl.dataset) panelEl.dataset.maskDataUrl = '';
                updateInfoState();
            });

            fileInput.addEventListener('change', () => {
                const source = getSource();
                if (source !== 'file') setSource('file', true);
                if (sourcePathInput) sourcePathInput.value = '';
                if (fileInput.files && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const filePath = getLocalPathFromFile(file);
                    if (filePath && !hasUsableFileBytes(file)) {
                        if (sourcePathInput) sourcePathInput.value = filePath;
                        showPreviewFromPath(filePath);
                    } else {
                        cleanupPreviewUrl();
                        const nextPreviewUrl = URL.createObjectURL(file);
                        showPreview(nextPreviewUrl, detectFileKind(file));
                        previewUrl = nextPreviewUrl;
                    }
                } else {
                    hidePreview();
                }
                if (panelEl.dataset) panelEl.dataset.maskDataUrl = '';
                updateInfoState();
            });

            sourceButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const source = btn.getAttribute('data-source');
                    if (!source) return;

                    if (source === 'file') {
                        setSource('file', true);
                        updateInfoState();
                        return;
                    }

                    try {
                        let localPath = '';
                        if (source === 'layer') {
                            statusDiv.textContent = '正在读取 AE 选中图层...';
                            const res = await evalScript('getSelectedLayerSource()');
                            const obj = JSON.parse(res);
                            if (obj.error) throw new Error(obj.error);
                            localPath = obj.path;
                        } else if (source === 'frame') {
                            statusDiv.textContent = '正在截取 AE 当前画面...';
                            localPath = await captureCurrentAeFramePath();
                        }

                        if (!localPath) throw new Error('未获取到可用文件');
                        setSource(source, true);
                        fileInput.value = '';
                        if (sourcePathInput) sourcePathInput.value = localPath;
                        const kind = source === 'frame' ? 'image' : getPathKind(localPath);
                        showPreviewFromPath(localPath, kind);
                        updateInfoState();
                        statusDiv.textContent = source === 'frame' ? '已更新 AE 当前画面截图' : '已绑定 AE 选中图层文件';
                    } catch (err) {
                        notifyUser(`获取 AE 输入失败: ${err.message}`, 'error', '读取失败');
                    }
                });
            });

            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSource('file', true);
                    if (sourcePathInput) sourcePathInput.value = '';
                    fileInput.value = '';
                    if (fileInput.dataset) fileInput.dataset.localPath = '';
                    if (panelEl.dataset) panelEl.dataset.maskDataUrl = '';
                    hidePreview();
                    updateInfoState();
                });
            }

            if (maskBtn && mediaType === 'image') {
                maskBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    let imageSource = null;
                    try {
                        imageSource = await resolveMaskSourceDescriptor();
                        const initialMaskDataUrl = panelEl.dataset ? (panelEl.dataset.maskDataUrl || '') : '';
                        const maskResult = await openComfyMaskEditor({
                            sourceUrl: imageSource.sourceUrl,
                            sourceName: imageSource.sourceName || '图片遮罩',
                            title: '绘制遮罩',
                            initialMaskDataUrl
                        });
                        if (!maskResult) return;
                        await applyMaskResultToPanel(maskResult, imageSource.sourceName || '');
                    } catch (err) {
                        notifyUser(`遮罩绘制失败: ${err.message}`, 'error', '遮罩失败');
                    } finally {
                        if (imageSource && typeof imageSource.cleanup === 'function') {
                            imageSource.cleanup();
                        }
                    }
                });
            }

            const configSource = !isNaN(idx) && customParamConfig[idx] ? customParamConfig[idx].fileSource : '';
            const initialSource = panelEl.getAttribute('data-source') || configSource || 'file';
            setSource(initialSource, false);
            hidePreview();
            updateInfoState();
        });

        container.querySelectorAll('.comfyui-custom-path-panel').forEach(panelEl => {
            const nodeId = panelEl.getAttribute('data-node');
            const key = panelEl.getAttribute('data-key');
            const inputEl = panelEl.querySelector('.comfyui-custom-path-input');
            const pickBtn = panelEl.querySelector('.comfyui-custom-path-pick');
            const clearBtn = panelEl.querySelector('.comfyui-custom-path-clear');
            const dropEl = panelEl.querySelector('.comfyui-custom-path-drop');
            if (!inputEl || !nodeId || !key) return;

            const writeValue = (rawValue, save = true) => {
                const normalized = normalizePathForNodeInput(rawValue, key);
                inputEl.value = normalized;
                updateCurrentWorkflowInput(nodeId, key, normalized);
                if (save) saveMappingConfig();
            };

            inputEl.addEventListener('change', () => writeValue(inputEl.value, true));
            inputEl.addEventListener('blur', () => writeValue(inputEl.value, false));

            if (pickBtn) {
                pickBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        const folderPath = await evalScript('selectFolder()');
                        if (!folderPath || folderPath === 'null' || folderPath === 'undefined') return;
                        writeValue(folderPath, true);
                    } catch (err) {
                        notifyUser(`选择目录失败: ${err.message}`, 'error', '路径选择失败');
                    }
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    inputEl.value = '';
                    updateCurrentWorkflowInput(nodeId, key, '');
                    saveMappingConfig();
                });
            }

            if (dropEl) {
                dropEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropEl.classList.add('drag-over');
                });
                dropEl.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropEl.classList.remove('drag-over');
                });
                dropEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropEl.classList.remove('drag-over');
                    const droppedPath = extractLocalPathFromDataTransfer(e.dataTransfer);
                    if (!droppedPath) return;
                    writeValue(droppedPath, true);
                });
            }
        });

        container.querySelectorAll('.comfyui-remove-param-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                removeCustomParam(idx);
            });
        });

        container.querySelectorAll('.comfyui-remove-group-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const gid = btn.getAttribute('data-group-id');
                window.removeCustomGroup(gid);
            });
        });
    }
    async function fetchLoraList() {
        if (!comfyUiUrl) return;
        try {
            const url = `${comfyUiUrl}/object_info/LoraLoader`;
            const res = await fetch(url).then(r => r.json());
            if (res && res.LoraLoader && res.LoraLoader.input && res.LoraLoader.input.required && res.LoraLoader.input.required.lora_name) {
                const list = res.LoraLoader.input.required.lora_name[0];
                if (Array.isArray(list)) {
                    loraList = list;
                    // Update existing dropdowns if any
                    document.querySelectorAll('.comfyui-lora-select').forEach(sel => {
                        const current = sel.value;
                        sel.innerHTML = `<option value="">-- 关闭 (Disable) --</option>` +
                            loraList.map(l => `<option value="${l}" ${l === current ? 'selected' : ''}>${l}</option>`).join('');
                    });
                }
            }
        } catch (e) {
            console.error("Failed to fetch LoRA list", e);
        }
    }

    async function getConfiguredSaveDir() {
        if (typeof window.getAIGenerateGlobalPath === 'function') {
            try {
                return await window.getAIGenerateGlobalPath('ComfyUI_Output');
            } catch (e) {
                console.error('getAIGenerateGlobalPath error:', e);
            }
        }
        const parseStoredValue = (raw, fallback) => {
            if (raw == null || raw === '') return fallback;
            if (typeof raw !== 'string') return String(raw);
            try { return JSON.parse(raw); } catch (_) { return raw; }
        };
        const normalizeSaveLocation = (v) => {
            const loc = String(v || '').trim();
            if (!loc) return 'documents';
            if (loc === 'project') return 'projectFile';
            return loc;
        };
        const normalizePath = (v) => String(v || '').trim().replace(/^["']|["']$/g, '');
        const joinOut = (base) => {
            const b = normalizePath(base);
            if (!b) return '';
            if (path) return path.join(b, 'ComfyUI_Output');
            return (b.replace(/[\\\/]+$/, '') + '/ComfyUI_Output').replace(/\//g, '\\');
        };
        const ensureDir = (dir) => {
            if (!dir) return '';
            try {
                if (fsHelper && typeof fsHelper.mkdirSync === 'function') fsHelper.mkdirSync(dir);
                else if (fs && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                else if (cepFs) {
                    const statRes = cepFs.stat(dir);
                    if (!statRes || statRes.err !== 0) cepFs.makedir(dir);
                }
            } catch (_) { }
            return dir;
        };
        const getSystemPathSafe = (key) => {
            try {
                if (csInterface && typeof csInterface.getSystemPath === 'function' && typeof SystemPath !== 'undefined' && SystemPath[key]) {
                    return normalizePath(csInterface.getSystemPath(SystemPath[key]));
                }
            } catch (_) { }
            return '';
        };
        const getProjectDir = () => new Promise((resolve) => {
            try {
                if (!csInterface || typeof csInterface.evalScript !== 'function') return resolve('');
                csInterface.evalScript('app.project && app.project.file ? app.project.file.parent.fsName : ""', (res) => {
                    resolve(normalizePath(res));
                });
            } catch (_) { resolve(''); }
        });

        let saveLoc = '';
        let customPath = '';
        try {
            const cache = window.SettingsPersistenceComplete && window.SettingsPersistenceComplete.settingsCache
                ? window.SettingsPersistenceComplete.settingsCache
                : null;
            if (cache) {
                saveLoc = cache.imageSaveLocation || '';
                customPath = cache.customLocationPath || cache.imageCustomPath || '';
            }
        } catch (_) { }
        if (!saveLoc) {
            try { saveLoc = parseStoredValue(localStorage.getItem('mogu_image_save_path'), 'documents'); } catch (_) { saveLoc = 'documents'; }
        }
        if (!customPath) {
            try { customPath = parseStoredValue(localStorage.getItem('mogu_image_custom_path'), ''); } catch (_) { customPath = ''; }
        }
        saveLoc = normalizeSaveLocation(saveLoc);
        customPath = normalizePath(customPath);

        if (saveLoc === 'custom' && customPath) {
            const out = joinOut(customPath);
            if (out) return ensureDir(out);
        }
        if (saveLoc === 'desktop') {
            const out = joinOut(getSystemPathSafe('DESKTOP'));
            if (out) return ensureDir(out);
        }
        if (saveLoc === 'projectFile') {
            const out = joinOut(await getProjectDir());
            if (out) return ensureDir(out);
        }

        const docsOut = joinOut(getSystemPathSafe('MY_DOCUMENTS'));
        if (docsOut) return ensureDir(docsOut);
        if (os && typeof os.homedir === 'function') {
            const homeDocs = path ? path.join(os.homedir(), 'Documents') : (os.homedir() + '\\Documents');
            const out = joinOut(homeDocs);
            if (out) return ensureDir(out);
        }
        return ensureDir('C:\\Users\\Public\\Documents\\ComfyUI_Output');
    }

    async function checkComfyUIStatus() {
        const lines = [];
        lines.push(fsHelper.existsSync(workflowStorageDir) ? "工作流目录: 正常" : "工作流目录: 未创建");

        try {
            const url = (comfyUiUrl || "").replace(/\/$/, '');
            if (!url) {
                lines.push("ComfyUI: 地址为空");
            } else {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(url + "/system_stats", { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                    lines.push("ComfyUI: 在线");
                    fetchLoraList(); // Refresh LoRAs
                } else {
                    lines.push("ComfyUI: 无响应");
                }
            }
        } catch (e) {
            lines.push("ComfyUI: 无响应");
        }
        statusDiv.textContent = lines.join("\n");
    }

    function createComfyCancelError(message = '任务已取消') {
        const err = new Error(message);
        err.code = 'COMFYUI_CANCELLED';
        return err;
    }

    function isComfyCancelError(err) {
        return !!(err && (err.code === 'COMFYUI_CANCELLED' || err.message === '任务已取消'));
    }

    function ensureComfyNotCancelled() {
        if (cancelRequested) {
            throw createComfyCancelError();
        }
    }

    function getBatchSubmitCount(rawValue) {
        const parsed = parseInt(rawValue, 10);
        if (isNaN(parsed)) return 1;
        return Math.max(1, Math.min(99, parsed));
    }

    function makeComfyNumericScrubbable(input, options = {}) {
        if (!input) return;
        const step = typeof options.step === 'number' ? options.step : 1;
        const sensitivity = typeof options.sensitivity === 'number' ? options.sensitivity : 0.5;
        input.classList.add('comfyui-scrubbable');

        // Determine precision
        const stepStr = String(step);
        const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;

        let startX = 0;
        let startValue = 0;
        let dragging = false;

        const onMouseDown = (e) => {
            if (e.button !== 0) return; // Only left click
            startX = e.clientX;
            startValue = parseFloat(input.value || '0');
            if (isNaN(startValue)) startValue = 0;
            dragging = false;

            const onMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                if (!dragging && Math.abs(deltaX) > 3) {
                    dragging = true;
                    document.body.style.cursor = 'ew-resize';
                    input.style.cursor = 'ew-resize';
                }
                if (!dragging) return;

                moveEvent.preventDefault(); // Prevent text selection

                // Calculate change
                // If step is small (float), we want raw pixel change * sensitivity * scale
                // If sensitivity is 0.5, 2 pixels = 1 step unit?

                const rawChange = deltaX * sensitivity;
                const quantized = Math.round(rawChange);
                let next = startValue + (quantized * step);

                const min = parseFloat(input.min !== '' ? input.min : '');
                const max = parseFloat(input.max !== '' ? input.max : '');
                if (!isNaN(min)) next = Math.max(min, next);
                if (!isNaN(max)) next = Math.min(max, next);

                input.value = decimals > 0 ? next.toFixed(decimals) : String(Math.round(next));
                input.dispatchEvent(new Event('change'));
                input.dispatchEvent(new Event('input'));
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                input.style.cursor = '';
                if (!dragging) {
                    input.focus();
                } else {
                    input.blur(); // Remove focus after drag to avoid keyboard popup on touch/conflict
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        input.addEventListener('mousedown', onMouseDown);
    }

    function refreshActionButtons() {
        if (generateBtn) {
            generateBtn.disabled = isGenerating || !canGenerateWorkflow;
        }
        if (cancelBtn) {
            cancelBtn.disabled = !isGenerating;
        }
        if (batchCountInput) {
            batchCountInput.disabled = isGenerating;
        }
    }

    async function requestQueueDelete(promptId) {
        if (!promptId) return false;
        try {
            const res = await fetch(`${comfyUiUrl}/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delete: [promptId] })
            });
            return !!res.ok;
        } catch (e) {
            console.warn('Failed to delete queued prompt', e);
            return false;
        }
    }

    async function requestInterrupt(promptId) {
        try {
            const withPromptRes = await fetch(`${comfyUiUrl}/interrupt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: promptId ? JSON.stringify({ prompt_id: promptId }) : undefined
            });
            if (withPromptRes.ok) return true;
        } catch (e) {
            console.warn('Interrupt request with prompt_id failed', e);
        }

        try {
            const fallbackRes = await fetch(`${comfyUiUrl}/interrupt`, { method: 'POST' });
            return !!fallbackRes.ok;
        } catch (e) {
            console.warn('Interrupt fallback request failed', e);
            return false;
        }
    }

    async function cancelPromptById(promptId) {
        const tasks = [];
        if (promptId) {
            tasks.push(requestQueueDelete(promptId));
        }
        tasks.push(requestInterrupt(promptId));
        await Promise.all(tasks);
    }

    function handleCancelGenerate() {
        if (!isGenerating) return;
        cancelRequested = true;
        statusDiv.textContent = "正在取消任务...";
        if (typeof activeWaitAbort === 'function') {
            try {
                activeWaitAbort();
            } catch (_) { }
        }
        if (activePromptId) {
            cancelPromptById(activePromptId).catch((err) => {
                console.warn('Cancel prompt request failed', err);
            });
        }
    }

    async function handleGenerateOnce(batchIndex = 1, batchTotal = 1) {
        try {
            const batchPrefix = batchTotal > 1 ? `[${batchIndex}/${batchTotal}] ` : '';
            statusDiv.textContent = batchPrefix + "正在初始化...";
            ensureComfyNotCancelled();

            // Auto Save Mapping
            saveMappingConfig();

            comfyUiUrl = document.getElementById('comfyui-url-input').value.replace(/\/$/, '');

            // 1. Collect Inputs
            const inputsContainer = document.getElementById('comfyui-inputs-list');
            const inputRows = inputsContainer ? inputsContainer.querySelectorAll('.comfyui-input-row') : [];

            // Deep copy workflow
            const promptRoot = getPromptRoot(currentWorkflow);
            if (!promptRoot) {
                throw new Error("工作流解析失败: 未找到有效的 prompt 结构");
            }
            const workflow = JSON.parse(JSON.stringify(promptRoot));
            const fileHasUsableBytes = (fileObj) => {
                if (!fileObj) return false;
                if (typeof fileObj.size !== 'number') return true;
                return fileObj.size > 0;
            };
            const collectAutoMaskTargets = () => {
                const targets = [];
                for (const row of inputRows) {
                    const nodeId = row.getAttribute('data-node-id');
                    const inputKey = row.getAttribute('data-input-key') || 'image';
                    const nodeObj = getWorkflowNode(workflow, nodeId);
                    if (!nodeObj || String(nodeObj.class_type || '') !== 'LoadImageMask') continue;
                    const select = row.querySelector('select');
                    const source = select ? select.value : 'file';
                    const fileInput = row.querySelector('input[type="file"]');
                    const hasPath = !!(fileInput && fileInput.dataset && fileInput.dataset.localPath);
                    const hasFile = !!(fileInput && fileInput.files && fileInput.files.length > 0);
                    const hasManual = source !== 'file' || hasPath || hasFile;
                    if (hasManual) continue;
                    targets.push({ nodeId, inputKey });
                }
                return targets;
            };
            const autoMaskTargets = collectAutoMaskTargets();
            let autoMaskCursor = 0;

            // Iterate UI inputs
            for (const row of inputRows) {
                ensureComfyNotCancelled();
                const nodeId = row.getAttribute('data-node-id');
                const select = row.querySelector('select');
                const source = select.value;
                const nodeTitle = row.querySelector('.input-node-title').textContent;
                const inputKey = row.getAttribute('data-input-key');
                const nodeObj = getWorkflowNode(workflow, nodeId);
                const transferMode = detectInputTransferMode(inputKey, nodeObj);

                statusDiv.textContent = `正在处理输入: ${nodeTitle}...`;

                let filename = null;
                let pathValue = '';

                if (source === 'file') {
                    const fileInput = row.querySelector('input[type="file"]');
                    const cachedPath = fileInput && fileInput.dataset ? fileInput.dataset.localPath || '' : '';
                    if (transferMode === 'path') {
                        if (fileInput.files.length > 0) {
                            const fileObj = fileInput.files[0];
                            const localPath = cachedPath || getLocalPathFromFile(fileObj);
                            if (localPath) {
                                pathValue = normalizePathForNodeInput(localPath, inputKey);
                            }
                        } else if (cachedPath && fsHelper.existsSync(cachedPath)) {
                            pathValue = normalizePathForNodeInput(cachedPath, inputKey);
                        } else {
                            const existing = getWorkflowNodeInput(workflow, nodeId, inputKey);
                            if (existing && typeof existing === 'string') {
                                pathValue = existing;
                            }
                        }
                    } else if (fileInput.files.length > 0) {
                        const fileObj = fileInput.files[0];
                        const localPath = cachedPath || getLocalPathFromFile(fileObj);
                        if (!fileHasUsableBytes(fileObj) && localPath && fsHelper.existsSync(localPath)) {
                            filename = await uploadInputFromPath(localPath, inputKey || 'image');
                        } else {
                            filename = await uploadInputBlob(fileObj, fileObj.name, inputKey);
                        }
                    } else if (cachedPath && fsHelper.existsSync(cachedPath)) {
                        filename = await uploadInputFromPath(cachedPath, inputKey || 'image');
                    } else {
                        const existing = getWorkflowNodeInput(workflow, nodeId, inputKey);
                        if (existing && typeof existing === 'string') {
                            if (isLocalAbsolutePathValue(existing)) {
                                const normalizedExistingPath = normalizeLocalPath(existing);
                                if (!normalizedExistingPath || !fsHelper.existsSync(normalizedExistingPath)) {
                                    throw new Error(`输入 ${nodeTitle} 使用了本地路径但文件不存在，请重新选择文件`);
                                }
                                filename = await uploadInputFromPath(normalizedExistingPath, inputKey || 'image');
                            } else {
                                filename = existing;
                                console.log(`Using existing file for ${nodeTitle}: ${existing}`);
                            }
                        }
                    }
                } else if (source === 'frame') {
                    statusDiv.textContent = `正在导出 AE 当前帧 (${nodeTitle})...`;
                    let framePath = await captureCurrentAeFramePath();
                    if (transferMode === 'path') {
                        pathValue = normalizePathForNodeInput(framePath, inputKey);
                    } else {
                        try {
                            filename = await uploadInputFromPath(framePath, 'image');
                        } catch (frameUploadError) {
                            console.warn(`输入 ${nodeTitle} 首次截图上传失败，尝试重新截取`, frameUploadError);
                            statusDiv.textContent = `截图上传失败，正在重新截取 (${nodeTitle})...`;
                            framePath = await captureCurrentAeFramePath();
                            filename = await uploadInputFromPath(framePath, 'image');
                        }
                    }
                } else if (source === 'layer') {
                    statusDiv.textContent = `正在获取选中图层 (${nodeTitle})...`;
                    const res = await evalScript('getSelectedLayerSource()');
                    const resObj = JSON.parse(res);
                    if (resObj.error) throw new Error(resObj.error);
                    if (transferMode === 'path') {
                        pathValue = normalizePathForNodeInput(resObj.path, inputKey);
                    } else {
                        filename = await uploadInputFromPath(resObj.path, inputKey || 'image');
                    }
                }

                if (transferMode === 'path') {
                    if (pathValue && inputKey) {
                        if (!setWorkflowNodeInput(workflow, nodeId, inputKey, pathValue)) {
                            throw new Error(`路径参数写入失败: 节点 #${nodeId} 不存在或当前工作流结构不兼容`);
                        }
                    }
                    continue;
                }

                if (filename && inputKey) {
                    if (!setWorkflowUploadedFile(workflow, nodeId, inputKey, filename)) {
                        throw new Error(`输入节点 #${nodeId} 不存在或当前工作流结构不兼容`);
                    }
                }

                const fileInput = row.querySelector('input[type="file"]');
                const draftKey = fileInput && fileInput.dataset ? (fileInput.dataset.maskDraftKey || '') : '';
                const draft = getMaskDraft(draftKey);
                if (!draft) continue;
                if (String(nodeObj && nodeObj.class_type || '') === 'LoadImageMask') continue;

                const target = autoMaskTargets[autoMaskCursor] || null;
                if (!target) {
                    notifyUser(`遮罩已绘制，但未找到可写入的 LoadImageMask 输入 (${nodeTitle})`, 'warning', '遮罩未映射');
                    continue;
                }
                const maskBlob = draft.maskBlob || draft.imageBlob;
                if (!maskBlob) continue;
                statusDiv.textContent = `正在上传遮罩: ${nodeTitle}...`;
                const maskFilename = await uploadInputBlob(maskBlob, `${sanitizeMaskFileName(draft.sourceName || nodeTitle, 'mask')}.png`, 'image');
                if (!setWorkflowUploadedFile(workflow, target.nodeId, target.inputKey || 'image', maskFilename)) {
                    throw new Error(`遮罩写入失败: 节点 #${target.nodeId} 不存在或结构不兼容`);
                }
                autoMaskCursor += 1;
            }
            const customFilePanels = document.querySelectorAll('.comfyui-custom-file-panel');
            for (const panelEl of customFilePanels) {
                ensureComfyNotCancelled();
                const pathInput = panelEl.querySelector('.comfyui-custom-path-input');
                if (pathInput) {
                    const nodeId = pathInput.getAttribute('data-node');
                    const key = pathInput.getAttribute('data-key');
                    if (!nodeId || !key) continue;
                    const existing = getWorkflowNodeInput(workflow, nodeId, key);
                    const rawPath = pathInput.value || (typeof existing === 'string' ? existing : '');
                    const finalPath = normalizePathForNodeInput(rawPath, key);
                    if (!finalPath) continue;
                    if (!setWorkflowNodeInput(workflow, nodeId, key, finalPath)) {
                        throw new Error(`参数路径写入失败: 节点 #${nodeId} 不存在或工作流结构不兼容`);
                    }
                    continue;
                }

                const inp = panelEl.querySelector('.comfyui-custom-file');
                if (!inp) continue;
                const nodeId = inp.getAttribute('data-node');
                const key = inp.getAttribute('data-key');
                const mediaType = inp.getAttribute('data-media') || 'image';
                const idx = parseInt(panelEl.getAttribute('data-idx'), 10);
                const sourcePathInput = panelEl.querySelector('.comfyui-custom-source-path');
                const nodeObj = getWorkflowNode(workflow, nodeId);
                let source = panelEl.getAttribute('data-source') || '';
                if (!source && !isNaN(idx) && customParamConfig[idx] && customParamConfig[idx].fileSource) {
                    source = customParamConfig[idx].fileSource;
                }
                if (!source) source = 'file';
                const transferMode = (!isNaN(idx) && customParamConfig[idx] && customParamConfig[idx].transferMode)
                    ? customParamConfig[idx].transferMode
                    : detectInputTransferMode(key, nodeObj);
                let filename = null;

                if (transferMode === 'path') {
                    let localPath = '';

                    if (source === 'layer') {
                        const selectedPath = sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '';
                        if (selectedPath) {
                            localPath = selectedPath;
                        } else {
                            statusDiv.textContent = `正在读取 AE 选中图层路径 (${key})...`;
                            const layerRes = await evalScript('getSelectedLayerSource()');
                            const layerObj = JSON.parse(layerRes);
                            if (layerObj.error) throw new Error(`参数 ${key}: ${layerObj.error}`);
                            localPath = layerObj.path;
                        }
                    } else if (source === 'frame') {
                        const selectedPath = sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '';
                        if (selectedPath) {
                            localPath = selectedPath;
                        } else {
                            statusDiv.textContent = `正在截取 AE 当前画面路径 (${key})...`;
                            localPath = await captureCurrentAeFramePath();
                        }
                    } else if (inp.files && inp.files.length > 0) {
                        const fileObj = inp.files[0];
                        localPath = (sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '') || getLocalPathFromFile(fileObj);
                    } else if (source === 'file' && sourcePathInput && sourcePathInput.value) {
                        localPath = sourcePathInput.value;
                    } else {
                        const existing = getWorkflowNodeInput(workflow, nodeId, key);
                        if (existing && typeof existing === 'string') {
                            localPath = existing;
                        }
                    }

                    const finalPath = normalizePathForNodeInput(localPath, key);
                    if (!finalPath) continue;
                    if (!setWorkflowNodeInput(workflow, nodeId, key, finalPath)) {
                        throw new Error(`参数路径写入失败: 节点 #${nodeId} 不存在或工作流结构不兼容`);
                    }
                    continue;
                }

                if (source === 'layer') {
                    const selectedPath = sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '';
                    if (selectedPath) {
                        try {
                            filename = await uploadInputFromPath(selectedPath, mediaType);
                        } catch (pathError) {
                            console.warn(`参数 ${key} 的 AE 图层缓存文件不可用，将重新读取图层`, pathError);
                        }
                    } else {
                        statusDiv.textContent = `正在读取 AE 选中图层 (${key})...`;
                        const layerRes = await evalScript('getSelectedLayerSource()');
                        const layerObj = JSON.parse(layerRes);
                        if (layerObj.error) throw new Error(`参数 ${key}: ${layerObj.error}`);
                        filename = await uploadInputFromPath(layerObj.path, mediaType);
                    }
                    if (!filename) {
                        statusDiv.textContent = `正在重新读取 AE 选中图层 (${key})...`;
                        const layerRes = await evalScript('getSelectedLayerSource()');
                        const layerObj = JSON.parse(layerRes);
                        if (layerObj.error) throw new Error(`参数 ${key}: ${layerObj.error}`);
                        filename = await uploadInputFromPath(layerObj.path, mediaType);
                    }
                } else if (source === 'frame') {
                    const selectedPath = sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '';
                    if (selectedPath) {
                        try {
                            filename = await uploadInputFromPath(selectedPath, 'image');
                        } catch (pathError) {
                            console.warn(`参数 ${key} 的 AE 截图缓存不可用，将重新截取`, pathError);
                        }
                    } else {
                        statusDiv.textContent = `正在截取 AE 当前画面 (${key})...`;
                        const framePath = await captureCurrentAeFramePath();
                        filename = await uploadInputFromPath(framePath, 'image');
                    }
                    if (!filename) {
                        statusDiv.textContent = `正在重新截取 AE 当前画面 (${key})...`;
                        const framePath = await captureCurrentAeFramePath();
                        filename = await uploadInputFromPath(framePath, 'image');
                    }
                } else if (inp.files && inp.files.length > 0) {
                    const fileObj = inp.files[0];
                    const localPath = (sourcePathInput && sourcePathInput.value ? sourcePathInput.value : '') || getLocalPathFromFile(fileObj);
                    if (!fileHasUsableBytes(fileObj) && localPath && fsHelper.existsSync(localPath)) {
                        filename = await uploadInputFromPath(localPath, mediaType);
                    } else {
                        filename = await uploadInputBlob(fileObj, fileObj.name, mediaType);
                    }
                } else if (source === 'file' && sourcePathInput && sourcePathInput.value) {
                    filename = await uploadInputFromPath(sourcePathInput.value, mediaType);
                } else {
                    const existing = getWorkflowNodeInput(workflow, nodeId, key);
                    if (existing && typeof existing === 'string') {
                        if (isLocalAbsolutePathValue(existing)) {
                            const normalizedExistingPath = normalizeLocalPath(existing);
                            if (!normalizedExistingPath || !fsHelper.existsSync(normalizedExistingPath)) {
                                throw new Error(`参数 ${key} 使用了本地路径但文件不存在，请重新选择文件`);
                            }
                            filename = await uploadInputFromPath(normalizedExistingPath, mediaType);
                        } else {
                            filename = existing;
                        }
                    }
                }

                if (!filename) continue;
                if (!setWorkflowUploadedFile(workflow, nodeId, key, filename)) {
                    throw new Error(`参数文件写入失败: 节点 #${nodeId} 不存在或工作流结构不兼容`);
                }
            }
            // 2. Apply Parameters
            ensureComfyNotCancelled();
            applyParameters(workflow);

            // 3. Send Prompt
            statusDiv.textContent = batchPrefix + "正在提交任务...";
            const promptRes = await sendPrompt(workflow);
            if (promptRes.error) throw new Error("ComfyUI Error: " + JSON.stringify(promptRes.error));

            const promptId = promptRes.prompt_id;
            activePromptId = promptId || null;
            ensureComfyNotCancelled();
            await waitForCompletion(promptId);
            ensureComfyNotCancelled();

            // 4. Handle Outputs
            statusDiv.textContent = batchPrefix + "任务完成，正在获取结果...";
            const history = await getHistory(promptId);
            const outputs = history[promptId].outputs;

            const resultFiles = [];
            for (const nodeId in outputs) {
                // If user specified output nodes, skip others
                if (outputNodeIds && outputNodeIds.length > 0) {
                    if (!outputNodeIds.includes(nodeId)) continue;
                }

                const nodeOutput = outputs[nodeId];
                if (nodeOutput.images && nodeOutput.images.length) {
                    nodeOutput.images.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'image' });
                    });
                }
                if (nodeOutput.gifs && nodeOutput.gifs.length) {
                    nodeOutput.gifs.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'image' });
                    });
                }
                if (nodeOutput.audio && nodeOutput.audio.length) {
                    nodeOutput.audio.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'audio' });
                    });
                }
                if (nodeOutput.audios && nodeOutput.audios.length) {
                    nodeOutput.audios.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'audio' });
                    });
                }
                if (nodeOutput.videos && nodeOutput.videos.length) {
                    nodeOutput.videos.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'video' });
                    });
                }
                if (nodeOutput.video && nodeOutput.video.length) {
                    nodeOutput.video.forEach(item => {
                        resultFiles.push({ filename: item.filename, subfolder: item.subfolder, type: item.type, mediaType: 'video' });
                    });
                }
            }

            if (resultFiles.length === 0) throw new Error("未找到输出文件");

            const assertImportedToLayer = (importRes, mediaLabel) => {
                let obj = null;
                try {
                    obj = JSON.parse(importRes);
                } catch (e) {
                    if (typeof importRes === 'string' && importRes.indexOf('Error') === 0) {
                        throw new Error(importRes);
                    }
                    return;
                }

                if (obj && obj.error) {
                    throw new Error(obj.error);
                }
                if (obj && obj.importedTo && obj.importedTo !== 'layer') {
                    throw new Error(`${mediaLabel}已导入项目面板，未放入当前合成。请先激活合成窗口并把时间指针放到目标位置后重试`);
                }
            };

            // Import all results
            for (let i = 0; i < resultFiles.length; i++) {
                ensureComfyNotCancelled();
                const item = resultFiles[i];
                const ext = item.filename.split('.').pop().toLowerCase();
                const url = `${comfyUiUrl}/view?filename=${item.filename}&subfolder=${item.subfolder}&type=${item.type}`;
                const isAudioExt = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus'].indexOf(ext) !== -1;
                const isImageExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].indexOf(ext) !== -1;
                const isVideoExt = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'gif'].indexOf(ext) !== -1;
                const mediaType = item.mediaType || (isVideoExt ? 'video' : (isAudioExt ? 'audio' : 'image'));

                // Preview first image
                if (i === 0 && mediaType === 'image' && isImageExt) {
                    document.getElementById('comfyui-result-img').src = url;
                    document.getElementById('comfyui-preview-box').style.display = 'flex';
                }

                // Download
                let saveDir = await getConfiguredSaveDir();
                let isTempFallback = false;

                const localPath = fsHelper.join(saveDir, `comfy_out_${Date.now()}_${i}.${ext}`);

                const blob = await fetch(url).then(r => r.blob());

                if (fs) {
                    const arrayBuffer = await blob.arrayBuffer();
                    fs.writeFileSync(localPath, Buffer.from(new Uint8Array(arrayBuffer)));
                } else if (cepFs) {
                    const reader = new FileReader();
                    const b64 = await new Promise(resolve => {
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                    const res = cepFs.writeFile(localPath, b64, cep.encoding.Base64);
                    if (res.err !== 0) throw new Error("Save file failed: " + res.err);
                }

                const safePath = localPath.replace(/\\/g, '\\\\');
                if (mediaType === 'audio') {
                    const importRes = await evalScript(`importAudioToComp("${safePath}")`);
                    assertImportedToLayer(importRes, '音频');
                } else if (mediaType === 'video') {
                    const importRes = await evalScript(`importVideoToComp("${safePath}")`);
                    assertImportedToLayer(importRes, '视频');
                } else {
                    const importRes = await evalScript(`importImageToComp("${safePath}")`);
                    assertImportedToLayer(importRes, '图片');
                }
            }

            activePromptId = null;

        } catch (err) {
            if (!isComfyCancelError(err)) {
                console.error(err);
            }
            throw err;
        }
    }

    async function handleGenerate() {
        if (isGenerating) return;
        if (!canGenerateWorkflow) {
            statusDiv.textContent = tc('comfyui.workflow.load_first', '请先加载可用工作流', 'Please load an available workflow first');
            return;
        }

        const total = getBatchSubmitCount(batchCountInput ? batchCountInput.value : 1);
        if (batchCountInput) batchCountInput.value = String(total);

        isGenerating = true;
        cancelRequested = false;
        activePromptId = null;
        refreshActionButtons();

        let completed = 0;
        try {
            for (let i = 1; i <= total; i++) {
                ensureComfyNotCancelled();
                await handleGenerateOnce(i, total);
                completed = i;
                if (i < total) {
                    statusDiv.textContent = `第 ${i}/${total} 次已完成，准备下一次...`;
                }
            }
            statusDiv.textContent = total > 1 ? `批量完成 (${completed}/${total})!` : "全部完成!";
        } catch (err) {
            if (isComfyCancelError(err)) {
                statusDiv.textContent = `任务已取消 (${completed}/${total})`;
            } else {
                statusDiv.textContent = "错误: " + err.message;
                console.error(err);
            }
        } finally {
            isGenerating = false;
            cancelRequested = false;
            activePromptId = null;
            activeWaitAbort = null;
            refreshActionButtons();
        }
    }

    function applyParameters(workflow) {
        saveMappingConfig();

        document.querySelectorAll('.comfyui-lora-select').forEach(sel => {
            const nodeId = sel.getAttribute('data-node');
            const loraName = sel.value;
            const node = getWorkflowNode(workflow, nodeId);
            if (!node || !node.inputs) return;

            if (!loraName) {
                if (node.inputs.strength_model !== undefined) setWorkflowNodeInput(workflow, nodeId, 'strength_model', 0);
                if (node.inputs.strength_clip !== undefined) setWorkflowNodeInput(workflow, nodeId, 'strength_clip', 0);
            } else {
                setWorkflowNodeInput(workflow, nodeId, 'lora_name', loraName);
                const strengthInput = document.querySelector(`input[data-node="${nodeId}"][data-type="strength"]`);
                if (strengthInput) {
                    const s = parseFloat(strengthInput.value);
                    if (node.inputs.strength_model !== undefined) setWorkflowNodeInput(workflow, nodeId, 'strength_model', s);
                    if (node.inputs.strength_clip !== undefined) setWorkflowNodeInput(workflow, nodeId, 'strength_clip', s);
                }
            }
        });

        document.querySelectorAll('.comfyui-custom-param').forEach(inp => {
            const nodeId = inp.getAttribute('data-node');
            const key = inp.getAttribute('data-key');
            const valueType = inp.getAttribute('data-value-type') || '';
            let val = inp.value;
            if (inp.type === 'checkbox') val = inp.checked;
            else if (valueType === 'number' || inp.type === 'number') val = inp.value === '' ? '' : Number(inp.value);
            if (nodeId) setWorkflowNodeInput(workflow, nodeId, key, val);
        });
    }
    // --- Helper Functions ---
    function logParamMapping(message, error) {
        if (error) console.error(`${PARAM_MAPPING_LOG_PREFIX} ${message}`, error);
        else console.log(`${PARAM_MAPPING_LOG_PREFIX} ${message}`);
    }

    function setStatusMessage(message) {
        if (statusDiv) statusDiv.textContent = message;
    }

    function notifyUser(message, type = 'success', title = '') {
        setStatusMessage(message);
        if (typeof window.showNotification === 'function') {
            if (title || type === 'warning' || type === 'error') {
                const toastTitle = title || (type === 'error' ? '错误' : type === 'warning' ? '提示' : '成功');
                window.showNotification(toastTitle, message, type);
            } else {
                window.showNotification(message, type === 'error');
            }
            return;
        }
        if (type === 'error' || type === 'warning') alert(message);
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderEmptyState(container, title, description, icon = 'ℹ️') {
        if (!container) return;
        container.innerHTML = `<div class="comfyui-empty-params">
            <span>${icon}</span>
            <p>${escapeHtml(title)}</p>
            <small>${escapeHtml(description)}</small>
        </div>`;
    }

    function renderUnsupportedWorkflowState(message) {
        const reason = message || tc('comfyui.workflow.unsupported', UNSUPPORTED_WORKFLOW_MESSAGE, 'Current workflow structure is incompatible. Please export with API Format.');
        renderEmptyState(document.getElementById('comfyui-dynamic-params'), tc('comfyui.workflow.unavailable', '工作流不可用', 'Workflow unavailable'), reason, '⚠️');
        renderEmptyState(nodeListEl, tc('comfyui.workflow.unavailable', '工作流不可用', 'Workflow unavailable'), tc('comfyui.workflow.api_export_hint', '请在 ComfyUI 中使用 Save (API Format) 导出后重试', 'Please export with Save (API Format) in ComfyUI and retry'), '⚠️');
    }

    function updateWorkflowAvailability(workflowFormat) {
        const useSection = document.getElementById('comfyui-use-mode-section');
        const configWrap = document.getElementById('comfyui-config-toggle-wrap');
        const configSection = document.getElementById('comfyui-config-section');
        const arrow = document.querySelector('#comfyui-config-toggle-btn .toggle-arrow');

        if (useSection) useSection.style.display = 'block';
        if (configSection) configSection.classList.remove('expanded');
        if (arrow) arrow.textContent = '▼';

        if (workflowFormat && workflowFormat.supported) {
            if (configWrap) configWrap.style.display = 'block';
            return;
        }

        if (configWrap) configWrap.style.display = 'none';
        renderUnsupportedWorkflowState((workflowFormat && workflowFormat.message) || UNSUPPORTED_WORKFLOW_MESSAGE);
    }

    function getWorkflowFormatInfo(data) {
        if (!data || typeof data !== 'object') {
            return { kind: 'unsupported', supported: false, message: UNSUPPORTED_WORKFLOW_MESSAGE };
        }

        if (data.prompt && typeof data.prompt === 'object' && !Array.isArray(data.prompt)) {
            const promptKeys = Object.keys(data.prompt);
            if (promptKeys.some(key => data.prompt[key] && typeof data.prompt[key] === 'object' && data.prompt[key].class_type)) {
                return { kind: 'prompt_wrapper', supported: true, root: data.prompt, message: '' };
            }
        }

        const keys = Object.keys(data);
        if (keys.some(key => data[key] && typeof data[key] === 'object' && data[key].class_type)) {
            return { kind: 'api_prompt', supported: true, root: data, message: '' };
        }

        const isUiWorkflow = (Array.isArray(data.nodes) && data.links !== undefined)
            || (data.workflow && Array.isArray(data.workflow.nodes));
        if (isUiWorkflow) {
            return { kind: 'ui_workflow', supported: false, message: UNSUPPORTED_WORKFLOW_MESSAGE };
        }

        return { kind: 'unsupported', supported: false, message: UNSUPPORTED_WORKFLOW_MESSAGE };
    }

    function getWorkflowNodes(workflow) {
        const info = getWorkflowFormatInfo(workflow);
        return info.supported ? info.root : null;
    }

    function getWorkflowNode(workflow, nodeId) {
        const nodes = getWorkflowNodes(workflow);
        if (!nodes || nodeId === undefined || nodeId === null) return null;
        return nodes[String(nodeId)] || null;
    }

    function getWorkflowNodeInput(workflow, nodeId, key) {
        const node = getWorkflowNode(workflow, nodeId);
        return node && node.inputs ? node.inputs[key] : undefined;
    }

    function setWorkflowNodeInput(workflow, nodeId, key, value) {
        const node = getWorkflowNode(workflow, nodeId);
        if (!node) return false;
        if (!node.inputs || typeof node.inputs !== 'object') node.inputs = {};
        node.inputs[key] = value;
        return true;
    }

    function updateCurrentWorkflowInput(nodeId, key, value) {
        if (!setWorkflowNodeInput(currentWorkflow, nodeId, key, value)) {
            notifyUser(`参数写回失败: 节点 #${nodeId} 不存在或工作流结构不兼容`, 'error', '配置失效');
            return false;
        }
        scheduleSaveWorkflow();
        return true;
    }

    function setWorkflowUploadedFile(workflow, nodeId, key, filename) {
        if (!setWorkflowNodeInput(workflow, nodeId, key, filename)) return false;
        const uiKey = `${key}UI`;
        if (getWorkflowNodeInput(workflow, nodeId, uiKey) !== undefined) {
            setWorkflowNodeInput(workflow, nodeId, uiKey, `/api/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=&rand=${Math.random()}`);
        }
        return true;
    }

    function isPrimitiveValue(value) {
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    }

    function inferValueTypeFromValue(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') return 'string';
        return '';
    }

    function coerceBooleanValue(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const lowered = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
            if (['false', '0', 'no', 'off', ''].includes(lowered)) return false;
        }
        return Boolean(value);
    }

    function getNodeInputSchemaMap(nodeInfo) {
        const schemaMap = {};
        if (!nodeInfo || !nodeInfo.input) return schemaMap;
        ['required', 'optional'].forEach(section => {
            const sectionInputs = nodeInfo.input[section];
            if (!sectionInputs || typeof sectionInputs !== 'object') return;
            Object.keys(sectionInputs).forEach(key => {
                schemaMap[key] = sectionInputs[key];
            });
        });
        return schemaMap;
    }

    function detectMediaType(key, node = null, schemaMeta = null, rawType = '') {
        const keyLower = String(key || '').toLowerCase();
        const typeLower = String(rawType || '').toLowerCase();
        const metaText = schemaMeta && typeof schemaMeta === 'object'
            ? Object.keys(schemaMeta).join(' ').toLowerCase()
            : '';
        const nodeType = node && node.class_type ? node.class_type : '';

        if (isDirectoryLikeParam(keyLower, rawType)) return '';

        if (typeLower.includes('video') || metaText.includes('video')) return 'video';
        if (typeLower.includes('audio') || metaText.includes('audio')) return 'audio';
        if (typeLower.includes('image') || metaText.includes('image')) return 'image';

        if (MEDIA_NODE_HINTS.image.some(re => re.test(nodeType))) return 'image';
        if (MEDIA_NODE_HINTS.audio.some(re => re.test(nodeType))) return 'audio';
        if (MEDIA_NODE_HINTS.video.some(re => re.test(nodeType))) return 'video';

        if (keyLower.includes('video') || keyLower.includes('gif')) return 'video';
        if (keyLower.includes('audio') || keyLower.includes('sound') || keyLower.includes('music')) return 'audio';
        if (keyLower.includes('image') || keyLower.includes('mask')) return 'image';

        return '';
    }

    function detectInputTransferMode(key, node = null, schemaMeta = null, rawType = '') {
        const keyLower = String(key || '').toLowerCase();
        const typeLower = String(rawType || '').toLowerCase();
        const metaText = schemaMeta && typeof schemaMeta === 'object'
            ? Object.keys(schemaMeta).join(' ').toLowerCase()
            : '';
        const nodeType = node && node.class_type ? node.class_type : '';

        if (isDirectoryLikeParam(keyLower, rawType)) return 'path';

        if (metaText.includes('directory') || metaText.includes('folder')) return 'path';
        if (typeLower.includes('directory') || typeLower.includes('folder')) return 'path';

        if (/(^|_)(filepath|file_path)(_|$)/.test(keyLower)) return 'path';
        if (/(^|_)path(_|$)/.test(keyLower) && (typeLower.includes('path') || metaText.includes('path') || /path|file/i.test(nodeType))) {
            return 'path';
        }

        return 'upload';
    }

    function parseSchemaDefinition(key, definition, node, currentValue) {
        const schemaInfo = {
            rawType: '',
            options: null,
            defaultValue: undefined,
            valueType: '',
            mediaType: '',
            isEditable: false,
            meta: null
        };

        if (!Array.isArray(definition) || definition.length === 0) {
            if (isPrimitiveValue(currentValue)) {
                schemaInfo.valueType = inferValueTypeFromValue(currentValue);
                schemaInfo.isEditable = true;
            }
            return schemaInfo;
        }

        const typeDef = definition[0];
        const meta = definition.length > 1 && definition[1] && typeof definition[1] === 'object' && !Array.isArray(definition[1])
            ? definition[1]
            : null;
        schemaInfo.meta = meta;
        if (meta && Object.prototype.hasOwnProperty.call(meta, 'default')) {
            schemaInfo.defaultValue = meta.default;
        }

        if (Array.isArray(typeDef)) {
            schemaInfo.options = typeDef.map(item => String(item));
            schemaInfo.valueType = 'enum';
            schemaInfo.isEditable = true;
            if (schemaInfo.defaultValue === undefined && schemaInfo.options.length > 0) {
                schemaInfo.defaultValue = schemaInfo.options[0];
            }
            schemaInfo.mediaType = detectMediaType(key, node, meta, '');
            return schemaInfo;
        }

        schemaInfo.rawType = typeof typeDef === 'string' ? typeDef.toUpperCase() : '';
        schemaInfo.mediaType = detectMediaType(key, node, meta, schemaInfo.rawType);

        if (BOOLEAN_SCHEMA_TYPES.has(schemaInfo.rawType)) {
            schemaInfo.valueType = 'boolean';
            schemaInfo.isEditable = true;
            if (schemaInfo.defaultValue === undefined) schemaInfo.defaultValue = false;
            return schemaInfo;
        }

        if (NUMERIC_SCHEMA_TYPES.has(schemaInfo.rawType)) {
            schemaInfo.valueType = 'number';
            schemaInfo.isEditable = true;
            return schemaInfo;
        }

        if (STRING_SCHEMA_TYPES.has(schemaInfo.rawType) || schemaInfo.mediaType) {
            schemaInfo.valueType = 'string';
            schemaInfo.isEditable = true;
            return schemaInfo;
        }

        if (NON_EDITABLE_SCHEMA_TYPES.has(schemaInfo.rawType) && !isPrimitiveValue(currentValue) && !schemaInfo.mediaType) {
            return schemaInfo;
        }

        if (isPrimitiveValue(currentValue)) {
            schemaInfo.valueType = inferValueTypeFromValue(currentValue);
            schemaInfo.isEditable = true;
        }

        return schemaInfo;
    }

    function getParamCandidates(node, nodeInfo) {
        const inputs = node && node.inputs && typeof node.inputs === 'object' ? node.inputs : {};
        const schemaMap = getNodeInputSchemaMap(nodeInfo);
        const orderedKeys = [];
        Object.keys(inputs).forEach(key => orderedKeys.push(key));
        Object.keys(schemaMap).forEach(key => {
            if (!orderedKeys.includes(key)) orderedKeys.push(key);
        });

        const candidates = [];
        orderedKeys.forEach(key => {
            const currentValue = inputs[key];
            if (Array.isArray(currentValue)) return;
            if (currentValue && typeof currentValue === 'object') return;

            const schemaInfo = parseSchemaDefinition(key, schemaMap[key], node, currentValue);
            const hasPrimitiveCurrent = isPrimitiveValue(currentValue);
            if (!hasPrimitiveCurrent && !schemaInfo.isEditable) return;

            const mediaType = schemaInfo.mediaType || detectMediaType(key, node);
            const valueType = schemaInfo.valueType || inferValueTypeFromValue(currentValue) || 'string';
            const transferMode = detectInputTransferMode(key, node, schemaInfo.meta, schemaInfo.rawType);
            const isDirectoryParam = isDirectoryLikeParam(key, schemaInfo.rawType) && transferMode === 'path';
            const displayValue = hasPrimitiveCurrent ? currentValue : schemaInfo.defaultValue;
            candidates.push({
                key,
                val: displayValue,
                options: schemaInfo.options,
                valueType,
                defaultValue: schemaInfo.defaultValue,
                mediaType,
                transferMode,
                inputMode: isDirectoryParam ? 'path' : (mediaType ? 'file' : (schemaInfo.options ? 'select' : '')),
                rawType: schemaInfo.rawType
            });
        });

        return candidates;
    }

    function resolveParamValue(node, paramConfig) {
        if (node && node.inputs && node.inputs[paramConfig.key] !== undefined) {
            return node.inputs[paramConfig.key];
        }
        if (paramConfig.defaultValue !== undefined) return paramConfig.defaultValue;
        if (paramConfig.valueType === 'boolean') return false;
        return '';
    }

    function getPromptRoot(data) {
        return getWorkflowNodes(data);
    }

    function parseNodes(json) {
        const prompt = getWorkflowNodes(json);
        if (!prompt) {
            currentNodeList = [];
            renderNodeList(currentNodeList, '');
            return;
        }

        const visualNodes = [];
        for (const [id, node] of Object.entries(prompt)) {
            const type = node.class_type || 'Unknown';
            const title = node._meta ? node._meta.title : type;
            const inputKeys = node.inputs ? Object.keys(node.inputs) : [];
            const isInput = inputKeys.some(key => !!detectMediaType(key, node));
            const isPrompt = (/TextEncode/i.test(type) || /CLIP/i.test(type) || (node.inputs && typeof node.inputs.text === 'string'));
            const isOutput = (type === 'SaveImage' || type === 'PreviewImage' || /SaveImage/i.test(type));
            visualNodes.push({ id, type, title, isInput, isPrompt, isOutput });
        }

        currentNodeList = visualNodes;
        renderNodeList(currentNodeList, '');
    }

    function renderInputList(workflow) {
        const container = document.getElementById('comfyui-inputs-list');
        if (!container) return;
        container.innerHTML = '';

        const prompt = getPromptRoot(workflow);
        if (!prompt) return;

        const inputNodes = [];
        for (const [id, node] of Object.entries(prompt)) {
            const type = node.class_type;
            const title = node._meta ? node._meta.title : type;

            if (type === "LoadImage" || type === "LoadImageMask") {
                inputNodes.push({ id, type, title, key: 'image', accept: 'image/*' });
                continue;
            }
            if (type === "LoadAudio" || type === "VHS_LoadAudioUpload") {
                inputNodes.push({ id, type, title, key: 'audio', accept: 'audio/*' });
                continue;
            }
            if (type === "VHS_LoadVideo") {
                inputNodes.push({ id, type, title, key: 'video', accept: 'video/*,image/gif' });
                continue;
            }
            if (node.inputs) {
                if (node.inputs.image !== undefined && typeof node.inputs.image === 'string') {
                    inputNodes.push({ id, type, title, key: 'image', accept: 'image/*' });
                    continue;
                }
                if (node.inputs.video !== undefined && typeof node.inputs.video === 'string') {
                    inputNodes.push({ id, type, title, key: 'video', accept: 'video/*,image/gif' });
                    continue;
                }
                if (node.inputs.audio !== undefined && typeof node.inputs.audio === 'string') {
                    inputNodes.push({ id, type, title, key: 'audio', accept: 'audio/*' });
                    continue;
                }
            }
        }

        if (inputNodes.length === 0) {
            container.innerHTML = '<div style="color:#666; font-size:11px; padding:4px;">无检测到的输入节点 (文生图模式)</div>';
            return;
        }

        inputNodes.forEach(node => {
            const row = document.createElement('div');
            row.className = 'comfyui-input-row';
            row.setAttribute('data-node-id', node.id);
            row.setAttribute('data-input-key', node.key);
            row.style.marginBottom = '10px';
            row.style.background = 'rgba(255,255,255,0.03)';
            row.style.padding = '8px';
            row.style.borderRadius = '4px';

            const sourceTypeSelectId = `input-source-${node.id}`;
            const fileInputId = `input-file-${node.id}`;
            const dropZoneId = `input-drop-${node.id}`;
            const fileInfoId = `input-info-${node.id}`;
            const previewBoxId = `input-preview-${node.id}`;
            const previewImgId = `input-preview-img-${node.id}`;
            const previewAudioId = `input-preview-audio-${node.id}`;
            const previewVideoId = `input-preview-video-${node.id}`;
            const clearBtnId = `input-clear-${node.id}`;
            const maskBtnId = `input-mask-${node.id}`;
            const isImageInput = node.accept && node.accept.indexOf('image/') === 0;

            // Default source based on type
            let defaultSource = 'file';
            if (node.type === 'LoadImage') defaultSource = 'frame';

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:6px;">
                    <span style="font-weight:bold; font-size:12px; color:#eee;" class="input-node-title">${node.title} <span style="font-weight:normal; color:#888;">(#${node.id})</span></span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <select id="${sourceTypeSelectId}" class="comfyui-select" style="width:auto; padding:2px 6px; height:24px; font-size:11px;">
                            ${node.type === 'LoadImage' ? '<option value="frame">当前帧</option><option value="layer">选中图层</option>' : ''}
                            <option value="file" ${defaultSource === 'file' ? 'selected' : ''}>本地文件</option>
                        </select>
                        ${isImageInput ? `<button id="${maskBtnId}" class="comfyui-btn comfyui-btn-secondary" style="height:24px; padding:2px 8px; font-size:11px;">绘制遮罩</button>` : ''}
                        <button id="${clearBtnId}" class="comfyui-btn comfyui-btn-secondary" style="height:24px; padding:2px 8px; font-size:11px; display:${defaultSource === 'file' ? 'inline-flex' : 'none'};">清除</button>
                    </div>
                </div>
                
                <div id="${dropZoneId}" style="display:${defaultSource === 'file' ? 'flex' : 'none'}; flex-direction:column; align-items:center; justify-content:center; border:1px dashed #444; padding:8px; border-radius:4px; cursor:pointer; min-height:40px;">
                    <span style="font-size:11px; color:#888;">点击或拖入文件</span>
                    <span id="${fileInfoId}" style="font-size:10px; color:#ccc; margin-top:2px; word-break:break-all;"></span>
                    <input type="file" id="${fileInputId}" accept="${node.accept}" style="display:none;">
                </div>
                <div id="${previewBoxId}" style="display:none; margin-top:6px;">
                    <img id="${previewImgId}" style="display:none; max-width:100%; border-radius:4px;">
                    <audio id="${previewAudioId}" style="display:none; width:100%;" controls></audio>
                    <video id="${previewVideoId}" style="display:none; width:100%; border-radius:4px;" controls></video>
                </div>
            `;

            container.appendChild(row);
            bindSelectTitleSync(row);

            // Bind Events
            const sourceSel = document.getElementById(sourceTypeSelectId);
            const dropZone = document.getElementById(dropZoneId);
            const fileInput = document.getElementById(fileInputId);
            const fileInfo = document.getElementById(fileInfoId);
            const previewBox = document.getElementById(previewBoxId);
            const previewImg = document.getElementById(previewImgId);
            const previewAudio = document.getElementById(previewAudioId);
            const previewVideo = document.getElementById(previewVideoId);
            const clearBtn = document.getElementById(clearBtnId);
            const maskBtn = isImageInput ? document.getElementById(maskBtnId) : null;
            let previewUrl = null;
            if (fileInput && fileInput.dataset) fileInput.dataset.localPath = '';

            sourceSel.addEventListener('change', (e) => {
                dropZone.style.display = e.target.value === 'file' ? 'flex' : 'none';
                const hasFile = fileInput.files.length > 0;
                const hasPath = !!(fileInput.dataset && fileInput.dataset.localPath);
                previewBox.style.display = e.target.value === 'file' && (hasFile || hasPath) ? 'block' : 'none';
                clearBtn.style.display = e.target.value === 'file' ? 'inline-flex' : 'none';
            });

            dropZone.addEventListener('click', () => fileInput.click());

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault(); e.stopPropagation();
                dropZone.style.background = 'rgba(255,255,255,0.1)';
            });
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault(); e.stopPropagation();
                dropZone.style.background = 'transparent';
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation();
                dropZone.style.background = 'transparent';
                const droppedPath = extractLocalPathFromDataTransfer(e.dataTransfer);
                if (fileInput.dataset) fileInput.dataset.localPath = droppedPath || '';
                if (fileInput.dataset) fileInput.dataset.maskDataUrl = '';
                if (fileInput.dataset && fileInput.dataset.maskDraftKey) clearMaskDraft(fileInput.dataset.maskDraftKey);
                if (fileInput.dataset) fileInput.dataset.maskDraftKey = '';
                if (e.dataTransfer.files.length > 0) {
                    try {
                        fileInput.files = e.dataTransfer.files;
                    } catch (assignError) {
                        console.warn('拖拽文件赋值失败，改用路径模式', assignError);
                    }
                }
                updateFileInfo();
            });

            clearBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                fileInput.value = '';
                if (fileInput.dataset) fileInput.dataset.localPath = '';
                if (fileInput.dataset) fileInput.dataset.maskDataUrl = '';
                if (fileInput.dataset && fileInput.dataset.maskDraftKey) clearMaskDraft(fileInput.dataset.maskDraftKey);
                if (fileInput.dataset) fileInput.dataset.maskDraftKey = '';
                fileInfo.textContent = '';
                fileInfo.style.color = '#ccc';
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = null;
                previewImg.src = '';
                previewAudio.src = '';
                previewVideo.src = '';
                previewImg.style.display = 'none';
                previewAudio.style.display = 'none';
                previewVideo.style.display = 'none';
                previewBox.style.display = 'none';
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.dataset && fileInput.dataset.maskDraftKey) clearMaskDraft(fileInput.dataset.maskDraftKey);
                if (fileInput.dataset) fileInput.dataset.maskDraftKey = '';
                if (fileInput.dataset) fileInput.dataset.maskDataUrl = '';
                updateFileInfo();
            });

            if (maskBtn) {
                const resolveMaskSourceDescriptor = async () => {
                    const source = sourceSel.value;
                    if (source === 'file') {
                        const selectedFile = fileInput.files.length > 0 ? fileInput.files[0] : null;
                        const fallbackPath = fileInput.dataset ? fileInput.dataset.localPath || '' : '';
                        return resolveMaskEditorImageSource(selectedFile, fallbackPath);
                    }
                    if (source === 'layer') {
                        statusDiv.textContent = `正在读取 AE 选中图层 (${node.title})...`;
                        const res = await evalScript('getSelectedLayerSource()');
                        const obj = JSON.parse(res);
                        if (obj.error) throw new Error(obj.error);
                        return resolveMaskEditorImageSource(null, obj.path);
                    }
                    if (source === 'frame') {
                        statusDiv.textContent = `正在截取 AE 当前画面 (${node.title})...`;
                        const framePath = await captureCurrentAeFramePath();
                        return resolveMaskEditorImageSource(null, framePath);
                    }
                    throw new Error('当前来源不支持遮罩绘制');
                };
                const applyMaskResult = async (maskResult, sourceName = '') => {
                    if (!maskResult) return;
                    const draftKey = buildMaskDraftKey(node.id, node.key || 'image');
                    const keyLower = String(node.key || 'image').toLowerCase();
                    const maskOnly = node.type === 'LoadImageMask' || keyLower.includes('mask');
                    const routeToStandaloneMask = !maskOnly && hasStandaloneMaskInputNode(currentWorkflow);

                    if (routeToStandaloneMask) {
                        const storedMaskBlob = maskResult.maskBlob || maskResult.imageBlob;
                        if (!storedMaskBlob) throw new Error('遮罩导出失败');
                        setMaskDraft(draftKey, {
                            nodeId: node.id,
                            inputKey: node.key || 'image',
                            sourceName: sourceName || node.title || 'mask',
                            maskBlob: storedMaskBlob,
                            imageBlob: maskResult.imageBlob || null
                        });
                        if (fileInput.dataset) {
                            fileInput.dataset.maskDraftKey = draftKey;
                            fileInput.dataset.maskDataUrl = maskResult.editorMaskDataUrl || maskResult.maskDataUrl || '';
                            fileInput.dataset.maskSettings = JSON.stringify(maskResult.settings || {});
                        }
                        statusDiv.textContent = `已绘制遮罩 (${node.title})，生成时将写入遮罩输入`;
                        return;
                    }

                    clearMaskDraft(draftKey);
                    const payloadBlob = maskOnly
                        ? (maskResult.maskBlob || maskResult.imageBlob)
                        : (maskResult.imageBlob || maskResult.maskBlob);
                    if (!payloadBlob) throw new Error('遮罩导出失败');
                    const applyRes = await applyMaskBlobToFileInput(fileInput, payloadBlob, sourceName || node.title || 'mask');
                    if (fileInput.dataset) {
                        fileInput.dataset.maskDraftKey = '';
                        fileInput.dataset.maskDataUrl = maskResult.editorMaskDataUrl || maskResult.maskDataUrl || '';
                        fileInput.dataset.maskSettings = JSON.stringify(maskResult.settings || {});
                        if (applyRes.mode === 'path') {
                            fileInput.dataset.localPath = applyRes.path || '';
                        } else {
                            fileInput.dataset.localPath = '';
                        }
                    }
                    sourceSel.value = 'file';
                    sourceSel.dispatchEvent(new Event('change'));
                    updateFileInfo();
                    statusDiv.textContent = `已更新遮罩 (${node.title})`;
                };
                maskBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    let imageSource = null;
                    try {
                        imageSource = await resolveMaskSourceDescriptor();
                        const initialMaskDataUrl = fileInput.dataset ? (fileInput.dataset.maskDataUrl || '') : '';
                        const maskResult = await openComfyMaskEditor({
                            sourceUrl: imageSource.sourceUrl,
                            sourceName: imageSource.sourceName || node.title || '图片',
                            title: `${node.title} · 绘制遮罩`,
                            initialMaskDataUrl
                        });
                        if (!maskResult) return;
                        await applyMaskResult(maskResult, imageSource.sourceName || '');
                    } catch (err) {
                        notifyUser(`遮罩绘制失败: ${err.message}`, 'error', '遮罩失败');
                    } finally {
                        if (imageSource && typeof imageSource.cleanup === 'function') {
                            imageSource.cleanup();
                        }
                    }
                });
            }

            function updateFileInfo() {
                const clearPreviewMedia = () => {
                    previewImg.style.display = 'none';
                    previewAudio.style.display = 'none';
                    previewVideo.style.display = 'none';
                    previewImg.src = '';
                    previewAudio.src = '';
                    previewVideo.src = '';
                };

                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const directPath = getLocalPathFromFile(file);
                    const fallbackPath = (fileInput.dataset && fileInput.dataset.localPath) || directPath;
                    const fileHasBytes = typeof file.size !== 'number' || file.size > 0;
                    const isPathFallback = !!fallbackPath && !fileHasBytes;
                    if (fileInput.dataset) {
                        fileInput.dataset.localPath = isPathFallback ? fallbackPath : (directPath || '');
                    }

                    fileInfo.textContent = isPathFallback ? fsHelper.basename(fallbackPath) : file.name;
                    fileInfo.style.color = '#818cf8';
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    previewUrl = null;

                    const mime = (file.type || '').toLowerCase();
                    const lowerName = isPathFallback ? fallbackPath.toLowerCase() : file.name.toLowerCase();
                    const isImage = mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(lowerName);
                    const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(lowerName);
                    const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|gif)$/i.test(lowerName);
                    clearPreviewMedia();

                    if (isPathFallback) {
                        const fileUrl = `${pathToFileUrl(fallbackPath)}?t=${Date.now()}`;
                        if (isImage) previewImg.src = fileUrl;
                        if (isAudio) previewAudio.src = fileUrl;
                        if (isVideo) previewVideo.src = fileUrl;
                    } else {
                        previewUrl = URL.createObjectURL(file);
                        if (isImage) previewImg.src = previewUrl;
                        if (isAudio) previewAudio.src = previewUrl;
                        if (isVideo) previewVideo.src = previewUrl;
                    }
                    previewImg.style.display = isImage ? 'block' : 'none';
                    previewAudio.style.display = isAudio ? 'block' : 'none';
                    previewVideo.style.display = isVideo ? 'block' : 'none';
                    previewBox.style.display = (isImage || isAudio || isVideo) ? 'block' : 'none';
                } else if (fileInput.dataset && fileInput.dataset.localPath) {
                    const localPath = fileInput.dataset.localPath;
                    const lowerName = localPath.toLowerCase();
                    const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(lowerName);
                    const isAudio = /\.(mp3|wav|flac|aac|m4a|ogg)$/i.test(lowerName);
                    const isVideo = /\.(mp4|mov|webm|mkv|avi|gif)$/i.test(lowerName);
                    const fileUrl = `${pathToFileUrl(localPath)}?t=${Date.now()}`;
                    fileInfo.textContent = fsHelper.basename(localPath);
                    fileInfo.style.color = '#818cf8';
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    previewUrl = null;
                    clearPreviewMedia();
                    if (isImage) previewImg.src = fileUrl;
                    if (isAudio) previewAudio.src = fileUrl;
                    if (isVideo) previewVideo.src = fileUrl;
                    previewImg.style.display = isImage ? 'block' : 'none';
                    previewAudio.style.display = isAudio ? 'block' : 'none';
                    previewVideo.style.display = isVideo ? 'block' : 'none';
                    previewBox.style.display = (isImage || isAudio || isVideo) ? 'block' : 'none';
                } else {
                    fileInfo.textContent = '';
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    previewUrl = null;
                    clearPreviewMedia();
                    previewBox.style.display = 'none';
                }
            }
        });
    }

    function renderTargetButtons() {
        const container = document.getElementById('comfyui-target-buttons');
        if (!container) return;

        let html = '';

        // Standard targets
        const standards = [
            { id: 'input', label: '输入图' },
            { id: 'positive', label: '正向' },
            { id: 'negative', label: '反向' },
            { id: 'output', label: '输出图' }
        ];

        standards.forEach(t => {
            const active = currentMappingTarget === t.id ? 'active' : '';
            html += `<button class="comfyui-btn comfyui-btn-secondary comfyui-target-btn ${active}" data-target="${t.id}">${t.label}</button>`;
        });

        // Custom Groups
        if (customMappingGroups && customMappingGroups.length > 0) {
            customMappingGroups.forEach(g => {
                const targetId = 'group_' + g.id;
                const active = currentMappingTarget === targetId ? 'active' : '';
                html += `<button class="comfyui-btn comfyui-btn-secondary comfyui-target-btn ${active}" data-target="${targetId}" data-group-id="${g.id}" data-group-name="${g.name}">
                    ${g.name} <span class="comfyui-remove-group-icon" data-group-id="${g.id}" title="删除此组">×</span>
                </button>`;
            });
        }

        // Add button
        const customActive = currentMappingTarget === 'custom' ? 'active' : '';
        html += `<button class="comfyui-btn comfyui-btn-secondary comfyui-target-btn ${customActive}" data-target="custom" title="添加自定义参数" style="font-weight:bold;">+</button>`;

        container.innerHTML = html;
    }

    // --- Node Picker Logic ---
    function bindNodePickerEvents() {
        // Note: All node picker events are now bound in init() directly.
    }

    function toggleOutputNode(nodeId) {
        const idx = outputNodeIds.indexOf(nodeId);
        if (idx > -1) {
            outputNodeIds.splice(idx, 1);
        } else {
            outputNodeIds.push(nodeId);
        }
        renderNodeList(currentNodeList, nodeSearchInput ? nodeSearchInput.value : '');
        saveMappingConfig();
    }

    function showInputModal(title, placeholder, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const card = document.createElement('div');
        card.className = 'dialog-card';
        card.style.width = '400px';
        card.style.maxWidth = '90vw';

        card.innerHTML = `
            <div class="dialog-header">
                <h3>${title}</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="dialog-body">
                <div class="dialog-group">
                    <input type="text" class="form-input" placeholder="${placeholder}" id="modal-input-val">
                </div>
            </div>
            <div class="dialog-footer">
                <button class="comfyui-btn comfyui-btn-secondary cancel-btn">取消</button>
                <button class="comfyui-btn comfyui-btn-primary confirm-btn">确认</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const input = card.querySelector('#modal-input-val');
        const close = () => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
        };

        setTimeout(() => input.focus(), 50);

        card.querySelector('.close-btn').onclick = close;
        card.querySelector('.cancel-btn').onclick = close;

        const confirm = () => {
            const val = input.value.trim();
            if (val) {
                callback(val);
                close();
            } else {
                input.style.borderColor = '#f87171';
                // Simple shake animation
                input.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 200 });
            }
        };

        card.querySelector('.confirm-btn').onclick = confirm;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') close();
        };
    }

    function showCustomParamSettings(idx) {
        const param = customParamConfig[idx];
        if (!param) return;

        const node = getWorkflowNode(currentWorkflow, param.nodeId);
        const mediaType = param.mediaType || detectMediaType(param.key, node);
        const transferMode = param.transferMode || detectInputTransferMode(param.key, node, null, param.rawType || '');
        const isDirectoryPathParam = isDirectoryLikeParam(param.key, param.rawType || '') && transferMode === 'path';
        const hasOptions = Array.isArray(param.options) && param.options.length > 0;
        const valueType = param.valueType || '';
        let mode = param.inputMode || (mediaType ? 'file' : (hasOptions ? 'select' : 'text'));
        if (isDirectoryPathParam) mode = 'path';
        if (valueType === 'boolean') mode = 'boolean';

        const modeOptions = [];
        if (valueType === 'boolean') {
            modeOptions.push({ value: 'boolean', label: '布尔开关' });
        } else if (isDirectoryPathParam) {
            modeOptions.push({ value: 'path', label: '目录路径' });
        } else {
            if (hasOptions) modeOptions.push({ value: 'select', label: '下拉选项' });
            if (mediaType) modeOptions.push({ value: 'file', label: '文件输入' });
            if (valueType === 'number') {
                modeOptions.push({ value: 'number', label: '数字输入' });
                modeOptions.push({ value: 'slider', label: '滑块控制' });
            }
            modeOptions.push({ value: 'text', label: '文本输入' });
        }

        const nodeTitle = getNodeDisplayName(node, param.nodeId);
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const card = document.createElement('div');
        card.className = 'dialog-card';
        card.style.width = '420px';
        card.style.maxWidth = '92vw';

        const modeSelectHtml = modeOptions.map(option => {
            const selected = option.value === mode ? 'selected' : '';
            return `<option value="${option.value}" ${selected}>${option.label}</option>`;
        }).join('');

        let extraFieldsHtml = '';
        if (valueType === 'number') {
            const min = param.min !== undefined ? param.min : 0;
            const max = param.max !== undefined ? param.max : 1;
            const step = param.step !== undefined ? param.step : 0.01;
            extraFieldsHtml = `
                <div id="param-numeric-settings" style="display:${mode === 'slider' || mode === 'number' ? 'block' : 'none'}; margin-top:10px; padding-top:10px; border-top:1px dashed var(--comfyui-border);">
                    <div style="display:flex; gap:8px;">
                        <div style="flex:1;">
                            <label class="dialog-label">最小值</label>
                            <input id="param-setting-min" type="number" class="form-input" style="width:100%;" value="${min}" step="any">
                        </div>
                        <div style="flex:1;">
                            <label class="dialog-label">最大值</label>
                            <input id="param-setting-max" type="number" class="form-input" style="width:100%;" value="${max}" step="any">
                        </div>
                        <div style="flex:1;">
                            <label class="dialog-label">步长</label>
                            <input id="param-setting-step" type="number" class="form-input" style="width:100%;" value="${step}" step="any">
                        </div>
                    </div>
                </div>
            `;
        }

        const modeFieldHtml = isDirectoryPathParam
            ? `<div class="dialog-group" style="margin-top:10px;">
                    <label class="dialog-label">输入形式</label>
                    <div class="dialog-hint" style="margin-top:6px;">目录路径（固定）</div>
               </div>`
            : `<div class="dialog-group" style="margin-top:10px;">
                    <label class="dialog-label">输入形式</label>
                    <select id="param-setting-mode" class="form-input" style="width:100%;">
                        ${modeSelectHtml}
                    </select>
               </div>
               ${extraFieldsHtml}`;

        card.innerHTML = `
            <div class="dialog-header">
                <h3>参数设置</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="dialog-body">
                <div class="dialog-group">
                    <label class="dialog-label">显示名称</label>
                    <input id="param-setting-label" type="text" class="form-input" value="${escapeHtml(normalizeCustomParamLabel(param.label, param.key))}" placeholder="${escapeHtml(param.key)}">
                </div>
                ${modeFieldHtml}
                <div class="dialog-hint" style="margin-top:12px;">
                    节点: <span style="color:var(--comfyui-text);">${escapeHtml(nodeTitle)}</span><br>
                    参数键: <span style="color:var(--comfyui-text);">${escapeHtml(param.key)}</span>
                </div>
            </div>
            <div class="dialog-footer">
                <button class="comfyui-btn comfyui-btn-secondary cancel-btn">取消</button>
                <button class="comfyui-btn comfyui-btn-primary save-btn">保存</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const close = () => {
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
        };

        // Dynamic toggle for numeric fields
        const modeSelect = card.querySelector('#param-setting-mode');
        const numericSettings = card.querySelector('#param-numeric-settings');
        if (modeSelect && numericSettings) {
            modeSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                numericSettings.style.display = (val === 'slider' || val === 'number') ? 'block' : 'none';
            });
        }

        card.querySelector('.close-btn').onclick = close;
        card.querySelector('.cancel-btn').onclick = close;
        card.querySelector('.save-btn').onclick = () => {
            const labelInput = card.querySelector('#param-setting-label');
            const modeInput = card.querySelector('#param-setting-mode');
            const nextLabel = normalizeCustomParamLabel(labelInput ? labelInput.value : '', param.key);
            const nextMode = isDirectoryPathParam ? 'path' : (modeInput ? modeInput.value : mode);

            param.label = nextLabel;
            param.inputMode = nextMode;

            if (valueType === 'number') {
                const minInput = card.querySelector('#param-setting-min');
                const maxInput = card.querySelector('#param-setting-max');
                const stepInput = card.querySelector('#param-setting-step');
                if (minInput) param.min = parseFloat(minInput.value);
                if (maxInput) param.max = parseFloat(maxInput.value);
                if (stepInput) param.step = parseFloat(stepInput.value);
            }

            if (isDirectoryPathParam) {
                param.transferMode = 'path';
                param.fileSource = '';
            } else if (nextMode !== 'file') {
                param.fileSource = '';
            } else if (!param.fileSource) {
                param.fileSource = 'file';
            }

            renderUseModeParams(currentWorkflow);
            saveMappingConfig();
            close();
        };
    }

    async function showParamPicker(nodeId) {
        try {
            if (!currentWorkflowFormat.supported) {
                notifyUser(currentWorkflowFormat.message || UNSUPPORTED_WORKFLOW_MESSAGE, 'warning', '工作流格式不支持');
                return;
            }

            const node = getWorkflowNode(currentWorkflow, nodeId);
            if (!node) {
                notifyUser(`节点 #${nodeId} 不存在或当前工作流结构不兼容`, 'warning', '无法添加参数');
                return;
            }

            const nodeInfo = await fetchNodeObjectInfo(node.class_type);
            const candidates = getParamCandidates(node, nodeInfo);
            if (candidates.length === 0) {
                notifyUser('当前节点没有可暴露的可编辑参数', 'warning', '无可配置参数');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const card = document.createElement('div');
            card.className = 'dialog-card';
            card.style.width = '420px';
            card.style.maxHeight = '80vh';

            let html = `
                <div class="dialog-header">
                    <h3>选择参数 (Node #${escapeHtml(nodeId)})</h3>
                    <button class="close-btn">×</button>
                </div>
                <div class="dialog-body">
                    <div class="dialog-hint" style="margin-bottom:12px;">
                        映射目标: <span style="color:var(--comfyui-text); font-weight:bold;">${escapeHtml(pendingGroupName || '未分组')}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
            `;

            candidates.forEach(candidate => {
                const preview = candidate.val !== undefined && candidate.val !== null && candidate.val !== ''
                    ? `当前值: ${candidate.val}`
                    : (candidate.defaultValue !== undefined ? `默认值: ${candidate.defaultValue}` : '未设置');
                const typeLabel = candidate.mediaType
                    ? `文件/${candidate.mediaType}`
                    : candidate.valueType === 'boolean'
                        ? '布尔'
                        : candidate.valueType === 'number'
                            ? '数字'
                            : candidate.options
                                ? '枚举'
                                : '文本';
                const existingParam = customParamConfig.find(p => p.nodeId === nodeId && p.key === candidate.key);
                const aliasValue = normalizeCustomParamLabel(
                    existingParam ? existingParam.label : buildDefaultParamLabel(node, nodeId, candidate.key),
                    candidate.key
                );
                html += `
                <label style="display:flex; align-items:center; gap:10px; padding:8px; background:var(--comfyui-card-bg); border:1px solid var(--comfyui-card-border); border-radius:4px; cursor:pointer; user-select:none;">
                    <input type="checkbox" class="comfyui-param-checkbox" value="${escapeHtml(candidate.key)}">
                    <div style="display:flex; flex-direction:column; min-width:0;">
                        <span style="font-weight:bold; color:var(--comfyui-text); display:flex; align-items:center; gap:6px;">
                            ${escapeHtml(candidate.key)}
                            ${existingParam ? '<span style="font-size:10px; color:#fbbf24;">已添加</span>' : ''}
                        </span>
                        <span style="font-size:10px; color:var(--comfyui-text-muted);">${escapeHtml(typeLabel)} · ${escapeHtml(String(preview))}</span>
                        <input type="text" class="comfyui-input comfyui-param-alias" data-key="${escapeHtml(candidate.key)}" value="${escapeHtml(aliasValue)}" placeholder="显示名称" style="margin-top:6px; padding:4px 6px; height:26px; font-size:11px;">
                    </div>
                </label>`;
            });

            html += `
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="comfyui-btn comfyui-btn-secondary cancel-btn">取消</button>
                    <button id="confirm-param-picker" class="comfyui-btn comfyui-btn-primary">确认添加</button>
                </div>
            `;

            card.innerHTML = html;
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const close = () => {
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
            };
            card.querySelector('.close-btn').onclick = close;
            card.querySelector('.cancel-btn').onclick = close;

            card.querySelector('#confirm-param-picker').onclick = () => {
                try {
                    const checkboxes = overlay.querySelectorAll('.comfyui-param-checkbox:checked');
                    if (checkboxes.length === 0) {
                        notifyUser('请至少选择一个参数', 'warning', '未选择参数');
                        return;
                    }

                    let groupId = null;
                    let shouldCreateGroup = false;
                    if (pendingGroupName) {
                        const existingGroup = customMappingGroups.find(g => g.name === pendingGroupName);
                        if (existingGroup) {
                            groupId = existingGroup.id;
                        } else {
                            groupId = 'g_' + Date.now();
                            shouldCreateGroup = true;
                        }
                    }

                    let addedCount = 0;
                    let updatedCount = 0;
                    let skippedCount = 0;
                    const aliasMap = {};
                    overlay.querySelectorAll('.comfyui-param-alias').forEach(input => {
                        const key = input.getAttribute('data-key');
                        if (!key) return;
                        aliasMap[key] = normalizeCustomParamLabel(input.value, key);
                    });
                    checkboxes.forEach(chk => {
                        const key = chk.value;
                        const candidate = candidates.find(c => c.key === key);
                        if (!candidate) return;
                        const defaultLabel = buildDefaultParamLabel(node, nodeId, key);
                        const aliasLabel = aliasMap[key] || defaultLabel;
                        const existing = customParamConfig.find(p => p.nodeId === nodeId && p.key === key);
                        if (existing) {
                            existing.label = aliasLabel;
                            updatedCount += 1;
                            return;
                        }
                        const added = addCustomParam(nodeId, key, aliasLabel, candidate.options, groupId, true, candidate);
                        if (added) {
                            if (shouldCreateGroup) {
                                customMappingGroups.push({ id: groupId, name: pendingGroupName, nodeId: nodeId });
                                shouldCreateGroup = false;
                            }
                            addedCount += 1;
                        } else {
                            skippedCount += 1;
                        }
                    });
                    if (addedCount > 0 || updatedCount > 0) {
                        renderUseModeParams(currentWorkflow);
                        saveMappingConfig();
                    }

                    const feedback = [];
                    if (addedCount > 0) feedback.push(`已添加 ${addedCount} 个参数`);
                    if (updatedCount > 0) feedback.push(`已更新 ${updatedCount} 个参数设置`);
                    if (skippedCount > 0) feedback.push('所选参数已存在，已自动跳过');
                    notifyUser(
                        feedback.join('，') || '当前节点没有可暴露的可编辑参数',
                        (addedCount > 0 || updatedCount > 0) ? 'success' : 'warning',
                        (addedCount > 0 || updatedCount > 0) ? '参数设置已保存' : '重复参数'
                    );

                    close();
                    pendingGroupName = null;
                } catch (error) {
                    logParamMapping('确认添加参数失败', error);
                    notifyUser('添加参数失败: ' + error.message, 'error', '添加失败');
                }
            };
        } catch (error) {
            logParamMapping('打开参数选择器失败', error);
            notifyUser('打开参数选择器失败: ' + error.message, 'error', '参数映射异常');
        }
    }

    function addCustomParam(nodeId, key, label, options = null, groupId = null, skipRenderAndSave = false, candidate = null) {
        const exists = customParamConfig.find(p => p.nodeId === nodeId && p.key === key);
        if (exists) {
            return false;
        }

        const node = getWorkflowNode(currentWorkflow, nodeId);
        const mediaType = candidate && candidate.mediaType ? candidate.mediaType : detectMediaType(key, node);
        const transferMode = candidate && candidate.transferMode ? candidate.transferMode : detectInputTransferMode(key, node, null, candidate && candidate.rawType ? candidate.rawType : '');
        const rawType = candidate && candidate.rawType ? candidate.rawType : '';
        const isDirectoryParam = isDirectoryLikeParam(key, rawType) && transferMode === 'path';
        const normalizedOptions = candidate && candidate.options ? candidate.options : options;
        let inputMode = candidate && candidate.inputMode ? candidate.inputMode : '';
        if (!inputMode) {
            if (isDirectoryParam) inputMode = 'path';
            else if (mediaType) inputMode = 'file';
            else if (normalizedOptions && Array.isArray(normalizedOptions)) inputMode = 'select';
        }

        customParamConfig.push({
            nodeId,
            key,
            label: normalizeCustomParamLabel(label, key),
            options: normalizedOptions,
            groupId,
            mediaType,
            transferMode,
            fileSource: isDirectoryParam ? '' : (mediaType === 'image' ? 'file' : (mediaType ? 'file' : '')),
            inputMode,
            valueType: candidate ? candidate.valueType : undefined,
            defaultValue: candidate ? candidate.defaultValue : undefined
        });

        if (!skipRenderAndSave) {
            renderUseModeParams(currentWorkflow);
            saveMappingConfig();
        }

        return true;
    }
    function saveMappingConfig() {
        const mapping = {
            outputNodeIds: outputNodeIds,
            customParams: customParamConfig,
            customGroups: customMappingGroups
        };

        if (currentWorkflowPath) {
            const workflowKey = "comfyui_mapping_" + fsHelper.basename(currentWorkflowPath);
            localStorage.setItem(workflowKey, JSON.stringify(mapping));
        }
        return mapping;
    }

    // Global function for remove button
    window.removeCustomParam = function (idx) {
        const param = customParamConfig[idx];
        const groupId = param ? param.groupId : null;

        customParamConfig.splice(idx, 1);

        // Auto-remove empty group
        if (groupId) {
            const hasRemaining = customParamConfig.some(p => p.groupId === groupId);
            if (!hasRemaining) {
                customMappingGroups = customMappingGroups.filter(g => g.id !== groupId);
            }
        }

        renderUseModeParams(currentWorkflow);
        saveMappingConfig();
    };

    window.removeCustomGroup = function (groupId) {
        if (typeof DialogManager !== 'undefined' && DialogManager.showConfirm) {
            DialogManager.showConfirm("删除组确认", "确定要删除此组及其所有参数吗？", (confirmed) => {
                if (!confirmed) return;
                performRemoveGroup(groupId);
            });
        } else {
            if (confirm("确定要删除此组及其所有参数吗？")) {
                performRemoveGroup(groupId);
            }
        }
    };

    function performRemoveGroup(groupId) {
        // Remove params
        customParamConfig = customParamConfig.filter(p => p.groupId !== groupId);
        // Remove group
        customMappingGroups = customMappingGroups.filter(g => g.id !== groupId);

        renderUseModeParams(currentWorkflow);
        saveMappingConfig();
    }

    function applyNodeToTarget(nodeId) {
        let selId = "";
        if (currentMappingTarget === 'input') selId = "comfyui-input-node";
        else if (currentMappingTarget === 'positive') selId = "comfyui-positive-node";
        else if (currentMappingTarget === 'negative') selId = "comfyui-negative-node";
        else if (currentMappingTarget === 'output') selId = "comfyui-output-node";

        if (currentMappingTarget === 'custom' || currentMappingTarget.startsWith('group_')) {
            // Ensure pendingGroupName is set if target is a specific group
            if (currentMappingTarget.startsWith('group_')) {
                const gId = currentMappingTarget.replace('group_', '');
                const g = customMappingGroups.find(x => x.id === gId);
                if (g) pendingGroupName = g.name;
            }

            // Show parameter picker for this node
            showParamPicker(nodeId);
            return;
        }

        const sel = document.getElementById(selId);
        if (sel) {
            // Check if option exists, if not, add it (should exist from parse)
            sel.value = nodeId;
            statusDiv.textContent = `已映射 [${currentMappingTarget}] -> Node ${nodeId}`;

            // If we selected an input node, show input source options
            if (currentMappingTarget === 'input') {
                const row = document.getElementById('comfyui-input-source-row');
                if (row) row.style.display = 'flex';
            }
        }
    }

    function renderNodeList(nodes, filter) {
        nodeListEl.innerHTML = '';

        if (!nodes || nodes.length === 0) {
            if (currentWorkflowFormat && !currentWorkflowFormat.supported) {
                renderEmptyState(nodeListEl, tc('comfyui.workflow.unavailable', '工作流不可用', 'Workflow unavailable'), tc('comfyui.workflow.api_export_hint', '请在 ComfyUI 中使用 Save (API Format) 导出后重试', 'Please export with Save (API Format) in ComfyUI and retry'), '⚠️');
            } else {
                renderEmptyState(nodeListEl, tc('comfyui.nodes.none', '暂无节点', 'No nodes'), tc('comfyui.nodes.none_hint', '当前工作流没有可展示的节点', 'No displayable nodes in current workflow'), '🧩');
            }
            return;
        }

        const f = String(filter || '').toLowerCase();
        let matchCount = 0;

        nodes.forEach(n => {
            if (f && !n.title.toLowerCase().includes(f) && !n.type.toLowerCase().includes(f) && !n.id.includes(f)) return;
            matchCount += 1;

            const card = document.createElement('div');
            card.className = 'comfyui-node-card';
            card.setAttribute('data-id', n.id);

            let tags = '';
            if (n.isInput) tags += '<span class="node-tag input">Input</span>';
            if (n.isPrompt) tags += '<span class="node-tag prompt">Prompt</span>';
            if (n.isOutput) tags += '<span class="node-tag output">Output</span>';

            const isOut = outputNodeIds.includes(n.id);
            if (isOut) card.classList.add('output-node');
            card.innerHTML = `
                <div class="node-id">#${escapeHtml(n.id)}</div>
                <div class="node-title">${escapeHtml(n.title)}</div>
                <div class="node-type">${escapeHtml(n.type)}</div>
                <div class="node-tags">${tags}</div>
                <div class="node-card-actions">
                    <button class="comfyui-expose-param-btn" data-id="${escapeHtml(n.id)}" title="暴露参数到使用区">➕ 设为参数</button>
                    <button class="comfyui-set-output-btn${isOut ? ' active' : ''}" data-id="${escapeHtml(n.id)}" title="设定为输出节点">🚩 ${isOut ? '已设为输出' : '设为输出'}</button>
                </div>
            `;
            nodeListEl.appendChild(card);
        });

        if (matchCount === 0) {
            renderEmptyState(nodeListEl, '没有匹配节点', '请尝试其他关键词', '🔎');
        }
    }
    // bindInputSourceEvents removed

    // --- Communication Utils ---

    async function evalScript(script) {
        return new Promise((resolve, reject) => {
            const cs = new CSInterface();
            cs.evalScript(script, (res) => {
                if (res === 'EvalScript error.') reject(new Error(res));
                else resolve(res);
            });
        });
    }

    async function getAeTempPath() {
        const res = await evalScript('Folder.temp.fsName');
        return res;
    }

    async function captureCurrentAeFramePath() {
        const jsxCode = `
            (function() {
                try {
                    function waitFileReady(fileObj, maxLoops, minBytes) {
                        var loops = maxLoops || 30;
                        var minLen = minBytes || 128;
                        for (var i = 0; i < loops; i++) {
                            try {
                                fileObj = new File(fileObj.fsName);
                                if (fileObj.exists && fileObj.length >= minLen) {
                                    return true;
                                }
                            } catch (_) {}
                            try { $.sleep(100); } catch (_) {}
                        }
                        try {
                            fileObj = new File(fileObj.fsName);
                            return fileObj.exists && fileObj.length > 0;
                        } catch (_) {
                            return false;
                        }
                    }

                    function saveWithRenderQueue(comp, time, tmpFile) {
                        var rqItem = null;
                        var mutedItems = [];
                        try {
                            rqItem = app.project.renderQueue.items.add(comp);
                            rqItem.timeSpanStart = time;
                            rqItem.timeSpanDuration = comp.frameDuration;
                            var om = rqItem.outputModule(1);
                            om.file = tmpFile;

                            var templates = om.templates;
                            var pngTemplate = null;
                            for (var i = 0; i < templates.length; i++) {
                                if (String(templates[i]).toLowerCase().indexOf("png") !== -1) {
                                    pngTemplate = templates[i];
                                    break;
                                }
                            }
                            if (!pngTemplate) return false;

                            om.applyTemplate(pngTemplate);

                            // Mute other queued items to avoid rendering the whole queue.
                            var rqItems = app.project.renderQueue.items;
                            for (var j = 1; j <= rqItems.length; j++) {
                                var item = rqItems[j];
                                if (item !== rqItem && item.status === RQItemStatus.QUEUED && item.render) {
                                    mutedItems.push(item);
                                    item.render = false;
                                }
                            }

                            app.project.renderQueue.render();
                            return waitFileReady(tmpFile, 40, 128);
                        } catch (_) {
                            return false;
                        } finally {
                            for (var k = 0; k < mutedItems.length; k++) {
                                try { mutedItems[k].render = true; } catch (_) {}
                            }
                            try {
                                if (rqItem) rqItem.remove();
                            } catch (_) {}
                        }
                    }

                    var comp = null;
                    var time = null;
                    var viewer = app.activeViewer;
                    if (viewer && viewer.source && (viewer.source instanceof CompItem)) {
                        comp = viewer.source;
                        if (viewer.time !== undefined && viewer.time !== null) time = viewer.time;
                    }
                    if (!comp && app.project && app.project.activeItem && (app.project.activeItem instanceof CompItem)) {
                        comp = app.project.activeItem;
                    }
                    if (!comp) return "ERROR:No active comp";
                    if (time === null || time === undefined) time = comp.time;

                    var prevRes = comp.resolutionFactor;
                    var tmpFile = new File(Folder.temp.fsName + "/Mogu_Frame_" + new Date().getTime() + ".png");
                    var directSaved = false;
                    try {
                        comp.resolutionFactor = [1, 1];
                        if (typeof comp.saveFrameToPng === "function") {
                            comp.saveFrameToPng(time, tmpFile);
                            directSaved = waitFileReady(tmpFile, 30, 128);
                        }
                    } finally {
                        try { comp.resolutionFactor = prevRes; } catch (_) {}
                    }

                    if (!directSaved) {
                        var rqSaved = saveWithRenderQueue(comp, time, tmpFile);
                        if (!rqSaved) {
                            return "ERROR:AE 截图失败，请确认当前合成可见且可渲染";
                        }
                    }

                    var verified = new File(tmpFile.fsName);
                    if (!verified.exists || verified.length <= 0) {
                        return "ERROR:截图文件未生成";
                    }
                    return verified.fsName;
                } catch (e) {
                    return "ERROR:" + e.toString();
                }
            })();
        `;

        const result = await evalScript(jsxCode);
        if (!result || result === 'undefined' || result === 'null') {
            throw new Error('未获取到有效截图路径');
        }
        if (String(result).indexOf('ERROR:') === 0) {
            throw new Error(String(result).replace('ERROR:', ''));
        }
        const normalizedResult = normalizeLocalPath(String(result).replace(/\\\\/g, '\\')) || String(result).replace(/\\\\/g, '\\');
        await waitForLocalFileReady(normalizedResult, {
            attempts: 30,
            intervalMs: 120,
            minBytes: 256,
            validatePng: true
        });
        return normalizedResult;
    }

    async function uploadImage(localPath) {
        return uploadInputFromPath(localPath, 'image');
    }

    function isLikelyCompletePng(bytesLike) {
        if (!bytesLike) return false;
        const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
        if (!bytes || bytes.length < 20) return false;
        const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < pngSig.length; i++) {
            if (bytes[i] !== pngSig[i]) return false;
        }
        const tail = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
        if (bytes.length < tail.length) return false;
        const start = bytes.length - tail.length;
        for (let i = 0; i < tail.length; i++) {
            if (bytes[start + i] !== tail[i]) return false;
        }
        return true;
    }

    function readLocalFileBytes(localPath) {
        const normalizedPath = normalizeLocalPath(localPath) || String(localPath || '').trim();
        if (!normalizedPath) return null;

        if (fs) {
            const buffer = fs.readFileSync(normalizedPath);
            return new Uint8Array(buffer);
        }
        if (cepFs) {
            const res = cepFs.readFile(normalizedPath, cep.encoding.Base64);
            if (res.err !== 0) {
                throw new Error(`Read failed (Code: ${res.err})`);
            }
            const byteCharacters = atob(res.data || '');
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            return new Uint8Array(byteNumbers);
        }
        return null;
    }

    async function waitForLocalFileReady(localPath, options = {}) {
        const normalizedPath = normalizeLocalPath(localPath) || String(localPath || '').trim();
        if (!normalizedPath) throw new Error('文件路径为空');

        const attempts = typeof options.attempts === 'number' ? options.attempts : 20;
        const intervalMs = typeof options.intervalMs === 'number' ? options.intervalMs : 120;
        const minBytes = typeof options.minBytes === 'number' ? options.minBytes : 128;
        const validatePng = !!options.validatePng;
        const stableRoundsRequired = typeof options.stableRounds === 'number' ? options.stableRounds : 2;

        let lastSize = -1;
        let stableRounds = 0;
        let lastError = null;

        for (let i = 0; i < attempts; i++) {
            try {
                if (!fsHelper.existsSync(normalizedPath)) {
                    throw new Error('File does not exist yet');
                }

                const bytes = readLocalFileBytes(normalizedPath);
                const size = bytes && typeof bytes.length === 'number' ? bytes.length : 0;
                if (size < minBytes) {
                    throw new Error(`文件大小过小 (${size} bytes)`);
                }
                if (validatePng && !isLikelyCompletePng(bytes)) {
                    throw new Error('PNG 文件尚未写入完成');
                }

                if (size === lastSize) stableRounds += 1;
                else stableRounds = 0;
                lastSize = size;

                if (stableRounds >= stableRoundsRequired) {
                    return normalizedPath;
                }
            } catch (e) {
                lastError = e;
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }

        throw new Error(`等待文件就绪超时: ${normalizedPath}${lastError ? ` (${lastError.message})` : ''}`);
    }

    async function uploadInputFromPath(localPath, mediaType = 'image') {
        if (!localPath) {
            throw new Error('输入文件路径为空');
        }
        const normalizedPath = normalizeLocalPath(localPath) || localPath;
        const mimeType = inferMimeType(normalizedPath, mediaType);
        const shouldValidatePng = /\.png$/i.test(normalizedPath) || mimeType === 'image/png';

        // Wait for file to be ready (AE might still be writing)
        // Retry loop: 16 attempts * 500ms = 8 seconds max wait
        let lastError = null;
        for (let i = 0; i < 16; i++) {
            try {
                if (fsHelper.existsSync(normalizedPath)) {
                    // Try to read
                    const binaryBytes = readLocalFileBytes(normalizedPath);
                    const blob = binaryBytes
                        ? (mimeType ? new Blob([binaryBytes], { type: mimeType }) : new Blob([binaryBytes]))
                        : null;

                    if (blob) {
                        if (typeof blob.size === 'number' && blob.size <= 0) {
                            throw new Error('读取到的文件大小为 0 字节');
                        }
                        if (shouldValidatePng && binaryBytes && !isLikelyCompletePng(binaryBytes)) {
                            throw new Error('PNG 文件尚未写入完成');
                        }
                        return await uploadInputBlob(blob, fsHelper.basename(normalizedPath), mediaType);
                    }
                } else {
                    throw new Error("File does not exist yet");
                }
            } catch (e) {
                lastError = e;
                console.log(`Attempt ${i + 1} failed: ${e.message}. Retrying...`);
                await new Promise(r => setTimeout(r, 500));
            }
        }

        throw new Error(`Failed to read input file after retries: ${normalizedPath} (${lastError ? lastError.message : 'Unknown error'})`);
    }

    async function uploadInputBlob(blob, filename, mediaType) {
        if (!blob) {
            throw new Error("Upload failed: empty blob");
        }
        const rawName = filename || blob.name || `input_${Date.now()}`;
        const finalFilename = normalizeUploadFilename(rawName, mediaType);
        const inferredMimeType = inferMimeType(finalFilename, mediaType);
        const payloadBlob = (!blob.type && inferredMimeType)
            ? new Blob([blob], { type: inferredMimeType })
            : blob;

        if (typeof payloadBlob.size === 'number' && payloadBlob.size <= 0) {
            throw new Error(`Upload failed: ${finalFilename} 文件大小为 0 字节`);
        }

        const endpoints = mediaType === 'audio'
            ? ['/upload/audio', '/upload/image']
            : mediaType === 'video'
                ? ['/upload/image', '/upload/video']
                : ['/upload/image'];

        let lastError = null;
        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            const key = endpoint.indexOf('/upload/audio') !== -1 ? 'audio' : endpoint.indexOf('/upload/video') !== -1 ? 'video' : 'image';
            const formData = new FormData();
            formData.append(key, payloadBlob, finalFilename);
            formData.append('type', 'input');
            formData.append('overwrite', 'true');

            try {
                const res = await fetch(`${comfyUiUrl}${endpoint}`, {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    const txt = await res.text();
                    if (txt && (txt.indexOf('"errcode":16') !== -1 || txt.indexOf('未登录') !== -1)) {
                        lastError = new Error("Upload failed: ComfyUI 未登录或未授权");
                        continue;
                    }
                    lastError = new Error("Upload failed: " + res.statusText + " " + txt);
                    continue;
                }

                const json = await res.json();
                if (json && json.name) return json.name;
                if (json && (json.errcode === 16 || json.errmsg && json.errmsg.indexOf('未登录') !== -1)) {
                    lastError = new Error("Upload failed: ComfyUI 未登录或未授权");
                    continue;
                }
                lastError = new Error("Upload failed: invalid response");
            } catch (err) {
                lastError = err;
            }
        }

        if (lastError) throw lastError;
        throw new Error("Upload failed: unknown error");
    }

    async function sendPrompt(workflow) {
        const payload = {
            prompt: workflow,
            client_id: clientId
        };

        const res = await fetch(`${comfyUiUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return await res.json();
    }

    async function getHistory(promptId) {
        const res = await fetch(`${comfyUiUrl}/history/${promptId}`);
        return await res.json();
    }

    async function waitForCompletion(promptId) {
        return new Promise((resolve, reject) => {
            const wsProtocol = comfyUiUrl.indexOf('https://') === 0 ? 'wss://' : 'ws://';
            const ws = new WebSocket(`${wsProtocol}${comfyUiUrl.replace('http://', '').replace('https://', '')}/ws?clientId=${clientId}`);
            const abortState = { aborted: false };
            let settled = false;

            const rejectOnce = (err) => {
                if (settled) return;
                settled = true;
                activeWaitAbort = null;
                try { ws.close(); } catch (_) { }
                reject(err);
            };
            const resolveOnce = () => {
                if (settled) return;
                settled = true;
                activeWaitAbort = null;
                try { ws.close(); } catch (_) { }
                resolve();
            };

            activeWaitAbort = () => {
                abortState.aborted = true;
                rejectOnce(createComfyCancelError());
            };

            ws.onmessage = (event) => {
                try {
                    if (abortState.aborted || cancelRequested) {
                        rejectOnce(createComfyCancelError());
                        return;
                    }
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'executing' && msg.data.node === null && msg.data.prompt_id === promptId) {
                        resolveOnce();
                    }
                    if (msg.type === 'progress' && msg.data.prompt_id === promptId) {
                        statusDiv.textContent = `生成进度: ${msg.data.value}/${msg.data.max}`;
                    }
                } catch (e) { }
            };

            ws.onerror = (err) => {
                if (abortState.aborted || cancelRequested) {
                    rejectOnce(createComfyCancelError());
                    return;
                }
                try { ws.close(); } catch (_) { }
                // Fallback: poll history if WS fails
                pollHistory(promptId, resolveOnce, rejectOnce, abortState);
            };
        });
    }

    async function pollHistory(promptId, resolve, reject, abortState) {
        const interval = setInterval(async () => {
            if ((abortState && abortState.aborted) || cancelRequested) {
                clearInterval(interval);
                reject(createComfyCancelError());
                return;
            }
            try {
                const history = await getHistory(promptId);
                if (history && history[promptId]) {
                    clearInterval(interval);
                    resolve();
                }
            } catch (e) { }
        }, 1000);
    }

    // Expose ComfyUIManager for external interaction (e.g., import refresh)
    // Expose ComfyUIManager for external interaction (e.g., import refresh)
    window.ComfyUIManager = {
        refreshWorkflowList: refreshWorkflowList,
        updateSettings: function () {
            comfyUiUrl = localStorage.getItem('comfyui_url') || "http://127.0.0.1:8188";
            this.refreshWorkflowList();
        }
    };

    // Initialize
    setTimeout(init, 500);

})();
