import type { Segment } from "@/lib/rich-text/parse-references";

interface ReferenceLinkProps {
  segment: Segment;
  repoContext?: { owner: string; name: string };
}

export function ReferenceLink({ segment, repoContext }: ReferenceLinkProps) {
  switch (segment.type) {
    case "issue_ref": {
      if (!repoContext || !segment.meta) {
        return <span className="font-mono text-[var(--accent-blue)]">{segment.value}</span>;
      }
      return (
        <a
          href={`https://github.com/${repoContext.owner}/${repoContext.name}/issues/${segment.meta}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[var(--accent-blue)] hover:underline"
        >
          {segment.value}
        </a>
      );
    }
    case "mention": {
      const username = segment.meta ?? segment.value.slice(1);
      const isAI = /^(ai|skynet)$/i.test(username);
      if (isAI) {
        return (
          <span className="rounded px-1 py-0.5 font-medium bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]">
            {segment.value}
          </span>
        );
      }
      return (
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-1 py-0.5 font-medium bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:underline"
        >
          {segment.value}
        </a>
      );
    }
    case "url": {
      return (
        <a
          href={segment.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent-blue)] hover:underline break-all"
        >
          {segment.value}
        </a>
      );
    }
    default:
      return <>{segment.value}</>;
  }
}
