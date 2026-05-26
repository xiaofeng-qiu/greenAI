import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type { AdminConfig } from "../config.js";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireAdminAuth(config: AdminConfig) {
  return async function adminAuth(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "missing_token" });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token || !safeEqual(token, config.ADMIN_API_TOKEN)) {
      return reply.status(401).send({ error: "invalid_token" });
    }
  };
}
