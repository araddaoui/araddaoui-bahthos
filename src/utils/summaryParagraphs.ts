// Re-introduces sustained paragraph breaks into summaries that were flattened
// to a single line by the (frozen) Arabic text normalizers. Deterministic and
// text-only: splits on sentence terminators followed by whitespace, groups
// two sentences per paragraph. Content with existing line breaks is untouched.

export function ensureSummaryParagraphs(text: string): string {
  const raw = String(text || "").trim();
  if (!raw || /\n[^\n]/.test(raw)) return raw;

  const sentences = raw
    .split(/(?<=[.？！؟!۔])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length < 4) return raw;

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = sentences.slice(i, i + 2).join(" ");
    if (chunk) paragraphs.push(chunk);
  }
  return paragraphs.join("\n\n");
}
