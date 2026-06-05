// VT Tracker - 進度追蹤引擎 + 進度條繪製 + Debug 面板
// 負責：掃描縮圖、繪製進度條、監控播放器、存檔進度
// 依賴：vt_utils.js, vt_url_parser.js
// 共享狀態（由 content.js 初始化）：sysState, _vtProgressCache, activeOverlayBars,
//   _overlaySyncLoop, _vtObs, _vtMut, _cachedIframes, debugPanel, CONFIG

if (!window._vtTrackerLoaded) {
    window._vtTrackerLoaded = true;

    function startScanner() {
        if (!sysState.currentDriver || !sysState.currentDriver.thumbnail) return;
        const driver = sysState.currentDriver.thumbnail;
        let visibleTargets = new Map();
        if (_vtObs) _vtObs.disconnect();
        if (_vtMut) _vtMut.disconnect();
        let _instantDrawTimer = null;
        window._vtObs = new IntersectionObserver(
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
                            new Promise(resolve => chrome.runtime.sendMessage({ action: "VT_GET_RECORDS", ids: uncachedIds }, resolve)).then((d) => {
                                if (!d) d = {};
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
        window._vtMut = new MutationObserver((mutations) => {
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

            // [效能修復 P1] 髒值偵測（Dirty Checking）：
            // 分離「需要查 IDB 的 ID」與「快取命中但進度值已改變」兩種情況。
            // 若所有 ID 都在快取中，且進度條寬度與快取完全一致，直接跳過本輪，
            // 避免每 1.5s 在縮圖多時執行大量不必要的 style 寫入。
            const uncachedIds = [];
            let hasDirty = false;
            visibleTargets.forEach((t) => {
                if (!_vtProgressCache.has(t.id)) {
                    uncachedIds.push(t.id);
                } else {
                    const cachedPct = _vtProgressCache.get(t.id) || 0;
                    const barData = activeOverlayBars.get(t.w);
                    // 進度條不存在（尚未繪製）或寬度與快取不符時，標記為髒值
                    if (!barData || parseFloat(barData.barFill.style.width) !== cachedPct) {
                        hasDirty = true;
                    }
                }
            });
            // 完全命中快取且無髒值：本輪所有進度條都是最新狀態，跳過
            if (uncachedIds.length === 0 && !hasDirty) return;

            const _redrawBars = () => {
                visibleTargets.forEach((t) => {
                    drawBar(t.w, _vtProgressCache.get(t.id) || 0, t.id);
                });
            };
            if (uncachedIds.length > 0) {
                new Promise(resolve => chrome.runtime.sendMessage({ action: "VT_GET_RECORDS", ids: uncachedIds }, resolve)).then((d) => {
                    if (!d) d = {};
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
                window._cachedIframes = null; // [效能優化] URL 變化時清除 iframe 快取
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
                if (!_cachedIframes) window._cachedIframes = Array.from(document.querySelectorAll("iframe"));
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
                window.vtBookmarkPanel?.hide(); // 無影片時隱藏書籤面板
                return;
            }
            let video = videos.sort(
                (a, b) =>
                    b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight,
            )[0];
            sysState._activeEl = video;
            if (!sysState._cachedId) {
                window.vtBookmarkPanel?.hide(); // 無 ID 時隱藏書籤面板
                return window === window.top ? updateDebugStatus("OFF", "m1") : null;
            }
            if (sysState.activeVideoId !== sysState._cachedId) {
                sysState.activeVideoId = sysState._cachedId;
                sysState.isDataLoaded = false;
                const _loadTarget = sysState._cachedId; // [BUG 修復] 快取 ID 避免閉包跟蹤競態
                new Promise(resolve => chrome.runtime.sendMessage({ action: "VT_GET_RECORDS", ids: [_loadTarget] }, resolve)).then((res) => {
                    if (!res) res = {};
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
            // 有影片且有 ID：通知書籤面板顯示
            window.vtBookmarkPanel?.setVideo(sysState.activeVideoId);
        };
        tick();
        sysState.timer = setInterval(tick, CONFIG.checkInterval);
    }

    function enforceLimitAndSave(id, data) {
        if (chrome.runtime?.id)
            chrome.runtime
                .sendMessage({ action: "VT_SAVE_RECORD", id: id, data: data })
                .catch(() => { });
        _vtProgressCache.set(id, data.progress); // [效能優化] 本機直接更新快取，確保同一個分頁即使沒有廣播也能立刻重繪
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
                    // 更新 badge 垂直位置 (固定在縮圖左上角)
                    if (update.data.badgeEl) {
                        update.data.badgeEl.style.bottom = (update.rect.height - 3) + "px";
                    }
                }
            });

            window._overlaySyncLoop = requestAnimationFrame(syncOverlay);
        } else window._overlaySyncLoop = null;
    }

    // ─── 縮圖評分角標（Badge）─────────────────────────────────────────
    function _vtUpdateBadge(data, videoId) {
        const rating = window._vtRatingsCache?.[videoId];
        const isBookmarked = window._vtBookmarkedSet?.has(videoId);
        const icons = [];
        if (rating === 'like') icons.push('👍');
        if (rating === 'dislike') icons.push('😤');
        if (isBookmarked) icons.push('❤️');

        if (icons.length === 0) {
            if (data.badgeEl) data.badgeEl.style.display = 'none';
            return;
        }
        if (!data.badgeEl) {
            const badge = document.createElement('span');
            badge.className = 'vt-rating-badge';
            badge.style.cssText = 'position:absolute;left:3px;font-size:13px;pointer-events:none;line-height:1;text-shadow:0 1px 4px rgba(0,0,0,0.9);z-index:2;';
            data.barEl.appendChild(badge);
            data.badgeEl = badge;
        }
        data.badgeEl.textContent = icons.join('');
        data.badgeEl.style.display = 'block';
    }

    // 全域：供 vt_bookmarks.js 呼叫，在評分/書籤變更後刷新所有可見縮圖角標
    window._vtRefreshAllBadges = function () {
        activeOverlayBars.forEach((data) => {
            if (data.videoId) _vtUpdateBadge(data, data.videoId);
        });
    };

    function drawBar(container, pct, id) {
        if (!_overlaySyncLoop)
            window._overlaySyncLoop = requestAnimationFrame(syncOverlay);
        let data = activeOverlayBars.get(container);
        if (data && data.barEl.isConnected) {
            data.barFill.style.width = `${pct}%`;
            if (data.labelEl.innerText !== `ID: ${id}`)
                data.labelEl.innerText = `ID: ${id}`;
            _vtUpdateBadge(data, id); // 每次更新時同步角標
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
        lbl.style.cssText = `position:absolute;bottom:8px;left:0;font-size:12px;color:#ffeb3b;text-shadow:-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.9);padding:2px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%;line-height:1.2;font-weight:bold;display:${sysState._showMonitor ? "block" : "none"};`;
        lbl.innerText = `ID: ${id}`;
        track.append(bar, lbl);
        (document.body || document.documentElement).appendChild(track);
        const newData = { barEl: track, barFill: bar, labelEl: lbl, badgeEl: null, videoId: id };
        activeOverlayBars.set(container, newData);
        _vtUpdateBadge(newData, id); // 新建 bar 時立即畫角標
        if (newData.badgeEl) {
            newData.badgeEl.style.bottom = (rect.height - 3) + 'px'; // 相對於底部的 barEl，設定 bottom 為縮圖高度 - 3px，達到 top-left 效果
        }
    }

    function removeAllBars() {
        if (_vtObs) { _vtObs.disconnect(); window._vtObs = null; }
        if (_vtMut) { _vtMut.disconnect(); window._vtMut = null; }
        if (sysState.timer) { clearInterval(sysState.timer); sysState.timer = null; }
        if (sysState._barUpdateTimer) { clearInterval(sysState._barUpdateTimer); sysState._barUpdateTimer = null; }
        if (_overlaySyncLoop) { cancelAnimationFrame(_overlaySyncLoop); window._overlaySyncLoop = null; }
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
        window.debugPanel = document.createElement("div");
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
}
