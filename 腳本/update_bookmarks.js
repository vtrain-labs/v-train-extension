const fs = require('fs');
let content = fs.readFileSync('bookmarks.js', 'utf8');

// Replacements

// 358: countText.textContent = `${directCount} 部影片`;
content = content.replace(/countText\.textContent = \`\$\{directCount\} 部影片\`;/g, 
    "countText.textContent = getLang('bvVideoCount', '{num} 部影片').replace('{num}', directCount);");

// 495: jumpInput.title = '輸入頁碼後按 Enter 跳轉';
content = content.replace(/jumpInput\.title = '輸入頁碼後按 Enter 跳轉';/g,
    "jumpInput.title = getLang('bvJumpHint', '輸入頁碼後按 Enter 跳轉');");

// 737: `刪除「${folderName}」？`,
content = content.replace(/\`刪除「\$\{folderName\}」？\`/g,
    "getLang('bvDelFolderConfirm', '刪除「{name}」？').replace('{name}', folderName)");

// 738: '此資料夾內的書籤將移至「未分類」，子資料夾也會一併刪除。',
content = content.replace(/'此資料夾內的書籤將移至「未分類」，子資料夾也會一併刪除。'/g,
    "getLang('bvDelFolderDesc', '此資料夾內的書籤將移至「未分類」，子資料夾也會一併刪除。')");

// 762: showToast('🗑 資料夾已刪除');
content = content.replace(/showToast\('🗑 資料夾已刪除'\);/g,
    "showToast(getLang('bvToastFolderDel', '🗑 資料夾已刪除'));");

// 779: showToast('🗑 書籤已刪除');
content = content.replace(/showToast\('🗑 書籤已刪除'\);/g,
    "showToast(getLang('bvToastBookmarkDel', '🗑 書籤已刪除'));");

// 831: htitle.textContent = '🗂 移動書籤';
content = content.replace(/htitle\.textContent = '🗂 移動書籤';/g,
    "htitle.textContent = getLang('bvMoveTitle', '🗂 移動書籤');");

// 846: cancelBtn.textContent = '取消';
content = content.replace(/cancelBtn\.textContent = '取消';/g,
    "cancelBtn.textContent = getLang('btnCancel', '取消');");

// 851: confirmBtn.textContent = '確認移動';
content = content.replace(/confirmBtn\.textContent = '確認移動';/g,
    "confirmBtn.textContent = getLang('bvBtnMove', '確認移動');");

// 860: showToast('✅ 書籤已移動');
content = content.replace(/showToast\('✅ 書籤已移動'\);/g,
    "showToast(getLang('bvToastMoved', '✅ 書籤已移動'));");

fs.writeFileSync('bookmarks.js', content, 'utf8');
console.log('bookmarks.js updated!');
