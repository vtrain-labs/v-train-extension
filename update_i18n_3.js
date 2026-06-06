const fs = require('fs');
let code = fs.readFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', 'utf8');

const replacements = {
    "zh-TW": "本機書籤庫",
    "zh-CN": "本地书签库",
    "ja": "ローカルブックマーク",
    "ko": "로컬 북마크",
    "es": "Bóveda de Marcadores",
    "fr": "Coffre aux Signets",
    "de": "Lesezeichen-Tresor"
};

for (let lang in replacements) {
    const newVal = replacements[lang];
    const regex = new RegExp(`("${lang}":\\s*\\{[\\s\\S]*?bvTitle:\\s*)"Bookmark Vault"`, 'g');
    code = code.replace(regex, `$1"${newVal}"`);
}

fs.writeFileSync('D:\\\\UDATA\\\\Kevin\\\\Desktop\\\\VT\\\\shared_i18n.js', code);
console.log('bvTitle translations updated.');
