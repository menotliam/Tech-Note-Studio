import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "./rate-limit.service";

describe("consumeRateLimit", () => {
  it("allows requests when the RPC fails so deployment does not get bricked", async () => {
    const supabase = {
      rpc: () => ({
        single: async () => {
          throw new Error("rpc unavailable");
        }
      })
    } as never;

    const result = await consumeRateLimit(supabase, {
      action: "auth_app_entry",
      key: "test-key",
      limit: 10,
      windowSeconds: 60
    });

    expect(result).toEqual({
      allowed: true,
      currentCount: 0,
      retryAfterSeconds: 60
    });
  });
});
