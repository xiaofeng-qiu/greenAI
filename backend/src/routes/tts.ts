import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { verifyDeviceIngestHmac } from "../lib/hmacAuth.js";
import { synthesizeMp3 } from "../services/edgeTts.js";

/**
 * 设备端文字转语音：固件 POST 文本，服务端用 edge-tts 合成，
 * 返回 24kHz 单声道 MP3（设备用 ESP8266Audio 解码 → I2S → MAX98357A）。
 *
 * 鉴权与 /internal/sensors/ingest 完全一致：
 *   header  x-timestamp + x-signature
 *   签名串  `${ts}\n${sha256_hex(rawBody)}`，密钥 SENSOR_HMAC_SECRET。
 */
const payloadSchema = z.object({
  hardwareId: z.string().min(1).max(128),
  text: z.string().min(1).max(500),
  /** 可选指定发音人，默认 zh-CN-XiaoxiaoNeural */
  voice: z.string().min(1).max(64).optional(),
});

const ttsRoutes: FastifyPluginAsync = async (app) => {
  // 与 sensorIngest 同样的「原始字节」捕获，供 HMAC 校验（不泄漏到兄弟路由）。
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      const raw = typeof body === "string" ? body : body.toString("utf8");
      (req as unknown as { rawBody: string }).rawBody = raw;
      if (raw.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        e.statusCode = 400;
        done(e, undefined);
      }
    }
  );

  app.post("/internal/tts", async (req, reply) => {
    const secret = ttsSecret(reply);
    if (!secret) return;

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";

    if (
      !verifyDeviceIngestHmac({
        secret,
        timestampHeader: stringHeader(req.headers["x-timestamp"]),
        signatureHeader: stringHeader(req.headers["x-signature"]),
        rawBody,
        skewSeconds: 300,
      })
    ) {
      return reply.status(401).send({ error: "invalid_signature" });
    }

    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_payload" });
    }

    // 设备必须已登记（与 ingest 一致，避免被任意 hardwareId 滥用）。
    const deviceRow = await app.prisma.device.findFirst({
      where: { hardwareId: parsed.data.hardwareId },
      select: { id: true },
    });
    if (!deviceRow) {
      return reply.status(404).send({ error: "device_not_registered" });
    }

    const voice = parsed.data.voice || process.env.TTS_VOICE || "zh-CN-XiaoxiaoNeural";
    try {
      const mp3 = await synthesizeMp3(parsed.data.text, voice);
      req.log.info(
        { hardwareId: parsed.data.hardwareId, bytes: mp3.length, voice },
        "tts_synthesized"
      );
      return reply
        .header("content-type", "audio/mpeg")
        .header("content-length", String(mp3.length))
        .send(mp3);
    } catch (err) {
      req.log.error({ err }, "tts_synthesis_failed");
      return reply.status(502).send({ error: "tts_upstream" });
    }
  });
};

function ttsSecret(reply: FastifyReply): string | undefined {
  const config = loadConfig();
  if (!config.SENSOR_HMAC_SECRET) {
    void reply.status(503).send({ error: "tts_disabled" });
    return undefined;
  }
  return config.SENSOR_HMAC_SECRET;
}

function stringHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default ttsRoutes;
