const PROMPT_PATTERNS = [
  /\[y\/n\]\s*$/i,
  /\(yes\/no\)\s*$/i,
  /choose.*:\s*$/i,
  /select.*:\s*$/i,
  /\?\s*$/,
  />\s*$/,
  /press enter/i,
  /type your response/i,
  /waiting for.*input/i,
];

export function detectInputPrompt(output: string): boolean {
  const lastLine = output.trimEnd().split("\n").pop() ?? "";
  return PROMPT_PATTERNS.some((p) => p.test(lastLine));
}
