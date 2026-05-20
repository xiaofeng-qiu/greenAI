import { describe, expect, it } from "vitest";
import {
  DEFAULT_PH_PREFERRED_MAX,
  DEFAULT_PH_PREFERRED_MIN,
  evaluatePhAgainstPreference,
} from "./careEngine.js";

describe("evaluatePhAgainstPreference", () => {
  it("returns 'unknown' when ph is missing or non-finite", () => {
    const out = evaluatePhAgainstPreference(null, 5.5, 6.5);
    expect(out.status).toBe("unknown");
    expect(out.ph).toBeNull();
    expect(out.preferredMin).toBe(5.5);
    expect(out.preferredMax).toBe(6.5);
    expect(evaluatePhAgainstPreference(Number.NaN, 5.5, 6.5).status).toBe(
      "unknown"
    );
  });

  it("uses default range 6.0–7.0 when plant has no preference, marked usedDefaultRange", () => {
    const out = evaluatePhAgainstPreference(6.5, null, null);
    expect(out.status).toBe("optimal");
    expect(out.preferredMin).toBe(DEFAULT_PH_PREFERRED_MIN);
    expect(out.preferredMax).toBe(DEFAULT_PH_PREFERRED_MAX);
    expect(out.usedDefaultRange).toBe(true);
  });

  it("acid-loving plant (e.g. blueberry 4.5–5.5): ph 5.0 is optimal, 6.0 is too alkaline", () => {
    expect(
      evaluatePhAgainstPreference(5.0, 4.5, 5.5).status
    ).toBe("optimal");
    expect(
      evaluatePhAgainstPreference(6.0, 4.5, 5.5).status
    ).toBe("too_alkaline");
    expect(
      evaluatePhAgainstPreference(4.0, 4.5, 5.5).status
    ).toBe("too_acidic");
  });

  it("alkaline-tolerant plant (7.0–8.0): same ph 6.0 is too acidic for this plant", () => {
    expect(
      evaluatePhAgainstPreference(6.0, 7.0, 8.0).status
    ).toBe("too_acidic");
    expect(
      evaluatePhAgainstPreference(7.5, 7.0, 8.0).status
    ).toBe("optimal");
  });

  it("treats reversed min/max defensively by swapping", () => {
    const out = evaluatePhAgainstPreference(6.0, 7.0, 5.0);
    expect(out.preferredMin).toBe(5.0);
    expect(out.preferredMax).toBe(7.0);
    expect(out.status).toBe("optimal");
  });

  it("boundary values are inclusive (min and max both count as optimal)", () => {
    expect(evaluatePhAgainstPreference(5.5, 5.5, 6.5).status).toBe("optimal");
    expect(evaluatePhAgainstPreference(6.5, 5.5, 6.5).status).toBe("optimal");
  });

  it("partial preference (only min) falls back to default max", () => {
    const out = evaluatePhAgainstPreference(6.8, 5.0, null);
    expect(out.preferredMin).toBe(5.0);
    expect(out.preferredMax).toBe(DEFAULT_PH_PREFERRED_MAX);
    expect(out.usedDefaultRange).toBe(false);
  });
});
