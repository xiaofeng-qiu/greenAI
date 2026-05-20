import { describe, expect, it, beforeEach } from "vitest";

// We exercise loadPlantSensorSeries with a hand-rolled in-memory PrismaClient
// stub. Only the methods used by the function need to behave consistently.

type Row = {
  measuredAt: Date;
  tempC: number | null;
  soilMoisture: number | null;
  phLevel: number | null;
  lux: number | null;
};

function buildPrismaStub(opts: {
  devices: Array<{
    id: string;
    hardwareId: string;
    label: string | null;
    lastSeenAt: Date | null;
    plantId: string;
  }>;
  readings: Array<Row & { deviceId: string }>;
  speciesProfile?: {
    phPreferredMin: number | null;
    phPreferredMax: number | null;
  } | null;
}) {
  return {
    device: {
      findMany: async ({
        where,
      }: {
        where: { plantId: string };
      }) => {
        return opts.devices
          .filter((d) => d.plantId === where.plantId)
          .map((d) => ({
            id: d.id,
            hardwareId: d.hardwareId,
            label: d.label,
            lastSeenAt: d.lastSeenAt,
          }));
      },
    },
    deviceReading: {
      findMany: async ({
        where,
      }: {
        where: {
          deviceId: { in: string[] };
          measuredAt: { gte: Date; lte: Date };
        };
      }) => {
        const ids = new Set(where.deviceId.in);
        return opts.readings
          .filter(
            (r) =>
              ids.has(r.deviceId) &&
              r.measuredAt >= where.measuredAt.gte &&
              r.measuredAt <= where.measuredAt.lte
          )
          .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime())
          .map(({ deviceId: _ignore, ...rest }) => rest);
      },
    },
    speciesProfile: {
      findUnique: async () => opts.speciesProfile ?? null,
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

let loadPlantSensorSeries: typeof import("./sensorSeries.js").loadPlantSensorSeries;

beforeEach(async () => {
  const mod = await import("./sensorSeries.js");
  loadPlantSensorSeries = mod.loadPlantSensorSeries;
});

describe("loadPlantSensorSeries", () => {
  const now = new Date("2026-05-20T12:00:00.000Z");

  it("returns empty readings + unknown phEvaluation when plant has no devices", async () => {
    const prisma = buildPrismaStub({ devices: [], readings: [] });
    const out = await loadPlantSensorSeries(
      prisma,
      { id: "p1", speciesLabel: "绿萝" },
      { hours: 72, now }
    );
    expect(out.readings).toEqual([]);
    expect(out.latest).toBeNull();
    expect(out.devices).toEqual([]);
    expect(out.phEvaluation.status).toBe("unknown");
    expect(out.windowHours).toBe(72);
  });

  it("filters by window and orders by measuredAt asc", async () => {
    const prisma = buildPrismaStub({
      devices: [
        {
          id: "d1",
          hardwareId: "HW1",
          label: null,
          lastSeenAt: now,
          plantId: "p1",
        },
      ],
      readings: [
        // out-of-window (too old)
        {
          deviceId: "d1",
          measuredAt: new Date("2026-05-10T00:00:00Z"),
          tempC: 5,
          soilMoisture: null,
          phLevel: null,
          lux: null,
        },
        {
          deviceId: "d1",
          measuredAt: new Date("2026-05-19T00:00:00Z"),
          tempC: 21,
          soilMoisture: 40,
          phLevel: 6.5,
          lux: 300,
        },
        {
          deviceId: "d1",
          measuredAt: new Date("2026-05-20T11:00:00Z"),
          tempC: 23,
          soilMoisture: 38,
          phLevel: 6.3,
          lux: 400,
        },
      ],
    });
    const out = await loadPlantSensorSeries(
      prisma,
      { id: "p1", speciesLabel: "绿萝" },
      { hours: 72, now }
    );
    expect(out.readings).toHaveLength(2);
    expect(out.latest?.tempC).toBe(23);
    expect(out.devices).toHaveLength(1);
  });

  it("downsamples to <=240 points while keeping last row", async () => {
    const rows: Array<Row & { deviceId: string }> = [];
    for (let i = 0; i < 1000; i++) {
      rows.push({
        deviceId: "d1",
        measuredAt: new Date(now.getTime() - (1000 - i) * 60_000),
        tempC: i,
        soilMoisture: null,
        phLevel: null,
        lux: null,
      });
    }
    const prisma = buildPrismaStub({
      devices: [
        {
          id: "d1",
          hardwareId: "HW1",
          label: null,
          lastSeenAt: now,
          plantId: "p1",
        },
      ],
      readings: rows,
    });
    const out = await loadPlantSensorSeries(
      prisma,
      { id: "p1", speciesLabel: null },
      { hours: 72, now }
    );
    expect(out.readings.length).toBeLessThanOrEqual(240);
    // Server caps DB pull at 2000 rows; final sample must preserve the freshest
    // value so the "latest" card on the client is not stale.
    expect(out.latest?.tempC).toBe(999);
  });

  it("uses SpeciesProfile preferred range when available", async () => {
    const prisma = buildPrismaStub({
      devices: [
        {
          id: "d1",
          hardwareId: "HW1",
          label: null,
          lastSeenAt: now,
          plantId: "p1",
        },
      ],
      readings: [
        {
          deviceId: "d1",
          measuredAt: new Date("2026-05-20T11:30:00Z"),
          tempC: null,
          soilMoisture: null,
          phLevel: 6.0,
          lux: null,
        },
      ],
      speciesProfile: { phPreferredMin: 4.5, phPreferredMax: 5.5 },
    });
    const out = await loadPlantSensorSeries(
      prisma,
      { id: "p1", speciesLabel: "杜鹃" },
      { hours: 72, now }
    );
    expect(out.phEvaluation.status).toBe("too_alkaline");
    expect(out.phEvaluation.preferredMin).toBe(4.5);
    expect(out.phEvaluation.preferredMax).toBe(5.5);
  });
});
