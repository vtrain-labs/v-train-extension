// VT Core Engine V1.3 (i18n Refactored & Clean UI Edition)
// Features: Array Rules, Auto-Awake, Cousin Radar, Split Logic, Auto-Max-Video, No-Zero-Bar, Global i18n

if (!window._vtInjected) {
    window._vtInjected = true;

    // [CWS 安全修復] HTML 安全轉義工具函式，防止 DOM-Based XSS
    // 對所有要插入 innerHTML 的外部變數（URL 擷取值、使用者輸入）強制跳脫
    const escapeHtml = (str) => {
        if (typeof str !== 'string') return String(str ?? '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // [架構師重構] 使用 DOMParser 代替 innerHTML 進行多國語言注入
    const safeInject = (parent, htmlStr) => {
        const p = new DOMParser();
        const d = p.parseFromString(htmlStr, 'text/html');
        parent.innerHTML = ''; 
        while(d.body.firstChild) parent.appendChild(d.body.firstChild);
    };

    // [CWS 安全修復] DOM 屬性值 URL 淨化器，防止 javascript:/data:/vbscript: 偽協議注入
    // 在所有將 DOM 屬性值（attr.value）傳入 URL 解析前，必須先經過此函式過濾
    const sanitizeAttrAsUrl = (val) => {
        if (!val || typeof val !== 'string') return null;
        const trimmed = val.trim();
        // 阻擋 javascript:, data:, vbscript:, blob: 及 URL 編碼的偽協議（如 %6a%61%76%61%73%63%72%69%70%74 = javascript）
        if (/^\s*(javascript|data|vbscript|blob):/i.test(trimmed)) return null;
        if (/%6a%61%76%61%73%63%72%69%70%74/i.test(trimmed)) return null;
        return val;
    };

    const CONFIG = {
        checkInterval: 1500,
        saveInterval: 5000, // 常態存檔案改為 5 秒一次
    };

    // [架構師重構] 徹底移除本地 TRANSLATIONS 字典與 getInternalText 函式。
    // 全面改用由 background.js 優先注入的 shared_i18n.js 中的 getLangText() 全域方法。

    let lastRightClickedEl = null;
    let lastRightClickPos = null;
    let debugPanel = null;
    const _vtProgressCache = new Map(); // [效能優化] 進度値 RAM 快取，減少 Storage I/O
    let _cachedIframes = null;          // [效能優化] iframe 清單快取，避免每 tick 重新查詢

    document.addEventListener(
        "contextmenu",
        (e) => {
            lastRightClickedEl = e.target;
            lastRightClickPos = { x: e.clientX, y: e.clientY };
        },
        true,
    );

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "START_MARKING") {
            chrome.storage.local.get(
                ["isStealthMode", "userLang", "barColor"],
                (res) => {
                    const lang = res.userLang || "en";
                    // [架構師重構] 建立輕量代理，直接橋接至全域 getLangText，保持原本模板的簡潔度
                    const txt = new Proxy(
                        {},
                        { get: (target, key) => getLangText(lang, key) },
                    );

                    const showToast = (msg) => {
                        let t = document.getElementById("vt-web-toast");
                        if (t) t.remove();
                        t = document.createElement("div");
                        t.id = "vt-web-toast";
                        t.style.cssText =
                            "position:fixed;bottom:30px;right:30px;background:rgba(20,20,20,0.95);color:#ff5252;padding:16px 24px;border-radius:8px;font-size:16px;font-weight:bold;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,0.8);border-left:4px solid #ff5252;transition:opacity 0.3s;font-family:sans-serif;pointer-events:none;letter-spacing:1px;";
                        t.innerText = msg;
                        document.body.appendChild(t);
                        setTimeout(() => {
                            t.style.opacity = "0";
                            setTimeout(() => t.remove(), 300);
                        }, 3000);
                    };

                    const isStealth =
                        res.isStealthMode === undefined ? true : res.isStealthMode;
                    if (isStealth) return showToast(txt.sw);

                    // [新增] 進入訓練模式時：將既有進度條設為半透明 (不呼叫 removeAllBars)
                    document.querySelectorAll(".vt-progress-container").forEach(el => el.classList.add("vt-ghost"));

                    let target = lastRightClickedEl;
                    if (!target || !document.contains(target)) {
                        let hovers = document.querySelectorAll(":hover");
                        target = hovers.length ? hovers[hovers.length - 1] : null;
                    }
                    if (!target) return showToast(txt.err1);
                    lastRightClickedEl = target;

                    let elementsUnderCursor = [];
                    if (lastRightClickPos) {
                        elementsUnderCursor =
                            document.elementsFromPoint(
                                lastRightClickPos.x,
                                lastRightClickPos.y,
                            ) || [];
                    }

                    let imgEl = elementsUnderCursor.find((el) => {
                        let tag = el.tagName.toUpperCase();
                        if (["IMG", "PICTURE", "VIDEO"].includes(tag)) return true;
                        let styleStr = el.getAttribute("style") || "";
                        if (
                            styleStr.includes("background-image") ||
                            styleStr.includes("background: url(") ||
                            styleStr.includes("background:url(")
                        )
                            return true;
                        if (
                            el.hasAttribute("data-background-image") ||
                            el.hasAttribute("data-bg")
                        )
                            return true;
                        let cls =
                            typeof el.className === "string"
                                ? el.className.toLowerCase()
                                : "";
                        if (/(thumb|cover|poster)/i.test(cls)) return true;
                        return false;
                    });

                    if (!imgEl) {
                        let s = lastRightClickedEl;
                        imgEl =
                            s.tagName === "IMG" || s.tagName === "PICTURE"
                                ? s
                                : s.querySelector("img, picture") || s.closest("img, picture");
                    }

                    let currentFocusEl = imgEl || lastRightClickedEl || document.body;
                    let finalTargetSelector = "";
                    let activeOutlineBoxes = [];
                    let historyStack = [];

                    const getGeneralSelector = (el) => {
                        if (!el || el === document.body || el === document.documentElement)
                            return "";
                        let tag = el.tagName.toLowerCase();

                        // [修正] 改用 getAttribute 確保相容 SVG 與各類元素
                        let rawCls = el.getAttribute ? (el.getAttribute('class') || "") : "";
                        if (typeof rawCls !== 'string') rawCls = "";

                        // [架構師修復] 數字過濾改為精準邏輯，不再一刀切排除所有含數字類名。
                        // 排除規則：純數字（"123"） 或 長度>20且含連續4位以上數字（哈希類名如 jss1a2b3c4d）。
                        // 保留：語意類名如 gap-4、col-6、flex-grow-1、card-v2、h264-player。
                        const _isRandomHash = (c) =>
                            /^\d+$/.test(c) ||
                            (c.length > 20 && /\d{4,}/.test(c));

                        let cls = rawCls
                            .trim()
                            .split(/\s+/)
                            .filter(
                                (c) =>
                                    c &&
                                    c.length > 1 &&
                                    !/hover|active|focus|playing|lazy|loaded|hidden|visible|selected|checked|expanded|collapsed|transitioning|animating|seen|watched|viewed/i.test(
                                        c,
                                    ) &&
                                    !_isRandomHash(c),
                            )
                            // [新增] 權重排序：優先保留長度適中、看起來像語意的類名，過濾掉太短的 utility class (如 p-1, m-2)
                            .sort((a, b) => {
                                const getWeight = (s) => {
                                    if (s.includes('thumb') || s.includes('video') || s.includes('card') || s.includes('cover')) return 100;
                                    if (s.length > 8) return 50;
                                    return s.length;
                                };
                                return getWeight(b) - getWeight(a);
                            });

                        if (cls.length > 0) {
                            // [修正] 僅取權重最高的 2 個類名，並確保轉義
                            return `${tag}.${cls
                                .slice(0, 2)
                                .map((c) => CSS.escape(c))
                                .join(".")}`;
                        }

                        // [新增] 如果沒有類名，嘗試尋找關鍵屬性作為替代
                        const importantAttrs = ['role', 'itemprop', 'aria-label'];
                        for (let attr of importantAttrs) {
                            let val = el.getAttribute(attr);
                            if (val) return `${tag}[${attr}="${CSS.escape(val)}"]`;
                        }

                        let parentSel = getGeneralSelector(el.parentElement);
                        if (parentSel) return `${parentSel} > ${tag}`;
                        return tag;
                    };

                    let visualUpdateLoop = null;
                    const updateFocus = (el) => {
                        if (
                            !el ||
                            el === document ||
                            el === document.body ||
                            el === document.documentElement
                        )
                            return;
                        currentFocusEl = el;
                        activeOutlineBoxes.forEach((item) =>
                            item.box ? item.box.remove() : item.remove(),
                        );
                        activeOutlineBoxes = [];

                        let sel = getGeneralSelector(el);
                        let targets = [];
                        try {
                            targets = sel ? Array.from(document.querySelectorAll(sel)) : [el];
                        } catch (e) {
                            targets = [el];
                        }
                        if (targets.length === 0) targets = [el];

                        targets.forEach((targetEl) => {
                            let box = document.createElement("div");
                            let isMain = targetEl === el;

                            let isValid = true;
                            let invalidReason = "";
                            if (
                                ["IMG", "PICTURE", "VIDEO", "SVG", "CANVAS"].includes(
                                    targetEl.tagName.toUpperCase(),
                                )
                            ) {
                                isValid = false;
                                invalidReason = txt.ve1;
                            } else if (
                                targetEl.offsetWidth < 20 ||
                                targetEl.offsetHeight < 20
                            ) {
                                isValid = false;
                                invalidReason = txt.ve2;
                            } else if (activeOverlayBars && activeOverlayBars.has(targetEl)) {
                                isValid = false;
                                invalidReason = txt.ve3 || "ALREADY TRACKED";
                            }

                            let borderColor = isValid ? "#00F0FF" : "#FF3333";
                            let shadowColor = isValid
                                ? "rgba(0,240,255,0.8)"
                                : "rgba(255,51,51,0.8)";
                            let insetColor = isValid
                                ? "rgba(0,240,255,0.4)"
                                : "rgba(255,51,51,0.4)";
                            let borderStyle = isValid ? "solid" : "dashed";

                            box.style.cssText = `position:fixed; pointer-events:none; z-index:${isMain ? 2147483648 : 2147483647}; border:4px ${borderStyle} ${borderColor}; box-shadow:0 0 15px ${shadowColor}, inset 0 0 15px ${insetColor}; opacity:${isMain ? "1" : "0.6"}; transition: all 0.1s ease-out;`;

                            if (isMain) {
                                let label = document.createElement("div");
                                if (!isValid) {
                                    label.style.cssText =
                                        "position:absolute; top:-36px; left:-6px; background:#FF3333; color:#fff; font-size:14px; font-weight:bold; padding:6px 12px; border-radius:6px; white-space:nowrap; pointer-events:none; box-shadow:0 4px 8px rgba(0,0,0,0.5); font-family:sans-serif; letter-spacing:0.5px; transition: transform 0.15s ease-out; transform-origin: left bottom;";
                                    safeInject(label, invalidReason);
                                } else {
                                    label.style.cssText =
                                        "position:absolute; top:-36px; left:-6px; background:#10b981; color:#fff; font-size:14px; font-weight:bold; padding:6px 12px; border-radius:6px; white-space:nowrap; pointer-events:none; box-shadow:0 4px 8px rgba(0,0,0,0.5); font-family:sans-serif; letter-spacing:0.5px; transition: transform 0.15s ease-out; transform-origin: left bottom;";
                                    safeInject(label, txt.vok);
                                }
                                box.appendChild(label);
                            }

                            let rect = targetEl.getBoundingClientRect();
                            box.style.top = rect.top + "px";
                            box.style.left = rect.left + "px";
                            box.style.width = rect.width + "px";
                            box.style.height = rect.height + "px";
                            document.body.appendChild(box);
                            activeOutlineBoxes.push({ box: box, el: targetEl });
                        });

                        if (!visualUpdateLoop) {
                            let _outlineLastSync = 0; // [效能優化] 節流框線同步至 ~10fps
                            const loop = () => {
                                const _now = Date.now();
                                if (_now - _outlineLastSync >= 100) {
                                    _outlineLastSync = _now;
                                    activeOutlineBoxes.forEach((item) => {
                                        if (item.el && item.box) {
                                            let rect = item.el.getBoundingClientRect();
                                            item.box.style.top = rect.top + "px";
                                            item.box.style.left = rect.left + "px";
                                            item.box.style.width = rect.width + "px";
                                            item.box.style.height = rect.height + "px";
                                        }
                                    });
                                }
                                visualUpdateLoop = requestAnimationFrame(loop);
                            };
                            visualUpdateLoop = requestAnimationFrame(loop);
                        }
                    };

                    let overlayUi = null;
                    let ui = null;

                    const closeVisualMode = () => {
                        // [新增] 離開視覺模式時，清除滾動監聽
                        if (window._vtScrollHandler) {
                            window.removeEventListener("scroll", window._vtScrollHandler, true);
                            window._vtScrollHandler = null;
                        }

                        // [新增] 離開視覺模式時：恢復進度條
                        document.querySelectorAll(".vt-progress-container").forEach(el => el.classList.remove("vt-ghost"));

                        if (visualUpdateLoop) {
                            cancelAnimationFrame(visualUpdateLoop);
                            visualUpdateLoop = null;
                        }
                        if (_fakeBarSyncLoop) { // [BUG 修復] 關閉視覺模式時同步取消 fakeBar rAF
                            cancelAnimationFrame(_fakeBarSyncLoop);
                            _fakeBarSyncLoop = null;
                        }
                        activeOutlineBoxes.forEach((item) =>
                            item.box ? item.box.remove() : item.remove(),
                        );
                        activeOutlineBoxes = [];
                        if (overlayUi) overlayUi.remove();
                        document.removeEventListener("keydown", keydownHandler, true);
                    };

                    const keydownHandler = (e) => {
                        if (
                            [
                                "ArrowUp",
                                "ArrowDown",
                                "ArrowLeft",
                                "ArrowRight",
                                "Enter",
                                "Escape",
                            ].includes(e.key)
                        ) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        if (e.key === "Escape") {
                            closeVisualMode();
                        } else if (e.key === "ArrowUp") {
                            if (
                                currentFocusEl.parentElement &&
                                currentFocusEl.parentElement !== document.body
                            ) {
                                historyStack.push(currentFocusEl);
                                updateFocus(currentFocusEl.parentElement);
                            }
                        } else if (e.key === "ArrowDown") {
                            if (historyStack.length > 0) {
                                updateFocus(historyStack.pop());
                            } else if (currentFocusEl.firstElementChild) {
                                historyStack.push(currentFocusEl);
                                updateFocus(currentFocusEl.firstElementChild);
                            }
                        } else if (e.key === "ArrowLeft") {
                            if (currentFocusEl.previousElementSibling) {
                                historyStack = [];
                                updateFocus(currentFocusEl.previousElementSibling);
                            }
                        } else if (e.key === "ArrowRight") {
                            if (currentFocusEl.nextElementSibling) {
                                historyStack = [];
                                updateFocus(currentFocusEl.nextElementSibling);
                            }
                        } else if (e.key === "Enter") {
                            let isValid =
                                !["IMG", "PICTURE", "VIDEO", "SVG", "CANVAS"].includes(
                                    currentFocusEl.tagName.toUpperCase(),
                                ) &&
                                currentFocusEl.offsetWidth >= 20 &&
                                currentFocusEl.offsetHeight >= 20;
                            if (!isValid) {
                                let label = activeOutlineBoxes.find(
                                    (b) => b.el === currentFocusEl,
                                )?.box?.firstChild;
                                if (label) {
                                    label.style.transform = "scale(1.1)";
                                    setTimeout(() => (label.style.transform = "scale(1)"), 150);
                                }
                                return;
                            }

                            finalTargetSelector = getGeneralSelector(currentFocusEl);
                            closeVisualMode();
                            showMainPanel();
                        }
                    };

                    let _fakeBarSyncLoop = null;
                    const _syncFakeBars = () => {
                        // [效能修復] 問題 4：採用與 syncOverlay 相同的 Read-Write Batching 模式
                        // 原版在 forEach 內部交替 getBoundingClientRect (Read) 與 style.top= (Write)，
                        // 多個 bar 時觸發瀏覽器強制同步佈局 (Layout Thrashing)。
                        // 新版：先集中所有 READ，再集中所有 WRITE，徹底分離兩個階段。
                        const bars = Array.from(document.querySelectorAll('.vt-fake-bar'));
                        if (bars.length === 0) { _fakeBarSyncLoop = null; return; }

                        // --- 階段 1：集中所有 READ ---
                        const updates = bars.map(bar => ({
                            bar,
                            rect: (bar._targetEl && bar._targetEl.isConnected)
                                ? bar._targetEl.getBoundingClientRect()
                                : null
                        }));

                        // --- 階段 2：集中所有 WRITE (加入髒值偵測) ---
                        updates.forEach(({ bar, rect }) => {
                            if (!rect) { bar.remove(); return; }
                            const prev = bar._lastRect;
                            const changed = !prev || prev.top !== rect.top || prev.left !== rect.left || prev.width !== rect.width || prev.height !== rect.height;
                            if (changed) {
                                bar.style.top = rect.top + 'px';
                                bar.style.left = rect.left + 'px';
                                bar.style.width = rect.width + 'px';
                                bar.style.height = rect.height + 'px';
                                bar._lastRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
                            }
                        });

                        _fakeBarSyncLoop = requestAnimationFrame(_syncFakeBars);
                    };

                    const renderUIBars = () => {
                        document
                            .querySelectorAll(".vt-fake-bar")
                            .forEach((e) => e.remove());
                        if (!finalTargetSelector) return;
                        document.querySelectorAll(finalTargetSelector).forEach((el) => {
                            if (
                                el.closest(
                                    "video, .plyr, .video-js, .fluid_video_wrapper, #player, .player, .vjs-tech, .jwplayer",
                                )
                            )
                                return;

                            let target = ["IMG", "PICTURE", "VIDEO"].includes(el.tagName)
                                ? el.parentElement
                                : el;
                            if (!target) return;
                            if (target.offsetWidth < 20 || target.offsetHeight < 40) return;

                            let aTag =
                                el.tagName === "A"
                                    ? el
                                    : el.closest("a") || el.querySelector("a");
                            
                            // [架構師升級] 表親雷達 (Cousin Radar)：針對 Odysee 這類 <a> 標籤與縮圖平行的結構
                            if (!aTag) {
                                let p = el.parentElement;
                                for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
                                    aTag = p.querySelector("a");
                                    if (aTag) break;
                                }
                            }

                            let displayId = `WAITING...`;
                            if (window._vtSelectedTarget) {
                                let detectedRule = window._vtDetectedUrlRule;
                                if (!detectedRule) {
                                    let trainUrl = document
                                        .getElementById("vt-train-url")
                                        ?.value?.trim();
                                    if (trainUrl)
                                        detectedRule = autoDetectUrlRule(
                                            trainUrl,
                                            window._vtSelectedTarget,
                                        );
                                }
                                if (detectedRule) {
                                    let extracted =
                                        aTag && aTag.href
                                            ? extractIdByUrlRule(aTag.href, detectedRule)
                                            : null;
                                    if (extracted) {
                                        displayId = extracted;
                                    } else {
                                        // [架構師修正] 傳入目前正在比對的 targetId (鑰匙)，執行嚴格的真理比對
                                        let deep = deepScanForId(target, detectedRule, window._vtSelectedTarget);
                                        displayId = deep ? deep : `WAITING...`;
                                    }
                                } else {
                                    displayId = `WAITING...`;
                                }
                            }
                            const bar = document.createElement("div");
                            bar.className = "vt-fake-bar";
                            bar._targetEl = target;
                            let computedZ = window.getComputedStyle(target).zIndex;
                            let targetZ =
                                computedZ === "auto" || isNaN(computedZ)
                                    ? 1
                                    : parseInt(computedZ) + 1;
                            bar.style.cssText = `position:fixed;pointer-events:none;z-index:${targetZ};`;

                            let cHex = res.barColor || "#ff0000";
                            
                            const barBg = document.createElement("div");
                            barBg.style.cssText = "position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(255,255,255,0.35) !important;box-shadow:0 -1px 3px rgba(0,0,0,0.6) !important;pointer-events:none;";
                            const barFill = document.createElement("div");
                            barFill.style.cssText = `height:100%;width:50%;background:${cHex} !important;`;
                            barBg.appendChild(barFill);
                            
                            const idLabel = document.createElement("span");
                            idLabel.style.cssText = "position:absolute;bottom:6px;left:2px;font-size:11px;color:#ff0;background:rgba(0,0,0,0.9);padding:3px;border-radius:2px;pointer-events:none;white-space:nowrap;line-height:1;font-weight:bold;";
                            idLabel.textContent = `ID: ${displayId}`;
                            
                            bar.appendChild(barBg);
                            bar.appendChild(idLabel);
                            document.body.appendChild(bar);
                        });
                        if (!_fakeBarSyncLoop)
                            _fakeBarSyncLoop = requestAnimationFrame(_syncFakeBars);
                    };

                    const showMainPanel = () => {
                        // [CWS 安全修復] 問題 1：消滅 showMainPanel 的巨型 innerHTML template literal。
                        // 使用 DOM API 分段建構面板，確保所有靜態文字透過 textContent 賦值，
                        // 徹底消除 CWS 靜態分析對 innerHTML + template literal 的 XSS 誤標風險。
                        ui = document.createElement("div");

                        // --- 外層固定面板 (靜態結構，不含任何動態值) ---
                        const panel = document.createElement('div');
                        panel.style.cssText = 'position:fixed;bottom:30px;right:30px;width:380px;background:#1e1e1e;color:#fff;padding:18px;z-index:2147483647;border:1px solid #444;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.9);font-family:sans-serif;';

                        // 標題
                        const title = document.createElement('div');
                        title.style.cssText = 'margin-bottom:14px;color:#ffd700;font-weight:bold;font-size:18px;text-align:center;letter-spacing:1px;';
                        title.textContent = txt.t1;
                        panel.appendChild(title);

                        // 選擇器鎖定區塊
                        const lockBox = document.createElement('div');
                        lockBox.style.cssText = 'background:#2a2a2a;padding:12px;border-radius:8px;margin-bottom:12px;';
                        const lockLabel = document.createElement('div');
                        lockLabel.style.cssText = 'color:#ffd700;font-size:15px;margin-bottom:8px;font-weight:bold;';
                        lockLabel.textContent = txt.t_lock;
                        // [安全] finalTargetSelector 是 CSS selector，用 textContent 賦值確保無 XSS 風險
                        const lockVal = document.createElement('div');
                        lockVal.style.cssText = 'color:#00e676;font-size:13px;font-family:monospace;background:#111;padding:8px;border-radius:6px;word-break:break-all;';
                        lockVal.textContent = finalTargetSelector;
                        lockBox.appendChild(lockLabel);
                        lockBox.appendChild(lockVal);
                        panel.appendChild(lockBox);

                        // URL 訓練區塊
                        const urlBox = document.createElement('div');
                        urlBox.style.cssText = 'background:#2a2a2a;padding:12px;border-radius:8px;margin-bottom:12px;';
                        const urlLabel = document.createElement('div');
                        urlLabel.style.cssText = 'color:#ffd700;font-size:15px;margin-bottom:8px;font-weight:bold;';
                        urlLabel.textContent = txt.t2;
                        const urlInput = document.createElement('input');
                        urlInput.id = 'vt-train-url'; urlInput.type = 'text'; urlInput.autocomplete = 'off';
                        urlInput.style.cssText = 'width:100%;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:6px;box-sizing:border-box;font-size:15px;';
                        urlInput.placeholder = 'https://';
                        urlBox.appendChild(urlLabel); urlBox.appendChild(urlInput);
                        panel.appendChild(urlBox);

                        // ID 偵測區塊
                        const idBox = document.createElement('div');
                        idBox.style.cssText = 'background:#2a2a2a;padding:12px;border-radius:8px;margin-bottom:12px;';
                        const idLabel = document.createElement('div');
                        idLabel.style.cssText = 'color:#ffd700;font-size:15px;margin-bottom:8px;font-weight:bold;';
                        idLabel.textContent = txt.t_id;
                        const idInput = document.createElement('input');
                        idInput.id = 'vt-id-input'; idInput.type = 'text'; idInput.autocomplete = 'off';
                        idInput.style.cssText = 'width:100%;padding:9px 10px;background:#111;color:#fff;border:1px solid #555;border-radius:6px;box-sizing:border-box;font-size:15px;font-family:monospace;';
                        idInput.placeholder = txt.p_id;
                        const optsWrapEl = document.createElement('div');
                        optsWrapEl.id = 'vt-opts-wrap'; optsWrapEl.style.display = 'none'; optsWrapEl.style.marginTop = '10px';
                        const optsEl = document.createElement('div');
                        optsEl.id = 'vt-opts'; optsEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
                        optsWrapEl.appendChild(optsEl);
                        const detectResultEl = document.createElement('div');
                        detectResultEl.id = 'vt-detect-result'; detectResultEl.style.cssText = 'margin-top:8px;min-height:18px;';
                        const rawValEl = document.createElement('span');
                        rawValEl.id = 'vt-raw-val'; rawValEl.style.display = 'none'; rawValEl.textContent = '...';
                        const previewValEl = document.createElement('span');
                        previewValEl.id = 'vt-preview-val'; previewValEl.style.display = 'none'; previewValEl.textContent = '...';
                        const splitCharEl = document.createElement('input');
                        splitCharEl.id = 'vt-split-char'; splitCharEl.type = 'hidden'; splitCharEl.value = '';
                        const splitIdxEl = document.createElement('select');
                        splitIdxEl.id = 'vt-split-idx'; splitIdxEl.style.display = 'none';
                        const defOpt = document.createElement('option'); defOpt.value = '-1'; defOpt.selected = true;
                        splitIdxEl.appendChild(defOpt);
                        idBox.appendChild(idLabel); idBox.appendChild(idInput); idBox.appendChild(optsWrapEl);
                        idBox.appendChild(detectResultEl); idBox.appendChild(rawValEl); idBox.appendChild(previewValEl);
                        idBox.appendChild(splitCharEl); idBox.appendChild(splitIdxEl);
                        panel.appendChild(idBox);

                        // 儲存按鈕區塊
                        const saveDefs = [
                            { id: 'vt-save-0', bg: '#10b981', label: txt.b1, sub: txt.s1 },
                            { id: 'vt-save-1', bg: '#0ea5e9', label: txt.b2, sub: txt.s2 },
                            { id: 'vt-save-2', bg: '#8b5cf6', label: txt.b3, sub: txt.s3 },
                            { id: 'vt-save-3', bg: '#f59e0b', label: txt.b4, sub: txt.s4 },
                        ];
                        const saveBox = document.createElement('div');
                        saveBox.style.cssText = 'background:#2a2a2a;padding:12px;border-radius:8px;';
                        const saveTitle = document.createElement('div');
                        saveTitle.style.cssText = 'color:#ffd700;font-size:15px;margin-bottom:8px;font-weight:bold;';
                        saveTitle.textContent = txt.t5;
                        const grid = document.createElement('div');
                        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;';
                        saveDefs.forEach(def => {
                            const btn = document.createElement('button');
                            btn.id = def.id;
                            btn.style.cssText = `padding:10px;background:${def.bg};color:#fff;text-shadow:1px 1px 2px rgba(0,0,0,0.8);border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.5);`;
                            btn.textContent = def.label;
                            const subSpan = document.createElement('span');
                            subSpan.style.cssText = 'font-size:11px;opacity:0.9;display:block;';
                            subSpan.textContent = def.sub;
                            btn.appendChild(subSpan);
                            grid.appendChild(btn);
                        });
                        const cancelBtn = document.createElement('button');
                        cancelBtn.id = 'vt-cancel';
                        cancelBtn.style.cssText = 'width:100%;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.5);';
                        cancelBtn.textContent = txt.c;
                        saveBox.appendChild(saveTitle); saveBox.appendChild(grid); saveBox.appendChild(cancelBtn);
                        panel.appendChild(saveBox);

                        const msgEl2 = document.createElement('div');
                        msgEl2.id = 'vt-msg';
                        msgEl2.style.cssText = 'margin-top:12px;font-size:15px;font-weight:bold;text-align:center;';
                        panel.appendChild(msgEl2);

                        ui.appendChild(panel);
                        document.body.appendChild(ui);
                        document.getElementById("vt-cancel").onclick = () => {
                            ui.remove();
                            document
                                .querySelectorAll(".vt-fake-bar")
                                .forEach((e) => e.remove());
                        };

                        const renderOpts = () => {
                            const msgEl = document.getElementById("vt-msg");
                            let url = document.getElementById("vt-train-url").value.trim();
                            const optsContainer = document.getElementById("vt-opts");
                            const detectResult = document.getElementById("vt-detect-result");

                            optsContainer.textContent = "";
                            if (detectResult) detectResult.textContent = "";
                            window._vtSelectedTarget = null;
                            window._vtDetectedUrlRule = null;
                            const setMsg = (text, color) => {
                                msgEl.textContent = "";
                                const s = document.createElement("span");
                                s.style.color = color;
                                s.textContent = text;
                                msgEl.appendChild(s);
                            };

                            if (!url) {
                                setMsg(txt.h1, "#f59e0b");
                                return;
                            }

                            let u;
                            try {
                                u = new URL(url);
                            } catch (e) {
                                setMsg(txt.e_url, "#ff5252");
                                return;
                            }

                            const BLACKLIST =
                                /^(www|http|https|video|videos|view|embed|watch|playlist|php|html|static|cdn|assets|api|index|m|mobile|en|zh|de|fr|es|ja|ko)$/i;
                            const domainName = location.hostname
                                .replace(/^(www\.|m\.)/i, "")
                                .split(".")[0]
                                .toLowerCase();

                            const refItems = [];
                            u.searchParams.forEach((val, key) => {
                                if (!val || val.length < 2) return;
                                refItems.push({
                                    label: val,
                                    value: val,
                                    hint: `?${key}`,
                                    isQuery: true,
                                    key,
                                });
                            });

                            const segs = u.pathname
                                .split("/")
                                .filter(
                                    (s) =>
                                        s &&
                                        s.length > 1 &&
                                        !BLACKLIST.test(s) &&
                                        s.toLowerCase() !== domainName,
                                );
                            segs.forEach((seg, i) => {
                                refItems.push({
                                    label: seg,
                                    value: seg,
                                    hint: `Path ${i + 1}`,
                                    isLast: i === segs.length - 1,
                                });
                            });

                            const hash = u.hash.replace("#", "");
                            if (hash && hash.length >= 2)
                                refItems.push({ label: hash, value: hash, hint: "Hash" });

                            let autoCandidate = null;
                            const vParam = u.searchParams.get("v");
                            if (vParam && vParam.length >= 2) {
                                autoCandidate = vParam;
                            } else if (refItems.some((r) => r.isQuery)) {
                                autoCandidate = refItems.find((r) => r.isQuery)?.value || null;
                            } else if (segs.length > 0) {
                                autoCandidate = segs[segs.length - 1];
                            }

                            const idInput = document.getElementById("vt-id-input");
                            if (!idInput) return;

                            const newInput = idInput.cloneNode(true);
                            idInput.parentNode.replaceChild(newInput, idInput);

                            if (autoCandidate && !newInput.value.trim()) {
                                newInput.value = autoCandidate;
                            }

                            const runDetect = () => {
                                const typedId = newInput.value.trim();
                                const detectEl = document.getElementById("vt-detect-result");
                                if (!detectEl) return;

                                if (!typedId) {
                                    detectEl.textContent = "";
                                    window._vtSelectedTarget = null;
                                    window._vtDetectedUrlRule = null;
                                    const rawEl = document.getElementById("vt-raw-val");
                                    if (rawEl) rawEl.innerText = "...";
                                    renderUIBars();
                                    return;
                                }

                                if (typedId.length < 3) {
                                    detectEl.textContent = "";
                                    const waitBox = document.createElement("div");
                                    waitBox.style.cssText = "background:#1a1a00;border:1.5px solid #888;border-radius:8px;padding:10px 12px;margin-top:6px;";
                                    const waitTxt = document.createElement("div");
                                    waitTxt.style.cssText = "color:#aaa;font-size:14px;";
                                    waitTxt.textContent = txt.e_wait;
                                    waitBox.appendChild(waitTxt);
                                    detectEl.appendChild(waitBox);

                                    window._vtSelectedTarget = null;
                                    window._vtDetectedUrlRule = null;
                                    renderUIBars();
                                    return;
                                }

                                const rule = autoDetectUrlRule(url, typedId);
                                const extractedCheck = rule
                                    ? extractIdByUrlRule(url, rule)
                                    : null;
                                const isExactMatch =
                                    extractedCheck &&
                                    extractedCheck.toLowerCase() === typedId.toLowerCase();

                                if (rule && isExactMatch) {
                                    window._vtSelectedTarget = typedId;
                                    window._vtDetectedUrlRule = rule;

                                    const rawEl = document.getElementById("vt-raw-val");
                                    const splitCharEl = document.getElementById("vt-split-char");
                                    const splitIdxEl = document.getElementById("vt-split-idx");
                                    if (rawEl) rawEl.innerText = typedId;
                                    if (splitCharEl) splitCharEl.value = rule.sep || "";
                                    if (splitIdxEl)
                                        splitIdxEl.value = String(
                                            rule.sepIdx !== undefined ? rule.sepIdx : -1,
                                        );

                                    // [架構師重構] 全面消滅字串拼接，改用 shared_i18n.js 的參數化字串替換
                                    let loc = "";
                                    let idxText =
                                        rule.idx < 0
                                            ? getLangText(lang, "idx_last", {
                                                num: Math.abs(rule.idx),
                                            })
                                            : getLangText(lang, "idx_first", { num: rule.idx + 1 });

                                    if (rule.type === "q") {
                                        loc = getLangText(lang, "loc_q", { key: rule.key });
                                    } else if (rule.type === "p") {
                                        let sepStr = rule.sep
                                            ? getLangText(lang, "loc_path_sep", {
                                                sep: rule.sep,
                                                sepIdx: Math.abs(rule.sepIdx || -1),
                                            })
                                            : "";
                                        loc = getLangText(lang, "loc_path", {
                                            idx: idxText,
                                            sepStr: sepStr,
                                        });
                                    } else if (rule.type === "hash") {
                                        loc = getLangText(lang, "loc_hash");
                                    } else if (rule.type === "hash_path") {
                                        loc = getLangText(lang, "loc_hash_path", { idx: idxText });
                                    } else if (rule.type === "flank") {
                                        loc = getLangText(lang, "loc_flank", {
                                            left: rule.left || "Start",
                                            right: rule.right || "End",
                                        });
                                    }

                                    // [架構師修復] 單一真理來源 (Single Source of Truth)
                                    // 捨棄雙重預檢邏輯，先呼叫 renderUIBars() 渲染黃色進度條標籤，
                                    // 然後回去讀取標籤上的結果。這樣 UI 警告與實際畫面的抓取邏輯將達到 100% 同步！
                                    renderUIBars();
                                    
                                    let existsInThumb = false;
                                    let baseNode = currentFocusEl.closest(finalTargetSelector) || currentFocusEl;
                                    let expectedTarget = ["IMG", "PICTURE", "VIDEO"].includes(baseNode.tagName) ? baseNode.parentElement : baseNode;
                                    
                                    document.querySelectorAll(".vt-fake-bar").forEach(bar => {
                                        if (bar._targetEl === expectedTarget || bar._targetEl === baseNode || bar._targetEl?.contains(currentFocusEl)) {
                                            if (bar.innerText.toLowerCase().includes(typedId.toLowerCase())) {
                                                existsInThumb = true;
                                            }
                                        }
                                    });

                                    // [架構師重構] 當 ID 確實存在於縮圖中時，立即在此計算並站存 tRule，確保「所見即所得」
                                    window._vtDetectedThumbRule = null;
                                    if (existsInThumb) {
                                        let tRule = null;
                                        let curr = currentFocusEl.closest(finalTargetSelector) || currentFocusEl;
                                        for (let i = 0; i <= 5 && curr; i++, curr = curr.parentElement) {
                                            for (let attr of curr.attributes) {
                                                if (!attr.value || attr.value.length < 3) continue;
                                                // [CWS 安全修復] 問題 2：屬性值傳入 URL 解析前，強制過濾 javascript:/data: 偽協議
                                                const safeAttrVal = sanitizeAttrAsUrl(attr.value);
                                                if (!safeAttrVal) continue;
                                                let testUrl = safeAttrVal.startsWith("http") || safeAttrVal.startsWith("/") ? safeAttrVal : `https://x.com/v/${safeAttrVal}`;
                                                let tCandidateRule = autoDetectUrlRule(testUrl, typedId);
                                                if (tCandidateRule) {
                                                    tRule = { ...tCandidateRule, targetAttr: attr.name, upLevel: i };
                                                    break;
                                                }
                                            }
                                            if (tRule) break;
                                        }
                                        window._vtDetectedThumbRule = tRule || rule;
                                    }

                                    detectEl.textContent = "";
                                    const okBox = document.createElement("div");
                                    okBox.style.cssText = "background:#1a1100;border:1.5px solid #ff9800;border-radius:8px;padding:10px 12px;margin-top:6px;";
                                    
                                    const locDiv = document.createElement("div");
                                    locDiv.style.cssText = "color:#ffb74d;font-size:14px;font-weight:bold;margin-bottom:6px;";
                                    safeInject(locDiv, `${getLangText(lang, "l_ok")} ${loc}`);
                                    okBox.appendChild(locDiv);

                                    const idDiv = document.createElement("div");
                                    idDiv.style.cssText = "color:#ffd740;font-family:monospace;font-size:18px;font-weight:bold;word-break:break-all;letter-spacing:0.5px;";
                                    idDiv.textContent = typedId;
                                    okBox.appendChild(idDiv);

                                    if (!existsInThumb) {
                                        const warnDiv = document.createElement("div");
                                        warnDiv.style.cssText = "color:#ff5252; font-size:12px; margin-top:8px; font-weight:bold; border-top:1px dashed #5d4037; padding-top:8px; line-height:1.4;";
                                        warnDiv.textContent = getLangText(lang, "warn_id_mismatch");
                                        okBox.appendChild(warnDiv);
                                    }
                                    detectEl.appendChild(okBox);

                                    if (typeof updatePreview === "function") updatePreview();
                                } else {
                                    window._vtSelectedTarget = null;
                                    window._vtDetectedUrlRule = null;

                                    detectEl.textContent = "";
                                    const errBox = document.createElement("div");
                                    errBox.style.cssText = "background:#200808;border:1.5px solid #e53935;border-radius:8px;padding:10px 12px;margin-top:6px;";
                                    
                                    const errMsg = document.createElement("div");
                                    safeInject(errMsg, getLangText(lang, "err_not_found", { id: escapeHtml(typedId) }));
                                    errBox.appendChild(errMsg);

                                    if (rule) {
                                        const hintMsg = document.createElement("div");
                                        safeInject(hintMsg, getLangText(lang, "err_hint", { ex: escapeHtml(extractedCheck || "?") }));
                                        errBox.appendChild(hintMsg);
                                    }
                                    detectEl.appendChild(errBox);
                                    
                                    renderUIBars();
                                }
                            };

                            newInput.addEventListener("input", runDetect);
                            runDetect();

                            const optsWrap = document.getElementById("vt-opts-wrap");
                            if (refItems.length > 0) {
                                if (optsWrap) optsWrap.style.display = "block";
                                refItems.forEach((item) => {
                                    const isRecommended = item.value === autoCandidate;
                                    const tag = document.createElement("span");
                                    tag.title = item.value;
                                    tag.style.cssText =
                                        `display:inline-flex;align-items:center;gap:6px;border-radius:6px;padding:5px 12px;font-size:15px;font-family:monospace;cursor:pointer;user-select:none;transition:all 0.12s;max-width:100%;box-sizing:border-box;` +
                                        (isRecommended
                                            ? "background:#1a1100;border:1.5px solid #ff9800;color:#ffd740;"
                                            : "background:#2d2d2d;border:1px solid #555;color:#ccc;");
                                    const textSpan = document.createElement("span");
                                    textSpan.textContent = item.value;
                                    textSpan.style.cssText =
                                        "font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;display:inline-block;vertical-align:middle;font-size:15px;";
                                    tag.appendChild(textSpan);
                                    if (isRecommended) {
                                        const badge = document.createElement("span");
                                        badge.textContent = txt.o_rec;
                                        badge.style.cssText =
                                            "font-size:12px;color:#ff9800;font-family:sans-serif;white-space:nowrap;flex-shrink:0;font-weight:bold;";
                                        tag.appendChild(badge);
                                    }
                                    tag.onmouseenter = () => {
                                        tag.style.background = isRecommended
                                            ? "#261800"
                                            : "#3a3a3a";
                                        tag.style.borderColor = isRecommended ? "#ffb74d" : "#888";
                                    };
                                    tag.onmouseleave = () => {
                                        tag.style.background = isRecommended
                                            ? "#1a1100"
                                            : "#2d2d2d";
                                        tag.style.borderColor = isRecommended ? "#ff9800" : "#555";
                                    };
                                    tag.onclick = () => {
                                        const inp = document.getElementById("vt-id-input");
                                        if (inp) {
                                            inp.value = item.value;
                                            inp.dispatchEvent(new Event("input"));
                                            inp.focus();
                                        }
                                    };
                                    optsContainer.appendChild(tag);
                                });
                            } else {
                                if (optsWrap) optsWrap.style.display = "none";
                            }
                        };

                        document
                            .getElementById("vt-train-url")
                            .addEventListener("input", renderOpts);

                        const updatePreview = () => {
                            let raw = document.getElementById("vt-raw-val").innerText;
                            if (raw === "...") return;
                            let sepInput = document.getElementById("vt-split-char");
                            let idxSelect = document.getElementById("vt-split-idx");
                            let sep = sepInput.value || "";
                            if (!sep) {
                                idxSelect.disabled = true;
                                idxSelect.style.opacity = "0.5";
                                if (!idxSelect.dataset.orig)
                                    idxSelect.dataset.orig = idxSelect.innerHTML;
                                safeInject(idxSelect, `<option value="0">${txt.o_no}</option>`);
                            } else {
                                idxSelect.disabled = false;
                                idxSelect.style.opacity = "1";
                                if (idxSelect.dataset.orig) {
                                    safeInject(idxSelect, idxSelect.dataset.orig);
                                    delete idxSelect.dataset.orig;
                                }
                            }
                            let idx = parseInt(idxSelect.value) || 0;
                            let res = raw;
                            if (sep && raw.includes(sep)) {
                                let pts = raw.split(sep);
                                res =
                                    pts[
                                    idx < 0 ? pts.length + idx : Math.min(idx, pts.length - 1)
                                    ] || raw;
                            }
                            document.getElementById("vt-preview-val").innerText = res;
                        };
                        document
                            .getElementById("vt-split-char")
                            .addEventListener("input", updatePreview);
                        document
                            .getElementById("vt-split-idx")
                            .addEventListener("change", updatePreview);

                        const executeSave = (slotIndex) => {
                            const msgEl = document.getElementById("vt-msg");
                            const setSaveMsg = (text, color) => {
                                msgEl.textContent = "";
                                const s = document.createElement("span");
                                s.style.color = color;
                                s.textContent = text;
                                msgEl.appendChild(s);
                            };

                            let url = document.getElementById("vt-train-url").value.trim();
                            if (!url) return setSaveMsg(txt.h1, "#f59e0b");
                            
                            let targetId = window._vtSelectedTarget;
                            if (!targetId) return setSaveMsg(txt.h2, "#f59e0b");
                            
                            let finalUrlRule = window._vtDetectedUrlRule || autoDetectUrlRule(url, targetId);
                            if (!finalUrlRule) return setSaveMsg(txt.err2, "#ff5252");
                            const manualSep = document.getElementById("vt-split-char").value;
                            const manualIdx = parseInt(
                                document.getElementById("vt-split-idx").value,
                            );
                            if (manualSep)
                                finalUrlRule = {
                                    ...finalUrlRule,
                                    sep: manualSep,
                                    sepIdx: isNaN(manualIdx) ? -1 : manualIdx,
                                };
                            else if (finalUrlRule.sep)
                                finalUrlRule = {
                                    type: finalUrlRule.type,
                                    key: finalUrlRule.key,
                                    idx: finalUrlRule.idx,
                                };
                            window._vtDetectedUrlRule = null;

                            chrome.storage.local.get(
                                ["site_config", "enabledSites"],
                                (res) => {
                                    let d = getBaseDomain(location.hostname);
                                    let config = res.site_config || {};
                                    let arr = Array.isArray(config[d])
                                        ? config[d]
                                        : config[d]
                                            ? [config[d]]
                                            : [];
                                    while (arr.length < 4) arr.push(null);
                                    if (
                                        arr[slotIndex] &&
                                        (arr[slotIndex].urlRule || arr[slotIndex].pRule)
                                    ) {
                                        if (!confirm(`${txt.cf1}${slotIndex + 1}${txt.cf2}`))
                                            return;
                                    }
                                    let curHosts = (arr[slotIndex] && arr[slotIndex].hosts) || [];
                                    if (!curHosts.includes(location.hostname))
                                        curHosts.push(location.hostname);
                                    
                                    // [架構師優化] 直接沿用在 runDetect 階段預先計算好並鎖定的縮圖規則，不再重新掃描 DOM
                                    let tRule = window._vtDetectedThumbRule || finalUrlRule;
                                    
                                    arr[slotIndex] = {
                                        s: finalTargetSelector,
                                        pRule: finalUrlRule,
                                        tRule: tRule || finalUrlRule,
                                        hosts: curHosts,
                                    };
                                    config[d] = arr;
                                    let enabled = res.enabledSites || {};
                                    enabled[d] = true;
                                    window._vtIsTraining = true;
                                    chrome.storage.local.set(
                                        { site_config: config, enabledSites: enabled },
                                        () => {
                                            setSaveMsg(txt.ok, "#10b981");
                                            setTimeout(() => {
                                                window._vtIsTraining = false;
                                                location.reload();
                                            }, 2000);
                                        },
                                    );
                                },
                            );
                        };

                        document.getElementById("vt-save-0").onclick = () =>
                            executeSave(0);
                        document.getElementById("vt-save-1").onclick = () =>
                            executeSave(1);
                        document.getElementById("vt-save-2").onclick = () =>
                            executeSave(2);
                        document.getElementById("vt-save-3").onclick = () =>
                            executeSave(3);
                        renderUIBars();
                        setTimeout(renderOpts, 100);
                    };

                    const startVisualMode = () => {
                        document.addEventListener("keydown", keydownHandler, true);
                        
                        // [新增] 實作防抖的滾動監聽器
                        window._vtScrollHandler = () => {
                            if (window._vtScrollTimer) clearTimeout(window._vtScrollTimer);
                            window._vtScrollTimer = setTimeout(() => {
                                // 重新依照目前的焦點元素更新框線 (捕捉新載入的 DOM)
                                if (currentFocusEl && document.contains(currentFocusEl)) {
                                    updateFocus(currentFocusEl);
                                }
                            }, 200); // 停止滾動 200ms 後重新計算
                        };
                        // 使用 capture: true 確保能捕捉到內部 div 的滾動
                        window.addEventListener("scroll", window._vtScrollHandler, true); 

                        updateFocus(currentFocusEl);
                        overlayUi = document.createElement("div");
                        overlayUi.style.cssText =
                            "position:fixed;top:30px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:16px 24px;border-radius:12px;z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,0.8);border:1px solid #ff5252;display:flex;flex-direction:column;align-items:center;min-width:320px;font-family:sans-serif;pointer-events:none;";
                        safeInject(overlayUi, `<div style="font-size:16px;font-weight:bold;margin-bottom:8px;color:#ffd700;">${txt.vt}</div><div style="font-size:14px;line-height:1.6;color:#ccc;text-align:center;">${txt.v1}</div>`);
                        document.body.appendChild(overlayUi);
                    };
                    startVisualMode();
                },
            );
        }
        if (request.action === "RESET_BINDING") location.reload();
    });

    let sysState = {
        isStealth: true,
        activeVideoId: null,
        isDataLoaded: false,
        timer: null,
        currentDriver: null,
        _lastSave: 0,
        _activeEl: null,
        _lastUrl: null,
        _cachedId: null,
        _showMonitor: true,
        barColor: "#ff0000",
        _flashTimer: null,
        _actionTimer: null // [新增] 用於暫停與跳轉的統一防抖計時器
    };

    window.addEventListener("message", (e) => {
        if (!e.data || !/^(VT_SYNC|VT_SYNC_ACK)$/.test(e.data.type)) return;
        let isTrusted =
            e.source === window ||
            e.source === window.parent ||
            e.source === window.top;
            
        // [CWS 安全修復] PostMessage 零信任架構：正則白名單過濾
        if (!isTrusted) {
            if (!e.data.id || typeof e.data.id !== "string") return;
            const VT_ID_WHITELIST = /^[a-z0-9\-]{2,40}\/[a-zA-Z0-9\-_.%]{2,200}$/;
            if (!VT_ID_WHITELIST.test(e.data.id)) return;
        }

        if (e.data.type === "VT_SYNC" && e.data.id && window !== window.top) {
            sysState._cachedId = e.data.id;
            if (sysState.isStealth) {
                sysState.isStealth = false;
                sysState.isDataLoaded = true;
                sysState._showMonitor = false;
                startPlayerMonitor();
            }
        }
        if (e.data.type === "VT_SYNC_ACK" && window === window.top) {
            if (e.data.force) {
                if (sysState._flashTimer) clearTimeout(sysState._flashTimer); // [修復] 執行前先清除舊計時器
                updateDebugStatus("FLASH", `[${e.data.id}] m3s: ${e.data.pct}%`);
                sysState._flashTimer = setTimeout(() => {
                    if (sysState.activeVideoId === e.data.id)
                        updateDebugStatus("REC", `[${e.data.id}] ${e.data.pct}%`);
                }, 800);
            } else {
                updateDebugStatus("REC", `[${e.data.id}] ${e.data.pct}%`);
            }
        }
    });

    const getBaseDomain = (h) => {
        let pts = h.replace(/^(www\.|m\.|cn\.)/i, "").split(".");
        if (
            pts.length >= 3 &&
            ["com", "co", "net", "org", "edu", "gov"].includes(
                pts[pts.length - 2].toLowerCase(),
            )
        )
            return pts[pts.length - 3].toLowerCase();
        return pts.length >= 2
            ? pts[pts.length - 2].toLowerCase()
            : pts[0].toLowerCase();
    };

    const getUniversalId = (urlStr) => {
        try {
            const u = new URL(urlStr, window.location.origin);
            let host = getBaseDomain(u.hostname);
            for (let k of ["viewkey", "v"]) {
                if (u.searchParams.has(k))
                    return `${host}/${u.searchParams.get(k).toLowerCase()}`;
            }
            let xvMatch = u.pathname.match(/\/video[._]?([a-zA-Z0-9]{3,})/i);
            if (xvMatch) return `${host}/video${xvMatch[1].toLowerCase()}`;
            let segs = u.pathname.split("/").filter((s) => s.length > 0);
            let core = segs.pop() || "";
            core = core.replace(/\.(html|php|aspx)$/i, "").replace(/[-_]/g, "");
            if (/^(video|id|watch)$/.test(core) && segs.length > 0)
                core = segs.pop().replace(/[-_]/g, "") + core;
            return `${host}/${core}`.toLowerCase();
        } catch (e) {
            return urlStr.replace(/[-_]/g, "").toLowerCase();
        }
    };

    function detectSeparator(raw, target) {
        for (let sep of ["-", "_", ".", "+"]) {
            let pts = raw.split(sep);
            if (pts.findIndex((p) => p === target) !== -1)
                return { sep, sepIdx: pts.findIndex((p) => p === target) - pts.length };
        }
        return null;
    }

    // [新增] 動態特徵鎖生成器：分析訓練 ID，產生專屬的 Regex 白名單
    const generateGuardRegex = (targetId) => {
        if (!targetId || typeof targetId !== 'string') return null;
        const chars = new Set(targetId.split(''));
        let pattern = "";
        chars.forEach(c => {
            if (/[a-zA-Z0-9]/.test(c)) return; 
            // 轉義特殊字元，確保 Regex 安全性
            if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/.test(c)) {
                 pattern += "\\" + c;
            }
        });
        return `^[a-zA-Z0-9${pattern}]+$`;
    };

    // [強化] CWS 審查級別的 ID 校驗器
    function validateIdByGuard(id, guard) {
        if (!id || typeof id !== 'string') return false;
        
        // 1. 強制攔截：封殺所有潛在的腳本注入關鍵字 (XSS 防禦)
        const lowerId = id.toLowerCase();
        const dangerKeys = ['javascript:', 'data:', '<script', 'onerror=', 'onclick='];
        if (dangerKeys.some(key => lowerId.includes(key))) {
            return false;
        }

        // [新增] 嚴格拒絕包含網址結構的垃圾字串
        if (/[/?=&]/.test(id)) return false; 

        if (!guard) return true; // 舊規則相容模式

        // 2. 長度過濾
        if (guard.minLen && id.length < guard.minLen) return false;
        if (guard.maxLen && id.length > guard.maxLen) return false;

        // 3. 動態特徵鎖 (Adaptive Whitelist)
        if (guard.regex) {
            try {
                const regex = new RegExp(guard.regex);
                if (!regex.test(id)) return false; 
            } catch (e) {
                return false; 
            }
        }
        return true;
    }
    function detectFlank(raw, target) {
        const pos = raw.indexOf(target);
        if (pos === -1) return null;
        const left = pos > 0 ? raw.slice(0, pos) : null,
            right =
                pos + target.length < raw.length
                    ? raw.slice(pos + target.length)
                    : null;
        if (!left && !right) return null;
        return {
            left,
            right,
            guard: {
                minLen: Math.max(2, Math.floor(target.length * 0.7)),
                maxLen: target.length * 3 + 10,
                regex: "^[a-zA-Z0-9\\-_\\.]+$",
            },
        };
    }

    function autoDetectUrlRule(playerUrl, targetId) {
        const _detect = () => {
            try {
                const u = new URL(playerUrl, window.location.origin);
                const highPriorityKeys = ["v", "id", "vid", "viewkey", "video_id", "key"];
                for (let k of highPriorityKeys) {
                const v = u.searchParams.get(k);
                if (v === targetId) return { type: "q", key: k };
                if (v && v.includes(targetId)) {
                    let r = detectSeparator(v, targetId);
                    if (r) return { type: "q", key: k, sep: r.sep, sepIdx: r.sepIdx };
                }
            }
            for (let [k, v] of u.searchParams) {
                if (!highPriorityKeys.includes(k) && v === targetId)
                    return { type: "q", key: k };
                if (v && v.includes(targetId)) {
                    let r = detectSeparator(v, targetId);
                    if (r) return { type: "q", key: k, sep: r.sep, sepIdx: r.sepIdx };
                }
            }
            // [架構師升級] URL 中文還原器：確保 Hash 與 Path 內的 %E4 亂碼能被還原成純文字比對
            let hashRaw = u.hash.replace(/^#\/?/, "");
            try { hashRaw = decodeURIComponent(hashRaw); } catch(e) {}
            
            if (hashRaw) {
                if (hashRaw === targetId) return { type: "hash" };
                if (hashRaw.includes("/")) {
                    const hashSegs = hashRaw.split("/").filter((x) => x);
                    for (let i = 0; i < hashSegs.length; i++) {
                        if (hashSegs[i] === targetId)
                            return {
                                type: "hash_path",
                                idx: i - hashSegs.length,
                                guard: {
                                    minLen: Math.max(2, targetId.length - 3),
                                    maxLen: targetId.length + 20,
                                },
                            };
                    }
                }
                if (hashRaw.includes(targetId)) {
                    let r = detectSeparator(hashRaw, targetId);
                    if (r) return { type: "hash", sep: r.sep, sepIdx: r.sepIdx };
                }
            }
            
            let segs = u.pathname.split("/").filter((x) => x);
            try { segs = segs.map(s => decodeURIComponent(s)); } catch(e) {}
            
            for (let i = 0; i < segs.length; i++) {
                if (segs[i] === targetId) return { type: "p", idx: i - segs.length };
                if (segs[i] && segs[i].includes(targetId)) {
                    const flank = detectFlank(segs[i], targetId);
                    if (flank) {
                        if (!flank.right || !flank.left) {
                            let r = detectSeparator(segs[i], targetId);
                            if (r)
                                return {
                                    type: "p",
                                    idx: i - segs.length,
                                    sep: r.sep,
                                    sepIdx: r.sepIdx,
                                };
                            return { type: "p", idx: i - segs.length };
                        }
                        return {
                            type: "flank",
                            seg_idx: i - segs.length,
                            left: flank.left,
                            right: flank.right,
                            fallback_idx: i - segs.length,
                            guard: flank.guard,
                        };
                    }
                    let r = detectSeparator(segs[i], targetId);
                    if (r)
                        return {
                            type: "p",
                            idx: i - segs.length,
                            sep: r.sep,
                            sepIdx: r.sepIdx,
                        };
                }
            }
        } catch (e) { }
        return null;
        };
        
        let rule = _detect();
        if (rule && !rule.guard) {
            // [動態優化] 訓練階段：自動分析並生成針對該站點 ID 格式的專屬特徵鎖
            rule.guard = { 
                // 1. 下限：根據 ID 長度動態設定最小門檻
                minLen: Math.max(2, targetId.length > 20 ? 5 : targetId.length - 3),
                // 2. 上限：設定安全邊界，防止惡意超長字串
                maxLen: Math.max(150, targetId.length + 50),
                // 3. [關鍵改動]：不再根據英數字判斷，而是直接「學習」該 ID 出現過的字元特徵
                regex: generateGuardRegex(targetId) 
            };
        }
        return rule;
    }

    function extractIdByUrlRule(urlStr, rule) {
        try {
            const u = new URL(urlStr, window.location.origin);
            let raw = null;
            if (rule.type === "q") raw = u.searchParams.get(rule.key);
            else if (rule.type === "hash") raw = u.hash.replace(/^#\/?/, "");
            else if (rule.type === "hash_path") {
                const hashSegs = u.hash
                    .replace(/^#\/?/, "")
                    .split("/")
                    .filter((x) => x);
                const tIdx = rule.idx < 0 ? hashSegs.length + rule.idx : rule.idx;
                // [修正] 檢查索引是否在合法範圍內
                if (tIdx < 0 || tIdx >= hashSegs.length) return null;
                raw = hashSegs[tIdx] || null;
                if (raw && !validateIdByGuard(raw, rule.guard)) raw = null;
                return raw;
            } else if (rule.type === "p") {
                const segs = u.pathname.split("/").filter((x) => x);
                const tIdx = rule.idx < 0 ? segs.length + rule.idx : rule.idx;
                // [修正] 檢查索引是否在合法範圍內
                if (tIdx < 0 || tIdx >= segs.length) return null;
                raw = segs[tIdx] || null;
            } else if (rule.type === "flank") {
                const segs = u.pathname.split("/").filter((x) => x);
                const sIdx =
                    rule.seg_idx < 0 ? segs.length + rule.seg_idx : rule.seg_idx;
                const seg = segs[Math.max(0, Math.min(sIdx, segs.length - 1))] || "";
                let ex = null;
                if (seg) {
                    let start = 0,
                        end = seg.length;
                    if (rule.left && seg.includes(rule.left))
                        start = seg.indexOf(rule.left) + rule.left.length;
                    if (rule.right && seg.includes(rule.right)) {
                        const rPos = seg.lastIndexOf(rule.right);
                        if (rPos > start) end = rPos;
                    }
                    const cand = seg.slice(start, end);
                    if (cand && validateIdByGuard(cand, rule.guard)) ex = cand;
                }
                if (!ex && rule.fallback_idx !== undefined) {
                    const fbIdx =
                        rule.fallback_idx < 0
                            ? segs.length + rule.fallback_idx
                            : rule.fallback_idx;
                    const fbSeg =
                        segs[Math.max(0, Math.min(fbIdx, segs.length - 1))] || null;
                    if (fbSeg && validateIdByGuard(fbSeg, rule.guard)) ex = fbSeg;
                }
                return ex;
            }
            if (raw && rule.sep && raw.includes(rule.sep)) {
                let pts = raw.split(rule.sep);
                let sIdx = rule.sepIdx < 0 ? pts.length + rule.sepIdx : rule.sepIdx;
                raw = pts[Math.max(0, Math.min(sIdx, pts.length - 1))] || raw;
            }
            
            // [架構師升級] URL 中文還原器：將 %E4%B8%AD 等編碼還原為純文字，確保安檢門的「字數長度」判定正確
            if (raw) {
                try { raw = decodeURIComponent(raw); } catch (e) {}
            }
            
            // [架構師修復] 強制防護：若提取出的字串不符合長度或格式安檢，直接退件，迫使觸發下一個模組降級尋找
            if (raw && !validateIdByGuard(raw, rule.guard)) return null;
            
            return raw;
        } catch (e) {
            return null;
        }
    }

    const _idCache = new WeakMap();
    function deepScanForId(rootEl, urlRule, targetId = "") {
        // [架構師重構] 徹底廢除所有「猜測」與「降級」邏輯。
        // 核心流程：遍歷 DOM 屬性 ➡️ 套用 URL 規則提取 ➡️ 若有 targetId 則執行「真理比對」。
        
        const performSearch = (el) => {
            if (!el || !el.attributes) return null;
            for (let attr of el.attributes) {
                if (!attr.value || attr.value.length < 1) continue;
                
                // [CWS 安全修復] 問題 2：屬性值傳入 URL 解析前，強制過濾 javascript:/data: 偽協議
                const safeVal = sanitizeAttrAsUrl(attr.value);
                if (!safeVal) continue;
                // 為了讓 URL 規則能正確執行，我們模擬完整的網址格式進行提取
                let testValue = safeVal.startsWith('http') || safeVal.startsWith('/') ? safeVal : `https://x.com/v/${safeVal}`;
                let extracted = extractIdByUrlRule(testValue, urlRule);
                
                if (extracted) {
                    // [真理比對] 如果存在 targetId (訓練模式)，則必須完全匹配才算找到位置
                    if (targetId) {
                        if (extracted.toLowerCase() === targetId.toLowerCase()) return extracted;
                    } else {
                        // 日常監控模式 (Runtime)：只要符合規則就返回
                        return extracted;
                    }
                }
            }
            return null;
        };

        // 優先級 1：向上遍歷父節點（通常穩定的 ID 規則都藏在外層容器或連結上）
        let anc = rootEl;
        for (let i = 0; i < 8 && anc; i++, anc = anc.parentElement) {
            let res = performSearch(anc);
            if (res) return res;
        }

        // 優先級 2：向下遍歷子節點（處理 data-屬性 藏在內部的特殊結構）
        const allEls = [rootEl, ...rootEl.querySelectorAll('*')];
        for (let el of allEls) {
            let res = performSearch(el);
            if (res) return res;
        }
        
        return null;
    }

    function initSystem() {
        if (!chrome.runtime?.id) return;
        createDebugPanel();
        chrome.storage.local.get(
            [
                "site_config",
                "isStealthMode",
                "enabledSites",
                "userLang",
                "showMonitorPanel",
                "barColor",
            ],
            (data) => {
                if (chrome.runtime.lastError) return;
                sysState.barColor = data.barColor || "#ff0000";
                sysState.userLang = data.userLang || "en";
                const baseDomain = getBaseDomain(location.hostname);
                const config = data.site_config || {};
                let savedDataRaw = config[baseDomain] || config[location.hostname];
                if (!savedDataRaw) {
                    for (let key in config) {
                        let arr = Array.isArray(config[key]) ? config[key] : [config[key]];
                        if (
                            arr.some(
                                (r) =>
                                    r &&
                                    r.hosts &&
                                    r.hosts.some((h) => getBaseDomain(h) === baseDomain),
                            )
                        ) {
                            savedDataRaw = config[key];
                            break;
                        }
                    }
                }
                sysState._showMonitor = data.showMonitorPanel !== false;
                const isStealth = !!data.isStealthMode;
                sysState.isStealth = isStealth;
                const savedDataArr = Array.isArray(savedDataRaw)
                    ? savedDataRaw
                    : savedDataRaw
                        ? [savedDataRaw]
                        : null;
                const validConfigs = savedDataArr
                    ? savedDataArr.filter(
                        (d) => d && d.s && (d.urlRule || d.pRule || d.tRule),
                    )
                    : [];
                if (validConfigs.length > 0) {
                    let needUpdate = false;
                    validConfigs.forEach((c) => {
                        if (!c.hosts) c.hosts = [];
                        if (!c.hosts.includes(location.hostname)) {
                            c.hosts.push(location.hostname);
                            needUpdate = true;
                        }
                    });
                    if (needUpdate) chrome.storage.local.set({ site_config: config });
                    sysState.currentDriver = {
                        key: baseDomain,
                        savedConfigArr: validConfigs,
                        thumbnail: {
                            minHeight: 40,
                            selector: validConfigs.map((c) => c.s).join(", "),
                            idParser: (el) => {
                                // [架構師修復] SPA DOM 節點複用偵測：以 <a> 的 href 作為快取失效鍵。
                                // React/Vue 為效能會原地複用同一個 DOM 節點（節點物理地址不變），
                                // 只更換 <a href> 指向新影片。舊的 WeakMap 快取無法感知這個變化，
                                // 導致進度條持續顯示「上一部影片」的進度。
                                // 解法：儲存 { id, href }，每次呼叫時比對 href 是否改變，變則重算。
                                const _aEl =
                                    el.tagName === "A"
                                        ? el
                                        : el.querySelector("a") || el.closest("a");
                                const _currentHref = _aEl?.href || "";
                                const _cached = _idCache.get(el);
                                if (_cached && _cached.href === _currentHref) return _cached.id;
                                const _calcId = () => {
                                    for (let cfg of validConfigs) {
                                        if (!el.matches(cfg.s) && !el.closest(cfg.s)) continue;
                                        let rule = cfg.tRule || cfg.urlRule || cfg.pRule;
                                        if (rule) {
                                            if (rule.targetAttr && rule.upLevel !== undefined) {
                                                let curr = el;
                                                for (let i = 0; i < rule.upLevel && curr; i++)
                                                    curr = curr.parentElement;
                                                if (curr && curr.hasAttribute(rule.targetAttr)) {
                                                    let v = curr.getAttribute(rule.targetAttr);
                                                    // [CWS 安全修復] 問題 2：屬性值傳入前過濾偽協議
                                                    const safeV = sanitizeAttrAsUrl(v);
                                                    if (!safeV) continue;
                                                    let id = extractIdByUrlRule(
                                                        safeV.startsWith("http") || safeV.startsWith("/")
                                                            ? safeV
                                                            : `https://x.com/v/${safeV}`,
                                                        rule,
                                                    );
                                                    if (id) return `${baseDomain}/${id.toLowerCase()}`;
                                                }
                                            }
                                            let aEl =
                                                el.tagName === "A"
                                                    ? el
                                                    : el.closest("a") || el.querySelector("a");
                                            
                                            // [架構師升級] 表親雷達 (Cousin Radar)：通用化跨分支搜尋，廢除舊版寫死的 class 判斷
                                            if (!aEl) {
                                                let p = el.parentElement;
                                                for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
                                                    aEl = p.querySelector("a");
                                                    if (aEl) break;
                                                }
                                            }
                                            
                                            if (aEl && aEl.href) {
                                                let id = extractIdByUrlRule(aEl.href, rule);
                                                // [架構師解封] 移除 50 碼硬限制，改由 rule.guard 的 150 碼自適應上限接管
                                                if (id && id.length <= 150)
                                                    return `${baseDomain}/${id.toLowerCase()}`;
                                            }
                                            // [架構師決斷] 徹底拔除 Runtime 的 deepScanForId 盲掃！
                                            // 既然訓練時已經記錄了精準的 targetAttr 座標或 <a> 標籤，
                                            // 若這兩條正規路徑都抓不到（或被安檢門退件），代表這是異質縮圖（如廣告），
                                            // 必須果斷回傳 null，絕對不允許降級去掃描 class 來瞎猜。
                                        }
                                    }
                                    return null;
                                };
                                const id = _calcId();
                                _idCache.set(el, { id, href: _currentHref }); // 儲存 href 供下次比對
                                return id;
                            },
                            wrapper: (el) =>
                                el.closest(".thumb-inside, .thumb") ||
                                (["IMG", "PICTURE", "VIDEO"].includes(el.tagName)
                                    ? el.parentElement
                                    : el),
                        },
                    };
                    updateDebugStatus("Init", `Driver: ${baseDomain}`);
                    const enabledSites = data.enabledSites || {};
                    sysState.isStealth =
                        isStealth ||
                        enabledSites[baseDomain] === false ||
                        enabledSites[location.hostname] === false;
                    if (!sysState.isStealth) {
                        startEngine();
                        updateDebugStatus("ON", "");
                        // [Bug 修復] 引擎啟動後補同步 _showMonitor，
                        // 確保監控面板按 showMonitorPanel 設定顯示/隱藏。
                        if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                    } else {
                        if (debugPanel) {
                            debugPanel.remove();
                            debugPanel = null;
                        }
                        removeAllBars();
                    }
                } else if (!sysState.isStealth) {
                    // [Bug 修復] 尊重 _showMonitor 開關，不能無條件顯示 debugPanel。
                    // 原本：debugPanel.style.display = "block" 忽略了 showMonitorPanel 的設定。
                    if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                    if (sysState.currentDriver) {
                        if (!sysState.timer) startEngine();
                    } else updateDebugStatus("Waiting", "m2");
                } else if (debugPanel) {
                    debugPanel.remove();
                    debugPanel = null;
                }
            },
        );
        chrome.storage.onChanged.addListener((changes) => {
            // [效能優化] 自動同步進度快取，減少主動 Storage 輪詢
            for (const [key, change] of Object.entries(changes)) {
                if (change.newValue && typeof change.newValue.progress === 'number') {
                    _vtProgressCache.set(key, change.newValue.progress);
                } else if (change.newValue === undefined) {
                    _vtProgressCache.delete(key);
                }
            }
            if (changes.userLang) {
                sysState.userLang = changes.userLang.newValue;
                if (sysState._lastState)
                    updateDebugStatus(sysState._lastState, sysState._lastMsg);
            }
            if (changes.showMonitorPanel) {
                sysState._showMonitor = changes.showMonitorPanel.newValue !== false;
                if (debugPanel)
                    debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                // [架構師補丁] 即時同步現有進度條標籤，無需刷新頁面
                activeOverlayBars.forEach((data) => {
                    if (data.labelEl) data.labelEl.style.display = sysState._showMonitor ? "block" : "none";
                });
            }
            if (changes.barColor) {
                sysState.barColor = changes.barColor.newValue || "#ff0000";
                document
                    .querySelectorAll(".vt-progress-bar, .vt-fake-bar > div > div")
                    .forEach((el) =>
                        el.style.setProperty(
                            "background-color",
                            sysState.barColor,
                            "important",
                        ),
                    );
            }
            if (changes.isStealthMode) {
                sysState.isStealth = changes.isStealthMode.newValue;
                if (!sysState.isStealth) {
                    // [Bug 修復] 退出 stealth 時尊重 _showMonitor 開關。
                    // 原本：debugPanel.style.display = "block" 無視 showMonitorPanel 設定，
                    // 導致用戶關掉監控面板後切換 stealth，面板又自動彈出。
                    if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                    if (sysState.currentDriver) {
                        if (!sysState.timer) startEngine();
                    } else updateDebugStatus("Waiting", "m2");
                } else {
                    if (debugPanel) debugPanel.style.display = "none";
                    removeAllBars();
                }
            }
            if (
                (changes.enabledSites || changes.site_config) &&
                !window._vtIsTraining
            )
                location.reload();
        });
    }

    function startEngine() {
        startScanner();
        startPlayerMonitor();
    }
    let _vtObs = null,
        _vtMut = null;
    function startScanner() {
        if (!sysState.currentDriver || !sysState.currentDriver.thumbnail) return;
        const driver = sysState.currentDriver.thumbnail;
        let visibleTargets = new Map();
        if (_vtObs) _vtObs.disconnect();
        if (_vtMut) _vtMut.disconnect();
        let _instantDrawTimer = null;
        _vtObs = new IntersectionObserver(
            (entries) => {
                if (sysState.isStealth) return;
                let hasNewIntersecting = false;
                entries.forEach((e) => {
                    let el = e.target;
                    if (e.isIntersecting) {
                        if (el.closest("video, .plyr, .vjs-tech, #player")) return;
                        let w = driver.wrapper(el),
                            id = driver.idParser(el);
                        if (w && id && w.offsetHeight >= (driver.minHeight || 40)) {
                            visibleTargets.set(el, { w, id });
                            hasNewIntersecting = true;
                        }
                    } else {
                        let c = visibleTargets.get(el);
                        if (c && c.w) {
                            let d = activeOverlayBars.get(c.w);
                            if (d) {
                                d.barEl.remove();
                                activeOverlayBars.delete(c.w);
                            }
                        }
                        visibleTargets.delete(el);
                    }
                });

                // [優化] 進入視窗時立即合批查詢，達到 0~50ms 秒開進度條體驗
                if (hasNewIntersecting) {
                    if (_instantDrawTimer) clearTimeout(_instantDrawTimer);
                    _instantDrawTimer = setTimeout(() => {
                        if (sysState.isStealth || visibleTargets.size === 0) return;
                        const uncachedIds = [];
                        visibleTargets.forEach((t) => {
                            if (!_vtProgressCache.has(t.id)) uncachedIds.push(t.id);
                        });
                        const _redrawBars = () => {
                            visibleTargets.forEach((t) => {
                                drawBar(t.w, _vtProgressCache.get(t.id) || 0, t.id);
                            });
                        };
                        if (uncachedIds.length > 0) {
                            if (!chrome.runtime?.id) return;
                            window.vtDB.getRecords(uncachedIds).then((d) => {
                                uncachedIds.forEach((id) => {
                                    if (d[id]?.progress !== undefined) _vtProgressCache.set(id, d[id].progress);
                                });
                                _redrawBars();
                            }).catch(() => _redrawBars());
                        } else {
                            _redrawBars();
                        }
                    }, 50);
                }
            },
            { rootMargin: "150px" },
        );
        const obsExisting = (node = document) => {
            if (node === document)
                visibleTargets.forEach((v, k) => {
                    if (!k.isConnected) visibleTargets.delete(k);
                });
            node
                .querySelectorAll(`${driver.selector}:not([data-vt-observed])`)
                .forEach((el) => {
                    el.setAttribute("data-vt-observed", "true");
                    _vtObs.observe(el);
                });
        };
        obsExisting();
        let _mutTimer = null,
            _mutLastRun = 0;
        _vtMut = new MutationObserver((mutations) => {
            let hasVal = false;
            for (let i = 0; i < mutations.length; i++) {
                const added = mutations[i].addedNodes;
                for (let j = 0; j < added.length; j++) {
                    const n = added[j];
                    if (n.nodeType === 1 && !/^(SCRIPT|STYLE|SVG|PATH)$/i.test(n.tagName)) {
                        hasVal = true;
                        break;
                    }
                }
                if (hasVal) break;
            }
            if (!hasVal) return;

            const now = Date.now();
            if (_mutTimer) clearTimeout(_mutTimer);
            
            // [效能極致修復] 捨棄 Set Buffer 與迴圈，改用全域單次掃描 (Throttle + Debounce)
            // 防止 YouTube 大量 DOM 變更（如切換分頁時）導致 querySelectorAll 被同步呼叫數百次鎖死主執行緒
            if (now - _mutLastRun > 500) {
                _mutLastRun = now;
                obsExisting(document);
            } else {
                _mutTimer = setTimeout(() => {
                    _mutLastRun = Date.now();
                    obsExisting(document);
                }, 100);
            }
        });
        _vtMut.observe(document.body, { childList: true, subtree: true });
        if (sysState._barUpdateTimer) clearInterval(sysState._barUpdateTimer);
        sysState._barUpdateTimer = setInterval(() => {
            // [防護] 擴充功能重載後 context 失效時自動停止計時器，避免 "Extension context invalidated" 錯誤
            if (!chrome.runtime?.id) { clearInterval(sysState._barUpdateTimer); sysState._barUpdateTimer = null; return; }
            if (sysState.isStealth || visibleTargets.size === 0) return;
            const uncachedIds = [];
            visibleTargets.forEach((t) => {
                if (!_vtProgressCache.has(t.id)) uncachedIds.push(t.id);
            });
            const _redrawBars = () => {
                visibleTargets.forEach((t) => {
                    drawBar(t.w, _vtProgressCache.get(t.id) || 0, t.id);
                });
            };
            if (uncachedIds.length > 0) {
                window.vtDB.getRecords(uncachedIds).then((d) => {
                    uncachedIds.forEach((id) => {
                        if (d[id]?.progress !== undefined) _vtProgressCache.set(id, d[id].progress);
                    });
                    _redrawBars();
                }).catch(() => _redrawBars());
            } else {
                _redrawBars();
            }
        }, 1500);
    }

    function startPlayerMonitor() {
        if (sysState.timer) clearInterval(sysState.timer);
        const tick = () => {
            if (!chrome.runtime?.id || sysState.isStealth) return;
            if (sysState._lastUrl !== location.href) {
                sysState._lastUrl = location.href;
                _cachedIframes = null; // [效能優化] URL 變化時清除 iframe 快取
                if (window === window.top) sysState._cachedId = null;
                if (sysState.currentDriver?.savedConfigArr) {
                    for (let cfg of sysState.currentDriver.savedConfigArr) {
                        let id = extractIdByUrlRule(
                            location.href,
                            cfg.pRule || cfg.urlRule,
                        );
                        if (id) {
                            sysState._cachedId = `${sysState.currentDriver.key}/${id.toLowerCase()}`;
                            break;
                        }
                    }
                }
            }
            if (window === window.top && sysState._cachedId) {
                // [效能優化] 快取 iframe 清單，避免每 tick 重複 querySelectorAll
                if (!_cachedIframes) _cachedIframes = Array.from(document.querySelectorAll("iframe"));
                _cachedIframes.forEach((f) => {
                    try {
                        f.contentWindow.postMessage(
                            { type: "VT_SYNC", id: sysState._cachedId },
                            "*",
                        );
                    } catch (e) { }
                });
            }
            let videos = Array.from(document.querySelectorAll("video")).filter(
                (v) =>
                    !v.closest('a, iframe, [class*="sponsor"]') &&
                    (v.offsetWidth >= 340 || v.videoWidth >= 340),
            );
            if (videos.length === 0) {
                if (
                    window === window.top &&
                    sysState._cachedId &&
                    !/^(REC|FLASH)$/.test(sysState._lastState)
                )
                    updateDebugStatus("Waiting", "m1");
                return;
            }
            let video = videos.sort(
                (a, b) =>
                    b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight,
            )[0];
            sysState._activeEl = video;
            if (!sysState._cachedId)
                return window === window.top ? updateDebugStatus("OFF", "m1") : null;
            if (sysState.activeVideoId !== sysState._cachedId) {
                sysState.activeVideoId = sysState._cachedId;
                sysState.isDataLoaded = false;
                const _loadTarget = sysState._cachedId; // [BUG 修復] 快取 ID 避免閉包跟蹤競態
                window.vtDB.getRecords([_loadTarget]).then((res) => {
                    if (sysState.activeVideoId === _loadTarget) {
                        if (res[_loadTarget]?.progress !== undefined)
                            _vtProgressCache.set(_loadTarget, res[_loadTarget].progress); // [效能優化] 預充進度快取
                        sysState.isDataLoaded = true;
                    }
                }).catch(() => {
                    if (sysState.activeVideoId === _loadTarget) sysState.isDataLoaded = true;
                });
                if (!video.dataset.vtBound) {
                    video.addEventListener("ended", () => {
                        if (sysState.activeVideoId)
                            forceSave(video, sysState.activeVideoId);
                    });
                    // [架構師優化] 統一暫停與跳轉防抖 (Unified Action Debounce)
                    // 解決點擊進度條時 pause 與 seeked 連續觸發導致的「雙重存檔」與面板閃爍問題
                    // 同時確保按住進度條拖曳時，只會在放開後存檔一次
                    const handleUserActionSave = () => {
                        if (sysState._actionTimer) clearTimeout(sysState._actionTimer);
                        sysState._actionTimer = setTimeout(() => {
                            if (sysState.activeVideoId && sysState._activeEl) {
                                // 核心防護：如果用戶還在按住進度條拖曳 (seeking 為 true)，則拒絕存檔
                                if (!sysState._activeEl.seeking) {
                                    forceSave(sysState._activeEl, sysState.activeVideoId);
                                }
                            }
                        }, 800);
                    };

                    video.addEventListener("pause", handleUserActionSave);
                    video.addEventListener("seeked", handleUserActionSave);
                    if (!window._vtGlobalGuardBound) {
                        window._vtGlobalGuardBound = true;
                        document.addEventListener("visibilitychange", () => {
                            if (
                                document.hidden &&
                                sysState.activeVideoId &&
                                sysState._activeEl
                            )
                                forceSave(sysState._activeEl, sysState.activeVideoId);
                        });
                        window.addEventListener("beforeunload", () => {
                            if (sysState.activeVideoId && sysState._activeEl)
                                forceSave(sysState._activeEl, sysState.activeVideoId);
                        });
                    }
                    video.dataset.vtBound = "true";
                }
            }
            checkAndSave(video, sysState.activeVideoId);
        };
        tick();
        sysState.timer = setInterval(tick, CONFIG.checkInterval);
    }

    function enforceLimitAndSave(id, data) {
        if (chrome.runtime?.id)
            chrome.runtime
                .sendMessage({ action: "VT_SAVE_RECORD", id: id, data: data })
                .catch(() => { });
    }
    function checkAndSave(video, id, force = false) {
        if (!sysState.isDataLoaded || (video.seeking && !force)) return;
        const d = video.duration;
        if (isNaN(d) || d < 10 || video.currentTime < 5) return;

        // [廣告過濾] 當影片外層被套上廣告的 UI 殼時，拒絕記錄進度
        if (video.closest('.ad-showing, .video-ads, [class*="ad-container"], [id*="ad-play"]')) return;

        const pct = parseFloat(((video.currentTime / d) * 100).toFixed(2));
        if (pct <= 0) return;
        const now = Date.now();
        if (
            !force &&
            sysState._lastSave &&
            now - sysState._lastSave < CONFIG.saveInterval
        )
            return;
        sysState._lastSave = now;
        enforceLimitAndSave(id, { progress: pct, lastUpdated: now });
        if (window !== window.top) {
            window.top.postMessage(
                { type: "VT_SYNC_ACK", id: id, pct: pct, force: force },
                "*",
            );
            return;
        }
        if (force) {
            if (sysState._flashTimer) clearTimeout(sysState._flashTimer); // [修復] 執行前先清除舊計時器
            updateDebugStatus("FLASH", `[${id}] m3s: ${pct}%`);
            sysState._flashTimer = setTimeout(() => {
                if (sysState.activeVideoId === id)
                    updateDebugStatus("REC", `[${id}] ${pct}%`);
            }, 800);
        } else {
            updateDebugStatus("REC", `[${id}] ${pct}%`);
        }
    }
    function forceSave(video, id) {
        checkAndSave(video, id, true);
    }
    const activeOverlayBars = new Map();
    let _overlaySyncLoop = null;
    // [架構師重構] 移除 #vt-global-overlay 容器。
    // 原本 overlay 的 overflow:hidden 在部分瀏覽器會意外建立新的 Stacking Context，
    // 導致進度條的 z-index 在孤立的層級空間中計算，無法與頁面上的語言選單、導覽列正確競爭。
    // 新方案：每個 .vt-progress-container 直接掛在 document.body，
    // 以「縮圖容器的 z-index + 1」參與頁面根 Stacking Context，
    // 確保進度條高於縮圖、但頁面上任何更高層級的 UI（如語言選單 z-index:1000）可自然遮擋它。
    function syncOverlay() {
        if (!sysState.isStealth && activeOverlayBars.size > 0) {
            // [效能修復] 解決全螢幕閃爍/抖動問題（Layout Thrashing）
            // 在 60 FPS 迴圈中，頻繁在不同的 DOM 之間交替 READ (getBoundingClientRect) 
            // 和 WRITE (style.top = ...)，會引發瀏覽器嚴重的「強制同步佈局」。
            // 以下採用 Read-Write Batching 徹底分離讀寫操作，消除效能災難。
            const batchUpdates = [];

            // --- 階段 1：集中所有 READ 操作 ---
            activeOverlayBars.forEach((data, container) => {
                if (!container.isConnected) {
                    batchUpdates.push({ type: "remove", container, data });
                    return;
                }
                const rect = container.getBoundingClientRect();
                
                // [效能修復] 髒值偵測 (Dirty Checking)：只有當座標真正改變時才推入更新隊列
                const prev = data._lastRect;
                const changed = !prev || prev.top !== rect.top || prev.left !== rect.left || prev.width !== rect.width || prev.bottom !== rect.bottom;
                
                if (changed) {
                    batchUpdates.push({ type: "update", container, data, rect });
                }
            });

            // --- 階段 2：集中所有 WRITE 操作 ---
            batchUpdates.forEach((update) => {
                if (update.type === "remove") {
                    update.data.barEl.remove();
                    activeOverlayBars.delete(update.container);
                } else if (update.type === "update") {
                    update.data.barEl.style.top = update.rect.bottom - 6 + "px";
                    update.data.barEl.style.left = update.rect.left + "px";
                    update.data.barEl.style.width = update.rect.width + "px";
                    // 寫入完成後更新快取，供下一次 Frame 比對
                    update.data._lastRect = { top: update.rect.top, left: update.rect.left, width: update.rect.width, bottom: update.rect.bottom };
                }
            });

            _overlaySyncLoop = requestAnimationFrame(syncOverlay);
        } else _overlaySyncLoop = null;
    }
    function drawBar(container, pct, id) {
        if (!_overlaySyncLoop)
            _overlaySyncLoop = requestAnimationFrame(syncOverlay);
        let data = activeOverlayBars.get(container);
        if (data && data.barEl.isConnected) {
            data.barFill.style.width = `${pct}%`;
            if (data.labelEl.innerText !== `ID: ${id}`)
                data.labelEl.innerText = `ID: ${id}`;
            return;
        }
        let track = document.createElement("div");
        track.className = "vt-progress-container";
        // [架構師重構] 直接掛在 document.body，以縮圖容器的 z-index + 1 參與頁面根 Stacking Context。
        // 這讓進度條的層級語義正確：
        //   - 浮在縮圖容器上方（+1）
        //   - 被任何 z-index 更高的頁面 UI（如 z-index:1000 的語言選單）自然遮擋
        //   - 不需要 overflow:hidden 容器，不會意外建立孤立的 Stacking Context
        let computedZ = window.getComputedStyle(container).zIndex;
        let targetZ =
            computedZ === "auto" || isNaN(parseInt(computedZ)) ? 1 : parseInt(computedZ) + 1;
        track.style.zIndex = targetZ; // 不用 !important，讓頁面更高層 UI 可以自然蓋過
        const rect = container.getBoundingClientRect();
        track.style.top = rect.bottom - 6 + "px";
        track.style.left = rect.left + "px";
        track.style.width = rect.width + "px";
        const bar = document.createElement("div");
        bar.className = "vt-progress-bar";
        bar.style.width = `${pct}%`;
        bar.style.borderRadius = "4px";
        bar.style.setProperty("background-color", sysState.barColor, "important");
        const lbl = document.createElement("span");
        lbl.className = "vt-debug-label";
        lbl.style.cssText = `position:absolute;bottom:8px;left:0;font-size:12px;color:#ffeb3b;text-shadow:-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.9);padding:2px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:95%;line-height:1.2;font-weight:bold;display:${sysState._showMonitor ? "block" : "none"};`;
        lbl.innerText = `ID: ${id}`;
        track.append(bar, lbl);
        (document.body || document.documentElement).appendChild(track);
        activeOverlayBars.set(container, {
            barEl: track,
            barFill: bar,
            labelEl: lbl,
        });
    }
    function removeAllBars() {
        if (_vtObs) { _vtObs.disconnect(); _vtObs = null; }
        if (_vtMut) { _vtMut.disconnect(); _vtMut = null; }
        if (sysState.timer) { clearInterval(sysState.timer); sysState.timer = null; }
        if (sysState._barUpdateTimer) { clearInterval(sysState._barUpdateTimer); sysState._barUpdateTimer = null; }
        if (_overlaySyncLoop) { cancelAnimationFrame(_overlaySyncLoop); _overlaySyncLoop = null; }
        activeOverlayBars.forEach((data) => data.barEl.remove());
        activeOverlayBars.clear();
        // [Bug 修復] 清除所有元素的 observed 標記。
        // 原本 disconnect() 後標記仍留在 DOM 上，導致重啟 scanner 時，
        // obsExisting() 的 :not([data-vt-observed]) 篩選會跳過這些舊縮圖，
        // 造成切換開關後進度條無法即時回歸。
        document
            .querySelectorAll("[data-vt-observed]")
            .forEach((el) => el.removeAttribute("data-vt-observed"));
        // [架構師重構] 清除所有直接掛在 body 的進度條（防禦性清理）
        document
            .querySelectorAll(".vt-progress-container")
            .forEach((el) => el.remove());
    }
    function createDebugPanel() {
        if (debugPanel) return;
        debugPanel = document.createElement("div");
        debugPanel.style.cssText = `position:fixed; bottom:15px; right:15px; padding:16px 24px; background:rgba(15,15,15,0.9); font-family:sans-serif; font-size:26px; font-weight:bold; border-left:8px solid #4fc3f7; border-radius:12px; z-index:2147483647; pointer-events:none; box-shadow:0 8px 24px rgba(0,0,0,0.7); backdrop-filter:blur(2px);`;
        (document.body || document.documentElement).appendChild(debugPanel);
    }

    // [架構師重構] 修正 DOM 重繪閃爍，並還原分離式 Flex 佈局以防止 % 符號被裁切
    function updateDebugStatus(state, msg) {
        if (window !== window.top) return;
        if (!debugPanel) {
            createDebugPanel();
            if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
        }
        
        // [效能修復] 狀態與訊息如果完全一樣，拒絕重複渲染
        if (sysState._lastState === state && sysState._lastMsg === msg) return;
        
        sysState._lastState = state;
        sysState._lastMsg = msg;
        const lang = sysState.userLang || "en";

        const icon =
            state === "REC" ? getLangText(lang, "r") :
            state === "FLASH" ? getLangText(lang, "f") :
            state === "OFF" ? getLangText(lang, "o") : getLangText(lang, "w");
            
        const color =
            state === "REC" ? "#10b981" :
            state === "FLASH" ? "#3b82f6" :
            state === "OFF" ? "#6b7280" : "#4fc3f7";

        if (msg) {
            if (msg.includes("m1")) msg = msg.replace("m1", getLangText(lang, "m1"));
            if (msg.includes("m2")) msg = msg.replace("m2", getLangText(lang, "m2"));
            if (msg.includes("m3s")) msg = msg.replace("m3s", getLangText(lang, "m3s"));
        }

        // 尋找現有的容器，如果沒有才建立 (消除 DOM 暴力重繪的閃爍)
        let container = debugPanel.querySelector('.vt-debug-container');
        if (!container) {
            debugPanel.textContent = ''; 
            container = document.createElement('div');
            container.className = 'vt-debug-container';
            container.style.cssText = 'display:flex; align-items:center; max-width:450px; overflow:hidden;';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'vt-debug-icon';
            iconSpan.style.cssText = `flex-shrink:0; transition: color 0.2s ease;`;

            // [佈局修復] ID 與進度完全分離，確保進度區域 (pctSpan) 絕對不被擠壓
            const idSpan = document.createElement('span');
            idSpan.className = 'vt-debug-id';
            idSpan.style.cssText = 'color:#fff; margin-left:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:none;';

            const pctSpan = document.createElement('span');
            pctSpan.className = 'vt-debug-pct';
            pctSpan.style.cssText = 'color:#fff; margin-left:4px; white-space:nowrap; flex-shrink:0; display:none;';

            const msgSpan = document.createElement('span');
            msgSpan.className = 'vt-debug-msg';
            msgSpan.style.cssText = 'color:#fff; margin-left:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:1; display:none;';

            container.appendChild(iconSpan);
            container.appendChild(idSpan);
            container.appendChild(pctSpan);
            container.appendChild(msgSpan);
            debugPanel.appendChild(container);
        }

        // 更新現有節點的內容
        const iconSpan = container.querySelector('.vt-debug-icon');
        const idSpan = container.querySelector('.vt-debug-id');
        const pctSpan = container.querySelector('.vt-debug-pct');
        const msgSpan = container.querySelector('.vt-debug-msg');

        iconSpan.style.color = color;
        iconSpan.textContent = icon;

        if (msg) {
            const match = msg.match(/^\[(?:.*?\/)?(.*?)\](.*)$/);
            if (match) {
                // 有進度資訊時，顯示 ID 與百分比
                idSpan.textContent = `[${match[1]}]`;
                idSpan.title = msg;
                idSpan.style.display = 'block';
                
                pctSpan.textContent = match[2].trim();
                pctSpan.style.display = 'block';

                msgSpan.style.display = 'none';
            } else {
                // 只有純文字狀態時 (如 Waiting)
                msgSpan.textContent = msg;
                msgSpan.title = msg;
                msgSpan.style.display = 'block';
                
                idSpan.style.display = 'none';
                pctSpan.style.display = 'none';
            }
        } else {
            idSpan.style.display = 'none';
            pctSpan.style.display = 'none';
            msgSpan.style.display = 'none';
        }

        debugPanel.style.borderLeftColor = color;
    }

    initSystem();
}
