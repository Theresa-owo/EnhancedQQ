function installRecallHook(window, engine, getSettings, notify, onObserved = () => {}, onRecord = () => {}) {
    const webContents = window?.webContents;
    if (!webContents || typeof webContents.send !== "function") return false;
    const previousSend = webContents.send;
    webContents.send = function (channel, ...args) {
        let result = { args, changed: false };
        const revision = engine.revision();
        const observed = engine.observed();
        try { result = engine.process(channel, args, getSettings(), onRecord); }
        catch (error) { console.warn("[EnhancedQQ] Recall processing failed:", error?.message); }
        const returned = Reflect.apply(previousSend, this, [channel, ...result.args]);
        if (engine.revision() !== revision) queueMicrotask(() => { try { notify(); } catch {} });
        if (engine.observed() !== observed) { try { onObserved(); } catch {} }
        return returned;
    };
    return true;
}

module.exports = { installRecallHook };
