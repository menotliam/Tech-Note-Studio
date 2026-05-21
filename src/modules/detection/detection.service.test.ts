import { describe, expect, it } from "vitest";
import { detectTechnicalSnippet } from "./detection.service";

describe("detectTechnicalSnippet", () => {
  it("detects valid JSON objects", () => {
    const result = detectTechnicalSnippet('{"name":"TechNote","features":["notes","export"]}');

    expect(result.detectedType).toBe("json");
    expect(result.language).toBe("json");
    expect(result.shouldAutoFormat).toBe(true);
  });

  it("detects common SQL queries", () => {
    const result = detectTechnicalSnippet("SELECT id, email FROM users WHERE is_active = true;");

    expect(result.detectedType).toBe("sql");
    expect(result.language).toBe("sql");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects terminal commands", () => {
    const result = detectTechnicalSnippet("npm run dev -- --port 3001");

    expect(result.detectedType).toBe("terminal");
    expect(result.language).toBe("bash");
  });

  it("detects programming code with a language guess", () => {
    const result = detectTechnicalSnippet("const answer = (value: number) => value + 42;");

    expect(result.detectedType).toBe("code");
    expect(result.language).toBe("typescript");
  });

  it("falls back to plain text for normal sentences", () => {
    const result = detectTechnicalSnippet("Remember to review the database chapter tomorrow.");

    expect(result.detectedType).toBe("plain_text");
    expect(result.shouldAutoFormat).toBe(false);
  });
});
