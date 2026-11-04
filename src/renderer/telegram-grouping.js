function messageRecord(row) {
    const message = row.querySelector(".message");
    for (const node of [message, row]) {
        const instances = [...(Array.isArray(node?.__VUE__) ? node.__VUE__ : []), node?.__vueParentComponent].filter(Boolean);
        for (const instance of instances) {
            const record = instance?.props?.msgRecord;
            if (record && typeof record === "object") return record;
        }
    }
    return null;
}

// Read the rendered rows rather than depending on the store's ID matching QQ's
// virtual-list DOM ID. The record stays attached to the message as rows recycle.
export function collectTelegramRows(list, storedMessages = []) {
    const stored = new Map();
    if (Array.isArray(storedMessages)) for (const item of storedMessages) {
        if (item?.id != null) stored.set(String(item.id), item.data || item);
    }
    return [...list.querySelectorAll(".ml-item")]
        .filter(row => row.closest(".ml-list") === list)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map((row, index) => {
            const container = row.querySelector(".message-container");
            const record = messageRecord(row) || (row.id ? stored.get(String(row.id)) : null);
            const self = !!row.querySelector(".container--self, .message-container--self, .message-container--align-right");
            const avatar = row.querySelector(".avatar-span");
            const sender = self ? "self" : String(record?.senderUid || record?.senderUin || "") ||
                avatar?.getAttribute("aria-label") || avatar?.querySelector("img")?.src || row.querySelector(".user-name .text-ellipsis")?.textContent?.trim() || "";
            const stamp = row.querySelector(".message__timestamp");
            return { id: String(index), row, sender, self, gray: !container || !!row.querySelector(".gray-tip-message") || [5, 19].includes(Number(record?.msgType)),
                timestamp: !!stamp?.textContent?.trim() };
        });
}

// Group boundaries follow Telegram Theme's concatMsg: timestamps, gray notices,
// sender changes and direction changes begin a new group.
export function classifyTelegramMessages(messages) {
    const result = [];
    let group = [];
    function flush() {
        if (!group.length) return;
        const side = group[0].self ? "self" : "others";
        group.forEach((message, index) => {
            const part = group.length === 1 ? "single" : index === 0 ? "head" : index === group.length - 1 ? "tail" : "body";
            result.push({ id: String(message.id), group: `${side}-${part}` });
        });
        group = [];
    }
    for (const message of messages) {
        if (!message?.id) continue;
        if (message.gray) { flush(); continue; }
        const previous = group[group.length - 1];
        if (previous && (message.timestamp || !message.sender || !previous.sender || message.sender !== previous.sender || message.self !== previous.self)) flush();
        group.push(message);
    }
    flush();
    return result;
}
