// VT Trainer - 訓練模式 UI 引擎
// 負責：視覺化容器選擇、訓練面板 showMainPanel、ID 偵測、規則儲存
// 依賴：vt_utils.js, vt_url_parser.js, vt_tracker.js (drawBar, removeAllBars)
// 共享狀態（由 content.js 初始化）：lastRightClickedEl, lastRightClickPos,
//   sysState, activeOverlayBars

if (!window._vtTrainerLoaded) {
    window._vtTrainerLoaded = true;

    window.vtHandleStartMarking = function() {
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
                window.lastRightClickedEl = target;

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
                        let res2 = raw;
                        if (sep && raw.includes(sep)) {
                            let pts = raw.split(sep);
                            res2 =
                                pts[
                                idx < 0 ? pts.length + idx : Math.min(idx, pts.length - 1)
                                ] || raw;
                        }
                        document.getElementById("vt-preview-val").innerText = res2;
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
                            (saveRes) => {
                                let d = getBaseDomain(location.hostname);
                                let config = saveRes.site_config || {};
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
                                let enabled = saveRes.enabledSites || {};
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

                    document.getElementById("vt-save-0").onclick = () => executeSave(0);
                    document.getElementById("vt-save-1").onclick = () => executeSave(1);
                    document.getElementById("vt-save-2").onclick = () => executeSave(2);
                    document.getElementById("vt-save-3").onclick = () => executeSave(3);
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
    };
}
