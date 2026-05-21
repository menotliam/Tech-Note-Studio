import type { DetectionResult } from "../detection.types";

const strongPatterns = [
  /\bselect\b[\s\S]+\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\b[\s\S]+\bset\b/i,
  /\bdelete\s+from\b/i,
  /\bcreate\s+table\b/i
];

const supportKeywords = /\b(where|join|group\s+by|order\s+by|having|limit|values)\b/gi;

export function detectSqlSnippet(input: string): DetectionResult | null {
  const text = input.trim();
  if (text.length < 12) {
    return null;
  }

  const strongMatch = strongPatterns.some((pattern) => pattern.test(text));
  const supportMatches = text.match(supportKeywords)?.length ?? 0;

  if (!strongMatch && supportMatches < 2) {
    return null;
  }

  const confidence = strongMatch && supportMatches > 0 ? 0.9 : 0.68;

  return {
    detectedType: "sql",
    language: "sql",
    confidence,
    shouldAutoFormat: confidence >= 0.8,
    reasonCodes: [
      strongMatch ? "sql_strong_query_pattern" : "sql_keyword_cluster",
      supportMatches > 0 ? "sql_supporting_clause" : "sql_no_supporting_clause"
    ]
  };
}
