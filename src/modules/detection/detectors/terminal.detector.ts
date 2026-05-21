import type { DetectionResult } from "../detection.types";

const commandPattern =
  /^(?:\$|#|>)?\s*(git|npm|pnpm|yarn|docker|sudo|cd|ls|cat|curl|ssh|pip|python|node|php|composer)\b/i;
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

  if (commandMatches === 0 && !hasPrompt) {
    return null;
  }

  const confidence =
    commandMatches === lines.length || hasPrompt ? 0.88 : shellSignalMatches > 0 ? 0.72 : 0.58;

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
