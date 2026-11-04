import { readConfig, writeConfig } from "./config.js";
import { installRecallBadges } from "./recall-badges.js";
import { installTelegramBubbles } from "./telegram-bubbles.js";
import { mountTelegramSettings } from "./telegram-settings.js";
import { installThemeColor } from "./theme-color.js";
import { installAutoRedPacket, redPacketSettings } from "./red-packet.js";
import { installTtsController, TTS_VOICES } from "./tts.js";
import { installLiuliComposerFix } from "./liuli-composer.js";
import { installQQUpdateUiGuard } from "./qq-update.js";
import { installBiliExternal } from "./bili-external.js";
import { installContextMenu, contextMenuSettings, seenMenuItems } from "./context-menu.js";
import { installReactions, reactionSettings, reactionDetails, unicodeReactionId } from "./reactions.js";
import { unicodeEmojiGroups, ensureUnicodeEmojiFont } from "./unicode-emoji.js";
import { installGroupActions } from "./group-actions.js";
import { installContextMenuPositioning } from "./menu-position.js";
import { installReactionBurst } from "./reaction-burst.js";

installRecallBadges();
const telegram = installTelegramBubbles();
const themeColor = installThemeColor();
installAutoRedPacket();
const tts = installTtsController();
installLiuliComposerFix();
installQQUpdateUiGuard();
installBiliExternal();
installContextMenu();
installReactions();
installGroupActions();
installContextMenuPositioning();
installReactionBurst();

const TAB_KEY = "enhancedqq-settings-tab";
const tabs = ["chat", "misc", "about"];
const CHAT_TAB_KEY = "enhancedqq-chat-tab";
const chatTabs = ["messages", "appearance", "interaction", "tts"];

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
      <button type="button" id="enhancedqq-chat-tab-interaction" role="tab" aria-controls="enhancedqq-chat-page-interaction" data-chat-tab="interaction">菜单与回应</button>
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
      <div class="group">分享</div>
      <div class="field"><div class="option-row"><div class="field-label">浏览器打开 B 站视频</div><div class="segments" role="group" aria-label="浏览器打开 B 站视频"><button type="button" data-bili-external="false" disabled>关闭</button><button type="button" data-bili-external="true" disabled>开启</button></div></div><p class="field-hint">点击聊天中的 B 站视频小程序卡片时，直接在系统默认浏览器中打开。</p></div>
      <p class="save-status" role="status" aria-live="polite" data-bili-status></p>
    </section>
    <section id="enhancedqq-chat-page-appearance" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-appearance" data-chat-page="appearance" hidden>
      <div data-telegram-appearance></div>
    </section>
    <section id="enhancedqq-chat-page-interaction" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-interaction" data-chat-page="interaction" hidden>
      <div class="group">右键菜单</div>
      <div class="field"><div class="option-row"><div class="field-label">自定义显示项目</div><div class="segments" role="group" aria-label="自定义右键菜单"><button type="button" data-menu-enabled="false" disabled>关闭</button><button type="button" data-menu-enabled="true" disabled>开启</button></div></div><p class="field-hint">点选要显示的菜单项。右键不同类型的消息后，新发现的项目会自动加入列表；琉璃的菜单排序仍可使用。</p></div>
      <div class="menu-choice-list" data-menu-items></div><p class="save-status" role="status" data-menu-status></p>
      <div class="group">表情回应</div>
      <div class="field"><div class="option-row"><div class="field-label">扩展表情回应</div><div class="segments" role="group" aria-label="扩展表情回应"><button type="button" data-reaction-setting="enabled" data-value="false" disabled>关闭</button><button type="button" data-reaction-setting="enabled" data-value="true" disabled>开启</button></div></div><p class="field-hint">在群消息中使用 QQ 的更多本地表情；实际可用范围由 QQ 决定。</p></div>
      <div class="field"><div class="option-row"><div class="field-label">扩展回应面板</div><div class="segments" role="group" aria-label="扩展回应面板"><button type="button" data-reaction-setting="expandPanel" data-value="false" disabled>关闭</button><button type="button" data-reaction-setting="expandPanel" data-value="true" disabled>开启</button></div></div></div>
      <div class="field"><div class="option-row"><div class="field-label">消息右键显示 Reaction 轰炸</div><div class="segments" role="group" aria-label="Reaction 轰炸"><button type="button" data-reaction-setting="burstEnabled" data-value="false" disabled>关闭</button><button type="button" data-reaction-setting="burstEnabled" data-value="true" disabled>开启</button></div></div><p class="field-hint">选择消息后设置表情、次数和间隔；执行过程中可以停止。</p></div>
      <div class="field"><div class="option-row"><div class="field-label">快捷栏模式</div><div class="segments" role="group" aria-label="快捷回应栏模式"><button type="button" data-reaction-setting="quickMode" data-value="append" disabled>追加到默认</button><button type="button" data-reaction-setting="quickMode" data-value="custom" disabled>仅自选</button></div></div><p class="field-hint">最多选择 24 个快捷回应，按选择顺序排列。</p></div>
      <div class="field"><label class="field-label" for="enhancedqq-reaction-search">选择快捷回应</label><div class="reaction-search-row"><input id="enhancedqq-reaction-search" class="telegram-value reaction-search" data-reaction-search placeholder="搜索表情名称" type="search"><select class="telegram-value reaction-category" data-reaction-category aria-label="快捷回应分类"><option value="all">全部分类</option><option value="qq">QQ 本地</option></select></div></div>
      <div class="field-hint" data-reaction-count></div><div class="reaction-selected" data-reaction-selected></div>
      <div class="reaction-choices" data-reaction-choices></div>
      <div class="field"><div class="option-row"><label class="field-label" for="enhancedqq-reaction-custom">添加 Emoji</label><div class="reaction-custom"><input id="enhancedqq-reaction-custom" class="telegram-value" data-reaction-custom placeholder="例如 🦊"><button type="button" data-reaction-add disabled>添加</button></div></div></div>
      <p class="save-status" role="status" aria-live="polite" data-reaction-status></p>
      <div class="group">群管理</div>
      <div class="field"><div class="option-row"><div class="field-label">头像右键管理</div><div class="segments" role="group" aria-label="头像右键管理"><button type="button" data-group-tools="false" disabled>关闭</button><button type="button" data-group-tools="true" disabled>开启</button></div></div><p class="field-hint">群主可设置成员头衔；群主和管理员可按秒设置禁言，具体权限以 QQ 为准。</p></div>
      <p class="save-status" role="status" aria-live="polite" data-group-tools-status></p>
    </section>
    <section id="enhancedqq-chat-page-tts" role="tabpanel" aria-labelledby="enhancedqq-chat-tab-tts" data-chat-page="tts" hidden>
      <div class="group">文字转语音</div>
      <div class="field"><div class="option-row"><div class="field-label">TTS 语音发送</div><div class="segments" role="group" aria-label="TTS 语音发送"><button type="button" data-tts-enabled="false" disabled>关闭</button><button type="button" data-tts-enabled="true" disabled>开启</button></div></div><p class="field-hint">开启后，输入框中的文字会通过微软 Edge 语音合成并以语音消息发送。也可在聊天框的“+”菜单中切换。</p></div>
      <div class="field"><div class="option-row"><label class="field-label" for="enhancedqq-tts-voice">语音音色</label><select id="enhancedqq-tts-voice" class="telegram-value tts-voice" data-tts-voice disabled></select></div></div>
      <p class="save-status" role="status" aria-live="polite" data-tts-status></p>
    </section>
  </section>
  <section id="enhancedqq-page-misc" role="tabpanel" aria-labelledby="enhancedqq-tab-misc" data-page="misc" hidden>
    <div class="group">QQ 更新</div>
    <div class="field"><div class="option-row"><div class="field-label">屏蔽 QQ 更新</div><div class="segments" role="group" aria-label="屏蔽 QQ 更新"><button type="button" data-update-block="false" disabled>关闭</button><button type="button" data-update-block="true" disabled>开启</button></div></div><p class="field-hint">阻止 QQ 更新并隐藏检查更新入口；关闭后可在 QQ 通用设置中重新开启自动安装。</p></div>
    <p class="save-status" role="status" aria-live="polite" data-update-status></p>
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
    <div class="info-row"><span>作者</span><span>Theresa-owo</span></div>
    <div class="info-row"><span>LiteLoaderQQNT</span><span data-loader>—</span></div>
    <div class="info-row"><span>QQ</span><span data-qq>—</span></div>
    <p class="field-hint">设置界面跟随琉璃的配色与外观。</p>
    <div class="group">EnhancedQQ 更新</div>
    <div class="field"><div class="option-row"><div class="field-label">自动检查插件更新</div><div class="segments" role="group" aria-label="自动检查插件更新"><button type="button" data-plugin-auto="false" disabled>关闭</button><button type="button" data-plugin-auto="true" disabled>开启</button></div></div><p class="field-hint">检查 GitHub 正式 Release；发现新版时由你选择是否安装。</p></div>
    <div class="info-row"><span>版本状态</span><span data-plugin-update-state>尚未检查</span></div>
    <div class="segments"><button type="button" data-plugin-check disabled>检查更新</button><button type="button" data-plugin-release disabled>查看 Release</button><button type="button" data-plugin-install hidden>安装更新</button></div>
    <p class="save-status" role="status" aria-live="polite" data-plugin-update-message></p>
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
    shadow.querySelector("[data-version]").textContent = info.plugins?.enhancedqq?.manifest?.version || "0.9.6";
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

    const biliButtons = [...shadow.querySelectorAll("[data-bili-external]")];
    const biliStatus = shadow.querySelector("[data-bili-status]");
    let biliEnabled = false, biliReady = false, biliSaving = false;
    function renderBili() {
        for (const button of biliButtons) {
            const selected = (button.dataset.biliExternal === "true") === biliEnabled;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !biliReady || biliSaving;
        }
    }
    readConfig(api).then(config => { biliEnabled = config.features?.biliExternal?.enabled === true; biliReady = true; renderBili(); })
        .catch(() => { biliStatus.textContent = "读取配置失败"; });
    globalThis.EnhancedQQ?.onState?.(state => { if (!biliReady || biliSaving) return; biliEnabled = state?.biliExternal?.enabled === true; renderBili(); });
    for (const button of biliButtons) button.addEventListener("click", async () => {
        biliSaving = true; renderBili(); biliStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api);
            const previous = config.features?.biliExternal;
            const biliExternal = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
            const updated = { ...biliExternal, enabled: button.dataset.biliExternal === "true" };
            await writeConfig(api, { features: { biliExternal: updated } });
            biliEnabled = updated.enabled;
            globalThis.EnhancedQQ?.configChanged?.();
            biliStatus.textContent = "设置已保存";
        } catch (error) { biliStatus.textContent = error?.message || "保存失败"; }
        finally { biliSaving = false; renderBili(); }
    });
    renderBili();

    const updateButtons = [...shadow.querySelectorAll("[data-update-block]")];
    const updateStatus = shadow.querySelector("[data-update-status]");
    let updateEnabled = false, updateReady = false, updateSaving = false;
    function renderUpdate() {
        for (const button of updateButtons) {
            const selected = (button.dataset.updateBlock === "true") === updateEnabled;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !updateReady || updateSaving;
        }
    }
    readConfig(api).then(config => { updateEnabled = config.features?.blockUpdate?.enabled === true; updateReady = true; renderUpdate(); })
        .catch(() => { updateStatus.textContent = "读取配置失败"; });
    globalThis.EnhancedQQ?.onState?.(state => { if (!updateReady || updateSaving) return; updateEnabled = state?.blockUpdate?.enabled === true; renderUpdate(); });
    for (const button of updateButtons) button.addEventListener("click", async () => {
        updateSaving = true; renderUpdate(); updateStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api);
            const previous = config.features?.blockUpdate;
            const blockUpdate = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
            const updated = { ...blockUpdate, enabled: button.dataset.updateBlock === "true" };
            await writeConfig(api, { features: { blockUpdate: updated } });
            updateEnabled = updated.enabled;
            globalThis.EnhancedQQ?.configChanged?.();
            updateStatus.textContent = "设置已保存";
        } catch (error) { updateStatus.textContent = error?.message || "保存失败"; }
        finally { updateSaving = false; renderUpdate(); }
    });
    renderUpdate();

    const pluginAutoButtons = [...shadow.querySelectorAll("[data-plugin-auto]")];
    const pluginCheckButton = shadow.querySelector("[data-plugin-check]");
    const pluginReleaseButton = shadow.querySelector("[data-plugin-release]");
    const pluginInstallButton = shadow.querySelector("[data-plugin-install]");
    const pluginStatus = shadow.querySelector("[data-plugin-update-state]");
    const pluginMessage = shadow.querySelector("[data-plugin-update-message]");
    const bridge = globalThis.EnhancedQQ;
    let pluginAuto = true, pluginAutoReady = false, pluginAutoSaving = false, pluginStateReceived = false, pluginUiError = "";
    let releaseState = { status: "idle", autoCheck: true };
    function renderPluginUpdate() {
        for (const button of pluginAutoButtons) {
            const selected = (button.dataset.pluginAuto === "true") === pluginAuto;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !pluginAutoReady || pluginAutoSaving;
        }
        const labels = { idle: "尚未检查", checking: "正在检查…", "no-release": "尚无正式 Release", current: "已是最新版本", available: `发现新版 ${releaseState.latest || ""}`, installing: "正在安装…", installed: "更新已安装", error: "检查失败" };
        pluginStatus.textContent = labels[releaseState.status] || "尚未检查";
        pluginMessage.textContent = pluginUiError || releaseState.message || (releaseState.status === "available" && !releaseState.installable ? "此 Release 尚未提供可安装的 EnhancedQQ.zip，可打开发布页查看。" : "");
        pluginCheckButton.disabled = !bridge?.checkPluginUpdate || ["checking", "installing", "installed"].includes(releaseState.status);
        pluginReleaseButton.disabled = !bridge?.openPluginRelease;
        pluginInstallButton.hidden = releaseState.status !== "available" || !releaseState.installable;
        pluginInstallButton.disabled = !bridge?.installPluginUpdate;
        shadow.querySelector('[data-tab="about"]').textContent = releaseState.status === "available" ? "关于 · 有更新" : "关于";
    }
    readConfig(api).then(config => { if (!pluginStateReceived) pluginAuto = config.features?.pluginUpdate?.autoCheck !== false; pluginAutoReady = true; renderPluginUpdate(); })
        .catch(() => { pluginUiError = "读取配置失败"; renderPluginUpdate(); });
    function receivePluginState(state) {
        if (!state?.pluginUpdate) return;
        pluginStateReceived = true;
        releaseState = state.pluginUpdate;
        if (!pluginAutoSaving) pluginAuto = releaseState.autoCheck !== false;
        renderPluginUpdate();
    }
    bridge?.onState?.(receivePluginState);
    bridge?.getState?.().then(receivePluginState).catch(() => {});
    for (const button of pluginAutoButtons) button.addEventListener("click", async () => {
        pluginAutoSaving = true; pluginUiError = ""; renderPluginUpdate();
        try {
            const config = await readConfig(api);
            const previous = config.features?.pluginUpdate;
            const pluginUpdate = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
            const updated = { ...pluginUpdate, autoCheck: button.dataset.pluginAuto === "true" };
            await writeConfig(api, { features: { pluginUpdate: updated } });
            pluginAuto = updated.autoCheck;
            bridge?.configChanged?.();
        } catch (error) { pluginUiError = error?.message || "保存失败"; }
        finally { pluginAutoSaving = false; renderPluginUpdate(); }
    });
    pluginCheckButton.addEventListener("click", () => { pluginUiError = ""; bridge?.checkPluginUpdate?.().then(state => receivePluginState({ pluginUpdate: state })).catch(error => { pluginUiError = error?.message || "检查失败"; renderPluginUpdate(); }); });
    pluginReleaseButton.addEventListener("click", () => { pluginUiError = ""; bridge?.openPluginRelease?.().catch(error => { pluginUiError = error?.message || "无法打开发布页"; renderPluginUpdate(); }); });
    pluginInstallButton.addEventListener("click", () => { pluginUiError = ""; bridge?.installPluginUpdate?.().then(state => receivePluginState({ pluginUpdate: state })).catch(error => { pluginUiError = error?.message || "安装失败"; renderPluginUpdate(); }); });
    renderPluginUpdate();

    const menuButtons = [...shadow.querySelectorAll("[data-menu-enabled]")];
    const menuItems = shadow.querySelector("[data-menu-items]");
    const menuStatus = shadow.querySelector("[data-menu-status]");
    let menu = contextMenuSettings({}), menuReady = false, menuSaving = false;
    function renderMenu() {
        for (const button of menuButtons) {
            const selected = (button.dataset.menuEnabled === "true") === menu.enabled;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !menuReady || menuSaving;
        }
        menuItems.replaceChildren();
        for (const label of [...new Set([...seenMenuItems(), ...menu.hiddenItems])]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "menu-choice";
            button.textContent = label;
            const selected = !menu.hiddenItems.includes(label);
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !menuReady || menuSaving || !menu.enabled;
            button.addEventListener("click", () => saveMenu({ hiddenItems: selected ? [...menu.hiddenItems, label] : menu.hiddenItems.filter(item => item !== label) }));
            menuItems.append(button);
        }
    }
    async function saveMenu(patch) {
        menuSaving = true; renderMenu(); menuStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api), previous = config.features?.contextMenu;
            const updated = { ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}), ...patch };
            await writeConfig(api, { features: { contextMenu: updated } });
            menu = contextMenuSettings({ features: { contextMenu: updated } });
            bridge?.configChanged?.(); menuStatus.textContent = "设置已保存";
        } catch (error) { menuStatus.textContent = error?.message || "保存失败"; }
        finally { menuSaving = false; renderMenu(); }
    }
    readConfig(api).then(config => { menu = contextMenuSettings(config); menuReady = true; renderMenu(); }).catch(() => { menuStatus.textContent = "读取配置失败"; });
    bridge?.onState?.(state => { if (!menuReady || menuSaving || !state?.contextMenu) return; menu = contextMenuSettings({ features: { contextMenu: state.contextMenu } }); renderMenu(); });
    window.addEventListener("enhancedqq-context-menu-seen", renderMenu);
    window.addEventListener("storage", event => { if (["enhancedqq-context-menu-seen", "liuli-layout-seen"].includes(event.key)) renderMenu(); });
    for (const button of menuButtons) button.addEventListener("click", () => saveMenu({ enabled: button.dataset.menuEnabled === "true" }));
    renderMenu();

    const reactionControls = [...shadow.querySelectorAll("[data-reaction-setting]")];
    const reactionChoices = shadow.querySelector("[data-reaction-choices]");
    const reactionSelected = shadow.querySelector("[data-reaction-selected]");
    const reactionCount = shadow.querySelector("[data-reaction-count]");
    const reactionSearch = shadow.querySelector("[data-reaction-search]");
    const reactionCategory = shadow.querySelector("[data-reaction-category]");
    const reactionCustom = shadow.querySelector("[data-reaction-custom]");
    const reactionAdd = shadow.querySelector("[data-reaction-add]");
    const reactionStatus = shadow.querySelector("[data-reaction-status]");
    let reaction = reactionSettings({}), reactionCatalog = [], reactionReady = false, reactionSaving = false, reactionVisible = 120;
    function reactionButton(emoji, selected) {
        const button = document.createElement("button");
        button.type = "button"; button.className = "reaction-choice";
        button.title = emoji.label; button.setAttribute("aria-label", emoji.label); button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-active", selected);
        button.disabled = !reactionReady || reactionSaving || !reaction.enabled;
        if (emoji.symbol) button.textContent = emoji.symbol;
        else if (emoji.src) { const image = document.createElement("img"); image.src = emoji.src; image.alt = ""; button.append(image); }
        else button.textContent = emoji.label;
        button.addEventListener("click", () => {
            const next = selected ? reaction.quickIds.filter(id => id !== emoji.id) : [...reaction.quickIds, emoji.id];
            if (next.length > 24) { reactionStatus.textContent = "最多选择 24 个快捷回应。"; return; }
            saveReaction({ quickIds: next });
        });
        return button;
    }
    function renderReactions() {
        for (const button of reactionControls) {
            const key = button.dataset.reactionSetting;
            const selected = key === "quickMode" ? button.dataset.value === reaction.quickMode : (button.dataset.value === "true") === reaction[key];
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.disabled = !reactionReady || reactionSaving || (key !== "enabled" && !reaction.enabled);
        }
        reactionSearch.disabled = reactionCategory.disabled = reactionCustom.disabled = reactionAdd.disabled = !reactionReady || reactionSaving || !reaction.enabled;
        reactionCount.textContent = `已选 ${reaction.quickIds.length} / 24 · 点击已选表情可移除`;
        reactionSelected.replaceChildren();
        for (const id of reaction.quickIds) { const emoji = reactionDetails(id, reactionCatalog); if (emoji) reactionSelected.append(reactionButton(emoji, true)); }
        const previousScroll = reactionChoices.scrollTop;
        reactionChoices.replaceChildren();
        const query = reactionSearch.value.trim().toLowerCase();
        const matches = reactionCatalog.filter(emoji => (reactionCategory.value === "all" || (reactionCategory.value === "qq" ? emoji.qq : emoji.group === reactionCategory.value)) &&
            (!query || `${emoji.symbol || ""} ${emoji.label} ${emoji.keywords || ""} ${emoji.id}`.toLowerCase().includes(query)));
        for (const emoji of matches.slice(0, reactionVisible)) {
            reactionChoices.append(reactionButton(emoji, reaction.quickIds.includes(emoji.id)));
        }
        if (matches.length > reactionVisible) {
            const more = document.createElement("button"); more.type = "button"; more.className = "reaction-choice-more"; more.textContent = "显示更多";
            more.addEventListener("click", () => { reactionVisible += 120; renderReactions(); }); reactionChoices.append(more);
        }
        reactionChoices.scrollTop = previousScroll;
    }
    async function saveReaction(patch) {
        reactionSaving = true; renderReactions(); reactionStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api), previous = config.features?.reactions;
            const updated = { ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}), ...patch };
            await writeConfig(api, { features: { reactions: updated } });
            reaction = reactionSettings({ features: { reactions: updated } });
            bridge?.configChanged?.(); reactionStatus.textContent = "设置已保存";
        } catch (error) { reactionStatus.textContent = error?.message || "保存失败"; }
        finally { reactionSaving = false; renderReactions(); }
    }
    Promise.all([readConfig(api), bridge?.getReactionCatalog?.() || Promise.resolve([]), bridge?.getUnicodeEmojiCatalog?.() || Promise.resolve({})]).then(([config, catalog, unicode]) => {
        ensureUnicodeEmojiFont(bridge);
        reaction = reactionSettings(config);
        const all = new Map();
        for (const emoji of Array.isArray(catalog) ? catalog : []) all.set(emoji.id, { ...reactionDetails(emoji.id, [emoji]), qq: true });
        for (const group of unicodeEmojiGroups(unicode)) {
            const option = document.createElement("option"); option.value = group.name; option.textContent = group.name; reactionCategory.append(option);
            for (const emoji of group.items) all.set(emoji.id, { ...all.get(emoji.id), ...emoji, qq: Boolean(all.get(emoji.id)?.qq), group: group.name });
        }
        reactionCatalog = [...all.values()]; reactionReady = true;
        if (!reactionCatalog.length) reactionStatus.textContent = "未找到 QQ 本地表情资源，仍可手动添加单个 Emoji。";
        renderReactions();
    }).catch(() => { reactionStatus.textContent = "读取表情设置失败"; });
    bridge?.onState?.(state => { if (!reactionReady || reactionSaving || !state?.reactions) return; reaction = reactionSettings({ features: { reactions: state.reactions } }); renderReactions(); });
    for (const button of reactionControls) button.addEventListener("click", () => {
        const key = button.dataset.reactionSetting;
        saveReaction({ [key]: key === "quickMode" ? button.dataset.value : button.dataset.value === "true" });
    });
    reactionSearch.addEventListener("input", () => { reactionVisible = 120; reactionChoices.scrollTop = 0; renderReactions(); });
    reactionCategory.addEventListener("change", () => { reactionVisible = 120; reactionChoices.scrollTop = 0; renderReactions(); });
    reactionChoices.addEventListener("scroll", () => { if (reactionChoices.scrollTop + reactionChoices.clientHeight >= reactionChoices.scrollHeight - 30 && reactionChoices.querySelector(".reaction-choice-more")) { reactionVisible += 120; renderReactions(); } });
    reactionAdd.addEventListener("click", () => {
        const symbol = reactionCustom.value.trim();
        const known = reactionCatalog.find(emoji => emoji.symbol === symbol || emoji.symbol?.replace(/\uFE0F/g, "") === symbol.replace(/\uFE0F/g, ""));
        const id = unicodeReactionId(symbol) || known?.id;
        if (!id) { reactionStatus.textContent = "请输入一个 Emoji。"; return; }
        if (reaction.quickIds.includes(id)) { reactionStatus.textContent = "这个回应已经在快捷栏中。"; return; }
        if (reaction.quickIds.length >= 24) { reactionStatus.textContent = "最多选择 24 个快捷回应。"; return; }
        reactionCustom.value = "";
        saveReaction({ quickIds: [...reaction.quickIds, id] });
    });
    renderReactions();

    const groupButtons = [...shadow.querySelectorAll("[data-group-tools]")];
    const groupStatus = shadow.querySelector("[data-group-tools-status]");
    let groupEnabled = false, groupReady = false, groupSaving = false;
    function renderGroupTools() {
        for (const button of groupButtons) {
            const selected = (button.dataset.groupTools === "true") === groupEnabled;
            button.classList.toggle("is-active", selected); button.setAttribute("aria-pressed", String(selected));
            button.disabled = !groupReady || groupSaving;
        }
    }
    readConfig(api).then(config => { groupEnabled = config.features?.groupTools?.enabled === true; groupReady = true; renderGroupTools(); })
        .catch(() => { groupStatus.textContent = "读取配置失败"; });
    bridge?.onState?.(state => { if (!groupReady || groupSaving || !state?.groupTools) return; groupEnabled = state.groupTools.enabled === true; renderGroupTools(); });
    for (const button of groupButtons) button.addEventListener("click", async () => {
        groupSaving = true; renderGroupTools(); groupStatus.textContent = "正在保存…";
        try {
            const config = await readConfig(api), previous = config.features?.groupTools;
            const updated = { ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}), enabled: button.dataset.groupTools === "true" };
            await writeConfig(api, { features: { groupTools: updated } }); groupEnabled = updated.enabled;
            bridge?.configChanged?.(); groupStatus.textContent = "设置已保存";
        } catch (error) { groupStatus.textContent = error?.message || "保存失败"; }
        finally { groupSaving = false; renderGroupTools(); }
    });
    renderGroupTools();

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
