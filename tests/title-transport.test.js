import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTitleTransport, SUPPORTED_WRAPPER_HASH } = require("../src/title-transport.cjs");

test("installs the title compatibility component only for the verified QQ binary", async () => {
    let loaded = 0, hashes = 0;
    const ensure = createTitleTransport({ platform: "win32", arch: "x64", getWrapperPath: () => "wrapper.node",
        hash: async file => { assert.equal(file, "wrapper.node"); hashes++; return SUPPORTED_WRAPPER_HASH; },
        loadNative: () => ({ install: () => { loaded++; return 0; } }) });
    await Promise.all([ensure(), ensure()]);
    await ensure();
    assert.equal(hashes, 1);
    assert.equal(loaded, 1);
});

test("does not load native code for an unsupported or unreadable QQ binary", async () => {
    let loaded = false;
    for (const hash of [async () => "different", async () => { throw new Error("unreadable"); }]) {
        const ensure = createTitleTransport({ platform: "win32", arch: "x64", hash, loadNative: () => { loaded = true; } });
        await assert.rejects(ensure(), /暂不支持|无法检查/);
    }
    assert.equal(loaded, false);
});

test("reports a native initialization error and permits retry", async () => {
    let count = 0;
    const ensure = createTitleTransport({ platform: "win32", arch: "x64", hash: async () => SUPPORTED_WRAPPER_HASH,
        loadNative: () => ({ install: () => ++count === 1 ? -2 : 0 }) });
    await assert.rejects(ensure(), /初始化失败/);
    await ensure();
    assert.equal(count, 2);
});
