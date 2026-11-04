function createRedPacketGate(limit = 1000) {
    const seen = new Map();
    return {
        reserve(key, enabled, owner = "", type = "") {
            if (!enabled || typeof key !== "string" || !key || key.length > 300 || seen.has(key)) return false;
            seen.set(key, { owner, type, consumed: false });
            if (seen.size > limit) seen.delete(seen.keys().next().value);
            return true;
        },
        permitted(key, enabled, owner = "", consume = false, type = "") {
            const entry = seen.get(key);
            if (!enabled || !entry || entry.owner !== owner || entry.type !== type || entry.consumed) return false;
            if (consume) entry.consumed = true;
            return true;
        },
        clear() { seen.clear(); }
    };
}

module.exports = { createRedPacketGate };
