import type { DetectionResult } from "../detection.types";

type LanguageSignal = {
  language: string;
  pattern: RegExp;
  reason: string;
};

const languageSignals: LanguageSignal[] = [
  { language: "python", pattern: /\b(def|print|from\s+\w+\s+import)\b|:\s*\n\s{2,}\w/i, reason: "python_signal" },
  { language: "typescript", pattern: /\b(interface|type)\s+\w+|:\s*(string|number|boolean)\b/, reason: "typescript_signal" },
  { language: "javascript", pattern: /\b(const|let|function|import|export)\b|=>/, reason: "javascript_signal" },
  { language: "java", pattern: /\bpublic\s+static\s+void\s+main\b|\bclass\s+\w+\s*\{/, reason: "java_signal" },
  { language: "cpp", pattern: /#include\s*<|std::|int\s+main\s*\(/, reason: "cpp_signal" },
  { language: "php", pattern: /<\?php|\bcomposer\b/, reason: "php_signal" },
  { language: "html", pattern: /<\/?[a-z][\s\S]*>/i, reason: "html_signal" },
  { language: "css", pattern: /[.#]?[a-z][\w-]*\s*\{[\s\S]*:[\s\S]*\}/i, reason: "css_signal" }
];

const genericCodePattern = /[{}();]|\b(return|class|function|import|export|const|let|def)\b/;

export function detectCodeSnippet(input: string): DetectionResult | null {
  const text = input.trim();
  const lines = text.split(/\r?\n/);

  if (text.length < 20 || !genericCodePattern.test(text)) {
    return null;
  }

  const languageSignal = languageSignals.find((signal) => signal.pattern.test(text));
  const multiLineBonus = lines.length > 1 ? 0.12 : 0;
  const syntaxDensity = (text.match(/[{}();=]/g)?.length ?? 0) / Math.max(text.length, 1);
  const confidence = Math.min(0.76 + multiLineBonus + syntaxDensity, languageSignal ? 0.86 : 0.78);

  return {
    detectedType: "code",
    language: languageSignal?.language ?? "plaintext",
    confidence,
    shouldAutoFormat: confidence >= 0.8,
    reasonCodes: [languageSignal?.reason ?? "generic_code_signal", lines.length > 1 ? "multi_line_code" : "single_line_code"]
  };
}
