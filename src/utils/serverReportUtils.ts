/**
 * Server-safe source and report deduplication helpers.
 * This module intentionally has no React or TSX dependency so Vercel API functions
 * can load it as a native ESM server module.
 */

export function deduplicateSources<T extends { title?: string; content?: string; summary?: string; extractedText?: string }>(sources: T[]): T[] {
  if (!Array.isArray(sources)) return [];
  const seenKeys = new Set<string>();
  const unique: T[] = [];

  for (const src of sources) {
    if (!src) continue;
    const title = (src.title || "").trim();
    const normTitle = title
      .replace(/^[\s.\-–—:؛"']+|[\s.\-–—:؛"']+$/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    const rawContent = (src.content || src.summary || src.extractedText || "").trim();
    const contentSnippet = rawContent.substring(0, 300).toLowerCase().replace(/\s+/g, " ");

    const titleKey = normTitle.length > 5 ? normTitle : null;
    const contentKey = contentSnippet.length > 30 ? contentSnippet : null;

    if (titleKey && seenKeys.has(titleKey)) continue;
    if (contentKey && seenKeys.has(contentKey)) continue;

    if (titleKey) seenKeys.add(titleKey);
    if (contentKey) seenKeys.add(contentKey);
    unique.push(src);
  }

  return unique.length > 0 ? unique : sources;
}

export function deduplicateReportBlocks(text: string): string {
  if (!text) return "";

  const blocks = text.split(/\n{2,}/);
  const resultBlocks: string[] = [];
  const seenQAKeys = new Set<string>();
  const seenBulletKeys = new Set<string>();
  let questionCounter = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const isQuestion = /^(?:#{1,6}\s*)?(?:س\d*:|سؤال\s*\d*:|\*\*س\d+:\*\*|\*\*س:\*\*|\*\*سؤال:\*\*)/i.test(block);
    if (isQuestion) {
      const nextBlock = i + 1 < blocks.length ? blocks[i + 1].trim() : "";
      const isAnswer = /^(?:\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*|الإجابة\s+العلمية\s*\(ج\):)/i.test(nextBlock);
      const rawQuestionText = block.replace(/^(?:#{1,6}\s*)?(?:س\d*:|سؤال\s*\d*:|\*\*س\d+:\*\*|\*\*س:\*\*|\*\*سؤال:\*\*)\s*/i, "").trim();
      const normQuestion = rawQuestionText
        .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");

      let normAnswer = "";
      if (isAnswer) {
        normAnswer = nextBlock
          .replace(/^(?:\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*|الإجابة\s+العلمية\s*\(ج\):)\s*/i, "")
          .trim()
          .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
          .substring(0, 150)
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      const qaKey = normQuestion + "||" + normAnswer;
      if (seenQAKeys.has(qaKey)) {
        if (isAnswer) i++;
        continue;
      }
      seenQAKeys.add(qaKey);
      resultBlocks.push(`#### س${questionCounter++}: ${rawQuestionText}`);
      if (isAnswer) {
        resultBlocks.push(nextBlock);
        i++;
      }
      continue;
    }

    if (block.startsWith("- ") || block.startsWith("* ") || block.startsWith("• ")) {
      const bulletContent = block.replace(/^[*•-]\s+/, "").trim();
      const normBullet = bulletContent
        .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (normBullet.length > 20 && seenBulletKeys.has(normBullet)) continue;
      if (normBullet.length > 20) seenBulletKeys.add(normBullet);
    }

    resultBlocks.push(block);
  }

  return resultBlocks.join("\n\n");
}
