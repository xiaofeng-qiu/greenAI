import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import {
  fetchOpenMeteoCurrent,
  fetchOpenMeteoDailyForecast,
} from "./openMeteo.js";

describe("fetchOpenMeteoCurrent", () => {
  let agent: MockAgent;
  let previousDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeAll(() => {
    previousDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  afterAll(() => {
    agent.close();
    setGlobalDispatcher(previousDispatcher);
  });

  it("parses current block", async () => {
    const pool = agent.get("https://api.open-meteo.com");
    pool
      .intercept({
        path: (p) =>
          typeof p === "string" &&
          p.startsWith("/v1/forecast") &&
          !p.includes("daily="),
        method: "GET",
      })
      .reply(200, {
        current: {
          temperature_2m: 22.5,
          relative_humidity_2m: 55,
        },
      });

    const w = await fetchOpenMeteoCurrent({ latitude: 31.2, longitude: 121.5 });
    expect(w.temperatureC).toBe(22.5);
    expect(w.relativeHumidity).toBe(55);
  });
});

describe("fetchOpenMeteoDailyForecast", () => {
  let agent: MockAgent;
  let previousDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeAll(() => {
    previousDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  afterAll(() => {
    agent.close();
    setGlobalDispatcher(previousDispatcher);
  });

  it("parses daily arrays into entries", async () => {
    const pool = agent.get("https://api.open-meteo.com");
    pool
      .intercept({
        path: (p) =>
          typeof p === "string" &&
          p.startsWith("/v1/forecast") &&
          p.includes("daily="),
        method: "GET",
      })
      .reply(200, {
        daily: {
          time: ["2026-05-18", "2026-05-19", "2026-05-20"],
          temperature_2m_max: [24, 26, 22],
          temperature_2m_min: [16, 18, 15],
          precipitation_probability_max: [10, 80, 40],
          precipitation_sum: [0, 4.2, 0.5],
          weathercode: [0, 61, 3],
        },
      });

    const days = await fetchOpenMeteoDailyForecast({
      latitude: 31.2,
      longitude: 121.5,
      timezone: "Asia/Shanghai",
      forecastDays: 3,
    });
    expect(days).toHaveLength(3);
    expect(days[0].date).toBe("2026-05-18");
    expect(days[1].precipitationProbabilityMax).toBe(80);
    expect(days[1].precipitationSumMm).toBe(4.2);
  });
});
