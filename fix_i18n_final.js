const fs = require('fs');

let js = fs.readFileSync('shared_i18n.js', 'utf8');

// 1. Fix modalSetPassDesc to have the large warning for all languages
const twWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 警告：若忘記密碼，唯一的解決方法是「清除所有資料」。請謹慎設定。</span>";
const cnWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 警告：若忘记密码，唯一的解决方法是“清除所有数据”。请谨慎设置。</span>";
const enWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Warning: If you forget your passcode, the only way to recover is to WIPE ALL DATA.</span>";
const krWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 경고: 비밀번호를 잊어버리면 데이터를 모두 지우는 것 외에 복구할 방법이 없습니다.</span>";
const jpWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 警告: パスワードを忘れた場合、すべてのデータを消去するしか回復方法はありません。</span>";
const esWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Advertencia: Si olvida su contraseña, la única forma de recuperarse es BORRAR TODOS LOS DATOS.</span>";
const frWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Attention : Si vous oubliez votre mot de passe, le seul moyen de le récupérer est d'EFFACER TOUTES LES DONNÉES.</span>";
const deWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Warnung: Wenn Sie Ihr Passwort vergessen, können Sie es nur durch LÖSCHEN ALLER DATEN wiederherstellen.</span>";

// Remove old warnings first to avoid duplication
js = js.replace(/<br><br><span style='color:#ff4444;font-size:12px;'>.*?<\/span>/g, "");
js = js.replace(/<br><br><span style='color:#ff4444; font-weight:bold;'>.*?<\/span>/g, "");

// Re-inject the correct warnings (using regex to match the exact localized strings)
js = js.replace(/(modalSetPassDesc:\s*"Set a new passcode \(leave blank to remove lock\)\.)"/, `$1${enWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"設定新密碼 \(留空則移除鎖定\)。)"/, `$1${twWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"设置新密码 \(留空则移除锁定\)。)"/, `$1${cnWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"새 비밀번호 설정 \(비워두면 잠금 해제\)\.)"/, `$1${krWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"新しいパスワードを設定 \(空の場合はロック解除\)。)"/, `$1${jpWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"Establecer nuevo codigo \(vacio para eliminar\)\.)"/, `$1${esWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"Definir un nouveau code \(laisser vide pour supprimer\)\.)"/, `$1${frWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"Neuen Passcode setzen \(leer lassen zum Entfernen\)\.)"/, `$1${deWarning}"`);


// 2. Fix modalClearDesc to remove "Pro status"
js = js.replace(/<br>\(Pro status and settings will be preserved\)/g, '<br>(Settings will be preserved)');
js = js.replace(/<br>\(Pro資格與設定將會保留\)/g, '<br>(設定將會保留)');
js = js.replace(/<br>\(Pro资格与设置将会保留\)/g, '<br>(设置将会保留)');
js = js.replace(/<br>\(Pro 상태와 설정은 유지됩니다\)/g, '<br>(설정은 유지됩니다)');
js = js.replace(/<br>\(Proのステータスと設定は保持されます\)/g, '<br>(設定は保持されます)');
js = js.replace(/<br>\(El estado Pro y ajustes se conservaran\)/g, '<br>(Los ajustes se conservarán)');
js = js.replace(/<br>\(Le statut Pro et les parametres seront conserves\)/g, '<br>(Les paramètres seront conservés)');
js = js.replace(/<br>\(Pro-Status und Einstellungen bleiben erhalten\)/g, '<br>(Einstellungen bleiben erhalten)');

fs.writeFileSync('shared_i18n.js', js, 'utf8');
