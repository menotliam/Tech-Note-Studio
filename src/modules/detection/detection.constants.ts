export const HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

export const PLAIN_TEXT_DETECTION = {
  detectedType: "plain_text",
  language: null,
  confidence: 0,
  shouldAutoFormat: false,
  reasonCodes: ["plain_text_fallback"]
} as const;
