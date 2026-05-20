import type { PrismaClient } from "@prisma/client";
import {
  evaluatePhAgainstPreference,
  type PhEvaluation,
} from "../domain/careEngine.js";
import { normalizeSpeciesNameKey } from "./speciesNameKey.js";

/** 单笔读数（已展开列）。`null` 字段表示这台设备本次没有该维度。 */
export type SensorSeriesPoint = {
  measuredAt: string;
  tempC: number | null;
  soilMoisture: number | null;
  phLevel: number | null;
  lux: number | null;
};

export type SensorSeriesDeviceInfo = {
  id: string;
  hardwareId: string;
  label: string | null;
  lastSeenAt: string | null;
};

export type SensorSeries = {
  windowHours: number;
  from: string;
  to: string;
  devices: SensorSeriesDeviceInfo[];
  latest: SensorSeriesPoint | null;
  readings: SensorSeriesPoint[];
  phEvaluation: PhEvaluation;
};

const MAX_HOURS = 24 * 14; // 上限 14 天，防止扫表
const MAX_RETURNED_POINTS = 240; // 图表点数封顶，超出按时间均匀抽样

/**
 * 拉取某株植物绑定的全部设备在 `hours` 窗口内的读数，用于详情页绘图。
 *  - 多台设备的读数合并按 `measuredAt` 升序返回
 *  - 超过 `MAX_RETURNED_POINTS` 时按等距下采样
 *  - 同步返回最新一笔合并样本 (`latest`) 与 pH 评估 (`phEvaluation`)
 */
export async function loadPlantSensorSeries(
  prisma: PrismaClient,
  plant: {
    id: string;
    speciesLabel: string | null;
  },
  opts: { hours?: number; now?: Date } = {}
): Promise<SensorSeries> {
  const now = opts.now ?? new Date();
  const hours = Math.max(1, Math.min(MAX_HOURS, opts.hours ?? 72));
  const since = new Date(now.getTime() - hours * 3_600_000);

  const devices = await prisma.device.findMany({
    where: { plantId: plant.id },
    select: {
      id: true,
      hardwareId: true,
      label: true,
      lastSeenAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let readings: SensorSeriesPoint[] = [];
  if (devices.length > 0) {
    const rows = await prisma.deviceReading.findMany({
      where: {
        deviceId: { in: devices.map((d) => d.id) },
        measuredAt: { gte: since, lte: now },
      },
      orderBy: { measuredAt: "asc" },
      take: 2000,
      select: {
        measuredAt: true,
        tempC: true,
        soilMoisture: true,
        phLevel: true,
        lux: true,
      },
    });
    readings = rows.map((r) => ({
      measuredAt: r.measuredAt.toISOString(),
      tempC: r.tempC,
      soilMoisture: r.soilMoisture,
      phLevel: r.phLevel,
      lux: r.lux,
    }));
    if (readings.length > MAX_RETURNED_POINTS) {
      const step = readings.length / MAX_RETURNED_POINTS;
      const sampled: SensorSeriesPoint[] = [];
      for (let i = 0; i < MAX_RETURNED_POINTS; i++) {
        sampled.push(readings[Math.floor(i * step)]);
      }
      // 保留最末一条，避免“最新值”落丢
      sampled[sampled.length - 1] = readings[readings.length - 1];
      readings = sampled;
    }
  }

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  let phMin: number | null | undefined;
  let phMax: number | null | undefined;
  if (plant.speciesLabel) {
    const nameKey = normalizeSpeciesNameKey(plant.speciesLabel);
    if (nameKey) {
      const profile = await prisma.speciesProfile.findUnique({
        where: { nameKey },
        select: { phPreferredMin: true, phPreferredMax: true },
      });
      phMin = profile?.phPreferredMin;
      phMax = profile?.phPreferredMax;
    }
  }
  const phEvaluation = evaluatePhAgainstPreference(
    latest?.phLevel ?? null,
    phMin,
    phMax
  );

  return {
    windowHours: hours,
    from: since.toISOString(),
    to: now.toISOString(),
    devices: devices.map((d) => ({
      id: d.id,
      hardwareId: d.hardwareId,
      label: d.label,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    })),
    latest,
    readings,
    phEvaluation,
  };
}
