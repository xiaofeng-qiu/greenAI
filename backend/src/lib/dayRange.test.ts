import { describe, expect, it } from "vitest";
import { utcRangeForUserLocalToday } from "./dayRange.js";

describe("utcRangeForUserLocalToday", () => {
  it("returns a 24h window in UTC for Asia/Shanghai", () => {
    const now = new Date("2026-05-18T16:00:00.000Z");
    const { start, end } = utcRangeForUserLocalToday(now, "Asia/Shanghai");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(start.toISOString()).toMatch(/T/);
  });
});
