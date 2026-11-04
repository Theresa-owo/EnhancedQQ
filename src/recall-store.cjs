const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const v8 = require("node:v8");

function digest(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// Only successfully recovered messages are written to disk. Each account and
// message has its own file, so two QQ processes do not share a database lock.
function createRecallStore(root) {
    function fileFor(account, id) {
        return path.join(root, digest(account), `${digest(id)}.bin`);
    }
    return {
        load(account, id) {
            if (!account || !id) return null;
            try {
                const saved = v8.deserialize(fs.readFileSync(fileFor(account, id)));
                return saved?.version === 1 && saved.id === String(id) ? saved : null;
            } catch { return null; }
        },
        save(account, id, entry) {
            if (!account || !id) return false;
            const file = fileFor(account, id);
            try {
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, v8.serialize({ version: 1, id: String(id), ...entry }), { flag: "wx" });
                return true;
            } catch (error) {
                return error?.code === "EEXIST";
            }
        }
    };
}

module.exports = { createRecallStore };
