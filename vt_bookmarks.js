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

    // ─── 載入快取 ────────────────────────────────────────────────────────
    async function _loadCache() {
        return new Promise(resolve => {
            chrome.storage.local.get(['vt_ratings', 'vt_bookmarks'], data => {
                window._vtRatingsCache = data.vt_ratings || {};
                const bm = data.vt_bookmarks || [];
                window._vtBookmarkedSet = new Set(bm.map(b => b.videoId).filter(Boolean));
                resolve();
            });
        });
    }

    // ─── 評分操作 ────────────────────────────────────────────────────────
    async function _setRating(videoId, rating) {
        if (!window._vtRatingsCache) await _loadCache();
        const current = window._vtRatingsCache[videoId];
        // Toggle: 點相同評分取消
        const next = (current === rating) ? null : rating;
        if (next === null) {
            delete window._vtRatingsCache[videoId];
        } else {
            window._vtRatingsCache[videoId] = next;
        }
        await new Promise(r => chrome.storage.local.set({ vt_ratings: window._vtRatingsCache }, r));
        return next;
    }

    // ─── 書籤操作 ────────────────────────────────────────────────────────
    async function _addBookmark(videoId, url, title, thumbnail, folderId) {
        const data = await new Promise(r => chrome.storage.local.get(['vt_bookmarks'], r));
        const bookmarks = data.vt_bookmarks || [];
        const existing = bookmarks.find(b => b.videoId === videoId);
        if (existing) {
            existing.folderId = folderId;
            existing.addedAt = Date.now();
            existing.title = title || existing.title;
        } else {
            bookmarks.push({
                id: 'bm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                videoId,
                url,
                title: title || document.title,
                thumbnail: thumbnail || '',
                folderId: folderId || null,
                domain: location.hostname,
                addedAt: Date.now()
            });
        }
        await new Promise(r => chrome.storage.local.set({ vt_bookmarks: bookmarks }, r));
        if (window._vtBookmarkedSet) window._vtBookmarkedSet.add(videoId);
    }

    async function _removeBookmark(videoId) {
        const data = await new Promise(r => chrome.storage.local.get(['vt_bookmarks'], r));
        const filtered = (data.vt_bookmarks || []).filter(b => b.videoId !== videoId);
        await new Promise(r => chrome.storage.local.set({ vt_bookmarks: filtered }, r));
        if (window._vtBookmarkedSet) window._vtBookmarkedSet.delete(videoId);
    }

    async function _isBookmarked(videoId) {
        if (!window._vtBookmarkedSet) await _loadCache();
        return window._vtBookmarkedSet.has(videoId);
    }

    // ─── 資料夾操作 ──────────────────────────────────────────────────────
    async function _getFolders() {
        const data = await new Promise(r => chrome.storage.local.get(['vt_bm_folders'], r));
        return data.vt_bm_folders || [];
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
        folders.push(newF);
        await new Promise(r => chrome.storage.local.set({ vt_bm_folders: folders }, r));
        return newF;
    }

    // ─── Pro 驗證 ────────────────────────────────────────────────────────
    // [TODO] 測試階段暫時開放，功能穩定後改回序號驗證（參考密碼鎖邏輯）
    async function _checkPro() {
        return true;
        // ↓ 上線後啟用以下邏輯：
        // const data = await new Promise(r => chrome.storage.local.get(['isProVersion'], r));
        // if (!data.isProVersion) { _showUpgradeToast(); return false; }
        // return true;
    }

    function _showUpgradeToast() {
        if (document.getElementById('vt-upgrade-toast')) return;
        const t = document.createElement('div');
        t.id = 'vt-upgrade-toast';
        t.style.cssText = `
            position:fixed;bottom:145px;right:15px;
            background:linear-gradient(135deg,#e91e8c,#9c27b0);
            color:#fff;padding:10px 16px;border-radius:10px;
            font-family:sans-serif;font-size:13px;font-weight:bold;
            z-index:2147483647;box-shadow:0 4px 20px rgba(233,30,140,0.5);
            cursor:pointer;line-height:1.5;animation:vtFadeIn 0.2s ease;
        `;
        t.innerHTML = '🔒 此功能需要 Pro 序號<br><small style="font-weight:normal;opacity:0.85">點擊前往購買</small>';
        t.onclick = () => chrome.runtime.sendMessage({ action: 'VT_OPEN_BUY_PAGE' });
        document.body.appendChild(t);
        setTimeout(() => t.style.opacity = '0', 2500);
        setTimeout(() => t.remove(), 2800);
    }

    // ─── 浮動操作面板 ────────────────────────────────────────────────────
    let _panel = null;
    let _currentId = null;
    let _panelRating = null;
    let _panelBookmarked = false;

    const PANEL_BTNS = [
        { key: 'like',     emoji: '👍', title: '喜歡', id: 'vt-bmb-like'     },
        { key: 'dislike',  emoji: '😤', title: '不喜歡', id: 'vt-bmb-dislike' },
        { key: 'bookmark', emoji: '❤️', title: '收藏', id: 'vt-bmb-bm'       },
        { key: 'open',     emoji: '📚', title: '書籤管理', id: 'vt-bmb-open'  },
    ];

    function _createPanel() {
        if (_panel) return;
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

        PANEL_BTNS.forEach(({ emoji, title, id, key }) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.title = title;
            btn.textContent = emoji;
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
        const htitle = document.createElement('span');
        htitle.textContent = '📁 選擇收藏位置';
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
        addBtn.textContent = '＋ 新增根目錄資料夾';
        addBtn.style.cssText = `
            background:rgba(233,30,140,0.08);border:1px dashed rgba(233,30,140,0.4);
            color:#e91e8c;border-radius:8px;padding:7px 14px;cursor:pointer;
            width:100%;font-family:sans-serif;font-size:13px;transition:all 0.15s;
        `;
        addBtn.onclick = async () => {
            const name = prompt('新資料夾名稱：');
            if (!name?.trim()) return;
            await _createFolder(name, null);
            _renderTree();
        };
        addRow.appendChild(addBtn);

        // Confirm bar
        const confirmRow = document.createElement('div');
        confirmRow.style.cssText = 'padding:12px 16px;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:flex-end;gap:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.15);color:#ccc;border-radius:8px;padding:7px 14px;cursor:pointer;font-family:sans-serif;font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '確認收藏';
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
            
            await _addBookmark(videoId, url, title, ogImg, selectedFolderId);
            _panelBookmarked = true;
            _renderPanelState();
            
            confirmBtn.textContent = '✅ 已收藏';
            confirmBtn.style.background = '#10b981';
            setTimeout(() => overlay.remove(), 650);
        };
        confirmRow.append(cancelBtn, confirmBtn);

        modal.append(hdr, tree, addRow, confirmRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        async function _renderTree() {
            tree.innerHTML = '';
            const folders = await _getFolders();

            const renderItem = (label, id, depth, hasKids) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display:flex;align-items:center;padding:7px 12px 7px ${12 + depth * 20}px;
                    border-radius:8px;margin-bottom:2px;cursor:pointer;user-select:none;
                    transition:background 0.15s;
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

            renderItem('📥 未分類（根目錄）', null, 0, false);

            const renderLevel = (parentId, depth) => {
                const kids = folders.filter(f => f.parentId === parentId).sort((a, b) => a.order - b.order);
                kids.forEach(f => {
                    const hasKids = folders.some(sub => sub.parentId === f.id);
                    renderItem('📁 ' + f.name, f.id, depth, hasKids);
                    if (hasKids && _expandedFolders.has(f.id)) {
                        renderLevel(f.id, depth + 1);
                    }
                });
            };
            renderLevel(null, 1);
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
    });

    // ─── 公開 API（供 vt_tracker.js 呼叫）────────────────────────────────
    window.vtBookmarkPanel = {
        async setVideo(videoId) {
            if (!videoId) {
                if (_panel) _panel.style.display = 'none';
                _currentId = null;
                return;
            }
            if (_currentId === videoId) return; // 沒變化，不重繪
            _currentId = videoId;

            if (!window._vtRatingsCache) await _loadCache();
            _panelRating = window._vtRatingsCache[videoId] || null;
            _panelBookmarked = window._vtBookmarkedSet?.has(videoId) || false;

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
