import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { telegramDefinitions, telegramSettings, validTelegramValue, telegramValue, telegramRuntimeValues, liuliMode } from "../src/renderer/telegram-config.js";

const source = JSON.parse(fs.readFileSync(new URL("../src/vendor/telegram-theme/setting.json", import.meta.url), "utf8"));

test("includes every upstream own and other message setting in both modes", () => {
    for (const mode of ["light", "dark"]) {
        const all = Object.entries(source[mode]).filter(([, value]) => ["自己的消息", "他人的消息"].includes(value.group));
        const ported = new Set(telegramDefinitions(source, mode).map(value => value.key));
        assert.equal(all.length, 25);
        assert.ok(all.every(([key]) => ported.has(key)));
    }
});

test("keeps mode-specific overrides and falls back from invalid values", () => {
    const settings = telegramSettings({ features: { telegramBubbles: { enabled: false, light: { "--tg-message-self-bg-color": "#123456aa" } } } });
    const definition = telegramDefinitions(source, "light").find(value => value.key === "--tg-message-self-bg-color");
    assert.equal(settings.enabled, false);
    assert.equal(telegramValue(definition, settings, "light"), "#123456aa");
    assert.equal(telegramValue(definition, { light: { [definition.key]: "invalid" } }, "light"), definition.defaultValue);
    assert.equal(validTelegramValue(definition, "#abcdef00"), true);
    assert.equal(validTelegramValue(definition, "#abcdef; color:red"), false);
});

test("preserves the prior layout by default and accepts the two new layout preferences", () => {
    const defaults = telegramSettings({});
    assert.equal(defaults.nicknamePosition, "above");
    assert.equal(defaults.showSelfAvatar, false);
    const selected = telegramSettings({ features: { telegramBubbles: { nicknamePosition: "below", showSelfAvatar: true, colorMode: "theme", dark: { "--tg-message-self-bg-color": "#ffc0cb" } } } });
    assert.equal(selected.nicknamePosition, "below");
    assert.equal(selected.showSelfAvatar, true);
    assert.equal(selected.dark["--tg-message-self-bg-color"], "#ffc0cb");
    assert.equal(telegramSettings({ features: { telegramBubbles: { nicknamePosition: "inside" } } }).nicknamePosition, "inside");
    const invalid = telegramSettings({ features: { telegramBubbles: { nicknamePosition: "elsewhere", showSelfAvatar: "true" } } });
    assert.equal(invalid.nicknamePosition, "above");
    assert.equal(invalid.showSelfAvatar, false);
});

test("uses Liuli's active theme before the system preference", () => {
    assert.equal(liuliMode({ dataset: { liuliDark: "0" } }, { matches: true }), "light");
    assert.equal(liuliMode({ dataset: { liuliDark: "1" } }, { matches: false }), "dark");
    assert.equal(liuliMode({ dataset: {} }, { matches: true }), "dark");
});

test("unifies bubbles with the theme by default and supports a shared custom color", () => {
    const defaults = telegramSettings({});
    const theme = telegramRuntimeValues(source, defaults, "light");
    assert.equal(defaults.colorMode, "theme");
    assert.equal(theme["--tg-message-self-bg-color"], theme["--tg-message-others-bg-color"]);
    assert.match(theme["--tg-message-self-bg-color"], /--ll-primary-container/);
    const unified = telegramSettings({ features: { telegramBubbles: { colorMode: "unified", uniform: { light: "#123456" } } } });
    const values = telegramRuntimeValues(source, unified, "light");
    assert.equal(values["--tg-message-self-bg-color"], "#123456");
    assert.equal(values["--tg-message-others-bg-color"], "#123456");
    assert.equal(values["--tg-message-self-font-color"], "#ffffff");
    assert.equal(values["--tg-message-self-forward-msg-bg-color"], "#123456");
    assert.equal(values["--tg-message-others-forward-msg-bg-color"], "#123456");
});

test("preserves previous separate bubble colors and explicit text colors", () => {
    const settings = telegramSettings({ features: { telegramBubbles: { light: {
        "--tg-message-self-bg-color": "#ffffff", "--tg-message-others-bg-color": "#112233", "--tg-message-self-font-color": "#333333"
    } } } });
    const values = telegramRuntimeValues(source, settings, "light");
    assert.equal(settings.colorMode, "separate");
    assert.equal(values["--tg-message-self-bg-color"], "#ffffff");
    assert.equal(values["--tg-message-others-bg-color"], "#112233");
    assert.equal(values["--tg-message-self-font-color"], "#333333");
    assert.equal(values["--tg-message-others-font-color"], "#ffffff");
});

test("follows primary and neutral or secondary theme colors while respecting explicit nickname colors", () => {
    const settings = telegramSettings({ features: { telegramBubbles: { colorMode: "theme-split" } } });
    assert.equal(settings.colorMode, "theme-split");
    for (const mode of ["light", "dark"]) {
        const values = telegramRuntimeValues(source, settings, mode);
        assert.match(values["--tg-message-self-bg-color"], /--ll-primary-container/);
        assert.match(values["--tg-message-others-bg-color"], /--ll-surface-highest/);
        assert.match(values["--tg-message-others-font-color"], /--ll-on-glass/);
        assert.match(values["--tg-message-others-username-font-color"], /--ll-brand/);
    }
    settings.splitTone = "secondary";
    assert.match(telegramRuntimeValues(source, settings, "dark")["--tg-message-others-bg-color"], /--ll-secondary-container/);
    assert.match(telegramRuntimeValues(source, settings, "dark")["--tg-message-others-font-color"], /--ll-on-secondary-container/);
    settings.dark["--tg-message-others-username-font-color"] = "#123456";
    assert.equal(telegramRuntimeValues(source, settings, "dark")["--tg-message-others-username-font-color"], "#123456");
});
