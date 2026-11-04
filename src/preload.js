const { contextBridge, ipcRenderer } = require("electron");

let nativeBridgePromise;
function nativeBridge() {
    if (!nativeBridgePromise) nativeBridgePromise = ipcRenderer.invoke("EnhancedQQ.getWebContentsId").then(id => {
        const numericId = Number(id);
        if (!Number.isSafeInteger(numericId) || numericId < 1) throw new Error("Invalid QQ window ID");
        return { id: String(numericId), channels: [...new Set([`RM_IPCFROM_MAIN${numericId}`, "RM_IPCFROM_MAIN2"])] };
    }).catch(error => { nativeBridgePromise = null; throw error; });
    return nativeBridgePromise;
}

async function invokeQQ(eventName, cmdName, payload) {
    const bridge = await nativeBridge();
    return new Promise((resolve, reject) => {
        const callbackId = globalThis.crypto.randomUUID();
        let timer;
        const finish = () => { clearTimeout(timer); for (const channel of bridge.channels) ipcRenderer.off(channel, listener); };
        const listener = (_event, ...args) => {
            if (args?.[0]?.callbackId !== callbackId) return;
            finish();
            if (args[0].promiseStatue === "fail" || args[0].promiseStatus === "fail") { reject(new Error("QQ 原生接口调用失败。")); return; }
            resolve(args[1]);
        };
        for (const channel of bridge.channels) ipcRenderer.on(channel, listener);
        timer = setTimeout(() => { finish(); reject(new Error("QQ 响应超时，结果未确认。")); }, 10000);
        try {
            ipcRenderer.send(`RM_IPCFROM_RENDERER${bridge.id}`, { type: "request", callbackId, eventName, peerId: bridge.id }, { cmdName, cmdType: "invoke", payload });
        } catch (error) { finish(); reject(error); }
    });
}

function onRedPacket(callback) {
    ipcRenderer.on("EnhancedQQ.redPacketRecord", (_event, payload) => {
        try { Promise.resolve(callback(payload, "forwarded")).catch(error => console.warn("[EnhancedQQ] Red packet handler failed:", error?.message)); }
        catch (error) { console.warn("[EnhancedQQ] Red packet handler failed:", error?.message); }
    });
    nativeBridge().then(bridge => {
        const listener = (_event, ...args) => {
            const message = args?.[1]?.cmdName ? args[1] : args?.[3]?.[1];
            const source = message?.cmdName === "nodeIKernelMsgListener/onRecvMsg" ? "receive"
                : message?.cmdName === "nodeIKernelMsgListener/onMsgInfoListUpdate" ? "update" : "";
            if (!source) return;
            const payload = message.payload;
            const list = Array.isArray(payload) ? payload : payload?.msgList || payload?.msgRecords || payload?.records;
            if (!Array.isArray(list)) return;
            for (const item of list) for (const element of item?.elements || []) {
                if (Number(element?.elementType) !== 9 && !element?.walletElement) continue;
                const wallet = element.walletElement;
                ipcRenderer.send("EnhancedQQ.redPacketDiagnostic", "candidate", { source, chatType: Number(item.chatType), status: Number(item.sendStatus),
                    channel: Number(wallet?.redChannel), wallet: Boolean(wallet), body: wallet?.pcBody != null, index: wallet?.stringIndex != null,
                    title: wallet?.receiver?.title != null, sequence: item.msgSeq != null && String(item.msgSeq) !== "0" });
            }
            const msgList = source === "update" ? list.filter(item => Number(item?.sendStatus) === 2 && item?.msgSeq != null && String(item.msgSeq) !== "0") : list;
            if (!msgList.length) return;
            try { Promise.resolve(callback({ msgList }, source)).catch(error => console.warn("[EnhancedQQ] Red packet handler failed:", error?.message)); }
            catch (error) { console.warn("[EnhancedQQ] Red packet handler failed:", error?.message); }
        };
        for (const channel of bridge.channels) ipcRenderer.on(channel, listener);
        ipcRenderer.send("EnhancedQQ.redPacketDiagnostic", "listener-ready", {});
    }).catch(error => console.warn("[EnhancedQQ] Red packet listener unavailable:", error?.message));
}

function qqResult(result) {
    if (["number", "string"].includes(typeof result) && /^-?\d+$/.test(String(result))) {
        if (Number(result) !== 0) throw new Error(`QQ 拒绝了消息发送（代码 ${result}）。`);
        return result;
    }
    if (result && typeof result === "object") {
        for (const key of ["result", "retCode", "errCode", "code"]) {
            if ((typeof result[key] === "number" || typeof result[key] === "string") && /^-?\d+$/.test(String(result[key]))) {
                if (Number(result[key]) === 0) return result;
                throw new Error(`QQ 拒绝了消息发送（代码 ${result[key]}）。`);
            }
        }
        if (result.success === true) return result;
    }
    return result;
}
function qqValue(value) {
    if (!value || typeof value !== "object") return value;
    for (const key of ["result", "data", "value", "id"]) {
        const item = value[key];
        if (item != null && (typeof item !== "object" || Object.keys(item).length)) return item;
    }
    return value;
}
async function qqAttributeId(chatType) {
    const serverTime = qqValue(await invokeQQ("ntApi", "nodeIKernelMSFService/getServerTime", []));
    if (!["number", "string"].includes(typeof serverTime)) throw new Error("QQ 未提供服务器时间。");
    const attrId = qqValue(await invokeQQ("ntApi", "nodeIKernelMsgService/generateMsgUniqueId", [chatType, serverTime]));
    if (!["number", "string"].includes(typeof attrId) || !String(attrId) || String(attrId) === "0") throw new Error("QQ 未提供消息标识。");
    return attrId;
}
function waitForSentMessage(bridge, attrId) {
    let finish;
    const promise = new Promise(resolve => {
        let timer;
        let finished = false;
        const relay = (_event, payload) => {
            if (String(payload?.attrId ?? "") !== String(attrId)) return;
            if (payload.status === "sent" && payload.msgId) finish({ status: "sent", msgId: String(payload.msgId) });
            else if (payload.status === "failed") finish({ status: "failed" });
        };
        const listener = (_event, ...args) => {
            const event = args?.[1]?.cmdName ? args[1] : args?.[3]?.[1];
            if (event?.cmdName !== "nodeIKernelMsgListener/onMsgInfoListUpdate") return;
            const payload = event.payload;
            const records = Array.isArray(payload) ? payload : payload?.msgList || payload?.msgRecords || payload?.records;
            if (!Array.isArray(records)) return;
            for (const record of records) {
                const attrs = record?.msgAttrs;
                const attr = typeof attrs?.get === "function" ? (attrs.get(0) ?? attrs.get("0")) : attrs?.[0];
                if (attr?.attrId == null || String(attr.attrId) !== String(attrId)) continue;
                const state = Number(record.sendStatus);
                if (state === 2 && record.msgId != null && String(record.msgId) !== "0") finish({ status: "sent", msgId: String(record.msgId) });
                else if (state === 0) finish({ status: "failed" });
            }
        };
        finish = result => { if (finished) return; finished = true; clearTimeout(timer); ipcRenderer.off("EnhancedQQ.outgoingStatus", relay); for (const channel of bridge.channels) ipcRenderer.off(channel, listener); resolve(result); };
        ipcRenderer.on("EnhancedQQ.outgoingStatus", relay);
        for (const channel of bridge.channels) ipcRenderer.on(channel, listener);
        timer = setTimeout(() => finish({ status: "unknown" }), 30000);
    });
    return { promise, cancel: () => finish({ status: "cancelled" }) };
}
async function sendMessage(peer, msgElements, kind) {
    const attrId = await qqAttributeId(peer.chatType);
    const msgAttributeInfos = new Map([[0, { attrType: 0, attrId, vasMsgInfo: {
        msgNamePlateInfo: {}, bubbleInfo: {}, avatarPendantInfo: {}, vasFont: {}, iceBreakInfo: {}
    } }]]);
    const bridge = await nativeBridge();
    const waiter = waitForSentMessage(bridge, attrId);
    let tracked = false;
    try {
        tracked = await ipcRenderer.invoke("EnhancedQQ.trackOutgoing", attrId, kind, peer);
        if (!tracked) throw new Error("QQ 消息状态监听不可用。");
        qqResult(await invokeQQ("ntApi", "nodeIKernelMsgService/sendMsg", [{ msgId: "0", peer, msgElements, msgAttributeInfos }, null]));
        const result = await waiter.promise;
        if (result.status === "sent") {
            if (!await ipcRenderer.invoke("EnhancedQQ.markOutgoingSent", attrId, result.msgId)) throw new Error("QQ 消息状态无法确认。");
            return result.msgId;
        }
        if (result.status === "failed") throw new Error("QQ 显示消息发送失败，原文字已保留。");
        throw new Error("QQ 尚未确认发送，请先检查聊天记录；原文字已保留。");
    } finally { waiter.cancel(); if (tracked) await ipcRenderer.invoke("EnhancedQQ.untrackOutgoing", attrId).catch(() => {}); }
}
function qqPath(value, depth = 0) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object" || depth > 4) return "";
    for (const key of ["filePath", "path", "data", "result", "value", "0"]) {
        const found = qqPath(value[key], depth + 1);
        if (found) return found;
    }
    return "";
}
async function sendVoice(peer, pcm, kind = "tts") {
    const audio = await ipcRenderer.invoke("EnhancedQQ.encodeSpeech", pcm);
    try {
        const cache = await invokeQQ("ntApi", "nodeIKernelMsgService/getRichMediaFilePathForGuild", [{ path_info: {
            md5HexStr: audio.md5, fileName: `${audio.md5}.amr`, elementType: 4, elementSubType: 0,
            thumbSize: 0, needCreate: true, downloadType: 1, file_uuid: ""
        } }]);
        const cachePath = qqPath(cache);
        if (!cachePath) throw new Error("QQ 未提供语音缓存路径。");
        await ipcRenderer.invoke("EnhancedQQ.copyVoiceCache", audio.file, cachePath);
        const element = { elementType: 4, elementId: "", pttElement: {
            fileName: `${audio.md5}.amr`, filePath: cachePath, md5HexStr: audio.md5, fileSize: audio.size,
            duration: audio.duration, formatType: 1, voiceType: 1, voiceChangeType: 0, canConvert2Text: true,
            waveAmplitudes: [0, 18, 9, 23, 16, 17, 16, 15, 44, 17, 24, 20, 14, 15, 17], fileUuid: "", fileSubId: "", playState: 1, autoConvertText: 0,
            storeID: 0, otherBusinessInfo: { aiVoiceType: 0 }
        } };
        return await sendMessage(peer, [element], kind);
    } finally { await ipcRenderer.invoke("EnhancedQQ.releaseVoice", audio.file); }
}
async function sendText(peer, content) {
    return sendMessage(peer, [{ elementType: 1, elementId: "", textElement: { content, atType: 0, atUid: "", atTinyId: "", atNtUid: "" } }], "red-packet-text");
}

const exists = contextBridge.executeInMainWorld({ func: key => key in globalThis, args: ["EnhancedQQ"] });
if (!exists) {
    contextBridge.exposeInMainWorld("EnhancedQQ", {
        getState: () => ipcRenderer.invoke("EnhancedQQ.getState"),
        getTelegramAssets: () => ipcRenderer.invoke("EnhancedQQ.getTelegramAssets"),
        configChanged: () => ipcRenderer.send("EnhancedQQ.configChanged"),
        rendererReady: () => ipcRenderer.send("EnhancedQQ.rendererReady"),
        nativeBubbleStatus: (status, detail) => ipcRenderer.send("EnhancedQQ.nativeBubbleStatus", status, detail),
        onState: callback => { ipcRenderer.on("EnhancedQQ.state", (_event, state) => callback(state)); },
        onRedPacket,
        redPacketDiagnostic: (stage, detail) => ipcRenderer.send("EnhancedQQ.redPacketDiagnostic", stage, detail),
        getRedPacketAccount: () => invokeQQ("GlobalDataApi", "fetchAuthData", []),
        getSelfNickname: () => ipcRenderer.invoke("EnhancedQQ.getSelfNickname"),
        synthesizeSpeech: (text, voice) => ipcRenderer.invoke("EnhancedQQ.synthesizeSpeech", text, voice),
        sendTtsVoice: sendVoice,
        reserveRedPacket: (key, type) => ipcRenderer.invoke("EnhancedQQ.reserveRedPacket", key, type),
        sendRedPacketText: async (key, peer, content) => {
            if (!await ipcRenderer.invoke("EnhancedQQ.allowRedPacketAction", key, "text", false)) throw new Error("红包功能已关闭或请求已处理。");
            return sendText(peer, content);
        },
        sendRedPacketVoice: async (key, peer, pcm) => {
            if (!await ipcRenderer.invoke("EnhancedQQ.allowRedPacketAction", key, "voice", false, "voiceTts")) throw new Error("语音红包功能已关闭或请求已处理。");
            return sendVoice(peer, pcm, "red-packet-voice");
        },
        recallRedPacketText: async (peer, msgId) => {
            return qqResult(await ipcRenderer.invoke("EnhancedQQ.recallAutoText", peer, msgId));
        },
        claimRedPacket: async (key, request, type) => {
            if (!await ipcRenderer.invoke("EnhancedQQ.allowRedPacketAction", key, type, true)) return null;
            return invokeQQ("ntApi", "nodeIKernelMsgService/grabRedBag", [{ grabRedBagReq: request }, { timeout: 5000 }]);
        }
    });
    ipcRenderer.send("EnhancedQQ.preloadReady");
}
