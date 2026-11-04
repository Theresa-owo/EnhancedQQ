const fs = require("node:fs");
const path = require("node:path");

function loadReactionCatalog(documentsPath) {
    if (!documentsPath) return [];
    const root = path.join(documentsPath, "Tencent Files", "nt_qq", "global", "nt_data", "Emoji", "emoji-resource");
    let config;
    try { config = JSON.parse(fs.readFileSync(path.join(root, "face_config.json"), "utf8")); }
    catch { return []; }
    const result = [], seen = new Set();
    for (const entry of Array.isArray(config?.emoji) ? config.emoji : []) {
        const id = String(entry?.QCid ?? ""), resource = String(entry?.AQLid ?? "");
        if (!/^\d{1,10}$/.test(id) || !/^\d{1,4}$/.test(resource) || seen.has(id)) continue;
        const image = path.join(root, "emoji_res", `emoji_${resource.padStart(3, "0")}.png`);
        try {
            if (fs.statSync(image).size > 512 * 1024) continue;
            const src = `data:image/png;base64,${fs.readFileSync(image).toString("base64")}`;
            const label = String(entry?.QDes || `表情 ${id}`).replace(/^\/+/, "").slice(0, 50);
            result.push({ id, label, src });
            seen.add(id);
        } catch { /* Missing local QQ resources are skipped. */ }
    }
    return result;
}

module.exports = { loadReactionCatalog };
