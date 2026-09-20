const fs = require('fs');

let html = fs.readFileSync('popup.html', 'utf8');
if (!html.includes('btnFactoryResetLock')) {
    html = html.replace(/<p id="loginMsg" class="error-msg"><\/p>/, '<p id="loginMsg" class="error-msg"></p>\n        <p id="btnFactoryResetLock" style="margin-top: 15px; font-size: 12px; cursor: pointer; color: #888; text-decoration: underline;" data-i18n="forgotPassWipe">Forgot Passcode? (Wipe all data)</p>');
    fs.writeFileSync('popup.html', html, 'utf8');
}

let js = fs.readFileSync('popup.js', 'utf8');
if (!js.includes('btnFactoryResetLock')) {
    let jsInsert = `
    document.getElementById('btnFactoryResetLock').addEventListener('click', async () => {
        const confirm = await showModal(getLangText(currentLang, 'modalClearData'), getLangText(currentLang, 'modalClearDesc'));
        if (confirm) {
            chrome.storage.local.get(['userLang'], async (config) => {
                await window.vtDB.clearRecords();
                chrome.storage.local.clear(async () => {
                    const bookmarkKeys = await window.vtDB.getAllKeys('vt_bookmarks');
                    if(bookmarkKeys) {
                        for(const k of bookmarkKeys) await window.vtDB.delete('vt_bookmarks', k);
                    }
                    chrome.storage.local.set({ 
                        vt_video_count: 0, 
                        isProVersion: true,
                        userLang: config.userLang || 'zh-TW'
                    }, () => {
                        window.close();
                    });
                });
            });
        }
    });
`;
    js = js.replace(/const btnUnlock = document\.getElementById\('btnUnlock'\);/, "const btnUnlock = document.getElementById('btnUnlock');" + jsInsert);
    fs.writeFileSync('popup.js', js, 'utf8');
}

let i18n = fs.readFileSync('shared_i18n.js', 'utf8');
if (!i18n.includes('forgotPassWipe')) {
    i18n = i18n.replace(/msgCleared: "/g, 'forgotPassWipe: "Forgot Passcode? (Wipe all data)", msgCleared: "');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ 已清空數據"/, 'forgotPassWipe: "忘記密碼？(將清除所有資料)", msgCleared: "✨ 已清空數據"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ 清理完毕"/, 'forgotPassWipe: "忘記密碼？(將清除所有資料)", msgCleared: "✨ 清理完毕"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ 데이터 삭제됨"/, 'forgotPassWipe: "비밀번호를 잊으셨나요? (모든 데이터 지우기)", msgCleared: "✨ 데이터 삭제됨"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ Datos Borrados"/, 'forgotPassWipe: "¿Olvidaste la contraseña? (Borrar todos los datos)", msgCleared: "✨ Datos Borrados"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ Données effacées"/, 'forgotPassWipe: "Mot de passe oublié ? (Effacer toutes les données)", msgCleared: "✨ Données effacées"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ Daten gelöscht"/, 'forgotPassWipe: "Passwort vergessen? (Alle Daten löschen)", msgCleared: "✨ Daten gelöscht"');
    i18n = i18n.replace(/forgotPassWipe: "Forgot Passcode\? \(Wipe all data\)", msgCleared: "✨ すべてのデータを削除しました"/, 'forgotPassWipe: "パスワードを忘れましたか？(すべてのデータを消去)", msgCleared: "✨ すべてのデータを削除しました"');
    fs.writeFileSync('shared_i18n.js', i18n, 'utf8');
}
