import { readConfig, writeConfig } from "./config.js";

export const TTS_VOICES = Object.freeze([
    ["zh-CN-XiaoxiaoNeural", "晓晓"], ["zh-CN-XiaoyiNeural", "晓伊"],
    ["zh-CN-YunxiNeural", "云希"], ["zh-CN-YunjianNeural", "云健"]
]);

export function ttsSettings(config) {
    const value = config?.features?.tts && typeof config.features.tts === "object" ? config.features.tts : {};
    return { ...value, enabled: value.enabled === true, voice: TTS_VOICES.some(([id]) => id === value.voice) ? value.voice : TTS_VOICES[0][0] };
}

export async function synthesizePcm(text, voice, bridge = globalThis.EnhancedQQ) {
    const bytes = await bridge.synthesizeSpeech(text, voice);
    const data = new Uint8Array(bytes);
    const decode = new OfflineAudioContext(1, 1, 24000);
    const decoded = await decode.decodeAudioData(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    const length = Math.ceil(decoded.duration * 24000);
    if (!length || length > 24000 * 180) throw new Error("语音为空或超过三分钟。");
    const render = new OfflineAudioContext(1, length, 24000);
    const source = render.createBufferSource(); source.buffer = decoded; source.connect(render.destination); source.start();
    const samples = (await render.startRendering()).getChannelData(0);
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) { const value = Math.max(-1, Math.min(1, samples[i])); pcm[i] = value < 0 ? value * 32768 : value * 32767; }
    return pcm.buffer;
}

export async function sendTts(text, peer, voice, bridge = globalThis.EnhancedQQ) {
    const pcm = await synthesizePcm(text, voice, bridge);
    return bridge.sendTtsVoice(peer, pcm);
}

export function peerFromAioData(data) {
    if (!data || typeof data !== "object") return null;
    const header = data.header || {};
    const chatType = Number(data.chatType ?? data.type ?? header.chatType ?? data.aioType ?? header.type);
    if (![1, 2, 100].includes(chatType)) return null;
    const candidates = chatType === 2
        ? [data.peerUid, header.peerUid, data.groupCode, header.groupCode, data.groupId, header.groupId, data.peerUin, header.peerUin, data.chatUin, header.chatUin, data.uin, header.uin]
        : [data.peerUid, header.peerUid, data.peer?.peerUid, header.peer?.peerUid, data.peer?.uid, header.peer?.uid, data.peer?.ntUid, header.peer?.ntUid,
            data.contact?.peerUid, header.contact?.peerUid, data.contact?.uid, header.contact?.uid, data.contact?.ntUid, header.contact?.ntUid,
            data.buddy?.peerUid, header.buddy?.peerUid, data.buddy?.uid, header.buddy?.uid, data.friend?.peerUid, header.friend?.peerUid,
            data.friend?.uid, header.friend?.uid, data.target?.peerUid, header.target?.peerUid, data.target?.uid, header.target?.uid,
            data.uid, header.uid, data.contactUid, header.contactUid, data.userUid, header.userUid, data.targetUid, header.targetUid, data.friendUid, header.friendUid];
    const peerUid = candidates.map(value => String(value ?? "").trim()).find(value => value && value !== "0" && value !== "self" && (chatType === 2 || value.startsWith("u_")));
    return peerUid ? { chatType, peerUid, guildId: String(data.guildId || header.guildId || "") } : null;
}

export function currentPeer(editor, documentRef = document) {
    const root = editor?.closest?.(".aio") || documentRef.querySelector(".aio.vue-component") || documentRef.querySelector(".aio");
    const instances = [...(Array.isArray(root?.__VUE__) ? root.__VUE__ : []), root?.__vueParentComponent].filter(Boolean);
    for (const instance of instances) {
        for (const value of [instance.proxy?.commonAioStore?.curAioData, instance.ctx?.commonAioStore?.curAioData,
            instance.proxy?.aioStore?.curAioData, instance.ctx?.aioStore?.curAioData, instance.props, instance.proxy, instance.ctx, instance.setupState]) {
            const peer = peerFromAioData(value);
            if (peer) return peer;
        }
    }
    const globals = documentRef.getElementById("app")?.__vue_app__?.config?.globalProperties;
    for (const value of [globals?.$store?.state?.common_Aio?.curAioData, globals?.$dt?.pageManager?.pageMap?.pg_aio_pc?.pageRoot?.__VUE__?.[0]?.proxy?.aioStore?.curAioData]) {
        const peer = peerFromAioData(value);
        if (peer) return peer;
    }
    return null;
}

export function clearSentComposer(element, sentText) {
    if (!element?.isConnected || element.innerText.trim() !== sentText) return false;
    if (typeof element.ckeditorInstance?.setData === "function") {
        element.ckeditorInstance.setData("");
        return true;
    }
    const host = element.matches?.(".qq-msg-editor") ? element : element.closest?.(".qq-msg-editor") || element.querySelector?.(".qq-msg-editor");
    for (const instance of Array.isArray(host?.__VUE__) ? host.__VUE__ : []) {
        try {
            const getter = instance?.proxy?.getEditor;
            const value = typeof getter === "function" ? getter.call(instance.proxy) : getter;
            const editor = value?.editor || value?.value?.editor || value;
            const view = editor?.view;
            const state = view?.state;
            if (typeof view?.dispatch !== "function" || typeof state?.tr?.delete !== "function" || !Number.isInteger(state?.doc?.content?.size)) continue;
            view.dispatch(state.tr.delete(0, state.doc.content.size));
            return true;
        } catch { /* Leave the user's text intact if the editor is unavailable. */ }
    }
    return false;
}

export function installTtsController() {
    const bridge = globalThis.EnhancedQQ;
    const api = globalThis.LiteLoader?.api?.config;
    if (!bridge?.synthesizeSpeech || !bridge?.sendTtsVoice || !api) return null;
    let current = ttsSettings({});
    let busy = false;
    const listeners = new Set();
    const notify = () => { for (const listener of listeners) listener(current); };
    function setCurrent(value) { current = ttsSettings({ features: { tts: value } }); updateToolbar(); notify(); }
    const ready = readConfig(api).then(config => { setCurrent(config.features?.tts); return current; });
    ready.catch(error => console.warn("[EnhancedQQ] TTS settings unavailable:", error?.message));
    bridge.onState?.(state => { if (state?.tts) setCurrent(state.tts); });
    async function save(change) {
        const config = await readConfig(api);
        const next = ttsSettings(config); change(next);
        await writeConfig(api, { features: { tts: next } });
        setCurrent(next); bridge.configChanged?.();
    }
    let errorTimer;
    function showError(text) {
        let node = document.querySelector("[data-enhancedqq-tts-error]");
        if (!node) { node = document.createElement("div"); node.dataset.enhancedqqTtsError = ""; node.setAttribute("role", "alert"); document.body.append(node); }
        node.textContent = text;
        clearTimeout(errorTimer);
        errorTimer = setTimeout(() => node.remove(), 6000);
    }
    function updateToolbar() {
        const button = document.querySelector("[data-enhancedqq-tts-toggle]");
        if (!button) return;
        button.setAttribute("aria-pressed", String(current.enabled));
        button.setAttribute("aria-label", "TTS 语音");
        button.dataset.liuliLabel = `TTS 语音：${current.enabled ? "开启" : "关闭"}`;
        button.setAttribute("aria-busy", String(busy));
        button.title = busy ? "正在发送语音" : current.enabled ? "TTS 语音已开启" : "TTS 语音已关闭";
    }
    function ensureToolbar() {
        const bar = document.querySelector(".chat-func-bar");
        const left = bar?.querySelector(".chat-func-bar__left") || bar?.firstElementChild;
        if (!left || left.querySelector("[data-enhancedqq-tts-toggle]")) return;
        const item = document.createElement("div"); item.className = "bar-icon enhancedqq-tts-bar";
        const button = document.createElement("button"); button.type = "button"; button.className = "icon-item enhancedqq-tts-toggle"; button.dataset.enhancedqqTtsToggle = "";
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h10M9 5v14M5 19h8M17 8c2 1 2 7 0 8M20 5c4 3 4 11 0 14"/></svg>';
        button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); save(next => { next.enabled = !next.enabled; }).catch(error => showError(error?.message || "TTS 设置保存失败")); });
        item.append(button); left.append(item); updateToolbar();
    }
    function setupToolbar() {
        const style = document.createElement("style");
        style.textContent = '.enhancedqq-tts-toggle { border:0; background:transparent; color:inherit; cursor:pointer; } .enhancedqq-tts-toggle svg { width:20px; height:20px; } .enhancedqq-tts-toggle[aria-busy="true"] { opacity:.5; } body .chat-func-bar .bar-icon > .enhancedqq-tts-toggle[aria-pressed="true"], body .chat-func-bar .bar-icon > .enhancedqq-tts-toggle[aria-pressed="true"]::after { color:var(--ll-brand, #7ab4ff) !important; } [data-enhancedqq-tts-error] { position:fixed; top:22px; left:50%; transform:translateX(-50%); z-index:99999; padding:9px 14px; border-radius:10px; background:var(--ll-glass, #3b3733); color:var(--ll-on-glass, #fff); box-shadow:0 4px 16px #0003; font-size:12px; pointer-events:none; }';
        document.head.append(style);
        let scheduled = false;
        const observer = new MutationObserver(() => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; ensureToolbar(); }); });
        observer.observe(document.body, { childList: true, subtree: true });
        ensureToolbar();
    }
    if (document.body && document.head) setupToolbar(); else document.addEventListener("DOMContentLoaded", setupToolbar, { once: true });
    async function sendEditor(editor) {
        if (busy) return;
        const text = editor.innerText.trim();
        if (!text) return;
        if (editor.querySelector("img, video, audio, [data-attachment]")) { showError("TTS 发送暂只支持纯文字，请先处理附件。"); return; }
        const peer = currentPeer(editor);
        if (!peer) { showError("未能识别当前会话，原文字已保留。"); return; }
        busy = true; updateToolbar();
        try {
            await sendTts(text, peer, current.voice, bridge);
            if (editor.isConnected && editor.innerText.trim() === text && !clearSentComposer(editor, text)) showError("语音已发送，但输入框未能清空，请手动清空以避免重复发送。");
        } catch (error) { showError(error?.message || "语音发送失败，原文字已保留。"); }
        finally { busy = false; updateToolbar(); }
    }
    document.addEventListener("keydown", event => {
        if (!current.enabled || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
        const editor = event.target?.closest?.(".ck-editor__editable, .qq-msg-editor");
        if (!editor || !editor.closest(".chat-input-area") || !editor.innerText.trim()) return;
        event.preventDefault(); event.stopImmediatePropagation(); sendEditor(editor);
    }, true);
    document.addEventListener("click", event => {
        if (!current.enabled || !event.target?.closest?.(".chat-input-area .send-btn-wrap, .chat-input-area [aria-label='发送']")) return;
        const editor = document.querySelector(".chat-input-area .ck-editor__editable, .chat-input-area .qq-msg-editor");
        if (!editor?.innerText.trim()) return;
        event.preventDefault(); event.stopImmediatePropagation(); sendEditor(editor);
    }, true);
    return { ready, get settings() { return current; }, onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }, save };
}
