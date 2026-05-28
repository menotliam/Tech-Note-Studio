import { describe, expect, it } from "vitest";
import { shouldReduceMotion } from "./motion-presets";

describe("motion preference exports", () => {
  it("resolves system preference through the shared helper", () => {
    expect(shouldReduceMotion("system", true)).toBe(true);
    expect(shouldReduceMotion("off", true)).toBe(false);
  });
});
