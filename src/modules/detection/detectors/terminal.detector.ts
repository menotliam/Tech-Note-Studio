import type { DetectionResult } from "../detection.types";

const commandPattern =
  /^(?:\$|#|>)?\s*(git|npm|npx|pnpm|yarn|bun|docker|sudo|cd|ls|cat|curl|wget|ssh|scp|pip|python|node|php|composer|uv|cargo|rustc|go|kubectl|helm|terraform|ansible|make|gradle|mvn)\b/i;
const shellSignalPattern = /(\s--?[a-z][\w-]*\b|&&|\|\s*\w|>>?|\.\/|~\/)/i;

export function detectTerminalSnippet(input: string): DetectionResult | null {
  const lines = input
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const commandMatches = lines.filter((line) => commandPattern.test(line)).length;
  const shellSignalMatches = lines.filter((line) => shellSignalPattern.test(line)).length;
  const hasPrompt = lines.some((line) => /^\s*(\$|#|>)\s+/.test(line));
  const hasNaturalSentence = lines.some((line) => !commandPattern.test(line) && !/^\s*(\$|#|>)\s+/.test(line) && /\s+(is|are|was|were|should|could|would|because)\s+/i.test(line));

  if ((commandMatches === 0 && !hasPrompt) || hasNaturalSentence) {
    return null;
  }

  const confidence =
    commandMatches === lines.length || hasPrompt ? 0.9 : shellSignalMatches > 0 ? 0.72 : 0.58;

  return {
    detectedType: "terminal",
    language: "bash",
    confidence,
    shouldAutoFormat: confidence >= 0.8,
    reasonCodes: [
      commandMatches > 0 ? "known_terminal_command" : "no_known_command",
      hasPrompt ? "shell_prompt_signal" : "no_shell_prompt",
      shellSignalMatches > 0 ? "shell_operator_or_flag" : "no_shell_operator_or_flag"
    ]
  };
}
