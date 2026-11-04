import { readConfig } from "./config.js";
import { reactionSettings, resolveReactionContext } from "./reactions.js";
import { unicodeEmojiGroups, unicodeReactionId, rememberRecentEmoji } from "./unicode-emoji.js";

function abortError() { return Object.assign(new Error("已停止。"), { name: "AbortError" }); }
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(abortError()); return; }
        const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
        function abort() { clearTimeout(timer); reject(abortError()); }
        signal?.addEventListener("abort", abort, { once: true });
    });
}
function clicked(record, id) {
    const value = record?.emojiLikesList?.find?.(item => String(item.emojiId) === id)?.isClicked;
    return [true, 1, "1"].includes(value);
}

export async function runReactionBurst({ context, mode, emojiId, count, intervalMs, pool = [], send, signal, onProgress = () => {}, wait = sleep, random = Math.random }) {
    if (!context?.peer || !/^\d+$/.test(String(context.msgSeq)) || !["single", "random"].includes(mode) ||
        !Number.isInteger(count) || count < 1 || count > 1000 || !Number.isInteger(intervalMs) || intervalMs < 500 || intervalMs > 60000 || typeof send !== "function") throw new Error("次数或间隔无效。");
    let requests = 0, completed = 0;
    async function dispatch(id, setEmoji, stopping = false) {
        if (!stopping && signal?.aborted) throw abortError();
        if (requests) await wait(intervalMs, stopping ? undefined : signal);
        if (!stopping && signal?.aborted) throw abortError();
        await send({ peer: context.peer, msgSeq: context.msgSeq, emojiId: id.startsWith("u:") ? id.slice(2) : id, emojiType: "2", setEmoji });
        requests++;
    }
    if (mode === "random") {
        const choices = [...new Set(pool.map(String).filter(id => /^\d{1,10}$/.test(id) && !clicked(context.record, id)))];
        if (count > choices.length) throw new Error(`可用的不重复表情只有 ${choices.length} 个。`);
        for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
        for (const id of choices.slice(0, count)) { await dispatch(id, true); onProgress(++completed, count); }
        return { completed, requests };
    }
    if (typeof emojiId !== "string" || !emojiId) throw new Error("请输入一个 Emoji。");
    const wireId = emojiId.startsWith("u:") ? emojiId.slice(2) : emojiId, initial = clicked(context.record, wireId);
    let active = initial, failure = null;
    try {
        if (initial) { await dispatch(emojiId, false); active = false; }
        for (let i = 0; i < count; i++) {
            await dispatch(emojiId, true); active = true;
            await dispatch(emojiId, false); active = false;
            onProgress(++completed, count);
        }
    } catch (error) { failure = error; }
    if (active !== initial) {
        try { await dispatch(emojiId, initial, true); }
        catch { failure = new Error(`${failure?.message || "执行结束"}；未能恢复原有回应状态。`); }
    }
    if (failure) throw failure;
    return { completed, requests };
}

export function installReactionBurst() {
    const bridge = globalThis.EnhancedQQ, api = globalThis.LiteLoader?.api?.config;
    if (!bridge?.sendReaction || !bridge?.getUnicodeEmojiCatalog || !api) return;
    if (!document.head || !document.documentElement) { document.addEventListener("DOMContentLoaded", installReactionBurst, { once: true }); return; }
    let settings = reactionSettings({}), stateReceived = false, sequence = 0, emojiPromise;
    const style = document.createElement("style");
    style.textContent = `
.enhancedqq-burst-backdrop { position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center; background:rgba(0,0,0,.25); }
.enhancedqq-burst-dialog { width:min(400px,calc(100vw - 48px)); padding:22px; border-radius:var(--ll-radius,14px); background:rgba(var(--ll-acrylic,245,245,245),.97); box-shadow:var(--ll-float-shadow,0 8px 30px #0004); color:var(--ll-on-glass,#222); font:13px/1.5 var(--ll-font,sans-serif); }
.enhancedqq-burst-dialog h3 { margin:0 0 14px; font-size:16px; }.enhancedqq-burst-dialog label { display:block; margin:10px 0 4px; }
.enhancedqq-burst-dialog [hidden] { display:none !important; }
.enhancedqq-burst-dialog input,.enhancedqq-burst-dialog select { box-sizing:border-box; width:100%; padding:8px; border:1px solid rgba(var(--ll-on-glass-rgb,128,128,128),.2); border-radius:8px; background:rgba(var(--ll-on-glass-rgb,128,128,128),.07); color:inherit; font:inherit; }
.enhancedqq-burst-dialog p { margin:8px 0; color:var(--ll-on-glass-2,#777); font-size:12px; }.enhancedqq-burst-buttons { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
.enhancedqq-burst-buttons button { border:0; border-radius:8px; padding:7px 14px; background:rgba(var(--ll-on-glass-rgb,128,128,128),.09); color:inherit; font:inherit; cursor:pointer; }
.enhancedqq-burst-buttons button[type=submit] { background:var(--ll-primary-container,#dedede); color:var(--ll-on-primary-container,#222); }
`;
    document.head.append(style);
    function catalog() { return emojiPromise ||= bridge.getUnicodeEmojiCatalog().then(unicodeEmojiGroups).then(groups => groups.flatMap(group => group.items)); }
    function dialog(context) {
        const overlay = document.createElement("div"); overlay.className = "enhancedqq-burst-backdrop";
        const form = document.createElement("form"); form.className = "enhancedqq-burst-dialog"; form.setAttribute("role", "dialog"); form.setAttribute("aria-label", "Reaction 轰炸");
        const heading = document.createElement("h3"); heading.textContent = "Reaction 轰炸";
        const makeField = (labelText, input) => { const label = document.createElement("label"); label.textContent = labelText; label.append(input); return label; };
        const mode = document.createElement("select"); mode.setAttribute("aria-label", "模式");
        for (const [value, text] of [["single", "单表情轰炸"], ["random", "多表情随机"]]) { const option = document.createElement("option"); option.value = value; option.textContent = text; mode.append(option); }
        const emoji = document.createElement("input"); emoji.type = "text"; emoji.value = "🐱"; emoji.setAttribute("aria-label", "Emoji");
        const emojiField = makeField("Emoji", emoji);
        const count = document.createElement("input"); count.type = "number"; count.min = "1"; count.max = "1000"; count.step = "1"; count.value = "5"; count.setAttribute("aria-label", "次数");
        const interval = document.createElement("input"); interval.type = "number"; interval.min = "500"; interval.max = "60000"; interval.step = "100"; interval.value = "1500"; interval.setAttribute("aria-label", "间隔毫秒");
        const hint = document.createElement("p"); hint.textContent = "间隔作用于每次请求；单表情添加并取消计为一次，结束时恢复原有回应状态。";
        const status = document.createElement("p"); status.setAttribute("role", "status");
        const buttons = document.createElement("div"); buttons.className = "enhancedqq-burst-buttons";
        const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "关闭";
        const start = document.createElement("button"); start.type = "submit"; start.textContent = "开始";
        buttons.append(cancel, start); form.append(heading, makeField("模式", mode), emojiField, makeField("次数", count), makeField("请求间隔（毫秒）", interval), hint, status, buttons); overlay.append(form); document.body.append(overlay);
        let controller = null;
        mode.addEventListener("change", () => {
            emojiField.hidden = mode.value !== "single";
            hint.textContent = mode.value === "single" ? "间隔作用于每次请求；单表情添加并取消计为一次，结束时恢复原有回应状态。" : "按间隔添加不同表情，QQ 拒绝请求时停止。";
        });
        cancel.addEventListener("click", () => { if (controller) { controller.abort(); status.textContent = "正在停止…"; } else overlay.remove(); });
        overlay.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); cancel.click(); } });
        form.addEventListener("submit", async event => {
            event.preventDefault(); if (controller) return;
            const amount = Number(count.value), delay = Number(interval.value);
            if (!Number.isInteger(amount) || amount < 1 || amount > 1000 || !Number.isInteger(delay) || delay < 500 || delay > 60000) { status.textContent = "次数为 1–1000，间隔为 500–60000 毫秒。"; return; }
            controller = new AbortController(); start.disabled = true; for (const input of [mode, emoji, count, interval]) input.disabled = true;
            cancel.textContent = "停止"; status.textContent = "正在准备…";
            let completed = 0;
            try {
                const entries = await catalog(), symbol = emoji.value.trim();
                const match = entries.find(item => item.symbol === symbol || item.symbol.replace(/\uFE0F/g, "") === symbol.replace(/\uFE0F/g, ""));
                const id = unicodeReactionId(symbol) || match?.id;
                if (mode.value === "single" && !id) throw new Error("请输入一个 Emoji。");
                const result = await runReactionBurst({ context, mode: mode.value, emojiId: id, count: amount, intervalMs: delay,
                    pool: entries.map(item => item.id), send: async request => {
                        const result = await bridge.sendReaction(request);
                        if (request.setEmoji) rememberRecentEmoji(/^\d{1,10}$/.test(request.emojiId) ? request.emojiId : `u:${request.emojiId}`);
                        return result;
                    }, signal: controller.signal,
                    onProgress: (done, total) => { completed = done; status.textContent = `已完成 ${done} / ${total}`; } });
                status.textContent = `已完成 ${result.completed} 次。`;
            } catch (error) {
                const detail = String(error?.message || "QQ 未确认回应结果。").replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "");
                status.textContent = completed ? `已完成 ${completed} / ${amount}：${detail}` : detail;
            }
            finally { controller = null; start.disabled = false; for (const input of [mode, emoji, count, interval]) input.disabled = false; cancel.textContent = "关闭"; }
        });
        mode.focus();
    }
    document.addEventListener("contextmenu", event => {
        const id = ++sequence;
        if (!settings.enabled || !settings.burstEnabled || event.target?.closest?.(".avatar-span, .avatar, .q-avatar")) return;
        const context = resolveReactionContext(event.target);
        if (!context) return;
        let tries = 0;
        function findMenu() {
            if (id !== sequence || !settings.enabled || !settings.burstEnabled || ++tries > 60) return;
            const menus = [...document.querySelectorAll(".q-context-menu.aio-right-click-menu")].filter(menu => menu.getBoundingClientRect().width > 0);
            menus.sort((a, b) => { const score = node => { const r = node.getBoundingClientRect(); return Math.abs(r.left - event.clientX) + Math.abs(r.top - event.clientY); }; return score(a) - score(b); });
            const menu = menus[0];
            if (!menu) { requestAnimationFrame(findMenu); return; }
            if (menu.querySelector(".enhancedqq-burst-item")) return;
            const item = document.createElement("div"); item.className = "q-context-menu-item enhancedqq-burst-item"; item.setAttribute("role", "menuitem");
            const text = document.createElement("span"); text.className = "q-context-menu-item__text"; text.textContent = "Reaction 轰炸"; item.append(text);
            item.addEventListener("click", click => { click.preventDefault(); click.stopPropagation(); document.documentElement.dispatchEvent(new MouseEvent("click", { bubbles: true })); dialog(context); });
            menu.append(item);
        }
        requestAnimationFrame(findMenu);
    }, true);
    bridge.onState?.(state => { stateReceived = true; settings = reactionSettings({ features: { reactions: state?.reactions } }); });
    readConfig(api).then(config => { if (!stateReceived) settings = reactionSettings(config); })
        .catch(error => console.warn("[EnhancedQQ] Reaction burst settings unavailable:", error?.message));
}
