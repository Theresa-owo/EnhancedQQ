import { readConfig } from "./config.js";
import { currentPeer } from "./tts.js";
import { unicodeEmojiGroups, createUnicodeEmojiPicker, ensureUnicodeEmojiFont, readRecentEmoji, rememberRecentEmoji } from "./unicode-emoji.js";
export { unicodeReactionId } from "./unicode-emoji.js";

export function reactionSettings(config) {
    const value = config?.features?.reactions || {};
    const quickIds = Array.isArray(value.quickIds) ? value.quickIds.map(String).filter(id => /^\d{1,10}$/.test(id) || (id.startsWith("u:") && id.length > 2 && [...id.slice(2)].length <= 16)) : [];
    return { enabled: value.enabled === true, expandPanel: value.expandPanel !== false, burstEnabled: value.burstEnabled === true,
        quickMode: value.quickMode === "custom" ? "custom" : "append", quickIds: [...new Set(quickIds)].slice(0, 24) };
}

export function reactionDetails(id, catalog) {
    const existing = catalog.find(item => item.id === String(id));
    if (String(id).startsWith("u:")) { const symbol = String(id).slice(2); return symbol ? { ...existing, id: String(id), label: existing?.label || symbol, symbol } : null; }
    const code = Number(id);
    if (!Number.isInteger(code) || code <= 127 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return existing || null;
    const symbol = String.fromCodePoint(code);
    return { ...existing, id: String(id), label: existing?.label || symbol, symbol };
}

function messageRecord(element) {
    const node = element?.closest?.(".message, .ml-item");
    for (const candidate of [node, node?.querySelector?.(".message"), node?.closest?.(".ml-item")]) {
        const instances = [...(Array.isArray(candidate?.__VUE__) ? candidate.__VUE__ : []), candidate?.__vueParentComponent];
        for (const instance of instances) {
            const record = instance?.props?.msgRecord;
            if (record && typeof record === "object") return record;
        }
    }
    return null;
}

export function resolveReactionContext(element, doc = document) {
    const record = messageRecord(element);
    if (!record) return null;
    if (record.chatType != null && Number(record.chatType) !== 2) return null;
    const fallback = currentPeer(null, doc);
    const fromRecord = Number(record.chatType) === 2 ? String(record.peerUid || "") : "";
    const fromCurrent = fallback?.chatType === 2 ? String(fallback.peerUid || "") : "";
    if (fromRecord && fromCurrent && fromRecord !== fromCurrent) return null;
    const peerUid = fromRecord || fromCurrent, msgSeq = String(record.msgSeq || "");
    return peerUid && /^\d+$/.test(msgSeq) && msgSeq !== "0" ? { record, peer: { chatType: 2, peerUid, guildId: String(record.guildId || fallback?.guildId || "") }, msgSeq } : null;
}

function makeButton(doc, emoji, kind) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `${kind === "panel" ? "stickers-list-item " : ""}enhancedqq-reaction-button`;
    button.dataset.enhancedqqReactionId = emoji.id;
    button.title = emoji.label;
    button.setAttribute("aria-label", emoji.label);
    if (emoji.symbol) button.textContent = emoji.symbol;
    else if (emoji.src) { const image = doc.createElement("img"); image.src = emoji.src; image.alt = ""; image.draggable = false; button.append(image); }
    return button;
}

export function installReactions() {
    const bridge = globalThis.EnhancedQQ, api = globalThis.LiteLoader?.api?.config;
    if (!bridge?.getReactionCatalog || !bridge?.getUnicodeEmojiCatalog || !bridge?.sendReaction || !api) return;
    if (!document.head || !document.documentElement) { document.addEventListener("DOMContentLoaded", installReactions, { once: true }); return; }
    let settings = reactionSettings({}), catalog = [], groups = [], catalogPromise = null, stateReceived = false, context = null, queued = false;
    const pending = new Map();
    const previousTranslate = new WeakMap();
    const style = document.createElement("style");
    style.textContent = `
.enhancedqq-reaction-quick { display: contents; }
.enhancedqq-reaction-button { appearance:none; border:0; padding:4px; width:34px; height:34px; flex:0 0 auto; background:transparent; border-radius:8px; cursor:pointer; color:inherit; font:22px/1 "EnhancedQQ Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif; }
.enhancedqq-reaction-button:hover { background:rgba(var(--ll-brand-rgb, 153, 203, 255), .16); }
.enhancedqq-reaction-button img { display:block; width:24px; height:24px; object-fit:contain; }
.menu-stickers-panel[data-enhancedqq-emoji-panel="1"] { width:min(510px, calc(100vw - 24px)) !important; max-height:min(75vh, 620px) !important; overflow:auto !important; box-sizing:border-box !important; }
.enhancedqq-emoji-picker { display:flex; flex-direction:column; flex:0 0 100%; grid-column:1 / -1; width:100%; box-sizing:border-box; padding:8px; color:var(--ll-on-glass, var(--text_primary, #303030)); }
.enhancedqq-emoji-header { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; font-weight:600; }
.enhancedqq-emoji-header input { width:150px; min-width:0; padding:6px 8px; border:0; border-radius:8px; background:rgba(var(--ll-on-glass-rgb, 128,128,128),.09); color:inherit; font:inherit; }
.enhancedqq-emoji-tabs { display:flex; gap:3px; overflow-x:auto; padding:6px 0; }
.enhancedqq-emoji-tabs button, .enhancedqq-emoji-more { flex:0 0 auto; padding:5px 8px; border:0; border-radius:8px; background:transparent; color:inherit; font:11px sans-serif; cursor:pointer; white-space:nowrap; }
.enhancedqq-emoji-tabs button.is-active { background:var(--ll-primary-container, rgba(128,128,128,.18)); color:var(--ll-on-primary-container, inherit); }
.enhancedqq-emoji-scroll { max-height:min(34vh, 270px); overflow-y:auto; }
.enhancedqq-emoji-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(34px,1fr)); gap:2px; }
.enhancedqq-emoji-more { display:block; margin:4px auto; background:rgba(var(--ll-on-glass-rgb,128,128,128),.08); }
.enhancedqq-emoji-more[hidden] { display:none; }
.enhancedqq-emoji-hint { margin:5px 0 0; font:11px/1.4 sans-serif; color:var(--ll-on-glass-3, #888); }
.enhancedqq-emoji-empty { grid-column:1 / -1; padding:16px 6px; color:var(--ll-on-glass-3, #888); font:12px sans-serif; }
.menu-stickers-panel [data-enhancedqq-native-emoji-hidden="1"] { display:none !important; }
.menu-stickers[data-enhancedqq-quick-only="1"] :is(.menu-stickers-item, .reaction-express-item):not(.enhancedqq-reaction-button):not([data-enhancedqq-quick-more="1"]):not(.more-reaction-item):not(.more-reaction-express-tag):not(:has(.more-reaction-item, .more-reaction-express-tag, use[href*="expression_add_24"])) { display:none !important; }
.menu-stickers[data-enhancedqq-quick-extended="1"] { max-width:min(560px, calc(100vw - 32px)); overflow-x:auto !important; overflow-y:hidden !important; }
.enhancedqq-reaction-error { position:fixed; z-index:2147483647; bottom:30px; left:50%; transform:translateX(-50%); padding:9px 14px; border-radius:10px; color:var(--ll-on-glass, #fff); background:rgba(var(--ll-acrylic, 35, 35, 40), .95); font-size:12px; pointer-events:none; }
`;
    document.head.append(style);

    function notify(message) {
        const node = document.createElement("div");
        node.className = "enhancedqq-reaction-error";
        node.setAttribute("role", "status");
        node.textContent = message;
        document.body.append(node);
        setTimeout(() => node.remove(), 3500);
    }
    function loadCatalog() {
        if (!catalogPromise) catalogPromise = Promise.all([bridge.getReactionCatalog(), bridge.getUnicodeEmojiCatalog()]).then(([value, data]) => {
            catalog = Array.isArray(value) ? value : []; groups = unicodeEmojiGroups(data); return catalog;
        }).catch(() => { catalogPromise = null; return []; });
        return catalogPromise;
    }
    function remember(element) {
        const resolved = resolveReactionContext(element);
        if (!resolved) return;
        context = { ...resolved, time: Date.now() };
        pending.clear();
    }
    function fitPanel(panel) {
        if (!panel.isConnected) return;
        if (previousTranslate.has(panel)) {
            const old = previousTranslate.get(panel);
            if (old) panel.style.translate = old; else panel.style.removeProperty("translate");
        }
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = rect.right > innerWidth - 8 ? innerWidth - 8 - rect.right : rect.left < 8 ? 8 - rect.left : 0;
        const y = rect.bottom > innerHeight - 8 ? innerHeight - 8 - rect.bottom : rect.top < 8 ? 8 - rect.top : 0;
        if (x || y) {
            if (!previousTranslate.has(panel)) previousTranslate.set(panel, panel.style.translate);
            panel.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
        } else previousTranslate.delete(panel);
    }
    function augment() {
        for (const holder of document.querySelectorAll(".menu-stickers-wrapper .menu-stickers")) {
            const signature = JSON.stringify([settings.enabled, settings.quickMode, settings.quickIds, catalog.length]);
            if (holder.dataset.enhancedqqQuickSignature === signature && (!settings.enabled || !settings.quickIds.length || holder.querySelector(":scope > .enhancedqq-reaction-quick")) &&
                (!settings.enabled || holder.querySelector('[data-enhancedqq-quick-more="1"]') || !holder.querySelector(":scope > .menu-stickers-item, :scope > .reaction-express-item"))) continue;
            holder.dataset.enhancedqqQuickSignature = signature;
            holder.querySelector(":scope > .enhancedqq-reaction-quick")?.remove();
            holder.querySelectorAll('[data-enhancedqq-quick-more="1"]').forEach(node => { delete node.dataset.enhancedqqQuickMore; });
            delete holder.dataset.enhancedqqQuickOnly;
            delete holder.dataset.enhancedqqQuickExtended;
            if (!settings.enabled) continue;
            if (settings.quickMode === "custom") holder.dataset.enhancedqqQuickOnly = "1";
            let more = holder.querySelector(".more-reaction-item, .more-reaction-express-tag");
            while (more?.parentElement && more.parentElement !== holder) more = more.parentElement;
            const nativeItems = [...holder.children].filter(element => element.matches?.(".menu-stickers-item, .reaction-express-item"));
            if (!more) more = nativeItems.at(-1) || null;
            if (more) more.dataset.enhancedqqQuickMore = "1";
            if (!settings.quickIds.length) continue;
            ensureUnicodeEmojiFont(bridge);
            const container = document.createElement("div");
            container.className = "enhancedqq-reaction-quick";
            for (const id of settings.quickIds) { const emoji = reactionDetails(id, catalog); if (emoji) container.append(makeButton(document, emoji, "quick")); }
            holder.insertBefore(container, more || null);
            holder.dataset.enhancedqqQuickExtended = "1";
        }
        if (!settings.enabled || !settings.expandPanel) {
            document.querySelectorAll(".menu-stickers-panel .enhancedqq-emoji-picker").forEach(node => node.remove());
            document.querySelectorAll('.menu-stickers-panel [data-enhancedqq-native-emoji-hidden="1"]').forEach(node => { delete node.dataset.enhancedqqNativeEmojiHidden; });
            document.querySelectorAll('.menu-stickers-panel[data-enhancedqq-emoji-panel="1"]').forEach(node => {
                delete node.dataset.enhancedqqEmojiPanel;
                if (previousTranslate.has(node)) {
                    const old = previousTranslate.get(node);
                    if (old) node.style.translate = old; else node.style.removeProperty("translate");
                    previousTranslate.delete(node);
                }
            });
            return;
        }
        for (const panel of document.querySelectorAll(".menu-stickers-panel")) {
            const grid = [...panel.querySelectorAll(".stickers-list")].find(item => item.querySelector(".stickers-list-item > span"));
            if (!grid || !groups.length) continue;
            let picker = panel.querySelector(".enhancedqq-emoji-picker");
            if (!picker) {
                ensureUnicodeEmojiFont(bridge);
                panel.dataset.enhancedqqEmojiPanel = "1";
                picker = createUnicodeEmojiPicker(document, groups, readRecentEmoji());
                grid.parentElement.insertBefore(picker, grid);
            }
            for (const list of panel.querySelectorAll(".stickers-list")) {
                if (!list.contains(picker)) list.dataset.enhancedqqNativeEmojiHidden = "1";
                else for (const child of list.children) if (child !== picker && !child.contains(picker)) child.dataset.enhancedqqNativeEmojiHidden = "1";
            }
            for (const node of panel.querySelectorAll("*")) {
                if (node.children.length || !/^(最近表情|全部表情)$/.test(node.textContent.trim()) || picker.contains(node)) continue;
                let heading = node;
                for (let parent = node.parentElement, depth = 0; parent && parent !== panel && depth < 3; parent = parent.parentElement, depth++) {
                    if (parent.contains(picker)) break;
                    if ([...parent.classList].some(name => /title|heading|header/i.test(name))) { heading = parent; break; }
                }
                heading.dataset.enhancedqqNativeEmojiHidden = "1";
            }
            requestAnimationFrame(() => fitPanel(panel));
        }
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; augment(); });
    }
    function configure(value) {
        settings = reactionSettings({ features: { reactions: value } });
        if (settings.enabled) loadCatalog().then(schedule);
        schedule();
    }
    document.addEventListener("contextmenu", event => { if (settings.enabled) { context = null; pending.clear(); remember(event.target); schedule(); } }, true);
    document.addEventListener("click", event => {
        const button = event.target?.closest?.(".enhancedqq-reaction-button");
        if (!settings.enabled || !button) {
            if (settings.enabled && event.target?.closest?.('.more-reaction-item, .more-reaction-express-tag, [data-enhancedqq-quick-more="1"]')) { remember(event.target); schedule(); }
            return;
        }
        event.preventDefault(); event.stopImmediatePropagation();
        if (!context || Date.now() - context.time > 120000) { notify("请在群消息的右键菜单中选择回应。"); return; }
        const id = button.dataset.enhancedqqReactionId;
        const wireId = id.startsWith("u:") ? id.slice(2) : id;
        const key = `${context.peer.peerUid}:${context.msgSeq}:${id}`;
        const existing = context.record.emojiLikesList?.find?.(entry => String(entry.emojiId) === wireId);
        const clicked = pending.has(key) ? pending.get(key) : [true, 1, "1"].includes(existing?.isClicked);
        button.disabled = true;
        bridge.sendReaction({ peer: context.peer, msgSeq: context.msgSeq, emojiId: wireId, emojiType: "2", setEmoji: !clicked }).then(() => {
            pending.set(key, !clicked);
            if (!clicked) {
                const recent = rememberRecentEmoji(id);
                document.querySelectorAll(".enhancedqq-emoji-picker").forEach(picker => picker.setRecentIds?.(recent));
            }
            document.documentElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }).catch(error => notify(error?.message || "QQ 未能添加回应。"))
            .finally(() => { button.disabled = false; });
    }, true);
    const observer = new MutationObserver(records => {
        if (records.some(record => record.target?.closest?.(".menu-stickers-wrapper, .menu-stickers-panel") ||
            [...record.addedNodes].some(node => node.matches?.(".q-context-menu, .menu-stickers-wrapper, .menu-stickers-panel") || node.querySelector?.(".q-context-menu, .menu-stickers-wrapper, .menu-stickers-panel")))) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    bridge.onState?.(state => { stateReceived = true; configure(state?.reactions); });
    readConfig(api).then(config => { if (!stateReceived) configure(config.features?.reactions); })
        .catch(error => console.warn("[EnhancedQQ] Reaction settings unavailable:", error?.message));
}
