import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createPacketEventCollector } = require("../src/red-packet-events.cjs");

test("joins a newly sent wallet message to its later status update, excluding old messages", () => {
    const start = 2000000000000;
    const collector = createPacketEventCollector({ startedAt: start, now: () => start + 5000, ownUid: () => "u_me" });
    const wallet = { elementType: 9, walletElement: { redChannel: 1, pcBody: "body" } };
    const pending = { msgId: "m1", msgTime: "2000000001", senderUid: "u_me", chatType: 2, peerUid: "group", msgSeq: "0", sendStatus: 1, elements: [wallet] };
    assert.equal(collector.observe(pending), null);
    const completed = collector.observe({ msgId: "m1", msgSeq: "7", sendStatus: 2, elements: [] });
    assert.equal(completed.msgSeq, "7");
    assert.equal(completed.elements[0].walletElement.redChannel, 1);
    assert.equal(collector.observe({ ...pending, msgId: "old", msgTime: "1999999900", msgSeq: "9", sendStatus: 2 }), null);
    assert.equal(collector.observe({ ...pending, msgId: "other", elements: [] }), null);
    collector.clear();
    assert.equal(collector.observe({ msgId: "m1", msgSeq: "7", sendStatus: 2, elements: [] }), null);
});
