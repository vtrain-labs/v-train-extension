// vt_bookmarks.js - VT Bookmark Vault
// 付費功能：評分（👍😤）+ 收藏（❤️）+ 浮動操作面板 + 資料夾選擇器
// 依賴注入順序：必須在 vt_tracker.js 之後、content.js 之前注入
// 儲存方案：chrome.storage.local (不需要 IndexedDB 或後端)
//   - vt_ratings: { [videoId]: 'like' | 'dislike' }
//   - vt_bookmarks: [{ id, videoId, url, title, thumbnail, folderId, domain, addedAt }]
//   - vt_bm_folders: [{ id, name, parentId, order, createdAt }]

if (!window._vtBookmarksLoaded) {
    window._vtBookmarksLoaded = true;

    // ─── 全域快取 ────────────────────────────────────────────────────────
    window._vtRatingsCache = null;   // { [videoId]: 'like' | 'dislike' }
    window._vtBookmarkedSet = null;  // Set<videoId>
    const vtSyncChannel = new BroadcastChannel('vt_sync_channel');
    function notifySync() {
        vtSyncChannel.postMessage({ action: 'sync_bookmarks' });
        try { chrome.runtime.sendMessage({ action: 'VT_SYNC_BOOKMARKS' }).catch(()=>{}); } catch (e) {}
    }
    vtSyncChannel.onmessage = (e) => {
        if (e.data.action === 'sync_bookmarks') {
            _loadCache().then(() => {
                if (window._vtRefreshAllBadges) window._vtRefreshAllBadges();
            });
        }
    };

    // ─── 資料庫代理 (DB Proxy) ──────────────────────────────────────────────────
    // 所有 DB 操作必須透過 Background Script 進行，確保寫入擴充功能的來源 (Origin)，而非當前網站 (Host) 的來源
    const vtDBProxy = {
        get: (storeName, key) => new Promise(r => chrome.runtime.sendMessage({ action: 'VT_DB_GET', storeName, key }, r)),
        getAll: (storeName) => new Promise(r => chrome.runtime.sendMessage({ action: 'VT_DB_GET_ALL', storeName }, r)),
        put: (storeName, obj) => new Promise(r => chrome.runtime.sendMessage({ action: 'VT_DB_PUT', storeName, obj }, r)),
        delete: (storeName, key) => new Promise(r => chrome.runtime.sendMessage({ action: 'VT_DB_DELETE', storeName, key }, r))
    };



    // ─── 載入快取 ────────────────────────────────────────────────────────
    async function _loadCache() {
        return new Promise(async (resolve) => {
            const ratings = await vtDBProxy.getAll('vt_ratings');
            window._vtRatingsCache = {};
            ratings.forEach(r => window._vtRatingsCache[r.videoId] = r.rating);

            const bm = await vtDBProxy.getAll('vt_bookmarks');
            window._vtBookmarkedSet = new Set(bm.map(b => b.videoId).filter(Boolean));

            chrome.storage.local.get(['vt_panel_pos', 'showInteraction', 'isProVersion', 'userLang'], data => {
                window._vtPanelPos = data.vt_panel_pos || null;
                window._vtShowInteraction = !!data.showInteraction;
                window._vtIsPro = !!data.isProVersion;
                window._vtCurrentLang = data.userLang || 'en';
                resolve();
            });
        });
    }

    // ─── 滑鼠移入移出觸發邏輯 ────────────────────────────────────────────
    let _hoverTimer = null;
    let _leaveTimer = null;

    function _handleVideoHover(e) {
        if (!window._vtShowInteraction || !window._vtIsPro) return;
        const target = e.target;
        const videoId = window._vtParseVideoId(target.closest('a')?.href || target.href);
        if (!videoId) return;

        clearTimeout(_leaveTimer);
        _hoverTimer = setTimeout(() => {
            const rect = target.getBoundingClientRect();
            _showPanel(videoId, rect);
        }, 150); // 稍微延遲避免快速滑過
    }

    // ─── 評分操作 ────────────────────────────────────────────────────────
    async function _setRating(videoId, rating) {
        if (!window._vtRatingsCache) await _loadCache();
        const current = window._vtRatingsCache[videoId];
        // Toggle: 點相同評分取消
        const next = (current === rating) ? null : rating;
        if (next === null) {
            delete window._vtRatingsCache[videoId];
            await vtDBProxy.delete('vt_ratings', videoId);
        } else {
            window._vtRatingsCache[videoId] = next;
            await vtDBProxy.put('vt_ratings', { videoId, rating, timestamp: Date.now() });
        }
        if (window._vtRefreshAllBadges) window._vtRefreshAllBadges();
        notifySync();
        return next;
    }

    // ─── 書籤操作 ────────────────────────────────────────────────────────
    async function _addBookmark(videoId, url, title, thumbnail, folderId) {
        let existing = await vtDBProxy.get('vt_bookmarks', videoId);
        if (existing) {
            existing.folderId = folderId;
            existing.addedAt = Date.now();
            existing.title = title || existing.title;
        } else {
            existing = {
                id: 'bm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                videoId,
                url,
                title: title || document.title,
                thumbnail: thumbnail || '',
                folderId: folderId || null,
                domain: location.hostname,
                addedAt: Date.now()
            };
        }
        await vtDBProxy.put('vt_bookmarks', existing);
        if (window._vtBookmarkedSet) window._vtBookmarkedSet.add(videoId);
        if (window._vtRefreshAllBadges) window._vtRefreshAllBadges();
        notifySync();
    }

    async function _removeBookmark(videoId) {
        await vtDBProxy.delete('vt_bookmarks', videoId);
        if (window._vtBookmarkedSet) window._vtBookmarkedSet.delete(videoId);
        if (window._vtRefreshAllBadges) window._vtRefreshAllBadges();
        notifySync();
    }

    async function _isBookmarked(videoId) {
        if (!window._vtBookmarkedSet) await _loadCache();
        return window._vtBookmarkedSet.has(videoId);
    }

    // ─── 資料夾操作 ──────────────────────────────────────────────────────
    async function _getFolders() {
        return await vtDBProxy.getAll('vt_bm_folders');
    }

    async function _createFolder(name, parentId = null) {
        const folders = await _getFolders();
        const newF = {
            id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: name.trim(),
            parentId: parentId || null,
            order: folders.length,
            createdAt: Date.now()
        };
        await vtDBProxy.put('vt_bm_folders', newF);
        notifySync();
        return newF;
    }

    // ─── Pro 驗證 ────────────────────────────────────────────────────────
    async function _checkPro() {
        if (!window._vtIsPro) {
            return false;
        }
        return true;
    }

    // ─── 滑鼠移入移出觸發邏輯 ────────────────────────────────────────────
    let _panel = null;
    let _currentId = null;
    let _panelRating = null;
    let _panelBookmarked = false;

    const SVG_LIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;vertical-align:-0.2em;display:inline-block;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
    const SVG_DISLIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;vertical-align:-0.2em;display:inline-block;"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>`;

    const _g = (k, d) => window.getI18nStr ? window.getI18nStr(k, d) : d;
    const PANEL_BTNS = [
        { key: 'like',     html: SVG_LIKE, emoji: '👍', title: _g('btnLike', '喜歡'), id: 'vt-bmb-like'     },
        { key: 'dislike',  html: SVG_DISLIKE, emoji: '😤', title: _g('btnDislike', '不喜歡'), id: 'vt-bmb-dislike' },
        { key: 'bookmark', emoji: '❤️', title: _g('btnBookmark', '收藏'), id: 'vt-bmb-bm'       },
        { key: 'open',     emoji: '📚', title: _g('btnManage', '書籤管理'), id: 'vt-bmb-open'  },
    ];

    function _createPanel() {
        if (_panel) {
            if (!_panel.isConnected) {
                (document.body || document.documentElement).appendChild(_panel);
            }
            return;
        }
        const p = document.createElement('div');
        p.id = 'vt-bookmark-panel';
        p.style.cssText = `
            position:fixed;bottom:82px;right:15px;display:none;
            align-items:center;gap:2px;padding:5px 8px;
            background:rgba(12,12,20,0.93);
            border-left:4px solid #e91e8c;border-radius:12px;
            z-index:2147483646;box-shadow:0 4px 20px rgba(0,0,0,0.7);
            backdrop-filter:blur(6px);
        `;

        const dragHandle = document.createElement('div');
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.title = window.getI18nStr ? window.getI18nStr('dragHint', '拖曳移動 (點兩下恢復原位)') : '拖曳移動 (點兩下恢復原位)';
        dragHandle.style.cssText = `
            cursor:grab;color:rgba(255,255,255,0.4);font-size:14px;
            padding:0 6px;user-select:none;display:flex;align-items:center;
            transition:color 0.2s;height:100%;
        `;
        dragHandle.onmouseenter = () => dragHandle.style.color = 'rgba(255,255,255,0.8)';
        dragHandle.onmouseleave = () => dragHandle.style.color = 'rgba(255,255,255,0.4)';
        p.appendChild(dragHandle);

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        dragHandle.onmousedown = (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            dragHandle.style.cursor = 'grabbing';
            window._vtPanelDragged = true;
            
            const rect = p.getBoundingClientRect();
            p.style.left = rect.left + 'px';
            p.style.top = rect.top + 'px';
            p.style.right = 'auto';
            p.style.bottom = 'auto';

            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        function onMouseMove(e) {
            if (!isDragging) return;
            let newLeft = initialLeft + (e.clientX - startX);
            let newTop = initialTop + (e.clientY - startY);
            
            const maxLeft = window.innerWidth - p.offsetWidth;
            const maxTop = window.innerHeight - p.offsetHeight;
            
            if (newLeft < 0) newLeft = 0;
            if (newLeft > maxLeft) newLeft = maxLeft;
            if (newTop < 0) newTop = 0;
            if (newTop > maxTop) newTop = maxTop;
            
            p.style.left = newLeft + 'px';
            p.style.top = newTop + 'px';
        }

        function onMouseUp() {
            isDragging = false;
            dragHandle.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            chrome.storage.local.set({ vt_panel_pos: { left: p.style.left, top: p.style.top } });
        }
        
        dragHandle.ondblclick = () => {
            window._vtPanelDragged = false;
            chrome.storage.local.remove('vt_panel_pos');
        };

        PANEL_BTNS.forEach(({ html, emoji, title, id, key }) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.title = title;
            if (html) btn.innerHTML = html; else btn.textContent = emoji;
            btn.dataset.key = key;
            btn.style.cssText = `
                background:none;border:none;font-size:18px;cursor:pointer;
                padding:5px 7px;border-radius:8px;
                transition:background 0.15s,transform 0.1s,opacity 0.15s;
                opacity:0.6;filter:grayscale(0.4);
            `;
            btn.onmouseenter = () => { if (!btn.dataset.active) btn.style.opacity = '0.9'; };
            btn.onmouseleave = () => { if (!btn.dataset.active) { btn.style.opacity = '0.6'; btn.style.transform = ''; } };
            btn.onmousedown = () => { btn.style.transform = 'scale(0.88)'; };
            btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
            p.appendChild(btn);
        });

        // 事件
        p.querySelector('#vt-bmb-like').onclick = async () => {
            if (!await _checkPro() || !_currentId) return;
            _panelRating = await _setRating(_currentId, 'like');
            _renderPanelState();
        };
        p.querySelector('#vt-bmb-dislike').onclick = async () => {
            if (!await _checkPro() || !_currentId) return;
            _panelRating = await _setRating(_currentId, 'dislike');
            _renderPanelState();
        };
        p.querySelector('#vt-bmb-bm').onclick = async () => {
            if (!await _checkPro() || !_currentId) return;
            if (_panelBookmarked) {
                await _removeBookmark(_currentId);
                _panelBookmarked = false;
                _renderPanelState();
            } else {
                _showFolderPicker(_currentId);
            }
        };
        p.querySelector('#vt-bmb-open').onclick = () => {
            chrome.runtime.sendMessage({ action: 'VT_OPEN_BOOKMARKS' });
        };

        (document.body || document.documentElement).appendChild(p);
        _panel = p;
        _startPanelSync();
    }

    let _panelSyncLoop = null;
    function _startPanelSync() {
        if (_panelSyncLoop) return;
        
        // 恢復之前的拖曳位置
        if (window._vtPanelPos) {
            window._vtPanelDragged = true;
            if (_panel) {
                _panel.style.left = window._vtPanelPos.left;
                _panel.style.top = window._vtPanelPos.top;
                _panel.style.right = 'auto';
                _panel.style.bottom = 'auto';
            }
        }

        const sync = () => {
            _panelSyncLoop = requestAnimationFrame(sync);
            if (!_panel || _panel.style.display === 'none' || !window.sysState?._activeEl) return;
            
            if (window._vtPanelDragged) return; // 使用者已手動拖曳，停止自動對齊
            
            const video = window.sysState._activeEl;
            const rect = video.getBoundingClientRect();
            
            // 如果處於全螢幕，退回螢幕右下角固定顯示 (因為全螢幕時外面看不到)
            if (document.fullscreenElement) {
                _panel.style.bottom = '82px';
                _panel.style.right = '15px';
                _panel.style.top = 'auto';
                _panel.style.left = 'auto';
            } else {
                // 一般模式下，懸掛在影片右下方 (外面)
                const rightOffset = window.innerWidth - rect.right;
                const topOffset = rect.bottom + 12; // 距離影片底部 12px
                
                _panel.style.top = topOffset + 'px';
                _panel.style.right = rightOffset + 'px';
                _panel.style.bottom = 'auto';
                _panel.style.left = 'auto';
            }
        };
        _panelSyncLoop = requestAnimationFrame(sync);
    }

    function _renderPanelState() {
        if (!_panel) return;
        const configs = {
            like:     { active: _panelRating === 'like',      bg: 'rgba(255,215,0,0.18)',  emoji: '👍' },
            dislike:  { active: _panelRating === 'dislike',   bg: 'rgba(255,80,80,0.18)',  emoji: '😤' },
            bookmark: { active: _panelBookmarked,             bg: 'rgba(233,30,140,0.18)', emoji: '❤️' },
        };
        for (const [key, cfg] of Object.entries(configs)) {
            const btn = _panel.querySelector(`[data-key="${key}"]`);
            if (!btn) continue;
            btn.dataset.active = cfg.active ? 'true' : '';
            btn.style.opacity = cfg.active ? '1' : '0.6';
            btn.style.filter = cfg.active ? 'none' : 'grayscale(0.4)';
            btn.style.background = cfg.active ? cfg.bg : 'none';
        }
    }

    // ─── 資料夾選擇器 Modal ──────────────────────────────────────────────
    let _expandedFolders = new Set();

    function _showFolderPicker(videoId) {
        document.getElementById('vt-folder-picker')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'vt-folder-picker';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.72);
            z-index:2147483647;display:flex;align-items:center;
            justify-content:center;backdrop-filter:blur(5px);
            animation:vtFadeIn 0.18s ease;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background:#13132a;border:1px solid rgba(233,30,140,0.35);
            border-radius:16px;width:360px;max-height:480px;
            display:flex;flex-direction:column;overflow:hidden;
            box-shadow:0 24px 64px rgba(0,0,0,0.85),0 0 0 1px rgba(233,30,140,0.1);
        `;

        let selectedFolderId = null;

        // Header
        const hdr = document.createElement('div');
        hdr.style.cssText = `
            padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.07);
            display:flex;justify-content:space-between;align-items:center;
        `;
        const lang = window._vtCurrentLang || 'zh-TW';
        const getLang = (k, def) => (typeof getLangText === 'function' ? getLangText(lang, k) : def);

        const htitle = document.createElement('span');
        htitle.textContent = '📁 ' + getLang('bvSelectFolder', '選擇收藏位置');
        htitle.style.cssText = 'color:#fff;font-size:15px;font-weight:700;font-family:sans-serif;';
        const xBtn = document.createElement('button');
        xBtn.textContent = '✕';
        xBtn.style.cssText = 'background:none;border:none;color:#666;cursor:pointer;font-size:17px;padding:0;line-height:1;transition:color 0.15s;';
        xBtn.onclick = () => overlay.remove();
        hdr.append(htitle, xBtn);

        // Tree
        const tree = document.createElement('div');
        tree.style.cssText = 'flex:1;overflow-y:auto;padding:8px;';

        // Add folder bar
        const addRow = document.createElement('div');
        addRow.style.cssText = 'padding:10px 16px;border-top:1px solid rgba(255,255,255,0.07);';
        const addBtn = document.createElement('button');
        addBtn.textContent = '＋ ' + getLang('bvAddRootFolder', '新增根目錄資料夾');
        addBtn.style.cssText = `
            background:rgba(233,30,140,0.08);border:1px dashed rgba(233,30,140,0.4);
            color:#e91e8c;border-radius:8px;padding:7px 14px;cursor:pointer;
            width:100%;font-family:sans-serif;font-size:13px;transition:all 0.15s;
        `;
        addBtn.onclick = async () => {
            const name = prompt(getLang('bvFolderNamePrompt', '新資料夾名稱：'));
            if (!name?.trim()) return;
            await _createFolder(name, null);
            _renderTree();
        };
        addRow.appendChild(addBtn);

        // Confirm bar
        const confirmRow = document.createElement('div');
        confirmRow.style.cssText = 'padding:12px 16px;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:flex-end;gap:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = getLang('btnCancel', '取消');
        cancelBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.15);color:#ccc;border-radius:8px;padding:7px 14px;cursor:pointer;font-family:sans-serif;font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = getLang('bvConfirmSave', '確認收藏');
        confirmBtn.style.cssText = 'background:linear-gradient(135deg,#e91e8c,#9c27b0);border:none;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-family:sans-serif;font-size:13px;font-weight:bold;';
        confirmBtn.onclick = async () => {
            const url = location.href;
            const title = document.title;
            let ogImg = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[property="og:image:secure_url"]')?.content ||
                        document.querySelector('meta[name="twitter:image"]')?.content || '';
            if (!ogImg) {
                const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.width > 200 && img.height > 100);
                if (imgs.length > 0) ogImg = imgs[0].src;
            }

            // [無痛快取機制] 擷取圖片轉換為二進位存入快取資料庫
            if (ogImg && ogImg.startsWith('http')) {
                fetch(ogImg).then(r => r.blob()).then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        vtDBProxy.put('vt_thumbnails', { videoId, thumbnail: reader.result }).catch(()=>{});
                    };
                    reader.readAsDataURL(blob);
                }).catch(()=>{});
            }

            await _addBookmark(videoId, url, title, ogImg, selectedFolderId);
            
            // [動態 CDN 自學引擎] 當下立即配對並註冊規則
            if (ogImg && ogImg.startsWith('http') && url) {
                try {
                    const imgHost = new URL(ogImg).hostname;
                    const pageOrigin = new URL(url).origin + "/";
                    chrome.runtime.sendMessage({ action: 'VT_SYNC_CDNS', cdnMap: { [imgHost]: pageOrigin } }).catch(()=>{});
                } catch(e) {}
            }

            _panelBookmarked = true;
            _renderPanelState();
            
            confirmBtn.textContent = '✅ ' + getLang('bvSaved', '已收藏');
            confirmBtn.style.background = '#10b981';
            setTimeout(() => overlay.remove(), 650);
        };
        confirmRow.append(cancelBtn, confirmBtn);

        modal.append(hdr, tree, addRow, confirmRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        async function _renderTree() {
            const oldScroll = tree.scrollTop;
            const folders = await _getFolders();
            tree.innerHTML = '';

            const renderItem = (label, id, depth, hasKids) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display:flex;align-items:center;padding:7px 12px 7px ${12 + depth * 20}px;
                    border-radius:8px;margin-bottom:2px;cursor:pointer;user-select:none;
                    transition:background 0.15s; position:relative;
                    ${selectedFolderId === id ? 'background:rgba(233,30,140,0.15);' : ''}
                `;
                
                item.onmouseenter = () => { if (selectedFolderId !== id) item.style.background = 'rgba(255,255,255,0.06)'; };
                item.onmouseleave = () => { if (selectedFolderId !== id) item.style.background = 'none'; };

                const chevron = document.createElement('span');
                chevron.style.cssText = `
                    display:inline-block;width:16px;color:#888;font-size:12px;
                    transition:transform 0.2s;text-align:center;
                `;
                if (hasKids) {
                    chevron.textContent = '▶';
                    if (_expandedFolders.has(id)) chevron.style.transform = 'rotate(90deg)';
                }
                
                chevron.onclick = (e) => {
                    if (hasKids) {
                        e.stopPropagation();
                        if (_expandedFolders.has(id)) _expandedFolders.delete(id);
                        else _expandedFolders.add(id);
                        _renderTree();
                    }
                };

                const lbl = document.createElement('span');
                lbl.textContent = label;
                lbl.style.cssText = 'flex:1;color:#e4e4f0;font-size:14px;font-family:sans-serif;margin-left:6px;';

                const radio = document.createElement('div');
                radio.style.cssText = `
                    width:16px;height:16px;border-radius:50%;border:2px solid ${selectedFolderId === id ? '#e91e8c' : '#555'};
                    display:flex;align-items:center;justify-content:center;
                `;
                if (selectedFolderId === id) {
                    const dot = document.createElement('div');
                    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#e91e8c;';
                    radio.appendChild(dot);
                }

                item.onclick = () => {
                    selectedFolderId = id;
                    _renderTree();
                };

                item.append(chevron, lbl, radio);
                tree.appendChild(item);
            };

            renderItem('📥 ' + getLang('bvUncategorizedRoot', '未分類（根目錄）'), null, 0, false);

            const renderLevel = (parentId, depth) => {
                const kids = folders.filter(f => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                kids.forEach(f => {
                    const hasKids = folders.some(sub => sub.parentId === f.id);
                    renderItem('📁 ' + f.name, f.id, depth, hasKids);
                    if (hasKids && _expandedFolders.has(f.id)) {
                        renderLevel(f.id, depth + 1);
                    }
                });
            };
            renderLevel(null, 1);
            
            // 恢復滾動位置
            requestAnimationFrame(() => {
                tree.scrollTop = oldScroll;
            });
        }

        chrome.storage.local.get(['vt_bookmarks'], (data) => {
            const bm = (data.vt_bookmarks || []).find(b => b.videoId === videoId);
            if (bm) selectedFolderId = bm.folderId;
            else selectedFolderId = null;
            _renderTree();
        });
    }

    // ─── 監控 Storage 變化，同步快取 + 刷新角標 ─────────────────────────
    chrome.storage.onChanged.addListener((changes) => {
        if (!chrome.runtime?.id) return;
        if (changes.vt_ratings) {
            window._vtRatingsCache = changes.vt_ratings.newValue || {};
            window._vtRefreshAllBadges?.();
        }
        if (changes.vt_bookmarks) {
            const bm = changes.vt_bookmarks.newValue || [];
            window._vtBookmarkedSet = new Set(bm.map(b => b.videoId).filter(Boolean));
            window._vtRefreshAllBadges?.();
        }
        if (changes.showInteraction) {
            window._vtShowInteraction = !!changes.showInteraction.newValue;
            if (!window._vtShowInteraction && _panel) {
                _panel.style.display = 'none';
            }
        }
        if (changes.isProVersion) {
            window._vtIsPro = !!changes.isProVersion.newValue;
        }
        if (changes.userLang) {
            window._vtCurrentLang = changes.userLang.newValue;
        }
    });

    // ─── 公開 API（供 vt_tracker.js 呼叫）────────────────────────────────
    window.vtBookmarkPanel = {
        async setVideo(videoId) {
            if (!videoId || window._vtShowInteraction === false) {
                if (_panel) _panel.style.display = 'none';
                _currentId = null;
                return;
            }
            // [SPA 修復] 檢查面板是否被框架意外移除，如果移除則必須強制重繪
            const isDetached = _panel && !_panel.isConnected;
            
            if (_currentId === videoId && !isDetached) return; // 沒變化且還在 DOM 上，不重繪
            _currentId = videoId;

            if (!window._vtRatingsCache) await _loadCache();
            _panelRating = window._vtRatingsCache[videoId] || null;
            _panelBookmarked = window._vtBookmarkedSet?.has(videoId) || false;

            // [自癒機制 Self-Healing] 如果此影片已在書籤庫中，於背景靜默重新抓取縮圖並寫入快取庫。
            // 加入溫和的重試機制，最多 3 次，避免被當作 DDoS 攻擊，同時能繞過廣告延遲。
            if (_panelBookmarked) {
                const _heal = (attempt = 1) => {
                    if (attempt > 3) return; // 最多嘗試 3 次
                    setTimeout(() => {
                        let ogImg = document.querySelector('meta[property="og:image"]')?.content ||
                                    document.querySelector('meta[property="og:image:secure_url"]')?.content ||
                                    document.querySelector('meta[name="twitter:image"]')?.content || '';
                        if (!ogImg) {
                            const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.width > 200 && img.height > 100);
                            if (imgs.length > 0) ogImg = imgs[0].src;
                        }
                        if (ogImg && ogImg.startsWith('http')) {
                            fetch(ogImg).then(r => {
                                if (!r.ok) throw new Error('Fetch failed');
                                return r.blob();
                            }).then(blob => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    vtDBProxy.put('vt_thumbnails', { videoId, thumbnail: reader.result }).catch(()=>{});
                                };
                                reader.readAsDataURL(blob);
                            }).catch(()=>{
                                _heal(attempt + 1); // 如果抓取失敗 (例如廣告阻擋)，稍後再試
                            });
                        } else {
                            _heal(attempt + 1); // 如果 DOM 還沒生出圖片標籤，也稍後再試
                        }
                    }, attempt === 1 ? 300 : 3000 * (attempt - 1)); // 第一次 0.3 秒，第二次 3 秒，第三次 6 秒
                };
                _heal();
            }

            _createPanel();
            if (_panel) { _panel.style.display = 'flex'; _renderPanelState(); }
        },
        hide() {
            if (_panel) _panel.style.display = 'none';
            _currentId = null;
        },
        async loadCache() { await _loadCache(); }
    };

    // 啟動時預載入快取
    _loadCache();
}
