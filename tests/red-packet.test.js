import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { findRedPacketAccount, redPacketRequests, installAutoRedPacket, processRedPacket, redPacketSettings, classifyRedPacket, redPacketOutcome } from "../src/renderer/red-packet.js";

const require = createRequire(import.meta.url);
const { createRedPacketGate } = require("../src/red-packet-gate.cjs");

test("distinguishes a wallet response from an actual receipt", () => {
    assert.deepEqual(redPacketOutcome({ grabRedBagRsp: { result: 0, recvdOrder: { amount: "5" } } }), { outcome: "positive", order: true, code: 0 });
    assert.deepEqual(redPacketOutcome({ grabRedBagRsp: { result: 0, recvdOrder: { amount: "0" } } }), { outcome: "zero", order: true, code: 0 });
    assert.deepEqual(redPacketOutcome({ grabRedBagRsp: { result: 0, recvdOrder: {} } }), { outcome: "unknown", order: true, code: 0 });
    assert.deepEqual(redPacketOutcome({ grabRedBagRsp: { result: -1 } }), { outcome: "rejected", order: false, code: -1 });
});

test("builds QQ wallet requests for every supported received message", () => {
    const account = findRedPacketAccount({ result: { data: { authData: { uin: "12345", nickName: "昵称" } } } });
    assert.equal(findRedPacketAccount({ data: { selfUin: "12345" } }).uin, "12345");
    const wallet = { billNo: "bill-a", pcBody: "body", receiver: { title: "祝福" }, stringIndex: "1", packetType: "lucky" };
    const payload = { msgList: [
        { peerUid: "group", chatType: 2, msgSeq: "7", elements: [{ elementType: 9, walletElement: wallet }] },
        { peerUid: "friend", chatType: 1, msgSeq: "8", elements: [{ elementType: 9, walletElement: { ...wallet, billNo: "bill-b" } }] },
        { peerUid: "group", chatType: 2, msgSeq: "9", elements: [{ elementType: 9, walletElement: { ...wallet, packetType: "", redChannel: 32 } }] },
        { peerUid: "group", chatType: 2, msgSeq: "10", elements: [{ elementType: 1 }] }
    ] };
    const requests = redPacketRequests(payload, account);
    assert.equal(requests.length, 3);
    assert.deepEqual(requests[0], { key: "group:bill-a:1", type: "lucky", challenge: "祝福", peer: { chatType: 2, peerUid: "group", guildId: "" }, request: { recvUin: "group", recvType: 2, peerUid: "group", name: "昵称", pcBody: "body", wishing: "祝福", msgSeq: "7", index: "1" } });
    assert.equal(requests[1].request.recvUin, "12345");
    assert.equal(requests[2].type, "text");
    assert.equal(classifyRedPacket({ redChannel: 99 }), null);
    assert.equal(classifyRedPacket({ receiver: { subTitle: "语音红包" } }), "voice");
    assert.equal(classifyRedPacket({ redChannel: 65536 }), "voice");
    assert.equal(classifyRedPacket({ redChannel: 1 }), "lucky");
    assert.equal(classifyRedPacket({ grapUin: ["12345"] }), "exclusive");
    assert.equal(redPacketRequests({ msgList: [{ peerUid: "group", chatType: 2, msgSeq: "11", elements: [{ elementType: 9, walletElement: { ...wallet, packetType: "", grapUin: ["99999"] } }] }] }, account).length, 0);
    assert.deepEqual(redPacketRequests(payload, null), []);
});

test("deduplicates across windows and does not reserve while disabled", () => {
    const gate = createRedPacketGate(2);
    assert.equal(gate.reserve("first", false), false);
    assert.equal(gate.reserve("first", true), true);
    assert.equal(gate.reserve("first", true), false);
    assert.equal(gate.reserve("second", true), true);
    assert.equal(gate.reserve("third", true), true);
    assert.equal(gate.reserve("first", true), true);
    gate.clear();
    assert.equal(gate.reserve("first", true), true);
    assert.equal(gate.reserve("owned", true, 12), true);
    assert.equal(gate.permitted("owned", true, 13), false);
    assert.equal(gate.permitted("owned", false, 12), false);
    assert.equal(gate.permitted("owned", true, 12, true), true);
    assert.equal(gate.permitted("owned", true, 12), false);
});

test("the live handler follows the switch and filters disabled packet types", async t => {
    const previous = { EnhancedQQ: globalThis.EnhancedQQ, LiteLoader: globalThis.LiteLoader };
    t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
    let receive, onState;
    const claims = [];
    globalThis.LiteLoader = { api: { config: { get: async () => ({ features: {} }) } } };
    globalThis.EnhancedQQ = { onState: callback => { onState = callback; }, onRedPacket: callback => { receive = callback; },
        getRedPacketAccount: async () => ({ uin: "12345", nickName: "me" }), reserveRedPacket: async () => true, claimRedPacket: async (...args) => { claims.push(args); } };
    installAutoRedPacket();
    await new Promise(resolve => setImmediate(resolve));
    const message = { peerUid: "group", chatType: 2, msgSeq: "7", elements: [{ elementType: 9, walletElement: { billNo: "bill", pcBody: "body", receiver: { title: "祝福" }, stringIndex: "1", packetType: "lucky" } }] };
    await receive({ msgList: [message] });
    assert.equal(claims.length, 0);
    onState({ autoRedPacket: { enabled: true, types: { lucky: true } } });
    await receive({ msgList: [message] });
    assert.equal(claims.length, 1);
    assert.equal(claims[0][1].peerUid, "group");
    const password = { ...message, elements: [{ elementType: 9, walletElement: { ...message.elements[0].walletElement, packetType: "", redChannel: 32 } }] };
    await receive({ msgList: [password] });
    assert.equal(claims.length, 1);
    onState({ autoRedPacket: { enabled: false } });
    await receive({ msgList: [message] });
    assert.equal(claims.length, 1);
});

test("uses the current account nickname for a packet sent by someone else", async t => {
    const previous = { EnhancedQQ: globalThis.EnhancedQQ, LiteLoader: globalThis.LiteLoader };
    t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
    let receive, onState, ownNickname = "my nickname", reservations = 0;
    const claims = [];
    globalThis.LiteLoader = { api: { config: { get: async () => ({ features: {} }) } } };
    globalThis.EnhancedQQ = { onState: callback => { onState = callback; }, onRedPacket: callback => { receive = callback; },
        getRedPacketAccount: async () => ({ uin: "12345", nickName: "" }), getSelfNickname: async () => ownNickname,
        reserveRedPacket: async () => { reservations += 1; return true; }, claimRedPacket: async (...args) => { claims.push(args); } };
    installAutoRedPacket();
    await new Promise(resolve => setImmediate(resolve));
    onState({ autoRedPacket: { enabled: true, types: { lucky: true } } });
    const message = { peerUid: "group", chatType: 2, msgSeq: "7", senderUid: "u_other", sendNickName: "other nickname",
        elements: [{ elementType: 9, walletElement: { billNo: "bill", pcBody: "body", receiver: { title: "祝福" }, stringIndex: "1", redChannel: 1 } }] };
    await receive({ msgList: [message] });
    assert.equal(claims[0][1].name, "my nickname");
    assert.equal(reservations, 1);
    ownNickname = "";
    await receive({ msgList: [{ ...message, msgSeq: "8" }] });
    assert.equal(claims.length, 1);
    assert.equal(reservations, 1);
});

test("text packets send the challenge and optionally recall it; voice requires a method", async () => {
    const actions = [];
    const bridge = { reserveRedPacket: async () => true, sendRedPacketText: async (_key, _peer, text) => { actions.push(`text:${text}`); return "m1"; },
        claimRedPacket: async () => { actions.push("claim"); }, recallRedPacketText: async (_peer, id) => { actions.push(`recall:${id}`); },
        sendRedPacketVoice: async () => { actions.push("voice"); } };
    const item = { key: "key", type: "text", challenge: "口令", peer: {}, request: {} };
    const settings = redPacketSettings({ features: { autoRedPacket: { enabled: true, types: { text: true, voice: true }, recallText: true } } });
    await processRedPacket(item, settings, "voice", bridge, async () => {});
    assert.deepEqual(actions, ["text:口令", "claim", "recall:m1"]);
    actions.length = 0;
    await processRedPacket({ ...item, type: "voice" }, settings, "voice", bridge, async () => {}, async () => new ArrayBuffer(2));
    assert.deepEqual(actions, []);
    settings.voiceTts = true;
    await processRedPacket({ ...item, type: "voice" }, settings, "voice", bridge, async () => {}, async () => new ArrayBuffer(2));
    assert.deepEqual(actions, ["voice", "claim"]);
    actions.length = 0;
    settings.voiceDirect = true;
    settings.voiceTts = false;
    await assert.rejects(processRedPacket({ ...item, type: "voice" }, settings, "voice", bridge), /验证接口尚未适配/);
    assert.deepEqual(actions, []);
});
