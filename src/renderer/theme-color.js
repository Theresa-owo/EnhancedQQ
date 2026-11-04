import { readConfig, writeConfig } from "./config.js";
import { themeColorSettings } from "./theme-config.js";

const LIULI_MODE_KEY = "liuli-dsh-mode";

export function installThemeColor() {
    let legacyMode = "qq";
    try {
        const saved = localStorage.getItem(LIULI_MODE_KEY);
        if (["system", "light", "dark"].includes(saved)) legacyMode = saved;
    } catch { /* Liuli's default is to follow QQ. */ }
    let current = themeColorSettings({}, legacyMode);
    let nativeDark = null;
    let controlledBody = null;
    const listeners = new Set();
    const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");

    globalThis.__enhancedqqPaletteSource = async () => {
        const config = await readConfig(globalThis.LiteLoader.api.config);
        const value = themeColorSettings(config, legacyMode);
        return value.source === "fixed" ? value.color : null;
    };
    globalThis.__enhancedqqThemeMode = () => current.mode === "qq" ? "auto" : current.mode;
    globalThis.__enhancedqqThemeIsDark = () => current.mode === "dark" ||
        (current.mode === "system" && (nativeDark ?? media?.matches ?? false));
    globalThis.__enhancedqqSetThemeMode = async value => {
        const mode = value === "auto" ? "qq" : value;
        if (!["qq", "system", "light", "dark"].includes(mode)) return;
        const api = globalThis.LiteLoader.api.config;
        const config = await readConfig(api);
        const next = { ...themeColorSettings(config, legacyMode), mode };
        await writeConfig(api, { features: { themeColor: next } });
        setCurrent(next);
        globalThis.EnhancedQQ?.configChanged?.();
    };

    function notify() { for (const listener of listeners) listener(current); }
    function refreshPalette() {
        try {
            const result = globalThis.__enhancedqqRefreshLiuliPalette?.();
            if (result?.catch) result.catch(error => console.warn("[EnhancedQQ] Theme refresh failed:", error?.message));
        } catch (error) { console.warn("[EnhancedQQ] Theme refresh failed:", error?.message); }
    }
    function refreshMode(body) {
        try {
            if (globalThis.__enhancedqqApplyLiuliMode) globalThis.__enhancedqqApplyLiuliMode();
            else if (current.mode !== "qq") body.dataset.liuliDark = globalThis.__enhancedqqThemeIsDark() ? "1" : "0";
        } catch (error) { console.warn("[EnhancedQQ] Theme mode refresh failed:", error?.message); }
    }
    function applyMode(force = false) {
        const body = globalThis.document?.body;
        if (!body) return;
        let changed = false;
        if (current.mode === "qq") {
            if (controlledBody) {
                if (controlledBody.attribute === null) body.removeAttribute("q-theme");
                else body.setAttribute("q-theme", controlledBody.attribute);
                body.classList.toggle("q-theme-tokens-dark", controlledBody.darkClass);
                controlledBody = null;
                changed = true;
            }
        } else {
            if (!controlledBody) controlledBody = { attribute: body.getAttribute("q-theme"), darkClass: body.classList.contains("q-theme-tokens-dark") };
            const dark = globalThis.__enhancedqqThemeIsDark();
            const theme = dark ? "dark" : "light";
            if (body.getAttribute("q-theme") !== theme) { body.setAttribute("q-theme", theme); changed = true; }
            if (body.classList.contains("q-theme-tokens-dark") !== dark) { body.classList.toggle("q-theme-tokens-dark", dark); changed = true; }
        }
        if (changed || force) refreshMode(body);
    }
    function syncLegacyMode(mode) {
        try {
            if (mode === "qq") localStorage.removeItem(LIULI_MODE_KEY);
            else localStorage.setItem(LIULI_MODE_KEY, mode);
        } catch { /* EnhancedQQ's configuration remains authoritative. */ }
    }
    function setCurrent(value) {
        const next = themeColorSettings({ features: { themeColor: value } }, legacyMode);
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        const modeChanged = next.mode !== current.mode;
        const paletteChanged = next.source !== current.source || next.color !== current.color;
        current = next;
        if (modeChanged) { syncLegacyMode(current.mode); applyMode(true); }
        if (paletteChanged) refreshPalette();
        notify();
    }
    function receiveState(state) {
        const wasDark = nativeDark;
        if (typeof state?.nativeDark === "boolean") nativeDark = state.nativeDark;
        if (state?.themeColor) setCurrent(state.themeColor);
        if (current.mode === "system" && wasDark !== nativeDark) applyMode(true);
    }
    function observeBody() {
        const body = globalThis.document?.body;
        if (!body) return;
        if (globalThis.MutationObserver) new MutationObserver(() => applyMode()).observe(body, { attributes: true, attributeFilter: ["q-theme", "class"] });
        applyMode(true);
    }
    if (globalThis.document?.body) observeBody();
    else globalThis.document?.addEventListener("DOMContentLoaded", observeBody, { once: true });
    media?.addEventListener?.("change", () => { if (current.mode === "system" && nativeDark === null) applyMode(true); });
    globalThis.EnhancedQQ?.onState?.(receiveState);
    const ready = Promise.all([
        readConfig(globalThis.LiteLoader.api.config),
        globalThis.EnhancedQQ?.getState?.() || Promise.resolve(null)
    ]).then(([config, state]) => {
        if (typeof state?.nativeDark === "boolean") nativeDark = state.nativeDark;
        setCurrent(config.features?.themeColor);
        applyMode(true);
        notify();
        return current;
    });
    ready.catch(error => console.warn("[EnhancedQQ] Theme settings could not load:", error?.message));
    return { ready, get settings() { return current; }, onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }, setCurrent };
}
