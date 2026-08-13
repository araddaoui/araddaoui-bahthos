export function deduplicateSources(sources: any[]): any[] {
  if (!Array.isArray(sources)) return [];
  const seenKeys = new Set<string>();
  const unique: any[] = [];

  for (const src of sources) {
    if (!src) continue;
    const title = (src?.title || "").trim();
    const normTitle = title
      .replace(/^[\s.\-–—:؛"']+|[\s.\-–—:؛"']+$/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    const rawContent = (src?.content || src?.summary || src?.extractedText || "").trim();
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

export function deduplicateReportText(text: string): string {
  if (!text) return "";

  // Fix common Arabic typos and grammar agreement issues
  let cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/com\/[^\s]+/g, "")
    .replace(/Published by\s+[^\n]+/gi, "")
    .replace(/Wiley\s+on\s+behalf\s+of[^\n]+/gi, "")
    .replace(/\bقراءة\s+نقدي\b/g, "قراءة نقدية")
    .replace(/\bمستقبيلة\b/g, "مستقبلية")
    .replace(/\bباعتماها\b/g, "باعتمادها")
    .replace(/\bصناع\s+القرا\s*\n\s*ر\b/g, "صناع القرار")
    .replace(/توصية\s+مستندة\s+إلى\s*[\(\[«]\s*[\s.\-–—:؛"'\(\)]*([^)\n]+?)[\s.\-–—:؛"'\(\)]*[\)\]»]\s*[:：]?/gi, 'توصية مستندة إلى "$1":')
    .replace(/توصية\s+مستندة\s+إلى\s*[-–—•*]?\s*\(\s*([^)]+)\s*\)\s*[:：]?/gi, 'توصية مستندة إلى "$1":');

  // Split inline merged bullets mid-paragraph (e.g. "...المستهدفة. - **تطوير معايير...")
  cleanedText = cleanedText.replace(/([.؛:!؟\u0600-\u06FFa-zA-Z])\s*[-–—•*]\s+(\*\*[\u0600-\u06FFa-zA-Z])/g, "$1.\n\n- $2");
  cleanedText = cleanedText.replace(/([.؛:!؟\u0600-\u06FFa-zA-Z])\s*[-–—•*]\s+([\u0600-\u06FFa-zA-Z]{3,}\s*[:：])/g, "$1.\n\n- $2");

  const blocks = cleanedText.split(/\n{2,}/);
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
        const rawAnswerText = nextBlock.replace(/^(?:\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*|الإجابة\s+العلمية\s*\(ج\):)\s*/i, "").trim();
        normAnswer = rawAnswerText
          .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
          .substring(0, 150)
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      const qaKey = normQuestion + "||" + normAnswer;

      if (seenQAKeys.has(qaKey)) {
        if (isAnswer) i++; // Skip answer block
        continue;
      }

      seenQAKeys.add(qaKey);

      const cleanQHeader = `#### س${questionCounter++}: ${rawQuestionText}`;
      resultBlocks.push(cleanQHeader);

      if (isAnswer) {
        resultBlocks.push(nextBlock);
        i++; // Skip answer block as processed
      }
      continue;
    }

    if (block.startsWith("- ") || block.startsWith("* ") || block.startsWith("• ")) {
      const bulletContent = block.replace(/^[*•-]\s+/, "").trim();
      const normBullet = bulletContent
        .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");

      if (normBullet.length > 20 && seenBulletKeys.has(normBullet)) {
        continue;
      }
      if (normBullet.length > 20) {
        seenBulletKeys.add(normBullet);
      }
    }

    resultBlocks.push(block);
  }

  return resultBlocks.join("\n\n");
}
