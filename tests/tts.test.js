import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ttsSettings, peerFromAioData, currentPeer, clearSentComposer } from "../src/renderer/tts.js";

const require = createRequire(import.meta.url);
const { createTtsService } = require("../src/tts-service.cjs");

test("TTS keeps the send switch disabled by default and validates the configured voice", () => {
    assert.equal(ttsSettings({}).enabled, false);
    assert.equal(ttsSettings({}).voice, "zh-CN-XiaoxiaoNeural");
    assert.equal(ttsSettings({ features: { tts: { enabled: true, voice: "zh-CN-YunxiNeural" } } }).voice, "zh-CN-YunxiNeural");
    assert.equal(ttsSettings({ features: { tts: { voice: "invalid" } } }).voice, "zh-CN-XiaoxiaoNeural");
});

test("resolves the current QQ chat from its Vue AIO component and validates private IDs", () => {
    const group = { chatType: 2, peerUid: "123456", header: {} };
    const root = { __VUE__: [{ proxy: { commonAioStore: { curAioData: group } } }] };
    const doc = { querySelector: () => root, getElementById: () => null };
    assert.deepEqual(currentPeer({ closest: () => root }, doc), { chatType: 2, peerUid: "123456", guildId: "" });
    assert.deepEqual(peerFromAioData({ chatType: 1, header: { uid: "u_friend" } }), { chatType: 1, peerUid: "u_friend", guildId: "" });
    assert.deepEqual(peerFromAioData({ chatType: 1, header: { peer: { uid: "u_self" } } }), { chatType: 1, peerUid: "u_self", guildId: "" });
    assert.deepEqual(peerFromAioData({ type: 100, peer: { peerUid: "u_friend" } }), { chatType: 100, peerUid: "u_friend", guildId: "" });
    assert.equal(peerFromAioData({ chatType: 1, header: { uin: "123456" } }), null);
    assert.equal(peerFromAioData({ chatType: 2, peerUid: "0" }), null);
});

test("clears sent text through the editor model without overwriting newer input", () => {
    const actions = [];
    const state = { doc: { content: { size: 9 } }, tr: { delete: (from, to) => ({ from, to }) } };
    const view = { state, dispatch: transaction => { actions.push(transaction); } };
    const element = { isConnected: true, innerText: "测试文字", matches: () => true,
        __VUE__: [{ proxy: { getEditor: () => ({ editor: { view, schemaInstance: {} } }) } }] };
    assert.equal(clearSentComposer(element, "测试文字"), true);
    assert.deepEqual(actions, [{ from: 0, to: 9 }]);
    element.innerText = "测试文字和新内容";
    assert.equal(clearSentComposer(element, "测试文字"), false);
    assert.equal(actions.length, 1);
    element.innerText = "测试文字";
    element.__VUE__ = [];
    assert.equal(clearSentComposer(element, "测试文字"), false);
    assert.equal(element.innerText, "测试文字");
    let data;
    element.ckeditorInstance = { setData: value => { data = value; } };
    assert.equal(clearSentComposer(element, "测试文字"), true);
    assert.equal(data, "");
});

test("encodes PCM as QQ SILK and releases only the generated temporary file", async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "enhancedqq-tts-test-"));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const service = createTtsService(dir);
    const info = await service.encode(Buffer.alloc(24000 * 2));
    assert.ok(Number(info.size) > 0);
    assert.equal(info.duration, 1);
    assert.match(info.md5, /^[0-9a-f]{32}$/);
    assert.equal((await fs.stat(info.file)).size, Number(info.size));
    await service.release(info.file);
    await assert.rejects(fs.stat(info.file), { code: "ENOENT" });
});
