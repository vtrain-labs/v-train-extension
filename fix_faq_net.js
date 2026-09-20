const fs = require('fs');

// TW
let tw = fs.readFileSync('docs/guide/faq.md', 'utf8');
tw = tw.replace(/- 唯一的網路請求是 Pro 版\*\*授權序號驗證\*\*（僅傳送序號本身，不包含任何個人資料）/g, 
    '- V-Train 核心功能完全在本地端離線運作。未來若推出需要連線的雲端社群功能（例如：全球熱區分享），也絕對會採取「用戶自願開啟（Opt-in）」機制，絕不偷偷上傳。');
fs.writeFileSync('docs/guide/faq.md', tw, 'utf8');

// EN
let en = fs.readFileSync('docs/en/guide/faq.md', 'utf8');
en = en.replace(/- We only check your Pro \*\*License Key\*\* online\. We do not send your personal data\./g, 
    '- The core features of V-Train work completely offline locally. In the future, any cloud features (like global heatmaps) will be strictly "Opt-in". We will never secretly upload data.');
fs.writeFileSync('docs/en/guide/faq.md', en, 'utf8');
