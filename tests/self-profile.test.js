import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extractSelfNickname, querySelfNickname, createSelfNicknameResolver } = require("../src/self-profile.cjs");

test("reads the requested account nickname from QQ's profile detail", async () => {
    const own = { simpleInfo: { coreInfo: { uid: "u_me", nick: "my nickname" } } };
    const other = { simpleInfo: { coreInfo: { uid: "u_other", nick: "other nickname" } } };
    const detail = new Map([["u_me", own], ["u_other", other]]);
    const calls = [];
    const wrapper = { NodeIQQNTWrapperSession: { getNTWrapperSession: name => ({ getProfileService: () => ({
        fetchUserDetailInfo: (...args) => { calls.push({ name, args }); return { result: 0, detail }; }
    }) }) } };
    assert.equal(await querySelfNickname("u_me", wrapper), "my nickname");
    assert.deepEqual(calls[0], { name: "nt_1", args: ["nodeStore", ["u_me"], 1, [0]] });
    assert.equal(extractSelfNickname(other, "u_me"), "");
    assert.equal(extractSelfNickname({ detail }, "u_missing"), "");
});

test("shares profile lookups and resets the nickname when the account changes", async () => {
    let uid = "u_first";
    let calls = 0;
    const wrapper = { NodeIQQNTWrapperSession: { getNTWrapperSession: () => ({ getProfileService: () => ({
        fetchUserDetailInfo: (_trace, ids) => { calls += 1; return { detail: new Map([[ids[0], { coreInfo: { uid: ids[0], nick: ids[0] } }]]) }; }
    }) }) } };
    const resolver = createSelfNicknameResolver(() => uid, () => wrapper);
    assert.deepEqual(await Promise.all([resolver.get(), resolver.get()]), ["u_first", "u_first"]);
    assert.equal(calls, 1);
    uid = "u_second";
    assert.equal(await resolver.get(), "u_second");
    assert.equal(calls, 2);
    resolver.clear();
    assert.equal(await resolver.get(), "u_second");
    assert.equal(calls, 3);
});

test("does not return a stale nickname after the account changes during a lookup", async () => {
    let uid = "u_first";
    let resolveFirst;
    const wrapper = { NodeIQQNTWrapperSession: { getNTWrapperSession: () => ({ getProfileService: () => ({
        fetchUserDetailInfo: (_trace, ids) => ids[0] === "u_first"
            ? new Promise(resolve => { resolveFirst = resolve; })
            : { detail: new Map([[ids[0], { coreInfo: { uid: ids[0], nick: "second" } }]]) }
    }) }) } };
    const resolver = createSelfNicknameResolver(() => uid, () => wrapper);
    const first = resolver.get();
    await Promise.resolve();
    uid = "u_second";
    assert.equal(await resolver.get(), "second");
    resolveFirst({ detail: new Map([["u_first", { coreInfo: { uid: "u_first", nick: "first" } }]]) });
    assert.equal(await first, "");
    assert.equal(await resolver.get(), "second");
});
