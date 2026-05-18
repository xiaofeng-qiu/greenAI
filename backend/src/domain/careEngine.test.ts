import { describe, expect, it } from "vitest";
import {
  computeWaterIntervalDays,
  generateWaterTasks,
} from "./careEngine.js";

describe("computeWaterIntervalDays", () => {
  it("uses higher frequency when heating indoors", () => {
    const without = computeWaterIntervalDays("medium", {
      indoor: true,
      heating: false,
      lightLevel: "medium",
    });
    const withHeat = computeWaterIntervalDays("medium", {
      indoor: true,
      heating: true,
      lightLevel: "medium",
    });
    expect(withHeat).toBeLessThan(without);
  });
});

describe("generateWaterTasks", () => {
  it("creates pending tasks on interval boundaries", () => {
    const asOf = new Date("2026-05-18T08:00:00.000Z");
    const tasks = generateWaterTasks({
      asOf,
      intervalDays: 7,
      horizonDays: 14,
      plantId: "plant_1",
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].dueDate.toISOString().slice(0, 10)).toBe("2026-05-18");
    expect(tasks[1].dueDate.toISOString().slice(0, 10)).toBe("2026-05-25");
  });
});
