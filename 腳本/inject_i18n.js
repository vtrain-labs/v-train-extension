const fs = require('fs');

const newKeys = {
    en: {
        bvVideoCount: "{num} Videos",
        bvJumpHint: "Enter page number and press Enter",
        bvDelFolderConfirm: "Delete '{name}'?",
        bvDelFolderDesc: "Bookmarks will be moved to Uncategorized, and subfolders will be deleted.",
        bvToastFolderDel: "🗑 Folder deleted",
        bvToastBookmarkDel: "🗑 Bookmark deleted",
        bvToastMoved: "✅ Bookmark moved",
        bvMoveTitle: "🗂 Move Bookmark",
        bvBtnMove: "Confirm Move",
        btnLike: "Like",
        btnDislike: "Dislike",
        btnBookmark: "Bookmark",
        btnManage: "Manage Bookmarks",
        dragHint: "Drag to move (Double click to reset)"
    },
    "zh-TW": {
        bvVideoCount: "{num} 部影片",
        bvJumpHint: "輸入頁碼後按 Enter 跳轉",
        bvDelFolderConfirm: "刪除「{name}」？",
        bvDelFolderDesc: "此資料夾內的書籤將移至「未分類」，子資料夾也會一併刪除。",
        bvToastFolderDel: "🗑 資料夾已刪除",
        bvToastBookmarkDel: "🗑 書籤已刪除",
        bvToastMoved: "✅ 書籤已移動",
        bvMoveTitle: "🗂 移動書籤",
        bvBtnMove: "確認移動",
        btnLike: "喜歡",
        btnDislike: "不喜歡",
        btnBookmark: "收藏",
        btnManage: "書籤管理",
        dragHint: "拖曳移動 (點兩下恢復原位)"
    },
    "zh-CN": {
        bvVideoCount: "{num} 部影片",
        bvJumpHint: "输入页码后按 Enter 跳转",
        bvDelFolderConfirm: "删除“{name}”？",
        bvDelFolderDesc: "此文件夹内的书签将移至“未分类”，子文件夹也会一并删除。",
        bvToastFolderDel: "🗑 文件夹已删除",
        bvToastBookmarkDel: "🗑 书签已删除",
        bvToastMoved: "✅ 书签已移动",
        bvMoveTitle: "🗂 移动书签",
        bvBtnMove: "确认移动",
        btnLike: "喜欢",
        btnDislike: "不喜欢",
        btnBookmark: "收藏",
        btnManage: "书签管理",
        dragHint: "拖拽移动 (双击恢复原位)"
    },
    ja: {
        bvVideoCount: "{num} 本の動画",
        bvJumpHint: "ページ番号を入力して Enter で移動",
        bvDelFolderConfirm: "「{name}」を削除しますか？",
        bvDelFolderDesc: "このフォルダ内のブックマークは「未分類」に移動し、サブフォルダも削除されます。",
        bvToastFolderDel: "🗑 フォルダを削除しました",
        bvToastBookmarkDel: "🗑 ブックマークを削除しました",
        bvToastMoved: "✅ ブックマークを移動しました",
        bvMoveTitle: "🗂 ブックマークの移動",
        bvBtnMove: "移動を確認",
        btnLike: "いいね",
        btnDislike: "よくないね",
        btnBookmark: "ブックマーク",
        btnManage: "ブックマーク管理",
        dragHint: "ドラッグして移動 (ダブルクリックで元に戻す)"
    },
    ko: {
        bvVideoCount: "{num} 개의 동영상",
        bvJumpHint: "페이지 번호를 입력하고 Enter를 누르세요",
        bvDelFolderConfirm: "'{name}'을(를) 삭제하시겠습니까?",
        bvDelFolderDesc: "이 폴더의 북마크는 '미분류'로 이동되며, 하위 폴더도 삭제됩니다.",
        bvToastFolderDel: "🗑 폴더가 삭제되었습니다",
        bvToastBookmarkDel: "🗑 북마크가 삭제되었습니다",
        bvToastMoved: "✅ 북마크가 이동되었습니다",
        bvMoveTitle: "🗂 북마크 이동",
        bvBtnMove: "이동 확인",
        btnLike: "좋아요",
        btnDislike: "싫어요",
        btnBookmark: "북마크",
        btnManage: "북마크 관리",
        dragHint: "드래그하여 이동 (두 번 클릭하여 초기화)"
    },
    es: {
        bvVideoCount: "{num} Videos",
        bvJumpHint: "Introduzca el número de página y pulse Enter",
        bvDelFolderConfirm: "¿Eliminar '{name}'?",
        bvDelFolderDesc: "Los marcadores se moverán a Sin categoría y las subcarpetas se eliminarán.",
        bvToastFolderDel: "🗑 Carpeta eliminada",
        bvToastBookmarkDel: "🗑 Marcador eliminado",
        bvToastMoved: "✅ Marcador movido",
        bvMoveTitle: "🗂 Mover Marcador",
        bvBtnMove: "Confirmar",
        btnLike: "Me gusta",
        btnDislike: "No me gusta",
        btnBookmark: "Marcador",
        btnManage: "Gestionar",
        dragHint: "Arrastrar para mover (Doble clic para restablecer)"
    },
    fr: {
        bvVideoCount: "{num} Vidéos",
        bvJumpHint: "Entrez le numéro de page et appuyez sur Entrée",
        bvDelFolderConfirm: "Supprimer '{name}'?",
        bvDelFolderDesc: "Les favoris seront déplacés vers Non classé, et les sous-dossiers seront supprimés.",
        bvToastFolderDel: "🗑 Dossier supprimé",
        bvToastBookmarkDel: "🗑 Favori supprimé",
        bvToastMoved: "✅ Favori déplacé",
        bvMoveTitle: "🗂 Déplacer le favori",
        bvBtnMove: "Confirmer",
        btnLike: "J'aime",
        btnDislike: "Je n'aime pas",
        btnBookmark: "Favori",
        btnManage: "Gérer",
        dragHint: "Faites glisser pour déplacer (Double clic pour réinitialiser)"
    },
    de: {
        bvVideoCount: "{num} Videos",
        bvJumpHint: "Seitenzahl eingeben und Enter drücken",
        bvDelFolderConfirm: "'{name}' löschen?",
        bvDelFolderDesc: "Lesezeichen werden nach Nicht kategorisiert verschoben und Unterordner gelöscht.",
        bvToastFolderDel: "🗑 Ordner gelöscht",
        bvToastBookmarkDel: "🗑 Lesezeichen gelöscht",
        bvToastMoved: "✅ Lesezeichen verschoben",
        bvMoveTitle: "🗂 Lesezeichen verschieben",
        bvBtnMove: "Bestätigen",
        btnLike: "Mag ich",
        btnDislike: "Mag ich nicht",
        btnBookmark: "Lesezeichen",
        btnManage: "Verwalten",
        dragHint: "Zum Bewegen ziehen (Doppelklick zum Zurücksetzen)"
    }
};

let content = fs.readFileSync('shared_i18n.js', 'utf8');

for (const lang of Object.keys(newKeys)) {
    const keysToAdd = newKeys[lang];
    const regex = new RegExp(`("${lang}"\\s*:\\s*\\{[\\s\\S]*?)(?=\\s*\\},?\\s*"[a-zA-Z-]+":|\\s*\\}\\s*\\};)`);
    
    let match = content.match(regex);
    if (match) {
        let replacement = match[1];
        if (!replacement.trim().endsWith(',')) {
            replacement += ",\n";
        }
        
        let additions = Object.entries(keysToAdd).map(([k, v]) => `            ${k}: ${JSON.stringify(v)}`).join(',\n');
        replacement += "\n            // --- Newly Added Keys ---\n" + additions + "\n";
        
        content = content.replace(regex, replacement);
    }
}

fs.writeFileSync('shared_i18n.js', content, 'utf8');
console.log('Done!');
