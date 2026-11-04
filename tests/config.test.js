import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, normalizeConfig, readConfig, writeConfig } from "../src/renderer/config.js";

function storage(initial = {}, succeeds = true) {
    let data = structuredClone(initial);
    return {
        async get(slug) { assert.equal(slug, "enhancedqq"); return structuredClone(data); },
        async set(slug, value) {
            assert.equal(slug, "enhancedqq");
            if (!succeeds) return false;
            data = structuredClone(value);
            return true;
        },
        snapshot() { return structuredClone(data); }
    };
}

test("missing or invalid feature configuration becomes an empty map", () => {
    assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
    assert.deepEqual(normalizeConfig({ features: ["invalid"] }), DEFAULT_CONFIG);
});

test("feature updates retain other settings and old appearance data", async () => {
    const api = storage({ theme: "dark", accent: "mint", features: { first: { enabled: true } } });
    assert.equal((await readConfig(api)).theme, "dark");
    await writeConfig(api, { features: { second: { enabled: false } } });
    assert.deepEqual(api.snapshot(), {
        schemaVersion: 1, theme: "dark", accent: "mint",
        features: { first: { enabled: true }, second: { enabled: false } }
    });
});

test("failed writes and newer schemas are reported without overwriting", async () => {
    const failed = storage({}, false);
    await assert.rejects(writeConfig(failed, { features: { example: true } }), /未能保存/);
    assert.deepEqual(failed.snapshot(), {});
    const future = storage({ schemaVersion: 2, features: { example: true } });
    await assert.rejects(writeConfig(future, { features: { example: false } }), /更新版本/);
    assert.deepEqual(future.snapshot(), { schemaVersion: 2, features: { example: true } });
});
