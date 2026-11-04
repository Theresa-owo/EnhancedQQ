import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createOutgoingTracker, recordAttrId } = require("../src/outgoing-tracker.cjs");

test("routes a split QQ send confirmation only to its originating window", async () => {
    const events = [];
    const owner = { send: (channel, payload) => events.push({ channel, payload }), isDestroyed: () => false };
    const other = { send() {}, isDestroyed: () => false };
    const tracker = createOutgoingTracker();
    const peer = { chatType: 2, peerUid: "group", guildId: "" };
    assert.equal(tracker.watch("123", owner, "red-packet-text", peer), true);
    assert.equal(tracker.watch("123", other, "tts"), false);
    assert.equal(recordAttrId({ msgAttrs: new Map([["0", { attrId: "123" }]]) }), "123");
    tracker.observe({ msgId: "m1", sendStatus: 1, msgAttrs: new Map([[0, { attrId: "123" }]]) });
    tracker.observe({ msgId: "m1", sendStatus: 2 });
    await Promise.resolve();
    assert.deepEqual(events, [{ channel: "EnhancedQQ.outgoingStatus", payload: { attrId: "123", status: "sent", msgId: "m1" } }]);
    assert.equal(tracker.mark("123", owner, "m1"), true);
    assert.equal(tracker.consumeRecall("m1", other, peer), false);
    assert.equal(tracker.consumeRecall("m1", owner, { ...peer, peerUid: "different" }), false);
    assert.equal(tracker.consumeRecall("m1", owner, peer), true);
    assert.equal(tracker.consumeRecall("m1", owner, peer), false);
    assert.equal(tracker.unwatch("123", owner), true);
});

test("does not authorize automatic recall for ordinary TTS messages", () => {
    const owner = { send() {} };
    const tracker = createOutgoingTracker();
    assert.equal(tracker.watch("456", owner, "tts"), true);
    assert.equal(tracker.mark("456", owner, "m2"), true);
    assert.equal(tracker.consumeRecall("m2", owner), false);
    tracker.clear();
    assert.equal(tracker.mark("456", owner, "m2"), false);
});

test("accepts the same Electron window identity across wrapper objects", () => {
    const owner = { id: 12, send() {} };
    const sameWindow = { id: 12, send() {} };
    const tracker = createOutgoingTracker();
    const peer = { chatType: 1, peerUid: "u_me", guildId: "" };
    assert.equal(tracker.watch("789", owner, "red-packet-text", peer), true);
    assert.equal(tracker.mark("789", sameWindow, "m3"), true);
    assert.equal(tracker.consumeRecall("m3", sameWindow, peer), true);
});
