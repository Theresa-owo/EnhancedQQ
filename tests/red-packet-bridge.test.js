import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

test("bridges received QQ messages and sends only reserved wallet calls", async () => {
    const ipc = new EventEmitter();
    const calls = [];
    let reserved = true;
    let sendStatus = 2;
    let sendResponse = { result: 0 };
    let nextAttrId = 100;
    let sentViaRelay = false;
    let allowRecall = true;
    const recalls = [];
    ipc.invoke = async (channel, key, extra) => {
        if (channel === "EnhancedQQ.getWebContentsId") return 12;
        if (channel === "EnhancedQQ.reserveRedPacket") return key === "packet" && reserved;
        if (channel === "EnhancedQQ.allowRedPacketAction") return key === "packet" && reserved;
        if (["EnhancedQQ.trackOutgoing", "EnhancedQQ.markOutgoingSent", "EnhancedQQ.untrackOutgoing"].includes(channel)) return true;
        if (channel === "EnhancedQQ.recallAutoText") {
            if (!allowRecall) throw new Error("自动撤回未获确认。");
            recalls.push({ peer: key, msgId: extra });
            return { result: 0 };
        }
        if (channel === "EnhancedQQ.encodeSpeech") return { file: "fixture.silk", md5: "abcdef", size: "123", duration: 2 };
        if (channel === "EnhancedQQ.copyVoiceCache" || channel === "EnhancedQQ.releaseVoice") return true;
        return null;
    };
    ipc.send = (channel, ...args) => {
        calls.push({ channel, args });
        if (!channel.startsWith("RM_IPCFROM_RENDERER")) return;
        const [meta, command] = args;
        const result = command.cmdName === "fetchAuthData" ? { data: { uin: "12345", nickName: "test" } }
            : command.cmdName === "nodeIKernelMsgService/grabRedBag" ? { grabRedBagRsp: { recvdOrder: { amount: "1" } } }
            : command.cmdName === "nodeIKernelMsgService/getRichMediaFilePathForGuild" ? "E:\\fixture.amr"
            : command.cmdName === "nodeIKernelMSFService/getServerTime" ? 1700000000
            : command.cmdName === "nodeIKernelMsgService/generateMsgUniqueId" ? String(nextAttrId++)
            : command.cmdName === "nodeIKernelMsgService/sendMsg" ? sendResponse : { result: 0 };
        queueMicrotask(() => {
            if (command.cmdName === "nodeIKernelMsgService/sendMsg" && sendStatus != null) {
                const attrId = command.payload[0].msgAttributeInfos.get(0).attrId;
                if (sentViaRelay) ipc.emit("EnhancedQQ.outgoingStatus", {}, { attrId, status: sendStatus === 2 ? "sent" : "failed", msgId: `sent-${attrId}` });
                else ipc.emit("RM_IPCFROM_MAIN12", {}, {}, { cmdName: "nodeIKernelMsgListener/onMsgInfoListUpdate", payload: { msgList: [{ msgId: `sent-${attrId}`, msgAttrs: { 0: { attrId } }, sendStatus }] } });
            }
            ipc.emit("RM_IPCFROM_MAIN12", {}, { callbackId: meta.callbackId }, result);
        });
    };
    let api;
    const electron = { ipcRenderer: ipc, contextBridge: { executeInMainWorld: () => false, exposeInMainWorld: (_name, value) => { api = value; } } };
    const file = fileURLToPath(new URL("../src/preload.js", import.meta.url));
    const nativeRequire = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, "utf8"), { require: name => name === "electron" ? electron : nativeRequire(name), crypto: webcrypto, setTimeout, clearTimeout, Promise, console });
    let received, source;
    api.onRedPacket((payload, eventSource) => { received = payload; source = eventSource; });
    await new Promise(resolve => setImmediate(resolve));
    ipc.emit("RM_IPCFROM_MAIN12", {}, {}, { cmdName: "nodeIKernelMsgListener/onRecvMsg", payload: { msgList: [{ msgId: "m1" }] } });
    assert.equal(received.msgList[0].msgId, "m1");
    assert.equal(source, "receive");
    ipc.emit("RM_IPCFROM_MAIN12", {}, {}, { cmdName: "nodeIKernelMsgListener/onMsgInfoListUpdate", payload: { msgList: [{ msgId: "pending", sendStatus: 1, msgSeq: "0" }, { msgId: "sent", sendStatus: 2, msgSeq: "9" }] } });
    assert.deepEqual(Array.from(received.msgList, item => item.msgId), ["sent"]);
    assert.equal(source, "update");
    ipc.emit("RM_IPCFROM_MAIN12", {}, {}, { cmdName: "nodeIKernelMsgListener/onMsgInfoListUpdate", payload: [{ msgId: "sent-again", sendStatus: 2, msgSeq: "10" }] });
    assert.equal(received.msgList[0].msgId, "sent-again");
    ipc.emit("EnhancedQQ.redPacketRecord", {}, { msgList: [{ msgId: "forwarded" }] });
    assert.equal(received.msgList[0].msgId, "forwarded");
    assert.equal(source, "forwarded");
    assert.equal((await api.getRedPacketAccount()).data.uin, "12345");
    assert.equal(await api.reserveRedPacket("packet", "lucky"), true);
    const result = await api.claimRedPacket("packet", { recvType: 2, peerUid: "group" }, "lucky");
    assert.equal(result.grabRedBagRsp.recvdOrder.amount, "1");
    const nativeCalls = calls.filter(item => item.channel === "RM_IPCFROM_RENDERER12");
    assert.deepEqual(nativeCalls.map(item => item.args[1].cmdName), ["fetchAuthData", "nodeIKernelMsgService/grabRedBag"]);
    assert.equal(nativeCalls[1].args[1].payload[0].grabRedBagReq.peerUid, "group");
    reserved = false;
    assert.equal(await api.claimRedPacket("packet", {}, "lucky"), null);
    assert.equal(calls.filter(item => item.channel === "RM_IPCFROM_RENDERER12").length, 2);
    const voiceId = await api.sendTtsVoice({ chatType: 2, peerUid: "group", guildId: "" }, new ArrayBuffer(8));
    assert.equal(voiceId, "sent-100");
    const voiceCall = calls.findLast(item => item.args?.[1]?.cmdName === "nodeIKernelMsgService/sendMsg");
    assert.equal(voiceCall.args[1].payload[0].msgElements[0].pttElement.md5HexStr, "abcdef");
    assert.equal(voiceCall.args[1].payload[0].peer.peerUid, "group");
    assert.equal(voiceCall.args[1].payload[0].msgId, "0");
    assert.equal(voiceCall.args[1].payload[0].msgAttributeInfos.get(0).attrId, "100");
    reserved = true;
    const peer = { chatType: 2, peerUid: "group", guildId: "" };
    sendResponse = {};
    sentViaRelay = true;
    const textId = await api.sendRedPacketText("packet", peer, "测试口令");
    assert.equal(textId, "sent-101");
    const textCall = calls.findLast(item => item.args?.[1]?.cmdName === "nodeIKernelMsgService/sendMsg");
    assert.equal(textCall.args[1].payload[0].msgElements[0].textElement.content, "测试口令");
    await api.recallRedPacketText(peer, textId);
    assert.equal(recalls[0].peer.peerUid, "group");
    assert.equal(recalls[0].msgId, textId);
    allowRecall = false;
    await assert.rejects(api.recallRedPacketText(peer, textId), /自动撤回未获确认/);
    sendStatus = 0;
    await assert.rejects(api.sendTtsVoice(peer, new ArrayBuffer(8)), /消息发送失败/);
    sendStatus = null;
    sendResponse = { result: -1 };
    await assert.rejects(api.sendTtsVoice(peer, new ArrayBuffer(8)), /代码 -1/);
});
