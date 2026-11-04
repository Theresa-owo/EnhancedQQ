import { readConfig } from "./config.js";
import { telegramSettings, telegramRuntimeValues, liuliMode } from "./telegram-config.js";
import { classifyTelegramMessages, collectTelegramRows } from "./telegram-grouping.js";

const sourceUrl = new URL("../vendor/telegram-theme/setting.json", import.meta.url).href;
const cssUrls = ["./telegram-bubbles.generated.css", "./telegram-bubbles.compat.css"];

export function installTelegramBubbles() {
    let current = telegramSettings({});
    let source = null;
    const listeners = new Set();
    const previousVars = new Map();
    const rows = new Set();
    const media = matchMedia("(prefers-color-scheme: dark)");
    let queued = false;
    let active = false;
    let observer = null;

    function notify() { for (const listener of listeners) listener(current); }
    function restoreNames() {
        for (const bubble of document.querySelectorAll('.msg-content-container[data-liuli-named="1"]')) {
            const name = bubble.querySelector(":scope > .user-name");
            const wrapper = bubble.closest(".message-content__wrapper");
            const row = bubble.closest(".message-container");
            if (name && wrapper?.parentElement === row) row.insertBefore(name, wrapper);
            if (!name || wrapper?.parentElement === row) delete bubble.dataset.liuliNamed;
        }
        for (const row of document.querySelectorAll(".message-container[data-liuli-g]")) delete row.dataset.liuliG;
        for (const node of document.querySelectorAll(".chat-msg-area [data-liuli-quote-root]")) delete node.dataset.liuliQuoteRoot;
        for (const avatar of document.querySelectorAll(".avatar-span[data-liuli-ty]")) {
            if (/^translateY\(-?\d+px\)$/.test(avatar.style.transform)) avatar.style.removeProperty("transform");
            delete avatar.dataset.liuliTy;
        }
    }
    function restoreEnhancedName(bubble) {
        if (!bubble?.dataset.enhancedqqNamed) return;
        const name = bubble.querySelector(":scope > .user-name");
        const wrapper = bubble.closest(".message-content__wrapper");
        const row = bubble.closest(".message-container");
        if (name && wrapper?.parentElement === row) row.insertBefore(name, wrapper);
        if (!name || wrapper?.parentElement === row) delete bubble.dataset.enhancedqqNamed;
    }
    function placeEnhancedName(row, inside) {
        const wrapper = row.querySelector(".message-content__wrapper");
        const bubble = wrapper?.querySelector(".msg-content-container.container--others");
        if (!bubble) return;
        if (!inside) { restoreEnhancedName(bubble); return; }
        const container = wrapper.parentElement;
        if (!container?.matches(".message-container")) return;
        const name = container.querySelector(":scope > .user-name");
        if (!name) return;
        delete bubble.dataset.liuliNamed;
        bubble.insertBefore(name, bubble.firstChild);
        bubble.dataset.enhancedqqNamed = "1";
    }
    function restoreEnhancedNames() {
        for (const bubble of document.querySelectorAll('.msg-content-container[data-enhancedqq-named="1"]')) restoreEnhancedName(bubble);
    }
    function clearGrouping() {
        for (const row of rows) {
            if (row.dataset.enhancedqqGroup) row.classList.remove(row.dataset.enhancedqqGroup);
            delete row.dataset.enhancedqqGroup;
        }
        rows.clear();
    }
    function visibleMessages(list) {
        let storedMessages;
        try {
            const vue = document.getElementById("app")?.__vue_app__;
            storedMessages = vue?.config?.globalProperties?.$store?.state?.aio_chatMsgArea?.msgListRef?.curMsgs;
        } catch { /* Fall back to the visible message rows. */ }
        return collectTelegramRows(list, storedMessages);
    }
    function groupMessages() {
        if (!active) return;
        restoreNames();
        const list = document.querySelector(".ml-list");
        if (!list || list.querySelector(".is-pub-account")) return;
        const messages = visibleMessages(list);
        const groups = classifyTelegramMessages(messages);
        const activeRows = new Set();
        for (const item of groups) {
            const row = messages[Number(item.id)]?.row;
            if (!row || !list.contains(row)) continue;
            activeRows.add(row);
            const previous = row.dataset.enhancedqqGroup;
            if (previous !== item.group) {
                if (previous) row.classList.remove(previous);
                row.classList.add(item.group);
                row.dataset.enhancedqqGroup = item.group;
            }
            rows.add(row);
            placeEnhancedName(row, current.nicknamePosition === "inside" && ["others-head", "others-single"].includes(item.group));
        }
        for (const row of rows) if (!activeRows.has(row)) { if (row.dataset.enhancedqqGroup) row.classList.remove(row.dataset.enhancedqqGroup); delete row.dataset.enhancedqqGroup; rows.delete(row); }
    }
    function scheduleGrouping() {
        if (queued || !active) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; groupMessages(); });
    }
    function apply() {
        const body = document.body;
        if (!body || !source) return;
        if (!current.enabled) {
            active = false;
            restoreEnhancedNames();
            delete body.dataset.enhancedqqTelegram;
            delete body.dataset.enhancedqqNickname;
            delete body.dataset.enhancedqqSelfAvatar;
            for (const [key, previous] of previousVars) {
                if (previous.value) body.style.setProperty(key, previous.value, previous.priority);
                else body.style.removeProperty(key);
            }
            previousVars.clear();
            clearGrouping();
            notify();
            return;
        }
        if (current.nicknamePosition !== "inside") restoreEnhancedNames();
        body.dataset.enhancedqqTelegram = "on";
        body.dataset.enhancedqqNickname = current.nicknamePosition;
        body.dataset.enhancedqqSelfAvatar = current.showSelfAvatar ? "shown" : "hidden";
        active = true;
        const mode = liuliMode(body, media);
        for (const [key, value] of Object.entries(telegramRuntimeValues(source, current, mode))) {
            if (!previousVars.has(key)) previousVars.set(key, { value: body.style.getPropertyValue(key), priority: body.style.getPropertyPriority(key) });
            body.style.setProperty(key, value);
        }
        scheduleGrouping();
        notify();
    }
    function setCurrent(config) {
        const next = telegramSettings({ features: { telegramBubbles: config } });
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        current = next;
        apply();
    }
    async function start() {
        const config = await readConfig(globalThis.LiteLoader.api.config);
        current = telegramSettings(config);
        globalThis.EnhancedQQ?.onState?.(state => setCurrent(state?.telegramBubbles));
        observer = new MutationObserver(records => {
            if (records.some(record => record.type === "attributes" && record.attributeName === "data-liuli-dark")) apply();
            if (records.some(record => record.type === "childList" ||
                (record.type === "characterData" && record.target.parentElement?.closest(".ml-list")) ||
                (record.type === "attributes" && ["aria-label", "src"].includes(record.attributeName) && record.target.closest?.(".ml-list")))) scheduleGrouping();
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["data-liuli-dark", "aria-label", "src"] });
        media.addEventListener?.("change", apply);
        if (globalThis.EnhancedQQ?.getTelegramAssets) {
            const assets = await globalThis.EnhancedQQ.getTelegramAssets();
            source = assets.definitions;
            for (const text of assets.styles) { const style = document.createElement("style"); style.textContent = text; document.head.append(style); }
        } else {
            const response = await fetch(sourceUrl);
            if (!response.ok) throw new Error(`Telegram settings HTTP ${response.status}`);
            source = await response.json();
            for (const css of cssUrls) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = new URL(css, import.meta.url).href; document.head.append(link); }
        }
        apply();
        return source;
    }
    const ready = new Promise((resolve, reject) => {
        const run = () => start().then(resolve, reject);
        if (document.body && document.head) run(); else document.addEventListener("DOMContentLoaded", run, { once: true });
    });
    ready.catch(error => console.warn("[EnhancedQQ] Telegram bubbles could not load:", error?.message));
    return { ready, get settings() { return current; }, get source() { return source; }, onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }, setCurrent, apply };
}
