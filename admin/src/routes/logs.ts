import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { paginationQuery, skipTake } from "../lib/pagination.js";
import { readLastLines } from "../lib/tailFile.js";
import type { AdminConfig } from "../config.js";

const deviceIngestQuery = paginationQuery.extend({
  deviceId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  level: z.string().trim().min(1).max(32).optional(),
});

const logsRoutes = (config: AdminConfig): FastifyPluginAsync => {
  return async (app) => {
    app.get("/api/logs/device-ingest", async (req, reply) => {
      const parsed = deviceIngestQuery.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_query" });
      }
      const { page, pageSize, deviceId, userId, level } = parsed.data;
      const { skip, take } = skipTake({ page, pageSize });

      const where = {
        ...(deviceId ? { deviceId } : {}),
        ...(level ? { level } : {}),
        ...(userId
          ? { device: { userId } }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.deviceIngestLog.count({ where }),
        prisma.deviceIngestLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          include: {
            device: {
              select: {
                id: true,
                hardwareId: true,
                userId: true,
                user: { select: { openid: true } },
              },
            },
          },
        }),
      ]);

      return { page, pageSize, total, items };
    });

    app.get("/api/logs/system", async (req, reply) => {
      const parsed = z
        .object({
          fileLines: z.coerce.number().int().min(1).max(500).default(80),
        })
        .safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "invalid_query" });
      }
      const { fileLines } = parsed.data;

      const [
        notificationLogs,
        taskErrors,
        deviceErrors,
        fileTail,
      ] = await Promise.all([
        prisma.notificationLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            task: {
              select: {
                id: true,
                type: true,
                status: true,
                dueDate: true,
                lastError: true,
                plant: {
                  select: {
                    id: true,
                    nickname: true,
                    userId: true,
                    user: { select: { openid: true } },
                  },
                },
              },
            },
          },
        }),
        prisma.careTask.findMany({
          where: { lastError: { not: null } },
          orderBy: { dueDate: "desc" },
          take: 80,
          select: {
            id: true,
            type: true,
            status: true,
            dueDate: true,
            lastError: true,
            createdAt: true,
            plant: {
              select: {
                id: true,
                nickname: true,
                userId: true,
                user: { select: { openid: true } },
              },
            },
          },
        }),
        prisma.deviceIngestLog.findMany({
          where: {
            level: { in: ["error", "warn", "ERROR", "WARN"] },
          },
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            device: {
              select: {
                hardwareId: true,
                user: { select: { openid: true } },
              },
            },
          },
        }),
        config.ADMIN_SYSTEM_LOG_PATH
          ? readLastLines(config.ADMIN_SYSTEM_LOG_PATH, fileLines).catch(
              () => [] as string[]
            )
          : Promise.resolve([] as string[]),
      ]);

      return {
        notificationLogs,
        taskErrors,
        deviceWarnErrorLogs: deviceErrors,
        serverLogTail: fileTail,
        serverLogPath: config.ADMIN_SYSTEM_LOG_PATH ?? null,
      };
    });
  };
};

export default logsRoutes;
