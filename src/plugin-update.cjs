const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { unzipSync } = require("fflate");

const RELEASES_URL = "https://github.com/Theresa-owo/EnhancedQQ/releases";
const API_URL = "https://api.github.com/repos/Theresa-owo/EnhancedQQ/releases/latest";
const MAX_ARCHIVE = 64 * 1024 * 1024;
const MAX_EXPANDED = 256 * 1024 * 1024;

function parseVersion(value) {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value));
    if (!match) return null;
    const numbers = match.slice(1, 4).map(Number);
    if (numbers.some(number => !Number.isSafeInteger(number))) return null;
    const prerelease = match[4] ? match[4].split(".") : [];
    if (prerelease.some(part => !part || (/^\d+$/.test(part) && part.length > 1 && part[0] === "0"))) return null;
    return { numbers, prerelease };
}

function compareVersions(left, right) {
    const a = parseVersion(left), b = parseVersion(right);
    if (!a || !b) throw new Error("版本号格式无效。");
    for (let i = 0; i < 3; i++) if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i] ? 1 : -1;
    if (!a.prerelease.length || !b.prerelease.length) return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1;
    for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
        const x = a.prerelease[i], y = b.prerelease[i];
        if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1;
        if (x === y) continue;
        const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
        if (xn && yn) return BigInt(x) > BigInt(y) ? 1 : -1;
        if (xn !== yn) return xn ? -1 : 1;
        return x > y ? 1 : -1;
    }
    return 0;
}

function releaseFromApi(value, currentVersion) {
    const tag = typeof value?.tag_name === "string" ? value.tag_name : "";
    if (!parseVersion(tag) || value?.draft || value?.prerelease) throw new Error("Release 版本号无效。");
    const releaseUrl = `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
    if (value.html_url !== releaseUrl) throw new Error("Release 地址无效。");
    const expectedAssetUrl = `${RELEASES_URL}/download/${encodeURIComponent(tag)}/EnhancedQQ.zip`;
    const asset = Array.isArray(value.assets) ? value.assets.find(item => item?.name === "EnhancedQQ.zip" && item.state === "uploaded" &&
        item.browser_download_url === expectedAssetUrl && /^sha256:[0-9a-f]{64}$/i.test(item.digest || "") &&
        Number.isSafeInteger(item.size) && item.size > 0 && item.size <= MAX_ARCHIVE) : null;
    return { tag, version: tag.replace(/^v/, ""), url: releaseUrl, newer: compareVersions(tag, currentVersion) > 0,
        asset: asset ? { url: asset.browser_download_url, digest: asset.digest.slice(7).toLowerCase(), size: asset.size } : null };
}

async function withTimeout(fetcher, url, timeout, consume) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    timer.unref?.();
    try {
        const response = await fetcher(url, { signal: controller.signal, headers: { "User-Agent": "EnhancedQQ-Update", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
        return await consume(response);
    } finally { clearTimeout(timer); }
}

async function readArchive(response, expectedSize) {
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）。`);
    const sizeHeader = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(sizeHeader) && sizeHeader > MAX_ARCHIVE) throw new Error("更新包过大。");
    let bytes;
    if (response.body?.getReader) {
        const reader = response.body.getReader(), parts = [];
        let length = 0;
        while (true) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > MAX_ARCHIVE) { await reader.cancel(); throw new Error("更新包过大。"); }
            parts.push(Buffer.from(part.value));
        }
        bytes = Buffer.concat(parts, length);
    } else bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== expectedSize || bytes.length > MAX_ARCHIVE) throw new Error("更新包大小不匹配。");
    return bytes;
}

function unpackRelease(bytes, target, expectedVersion) {
    let total = 0, count = 0;
    const files = unzipSync(bytes, { filter(entry) {
        const name = entry.name;
        if (name.includes("\\") || name.startsWith("/") || name.split("/").some(part => part === "." || part === "..") ||
            !/^(?:(?:src|assets|patches|node_modules)\/|manifest\.json$|package(?:-lock)?\.json$|README\.md$|LICENSE$)/.test(name)) throw new Error("更新包含无效路径。");
        if (++count > 20000 || !Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0 || (total += entry.originalSize) > MAX_EXPANDED) throw new Error("更新包内容过大。");
        return !name.endsWith("/");
    } });
    let manifest, packageInfo;
    try { manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString("utf8")); packageInfo = JSON.parse(Buffer.from(files["package.json"]).toString("utf8")); }
    catch { throw new Error("更新包缺少有效的插件信息。"); }
    if (manifest.slug !== "enhancedqq" || manifest.version !== expectedVersion || packageInfo.version !== expectedVersion ||
        !files["src/main.cjs"] || !files["src/preload.js"] || !files["src/renderer/index.js"]) throw new Error("更新包与 Release 版本不匹配。");
    for (const name of Object.keys(packageInfo.dependencies || {})) {
        if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) || !files[`node_modules/${name}/package.json`]) throw new Error("更新包缺少插件依赖。");
    }
    for (const [name, data] of Object.entries(files)) {
        const destination = path.join(target, ...name.split("/"));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, data);
    }
}

function acquireLock(lockPath) {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    try {
        const fd = fs.openSync(lockPath, "wx");
        fs.writeFileSync(fd, String(process.pid));
        fs.closeSync(fd);
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        throw new Error("另一个 QQ 正在安装 EnhancedQQ 更新。");
    }
    return () => { try { fs.unlinkSync(lockPath); } catch {} };
}

function createPluginUpdater({ fetcher, pluginDir, dataDir, currentVersion, onChange = () => {} }) {
    let state = { status: "idle", current: currentVersion, latest: "", checkedAt: null, installable: false, message: "" };
    let release = null, checkFlight = null, timer = null, autoCheck = false, stopped = false;
    const publish = patch => { state = { ...state, ...patch }; onChange(snapshot()); };
    function snapshot() { return { ...state, autoCheck }; }
    function schedule(delay) {
        clearTimeout(timer); timer = null;
        if (!autoCheck || stopped || state.status === "installed") return;
        timer = setTimeout(() => { timer = null; check(); }, delay);
        timer.unref?.();
    }
    function setAutoCheck(enabled) {
        const next = enabled !== false;
        if (next === autoCheck) return;
        autoCheck = next;
        schedule(state.checkedAt ? 12 * 60 * 60 * 1000 : 15000);
        onChange(snapshot());
    }
    async function check() {
        if (checkFlight) return checkFlight;
        if (["installing", "installed"].includes(state.status)) return snapshot();
        publish({ status: "checking", message: "" });
        checkFlight = (async () => {
            try {
                const result = await withTimeout(fetcher, API_URL, 15000, async response => {
                    if (response.status === 404) return null;
                    if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}。`);
                    return releaseFromApi(await response.json(), currentVersion);
                });
                release = result;
                publish({ status: !result ? "no-release" : result.newer ? "available" : "current", latest: result?.version || "", checkedAt: Date.now(), installable: Boolean(result?.newer && result.asset), message: "" });
            } catch (error) { release = null; publish({ status: "error", checkedAt: Date.now(), installable: false, message: error?.name === "AbortError" ? "连接超时。" : String(error?.message || "无法连接 GitHub。").slice(0, 160) }); }
            finally { checkFlight = null; schedule(12 * 60 * 60 * 1000); }
            return snapshot();
        })();
        return checkFlight;
    }
    async function install() {
        if (state.status !== "available" || !release?.newer || !release.asset) throw new Error("没有可安装的更新包。");
        const selected = release;
        const unlock = acquireLock(path.join(dataDir, "plugin-update.lock"));
        let stage = "", backup = "";
        publish({ status: "installing", message: "" });
        try {
            const bytes = await withTimeout(fetcher, selected.asset.url, 120000, response => readArchive(response, selected.asset.size));
            if (crypto.createHash("sha256").update(bytes).digest("hex") !== selected.asset.digest) throw new Error("更新包校验失败。");
            const profile = path.dirname(path.dirname(pluginDir));
            stage = fs.mkdtempSync(path.join(profile, ".enhancedqq-stage-"));
            unpackRelease(bytes, stage, selected.version);
            const installed = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));
            if (installed.slug !== "enhancedqq" || compareVersions(installed.version, selected.version) >= 0) throw new Error("插件目录已更新，请重启 QQ 后再检查。");
            backup = path.join(profile, `.enhancedqq-backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
            fs.renameSync(pluginDir, backup);
            try { fs.renameSync(stage, pluginDir); stage = ""; }
            catch (error) {
                try { fs.renameSync(backup, pluginDir); }
                catch { const savedStage = stage; stage = ""; throw new Error(`恢复插件目录失败：原版位于 ${backup}，新版位于 ${savedStage}。`); }
                throw error;
            }
            publish({ status: "installed", installable: false, message: "更新已安装，重启所有运行中的 QQ 后生效。" });
            clearTimeout(timer); timer = null;
        } catch (error) {
            publish({ status: "available", message: String(error?.message || "安装失败。").slice(0, 160) });
            throw error;
        } finally {
            if (stage) { try { fs.rmSync(stage, { recursive: true, force: true }); } catch {} }
            unlock();
        }
        return snapshot();
    }
    function releaseUrl() { return release?.url || RELEASES_URL; }
    function stop() { stopped = true; clearTimeout(timer); timer = null; }
    return { snapshot, setAutoCheck, check, install, releaseUrl, stop };
}

module.exports = { API_URL, RELEASES_URL, compareVersions, releaseFromApi, unpackRelease, createPluginUpdater };
