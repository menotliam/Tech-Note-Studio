import { describe, expect, it } from "vitest";
import { shouldReduceMotion } from "./ui.motion";

describe("ui motion helpers", () => {
  it("resolves reduced motion preference against the system setting", () => {
    expect(shouldReduceMotion("on", false)).toBe(true);
    expect(shouldReduceMotion("off", true)).toBe(false);
    expect(shouldReduceMotion("system", true)).toBe(true);
    expect(shouldReduceMotion("system", false)).toBe(false);
  });
});
