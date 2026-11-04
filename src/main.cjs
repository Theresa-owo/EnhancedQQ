const fs = require("node:fs");
const path = require("node:path");
const { BrowserWindow, ipcMain, app, nativeTheme, shell, net } = require("electron");
const { createRecallEngine } = require("./recall-engine.cjs");
const { createRecallStore } = require("./recall-store.cjs");
const { installRecallHook } = require("./recall-hook.cjs");
const { createRedPacketGate } = require("./red-packet-gate.cjs");
const { createPacketEventCollector } = require("./red-packet-events.cjs");
const { createTtsService } = require("./tts-service.cjs");
const { createSelfNicknameResolver, getWrapper } = require("./self-profile.cjs");
const { createOutgoingTracker, recordAttrId } = require("./outgoing-tracker.cjs");
const { installPanguHook } = require("./pangu.cjs");
const { installUpdateConfigFilter, installHotUpdateGate } = require("./qq-update.cjs");
const { createPluginUpdater } = require("./plugin-update.cjs");
const { loadReactionCatalog } = require("./reaction-catalog.cjs");
const { createGroupActions } = require("./group-actions.cjs");
const { createTitleTransport } = require("./title-transport.cjs");

const plugin = LiteLoader.plugins.enhancedqq;
const dataDir = plugin.path.data;
const configPath = path.join(dataDir, "config.json");
const store = createRecallStore(path.join(dataDir, "recalled"));
const engine = createRecallEngine({ store, onStorageError: () => log("recall storage write failed") });
const installedWindows = new WeakSet();
const redPacketGate = createRedPacketGate();
const ttsService = createTtsService(dataDir);
let redPacketAccount = "";
const packetEvents = createPacketEventCollector({ ownUid: () => redPacketAccount });
const selfNickname = createSelfNicknameResolver(() => redPacketAccount);
const outgoing = createOutgoingTracker();
let settings = { enabled: true, showOwn: false, telegramBubbles: {}, themeColor: {}, autoRedPacket: { enabled: false }, tts: {}, pangu: { enabled: true }, blockUpdate: { enabled: false }, biliExternal: { enabled: false }, pluginUpdate: { autoCheck: true }, contextMenu: {}, reactions: {}, groupTools: { enabled: false } };
let pluginUpdater = null;
let reactionCatalog = null;
let unicodeEmojiCatalog = null;
let lastPluginUpdateStatus = "";
let observedLogged = false;
let bridgeLogged = false;
let rendererLogged = false;
let controllingTheme = false;
let previousThemeSource = nativeTheme?.themeSource || "system";
let desiredThemeSource = null;
let settingNativeTheme = false;
const ensureTitleTransport = createTitleTransport({
    getWrapperPath: () => Object.keys(require.cache).find(id => path.basename(id).toLowerCase() === "wrapper.node") || path.join(process.resourcesPath, "app", "wrapper.node")
});
const groupActions = createGroupActions({ getSession: () => getWrapper()?.NodeIQQNTWrapperSession?.getNTWrapperSession?.("nt_1"),
    getSelfUid: () => redPacketAccount, ensureTitleTransport });

function log(message) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.appendFileSync(path.join(dataDir, "plugin.log"), `${new Date().toISOString()} ${message}\n`, "utf8");
    } catch (error) { console.warn("[EnhancedQQ] Could not write the load marker:", error.message); }
}

function refreshSettings() {
    try {
        const config = LiteLoader.api.config.get("enhancedqq", {});
        const bubbleConfig = config?.features?.telegramBubbles;
        const themeConfig = config?.features?.themeColor;
        const packetConfig = config?.features?.autoRedPacket;
        const panguConfig = config?.features?.pangu;
        const updateConfig = config?.features?.blockUpdate;
        const biliConfig = config?.features?.biliExternal;
        const pluginUpdateConfig = config?.features?.pluginUpdate;
        const menuConfig = config?.features?.contextMenu;
        const reactionConfig = config?.features?.reactions;
        const groupConfig = config?.features?.groupTools;
        settings = { enabled: config?.features?.antiRecall?.enabled !== false, showOwn: config?.features?.antiRecall?.showOwn === true,
            telegramBubbles: bubbleConfig && typeof bubbleConfig === "object" && !Array.isArray(bubbleConfig) ? bubbleConfig : {},
            themeColor: themeConfig && typeof themeConfig === "object" && !Array.isArray(themeConfig) ? themeConfig : {},
            autoRedPacket: { ...(packetConfig && typeof packetConfig === "object" && !Array.isArray(packetConfig) ? packetConfig : {}), enabled: packetConfig?.enabled === true },
            tts: config?.features?.tts && typeof config.features.tts === "object" ? config.features.tts : {}, pangu: { enabled: panguConfig?.enabled !== false },
            blockUpdate: { enabled: updateConfig?.enabled === true }, biliExternal: { enabled: biliConfig?.enabled === true },
            pluginUpdate: { autoCheck: pluginUpdateConfig?.autoCheck !== false },
            contextMenu: menuConfig && typeof menuConfig === "object" && !Array.isArray(menuConfig) ? menuConfig : {},
            reactions: reactionConfig && typeof reactionConfig === "object" && !Array.isArray(reactionConfig) ? reactionConfig : {},
            groupTools: { enabled: groupConfig?.enabled === true } };
        engine.setEnabled(settings.enabled);
        applyNativeTheme(settings.themeColor.mode);
        pluginUpdater?.setAutoCheck(settings.pluginUpdate.autoCheck);
    } catch (error) { console.warn("[EnhancedQQ] Could not read settings:", error?.message); }
    return settings;
}

function setNativeTheme(source) {
    if (!nativeTheme || nativeTheme.themeSource === source) return;
    settingNativeTheme = true;
    try { nativeTheme.themeSource = source; }
    finally { settingNativeTheme = false; }
}

function applyNativeTheme(mode) {
    if (!nativeTheme) return;
    const source = ["system", "light", "dark"].includes(mode) ? mode : null;
    if (source) {
        if (!controllingTheme) previousThemeSource = nativeTheme.themeSource;
        controllingTheme = true;
        desiredThemeSource = source;
        setNativeTheme(source);
    } else if (controllingTheme) {
        controllingTheme = false;
        desiredThemeSource = null;
        setNativeTheme(previousThemeSource);
    }
}

function onNativeThemeUpdated() {
    if (settingNativeTheme) return;
    if (controllingTheme) setNativeTheme(desiredThemeSource);
    else if (nativeTheme) previousThemeSource = nativeTheme.themeSource;
    broadcast();
}

function snapshot() {
    return { enabled: settings.enabled, showOwn: settings.showOwn, telegramBubbles: settings.telegramBubbles, themeColor: settings.themeColor, autoRedPacket: settings.autoRedPacket, tts: settings.tts, pangu: settings.pangu, blockUpdate: settings.blockUpdate, biliExternal: settings.biliExternal,
        pluginUpdate: pluginUpdater?.snapshot() || settings.pluginUpdate, contextMenu: settings.contextMenu, reactions: settings.reactions, groupTools: settings.groupTools,
        nativeDark: nativeTheme ? nativeTheme.shouldUseDarkColors : null, markers: engine.markers() };
}

function broadcast() {
    const state = snapshot();
    for (const window of BrowserWindow.getAllWindows()) {
        try {
            if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send("EnhancedQQ.state", state);
        } catch { /* The window may close while its state is being sent. */ }
    }
}

function onBrowserWindowCreated(window) {
    if (installedWindows.has(window)) return;
    if (installRecallHook(window, engine, () => settings, broadcast, () => {
        if (!observedLogged) { observedLogged = true; log("recall message events observed"); }
    }, record => {
        outgoing.observe(record);
        if (!settings.autoRedPacket.enabled) return;
        const packet = packetEvents.observe(record);
        if (!packet) return;
        queueMicrotask(() => {
            if (!settings.autoRedPacket.enabled) return;
            for (const target of BrowserWindow.getAllWindows()) {
                try { if (!target.isDestroyed() && !target.webContents.isDestroyed()) target.webContents.send("EnhancedQQ.redPacketRecord", { msgList: [packet] }); }
                catch { /* A chat window may have closed. */ }
            }
        });
    })) {
        installUpdateConfigFilter(window, () => settings.blockUpdate.enabled, action => log(`qq update blocked | ${action}`));
        installPanguHook(ipcMain, window, () => settings, (message, owner) => outgoing.isPacketPassword(recordAttrId(message), owner));
        installedWindows.add(window);
    }
}

function onLogin(uid) {
    engine.setAccount(uid);
    const account = typeof uid === "string" ? uid : "";
    if (account !== redPacketAccount) { redPacketGate.clear(); packetEvents.clear(); selfNickname.clear(); outgoing.clear(); redPacketAccount = account; }
    log(`recall account ready | identified=${typeof uid === "string" && uid.length > 0}`);
    if (account && settings.autoRedPacket.enabled) {
        selfNickname.get().then(name => { if (account === redPacketAccount) log(`red packet account profile | namePresent=${Boolean(name)}`); });
    }
    broadcast();
}

refreshSettings();
pluginUpdater = createPluginUpdater({ fetcher: (...args) => net?.fetch ? net.fetch(...args) : fetch(...args), pluginDir: plugin.path.plugin, dataDir,
    currentVersion: plugin.manifest.version, onChange: state => {
        if (state.status !== lastPluginUpdateStatus) { lastPluginUpdateStatus = state.status; log(`plugin update | status=${state.status}`); }
        broadcast();
    } });
pluginUpdater.setAutoCheck(settings.pluginUpdate.autoCheck);
installHotUpdateGate(ipcMain, () => settings.blockUpdate.enabled, action => log(`qq update blocked | ${action}`));
nativeTheme?.on("updated", onNativeThemeUpdated);
ipcMain.handle("EnhancedQQ.getState", () => snapshot());
ipcMain.handle("EnhancedQQ.getWebContentsId", event => event.sender.id);
ipcMain.handle("EnhancedQQ.getSelfNickname", () => selfNickname.get());
ipcMain.handle("EnhancedQQ.openBiliVideo", async (_event, candidate) => {
    if (!settings.biliExternal.enabled) throw new Error("B 站浏览器打开功能已关闭。");
    const { normalizeBiliVideoUrl } = await import("./renderer/bili-url.js");
    const url = normalizeBiliVideoUrl(candidate);
    if (!url) throw new Error("无法识别 B 站视频链接。");
    await shell.openExternal(url);
});
ipcMain.handle("EnhancedQQ.checkPluginUpdate", () => pluginUpdater.check());
ipcMain.handle("EnhancedQQ.installPluginUpdate", () => pluginUpdater.install());
ipcMain.handle("EnhancedQQ.openPluginRelease", () => shell.openExternal(pluginUpdater.releaseUrl()));
ipcMain.handle("EnhancedQQ.getReactionCatalog", () => {
    if (!reactionCatalog?.length) reactionCatalog = loadReactionCatalog(app.getPath?.("documents") || "");
    return reactionCatalog;
});
ipcMain.handle("EnhancedQQ.getUnicodeEmojiCatalog", () => {
    if (!unicodeEmojiCatalog) unicodeEmojiCatalog = JSON.parse(fs.readFileSync(path.join(plugin.path.plugin, "src", "vendor", "unicode-emoji", "emoji.json"), "utf8"));
    return unicodeEmojiCatalog;
});
ipcMain.handle("EnhancedQQ.getUnicodeEmojiFont", () => fs.readFileSync(path.join(plugin.path.plugin, "src", "vendor", "unicode-emoji", "NotoColorEmoji.ttf")));
ipcMain.handle("EnhancedQQ.allowReaction", () => settings.reactions.enabled === true);
ipcMain.handle("EnhancedQQ.groupCapabilities", (_event, group, member) => {
    if (!settings.groupTools.enabled) return { canMute: false, canTitle: false };
    return groupActions.capabilities(group, member);
});
ipcMain.handle("EnhancedQQ.groupAction", (_event, action, group, member, value) => {
    if (!settings.groupTools.enabled) throw new Error("群管理快捷操作已关闭。");
    if (action === "mute") return groupActions.mute(group, member, value);
    if (action === "title") return groupActions.title(group, member, value);
    throw new Error("未知的群管理操作。");
});
ipcMain.handle("EnhancedQQ.trackOutgoing", (event, attrId, kind, peer) => outgoing.watch(attrId, event.sender, kind, peer));
ipcMain.handle("EnhancedQQ.markOutgoingSent", (event, attrId, msgId) => outgoing.mark(attrId, event.sender, msgId));
ipcMain.handle("EnhancedQQ.untrackOutgoing", (event, attrId) => outgoing.unwatch(attrId, event.sender));
ipcMain.handle("EnhancedQQ.recallAutoText", async (event, peer, msgId) => {
    if (!settings.autoRedPacket.enabled || settings.autoRedPacket.types?.text !== true || settings.autoRedPacket.recallText !== true || !outgoing.consumeRecall(msgId, event.sender, peer)) throw new Error("自动撤回未获确认。");
    engine.exclude(msgId);
    const session = getWrapper()?.NodeIQQNTWrapperSession?.getNTWrapperSession?.("nt_1");
    const service = session?.getMsgService?.();
    if (typeof service?.recallMsg !== "function") throw new Error("QQ 撤回接口不可用。");
    let timer;
    try {
        return await Promise.race([Promise.resolve(service.recallMsg(peer, [String(msgId)])),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("QQ 撤回结果未确认。")), 10000); })]);
    } finally { clearTimeout(timer); }
});
function packetActionEnabled(type, method) {
    const packet = settings.autoRedPacket;
    return packet.enabled && ["lucky", "voice", "text", "exclusive"].includes(type) && packet.types?.[type] === true && (method !== "voiceTts" || packet.voiceTts === true);
}
ipcMain.handle("EnhancedQQ.reserveRedPacket", (event, key, type) => redPacketGate.reserve(key, packetActionEnabled(type), event.sender?.id, type));
ipcMain.handle("EnhancedQQ.allowRedPacketAction", (event, key, type, consume, method) => redPacketGate.permitted(key, packetActionEnabled(type, method), event.sender?.id, consume === true, type));
ipcMain.handle("EnhancedQQ.synthesizeSpeech", (_event, text, voice) => ttsService.synthesize(text, voice));
ipcMain.handle("EnhancedQQ.encodeSpeech", (_event, pcm) => ttsService.encode(pcm));
ipcMain.handle("EnhancedQQ.copyVoiceCache", (_event, file, target) => ttsService.copyToCache(file, target));
ipcMain.handle("EnhancedQQ.releaseVoice", (_event, file) => ttsService.release(file));
ipcMain.handle("EnhancedQQ.getTelegramAssets", () => {
    const root = plugin.path.plugin;
    return {
        definitions: JSON.parse(fs.readFileSync(path.join(root, "src", "vendor", "telegram-theme", "setting.json"), "utf8")),
        styles: ["telegram-bubbles.generated.css", "telegram-bubbles.compat.css"].map(name => fs.readFileSync(path.join(root, "src", "renderer", name), "utf8"))
    };
});
ipcMain.on("EnhancedQQ.configChanged", () => { refreshSettings(); broadcast(); });
ipcMain.on("EnhancedQQ.preloadReady", () => { if (!bridgeLogged) { bridgeLogged = true; log("recall preload ready"); } });
ipcMain.on("EnhancedQQ.rendererReady", () => { if (!rendererLogged) { rendererLogged = true; log("recall renderer ready"); } });
ipcMain.on("EnhancedQQ.redPacketDiagnostic", (_event, stage, detail = {}) => {
    if (!settings.autoRedPacket.enabled || !["listener-ready", "candidate", "observed", "account-missing", "nickname-missing", "response", "failed", "text-sent", "text-recall-requested", "text-recall-failed"].includes(stage)) return;
    const finite = value => Number.isFinite(value) ? value : null;
    const safe = { source: ["receive", "update", "forwarded"].includes(detail.source) ? detail.source : null,
        type: ["lucky", "voice", "text", "exclusive"].includes(detail.type) ? detail.type : null };
    if (["observed", "candidate"].includes(stage)) Object.assign(safe, { chatType: finite(detail.chatType), channel: finite(detail.channel), status: finite(detail.status), wallet: detail.wallet === true,
        body: detail.body === true, index: detail.index === true, title: detail.title === true, sequence: detail.sequence === true });
    if (stage === "response") Object.assign(safe, { order: detail.order === true, code: finite(detail.code),
        outcome: ["positive", "zero", "rejected", "unknown"].includes(detail.outcome) ? detail.outcome : "unknown" });
    log(`red packet ${stage} | ${JSON.stringify(safe)}`);
});
ipcMain.on("EnhancedQQ.nativeBubbleStatus", (_event, status, detail) => {
    if (!["off", "missing", "unknown", "turning-off", "pending"].includes(status)) return;
    const safe = detail && typeof detail === "object" ? { tag: String(detail.tag || "").slice(0, 20), className: String(detail.className || "").slice(0, 160), aria: String(detail.aria || "").slice(0, 10),
        nodes: Array.isArray(detail.nodes) ? detail.nodes.slice(0, 6).map(node => ({ tag: String(node.tag || "").slice(0, 20), className: String(node.className || "").slice(0, 100), aria: String(node.aria || "").slice(0, 10), state: String(node.state || "").slice(0, 20), booleanProps: Array.isArray(node.booleanProps) ? node.booleanProps.slice(0, 8).map(value => String(value).slice(0, 40)) : [] })) : [] } : null;
    log(`native bubble setting | status=${status} detail=${JSON.stringify(safe)}`);
});
fs.watchFile(configPath, { interval: 1000 }, () => { refreshSettings(); broadcast(); });
app.once("before-quit", () => { fs.unwatchFile(configPath); nativeTheme?.removeListener("updated", onNativeThemeUpdated); pluginUpdater?.stop(); });
log(`main loaded | enhancedqq=${plugin.manifest.version} liteloader=${LiteLoader.versions.liteloader} qqnt=${LiteLoader.versions.qqnt}`);

module.exports = { onBrowserWindowCreated, onLogin };
