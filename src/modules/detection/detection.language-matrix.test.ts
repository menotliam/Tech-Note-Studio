import { describe, expect, it } from "vitest";
import { detectTechnicalSnippet } from "./detection.service";

const languageCases = [
  {
    name: "JSON object",
    snippet: '{"name":"TechNote","features":["editor","detection"]}',
    detectedType: "json",
    language: "json"
  },
  {
    name: "SQL query",
    snippet: "SELECT id, title FROM notes WHERE is_archived = false ORDER BY updated_at DESC;",
    detectedType: "sql",
    language: "sql"
  },
  {
    name: "terminal command",
    snippet: "npm run dev -- --port 3001",
    detectedType: "terminal",
    language: "bash"
  },
  {
    name: "kubectl command",
    snippet: "kubectl get pods --namespace default",
    detectedType: "terminal",
    language: "bash"
  },
  {
    name: "cargo command",
    snippet: "cargo test --workspace",
    detectedType: "terminal",
    language: "bash"
  },
  {
    name: "uv command",
    snippet: "uv run pytest tests/",
    detectedType: "terminal",
    language: "bash"
  },
  {
    name: "JavaScript console and alert",
    snippet: 'console.log("Hello, World!");\nalert("Welcome to JavaScript!");',
    detectedType: "code",
    language: "javascript"
  },
  {
    name: "TypeScript type annotation",
    snippet: "type Note = { title: string; archived: boolean };",
    detectedType: "code",
    language: "typescript"
  },
  {
    name: "Python function",
    snippet: "def greet(name):\n    print(name)",
    detectedType: "code",
    language: "python"
  },
  {
    name: "Java main class",
    snippet: "public class Main { public static void main(String[] args) { return; } }",
    detectedType: "code",
    language: "java"
  },
  {
    name: "C program",
    snippet: '#include <stdio.h>\nint main(void) { printf("Hi"); }',
    detectedType: "code",
    language: "c"
  },
  {
    name: "C++ program",
    snippet: '#include <iostream>\nint main() { std::cout << "Hi"; }',
    detectedType: "code",
    language: "cpp"
  },
  {
    name: "C++ class access labels",
    snippet: "class NoteStore {\npublic:\n  void save();\n};",
    detectedType: "code",
    language: "cpp"
  },
  {
    name: "PHP snippet",
    snippet: '<?php echo "Hello"; ?>',
    detectedType: "code",
    language: "php"
  },
  {
    name: "HTML anchor",
    snippet: '<a href="research.html#note">Research Note</a>',
    detectedType: "code",
    language: "html"
  },
  {
    name: "HTML image inside anchor",
    snippet: '<a href="cats.html">\n  <img src="cat.gif" height="60" width="60" alt="cat">\n</a>',
    detectedType: "code",
    language: "html"
  },
  {
    name: "CSS rule",
    snippet: ".note-card { color: red; padding: 1rem; }",
    detectedType: "code",
    language: "css"
  }
] as const;

describe("detection language matrix", () => {
  it.each(languageCases)("detects $name", ({ snippet, detectedType, language }) => {
    const result = detectTechnicalSnippet(snippet);

    expect(result.detectedType).toBe(detectedType);
    expect(result.language).toBe(language);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("keeps normal prose as plain text", () => {
    const result = detectTechnicalSnippet("Review the lecture notes before the database lab.");

    expect(result.detectedType).toBe("plain_text");
    expect(result.language).toBeNull();
  });

  it.each([
    "Compare value < limit before continuing.",
    "The phrase <important> is just a placeholder in this sentence.",
    "Remember name: string is a phrase from the assignment.",
    "{ name: string }",
    "The docker chapter is useful because containers are common."
  ])("does not over-detect prose: %s", (snippet) => {
    const result = detectTechnicalSnippet(snippet);

    expect(result.detectedType).toBe("plain_text");
  });
});
