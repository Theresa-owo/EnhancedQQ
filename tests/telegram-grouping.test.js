import test from "node:test";
import assert from "node:assert/strict";
import { classifyTelegramMessages, collectTelegramRows } from "../src/renderer/telegram-grouping.js";

test("groups consecutive messages while respecting timestamps, senders and notices", () => {
    const messages = [
        { id: "1", sender: "a", self: false }, { id: "2", sender: "a", self: false },
        { id: "3", gray: true }, { id: "4", sender: "a", self: false },
        { id: "5", sender: "me", self: true, timestamp: true }, { id: "6", sender: "me", self: true }
    ];
    assert.deepEqual(classifyTelegramMessages(messages), [
        { id: "1", group: "others-head" }, { id: "2", group: "others-tail" },
        { id: "4", group: "others-single" }, { id: "5", group: "self-head" }, { id: "6", group: "self-tail" }
    ]);
});

test("does not merge messages whose senders are unknown", () => {
    assert.deepEqual(classifyTelegramMessages([{ id: "1" }, { id: "2" }]), [
        { id: "1", group: "others-single" }, { id: "2", group: "others-single" }
    ]);
});

test("groups rendered rows without DOM IDs using QQ message records", () => {
    const list = {};
    function row({ top, sender, src, self = false, timestamp, gray = false }) {
        const record = sender ? { senderUid: sender } : null;
        const message = { __VUE__: record ? [{ props: { msgRecord: record } }] : [] };
        const avatar = { getAttribute: () => null, querySelector: () => ({ src }) };
        return {
            id: "", closest: () => list, getBoundingClientRect: () => ({ top }),
            querySelector(selector) {
                if (selector === ".message") return message;
                if (selector === ".message-container") return gray ? null : {};
                if (selector === ".container--self, .message-container--self, .message-container--align-right") return self ? {} : null;
                if (selector === ".avatar-span") return avatar;
                if (selector === ".message__timestamp") return timestamp == null ? null : { textContent: timestamp };
                return null;
            }
        };
    }
    const rows = [row({ top: 0, sender: "u_a", src: "cache:first" }), row({ top: 10, sender: "u_a", src: "cache:second", timestamp: " " }),
        row({ top: 20, gray: true }), row({ top: 30, sender: "u_b", src: "cache:third" }), row({ top: 40, self: true })];
    list.querySelectorAll = () => [...rows].reverse();
    const rendered = collectTelegramRows(list, [{ id: "unrelated", data: { senderUid: "u_stale" } }]);
    assert.deepEqual(classifyTelegramMessages(rendered), [
        { id: "0", group: "others-head" }, { id: "1", group: "others-tail" },
        { id: "3", group: "others-single" }, { id: "4", group: "self-single" }
    ]);
    assert.strictEqual(rendered[0].row, rows[0]);
    assert.strictEqual(rendered[1].row, rows[1]);
});
