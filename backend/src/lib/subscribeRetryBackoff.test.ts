import { describe, expect, it } from "vitest";
import { subscribeNotifyRetryDelayMs } from "./subscribeRetryBackoff.js";

describe("subscribeNotifyRetryDelayMs", () => {
  it("increases delay with failures", () => {
    const d1 = subscribeNotifyRetryDelayMs(1);
    const d2 = subscribeNotifyRetryDelayMs(2);
    const d3 = subscribeNotifyRetryDelayMs(3);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it("returns a sane floor for unexpected counts", () => {
    expect(subscribeNotifyRetryDelayMs(99)).toBe(60 * 60 * 1000);
  });
});
