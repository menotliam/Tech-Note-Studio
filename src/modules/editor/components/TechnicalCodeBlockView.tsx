"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Braces, Check, ChevronDown, ChevronRight, Clipboard, ListOrdered, WrapText, X } from "lucide-react";
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

type LanguageAccent = {
  family: string;
  accent: string;
  softAccent: string;
};

export function TechnicalCodeBlockView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [highlightTheme, setHighlightTheme] = useState<BundledTheme>("github-light");
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
  const languageAccent = getLanguageAccent(language);
  const accentStyle = {
    "--code-language-accent": languageAccent.accent,
    "--code-language-accent-soft": languageAccent.softAccent
  } as CSSProperties;

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
        setHighlightedHtml(null);
        return;
      }

      try {
        const shikiLanguage = resolveShikiLanguage(language);

        if (!shikiLanguage) {
          setHighlightedHtml(null);
          return;
        }

        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(codeText, {
          lang: shikiLanguage,
          theme: highlightTheme
        });

        if (!isCancelled) {
          setHighlightedHtml(sanitizeHighlightedHtml(html));
        }
      } catch {
        if (!isCancelled) {
          setHighlightedHtml(null);
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
      data-language-family={languageAccent.family}
      style={accentStyle}
    >
      <div
        className="technical-code-block-header flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--code-block-border))] bg-[hsl(var(--code-block-header))] px-3 py-2"
        contentEditable={false}
      >
        <div className="flex items-center gap-2" contentEditable={false}>
          <Braces size={16} className="technical-code-block-icon" />
          <select
            className="technical-code-language-select rounded-md border border-[hsl(var(--code-block-border))] bg-[hsl(var(--code-block-background))] px-2 py-1 text-sm text-[hsl(var(--code-block-foreground))]"
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
          <span
            className="rounded bg-[hsl(var(--code-block-background))] px-2 py-1 text-xs text-[hsl(var(--code-block-muted))]"
            contentEditable={false}
          >
            {attrs.source === "manual" ? "manual" : `${Math.round((attrs.confidence ?? 1) * 100)}%`}
          </span>
        </div>

        <div className="flex items-center gap-1" contentEditable={false}>
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
              (showLineNumbers ? "text-[color:var(--code-language-accent)]" : "text-[hsl(var(--code-block-muted))]")
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
              (wordWrap ? "text-[color:var(--code-language-accent)]" : "text-[hsl(var(--code-block-muted))]")
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
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--code-block-muted))] hover:bg-red-500/10 hover:text-red-500"
            onClick={deleteNode}
            title="Delete code block"
            aria-label="Delete code block"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="px-4 py-3 text-xs text-[hsl(var(--code-block-muted))]" contentEditable={false}>
          {node.textContent.split("\n").length} lines hidden
        </div>
      ) : (
        <div className="relative min-h-14 overflow-x-auto">
          {highlightedHtml ? (
            <div
              aria-hidden
              contentEditable={false}
              className={
                "technical-code-block-highlight pointer-events-none absolute inset-0 border-0 bg-transparent p-4 font-mono text-sm leading-6 text-[hsl(var(--code-block-foreground))] " +
                (wordWrap ? "whitespace-pre-wrap" : "whitespace-pre")
              }
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
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
              data-highlighted={highlightedHtml ? "true" : "false"}
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

function sanitizeHighlightedHtml(html: string) {
  return html.replace(/<script\b/gi, "&lt;script").replace(/<\/script>/gi, "&lt;/script&gt;");
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

function getLanguageAccent(language: string): LanguageAccent {
  const accents: Record<string, LanguageAccent> = {
    javascript: {
      family: "javascript",
      accent: "#f7df1e",
      softAccent: "rgba(247, 223, 30, 0.16)"
    },
    typescript: {
      family: "typescript",
      accent: "#3178c6",
      softAccent: "rgba(49, 120, 198, 0.18)"
    },
    python: {
      family: "python",
      accent: "#3776ab",
      softAccent: "rgba(55, 118, 171, 0.18)"
    },
    java: {
      family: "java",
      accent: "#f89820",
      softAccent: "rgba(248, 152, 32, 0.18)"
    },
    cpp: {
      family: "cpp",
      accent: "#00599c",
      softAccent: "rgba(0, 89, 156, 0.18)"
    },
    c: {
      family: "c",
      accent: "#659ad2",
      softAccent: "rgba(101, 154, 210, 0.18)"
    },
    php: {
      family: "php",
      accent: "#777bb4",
      softAccent: "rgba(119, 123, 180, 0.18)"
    },
    html: {
      family: "html",
      accent: "#e34f26",
      softAccent: "rgba(227, 79, 38, 0.18)"
    },
    css: {
      family: "css",
      accent: "#1572b6",
      softAccent: "rgba(21, 114, 182, 0.18)"
    },
    sql: {
      family: "sql",
      accent: "#00a6a6",
      softAccent: "rgba(0, 166, 166, 0.18)"
    },
    json: {
      family: "json",
      accent: "#f0db4f",
      softAccent: "rgba(240, 219, 79, 0.16)"
    },
    bash: {
      family: "shell",
      accent: "#4eaa25",
      softAccent: "rgba(78, 170, 37, 0.18)"
    },
    shell: {
      family: "shell",
      accent: "#4eaa25",
      softAccent: "rgba(78, 170, 37, 0.18)"
    },
    terminal: {
      family: "terminal",
      accent: "#22c55e",
      softAccent: "rgba(34, 197, 94, 0.18)"
    }
  };

  return (
    accents[language] ?? {
      family: "plaintext",
      accent: "#94a3b8",
      softAccent: "rgba(148, 163, 184, 0.14)"
    }
  );
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
      return document.documentElement.classList.contains("dark") ? "dark-plus" : "github-light";
  }
}
