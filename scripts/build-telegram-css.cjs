// Generate the message-related CSS from the vendored Telegram Theme source.
// Usage: node scripts/build-telegram-css.cjs <sass-module> <postcss-module>
const fs = require("node:fs");
const path = require("node:path");
const sass = require(process.argv[2] || "sass");
const postcss = require(process.argv[3] || "postcss");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/vendor/telegram-theme/telegram.scss"), "utf8");
const names = ["chat-msg-area", "message-right-layout", "message-left-layout", "message-tips", "message-others", "message-self", "message-concat"];

function mixin(name) {
    const match = new RegExp(`@mixin\\s+${name}\\s*(?:\\([^)]*\\))?\\s*\\{`).exec(source);
    if (!match) throw new Error(`Missing upstream mixin: ${name}`);
    let depth = 1, quote = "", lineComment = false, blockComment = false;
    for (let i = match.index + match[0].length; i < source.length; i++) {
        const c = source[i], next = source[i + 1];
        if (lineComment) { if (c === "\n") lineComment = false; continue; }
        if (blockComment) { if (c === "*" && next === "/") { blockComment = false; i++; } continue; }
        if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
        if (c === "/" && next === "/") { lineComment = true; i++; continue; }
        if (c === "/" && next === "*") { blockComment = true; i++; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === "{") depth++;
        if (c === "}" && --depth === 0) return source.slice(match.index, i + 1);
    }
    throw new Error(`Unclosed upstream mixin: ${name}`);
}

const selected = names.map(mixin).join("\n\n");
const dependencies = [...new Set(Array.from(selected.matchAll(/var\((--tg-[\w-]+)/g), item => item[1]))].sort();
const config = JSON.parse(fs.readFileSync(path.join(root, "src/vendor/telegram-theme/setting.json"), "utf8"));
function defaults(mode) {
    const css = sass.compileString(`${mixin(mode)}\n@include ${mode}();`).css;
    const values = {};
    postcss.parse(css).walkDecls(declaration => { if (dependencies.includes(declaration.prop)) values[declaration.prop] = declaration.value; });
    return Object.entries(values).map(([key, value]) => `  ${key}: ${value};`).join("\n");
}

const includes = names.filter(name => name !== "chat-msg-area").map(name => `  @include ${name}();`).join("\n");
const scoped = `${selected}\nbody[data-enhancedqq-telegram="on"] #app#app {\n  .aio .group-panel .group-chat { @include chat-msg-area(); }\n${includes}\n}`;
const parsed = postcss.parse(sass.compileString(scoped, { style: "expanded" }).css);
const patchRules = postcss.parse(sass.compileString(`${mixin("patch")}\nbody[data-enhancedqq-telegram="on"] #app#app { @include patch(); }`, { style: "expanded" }).css);
patchRules.walkRules(rule => {
    const messageSelectors = rule.selectors.filter(selector => selector.includes(".message-container"));
    if (messageSelectors.length) rule.selectors = messageSelectors;
    else rule.remove();
});
parsed.append(patchRules.nodes);
parsed.walkDecls(declaration => { declaration.important = true; });
const header = `/* Generated from Telegram Theme v4, commit 42fda79c9ba157831be37d6c31ebebc3f9a4d919.\n * Copyright (c) 2023 festoney8; MIT License: see src/vendor/telegram-theme/LICENSE.\n * Declarations are scoped and made important to coexist with Liuli. */\n`;
const variables = `body[data-enhancedqq-telegram="on"] {\n${defaults("light")}\n}\n` +
    `@media (prefers-color-scheme: dark) { body[data-enhancedqq-telegram="on"]:not([data-liuli-dark]) {\n${defaults("dark")}\n} }\n` +
    `body[data-enhancedqq-telegram="on"][data-liuli-dark="1"] {\n${defaults("dark")}\n}\n`;
const output = path.join(root, "src/renderer/telegram-bubbles.generated.css");
fs.writeFileSync(output, header + variables + parsed.toString() + "\n", "utf8");
const configurable = dependencies.filter(key => config.light[key] && config.dark[key]);
console.log(JSON.stringify({ mixins: names, dependencies, configurable, output }));
