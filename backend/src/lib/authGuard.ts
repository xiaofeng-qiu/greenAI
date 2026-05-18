import type { FastifyReply, FastifyRequest } from "fastify";
import { loadConfig } from "../config.js";
import { verifyUserToken } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "missing_token" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const config = loadConfig();
    const payload = verifyUserToken(token, config.JWT_SECRET);
    req.userId = payload.sub;
  } catch {
    return reply.status(401).send({ error: "invalid_token" });
  }
}
