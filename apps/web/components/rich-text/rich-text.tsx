"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseReferences, type Segment } from "@/lib/rich-text/parse-references";
import { ReferenceLink } from "./reference-link";
import { CodeBlock } from "./code-block";

interface RichTextProps {
  content: string;
  format?: "markdown" | "plain";
  repoContext?: { owner: string; name: string };
}

function InlineReferences({
  text,
  repoContext,
}: {
  text: string;
  repoContext?: { owner: string; name: string };
}) {
  const segments = parseReferences(text);
  if (segments.length === 1 && segments[0]!.type === "text") {
    return <>{text}</>;
  }
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        ) : (
          <ReferenceLink key={i} segment={seg} repoContext={repoContext} />
        ),
      )}
    </>
  );
}

function RichTextInner({ content, format = "markdown", repoContext }: RichTextProps) {
  if (!content) return null;

  if (format === "plain") {
    const segments = parseReferences(content);
    const hasRefs = segments.some((s) => s.type !== "text");
    if (!hasRefs) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }
    return (
      <div className="whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <React.Fragment key={i}>{seg.value}</React.Fragment>
          ) : (
            <ReferenceLink key={i} segment={seg} repoContext={repoContext} />
          ),
        )}
      </div>
    );
  }

  return (
    <div className="rich-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Intercept text nodes for cross-link parsing
          p({ children }) {
            return (
              <p>
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return <InlineReferences text={child} repoContext={repoContext} />;
                  }
                  return child;
                })}
              </p>
            );
          },
          li({ children }) {
            return (
              <li>
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return <InlineReferences text={child} repoContext={repoContext} />;
                  }
                  return child;
                })}
              </li>
            );
          },
          td({ children }) {
            return (
              <td>
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return <InlineReferences text={child} repoContext={repoContext} />;
                  }
                  return child;
                })}
              </td>
            );
          },
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[0.85em] font-mono text-[var(--accent-cyan)]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-blue)] hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const RichText = memo(RichTextInner);
