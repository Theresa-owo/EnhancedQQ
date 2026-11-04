// Generate an offline picker from Unicode emoji-test and CLDR Chinese annotations.
// Usage: node scripts/build-unicode-emoji.cjs <emoji-test.txt> <zh.json> <zh-derived.json>
const fs = require("node:fs");
const path = require("node:path");

const [emojiPath, zhPath, derivedPath] = process.argv.slice(2);
if (!emojiPath || !zhPath || !derivedPath) throw new Error("Provide Unicode emoji-test and both CLDR annotation files.");
const source = fs.readFileSync(emojiPath, "utf8");
if (!/^# Version: 18\.0\s*$/m.test(source)) throw new Error("Expected Unicode Emoji 18.0 data.");
const annotations = JSON.parse(fs.readFileSync(zhPath, "utf8")).annotations.annotations;
const derived = JSON.parse(fs.readFileSync(derivedPath, "utf8")).annotationsDerived.annotations;
const groupNames = {
    "Smileys & Emotion": "表情与情绪", "People & Body": "人物与手势", Component: "肤色与组件",
    "Animals & Nature": "动物与自然", "Food & Drink": "食物与饮料", "Travel & Places": "旅行与地点",
    Activities: "活动", Objects: "物品", Symbols: "符号", Flags: "旗帜"
};
const groups = [];
let current = null;
for (const line of source.split(/\r?\n/)) {
    const group = /^# group:\s*(.+)$/.exec(line);
    if (group) { current = { name: groupNames[group[1]] || group[1], items: [] }; groups.push(current); continue; }
    const match = /^([\dA-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*\S+\s+E[\d.]+\s+(.+)$/.exec(line);
    if (!match || !current) continue;
    const symbol = String.fromCodePoint(...match[1].trim().split(/\s+/).map(value => Number.parseInt(value, 16)));
    const key = symbol.replace(/\uFE0F/g, "");
    const info = annotations[key] || derived[key] || annotations[symbol] || derived[symbol] || {};
    const label = info.tts?.[0] || match[3];
    const keywords = [...new Set([...(info.default || []), match[3]])].join(" ");
    current.items.push([symbol, label, keywords]);
}
if (groups.reduce((sum, group) => sum + group.items.length, 0) < 3500) throw new Error("Unicode emoji data appears incomplete.");
const result = { version: "18.0", cldrRevision: "7d2b9cb11cec08f4d333ad73209deb3df0711c3b", groups };
const output = path.join(__dirname, "../src/vendor/unicode-emoji/emoji.json");
fs.writeFileSync(output, `${JSON.stringify(result)}\n`, "utf8");
console.log(`Generated ${groups.reduce((sum, group) => sum + group.items.length, 0)} emoji in ${groups.length} groups.`);
