import { readConfig } from "./config.js";
import { currentPeer } from "./tts.js";

export function avatarGroupTarget(element, doc = document) {
    const avatar = element?.closest?.(".avatar-span, .avatar, .q-avatar");
    if (!avatar) return null;
    const row = avatar.closest(".ml-item"), message = row?.querySelector(".message");
    let record = null;
    for (const node of [message, row]) {
        const instances = [...(Array.isArray(node?.__VUE__) ? node.__VUE__ : []), node?.__vueParentComponent];
        record = instances.find(instance => instance?.props?.msgRecord)?.props?.msgRecord;
        if (record) break;
    }
    const peer = currentPeer(null, doc);
    const fromRecord = Number(record?.chatType) === 2 ? String(record.peerUid || "") : "";
    const fromCurrent = peer?.chatType === 2 ? String(peer.peerUid || "") : "";
    if (fromRecord && fromCurrent && fromRecord !== fromCurrent) return null;
    const group = fromRecord || fromCurrent;
    const member = record?.senderUid;
    return /^\d{5,10}$/.test(String(group || "")) && /^u_[A-Za-z0-9_-]{4,128}$/.test(String(member || "")) ? { group: String(group), member: String(member) } : null;
}

export function installGroupActions() {
    const bridge = globalThis.EnhancedQQ, api = globalThis.LiteLoader?.api?.config;
    if (!bridge?.getGroupCapabilities || !bridge?.performGroupAction || !api) return;
    if (!document.head || !document.documentElement) { document.addEventListener("DOMContentLoaded", installGroupActions, { once: true }); return; }
    let enabled = false, stateReceived = false, sequence = 0;
    const style = document.createElement("style");
    style.textContent = `
.enhancedqq-group-action { display:flex; align-items:center; gap:10px; padding:6px 10px; min-height:28px; cursor:pointer; color:var(--ll-on-glass, var(--text_primary, #333)); }
.enhancedqq-group-action:hover { background:rgba(var(--ll-brand-rgb, 153,203,255),.14); }
.enhancedqq-group-action-icon { width:18px; text-align:center; }
.enhancedqq-group-backdrop { position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center; background:rgba(0,0,0,.25); }
.enhancedqq-group-dialog { width:min(380px, calc(100vw - 48px)); padding:22px; border-radius:var(--ll-radius,14px); background:rgba(var(--ll-acrylic, 245,245,245),.97); box-shadow:var(--ll-float-shadow,0 8px 30px #0004); color:var(--ll-on-glass, #222); font:13px/1.5 var(--ll-font, sans-serif); }
.enhancedqq-group-dialog h3 { margin:0 0 14px; font-size:16px; font-weight:600; }
.enhancedqq-group-dialog input { box-sizing:border-box; width:100%; padding:9px 10px; border:1px solid rgba(var(--ll-on-glass-rgb,128,128,128),.2); border-radius:9px; outline:none; color:inherit; background:rgba(var(--ll-on-glass-rgb,128,128,128),.07); font:inherit; }
.enhancedqq-group-dialog p { margin:8px 0; color:var(--ll-on-glass-2, #777); font-size:12px; }
.enhancedqq-group-buttons { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
.enhancedqq-group-buttons button { border:0; border-radius:9px; padding:7px 15px; background:rgba(var(--ll-on-glass-rgb,128,128,128),.09); color:inherit; font:inherit; cursor:pointer; }
.enhancedqq-group-buttons button[type=submit] { background:var(--ll-primary-container, #dedede); color:var(--ll-on-primary-container, #222); }
`;
    document.head.append(style);
    function dialog(action, target, capabilities) {
        const backdrop = document.createElement("div"); backdrop.className = "enhancedqq-group-backdrop";
        const form = document.createElement("form"); form.className = "enhancedqq-group-dialog"; form.setAttribute("role", "dialog"); form.setAttribute("aria-modal", "true");
        const heading = document.createElement("h3"); heading.textContent = action === "mute" ? "禁言指定秒数" : "设置群头衔"; form.setAttribute("aria-label", heading.textContent);
        const input = document.createElement("input"); input.setAttribute("aria-label", action === "mute" ? "禁言秒数" : "群头衔");
        input.type = action === "mute" ? "number" : "text";
        if (action === "mute") { input.min = "0"; input.max = "2592000"; input.step = "1"; input.value = "60"; }
        else { input.maxLength = 48; input.value = capabilities.title || ""; input.placeholder = "输入群头衔"; }
        const recipient = document.createElement("p"); recipient.textContent = `成员：${capabilities.name || "该成员"}${capabilities.uin ? `（${capabilities.uin}）` : ""}`;
        const hint = document.createElement("p"); hint.textContent = action === "mute" ? "输入 0 可解除禁言；最长 2592000 秒。" : "留空可清除该成员的头衔。";
        const status = document.createElement("p"); status.setAttribute("role", "status");
        const buttons = document.createElement("div"); buttons.className = "enhancedqq-group-buttons";
        const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "取消"; cancel.onclick = () => backdrop.remove();
        const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "确定";
        buttons.append(cancel, submit); form.append(heading, recipient, input, hint, status, buttons); backdrop.append(form); document.body.append(backdrop);
        backdrop.addEventListener("click", event => { if (event.target === backdrop) backdrop.remove(); });
        backdrop.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); backdrop.remove(); } });
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const value = action === "mute" ? Number(input.value) : input.value;
            if (action === "mute" && (!input.value || !Number.isInteger(value) || value < 0 || value > 2592000)) { status.textContent = "请输入 0 到 2592000 之间的整数秒。"; return; }
            submit.disabled = true; status.textContent = "正在提交…";
            try { await bridge.performGroupAction(action, target.group, target.member, value); status.textContent = action === "mute" ? "禁言设置成功。" : "群头衔设置成功。"; cancel.textContent = "关闭"; }
            catch (error) { status.textContent = String(error?.message || "QQ 未确认操作结果。").replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, ""); }
            finally { submit.disabled = false; }
        });
        input.focus(); input.select();
    }
    function addItem(menu, label, icon, action, target, capabilities) {
        const item = document.createElement("div"); item.className = "q-context-menu-item enhancedqq-group-action"; item.setAttribute("role", "menuitem");
        const mark = document.createElement("span"); mark.className = "enhancedqq-group-action-icon"; mark.textContent = icon;
        const text = document.createElement("span"); text.textContent = label; item.append(mark, text);
        item.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); document.documentElement.dispatchEvent(new MouseEvent("click", { bubbles: true })); dialog(action, target, capabilities); });
        menu.append(item);
    }
    document.addEventListener("contextmenu", event => {
        const id = ++sequence;
        if (!enabled) return;
        const target = avatarGroupTarget(event.target);
        if (!target) return;
        const previous = new Set([...document.querySelectorAll(".q-context-menu")].filter(node => node.getBoundingClientRect().width > 0));
        let menu = null, capabilities = null, tries = 0;
        function attach() {
            if (id !== sequence || !enabled || !menu?.isConnected || !capabilities || menu.querySelector(".enhancedqq-group-action")) return;
            if (capabilities.canTitle) addItem(menu, "设置群头衔", "✦", "title", target, capabilities);
            if (capabilities.canMute) addItem(menu, "禁言指定秒数", "◷", "mute", target, capabilities);
        }
        bridge.getGroupCapabilities(target.group, target.member).then(value => { capabilities = value; attach(); }).catch(() => {});
        function findMenu() {
            if (id !== sequence || !enabled || ++tries > 60) return;
            const choices = [...document.querySelectorAll(".q-context-menu")].filter(node => !previous.has(node) && node.getBoundingClientRect().width > 0);
            if (choices.length) {
                choices.sort((a, b) => {
                    const score = node => { const rect = node.getBoundingClientRect(); return Math.abs(rect.left - event.clientX) + Math.abs(rect.top - event.clientY); };
                    return score(a) - score(b);
                });
                menu = choices[0]; attach(); return;
            }
            requestAnimationFrame(findMenu);
        }
        requestAnimationFrame(findMenu);
    }, true);
    bridge.onState?.(state => { stateReceived = true; enabled = state?.groupTools?.enabled === true; });
    readConfig(api).then(config => { if (!stateReceived) enabled = config.features?.groupTools?.enabled === true; })
        .catch(error => console.warn("[EnhancedQQ] Group-action settings unavailable:", error?.message));
}
