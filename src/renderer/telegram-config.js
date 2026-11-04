import { contrastText } from "./theme-config.js";
const EXTRA_KEYS = new Set(["--tg-panel-message-timestamp-font-size", "--tg-panel-header-bg-color", "--tg-menu-bg-color"]);

export function telegramDefinitions(source, mode) {
    const entries = source?.[mode] && typeof source[mode] === "object" ? source[mode] : {};
    return Object.entries(entries).filter(([key, value]) =>
        value && (value.group === "自己的消息" || value.group === "他人的消息" || EXTRA_KEYS.has(key)) &&
        (value.type === "color" || value.type === "text")
    ).map(([key, value]) => ({ key, ...value }));
}

export function telegramSettings(config) {
    const raw = config?.features?.telegramBubbles;
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const mode = name => value[name] && typeof value[name] === "object" && !Array.isArray(value[name]) ? value[name] : {};
    const light = { ...mode("light") }, dark = { ...mode("dark") };
    const legacyColors = [light, dark].some(item => item["--tg-message-self-bg-color"] || item["--tg-message-others-bg-color"]);
    const colorMode = ["theme", "theme-split", "unified", "separate"].includes(value.colorMode) ? value.colorMode : legacyColors ? "separate" : "theme";
    const uniform = value.uniform && typeof value.uniform === "object" && !Array.isArray(value.uniform) ? value.uniform : {};
    return { ...value, enabled: value.enabled !== false, colorMode, splitTone: value.splitTone === "secondary" ? "secondary" : "neutral", uniform: { ...uniform }, light, dark,
        nicknamePosition: ["above", "below", "inside"].includes(value.nicknamePosition) ? value.nicknamePosition : "above", showSelfAvatar: value.showSelfAvatar === true };
}

export function validTelegramValue(definition, value) {
    if (typeof value !== "string" || !value.trim() || value.length > 120) return false;
    if (definition.type === "color") return /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value.trim());
    return !/[;{}]/.test(value);
}

export function telegramValue(definition, settings, mode) {
    const candidate = settings?.[mode]?.[definition.key];
    return validTelegramValue(definition, candidate) ? candidate.trim() : definition.defaultValue;
}

export function liuliMode(body, darkMedia) {
    if (body?.dataset?.liuliDark === "1") return "dark";
    if (body?.dataset?.liuliDark === "0") return "light";
    return darkMedia?.matches ? "dark" : "light";
}

export function telegramRuntimeValues(source, settings, mode) {
    const definitions = telegramDefinitions(source, mode);
    const values = Object.fromEntries(definitions.map(definition => [definition.key, telegramValue(definition, settings, mode)]));
    const explicit = key => {
        const definition = definitions.find(item => item.key === key);
        return !!definition && validTelegramValue(definition, settings[mode]?.[key]);
    };
    const fallback = mode === "dark" ? "#2b5278" : "#effdde";
    const themeBackground = `var(--ll-primary-container, ${fallback})`;
    const themeForeground = `var(--ll-on-primary-container, ${mode === "dark" ? "#ffffff" : "#000000"})`;
    const secondaryBackground = `var(--ll-secondary-container, ${mode === "dark" ? "#44464f" : "#e0e2ec"})`;
    const secondaryForeground = `var(--ll-on-secondary-container, ${mode === "dark" ? "#ffffff" : "#1a1b20"})`;
    const neutralBackground = `var(--ll-surface-highest, ${mode === "dark" ? "#363438" : "#e7e1e5"})`;
    const neutralForeground = `var(--ll-on-glass, ${mode === "dark" ? "#ffffff" : "#1a1b20"})`;
    const otherThemeBackground = settings.splitTone === "secondary" ? secondaryBackground : neutralBackground;
    const otherThemeForeground = settings.splitTone === "secondary" ? secondaryForeground : neutralForeground;
    let uniform = settings.uniform?.[mode];
    if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(uniform || "")) uniform = themeBackground;
    for (const side of ["self", "others"]) {
        const prefix = `--tg-message-${side}-`;
        const background = settings.colorMode === "theme" || (settings.colorMode === "theme-split" && side === "self") ? themeBackground
            : settings.colorMode === "theme-split" ? otherThemeBackground : settings.colorMode === "unified" ? uniform : values[`${prefix}bg-color`];
        const foreground = settings.colorMode === "theme-split" && side === "others" ? otherThemeForeground : background.startsWith("var(") ? themeForeground : contrastText(background);
        values[`${prefix}bg-color`] = background;
        if (!explicit(`${prefix}font-color`)) values[`${prefix}font-color`] = foreground;
        if (!explicit(`${prefix}reply-content-font-color`)) values[`${prefix}reply-content-font-color`] = foreground;
        if (!explicit(`${prefix}reply-bg-color`)) values[`${prefix}reply-bg-color`] = `color-mix(in srgb, ${background} 88%, ${foreground})`;
        if (!explicit(`${prefix}forward-msg-bg-color`)) values[`${prefix}forward-msg-bg-color`] = background;
    }
    if (settings.colorMode === "theme-split" && !explicit("--tg-message-others-username-font-color")) {
        values["--tg-message-others-username-font-color"] = `var(--ll-brand, ${otherThemeForeground})`;
    }
    return values;
}
