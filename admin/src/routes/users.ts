import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { paginationQuery, skipTake } from "../lib/pagination.js";

const listQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(128).optional(),
});

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/users", async (req, reply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_query" });
    }
    const { page, pageSize, q } = parsed.data;
    const { skip, take } = skipTake({ page, pageSize });

    const where = q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { openid: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          openid: true,
          timezone: true,
          latitude: true,
          longitude: true,
          locationLabel: true,
          airConditioning: true,
          windowAspect: true,
          createdAt: true,
          _count: {
            select: { plants: true, devices: true },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: rows.map(({ _count, ...r }) => ({
        ...r,
        plantCount: _count.plants,
        deviceCount: _count.devices,
      })),
    };
  });

  app.get<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const id = req.params.id;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        plants: {
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            id: true,
            nickname: true,
            speciesLabel: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { devices: true, tasks: true } },
          },
        },
        devices: {
          orderBy: { lastSeenAt: "desc" },
          take: 100,
          select: {
            id: true,
            hardwareId: true,
            label: true,
            plantId: true,
            lastSeenAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      return reply.status(404).send({ error: "not_found" });
    }
    return user;
  });
};

export default usersRoutes;
