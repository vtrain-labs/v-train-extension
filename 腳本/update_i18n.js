const fs = require('fs');
let content = fs.readFileSync('D:/UDATA/Kevin/Desktop/VT/shared_i18n.js', 'utf8');

const newKeys = {
    'en': {
        bvDeleteBookmark: 'Delete Bookmark',
        bvDeleteBookmarkConfirm: 'Delete Bookmark?',
        bvMoveTo: 'Move to...',
        bvNewFolderTitle: 'New Folder',
        bvNewSubFolderTitle: 'New Subfolder',
        bvRenameFolderTitle: 'Rename Folder',
        bvGrid: 'Grid View',
        bvList: 'List View'
    },
    'zh-TW': {
        bvDeleteBookmark: '刪除書籤',
        bvDeleteBookmarkConfirm: '刪除書籤？',
        bvMoveTo: '移動到...',
        bvNewFolderTitle: '新增資料夾',
        bvNewSubFolderTitle: '新增子資料夾',
        bvRenameFolderTitle: '重新命名資料夾',
        bvGrid: '格狀檢視',
        bvList: '列表檢視'
    },
    'zh-CN': {
        bvDeleteBookmark: '删除书签',
        bvDeleteBookmarkConfirm: '删除书签？',
        bvMoveTo: '移动到...',
        bvNewFolderTitle: '新增文件夹',
        bvNewSubFolderTitle: '新增子文件夹',
        bvRenameFolderTitle: '重命名文件夹',
        bvGrid: '网格视图',
        bvList: '列表视图'
    },
    'ja': {
        bvDeleteBookmark: 'ブックマークを削除',
        bvDeleteBookmarkConfirm: 'ブックマークを削除しますか？',
        bvMoveTo: '移動...',
        bvNewFolderTitle: '新しいフォルダ',
        bvNewSubFolderTitle: '新しいサブフォルダ',
        bvRenameFolderTitle: 'フォルダ名を変更',
        bvGrid: 'グリッド表示',
        bvList: 'リスト表示'
    },
    'ko': {
        bvDeleteBookmark: '북마크 삭제',
        bvDeleteBookmarkConfirm: '북마크를 삭제하시겠습니까?',
        bvMoveTo: '이동...',
        bvNewFolderTitle: '새 폴더',
        bvNewSubFolderTitle: '새 하위 폴더',
        bvRenameFolderTitle: '폴더 이름 바꾸기',
        bvGrid: '그리드 보기',
        bvList: '목록 보기'
    },
    'es': {
        bvDeleteBookmark: 'Eliminar Marcador',
        bvDeleteBookmarkConfirm: '¿Eliminar Marcador?',
        bvMoveTo: 'Mover a...',
        bvNewFolderTitle: 'Nueva Carpeta',
        bvNewSubFolderTitle: 'Nueva Subcarpeta',
        bvRenameFolderTitle: 'Renombrar Carpeta',
        bvGrid: 'Vista de Cuadrícula',
        bvList: 'Vista de Lista'
    },
    'fr': {
        bvDeleteBookmark: 'Supprimer le Signet',
        bvDeleteBookmarkConfirm: 'Supprimer le Signet ?',
        bvMoveTo: 'Déplacer vers...',
        bvNewFolderTitle: 'Nouveau Dossier',
        bvNewSubFolderTitle: 'Nouveau Sous-dossier',
        bvRenameFolderTitle: 'Renommer le Dossier',
        bvGrid: 'Vue en Grille',
        bvList: 'Vue en Liste'
    },
    'de': {
        bvDeleteBookmark: 'Lesezeichen löschen',
        bvDeleteBookmarkConfirm: 'Lesezeichen löschen?',
        bvMoveTo: 'Verschieben nach...',
        bvNewFolderTitle: 'Neuer Ordner',
        bvNewSubFolderTitle: 'Neuer Unterordner',
        bvRenameFolderTitle: 'Ordner umbenennen',
        bvGrid: 'Rasteransicht',
        bvList: 'Listenansicht'
    }
};

for (const [lang, keys] of Object.entries(newKeys)) {
    const langPattern = new RegExp('"' + lang + '": \\{([\\s\\S]*?)\\},', 'g');
    content = content.replace(langPattern, (match, p1) => {
        let block = p1.trimEnd();
        if (block.endsWith(',')) block = block.slice(0, -1);
        for (const [k, v] of Object.entries(keys)) {
            block += `,\n            ${k}: "${v}"`;
        }
        return `"${lang}": {\n${block}\n\n        },`;
    });
}

fs.writeFileSync('D:/UDATA/Kevin/Desktop/VT/shared_i18n.js', content);
