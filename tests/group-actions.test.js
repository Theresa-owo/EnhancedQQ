import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGroupActions, encodeGroupTitle, decodeOidbReply } = require("../src/group-actions.cjs");

function fixture(actorRole = 4, targetRole = 2, ensureTitleTransport = async () => {}) {
    const self = { uid: "u_owner123", uin: "123456789", role: actorRole };
    const target = { uid: "u_target123", uin: "987654321", cardName: "测试成员", role: targetRole, memberSpecialTitle: "旧头衔" };
    const calls = [];
    const groupService = { getAllMemberList: async () => ({ errCode: 0, result: { infos: new Map([[self.uid, self], [target.uid, target]]) } }),
        setMemberShutUp: async (...args) => { calls.push({ kind: "mute", args }); return { result: 0 }; } };
    const msfService = { sendMsfRequest: async (...args) => { calls.push({ kind: "packet", args }); return Buffer.from("08fc111002", "hex"); } };
    const session = { getGroupService: () => groupService, getMSFService: () => msfService };
    return { self, target, calls, actions: createGroupActions({ getSession: () => session, getSelfUid: () => self.uid, ensureTitleTransport }) };
}

test("checks group roles before showing or performing management actions", async () => {
    const owner = fixture(4, 3);
    assert.deepEqual(await owner.actions.capabilities("12345678", owner.target.uid), { canMute: true, canTitle: true, title: "旧头衔", name: "测试成员", uin: "987654321" });
    owner.self.role = 2;
    await assert.rejects(owner.actions.mute("12345678", owner.target.uid, 17), /无权/);
    assert.equal(owner.calls.length, 0);
    const admin = fixture(3, 2);
    assert.deepEqual(await admin.actions.capabilities("12345678", admin.target.uid), { canMute: true, canTitle: false, title: "旧头衔", name: "测试成员", uin: "987654321" });
    await assert.rejects(admin.actions.title("12345678", admin.target.uid, "测试"), /群主/);
    admin.target.role = 3;
    await assert.rejects(admin.actions.mute("12345678", admin.target.uid, 17), /无权/);
});

test("passes the exact number of seconds and permits zero to unmute", async () => {
    const value = fixture();
    await value.actions.mute("12345678", value.target.uid, 17);
    await value.actions.mute("12345678", value.target.uid, 0);
    assert.deepEqual(value.calls.map(item => item.args[1][0].timeStamp), [17, 0]);
    await assert.rejects(value.actions.mute("12345678", value.target.uid, 2.5), /整数秒|0 到/);
    await assert.rejects(value.actions.mute("12345678", value.target.uid, 2592001), /0 到/);
});

test("encodes the QQ title request and requires a successful matching reply", async () => {
    assert.equal(encodeGroupTitle("12345678", "u_test123", "测试").toString("hex"),
        "08fc111002222808cec2f1051a210a09755f746573743132332a06e6b58be8af9530ffffffff0f3a06e6b58be8af95");
    assert.equal(decodeOidbReply(Buffer.from("08fc111002", "hex")), true);
    assert.throws(() => decodeOidbReply(Buffer.from("08fc1110021801", "hex")), /拒绝/);
    assert.throws(() => decodeOidbReply(Buffer.from("08011002", "hex")), /未确认/);
    const value = fixture();
    await value.actions.title("12345678", value.target.uid, "测试");
    assert.equal(value.calls[0].args[1], "OidbSvcTrpcTcp.0x8fc_2");
    assert.equal(value.calls[0].args[3].account, value.self.uin);
});

test("confirms a fire-and-forget title request by refreshing the target member", async () => {
    const self = { uid: "u_owner123", uin: "123456789", role: 4 };
    const target = { uid: "u_target123", role: 2, memberSpecialTitle: "旧头衔" };
    const group = { getAllMemberList: async () => ({ errCode: 0, result: { infos: new Map([[self.uid, self], [target.uid, target]]) } }) };
    const msf = { sendMsfRequest: async () => { target.memberSpecialTitle = "新头衔"; } };
    const actions = createGroupActions({ getSession: () => ({ getGroupService: () => group, getMSFService: () => msf }), getSelfUid: () => self.uid, ensureTitleTransport: async () => {}, wait: async () => {} });
    assert.equal(await actions.title("12345678", target.uid, "新头衔"), true);
    msf.sendMsfRequest = async () => {};
    await assert.rejects(actions.title("12345678", target.uid, "未生效"), /未能确认/);
});

test("confirms a title from fresh member extension data when the member-list cache is stale", async () => {
    const self = { uid: "u_owner123", uin: "123456789", role: 4 };
    const target = { uid: "u_target123", uin: "987654321", role: 2, memberSpecialTitle: "旧头衔" };
    let serverTitle = "旧头衔";
    const group = { getAllMemberList: async () => ({ errCode: 0, result: { infos: new Map([[self.uid, self], [target.uid, target]]) } }),
        getMemberExtInfo: async request => ({ result: { memberLevelInfo: [{ uin: request.uinList[0], specialTitle: serverTitle }] } }) };
    const msf = { sendMsfRequest: async () => { serverTitle = "新头衔"; } };
    const actions = createGroupActions({ getSession: () => ({ getGroupService: () => group, getMSFService: () => msf }), getSelfUid: () => self.uid, ensureTitleTransport: async () => {}, wait: async () => {} });
    assert.equal(await actions.title("12345678", target.uid, "新头衔"), true);
    assert.equal((await actions.capabilities("12345678", target.uid)).title, "新头衔");
});

test("does not resubmit a title that already matches the current member data", async () => {
    const value = fixture();
    assert.equal(await value.actions.title("12345678", value.target.uid, "旧头衔"), true);
    assert.equal(value.calls.length, 0);
});

test("does not send a title request if the QQ compatibility component cannot be installed", async () => {
    const value = fixture(4, 2, async () => { throw new Error("不支持当前 QQ 版本"); });
    await assert.rejects(value.actions.title("12345678", value.target.uid, "新头衔"), /不支持/);
    assert.equal(value.calls.length, 0);
    await value.actions.mute("12345678", value.target.uid, 17);
    assert.equal(value.calls[0].kind, "mute");
});
