import { describe, expect, it } from "vitest";
import { evaluateSensorReadingAlerts } from "./sensorAlerts.js";

describe("evaluateSensorReadingAlerts", () => {
  it("classifies warning and danger thresholds", () => {
    expect(evaluateSensorReadingAlerts({ tempC: 36 })).toMatchObject([
      { code: "temperature", severity: "warning" },
    ]);
    expect(evaluateSensorReadingAlerts({ soilMoisture: 10 })).toMatchObject([
      { code: "moisture_low", severity: "danger" },
    ]);
    expect(evaluateSensorReadingAlerts({ lux: 120000 })).toMatchObject([
      { code: "light", severity: "danger" },
    ]);
  });

  it("uses the plant pH evaluation", () => {
    expect(
      evaluateSensorReadingAlerts(
        { phLevel: 5.4 },
        { status: "too_acidic" }
      )
    ).toMatchObject([{ code: "ph", severity: "warning" }]);
    expect(
      evaluateSensorReadingAlerts(
        { phLevel: 6.5 },
        { status: "optimal" }
      )
    ).toEqual([]);
  });

  it("does not warn for values inside the normal range", () => {
    expect(
      evaluateSensorReadingAlerts({
        tempC: 24,
        soilMoisture: 55,
        phLevel: 6.5,
        lux: 12000,
      })
    ).toEqual([]);
  });
});
