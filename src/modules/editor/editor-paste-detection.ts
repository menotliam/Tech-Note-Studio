import { HIGH_CONFIDENCE_THRESHOLD, MEDIUM_CONFIDENCE_THRESHOLD } from "@/modules/detection/detection.constants";
import { detectTechnicalSnippet } from "@/modules/detection/detection.service";
import type { DetectionResult } from "@/modules/detection/detection.types";

export type PasteDetectionAction =
  | { action: "ignore"; result: DetectionResult }
  | { action: "suggest"; result: DetectionResult }
  | { action: "auto_format"; result: DetectionResult };

export function getPasteDetectionAction(input: string, autoDetectionEnabled: boolean): PasteDetectionAction {
  const result = detectTechnicalSnippet(input);

  if (!autoDetectionEnabled || result.detectedType === "plain_text") {
    return {
      action: "ignore",
      result
    };
  }

  if (result.confidence >= HIGH_CONFIDENCE_THRESHOLD && result.shouldAutoFormat) {
    return {
      action: "auto_format",
      result
    };
  }

  if (result.confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return {
      action: "suggest",
      result
    };
  }

  return {
    action: "ignore",
    result
  };
}
