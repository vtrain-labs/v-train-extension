const fs = require('fs');
let js = fs.readFileSync('popup.js', 'utf8');

// Replace the entire if/else block for showBuyLink
let newLogic = `
            const mWarning = document.getElementById('mWarning');
            if (mWarning) mWarning.classList.add('hidden');
            const mBtnBuy = document.getElementById('mBtnBuy');
            if (mBtnBuy) mBtnBuy.classList.add('hidden');
`;

js = js.replace(/const mWarning = document\.getElementById\('mWarning'\);[\s\S]*?if \(mWarning\) mWarning\.classList\.add\('hidden'\);\n\s*\}/, newLogic.trim());

fs.writeFileSync('popup.js', js, 'utf8');
