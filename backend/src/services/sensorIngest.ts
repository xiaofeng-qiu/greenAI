import type { PrismaClient } from "@prisma/client";

export type SensorReadingInput = {
  /** 测量时刻；可为 Unix 秒数或 ISO 字符串。 */
  measuredAt: Date;
  /** 环境温度 ℃。 */
  tempC?: number | null;
  /** 土壤湿度（0..100）。 */
  soilMoisture?: number | null;
  /** 土壤 pH（0..14）。 */
  phLevel?: number | null;
  /** 光照 lx。 */
  lux?: number | null;
};

export type SensorIngestPayload = {
  /** 设备物理标识（厂商序列号或 MAC）。 */
  hardwareId: string;
  /** 设备所属用户。设备端固件出厂时通过用户绑定流程烧录。 */
  userId: string;
  /**
   * 可选：设备绑定到的具体植物 id。传入后会 upsert 到 `Device.plantId`，
   * 以后 care planning 会针对该植物使用本设备的读数。为 `null` 代表“解除绑定”。
   */
  plantId?: string | null;
  /** 单次请求可携带多笔读数（设备离线缓冲后批量补传）。 */
  readings: SensorReadingInput[];
};

export type SensorIngestResult = {
  deviceId: string;
  inserted: number;
  /** 因 (deviceId, measuredAt) 唯一约束被服务端去重的笔数。 */
  deduped: number;
};

/**
 * 幂等 ingest：
 *  - 按 (userId, hardwareId) upsert 设备
 *  - 按 (deviceId, measuredAt) 唯一约束去重写入读数
 *  - 刷新 device.lastSeenAt 为本批次最新 measuredAt
 */
export async function ingestSensorReadings(
  prisma: PrismaClient,
  payload: SensorIngestPayload
): Promise<SensorIngestResult> {
  const device = await prisma.device.upsert({
    where: {
      userId_hardwareId: {
        userId: payload.userId,
        hardwareId: payload.hardwareId,
      },
    },
    create: {
      userId: payload.userId,
      hardwareId: payload.hardwareId,
      plantId: payload.plantId ?? null,
    },
    update:
      payload.plantId === undefined
        ? {}
        : { plantId: payload.plantId },
  });

  const latest = payload.readings.reduce<Date | null>((acc, r) => {
    if (!acc || r.measuredAt > acc) return r.measuredAt;
    return acc;
  }, null);

  const result = await prisma.deviceReading.createMany({
    data: payload.readings.map((r) => ({
      deviceId: device.id,
      measuredAt: r.measuredAt,
      tempC: r.tempC ?? null,
      soilMoisture: r.soilMoisture ?? null,
      phLevel: r.phLevel ?? null,
      lux: r.lux ?? null,
    })),
    skipDuplicates: true,
  });

  if (latest) {
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: latest },
    });
  }

  return {
    deviceId: device.id,
    inserted: result.count,
    deduped: payload.readings.length - result.count,
  };
}
