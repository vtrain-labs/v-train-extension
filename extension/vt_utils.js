// VT Utils - 安全工具函式模組
// 提供所有 VT content script 模組共用的 XSS 防護工具
// 無任何依賴，必須第一個注入

if (!window._vtUtilsLoaded) {
    window._vtUtilsLoaded = true;

    // [CWS 安全修復] HTML 安全轉義工具函式，防止 DOM-Based XSS
    // 對所有要插入 innerHTML 的外部變數（URL 擷取值、使用者輸入）強制跳脫
    window.escapeHtml = function(str) {
        if (typeof str !== 'string') return String(str ?? '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // [架構師重構] 使用 DOMParser 代替 innerHTML 進行多國語言注入
    window.safeInject = function(parent, htmlStr) {
        const p = new DOMParser();
        const d = p.parseFromString(htmlStr, 'text/html');
        parent.innerHTML = '';
        while (d.body.firstChild) parent.appendChild(d.body.firstChild);
    };

    // [CWS 安全修復] DOM 屬性值 URL 淨化器，防止 javascript:/data:/vbscript: 偽協議注入
    // 在所有將 DOM 屬性值（attr.value）傳入 URL 解析前，必須先經過此函式過濾
    window.sanitizeAttrAsUrl = function(val) {
        if (!val || typeof val !== 'string') return null;
        const trimmed = val.trim();
        // 阻擋 javascript:, data:, vbscript:, blob: 及 URL 編碼的偽協議（如 %6a%61%76%61%73%63%72%69%70%74 = javascript）
        if (/^\s*(javascript|data|vbscript|blob):/i.test(trimmed)) return null;
        if (/%6a%61%76%61%73%63%72%69%70%74/i.test(trimmed)) return null;
        return val;
    };
}
