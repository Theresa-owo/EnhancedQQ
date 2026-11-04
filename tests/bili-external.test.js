import test from "node:test";
import assert from "node:assert/strict";
import { biliVideoFromRecord, normalizeBiliVideoUrl } from "../src/renderer/bili-url.js";
import { installBiliExternalHandler } from "../src/renderer/bili-external.js";

function record(url, app = "com.tencent.miniapp_01") {
    return { elements: [{ arkElement: { bytesData: JSON.stringify({ app, meta: { detail_1: { qqdocurl: url, url: "https://m.q.qq.com/miniapp" } } }) } }] };
}

test("recognizes Bilibili video shares and rejects unrelated URLs and app cards", () => {
    assert.equal(biliVideoFromRecord(record("https://b23.tv/AbC123")), "https://b23.tv/AbC123");
    assert.equal(biliVideoFromRecord(record("www.bilibili.com/video/BV1xx411c7mD?p=2")), "https://www.bilibili.com/video/BV1xx411c7mD?p=2");
    assert.equal(biliVideoFromRecord(record("https://www.bilibili.com/video/av123/")), "https://www.bilibili.com/video/av123/");
    assert.equal(biliVideoFromRecord(record("https://b23.tv/AbC123", "other-app")), "");
    assert.equal(biliVideoFromRecord(record("https://www.bilibili.com/read/cv123")), "");
    assert.equal(biliVideoFromRecord({ elements: [{ arkElement: { bytesData: "bad json" } }] }), "");
    for (const url of ["javascript:alert(1)", "https://b23.tv.evil.test/AbC123", "https://b23.tv@evil.test/AbC123", "https://evil.test/b23.tv/AbC123", "https://bilibili.com.evil.test/video/BV123"]) {
        assert.equal(normalizeBiliVideoUrl(url), "", url);
    }
});

test("intercepts only enabled Bilibili left clicks and leaves other cards and right clicks alone", async () => {
    const listeners = new Map();
    const doc = { addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
    const opened = [];
    let enabled = true;
    const remove = installBiliExternalHandler(doc, { openBiliVideo: async url => { opened.push(url); } }, () => enabled);
    function dispatch(type, msgRecord, button = 0, detail = 1) {
        const message = { __VUE__: [{ props: { msgRecord } }] };
        const card = { closest: selector => selector === ".message" ? message : null };
        const event = { type, button, detail, target: { closest: () => card }, prevented: false, stopped: false,
            preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
        listeners.get(type)(event);
        return event;
    }
    assert.equal(dispatch("mousedown", record("https://b23.tv/AbC123")).prevented, true);
    assert.equal(dispatch("click", record("https://b23.tv/AbC123")).stopped, true);
    dispatch("click", record("https://b23.tv/AbC123"), 0, 2);
    assert.deepEqual(opened, ["https://b23.tv/AbC123"]);
    assert.equal(dispatch("click", record("https://b23.tv/AbC123"), 2).prevented, false);
    assert.equal(dispatch("click", record("https://example.test/other")).prevented, false);
    enabled = false;
    assert.equal(dispatch("click", record("https://b23.tv/AbC123")).prevented, false);
    remove();
    assert.equal(listeners.size, 0);
});
