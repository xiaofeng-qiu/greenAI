import { describe, expect, it } from "vitest";
import { isValidIanaTimeZone } from "./timezone.js";

describe("isValidIanaTimeZone", () => {
  it("accepts Asia/Shanghai", () => {
    expect(isValidIanaTimeZone("Asia/Shanghai")).toBe(true);
  });
  it("accepts UTC", () => {
    expect(isValidIanaTimeZone("UTC")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidIanaTimeZone("Not/A/Zone")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isValidIanaTimeZone("")).toBe(false);
  });
});
