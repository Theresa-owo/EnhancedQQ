import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";

test("sends both single and composite emoji as explicit Unicode reaction requests", async () => {
    const ipc = new EventEmitter(), sent = [];
    ipc.invoke = async name => name === "EnhancedQQ.getWebContentsId" ? 7 : name === "EnhancedQQ.allowReaction";
    ipc.send = (channel, ...args) => {
        if (!channel.startsWith("RM_IPCFROM_RENDERER")) return;
        const [header, command] = args; sent.push(command);
        queueMicrotask(() => ipc.emit("RM_IPCFROM_MAIN7", {}, { callbackId: header.callbackId, promiseStatus: "success" }, { result: 0 }));
    };
    let bridge;
    const contextBridge = { executeInMainWorld: () => false, exposeInMainWorld: (_name, value) => { bridge = value; } };
    vm.runInNewContext(fs.readFileSync(new URL("../src/preload.js", import.meta.url), "utf8"), {
        require: name => name === "electron" ? { ipcRenderer: ipc, contextBridge } : null,
        crypto: { randomUUID: () => "fixture-id" }, setTimeout, clearTimeout, console, Intl, queueMicrotask
    });
    const peer = { chatType: 2, peerUid: "12345678", guildId: "" };
    await bridge.sendReaction({ peer, msgSeq: "42", emojiId: "169", setEmoji: true });
    await bridge.sendReaction({ peer, msgSeq: "42", emojiId: "🏳️‍🌈", setEmoji: true });
    assert.equal(sent[0].payload[0].emojiType, "2");
    assert.equal(sent[1].payload[0].emojiId, "🏳️‍🌈");
    assert.equal(sent[1].payload[0].emojiType, "2");
    await assert.rejects(bridge.sendReaction({ peer, msgSeq: "42", emojiId: "普通文字", setEmoji: true }), /无法识别/);
});
