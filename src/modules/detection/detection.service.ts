import { PLAIN_TEXT_DETECTION } from "./detection.constants";
import type { DetectionResult, Detector } from "./detection.types";
import { detectCodeSnippet } from "./detectors/code.detector";
import { detectJsonSnippet } from "./detectors/json.detector";
import { detectSqlSnippet } from "./detectors/sql.detector";
import { detectTerminalSnippet } from "./detectors/terminal.detector";

const detectors: Detector[] = [
  detectJsonSnippet,
  detectSqlSnippet,
  detectTerminalSnippet,
  detectCodeSnippet
];

function createPlainTextDetection(): DetectionResult {
  return {
    ...PLAIN_TEXT_DETECTION,
    reasonCodes: [...PLAIN_TEXT_DETECTION.reasonCodes]
  };
}

export function detectTechnicalSnippet(input: string): DetectionResult {
  const normalized = input.trim();

  if (normalized.length === 0) {
    return createPlainTextDetection();
  }

  for (const detector of detectors) {
    const result = detector(normalized);
    if (result && result.detectedType !== "plain_text") {
      return result;
    }
  }

  return createPlainTextDetection();
}
