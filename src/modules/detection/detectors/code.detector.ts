import type { DetectionResult } from "../detection.types";

type LanguageSignal = {
  language: string;
  score: number;
  reason: string;
};

const htmlTags = new Set([
  "a",
  "article",
  "body",
  "button",
  "code",
  "div",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "head",
  "header",
  "html",
  "img",
  "input",
  "label",
  "li",
  "link",
  "main",
  "meta",
  "nav",
  "ol",
  "option",
  "p",
  "pre",
  "script",
  "section",
  "select",
  "span",
  "table",
  "tbody",
  "td",
  "textarea",
  "th",
  "thead",
  "title",
  "tr",
  "ul"
]);

const cssProperties = [
  "align-items",
  "background",
  "border",
  "color",
  "display",
  "font-size",
  "gap",
  "grid-template-columns",
  "height",
  "justify-content",
  "line-height",
  "margin",
  "padding",
  "position",
  "width"
];

const genericCodePattern = /[{}();<>]|\b(return|class|function|import|export|const|let|def|console|alert)\b/;

export function detectCodeSnippet(input: string): DetectionResult | null {
  const text = input.trim();
  const lines = text.split(/\r?\n/);
  const languageSignals = getLanguageSignals(text);
  const bestSignal = languageSignals.sort((left, right) => right.score - left.score)[0];

  if (text.length < 8 || (!bestSignal && !genericCodePattern.test(text))) {
    return null;
  }

  if (!bestSignal && !hasStrongGenericCodeSignal(text)) {
    return null;
  }

  const multiLineBonus = lines.length > 1 ? 0.06 : 0;
  const syntaxDensity = Math.min((text.match(/[{}();=<>]/g)?.length ?? 0) / Math.max(text.length, 1), 0.1);
  const baseConfidence = bestSignal?.score ?? 0.54;
  const confidence = Math.min(baseConfidence + multiLineBonus + syntaxDensity, 0.96);

  if (confidence < 0.5) {
    return null;
  }

  return {
    detectedType: "code",
    language: bestSignal?.language ?? "code",
    confidence,
    shouldAutoFormat: confidence >= 0.8,
    reasonCodes: [
      bestSignal?.reason ?? "generic_code_signal",
      lines.length > 1 ? "multi_line_code" : "single_line_code"
    ]
  };
}

function getLanguageSignals(text: string): LanguageSignal[] {
  const signals: LanguageSignal[] = [];

  if (/(^|\n)\s*(def|if|for|while|class|with|try|except|else|elif)\b[^\n]*:\s*\n\s{2,}\w/i.test(text)) {
    signals.push({ language: "python", score: 0.84, reason: "python_structure_signal" });
  }

  if (/\bprint\s*\(/.test(text) && !/[{};]/.test(text)) {
    signals.push({ language: "python", score: 0.72, reason: "python_print_signal" });
  }

  if (
    /\b(interface|type)\s+\w+\s*[={]/.test(text) ||
    /\b(const|let)\s+\w+\s*:\s*\w+/.test(text) ||
    /\(\s*\w+\s*:\s*(string|number|boolean|unknown|Record)\b/.test(text)
  ) {
    signals.push({ language: "typescript", score: 0.86, reason: "typescript_declaration_signal" });
  }

  if (/\b(console\.\w+|alert|document\.|window\.)\s*\(/.test(text) || /\b(const|let|function|import|export)\b|=>/.test(text)) {
    signals.push({ language: "javascript", score: 0.82, reason: "javascript_signal" });
  }

  if (/#include\s*<stdio\.h>|printf\s*\(|int\s+main\s*\(\s*(void)?\s*\)\s*\{/.test(text)) {
    signals.push({ language: "c", score: 0.9, reason: "c_signal" });
  }

  if (/#include\s*<(iostream|vector|string)>|std::/.test(text)) {
    signals.push({ language: "cpp", score: 0.92, reason: "cpp_standard_library_signal" });
  }

  if (/\bclass\s+\w+\s*\{[\s\S]*\b(public|private|protected)\s*:/.test(text)) {
    signals.push({ language: "cpp", score: 0.9, reason: "cpp_class_access_label_signal" });
  }

  if (/\bpublic\s+static\s+void\s+main\b|\bpublic\s+class\s+\w+\s*\{/.test(text)) {
    signals.push({ language: "java", score: 0.9, reason: "java_signal" });
  } else if (/\bclass\s+\w+\s*\{/.test(text) && !/#include|std::/.test(text)) {
    signals.push({ language: "java", score: 0.68, reason: "java_class_weak_signal" });
  }

  if (/<\?php|\becho\s+["']/.test(text)) {
    signals.push({ language: "php", score: 0.88, reason: "php_signal" });
  }

  if (isLikelyHtml(text)) {
    signals.push({ language: "html", score: 0.9, reason: "html_known_tag_signal" });
  }

  if (isLikelyCss(text)) {
    signals.push({ language: "css", score: 0.84, reason: "css_rule_signal" });
  }

  return signals;
}

function isLikelyHtml(text: string) {
  const tagMatches = [...text.matchAll(/<\/?([a-z][a-z0-9-]*)(\s[^>]*)?>/gi)];

  if (tagMatches.length === 0) {
    return false;
  }

  const knownTagMatches = tagMatches.filter((match) => htmlTags.has(match[1].toLowerCase()));
  const hasTagAttribute = /\s(href|src|alt|class|id|height|width|rel|type)=["'][^"']*["']/i.test(text);
  const hasClosingTag = /<\/[a-z][a-z0-9-]*>/i.test(text);

  return knownTagMatches.length > 0 && (hasTagAttribute || hasClosingTag || tagMatches.length >= 2);
}

function isLikelyCss(text: string) {
  const ruleMatch = text.match(/^\s*([.#][\w-]+|[a-z][\w-]*(?:\s+[.#]?\w[\w-]*)?)\s*\{([\s\S]+)\}\s*$/i);

  if (!ruleMatch) {
    return false;
  }

  const body = ruleMatch[2];
  const hasKnownProperty = cssProperties.some((property) => new RegExp(`\\b${property}\\s*:`, "i").test(body));
  const declarations = body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const declarationLikeCount = declarations.filter((part) => /^[a-z-]+\s*:\s*[^{}]+$/i.test(part)).length;

  return hasKnownProperty && declarationLikeCount >= 1;
}

function hasStrongGenericCodeSignal(text: string) {
  if (/^\s*\{\s*[\w"']+\s*:\s*[^{};]+\}\s*$/.test(text)) {
    return false;
  }

  const hasCodeKeyword = /\b(return|class|function|import|export|const|let|def|console|alert)\b/.test(text);
  const syntaxCount = text.match(/[{}();=]/g)?.length ?? 0;

  return hasCodeKeyword || syntaxCount >= 3;
}
