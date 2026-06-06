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

// ─── 載入資料 ─────────────────────────────────────────────────────────────
async function loadData() {
    const data = await new Promise(r =>
        chrome.storage.local.get(['vt_bookmarks', 'vt_bm_folders', 'vt_ratings'], r)
    );
    _allBookmarks = data.vt_bookmarks || [];
    _allFolders   = data.vt_bm_folders || [];
    _allRatings   = data.vt_ratings || {};
    renderAll();
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

    // 全部
    tree.appendChild(_makeFolderNode({
        id: '__all__', name: '📚 全部收藏', icon: '',
        count: _allBookmarks.length, depth: 0, isSpecial: true
    }));
    // 未分類
    const uncat = _allBookmarks.filter(b => !b.folderId).length;
    tree.appendChild(_makeFolderNode({
        id: null, name: '📥 未分類', icon: '',
        count: uncat, depth: 0, isSpecial: true
    }));

    // 遞迴渲染資料夾
    _renderFolderLevel(tree, null, 0);
}

function _renderFolderLevel(container, parentId, depth) {
    const kids = _allFolders
        .filter(f => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
    item.style.paddingLeft = `${12 + depth * 20}px`;
    item.style.position = 'relative';
    item.dataset.folderId = id === null ? '__null__' : (id || '__all__');

    // 展開/折疊箭頭
    if (hasKids) {
        const tog = document.createElement('button');
        tog.className = 'bv-folder-toggle' + (_expandedFolders.has(id) ? ' expanded' : '');
        tog.textContent = '▶';
        tog.onclick = (e) => {
            e.stopPropagation();
            if (_expandedFolders.has(id)) _expandedFolders.delete(id);
            else _expandedFolders.add(id);
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

    const path = [];
    if (_activeFolderId === '__all__') {
        path.push({ id: '__all__', name: '📚 全部收藏' });
    } else if (_activeFolderId === null) {
        path.push({ id: null, name: '📥 未分類' });
    } else {
        path.push({ id: '__all__', name: '📚 全部收藏' });
        
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

    targetFolders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
        return;
    }
    empty.classList.add('hidden');

    items.forEach(bm => grid.appendChild(_makeCard(bm)));
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
    if (bm.thumbnail) {
        const img = document.createElement('img');
        img.className = 'bv-card-thumb';
        img.src = bm.thumbnail;
        img.referrerPolicy = 'no-referrer'; // 繞過 CDN 防盜鏈檢查
        img.loading = 'lazy';
        img.onerror = () => img.replaceWith(_makePlaceholder());
        card.appendChild(img);
    } else {
        card.appendChild(_makePlaceholder());
    }

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

    const badges = document.createElement('span');
    badges.className = 'bv-card-badges';
    badges.style.display = 'flex';
    badges.style.alignItems = 'center';
    badges.style.gap = '4px';

    const rating = _allRatings[bm.videoId];
    const SVG_LIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;display:inline-block;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
    const SVG_DISLIKE = `<svg viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.2em;height:1.2em;display:inline-block;"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>`;

    let iconsHTML = '';
    if (rating === 'like') iconsHTML += SVG_LIKE;
    if (rating === 'dislike') iconsHTML += SVG_DISLIKE;
    iconsHTML += '<span>❤️</span>';
    badges.innerHTML = iconsHTML;

    const date = document.createElement('span');
    date.className = 'bv-card-date';
    date.textContent = bm.addedAt ? _formatDate(bm.addedAt) : '';

    meta.append(domain, badges);
    body.append(title, meta, date);
    card.appendChild(body);

    // Hover actions
    const acts = document.createElement('div');
    acts.className = 'bv-card-actions';

    const moveBtn = document.createElement('button');
    moveBtn.className = 'bv-card-act';
    moveBtn.textContent = '🗂';
    moveBtn.title = '移動到...';
    moveBtn.onclick = (e) => { 
        e.stopPropagation(); 
        showMoveModal(bm.id, bm.folderId);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'bv-card-act danger';
    delBtn.textContent = '🗑';
    delBtn.title = '刪除書籤';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteBookmark(bm.id, bm.title); };

    acts.append(moveBtn, delBtn);
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

    title.textContent = editId ? '重新命名資料夾' : (parentId ? '新增子資料夾' : '新增資料夾');
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
            // 重新命名
            const f = _allFolders.find(f => f.id === editId);
            if (f) { f.name = name; await _saveFolders(); }
        } else {
            // 新增
            _allFolders.push({
                id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                name, parentId: parentId || null,
                order: _allFolders.length, createdAt: Date.now()
            });
            await _saveFolders();
            if (parentId) _expandedFolders.add(parentId);
        }
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
            _allBookmarks = _allBookmarks.map(b =>
                allSubIds.has(b.folderId) ? { ...b, folderId: null } : b
            );
            await _saveBookmarks();
            // 刪除資料夾及子孫
            _allFolders = _allFolders.filter(f => !allSubIds.has(f.id) && f.id !== folderId);
            await _saveFolders();
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
        `刪除書籤？`,
        `「${(title || '').slice(0, 40)}」將從收藏中移除。`,
        async () => {
            _allBookmarks = _allBookmarks.filter(b => b.id !== bookmarkId);
            await _saveBookmarks();
            renderAll();
            showToast('🗑 書籤已刪除');
        }
    );
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
            await _saveBookmarks();
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
        requestAnimationFrame(() => tree.scrollTop = oldScroll);
    }
    
    _renderTree();
}

// ─── 儲存 ─────────────────────────────────────────────────────────────────
function _saveFolders() {
    return new Promise(r => chrome.storage.local.set({ vt_bm_folders: _allFolders }, r));
}
function _saveBookmarks() {
    return new Promise(r => chrome.storage.local.set({ vt_bookmarks: _allBookmarks }, r));
}

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
    // 搜尋
    const searchEl = document.getElementById('bvSearch');
    let _searchTimer;
    searchEl.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            _searchTerm = searchEl.value.trim();
            renderBookmarks();
        }, 200);
    });

    // 排序
    document.getElementById('bvSort').addEventListener('change', (e) => {
        _sortMode = e.target.value;
        renderBookmarks();
    });

    // 切換檢視
    document.getElementById('btnViewGrid').addEventListener('click', () => {
        _viewMode = 'grid';
        document.getElementById('btnViewGrid').classList.add('active');
        document.getElementById('btnViewList').classList.remove('active');
        renderBookmarks();
    });
    document.getElementById('btnViewList').addEventListener('click', () => {
        _viewMode = 'list';
        document.getElementById('btnViewList').classList.add('active');
        document.getElementById('btnViewGrid').classList.remove('active');
        renderBookmarks();
    });

    // 新增根目錄資料夾
    document.getElementById('btnNewRootFolder').addEventListener('click', () => {
        showFolderModal(null, null);
    });

    // Storage 即時同步
    chrome.storage.onChanged.addListener((changes) => {
        let needReload = false;
        if (changes.vt_bookmarks) { _allBookmarks = changes.vt_bookmarks.newValue || []; needReload = true; }
        if (changes.vt_bm_folders) { _allFolders = changes.vt_bm_folders.newValue || []; needReload = true; }
        if (changes.vt_ratings) { _allRatings = changes.vt_ratings.newValue || {}; needReload = true; }
        if (needReload) renderAll();
    });

    // 載入資料
    loadData();
});
