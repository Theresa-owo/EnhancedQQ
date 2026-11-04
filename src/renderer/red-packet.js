import { readConfig } from "./config.js";
import { synthesizePcm, ttsSettings } from "./tts.js";

export function redPacketSettings(config) {
    const raw = config?.features?.autoRedPacket;
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const types = value.types && typeof value.types === "object" ? value.types : {};
    return { ...value, enabled: value.enabled === true,
        types: Object.fromEntries(["lucky", "voice", "text", "exclusive"].map(key => [key, types[key] === true])),
        voiceDirect: value.voiceDirect === true, voiceTts: value.voiceTts === true, recallText: value.recallText === true };
}

export function classifyRedPacket(wallet) {
    if (!wallet || typeof wallet !== "object") return null;
    const explicit = String(wallet.packetType || wallet.redPacketType || "").toLowerCase();
    if (["lucky", "voice", "text", "exclusive"].includes(explicit)) return explicit;
    if (Array.isArray(wallet.grapUin) && wallet.grapUin.length) return "exclusive";
    if (Number(wallet.redChannel) === 65536) return "voice";
    const labels = [wallet.name, wallet.receiver?.content, wallet.receiver?.subTitle, wallet.receiver?.notice, wallet.sender?.content].filter(value => typeof value === "string").join(" ");
    if (/语音(?:口令|红包)/.test(labels)) return "voice";
    if (/专属红包/.test(labels)) return "exclusive";
    if (/拼手气红包/.test(labels)) return "lucky";
    if (Number(wallet.redChannel) === 1) return "lucky";
    if (Number(wallet.redChannel) === 32) return "text";
    if (/(?:文字|口令)红包/.test(labels)) return "text";
    return null;
}

export function redPacketOutcome(response) {
    const result = response?.grabRedBagRsp || response;
    const code = Number(result?.result ?? result?.retCode ?? result?.errCode ?? result?.resultCode);
    const rawAmount = result?.recvdOrder?.amount;
    let outcome = "unknown";
    if (Number.isFinite(code) && code !== 0) outcome = "rejected";
    else if ((typeof rawAmount === "string" && /^\d+$/.test(rawAmount)) || (typeof rawAmount === "number" && Number.isFinite(rawAmount) && rawAmount >= 0)) {
        outcome = Number(rawAmount) > 0 ? "positive" : "zero";
    }
    return { outcome, order: Boolean(result?.recvdOrder), code: Number.isFinite(code) ? code : null };
}

export function findRedPacketAccount(root) {
    const queue = [{ value: root, depth: 0 }];
    const seen = new Set();
    while (queue.length) {
        const { value, depth } = queue.shift();
        if (!value || typeof value !== "object" || seen.has(value) || depth > 5) continue;
        seen.add(value);
        const uin = value.uin ?? value.selfUin ?? value.accountUin;
        if (["string", "number"].includes(typeof uin) && /^\d{5,20}$/.test(String(uin))) return { uin, nickName: String(value.nickName || value.nickname || value.nick || "") };
        const children = Array.isArray(value) ? value : [value.authData, value.data, value.result, value.payload, value.account, value.accountInfo];
        for (const child of children) queue.push({ value: child, depth: depth + 1 });
    }
    return null;
}

export function redPacketRequests(payload, account) {
    if (!account?.uin || !Array.isArray(payload?.msgList)) return [];
    const result = [];
    for (const message of payload.msgList) {
        const chatType = Number(message?.chatType);
        if (![1, 2].includes(chatType) || !message?.peerUid || message.msgSeq == null || !Array.isArray(message.elements)) continue;
        for (const element of message.elements) {
            const wallet = element?.walletElement;
            if (Number(element?.elementType) !== 9 || !wallet || wallet.pcBody == null || wallet.stringIndex == null || wallet.receiver?.title == null) continue;
            const type = classifyRedPacket(wallet);
            if (!type || (type === "exclusive" && Array.isArray(wallet.grapUin) && wallet.grapUin.length && !wallet.grapUin.some(uin => String(uin) === String(account.uin)))) continue;
            const key = `${message.peerUid}:${wallet.billNo || message.msgSeq}:${wallet.stringIndex}`;
            result.push({ key, type, challenge: String(wallet.receiver.title), peer: { chatType, peerUid: String(message.peerUid), guildId: "" }, request: {
                recvUin: chatType === 1 ? account.uin : message.peerUid,
                recvType: chatType, peerUid: message.peerUid, name: account.nickName,
                pcBody: wallet.pcBody, wishing: wallet.receiver.title, msgSeq: message.msgSeq, index: wallet.stringIndex
            } });
        }
    }
    return result;
}

export async function processRedPacket(item, settings, voice, bridge, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), synthesize = synthesizePcm) {
    if (!settings.enabled || !settings.types[item.type] || (item.type === "voice" && !settings.voiceDirect && !settings.voiceTts)) return;
    if (!await bridge.reserveRedPacket(item.key, item.type)) return;
    let sentTextId;
    try {
        if (item.type === "text") {
            sentTextId = await bridge.sendRedPacketText(item.key, item.peer, item.challenge);
            bridge.redPacketDiagnostic?.("text-sent", { type: "text" });
        }
        else if (item.type === "voice" && settings.voiceDirect && bridge.claimVoiceRedPacketDirect) {
            return await bridge.claimVoiceRedPacketDirect(item.key, item.request);
        }
        else if (item.type === "voice" && settings.voiceTts) {
            const pcm = await synthesize(item.challenge, voice, bridge);
            await bridge.sendRedPacketVoice(item.key, item.peer, pcm);
        }
        else if (item.type === "voice") throw new Error("当前 QQ 的语音红包验证接口尚未适配。");
        return await bridge.claimRedPacket(item.key, item.request, item.type);
    } finally {
        if (sentTextId && settings.recallText) {
            await delay(1200);
            try {
                await bridge.recallRedPacketText(item.peer, sentTextId);
                bridge.redPacketDiagnostic?.("text-recall-requested", { type: "text" });
            } catch (error) {
                bridge.redPacketDiagnostic?.("text-recall-failed", { type: "text" });
                throw error;
            }
        }
    }
}

export function installAutoRedPacket() {
    const bridge = globalThis.EnhancedQQ;
    if (!bridge?.onRedPacket || !bridge?.claimRedPacket || !bridge?.getRedPacketAccount || !bridge?.reserveRedPacket) return;
    let settings = redPacketSettings({});
    let voice = ttsSettings({}).voice;
    let stateReceived = false;
    let accountPromise;
    const api = globalThis.LiteLoader.api.config;
    bridge.onState?.(state => { stateReceived = true; settings = redPacketSettings({ features: { autoRedPacket: state?.autoRedPacket } }); voice = ttsSettings({ features: { tts: state?.tts } }).voice; });
    readConfig(api).then(config => { if (!stateReceived) { settings = redPacketSettings(config); voice = ttsSettings(config).voice; } }).catch(error => console.warn("[EnhancedQQ] Red packet settings unavailable:", error?.message));
    const handleRedPacket = async (payload, source = "receive") => {
        const hash = globalThis.location?.hash;
        if (typeof hash === "string" && !hash.includes("#/main") && !hash.includes("#/chat")) return;
        if (!settings.enabled) return;
        const walletMessages = (payload?.msgList || []).flatMap(message => (message?.elements || [])
            .filter(element => Number(element?.elementType) === 9)
            .map(element => ({ message, wallet: element.walletElement })));
        if (!walletMessages.length) return;
        for (const { message, wallet } of walletMessages) {
            bridge.redPacketDiagnostic?.("observed", { source, chatType: Number(message.chatType), channel: Number(wallet?.redChannel),
                type: classifyRedPacket(wallet), body: wallet?.pcBody != null, index: wallet?.stringIndex != null,
                title: wallet?.receiver?.title != null, sequence: message.msgSeq != null && String(message.msgSeq) !== "0" });
        }
        if (!walletMessages.some(({ wallet }) => classifyRedPacket(wallet))) return;
        if (!accountPromise) accountPromise = bridge.getRedPacketAccount().then(findRedPacketAccount).catch(() => null);
        let account = await accountPromise;
        if (!account) {
            accountPromise = null;
            try { account = findRedPacketAccount(document.getElementById("app")?.__vue_app__?.config?.globalProperties?.$store?.state?.common_Auth?.authData); } catch { /* QQ may not expose this store. */ }
        }
        if (!settings.enabled) return;
        if (!account) { bridge.redPacketDiagnostic?.("account-missing", { source }); return; }
        if (!account.nickName.trim()) {
            const nickname = await bridge.getSelfNickname?.().catch(() => "");
            if (!nickname) { bridge.redPacketDiagnostic?.("nickname-missing", { source }); return; }
            account = { ...account, nickName: nickname };
        }
        for (const item of redPacketRequests(payload, account)) {
            if (!settings.enabled) break;
            if (!settings.types[item.type]) continue;
            try {
                const response = await processRedPacket(item, settings, voice, bridge);
                if (response != null) {
                    bridge.redPacketDiagnostic?.("response", { source, type: item.type, ...redPacketOutcome(response) });
                }
            } catch (error) {
                bridge.redPacketDiagnostic?.("failed", { source, type: item.type });
                console.warn("[EnhancedQQ] Red packet claim failed:", error?.message);
            }
        }
    };
    bridge.onRedPacket(handleRedPacket);
}
