export function unicodeReactionId(input) {
    const chars = Array.from(String(input || "").trim().replace(/\uFE0F/g, ""));
    if (chars.length !== 1 || !/^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})$/u.test(chars[0])) return "";
    const value = chars[0].codePointAt(0);
    return value > 127 ? String(value) : "";
}

export function unicodeEmojiGroups(data) {
    if (!Array.isArray(data?.groups)) return [];
    return data.groups.map(group => ({ name: String(group.name || "其他"), items: (Array.isArray(group.items) ? group.items : []).map(item => {
        const [symbol, label, keywords] = item;
        return { symbol: String(symbol || ""), label: String(label || symbol || ""), keywords: String(keywords || ""), id: unicodeReactionId(symbol) || `u:${symbol}` };
    }).filter(item => item.symbol) })).filter(group => group.items.length);
}

const RECENT_KEY = "enhancedqq-recent-emoji";
export function readRecentEmoji(storage = globalThis.localStorage) {
    try { const ids = JSON.parse(storage?.getItem(RECENT_KEY) || "[]"); return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string" && id.length > 0))].slice(0, 48) : []; }
    catch { return []; }
}

export function rememberRecentEmoji(id, storage = globalThis.localStorage) {
    if (typeof id !== "string" || !id) return readRecentEmoji(storage);
    const next = [id, ...readRecentEmoji(storage).filter(value => value !== id)].slice(0, 48);
    try { storage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* The picker still works without persistence. */ }
    return next;
}

export function createUnicodeEmojiPicker(doc, groups, recentIds = []) {
    const root = doc.createElement("section");
    root.className = "enhancedqq-emoji-picker";
    const header = doc.createElement("div"); header.className = "enhancedqq-emoji-header";
    const title = doc.createElement("span"); title.textContent = "全部 Emoji";
    const search = doc.createElement("input"); search.type = "search"; search.placeholder = "搜索表情"; search.setAttribute("aria-label", "搜索 Emoji");
    header.append(title, search);
    const tabs = doc.createElement("div"); tabs.className = "enhancedqq-emoji-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Emoji 分类");
    const scroll = doc.createElement("div"); scroll.className = "enhancedqq-emoji-scroll";
    const grid = doc.createElement("div"); grid.className = "enhancedqq-emoji-grid";
    const more = doc.createElement("button"); more.type = "button"; more.className = "enhancedqq-emoji-more"; more.textContent = "显示更多";
    const hint = doc.createElement("p"); hint.className = "enhancedqq-emoji-hint"; hint.textContent = "组合 Emoji 的回应效果取决于 QQ 支持情况。";
    scroll.append(grid, more); root.append(header, tabs, scroll, hint);
    const byId = new Map(groups.flatMap(group => group.items).map(emoji => [emoji.id, emoji]));
    function resolveRecent(id) {
        if (byId.has(id)) return byId.get(id);
        const code = Number(id), symbol = id.startsWith("u:") ? id.slice(2) : Number.isInteger(code) && code > 127 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
        return symbol ? { id, symbol, label: symbol, keywords: "" } : null;
    }
    const recent = { name: "最近", items: recentIds.map(resolveRecent).filter(Boolean) };
    const displayedGroups = [recent, ...groups];
    let selected = recent.items.length ? 0 : 1, items = [], shown = 0;
    function appendPage() {
        const fragment = doc.createDocumentFragment(), end = Math.min(items.length, shown + 96);
        while (shown < end) {
            const emoji = items[shown++], button = doc.createElement("button");
            button.type = "button"; button.className = "enhancedqq-reaction-button enhancedqq-emoji-option";
            button.textContent = emoji.symbol; button.setAttribute("aria-label", emoji.label);
            button.dataset.enhancedqqReactionId = emoji.id; button.title = emoji.label;
            fragment.append(button);
        }
        grid.append(fragment);
        more.hidden = shown >= items.length;
    }
    function render() {
        const query = search.value.trim().toLowerCase();
        items = query ? groups.flatMap(group => group.items).filter(item => `${item.symbol} ${item.label} ${item.keywords}`.toLowerCase().includes(query)) : displayedGroups[selected]?.items || [];
        grid.replaceChildren(); shown = 0; scroll.scrollTop = 0;
        for (const button of tabs.children) {
            const active = Number(button.dataset.group) === selected;
            button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active));
        }
        appendPage();
        if (!items.length) { const empty = doc.createElement("span"); empty.className = "enhancedqq-emoji-empty"; empty.textContent = query ? "没有找到表情" : "暂无最近回应"; grid.append(empty); }
    }
    displayedGroups.forEach((group, index) => {
        const button = doc.createElement("button"); button.type = "button"; button.dataset.group = String(index); button.setAttribute("role", "tab"); button.textContent = group.name;
        button.addEventListener("click", event => { event.stopPropagation(); selected = index; search.value = ""; render(); }); tabs.append(button);
    });
    search.addEventListener("input", render);
    search.addEventListener("click", event => event.stopPropagation());
    more.addEventListener("click", event => { event.stopPropagation(); appendPage(); });
    scroll.addEventListener("scroll", () => { if (!more.hidden && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 36) appendPage(); });
    root.addEventListener("mousedown", event => event.stopPropagation());
    root.addEventListener("click", event => event.stopPropagation());
    root.setRecentIds = ids => { recent.items = ids.map(resolveRecent).filter(Boolean); if (selected === 0 && !search.value.trim()) render(); };
    render();
    return root;
}
let fontPromise;
export function ensureUnicodeEmojiFont(bridge, doc = document) {
    if (!bridge?.getUnicodeEmojiFont || typeof FontFace !== "function" || !doc.fonts) return Promise.resolve(false);
    if (!fontPromise) fontPromise = bridge.getUnicodeEmojiFont().then(async bytes => {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const font = new FontFace("EnhancedQQ Color Emoji", view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        await font.load(); doc.fonts.add(font); return true;
    }).catch(error => { fontPromise = null; console.warn("[EnhancedQQ] Emoji font unavailable:", error?.message); return false; });
    return fontPromise;
}
