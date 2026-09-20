const fs = require('fs');

let js = fs.readFileSync('shared_i18n.js', 'utf8');

const krWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 경고: 비밀번호를 잊어버리면 데이터를 모두 지우는 것 외에 복구할 방법이 없습니다.</span>";
const jpWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ 警告: パスワードを忘れた場合、すべてのデータを消去するしか回復方法はありません。</span>";
const esWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Advertencia: Si olvida su contraseña, la única forma de recuperarse es BORRAR TODOS LOS DATOS.</span>";
const frWarning = "<br><br><span style='color:#ff4444; font-weight:bold;'>⚠️ Attention : Si vous oubliez votre mot de passe, le seul moyen de le récupérer est d'EFFACER TOUTES LES DONNÉES.</span>";

js = js.replace(/(modalSetPassDesc:\s*"新しいパスコードを設定 \(空欄でロック解除\)。)"/, `$1${jpWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"새 비밀번호 설정 \(잠금을 해제하려면 비워 두세요\)\.)"/, `$1${krWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"Establecer nuevo código \(vacío para eliminar\)\.)"/, `$1${esWarning}"`);
js = js.replace(/(modalSetPassDesc:\s*"Définir un nouveau code \(laisser vide pour supprimer\)\.)"/, `$1${frWarning}"`);

fs.writeFileSync('shared_i18n.js', js, 'utf8');
