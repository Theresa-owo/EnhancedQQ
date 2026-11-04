export function normalizeBiliVideoUrl(value) {
    if (typeof value !== "string") return "";
    let input = value.trim();
    if (!input) return "";
    if (/^(?:www\.|m\.)?bilibili\.com\//i.test(input) || /^b23\.tv\//i.test(input)) input = `https://${input}`;
    let url;
    try { url = new URL(input); } catch { return ""; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    const host = url.hostname.toLowerCase();
    const video = (host === "bilibili.com" || host.endsWith(".bilibili.com")) && /^\/video\/(?:BV[a-z0-9]+|av\d+)(?:\/|$)/i.test(url.pathname);
    const short = host === "b23.tv" && /^\/[a-z0-9]+\/?$/i.test(url.pathname);
    return video || short ? url.href : "";
}

export function biliVideoFromRecord(record) {
    if (!Array.isArray(record?.elements)) return "";
    for (const element of record.elements) {
        const raw = element?.arkElement?.bytesData;
        let data;
        try {
            const text = ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw) : raw;
            data = typeof text === "string" ? JSON.parse(text) : text;
        } catch { continue; }
        if (!data || typeof data !== "object" || !/^com\.tencent\.miniapp(?:_|$)/i.test(String(data.app || ""))) continue;
        for (const meta of Object.values(data.meta || {})) {
            if (!meta || typeof meta !== "object") continue;
            for (const key of ["qqdocurl", "jumpUrl", "url"]) {
                const url = normalizeBiliVideoUrl(meta[key]);
                if (url) return url;
            }
        }
    }
    return "";
}
