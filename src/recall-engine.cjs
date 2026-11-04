const MAX_CACHE = 10000;
const CHILD_KEYS = ["payload", "msgList", "msgRecord", "msgRecords", "records", "data", "result"];
const KEEP_FROM_UPDATE = ["msgSeq", "cntSeq", "clientSeq", "sendStatus", "emojiLikesList"];

function recallInfo(record) {
    if (!Array.isArray(record?.elements)) return null;
    for (const element of record.elements) {
        const revoke = element?.grayTipElement?.revokeElement;
        if (revoke && typeof revoke === "object") return revoke;
    }
    return null;
}

function isRecord(value) {
    return value && typeof value === "object" && value.msgId != null && Array.isArray(value.elements);
}

function sameConversation(first, second) {
    for (const key of ["chatType", "peerUid"]) {
        if (first?.[key] != null && second?.[key] != null && String(first[key]) !== String(second[key])) return false;
    }
    return true;
}

function senderIsSelf(record, recall, selfUid) {
    const sender = record?.senderUid || recall?.origMsgSenderUid;
    if (!sender || !selfUid) return null;
    return String(sender) === String(selfUid);
}

function clone(value) {
    try { return structuredClone(value); } catch { return null; }
}

function createRecallEngine({ store, maxCache = MAX_CACHE, onStorageError = () => {} } = {}) {
    let account = "";
    const recent = new Map();
    const recovered = new Map();
    const markers = new Map();
    const excluded = new Set();
    let revision = 0;
    let observed = 0;
    let enabled = true;

    function setEnabled(value) {
        const next = value !== false;
        if (enabled && !next) recent.clear();
        enabled = next;
    }

    function mark(id, self) {
        if (!markers.has(id) || markers.get(id) !== self) {
            markers.set(id, self);
            revision += 1;
        }
    }

    function setAccount(uid) {
        const next = typeof uid === "string" ? uid : "";
        if (account !== next) {
            account = next;
            recent.clear();
            recovered.clear();
            markers.clear();
            excluded.clear();
            revision += 1;
        }
    }

    function cache(id, record) {
        const copy = clone(record);
        if (!copy) return;
        recent.delete(id);
        recent.set(id, copy);
        while (recent.size > maxCache) recent.delete(recent.keys().next().value);
    }

    function transformRecord(record, options) {
        const id = String(record.msgId || "");
        if (!id || !account || !options.enabled) return record;
        observed += 1;
        if (excluded.has(id)) return record;
        const recall = recallInfo(record);
        let saved = recovered.get(id);
        if (recall && !saved) {
            const persisted = store?.load(account, id);
            if (persisted?.record && typeof persisted.self === "boolean") {
                saved = { record: persisted.record, self: persisted.self };
                recovered.set(id, saved);
            }
        }
        const elements = record.elements;
        const incomplete = elements.length === 0 || elements.every(element => element?.grayTipElement);
        if (!recall && !saved) {
            if (!incomplete) cache(id, record);
            return record;
        }
        if (!recall && saved && !incomplete) {
            if (sameConversation(saved.record, record) && (!saved.self || options.showOwn)) mark(id, saved.self);
            return record;
        }
        const original = saved?.record || recent.get(id);
        if (!original || !sameConversation(original, record)) return record;
        const self = saved?.self ?? senderIsSelf(original, recall, account);
        if (self === null || (self && !options.showOwn)) return record;
        const restored = clone(original);
        if (!restored) return record;
        for (const key of KEEP_FROM_UPDATE) if (record[key] !== undefined) restored[key] = record[key];
        if (!saved) {
            saved = { record: original, self };
            recovered.set(id, saved);
            if (store && !store.save(account, id, saved)) onStorageError();
        }
        mark(id, self);
        return restored;
    }

    function process(channel, args, options = {}, onRecord = () => {}) {
        if (!/^RM_IPCFROM_MAIN\d*$/.test(String(channel))) return { args, changed: false };
        const settings = { enabled: options.enabled !== false, showOwn: options.showOwn === true };
        setEnabled(settings.enabled);
        let changed = false;
        const seen = new WeakMap();
        function visit(value, depth) {
            if (!value || typeof value !== "object" || depth > 8 || ArrayBuffer.isView(value) || value instanceof Map) return value;
            if (seen.has(value)) return seen.get(value);
            if (isRecord(value)) {
                try { onRecord(value); } catch (error) { console.warn("[EnhancedQQ] Message observation failed:", error?.message); }
                const result = transformRecord(value, settings);
                if (result !== value) changed = true;
                seen.set(value, result);
                return result;
            }
            if (value.msgId != null && (value.msgAttrs != null || value.sendStatus != null)) {
                try { onRecord(value); } catch (error) { console.warn("[EnhancedQQ] Message observation failed:", error?.message); }
            }
            if (Array.isArray(value)) {
                let result = value;
                seen.set(value, value);
                value.forEach((item, index) => {
                    const next = visit(item, depth + 1);
                    if (next !== item) {
                        if (result === value) result = value.slice();
                        result[index] = next;
                    }
                });
                seen.set(value, result);
                return result;
            }
            let result = value;
            seen.set(value, value);
            for (const key of CHILD_KEYS) {
                if (!(key in value)) continue;
                const next = visit(value[key], depth + 1);
                if (next !== value[key]) {
                    if (result === value) result = { ...value };
                    result[key] = next;
                }
            }
            seen.set(value, result);
            return result;
        }
        const result = visit(args, 0);
        return { args: result, changed };
    }

    return {
        setAccount,
        setEnabled,
        exclude(id) { const value = String(id || ""); if (!value) return; excluded.add(value); if (excluded.size > maxCache) excluded.delete(excluded.values().next().value); },
        process,
        markers() { return Array.from(markers, ([id, self]) => ({ id, self })); },
        revision() { return revision; },
        observed() { return observed; }
    };
}

module.exports = { createRecallEngine, recallInfo, senderIsSelf };
