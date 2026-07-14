import { createHash, randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { signUserToken } from "../lib/jwt.js";
import { jscode2session } from "../services/wechat.js";

const bodySchema = z.object({
  code: z.string().min(1),
});

const guestBodySchema = z.object({
  guestKey: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
});

function guestOpenid(guestKey: string): string {
  const digest = createHash("sha256").update(guestKey).digest("hex");
  return `guest:${digest}`;
}

const authRoutes: FastifyPluginAsync = async (app) => {
  const config = loadConfig();

  app.post("/auth/wechat", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    let wx;
    try {
      wx = await jscode2session({
        appId: config.WECHAT_APPID,
        secret: config.WECHAT_SECRET,
        code: parsed.data.code,
      });
    } catch {
      return reply.status(401).send({ error: "wechat_auth_failed" });
    }

    const user = await app.prisma.user.upsert({
      where: { openid: wx.openid },
      create: { openid: wx.openid },
      update: {},
    });

    const token = signUserToken(user.id, config.JWT_SECRET);
    return { token, userId: user.id };
  });

  app.post("/auth/guest", async (req, reply) => {
    const parsed = guestBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }

    const guestKey =
      parsed.data.guestKey ?? randomBytes(32).toString("base64url");
    const user = await app.prisma.user.upsert({
      where: { openid: guestOpenid(guestKey) },
      create: { openid: guestOpenid(guestKey) },
      update: {},
    });
    const token = signUserToken(user.id, config.JWT_SECRET);
    return { token, userId: user.id, guestKey };
  });

  app.post("/auth/dev", async (req, reply) => {
    const user = await app.prisma.user.upsert({
      where: { openid: "dev" },
      create: { openid: "dev" },
      update: {},
    });
    const token = signUserToken(user.id, config.JWT_SECRET);
    return { token, userId: user.id };
  });
};

export default authRoutes;

