// V-Train (VT) Core Implementation V1.0
// background.js - 確保所有網域都在白名單，並支援多國語言錯誤代碼傳遞
importScripts("db.js", "shared_i18n.js");

let _vtSaveLock = Promise.resolve(); // [架構師注入] 全域存檔隊列鎖，確保非同步存取順序性

// [CWS 效能修復] 問題 5：_vtSaveLock Max Queue Guard
// 防止高頻存檔時 Promise 鏈無限增長，以及 SW 休眠後鏈條被截斷導致存檔永久丟失
// 當隊列中有超過 VT_MAX_QUEUE 個 pending request 時，拒絕新入隊並直接回傳失敗
let _vtSaveLockDepth = 0;
const VT_MAX_QUEUE = 20;

// [CWS 效能修復] 問題 3：節流鎖（Throttle Lock）
// checkAndLockIfAllClosed 綁定了 onUpdated 與 onRemoved，在多分頁環境下會爆炸性觸發
// 元兇：5s 內最多執行一次 chrome.tabs.query，大幅降低事件風暴與 CPU 峰值
let _checkLockTimer = null;

function lockSystem() {
    chrome.storage.local.set({ isStealthMode: true }, () => {
        // console.log('[VT Security] 🛡️ System Locked');
    });
}

function checkAndLockIfAllClosed() {
    // [CWS 效能修復] 問題 3：套用節流鎖，5s 內同一時間窗口只執行一次 tabs.query
    if (_checkLockTimer) return; // 已有排程，直接跳過
    _checkLockTimer = setTimeout(() => {
        _checkLockTimer = null;
        chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
            if (tabs.length === 0) lockSystem();
        });
    }, 5000);
}

function injectScriptToExistingTabs() {
    // [效能修復 P2] 遞迴改 while 迴圈：原 processBatch() 遞迴呼叫沒有 await，
    // 在 MV3 Service Worker 環境中，SW 可能在批次間隙休眠導致後續批次被截斷。
    // 改為在同一個 async callback 裡用 for 迴圈，所有批次都在同一個 await 鏈中完成。
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, async (tabs) => {
        const batchSize = 5; // 每批次處理 5 個分頁
        for (let i = 0; i < tabs.length; i += batchSize) {
            const batch = tabs.slice(i, i + batchSize);

            await Promise.all(batch.map(async (tab) => {
                if (!tab.url || !tab.url.startsWith('http')) return;

                const urlObj = new URL(tab.url);
                const origin = `${urlObj.protocol}//*.${urlObj.hostname.replace(/^(www\.|m\.)/i, '')}/*`;

                const hasPerm = await new Promise(resolve => {
                    chrome.permissions.contains({ origins: [origin] }, resolve);
                });
                if (!hasPerm) return;

                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id, allFrames: true },
                    files: ["style.css"]
                }).catch(() => { });

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    files: ["db.js", "shared_i18n.js", "vt_utils.js", "vt_url_parser.js", "vt_tracker.js", "vt_bookmarks.js", "vt_trainer.js", "content.js"]
                }).catch(() => { });
            }));

            // 讓出主執行緒，確保上一批真正完成後再處理下一批
            if (i + batchSize < tabs.length) {
                await new Promise(r => setTimeout(r, 250));
            }
        }
    });
}

chrome.runtime.onStartup.addListener(lockSystem);

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        lockSystem();
        const nav = (chrome.i18n.getUILanguage() || 'en').toLowerCase(); // [CWS 修復] 改用原生 chrome.i18n.getUILanguage()，避免 OS 與瀏覽器語系不一致的判定誤差
        const lang = detectLanguage(nav); // [i18n 優化] 統一使用 shared_i18n.js 的 detectLanguage()，未來新增語言只需修改一處
        chrome.storage.local.set({ userLang: lang });
    }

    // [架構師注入] 資料遷移腳本：從 chrome.storage.local 轉移海量資料到 IndexedDB
    chrome.storage.local.get(null, async (res) => {
        if (res.vt_index && Array.isArray(res.vt_index)) {
            console.log('[VT Migration] Found vt_index, starting migration to IndexedDB...');
            let index = res.vt_index;
            for (let i = 0; i < index.length; i++) {
                const vid = index[i].id;
                if (res[vid]) {
                    await vtDB.putRecord(vid, res[vid]);
                }
            }
            // 清除舊資料
            const toRemove = index.map(item => item.id);
            toRemove.push('vt_index');
            toRemove.push('vt_video_count');
            chrome.storage.local.remove(toRemove, () => {
                console.log('[VT Migration] Completed and cleaned up local storage.');
            });
        }
    });

    injectScriptToExistingTabs();

    // 這裡原本就正確使用了原生 i18n
    chrome.contextMenus.create({
        id: "mark_vt_thumbnail",
        title: chrome.i18n.getMessage("contextMenuTrack"),
        contexts: ["all"]
    }, () => chrome.runtime.lastError);

    // 註冊計數器校準任務 (僅更新/安裝時執行一次)
    chrome.alarms.create('vt_init_count', { when: Date.now() + 3000 });
});

// [架構師無障礙版] 色盲友善高對比藍色，動態判斷系統語言，加大字體
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "mark_vt_thumbnail" && tab.url && tab.url.startsWith('http')) {
        const urlObj = new URL(tab.url);
        const baseDomain = urlObj.hostname.replace(/^(www\.|m\.)/i, '');
        const origin = `${urlObj.protocol}//*.${baseDomain}/*`;
        const reqTime = Date.now();
        chrome.permissions.request({ origins: [origin] }, (granted) => {
            if (!granted) return;
            const isNewGrant = (Date.now() - reqTime) > 500; // [BUG 修復] 語意修正：時間差大代表使用者剛完成新授權
            chrome.storage.local.set({ isStealthMode: false }, () => {
                chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["style.css"] }).catch(() => { });

                // [架構師修改] 確保點擊右鍵注入時，也帶上 db.js 和 shared_i18n.js
                chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["db.js", "shared_i18n.js", "vt_utils.js", "vt_url_parser.js", "vt_tracker.js", "vt_bookmarks.js", "vt_trainer.js", "content.js"] }).then(() => {
                    if (!isNewGrant) return setTimeout(() => chrome.tabs.sendMessage(tab.id, { action: "START_MARKING" }).catch(() => { }), 100);

                    // [架構師重構] 移除寫死的多國語言物件，改用原生 chrome.i18n.getMessage
                    // 若抓不到（例如忘記在 _locales 設定），則退回預設英文
                    const msg = chrome.i18n.getMessage("toastAuthSuccess") || "☑️ Success! Right-click thumbnail again.";

                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (m) => {
                            let t = document.createElement('div');
                            t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1976d2;color:#fff;padding:16px 32px;border-radius:10px;font-size:20px;font-weight:bold;z-index:2147483647;box-shadow:0 6px 16px rgba(0,0,0,0.4);transition:opacity 0.3s;pointer-events:none;letter-spacing:1px;';
                            t.innerText = m; document.body.appendChild(t);
                            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
                        },
                        args: [msg]
                    }).catch(() => { });
                }).catch(() => { });
            });
        });
    }
});

chrome.tabs.onRemoved.addListener(() => setTimeout(checkAndLockIfAllClosed, 200));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkAndLockIfAllClosed();
        if (tab.url && tab.url.startsWith('http')) {
            const urlObj = new URL(tab.url);
            const baseDomain = urlObj.hostname.replace(/^(www\.|m\.)/i, '');
            const origin = `${urlObj.protocol}//*.${baseDomain}/*`;
            chrome.permissions.contains({ origins: [origin] }, (hasPerm) => {
                if (hasPerm) {
                    chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ["style.css"] }).catch(() => { });
                    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["db.js", "shared_i18n.js", "vt_utils.js", "vt_url_parser.js", "vt_tracker.js", "vt_bookmarks.js", "vt_trainer.js", "content.js"] }).catch(() => { });
                }
            });
        }
    }
});

// [架構師升級] 執行優化版索引垃圾回收 (同步鎖定版)
async function runOptimizedGCInsideLock() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['isProVersion'], async (items) => {
            let maxLimit = items.isProVersion ? 200000 : 200;
            let dropCount = items.isProVersion ? 100 : 10;
            try {
                await vtDB.runGC(maxLimit, dropCount);
            } catch (e) {
                console.error('[VTDatabase] GC Error:', e);
            }
            resolve();
        });
    });
}

// [架構師升級] 建立 RAM 快取，攔截磁碟 I/O，解決頻繁存檔時的效能瓶頸
let _swCache = { isLoaded: false, isPro: false };
chrome.storage.onChanged.addListener((changes) => {
    if (changes.isProVersion) _swCache.isPro = !!changes.isProVersion.newValue;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'VT_OPEN_BOOKMARKS') {
        chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
        return;
    }

    if (request.action === 'VT_OPEN_BUY_PAGE') {
        const BUY_URL = 'https://ivr-extension.lemonsqueezy.com/checkout/buy/3e17b694-3f55-4e64-8aa6-bd6244bf1af4';
        chrome.tabs.create({ url: BUY_URL });
        return;
    }

    if (request.action === 'VT_GET_RECORDS') {
        globalThis.vtDB.getRecords(request.ids || [])
            .then(data => sendResponse(data))
            .catch(err => {
                console.error('[VT] Get Records Error:', err);
                sendResponse({});
            });
        return true;
    }

    if (request.action === 'VT_SAVE_RECORD') {
        const { id, data } = request;

        // [CWS 效能修復] 問題 5：Max Queue Guard 入隊保護
        // 當隊列積壓超過 VT_MAX_QUEUE 時，直接拒絕新入隊請求，回傳 queue_full
        // 防止高頻存檔時 Promise 鏈條無限增長，以及 MW3 SW 休眠後鏈條被截斷導致死鎖
        if (_vtSaveLockDepth >= VT_MAX_QUEUE) {
            try { sendResponse({ ok: false, reason: 'queue_full' }); } catch (e) {}
            return true;
        }
        _vtSaveLockDepth++;

        _vtSaveLock = _vtSaveLock.then(() => new Promise((resolve) => {
            const checkAndSave = async () => {
                try {
                    if (!_swCache.isLoaded) {
                        const res = await new Promise(r => chrome.storage.local.get(['isProVersion'], r));
                        _swCache.isPro = !!res.isProVersion;
                        _swCache.isLoaded = true;
                    }

                    await vtDB.putRecord(id, data);
                    
                    const count = await vtDB.count();
                    chrome.storage.local.set({ vt_video_count: count });
                    
                    // [進度同步修復] 廣播進度給所有分頁，模擬過去 chrome.storage.onChanged 的全域跨分頁同步效果
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                                action: "VT_PROGRESS_UPDATE",
                                id: id,
                                progress: data.progress
                            }).catch(() => {});
                        });
                    });

                    const limit = _swCache.isPro ? 200000 : 200;
                    if (count > limit) {
                        await runOptimizedGCInsideLock();
                    }
                } catch (e) {
                    console.error('[VTDatabase] Save Record Error:', e);
                }
                resolve();
            };
            checkAndSave();
        }))
        // [MV3 修復] 存檔完成後呼叫 sendResponse 正式關閉 message channel。
        // 搭配下方的 return true，Chrome 會在整個 storage 操作鏈完成前讓 SW 保持活躍，
        // 防止 SW 在 Promise 隊列執行到一半時休眠並重置 _vtSaveLock。
        .then(() => {
            _vtSaveLockDepth = Math.max(0, _vtSaveLockDepth - 1); // [問題 5] 成功後遞減，防止計數器永久累積
            try { sendResponse({ ok: true }); } catch (e) { }
        })
        .catch(() => {
            _vtSaveLockDepth = Math.max(0, _vtSaveLockDepth - 1); // [問題 5] 失敗也要遞減，防止永久封鎖後續入隊
            try { sendResponse({ ok: false }); } catch (e) { }
        });
        return true; // [MV3 修復] 宣告非同步回應，阻止 Chrome 提早終止 SW
    } else if (request.action === "VT_TRIGGER_GC") {
        runOptimizedGC();
    } else if (request.action === "VT_REBUILD_INDEX") {
        // [架構師優化] 改用 IndexedDB 後不再需要手動重建本地記憶體索引，直接執行 GC 即可
        runOptimizedGC();
    } else if (request.action === "VERIFY_LICENSE") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        chrome.storage.local.get(['vt_instance_id'], (res) => {
            let instanceId = res.vt_instance_id;
            if (!instanceId) {
                instanceId = 'VT_' + crypto.randomUUID(); // [CODE 修復] 改用密碼學安全的 UUID，避免碰撞
                chrome.storage.local.set({ vt_instance_id: instanceId });
            }

            fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'license_key': request.key,
                    'instance_name': instanceId
                }),
                signal: controller.signal
            })
                .then(async res => {
                    const text = await res.text();
                    try { return JSON.parse(text); } catch (e) { throw new Error("Server response is not valid JSON"); }
                })
                .then(data => {
                    clearTimeout(timeoutId);

                    if (data.activated === true) {
                        chrome.storage.local.set({
                            isProVersion: true,
                            storedLicenseKey: request.key
                        }, () => {
                            sendResponse({ success: true });
                        });
                    } else {
                        // [架構師重構] 不再回傳寫死的英文，改回傳 Error Code (對應 shared_i18n.js)
                        // 如果伺服器有自訂錯誤訊息 (data.error)，則原封不動傳回 (加上 ❌ 前綴)
                        let code = 'msgInvalidKey';
                        let dynamicMsg = data.error ? `❌ ${data.error}` : null;

                        sendResponse({ success: false, errorCode: code, dynamicMsg: dynamicMsg });
                    }
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    // [架構師重構] 網路錯誤也改為回傳 Error Code
                    sendResponse({ success: false, errorCode: 'msgNetworkError' });
                });
        });

        return true;
    }
});

chrome.permissions.onAdded.addListener((permissions) => {
    if (permissions.origins && permissions.origins.length > 0) {
        chrome.tabs.query({ url: permissions.origins }, (tabs) => {
            for (let tab of tabs) {
                chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: ["style.css"] }).catch(() => { });
                // [安全修復 #5] 補上遺漏的 db.js，確保 content.js 執行前 vtDB 已就緒
                chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["db.js", "shared_i18n.js", "vt_utils.js", "vt_url_parser.js", "vt_tracker.js", "vt_bookmarks.js", "vt_trainer.js", "content.js"] }).catch(() => { });
            }
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'vt_init_count') runOptimizedGC();
});

function runOptimizedGC() {
    runOptimizedGCInsideLock();
}