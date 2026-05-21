import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth.schemas";

describe("auth schemas", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "student@example.com",
      password: "secret123"
    });

    expect(result.success).toBe(true);
  });

  it("rejects weak signup passwords", () => {
    const result = signupSchema.safeParse({
      email: "student@example.com",
      password: "password",
      displayName: "Student"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid signup email", () => {
    const result = signupSchema.safeParse({
      email: "not-an-email",
      password: "password1"
    });

    expect(result.success).toBe(false);
  });
});
