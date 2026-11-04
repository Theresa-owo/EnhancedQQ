const pangu = require("./vendor/pangu/index.cjs");

function formatMessage(message) {
    if (!message || !Array.isArray(message.msgElements) || !message.msgElements.length) return message;
    const elements = message.msgElements;
    const first = elements[0]?.textElement;
    const second = elements[1]?.textElement;
    if (typeof first?.content === "string") {
        if (first.content.startsWith("/")) return message;
        if (first.atType != null && Number(first.atType) !== 0 && typeof second?.content === "string" && /^\s\//.test(second.content)) return message;
        if (/^!PanguSkip\s/.test(first.content)) {
            const next = [...elements];
            next[0] = { ...elements[0], textElement: { ...first, content: first.content.replace(/^!PanguSkip\s/, "") } };
            return { ...message, msgElements: next };
        }
    }
    let changed = false;
    const next = elements.map(element => {
        const text = element?.textElement;
        if (Number(element?.elementType) !== 1 || !text || (text.atType != null && Number(text.atType) !== 0) || typeof text.content !== "string") return element;
        const content = pangu.spacing(text.content);
        if (content === text.content) return element;
        changed = true;
        return { ...element, textElement: { ...text, content } };
    });
    return changed ? { ...message, msgElements: next } : message;
}

function processRequest(header, command, enabled, isPacketPassword = () => false) {
    if (!enabled || header?.eventName !== "ntApi" || command?.cmdName !== "nodeIKernelMsgService/sendMsg" || !Array.isArray(command.payload)) return false;
    const message = command.payload[0];
    if (!message || isPacketPassword(message)) return false;
    const formatted = formatMessage(message);
    if (formatted === message) return false;
    command.payload[0] = formatted;
    return true;
}

function installPanguHook(ipcMain, window, getSettings, isPacketPassword) {
    const contents = window?.webContents;
    if (!Number.isSafeInteger(contents?.id) || typeof ipcMain?.prependListener !== "function") return false;
    const channel = `RM_IPCFROM_RENDERER${contents.id}`;
    const listener = (event, header, command) => {
        if (event?.sender !== contents && event?.sender?.id !== contents.id) return;
        try { processRequest(header, command, getSettings().pangu.enabled, message => isPacketPassword(message, event.sender)); }
        catch (error) { console.warn("[EnhancedQQ] Pangu processing failed:", error?.message); }
    };
    ipcMain.prependListener(channel, listener);
    contents.once?.("destroyed", () => ipcMain.removeListener(channel, listener));
    return true;
}

module.exports = { formatMessage, processRequest, installPanguHook };
