import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import engineModule from "../src/recall-engine.cjs";
import storeModule from "../src/recall-store.cjs";
import hookModule from "../src/recall-hook.cjs";

const { createRecallEngine } = engineModule;
const { createRecallStore } = storeModule;
const { installRecallHook } = hookModule;
const channel = "RM_IPCFROM_MAIN42";
const wrap = records => [{ type: "request" }, { cmdName: "nodeIKernelMsgListener/onMsgInfoListUpdate", payload: { msgList: records } }];
const message = (id, senderUid = "u_friend", peerUid = "u_peer") => ({
    msgId: id, chatType: 1, peerUid, senderUid, msgSeq: "10", elements: [{ elementType: 1, textElement: { content: `text-${id}` } }]
});
const recalled = (id, peerUid = "u_peer", extra = {}) => ({
    msgId: id, chatType: 1, peerUid, msgSeq: "11", msgType: 5, subMsgType: 4,
    elements: [{ grayTipElement: { subElementType: 1, revokeElement: { isSelfOperate: false, ...extra } } }]
});
const list = result => result.args[1].payload.msgList;

test("restores another sender in mixed updates without mutating the original event", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    const original = message("a");
    engine.process(channel, wrap([original]), { enabled: true });
    const tip = recalled("a");
    const unrelated = message("b");
    const incoming = wrap([tip, unrelated]);
    const result = engine.process(channel, incoming, { enabled: true });
    assert.equal(result.changed, true);
    assert.equal(list(result)[0].elements[0].textElement.content, "text-a");
    assert.equal(list(result)[0].msgSeq, "11");
    assert.strictEqual(list(result)[1], unrelated);
    assert.strictEqual(incoming[1].payload.msgList[0], tip);
    assert.deepEqual(engine.markers(), [{ id: "a", self: false }]);
});

test("own recall is left alone by default, and restored only when enabled", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    engine.process(channel, [{ type: "request" }, { cmdName: "nodeIKernelMsgListener/onAddSendMsg", payload: { msgRecord: message("self", "u_me") } }], {});
    const event = wrap([recalled("self", "u_peer", { isSelfOperate: true })]);
    assert.equal(engine.process(channel, event, {}).changed, false);
    const result = engine.process(channel, event, { showOwn: true });
    assert.equal(list(result)[0].senderUid, "u_me");
    assert.deepEqual(engine.markers(), [{ id: "self", self: true }]);
});

test("automatic password recalls remain hidden without changing ordinary own recall protection", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("password", "u_me"), message("ordinary", "u_me")]), { showOwn: true });
    engine.exclude("password");
    const result = engine.process(channel, wrap([recalled("password", "u_peer", { isSelfOperate: true }), recalled("ordinary", "u_peer", { isSelfOperate: true })]), { showOwn: true });
    assert.ok(list(result)[0].elements[0].grayTipElement);
    assert.equal(list(result)[1].elements[0].textElement.content, "text-ordinary");
    assert.deepEqual(engine.markers(), [{ id: "ordinary", self: true }]);
});

test("sender identity wins over the operator flag for group moderation", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("group", "u_other")]), {});
    const result = engine.process(channel, wrap([recalled("group", "u_peer", { isSelfOperate: true })]), { showOwn: false });
    assert.equal(result.changed, true);
    assert.deepEqual(engine.markers(), [{ id: "group", self: false }]);
});

test("unknown senders, uncached messages, disabled feature and different peers pass through", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("known"), message("unknown", "")]), {});
    assert.equal(engine.process(channel, wrap([recalled("missing")]), {}).changed, false);
    assert.equal(engine.process(channel, wrap([recalled("unknown")]), { showOwn: true }).changed, false);
    assert.equal(engine.process(channel, wrap([recalled("known", "u_another")]), {}).changed, false);
    assert.equal(engine.process(channel, wrap([recalled("known")]), { enabled: false }).changed, false);
    assert.equal(engine.process("unrelated", wrap([recalled("known")]), {}).changed, false);
});

test("recovered messages persist across engine restarts and remain account isolated", t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "enhancedqq-recall-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const store = createRecallStore(directory);
    const first = createRecallEngine({ store });
    first.setAccount("u_me");
    const original = message("persist");
    original.msgMeta = new Map([["counter", 12n]]);
    first.process(channel, wrap([original]), {});
    assert.equal(first.process(channel, wrap([recalled("persist")]), {}).changed, true);
    const restarted = createRecallEngine({ store });
    restarted.setAccount("u_other");
    assert.equal(restarted.process(channel, wrap([recalled("persist")]), {}).changed, false);
    restarted.setAccount("u_me");
    const restored = list(restarted.process(channel, wrap([recalled("persist")]), {}))[0];
    assert.equal(restored.elements[0].textElement.content, "text-persist");
    assert.equal(restored.msgMeta.get("counter"), 12n);
    assert.equal(restarted.process(channel, wrap([{ msgId: "persist", chatType: 1, peerUid: "u_peer", elements: [] }]), {}).changed, true);
});

test("a storage failure does not suppress an otherwise recoverable message", () => {
    let failures = 0;
    const engine = createRecallEngine({ store: { load: () => null, save: () => false }, onStorageError: () => { failures += 1; } });
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("memory-only")]), {});
    assert.equal(engine.process(channel, wrap([recalled("memory-only")]), {}).changed, true);
    assert.equal(failures, 1);
});

test("turning protection off clears temporary candidates and forwards recalls unchanged", () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("before-off")]), {});
    engine.setEnabled(false);
    const tip = wrap([recalled("before-off")]);
    assert.equal(engine.process(channel, tip, { enabled: false }).changed, false);
    engine.setEnabled(true);
    assert.equal(engine.process(channel, tip, { enabled: true }).changed, false);
    engine.process(channel, wrap([message("after-on")]), { enabled: true });
    assert.equal(engine.process(channel, wrap([recalled("after-on")]), { enabled: true }).changed, true);
});

test("turning protection off does not erase messages recovered earlier", t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "enhancedqq-toggle-test-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const store = createRecallStore(directory);
    const engine = createRecallEngine({ store });
    engine.setAccount("u_me");
    engine.process(channel, wrap([message("saved")]), {});
    assert.equal(engine.process(channel, wrap([recalled("saved")]), {}).changed, true);
    engine.setEnabled(false);
    assert.equal(engine.process(channel, wrap([recalled("saved")]), { enabled: false }).changed, false);
    engine.setEnabled(true);
    assert.equal(engine.process(channel, wrap([recalled("saved")]), { enabled: true }).changed, true);
    const restarted = createRecallEngine({ store });
    restarted.setAccount("u_me");
    assert.equal(restarted.process(channel, wrap([recalled("saved")]), {}).changed, true);
});

test("window hook preserves the existing send chain and forwards unrelated events", async () => {
    const engine = createRecallEngine();
    engine.setAccount("u_me");
    const calls = [];
    let notices = 0;
    const webContents = { send(channelName, ...args) { calls.push({ self: this, channelName, args }); return "original-result"; } };
    installRecallHook({ webContents }, engine, () => ({ showOwn: false }), () => { notices += 1; });
    assert.equal(webContents.send("different-channel", "payload"), "original-result");
    webContents.send(channel, ...wrap([message("hook")]));
    webContents.send(channel, ...wrap([recalled("hook")]));
    await Promise.resolve();
    assert.strictEqual(calls[0].self, webContents);
    assert.equal(calls[0].channelName, "different-channel");
    assert.equal(calls[2].args[1].payload.msgList[0].elements[0].textElement.content, "text-hook");
    assert.equal(notices, 1);
});
