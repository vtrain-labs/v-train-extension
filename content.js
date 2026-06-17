// VT Core Entry Point V1.3
// 入口點：初始化全域共享狀態，協調各模組啟動
// 依賴注入順序（由 background.js 確保）：
//   db.js → shared_i18n.js → vt_utils.js → vt_url_parser.js → vt_tracker.js → vt_trainer.js → content.js

if (!window._vtInjected) {
    window._vtInjected = true;

    // ─── 共享設定 ───────────────────────────────────────────────────
    window.CONFIG = {
        checkInterval: 1500,
        saveInterval: 5000,
    };

    // ─── 全域共享狀態（所有模組透過 window.xxx 存取）──────────────────
    window.lastRightClickedEl = null;
    window.lastRightClickPos = null;
    window.debugPanel = null;
    window._vtProgressCache = new Map();
    window._cachedIframes = null;
    window._idCache = new WeakMap();
    window.activeOverlayBars = new Map();
    window._overlaySyncLoop = null;
    window._vtObs = null;
    window._vtMut = null;

    window.sysState = {
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
        _actionTimer: null, // [新增] 用於暫停與跳轉的統一防抖計時器
    };

    // ─── 右鍵選單位置記錄 ─────────────────────────────────────────
    document.addEventListener(
        "contextmenu",
        (e) => {
            window.lastRightClickedEl = e.target;
            window.lastRightClickPos = { x: e.clientX, y: e.clientY };
        },
        true,
    );

    // ─── 主訊息監聽器 ──────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "VT_PROGRESS_UPDATE") {
            _vtProgressCache.set(request.id, request.progress);
            return;
        }

        if (request.action === "VT_RECORDS_DELETED") {
            if (request.ids && Array.isArray(request.ids)) {
                request.ids.forEach(id => {
                    _vtProgressCache.delete(id);
                });
                if (typeof window._vtRemoveDeletedBars === 'function') {
                    window._vtRemoveDeletedBars(request.ids);
                }
            }
            return;
        }

        if (request.action === "START_MARKING") {
            // 委派給 vt_trainer.js 處理
            window.vtHandleStartMarking();
            return;
        }

        if (request.action === "VT_EXTRACT_OG_IMAGE") {
            let ogImg = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[property="og:image:secure_url"]')?.content ||
                        document.querySelector('meta[name="twitter:image"]')?.content || '';
            if (!ogImg) {
                try {
                    const ldJsons = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const script of ldJsons) {
                        const data = JSON.parse(script.textContent);
                        if (data && data.thumbnailUrl) {
                            ogImg = Array.isArray(data.thumbnailUrl) ? data.thumbnailUrl[0] : data.thumbnailUrl;
                            break;
                        } else if (data && data.image) {
                            ogImg = Array.isArray(data.image) ? (data.image[0].url || data.image[0]) : (data.image.url || data.image);
                            break;
                        }
                    }
                } catch(e) {}
            }
            sendResponse({ ogImg: ogImg });
            return;
        }

        if (request.action === "RESET_BINDING") location.reload();
    });

    // ─── PostMessage 監聽器（iframe 同步）─────────────────────────
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
            // [VR/Iframe 修復] 同步 ID 給頂層的狀態機，避免被輪詢迴圈隱藏
            sysState.activeVideoId = e.data.id;
            if (window.vtBookmarkPanel && e.data.id) {
                window.vtBookmarkPanel.setVideo(e.data.id);
            }
            if (e.data.force) {
                if (sysState._flashTimer) clearTimeout(sysState._flashTimer);
                updateDebugStatus("FLASH", `[${e.data.id}] m3s: ${e.data.pct}%`);
                sysState._flashTimer = setTimeout(() => {
                    if (sysState.activeVideoId === e.data.id)
                        updateDebugStatus("REC", `[${e.data.id}] ${e.data.pct}%`);
                }, 800);
            } else {
                updateDebugStatus("REC", `[${e.data.id}] ${e.data.pct}%`);
            }
        }

        // [終極截圖修復] 處理 iframe 請求自身絕對座標，以精確裁切 captureVisibleTab
        if (e.data && e.data.type === 'VT_GET_IFRAME_RECT' && window === window.top) {
            try {
                const iframes = document.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    if (iframes[i].contentWindow === e.source) {
                        const rect = iframes[i].getBoundingClientRect();
                        e.ports[0].postMessage({ rect: { left: rect.left, top: rect.top } });
                        return;
                    }
                }
            } catch(err) {}
            e.ports[0]?.postMessage({ rect: { left: 0, top: 0 } });
        }
    });

    // ─── 引擎協調器 ────────────────────────────────────────────────
    function startEngine() {
        startScanner();        // 由 vt_tracker.js 提供
        startPlayerMonitor();  // 由 vt_tracker.js 提供
    }

    // ─── 系統初始化 ────────────────────────────────────────────────
    function initSystem() {
        if (!chrome.runtime?.id) return;
        if (window === window.top) createDebugPanel(); // 由 vt_tracker.js 提供
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
                const baseDomain = getBaseDomain(location.hostname); // 由 vt_url_parser.js 提供
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

                                            // [架構師升級] 表親雷達 (Cousin Radar)
                                            if (!aEl) {
                                                let p = el.parentElement;
                                                for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
                                                    aEl = p.querySelector("a");
                                                    if (aEl) break;
                                                }
                                            }

                                            if (aEl && aEl.href) {
                                                let id = extractIdByUrlRule(aEl.href, rule);
                                                if (id && id.length <= 150)
                                                    return `${baseDomain}/${id.toLowerCase()}`;
                                            }
                                        }
                                    }
                                    return null;
                                };
                                const id = _calcId();
                                _idCache.set(el, { id, href: _currentHref });
                                return id;
                            },
                            wrapper: (el) =>
                                el.closest(".thumb-inside, .thumb") ||
                                (["IMG", "PICTURE", "VIDEO"].includes(el.tagName)
                                    ? el.parentElement
                                    : el),
                        },
                    };
                    updateDebugStatus("Init", `Driver: ${baseDomain}`); // 由 vt_tracker.js 提供
                    const enabledSites = data.enabledSites || {};
                    sysState.isStealth =
                        isStealth ||
                        enabledSites[baseDomain] === false ||
                        enabledSites[location.hostname] === false;
                    if (!sysState.isStealth) {
                        startEngine();
                        updateDebugStatus("ON", "");
                        // [Bug 修復] 引擎啟動後補同步 _showMonitor
                        if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                    } else {
                        if (debugPanel) {
                            debugPanel.remove();
                            window.debugPanel = null;
                        }
                        removeAllBars(); // 由 vt_tracker.js 提供
                    }
                } else if (!sysState.isStealth) {
                    // [Bug 修復] 尊重 _showMonitor 開關
                    if (debugPanel) debugPanel.style.display = sysState._showMonitor ? "block" : "none";
                    if (sysState.currentDriver) {
                        if (!sysState.timer) startEngine();
                    } else updateDebugStatus("Waiting", "m2");
                } else if (debugPanel) {
                    debugPanel.remove();
                    window.debugPanel = null;
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
                    // [Bug 修復] 退出 stealth 時尊重 _showMonitor 開關
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

    initSystem();
}
