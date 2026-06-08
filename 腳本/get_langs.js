const fs = require('fs');
const content = fs.readFileSync('shared_i18n.js', 'utf8');
const keys = [];
const lines = content.split('\n');
lines.forEach(l => {
    const m = l.match(/^\s*\"([a-zA-Z-]+)\":\s*\{\s*$/);
    if(m) keys.push(m[1]);
});
console.log(keys);
