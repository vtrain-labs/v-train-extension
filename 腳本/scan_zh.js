const fs = require('fs');
function scanFile(filePath) {
    if (filePath.includes('shared_i18n.js')) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let found = [];
    lines.forEach((line, idx) => {
        if (line.trim().startsWith('//')) return;
        if (/[\u4e00-\u9fa5]/.test(line)) {
            if (/['"\`].*[\u4e00-\u9fa5].*['"\`]/.test(line) || filePath.endsWith('.html')) {
                found.push({line: idx + 1, text: line.trim()});
            }
        }
    });
    if (found.length > 0) {
        console.log('--- ' + filePath + ' ---');
        found.forEach(f => console.log(f.line + ': ' + f.text));
    }
}
const files = fs.readdirSync('.').filter(f => f.endsWith('.js') || f.endsWith('.html'));
files.forEach(scanFile);
