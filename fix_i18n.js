const fs = require('fs');
let txt = fs.readFileSync('shared_i18n.js', 'utf8');

txt = txt.replace(/modalSetPassDesc: "Set a new passcode \(leave blank to remove lock\)\.",/, 
    'modalSetPassDesc: "Set a new passcode (leave blank to remove lock).<br><br><span style=\'color:#ff4444;font-size:12px;\'>⚠️ Warning: If you forget your passcode, the only way to recover is to WIPE ALL DATA.</span>",');

txt = txt.replace(/modalSetPassDesc: "設定新密碼 \(留空則移除鎖定\)。",/, 
    'modalSetPassDesc: "設定新密碼 (留空則移除鎖定)。<br><br><span style=\'color:#ff4444;font-size:12px;\'>⚠️ 警告：若忘記密碼，唯一的解決方法是「清除所有資料」。請謹慎設定。</span>",');

fs.writeFileSync('shared_i18n.js', txt, 'utf8');
