const path = require("node:path");

function extractSelfNickname(value, uid, depth = 0, seen = new Set()) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return "";
    seen.add(value);
    if (typeof value.get === "function" && typeof value.has === "function") return extractSelfNickname(value.get(uid), uid, depth + 1, seen);
    const entryUid = value.uid ?? value.coreInfo?.uid;
    if (entryUid && String(entryUid) !== String(uid)) return "";
    for (const candidate of [value.coreInfo?.nick, value.nick, value.nickName, value.nickname]) {
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    for (const child of [value[uid], value.result, value.data, value.detail, value.value, value.simpleInfo, value.coreInfo]) {
        const nick = extractSelfNickname(child, uid, depth + 1, seen);
        if (nick) return nick;
    }
    return "";
}

async function querySelfNickname(uid, wrapper) {
    if (typeof uid !== "string" || !uid.startsWith("u_")) return "";
    const session = wrapper?.NodeIQQNTWrapperSession?.getNTWrapperSession?.("nt_1");
    const service = session?.getProfileService?.();
    if (typeof service?.fetchUserDetailInfo !== "function") return "";
    let timer;
    try {
        const result = await Promise.race([
            Promise.resolve(service.fetchUserDetailInfo("nodeStore", [uid], 1, [0])),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("profile-timeout")), 6000); })
        ]);
        return extractSelfNickname(result, uid);
    } finally { clearTimeout(timer); }
}

function getWrapper() {
    for (const [id, module] of Object.entries(require.cache)) {
        if (path.basename(id).toLowerCase() === "wrapper.node" && module?.exports?.NodeIQQNTWrapperSession) return module.exports;
    }
    return require(path.join(process.resourcesPath, "app", "wrapper.node"));
}

function createSelfNicknameResolver(getUid, getWrapperApi = getWrapper) {
    let account = "";
    let cached = "";
    let pending = null;
    function clear() { account = ""; cached = ""; pending = null; }
    async function get() {
        const uid = String(getUid() || "");
        if (!uid) return "";
        if (account !== uid) { account = uid; cached = ""; pending = null; }
        if (cached) return cached;
        if (!pending) {
            const task = Promise.resolve().then(() => querySelfNickname(uid, getWrapperApi())).catch(() => "");
            pending = task;
            task.then(name => { if (account === uid && pending === task) { cached = name; pending = null; } });
        }
        const name = await pending;
        return account === uid && String(getUid() || "") === uid ? name : "";
    }
    return { get, clear };
}

module.exports = { extractSelfNickname, querySelfNickname, createSelfNicknameResolver, getWrapper };
