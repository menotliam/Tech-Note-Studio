import { HIGH_CONFIDENCE_THRESHOLD } from "../detection.constants";
import type { DetectionResult } from "../detection.types";

export function detectJsonSnippet(input: string): DetectionResult | null {
  const text = input.trim();
  const startsLikeJson =
    (text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"));

  if (!startsLikeJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || (typeof parsed !== "object" && !Array.isArray(parsed))) {
      return null;
    }

    return {
      detectedType: "json",
      language: "json",
      confidence: 0.98,
      shouldAutoFormat: true,
      reasonCodes: ["json_parse_success", "json_object_or_array"]
    };
  } catch {
    const hasQuotedKeys = /"[^"]+"\s*:/.test(text);
    const confidence = hasQuotedKeys ? 0.62 : 0.35;

    return {
      detectedType: hasQuotedKeys ? "json" : "plain_text",
      language: hasQuotedKeys ? "json" : null,
      confidence,
      shouldAutoFormat: confidence >= HIGH_CONFIDENCE_THRESHOLD,
      reasonCodes: ["json_parse_failed", hasQuotedKeys ? "quoted_key_signal" : "weak_json_signal"]
    };
  }
}
