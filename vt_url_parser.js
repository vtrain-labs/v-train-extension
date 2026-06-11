// VT URL Parser - URL 規則偵測與 ID 提取引擎
// 負責所有 URL 解析邏輯，零 DOM 操作，純函式設計
// 依賴：vt_utils.js（sanitizeAttrAsUrl）

if (!window._vtUrlParserLoaded) {
    window._vtUrlParserLoaded = true;

    window.getBaseDomain = function(h) {
        let pts = h.replace(/^(www\.|m\.|cn\.)/i, "").split(".");
        if (
            pts.length >= 3 &&
            ["com", "co", "net", "org", "edu", "gov"].includes(
                pts[pts.length - 2].toLowerCase(),
            )
        )
            return pts[pts.length - 3].toLowerCase();
        return pts.length >= 2
            ? pts[pts.length - 2].toLowerCase()
            : pts[0].toLowerCase();
    };

    function detectSeparator(raw, target) {
        for (let sep of ["-", "_", ".", "+"]) {
            let pts = raw.split(sep);
            if (pts.findIndex((p) => p === target) !== -1)
                return { sep, sepIdx: pts.findIndex((p) => p === target) - pts.length };
        }
        return null;
    }

    // [強化] CWS 審查級別的 ID 校驗器 (純粹位置提取，僅保留 XSS 與垃圾字串防禦)
    function validateIdByGuard(id, guard) {
        if (!id || typeof id !== 'string') return false;

        // 1. 強制攔截：封殺所有潛在的腳本注入關鍵字 (XSS 防禦)
        const lowerId = id.toLowerCase();
        const dangerKeys = ['javascript:', 'data:', '<script', 'onerror=', 'onclick='];
        if (dangerKeys.some(key => lowerId.includes(key))) {
            return false;
        }

        // 2. 嚴格拒絕包含網址結構的垃圾字串 (移除 '=' 攔截以支援 Base64 ID)
        if (/^[/?&]/.test(id) || /[?&]/.test(id)) return false;

        // 3. 完全移除長度與 Regex 特徵鎖，實現真正的 100% Adaptive 位置提取
        return true; 
    }

    function detectFlank(raw, target) {
        const pos = raw.indexOf(target);
        if (pos === -1) return null;
        const left = pos > 0 ? raw.slice(0, pos) : null,
            right =
                pos + target.length < raw.length
                    ? raw.slice(pos + target.length)
                    : null;
        if (!left && !right) return null;
        return {
            left,
            right,
            guard: { isPositional: true }
        };
    }

    window.autoDetectUrlRule = function(playerUrl, targetId) {
        const _detect = () => {
            try {
                const u = new URL(playerUrl, window.location.origin);
                const highPriorityKeys = ["v", "id", "vid", "viewkey", "video_id", "key"];
                for (let k of highPriorityKeys) {
                const v = u.searchParams.get(k);
                if (v === targetId) return { type: "q", key: k };
                if (v && v.includes(targetId)) {
                    let r = detectSeparator(v, targetId);
                    if (r) return { type: "q", key: k, sep: r.sep, sepIdx: r.sepIdx };
                }
            }
            for (let [k, v] of u.searchParams) {
                if (!highPriorityKeys.includes(k) && v === targetId)
                    return { type: "q", key: k };
                if (v && v.includes(targetId)) {
                    let r = detectSeparator(v, targetId);
                    if (r) return { type: "q", key: k, sep: r.sep, sepIdx: r.sepIdx };
                }
            }
            // [架構師升級] URL 中文還原器：確保 Hash 與 Path 內的 %E4 亂碼能被還原成純文字比對
            let hashRaw = u.hash.replace(/^#\/?/, "");
            try { hashRaw = decodeURIComponent(hashRaw); } catch(e) {}

            if (hashRaw) {
                if (hashRaw === targetId) return { type: "hash" };
                if (hashRaw.includes("/")) {
                    const hashSegs = hashRaw.split("/").filter((x) => x);
                    for (let i = 0; i < hashSegs.length; i++) {
                        if (hashSegs[i] === targetId)
                            return {
                                type: "hash_path",
                                idx: i - hashSegs.length,
                                guard: {
                                    minLen: Math.max(2, targetId.length - 3),
                                    maxLen: targetId.length + 20,
                                },
                            };
                    }
                }
                if (hashRaw.includes(targetId)) {
                    let r = detectSeparator(hashRaw, targetId);
                    if (r) return { type: "hash", sep: r.sep, sepIdx: r.sepIdx };
                }
            }

            let segs = u.pathname.split("/").filter((x) => x);
            try { segs = segs.map(s => decodeURIComponent(s)); } catch(e) {}

            for (let i = 0; i < segs.length; i++) {
                if (segs[i] === targetId) return { type: "p", idx: i - segs.length };
                if (segs[i] && segs[i].includes(targetId)) {
                    const flank = detectFlank(segs[i], targetId);
                    if (flank) {
                        if (!flank.right || !flank.left) {
                            let r = detectSeparator(segs[i], targetId);
                            if (r)
                                return {
                                    type: "p",
                                    idx: i - segs.length,
                                    sep: r.sep,
                                    sepIdx: r.sepIdx,
                                };
                            return { type: "p", idx: i - segs.length };
                        }
                        return {
                            type: "flank",
                            seg_idx: i - segs.length,
                            left: flank.left,
                            right: flank.right,
                            fallback_idx: i - segs.length,
                            guard: flank.guard,
                        };
                    }
                    let r = detectSeparator(segs[i], targetId);
                    if (r)
                        return {
                            type: "p",
                            idx: i - segs.length,
                            sep: r.sep,
                            sepIdx: r.sepIdx,
                        };
                }
            }
        } catch (e) { }
        return null;
        };

        let rule = _detect();
        if (rule && !rule.guard) {
            // [極致優化] 訓練階段：不再綁定任何 ID 格式與長度限制，100% 信任 DOM 位置提取
            rule.guard = { isPositional: true };
        }
        return rule;
    };

    window.extractIdByUrlRule = function(urlStr, rule) {
        try {
            const u = new URL(urlStr, window.location.origin);
            let raw = null;
            if (rule.type === "q") raw = u.searchParams.get(rule.key);
            else if (rule.type === "hash") raw = u.hash.replace(/^#\/?/, "");
            else if (rule.type === "hash_path") {
                const hashSegs = u.hash
                    .replace(/^#\/?/, "")
                    .split("/")
                    .filter((x) => x);
                const tIdx = rule.idx < 0 ? hashSegs.length + rule.idx : rule.idx;
                // [修正] 檢查索引是否在合法範圍內
                if (tIdx < 0 || tIdx >= hashSegs.length) return null;
                raw = hashSegs[tIdx] || null;
                if (raw && !validateIdByGuard(raw, rule.guard)) raw = null;
                return raw;
            } else if (rule.type === "p") {
                const segs = u.pathname.split("/").filter((x) => x);
                const tIdx = rule.idx < 0 ? segs.length + rule.idx : rule.idx;
                // [修正] 檢查索引是否在合法範圍內
                if (tIdx < 0 || tIdx >= segs.length) return null;
                raw = segs[tIdx] || null;
            } else if (rule.type === "flank") {
                const segs = u.pathname.split("/").filter((x) => x);
                const sIdx =
                    rule.seg_idx < 0 ? segs.length + rule.seg_idx : rule.seg_idx;
                const seg = segs[Math.max(0, Math.min(sIdx, segs.length - 1))] || "";
                let ex = null;
                if (seg) {
                    let start = 0,
                        end = seg.length;
                    if (rule.left && seg.includes(rule.left))
                        start = seg.indexOf(rule.left) + rule.left.length;
                    if (rule.right && seg.includes(rule.right)) {
                        const rPos = seg.lastIndexOf(rule.right);
                        if (rPos > start) end = rPos;
                    }
                    const cand = seg.slice(start, end);
                    if (cand && validateIdByGuard(cand, rule.guard)) ex = cand;
                }
                if (!ex && rule.fallback_idx !== undefined) {
                    const fbIdx =
                        rule.fallback_idx < 0
                            ? segs.length + rule.fallback_idx
                            : rule.fallback_idx;
                    const fbSeg =
                        segs[Math.max(0, Math.min(fbIdx, segs.length - 1))] || null;
                    if (fbSeg && validateIdByGuard(fbSeg, rule.guard)) ex = fbSeg;
                }
                return ex;
            }
            if (raw && rule.sep) {
                let pts;
                if (raw.includes(rule.sep)) {
                    pts = raw.split(rule.sep);
                } else {
                    // 容錯機制：部分網站(如 Xvideos)在播放頁使用 '.'，但縮圖使用 '-'
                    // 當找不到原本的分割符時，退而求其次使用通用分割符進行切割
                    pts = raw.split(/[\-\_\.\+]/);
                }
                let sIdx = rule.sepIdx < 0 ? pts.length + rule.sepIdx : rule.sepIdx;
                raw = pts[Math.max(0, Math.min(sIdx, pts.length - 1))] || raw;
            }

            // [架構師升級] URL 中文還原器：將 %E4%B8%AD 等編碼還原為純文字，確保安檢門的「字數長度」判定正確
            if (raw) {
                try { raw = decodeURIComponent(raw); } catch (e) {}
            }

            // [架構師修復] 強制防護：若提取出的字串不符合長度或格式安檢，直接退件，迫使觸發下一個模組降級尋找
            if (raw && !validateIdByGuard(raw, rule.guard)) return null;

            return raw;
        } catch (e) {
            return null;
        }
    };

    window.deepScanForId = function(rootEl, urlRule, targetId = "") {
        // [架構師重構] 徹底廢除所有「猜測」與「降級」邏輯。
        // 核心流程：遍歷 DOM 屬性 ➡️ 套用 URL 規則提取 ➡️ 若有 targetId 則執行「真理比對」。

        const performSearch = (el) => {
            if (!el || !el.attributes) return null;
            for (let attr of el.attributes) {
                if (!attr.value || attr.value.length < 1) continue;

                // [CWS 安全修復] 問題 2：屬性值傳入 URL 解析前，強制過濾 javascript:/data: 偽協議
                const safeVal = sanitizeAttrAsUrl(attr.value);
                if (!safeVal) continue;
                // 為了讓 URL 規則能正確執行，我們模擬完整的網址格式進行提取
                let testValue = safeVal.startsWith('http') || safeVal.startsWith('/') ? safeVal : `https://x.com/v/${safeVal}`;
                
                // [架構師修復] 如果處於訓練模式 (有 targetId)，且屬性值裡面直接包含目標 ID
                // 這代表縮圖的網址結構可能跟播放頁不同，我們應該即時動態生成針對縮圖的專屬規則 (tRule) 來提取
                let activeRule = urlRule;
                if (targetId && safeVal.toLowerCase().includes(targetId.toLowerCase())) {
                    let tempRule = autoDetectUrlRule(testValue, targetId);
                    if (tempRule) activeRule = tempRule;
                }

                let extracted = extractIdByUrlRule(testValue, activeRule);

                if (extracted) {
                    // [真理比對] 如果存在 targetId (訓練模式)，則必須完全匹配才算找到位置
                    if (targetId) {
                        if (extracted.toLowerCase() === targetId.toLowerCase()) return extracted;
                    } else {
                        // 日常監控模式 (Runtime)：只要符合規則就返回
                        return extracted;
                    }
                }
            }
            return null;
        };

        // 優先級 1：向上遍歷父節點（通常穩定的 ID 規則都藏在外層容器或連結上）
        let anc = rootEl;
        for (let i = 0; i < 8 && anc; i++, anc = anc.parentElement) {
            let res = performSearch(anc);
            if (res) return res;
        }

        // 優先級 2：向下遍歷子節點（處理 data-屬性 藏在內部的特殊結構）
        const allEls = [rootEl, ...rootEl.querySelectorAll('*')];
        for (let el of allEls) {
            let res = performSearch(el);
            if (res) return res;
        }

        return null;
    };
}
