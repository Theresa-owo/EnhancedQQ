import { readConfig } from "./config.js";
import { readNativeBubbleControl } from "./native-bubble.js";

const SWITCHES = '[role="switch"], input[type="checkbox"], .q-switch';
const MENU_ITEMS = '.q-context-menu-item, [role="menuitem"], .func-menu__item_wrap';

export function findAutoUpdateControl(doc) {
    const root = doc.querySelector(".setting-main") || doc;
    const labels = [...root.querySelectorAll("*")].filter(element => element.children.length === 0 &&
        element.textContent.replace(/\s/g, "") === "有新版本时自动安装QQ");
    for (const label of labels) {
        for (let node = label.parentElement, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
            const found = [...node.querySelectorAll(SWITCHES)].filter(element => !element.closest(".enhancedqq-host"));
            const outer = found.filter(element => !found.some(other => other !== element && other.contains(element)));
            if (outer.length === 1) return outer[0];
            if (outer.length > 1) break;
        }
    }
    return null;
}

export function findQQUpdateEntries(doc) {
    const entries = [...doc.querySelectorAll(MENU_ITEMS)];
    if (/^#\/setting\/settings\/about(?:[/?]|$)/i.test(String(doc.defaultView?.location?.hash || ""))) entries.push(...doc.querySelectorAll("button"));
    return entries.filter(element => !element.closest(".enhancedqq-host, .recent-contact, .aio, .chat-msg-area") &&
        [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title")].some(value => String(value || "").replace(/\s/g, "") === "检查更新"));
}

export function createQQUpdateUiGuard(doc) {
    let enabled = false, attempted = false, queued = false;
    const hidden = new Set();
    const style = doc.createElement("style");
    style.textContent = '[data-enhancedqq-qq-update-hidden="1"] { display: none !important; }';
    doc.head.append(style);
    function update() {
        if (!enabled) {
            for (const element of hidden) delete element.dataset.enhancedqqQqUpdateHidden;
            hidden.clear();
            attempted = false;
            return;
        }
        const next = new Set(findQQUpdateEntries(doc));
        for (const element of hidden) if (!next.has(element)) { delete element.dataset.enhancedqqQqUpdateHidden; hidden.delete(element); }
        for (const element of next) { element.dataset.enhancedqqQqUpdateHidden = "1"; hidden.add(element); }
        if (!/^#\/setting\//i.test(String(doc.defaultView?.location?.hash || ""))) return;
        const control = findAutoUpdateControl(doc);
        const state = readNativeBubbleControl(control);
        if (state === false) { attempted = false; return; }
        if (state !== true || attempted) return;
        attempted = true;
        control.click();
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
    }
    const observer = new MutationObserver(records => {
        if (!enabled) return;
        if (records.some(record => record.type === "childList" || record.target?.matches?.(SWITCHES))) schedule();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "checked", "data-state", "class"] });
    return { setEnabled(value) { enabled = value === true; update(); }, update, disconnect() { observer.disconnect(); enabled = false; update(); style.remove(); } };
}

export function installQQUpdateUiGuard() {
    const api = globalThis.LiteLoader?.api?.config;
    if (!api) return null;
    if (!document.head || !document.documentElement) {
        document.addEventListener("DOMContentLoaded", installQQUpdateUiGuard, { once: true });
        return null;
    }
    const guard = createQQUpdateUiGuard(document);
    let stateReceived = false;
    globalThis.EnhancedQQ?.onState?.(state => { stateReceived = true; guard.setEnabled(state?.blockUpdate?.enabled === true); });
    readConfig(api).then(config => { if (!stateReceived) guard.setEnabled(config.features?.blockUpdate?.enabled === true); })
        .catch(error => console.warn("[EnhancedQQ] Update settings unavailable:", error?.message));
    return guard;
}
