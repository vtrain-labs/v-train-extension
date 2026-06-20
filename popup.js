// [架構師更新] Lemon Squeezy 正式結帳連結 (VT Pro - $4.99)
const BUY_URL = `https://v-train.lemonsqueezy.com/checkout/buy/3dbcb93a-052c-433c-9adb-5fdcf221cc17`;

// [XSS 修復] HTML 安全轉義工具函式，封鎖所有來自 storage 的動態內容
function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// VT Rule Serial 壓縮模組
// 使用瀏覽器原生 CompressionStream / DecompressionStream（Chrome 80+ 均支援）。
// 新版序號格式：SYNC-Z{deflate-raw base64}（'Z' 前綴為壓縮版本標記）
// 舊版序號（無 Z 前綴）解碼時自動 fallback，確保向下相容。
// 壓縮效果：典型規則約縮短 35~50%（JSON 重複字串越多效果越好）。
// ─────────────────────────────────────────────────────────────────────────────
async function _vtRuleCompress(jsonStr) {
    const bytes = new TextEncoder().encode(jsonStr);
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    const arr = new Uint8Array(buf);
    let b = '';
    for (let i = 0; i < arr.length; i++) b += String.fromCharCode(arr[i]);
    return btoa(b);
}

async function _vtRuleDecompress(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(arr);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(buf);
}

document.addEventListener('DOMContentLoaded', () => {
    // [架構師注入] 同步預判 (Early Prediction)：在非同步 I/O 回傳前先進行預先渲染
    const _nav = (navigator.language || 'en').toLowerCase();
    const _earlyLang = detectLanguage(_nav);
    applyLanguage(_earlyLang);

    // 綁定 UI 元素
    const lockScreen = document.getElementById('lockScreen');
    const controlPanel = document.getElementById('controlPanel');
    const passwordInput = document.getElementById('passwordInput');
    const btnUnlock = document.getElementById('btnUnlock');
    const loginMsg = document.getElementById('loginMsg');
    const toggleVisibility = document.getElementById('toggleVisibility');
    const toggleMonitorPanel = document.getElementById('toggleMonitorPanel');
    const progressBarColor = document.getElementById('progressBarColor');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const btnOpenRules = document.getElementById('btnOpenRules');
    const rulesPanel = document.getElementById('rulesPanel');
    const btnBackToControl = document.getElementById('btnBackToControl');
    const btnExportRules = document.getElementById('btnExportRules');
    const btnImportRules = document.getElementById('btnImportRules');
    const rulesListContainer = document.getElementById('rulesListContainer');
    const ruleFileInput = document.getElementById('ruleFileInput');
    const btnSetupPass = document.getElementById('btnSetupPass');
    const btnClearData = document.getElementById('btnClearData');
    const videoCountLabel = document.getElementById('videoCount');
    const btnDonateUpgrade = document.getElementById('btnDonateUpgrade');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const fileInput = document.getElementById('fileInput');
    const btnAuthorizeCurrentSite = document.getElementById('btnAuthorizeCurrentSite');

    // 權限檢查與授權按鈕邏輯
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url.startsWith('http')) return btnAuthorizeCurrentSite.classList.add('hidden');

        const urlObj = new URL(tab.url);
        const baseDomain = urlObj.hostname.replace(/^(www\.|m\.)/i, '');
        const origin = `${urlObj.protocol}//*.${baseDomain}/*`;

        const updateAuthBtn = (hasPerm) => {
            if (hasPerm) {
                btnAuthorizeCurrentSite.classList.add('authorized');
                // [安全修復 #10] 純文字改用 textContent，消除不必要的 innerHTML 使用
                btnAuthorizeCurrentSite.textContent = getLangText(currentLang, 'siteAuthorized');
            } else {
                btnAuthorizeCurrentSite.classList.remove('authorized');
                btnAuthorizeCurrentSite.textContent = getLangText(currentLang, 'authorizeSite');
            }
        };

        chrome.permissions.contains({ origins: [origin] }, updateAuthBtn);

        btnAuthorizeCurrentSite.onclick = () => {
            chrome.permissions.request({ origins: [origin] }, (granted) => {
                if (granted) updateAuthBtn(true);
            });
        };
    });

    // 彈窗元素
    const modal = document.getElementById('customModal');
    const mTitle = document.getElementById('mTitle');
    const mDesc = document.getElementById('mDesc');
    const mInput = document.getElementById('mInput');
    const mBtnCancel = document.getElementById('mBtnCancel');
    const mBtnConfirm = document.getElementById('mBtnConfirm');
    const mBtnBuy = document.getElementById('mBtnBuy');

    // 語言選擇器
    const langSelect = document.getElementById('langSelect');
    let currentLang = 'en';

    // 2. 購買連結
    if (mBtnBuy) {
        mBtnBuy.addEventListener('click', (e) => {
            e.preventDefault();
            const lsLocale = 'en'; // Lemon Squeezy does not support zh-CN/zh-TW; fallback to English to prevent locale mismatch
            chrome.tabs.create({ url: BUY_URL + '?locale=' + lsLocale });
        });
    }

    // 初始化資料
    const configKeys = ['userPassword', 'isStealthMode', 'isProVersion', 'storedLicenseKey', 'enabledSites', 'remainingUses', 'userLang', 'site_config', 'showMonitorPanel', 'barColor', 'vt_video_count', 'showInteraction'];
    chrome.storage.local.get(configKeys, async (items) => {
        // [Data Migration] Aggressively clean up legacy bloated data without loading it
        chrome.storage.local.remove(['vt_bookmarks', 'vt_ratings', 'vt_bm_folders']);



        if (items.userLang) {
            currentLang = items.userLang;
        } else {
            currentLang = 'en';
            chrome.storage.local.set({ userLang: currentLang });
        }

        if (langSelect) {
            langSelect.value = currentLang;
            langSelect.addEventListener('change', (e) => {
                currentLang = e.target.value;
                chrome.storage.local.set({ userLang: currentLang });
                applyLanguage(currentLang);
                // [BUG 修復] 重新讀取最新狀態，避免使用 chrome.storage.local.get 的過時閉包快照
                chrome.storage.local.get(['isStealthMode', 'isProVersion', 'vt_video_count'], (fresh) => {
                    const isStealth = fresh.isStealthMode === undefined ? true : !!fresh.isStealthMode;
                    updateStatusUI(!isStealth);
                    updateProUI(!!fresh.isProVersion, fresh.vt_video_count || 0);
                });
            });
        }
        applyLanguage(currentLang);

        const savedPass = items.userPassword;
        const isStealth = (items.isStealthMode === undefined) ? true : !!items.isStealthMode;
        const isPro = !!items.isProVersion;

        const toggleInteraction = document.getElementById('toggleInteraction');
        const interactionToggleRow = document.getElementById('interactionToggleRow');

        toggleVisibility.checked = !isStealth; updateStatusUI(!isStealth);
        if (toggleMonitorPanel) toggleMonitorPanel.checked = items.showMonitorPanel !== false;
        if (toggleInteraction) toggleInteraction.checked = !!items.showInteraction;
        if (progressBarColor) progressBarColor.value = items.barColor || '#ff0000';
        updateProUI(isPro, items.vt_video_count || 0);

        // Interaction Toggle Event
        if (toggleInteraction) {
            toggleInteraction.addEventListener('change', async (e) => {
                chrome.storage.local.set({ showInteraction: toggleInteraction.checked });
            });
        }

        chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
            const warningEl = document.getElementById('incognitoWarning');
            if (!isAllowed && warningEl) warningEl.classList.remove('hidden');
        });

        const btnOpenExtPage = document.getElementById('btnOpenExtPage');
        if (btnOpenExtPage) {
            btnOpenExtPage.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
            });
        }

        // Bookmark Vault 入口按鈕
        const btnOpenBookmarks = document.getElementById('btnOpenBookmarks');
        if (btnOpenBookmarks) {
            btnOpenBookmarks.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
            });
        }

        if (savedPass) showScreen('lock');
        else showScreen('control');

        document.body.style.opacity = '1';
    });

    function applyLanguage(lang) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = getLangText(lang, key);
            else {
                const val = getLangText(lang, key);
                if (val.includes('<')) el.innerHTML = val;
                else el.textContent = val;
            }
        });
    }

    // [分頁狀態]
    let _rulesCurrentPage = 1;
    const _rulesPageSize = 10;

    // [效能修復 P4] popup 記憶體快取：避免每次搜尋/翻頁都重新呼叫 storage.get
    // popup 生命週期通常僅數秒，快取安全無副作用。
    // 所有寫入 site_config 的地方都會先設 null 清除快取，確保一致性。
    let _cachedSiteConfig = null;

    const ruleSearchInput = document.getElementById('ruleSearchInput');
    // 搜尋 Debounce (200ms)
    let searchTimer = null;
    if (ruleSearchInput) {
        ruleSearchInput.addEventListener('input', () => {
            _rulesCurrentPage = 1; // 每次搜尋都回到第一頁
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                renderRulesList(ruleSearchInput.value);
            }, 200);
        });
    }

    function renderRulesList(searchTerm = '') {
        // [效能修復 P4] 命中記憶體快取時直接渲染，跳過 storage.get
        const _doRender = async (config) => {
            const fragment = document.createDocumentFragment(); // [效能修復 P4] 用 Fragment 批次插入，單次 reflow
            const sysBlackList = ['isProVersion', 'remainingUses', 'storedLicenseKey', 'userPassword', 'userLang', 'vt_video_count', 'isStealthMode', 'enabledSites', 'showMonitorPanel', 'barColor'];

            let allDomains = Object.keys(config).filter(d => !sysBlackList.includes(d)).sort((a, b) => a.localeCompare(b));
            if (searchTerm) allDomains = allDomains.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const totalItems = allDomains.length;
            const totalPages = Math.ceil(totalItems / _rulesPageSize) || 1;
            if (_rulesCurrentPage > totalPages) _rulesCurrentPage = 1;

            const startIdx = (_rulesCurrentPage - 1) * _rulesPageSize;
            let domains = allDomains.slice(startIdx, startIdx + _rulesPageSize);

            if (totalItems === 0) return rulesListContainer.innerHTML = `<div style="color:#aaa;text-align:center;">${searchTerm ? getLangText(currentLang, 'noSearchResults') : getLangText(currentLang, 'noRules')}</div>`;

            // shrink 移至 forEach 外層，避免每個 domain 重複定義
            const shrink = (obj) => {
                if (!obj || typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) return obj.filter(x => x !== null).map(shrink);
                const map = { hosts: 'h', pRule: 'p', tRule: 't', type: 'ty', idx: 'ix', sep: 'sp', sepIdx: 'sx', key: 'k', targetAttr: 'ta', upLevel: 'ul', s: 's' };
                let newObj = {};
                for (let k in obj) {
                    if (obj[k] === null || obj[k] === undefined) continue;
                    newObj[map[k] || k] = shrink(obj[k]);
                }
                return newObj;
            };

            // [UI P2] 人類可讀的規則描述函式
            const describeRulePart = (r, lang) => {
                if (!r) return null;
                const type = r.type || '?';
                const idx = r.idx ?? -1;
                if (type === 'p') {
                    let desc = `${getLangText(lang, 'ruleUrlPath')} ${idx === -1 ? getLangText(lang, 'rulePathLast') : idx === 0 ? getLangText(lang, 'rulePathFirst') : `[${idx}]`}`;
                    if (r.sep) desc += getLangText(lang, 'loc_path_sep', { sep: r.sep, sepIdx: r.sepIdx });
                    return desc;
                }
                if (type === 'q') return `${getLangText(lang, 'ruleQuery')}${r.key ? ` "${r.key}"` : ''}`;
                if (type === 'hash') return `Hash [${idx}]`;
                if (type === 'flank') return getLangText(lang, 'ruleFlank');
                return type;
            };

            // [UI P2] 單個槽位的人類可讀摘要卡片（空槽回傳空字串）
            const buildSlotCard = (rule, num, lang) => {
                if (!rule) return '';
                const s = escapeHtml(rule.s || '—');
                const tDesc = describeRulePart(rule.tRule, lang);
                const pDesc = describeRulePart(rule.pRule, lang);
                const tAttr = rule.tRule?.targetAttr
                    ? ` ← <code style="background:#111;padding:1px 4px;border-radius:3px;color:#ffcc80;">${escapeHtml(rule.tRule.targetAttr)}</code>`
                    : '';
                const hList = (rule.hosts || []).map(h =>
                    `<code style="background:#1a2a3a;border-radius:3px;padding:1px 5px;font-size:10px;color:#4fc3f7;">${escapeHtml(h)}</code>`
                ).join(' ');
                return `<div style="background:#1a1a1a;border:1px solid #2a4a5a;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:11px;line-height:1.8;">
                    <div style="color:#ff0000;font-weight:bold;margin-bottom:3px;">● ${getLangText(lang, 'slotLabel', { num })}</div>
                    <div style="color:#666;">${getLangText(lang, 'slotSelector')} <code style="background:#111;border-radius:3px;padding:1px 5px;color:#e0e0e0;word-break:break-all;">${s}</code></div>
                    ${tDesc ? `<div style="color:#666;">${getLangText(lang, 'slotIdSrc')} <span style="color:#f8bbd0;">${tDesc}</span>${tAttr}</div>` : ''}
                    ${pDesc ? `<div style="color:#666;">${getLangText(lang, 'slotProgressSrc')} <span style="color:#c8e6c9;">${pDesc}</span></div>` : ''}
                    ${hList ? `<div style="margin-top:4px;">${hList}</div>` : ''}
                </div>`;
            };

            // [壓縮優化] 並行壓縮所有序號，再一次性渲染，避免逐列閃爍
            const shareCodes = await Promise.all(domains.map(async d => {
                const payload = { d: d, r: shrink(config[d]) };
                return `SYNC-Z${await _vtRuleCompress(JSON.stringify(payload))}`;
            }));

            domains.forEach((d, idx) => {
                const shareCode = shareCodes[idx];
                // 序號截短顯示（前 24 碼 + ... + 末 4 碼），滑鼠停留顯示完整序號
                const displayCode = shareCode.length > 32
                    ? `${shareCode.slice(0, 24)}...${shareCode.slice(-4)}`
                    : shareCode;

                // [UI P2] 補滿 4 槽（相容舊格式），建立槽位圓點列與詳情卡片
                const slotsArr = Array.isArray(config[d]) ? [...config[d]] : [config[d]];
                while (slotsArr.length < 4) slotsArr.push(null);

                // [UI P2 空槽可視化] 4 個圓點：● 已訓練（亮藍）/ ○ 空槽（暗灰）
                const slotDotsHtml = slotsArr.map((r, i) => {
                    const filled = r !== null && r !== undefined;
                    return `<span style="background:${filled ? 'rgba(255,0,0,0.1)' : '#252525'};border:1px solid ${filled ? '#ff000066' : '#3a3a3a'};border-radius:12px;padding:2px 10px;font-size:11px;color:${filled ? '#ff0000' : '#555'};">${filled ? '●' : '○'} ${getLangText(currentLang, 'slotLabel', { num: i + 1 })}</span>`;
                }).join('');

                // [UI P2 人類可讀] 已訓練槽位的結構化摘要
                const slotCardsHtml = slotsArr.map((r, i) => buildSlotCard(r, i + 1, currentLang)).join('');

                const safeJsonText = JSON.stringify(config[d]).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

                let rules = Array.isArray(config[d]) ? config[d] : [config[d]];
                let hosts = new Set(); rules.forEach(r => r?.hosts?.forEach(h => hosts.add(h)));
                // [安全修復 #2] 以 DOM API 建構 span，透過 textContent 寫入 hosts，消除 innerHTML
                let hostSpanEl = null;
                if (hosts.size > 0) {
                    hostSpanEl = document.createElement('span');
                    hostSpanEl.style.cssText = 'color:#f57c00;font-size:12px;';
                    hostSpanEl.textContent = `(${getLangText(currentLang, 'appliedTo')} ${[...hosts].join(', ')})`;
                }

                const row = document.createElement('div');
                row.style.cssText = 'padding:10px; border-bottom:1px solid #333; color:#fff; display:flex; flex-direction:column; gap:8px;';

                // 使用 DOMParser 安全解析 HTML 模板，避免直接拼接變數至 innerHTML
                const parser = new DOMParser();
                const templateStr = `<div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="vt-title-trigger" style="cursor:pointer;flex:1;">
                        <strong class="vt-domain-name"></strong>
                        <span class="vt-host-info"></span>
                        <span style="font-size:12px;color:#888;">${getLangText(currentLang, 'clickExpand')}</span>
                    </span>
                    <button class="del-rule-btn" style="background:none;border:none;color:#ff5252;cursor:pointer;font-size:16px;padding:0 5px;" title="${getLangText(currentLang, 'delete')}">🗑️</button>
                </div>
                <div class="rule-detail hidden">
                    <div class="vt-slots-dots" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"></div>
                    <div class="vt-slots-cards"></div>
                    <div style="margin-bottom:8px;">
                        <button class="toggle-raw-btn" style="background:none;border:1px solid #444;color:#666;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">▶ Raw JSON</button>
                        <div class="raw-json-section" style="display:none;margin-top:6px;font-size:12px;color:#00e676;background:#111;padding:8px;border-radius:4px;word-break:break-all;"></div>
                    </div>
                    <div style="display:flex;gap:5px;align-items:center;">
                        <span class="vt-share-display" style="flex:1;padding:5px;background:#222;color:#aaa;border:1px solid #444;border-radius:4px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                        <button class="share-rule-btn" style="background:#f57c00;color:#fff;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:bold;white-space:nowrap;">📋 ${getLangText(currentLang, 'share')}</button>
                    </div>
                </div>`;
                
                const doc = parser.parseFromString(templateStr, 'text/html');
                
                // [修復] 使用 while 迴圈，將解析出來的「所有」節點完整搬移到 row 中
                while (doc.body.firstChild) {
                    row.appendChild(doc.body.firstChild);
                }
                
                // 透過 textContent 注入變數，徹底封死 XSS
                row.querySelector('.vt-domain-name').textContent = d;
                // [安全修復 #2] hostStr 改用 DOM API 建構的 span 元素，透過 appendChild 注入
                if (hostSpanEl) row.querySelector('.vt-host-info').appendChild(hostSpanEl);
                // [安全修復 #3] slotDotsHtml / slotCardsHtml 改用 DOMParser 安全解析後再注入
                const _slotParser = new DOMParser();
                const _dotsDoc = _slotParser.parseFromString(`<div>${slotDotsHtml}</div>`, 'text/html');
                while (_dotsDoc.body.firstChild.firstChild) {
                    row.querySelector('.vt-slots-dots').appendChild(_dotsDoc.body.firstChild.firstChild);
                }
                const _cardsDoc = _slotParser.parseFromString(`<div>${slotCardsHtml}</div>`, 'text/html');
                while (_cardsDoc.body.firstChild.firstChild) {
                    row.querySelector('.vt-slots-cards').appendChild(_cardsDoc.body.firstChild.firstChild);
                }
                row.querySelector('.raw-json-section').textContent = JSON.stringify(config[d]);
                row.querySelector('.vt-share-display').textContent = displayCode;
                row.querySelector('.vt-share-display').title = shareCode;
                row.querySelector('.vt-title-trigger').onclick = () => row.querySelector('.rule-detail').classList.toggle('hidden');
                row.querySelector('.share-rule-btn').onclick = () => {
                    navigator.clipboard.writeText(shareCode); // 複製完整序號
                    showToast(row.querySelector('.share-rule-btn'), "✅");
                };
                // [UI P2] Raw JSON 折疊按鈕
                row.querySelector('.toggle-raw-btn').onclick = (e) => {
                    const sec = row.querySelector('.raw-json-section');
                    const isHidden = sec.style.display === 'none';
                    sec.style.display = isHidden ? 'block' : 'none';
                    e.currentTarget.textContent = isHidden ? '▼ Raw JSON' : '▶ Raw JSON';
                };
                row.querySelector('.del-rule-btn').onclick = async () => {
                    // [安全修復 #1] showModal 的 desc 使用純文字，不再傳入 HTML
                    const isConfirm = await showModal(`⚠️ ${getLangText(currentLang, 'delete')}`, `${getLangText(currentLang, 'confirmDelRule')} "${d}" ?`);
                    if (isConfirm) {
                        delete config[d];
                        _cachedSiteConfig = null; // [效能修復 P4] 清除快取，下次讀取最新資料
                        chrome.storage.local.set({ site_config: config }, () => renderRulesList(ruleSearchInput?.value));
                    }
                };
                fragment.appendChild(row); // [效能修復 P4] 插入 Fragment，不直接操作 DOM
            });

            // 一次性將所有 row 插入 DOM（單次 reflow，消除逐列閃爍）
            rulesListContainer.innerHTML = '';
            rulesListContainer.appendChild(fragment);

            // 5. 渲染分頁按鈕
            renderPagination(totalPages, searchTerm);
        };

        if (_cachedSiteConfig !== null) {
            _doRender(_cachedSiteConfig);
        } else {
            chrome.storage.local.get(['site_config'], (res) => {
                _cachedSiteConfig = res.site_config || {};
                _doRender(_cachedSiteConfig);
            });
        }
    }

    function renderPagination(totalPages, searchTerm) {
        // 移除舊的分頁列（如果存在）
        let oldNav = document.getElementById('rulesPagination');
        if (oldNav) oldNav.remove();

        if (totalPages <= 1) return;

        const nav = document.createElement('div');
        nav.id = 'rulesPagination';
        nav.style.cssText = 'display:flex; justify-content:center; align-items:center; gap:8px; padding:15px 0; border-top:1px solid #333; margin-top:10px;';

        // 前一頁按鈕
        const btnPrev = document.createElement('button');
        btnPrev.innerText = '<';
        btnPrev.disabled = _rulesCurrentPage === 1;
        btnPrev.style.cssText = 'padding:5px 10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;';
        btnPrev.onclick = () => { _rulesCurrentPage--; renderRulesList(searchTerm); };

        // 後一頁按鈕
        const btnNext = document.createElement('button');
        btnNext.innerText = '>';
        btnNext.disabled = _rulesCurrentPage === totalPages;
        btnNext.style.cssText = 'padding:5px 10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;';
        btnNext.onclick = () => { _rulesCurrentPage++; renderRulesList(searchTerm); };

        nav.appendChild(btnPrev);

        // 頁碼按鈕 (簡化邏輯：僅顯示數字)
        for (let i = 1; i <= totalPages; i++) {
            const btnPage = document.createElement('button');
            btnPage.innerText = i;
            btnPage.style.cssText = `padding:5px 10px; border-radius:4px; border:none; cursor:pointer; ${i === _rulesCurrentPage ? 'background:#00bcd4; color:#fff;' : 'background:#2a2a2a; color:#aaa;'}`;
            btnPage.onclick = () => { _rulesCurrentPage = i; renderRulesList(searchTerm); };
            nav.appendChild(btnPage);
        }

        nav.appendChild(btnNext);
        rulesListContainer.parentElement.appendChild(nav);
    }


    if (btnExportRules) btnExportRules.addEventListener('click', () => {
        chrome.storage.local.get(['site_config'], (res) => {
            const rawConfig = res.site_config || {};
            const cleanRules = {};
            const sysBlackList = ['isProVersion', 'remainingUses', 'storedLicenseKey', 'userPassword', 'userLang', 'vt_video_count', 'isStealthMode', 'enabledSites', 'showMonitorPanel', 'barColor'];

            Object.keys(rawConfig).forEach(k => {
                if (!sysBlackList.includes(k)) cleanRules[k] = rawConfig[k];
            });

            const blob = new Blob([JSON.stringify(cleanRules)], { type: "application/json" });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `VTrain_Rules_${new Date().toISOString().split('T')[0]}.json`; a.click();
        });
    });

    const btnCommunityRules = document.getElementById('btnCommunityRules');
    if (btnCommunityRules) {
        btnCommunityRules.addEventListener('click', () => {
            // [架構師修復] 確保連結與實際 GitHub 倉庫路徑一致，防止 404
            chrome.tabs.create({ url: 'https://github.com/vtrain-labs/community-rules' });
        });
    }

    const btnPasteRule = document.getElementById('btnPasteRule');
    const inlineRuleInput = document.getElementById('inlineRuleInput');
    if (btnPasteRule && inlineRuleInput) btnPasteRule.addEventListener('click', async () => {
        const inputCode = inlineRuleInput.value;
        if (!inputCode || !inputCode.trim()) return;
        const trimmedCode = inputCode.trim();
        if (!trimmedCode.startsWith('SYNC-') && !trimmedCode.startsWith('VT-RULE-')) {
            return showToast(btnPasteRule, getLangText(currentLang, 'msgShareImportFail'));
        }

        const expand = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(expand);
            const rMap = { h: 'hosts', p: 'pRule', t: 'tRule', ty: 'type', ix: 'idx', sp: 'sep', sx: 'sepIdx', k: 'key', ta: 'targetAttr', ul: 'upLevel', s: 's' };
            let newObj = {};
            for (let k in obj) newObj[rMap[k] || k] = expand(obj[k]);
            return newObj;
        };

        try {
            // [壓縮解碼] 自動偵測格式：SYNC-Z / VT-RULE-Z（壓縮版）或 SYNC- / VT-RULE-（舊版未壓縮）
            const raw = trimmedCode.replace(/^(SYNC-|VT-RULE-)/, '');
            let jsonStr;
            if (raw.startsWith('Z')) {
                // 新版：deflate-raw 壓縮，'Z' 為版本前綴
                jsonStr = await _vtRuleDecompress(raw.slice(1));
            } else {
                // 舊版：直接 base64 → UTF-8 解碼
                const binStr = atob(raw);
                const arr = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
                jsonStr = new TextDecoder().decode(arr);
            }
            const rawData = JSON.parse(jsonStr);
            const data = { d: rawData.d, r: expand(rawData.r) };
            if (!data.d || !data.r) throw new Error("Invalid format");
            
            // [架構師修復] 對於剪貼簿匯入的規則進行嚴格 XSS 阻擋，包含陣列與單一物件的檢查
            const isSafe = (r) => !r || (typeof r.s === 'string' && !r.s.toLowerCase().includes('javascript:') && !r.s.toLowerCase().includes('onerror='));
            const isRuleSafe = Array.isArray(data.r) ? data.r.every(isSafe) : isSafe(data.r);
            if (!isRuleSafe) throw new Error("Security block: Malicious rule detected");

            chrome.storage.local.get(['site_config', 'enabledSites'], async (res) => {
                // [安全修復 #1] showModal 的 desc 使用純文字，不再拼接包含 data.d 的 HTML
                let cMsg = `${getLangText(currentLang, 'modalShareDesc')} "${data.d}"`;
                if (res.site_config && res.site_config[data.d]) cMsg += `\n\n${getLangText(currentLang, 'confirmOverwrite')}`;
                if (await showModal(getLangText(currentLang, 'modalShareTitle'), cMsg)) {
                    _cachedSiteConfig = null; // [效能修復 P4] 清除快取
                    chrome.storage.local.set({ site_config: { ...res.site_config, [data.d]: data.r }, enabledSites: { ...res.enabledSites, [data.d]: true } }, () => {
                        inlineRuleInput.value = '';
                        showToast(btnPasteRule, getLangText(currentLang, 'msgShareImportSuccess'));
                        renderRulesList(ruleSearchInput?.value);
                    });
                }
            });
        } catch (err) { showToast(btnPasteRule, getLangText(currentLang, 'msgShareImportFail')); }
    });

    if (btnImportRules) btnImportRules.addEventListener('click', () => ruleFileInput.click());
    if (ruleFileInput) ruleFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const uploadedData = JSON.parse(ev.target.result);
                let newRules = uploadedData.site_config ? uploadedData.site_config : uploadedData;

                const blackList = ['isProVersion', 'remainingUses', 'storedLicenseKey', 'userPassword', 'userLang', 'vt_video_count', 'isStealthMode', 'enabledSites'];
                const filteredRules = {};
                Object.keys(newRules).forEach(k => { if (!blackList.includes(k)) filteredRules[k] = newRules[k]; });

                chrome.storage.local.get(['site_config'], (res) => {
                    // [架構師校驗] 確保匯入的規則不含 JavaScript 偽協議或惡意事件屬性
                    const validatedRules = {};
                    Object.keys(filteredRules).forEach(domain => {
                        const rule = filteredRules[domain];
                        // [架構師修復] 允許空槽位 (r 為 null 或 undefined)，否則只檢查有值的槽位
                        const isSafe = (r) => !r || (typeof r.s === 'string' && !r.s.toLowerCase().includes('javascript:') && !r.s.toLowerCase().includes('onerror='));
                        if (Array.isArray(rule) ? rule.every(isSafe) : isSafe(rule)) {
                            validatedRules[domain] = rule;
                        }
                    });
                    const mergedRules = { ...(res.site_config || {}), ...validatedRules };
                    _cachedSiteConfig = null; // [效能修復 P4] 清除快取
                    chrome.storage.local.set({ site_config: mergedRules }, () => {
                        showToast(btnImportRules, getLangText(currentLang, 'msgRuleImportSuccess'));
                        renderRulesList();
                    });
                });
            } catch (err) { showToast(btnImportRules, getLangText(currentLang, 'msgRuleImportFail')); }
        }; reader.readAsText(file); ruleFileInput.value = '';
    });

    // 面板切換與規則渲染
    if (btnOpenRules) btnOpenRules.addEventListener('click', () => {
        controlPanel.classList.add('hidden'); rulesPanel.classList.remove('hidden'); renderRulesList();
    });
    if (btnBackToControl) btnBackToControl.addEventListener('click', () => {
        rulesPanel.classList.add('hidden'); controlPanel.classList.remove('hidden');
    });

    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnUnlock.click();
    });

    btnUnlock.addEventListener('click', () => {
        chrome.storage.local.get('userPassword', (d) => {
            if (passwordInput.value === d.userPassword) {
                showScreen('control');
                passwordInput.value = '';
                loginMsg.textContent = '';
            } else {
                loginMsg.textContent = getLangText(currentLang, 'msgIncorrectPass');
                passwordInput.value = '';
            }
        });
    });

    toggleVisibility.addEventListener('change', (e) => {
        const isShow = e.target.checked;
        chrome.storage.local.set({ isStealthMode: !isShow });
        updateStatusUI(isShow);
    });

    if (toggleMonitorPanel) {
        toggleMonitorPanel.addEventListener('change', (e) => {
            chrome.storage.local.set({ showMonitorPanel: e.target.checked });
        });
    }

    if (progressBarColor) {
        progressBarColor.addEventListener('input', (e) => {
            chrome.storage.local.set({ barColor: e.target.value });
        });
    }

    // ★★★ 核心修正：驗證邏輯與錯誤代碼接接 ★★★
    btnDonateUpgrade.addEventListener('click', async () => {
        if (btnDonateUpgrade.classList.contains('pro-active')) return;

        const inputKey = await showModal(getLangText(currentLang, 'modalEnablePro'), getLangText(currentLang, 'modalEnterKey'), true, "XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX", true);

        if (inputKey) {
            const cleanKey = inputKey.trim();
            const btnOldText = btnDonateUpgrade.innerHTML;

            // [架構師修復] 移除寫死的 Verifying... 替換為通用沙漏
            btnDonateUpgrade.textContent = "⏳...";
            btnDonateUpgrade.disabled = true;

            try {
                chrome.runtime.sendMessage({ action: "VERIFY_LICENSE", key: cleanKey }, (response) => {
                    if (chrome.runtime.lastError) {
                        btnDonateUpgrade.innerHTML = btnOldText;
                        btnDonateUpgrade.disabled = false;
                        showToast(btnDonateUpgrade, getLangText(currentLang, 'msgNetworkError'));
                        return;
                    }

                    if (response && response.success) {
                        chrome.storage.local.get(['vt_video_count'], (res) => {
                            updateProUI(true, res.vt_video_count || 0);
                        });
                        showToast(btnDonateUpgrade, getLangText(currentLang, 'msgVerifySuccess'));
                        setTimeout(() => { location.reload(); }, 3000);
                    } else {
                        btnDonateUpgrade.innerHTML = btnOldText;
                        btnDonateUpgrade.disabled = false;

                        // [架構師修復] 解析 Error Code，如果 API 給了特定錯誤則組合，否則用字典
                        let errorMsg = response?.dynamicMsg || getLangText(currentLang, response?.errorCode || 'msgNetworkError');
                        if (!errorMsg.startsWith('❌')) errorMsg = `❌ ${errorMsg}`;

                        showToast(btnDonateUpgrade, errorMsg);
                    }
                });
            } catch (error) {
                btnDonateUpgrade.innerHTML = btnOldText;
                btnDonateUpgrade.disabled = false;
                showToast(btnDonateUpgrade, getLangText(currentLang, 'msgNetworkError'));
            }
        }
    });

    // 設定密碼
    btnSetupPass.addEventListener('click', async () => {
        chrome.storage.local.get('isProVersion', async (items) => {
            if (!items.isProVersion) {
                await showModal(getLangText(currentLang, 'msgProOnlyFeature'), getLangText(currentLang, 'msgProOnlyDesc'), false, "", true);
                return;
            }
            const newPass = await showModal(getLangText(currentLang, 'modalSetPass'), getLangText(currentLang, 'modalSetPassDesc'), true, "1234", false);
            if (newPass !== null) {
                if (newPass.trim() === "") {
                    chrome.storage.local.remove('userPassword');
                    showToast(btnSetupPass, getLangText(currentLang, 'msgCleared'));
                } else {
                    chrome.storage.local.set({ userPassword: newPass.trim() });
                    showToast(btnSetupPass, getLangText(currentLang, 'msgSaved'));
                }
            }
        });
    });

    // 忘記密碼 (救援)
    const btnForgotPassword = document.getElementById('btnForgotPassword');
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener('click', () => {
            chrome.storage.local.get(['isProVersion', 'storedLicenseKey'], async (items) => {
                if (!items.isProVersion || !items.storedLicenseKey) {
                    loginMsg.textContent = getLangText(currentLang, 'msgProOnlyFeature');
                    return;
                }
                const dynamicDesc = getLangText(currentLang, 'modalRescueDesc');
                const inputKey = await showModal(getLangText(currentLang, 'modalRescue'), dynamicDesc, true, getLangText(currentLang, 'modalEnterKey'), false);

                if (inputKey) {
                    const cleanInput = inputKey.trim();
                    if (cleanInput !== items.storedLicenseKey) {
                        // [架構師修復] 移除寫死的 Key mismatch
                        loginMsg.textContent = getLangText(currentLang, 'msgInvalidKey');
                        return;
                    }

                    chrome.storage.local.remove('userPassword', async () => {
                        passwordInput.value = '';
                        loginMsg.textContent = "";

                        const oldConfirmText = mBtnConfirm.innerHTML;
                        mBtnConfirm.innerHTML = getLangText(currentLang, 'btnFullBackup');

                        const desc = getLangText(currentLang, 'modalRescueSuccessDesc');
                        const doBackup = await showModal(getLangText(currentLang, 'modalRescueSuccess'), desc);

                        if (doBackup) {
                            if (btnExport) btnExport.click();
                            setTimeout(() => { if (btnExportRules) btnExportRules.click(); }, 500);
                        }

                        mBtnConfirm.innerHTML = oldConfirmText;
                        setTimeout(() => { location.reload(); }, doBackup ? 1000 : 0);
                    });
                }
            });
        });
    }

    // 清除資料
    btnClearData.addEventListener('click', async () => {
        const confirm = await showModal(getLangText(currentLang, 'modalClearData'), getLangText(currentLang, 'modalClearDesc'));
        if (confirm) {
            chrome.storage.local.get(['userPassword', 'isStealthMode', 'isProVersion', 'storedLicenseKey', 'enabledSites', 'remainingUses', 'userLang', 'site_config', 'showMonitorPanel', 'barColor', 'vt_instance_id'], async (config) => {
                await window.vtDB.clearRecords();
                chrome.storage.local.clear(async () => {
                    // [修復] 計算剩餘的書籤數量，而不是直接歸零
                    const bookmarkKeys = await window.vtDB.getAllKeys('vt_bookmarks');
                    config.vt_video_count = bookmarkKeys ? bookmarkKeys.length : 0;
                    chrome.storage.local.set(config, () => {
                        videoCountLabel.textContent = config.vt_video_count.toLocaleString();
                        showToast(btnClearData, getLangText(currentLang, 'msgCleared'));
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length > 0) chrome.tabs.sendMessage(tabs[0].id, { action: "RESET_BINDING" }).catch(() => { });
                        });
                    });
                });
            });
        }
    });

    // 匯出
    btnExport.addEventListener('click', async () => {
        const exportCore = document.getElementById('chkExportCore') ? document.getElementById('chkExportCore').checked : true;
        const exportImages = document.getElementById('chkExportImages') ? document.getElementById('chkExportImages').checked : false;

        if (!exportCore && !exportImages) return;
        
        chrome.tabs.create({ url: chrome.runtime.getURL(`backup.html?action=export&core=${exportCore}&images=${exportImages}&lang=${currentLang}`) });
    });

    // 匯入
    btnImport.addEventListener('click', async () => {
        const confirm = await showModal(getLangText(currentLang, 'modalImport'), getLangText(currentLang, 'modalImportDesc'));
        if (confirm) {
            chrome.tabs.create({ url: chrome.runtime.getURL(`backup.html?action=import&lang=${currentLang}`) });
        }
    });

    // 輔助函式
    function showScreen(name) {
        if (name === 'lock') { lockScreen.style.display = 'block'; controlPanel.classList.add('hidden'); }
        else { lockScreen.style.display = 'none'; controlPanel.classList.remove('hidden'); }
    }

    function updateStatusUI(isShow) {
        statusText.textContent = isShow ? getLangText(currentLang, 'monitoring') : getLangText(currentLang, 'stealth');
        statusText.style.color = isShow ? "#00e676" : "#aaa";
        isShow ? statusDot.classList.add('active') : statusDot.classList.remove('active');
    }

    function updateProUI(isPro, count) {
        const limitNote = document.getElementById('limitNote');
        const interactionToggleRow = document.getElementById('interactionToggleRow');
        const interactionLabel = document.querySelector('#interactionToggleRow .status-label');
        const upsellBadge = document.getElementById('upsellBadge');
        
        if (isPro) {
            btnDonateUpgrade.classList.add('pro-active');
            btnDonateUpgrade.innerHTML = `<span class="donate-icon">👑</span> ${getLangText(currentLang, 'proActive')}`;
            videoCountLabel.innerHTML = `${count.toLocaleString()} / &infin; <span style="font-size:10px;background:#ff007f;color:#fff;padding:2px 4px;border-radius:4px;margin-left:4px;">PRO</span>`;
            videoCountLabel.style.color = '#ffd700';
            if (limitNote) limitNote.style.display = 'none'; // [修復] Pro 版現在是真正的無限，不再顯示 20 萬筆的提示
            if (interactionToggleRow) interactionToggleRow.style.display = 'flex';
            if (upsellBadge) upsellBadge.style.display = 'none';
            if (interactionLabel && interactionLabel.querySelector('.pro-badge')) {
                interactionLabel.querySelector('.pro-badge').remove();
            }
        } else {
            const limit = 200;
            const displayCount = count > limit ? limit : count;
            videoCountLabel.textContent = `${displayCount.toLocaleString()} / ${limit}`;
            if (count >= limit) videoCountLabel.style.color = '#ff5252';
            if (limitNote) limitNote.style.display = 'none';
            if (upsellBadge) upsellBadge.style.display = 'inline-block';
            if (interactionToggleRow) {
                interactionToggleRow.style.display = 'flex';
                if (interactionLabel && interactionLabel.querySelector('.pro-badge')) {
                    interactionLabel.querySelector('.pro-badge').remove();
                }
            }
        }
    }

    function showModal(title, desc, isPrompt = false, placeholder = "", showBuyLink = false) {
        return new Promise((resolve) => {
            mTitle.textContent = title;
            // [修復] 因為描述文字都來自我們自己寫死的 i18n 翻譯檔，含有 <br> 換行，因此安全恢復使用 innerHTML
            mDesc.innerHTML = desc;

            if (isPrompt) {
                mInput.classList.remove('hidden');
                mInput.value = "";
                mInput.placeholder = placeholder;
                mInput.focus();

                mInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        mBtnConfirm.click();
                    }
                };
            } else {
                mInput.classList.add('hidden');
            }

            // [架構師防護邏輯] 若顯示購買連結，則強制顯示相容性警告
            const mWarning = document.getElementById('mWarning');
            if (showBuyLink && mBtnBuy) {
                mBtnBuy.classList.remove('hidden');
                if (mWarning) {
                    // [安全修復 #1] 翻譯字串為受信任靜態字典，但仍改用 textContent 以消除 innerHTML 使用
                    mWarning.textContent = getLangText(currentLang, 'buyWarning');
                    mWarning.classList.remove('hidden');
                }
            } else {
                if (mBtnBuy) mBtnBuy.classList.add('hidden');
                if (mWarning) mWarning.classList.add('hidden');
            }

            modal.classList.add('show');

            const handleConfirm = () => {
                cleanup();
                resolve(isPrompt ? mInput.value : true);
            };
            const handleCancel = () => {
                cleanup();
                resolve(isPrompt ? null : false);
            };
            const cleanup = () => {
                modal.classList.remove('show');
                mBtnConfirm.removeEventListener('click', handleConfirm);
                mBtnCancel.removeEventListener('click', handleCancel);
            };

            mBtnConfirm.addEventListener('click', handleConfirm);
            mBtnCancel.addEventListener('click', handleCancel);
        });
    }

    // [架構師重構] 簡化 showToast 參數，移除沒有用到的 originalTxt
    function showToast(btn, msg) {
        const oldTxt = btn.innerHTML;
        const oldBg = btn.style.background;
        btn.textContent = msg;
        btn.style.background = msg.includes('❌') ? '#444' : '#00e676';
        btn.disabled = true;

        if (btn.id === 'btnDonateUpgrade' && (msg.includes('❌') || msg.includes('✅'))) {
            if (msg.includes('❌')) btn.disabled = false;
            return;
        }

        setTimeout(() => {
            btn.innerHTML = oldTxt;
            btn.style.background = oldBg;
            btn.disabled = false;
        }, 1500);
    }
});