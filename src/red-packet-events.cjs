function createPacketEventCollector({ startedAt = Date.now(), now = Date.now, ownUid = () => "" } = {}) {
    const pending = new Map();
    return {
        clear() { pending.clear(); },
        observe(record) {
            const id = String(record?.msgId || "");
            if (!id || !Array.isArray(record?.elements)) return null;
            const hasWallet = record.elements.some(element => Number(element?.elementType) === 9 && element?.walletElement);
            const previous = pending.get(id);
            if (!hasWallet && !previous) return null;
            const merged = previous ? { ...previous, ...record, elements: hasWallet ? record.elements : previous.elements } : record;
            const rawTime = Number(merged.msgTime);
            const msgTime = rawTime < 1e12 ? rawTime * 1000 : rawTime;
            const currentTime = now();
            if (!Number.isFinite(msgTime) || msgTime < Math.max(startedAt - 2000, currentTime - 120000) || msgTime > currentTime + 60000) return null;
            if (hasWallet) {
                pending.set(id, merged);
                if (pending.size > 1000) pending.delete(pending.keys().next().value);
            }
            if (merged.msgSeq == null || String(merged.msgSeq) === "0") return null;
            if (merged.senderUid && String(merged.senderUid) === String(ownUid()) && merged.sendStatus != null && Number(merged.sendStatus) !== 2) return null;
            pending.delete(id);
            return merged;
        }
    };
}

module.exports = { createPacketEventCollector };
