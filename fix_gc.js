const fs = require('fs');

let tw = fs.readFileSync('docs/guide/bookmark-vault.md', 'utf8');
tw = tw.replace('## 10. 免費版保護：書籤永不被 GC 刪除 🛡️', '## 10. 永久保存：書籤的防刪除保護 🛡️');
tw = tw.replace('**無論你是免費版還是 PRO 版**，只要一部影片被加入書籤，V-Train 就會對該筆觀看紀錄資料標記「受保護」。', '只要一部影片被加入書籤，V-Train 就會對該筆觀看紀錄資料標記「受保護」。');
tw = tw.replace(/::: info 免費版用戶也能享有這項保護[\s\S]*?設計原則。\n:::/, '::: info 核心設計原則\n書籤的防刪除保護是 V-Train 的核心機制。這確保了「你明確想保留的東西，絕對不會消失」，讓你安心收藏每一部重要影片。\n:::');
fs.writeFileSync('docs/guide/bookmark-vault.md', tw, 'utf8');

let en = fs.readFileSync('docs/en/guide/bookmark-vault.md', 'utf8');
en = en.replace('## 10. Free Version Protection: Bookmarks Survive GC 🛡️', '## 10. Permanent Storage: Anti-Deletion Protection 🛡️');
en = en.replace('**Whether you are a Free or Pro user**, as long as a video is bookmarked, V-Train marks its record as "Protected".', 'As long as a video is bookmarked, V-Train marks its record as "Protected".');
en = en.replace(/::: info Free Users Also Get This Protection[\s\S]*?design principle.\n:::/, '::: info Core Design Principle\nThis protection mechanism is a core part of V-Train. It ensures that "what you explicitly want to keep, will never disappear", allowing you to safely collect your favorite videos.\n:::');
fs.writeFileSync('docs/en/guide/bookmark-vault.md', en, 'utf8');
