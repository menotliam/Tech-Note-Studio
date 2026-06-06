import { describe, expect, it } from "vitest";
import { normalizeSecurityActivityEvent } from "./security-activity.service";

describe("normalizeSecurityActivityEvent", () => {
  it("maps known events to safe display content", () => {
    const event = normalizeSecurityActivityEvent({
      id: "event-1",
      event_type: "FILE_UPLOAD_REJECTED",
      severity: "warning",
      ip_address: "127.0.0.1",
      user_agent: "Mozilla/5.0 Chrome/120",
      created_at: "2026-06-06T00:00:00.000Z",
      metadata: {
        rejectedReason: "unsupported_type",
        storage_path: "private/path/that/should/not/render",
        size: 123
      }
    });

    expect(event.category).toBe("storage");
    expect(event.title).toBe("Image upload rejected");
    expect(event.metadata).toEqual([
      { label: "Reason", value: "unsupported_type" },
      { label: "Size", value: "123" }
    ]);
  });

  it("falls back for unknown event types without exposing object metadata", () => {
    const event = normalizeSecurityActivityEvent({
      event_type: "AUTH_SIGNED_IN",
      severity: "critical",
      metadata: {
        nested: { raw: "ignored" },
        tokenValue: "hidden"
      }
    });

    expect(event.category).toBe("account");
    expect(event.title).toBe("Auth Signed In");
    expect(event.metadata).toEqual([]);
  });
});

