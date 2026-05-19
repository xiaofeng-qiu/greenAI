import { describe, expect, it } from "vitest";
import { dedupeArticleSummaries } from "./knowledgeArticleService.js";

describe("dedupeArticleSummaries", () => {
  it("dedupes by slug and respects limit", () => {
    const out = dedupeArticleSummaries(
      [
        { slug: "a", title: "A", summary: "s" },
        { slug: "a", title: "A2", summary: "x" },
        { slug: "b", title: "B", summary: "long".repeat(100) },
      ],
      2
    );
    expect(out).toHaveLength(2);
    expect(out[0].slug).toBe("a");
    expect(out[1].slug).toBe("b");
    expect(out[1].summary.length).toBeLessThanOrEqual(220);
  });
});
