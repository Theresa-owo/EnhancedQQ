import { readConfig } from "./config.js";

const SEEN_KEY = "enhancedqq-context-menu-seen";
const MENU_SELECTOR = ".q-context-menu.aio-right-click-menu";
export const DEFAULT_MENU_ITEMS = ["复制", "收藏", "转发", "多选", "引用", "设为精华", "删除", "撤回", "用浏览器打开"];

export function normalizeMenuLabel(value) {
    return String(value || "").replace(/\s*(?:Ctrl|Alt|Shift|⌘)[\s\S]*$/i, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function contextMenuSettings(config) {
    const value = config?.features?.contextMenu || {};
    return { enabled: value.enabled !== false, hiddenItems: Array.isArray(value.hiddenItems) ? [...new Set(value.hiddenItems.map(normalizeMenuLabel).filter(Boolean))] : [] };
}

export function seenMenuItems(storage = globalThis.localStorage) {
    try {
        const own = JSON.parse(storage?.getItem(SEEN_KEY) || "[]");
        const liuli = JSON.parse(storage?.getItem("liuli-layout-seen") || "{}");
        return [...new Set([...DEFAULT_MENU_ITEMS, ...(Array.isArray(own) ? own : []), ...(Array.isArray(liuli.menu) ? liuli.menu : [])].map(normalizeMenuLabel).filter(Boolean))];
    } catch { return [...DEFAULT_MENU_ITEMS]; }
}

function labelOf(item) {
    return normalizeMenuLabel(item.querySelector(".q-context-menu-item__text")?.textContent || item.textContent);
}

export function applyContextMenu(menu, config) {
    const hidden = new Set(config.enabled ? config.hiddenItems : []), labels = [];
    for (const item of menu.querySelectorAll(":scope > .q-context-menu-item")) {
        const label = labelOf(item);
        if (!label) continue;
        labels.push(label);
        if (hidden.has(label)) item.dataset.enhancedqqMenuHidden = "1";
        else delete item.dataset.enhancedqqMenuHidden;
    }
    return labels;
}

export function installContextMenu() {
    const api = globalThis.LiteLoader?.api?.config;
    if (!api) return;
    if (!document.head || !document.documentElement) { document.addEventListener("DOMContentLoaded", installContextMenu, { once: true }); return; }
    let config = contextMenuSettings({}), ready = false, queued = false, stateReceived = false;
    const style = document.createElement("style");
    style.textContent = `${MENU_SELECTOR} > [data-enhancedqq-menu-hidden="1"] { display: none !important; }`;
    document.head.append(style);
    function update() {
        if (!ready) return;
        const labels = [...document.querySelectorAll(MENU_SELECTOR)].flatMap(menu => applyContextMenu(menu, config));
        if (!labels.length) return;
        try {
            const prior = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
            const existing = Array.isArray(prior) ? prior : [];
            const next = [...new Set([...existing, ...labels])];
            if (next.length !== existing.length) {
                localStorage.setItem(SEEN_KEY, JSON.stringify(next));
                window.dispatchEvent(new CustomEvent("enhancedqq-context-menu-seen"));
            }
        } catch { /* Menu visibility works without local storage. */ }
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
    }
    const observer = new MutationObserver(records => {
        if (records.some(record => record.target?.closest?.(MENU_SELECTOR) || [...record.addedNodes].some(node => node.matches?.(MENU_SELECTOR) || node.querySelector?.(MENU_SELECTOR)))) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("contextmenu", schedule, true);
    globalThis.EnhancedQQ?.onState?.(state => { stateReceived = true; config = contextMenuSettings({ features: { contextMenu: state?.contextMenu } }); ready = true; update(); });
    readConfig(api).then(value => { if (!stateReceived) config = contextMenuSettings(value); ready = true; update(); })
        .catch(error => console.warn("[EnhancedQQ] Context-menu settings unavailable:", error?.message));
}
