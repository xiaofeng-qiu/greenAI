import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import {
  diagnosePlantWithVisionLlm,
  toVisionImageDataUrl,
} from "./diagnoseLlm.js";

describe("toVisionImageDataUrl", () => {
  it("wraps raw base64 as jpeg data url", () => {
    expect(toVisionImageDataUrl("abcd")).toBe("data:image/jpeg;base64,abcd");
  });

  it("preserves existing data url", () => {
    const u = "data:image/png;base64,XX==";
    expect(toVisionImageDataUrl(u)).toBe(u);
  });
});

describe("diagnosePlantWithVisionLlm", () => {
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

  it("parses chat completion JSON content", async () => {
    const pool = agent.get("https://api.openai.com");
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "叶色略黄，可能缺光或自然老叶。",
                likely_issues: [
                  { title: "光照不足", detail: "新叶偏淡、节间拉长。" },
                ],
                immediate_actions: ["移至明亮散射光处观察一周。"],
                caution: "",
                needs_expert_visit: false,
              }),
            },
          },
        ],
      });

    const out = await diagnosePlantWithVisionLlm({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      userNote: "最近浇水较多",
      symptomLabels: ["老叶发黄"],
      plantHint: "绿萝；室内",
    });

    expect(out.summary).toContain("黄");
    expect(out.likely_issues.length).toBeGreaterThan(0);
    expect(out.immediate_actions.length).toBeGreaterThan(0);
  });

  it("accepts markdown fenced JSON", async () => {
    const json = {
      summary: "测试",
      likely_issues: [],
      immediate_actions: ["a"],
    };
    const pool = agent.get("https://api.example.com");
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, {
        choices: [
          {
            message: {
              content: "```json\n" + JSON.stringify(json) + "\n```",
            },
          },
        ],
      });

    const out = await diagnosePlantWithVisionLlm({
      baseUrl: "https://api.example.com/v1",
      apiKey: "k",
      model: "deepseek-vl",
      imageBase64: "abcd",
    });
    expect(out.summary).toBe("测试");
  });
});
