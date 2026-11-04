export const THEME_PRESETS = Object.freeze([
    { name: "天空蓝", color: "#1d9bf0" },
    { name: "海洋蓝", color: "#4b7bec" },
    { name: "薰衣草", color: "#8766cf" },
    { name: "樱花粉", color: "#df7798" },
    { name: "暖橙", color: "#d98545" },
    { name: "琥珀", color: "#b88a35" },
    { name: "薄荷", color: "#3d9d85" },
    { name: "森林绿", color: "#6d9258" }
]);

export function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const color = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(color)) return color;
    if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map(c => c + c).join("")}`;
    return null;
}

export function themeColorSettings(config, legacyMode = "qq") {
    const raw = config?.features?.themeColor;
    const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const modes = ["qq", "system", "light", "dark"];
    const fallback = modes.includes(legacyMode) ? legacyMode : "qq";
    return { ...value, source: value.source === "fixed" ? "fixed" : "wallpaper", color: normalizeHex(value.color) || "#1d9bf0",
        mode: modes.includes(value.mode) ? value.mode : fallback };
}

export function contrastText(value) {
    const color = normalizeHex(typeof value === "string" ? value.slice(0, 7) : value);
    if (!color) return "#000000";
    const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
    const linear = rgb.map(component => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4);
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
