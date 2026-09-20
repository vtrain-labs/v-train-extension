const fs = require('fs');

let js = fs.readFileSync('shared_i18n.js', 'utf8');

// The generic warning template (English fallback for other languages)
const enWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ Warning: If you forget your passcode, the only way to recover is to WIPE ALL DATA.</span>";
const twWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ 警告：若忘記密碼，唯一的解決方法是「清除所有資料」。請謹慎設定。</span>";
const cnWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ 警告：若忘记密码，唯一的解决方法是“清除所有数据”。请谨慎设置。</span>";
const krWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ 경고: 비밀번호를 잊어버리면 데이터를 모두 지우는 것 외에 복구할 방법이 없습니다.</span>";
const jpWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ 警告: パスワードを忘れた場合、すべてのデータを消去するしか回復方法はありません。</span>";
const esWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ Advertencia: Si olvida su contraseña, la única forma de recuperarse es BORRAR TODOS LOS DATOS.</span>";
const frWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ Attention : Si vous oubliez votre mot de passe, le seul moyen de le récupérer est d'EFFACER TOUTES LES DONNÉES.</span>";
const deWarning = "<br><br><span style='color:#ff4444;font-size:12px;'>⚠️ Warnung: Wenn Sie Ihr Passwort vergessen, können Sie es nur durch LÖSCHEN ALLER DATEN wiederherstellen.</span>";

// Apply replacements
function addWarning(regex, warningText) {
    let match = regex.exec(js);
    if (match && !match[0].includes('color:#ff4444')) {
        let replacement = match[0].replace(').",', `).${warningText}",`);
        js = js.replace(match[0], replacement);
    }
}

// These are already done in my previous script, but let's check
// (We already replaced EN and TW manually, but CN, KR, JP, ES, FR, DE are untouched)

// 简体中文
js = js.replace(/modalSetPassDesc: "设置新密码 \(留空则移除锁定\)。",/, 
    `modalSetPassDesc: "设置新密码 (留空则移除锁定)。${cnWarning}",`);

// 韓文
js = js.replace(/modalSetPassDesc: "새 비밀번호 설정 \(비워두면 잠금 해제\)\.",/, 
    `modalSetPassDesc: "새 비밀번호 설정 (비워두면 잠금 해제).${krWarning}",`);
    
// 日文
js = js.replace(/modalSetPassDesc: "新しいパスワードを設定 \(空の場合はロック解除\)。",/, 
    `modalSetPassDesc: "新しいパスワードを設定 (空の場合はロック解除)。${jpWarning}",`);

// 西班牙文
js = js.replace(/modalSetPassDesc: "Establecer nuevo codigo \(vacio para eliminar\)\.",/, 
    `modalSetPassDesc: "Establecer nuevo codigo (vacio para eliminar).${esWarning}",`);

// 法文
js = js.replace(/modalSetPassDesc: "Definir un nouveau code \(laisser vide pour supprimer\)\.",/, 
    `modalSetPassDesc: "Definir un nouveau code (laisser vide pour supprimer).${frWarning}",`);

// 德文
js = js.replace(/modalSetPassDesc: "Neuen Passcode setzen \(leer lassen zum Entfernen\)\.",/, 
    `modalSetPassDesc: "Neuen Passcode setzen (leer lassen zum Entfernen).${deWarning}",`);


fs.writeFileSync('shared_i18n.js', js, 'utf8');
