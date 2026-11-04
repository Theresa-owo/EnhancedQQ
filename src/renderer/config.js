export const SLUG = "enhancedqq";
export const SCHEMA_VERSION = 1;

export const DEFAULT_CONFIG = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    features: Object.freeze({})
});

function record(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeConfig(value) {
    const input = record(value);
    return {
        ...input,
        schemaVersion: SCHEMA_VERSION,
        features: { ...record(input.features) }
    };
}

export async function readConfig(api) {
    return normalizeConfig(await api.get(SLUG, {}));
}

// Read immediately before writing so separate settings windows do not normally
// overwrite unrelated keys using an old in-memory copy.
export async function writeConfig(api, patch) {
    const existing = record(await api.get(SLUG, {}));
    if (Number.isInteger(existing.schemaVersion) && existing.schemaVersion > SCHEMA_VERSION) {
        throw new Error("配置来自更新版本，当前版本不会覆盖它。");
    }
    const change = record(patch);
    const updated = normalizeConfig({
        ...existing,
        ...change,
        features: { ...record(existing.features), ...record(change.features) }
    });
    const result = await api.set(SLUG, updated);
    if (result !== true) throw new Error("配置未能保存，请检查 LiteLoader 数据目录的写入权限。");
    return updated;
}
