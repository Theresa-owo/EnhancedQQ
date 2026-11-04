import test from "node:test";
import assert from "node:assert/strict";
import { runReactionBurst } from "../src/renderer/reaction-burst.js";

const context = record => ({ peer: { chatType: 2, peerUid: "12345678", guildId: "" }, msgSeq: "42", record });

test("single mode counts an add and removal as one cycle and spaces requests", async () => {
    const requests = [], delays = [], progress = [];
    const result = await runReactionBurst({ context: context({ emojiLikesList: [] }), mode: "single", emojiId: "128049", count: 2, intervalMs: 1500,
        send: async value => { requests.push(value); }, wait: async ms => { delays.push(ms); }, onProgress: done => progress.push(done) });
    assert.deepEqual(requests.map(value => value.setEmoji), [true, false, true, false]);
    assert.deepEqual(delays, [1500, 1500, 1500]);
    assert.deepEqual(progress, [1, 2]);
    assert.equal(result.completed, 2);
});

test("single mode restores an existing reaction and stops cleanly", async () => {
    const requests = [], controller = new AbortController();
    await assert.rejects(runReactionBurst({ context: context({ emojiLikesList: [] }), mode: "single", emojiId: "128049", count: 4, intervalMs: 500,
        signal: controller.signal, send: async value => { requests.push(value.setEmoji); if (requests.length === 1) controller.abort(); }, wait: async () => {} }), /已停止/);
    assert.deepEqual(requests, [true, false]);
    const existing = [];
    await runReactionBurst({ context: context({ emojiLikesList: [{ emojiId: "128049", isClicked: "1" }] }), mode: "single", emojiId: "128049", count: 1, intervalMs: 500,
        send: async value => { existing.push(value.setEmoji); }, wait: async () => {} });
    assert.deepEqual(existing, [false, true, false, true]);
});

test("random mode adds different not-yet-selected reactions and stops on error", async () => {
    const requests = [];
    const result = await runReactionBurst({ context: context({ emojiLikesList: [{ emojiId: "3", isClicked: true }] }), mode: "random", count: 2, intervalMs: 500,
        pool: ["1", "2", "3", "u:🏳️‍🌈", "2"], random: () => 0, send: async value => { requests.push(value); }, wait: async () => {} });
    assert.equal(result.completed, 2);
    assert.deepEqual(new Set(requests.map(value => value.emojiId)), new Set(["1", "2"]));
    assert.ok(requests.every(value => value.setEmoji));
    await assert.rejects(runReactionBurst({ context: context({}), mode: "random", count: 2, intervalMs: 500, pool: ["1"], send: async () => {}, wait: async () => {} }), /只有 1/);
});
