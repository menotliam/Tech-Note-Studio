import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./csrf";

describe("isSameOriginRequest", () => {
  it("accepts same-origin requests", () => {
    const request = new Request("https://app.example.com/api/preferences", {
      headers: {
        origin: "https://app.example.com",
        "sec-fetch-site": "same-origin"
      }
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects cross-origin requests", () => {
    const request = new Request("https://app.example.com/api/preferences", {
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site"
      }
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });
});
