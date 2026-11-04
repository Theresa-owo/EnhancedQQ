import { readConfig } from "./config.js";
import { biliVideoFromRecord } from "./bili-url.js";

function recordOf(element) {
    const message = element?.closest?.(".message");
    const instances = [...(Array.isArray(message?.__VUE__) ? message.__VUE__ : []), message?.__vueParentComponent];
    return instances.find(instance => instance?.props?.msgRecord)?.props?.msgRecord || null;
}

export function isBiliArkCard(element) {
    return Boolean(biliVideoFromRecord(recordOf(element)));
}

export function installBiliExternalHandler(doc, bridge, getEnabled) {
    if (!bridge || typeof bridge.openBiliVideo !== "function") return () => {};
    const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"];
    const handle = event => {
        if (!getEnabled() || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const card = event.target?.closest?.(".ark-msg-content-container, .ark-item-container");
        if (!card) return;
        const url = biliVideoFromRecord(recordOf(card));
        if (!url) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === "click" && event.detail < 2) {
            bridge.openBiliVideo(url).catch(() => console.warn("[EnhancedQQ] Could not open Bilibili video."));
        }
    };
    for (const type of types) doc.addEventListener(type, handle, true);
    return () => { for (const type of types) doc.removeEventListener(type, handle, true); };
}

export function installBiliExternal() {
    const api = globalThis.LiteLoader?.api?.config;
    const bridge = globalThis.EnhancedQQ;
    if (!api || !bridge) return;
    globalThis.__enhancedqqOwnsBiliArk = isBiliArkCard;
    let enabled = false, stateReceived = false;
    installBiliExternalHandler(document, bridge, () => enabled);
    bridge.onState?.(state => { stateReceived = true; enabled = state?.biliExternal?.enabled === true; });
    readConfig(api).then(config => { if (!stateReceived) enabled = config.features?.biliExternal?.enabled === true; })
        .catch(error => console.warn("[EnhancedQQ] Bilibili settings unavailable:", error?.message));
}
