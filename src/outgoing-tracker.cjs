function recordAttrId(record) {
    const attrs = record?.msgAttrs ?? record?.msgAttributeInfos;
    const attr = typeof attrs?.get === "function" ? (attrs.get(0) ?? attrs.get("0")) : attrs?.[0];
    return attr?.attrId == null ? "" : String(attr.attrId);
}

function createOutgoingTracker({ now = Date.now, ttl = 60000, limit = 1000 } = {}) {
    const pending = new Map();
    const byMessage = new Map();
    const completed = new Map();
    const sameOwner = (left, right) => left === right || (Number.isInteger(left?.id) && left.id === right?.id);
    function prune() {
        const cutoff = now() - ttl;
        for (const [key, entry] of pending) if (entry.time < cutoff) { pending.delete(key); if (entry.msgId) byMessage.delete(entry.msgId); }
        for (const [key, entry] of completed) if (entry.time < cutoff) completed.delete(key);
        while (pending.size > limit) { const [key, entry] = pending.entries().next().value; pending.delete(key); if (entry.msgId) byMessage.delete(entry.msgId); }
        while (completed.size > limit) completed.delete(completed.keys().next().value);
    }
    function watch(attrId, owner, kind, peer) {
        prune();
        const id = String(attrId ?? "");
        if (!id || id.length > 128 || !owner || typeof owner.send !== "function" || !["tts", "red-packet-text", "red-packet-voice"].includes(kind) || pending.has(id)) return false;
        const target = peer && typeof peer === "object" ? { chatType: Number(peer.chatType), peerUid: String(peer.peerUid || ""), guildId: String(peer.guildId || "") } : null;
        if (kind === "red-packet-text" && (!target || ![1, 2].includes(target.chatType) || !target.peerUid)) return false;
        pending.set(id, { owner, kind, peer: target, time: now(), msgId: "" });
        return true;
    }
    function mark(attrId, owner, msgId) {
        const id = String(attrId ?? ""), message = String(msgId ?? "");
        if (!message || message === "0") return false;
        const prior = completed.get(message);
        if (prior && prior.attrId === id && sameOwner(prior.owner, owner)) return true;
        const entry = pending.get(id);
        if (!entry || !sameOwner(entry.owner, owner)) return false;
        completed.set(message, { owner, kind: entry.kind, peer: entry.peer, attrId: id, time: now() });
        return true;
    }
    function unwatch(attrId, owner) {
        const id = String(attrId ?? ""), entry = pending.get(id);
        if (!entry || !sameOwner(entry.owner, owner)) return false;
        pending.delete(id);
        if (entry.msgId) byMessage.delete(entry.msgId);
        return true;
    }
    function observe(record) {
        const message = String(record?.msgId ?? "");
        const id = recordAttrId(record) || byMessage.get(message) || "";
        const entry = pending.get(id);
        if (!entry) return;
        if (message && message !== "0") { entry.msgId = message; byMessage.set(message, id); }
        const status = Number(record?.sendStatus);
        if (status !== 0 && !(status === 2 && message && message !== "0")) return;
        if (status === 2) mark(id, entry.owner, message);
        const payload = { attrId: id, status: status === 2 ? "sent" : "failed", msgId: status === 2 ? message : "" };
        queueMicrotask(() => { try { if (!entry.owner.isDestroyed?.()) entry.owner.send("EnhancedQQ.outgoingStatus", payload); } catch {} });
    }
    function consumeRecall(msgId, owner, peer) {
        prune();
        const id = String(msgId ?? ""), entry = completed.get(id);
        if (!entry || !sameOwner(entry.owner, owner) || entry.kind !== "red-packet-text") return false;
        if (entry.peer && (!peer || entry.peer.chatType !== Number(peer.chatType) || entry.peer.peerUid !== String(peer.peerUid || "") || entry.peer.guildId !== String(peer.guildId || ""))) return false;
        completed.delete(id);
        return true;
    }
    function isPacketPassword(attrId, owner) {
        const entry = pending.get(String(attrId ?? ""));
        return Boolean(entry && entry.kind === "red-packet-text" && sameOwner(entry.owner, owner));
    }
    function clear() { pending.clear(); byMessage.clear(); completed.clear(); }
    return { watch, mark, unwatch, observe, consumeRecall, isPacketPassword, clear };
}

module.exports = { createOutgoingTracker, recordAttrId };
