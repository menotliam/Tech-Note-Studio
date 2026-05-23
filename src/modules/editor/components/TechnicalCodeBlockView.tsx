"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Braces, ListOrdered, WrapText } from "lucide-react";

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

export function TechnicalCodeBlockView({ node, updateAttributes }: NodeViewProps) {
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

  return (
    <NodeViewWrapper className="technical-code-block rounded-md border border-border bg-muted">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Braces size={16} className="text-primary" />
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
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
          <span className="rounded bg-background px-2 py-1 text-xs text-muted-foreground">
            {attrs.source === "manual" ? "manual" : `${Math.round((attrs.confidence ?? 1) * 100)}%`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={
              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-background " +
              (showLineNumbers ? "text-primary" : "text-muted-foreground")
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
              "inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-background " +
              (wordWrap ? "text-primary" : "text-muted-foreground")
            }
            onClick={() => updateAttributes({ wordWrap: !wordWrap })}
            title="Toggle word wrap"
            aria-label="Toggle word wrap"
          >
            <WrapText size={15} />
          </button>
        </div>
      </div>

      <div
        className={
          "m-0 min-h-14 overflow-x-auto border-0 bg-transparent p-4 font-mono text-sm leading-6 " +
          (wordWrap ? "whitespace-pre-wrap" : "whitespace-pre")
        }
        data-line-numbers={String(showLineNumbers)}
      >
        <NodeViewContent className="outline-none" />
      </div>
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
