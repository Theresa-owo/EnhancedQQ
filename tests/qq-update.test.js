import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { filterUpdateConfig, installUpdateConfigFilter, installHotUpdateGate } = require("../src/qq-update.cjs");

test("removes QQ update entries while retaining unrelated configuration and the original event", () => {
    const update = { releaseVersion: "9.9.99", lowestVersion: "9.9.0", jumpUrl: "https://example.test/update" };
    const other = { title: "unrelated", enabled: true };
    const event = { cmdName: "nodeIKernelUnitedConfigListener/onUnitedConfigUpdate", payload: { configData: { content: JSON.stringify([update, other]), code: 0 } } };
    const args = [{ type: "request" }, event];
    const result = filterUpdateConfig("RM_IPCFROM_MAIN2", args, true);
    assert.equal(result.changed, true);
    assert.deepEqual(JSON.parse(result.args[1].payload.configData.content), [other]);
    assert.deepEqual(JSON.parse(event.payload.configData.content), [update, other]);
    assert.strictEqual(filterUpdateConfig("RM_IPCFROM_MAIN2", args, false).args, args);
    assert.strictEqual(filterUpdateConfig("other", args, true).args, args);
    const unrelated = [{ payload: { configData: { content: "not-json" } } }];
    assert.strictEqual(filterUpdateConfig("RM_IPCFROM_MAIN2", unrelated, true).args, unrelated);
});

test("forwards filtered events through an existing webContents chain", () => {
    const received = [];
    const window = { webContents: { send: (channel, ...args) => { received.push({ channel, args }); return "sent"; } } };
    let enabled = true;
    assert.equal(installUpdateConfigFilter(window, () => enabled), true);
    const event = { payload: { configData: { content: JSON.stringify([{ releaseVersion: "1", lowestVersion: "0", jumpUrl: "u" }]) } } };
    assert.equal(window.webContents.send("RM_IPCFROM_MAIN2", event), "sent");
    assert.equal(received.at(-1).args[0].payload.configData.content, "[]");
    enabled = false;
    window.webContents.send("RM_IPCFROM_MAIN2", event);
    assert.strictEqual(received.at(-1).args[0], event);
});

test("blocks QQ HotUpdateApi download and installation actions while preserving unrelated IPC", async () => {
    const ipc = new EventEmitter();
    const delivered = [];
    const replies = [];
    const sender = { id: 8, isDestroyed: () => false, send: (...args) => replies.push(args) };
    ipc.on("RM_IPCFROM_RENDERER8", (_event, _header, command) => delivered.push(command.cmdName));
    let enabled = true;
    const blocked = [];
    assert.equal(installHotUpdateGate(ipc, () => enabled, action => blocked.push(action)), true);
    const send = (eventName, cmdName, callbackId = "test") => ipc.emit("RM_IPCFROM_RENDERER8", { sender }, { eventName, callbackId }, { cmdName, cmdType: "invoke", payload: [] });
    send("HotUpdateApi", "start");
    send("HotUpdateApi", "appInstallNextTime");
    send("HotUpdateApi", "appRelaunch");
    send("HotUpdateApi", "getUpdateStatus");
    send("other", "start");
    enabled = false;
    send("HotUpdateApi", "start");
    await Promise.resolve();
    assert.deepEqual(blocked, ["start", "appInstallNextTime", "appRelaunch"]);
    assert.deepEqual(delivered, ["getUpdateStatus", "start", "start"]);
    assert.equal(replies.length, 3);
    assert.equal(replies[0][0], "RM_IPCFROM_MAIN8");
    assert.equal(replies[0][1].promiseStatue, "fail");
    assert.equal(replies[0][2].result, -1);
});
