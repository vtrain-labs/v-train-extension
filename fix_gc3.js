const fs = require('fs');

function cleansePRO(file) {
    let txt = fs.readFileSync(file, 'utf8');
    
    // Cleanse specific sentences
    txt = txt.replace(/PRO 功能：/g, '核心功能：');
    txt = txt.replace(/是 V-Train PRO 最直覺的/g, '是 V-Train 最直覺的');
    txt = txt.replace(/is one of the most intuitive features of V-Train PRO/gi, 'is one of the most intuitive features of V-Train');
    txt = txt.replace(/::: info PRO 功能說明[\s\S]*?資料會完整保留。\n:::/g, '');
    txt = txt.replace(/::: info PRO Feature[\s\S]*?will be preserved.\n:::/g, '');
    txt = txt.replace(/書籤的 GC 保護不是 PRO 專屬。即使是免費版，你收藏的書籤也會受到保護。這是 V-Train 確保「你明確想保留的東西，絕對不會消失」的設計原則。/g, 
        '書籤的防刪除保護是 V-Train 的核心機制。這確保了「你明確想保留的東西，絕對不會消失」，讓你安心收藏每一部重要影片。');
    txt = txt.replace(/The GC protection for bookmarks is not a PRO exclusive. Even in the free version, your bookmarked videos are protected. This is V-Train's design principle to ensure that "what you explicitly want to keep, will never disappear"./gi,
        'This protection mechanism is a core part of V-Train. It ensures that "what you explicitly want to keep, will never disappear", allowing you to safely collect your favorite videos.');
    txt = txt.replace(/免費版用戶也能享有這個保護/g, '核心設計原則');
    txt = txt.replace(/Free Users Also Get This Protection/gi, 'Core Design Principle');
    
    // Cleanse remaining generic PRO and Free mentions
    txt = txt.replace(/PRO/g, '');
    txt = txt.replace(/免費版/g, '');
    txt = txt.replace(/Free version/gi, 'version');
    
    fs.writeFileSync(file, txt, 'utf8');
}

cleansePRO('docs/guide/bookmark-vault.md');
cleansePRO('docs/en/guide/bookmark-vault.md');
