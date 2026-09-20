const fs = require('fs');
let js = fs.readFileSync('popup.js', 'utf8');

let startIndex = js.indexOf("const mWarning = document.getElementById('mWarning');");
let endIndex = js.indexOf("modal.classList.add('show');");

if (startIndex !== -1 && endIndex !== -1) {
    let before = js.substring(0, startIndex);
    let after = js.substring(endIndex);
    let newLogic = `const mWarning = document.getElementById('mWarning');
            if (mWarning) mWarning.classList.add('hidden');
            const mBtnBuy = document.getElementById('mBtnBuy');
            if (mBtnBuy) mBtnBuy.classList.add('hidden');\n\n            `;
    
    fs.writeFileSync('popup.js', before + newLogic + after, 'utf8');
} else {
    console.log("Could not find start or end index");
}
