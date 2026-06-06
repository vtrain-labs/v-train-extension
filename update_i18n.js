const fs = require('fs');
let code = fs.readFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', 'utf8');

const additions = {
    "en": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · Local Collection",
        bvSearch: "Search title or URL...",
        bvFolders: "📁 Folders",
        bvAllBookmarks: "All Bookmarks",
        bvUncategorized: "Uncategorized",
        bvTotal: "📊 Total",
        bvLike: "👍 Likes",
        bvDislike: "😤 Dislikes",
        bvSort: "Sort: Newest",
        bvSettings: "⚙️ System Settings",
        toggleInteraction: "👍 Enable Interaction Buttons",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "zh-TW": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · 本機收藏管理",
        bvSearch: "搜尋書籤標題或網址...",
        bvFolders: "📁 資料夾",
        bvAllBookmarks: "全部收藏",
        bvUncategorized: "未分類",
        bvTotal: "📊 總收藏",
        bvLike: "👍 喜歡",
        bvDislike: "😤 不喜歡",
        bvSort: "排序：最新加入",
        bvSettings: "⚙️ 系統設定",
        toggleInteraction: "👍 啟用快捷互動按鈕",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "zh-CN": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · 本地收藏管理",
        bvSearch: "搜索书签标题或网址...",
        bvFolders: "📁 文件夹",
        bvAllBookmarks: "全部收藏",
        bvUncategorized: "未分类",
        bvTotal: "📊 总收藏",
        bvLike: "👍 喜欢",
        bvDislike: "😤 不喜欢",
        bvSort: "排序：最新加入",
        bvSettings: "⚙️ 系统设置",
        toggleInteraction: "👍 启用快捷互动按钮",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "ja": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · ローカルコレクション",
        bvSearch: "タイトルやURLを検索...",
        bvFolders: "📁 フォルダ",
        bvAllBookmarks: "すべてのブックマーク",
        bvUncategorized: "未分類",
        bvTotal: "📊 合計",
        bvLike: "👍 いいね",
        bvDislike: "😤 よくないね",
        bvSort: "並べ替え：最新",
        bvSettings: "⚙️ システム設定",
        toggleInteraction: "👍 インタラクションボタンを有効化",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "ko": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · 로컬 컬렉션",
        bvSearch: "제목 또는 URL 검색...",
        bvFolders: "📁 폴더",
        bvAllBookmarks: "모든 북마크",
        bvUncategorized: "미분류",
        bvTotal: "📊 총 북마크",
        bvLike: "👍 좋아요",
        bvDislike: "😤 싫어요",
        bvSort: "정렬: 최신순",
        bvSettings: "⚙️ 시스템 설정",
        toggleInteraction: "👍 상호작용 버튼 활성화",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "es": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · Colección Local",
        bvSearch: "Buscar título o URL...",
        bvFolders: "📁 Carpetas",
        bvAllBookmarks: "Todos",
        bvUncategorized: "Sin categoría",
        bvTotal: "📊 Total",
        bvLike: "👍 Me gusta",
        bvDislike: "😤 No me gusta",
        bvSort: "Orden: Más recientes",
        bvSettings: "⚙️ Configuración del sistema",
        toggleInteraction: "👍 Habilitar botones de interacción",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "fr": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · Collection locale",
        bvSearch: "Rechercher titre ou URL...",
        bvFolders: "📁 Dossiers",
        bvAllBookmarks: "Tous les favoris",
        bvUncategorized: "Non classé",
        bvTotal: "📊 Total",
        bvLike: "👍 J'aime",
        bvDislike: "😤 Je n'aime pas",
        bvSort: "Trier: Plus récents",
        bvSettings: "⚙️ Paramètres du système",
        toggleInteraction: "👍 Activer les boutons d'interaction",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    },
    "de": {
        bvTitle: "Bookmark Vault",
        bvSubtitle: "V-Train Pro · Lokale Sammlung",
        bvSearch: "Titel oder URL suchen...",
        bvFolders: "📁 Ordner",
        bvAllBookmarks: "Alle Lesezeichen",
        bvUncategorized: "Nicht kategorisiert",
        bvTotal: "📊 Gesamt",
        bvLike: "👍 Mag ich",
        bvDislike: "😤 Mag ich nicht",
        bvSort: "Sortieren: Neueste",
        bvSettings: "⚙️ Systemeinstellungen",
        toggleInteraction: "👍 Interaktionsschaltflächen aktivieren",
        proOnly: "PRO",
        openVaultPro: "Bookmark Vault PRO"
    }
};

for (let lang in additions) {
    let strToAdd = '';
    for (let key in additions[lang]) {
        strToAdd += `            ${key}: "${additions[lang][key]}",\n`;
    }
    // Find the end of the content script keys for that language
    let regex = new RegExp(`("${lang}":\\s*\\{[\\s\\S]*?)(^\\s*\\},|\\s*\\};)`, 'm');
    code = code.replace(regex, (match, p1, p2) => {
        // Strip trailing comma from p1 if it exists before the brace
        return p1.replace(/,\s*$/, '') + ",\n\n            // === Vault & Advanced UI ===\n" + strToAdd.replace(/,\n$/, '\n') + p2;
    });
}

fs.writeFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', code);
console.log('I18N updated.');
