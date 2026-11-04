const fs = require("node:fs");
const path = require("node:path");
const { zipSync } = require("fflate");

const root = path.resolve(__dirname, "..");
const files = {};
function add(relative) {
    const full = path.join(root, ...relative.split("/"));
    const item = fs.lstatSync(full);
    if (item.isSymbolicLink()) return;
    if (item.isDirectory()) {
        for (const entry of fs.readdirSync(full).sort()) {
            if (relative === "node_modules" && entry === ".bin") continue;
            add(`${relative}/${entry}`);
        }
    } else if (item.isFile()) files[relative] = fs.readFileSync(full);
}
for (const name of ["manifest.json", "package.json", "package-lock.json", "README.md", "LICENSE", "src", "assets", "patches", "node_modules"]) add(name);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (manifest.slug !== "enhancedqq" || manifest.version !== pkg.version) throw new Error("manifest and package versions must match");
for (const name of Object.keys(pkg.dependencies || {})) if (!files[`node_modules/${name}/package.json`]) throw new Error(`missing dependency: ${name}`);
const output = path.join(root, "dist", "EnhancedQQ.zip");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, zipSync(files, { level: 6 }));
console.log(`Created ${output} (${manifest.version})`);
