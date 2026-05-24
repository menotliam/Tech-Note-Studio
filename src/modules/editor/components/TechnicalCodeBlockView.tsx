"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Braces, Check, ChevronDown, ChevronRight, Clipboard, ListOrdered, WrapText } from "lucide-react";
import type { BundledLanguage, BundledTheme } from "shiki";

const languageOptions = [
  "plaintext",
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "c",
  "php",
  "html",
  "css",
  "sql",
  "json",
  "bash",
  "shell",
  "terminal"
];

type HighlightToken = {
  color?: string;
  content: string;
};

export function TechnicalCodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightedLines, setHighlightedLines] = useState<HighlightToken[][] | null>(null);
  const [highlightTheme, setHighlightTheme] = useState<BundledTheme>("light-plus");
  const codeBlockRef = useRef<HTMLDivElement | null>(null);
  const attrs = node.attrs as {
    language?: string;
    showLineNumbers?: boolean;
    wordWrap?: boolean;
    confidence?: number;
    source?: string;
  };

  const language = attrs.language ?? "plaintext";
  const showLineNumbers = attrs.showLineNumbers !== false;
  const wordWrap = attrs.wordWrap === true;
  const codeText = node.textContent;

  useEffect(() => {
    function updateHighlightTheme() {
      setHighlightTheme(resolveShikiTheme(codeBlockRef.current));
    }

    updateHighlightTheme();

    const rootObserver = new MutationObserver(updateHighlightTheme);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const preferencesRoot = codeBlockRef.current?.closest("[data-code-theme]");
    const preferencesObserver = preferencesRoot ? new MutationObserver(updateHighlightTheme) : null;

    if (preferencesRoot && preferencesObserver) {
      preferencesObserver.observe(preferencesRoot, { attributes: true, attributeFilter: ["data-code-theme"] });
    }

    return () => {
      rootObserver.disconnect();
      preferencesObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function highlight() {
      if (!codeText.trim()) {
        setHighlightedLines(null);
        return;
      }

      try {
        const shikiLanguage = resolveShikiLanguage(language);

        if (!shikiLanguage) {
          setHighlightedLines(null);
          return;
        }

        const { codeToTokens } = await import("shiki");
        const result = await codeToTokens(codeText, {
          lang: shikiLanguage,
          theme: highlightTheme
        });

        if (!isCancelled) {
          setHighlightedLines(
            result.tokens.map((line) =>
              line.map((token) => ({
                color: token.color,
                content: token.content
              }))
            )
          );
        }
      } catch {
        if (!isCancelled) {
          setHighlightedLines(null);
        }
      }
    }

    void highlight();

    return () => {
      isCancelled = true;
    };
  }, [codeText, highlightTheme, language]);

  return (
    <NodeViewWrapper
      ref={codeBlockRef}
      className="technical-code-block rounded-md border border-[hsl(var(--code-block-border))] bg-[hsl(var(--code-block-background))] shadow-lg shadow-black/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--code-block-border))] bg-[hsl(var(--code-block-header))] px-3 py-2">
        <div className="flex items-center gap-2">
          <Braces size={16} className="text-primary" />
          <select
            className="rounded-md border border-[hsl(var(--code-block-border))] bg-[hsl(var(--code-block-background))] px-2 py-1 text-sm text-[hsl(var(--code-block-foreground))]"
            value={language}
            onChange={(event) =>
              updateAttributes({
                language: event.target.value,
                source: "manual",
                confidence: 1
              })
            }
            aria-label="Code language"
          >
            {languageOptions.map((option) => (
              <option key={option} value={option}>
                {formatLanguage(option)}
              </option>
            ))}
          </select>
          <span className="rounded bg-[hsl(var(--code-block-background))] px-2 py-1 text-xs text-[hsl(var(--code-block-muted))]">
            {attrs.source === "manual" ? "manual" : `${Math.round((attrs.confidence ?? 1) * 100)}%`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--code-block-muted))] hover:bg-[hsl(var(--code-block-background))] hover:text-[hsl(var(--code-block-foreground))]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(node.textContent);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              } catch {
                setCopied(false);
              }
            }}
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? <Check size={15} /> : <Clipboard size={15} />}
          </button>
          <button
            type="button"
            className={
              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--code-block-background))] " +
              (showLineNumbers ? "text-primary" : "text-[hsl(var(--code-block-muted))]")
            }
            onClick={() => updateAttributes({ showLineNumbers: !showLineNumbers })}
            title="Toggle line numbers"
            aria-label="Toggle line numbers"
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            className={
              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--code-block-background))] " +
              (wordWrap ? "text-primary" : "text-[hsl(var(--code-block-muted))]")
            }
            onClick={() => updateAttributes({ wordWrap: !wordWrap })}
            title="Toggle word wrap"
            aria-label="Toggle word wrap"
          >
            <WrapText size={15} />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--code-block-muted))] hover:bg-[hsl(var(--code-block-background))] hover:text-[hsl(var(--code-block-foreground))]"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand code block" : "Collapse code block"}
            aria-label={collapsed ? "Expand code block" : "Collapse code block"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="px-4 py-3 text-xs text-[hsl(var(--code-block-muted))]">
          {node.textContent.split("\n").length} lines hidden
        </div>
      ) : (
        <div className="relative min-h-14 overflow-x-auto">
          {highlightedLines ? (
            <div
              aria-hidden
              className={
                "pointer-events-none absolute inset-0 border-0 bg-transparent p-4 font-mono text-sm leading-6 text-[hsl(var(--code-block-foreground))] " +
                (wordWrap ? "whitespace-pre-wrap" : "whitespace-pre")
              }
            >
              {highlightedLines.map((line, lineIndex) => (
                <div key={lineIndex} className="min-h-6">
                  {line.length > 0
                    ? line.map((token, tokenIndex) => (
                        <span key={tokenIndex} style={{ color: token.color }}>
                          {token.content}
                        </span>
                      ))
                    : "\u00A0"}
                </div>
              ))}
            </div>
          ) : null}
          <div
            className={
              "m-0 min-h-14 border-0 bg-transparent p-4 font-mono text-sm leading-6 text-[hsl(var(--code-block-foreground))] " +
              (wordWrap ? "whitespace-pre-wrap" : "whitespace-pre")
            }
            data-line-numbers={String(showLineNumbers)}
          >
            <NodeViewContent
              className="technical-code-block-content outline-none"
              data-highlighted={highlightedLines ? "true" : "false"}
            />
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}

function formatLanguage(value: string) {
  const labels: Record<string, string> = {
    cpp: "C++",
    c: "C",
    css: "CSS",
    html: "HTML",
    json: "JSON",
    sql: "SQL"
  };

  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveShikiLanguage(language: string): BundledLanguage | null {
  const languageMap: Record<string, BundledLanguage> = {
    bash: "bash",
    c: "c",
    cpp: "cpp",
    css: "css",
    html: "html",
    java: "java",
    javascript: "javascript",
    json: "json",
    php: "php",
    python: "python",
    shell: "shellscript",
    sql: "sql",
    terminal: "shellsession",
    typescript: "typescript"
  };

  return languageMap[language] ?? null;
}

function resolveShikiTheme(element: HTMLElement | null): BundledTheme {
  const codeTheme = element?.closest("[data-code-theme]")?.getAttribute("data-code-theme");

  switch (codeTheme) {
    case "github-dark":
      return "github-dark";
    case "github-light":
      return "github-light";
    case "dracula":
      return "dracula";
    case "one-dark":
      return "one-dark-pro";
    default:
      return document.documentElement.classList.contains("dark") ? "dark-plus" : "light-plus";
  }
}
