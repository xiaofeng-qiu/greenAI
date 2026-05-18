import { describe, expect, it } from "vitest";
import {
  diagnoseFromSymptoms,
  listSymptomCatalog,
} from "./diagnoseEngine.js";

describe("listSymptomCatalog", () => {
  it("returns stable ids and groups", () => {
    const rows = listSymptomCatalog();
    expect(rows.length).toBeGreaterThan(5);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(rows.length);
  });
});

describe("diagnoseFromSymptoms", () => {
  it("prioritizes root rot when soil smells bad", () => {
    const r = diagnoseFromSymptoms(["soil_sour_smell", "wilting_soft_stem"]);
    expect(r.causes[0].id).toBe("root_rot_overwater");
    expect(r.disclaimer.length).toBeGreaterThan(20);
  });

  it("flags underwater when soil dry and wilting", () => {
    const r = diagnoseFromSymptoms(["wilting_dry_soil"]);
    expect(r.causes.map((c) => c.id)).toContain("underwater");
  });

  it("adds heating context tip", () => {
    const r = diagnoseFromSymptoms(["leaf_brown_tips"], {
      indoor: true,
      heating: true,
    });
    expect(r.contextTips.some((t) => t.includes("供暖"))).toBe(true);
  });

  it("returns generic fallback when nothing matches", () => {
    const r = diagnoseFromSymptoms([]);
    expect(r.causes[0].id).toBe("no_rule_match");
  });
});
