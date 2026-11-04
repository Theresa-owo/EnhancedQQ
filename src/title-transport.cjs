const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SUPPORTED_WRAPPER_HASH = "fed532ad58d2404dcedf2858554e8fa52a5f4e65b271c008d2faca4011d7d4a2";

function hashFile(file) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(file);
        stream.on("data", chunk => hash.update(chunk));
        stream.once("error", reject);
        stream.once("end", () => resolve(hash.digest("hex")));
    });
}

function createTitleTransport({ getWrapperPath, hash = hashFile, loadNative = () => require("./native/title-whitelist.node"),
    platform = process.platform, arch = process.arch } = {}) {
    let installed = false, pending = null;
    return async function ensureTitleTransport() {
        if (installed) return;
        if (pending) return pending;
        pending = (async () => {
            if (platform !== "win32" || arch !== "x64") throw new Error("当前系统暂不支持设置群头衔。");
            const wrapperPath = typeof getWrapperPath === "function" ? getWrapperPath() : path.join(process.resourcesPath || "", "app", "wrapper.node");
            let digest;
            try { digest = await hash(wrapperPath); }
            catch { throw new Error("无法检查当前 QQ 版本，暂不能设置群头衔。"); }
            if (String(digest).toLowerCase() !== SUPPORTED_WRAPPER_HASH) throw new Error("当前 QQ 版本暂不支持设置群头衔。");
            let status;
            try { status = loadNative().install(); }
            catch { throw new Error("无法加载群头衔兼容组件。"); }
            if (status !== 0) throw new Error("QQ 群头衔兼容组件初始化失败。");
            installed = true;
        })();
        try { await pending; }
        finally { pending = null; }
    };
}

module.exports = { createTitleTransport, hashFile, SUPPORTED_WRAPPER_HASH };
