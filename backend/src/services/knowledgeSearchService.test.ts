import { describe, expect, it } from "vitest";
import { tokenizeKnowledgeQuery } from "./knowledgeSearchService.js";

describe("tokenizeKnowledgeQuery", () => {
  it("returns empty for blank", () => {
    expect(tokenizeKnowledgeQuery("")).toEqual([]);
    expect(tokenizeKnowledgeQuery("   ")).toEqual([]);
  });

  it("includes full string and split tokens", () => {
    const t = tokenizeKnowledgeQuery("绿萝 叶尖");
    expect(t).toContain("绿萝 叶尖");
    expect(t).toContain("绿萝");
    expect(t).toContain("叶尖");
  });
});
