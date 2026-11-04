import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { zipSync, strToU8 } from "fflate";

const require = createRequire(import.meta.url);
const { compareVersions, releaseFromApi, createPluginUpdater } = require("../src/plugin-update.cjs");
const url = "https://github.com/Theresa-owo/EnhancedQQ/releases";
const file = value => strToU8(typeof value === "string" ? value : JSON.stringify(value));
function archive(extra = {}) {
    return Buffer.from(zipSync({ "manifest.json": file({ slug: "enhancedqq", version: "0.9.6" }), "package.json": file({ version: "0.9.6", dependencies: {} }),
        "src/main.cjs": file("main"), "src/preload.js": file("preload"), "src/renderer/index.js": file("renderer"), ...extra }));
}
function release(bytes) {
    return { tag_name: "v0.9.6", html_url: `${url}/tag/v0.9.6`, draft: false, prerelease: false,
        assets: [{ name: "EnhancedQQ.zip", state: "uploaded", browser_download_url: `${url}/download/v0.9.6/EnhancedQQ.zip`,
            digest: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`, size: bytes.length }] };
}
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "enhancedqq-release-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const pluginDir = path.join(root, "plugins", "enhancedqq"), dataDir = path.join(root, "data", "enhancedqq");
    fs.mkdirSync(pluginDir, { recursive: true }); fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, "manifest.json"), JSON.stringify({ slug: "enhancedqq", version: "0.9.5" }));
    fs.writeFileSync(path.join(pluginDir, "old.txt"), "original");
    fs.writeFileSync(path.join(dataDir, "config.json"), "user settings");
    return { root, pluginDir, dataDir };
}
function fetcherFor(bytes, metadata = release(bytes)) {
    return async request => request.endsWith("/latest") ? { status: 200, ok: true, json: async () => metadata } :
        { status: 200, ok: true, headers: { get: () => null }, arrayBuffer: async () => bytes };
}

test("compares stable and prerelease versions and only accepts repository release assets", () => {
    assert.equal(compareVersions("v0.10.0", "0.9.9"), 1);
    assert.equal(compareVersions("v1.0.0-rc.2", "1.0.0"), -1);
    assert.equal(compareVersions("v1.0.0-rc.10", "1.0.0-rc.2"), 1);
    assert.equal(compareVersions("1.0.0+abc", "v1.0.0"), 0);
    assert.throws(() => compareVersions("latest", "0.9.5"));
    const value = release(archive());
    assert.equal(releaseFromApi(value, "0.9.5").newer, true);
    value.assets[0].browser_download_url = "https://example.test/EnhancedQQ.zip";
    assert.equal(releaseFromApi(value, "0.9.5").asset, null);
    value.html_url = "https://example.test/";
    assert.throws(() => releaseFromApi(value, "0.9.5"));
});

test("reports an unpublished release and an HTTP failure without changing the plugin", async t => {
    const where = fixture(t);
    let status = 404;
    const updater = createPluginUpdater({ ...where, currentVersion: "0.9.5", fetcher: async () => ({ ok: false, status }) });
    assert.equal((await updater.check()).status, "no-release");
    status = 503;
    assert.equal((await updater.check()).status, "error");
    assert.equal(fs.readFileSync(path.join(where.pluginDir, "old.txt"), "utf8"), "original");
    updater.stop();
});

test("installs a verified release and keeps both the old plugin and user settings", async t => {
    const where = fixture(t), bytes = archive();
    const updater = createPluginUpdater({ ...where, currentVersion: "0.9.5", fetcher: fetcherFor(bytes) });
    const result = await updater.check();
    assert.equal(result.status, "available");
    assert.equal(result.installable, true);
    assert.equal((await updater.install()).status, "installed");
    assert.equal(JSON.parse(fs.readFileSync(path.join(where.pluginDir, "manifest.json"))).version, "0.9.6");
    const backup = fs.readdirSync(where.root).find(name => name.startsWith(".enhancedqq-backup-"));
    assert.equal(fs.readFileSync(path.join(where.root, backup, "old.txt"), "utf8"), "original");
    assert.equal(fs.readFileSync(path.join(where.dataDir, "config.json"), "utf8"), "user settings");
    assert.equal(fs.existsSync(path.join(where.dataDir, "plugin-update.lock")), false);
    updater.stop();
});

test("rejects corrupt or path-traversing archives before changing the installed plugin", async t => {
    const where = fixture(t), bytes = archive({ "src/../../escape.txt": file("bad") });
    const updater = createPluginUpdater({ ...where, currentVersion: "0.9.5", fetcher: fetcherFor(bytes) });
    await updater.check();
    await assert.rejects(updater.install(), /无效路径/);
    assert.equal(fs.readFileSync(path.join(where.pluginDir, "old.txt"), "utf8"), "original");
    assert.equal(fs.existsSync(path.join(where.root, "escape.txt")), false);
    assert.equal(fs.existsSync(path.join(where.dataDir, "plugin-update.lock")), false);
    updater.stop();
});

test("rejects an archive whose digest differs from the GitHub release metadata", async t => {
    const where = fixture(t), bytes = archive(), metadata = release(bytes);
    metadata.assets[0].digest = `sha256:${"0".repeat(64)}`;
    const updater = createPluginUpdater({ ...where, currentVersion: "0.9.5", fetcher: fetcherFor(bytes, metadata) });
    await updater.check();
    await assert.rejects(updater.install(), /校验失败/);
    assert.equal(fs.readFileSync(path.join(where.pluginDir, "old.txt"), "utf8"), "original");
    assert.equal(fs.existsSync(path.join(where.dataDir, "plugin-update.lock")), false);
    updater.stop();
});
