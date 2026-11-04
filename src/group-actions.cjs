const crypto = require("node:crypto");

function varint(value) {
    let n = BigInt(value), bytes = [];
    if (n < 0n) throw new Error("Invalid protobuf value");
    do { let byte = Number(n & 127n); n >>= 7n; if (n) byte |= 128; bytes.push(byte); } while (n);
    return Buffer.from(bytes);
}
function integer(field, value) { return Buffer.concat([varint(field * 8), varint(value)]); }
function bytes(field, value) { const data = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8"); return Buffer.concat([varint(field * 8 + 2), varint(data.length), data]); }

function encodeGroupTitle(group, uid, title) {
    const member = Buffer.concat([bytes(1, uid), bytes(5, title), integer(6, 0xffffffff), bytes(7, title)]);
    const body = Buffer.concat([integer(1, group), bytes(3, member)]);
    return Buffer.concat([integer(1, 0x8fc), integer(2, 2), bytes(4, body)]);
}

function decodeOidbReply(input) {
    const data = Buffer.from(input);
    let index = 0, command = null, subCommand = null, code = 0, message = "";
    function readVarint() {
        let value = 0n, shift = 0n;
        for (let n = 0; n < 10 && index < data.length; n++) {
            const b = data[index++]; value |= BigInt(b & 127) << shift;
            if (!(b & 128)) return value;
            shift += 7n;
        }
        throw new Error("QQ 返回了不完整的响应。");
    }
    while (index < data.length) {
        const tag = Number(readVarint()), field = tag >>> 3, wire = tag & 7;
        if (!field) throw new Error("QQ 返回了无效的响应。");
        if (wire === 0) {
            const value = Number(readVarint());
            if (field === 1) command = value;
            if (field === 2) subCommand = value;
            if (field === 3) code = value;
        } else if (wire === 2) {
            const length = Number(readVarint()), end = index + length;
            if (!Number.isSafeInteger(end) || end > data.length) throw new Error("QQ 返回了不完整的响应。");
            if (field === 5) message = data.subarray(index, end).toString("utf8").slice(0, 120);
            index = end;
        } else if (wire === 1) index += 8;
        else if (wire === 5) index += 4;
        else throw new Error("QQ 返回了不支持的响应格式。");
        if (index > data.length) throw new Error("QQ 返回了不完整的响应。");
    }
    if (command !== 0x8fc || subCommand !== 2) throw new Error("QQ 未确认头衔设置结果。");
    if (code !== 0) throw new Error(message || `QQ 拒绝了头衔设置（代码 ${code}）。`);
    return true;
}

function validateTarget(group, uid) {
    return /^\d{5,10}$/.test(String(group)) && BigInt(group) <= 0xffffffffn && /^u_[A-Za-z0-9_-]{4,128}$/.test(String(uid));
}

async function fetchMemberTitle(service, group, uin) {
    if (typeof service?.getMemberExtInfo !== "function" || !/^\d{5,20}$/.test(String(uin))) return null;
    const filter = Object.fromEntries(["memberLevelInfoUin", "memberLevelInfoPoint", "memberLevelInfoActiveDay", "memberLevelInfoLevel", "memberLevelInfoName", "levelName", "dataTime", "userShowFlag", "sysShowFlag", "timeToUpdate", "nickName", "specialTitle", "levelNameNew", "userShowFlagNew", "msgNeedField", "cmdUinFlagExt3Grocery", "memberIcon", "memberInfoSeq"].map(key => [key, 1]));
    const result = await service.getMemberExtInfo({ groupCode: String(group), sourceType: 1, beginUin: "0", dataTime: "0", uinList: [String(uin)],
        uinNum: "", seq: "", groupType: "", richCardNameVer: "", memberExtFilter: filter });
    const body = result?.result || result?.data || result;
    const entries = body?.memberLevelInfo;
    const member = Array.isArray(entries) ? entries.find(item => String(item?.uin) === String(uin)) : null;
    return member && typeof member.specialTitle === "string" ? member.specialTitle : null;
}

async function fetchMemberTitleWithTimeout(service, group, uin) {
    let timer;
    try { return await Promise.race([fetchMemberTitle(service, group, uin), new Promise(resolve => { timer = setTimeout(() => resolve(null), 3000); })]); }
    finally { clearTimeout(timer); }
}

function createGroupActions({ getSession, getSelfUid, ensureTitleTransport, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    async function memberContext(group, target, force = false) {
        if (!validateTarget(group, target)) throw new Error("无法识别群聊或群成员。");
        const self = String(getSelfUid() || "");
        if (!self || self === target) throw new Error("请选择另一位群成员。");
        const session = getSession(), service = session?.getGroupService?.();
        if (typeof service?.getAllMemberList !== "function") throw new Error("QQ 群成员接口不可用。");
        const result = await service.getAllMemberList(String(group), force);
        if (Number(result?.errCode || 0) !== 0) throw new Error(result?.errMsg || "读取群成员失败。");
        const infos = result?.result?.infos;
        const member = uid => infos instanceof Map ? infos.get(uid) : infos?.[uid];
        const actor = member(self), selected = member(target);
        if (!actor || !selected) {
            if (!force) return memberContext(group, target, true);
            throw new Error("无法确认当前账号或该成员的群权限。");
        }
        const actorRole = Number(actor.role), targetRole = Number(selected.role);
        return { session, service, actor, selected, canMute: (actorRole === 4 && [2, 3].includes(targetRole)) || (actorRole === 3 && targetRole === 2),
            canTitle: actorRole === 4 && [2, 3].includes(targetRole) };
    }
    async function capabilities(group, target) {
        const context = await memberContext(group, target);
        let currentTitle = String(context.selected.memberSpecialTitle || "");
        if (context.canTitle) {
            try {
                const fresh = await fetchMemberTitleWithTimeout(context.service, group, context.selected.uin);
                if (fresh !== null) currentTitle = fresh;
            } catch { /* The member-list value is still usable. */ }
        }
        return { canMute: context.canMute, canTitle: context.canTitle, title: currentTitle,
            name: String(context.selected.cardName || context.selected.nick || context.selected.uin || "该成员"), uin: String(context.selected.uin || "") };
    }
    async function mute(group, target, seconds) {
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 2592000) throw new Error("禁言时长应为 0 到 2592000 秒。");
        const context = await memberContext(group, target, true);
        if (!context.canMute) throw new Error("当前账号无权禁言该成员。");
        if (typeof context.service.setMemberShutUp !== "function") throw new Error("QQ 禁言接口不可用。");
        const result = await context.service.setMemberShutUp(String(group), [{ uid: target, timeStamp: seconds }]);
        if (result == null) throw new Error("QQ 未确认禁言结果。");
        const code = result.result ?? result.errCode;
        if (typeof code !== "number" || code !== 0) throw new Error(String(result.errMsg || result.errMessage || "QQ 未确认禁言成功。"));
        return true;
    }
    async function title(group, target, value) {
        if (typeof value !== "string" || [...value].length > 24) throw new Error("头衔不能超过 24 个字符。");
        const context = await memberContext(group, target, true);
        if (!context.canTitle) throw new Error("只有群主可以设置该成员的头衔。");
        let before = null;
        try { before = await fetchMemberTitleWithTimeout(context.service, group, context.selected.uin); } catch {}
        if (before === value || (before === null && String(context.selected.memberSpecialTitle || "") === value)) return true;
        const uin = String(context.actor.uin || ""), msf = context.session?.getMSFService?.();
        if (!/^\d{5,20}$/.test(uin) || typeof msf?.sendMsfRequest !== "function") throw new Error("QQ 头衔接口不可用。");
        if (typeof ensureTitleTransport !== "function") throw new Error("QQ 头衔兼容接口不可用。");
        await ensureTitleTransport();
        const options = { sendTimeout: 10000, sendTimeoutOnSlowNet: 10000, resendNum: 0, sendOptions: 1, reqTargetAccountType: 0, account: uin, accountType: 0, transInfoMap: new Map() };
        const response = await msf.sendMsfRequest(String(crypto.randomInt(1, 0x7fffffff)), "OidbSvcTrpcTcp.0x8fc_2", encodeGroupTitle(group, target, value), options);
        const data = response instanceof Uint8Array ? response : response?.pbBuffer || response?.data;
        if (data instanceof Uint8Array && data.length) return decodeOidbReply(data);
        // QQ 9.9.37 submits this method without a direct return value. Check the
        // member's refreshed title rather than treating submission as success.
        for (const delay of [250, 750, 1500, 2500, 4000]) {
            await wait(delay);
            let fresh = null;
            try { fresh = await fetchMemberTitleWithTimeout(context.service, group, context.selected.uin); } catch {}
            if (fresh === value) return true;
            if (fresh === null) {
                const updated = await memberContext(group, target, true);
                if (String(updated.selected.memberSpecialTitle || "") === value) return true;
            }
        }
        throw new Error("请求已提交，但未能确认头衔变化，请查看成员资料。");
    }
    return { capabilities, mute, title };
}

module.exports = { encodeGroupTitle, decodeOidbReply, validateTarget, fetchMemberTitle, createGroupActions };
