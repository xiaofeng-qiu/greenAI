import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  CareTaskStatus,
  CareTaskType,
  LightLevel,
  WaterPreference,
} from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prismaPlugin from "../plugins/prisma.js";
import internalJobsRoutes from "../routes/internalJobs.js";
import plantsRoutes from "../routes/plants.js";
import tasksRoutes from "../routes/tasks.js";
import { signUserToken } from "../lib/jwt.js";

/** Set RUN_INTEGRATION_TESTS=1 (CI does) when Postgres is up and migrated. */
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET);

async function buildApp(
  ...plugins: FastifyPluginAsync[]
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(prismaPlugin);
  for (const p of plugins) {
    await app.register(p);
  }
  await app.ready();
  return app;
}

describe.skipIf(!runIntegration)("API authz — plants & tasks", () => {
  let app: FastifyInstance | undefined;
  const secret = process.env.JWT_SECRET as string;
  let userAId = "";
  let userBId = "";
  let plantAId = "";
  let taskAId = "";

  beforeAll(async () => {
    app = await buildApp(plantsRoutes, tasksRoutes);
    const a = await app.prisma.user.create({
      data: { openid: `it-a-${randomUUID()}` },
    });
    const b = await app.prisma.user.create({
      data: { openid: `it-b-${randomUUID()}` },
    });
    userAId = a.id;
    userBId = b.id;
    const plant = await app.prisma.plant.create({
      data: {
        userId: userAId,
        nickname: "IntegrationPlant",
        speciesLabel: "Test",
        waterPreference: WaterPreference.medium,
        indoor: true,
        heating: false,
        lightLevel: LightLevel.medium,
        carePlan: { create: { baseIntervalDays: 7, horizonDays: 14 } },
      },
    });
    plantAId = plant.id;
    const task = await app.prisma.careTask.create({
      data: {
        plantId: plantAId,
        type: CareTaskType.water,
        dueDate: new Date("2030-06-01T00:00:00.000Z"),
        status: CareTaskStatus.pending,
      },
    });
    taskAId = task.id;
  });

  afterAll(async () => {
    if (!app) return;
    try {
      if (userAId && userBId) {
        await app.prisma.user.deleteMany({
          where: { id: { in: [userAId, userBId] } },
        });
      }
    } finally {
      await app.close();
    }
  });

  it("GET /plants/:id returns 401 without Authorization", async () => {
    const res = await app!.inject({ method: "GET", url: `/plants/${plantAId}` });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "missing_token" });
  });

  it("GET /plants/:id returns 401 for invalid JWT", async () => {
    const res = await app!.inject({
      method: "GET",
      url: `/plants/${plantAId}`,
      headers: { authorization: "Bearer not-a-valid-jwt" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "invalid_token" });
  });

  it("owner can GET their plant", async () => {
    const token = signUserToken(userAId, secret);
    const res = await app!.inject({
      method: "GET",
      url: `/plants/${plantAId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(plantAId);
  });

  it("other user gets 404 for plant GET (no leak)", async () => {
    const token = signUserToken(userBId, secret);
    const res = await app!.inject({
      method: "GET",
      url: `/plants/${plantAId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "not_found" });
  });

  it("other user cannot complete foreign task", async () => {
    const token = signUserToken(userBId, secret);
    const res = await app!.inject({
      method: "POST",
      url: `/tasks/${taskAId}/complete`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "not_found" });
  });
});

describe.skipIf(!runIntegration)("API internal — cron HMAC", () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildApp(internalJobsRoutes);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("POST /internal/jobs/reminders returns 401 when signature invalid", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/internal/jobs/reminders",
      headers: {
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-signature": "00".repeat(32),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "invalid_signature" });
  });
});
