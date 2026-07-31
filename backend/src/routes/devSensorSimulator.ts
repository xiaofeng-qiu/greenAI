import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { LightLevel, WaterPreference } from "@prisma/client";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { ingestSensorReadings } from "../services/sensorIngest.js";

const userParamsSchema = z.object({
  userId: z.string().min(1).max(64),
});

const deviceParamsSchema = z.object({
  deviceId: z.string().min(1).max(64),
});

const plantParamsSchema = z.object({
  plantId: z.string().min(1).max(64),
});

const jobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const simulatedDeviceSchema = z.object({
  hardwareId: z.string().trim().min(1).max(128),
  label: z.string().trim().max(60).nullable().optional(),
  plantId: z.string().min(1).max(64).nullable().optional(),
});

const simulatedPlantSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  speciesLabel: z.string().trim().min(1).max(120),
  waterPreference: z.nativeEnum(WaterPreference).default(WaterPreference.medium),
  indoor: z.boolean().default(true),
  heating: z.boolean().default(false),
  lightLevel: z.nativeEnum(LightLevel).default(LightLevel.medium),
});

const simulatedReadingSchema = z
  .object({
    measuredAt: z.union([z.string().datetime(), z.number().int()]),
    tempC: z.number().finite().min(-50).max(80).optional(),
    soilMoisture: z.number().finite().min(0).max(100).optional(),
    phLevel: z.number().finite().min(0).max(14).optional(),
    lux: z.number().finite().min(0).max(200_000).optional(),
  })
  .refine(
    (reading) =>
      reading.tempC !== undefined ||
      reading.soilMoisture !== undefined ||
      reading.phLevel !== undefined ||
      reading.lux !== undefined,
    { message: "at_least_one_metric_required" }
  );

const simulatedReadingsSchema = z.object({
  readings: z.array(simulatedReadingSchema).min(1).max(200),
});

const scheduledJobSchema = z.object({
  total: z.number().int().min(1).max(200),
  intervalSeconds: z.number().int().min(1).max(86_400),
  jitter: z.boolean().default(false),
  reading: z
    .object({
      tempC: z.number().finite().min(-50).max(80).optional(),
      soilMoisture: z.number().finite().min(0).max(100).optional(),
      phLevel: z.number().finite().min(0).max(14).optional(),
      lux: z.number().finite().min(0).max(200_000).optional(),
    })
    .refine(
      (reading) =>
        reading.tempC !== undefined ||
        reading.soilMoisture !== undefined ||
        reading.phLevel !== undefined ||
        reading.lux !== undefined,
      { message: "at_least_one_metric_required" }
    ),
});

type JobStatus = "running" | "completed" | "stopped" | "failed";
type ReadingTemplate = z.infer<typeof scheduledJobSchema>["reading"];
type ScheduledJob = {
  id: string;
  deviceId: string;
  status: JobStatus;
  total: number;
  sentCount: number;
  inserted: number;
  deduped: number;
  intervalSeconds: number;
  jitter: boolean;
  reading: ReadingTemplate;
  startedAt: string;
  nextSendAt: string | null;
  completedAt: string | null;
  error: string | null;
  stopRequested: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

const scheduledJobs = new Map<string, ScheduledJob>();
const latestJobByDevice = new Map<string, string>();

function jobSnapshot(job: ScheduledJob) {
  return {
    id: job.id,
    deviceId: job.deviceId,
    status: job.status,
    total: job.total,
    sentCount: job.sentCount,
    inserted: job.inserted,
    deduped: job.deduped,
    intervalSeconds: job.intervalSeconds,
    startedAt: job.startedAt,
    nextSendAt: job.nextSendAt,
    completedAt: job.completedAt,
    error: job.error,
  };
}

function jitterMetric(
  key: keyof ReadingTemplate,
  value: number
): number {
  const amplitude = {
    tempC: 1.2,
    soilMoisture: 3,
    phLevel: 0.15,
    lux: Math.max(20, value * 0.08),
  }[key];
  const [min, max] = {
    tempC: [-50, 80],
    soilMoisture: [0, 100],
    phLevel: [0, 14],
    lux: [0, 200_000],
  }[key];
  const next = Math.min(max, Math.max(min, value + (Math.random() * 2 - 1) * amplitude));
  const factor = key === "lux" ? 1 : 10;
  return Math.round(next * factor) / factor;
}

function buildScheduledReading(job: ScheduledJob) {
  const reading: ReadingTemplate & { measuredAt: Date } = {
    measuredAt: new Date(),
  };
  for (const key of ["tempC", "soilMoisture", "phLevel", "lux"] as const) {
    const value = job.reading[key];
    if (value !== undefined) {
      reading[key] = job.jitter ? jitterMetric(key, value) : value;
    }
  }
  return reading;
}

/**
 * 独立开发控制台 API。无需用户登录，但必须显式设置
 * ENABLE_DEV_SENSOR_SIMULATOR=1；生产环境必须保持关闭。
 */
const devSensorSimulatorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (_req, reply) => {
    if (loadConfig().ENABLE_DEV_SENSOR_SIMULATOR !== "1") {
      return reply.status(404).send({ error: "not_found" });
    }
  });

  const finishJob = (
    job: ScheduledJob,
    status: Exclude<JobStatus, "running">,
    error: string | null = null
  ) => {
    if (job.timer) clearTimeout(job.timer);
    job.timer = null;
    job.status = status;
    job.nextSendAt = null;
    job.completedAt = new Date().toISOString();
    job.error = error;
  };

  const runScheduledJob = async (
    job: ScheduledJob,
    device: { hardwareId: string; userId: string }
  ): Promise<void> => {
    if (job.stopRequested) {
      finishJob(job, "stopped");
      return;
    }

    try {
      const result = await ingestSensorReadings(app.prisma, {
        hardwareId: device.hardwareId,
        userId: device.userId,
        plantId: undefined,
        readings: [buildScheduledReading(job)],
      });
      job.sentCount += 1;
      job.inserted += result.inserted;
      job.deduped += result.deduped;

      if (job.stopRequested) {
        finishJob(job, "stopped");
        return;
      }
      if (job.sentCount >= job.total) {
        finishJob(job, "completed");
        return;
      }

      job.nextSendAt = new Date(
        Date.now() + job.intervalSeconds * 1_000
      ).toISOString();
      job.timer = setTimeout(() => {
        job.timer = null;
        void runScheduledJob(job, device);
      }, job.intervalSeconds * 1_000);
    } catch (error) {
      finishJob(
        job,
        "failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  app.get("/dev/sensor-simulator/users", async () => {
    return app.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        openid: true,
        displayName: true,
        createdAt: true,
        _count: {
          select: { plants: true, devices: true },
        },
      },
    });
  });

  app.delete("/dev/sensor-simulator/users/:userId", async (req, reply) => {
    const params = userParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: params.data.userId },
      select: {
        id: true,
        _count: {
          select: { plants: true, devices: true },
        },
      },
    });
    if (!user) {
      return reply.status(404).send({
        error: "user_not_found",
        message: "用户不存在",
      });
    }

    await app.prisma.user.delete({ where: { id: user.id } });
    return {
      deleted: true,
      userId: user.id,
      plants: user._count.plants,
      devices: user._count.devices,
    };
  });

  app.get("/dev/sensor-simulator/users/:userId/context", async (req, reply) => {
    const params = userParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true, openid: true },
    });
    if (!user) {
      return reply.status(404).send({
        error: "user_not_found",
        message: "用户不存在",
      });
    }

    const [plants, devices] = await Promise.all([
      app.prisma.plant.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nickname: true,
          speciesLabel: true,
        },
      }),
      app.prisma.device.findMany({
        where: { userId: user.id },
        orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
        include: {
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
      }),
    ]);

    return {
      user,
      plants,
      devices: devices.map((device) => ({
        id: device.id,
        hardwareId: device.hardwareId,
        label: device.label,
        plantId: device.plantId,
        lastSeenAt: device.lastSeenAt,
        latestReading: device.readings[0] ?? null,
      })),
    };
  });

  app.post("/dev/sensor-simulator/users/:userId/plants", async (req, reply) => {
    const params = userParamsSchema.safeParse(req.params);
    const body = simulatedPlantSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "invalid_body",
        message: "模拟植物信息格式错误",
      });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true },
    });
    if (!user) {
      return reply.status(404).send({
        error: "user_not_found",
        message: "用户不存在",
      });
    }

    return app.prisma.plant.create({
      data: {
        userId: user.id,
        ...body.data,
        carePlan: {
          create: { baseIntervalDays: 7, horizonDays: 14 },
        },
      },
      select: {
        id: true,
        nickname: true,
        speciesLabel: true,
        createdAt: true,
      },
    });
  });

  app.patch("/dev/sensor-simulator/plants/:plantId", async (req, reply) => {
    const params = plantParamsSchema.safeParse(req.params);
    const body = simulatedPlantSchema
      .pick({ nickname: true, speciesLabel: true })
      .safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "invalid_body",
        message: "模拟植物信息格式错误",
      });
    }

    const plant = await app.prisma.plant.findUnique({
      where: { id: params.data.plantId },
      select: { id: true },
    });
    if (!plant) {
      return reply.status(404).send({
        error: "plant_not_found",
        message: "目标植物不存在",
      });
    }

    return app.prisma.plant.update({
      where: { id: plant.id },
      data: body.data,
      select: {
        id: true,
        nickname: true,
        speciesLabel: true,
        createdAt: true,
      },
    });
  });

  app.delete("/dev/sensor-simulator/plants/:plantId", async (req, reply) => {
    const params = plantParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }

    const plant = await app.prisma.plant.findUnique({
      where: { id: params.data.plantId },
      select: { id: true },
    });
    if (!plant) {
      return reply.status(404).send({
        error: "plant_not_found",
        message: "目标植物不存在",
      });
    }

    await app.prisma.plant.delete({ where: { id: plant.id } });
    return { deleted: true, plantId: plant.id };
  });

  app.post("/dev/sensor-simulator/users/:userId/devices", async (req, reply) => {
    const params = userParamsSchema.safeParse(req.params);
    const body = simulatedDeviceSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "invalid_body",
        message: "模拟设备信息格式错误",
      });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: params.data.userId },
      select: { id: true },
    });
    if (!user) {
      return reply.status(404).send({
        error: "user_not_found",
        message: "用户不存在",
      });
    }

    const { hardwareId, label, plantId } = body.data;
    const existing = await app.prisma.device.findFirst({
      where: { hardwareId },
      select: { userId: true },
    });
    if (existing && existing.userId !== user.id) {
      return reply.status(409).send({
        error: "hardware_id_bound_to_other_user",
        message: "该硬件 ID 已属于其他用户",
      });
    }

    if (plantId) {
      const plant = await app.prisma.plant.findFirst({
        where: { id: plantId, userId: user.id },
        select: { id: true },
      });
      if (!plant) {
        return reply.status(404).send({
          error: "plant_not_found",
          message: "目标植物不属于所选用户",
        });
      }
    }

    const update: { label?: string | null; plantId?: string | null } = {};
    if (label !== undefined) update.label = label;
    if (plantId !== undefined) update.plantId = plantId;

    return app.prisma.device.upsert({
      where: {
        userId_hardwareId: {
          userId: user.id,
          hardwareId,
        },
      },
      create: {
        userId: user.id,
        hardwareId,
        label: label ?? "开发模拟设备",
        plantId: plantId ?? null,
      },
      update,
      select: {
        id: true,
        hardwareId: true,
        label: true,
        plantId: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  });

  app.delete("/dev/sensor-simulator/devices/:deviceId", async (req, reply) => {
    const params = deviceParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }

    const device = await app.prisma.device.findUnique({
      where: { id: params.data.deviceId },
      select: { id: true },
    });
    if (!device) {
      return reply.status(404).send({
        error: "device_not_found",
        message: "模拟设备不存在",
      });
    }

    const jobId = latestJobByDevice.get(device.id);
    const job = jobId ? scheduledJobs.get(jobId) : undefined;
    if (job?.status === "running") finishJob(job, "stopped");
    if (jobId) scheduledJobs.delete(jobId);
    latestJobByDevice.delete(device.id);

    await app.prisma.device.delete({ where: { id: device.id } });
    return { deleted: true, deviceId: device.id };
  });

  app.post("/dev/sensor-simulator/devices/:deviceId/jobs", async (req, reply) => {
    const params = deviceParamsSchema.safeParse(req.params);
    const body = scheduledJobSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "invalid_body",
        message: "定时发送参数格式错误",
      });
    }

    const device = await app.prisma.device.findUnique({
      where: { id: params.data.deviceId },
      select: { hardwareId: true, userId: true },
    });
    if (!device) {
      return reply.status(404).send({
        error: "device_not_found",
        message: "模拟设备不存在",
      });
    }

    const latestId = latestJobByDevice.get(params.data.deviceId);
    const latest = latestId ? scheduledJobs.get(latestId) : undefined;
    if (latest?.status === "running") {
      return reply.status(409).send({
        error: "job_already_running",
        message: "该设备已有定时发送任务",
        job: jobSnapshot(latest),
      });
    }

    const job: ScheduledJob = {
      id: randomUUID(),
      deviceId: params.data.deviceId,
      status: "running",
      total: body.data.total,
      sentCount: 0,
      inserted: 0,
      deduped: 0,
      intervalSeconds: body.data.intervalSeconds,
      jitter: body.data.jitter,
      reading: body.data.reading,
      startedAt: new Date().toISOString(),
      nextSendAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      stopRequested: false,
      timer: null,
    };
    scheduledJobs.set(job.id, job);
    latestJobByDevice.set(job.deviceId, job.id);
    void runScheduledJob(job, device);
    return reply.status(202).send(jobSnapshot(job));
  });

  app.get("/dev/sensor-simulator/devices/:deviceId/job", async (req, reply) => {
    const params = deviceParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }
    const jobId = latestJobByDevice.get(params.data.deviceId);
    const job = jobId ? scheduledJobs.get(jobId) : undefined;
    return { job: job ? jobSnapshot(job) : null };
  });

  app.post("/dev/sensor-simulator/jobs/:jobId/stop", async (req, reply) => {
    const params = jobParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: "invalid_params" });
    }
    const job = scheduledJobs.get(params.data.jobId);
    if (!job) {
      return reply.status(404).send({
        error: "job_not_found",
        message: "定时发送任务不存在",
      });
    }
    if (job.status === "running") {
      job.stopRequested = true;
      if (job.timer) finishJob(job, "stopped");
    }
    return jobSnapshot(job);
  });

  app.post("/dev/sensor-simulator/devices/:deviceId/readings", async (req, reply) => {
    const params = deviceParamsSchema.safeParse(req.params);
    const body = simulatedReadingsSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "invalid_body",
        message: "模拟读数格式错误",
      });
    }

    const device = await app.prisma.device.findUnique({
      where: { id: params.data.deviceId },
      select: { hardwareId: true, userId: true },
    });
    if (!device) {
      return reply.status(404).send({
        error: "device_not_found",
        message: "模拟设备不存在",
      });
    }

    return ingestSensorReadings(app.prisma, {
      hardwareId: device.hardwareId,
      userId: device.userId,
      plantId: undefined,
      readings: body.data.readings.map((reading) => ({
        measuredAt:
          typeof reading.measuredAt === "number"
            ? new Date(reading.measuredAt * 1000)
            : new Date(reading.measuredAt),
        tempC: reading.tempC,
        soilMoisture: reading.soilMoisture,
        phLevel: reading.phLevel,
        lux: reading.lux,
      })),
    });
  });
};

export default devSensorSimulatorRoutes;
