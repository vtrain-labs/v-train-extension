// bookmarks.js — VT Bookmark Vault 管理頁面邏輯
'use strict';

// ─── 狀態 ────────────────────────────────────────────────────────────────
let _allBookmarks = [];
let _allFolders   = [];
let _allRatings   = {};
let _activeFolderId = '__all__'; // '__all__' = 全部，null = 未分類
let _searchTerm   = '';
let _sortMode     = 'newest';
let _viewMode     = 'grid'; // 'grid' | 'list'
let _expandedFolders = new Set();
let _currentLang = 'en';

// Pagination
let _currentPage = 1;
let _itemsPerPage = 12;
let _resizeTimer = null;

function getLang(key, defaultText) {
    if (typeof getLangText === 'function') {
        const text = getLangText(_currentLang, key);
        // 如果回傳的字串跟 key 一樣，代表字典檔沒找到，改用 defaultText
        if (text && text !== key) return text;
    }
    return defaultText;
}

const vtSyncChannel = new BroadcastChannel('vt_sync_channel');
vtSyncChannel.onmessage = (e) => {
    if (e.data.action === 'sync_bookmarks') loadData();
};
function notifySync() { vtSyncChannel.postMessage({ action: 'sync_bookmarks' }); }

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'VT_SYNC_BOOKMARKS') {
        loadData();
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.userLang) {
        _currentLang = changes.userLang.newValue || 'en';
        applyLanguage(_currentLang);
        renderFolderTree(); // Re-render tree to translate "All" and "Uncategorized"
        renderBreadcrumb(); // Re-render breadcrumb
    }
});

// ─── 載入資料 ─────────────────────────────────────────────────────────────
async function loadData() {
    const data = await new Promise(r => chrome.storage.local.get(['userLang'], r));
    
    _allBookmarks = await window.vtDB.getAll('vt_bookmarks');
    
    // [動態 CDN 自學引擎] 掃描現有書籤，將 圖片CDN網域 對應到 來源網域，交給 Background 動態建立規則
    const cdnMap = {};
    _allBookmarks.forEach(bm => {
        if (bm.thumbnail && bm.thumbnail.startsWith('http') && bm.url) {
            try {
                const imgHost = new URL(bm.thumbnail).hostname;
                const pageOrigin = new URL(bm.url).origin + "/";
                cdnMap[imgHost] = pageOrigin;
            } catch (e) {}
        }
    });
    try { chrome.runtime.sendMessage({ action: 'VT_SYNC_CDNS', cdnMap }).catch(()=>{}); } catch(e){}

    _allFolders   = await window.vtDB.getAll('vt_bm_folders');
    
    const ratings = await window.vtDB.getAll('vt_ratings');
    _allRatings = {};
    ratings.forEach(r => _allRatings[r.videoId] = r.rating);
    
    // 套用多國語言
    _currentLang = data.userLang || 'en';
    applyLanguage(_currentLang);

    renderAll();
}

function applyLanguage(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (typeof getLangText === 'function') {
            const translated = getLangText(lang, key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translated;
            } else {
                el.innerHTML = translated;
            }
        }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (typeof getLangText === 'function') {
            el.title = getLangText(lang, key);
        }
    });
}

// ─── 渲染全部 UI ─────────────────────────────────────────────────────────
function renderAll() {
    renderSidebarStats();
    renderFolderTree();
    renderBookmarks();
}

// ─── 側邊欄統計 ──────────────────────────────────────────────────────────
function renderSidebarStats() {
    const total = _allBookmarks.length;
    const likes = Object.values(_allRatings).filter(v => v === 'like').length;
    const dislikes = Object.values(_allRatings).filter(v => v === 'dislike').length;
    document.getElementById('bvTotalCount').textContent = total;
    document.getElementById('bvLikeCount').textContent = likes;
    document.getElementById('bvDislikeCount').textContent = dislikes;
}

// ─── 資料夾樹 ─────────────────────────────────────────────────────────────
function renderFolderTree() {
    const tree = document.getElementById('bvFolderTree');
    tree.innerHTML = '';

    const allBookmarksStr = typeof getLangText === 'function' ? getLangText(_currentLang, 'bvAllBookmarks') : '全部收藏';
    const uncategorizedStr = typeof getLangText === 'function' ? getLangText(_currentLang, 'bvUncategorized') : '未分類';

    // 全部
    tree.appendChild(_makeFolderNode({
        id: '__all__', name: `📚 ${allBookmarksStr}`, icon: '',
        count: _allBookmarks.length, depth: 0, isSpecial: true
    }));
    // 未分類
    const uncat = _allBookmarks.filter(b => !b.folderId).length;
    tree.appendChild(_makeFolderNode({
        id: null, name: `📥 ${uncategorizedStr}`, icon: '',
        count: uncat, depth: 0, isSpecial: true
    }));

    // 遞迴渲染資料夾
    _renderFolderLevel(tree, null, 0);
}

function _renderFolderLevel(container, parentId, depth) {
    const kids = _allFolders
        .filter(f => f.parentId === parentId)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    kids.forEach(folder => {
        const hasKids = _allFolders.some(f => f.parentId === folder.id);
        const count = _countInFolder(folder.id);
        const node = _makeFolderNode({ id: folder.id, name: folder.name, count, depth, hasKids });
        container.appendChild(node);
        if (hasKids && _expandedFolders.has(folder.id)) {
            _renderFolderLevel(container, folder.id, depth + 1);
        }
    });
}

function _countInFolder(folderId) {
    // 只統計直接在此資料夾內的書籤數（不含子資料夾）
    return _allBookmarks.filter(b => b.folderId === folderId).length;
}

function _getAllSubfolderIds(parentId, collected = new Set()) {
    _allFolders.filter(f => f.parentId === parentId).forEach(f => {
        collected.add(f.id);
        _getAllSubfolderIds(f.id, collected);
    });
    return collected;
}

function _makeFolderNode({ id, name, count, depth, hasKids, isSpecial }) {
    const item = document.createElement('div');
    item.className = 'bv-folder-item' + (id === _activeFolderId || (id === null && _activeFolderId === null) ? ' active' : '');
    item.style.paddingLeft = `${12 + depth * 10}px`;
    item.style.position = 'relative';
    item.dataset.folderId = id === null ? '__null__' : (id || '__all__');

    // 展開/折疊箭頭
    if (hasKids) {
        const tog = document.createElement('button');
        tog.className = 'bv-folder-toggle' + (_expandedFolders.has(id) ? ' expanded' : '');
        tog.textContent = _expandedFolders.has(id) ? 'v' : '❯';
        tog.onclick = (e) => {
            e.stopPropagation();
            if (_expandedFolders.has(id)) {
                _expandedFolders.delete(id);
                tog.textContent = '❯';
            } else {
                _expandedFolders.add(id);
                tog.textContent = 'v';
            }
            renderFolderTree();
        };
        item.appendChild(tog);
    } else {
        const spacer = document.createElement('span');
        spacer.style.width = '20px';
        spacer.style.display = 'inline-block';
        spacer.style.flexShrink = '0';
        item.appendChild(spacer);
    }

    const lbl = document.createElement('span');
    lbl.className = 'bv-folder-item-label';
    lbl.textContent = (isSpecial ? '' : '📁 ') + name;
    lbl.title = name;
    item.appendChild(lbl);

    const cnt = document.createElement('span');
    cnt.className = 'bv-folder-count';
    cnt.textContent = count;
    item.appendChild(cnt);

    item.oncontextmenu = (e) => {
        if (isSpecial) return;
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.pageX, e.pageY, id, name);
    };

    item.onclick = () => {
        if (hasKids) {
            if (_expandedFolders.has(id)) _expandedFolders.delete(id);
            else _expandedFolders.add(id);
        }
        _activeFolderId = id === '__null__' ? null : (id === '__all__' ? '__all__' : id);
        renderFolderTree();
        renderBookmarks();
    };

    return item;
}

function showContextMenu(x, y, folderId, folderName) {
    const cm = document.getElementById('bvContextMenu');
    if (!cm) return;
    cm.classList.remove('hidden');
    
    const w = cm.offsetWidth || 180;
    const h = cm.offsetHeight || 120;
    if (x + w > window.innerWidth) x = window.innerWidth - w - 10;
    if (y + h > window.innerHeight) y = window.innerHeight - h - 10;
    cm.style.left = x + 'px';
    cm.style.top = y + 'px';

    document.getElementById('cmAddSubFolder').onclick = () => {
        cm.classList.add('hidden');
        showFolderModal(null, folderId);
    };
    document.getElementById('cmRename').onclick = () => {
        cm.classList.add('hidden');
        showFolderModal(folderId);
    };
    document.getElementById('cmDelete').onclick = () => {
        cm.classList.add('hidden');
        deleteFolder(folderId, folderName);
    };
}

document.addEventListener('click', () => {
    const cm = document.getElementById('bvContextMenu');
    if (cm && !cm.classList.contains('hidden')) cm.classList.add('hidden');
});

// ─── 書籤列表 ─────────────────────────────────────────────────────────────
function renderBreadcrumb() {
    const bc = document.getElementById('bvBreadcrumb');
    if (!bc) return;
    bc.innerHTML = '';

    const allBookmarksStr = typeof getLangText === 'function' ? getLangText(_currentLang, 'bvAllBookmarks') : '全部收藏';
    const uncategorizedStr = typeof getLangText === 'function' ? getLangText(_currentLang, 'bvUncategorized') : '未分類';

    const path = [];
    if (_activeFolderId === '__all__') {
        path.push({ id: '__all__', name: `📚 ${allBookmarksStr}` });
    } else if (_activeFolderId === null) {
        path.push({ id: null, name: `📥 ${uncategorizedStr}` });
    } else {
        path.push({ id: '__all__', name: `📚 ${allBookmarksStr}` });
        
        let curr = _allFolders.find(f => f.id === _activeFolderId);
        const hierarchy = [];
        while (curr) {
            hierarchy.unshift({ id: curr.id, name: '📁 ' + curr.name });
            curr = _allFolders.find(f => f.id === curr.parentId);
        }
        path.push(...hierarchy);
    }

    path.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'bv-bc-item';
        span.textContent = item.name;
        span.onclick = () => {
            _activeFolderId = item.id;
            if (item.id !== '__all__' && item.id !== null) {
                _expandedFolders.add(item.id);
            }
            renderFolderTree();
            renderBookmarks();
        };
        bc.appendChild(span);

        if (index < path.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'bv-bc-sep';
            sep.textContent = '>';
            bc.appendChild(sep);
        }
    });
}

function renderSubfolders() {
    const subGrid = document.getElementById('bvSubfolderGrid');
    if (!subGrid) return;
    subGrid.innerHTML = '';

    let targetFolders = [];
    if (_activeFolderId === '__all__') {
        targetFolders = _allFolders.filter(f => !f.parentId);
    } else if (_activeFolderId !== null) {
        targetFolders = _allFolders.filter(f => f.parentId === _activeFolderId);
    }

    targetFolders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    targetFolders.forEach(f => {
        const card = document.createElement('div');
        card.className = 'bv-subfolder-card';
        card.onclick = () => {
            _activeFolderId = f.id;
            _expandedFolders.add(f.id);
            renderFolderTree();
            renderBookmarks();
        };
        card.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.pageX, e.pageY, f.id, f.name);
        };

        const icon = document.createElement('div');
        icon.className = 'bv-subfolder-card-icon';
        icon.textContent = '📁';

        const info = document.createElement('div');
        info.className = 'bv-subfolder-card-info';
        
        const name = document.createElement('div');
        name.className = 'bv-subfolder-card-name';
        name.textContent = f.name;

        const countText = document.createElement('div');
        countText.className = 'bv-subfolder-card-count';
        const directCount = _allBookmarks.filter(b => b.folderId === f.id).length;
        countText.textContent = `${directCount} 部影片`;

        info.append(name, countText);
        card.append(icon, info);
        subGrid.appendChild(card);
    });

    const subContainer = document.getElementById('bvSubfolderContainer');
    if (subContainer) {
        if (targetFolders.length === 0) {
            subContainer.classList.add('hidden');
        } else {
            subContainer.classList.remove('hidden');
            setTimeout(() => {
                if (window._updateSubfolderScrollBtns) window._updateSubfolderScrollBtns();
            }, 50);
        }
    }
}

function renderBookmarks() {
    renderBreadcrumb();
    renderSubfolders();

    const grid = document.getElementById('bvGrid');
    const empty = document.getElementById('bvEmpty');
    grid.innerHTML = '';

    let items = _getFilteredBookmarks();

    // 排序
    items = _sortBookmarks(items);

    grid.className = 'bv-grid' + (_viewMode === 'list' ? ' list-view' : '');

    const subGrid = document.getElementById('bvSubfolderGrid');
    const hasSubfolders = subGrid && subGrid.children.length > 0;

    if (items.length === 0 && !hasSubfolders) {
        empty.classList.remove('hidden');
        document.getElementById('bvPagination').innerHTML = '';
        return;
    }
    empty.classList.add('hidden');

    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / _itemsPerPage) || 1;
    
    // 確保當前分頁沒有超出範圍
    if (_currentPage > totalPages) _currentPage = totalPages;
    if (_currentPage < 1) _currentPage = 1;

    const startIndex = (_currentPage - 1) * _itemsPerPage;
    const pageItems = items.slice(startIndex, startIndex + _itemsPerPage);

    pageItems.forEach(bm => grid.appendChild(_makeCard(bm)));

    _renderPagination(totalItems, totalPages);
}

function _renderPagination(totalItems, totalPages) {
    const container = document.getElementById('bvPagination');
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) return; // 只有一頁不顯示分頁列

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'bv-pagination';

    const createBtn = (text, page, isDisabled, isActive) => {
        const btn = document.createElement('button');
        btn.className = 'bv-page-btn';
        if (isDisabled) btn.classList.add('disabled');
        if (isActive) btn.classList.add('active');
        btn.textContent = text;
        
        if (!isDisabled && !isActive) {
            btn.onclick = () => {
                _currentPage = page;
                renderBookmarks();
                document.querySelector('.bv-content').scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
        return btn;
    };

    // < 上一頁
    paginationDiv.appendChild(createBtn('<', _currentPage - 1, _currentPage === 1, false));

    // 智慧型頁碼省略邏輯 (1 2 3 4 5 ... 259 260)
    const maxVisible = 7;
    let pages = [];

    if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (_currentPage > 3) pages.push('...');
        
        let start = Math.max(2, _currentPage - 1);
        let end = Math.min(totalPages - 1, _currentPage + 1);
        
        if (_currentPage === 1) end = 3;
        if (_currentPage === totalPages) start = totalPages - 2;

        for (let i = start; i <= end; i++) pages.push(i);
        
        if (_currentPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    pages.forEach(p => {
        if (p === '...') {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.color = 'var(--text3)';
            dots.style.padding = '0 4px';
            paginationDiv.appendChild(dots);
        } else {
            paginationDiv.appendChild(createBtn(p, p, false, p === _currentPage));
        }
    });

    // > 下一頁
    paginationDiv.appendChild(createBtn('>', _currentPage + 1, _currentPage === totalPages, false));

    // Jump Input
    const jumpWrap = document.createElement('div');
    jumpWrap.style.cssText = 'display:inline-flex; align-items:center; margin-left:12px; position:relative;';
    
    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = 1;
    jumpInput.max = totalPages;
    jumpInput.placeholder = '';
    jumpInput.className = 'bv-page-jump-input';
    jumpInput.title = '輸入頁碼後按 Enter 跳轉';
    
    jumpInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            let p = parseInt(jumpInput.value);
            if (!isNaN(p)) {
                if (p < 1) p = 1;
                if (p > totalPages) p = totalPages;
                _currentPage = p;
                renderBookmarks();
                document.querySelector('.bv-content').scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };
    
    jumpWrap.appendChild(jumpInput);
    paginationDiv.appendChild(jumpWrap);

    const hint = document.createElement('div');
    hint.className = 'bv-page-hint';
    hint.textContent = getLangText ? getLangText(_currentLang, 'bvPageHint', { key: '← / →' }) || '使用鍵盤上的 ← 與 → 鍵來翻頁' : '使用鍵盤上的 ← 與 → 鍵來翻頁';

    container.append(paginationDiv, hint);
}

function _getFilteredBookmarks() {
    let items = _allBookmarks;

    // 資料夾篩選
    if (_activeFolderId === '__all__') {
        // 全部，不篩選
    } else if (_activeFolderId === null) {
        items = items.filter(b => !b.folderId);
    } else {
        // 只顯示該資料夾直屬的書籤
        items = items.filter(b => b.folderId === _activeFolderId);
    }

    // 搜尋篩選
    if (_searchTerm) {
        const q = _searchTerm.toLowerCase();
        items = items.filter(b =>
            (b.title || '').toLowerCase().includes(q) ||
            (b.url || '').toLowerCase().includes(q) ||
            (b.domain || '').toLowerCase().includes(q)
        );
    }
    return items;
}

function _sortBookmarks(items) {
    return [...items].sort((a, b) => {
        switch (_sortMode) {
            case 'newest': return (b.addedAt || 0) - (a.addedAt || 0);
            case 'oldest': return (a.addedAt || 0) - (b.addedAt || 0);
            case 'title':  return (a.title || '').localeCompare(b.title || '');
            case 'domain': return (a.domain || '').localeCompare(b.domain || '');
            default: return 0;
        }
    });
}

function _makeCard(bm) {
    const card = document.createElement('div');
    card.className = 'bv-card';

    // Thumbnail

    const rating = _allRatings[bm.videoId];
    const SVG_LIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;display:inline-block;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
    const SVG_DISLIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;display:inline-block;"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>`;
    
    const badges = document.createElement('span');
    badges.className = 'bv-card-badges';
    let iconsHTML = '';
    if (rating === 'like') iconsHTML += SVG_LIKE;
    if (rating === 'dislike') iconsHTML += SVG_DISLIKE;
    iconsHTML += '<span>❤️</span>';
    badges.innerHTML = iconsHTML;

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'bv-card-thumb-wrap';

    if (bm.thumbnail) {
        const img = document.createElement('img');
        img.className = 'bv-card-thumb';
        img.referrerPolicy = 'no-referrer'; // 繞過 CDN 防盜鏈檢查
        img.loading = 'lazy';
        
        img.onerror = () => {
            const ph = document.createElement('div');
            ph.className = 'bv-card-thumb-placeholder';
            ph.style.cssText = 'display:flex; flex-direction:column; justify-content:center; align-items:center; background:#1a1a1a; padding:10px; text-align:center; height:100%;';
            ph.innerHTML = `<span style="font-size:24px;margin-bottom:8px;">🪄</span><span style="color:#00e676; font-size:12px; font-weight:bold; line-height:1.4;">${getLang('clickToHeal', '點擊觀看以修復縮圖')}</span>`;
            img.replaceWith(ph);
        };
        
        // [效能升級] 優先從分離資料庫提取二進位縮圖
        window.vtDB.get('vt_thumbnails', bm.videoId).then(data => {
            if (data && data.thumbnail) {
                img.src = data.thumbnail;
            } else {
                img.src = bm.thumbnail; // fallback
            }
        }).catch(() => {
            img.src = bm.thumbnail;
        });

        thumbWrap.appendChild(img);
    } else {
        const ph = _makePlaceholder();
        ph.className = 'bv-card-thumb-placeholder';
        thumbWrap.appendChild(ph);
    }
    
    thumbWrap.appendChild(badges);
    card.appendChild(thumbWrap);

    // Body
    const body = document.createElement('div');
    body.className = 'bv-card-body';

    const title = document.createElement('div');
    title.className = 'bv-card-title';
    title.textContent = bm.title || bm.url;
    title.title = bm.title || '';

    const meta = document.createElement('div');
    meta.className = 'bv-card-meta';

    const domain = document.createElement('span');
    domain.className = 'bv-card-domain';
    domain.textContent = bm.domain || '';

    const date = document.createElement('span');
    date.className = 'bv-card-date';
    date.textContent = bm.addedAt ? _formatDate(bm.addedAt) : '';

    meta.append(domain, date);
    body.append(title, meta);
    card.appendChild(body);

    // Hover actions
    const acts = document.createElement('div');
    acts.className = 'bv-card-actions';

    const moveBtn = document.createElement('button');
    moveBtn.className = 'bv-card-act';
    moveBtn.textContent = '🗂';
    moveBtn.title = getLang('bvMoveTo', '移動到...');
    moveBtn.onclick = (e) => { 
        e.stopPropagation(); 
        showMoveModal(bm.id, bm.folderId);
    };

    const renameBtn = document.createElement('button');
    renameBtn.className = 'bv-card-act';
    renameBtn.textContent = '✏️';
    renameBtn.title = getLang('bvRenameBookmark', '重新命名書籤');
    renameBtn.onclick = (e) => { e.stopPropagation(); renameBookmark(bm.id, bm.title || bm.url); };

    const delBtn = document.createElement('button');
    delBtn.className = 'bv-card-act danger';
    delBtn.textContent = '🗑';
    delBtn.title = getLang('bvDeleteBookmark', '刪除書籤');
    delBtn.onclick = (e) => { e.stopPropagation(); deleteBookmark(bm.id, bm.title); };

    acts.append(renameBtn, moveBtn, delBtn);
    card.appendChild(acts);

    // 點擊卡片開啟連結
    card.onclick = () => chrome.tabs.create({ url: bm.url });

    return card;
}

function _makePlaceholder() {
    const ph = document.createElement('div');
    ph.className = 'bv-card-thumb-placeholder';
    ph.textContent = '🎬';
    return ph;
}

function _formatDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── 資料夾 CRUD ─────────────────────────────────────────────────────────
function showFolderModal(editId = null, parentId = null) {
    const modal = document.getElementById('bvModal');
    const title = document.getElementById('bvModalTitle');
    const input = document.getElementById('bvModalInput');
    const confirm = document.getElementById('bvModalConfirm');
    const cancel = document.getElementById('bvModalCancel');

    title.textContent = editId ? getLang('bvRenameFolderTitle', '重新命名資料夾') : (parentId ? getLang('bvNewSubFolderTitle', '新增子資料夾') : getLang('bvNewFolderTitle', '新增資料夾'));
    input.value = editId ? (_allFolders.find(f => f.id === editId)?.name || '') : '';
    modal.classList.remove('hidden');
    input.focus();
    input.select();

    const cleanup = () => {
        modal.classList.add('hidden');
        confirm.onclick = null;
        cancel.onclick = null;
        input.onkeydown = null;
    };
    cancel.onclick = cleanup;

    const handleConfirm = async () => {
        const name = input.value.trim();
        if (!name) return;
        if (editId) {
            // 修改
            const f = _allFolders.find(x => x.id === editId);
            if (f) {
                f.name = name;
                await window.vtDB.put('vt_bm_folders', f);
            }
        } else {
            // 新增
            const newF = {
                id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                name, parentId: parentId || null,
                order: _allFolders.length, createdAt: Date.now()
            };
            _allFolders.push(newF);
            await window.vtDB.put('vt_bm_folders', newF);
            if (parentId) _expandedFolders.add(parentId);
        }
        notifySync();
        cleanup();
        renderAll();
    };

    confirm.onclick = handleConfirm;
    input.onkeydown = (e) => { if (e.key === 'Enter') handleConfirm(); };
}

async function deleteFolder(folderId, folderName) {
    showConfirm(
        `刪除「${folderName}」？`,
        '此資料夾內的書籤將移至「未分類」，子資料夾也會一併刪除。',
        async () => {
            // 移動書籤到未分類
            const allSubIds = _getAllSubfolderIds(folderId);
            allSubIds.add(folderId);
            
            for (const b of _allBookmarks) {
                if (allSubIds.has(b.folderId)) {
                    b.folderId = null;
                    await window.vtDB.put('vt_bookmarks', b);
                }
            }
            
            // 刪除資料夾及子孫
            for (const id of allSubIds) {
                await window.vtDB.delete('vt_bm_folders', id);
            }
            _allFolders = _allFolders.filter(f => !allSubIds.has(f.id));
            
            notifySync();
            if (_activeFolderId === folderId || allSubIds.has(_activeFolderId)) {
                _activeFolderId = '__all__';
            }
            renderAll();
            showToast('🗑 資料夾已刪除');
        }
    );
}

async function deleteBookmark(bookmarkId, title) {
    showConfirm(
        getLang('bvDeleteBookmarkConfirm', '刪除書籤？'),
        getLang('bvDeleteBookmarkDesc', '「{title}」將從收藏中移除。').replace('{title}', (title || '').slice(0, 40)),
        async () => {
            const bm = _allBookmarks.find(b => b.id === bookmarkId);
            _allBookmarks = _allBookmarks.filter(b => b.id !== bookmarkId);
            if (bm) {
                await window.vtDB.delete('vt_bookmarks', bm.videoId);
                notifySync();
            }
            renderAll();
            showToast('🗑 書籤已刪除');
        }
    );
}

async function renameBookmark(bookmarkId, oldTitle) {
    const newTitle = prompt(getLang('bvNewBookmarkTitle', '請輸入新標題：'), oldTitle);
    if (newTitle !== null && newTitle.trim() !== '' && newTitle !== oldTitle) {
        const bm = _allBookmarks.find(b => b.id === bookmarkId);
        if (bm) {
            bm.title = newTitle.trim();
            await window.vtDB.put('vt_bookmarks', bm);
            notifySync();
            renderAll();
        }
    }
}

// ─── 確認 Modal ──────────────────────────────────────────────────────────
function showConfirm(title, desc, onOk) {
    const modal = document.getElementById('bvConfirmModal');
    document.getElementById('bvConfirmTitle').textContent = title;
    document.getElementById('bvConfirmDesc').textContent = desc;
    modal.classList.remove('hidden');

    const ok = document.getElementById('bvConfirmOk');
    const cancel = document.getElementById('bvConfirmCancel');
    const cleanup = () => {
        modal.classList.add('hidden');
        ok.onclick = null; cancel.onclick = null;
    };
    cancel.onclick = cleanup;
    ok.onclick = () => { cleanup(); onOk(); };
}

function showMoveModal(bookmarkId, currentFolderId) {
    let selectedFolderId = currentFolderId;
    const overlay = document.createElement('div');
    overlay.className = 'bv-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'bv-modal';
    modal.style.width = '360px';
    modal.style.padding = '0';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.maxHeight = '480px';
    
    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;';
    const htitle = document.createElement('h3');
    htitle.textContent = '🗂 移動書籤';
    htitle.style.margin = '0';
    const xBtn = document.createElement('button');
    xBtn.textContent = '✕';
    xBtn.style.cssText = 'background:none;border:none;color:var(--text2);cursor:pointer;font-size:16px;';
    xBtn.onclick = () => overlay.remove();
    hdr.append(htitle, xBtn);

    const tree = document.createElement('div');
    tree.style.cssText = 'flex:1;overflow-y:auto;padding:8px;';
    
    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'bv-btn bv-btn-ghost';
    cancelBtn.onclick = () => overlay.remove();
    
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '確認移動';
    confirmBtn.className = 'bv-btn bv-btn-accent';
    confirmBtn.onclick = async () => {
        const bm = _allBookmarks.find(b => b.id === bookmarkId);
        if (bm) {
            bm.folderId = selectedFolderId;
            await window.vtDB.put('vt_bookmarks', bm);
            notifySync();
            renderAll();
            showToast('✅ 書籤已移動');
        }
        overlay.remove();
    };
    confirmRow.append(cancelBtn, confirmBtn);
    
    modal.append(hdr, tree, confirmRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function _renderTree() {
        const oldScroll = tree.scrollTop;
        tree.innerHTML = '';
        const folders = _allFolders;

        const renderItem = (label, id, depth, hasKids) => {
            const item = document.createElement('div');
            item.style.cssText = `
                display:flex;align-items:center;padding:7px 12px 7px ${12 + depth * 20}px;
                border-radius:8px;margin-bottom:2px;cursor:pointer;user-select:none;
                transition:background 0.15s; position:relative;
                ${selectedFolderId === id ? 'background:rgba(233,30,140,0.15);' : ''}
            `;

            item.onmouseenter = () => { if (selectedFolderId !== id) item.style.background = 'var(--bg4)'; };
            item.onmouseleave = () => { if (selectedFolderId !== id) item.style.background = 'none'; };

            const chevron = document.createElement('span');
            chevron.style.cssText = 'display:inline-block;width:16px;color:var(--text3);font-size:12px;transition:transform 0.2s;text-align:center;';
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
            lbl.style.cssText = 'flex:1;color:var(--text);font-size:13px;margin-left:6px;';

            const radio = document.createElement('div');
            radio.style.cssText = `
                width:16px;height:16px;border-radius:50%;border:2px solid ${selectedFolderId === id ? 'var(--accent)' : 'var(--text3)'};
                display:flex;align-items:center;justify-content:center;
            `;
            if (selectedFolderId === id) {
                const dot = document.createElement('div');
                dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:var(--accent);';
                radio.appendChild(dot);
            }

            item.onclick = () => {
                if (hasKids) {
                    if (_expandedFolders.has(id)) _expandedFolders.delete(id);
                    else _expandedFolders.add(id);
                }
                selectedFolderId = id;
                _renderTree();
            };

            item.append(chevron, lbl, radio);
            tree.appendChild(item);
        };

        renderItem('📥 未分類（根目錄）', null, 0, false);

        const renderLevel = (parentId, depth) => {
            const kids = folders.filter(f => f.parentId === parentId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            kids.forEach(f => {
                const hasKids = folders.some(sub => sub.parentId === f.id);
                renderItem('📁 ' + f.name, f.id, depth, hasKids);
                if (hasKids && _expandedFolders.has(f.id)) {
                    renderLevel(f.id, depth + 1);
                }
            });
        };
        renderLevel(null, 1);
        requestAnimationFrame(() => tree.scrollTop = oldScroll);
    }
    
    _renderTree();
}

// ─── 儲存 ─────────────────────────────────────────────────────────────────
// (移除 _saveFolders 與 _saveBookmarks，改為即時寫入 DB)

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('bvToast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// ─── 初始化事件 ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 預設固定為 18 個一頁 (3排6列)
    _itemsPerPage = _viewMode === 'list' ? 12 : 18;

    // 鍵盤左右切換分頁
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const totalItems = _getFilteredBookmarks().length;
        const totalPages = Math.ceil(totalItems / _itemsPerPage) || 1;
        
        if (e.key === 'ArrowLeft' && _currentPage > 1) {
            _currentPage--;
            renderBookmarks();
        } else if (e.key === 'ArrowRight' && _currentPage < totalPages) {
            _currentPage++;
            renderBookmarks();
        }
    });

    // 搜尋
    const searchEl = document.getElementById('bvSearch');
    let _searchTimer;
    searchEl.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            _searchTerm = searchEl.value.trim();
            _currentPage = 1; // 重設分頁
            renderBookmarks();
        }, 200);
    });

    // 子資料夾橫向捲動
    const subGrid = document.getElementById('bvSubfolderGrid');
    const btnLeft = document.getElementById('bvSubfolderLeft');
    const btnRight = document.getElementById('bvSubfolderRight');
    
    if (subGrid && btnLeft && btnRight) {
        const updateScrollBtns = () => {
            // Check if scrollable
            if (subGrid.scrollWidth <= subGrid.clientWidth + 2) {
                btnLeft.classList.add('hidden');
                btnRight.classList.add('hidden');
            } else {
                btnLeft.classList.remove('hidden');
                btnRight.classList.remove('hidden');
            }
        };
        
        subGrid.addEventListener('scroll', updateScrollBtns);
        window.addEventListener('resize', updateScrollBtns);
        
        // 每次點擊左右箭頭時，直接捲動整個可視寬度的距離加上 gap (16px) (跳一頁)
        btnLeft.onclick = () => subGrid.scrollBy({ left: -(subGrid.clientWidth + 16), behavior: 'smooth' });
        btnRight.onclick = () => subGrid.scrollBy({ left: subGrid.clientWidth + 16, behavior: 'smooth' });
        
        window._updateSubfolderScrollBtns = updateScrollBtns;
    }

    // 排序
    document.getElementById('bvSort').addEventListener('change', (e) => {
        _sortMode = e.target.value;
        renderBookmarks();
    });

    // 切換檢視
    document.getElementById('btnViewGrid').addEventListener('click', () => {
        _viewMode = 'grid';
        _itemsPerPage = 18;
        document.getElementById('btnViewGrid').classList.add('active');
        document.getElementById('btnViewList').classList.remove('active');
        renderBookmarks();
    });
    document.getElementById('btnViewList').addEventListener('click', () => {
        _viewMode = 'list';
        _itemsPerPage = 12;
        document.getElementById('btnViewList').classList.add('active');
        document.getElementById('btnViewGrid').classList.remove('active');
        renderBookmarks();
    });

    // 新增根目錄資料夾
    document.getElementById('btnNewRootFolder').addEventListener('click', () => {
        showFolderModal(null, null);
    });

    // 移除舊的 chrome.storage.onChanged 監聽，因為現在全部由 BroadcastChannel 接手同步。
    const channel = new BroadcastChannel('vt_sync');
    channel.onmessage = (event) => {
        if (event.data === 'data_updated') loadData();
    };

    // Resizer logic
    const resizer = document.getElementById('bvResizer');
    const sidebar = document.querySelector('.bv-sidebar');
    let isResizing = false;

    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            sidebar.style.userSelect = 'none'; // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 200 && newWidth <= 800) {
                sidebar.style.width = newWidth + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                sidebar.style.userSelect = '';
                document.body.style.userSelect = '';
                chrome.storage.local.set({ sidebarWidth: sidebar.style.width });
            }
        });

        // Initialize sidebar width from storage
        chrome.storage.local.get(['sidebarWidth'], (data) => {
            if (data.sidebarWidth) sidebar.style.width = data.sidebarWidth;
        });
    }

    // 載入資料
    loadData();
});
