export type DetectionType = "json" | "sql" | "terminal" | "code" | "plain_text";

export type DetectionResult = {
  detectedType: DetectionType;
  language: string | null;
  confidence: number;
  shouldAutoFormat: boolean;
  reasonCodes: string[];
};

export type Detector = (input: string) => DetectionResult | null;
