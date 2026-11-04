const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const VOICES = ["zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural", "zh-CN-YunxiNeural", "zh-CN-YunjianNeural"];

function createTtsService(dataDir) {
    const tempDir = path.join(dataDir, "tts-temp");
    const owned = new Set();
    return {
        async synthesize(text, voice) {
            if (typeof text !== "string" || !text.trim() || text.length > 2000) throw new Error("请输入 1–2000 个字符。");
            if (!VOICES.includes(voice)) throw new Error("请选择有效音色。");
            const { EdgeTTS } = require("node-edge-tts");
            const tts = new EdgeTTS({ voice, lang: "zh-CN", timeout: 20000 });
            const chunks = [];
            for await (const chunk of tts.streamAudio(text)) if (Buffer.isBuffer(chunk)) chunks.push(chunk);
            const audio = Buffer.concat(chunks);
            if (!audio.length) throw new Error("语音服务没有返回音频。");
            return audio;
        },
        async encode(pcm) {
            const samples = Buffer.from(pcm);
            if (!samples.length || samples.length % 2 || samples.length > 24000 * 2 * 180) throw new Error("语音数据无效或过长。");
            const { encode } = require("silk-wasm");
            const result = await encode(samples, 24000);
            const bytes = Buffer.from(result.data);
            await fs.mkdir(tempDir, { recursive: true });
            const file = path.join(tempDir, `${crypto.randomUUID()}.silk`);
            await fs.writeFile(file, bytes, { flag: "wx" });
            owned.add(file);
            return { file, md5: crypto.createHash("md5").update(bytes).digest("hex"), size: String(bytes.length), duration: Math.max(1, Math.ceil(result.duration / 1000)) };
        },
        async copyToCache(file, destination) {
            if (!owned.has(file) || typeof destination !== "string" || !path.isAbsolute(destination)) throw new Error("语音缓存路径无效。");
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.copyFile(file, destination);
        },
        async release(file) {
            if (!owned.delete(file)) return;
            await fs.unlink(file).catch(() => {});
        }
    };
}

module.exports = { createTtsService, VOICES };
