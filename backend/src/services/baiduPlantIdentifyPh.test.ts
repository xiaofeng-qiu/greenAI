import { describe, expect, it } from "vitest";
import { extractPhPreferenceFromText } from "./baiduPlantIdentify.js";

describe("extractPhPreferenceFromText", () => {
  it("returns undefined for empty / non-pH text", () => {
    expect(extractPhPreferenceFromText(undefined)).toBeUndefined();
    expect(extractPhPreferenceFromText("")).toBeUndefined();
    expect(extractPhPreferenceFromText("一种常见的室内观叶植物。")).toBeUndefined();
  });

  it("parses explicit numeric range with hyphen", () => {
    expect(
      extractPhPreferenceFromText("喜疏松肥沃的微酸性土壤，pH 5.5-6.5 为佳。")
    ).toEqual({ min: 5.5, max: 6.5 });
  });

  it("parses range with full-width tilde and pH值 wording", () => {
    expect(
      extractPhPreferenceFromText("土壤pH值5.0～6.0最适生长。")
    ).toEqual({ min: 5.0, max: 6.0 });
  });

  it("parses range written with 至 / 到", () => {
    expect(extractPhPreferenceFromText("pH 6 至 7 之间")).toEqual({
      min: 6,
      max: 7,
    });
    expect(extractPhPreferenceFromText("pH 6.5 到 7.5")).toEqual({
      min: 6.5,
      max: 7.5,
    });
  });

  it("parses single-point '约' as ±0.5 window", () => {
    expect(extractPhPreferenceFromText("土壤pH约6.0。")).toEqual({
      min: 5.5,
      max: 6.5,
    });
  });

  it("parses threshold '≤ 5.5' as a window below the threshold", () => {
    const out = extractPhPreferenceFromText("要求pH ≤ 5.5的酸性土。");
    expect(out).toBeDefined();
    expect(out!.max).toBe(5.5);
    expect(out!.min).toBeLessThan(5.5);
  });

  it("falls back to qualitative '微酸性' bucket", () => {
    expect(extractPhPreferenceFromText("喜微酸性土壤")).toEqual({
      min: 5.5,
      max: 6.5,
    });
  });

  it("falls back to '酸性土 / 喜酸' bucket for acid-loving plants", () => {
    expect(extractPhPreferenceFromText("典型的喜酸植物")).toEqual({
      min: 4.5,
      max: 5.5,
    });
  });

  it("falls back to alkaline bucket for '碱性土 / 喜碱 / 耐碱'", () => {
    expect(extractPhPreferenceFromText("耐碱性较强")).toEqual({
      min: 7.5,
      max: 8.5,
    });
  });

  it("ignores out-of-range numbers (>14 etc.) and returns undefined", () => {
    expect(extractPhPreferenceFromText("产量可达 ph 20-30 公斤")).toBeUndefined();
  });

  it("ignores ranges wider than 6 pH units (likely false positive)", () => {
    expect(extractPhPreferenceFromText("pH 1-13")).toBeUndefined();
  });

  it("normalizes letter case (PH / Ph / pH)", () => {
    expect(extractPhPreferenceFromText("PH 6.0-7.0")).toEqual({
      min: 6.0,
      max: 7.0,
    });
  });
});
