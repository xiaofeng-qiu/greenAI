import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { paginationQuery, skipTake } from "../lib/pagination.js";

const listQuery = paginationQuery;

/**
 * 与硬件设备关联的植物：设备绑定了 plantId，或用户名下任意设备最近上报读数涉及的植物摘要。
 */
const hardwarePlantsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/hardware/plants", async (req, reply) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_query" });
    }
    const { page, pageSize } = parsed.data;
    const { skip, take } = skipTake({ page, pageSize });

    const plantRows = await prisma.device.findMany({
      where: { plantId: { not: null } },
      select: { plantId: true },
      distinct: ["plantId"],
    });
    const ids = [
      ...new Set(
        plantRows.map((d) => d.plantId).filter((id): id is string => Boolean(id))
      ),
    ].sort();

    const total = ids.length;
    const pageIds = ids.slice(skip, skip + take);

    const plants = await prisma.plant.findMany({
      where: { id: { in: pageIds } },
      include: {
        user: {
          select: { id: true, openid: true, timezone: true },
        },
        devices: {
          select: {
            id: true,
            hardwareId: true,
            label: true,
            lastSeenAt: true,
            readings: {
              orderBy: { measuredAt: "desc" },
              take: 1,
              select: {
                measuredAt: true,
                tempC: true,
                soilMoisture: true,
                phLevel: true,
                lux: true,
              },
            },
          },
        },
      },
    });

    const byId = new Map(plants.map((p) => [p.id, p]));
    const ordered = pageIds.map((id) => byId.get(id)).filter(Boolean);

    return {
      page,
      pageSize,
      total,
      items: ordered,
    };
  });

  app.get<{ Params: { plantId: string } }>(
    "/api/hardware/plants/:plantId",
    async (req, reply) => {
      const plantId = req.params.plantId;
      const plant = await prisma.plant.findUnique({
        where: { id: plantId },
        include: {
          user: {
            select: { id: true, openid: true, timezone: true, createdAt: true },
          },
          devices: {
            select: {
              id: true,
              hardwareId: true,
              label: true,
              lastSeenAt: true,
              createdAt: true,
              ingestLogs: {
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                  id: true,
                  level: true,
                  message: true,
                  occurredAt: true,
                  createdAt: true,
                },
              },
              readings: {
                orderBy: { measuredAt: "desc" },
                take: 50,
                select: {
                  id: true,
                  measuredAt: true,
                  tempC: true,
                  soilMoisture: true,
                  phLevel: true,
                  lux: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });
      if (!plant) {
        return reply.status(404).send({ error: "not_found" });
      }
      if (plant.devices.length === 0) {
        return reply
          .status(404)
          .send({ error: "no_hardware_linked", message: "该植物未绑定设备" });
      }
      return plant;
    }
  );
};

export default hardwarePlantsRoutes;
