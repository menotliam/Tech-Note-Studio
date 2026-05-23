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

const typeTieBreakPriority = {
  json: 5,
  sql: 4,
  terminal: 3,
  code: 2,
  plain_text: 1
} satisfies Record<DetectionResult["detectedType"], number>;

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

  const candidates = detectors
    .map((detector) => detector(normalized))
    .filter((result): result is DetectionResult => Boolean(result))
    .filter((result) => result.detectedType !== "plain_text");

  if (candidates.length === 0) {
    return createPlainTextDetection();
  }

  const bestCandidate = candidates.sort((left, right) => {
    const confidenceDelta = right.confidence - left.confidence;

    if (Math.abs(confidenceDelta) > 0.03) {
      return confidenceDelta;
    }

    return typeTieBreakPriority[right.detectedType] - typeTieBreakPriority[left.detectedType];
  })[0];

  return bestCandidate ?? createPlainTextDetection();
}
