"use client";

import { useEffect, useState, type ReactNode } from "react";

interface CodeBlockProps {
  className?: string;
  children?: ReactNode;
}

// Lazily loaded shiki highlighter singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let highlighterPromise: Promise<any> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((mod) =>
      mod.createHighlighter({
        themes: ["github-light-default"],
        langs: [
          "typescript",
          "javascript",
          "python",
          "go",
          "rust",
          "json",
          "yaml",
          "bash",
          "sql",
          "html",
          "css",
          "tsx",
          "jsx",
          "markdown",
          "diff",
        ],
      }),
    );
  }
  return highlighterPromise;
}

export function CodeBlock({ className, children }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const code = typeof children === "string" ? children : String(children ?? "");
  const lang = className?.replace(/^language-/, "") ?? "";

  useEffect(() => {
    if (!lang || !code) return;

    let cancelled = false;
    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        const loadedLangs = highlighter.getLoadedLanguages();
        const langId = loadedLangs.includes(lang as never) ? lang : "text";
        const result = highlighter.codeToHtml(code.replace(/\n$/, ""), {
          lang: langId,
          theme: "github-light-default",
        });
        setHtml(result);
      })
      .catch(() => {
        // fallback to plain
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (html) {
    return (
      <div
        className="overflow-x-auto rounded-lg text-sm [&_pre]:!bg-[var(--bg-primary)] [&_pre]:p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Fallback: plain code block
  return (
    <pre className="overflow-x-auto rounded-lg bg-[var(--bg-primary)] p-4 text-sm">
      <code className={className}>{children}</code>
    </pre>
  );
}
