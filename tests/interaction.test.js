import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { contextMenuSettings, normalizeMenuLabel, applyContextMenu } from "../src/renderer/context-menu.js";
import { reactionSettings, reactionDetails, unicodeReactionId } from "../src/renderer/reactions.js";
import { unicodeEmojiGroups, readRecentEmoji, rememberRecentEmoji } from "../src/renderer/unicode-emoji.js";
import { avatarGroupTarget } from "../src/renderer/group-actions.js";
import { fitContextMenu } from "../src/renderer/menu-position.js";

const require = createRequire(import.meta.url);
const { loadReactionCatalog } = require("../src/reaction-catalog.cjs");

test("hides only the selected native menu labels and restores them when disabled", () => {
    const item = name => ({ textContent: name, dataset: {}, querySelector: () => null });
    const copy = item("复制 Ctrl+C"), remove = item("删除"), forward = item("转发");
    const menu = { querySelectorAll: () => [copy, remove, forward] };
    assert.equal(normalizeMenuLabel(copy.textContent), "复制");
    const settings = contextMenuSettings({ features: { contextMenu: { hiddenItems: ["删除"] } } });
    assert.deepEqual(applyContextMenu(menu, settings), ["复制", "删除", "转发"]);
    assert.equal(remove.dataset.enhancedqqMenuHidden, "1");
    assert.equal(copy.dataset.enhancedqqMenuHidden, undefined);
    applyContextMenu(menu, { ...settings, enabled: false });
    assert.equal(remove.dataset.enhancedqqMenuHidden, undefined);
});

test("keeps a unique bounded selection and supports one custom Unicode emoji", () => {
    const settings = reactionSettings({ features: { reactions: { enabled: true, quickMode: "custom", quickIds: ["128522", "128522", "bad", "129418"] } } });
    assert.deepEqual(settings.quickIds, ["128522", "129418"]);
    assert.equal(settings.quickMode, "custom");
    assert.equal(unicodeReactionId("🦊"), "129418");
    assert.equal(unicodeReactionId("❤️"), "10084");
    assert.equal(unicodeReactionId("👨‍👩‍👧"), "");
    assert.equal(unicodeReactionId("字"), "");
    assert.equal(reactionDetails("129418", []).symbol, "🦊");
});

test("reads available QQ local reactions and skips missing or invalid resources", t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "enhancedqq-emoji-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = path.join(root, "Tencent Files", "nt_qq", "global", "nt_data", "Emoji", "emoji-resource");
    fs.mkdirSync(path.join(directory, "emoji_res"), { recursive: true });
    fs.writeFileSync(path.join(directory, "face_config.json"), JSON.stringify({ emoji: [{ AQLid: 3, QCid: 128522, QDes: "/嘿嘿" }, { AQLid: "../x", QCid: 1 }, { AQLid: 4, QCid: 128523 }] }));
    fs.writeFileSync(path.join(directory, "emoji_res", "emoji_003.png"), Buffer.from([137, 80, 78, 71]));
    const catalog = loadReactionCatalog(root);
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].id, "128522");
    assert.equal(catalog[0].label, "嘿嘿");
    assert.match(catalog[0].src, /^data:image\/png;base64,/);
});

test("ships the complete Unicode 18 emoji groups and keeps combined emoji intact", () => {
    const data = JSON.parse(fs.readFileSync(new URL("../src/vendor/unicode-emoji/emoji.json", import.meta.url), "utf8"));
    const groups = unicodeEmojiGroups(data), entries = groups.flatMap(group => group.items);
    assert.equal(data.version, "18.0");
    assert.equal(groups.length, 10);
    assert.equal(entries.length, 3972);
    assert.equal(entries.find(entry => entry.symbol === "🐱").id, "128049");
    assert.equal(entries.find(entry => entry.symbol === "👨‍👩‍👧").id, "u:👨‍👩‍👧");
    assert.ok(fs.statSync(new URL("../src/vendor/unicode-emoji/NotoColorEmoji.ttf", import.meta.url)).size > 20_000_000);
});

test("stores recent emoji in most-recent order without duplicates", () => {
    const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    rememberRecentEmoji("128049", storage);
    rememberRecentEmoji("u:🏳️‍🌈", storage);
    rememberRecentEmoji("128049", storage);
    assert.deepEqual(readRecentEmoji(storage), ["128049", "u:🏳️‍🌈"]);
});

test("resolves the clicked avatar to the sender of its group message", () => {
    const message = { __VUE__: [{ props: { msgRecord: { chatType: 2, peerUid: "12345678", senderUid: "u_target123" } } }] };
    const row = { querySelector: () => message };
    const avatar = { closest: selector => selector === ".ml-item" ? row : null };
    const element = { closest: () => avatar };
    const doc = { querySelector: () => null, getElementById: () => null };
    assert.deepEqual(avatarGroupTarget(element, doc), { group: "12345678", member: "u_target123" });
    message.__VUE__[0].props.msgRecord.chatType = 1;
    assert.equal(avatarGroupTarget(element, doc), null);
});

test("moves bottom-edge menus inside the window and makes oversized menus scrollable", () => {
    const style = { top: "430px", left: "450px", maxHeight: "", overflowY: "", boxSizing: "" };
    let naturalHeight = 300;
    const menu = { isConnected: true, style, getBoundingClientRect() {
        const top = Number.parseFloat(style.top), left = Number.parseFloat(style.left), height = Math.min(naturalHeight, Number.parseFloat(style.maxHeight) || naturalHeight);
        return { top, left, right: left + 150, bottom: top + height, width: 150, height };
    } };
    const view = { innerWidth: 500, innerHeight: 500, getComputedStyle: () => style };
    fitContextMenu(menu, view);
    assert.equal(menu.getBoundingClientRect().bottom, 492);
    assert.equal(menu.getBoundingClientRect().right, 492);
    naturalHeight = 800; style.top = "430px";
    fitContextMenu(menu, view);
    assert.equal(menu.getBoundingClientRect().top, 8);
    assert.equal(menu.getBoundingClientRect().bottom, 492);
    assert.equal(style.overflowY, "auto");
    view.document = { querySelector: () => ({ getBoundingClientRect: () => ({ top: 350, height: 150 }) }) };
    style.top = "430px";
    fitContextMenu(menu, view);
    assert.equal(menu.getBoundingClientRect().top, 8);
    assert.equal(menu.getBoundingClientRect().bottom, 342);
});
