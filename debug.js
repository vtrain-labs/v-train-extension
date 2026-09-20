const fs = require('fs');
const txt = fs.readFileSync('shared_i18n.js', 'utf8');
const match = txt.match(/modalSetPassDesc:\s*".*?"/g);
console.log(match);
