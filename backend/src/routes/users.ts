import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/authGuard.js";
import { isValidIanaTimeZone } from "../lib/timezone.js";

const patchBody = z.object({
  timezone: z
    .string()
    .min(2)
    .max(64)
    .refine(isValidIanaTimeZone, "invalid_timezone"),
});

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/users/me", async (req) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { id: true, timezone: true, createdAt: true },
    });
    return user;
  });

  app.patch("/users/me", async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    const user = await app.prisma.user.update({
      where: { id: req.userId! },
      data: { timezone: parsed.data.timezone },
      select: { id: true, timezone: true, createdAt: true },
    });
    return user;
  });
};

export default usersRoutes;
