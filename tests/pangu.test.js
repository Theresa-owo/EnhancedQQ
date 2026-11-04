import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { formatMessage, processRequest, installPanguHook } = require("../src/pangu.cjs");
const { createOutgoingTracker, recordAttrId } = require("../src/outgoing-tracker.cjs");
const text = (content, atType = 0) => ({ elementType: 1, textElement: { content, atType } });

test("uses the reference Pangu rules while preserving other message elements", () => {
    const mention = text("@测试Bot", 2);
    const picture = { elementType: 2, picElement: { fileName: "example.png" } };
    const original = { msgId: "0", peer: { peerUid: "friend" }, extra: "keep", msgElements: [text("你好Hello123世界,中文"), mention, picture, text("数字42个")], msgAttributeInfos: new Map() };
    const result = formatMessage(original);
    assert.equal(result.msgElements[0].textElement.content, "你好 Hello123 世界，中文");
    assert.equal(result.msgElements[3].textElement.content, "数字 42 个");
    assert.strictEqual(result.msgElements[1], mention);
    assert.strictEqual(result.msgElements[2], picture);
    assert.strictEqual(result.msgAttributeInfos, original.msgAttributeInfos);
    assert.equal(result.extra, "keep");
    assert.equal(original.msgElements[0].textElement.content, "你好Hello123世界,中文");
});

test("skips robot commands and removes the explicit skip prefix", () => {
    const slash = { msgElements: [text("/测试ABC")] };
    const at = { msgElements: [text("@Bot", 2), text(" /测试ABC")] };
    assert.strictEqual(formatMessage(slash), slash);
    assert.strictEqual(formatMessage(at), at);
    const skip = { msgElements: [text("!PanguSkip 中文ABC"), text("后续DEF")] };
    const result = formatMessage(skip);
    assert.equal(result.msgElements[0].textElement.content, "中文ABC");
    assert.equal(result.msgElements[1].textElement.content, "后续DEF");
    assert.equal(skip.msgElements[0].textElement.content, "!PanguSkip 中文ABC");
});

test("only formats enabled QQ sends and preserves automated red-packet passwords", () => {
    const tracker = createOutgoingTracker();
    const owner = { id: 7, send() {} };
    const peer = { chatType: 2, peerUid: "group", guildId: "" };
    tracker.watch("password-id", owner, "red-packet-text", peer);
    const protectedPassword = message => tracker.isPacketPassword(recordAttrId(message), owner);
    const password = { msgElements: [text("口令ABC")], msgAttributeInfos: new Map([[0, { attrId: "password-id" }]]) };
    const command = { cmdName: "nodeIKernelMsgService/sendMsg", payload: [password, null] };
    const header = { eventName: "ntApi" };
    assert.equal(processRequest(header, command, true, protectedPassword), false);
    assert.strictEqual(command.payload[0], password);
    const normal = { msgElements: [text("你好ABC")] };
    command.payload[0] = normal;
    assert.equal(processRequest(header, command, false), false);
    assert.strictEqual(command.payload[0], normal);
    assert.equal(processRequest({ eventName: "other" }, command, true), false);
    assert.equal(processRequest(header, command, true), true);
    assert.equal(command.payload[0].msgElements[0].textElement.content, "你好 ABC");
});

test("installs a window-scoped QQ IPC hook and removes it with the window", () => {
    const ipc = new EventEmitter();
    const contents = Object.assign(new EventEmitter(), { id: 24 });
    const window = { webContents: contents };
    const settings = { pangu: { enabled: true } };
    const delivered = [];
    ipc.on("RM_IPCFROM_RENDERER24", (_event, _header, command) => delivered.push(command.payload[0].msgElements[0].textElement.content));
    assert.equal(installPanguHook(ipc, window, () => settings, () => false), true);
    const send = (sender, content) => ipc.emit("RM_IPCFROM_RENDERER24", { sender }, { eventName: "ntApi" },
        { cmdName: "nodeIKernelMsgService/sendMsg", payload: [{ msgElements: [text(content)] }] });
    send(contents, "你好ABC");
    settings.pangu.enabled = false;
    send(contents, "你好ABC");
    settings.pangu.enabled = true;
    send({ id: 25 }, "你好ABC");
    assert.deepEqual(delivered, ["你好 ABC", "你好ABC", "你好ABC"]);
    contents.emit("destroyed");
    assert.equal(ipc.listenerCount("RM_IPCFROM_RENDERER24"), 1);
});
