import type { PrismaClient } from "@prisma/client";
import type { SensorAggregate } from "../domain/careEngine.js";

/** 默认认为「新鲜」的窗口：最近 6 小时的读数才参与融合。 */
export const DEFAULT_SENSOR_FRESH_HOURS = 6;

/**
 * 取与某株植物绑定的设备在新鲜窗口内的读数并按维度求平均。
 *  - 仅匹配 `Device.plantId === plantId` 的设备（房间级设备未指定 plantId 时不参与，
 *    避免一个房间多株植物时把同一笔读数混入不属于它的植物）。
 *  - 若窗口内一笔读数也没有，返回 `null` → 上层退回纯天气 + 用户自报。
 */
export async function loadPlantSensorAggregate(
  prisma: PrismaClient,
  plantId: string,
  opts: { now?: Date; freshHours?: number } = {}
): Promise<SensorAggregate | null> {
  const now = opts.now ?? new Date();
  const hours = opts.freshHours ?? DEFAULT_SENSOR_FRESH_HOURS;
  const since = new Date(now.getTime() - hours * 3_600_000);
  const rows = await prisma.deviceReading.findMany({
    where: {
      measuredAt: { gte: since, lte: now },
      device: { plantId },
    },
    orderBy: { measuredAt: "desc" },
    take: 200,
    select: {
      measuredAt: true,
      tempC: true,
      soilMoisture: true,
      phLevel: true,
      lux: true,
    },
  });
  if (rows.length === 0) return null;

  let tSum = 0;
  let tCount = 0;
  let smSum = 0;
  let smCount = 0;
  let phSum = 0;
  let phCount = 0;
  let lSum = 0;
  let lCount = 0;
  let latest = rows[0].measuredAt;
  for (const r of rows) {
    if (r.measuredAt > latest) latest = r.measuredAt;
    if (r.tempC != null && Number.isFinite(r.tempC)) {
      tSum += r.tempC;
      tCount++;
    }
    if (r.soilMoisture != null && Number.isFinite(r.soilMoisture)) {
      smSum += r.soilMoisture;
      smCount++;
    }
    if (r.phLevel != null && Number.isFinite(r.phLevel)) {
      phSum += r.phLevel;
      phCount++;
    }
    if (r.lux != null && Number.isFinite(r.lux)) {
      lSum += r.lux;
      lCount++;
    }
  }

  return {
    tempC: tCount ? tSum / tCount : null,
    soilMoisture: smCount ? smSum / smCount : null,
    phLevel: phCount ? phSum / phCount : null,
    lux: lCount ? lSum / lCount : null,
    measuredAt: latest,
  };
}
