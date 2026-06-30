import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 用官方维护的 edge-tts (Python) 合成 **24kHz 单声道 MP3**（CLI 默认即此格式）。
 * 设备端（ESP32 + ESP8266Audio）解码 MP3 后经 I2S 推 MAX98357A 播放。
 *
 * 为什么走 Python CLI 而不是纯 Node：微软会不定期更新 Sec-MS-GEC 令牌算法与
 * Chromium 版本号，纯 Node 复刻很容易过期被 403。官方 edge-tts 会持续跟进。
 *
 * 依赖：服务器/开发机需安装  pip install edge-tts
 *       命令可用环境变量 EDGE_TTS_BIN 覆盖；支持多词形式，例如：
 *         EDGE_TTS_BIN="edge-tts"            （默认，console 脚本在 PATH 时）
 *         EDGE_TTS_BIN="python -m edge_tts"  （脚本不在 PATH，用模块方式）
 *         EDGE_TTS_BIN="py -m edge_tts"
 */
const EDGE_TTS_CMD = process.env.EDGE_TTS_BIN || "edge-tts";

export async function synthesizeMp3(
  text: string,
  voice = "zh-CN-XiaoxiaoNeural"
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "greenai-tts-"));
  const outPath = join(dir, "out.mp3");
  try {
    await runEdgeTts(["--voice", voice, "--text", text, "--write-media", outPath]);
    const buf = await readFile(outPath);
    if (buf.length === 0) throw new Error("edge-tts produced empty audio");
    return buf;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runEdgeTts(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // 支持 EDGE_TTS_BIN 为多词命令（如 "python -m edge_tts"）。
    const parts = EDGE_TTS_CMD.split(/\s+/).filter(Boolean);
    const bin = parts[0];
    const prefixArgs = parts.slice(1);
    // shell:false + 数组参数：避免命令注入（text 可能含特殊字符）。
    const child = spawn(bin, [...prefixArgs, ...args], { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") {
        reject(
          new Error(
            `'${EDGE_TTS_CMD}' 未找到。请先安装：pip install edge-tts；若 edge-tts 不在 PATH，设 EDGE_TTS_BIN="python -m edge_tts"`
          )
        );
      } else {
        reject(e);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts 退出码 ${code}: ${stderr.trim().slice(0, 500)}`));
    });
  });
}
