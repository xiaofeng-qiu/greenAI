import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../lib/authGuard.js";
import {
  fetchOpenMeteoCurrent,
  fetchOpenMeteoDailyForecast,
} from "../services/openMeteo.js";

const weatherRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/weather/current", async (req, reply) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { latitude: true, longitude: true },
    });
    if (user.latitude == null || user.longitude == null) {
      return reply.status(400).send({ error: "no_location" });
    }
    try {
      const current = await fetchOpenMeteoCurrent({
        latitude: user.latitude,
        longitude: user.longitude,
      });
      return {
        ...current,
        latitude: user.latitude,
        longitude: user.longitude,
      };
    } catch {
      return reply.status(502).send({ error: "weather_upstream" });
    }
  });

  /** 未来数日逐日预报（与用户时区对齐），用于设置页与养护提示。 */
  app.get("/weather/forecast", async (req, reply) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { latitude: true, longitude: true, timezone: true },
    });
    if (user.latitude == null || user.longitude == null) {
      return reply.status(400).send({ error: "no_location" });
    }
    try {
      const days = await fetchOpenMeteoDailyForecast({
        latitude: user.latitude,
        longitude: user.longitude,
        timezone: user.timezone || "Asia/Shanghai",
        forecastDays: 3,
      });
      return {
        timezone: user.timezone,
        latitude: user.latitude,
        longitude: user.longitude,
        days,
      };
    } catch {
      return reply.status(502).send({ error: "weather_upstream" });
    }
  });
};

export default weatherRoutes;
