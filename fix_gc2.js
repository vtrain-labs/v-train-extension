const fs = require('fs');

let tw = fs.readFileSync('docs/guide/bookmark-vault.md', 'utf8');

// Replace the specific sentences containing PRO
tw = tw.replace(/\*\*無論你是免費版還是 PRO 版\*\*，/g, '');
tw = tw.replace(/::: info 免費版用戶也能享有這個保護[\s\S]*?設計原則。\n:::/g, 
    '::: info 核心設計原則\n書籤的防刪除保護是 V-Train 的核心機制。這確保了「你明確想保留的東西，絕對不會消失」，讓你安心收藏每一部重要影片。\n:::');

fs.writeFileSync('docs/guide/bookmark-vault.md', tw, 'utf8');

// Also do it for English just in case
let en = fs.readFileSync('docs/en/guide/bookmark-vault.md', 'utf8');
en = en.replace(/\*\*Whether you are a Free or Pro user\*\*, /gi, '');
en = en.replace(/::: info Free Users Also Get This Protection[\s\S]*?design principle.\n:::/gi, 
    '::: info Core Design Principle\nThis protection mechanism is a core part of V-Train. It ensures that "what you explicitly want to keep, will never disappear", allowing you to safely collect your favorite videos.\n:::');
fs.writeFileSync('docs/en/guide/bookmark-vault.md', en, 'utf8');
