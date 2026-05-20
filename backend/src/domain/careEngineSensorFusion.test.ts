import { describe, expect, it } from "vitest";
import {
  applyWeatherToIntervalDays,
  computeWaterIntervalDays,
  fusePlantEnvWithSensor,
  fuseWeatherWithSensor,
  lightLevelFromLux,
  soilMoistureHintFromPercent,
  type PlantEnv,
  type SensorAggregate,
  type WeatherSnapshot,
} from "./careEngine.js";

const baseEnv: PlantEnv = {
  indoor: true,
  heating: false,
  lightLevel: "medium",
  soilMoistureHint: null,
  airConditioning: false,
  windowAspect: "unknown",
  waterSkipStreak: 0,
};

function sensor(partial: Partial<SensorAggregate>): SensorAggregate {
  return {
    tempC: null,
    soilMoisture: null,
    phLevel: null,
    lux: null,
    measuredAt: new Date("2030-06-01T12:00:00Z"),
    ...partial,
  };
}

describe("lightLevelFromLux", () => {
  it("buckets dim / typical / bright readings", () => {
    expect(lightLevelFromLux(120)).toBe("low");
    expect(lightLevelFromLux(1500)).toBe("medium");
    expect(lightLevelFromLux(8000)).toBe("high");
  });
});

describe("soilMoistureHintFromPercent", () => {
  it("buckets the five soil-moisture levels", () => {
    expect(soilMoistureHintFromPercent(5)).toBe("very_dry");
    expect(soilMoistureHintFromPercent(20)).toBe("dry");
    expect(soilMoistureHintFromPercent(45)).toBe("moderate");
    expect(soilMoistureHintFromPercent(65)).toBe("wet");
    expect(soilMoistureHintFromPercent(85)).toBe("very_wet");
  });
});

describe("fusePlantEnvWithSensor", () => {
  it("returns env unchanged when sensor is absent", () => {
    expect(fusePlantEnvWithSensor(baseEnv, null)).toEqual(baseEnv);
    expect(fusePlantEnvWithSensor(baseEnv, undefined)).toEqual(baseEnv);
  });

  it("returns env unchanged when sensor has no lux or soilMoisture", () => {
    expect(
      fusePlantEnvWithSensor(baseEnv, sensor({ tempC: 22, phLevel: 6.5 }))
    ).toEqual(baseEnv);
  });

  it("overrides lightLevel from sensor lux", () => {
    const env = { ...baseEnv, lightLevel: "low" as const };
    expect(fusePlantEnvWithSensor(env, sensor({ lux: 5000 })).lightLevel).toBe(
      "high"
    );
    expect(fusePlantEnvWithSensor(env, sensor({ lux: 100 })).lightLevel).toBe(
      "low"
    );
  });

  it("overrides soilMoistureHint from sensor soilMoisture %", () => {
    const env = { ...baseEnv, soilMoistureHint: "very_wet" as const };
    expect(
      fusePlantEnvWithSensor(env, sensor({ soilMoisture: 10 })).soilMoistureHint
    ).toBe("very_dry");
    expect(
      fusePlantEnvWithSensor(env, sensor({ soilMoisture: 70 })).soilMoistureHint
    ).toBe("wet");
  });

  it("can override both lightLevel and soilMoistureHint at once", () => {
    const fused = fusePlantEnvWithSensor(
      baseEnv,
      sensor({ lux: 4000, soilMoisture: 80 })
    );
    expect(fused.lightLevel).toBe("high");
    expect(fused.soilMoistureHint).toBe("very_wet");
  });
});

describe("fuseWeatherWithSensor", () => {
  const weather: WeatherSnapshot = {
    temperatureC: 28,
    relativeHumidity: 70,
    upcomingWetBias: 0.3,
    upcomingDryBias: 0.1,
  };

  it("returns weather unchanged when sensor is absent", () => {
    expect(fuseWeatherWithSensor(weather, null)).toEqual(weather);
  });

  it("overrides only temperatureC from sensor; RH stays from weather", () => {
    const out = fuseWeatherWithSensor(weather, sensor({ tempC: 21 }));
    expect(out).toEqual({
      temperatureC: 21,
      relativeHumidity: 70,
      upcomingWetBias: 0.3,
      upcomingDryBias: 0.1,
    });
  });

  it("returns weather unchanged when sensor has no tempC (sensor doesn't measure air RH)", () => {
    expect(
      fuseWeatherWithSensor(weather, sensor({ soilMoisture: 40, phLevel: 7 }))
    ).toEqual(weather);
  });
});

describe("integration: sensor changes computed interval", () => {
  it("soil sensor reporting very dry shortens base interval vs no sensor", () => {
    const envWithSensor = fusePlantEnvWithSensor(
      baseEnv,
      sensor({ soilMoisture: 8 })
    );
    const baseNoSensor = computeWaterIntervalDays("medium", baseEnv);
    const baseWithSensor = computeWaterIntervalDays("medium", envWithSensor);
    expect(baseWithSensor).toBeLessThan(baseNoSensor);
  });

  it("falls back to weather-only when no sensor data", () => {
    const weather: WeatherSnapshot = { temperatureC: 25, relativeHumidity: 50 };
    const base = computeWaterIntervalDays("medium", baseEnv);
    expect(
      applyWeatherToIntervalDays(base, fuseWeatherWithSensor(weather, null))
    ).toBe(applyWeatherToIntervalDays(base, weather));
  });
});
