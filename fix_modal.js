const fs = require('fs');
let js = fs.readFileSync('popup.js', 'utf8');

const target = `const mWarning = document.getElementById('mWarning');
            if (showBuyLink && mBtnBuy) {
                mBtnBuy.classList.remove('hidden');
                if (mWarning) {
                    // [安全修復 #1] 翻譯字串來自信任的本地字典，但仍改用 textContent 以避免 innerHTML 使用
                    mWarning.textContent = getLangText(currentLang, 'buyWarning');
                    mWarning.classList.remove('hidden');
                }
            } else {
                if (mBtnBuy) mBtnBuy.classList.add('hidden');
                if (mWarning) mWarning.classList.add('hidden');
            }`;

const replace = `const mWarning = document.getElementById('mWarning');
            if (mWarning) mWarning.classList.add('hidden');
            const mBtnBuy = document.getElementById('mBtnBuy');
            if (mBtnBuy) mBtnBuy.classList.add('hidden');`;

if (js.includes(target)) {
    js = js.replace(target, replace);
} else {
    // try fallback regex
    js = js.replace(/const mWarning = document\.getElementById\('mWarning'\);[\s\S]*?if \(mWarning\) mWarning\.classList\.add\('hidden'\);\n\s*\}/, replace);
}

fs.writeFileSync('popup.js', js, 'utf8');
