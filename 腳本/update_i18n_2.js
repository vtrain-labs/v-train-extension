const fs = require('fs');
let code = fs.readFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', 'utf8');

const additions = {
    "en": {
        bvEmptyTitle: "No Bookmarks Yet",
        bvEmptySub: "Click the ❤️ button while watching to start saving.",
        bvNewFolder: "New Folder",
        bvFolderName: "Folder Name",
        bvConfirmDelete: "Confirm Delete",
        bvAddSubFolder: "Add Subfolder",
        bvRename: "Rename",
        bvSortNewest: "Newest First",
        bvSortOldest: "Oldest First",
        bvSortTitle: "Title A-Z",
        bvSortDomain: "Domain"
    },
    "zh-TW": {
        bvEmptyTitle: "這裡還沒有收藏",
        bvEmptySub: "在影片播放時點擊 ❤️ 按鈕開始收藏",
        bvNewFolder: "新增資料夾",
        bvFolderName: "資料夾名稱",
        bvConfirmDelete: "確認刪除",
        bvAddSubFolder: "新增子資料夾",
        bvRename: "重新命名",
        bvSortNewest: "最新加入",
        bvSortOldest: "最早加入",
        bvSortTitle: "標題 A-Z",
        bvSortDomain: "網站"
    },
    "zh-CN": {
        bvEmptyTitle: "这里还没有收藏",
        bvEmptySub: "在影片播放时点击 ❤️ 按钮开始收藏",
        bvNewFolder: "新建文件夹",
        bvFolderName: "文件夹名称",
        bvConfirmDelete: "确认删除",
        bvAddSubFolder: "新建子文件夹",
        bvRename: "重命名",
        bvSortNewest: "最新加入",
        bvSortOldest: "最早加入",
        bvSortTitle: "标题 A-Z",
        bvSortDomain: "网站"
    },
    "ja": {
        bvEmptyTitle: "まだブックマークがありません",
        bvEmptySub: "再生中に ❤️ ボタンをクリックして保存を開始します。",
        bvNewFolder: "新規フォルダ",
        bvFolderName: "フォルダ名",
        bvConfirmDelete: "削除の確認",
        bvAddSubFolder: "サブフォルダを追加",
        bvRename: "名前を変更",
        bvSortNewest: "最新順",
        bvSortOldest: "古い順",
        bvSortTitle: "タイトル A-Z",
        bvSortDomain: "サイト"
    },
    "ko": {
        bvEmptyTitle: "아직 북마크가 없습니다",
        bvEmptySub: "재생 중 ❤️ 버튼을 클릭하여 저장을 시작하세요.",
        bvNewFolder: "새 폴더",
        bvFolderName: "폴더 이름",
        bvConfirmDelete: "삭제 확인",
        bvAddSubFolder: "하위 폴더 추가",
        bvRename: "이름 변경",
        bvSortNewest: "최신순",
        bvSortOldest: "오래된순",
        bvSortTitle: "제목 A-Z",
        bvSortDomain: "도메인"
    },
    "es": {
        bvEmptyTitle: "Aún no hay marcadores",
        bvEmptySub: "Haz clic en ❤️ durante la reproducción para guardar.",
        bvNewFolder: "Nueva carpeta",
        bvFolderName: "Nombre de la carpeta",
        bvConfirmDelete: "Confirmar eliminación",
        bvAddSubFolder: "Añadir subcarpeta",
        bvRename: "Renombrar",
        bvSortNewest: "Más recientes",
        bvSortOldest: "Más antiguos",
        bvSortTitle: "Título A-Z",
        bvSortDomain: "Dominio"
    },
    "fr": {
        bvEmptyTitle: "Aucun favori pour le moment",
        bvEmptySub: "Cliquez sur ❤️ pendant la lecture pour enregistrer.",
        bvNewFolder: "Nouveau dossier",
        bvFolderName: "Nom du dossier",
        bvConfirmDelete: "Confirmer la suppression",
        bvAddSubFolder: "Ajouter un sous-dossier",
        bvRename: "Renommer",
        bvSortNewest: "Plus récents",
        bvSortOldest: "Plus anciens",
        bvSortTitle: "Titre A-Z",
        bvSortDomain: "Domaine"
    },
    "de": {
        bvEmptyTitle: "Noch keine Lesezeichen",
        bvEmptySub: "Klicken Sie während der Wiedergabe auf ❤️, um zu speichern.",
        bvNewFolder: "Neuer Ordner",
        bvFolderName: "Ordnername",
        bvConfirmDelete: "Löschen bestätigen",
        bvAddSubFolder: "Unterordner hinzufügen",
        bvRename: "Umbenennen",
        bvSortNewest: "Neueste",
        bvSortOldest: "Älteste",
        bvSortTitle: "Titel A-Z",
        bvSortDomain: "Domäne"
    }
};

for (let lang in additions) {
    let strToAdd = '';
    for (let key in additions[lang]) {
        strToAdd += `            ${key}: "${additions[lang][key]}",\n`;
    }
    let regex = new RegExp(`("${lang}":\\s*\\{[\\s\\S]*?)(^\\s*\\},|\\s*\\};)`, 'm');
    code = code.replace(regex, (match, p1, p2) => {
        return p1.replace(/,\s*$/, '') + ",\n" + strToAdd.replace(/,\n$/, '\n') + p2;
    });
}

fs.writeFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', code);
console.log('I18N updated again.');
