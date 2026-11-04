const BLOCKED_UPDATE_ACTIONS = new Set(["start", "appInstallNextTime", "appRelaunch", "checkResourceExist", "checkHasEnoughSpace"]);

function filterUpdateConfig(channel, args, enabled) {
    if (!enabled || !/^RM_IPCFROM_MAIN\d*$/.test(String(channel))) return { args, changed: false };
    const command = args.find(item => typeof item?.cmdName === "string")?.cmdName || args?.[3]?.[1]?.cmdName;
    if (command && !/UnitedConfig/.test(command)) return { args, changed: false };
    let changed = false;
    const seen = new WeakMap();
    function visit(value, depth) {
        if (!value || typeof value !== "object" || depth > 7 || ArrayBuffer.isView(value) || value instanceof Map) return value;
        if (seen.has(value)) return seen.get(value);
        if (Array.isArray(value)) {
            let result = value;
            seen.set(value, value);
            value.forEach((item, index) => {
                const next = visit(item, depth + 1);
                if (next !== item) { if (result === value) result = value.slice(); result[index] = next; }
            });
            seen.set(value, result);
            return result;
        }
        let result = value;
        seen.set(value, value);
        const config = value.configData;
        if (config && typeof config === "object" && typeof config.content === "string") {
            try {
                const items = JSON.parse(config.content);
                if (Array.isArray(items)) {
                    const kept = items.filter(item => !(item && typeof item === "object" &&
                        typeof item.releaseVersion === "string" && typeof item.lowestVersion === "string" && typeof item.jumpUrl === "string"));
                    if (kept.length !== items.length) {
                        result = { ...value, configData: { ...config, content: JSON.stringify(kept) } };
                        changed = true;
                    }
                }
            } catch { /* Leave unrelated or malformed configuration untouched. */ }
        }
        for (const [key, child] of Object.entries(value)) {
            if (key === "configData" && result !== value) continue;
            const next = visit(child, depth + 1);
            if (next !== child) { if (result === value) result = { ...value }; result[key] = next; }
        }
        seen.set(value, result);
        return result;
    }
    const result = visit(args, 0);
    return { args: result, changed };
}

function installUpdateConfigFilter(window, getEnabled, onBlocked = () => {}) {
    const contents = window?.webContents;
    if (!contents || typeof contents.send !== "function") return false;
    const previous = contents.send;
    contents.send = function (channel, ...args) {
        let result = { args, changed: false };
        try { result = filterUpdateConfig(channel, args, getEnabled()); }
        catch (error) { console.warn("[EnhancedQQ] Update config filter failed:", error?.message); }
        if (result.changed) onBlocked("configuration");
        return Reflect.apply(previous, this, [channel, ...result.args]);
    };
    return true;
}

function installHotUpdateGate(ipcMain, getEnabled, onBlocked = () => {}, onObserved = () => {}) {
    if (!ipcMain || typeof ipcMain.emit !== "function") return false;
    const previous = ipcMain.emit;
    ipcMain.emit = function (channel, ...args) {
        const event = args[0], header = args[1], command = args[2];
        if (/^RM_IPCFROM_RENDERER\d+$/.test(String(channel)) && header?.eventName === "HotUpdateApi" && typeof command?.cmdName === "string") {
            onObserved(command.cmdName);
            if (getEnabled() && BLOCKED_UPDATE_ACTIONS.has(command.cmdName)) {
                onBlocked(command.cmdName);
                const sender = event?.sender;
                if (header.callbackId && Number.isSafeInteger(sender?.id) && typeof sender.send === "function") {
                    const reply = { type: "response", callbackId: header.callbackId, promiseStatue: "fail", promiseStatus: "fail" };
                    queueMicrotask(() => { try { if (!sender.isDestroyed?.()) sender.send(`RM_IPCFROM_MAIN${sender.id}`, reply, { result: -1, errMsg: "QQ 更新已由 EnhancedQQ 屏蔽。" }); } catch {} });
                }
                return true;
            }
        }
        return Reflect.apply(previous, this, [channel, ...args]);
    };
    return true;
}

module.exports = { BLOCKED_UPDATE_ACTIONS, filterUpdateConfig, installUpdateConfigFilter, installHotUpdateGate };
