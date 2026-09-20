const fs = require('fs');

// TW FAQ
let tw = fs.readFileSync('docs/guide/faq.md', 'utf8');

let qPassTw = /### Q：我忘記自己設定的密碼了！[\s\S]*?密碼重置。/g;
let newQPassTw = '### Q：我忘記自己設定的密碼了！\n\n基於最高層級的隱私安全原則，V-Train **沒有任何後門**可以找回密碼。\n如果您忘記了，唯一的解決辦法是在密碼輸入畫面點擊「**忘記密碼？(將清除所有資料)**」。這會立刻重置擴充功能，並銷毀所有的觀看紀錄與書籤。請務必牢記您的密碼！';
tw = tw.replace(qPassTw, newQPassTw);

let qLimitTw = /### Q：為什麼有些影片的進度條消失了？（免費版限制）[\s\S]*?建議定期備份。/g;
tw = tw.replace(qLimitTw, '');

let proKeyTw = /唯一的網路請求是 Pro 版授權序號驗證.*/g;
tw = tw.replace(proKeyTw, 'V-Train 完全在本地離線運作，沒有任何網路請求。');

fs.writeFileSync('docs/guide/faq.md', tw, 'utf8');

// EN FAQ
let en = fs.readFileSync('docs/en/guide/faq.md', 'utf8');

let qPassEn = /### Q: I forgot my passcode![\s\S]*?The passcode is removed\./g;
let newQPassEn = '### Q: I forgot my passcode!\n\nFor maximum privacy, V-Train has **no backdoors** to recover a passcode. If you forget it, your only option is to click "**Forgot Passcode? (Wipe all data)**" on the lock screen. This will instantly factory reset the extension and permanently destroy all your viewing records and bookmarks. Please remember your passcode!';
en = en.replace(qPassEn, newQPassEn);

let qLimitEn = /### Q: Why did the progress bars for some videos disappear\? \(Free Version Limit\)[\s\S]*?back up your data regularly\./g;
en = en.replace(qLimitEn, '');

let proKeyEn = /We only check your Pro License Key online.*/g;
en = en.replace(proKeyEn, 'V-Train works 100% locally offline with zero network requests.');

fs.writeFileSync('docs/en/guide/faq.md', en, 'utf8');
