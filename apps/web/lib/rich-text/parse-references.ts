export type SegmentType = "text" | "issue_ref" | "mention" | "url";

export interface Segment {
  type: SegmentType;
  value: string;
  /** Issue number for issue_ref, username for mention */
  meta?: string;
}

const ISSUE_REF = /#(\d+)/;
const MENTION = /@(\w[\w-]*)/;
const URL_PATTERN = /https?:\/\/\S+/;

// Combined pattern — order matters (URL before others to avoid partial matching)
const COMBINED = new RegExp(
  `(${URL_PATTERN.source})|(${ISSUE_REF.source})|(${MENTION.source})`,
  "g",
);

export function parseReferences(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(COMBINED)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    if (match[1]) {
      // URL
      segments.push({ type: "url", value: match[1] });
    } else if (match[2]) {
      // Issue ref: match[2] is full `#123`, match[3] is the number
      segments.push({ type: "issue_ref", value: match[2], meta: match[3] });
    } else if (match[4]) {
      // Mention: match[4] is full `@user`, match[5] is username
      segments.push({ type: "mention", value: match[4], meta: match[5] });
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
