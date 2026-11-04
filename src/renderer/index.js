import { readConfig, writeConfig } from "./config.js";
import { installRecallBadges } from "./recall-badges.js";
import { installTelegramBubbles } from "./telegram-bubbles.js";
import { mountTelegramSettings } from "./telegram-settings.js";
import { installThemeColor } from "./theme-color.js";
import { installAutoRedPacket, redPacketSettings } from "./red-packet.js";
import { installTtsController, TTS_VOICES } from "./tts.js";
import { installLiuliComposerFix } from "./liuli-composer.js";

installRecallBadges();
const telegram = installTelegramBubbles();
const themeColor = installThemeColor();
installAutoRedPacket();
const tts = installTtsController();
installLiuliComposerFix();

const TAB_KEY = "enhancedqq-settings-tab";
const tabs = ["chat", "misc", "about"];
const CHAT_TAB_KEY = "enhancedqq-chat-tab";
const chatTabs = ["messages", "appearance", "tts"];

const page = `
<div class="settings">
  <header class="heading"><h2>EnhancedQQ</h2><p>增强功能 · 设置中心</p></header>
  <div class="tabs" role="tablist" aria-label="EnhancedQQ 设置分区">
    <button type="button" id="enhancedqq-tab-chat" role="tab" aria-controls="enhancedqq-page-chat" data-tab="chat">聊天</button>
    <button type="button" id="enhancedqq-tab-misc" role="tab" aria-controls="enhancedqq-page-misc" data-tab="misc">杂项</button>
    <button type="button" id="enhancedqq-tab-about" role="tab" aria-controls="enhancedqq-page-about" data-tab="about">关于</button>
  </div>
  <section id="enhancedqq-page-chat" role="tabpanel" aria-labelledby="enhancedqq-tab-chat" data-page="chat" hidden>
    <div class="subtabs" role="tablist" aria-label="聊天设置分区">
      <button type="button" id="enhancedqq-chat-tab-messages" role="tab" aria-controls="enhancedqq-chat-page-messages" data-chat-tab="messages">消息功能</button>
      <button type="button" id="enhancedqq-chat-tab-appearance" role="tab" aria-controls="enhancedqq-chat-page-appearance" data-chat-tab="appearance">外观</button>
      <button type="button" id="enhancedqq-chat-tab-tts" role="tab" aria-controls="enhancedqq-chat-page-tts" data-chat-tab="tts">语音</button>
    </div>
    <section id="enhancedqq-chat-page-messages" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-messages" data-chat-page="messages" hidden>
      <div class="group">防撤回</div>
      <div class="field"><div class="option-row"><div class="field-label">保留撤回的消息</div><div class="segments" role="group" aria-label="保留撤回的消息"><button type="button" data-setting="enabled" data-value="false" disabled>关闭</button><button type="button" data-setting="enabled" data-value="true" disabled>开启</button></div></div><p class="field-hint">开启后保留已收到的撤回消息；关闭后新的撤回按 QQ 原样处理。</p></div>
      <div class="field"><div class="option-row"><div class="field-label">显示自己撤回的消息</div><div class="segments" role="group" aria-label="显示自己撤回的消息"><button type="button" data-setting="showOwn" data-value="false" disabled>关闭</button><button type="button" data-setting="showOwn" data-value="true" disabled>开启</button></div></div><p class="field-hint">开启后，自己发出的消息被撤回时也会保留，标记显示在消息左侧。</p></div>
      <p class="save-status" role="status" aria-live="polite" data-save-status></p>
      <div class="group">发送排版</div>
      <div class="field"><div class="option-row"><div class="field-label">发送消息自动 Pangu</div><div class="segments" role="group" aria-label="发送消息自动 Pangu"><button type="button" data-pangu-enabled="false" disabled>关闭</button><button type="button" data-pangu-enabled="true" disabled>开启</button></div></div><p class="field-hint">发送时按盘古规则调整中英文、数字间距及部分标点。机器人指令自动跳过；消息以 !PanguSkip 加空格开头可临时跳过。</p></div>
      <p class="save-status" role="status" aria-live="polite" data-pangu-status></p>
    </section>
    <section id="enhancedqq-chat-page-appearance" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-appearance" data-chat-page="appearance" hidden>
      <div data-telegram-appearance></div>
    </section>
    <section id="enhancedqq-chat-page-tts" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-tts" data-chat-page="tts" hidden>
      <div class="group">文字转语音</div>
      <div class="field"><div class="option-row"><div class="field-label">TTS 语音发送</div><div class="segments" role="group" aria-label="TTS 语音发送"><button type="button" data-tts-enabled="false" disabled>关闭</button><button type="button" data-tts-enabled="true" disabled>开启</button></div></div><p class="field-hint">开启后，输入框中的文字会通过微软 Edge 语音合成并以语音消息发送。也可在聊天框的“+”菜单中切换。</p></div>
      <div class="field"><div class="option-row"><label class="field-label" for="enhancedqq-tts-voice">语音音色</label><select id="enhancedqq-tts-voice" class="telegram-value tts-voice" data-tts-voice disabled></select></div></div>
      <p class="save-status" role="status" aria-live="polite" data-tts-status></p>
    </section>
  </section>
  <section id="enhancedqq-page-misc" role="tabpanel" aria-labelledby="enhancedqq-tab-misc" data-page="misc" hidden>
    <div class="group">红包</div>
    <div class="field"><div class="option-row"><div class="field-label">自动抢红包</div><div class="segments" role="group" aria-label="自动抢红包"><button type="button" data-packet-setting="enabled" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="enabled" data-value="true" disabled>开启</button></div></div><p class="field-hint">只处理已开启且能够识别的 QQ 钱包红包类型。</p></div>
    <div class="group">领取类型</div>
    <div class="field"><div class="option-row"><div class="field-label">普通 / 拼手气红包</div><div class="segments" role="group" aria-label="普通和拼手气红包"><button type="button" data-packet-setting="lucky" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="lucky" data-value="true" disabled>开启</button></div></div></div>
    <div class="field"><div class="option-row"><div class="field-label">专属红包</div><div class="segments" role="group" aria-label="专属红包"><button type="button" data-packet-setting="exclusive" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="exclusive" data-value="true" disabled>开启</button></div></div></div>
    <div class="field"><div class="option-row"><div class="field-label">语音红包</div><div class="segments" role="group" aria-label="语音红包"><button type="button" data-packet-setting="voice" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="voice" data-value="true" disabled>开启</button></div></div><p class="field-hint">需至少开启一种语音红包领取方式；两种都开启时优先直接领取。</p></div>
    <div class="field"><div class="option-row"><div class="field-label">语音红包：直接领取</div><div class="segments" role="group" aria-label="语音红包直接领取"><button type="button" data-packet-setting="voiceDirect" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="voiceDirect" data-value="true" disabled>开启</button></div></div><p class="field-hint">Windows QQ 的语音验证接口仍在适配。</p></div>
    <div class="field"><div class="option-row"><div class="field-label">语音红包：发送 TTS</div><div class="segments" role="group" aria-label="语音红包发送 TTS"><button type="button" data-packet-setting="voiceTts" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="voiceTts" data-value="true" disabled>开启</button></div></div><p class="field-hint">当前 QQ 显示“请在新版手机 QQ 查看”时无法读取口令，不能自动发送；语音红包领取尚未验证。</p></div>
    <div class="field"><div class="option-row"><div class="field-label">文字红包</div><div class="segments" role="group" aria-label="文字红包"><button type="button" data-packet-setting="text" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="text" data-value="true" disabled>开启</button></div></div><p class="field-hint">开启后自动向红包所在会话发送目标文字。</p></div>
    <div class="field"><div class="option-row"><div class="field-label">发送文字后撤回</div><div class="segments" role="group" aria-label="发送文字后撤回"><button type="button" data-packet-setting="recallText" data-value="false" disabled>关闭</button><button type="button" data-packet-setting="recallText" data-value="true" disabled>开启</button></div></div></div>
    <p class="save-status" role="status" aria-live="polite" data-red-packet-status></p>
  </section>
  <section id="enhancedqq-page-about" role="tabpanel" aria-labelledby="enhancedqq-tab-about" data-page="about" hidden>
    <div class="group">插件信息</div>
    <div class="info-row"><span>EnhancedQQ</span><span data-version>—</span></div>
    <div class="info-row"><span>LiteLoaderQQNT</span><span data-loader>—</span></div>
    <div class="info-row"><span>QQ</span><span data-qq>—</span></div>
    <p class="field-hint">设置界面跟随琉璃的配色与外观。</p>
  </section>
</div>`;

function savedTab() {
    try {
        const value = localStorage.getItem(TAB_KEY);
        return tabs.includes(value) ? value : tabs[0];
    } catch { return tabs[0]; }
}

export function onSettingWindowCreated(view) {
    const host = document.createElement("div");
    host.className = "enhancedqq-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = new URL("./style.css", import.meta.url).href;
    shadow.append(style);
    const surface = document.createElement("div");
    surface.innerHTML = page;
    shadow.append(surface);
    view.replaceChildren(host);

    const info = globalThis.LiteLoader || {};
    shadow.querySelector("[data-version]").textContent = info.plugins?.enhancedqq?.manifest?.version || "0.9.4";
    shadow.querySelector("[data-loader]").textContent = info.versions?.liteloader || "—";
    shadow.querySelector("[data-qq]").textContent = info.versions?.qqnt || "—";

    function show(key, persist = false, focus = false) {
        if (!tabs.includes(key)) key = tabs[0];
        for (const button of shadow.querySelectorAll("[data-tab]")) {
            const selected = button.dataset.tab === key;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
            if (selected && focus) button.focus();
        }
        for (const panel of shadow.querySelectorAll("[data-page]")) panel.hidden = panel.dataset.page !== key;
        if (persist) {
            try { localStorage.setItem(TAB_KEY, key); } catch { /* Navigation still works without persistence. */ }
        }
    }

    const tablist = shadow.querySelector("[role=tablist]");
    tablist.addEventListener("click", event => {
        const button = event.target.closest("[data-tab]");
        if (button) show(button.dataset.tab, true);
    });
    tablist.addEventListener("keydown", event => {
        const current = tabs.indexOf(event.target.dataset.tab);
        if (current < 0) return;
        let next;
        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        show(tabs[next], true, true);
    });
    show(savedTab());

    function showChatTab(key, persist = false, focus = false) {
        if (!chatTabs.includes(key)) key = chatTabs[0];
        for (const button of shadow.querySelectorAll("[data-chat-tab]")) {
            const selected = button.dataset.chatTab === key;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
            if (selected && focus) button.focus();
        }
        for (const panel of shadow.querySelectorAll("[data-chat-page]")) panel.hidden = panel.dataset.chatPage !== key;
        if (persist) {
            try { localStorage.setItem(CHAT_TAB_KEY, key); } catch { /* Navigation still works without persistence. */ }
        }
    }
    const chatTablist = shadow.querySelector(".subtabs");
    chatTablist.addEventListener("click", event => {
        const button = event.target.closest("[data-chat-tab]");
        if (button) showChatTab(button.dataset.chatTab, true);
    });
    chatTablist.addEventListener("keydown", event => {
        const current = chatTabs.indexOf(event.target.dataset.chatTab);
        if (current < 0) return;
        let next;
        if (event.key === "ArrowRight") next = (current + 1) % chatTabs.length;
        else if (event.key === "ArrowLeft") next = (current - 1 + chatTabs.length) % chatTabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = chatTabs.length - 1;
        else return;
        event.preventDefault();
        showChatTab(chatTabs[next], true, true);
    });
    let initialChatTab;
    try { initialChatTab = localStorage.getItem(CHAT_TAB_KEY); } catch { /* Use the first section. */ }
    showChatTab(initialChatTab);

    const api = info.api?.config;
    mountTelegramSettings(shadow.querySelector("[data-telegram-appearance]"), telegram, themeColor, api).catch(error => {
        shadow.querySelector("[data-telegram-appearance]").textContent = `外观设置加载失败：${error?.message || "未知错误"}`;
    });
    const controls = [...shadow.querySelectorAll("[data-setting]")];
    const status = shadow.querySelector("[data-save-status]");
    let enabled = true;
    let showOwn = false;
    let ready = false;
    let saving = false;
    function renderSettings() {
        for (const button of controls) {
            const value = button.dataset.setting === "enabled" ? enabled : showOwn;
            const selected = (button.dataset.value === "true") === value;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !ready || saving || (button.dataset.setting === "showOwn" && !enabled);
        }
    }
    async function loadSettings() {
        const config = await readConfig(api);
        enabled = config.features?.antiRecall?.enabled !== false;
        showOwn = config.features?.antiRecall?.showOwn === true;
        renderSettings();
    }
    renderSettings();
    loadSettings().then(() => { ready = true; renderSettings(); }).catch(() => { status.textContent = "读取配置失败"; });
    globalThis.EnhancedQQ?.onState?.(state => {
        if (!ready || saving) return;
        enabled = state?.enabled !== false;
        showOwn = state?.showOwn === true;
        renderSettings();
    });
    for (const button of controls) button.addEventListener("click", async () => {
        saving = true;
        renderSettings();
        status.textContent = "正在保存…";
        try {
            const config = await readConfig(api);
            const previous = config.features?.antiRecall;
            const antiRecall = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
            const updated = { ...antiRecall, [button.dataset.setting]: button.dataset.value === "true" };
            await writeConfig(api, { features: { antiRecall: updated } });
            enabled = updated.enabled !== false;
            showOwn = updated.showOwn === true;
            globalThis.EnhancedQQ?.configChanged?.();
            status.textContent = "设置已保存";
        } catch (error) {
            try { await loadSettings(); } catch { /* Keep the last visible value. */ }
            status.textContent = error?.message || "保存失败";
        } finally { saving = false; renderSettings(); }
    });

    const panguButtons = [...shadow.querySelectorAll("[data-pangu-enabled]")];
    const panguStatus = shadow.querySelector("[data-pangu-status]");
    let panguEnabled = true, panguReady = false, panguSaving = false;
    function renderPangu() {
        for (const button of panguButtons) {
            const selected = (button.dataset.panguEnabled === "true") === panguEnabled;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !panguReady || panguSaving;
        }
    }
    readConfig(api).then(config => {
        panguEnabled = config.features?.pangu?.enabled !== false;
        panguReady = true;
        renderPangu();
    }).catch(() => { panguStatus.textContent = "读取配置失败"; });
    globalThis.EnhancedQQ?.onState?.(state => {
        if (!panguReady || panguSaving) return;
        panguEnabled = state?.pangu?.enabled !== false;
        renderPangu();
    });
    for (const button of panguButtons) button.addEventListener("click", async () => {
        panguSaving = true; renderPangu(); panguStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api);
            const previous = config.features?.pangu;
            const pangu = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
            const updated = { ...pangu, enabled: button.dataset.panguEnabled === "true" };
            await writeConfig(api, { features: { pangu: updated } });
            panguEnabled = updated.enabled;
            globalThis.EnhancedQQ?.configChanged?.();
            panguStatus.textContent = "设置已保存";
        } catch (error) { panguStatus.textContent = error?.message || "保存失败"; }
        finally { panguSaving = false; renderPangu(); }
    });
    renderPangu();

    const redPacketControls = [...shadow.querySelectorAll("[data-packet-setting]")];
    const redPacketStatus = shadow.querySelector("[data-red-packet-status]");
    let packet = redPacketSettings({});
    let redPacketReady = false;
    let redPacketSaving = false;
    function renderRedPacket() {
        for (const button of redPacketControls) {
            const key = button.dataset.packetSetting;
            const value = ["lucky", "voice", "text", "exclusive"].includes(key) ? packet.types[key] : packet[key];
            const selected = (button.dataset.value === "true") === value;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !redPacketReady || redPacketSaving || (key === "voiceDirect" && !globalThis.EnhancedQQ?.claimVoiceRedPacketDirect);
        }
    }
    readConfig(api).then(config => {
        packet = redPacketSettings(config);
        redPacketReady = true;
        renderRedPacket();
    }).catch(() => { redPacketStatus.textContent = "读取配置失败"; });
    globalThis.EnhancedQQ?.onState?.(state => {
        if (!redPacketReady || redPacketSaving) return;
        packet = redPacketSettings({ features: { autoRedPacket: state?.autoRedPacket } });
        renderRedPacket();
    });
    for (const button of redPacketControls) button.addEventListener("click", async () => {
        redPacketSaving = true;
        renderRedPacket();
        redPacketStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api);
            const updated = redPacketSettings(config);
            const key = button.dataset.packetSetting;
            const value = button.dataset.value === "true";
            if (key === "voice" && value && !updated.voiceDirect && !updated.voiceTts) throw new Error("请先开启一种语音红包领取方式。");
            if (["lucky", "voice", "text", "exclusive"].includes(key)) updated.types[key] = value;
            else updated[key] = value;
            if (["voiceDirect", "voiceTts"].includes(key) && !updated.voiceDirect && !updated.voiceTts) updated.types.voice = false;
            await writeConfig(api, { features: { autoRedPacket: updated } });
            packet = updated;
            globalThis.EnhancedQQ?.configChanged?.();
            redPacketStatus.textContent = "设置已保存";
        } catch (error) { redPacketStatus.textContent = error?.message || "保存失败"; }
        finally { redPacketSaving = false; renderRedPacket(); }
    });

    const ttsButtons = [...shadow.querySelectorAll("[data-tts-enabled]")];
    const ttsVoice = shadow.querySelector("[data-tts-voice]");
    const ttsStatus = shadow.querySelector("[data-tts-status]");
    for (const [value, label] of TTS_VOICES) { const option = document.createElement("option"); option.value = value; option.textContent = label; ttsVoice.append(option); }
    let ttsReady = false, ttsSaving = false;
    function renderTts() {
        const settings = tts?.settings;
        for (const button of ttsButtons) {
            const selected = (button.dataset.ttsEnabled === "true") === !!settings?.enabled;
            button.classList.toggle("is-active", selected); button.setAttribute("aria-pressed", String(selected)); button.disabled = !ttsReady || ttsSaving;
        }
        ttsVoice.disabled = !ttsReady || ttsSaving;
        if (settings) ttsVoice.value = settings.voice;
    }
    async function saveTts(change) {
        ttsSaving = true; renderTts(); ttsStatus.textContent = "正在保存…";
        try { await tts.save(change); ttsStatus.textContent = "设置已保存"; }
        catch (error) { ttsStatus.textContent = error?.message || "保存失败"; }
        finally { ttsSaving = false; renderTts(); }
    }
    if (tts) {
        tts.onChange(renderTts);
        tts.ready.then(() => { ttsReady = true; renderTts(); }).catch(() => { ttsStatus.textContent = "读取语音设置失败"; });
        for (const button of ttsButtons) button.addEventListener("click", () => saveTts(next => { next.enabled = button.dataset.ttsEnabled === "true"; }));
        ttsVoice.addEventListener("change", () => saveTts(next => { next.voice = ttsVoice.value; }));
    } else ttsStatus.textContent = "语音服务未加载。";
    renderTts();
}
