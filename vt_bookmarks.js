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
    async function _checkPro() {
        const data = await new Promise(r => chrome.storage.local.get(['isProVersion'], r));
        if (!data.isProVersion) {
            _showUpgradeToast();
            return false;
        }
        return true;
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
        xBtn.onmouseenter = () => xBtn.style.color = '#ccc';
        xBtn.onmouseleave = () => xBtn.style.color = '#666';
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
        addBtn.onmouseenter = () => addBtn.style.background = 'rgba(233,30,140,0.15)';
        addBtn.onmouseleave = () => addBtn.style.background = 'rgba(233,30,140,0.08)';
        addBtn.onclick = async () => {
            const name = prompt('新資料夾名稱：');
            if (!name?.trim()) return;
            await _createFolder(name, null);
            _renderFolderTree(tree, videoId, overlay);
        };
        addRow.appendChild(addBtn);

        modal.append(hdr, tree, addRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        _renderFolderTree(tree, videoId, overlay);
    }

    async function _renderFolderTree(container, videoId, overlay) {
        container.innerHTML = '';
        const folders = await _getFolders();

        // 未分類
        container.appendChild(_makeFolderItem('📥 未分類（根目錄）', null, videoId, overlay, folders, -1));

        // 遞迴渲染
        const renderLevel = (parentId, depth) => {
            const kids = folders.filter(f => f.parentId === parentId).sort((a, b) => a.order - b.order);
            kids.forEach(f => {
                container.appendChild(_makeFolderItem('📁 ' + f.name, f.id, videoId, overlay, folders, depth));
                renderLevel(f.id, depth + 1);
            });
        };
        renderLevel(null, 0);

        if (folders.length === 0) {
            const tip = document.createElement('div');
            tip.style.cssText = 'color:#555;text-align:center;padding:24px 12px;font-family:sans-serif;font-size:13px;';
            tip.textContent = '還沒有資料夾，點下方按鈕新增第一個！';
            container.appendChild(tip);
        }
    }

    function _makeFolderItem(label, folderId, videoId, overlay, allFolders, depth) {
        const item = document.createElement('div');
        item.style.cssText = `
            display:flex;align-items:center;justify-content:space-between;
            padding:9px 12px 9px ${14 + Math.max(0, depth) * 18}px;
            border-radius:8px;cursor:pointer;margin-bottom:2px;
            transition:background 0.13s;
        `;

        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = 'color:#ddd;font-family:sans-serif;font-size:14px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

        const actBar = document.createElement('div');
        actBar.style.cssText = 'display:flex;gap:4px;opacity:0;transition:opacity 0.13s;';

        // 新增子資料夾按鈕 (只對非根目錄顯示)
        if (folderId !== null) {
            const subBtn = document.createElement('button');
            subBtn.title = '新增子資料夾';
            subBtn.textContent = '+';
            subBtn.style.cssText = `
                background:rgba(233,30,140,0.15);border:none;color:#e91e8c;
                border-radius:5px;width:22px;height:22px;cursor:pointer;
                font-size:15px;line-height:1;padding:0;flex-shrink:0;
            `;
            subBtn.onclick = async (e) => {
                e.stopPropagation();
                const name = prompt('子資料夾名稱：');
                if (!name?.trim()) return;
                await _createFolder(name, folderId);
                _renderFolderTree(item.parentElement, videoId, overlay);
            };
            actBar.appendChild(subBtn);
        }

        item.onmouseenter = () => { item.style.background = 'rgba(233,30,140,0.12)'; actBar.style.opacity = '1'; };
        item.onmouseleave = () => { item.style.background = ''; actBar.style.opacity = '0'; };

        item.onclick = async () => {
            const url = location.href;
            const title = document.title;
            const ogImg = document.querySelector('meta[property="og:image"]')?.content || '';
            await _addBookmark(videoId, url, title, ogImg, folderId);
            _panelBookmarked = true;
            _renderPanelState();
            // 成功動畫
            item.style.background = 'rgba(233,30,140,0.35)';
            lbl.textContent = '✅ 已收藏！';
            setTimeout(() => overlay.remove(), 650);
        };

        item.append(lbl, actBar);
        return item;
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
