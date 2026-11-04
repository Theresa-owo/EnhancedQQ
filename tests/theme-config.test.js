import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHex, themeColorSettings, contrastText, THEME_PRESETS } from "../src/renderer/theme-config.js";
import { installThemeColor } from "../src/renderer/theme-color.js";

test("normalizes preset and custom theme colors without changing the default wallpaper mode", () => {
    assert.equal(themeColorSettings({}).source, "wallpaper");
    assert.equal(normalizeHex(" #AbC "), "#aabbcc");
    assert.equal(normalizeHex("#bad-color"), null);
    assert.ok(THEME_PRESETS.every(item => normalizeHex(item.color)));
    assert.deepEqual(themeColorSettings({ features: { themeColor: { source: "fixed", color: "#ABCDEF" } } }), { source: "fixed", color: "#abcdef", mode: "qq" });
    assert.equal(themeColorSettings({}, "dark").mode, "dark");
    assert.equal(themeColorSettings({ features: { themeColor: { mode: "system" } } }, "dark").mode, "system");
    assert.equal(themeColorSettings({ features: { themeColor: { mode: "invalid" } } }, "invalid").mode, "qq");
});

test("selects readable dark or light text for custom bubble colors", () => {
    assert.equal(contrastText("#ffffff"), "#000000");
    assert.equal(contrastText("#123456"), "#ffffff");
    assert.equal(contrastText("#f0c0d0"), "#000000");
});

test("supplies the chosen source to Liuli and refreshes only when theme settings change", async t => {
    const names = ["LiteLoader", "EnhancedQQ", "__enhancedqqPaletteSource", "__enhancedqqRefreshLiuliPalette", "__enhancedqqThemeMode", "__enhancedqqThemeIsDark", "__enhancedqqSetThemeMode"];
    const previous = new Map(names.map(name => [name, globalThis[name]]));
    t.after(() => { for (const name of names) { if (previous.get(name) === undefined) delete globalThis[name]; else globalThis[name] = previous.get(name); } });
    let config = { features: {} }, onState, refreshes = 0;
    globalThis.LiteLoader = { api: { config: { get: async () => config } } };
    globalThis.EnhancedQQ = { onState: callback => { onState = callback; } };
    globalThis.__enhancedqqRefreshLiuliPalette = () => { refreshes++; };
    const controller = installThemeColor();
    await controller.ready;
    assert.equal(await globalThis.__enhancedqqPaletteSource(), null);
    config = { features: { themeColor: { source: "fixed", color: "#abcdef" } } };
    controller.setCurrent(config.features.themeColor);
    assert.equal(await globalThis.__enhancedqqPaletteSource(), "#abcdef");
    assert.equal(refreshes, 1);
    onState({ themeColor: config.features.themeColor, markers: [{ id: "test" }] });
    assert.equal(refreshes, 1);
    config = { features: { themeColor: { source: "wallpaper", color: "#abcdef" } } };
    onState({ themeColor: config.features.themeColor });
    assert.equal(await globalThis.__enhancedqqPaletteSource(), null);
    assert.equal(refreshes, 2);
});

test("synchronizes QQ's theme with system changes and restores its prior state", async t => {
    const names = ["LiteLoader", "EnhancedQQ", "document", "localStorage", "MutationObserver", "matchMedia", "__enhancedqqPaletteSource", "__enhancedqqThemeMode", "__enhancedqqThemeIsDark", "__enhancedqqSetThemeMode", "__enhancedqqApplyLiuliMode"];
    const previous = new Map(names.map(name => [name, globalThis[name]]));
    t.after(() => { for (const name of names) { if (previous.get(name) === undefined) delete globalThis[name]; else globalThis[name] = previous.get(name); } });
    const attributes = new Map([["q-theme", "light"]]);
    const classes = new Set();
    const body = { dataset: {}, getAttribute: key => attributes.get(key) ?? null, setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
        classList: { contains: value => classes.has(value), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) } };
    let observer, onState, refreshes = 0, changes = 0;
    const storage = new Map([["liuli-dsh-mode", "dark"]]);
    let config = { features: { antiRecall: { enabled: false }, themeColor: { source: "fixed", color: "#df7798" } } };
    globalThis.document = { body };
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    globalThis.MutationObserver = class { constructor(callback) { observer = callback; } observe() {} };
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
    globalThis.LiteLoader = { api: { config: { get: async () => config, set: async (_slug, value) => { config = value; return true; } } } };
    globalThis.EnhancedQQ = { getState: async () => ({ nativeDark: false }), onState: callback => { onState = callback; }, configChanged: () => { changes++; } };
    globalThis.__enhancedqqApplyLiuliMode = () => { refreshes++; };
    const controller = installThemeColor();
    await controller.ready;
    assert.equal(controller.settings.mode, "dark");
    assert.equal(body.getAttribute("q-theme"), "dark");
    assert.equal(classes.has("q-theme-tokens-dark"), true);

    await globalThis.__enhancedqqSetThemeMode("system");
    assert.equal(config.features.themeColor.color, "#df7798");
    assert.equal(config.features.antiRecall.enabled, false);
    assert.equal(config.features.themeColor.mode, "system");
    assert.equal(body.getAttribute("q-theme"), "light");
    assert.equal(changes, 1);
    onState({ nativeDark: true, themeColor: config.features.themeColor });
    assert.equal(body.getAttribute("q-theme"), "dark");
    assert.equal(classes.has("q-theme-tokens-dark"), true);
    body.setAttribute("q-theme", "light");
    classes.delete("q-theme-tokens-dark");
    observer();
    assert.equal(body.getAttribute("q-theme"), "dark");
    assert.equal(classes.has("q-theme-tokens-dark"), true);
    await globalThis.__enhancedqqSetThemeMode("qq");
    assert.equal(body.getAttribute("q-theme"), "light");
    assert.equal(classes.has("q-theme-tokens-dark"), false);
    assert.equal(storage.has("liuli-dsh-mode"), false);
    assert.ok(refreshes >= 4);
});
