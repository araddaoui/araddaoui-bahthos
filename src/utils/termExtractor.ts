import { GlossaryTerm } from "../types.js";

export function collapseSpacedArabicLetters(text: string): string {
  if (!text) return "";
  let res = text;
  // Match sequences of isolated single Arabic letters separated by spaces e.g. "Ùƒ Ø§ Ù„ Ùƒ Ø§ Ù„" or "Ø§ Ù„ Ø¸ Ùˆ Ø§ Ù‡ Ø±"
  res = res.replace(/(?:^|[\s"'(Â«ØŒ;Ø›:!ØŸ\-\[])(?:[\u0600-\u06FF]\s+){2,}[\u0600-\u06FF](?=[\s"').!Â»Â«ØŒ;Ø›:!ØŸ\]]|$)/g, (match) => {
    const leadingMatch = match.match(/^[^\u0600-\u06FF]+/);
    const leading = leadingMatch ? leadingMatch[0] : "";
    const lettersOnly = match.substring(leading.length).replace(/\s+/g, "");
    return leading + lettersOnly;
  });
  return res.replace(/\s+/g, " ").trim();
}

// Remove journal metadata, publication headers, ProQuest IDs, volume/issue numbers, and copyright lines
export function cleanBibliographicNoise(text: string): string {
  if (!text) return "";
  let res = text;
  res = res.replace(/(?:MILLENNIUM\s+)?Journal\s+of\s+[A-Za-z\s]+(?:\d{2,}\(\d+\)\s*\d+[\sâ€“-]+\d+)?/gi, "");
  res = res.replace(/ProQuest\s+pg\.\s*\d+/gi, "");
  res = res.replace(/The\s+Journal\s+of\s+Military\s+History[^\n;.]*/gi, "");
  res = res.replace(/Paret,\s*Peter[^\n;.]*/gi, "");
  res = res.replace(/Ramy\s+Jabbour[^\n;.]*/gi, "");
  res = res.replace(/December\s+2015\s+Gulf\s+Office[^\n;.]*/gi, "");
  res = res.replace(/Â©\s*The\s+Author\(s\)[^\n;.]*/gi, "");
  res = res.replace(/Reprints\s+and\s+permissions[^\n;.]*/gi, "");
  res = res.replace(/uk\/journalsPermissions[^\n;.]*/gi, "");
  res = res.replace(/All\s+rights\s+reserved[^\n;.]*/gi, "");
  res = res.replace(/\b\d{2,}\(\d+\)\s*\d+[\sâ€“-]+\d+\b/g, "");
  res = res.replace(/\b(Vol|Volume|Issue|pp|pg)\.?\s*\d+/gi, "");
  return res.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes Arabic text to repair PDF font extraction artifacts (such as 'Ø¢Ù„' instead of 'Ø§Ù„'
 * or alif-madda 'Ø¢' replacing standard alif 'Ø§' / 'Ø£'), removes OCR ligature bugs, and standardizes punctuation.
 */
export function normalizeArabicText(text?: string): string {
  if (!text) return "";
  let res = collapseSpacedArabicLetters(text);

  // 0. Fix repeated prefix loops e.g. "Ø§Ù„ÙƒØ§Ù„ÙƒØ§Ù„ÙƒÙØ§Ø¡Ø©" -> "Ø§Ù„ÙƒÙØ§Ø¡Ø©", "Ø§Ù„Ø§Ù„ØªØ±Ø¬Ù…Ø©" -> "Ø§Ù„ØªØ±Ø¬Ù…Ø©"
  res = res.replace(/(?:ÙƒØ§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„){2,}/g, "Ø§Ù„");

  // 1. Fix PDF font extraction mapping of "Ø§Ù„Ø£Ù„Ù ÙˆØ§Ù„Ù„Ø§Ù…" to "Ø¢Ù„" at word boundaries
  // Examples: "Ø¢Ù„ØªØ±Ø¬Ù…Ø©" -> "Ø§Ù„ØªØ±Ø¬Ù…Ø©", "Ø¢Ù„Ø°ÙƒØ§Ø¡" -> "Ø§Ù„Ø°ÙƒØ§Ø¡", "Ø¢Ù„Ø¯Ø§Ø¢Øª" -> "Ø§Ù„Ø£Ø¯ÙˆØ§Øª", "Ø¢Ù„ÙˆØ¢Ø¶ÙŠØ¹" -> "Ø§Ù„Ù…ÙˆØ§Ø¶ÙŠØ¹", etc.
  res = res.replace(/\bØ¢Ù„([Ø§Ø£Ø¥Ø¤Ø¦Ø¨-ÙŠ]+)/g, "Ø§Ù„$1");

  // 1b. Fix the lam-alef ligature artifacts that occur in most Arabic PDF text extraction:
  // "Ø§Ù…Ù„..." -> "Ø§Ù„Ù…..." (a mim/lam swap: "Ø§Ù…Ù„ØªØ¹Ø¯Ø¯Ø©"->"Ø§Ù„Ù…ØªØ¹Ø¯Ø¯Ø©", "Ø§Ù…Ù„Ø±Ù†"->"Ø§Ù„Ù…Ø±Ù†") and
  // "Ø§Ø§Ù„..." -> "Ø§Ù„Ø¥..." (a doubled-alif lam-alef: "Ø§Ø§Ù„Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"->"Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ").
  // These are font-extraction defects, not genuine words, so they can be normalized safely.
  res = res.replace(/(?<![\u0600-\u06FF])(Ø§Ù…Ù„)(?=[\u0600-\u06FF]{2,})/g, "Ø§Ù„Ù…");
  res = res.replace(/(?<![\u0600-\u06FF])(Ø§Ø§Ù„)(?=[\u0600-\u06FF]{2,})/g, "Ø§Ù„Ø¥");

  // Fix common OCR typos, broken prefix fragments, and mangled word forms
  res = res.replace(/\bØ§Ù„ÙØ§Ø¡Ø©\b/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø©");
  res = res.replace(/\bÙØ§Ø¡Ø©\b/g, "ÙƒÙØ§Ø¡Ø©");
  res = res.replace(/\bÙ…Ù„ØªØ±Ø¬Ù…Ø©\b/g, "Ø§Ù„Ù…ØªØ±Ø¬Ù…Ø©");
  res = res.replace(/\bÙ„ØªØ±Ø¬Ù…Ø©\b/g, "Ø§Ù„ØªØ±Ø¬Ù…Ø©");

  // 2. Fix specific corrupted PDF words commonly seen in OCR/CID font tables
  const replacements: Record<string, string> = {
    "Ø§Ù„ÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©": "Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©",
    "Ø§Ù„ÙØ§Ø¡Ø©": "Ø§Ù„ÙƒÙØ§Ø¡Ø©",
    "Ø¢Ù„ÙˆØ¢Ø¶ÙŠØ¹": "Ø§Ù„Ù…ÙˆØ§Ø¶ÙŠØ¹",
    "Ø¢Ù„Ø±Ø¢Ù‡Ù†Ø©": "Ø§Ù„Ø±Ø§Ù‡Ù†Ø©",
    "Ø¢Ù„ÙˆØ¢Ø³Ø¹": "Ø§Ù„ÙˆØ§Ø³Ø¹",
    "Ø¢Ù„ØºØ±Ø¶": "Ø§Ù„ØºØ±Ø¶",
    "Ø¢Ù„ÙƒØ§Ø¯ÙŠÙ…ÙŠ": "Ø§Ù„Ø£ÙƒØ§Ø¯ÙŠÙ…ÙŠ",
    "Ø¢Ù„Ø®ÙŠØ±Ø©": "Ø§Ù„Ø£Ø®ÙŠØ±Ø©",
    "Ø¢Ù„Ø¯Ø§Ø¢Øª": "Ø§Ù„Ø£Ø¯ÙˆØ§Øª",
    "Ø£Ø¯Ø§Ø¢Øª": "Ø£Ø¯ÙˆØ§Øª",
    "Ø¢Ù„Ø¯Ø§Ø¡": "Ø§Ù„Ø£Ø¯Ø§Ø¡",
    "Ø¢Ù„Ø³ØªØ®Ø¯Ù…ÙŠÙ†": "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†",
    "Ø¢Ù„ØªØ±Ø¬Ù…Ø©": "Ø§Ù„ØªØ±Ø¬Ù…Ø©",
    "Ø¢Ù„ÙˆÙ‚Øª": "Ø§Ù„ÙˆÙ‚Øª",
    "Ø¢Ù„Ø¬Ù‡Ø¯": "Ø§Ù„Ø¬Ù‡Ø¯",
    "Ø¢Ù„Ø¯Ø±Ø¢Ø³Ø©": "Ø§Ù„Ø¯Ø±Ø§Ø³Ø©",
    "Ø¢Ù„ÙƒÙØ§Ø¡Ø©": "Ø§Ù„ÙƒÙØ§Ø¡Ø©",
    "Ø¢Ù„Ø¨Ø´Ø±ÙŠØ©": "Ø§Ù„Ø¨Ø´Ø±ÙŠØ©",
    "Ø¢Ù„Ø°ÙƒØ§Ø¡": "Ø§Ù„Ø°ÙƒØ§Ø¡",
    "Ø¢Ù„ØµØ·Ù†Ø§Ø¹ÙŠ": "Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
    "Ø¢Ù„Ù‚Ø§Ø¦Ù…Ø©": "Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©",
    "Ø±Ø§Ø¢Ø¬Ø§": "Ø±ÙˆØ§Ø¬Ø§Ù‹",
    "Ø§Ø¯Ù‚Ø©": "Ø¨Ø¯Ù‚Ø©",
    "Ø§Ø¹Ù„ÙŠÙ‡": "ÙˆØ¹Ù„ÙŠÙ‡",
    "Ø§Ø¨Ù† Ø¶Ø±Ø§Ø±Ø©": "ÙˆÙ…Ù† Ø¶Ø±ÙˆØ±Ø©",
    "Ø§Ù†Ù‚Ø¯ÙŠØ©": "Ø§Ù„Ù†Ù‚Ø¯ÙŠØ©",
    "Ù„Ù…Ø§Ø±Ø³Ø©": "Ù„Ù…Ù…Ø§Ø±Ø³Ø©",
    "Ø³ÙˆØ§Ø¢Ø¡": "Ø³ÙˆØ§Ø¡",
    "ÙƒØ¨ÙŠØ±Ø¢": "ÙƒØ¨ÙŠØ±Ø§Ù‹",
    "Ø§Ù‚Ø¯ ": "Ù„Ù‚Ø¯ ",
    "Ù‡Ø°Ø¢": "Ù‡Ø°Ø§",
    "ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù…Ù„ØªØ±Ø¬Ù…Ø©": "ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø§Ù„ØªØ±Ø¬Ù…Ø©",
    "Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø±": "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø±",
    "Ø¢Ù„Ø¸ÙˆØ¢Ù‡Ø±": "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø±",
    "Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Ø¢Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Ø§Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Ø¢Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©": "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø± Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "ØªØ­Ù„ÙŠÙ„ Ø¢Ù„Ø¸ÙˆØ¢Ù‡Ø± Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©": "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Ø§ØªØ·Ø¨ÙŠÙ‚ÙŠØ©": "Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ÙŠØ©",
    "Ø§Ù„Ø¢Ù„ÙŠÙŠØ©": "Ø§Ù„Ø¢Ù„ÙŠØ©",
    "Ø§Ù„Ø¥ØµØ·Ù†Ø§Ø¹ÙŠ": "Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
    "Ø£ÙˆØªÙˆÙ…Ø§ØªÙŠ": "Ø£ÙˆØªÙˆÙ…Ø§ØªÙŠÙƒÙŠ",
    "ØªØ±Ø¬Ù…Ø© Ø¢Ù„ÙŠ": "ØªØ±Ø¬Ù…Ø© Ø¢Ù„ÙŠØ©",
    "ØªÙˆØµÙŠØ© Ù…Ø³ØªÙ†Ø¯": "ØªÙˆØµÙŠØ© Ù…Ø³ØªÙ†Ø¯Ø©",
    "ÙØ¬ÙˆØ© Ù…Ø¹Ø±ÙÙŠ": "ÙØ¬ÙˆØ© Ù…Ø¹Ø±ÙÙŠØ©",
  };
  for (const [corrupted, fixed] of Object.entries(replacements)) {
    res = res.replace(new RegExp(`(?<![\\u0600-\\u06FF])${corrupted}(?![\\u0600-\\u06FF])`, "g"), fixed);
  }

  // Safe whole-word replacements for word endings without appending extra letters
  res = res.replace(/(?<![\u0600-\u06FF])Ø§Ù„Ø¯Ø±Ø§Ø³Ø§(?![\u0600-\u06FF])/g, "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª");
  res = res.replace(/(?<![\u0600-\u06FF])Ø§Ù„Ù…ØªØ±Ø¬Ù…ÙŠ(?![\u0600-\u06FF])/g, "Ø§Ù„Ù…ØªØ±Ø¬Ù…ÙŠÙ†");

  // Sanitize any accumulated trailing repeated letters (e.g. "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§ØªØªØªØª" -> "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª")
  res = res.replace(/Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª{2,}/g, "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª");
  res = res.replace(/(?<=[\u0600-\u06FF])Øª{2,}(?=[\s"').!Â»Â«ØŒ;Ø›:!ØŸ\]]|$)/g, "Øª");
  res = res.replace(/(?<=[\u0600-\u06FF])Ù†{2,}(?=[\s"').!Â»Â«ØŒ;Ø›:!ØŸ\]]|$)/g, "Ù†");
  res = res.replace(/(?<=[\u0600-\u06FF])Ø©{2,}(?=[\s"').!Â»Â«ØŒ;Ø›:!ØŸ\]]|$)/g, "Ø©");

  // 3. Fix remaining standalone alif madda inside normal Arabic words where Alif Madda does not belong
  // Preserve legitimate Alif Madda words: Ø§Ù„Ù‚Ø±Ø¢Ù†ØŒ Ø§Ù„Ø¢Ù†ØŒ Ø¢Ø±Ø§Ø¡ØŒ Ø¢Ø«Ø§Ø±ØŒ Ø¢ÙØ§Ù‚ØŒ Ø¢Ù„ÙŠØ©ØŒ Ø¢Ù„Ø§ØªØŒ Ù…Ø±Ø¢Ø©ØŒ Ù…ÙƒØ§ÙØ¢ØªØŒ Ù…Ù†Ø´Ø¢ØªØŒ Ù…Ø¢Ù„ØŒ Ù…Ù†Ø´Ø£Ø©
  const validMaddaRegex = /(Ø§Ù„Ù‚Ø±Ø¢Ù†|Ø§Ù„Ø¢Ù†|Ø¢Ø±Ø§Ø¡|Ø¢Ø«Ø§Ø±|Ø¢ÙØ§Ù‚|Ø¢Ù„ÙŠØ©|Ø¢Ù„Ø§Øª|Ù…Ø±Ø¢Ø©|Ù…ÙƒØ§ÙØ¢Øª|Ù…Ù†Ø´Ø¢Øª|Ù…Ø¢Ù„)/;
  res = res.replace(/\b(?!Ø§Ù„Ù‚Ø±Ø¢Ù†|Ø§Ù„Ø¢Ù†|Ø¢Ø±Ø§Ø¡|Ø¢Ø«Ø§Ø±|Ø¢ÙØ§Ù‚|Ø¢Ù„ÙŠØ©|Ø¢Ù„Ø§Øª|Ù…Ø±Ø¢Ø©|Ù…ÙƒØ§ÙØ¢Øª|Ù…Ù†Ø´Ø¢Øª|Ù…Ø¢Ù„)[Ø£-ÙŠ]*Ø¢[Ø£-ÙŠ]+\b/g, (match) => {
    if (validMaddaRegex.test(match)) return match;
    return match.replace(/Ø¢/g, "Ø§");
  });

  // 4. Normalize punctuation spacing
  res = res.replace(/\s+/g, " ").trim();
  res = res.replace(/\s+([ØŒ.,Ø›!ØŸ])/g, "$1 ");
  res = res.replace(/([ØŒ.,Ø›!ØŸ])(?=[^\sØŒ.,Ø›!ØŸ0-9])/g, "$1 ");
  return res.replace(/\s+/g, " ").trim();
}

// Blacklist filter to block trivial/irrelevant proper names, place names, scholar names, journal names, header metadata, section headers, sentence fragments, citations, and broad generic disciplines
export function isTrivialOrCitationTerm(term: string, definition?: string): boolean {
  if (!term) return true;
  const cleanTerm = normalizeArabicText(term).trim().toLowerCase();

  // Too short or too long
  if (cleanTerm.length < 3 || cleanTerm.length > 55) return true;

  // Reject AI-invented boilerplate forewords that are NEVER part of a real concept.
  // (e.g. "Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ Ù…Ø³ØªØ®Ø±Ø¬ Ù…Ø¨Ø§Ø´Ø±Ø© Ù…Ù† Ù†Øµ Ø§Ù„Ù…ØµØ¯Ø±: ..." or "Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ ÙŠÙÙ‚ØµØ¯ Ø¨Ù‡ ÙÙŠ Ø§Ù„Ù†Øµ: ...")
  if (
    cleanTerm.includes("Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ") ||
    cleanTerm.includes("Ù…Ø³ØªØ®Ø±Ø¬ Ù…Ø¨Ø§Ø´Ø±Ø©") ||
    cleanTerm.includes("Ù…Ø³ØªØ®Ø±Ø¬ Ù…Ù†") ||
    cleanTerm.includes("Ù…Ù† Ù†Øµ Ø§Ù„Ù…ØµØ¯Ø±") ||
    cleanTerm.includes("ÙŠÙÙ‚ØµØ¯ Ø¨Ù‡ ÙÙŠ Ø§Ù„Ù†Øµ") ||
    cleanTerm.includes("Ù…Ø³ØªØ®Ù„Øµ Ù…Ù† Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…ØµØ¯Ø±") ||
    cleanTerm.includes("Ù…ÙÙ‡ÙˆÙ… Ù…Ø±ÙƒØ²ÙŠ")
  ) {
    return true;
  }

  // Reject classic Arabic sentence-fragment constructions taken verbatim from source text.
  // These are 2-word windows of error/truncation messages or grammatical fragments, not concepts.
  const arabicFragmentSubstrings = [
    "Ø§Ù‚ØªØµØ§Øµ Ø¨Ù‚ÙŠØ©", "Ø¨Ù‚ÙŠØ© Ø§Ù„Ù†Øµ", "Ø§Ù„Ù†Øµ Ù„ØªØ¬Ø§ÙˆØ²", "Ù„ØªØ¬Ø§ÙˆØ² Ø§Ù„Ø­Ø¯", "Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰",
    "Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©", "Ø§Ù„Ø­Ø¯ Ø§Ù„Ø§Ù‚ØµÙ‰", "Ø§Ù‚ØªØµØ§Øµ", "Ù„ØªØ¬Ø§ÙˆØ²", "ØªØ¬Ø§Ø²ÙŠ", "ØªØ¬Ø§ÙˆØ² Ø§Ù„Ø­Ø¯",
    "ÙƒØ¢Ù„ÙŠØ©", "Ù„ØªØ¬ÙˆÙŠØ¯", "Ù…Ø®Ø±Ø¬Ø§Øª Ø§Ù„Ø¹Ù…Ù„ÙŠØ©", "Ø§Ù„Ø±Ù‚Ù…ÙŠ Ùƒ", "Ø¨Ù‚ÙŠØ©", "Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…",
  ];
  for (const frag of arabicFragmentSubstrings) {
    if (cleanTerm.includes(frag)) return true;
  }

  // Reject Arabic terms that are composed mostly of function words / prepositions / verbs /
  // filler, i.e. a grammatical fragment rather than a nominal concept.
  const arabicFragmentStopwords = new Set([
    "Ù…Ù†", "ÙÙŠ", "Ø¹Ù„Ù‰", "Ø¥Ù„Ù‰", "Ø¹Ù†", "Ù…Ø¹", "Ø¨ÙŠÙ†", "Ø­ØªÙ‰", "Ø«Ù…", "Ø£Ùˆ", "Ø¨Ù„", "Ø£Ù†", "Ø¥Ù†",
    "Ù‚Ø¯", "Ù„Ù†", "Ù„Ùˆ", "Ø¥Ø°Ø§", "Ø­ÙŠØ«", "Ø¹Ù†Ø¯Ù…Ø§", "Ø¨Ø¹Ø¯", "Ù‚Ø¨Ù„", "Ø¯ÙˆÙ†", "Ø¨Ø³Ø¨Ø¨", "Ø­Ø³Ø¨",
    "Ù†Ø­Ùˆ", "Ù„Ø¯Ù‰", "Ø¹Ù†Ø¯", "Ø®Ù„Ø§Ù„", "Ø¶Ù…Ù†", "Ø®Ø§Ø±Ø¬", "ÙÙˆÙ‚", "ØªØ­Øª", "Ø£Ù…Ø§Ù…", "Ø®Ù„Ù", "ÙƒØ§Ù†",
    "ÙƒØ§Ù†Øª", "ÙŠÙƒÙˆÙ†", "ÙŠØªÙ…", "ØªØªÙ…", "ØªÙ…", "ÙŠÙˆØ¬Ø¯", "ØªÙˆØ¬Ø¯", "ÙŠØ¹Ø¯", "ØªØ¹Ø¯", "ÙŠØ¹ØªØ¨Ø±", "ØªØ¹ØªØ¨Ø±",
    "ÙŠØ¹Ù†ÙŠ", "ÙŠØ¤Ø¯ÙŠ", "ØªØ¤Ø¯ÙŠ", "Ø£Ø¯Ù‰", "Ù‡Ùˆ", "Ù‡ÙŠ", "Ù‡Ø°Ø§", "Ù‡Ø°Ù‡", "Ø°Ù„Ùƒ", "ØªÙ„Ùƒ", "Ø§Ù„Ø°ÙŠ",
    "Ø§Ù„ØªÙŠ", "Ø§Ù„Ø°ÙŠÙ†", "Ù…Ø¹Ø§Ù„Ø¬Ø©", "Ø§Ù„ØªØ§Ù„ÙŠ", "Ø§Ù„ØªØ§Ù„ÙŠØ©", "Ø£ÙŠØ¶Ø§", "ÙƒØ°Ù„Ùƒ", "Ø¨Ø´ÙƒÙ„", "Ø¨ØµÙˆØ±Ø©",
    "Ø¨Ø¹Ø¶", "ÙƒÙ„", "Ø¬Ù…ÙŠØ¹", "ÙƒÙ…", "Ø¨Ù‚ÙŠØ©", "Ø¨Ø§Ù‚ÙŠ", "Ø§Ù‚ØªØµØ§Øµ", "Ù„ØªØ¬Ø§ÙˆØ²", "ØªØ¬Ø§ÙˆØ²", "Ø§Ù„Ø£Ù‚ØµÙ‰",
    "Ø§Ù„Ù†Øµ", "Ø§Ù„Ù…Ø³ØªÙ†Ø¯", "Ø§Ù„ØµÙØ­Ø©", "Ø§Ù„Ø¬Ø²Ø¡", "Ø§Ù„Ø¹Ù…Ù„ÙŠØ©", "Ø§Ù„Ù…Ø®Ø±Ø¬Ø§Øª", "Ù…Ø¨Ø§Ø´Ø±Ø©", "Ø§Ù„Ø±Ù‚Ù…ÙŠ",
  ]);
  const cleanArWords = cleanTerm.split(/\s+/).filter(Boolean);
  if (cleanArWords.length >= 2) {
    const normalizeWord = (w: string) => w
      .replace(/^Ø§Ù„/, "")
      .replace(/^[ÙˆÙØ¨ÙƒÙ„]/, "")
      .replace(/Ø©$/, "Ù‡")
      .trim();
    const firstNorm = normalizeWord(cleanArWords[0]);
    if (firstNorm && arabicFragmentStopwords.has(firstNorm)) return true;
    let stopCount = 0;
    for (const w of cleanArWords) {
      if (arabicFragmentStopwords.has(normalizeWord(w))) stopCount++;
    }
    if (stopCount > Math.floor(cleanArWords.length / 2)) return true;
  }

  // Reject broad academic disciplines and generic fields when standalone or overly generic (e.g. "Computer Science", "Higher Education Policy", "Public Administration", "Thought Leadership")
  const genericDisciplinesAndBroadTerms = [
    "computer science", "marketing", "management", "finance", "accounting", "business",
    "economics", "law", "medicine", "engineering", "education", "sociology", "psychology",
    "philosophy", "history", "literature", "mathematics", "biology", "physics", "chemistry",
    "geography", "statistics", "linguistics", "anthropology", "political science", "journalism",
    "higher education policy", "higher education", "public administration", "thought leadership",
    "public policy", "educational policy", "general management", "project management",
    "quality assurance", "social media", "educational system", "policy studies", "digital transformation",
    "ministry of education strategy", "the education development strategy", "ministry of education",
    "education development strategy", "education development", "higher education strategy",
    "department of translation", "faculty of arts", "academic paper", "document title", "case study paper",
    "theory", "the theory", "methodology", "research methodology", "research", "the research",
    "study", "the study", "paper", "the paper", "analysis", "the analysis", "data", "results",
    "findings", "discussion", "literature review", "background", "theoretical framework",
    "methodological framework", "framework", "approach", "method", "methods", "concept", "concepts",
    "term", "terms", "definition", "definitions", "theories", "methodologies",
    "Ø¹Ù„ÙˆÙ… Ø§Ù„Ø­Ø§Ø³ÙˆØ¨", "Ø¹Ù„ÙˆÙ… Ø§Ù„ÙƒÙ…Ø¨ÙŠÙˆØªØ±", "Ø§Ù„ØªØ³ÙˆÙŠÙ‚", "Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©", "Ø§Ù„Ø¹Ù„ÙˆÙ… Ø§Ù„Ù…Ø§Ù„ÙŠØ©", "Ø§Ù„Ù…Ø­Ø§Ø³Ø¨Ø©",
    "Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø¹Ù…Ø§Ù„", "Ø§Ù„Ø§Ù‚ØªØµØ§Ø¯", "Ø§Ù„Ù‚Ø§Ù†ÙˆÙ†", "Ø§Ù„Ø·Ø¨", "Ø§Ù„Ù‡Ù†Ø¯Ø³Ø©", "Ø§Ù„ØªØ±Ø¨ÙŠØ©", "Ø¹Ù„Ù… Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹",
    "Ø³ÙŠØ§Ø³Ø© Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø¹Ø§Ù„ÙŠ", "Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø¹Ø§Ù„ÙŠ", "Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ø§Ù…Ø©", "Ø§Ù„Ø±ÙŠØ§Ø¯Ø© Ø§Ù„ÙÙƒØ±ÙŠØ©", "Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ÙÙƒØ±ÙŠØ©",
    "Ø§Ù„Ø³ÙŠØ§Ø³Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ø©", "Ø§Ù„Ø³ÙŠØ§Ø³Ø© Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©", "Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ø§Ù…Ø© ÙˆØ§Ù„Ø³ÙŠØ§Ø³Ø§Øª", "Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø´Ø§Ø±ÙŠØ¹",
    "Ø¹Ù„Ù… Ø§Ù„Ù†ÙØ³", "Ø§Ù„ÙÙ„Ø³ÙØ©", "Ø§Ù„ØªØ§Ø±ÙŠØ®", "Ø§Ù„Ø£Ø¯Ø¨", "Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª", "Ø§Ù„Ø£Ø­ÙŠØ§Ø¡", "Ø§Ù„ÙÙŠØ²ÙŠØ§Ø¡", "Ø§Ù„ÙƒÙŠÙ…ÙŠØ§Ø¡",
    "Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§", "Ø§Ù„Ø¥Ø­ØµØ§Ø¡", "Ø§Ù„Ù„Ø³Ø§Ù†ÙŠØ§Øª", "Ø§Ù„Ø£Ù†Ø«Ø±ÙˆØ¨ÙˆÙ„ÙˆØ¬ÙŠØ§", "Ø§Ù„Ø¹Ù„ÙˆÙ… Ø§Ù„Ø³ÙŠØ§Ø³ÙŠØ©", "Ø§Ù„Ø¥Ø¹Ù„Ø§Ù…",
    "Ø§Ù„Ù†Ø¸Ø±ÙŠØ©", "Ù†Ø¸Ø±ÙŠØ©", "Ù…Ù†Ù‡Ø¬ÙŠØ© Ø§Ù„Ø¨Ø­Ø«", "Ù…Ù†Ù‡Ø¬ÙŠØ©", "Ø§Ù„Ø¨Ø­Ø«", "Ø¨Ø­Ø«", "Ø§Ù„Ø¯Ø±Ø§Ø³Ø©", "Ø¯Ø±Ø§Ø³Ø©",
    "Ø§Ù„ÙˆØ±Ù‚Ø© Ø§Ù„Ø¨Ø­Ø«ÙŠØ©", "Ø§Ù„ØªØ­Ù„ÙŠÙ„", "Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª", "Ø§Ù„Ù†ØªØ§Ø¦Ø¬", "Ø§Ù„Ù…Ù†Ø§Ù‚Ø´Ø©", "Ø§Ø³ØªØ¹Ø±Ø§Ø¶ Ø§Ù„Ø£Ø¯Ø¨ÙŠØ§Øª",
    "Ø§Ù„Ø¥Ø·Ø§Ø± Ø§Ù„Ù†Ø¸Ø±Ù‰", "Ø§Ù„Ø¥Ø·Ø§Ø± Ø§Ù„Ù†Ø¸Ø±ÙŠ", "Ø§Ù„Ø¥Ø·Ø§Ø± Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠ", "Ø§Ù„Ø¥Ø·Ø§Ø±", "Ø§Ù„Ù…Ù‚Ø§Ø±Ø¨Ø©", "Ø§Ù„Ù…Ù†Ù‡Ø¬", "Ø§Ù„Ù…Ù†Ø§Ù‡Ø¬",
    "Ø§Ù„Ù…ÙÙ‡ÙˆÙ…", "Ø§Ù„Ù…ÙØ§Ù‡ÙŠÙ…", "Ø§Ù„Ù…ØµØ·Ù„Ø­", "Ø§Ù„Ù…ØµØ·Ù„Ø­Ø§Øª", "Ø§Ù„Ø¹Ù…Ù„ÙŠØ©", "Ø§Ù„Ø¹Ù…Ù„ÙŠØ© Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©", "Ø§Ù„Ù…Ù…Ø§Ø±Ø³Ø§Øª",
    "Ø§Ù„Ø®Ø¯Ù…Ø©", "Ø§Ù„Ø®Ø¯Ù…Ø§Øª", "Ø§Ù„Ù…Ù†Ø¸ÙˆÙ…Ø©", "Ø§Ù„Ø¨Ù†ÙŠØ©", "Ø§Ù„Ù†Ø¸Ø§Ù…", "Ø§Ù„Ø±Ø¤ÙŠØ©", "Ø§Ù„Ø±Ø³Ø§Ù„Ø©", "Ø§Ù„Ø£Ù‡Ø¯Ø§Ù", "Ø§Ù„ØºØ§ÙŠØ§Øª",
  ];
  if (genericDisciplinesAndBroadTerms.some(gd => cleanTerm === gd || cleanTerm.replace(/^(the|a|an)\s+/, "") === gd)) {
    return true;
  }

  // Reject terms ending with prepositions, conjunctions, or trailing verbs ("and", "or", "of", "in", "for", "on", "with", "by", "from", "at", "source", "author", "reshapes", "missed", "shaping", "reshaping", "seeking", "rethinking", "understanding", "facing", "looking")
  if (/\b(and|or|of|in|for|on|with|by|from|at|source|author|reshapes|missed|shaping|reshaping|seeking|rethinking|understanding|facing|looking|doing|going|seeing)\s*$/i.test(cleanTerm)) {
    return true;
  }

  // Reject terms starting with fragment verbs / articles / pronouns / title structures
  if (/^(war reshapes|missed the|the myth of|why we|how war|how the|what is|where is|when the|eleonora|gregory|gause|elizabeth|kendall|david|bernard|john|smith|dr\.|prof\.)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject specific scholar names, author surnames, proper personal names, and citation fragments
  const scholarAndAuthorNames = [
    "creanga", "popa", "ionescu", "vasilescu", "dimitrescu", "smith", "johnson", "brown", "miller", "jones",
    "davis", "garcia", "rodriguez", "wilson", "martinez", "anderson", "taylor", "thomas", "hernandez",
    "moore", "martin", "jackson", "thompson", "white", "lopez", "lee", "gonzalez", "harris", "clark",
    "lewis", "robinson", "walker", "perez", "hall", "young", "allen", "sanchez", "wright", "king",
    "scott", "green", "baker", "adams", "nelson", "hill", "ramirez", "campbell", "mitchell", "roberts",
    "carter", "phillips", "evans", "turner", "torres", "parker", "collins", "edwards", "stewart",
    "flores", "morris", "nguyen", "murphy", "rivera", "cook", "rogers", "morgan", "peterson", "cooper",
    "reed", "bailey", "bell", "gomez", "kelly", "howard", "ward", "cox", "diaz", "richardson", "wood",
    "watson", "brooks", "bennett", "gray", "james", "reyes", "cruz", "hughes", "price", "myers", "long",
    "foster", "sanders", "ross", "morales", "powell", "sullivan", "russell", "ortiz", "jenkins",
    "gutierrez", "perry", "butler", "barnes", "fisher", "eleonora ardemagni", "ardemagni", "gregory gause",
    "gause", "gregory gause iii", "gause iii", "elizabeth kendall", "kendall", "bernard lewis", "joseph nye",
    "nye", "roberts to", "roberts", "david b", "david", "tamim", "emir tamim", "john", "keohane", "waltz",
    "mearsheimer", "huntington", "fukuyama", "morgenthau", "bull", "wendt", "walt", "kissinger", "weber",
    "chomsky", "bourdieu", "foucault", "derrida", "habermas", "said", "lynch", "marc lynch", "barnett",
    "michael barnett", "telhami", "shibley telhami", "nawaz", "ameer nawaz", "gregory", "eleonora"
  ];
  if (scholarAndAuthorNames.some((sa) => cleanTerm === sa || cleanTerm.includes(sa))) {
    return true;
  }

  // Reject any action verbs, verb forms, or clause fragments in English
  if (/\b(reshapes|reshape|reshaped|reshaping|missed|miss|missing|rethinking|rethink|seeking|seek|sought|understanding|understand|understands|facing|face|faced|looking|look|doing|make|makes|making|made|takes|taking|took|gives|giving|gave|shows|showing|showed|creates|creating|created|brings|bringing|brought)\b/i.test(cleanTerm)) {
    return true;
  }

  // Contains citation numbers, ISSN, DOI, URLs, page ranges, or header symbols
  if (/[0-9]|issn|doi|http|www|vol|nÂ°|\bno\b|pp\.|isbn|journal|college|university|press|comillas|london|edited|published|accessed|downloaded/i.test(cleanTerm)) {
    return true;
  }

  // Reject citation verbs and author attribution fragments
  if (/\b(cite|citation|cited|author|edited|published|publisher|copyright|rights reserved|et al|ibid|op cit|translator|translated|source|volume|issue|proceedings)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject non-concept verbs, auxiliaries, pronouns, demonstratives, and sentence fragments
  if (/\b(both|have|has|had|was|were|been|being|is|are|does|do|did|doing|would|could|should|will|can|may|might|shall|which|that|this|these|those|some|many|each|every|such|also|only|very|more|most|than|then|when|where|how|why|what|who|whom|from|into|onto|upon|with|within|without|about|above|below|translatability)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject sentence fragments / conjunctions / adverbs starting English phrases
  if (/^(yet|and|or|so|but|however|thus|therefore|also|nonetheless|nevertheless|moreover|furthermore|regarding|concerning|according|since|while|although|to|by|from|with|about|via|in|on|at|as)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject Arabic generic workflow / section / fragment prefixes
  if (/^(Ø£Ø³Ù„ÙˆØ¨|Ø·Ø±ÙŠÙ‚Ø©|Ø¹Ù…Ù„ÙŠØ©|ÙˆÙÙ‚Ø§Ù‹|Ø­Ø³Ø¨|Ù†Ù‚Ù„Ø§Ù‹|Ø´ÙƒÙ„|Ø¬Ø¯ÙˆÙ„|ØµÙˆØ±Ø©|Ø´ÙƒÙ„ Ø±Ù‚Ù…|Ø¬Ø¯ÙˆÙ„ Ø±Ù‚Ù…|Ø¨Ù†Ø§Ø¡Ù‹|Ø§Ø³ØªÙ†Ø§Ø¯Ø§Ù‹|Ù…Ø¹ Ø°Ù„Ùƒ|ÙƒØ°Ù„Ùƒ|Ø¹Ù„Ø§ÙˆØ©|Ø¥Ø¶Ø§ÙØ©|Ù…Ù† Ù‚Ø¨Ù„|Ø¹Ù† Ø·Ø±ÙŠÙ‚|Ø¨ÙˆØ§Ø³Ø·Ø©)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject section names, document metadata, web footers
  if (/^(executive summary|full terms|terms & conditions|table of contents|abstract|keywords|introduction|conclusion|references|bibliography|appendix|chapter|section|figure|table|page|volume|issue|copyright|all rights reserved)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject university, department, faculty, school, student class, case study, and journal metadata
  const institutionalAndHeaderTerms = [
    "university", "department", "faculty", "school", "college", "students", "first-year", "second-year", "third-year", "case study",
    "saida", "algiers", "doha", "qatar", "cairo", "london", "paris", "journal", "review", "bulletin", "proceedings",
    "conference", "seminar", "symposium", "abstract", "keywords", "introduction", "conclusion", "references", "bibliography", "appendix",
    "Ø¬Ø§Ù…Ø¹Ø©", "Ù‚Ø³Ù…", "ÙƒÙ„ÙŠØ©", "Ù…Ø¹Ù‡Ø¯", "Ø·Ù„Ø¨Ø©", "Ø·Ù„Ø§Ø¨", "Ø³Ù†Ø© Ø£ÙˆÙ„Ù‰", "Ø³Ù†Ø© Ø«Ø§Ù†ÙŠØ©", "Ø³Ù†Ø© Ø«Ø§Ù„Ø«Ø©", "Ø³Ù†Ø© Ø±Ø§Ø¨Ø¹Ø©",
    "Ù„ÙŠØ³Ø§Ù†Ø³", "Ù…Ø§Ø¬Ø³ØªÙŠØ±", "Ø¯ÙƒØªÙˆØ±Ø§Ù‡", "Ø³Ø¹ÙŠØ¯Ø©", "Ø§Ù„Ø¬Ø²Ø§Ø¦Ø±", "Ø§Ù„Ø¯ÙˆØ­Ø©", "Ù‚Ø·Ø±", "Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©", "Ù„Ù†Ø¯Ù†", "Ø¨Ø§Ø±ÙŠØ³",
    "Ù…Ø¬Ù„Ø©", "Ø­ÙˆÙ„ÙŠØ§Øª", "Ù…Ø¤ØªÙ…Ø±", "Ù†Ø¯ÙˆØ©", "Ù…Ù„ØªÙ‚Ù‰", "Ø£Ù†Ù…ÙˆØ°Ø¬Ø§", "Ø£Ù†Ù…ÙˆØ°Ø¬Ø§Ù‹", "Ø¯Ø±Ø§Ø³Ø© Ø­Ø§Ù„Ø©", "Ù…Ù‚Ø¯Ù…Ø©", "Ø®Ø§ØªÙ…Ø©", "Ù…Ø±Ø§Ø¬Ø¹", "ÙÙ‡Ø±Ø³"
  ];
  if (institutionalAndHeaderTerms.some((sa) => cleanTerm === sa || cleanTerm.includes(sa))) {
    return true;
  }

  // Reject topic action phrases and title fragments that are NOT theoretical concepts
  const topicActionPhrases = [
    "teaching translation", "teaching of", "study of", "light of", "challenges and horizons", "challenges", "horizons",
    "application of", "use of", "case study", "first-year students", "department of translation", "university of saida",
    "ØªØ¯Ø±ÙŠØ³ Ø§Ù„ØªØ±Ø¬Ù…Ø©", "ÙÙŠ Ø¸Ù„", "Ø§Ù„ØªØ­Ø¯ÙŠØ§Øª Ø§Ù„Ø¢ÙØ§Ù‚", "Ø§Ù„ØªØ­Ø¯ÙŠØ§Øª ÙˆØ§Ù„Ø¢ÙØ§Ù‚", "Ù‚Ø³Ù… Ø§Ù„ØªØ±Ø¬Ù…Ø©", "Ø·Ù„Ø¨Ø© Ø³Ù†Ø© Ø£ÙˆÙ„Ù‰"
  ];
  if (topicActionPhrases.some((tp) => cleanTerm === tp || cleanTerm.startsWith(tp) || cleanTerm.endsWith(tp) || cleanTerm.includes("teaching"))) {
    return true;
  }

  // Reject any term containing digits or page ranges
  if (/[0-9]/.test(cleanTerm)) {
    return true;
  }

  // Reject geographical regions, country names, city names, journals, and publishers
  const geographicalAndPlaces = [
    "middle east", "qatar", "doha", "london", "al udeid", "as sayliyah", "sayliyah", "udeid", "united states", "usa", "america", "europe", "asia", "latin america", "persian gulf", "arabian gulf", "saudi arabia", "riyadh", "new york", "san antonio", "washington", "cairo", "beirut", "tehran", "tel aviv", "jerusalem", "gaza", "israel",
    "Ø§Ù„Ø´Ø±Ù‚ Ø§Ù„Ø£ÙˆØ³Ø·", "Ù‚Ø·Ø±", "Ø§Ù„Ø¯ÙˆØ­Ø©", "Ù„Ù†Ø¯Ù†", "Ø§Ù„ÙˆÙ„Ø§ÙŠØ§Øª Ø§Ù„Ù…ØªØ­Ø¯Ø©", "Ø£Ù…Ø±ÙŠÙƒØ§", "Ø£ÙˆØ±ÙˆØ¨Ø§", "Ø¢Ø³ÙŠØ§", "Ø£Ù…Ø±ÙŠÙƒØ§ Ø§Ù„Ù„Ø§ØªÙŠÙ†ÙŠØ©", "Ø§Ù„Ø®Ù„ÙŠØ¬ Ø§Ù„Ø¹Ø±Ø¨ÙŠ", "Ø§Ù„Ø³Ø¹ÙˆØ¯ÙŠØ©", "Ø§Ù„Ø±ÙŠØ§Ø¶", "Ù†ÙŠÙˆÙŠÙˆØ±Ùƒ", "Ø³Ø§Ù† Ø£Ù†Ø·ÙˆÙ†ÙŠÙˆ", "ÙˆØ§Ø´Ù†Ø·Ù†", "Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©", "Ø¨ÙŠØ±ÙˆØª", "Ø·Ù‡Ø±Ø§Ù†", "ØªÙ„ Ø£Ø¨ÙŠØ¨", "Ø§Ù„Ù‚Ø¯Ø³", "ØºØ²Ø©", "Ø¥Ø³Ø±Ø§Ø¦ÙŠÙ„"
  ];
  if (geographicalAndPlaces.some((gp) => cleanTerm.includes(gp))) {
    return true;
  }

  // Reject journal names, publisher names, and institutional publication fragments
  const journalsAndPublishers = [
    "foreign affairs", "international studies", "millennium", "wiley", "springer", "routledge", "cambridge", "oxford", "harvard", "jstor", "proquest", "buen", "press", "house", "review", "bulletin", "studies"
  ];
  if (journalsAndPublishers.some((jp) => cleanTerm.includes(jp))) {
    return true;
  }

  // Reject dangling initials, author suffixes, or prepositional title fragments (e.g. "Retrenchment J", "Robert Mason To", "John Smith By")
  if (/\b[a-z]\b$/i.test(cleanTerm) || /\b(to|by|and|from|in|on|with|at)\s*$/i.test(cleanTerm) || /\b[a-z]\s+(to|by|and|from|in|on|with|at)\b/i.test(cleanTerm)) {
    return true;
  }

  // Check definition for actual citation/footer/header garbage, page ranges, or empty quotes
  if (definition) {
    const cleanDef = normalizeArabicText(definition).toLowerCase();
    if (
      cleanDef.length < 15 ||
      cleanDef.includes('""') ||
      cleanDef.includes(":\s*\"\"") ||
      // Reject any AI-invented explanatory foreword baked into the definition
      cleanDef.includes("Ù…Ø³ØªØ®Ø±Ø¬ Ù…Ø¨Ø§Ø´Ø±Ø©") ||
      cleanDef.includes("Ù…Ø³ØªØ®Ø±Ø¬ Ù…Ù† Ù†Øµ") ||
      cleanDef.includes("Ù…Ù† Ù†Øµ Ø§Ù„Ù…ØµØ¯Ø±") ||
      cleanDef.includes("ÙŠÙÙ‚ØµØ¯ Ø¨Ù‡ ÙÙŠ Ø§Ù„Ù†Øµ") ||
      cleanDef.includes("Ù…Ø³ØªØ®Ù„Øµ Ù…Ù† Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù…ØµØ¯Ø±") ||
      cleanDef.includes("Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ ÙŠÙÙ‚ØµØ¯ Ø¨Ù‡ ÙÙŠ Ø§Ù„Ù†Øµ: \"\"") ||
      /issn|doi|nÂ°|001-|[0-9]{3,}|journal of|all rights reserved|executive summary|full terms|cite this article|http|\b\d{1,4}\s*[-â€“â€”]\s*\d{1,4}\b/i.test(cleanDef) ||
      cleanDef.includes("Ø¬Ø§Ù…Ø¹Ø©") || cleanDef.includes("Ø£Ù†Ù…ÙˆØ°Ø¬Ø§") || cleanDef.includes("Ø£Ù†Ù…ÙˆØ°Ø¬Ø§Ù‹") || cleanDef.includes("Ø³Ù†Ø© Ø£ÙˆÙ„Ù‰") || cleanDef.includes("ØªØ¯Ø±ÙŠØ³ Ø§Ù„ØªØ±Ø¬Ù…Ø© ÙÙŠ Ø¸Ù„") || cleanDef.includes("567")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Accurately detects the primary source language of a document ("ar", "en", or "fr")
 * based on character script frequency and vocabulary markers, overriding inaccurate AI labels.
 */
export function detectSourceLanguage(
  text: string,
  title?: string,
  modelLang?: string
): "ar" | "en" | "fr" {
  const sample = ((text || "") + " " + (title || "")).trim();
  if (!sample) return "ar";

  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (sample.match(/[a-zA-Z]/g) || []).length;

  if (latinChars > arabicChars && latinChars > 15) {
    const lower = sample.toLowerCase();
    const frenchKeywords = [
      " les ", " des ", " une ", " est ", " dans ", " pour ", " avec ",
      "traduction", "erreur", "intelligibilitÃ©", "automatique", "humaine", "sur "
    ];
    const frenchMatchCount = frenchKeywords.filter((kw) => lower.includes(kw)).length;
    if (frenchMatchCount >= 2) return "fr";
    return "en";
  }

  if (arabicChars > latinChars && arabicChars > 15) {
    return "ar";
  }

  if (modelLang === "en" || modelLang === "fr" || modelLang === "ar") {
    return modelLang;
  }

  return "ar";
}

export function stripArabicParticlesAndNumbers(term: string): string {
  if (!term) return "";
  let res = term.trim();

  // 1. Collapse spaced single OCR letters e.g. "Ùƒ Ø§ Ù„ Ùƒ Ø§ Ù„" -> "Ø§Ù„ÙƒØ§Ù„Ùƒ" or "Ùƒ Ø§ Ù„ Ùƒ Ù Ø§ Ø¡ Ø© Ø§ Ù„ Ø¨ Ø´ Ø± ÙŠ Ø©" -> "ÙƒØ§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©"
  res = collapseSpacedArabicLetters(res);

  // 2. Strip trailing numbers (e.g. " 2,", " 567", " 10"), page markers, and citations
  res = res.replace(/[\s,ØŒ;Ø›:!?ØŸâ€“â€”\-\d]+$/g, "");

  // 3. Strip trailing conversational adverbs, conjunctions, or suffixes
  res = res.replace(/[\s,ØŒ;Ø›:!?ØŸâ€“â€”-]+(Ø®ØµÙˆØµØ§|Ø®ØµÙˆØµØ§Ù‹|Ø®Ø§ØµØ©|Ø³ÙŠÙ…Ø§|Ù„Ø§ Ø³ÙŠÙ…Ø§|ÙˆÙÙ‚Ø§|ÙˆÙÙ‚Ø§Ù‹|Ø¨Ù†Ø§Ø¡|Ø¨Ù†Ø§Ø¡Ù‹|Ø£ÙŠØ¶Ø§|Ø£ÙŠØ¶Ø§Ù‹|ÙƒØ°Ù„Ùƒ|Ù…Ø¹ Ø°Ù„Ùƒ|Ù…Ù†Ù‡Ø§|Ø¥Ù„Ø®)+$/gi, "");

  // Repeat trailing punctuation and number purge
  res = res.replace(/[\s,ØŒ;Ø›:!?ØŸâ€“â€”\-\d]+$/g, "");

  // 4. Purge repeated prefixes e.g. "ÙƒØ§Ù„ÙƒØ§Ù„ÙƒØ§Ù„ÙƒÙØ§Ø¡Ø©", "Ø§Ù„ÙƒØ§Ù„ÙƒÙØ§Ø¡Ø©", "Ø§Ù„Ø§Ù„ØªØ±Ø¬Ù…Ø©"
  res = res.replace(/(?:ÙƒØ§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„){2,}/g, "Ø§Ù„");

  // 5. Strip prepended particle prepositions (ÙƒÙ€ØŒ Ø¨Ù€ØŒ ÙÙ€ØŒ ÙˆØŒ Ù„Ù€ØŒ ÙƒØ§Ù„Ù€ØŒ Ø¨Ø§Ù„Ù€ØŒ ÙØ§Ù„Ù€ØŒ ÙˆØ§Ù„Ù€ØŒ Ù„Ù„Ù€ØŒ ÙˆÙ„Ù„Ù€) from the start of Arabic terms
  // CRITICAL FIX: "ÙƒØ§Ù„Ùƒ" -> "Ø§Ù„Ùƒ" (e.g. "ÙƒØ§Ù„ÙƒÙØ§Ø¡Ø©" -> "Ø§Ù„ÙƒÙØ§Ø¡Ø©", "ÙƒØ§Ù„ÙƒØªØ§Ø¨" -> "Ø§Ù„ÙƒØªØ§Ø¨"). Never replace "ÙƒØ§Ù„Ùƒ" with "Ø§Ù„"!
  res = res.replace(/^(?:ÙˆÙƒØ§Ù„Ùƒ|ÙÙƒØ§Ù„Ùƒ|ÙƒØ§Ù„Ùƒ)/g, "Ø§Ù„Ùƒ");
  res = res.replace(/^(?:ÙˆÙƒØ§Ù„|ÙÙƒØ§Ù„|ÙˆØ¨Ø§Ù„|ÙØ¨Ø§Ù„|ÙƒØ§Ù„|Ø¨Ø§Ù„|ÙØ§Ù„|ÙˆØ§Ù„|ÙˆÙ„Ù„|ÙÙ„Ù„|Ù„Ù„)(?=[\u0600-\u06FF]{3,})/g, "Ø§Ù„");
  res = res.replace(/^(?:ÙˆÙƒ|ÙÙƒ|ÙˆØ¨|ÙØ¨|Ùƒ|Ø¨|Ù|Ùˆ)(?=Ø§Ù„[\u0600-\u06FF]{3,})/g, "");

  // 6. Normalization of common OCR mangles, root truncation, or indefinites
  if (res.includes("Ø§Ù„ÙØ§Ø¡Ø©") || res.includes("ÙØ§Ø¡Ø©")) {
    res = res.replace(/Ø§Ù„ÙØ§Ø¡Ø©/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø©").replace(/\bÙØ§Ø¡Ø©\b/g, "ÙƒÙØ§Ø¡Ø©");
  }
  if (res === "ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©" || res === "ÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©" || res === "Ø§Ù„ÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©" || res === "ÙƒÙØ§Ø¡Ø© Ø¨Ø´Ø±ÙŠØ©") {
    res = "Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©";
  }
  if (res === "Ù†Ø¸Ø±ÙŠØ© Ø§ØªØ·Ø¨ÙŠÙ‚ÙŠØ© Ù„Ù„ÙØ¹Ù„" || res === "Ù†Ø¸Ø±ÙŠØ© ØªØ·Ø¨ÙŠÙ‚ÙŠØ© Ù„Ù„ÙØ¹Ù„" || res === "Ø§ØªØ·Ø¨ÙŠÙ‚ÙŠØ© Ù„Ù„ÙØ¹Ù„") {
    res = "Ø§Ù„Ù†Ø¸Ø±ÙŠØ© Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ÙŠØ© Ù„Ù„ÙØ¹Ù„";
  }
  if (res.includes("Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø±") || res.includes("Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©") || res.includes("Ø¢Ù„Ø¸ÙˆØ¢Ù‡Ø±") || res.includes("Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©")) {
    res = res
      .replace(/Ø¢Ù„Ø¸ÙˆØ¢Ù‡Ø±|Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø±/g, "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø±")
      .replace(/Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø¢Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©/g, "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©");
  }

  let cleaned = res.replace(/^["'Â«Â»\sâ€“â€”:-]+|["'Â«Â»\sâ€“â€”:-]+$/g, "").trim();
  // Balance missing closing or opening parentheses
  if (cleaned.includes("(") && !cleaned.includes(")")) {
    cleaned = cleaned + ")";
  } else if (cleaned.includes(")") && !cleaned.includes("(")) {
    cleaned = "(" + cleaned;
  }
  return cleaned;
}

/**
 * Comprehensive spellchecker and word repair function.
 * Repairs OCR typos, truncated words, missing final letters, and mangled file names across all outputs.
 */
export function spellcheckAndRepairArabicAndEnglishText(text: string): string {
  if (!text) return "";
  let res = text;

  // 1. Repair truncated English words & filenames
  const englishRepairs: [RegExp, string][] = [
    [/\bPerspectiv\b/gi, "Perspective"],
    [/\bPerspecti\b/gi, "Perspective"],
    [/\bTranslati\b/gi, "Translation"],
    [/\bMachi\b/gi, "Machine"],
    [/\bTechnolog\b/gi, "Technology"],
    [/\bEvaluat\b/gi, "Evaluating"],
    [/\bCompetenc\b/gi, "Competence"],
    [/\bIntelligibilit\b/gi, "Intelligibility"],
    [/\bAgenc\b/gi, "Agency"],
  ];
  for (const [pattern, replacement] of englishRepairs) {
    res = res.replace(pattern, replacement);
  }

  // 2. Collapse spaced OCR letters and normalize Arabic text
  res = collapseSpacedArabicLetters(res);
  res = normalizeArabicText(res);

  // 3. Fix standalone particle loops & OCR phrases
  res = res.replace(/(?<![\u0600-\u06FF])(?:ÙƒØ§Ù„Ùƒ|Ø§Ù„Ùƒ|Ùƒ)*Ø§Ù„ÙØ§Ø¡Ø©\s+Ø§Ù„Ø¨Ø´Ø±ÙŠØ©(?![Ø§-ÙŠ])/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©");
  res = res.replace(/(?<![\u0600-\u06FF])(?:ÙƒØ§Ù„Ùƒ|Ø§Ù„Ùƒ|Ùƒ)*ÙƒÙØ§Ø¡Ø©\s+Ø§Ù„Ø¨Ø´Ø±ÙŠØ©(?![Ø§-ÙŠ])/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©");
  res = res.replace(/(?<![\u0600-\u06FF])Ø§Ù„ÙØ§Ø¡Ø©\s+Ø§Ù„Ø¨Ø´Ø±ÙŠØ©(?![Ø§-ÙŠ])/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©");
  res = res.replace(/(?<![\u0600-\u06FF])Ø§Ù„ÙØ§Ø¡Ø©(?![Ø§-ÙŠ])/g, "Ø§Ù„ÙƒÙØ§Ø¡Ø©");
  res = res.replace(/(?<![\u0600-\u06FF])Ù†Ø¸Ø±ÙŠØ©\s+Ø§ØªØ·Ø¨ÙŠÙ‚ÙŠØ©(\s+Ù„Ù„ÙØ¹Ù„)?(?![Ø§-ÙŠ])/g, "Ø§Ù„Ù†Ø¸Ø±ÙŠØ© Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ÙŠØ©$1");
  res = res.replace(/(?<![\u0600-\u06FF])Ø§ØªØ·Ø¨ÙŠÙ‚ÙŠØ©(?![Ø§-ÙŠ])/g, "Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ÙŠØ©");
  res = res.replace(/Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø±\s+(Ø¢Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©)/g, "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©");
  res = res.replace(/Ø§Ù„Ø¸ÙˆØ§Ù‡Ø±\s+(Ø¢Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©)/g, "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©");
  res = res.replace(/Ø§Ù„Ø¸ÙˆØ¢Ù‡Ø±/g, "Ø§Ù„Ø¸ÙˆØ§Ù‡Ø±");
  res = res.replace(/(Ø¢Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø¢Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØ¹Ù„ÙŠÙ…ÙŠØ©|Ø§Ù„ØªØªØªØ¹Ù„ÙŠÙ…ÙŠØ©)/g, "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©");

  // 4. Additional phrase repairs using Arabic word boundaries
  const phraseRepairs: [RegExp, string][] = [
    [/(?<![\u0600-\u06FF])ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©(?![\u0600-\u06FF])/g, "Ø§Ù„Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©"],
    [/(?<![\u0600-\u06FF])Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©(?![\u0600-\u06FF])/g, "Ø§Ù„Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©"],
    [/(?<![\u0600-\u06FF])Ø§Ù„Ø¢Ù„ÙŠÙŠØ©(?![\u0600-\u06FF])/g, "Ø§Ù„Ø¢Ù„ÙŠØ©"],
    [/(?<![\u0600-\u06FF])Ø§Ù„Ø¥ØµØ·Ù†Ø§Ø¹ÙŠ(?![\u0600-\u06FF])/g, "Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ"],
    [/(?<![\u0600-\u06FF])Ø£ÙˆØªÙˆÙ…Ø§ØªÙŠ(?![\u0600-\u06FF])/g, "Ø£ÙˆØªÙˆÙ…Ø§ØªÙŠÙƒÙŠ"],
    [/(?<![\u0600-\u06FF])ØªØ±Ø¬Ù…Ø© Ø¢Ù„ÙŠ(?![\u0600-\u06FF])/g, "ØªØ±Ø¬Ù…Ø© Ø¢Ù„ÙŠØ©"],
    [/(?<![\u0600-\u06FF])ØªÙˆØµÙŠØ© Ù…Ø³ØªÙ†Ø¯(?![\u0600-\u06FF])/g, "ØªÙˆØµÙŠØ© Ù…Ø³ØªÙ†Ø¯Ø©"],
    [/(?<![\u0600-\u06FF])ÙØ¬ÙˆØ© Ù…Ø¹Ø±ÙÙŠ(?![\u0600-\u06FF])/g, "ÙØ¬ÙˆØ© Ù…Ø¹Ø±ÙÙŠØ©"],
    [/(?<![\u0600-\u06FF])Ø§Ù„Ù…ØªØ±Ø¬Ù…ÙŠ(?![\u0600-\u06FF])/g, "Ø§Ù„Ù…ØªØ±Ø¬Ù…ÙŠÙ†"],
    [/(?<![\u0600-\u06FF])Ø§Ù„Ø¯Ø±Ø§Ø³Ø§(?![\u0600-\u06FF])/g, "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª"],
  ];
  for (const [pattern, replacement] of phraseRepairs) {
    res = res.replace(pattern, replacement);
  }

  // Purge any repeated letter artifacts at word end
  res = res.replace(/Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª{2,}/g, "Ø§Ù„Ø¯Ø±Ø§Ø³Ø§Øª");
  res = res.replace(/(?<=[\u0600-\u06FF])Øª{2,}(?=[\s"').!Â»Â«ØŒ;Ø›:!ØŸ\]]|$)/g, "Øª");

  // 5. Ensure prefix loops are purged
  res = res.replace(/(?:ÙƒØ§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„Ùƒ){2,}/g, "Ø§Ù„Ùƒ");
  res = res.replace(/(?:Ø§Ù„){2,}/g, "Ø§Ù„");

  return res.trim();
}

/**
 * Rigorously cleans, repairs, and validates academic terms and concepts.
 * Rejects sentence fragments, truncated words, OCR bugs, trailing adverbs, or nonsensical strings.
 */
export function cleanAndSanitizeAcademicTerm(
  rawTerm: string,
  rawDraft?: string,
  rawVerified?: string,
  definition?: string
): { term: string; verified_term: string; draft_term: string; isValid: boolean } {
  if (!rawTerm && !rawVerified && !rawDraft) {
    return { term: "", verified_term: "", draft_term: "", isValid: false };
  }

  let termEng = (rawTerm || "").trim();
  let termAr = normalizeArabicText(rawVerified || rawDraft || rawTerm || "").trim();

  // 1. Strip dangling prepositional particles and trailing numbers/citations
  termAr = stripArabicParticlesAndNumbers(termAr);

  // 2. Spellcheck & repair words
  termEng = spellcheckAndRepairArabicAndEnglishText(termEng);
  termAr = spellcheckAndRepairArabicAndEnglishText(termAr);

  // 3. Re-apply particle stripping on final term string
  termAr = stripArabicParticlesAndNumbers(termAr);

  // Reject nonsensical/gibberish terms
  const nonsensicalList = [
    "ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©",
    "Ø¥Ø´ÙƒØ§Ù„ÙŠØ© Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©",
    "ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø¥Ø´ÙƒØ§Ù„ÙŠØ©",
    "Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„ÙŠØ©",
    "Ø®ØµÙˆØµØ§",
    "Ø®Ø§ØµØ©",
    "Ù…Ø³ØªÙ†Ø¯ Ù…Ø±ÙÙ‚",
  ];
  if (nonsensicalList.some(ns => termAr.includes(ns) || termAr === ns)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 4. Reject if term still contains internal punctuation (numbers are now allowed in academic terms)
  if (/[,ØŒ;Ø›:!?ØŸ]/.test(termAr) || /[,;:!?]/.test(termEng)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 5. Ensure word count bounds (Concepts are nominal phrases of 1 to 4 words max)
  const arWords = termAr.split(/\s+/).filter(Boolean);
  const engWords = termEng.split(/\s+/).filter(Boolean);
  // Concepts are nominal phrases of 1 to 5 words max
  if (arWords.length > 5 || (termEng && engWords.length > 6)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 6. Check if term matches SCHOLARLY_CONCEPTS_REGISTRY (English key or Arabic phrase)
  const lowerEng = termEng.toLowerCase();
  for (const [key, meta] of Object.entries(SCHOLARLY_CONCEPTS_REGISTRY)) {
    if (lowerEng === key || termAr === meta.ar || areTermsEquivalent(termAr, meta.ar) || lowerEng.includes(key) || key.includes(lowerEng)) {
      termEng = key;
      termAr = meta.ar;
      break;
    }
  }

  // If termAr lacks Arabic characters, attempt word-level translation via ACADEMIC_TERMS_MAP
  if (!/[\u0600-\u06FF]/.test(termAr) && termEng) {
    const wordTranslations = termEng
      .toLowerCase()
      .split(/\s+/)
      .map((w) => ACADEMIC_TERMS_MAP[w] || w)
      .filter(Boolean);
    const hasArabicWord = wordTranslations.some((w) => /[\u0600-\u06FF]/.test(w));
    if (hasArabicWord) {
      termAr = wordTranslations.join(" ");
    }
  }

  // STRICT ARABIC REQUIREMENT: All concepts must be presented in professional Arabic.
  // If verified_term lacks Arabic characters, attempt direct translation or reject.
  const hasArabic = /[\u0600-\u06FF]/.test(termAr);
  if (!hasArabic) {
    // Try translation lookup from ACADEMIC_TERMS_MAP or registry
    const translated = termEng.split(" ").map(w => ACADEMIC_TERMS_MAP[w.toLowerCase()] || "").join(" ").trim();
    if (translated.length >= 3) {
      termAr = translated;
    } else {
      return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
    }
  }

  // 7. Final trivial/citation check
  if (isTrivialOrCitationTerm(termEng, definition) || isTrivialOrCitationTerm(termAr, definition)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 8. Consistency rule: every concept model carries BOTH an Arabic rendering and an authentic
  // English rendering, even if the source text only supplied Arabic. `term` (the English/key
  // shown as the secondary badge) must never be Arabic-only.
  const termEngIsLatin = termEng && !/[\u0600-\u06FF]/.test(termEng);
  const finalEnglish = termEngIsLatin
    ? termEng
    : resolveAuthenticEnglish(termAr || termEng);

  return {
    term: finalEnglish || termAr,
    verified_term: termAr,
    draft_term: termAr,
    isValid: termAr.length >= 3 && termAr.length <= 60 && /[\u0600-\u06FF]/.test(termAr),
  };
}


// Source/project-agnostic English resolution for an Arabic scholarly term. This deliberately carries
// NO curated term database so nothing baked into the engine can bias future work toward any
// discipline. It only ever PRESERVES an English/Latin rendering that already exists in the term
// (from the AI extraction or the source document); it never invents or supplies one from a table.
// When the extraction supplies no English, the term simply stays Arabic-only rather than being
// fabricated from a fixed list.
function resolveAuthenticEnglish(arabicTerm: string): string {
  const ar = String(arabicTerm || "").trim();
  if (!ar) return "";
  // Preserve any authentic Latin/English already present in the term string.
  const latin = ar.match(/[A-Za-z][A-Za-z0-9 &'’_\-()\/.·]*/);
  if (latin && latin[0].trim().length >= 2) {
    return latin[0].trim()
      .split(/\s+/)
      .filter((w) => /[A-Za-z]/.test(w))
      .map((w) => (w && w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return "";
}


// Authoritative dictionary of genuine scholarly theoretical concepts, frameworks, and methodological paradigms
export interface ScholarlyConceptMeta {
  ar: string;
  def: string;
}

export const SCHOLARLY_CONCEPTS_REGISTRY: Record<string, ScholarlyConceptMeta> = {
  // Purged to ensure project isolation.
  // Concepts are now dynamically extracted from the active source text only.
};

// Translation dictionary for common academic terms (backward compatible map)
export const ACADEMIC_TERMS_MAP: Record<string, string> = Object.entries(SCHOLARLY_CONCEPTS_REGISTRY).reduce(
  (acc, [key, val]) => ({ ...acc, [key]: val.ar }),
  {} as Record<string, string>
);

// Check whether two term strings denote the exact same underlying scholarly concept
export function areTermsEquivalent(termA: string, termB: string): boolean {
  if (!termA || !termB) return false;
  const cleanStr = (s: string) =>
    normalizeArabicText(s)
      .replace(/[-â€“_ØŒ.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const a = cleanStr(termA);
  const b = cleanStr(termB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Registry-based equivalence check (if registry is populated)
  const registryEntries = Object.entries(SCHOLARLY_CONCEPTS_REGISTRY);
  if (registryEntries.length > 0) {
    for (const [engKey, meta] of registryEntries) {
      const keyClean = cleanStr(engKey);
      const arClean = cleanStr(meta.ar);
      const isAMatch = a === keyClean || a === arClean;
      const isBMatch = b === keyClean || b === arClean;
      if (isAMatch && isBMatch) {
        return true;
      }
    }
  }

  // Fallback to substring match for cross-language equivalence if one is a subset of the other
  return a.includes(b) || b.includes(a);
}


/**
 * Strips out bibliographic noise (URLs, DOIs, ISSNs, email addresses, volume/issue metadata, raw HTML fragments)
 * and ensures clean, uninterrupted Arabic prose.
 */
export function cleanBibliographicClutterAndNormalizeArabic(text?: string): string {
  if (!text) return "";
  let cleaned = text;

  // Remove URLs & DOIs
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/gi, "");
  cleaned = cleaned.replace(/(http:\/\/)?dx\.doi\.org\/[^\s)]+/gi, "");
  cleaned = cleaned.replace(/\bDOI:\s*[^\s)]+/gi, "");

  // Remove ISSNs & ISBNs & emails
  cleaned = cleaned.replace(/\b(p-|e-)?ISSN:\s*[\d-]+\b/gi, "");
  cleaned = cleaned.replace(/\bISBN:\s*[\d-]+\b/gi, "");
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, "");

  // Remove journal volume/issue headers & raw citation metadata
  cleaned = cleaned.replace(/BUC Press House[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Global Language Review[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Journal of Arts and Linguistics[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Les Annales de lâ€™universitÃ©[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Volume\s*\d+\s*Issue\s*\(\d+\)[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Tome\s*(I|II|III|IV)\s*\/\s*\d+[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Citation:\s*[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Auteur correspondant\s*:[^.\n]*/gi, "");
  cleaned = cleaned.replace(/Online Academic Journal[^.\n]*/gi, "");

  // Remove raw HTML tags or malformed tag artifacts (e.g., span<>/br<pdf or <span style=...>)
  cleaned = cleaned.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/span<>\/br<[^\n]*/gi, " ");
  cleaned = cleaned.replace(/style="[^"]*"/gi, " ");

  // Remove bullet symbols or bizarre punctuation dumps
  cleaned = cleaned.replace(/[ï‚§â€¢\uF0A7\u25CF]/g, " ");
  cleaned = cleaned.replace(/[:|#]{2,}/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return normalizeArabicText(cleaned);
}

/**
 * Synthesizes a pure Arabic analytical summary from a title and document content.
 * Translates English/Latin titles into Arabic concepts and avoids raw quote dumps.
 */
export function synthesizeArabicSummaryFromTitleAndContent(cleanTitle: string, content?: string): string {
  let arabicTitle = cleanTitle;

  // Translate / map common English title terms into Arabic, including mixed Arabic/Latin titles.
  {
    let mapped = cleanTitle.toLowerCase();
    const mappings: [RegExp, string][] = [
      // Project-specific mappings removed for strict project isolation.
      // Generic academic terms can be added here if needed.
    ];

    mappings.forEach(([rgx, ar]) => {
      mapped = mapped.replace(rgx, ar);
    });

    // Clean up leftover punctuation and filler
    mapped = mapped
      .replace(/\b(?:pdf|docx?|txt)\b/gi, "")
      .replace(/[._\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/[\u0600-\u06FF]/.test(mapped) && mapped.length > 5) {
      arabicTitle = mapped;
    } else {
      arabicTitle = `Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„ØªØ®ØµØµÙŠ Ù„Ù…Ø³ØªÙ†Ø¯ "${cleanTitle}"`;
    }
  }

  // Extract pure Arabic sentences from content if content has Arabic text
  let contentHighlights = "";
  if (content && content.trim().length > 30) {
    const cleanContent = cleanBibliographicClutterAndNormalizeArabic(content.trim());
    const arabicLines = cleanContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 25 && /[\u0600-\u06FF]/.test(l) && !/^[0-9\s\-.]+$/.test(l));

    if (arabicLines.length > 0) {
      contentHighlights = arabicLines.slice(0, 2).join(" ").substring(0, 250);
    }
  }

  if (contentHighlights && contentHighlights.length > 30) {
    return `ØªØ³ØªØ¹Ø±Ø¶ Ù‡Ø°Ù‡ Ø§Ù„Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„Ø§Ù‹ Ù…ØªØ®ØµØµØ§Ù‹ ÙˆØ­Ù‚Ù„ÙŠØ§Ù‹ Ø­ÙˆÙ„ ${arabicTitle}ØŒ Ù…Ø³Ù„Ø·Ø© Ø§Ù„Ø¶ÙˆØ¡ Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© ÙˆØ§Ù„Ù…Ø¹Ø·ÙŠØ§Øª Ø§Ù„Ù…ÙŠØ¯Ø§Ù†ÙŠØ© Ø§Ù„Ù…Ø¯Ø±ÙˆØ³Ø©. ÙˆÙ…Ù† Ø£Ø¨Ø±Ø² Ø§Ù„Ù†ØªØ§Ø¦Ø¬ ÙˆØ§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ÙˆØ§Ø±Ø¯Ø©: ${contentHighlights}.`;
  }

  return `ÙŠÙ‚ØªØµØ± Ù‡Ø°Ø§ Ø§Ù„ÙˆØµÙ Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† ÙˆØ§Ù„Ù†Øµ Ø§Ù„Ù…ØªØ§Ø­ÙŠÙ† Ù…Ù† Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø­Ø§Ù„ÙŠØŒ ÙˆÙŠØ¹Ø±Ø¶ Ù…ÙˆØ¶ÙˆØ¹Ù‡ Ø¯ÙˆÙ† Ø¥Ø¶Ø§ÙØ© Ù…Ø¬Ø§Ù„ Ø£Ùˆ Ù„ØºØ© Ø£Ùˆ Ø³ÙŠØ§Ù‚ ØºÙŠØ± Ù…Ø«Ø¨Øª ÙÙŠ Ø§Ù„Ù…Ø³ØªÙ†Ø¯: ${arabicTitle}.`;
}

/**
 * Ensures a summary is strictly informative, document-specific, and normalized in Arabic.
 * Never returns raw verbatim English/foreign quote dumps or generic repetitive boilerplate.
 */
/**
 * Repairs summaries produced by older prompt versions when they contain generic
 * language/domain claims not supported by the current source text.
 */
function isGenericSourceSummary(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /^(?:ÙŠÙ‚ØªØµØ± Ù‡Ø°Ø§ Ø§Ù„ÙˆØµÙ|Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„ØªØ®ØµØµÙŠ Ù„Ù…Ø³ØªÙ†Ø¯|ØªØ³ØªØ¹Ø±Ø¶ Ù‡Ø°Ù‡ Ø§Ù„Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„Ø§Ù‹ Ù…ØªØ®ØµØµØ§Ù‹|ØªØ³ØªØ¹Ø±Ø¶ Ù‡Ø°Ù‡ Ø§Ù„Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„Ø§Ù‹|ÙŠÙ‚Ø¯Ù… Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„ÙŠØ© Ø±ØµÙŠÙ†Ø©)/i.test(normalized)
    || /Ø¯ÙˆÙ† Ø¥Ø¶Ø§ÙØ© Ù…Ø¬Ø§Ù„ Ø£Ùˆ Ù„ØºØ© Ø£Ùˆ Ø³ÙŠØ§Ù‚ ØºÙŠØ± Ù…Ø«Ø¨Øª/i.test(normalized)
    || /Ù„Ø§ ÙŠØªÙˆÙØ± ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù…ØµØ¯Ø± Ù…Ù„Ø®Øµ/i.test(normalized);
}

export function sanitizeSourceSummary(summary?: string, title?: string, content?: string): string {
  const rawSummary = String(summary || "").trim();
  const sourceText = `${title || ""} ${content || ""}`;
  const sourceMentionsArabic = /Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©|Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„ÙØµØ­Ù‰|arabic language/i.test(sourceText);
  const legacyGeneric = /Ø§Ù„Ù…Ù…Ø§Ø±Ø³Ø§Øª Ø§Ù„Ø³ÙŠØ§Ù‚ÙŠØ©.*(?:Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©|Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„ÙØµØ­Ù‰)|Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©.*(?:Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©|Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„ÙØµØ­Ù‰)|ØµÙŠØ§ØºØ©.*(?:Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©|Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„ÙØµØ­Ù‰)/i.test(rawSummary);
  if ((legacyGeneric || isGenericSourceSummary(rawSummary)) && !sourceMentionsArabic) {
    const regenerated = ensureArabicSummary("", title, content);
    return isGenericSourceSummary(regenerated) ? "" : regenerated;
  }
  const cleaned = ensureArabicSummary(rawSummary, title, content);
  return isGenericSourceSummary(cleaned) ? "" : cleaned;
}

export function ensureArabicSummary(summary?: string, title?: string, content?: string): string {
  const cleanTitle = normalizeArabicText(title || "Ø§Ù„Ù…Ø³ØªÙ†Ø¯ Ø§Ù„Ù…Ø±ÙÙ‚")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s+(?:pdf|docx?|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. If summary exists, strip any raw non-Arabic verbatim quotes or boilerplate headers
  if (summary && summary.trim().length > 15) {
    let cleanSum = summary.trim()
      .replace(/^Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ø§Ù„Ø¹Ù„Ù…ÙŠØ©\s*\(Ø¬\)\s*:\s*\*\*/i, "")
      .replace(/^\*\*\s*/, "")
      .replace(/ÙŠÙ‚Ø¯Ù… Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ Ø¯Ø±Ø§Ø³Ø© ØªØ­Ù„ÙŠÙ„ÙŠØ© Ø±ØµÙŠÙ†Ø© ØªØªÙ†Ø§ÙˆÙ„ Ù…ÙˆØ¶ÙˆØ¹ \([^)]*\)/g, "")
      .replace(/ØªÙ†Ø§Ù‚Ø´ Ù…ÙˆØ¶ÙˆØ¹ \([^)]*\)/g, "")
      .replace(/ØªÙ†Ø§Ù‚Ø´ Ù…ÙˆØ¶ÙˆØ¹/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠ ÙˆØ§Ù„Ø£Ù…Ù†ÙŠ Ø§Ù„Ù…Ø­Ø¯Ø¯ ÙÙŠ Ø§Ù„Ø¯Ø±Ø§Ø³Ø©/g, "")
      .trim();

    cleanSum = cleanBibliographicClutterAndNormalizeArabic(cleanSum);

    // Strip out long verbatim English/Latin quotes inside summary
    cleanSum = cleanSum.replace(/:\s*[A-Za-z0-9\s.,'â€™"()\-\/]{20,}\.\.\./g, ".");
    cleanSum = cleanSum.replace(/[A-Za-z0-9\s.,'â€™"()\-\/]{35,}/g, "").trim();
    cleanSum = cleanSum.replace(/:\s*$/g, ".").trim();

    // Remove any leftover empty brackets or orphaned "ØªÙ†Ø§Ù‚Ø´ Ù…ÙˆØ¶ÙˆØ¹"
    cleanSum = cleanSum.replace(/ØªÙ†Ø§Ù‚Ø´\s+Ù…ÙˆØ¶ÙˆØ¹\s*\.?/g, "").replace(/\(\s*\)/g, "").trim();

    const arabicCharCount = (cleanSum.match(/[\u0600-\u06FF]/g) || []).length;
    if (cleanSum.length > 25 && arabicCharCount > 15 && !isGenericSourceSummary(cleanSum)) {
      return cleanSum;
    }
  }

  // 3. Fallback to synthesized Arabic summary
  return synthesizeArabicSummaryFromTitleAndContent(cleanTitle, content);
}

/**
 * Extracts 2 to 3 concepts and terms strictly relating to the provided text/document.
 * Eliminates all title headers, page numbers, duplicates, and non-theoretical phrases.
 */
export function extractFallbackTermsFromText(text: string, sourceId?: string, title?: string): GlossaryTerm[] {
  if ((!text || text.trim().length < 5) && (!title || title.trim().length < 3)) {
    return [];
  }

  const cleanText = text || "";
  const searchScope = `${title || ""} ${cleanText}`.toLowerCase();
  const extracted: GlossaryTerm[] = [];

  const isAlreadyPresent = (rawTerm: string, arabicTerm: string, list?: GlossaryTerm[]) => {
    if (!list || list.length === 0) return false;
    return list.some((ex) => {
      const exEng = ex.term || "";
      const exAr = ex.verified_term || ex.transliteration || ex.draft_term || "";
      return (
        areTermsEquivalent(exEng, rawTerm) ||
        areTermsEquivalent(exAr, arabicTerm || rawTerm) ||
        areTermsEquivalent(exEng, arabicTerm || rawTerm) ||
        areTermsEquivalent(exAr, rawTerm) ||
        rawTerm.trim().toLowerCase() === exEng.trim().toLowerCase() ||
        (arabicTerm && arabicTerm.trim().toLowerCase() === exAr.trim().toLowerCase())
      );
    });
  };

  const addTerm = (rawTerm: string, arabicTerm?: string, customDef?: string) => {
    // Limit extraction per source to ensure merit-based selection (up to 6 per source)
    if (extracted.length >= 6) return;
    const termClean = rawTerm.trim();
    if (!termClean) return;

    let verifiedArabic = arabicTerm;
    let authoritativeDef = customDef;

    // Look up in scholarly concepts registry (now strictly dynamic)
    const registryKey = termClean.toLowerCase();
    const registryEntry = SCHOLARLY_CONCEPTS_REGISTRY[registryKey];
    if (registryEntry) {
      verifiedArabic = registryEntry.ar;
      authoritativeDef = registryEntry.def;
    } else if (!verifiedArabic) {
      if (/[\u0600-\u06FF]/.test(termClean)) {
        verifiedArabic = termClean;
      } else {
        // Only use mapping for very common academic structures if needed, 
        // but prefer raw term for merit-based extraction.
        verifiedArabic = termClean;
      }
    }

    const sanitized = cleanAndSanitizeAcademicTerm(termClean, verifiedArabic, verifiedArabic, authoritativeDef);
    if (!sanitized.isValid) return;

    const finalEng = sanitized.term;
    const cleanAr = sanitized.verified_term;

    if (isTrivialOrCitationTerm(finalEng, authoritativeDef) || isTrivialOrCitationTerm(cleanAr, authoritativeDef)) {
      return;
    }

    // Duplicate check strictly within the current source's extraction batch.
    if (isAlreadyPresent(finalEng, cleanAr, extracted)) {
      return;
    }

    const cleanDef = normalizeArabicText(authoritativeDef || buildContextDefinition(finalEng, cleanText, cleanAr));

    // Never ship a concept we cannot ground in a commonly accepted scholarly
    // definition. Fabricated or empty definitions mean the concept is dropped.
    if (!cleanDef || isFabricatedOrUnscholarlyDefinition(cleanDef)) {
      return;
    }

    // Final safety check against numbers or page ranges in definition
    if (/[0-9]{3,}/.test(cleanDef) || cleanDef.includes("Ø¬Ø§Ù…Ø¹Ø©") || cleanDef.includes("Ø£Ù†Ù…ÙˆØ°Ø¬Ø§")) {
      return;
    }

    extracted.push({
      term: finalEng,
      transliteration: cleanAr,
      draft_term: cleanAr,
      verified_term: cleanAr,
      definition: cleanDef,
      sourceId
    });
  };

  // 1. Scan for authentic multi-word noun phrase concepts ending in established academic suffixes
  // This ensures terms are merit-based and derived directly from the source text.
  if (/[a-zA-Z]/.test(cleanText)) {
    // Capture document-specific concepts (Proper Case phrases of 2-4 words)
    // Examples: "Westphalian Sovereignty", "International Relations Theory", "Hegemony Paradigm"
    const authenticConceptRegex = /\b[A-Z][a-z\-']*(?:\s+[A-Z][a-z\-']*){1,3}\b/g;
    let match;
    while ((match = authenticConceptRegex.exec(cleanText)) !== null && extracted.length < 6) {
      const candidate = match[0].trim();
      if (candidate.length > 6 && !isTrivialOrCitationTerm(candidate)) {
        addTerm(candidate);
      }
    }
  }

  // 2. Scan for authentic Arabic noun phrases and thematic constructs directly from text.
  // Anchored to real definitional/framing contexts ("Ù…ÙÙ‡ÙˆÙ… X", "Ù†Ø¸Ø±ÙŠØ© X", quoted terms) AND
  // genuine definite noun-adjective compounds, so the fallback never mints bogus compounds
  // like "Ø§Ù„Ø¹Ø¯Ø¯ Ù†ÙˆÙÙ…Ø¨Ø±", "Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ© ØªØ§Ø±ÙŠØ®", or "Ø§Ù„Ù‚Ø¨ÙˆÙ„ Ø§Ù…Ù„Ù„Ø®Øµ" (all of which pair a definite
  // noun with a NON-definite second word).
  const markerPatterns = [
    // Term introduced by a framing/disciplinary marker, e.g. "Ù…ÙÙ‡ÙˆÙ… Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ø±Ù‚Ù…ÙŠ", "Ù†Ø¸Ø±ÙŠØ© Ø§Ù„ØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ø°Ø§ØªÙŠ",
    // "Ù…ØµØ·Ù„Ø­ Ø§Ù„ØªØ±Ø¬Ù…Ø© Ø§Ù„Ø¢Ù„ÙŠØ©", "Ù…ØªØºÙŠØ± Ø§Ù„ØªØ­ØµÙŠÙ„ Ø§Ù„Ø£ÙƒØ§Ø¯ÙŠÙ…ÙŠ". Word tokens may be 2+ chars so genuine
    // concepts containing short prepositions (e.g. "Ø§Ù„ØªØ¹Ù„Ù… Ø¹Ù† Ø¨Ø¹Ø¯") are captured.
    /(?:Ù…ÙÙ‡ÙˆÙ…|Ù…ØµØ·Ù„Ø­|Ù†Ø¸Ø±ÙŠØ©|Ù†Ù…ÙˆØ°Ø¬|Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©|Ø¸Ø§Ù‡Ø±Ø©|Ù…ØªØºÙŠØ±|Ù…Ù†Ù‡Ø¬|Ù…Ø¯Ø®Ù„|Ø¥Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©)\s+([\u0600-\u06FF]{2,35}(?:\s+[\u0600-\u06FF]{2,30}){0,3})/g,
    // Term or definition framed by "(...)" parens, e.g. "(Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ù…Ø¯Ù…Ø¬)"
    /\(([\u0600-\u06FF]{2,50}(?:\s+[\u0600-\u06FF]{2,30}){0,3})\)/g,
  ];

  // Arabic connectives/clause markers that terminate a nominal concept so a marker capture
  // like "Ù…ÙÙ‡ÙˆÙ… Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ø±Ù‚Ù…ÙŠ ÙˆÙ…Ø¯Ù‰ ØªØ£Ø«ÙŠØ±Ù‡" is trimmed to "Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ø±Ù‚Ù…ÙŠ".
  // NOTE: bare prepositions (Ø¹Ù†ØŒ ÙÙŠØŒ Ø¹Ù„Ù‰ØŒ Ù…Ù†ØŒ Ø¥Ù„Ù‰) are intentionally NOT boundaries here,
  // because genuine concepts legitimately contain them (e.g. "Ø§Ù„ØªØ¹Ù„Ù… Ø¹Ù† Ø¨Ø¹Ø¯", "Ø§Ù„ØªØ¹Ù„ÙŠÙ… ÙÙŠ ").
  const conceptBoundary = /^(?:Ùˆ|Ø«Ù…|Ø£Ùˆ|Ø¨Ù„|Ù„ÙƒÙ†|Ù…Ø¯Ù‰|Ø£Ù‡Ù…ÙŠØ©|Ù‡Ø°Ø§|Ù‡Ø°Ù‡|Ø§Ù„ØªÙŠ|Ø§Ù„Ø°ÙŠ|Ø§Ù„Ø°ÙŠÙ†|Ø£Ù†|Ø¥Ù†|Ù„ÙƒÙ†|Ù‡Ùˆ|Ù‡ÙŠ|ÙƒØ§Ù†|ÙƒØ§Ù†Øª|ØªØ¹Ø¯|ÙŠØ¹ØªØ¨Ø±|ØªØ¹ØªØ¨Ø±|ÙŠØªÙ…|ØªØªÙ…|ÙŠØ³Ø§Ù‡Ù…|ØªØ³Ø§Ù‡Ù…|ÙŠØ³Ø§Ø¹Ø¯|ØªØ³Ø§Ø¹Ø¯|ÙŠØ¤Ø«Ø±|ØªØ¤Ø«Ø±|ÙŠØ¤Ø¯ÙŠ|ØªØ¤Ø¯ÙŠ|ÙŠÙ…Ø«Ù„|ØªÙ…Ø«Ù„|ÙŠØ´Ù…Ù„|ØªØ´Ù…Ù„|ÙŠØ¹ØªÙ…Ø¯|ØªØ¹ØªÙ…Ø¯|ÙˆÙŠØ¹ØªØ¨Ø±|ÙˆÙŠØ¹ØªÙ…Ø¯|ÙˆÙŠØ¹Ø¯|ÙˆÙŠØ³Ø§Ù‡Ù…|ÙˆÙŠØ³Ø§Ø¹Ø¯|ÙˆÙŠØ¹Ù†ÙŠ|ÙŠØ¹Ù†ÙŠ|ØªÙØ¹Ù†Ù‰|ÙØ§Ø¹Ù„ÙŠØªÙ‡|ÙˆØªØ£Ø«ÙŠØ±|ØªØ£Ø«ÙŠØ±|ÙˆØ£Ø«Ø±|Ø£Ø«Ø±|ÙˆØ¯ÙˆØ±|ÙˆØ¯ÙˆØ±|ÙˆÙ…Ø¯Ù‰|ÙˆØ£Ù‡Ù…ÙŠØ©|Ø¨Ø£Ù†Ù‡|Ø¨Ø£Ù†Ù‡Ø§|Ø¥Ù„Ø§|Ø­ÙŠØ«|Ø¨ÙŠÙ†Ù…Ø§|ÙÙŠÙ…Ø§|Ù„Ø¥Ù†Ø¬Ø§Ø²|Ù„ØªØ­Ù‚ÙŠÙ‚|Ù„ØªØ­Ø³ÙŠÙ†|Ù„ØªÙ†Ù…ÙŠØ©|Ù„ØªÙˆØ¸ÙŠÙ|Ù„ØªØ·ÙˆÙŠØ±|Ù„ØªØ¬ÙˆÙŠØ¯|Ù…ÙØ§Ù‡ÙŠÙ…|Ø£Ù‡Ù…ÙŠØ©|ÙƒØ¢Ù„ÙŠØ©|ÙƒØ£Ø¯Ø§Ø©|ÙƒÙˆØ³ÙŠÙ„Ø©|ÙˆÙƒØ§Ù†|ÙÙ‚Ø¯|Ù…Ø§ÙŠÙˆ|ØªÙˆØ¸ÙŠÙ|Ø¥Ù†Ø¬Ø§Ø²|ØªØ­Ù‚ÙŠÙ‚|ØªØ­Ø³ÙŠÙ†|ØªÙ†Ù…ÙŠØ©|Ø¨Ø¯Ø§ÙŠØ©|Ù…Ø¹ Ø¨Ø¯Ø§ÙŠØ©)/;
  const trimToNominalConcept = (raw: string): string => {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const kept: string[] = [];
    for (const tk of tokens) {
      if (kept.length >= 4) break;
      if (kept.length > 0 && conceptBoundary.test(tk)) break;
      kept.push(tk);
    }
    return kept.join(" ");
  };

  for (const pattern of markerPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleanText)) !== null && extracted.length < 6) {
      const rawCandidate = (match[1] || "").trim();
      if (!rawCandidate) continue;
      const candidate = normalizeArabicText(trimToNominalConcept(rawCandidate))
        .replace(/[ØŒ;Ø›:!?ØŸ.]+(?:\s*[ØŒ;Ø›:!?ØŸ.()]+)*\s*$/g, "").trim();
      if (candidate.length < 5) continue;
      // Require a definite nominal phrase (starts with "Ø§Ù„"), i.e. a genuine academic concept
      // rather than a verb-led or connective fragment.
      const words = candidate.split(/\s+/);
      if (!/^[\u0600-\u06FF]/.test(candidate) || !words[0].startsWith("Ø§Ù„")) continue;
      if (words.length > 1 && /^[ÙˆÙÙƒØ¨Ù„]/.test(words[1])) continue;
      // Reject a candidate that ends with a dangling short preposition ("Ø§Ù„ØªØ¹Ù„Ù… Ø¹Ù†") or a
      // 2-letter particle, which means the framing capture stopped mid-phrase.
      const last = words[words.length - 1];
      if (last.length < 3 || /^(?:Ø¹Ù†|ÙÙŠ|Ù…Ù†|Ø¥Ù„Ù‰|Ø¹Ù„Ù‰|Ù…Ø¹|Ù„Ù‡Ø§|Ù„Ù‡|Ù…Ù†Ù‡|ÙÙŠÙ‡Ø§)$/.test(last)) continue;
      if (isTrivialOrCitationTerm(candidate)) continue;
      addTerm(candidate, candidate, buildContextDefinition(candidate, cleanText, candidate));
    }
  }

  // 2b. Restricted plain-phrase scan. Unlike the old loose 2-word window this ONLY accepts
  // definite noun-adjective compounds (e.g. "Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ù…Ø¯Ù…Ø¬", "Ø§Ù„Ø§Ù†Ø­Ø±Ø§Ù Ø§Ù„Ù…Ø¹ÙŠØ§Ø±ÙŠ") where BOTH
  // immediate words are definite, which is the canonical form of a genuine Arabic academic term.
  // Tokenizing 1+ chars keeps short function words (ÙÙŠØŒ Ù…Ù†ØŒ Ø¹Ù†) as natural separators so definite
  // words from DIFFERENT phrases never collide, and definite function words (Ø§Ù„ØªÙŠØŒ Ø§Ù„Ø°ÙŠ...) are
  // denied as concept heads.
  const arabicWords = cleanText.match(/[\u0600-\u06FF]+/g) || [];
  const denyFreeDefinite = new Set([
    "Ø§Ù„ØªÙŠ", "Ø§Ø®ØªÙŠ", "Ø§Ù„Ø°ÙŠ", "Ø§Ù„Ø°ÙŠÙ†", "Ø§Ù„Ù„Ø°Ø§Ù†", "Ø§Ù„Ù„ØªØ§Ù†", "Ù‡Ø°Ø§", "Ù‡Ø°Ù‡", "Ø°Ù„Ùƒ", "ØªÙ„Ùƒ",
    "Ø§Ù„Ø¯Ø±Ø§Ø³Ø©", "Ø§Ù„Ø¨Ø­Ø«", "Ø§Ù„Ù†ØªØ§Ø¦Ø¬", "Ø§Ù„Ù…Ù‚Ø¯Ù…Ø©", "Ø§Ù„Ø®Ø§ØªÙ…Ø©", "Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹", "Ø§Ù„Ù…ØµØ§Ø¯Ø±", "ÙˆÙƒØ§Ù†",
  ]);
  for (let i = 0; i < arabicWords.length - 1 && extracted.length < 6; i++) {
    const w1 = arabicWords[i];
    const w2 = arabicWords[i + 1];
    // Both immediate words must be definite noun-adjective constructs (Ø§Ù„Ù€ + Ø§Ù„Ù€) and non-trivial.
    if (!w1.startsWith("Ø§Ù„") || !w2.startsWith("Ø§Ù„")) continue;
    if (denyFreeDefinite.has(w1) || denyFreeDefinite.has(w2)) continue;
    if (w1.length > 30 || w2.length > 30) continue;
    const candidate = `${w1} ${w2}`;
    if (candidate.length < 8) continue;
    if (isTrivialOrCitationTerm(candidate)) continue;
    addTerm(candidate, candidate, buildContextDefinition(candidate, cleanText, candidate));
  }

  // 3. If still fewer than 2 terms, use title keywords or first meaningful sentence fragment
  if (extracted.length < 2 && title && title.length > 5) {
    const cleanTitleConcept = title.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    if (cleanTitleConcept.length >= 6 && !isTrivialOrCitationTerm(cleanTitleConcept)) {
      addTerm(cleanTitleConcept, cleanTitleConcept, buildContextDefinition(cleanTitleConcept, cleanText, cleanTitleConcept));
    }
  }

  return extracted;
}

/**
 * Pipeline: sanitize, validate, and repair the raw terms array returned by the LLM.
 * Drops invalid/citation/fragment terms, repairs definitions, and guarantees a minimum
 * number of genuine scholarly concepts per document by topping up from local extraction
 * when the model returns too few.
 */
export function sanitizeAndRepairTermsPipeline(
  rawTerms: any[],
  parsedContent: string = "",
  sourceTitle: string = "",
  minimumTerms: number = 3
): GlossaryTerm[] {
  let cleanedTerms: GlossaryTerm[] = (Array.isArray(rawTerms) ? rawTerms : [])
    .map((t: any) => {
      const sanitized = cleanAndSanitizeAcademicTerm(t?.term, t?.draft_term, t?.verified_term, t?.definition);
      if (!sanitized.isValid) return null;
      if (isTrivialOrCitationTerm(sanitized.term, t?.definition)) return null;
      if (isTrivialOrCitationTerm(sanitized.verified_term, t?.definition)) return null;

      const rawDef =
        t?.definition &&
        !t.definition.includes('""') &&
        !/:\s*""/.test(t.definition) &&
        !t.definition.includes('Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ ÙŠÙÙ‚ØµØ¯ Ø¨Ù‡ ÙÙŠ Ø§Ù„Ù†Øµ: ""') &&
        t.definition.length > 25
          ? t.definition
          : "";

      const cleanDef = normalizeArabicText(
        rawDef || buildContextDefinition(sanitized.term, parsedContent, sanitized.verified_term)
      );

      // A definition that is empty, fabricated, or not grounded in a commonly
      // accepted scholarly rendering means the concept is dropped, never padded.
      if (!cleanDef || isFabricatedOrUnscholarlyDefinition(cleanDef)) {
        return null;
      }

      if (/[0-9]{3,}/.test(cleanDef) || cleanDef.includes("Ø¬Ø§Ù…Ø¹Ø©") || cleanDef.includes("Ø£Ù†Ù…ÙˆØ°Ø¬")) {
        return null;
      }

      return {
        term: sanitized.term,
        transliteration: sanitized.verified_term,
        draft_term: sanitized.draft_term,
        verified_term: sanitized.verified_term,
        definition: cleanDef,
      };
    })
    .filter((t): t is GlossaryTerm => Boolean(t));

  // Guarantee a solid basis of valid scholarly concepts per document.
  if (cleanedTerms.length < minimumTerms && parsedContent.length > 50) {
    const fallbacks = extractFallbackTermsFromText(parsedContent, undefined, sourceTitle).filter(
      (fb) => !cleanedTerms.some((ex) => areTermsEquivalent(ex.term, fb.term) || areTermsEquivalent(ex.verified_term, fb.verified_term))
    );
    for (const fb of fallbacks) {
      if (cleanedTerms.length >= minimumTerms) break;
      cleanedTerms.push(fb);
    }
  }

  return cleanedTerms;
}

/**
 * Rejects a "definition" that is not real words: repeated numbers, repeated
 * letters, stray symbols, or an unreasonable proportion of digits. Corrupted
 * extraction text must never masquerade as a scholarly definition.
 */
export function isGarbledOrOpaqueText(def: string | undefined | null): boolean {
  const t = (def ?? "").trim();
  if (!t) return true;
  // Repeated-run garble: "111111", "xxxxxxx", "<<<<<<", "aaaaaa".
  // Dots are tolerated ("..." occurs in ordinary prose).
  if (/([^.\s])\1{2,}/.test(t.replace(/[\u200C\u200D\s]/g, ""))) {
    return true;
  }
  const body = t.replace(/\s+/g, "");
  if (!body) return true;
  const digitShare = (body.match(/\d/g) || []).length / body.length;
  if (digitShare > 0.25) return true;
  // Anything that is not a letter, numeral, combining mark, dash, bracket,
  // quote, or ordinary punctuation is opaque garble (e.g. "*", "=", "+", "&").
  return /[^\p{L}\p{N}\p{M}\p{Pd}\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Po}\p{Cf}]/u.test(body);
}

/**
 * Rejects a "definition" that is not grounded in a commonly accepted scholarly
 * rendering of the concept: context-quotes, boilerplate filler, or "in this
 * source" framing are fabrications and must never reach the user. A missing or
 * too-short definition is also rejected so callers drop the concept instead of
 * shipping an invented one.
 */
export function isFabricatedOrUnscholarlyDefinition(def: string | undefined | null): boolean {
  if (!def || typeof def !== "string") return true;
  const d = normalizeArabicText(def).trim();
  if (d.length < 25) return true;
  if (isGarbledOrOpaqueText(d)) return true;
  const lower = d.toLowerCase();
  const fabricatedMarkers = [
    "مفهوم يشير في سياق هذا المصدر",
    "مفهوم وإطار تخصصي يشير إلى",
    "في سياق هذا المصدر",
    "يُقصد به في النص",
    "يقصد به في النص",
    "يراد بالمفهوم",
    "مفهوم تحليلي",
  ];
  return fabricatedMarkers.some((m) => lower.includes(m));
}

export function buildContextDefinition(term: string, fullText: string, arabicTerm: string): string {
  const cleanAr = (arabicTerm || term || "").trim();
  const cleanEng = (term || "").toLowerCase().trim();

  // 1. Check SCHOLARLY_CONCEPTS_REGISTRY for exact or fuzzy match
  for (const [key, meta] of Object.entries(SCHOLARLY_CONCEPTS_REGISTRY)) {
    if (cleanEng === key || cleanAr === meta.ar || areTermsEquivalent(cleanAr, meta.ar)) {
      return meta.def;
    }
  }

  // 2. Keyword-driven concept definitions across diverse professional and academic domains
  if (cleanEng.includes("learning management") || cleanEng.includes("lms") || cleanAr.includes("Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ØªØ¹Ù„Ù…") || cleanAr.includes("Ù†Ø¸Ø§Ù… Ø§Ù„ØªØ¹Ù„Ù…") || cleanAr.includes("Ù…Ù†ØµØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ©")) {
    return "Ù…Ù†Ø¸ÙˆÙ…Ø© Ø±Ù‚Ù…ÙŠØ© ÙˆÙ…Ù†ØµØ© Ø¨Ø±Ù…Ø¬ÙŠØ© Ù…ØªÙƒØ§Ù…Ù„Ø© ØªÙØ³ØªØ®Ø¯Ù… Ù„ØªØµÙ…ÙŠÙ… ÙˆØ¥Ø¯Ø§Ø±Ø© ÙˆØªÙˆØµÙŠÙ„ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆØªØªØ¨Ø¹ ØªÙ‚ÙŠÙŠÙ… ÙˆØªÙ‚Ø¯Ù… Ø§Ù„Ù…ØªØ¹Ù„Ù…ÙŠÙ†.";
  }
  if (cleanEng.includes("corporate governance") || cleanEng.includes("strategic management") || cleanEng.includes("governance") || cleanAr.includes("Ø­ÙˆÙƒÙ…Ø©") || cleanAr.includes("Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø£Ø¹Ù…Ø§Ù„") || cleanAr.includes("Ø¥Ø¯Ø§Ø±Ø© Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©")) {
    return "Ù…Ù†Ø¸ÙˆÙ…Ø© Ø§Ù„Ù…Ø¨Ø§Ø¯Ø¦ ÙˆØ§Ù„Ù‚ÙˆØ§Ø¹Ø¯ ÙˆØ§Ù„ØªØ®Ø·ÙŠØ· Ø§Ù„Ù…Ù†Ø¸Ù… Ù„ØªÙˆØ¬ÙŠÙ‡ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ ÙˆØªØ­Ù‚ÙŠÙ‚ Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„ØªØ´ØºÙŠÙ„ÙŠØ© ÙˆØ§Ù„Ù†Ù…Ùˆ Ø§Ù„Ù…Ø¤Ø³Ø³ÙŠ Ø§Ù„Ù…Ø³ØªØ¯Ø§Ù….";
  }
  if (cleanEng.includes("journalism") || cleanEng.includes("media") || cleanEng.includes("framing") || cleanAr.includes("ØµØ­Ø§ÙØ©") || cleanAr.includes("Ø¥Ø¹Ù„Ø§Ù…") || cleanAr.includes("Ø®Ø¨Ø±") || cleanAr.includes("ØªØ£Ø·ÙŠØ±")) {
    return "Ø¥Ø·Ø§Ø± ØªØ­Ù„ÙŠÙ„ÙŠ Ø§ØªØµØ§Ù„ÙŠ ÙŠØ¯Ø±Ø³ Ø¢Ù„ÙŠØ§Øª ØµÙŠØ§ØºØ© Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„Ø¥Ø¹Ù„Ø§Ù…ÙŠØ© ÙˆØªØºØ·ÙŠØ© Ø§Ù„Ø£Ø­Ø¯Ø§Ø« ÙˆÙ†Ù‚Ù„Ù‡Ø§ ÙˆØªØ£Ø«ÙŠØ±Ù‡Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø±Ø£ÙŠ Ø§Ù„Ø¹Ø§Ù… ÙˆØªÙˆØ¬ÙŠÙ‡ Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù….";
  }
  if (cleanEng.includes("literature") || cleanEng.includes("narrative") || cleanEng.includes("criticism") || cleanAr.includes("Ø³Ø±Ø¯") || cleanAr.includes("Ø£Ø¯Ø¨") || cleanAr.includes("Ù†Ù‚Ø¯") || cleanAr.includes("ØªÙ†Ø§Øµ") || cleanAr.includes("ØªØ£ÙˆÙŠÙ„")) {
    return "Ù…Ù†Ù‡Ø¬ Ù†Ù‚Ø¯ÙŠ ÙˆØªØ­Ù„ÙŠÙ„ÙŠ ÙŠØ¹Ù†Ù‰ Ø¨Ø¯Ø±Ø§Ø³Ø© Ø§Ù„Ø¨Ù†Ù‰ Ø§Ù„Ù†ØµÙŠØ© ÙˆØ§Ù„Ø³Ø±Ø¯ÙŠØ© ÙˆØ§Ù„ØªÙØ§Ø¹Ù„Ø§Øª Ø§Ù„Ø¯Ù„Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ø¬Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„ØªØ£ÙˆÙŠÙ„ÙŠØ© ÙÙŠ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ Ø§Ù„Ø£Ø¯Ø¨ÙŠØ©.";
  }
  if (cleanEng.includes("social") || cleanEng.includes("cohesion") || cleanAr.includes("Ø§Ø¬ØªÙ…Ø§Ø¹") || cleanAr.includes("ØªÙ…Ø§Ø³Ùƒ") || cleanAr.includes("Ù…Ø¬ØªÙ…Ø¹ÙŠ")) {
    return "Ù…ÙÙ‡ÙˆÙ… Ø³ÙˆØ³ÙŠÙˆÙ„ÙˆØ¬ÙŠ ÙŠØ¯Ø±Ø³ Ø´Ø¨ÙƒØ§Øª Ø§Ù„Ø±ÙˆØ§Ø¨Ø· ÙˆØ§Ù„ØªØ¶Ø§Ù…Ù† ÙˆØ§Ù„Ø¨Ù†Ù‰ Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠØ© ÙˆØ§Ù„Ù…Ø¤Ø³Ø³ÙŠØ© Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ù„Ù„ØªÙ…Ø§Ø³Ùƒ ÙˆØ§Ù„ØªØ·ÙˆØ± Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ.";
  }
  if (cleanEng.includes("economic") || cleanEng.includes("finance") || cleanAr.includes("Ø§Ù‚ØªØµØ§Ø¯") || cleanAr.includes("ØªÙ…ÙˆÙŠÙ„") || cleanAr.includes("Ø³ÙˆÙ‚") || cleanAr.includes("Ø±ÙŠØ¹")) {
    return "Ø¥Ø·Ø§Ø± ØªØ­Ù„ÙŠÙ„ÙŠ ÙŠØ¯Ø±Ø³ Ø¢Ù„ÙŠØ§Øª Ø¥Ù†ØªØ§Ø¬ ÙˆØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ø³Ù„ÙˆÙƒÙŠØ© ÙˆØ§Ù†Ø¹ÙƒØ§Ø³Ø§ØªÙ‡Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ø³ÙˆØ§Ù‚ ÙˆØ§Ù„ØªÙ†Ù…ÙŠØ©.";
  }
  if (cleanEng.includes("authoritarian") || cleanAr.includes("Ø§Ø³ØªØ¨Ø¯Ø§Ø¯")) {
    return "Ù…ÙÙ‡ÙˆÙ… ØªØ­Ù„ÙŠÙ„ÙŠ ÙŠØ¯Ø±Ø³ Ø§Ù„ØªØ±ØªÙŠØ¨Ø§Øª Ø§Ù„Ù…Ø¤Ø³Ø³ÙŠØ© ÙˆØ§Ù„Ø£Ù…Ù†ÙŠØ© ÙˆØ§Ù„Ù…Ø§Ù„ÙŠØ© Ø§Ù„ØªÙŠ ØªØ¹ØªÙ…Ø¯Ù‡Ø§ Ø§Ù„Ø£Ù†Ø¸Ù…Ø© ØºÙŠØ± Ø§Ù„Ø¯ÙŠÙ…Ù‚Ø±Ø§Ø·ÙŠØ© Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ØªÙ‡Ø¯ÙŠØ¯Ø§Øª ÙˆØ¶Ù…Ø§Ù† Ø§Ù„Ø§Ø³ØªÙ‚Ø±Ø§Ø±.";
  }
  if (cleanEng.includes("war") || cleanEng.includes("warfare") || cleanEng.includes("conflict") || cleanAr.includes("Ø­Ø±Ø¨") || cleanAr.includes("ØµØ±Ø§Ø¹")) {
    return "Ù†Ù…Ø· ØµØ±Ø§Ø¹ Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠ ÙŠØ±ÙƒØ² Ø¹Ù„Ù‰ ØªÙˆØ¸ÙŠÙ Ø§Ù„ØªÙƒØªÙŠÙƒØ§Øª Ø§Ù„Ø¹Ø³ÙƒØ±ÙŠØ© ÙˆØºÙŠØ± Ø§Ù„ØªÙ‚Ù„ÙŠØ¯ÙŠØ© ÙˆØ§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ø³ÙŠØ§Ø³ÙŠØ© Ù„ØªØ­Ù‚ÙŠÙ‚ Ø§Ù„Ø£Ù‡Ø¯Ø§Ù ÙˆØ§Ù„ØªÙˆØ§Ø²Ù†Ø§Øª.";
  }
  if (cleanEng.includes("security") || cleanAr.includes("Ø£Ù…Ù†")) {
    return "Ù…Ù†Ø¸ÙˆÙ…Ø© Ø§Ù„ØªØ±ØªÙŠØ¨Ø§Øª ÙˆØ§Ù„Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ§Øª Ø§Ù„Ù…ØªØ¨Ø¹Ø© Ù„Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ù…ØµØ§Ù„Ø­ Ø§Ù„Ø­ÙŠÙˆÙŠØ© ÙˆØ§Ù„Ø­Ø¯ Ù…Ù† Ø§Ù„ØªÙ‡Ø¯ÙŠØ¯Ø§Øª Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© ÙˆØ§Ù„Ù†Ø§Ø´Ø¦Ø©.";
  }
  if (cleanEng.includes("sovereign") || cleanAr.includes("Ø³ÙŠØ§Ø¯")) {
    return "Ù…Ø¨Ø¯Ø£ Ù‚Ø§Ù†ÙˆÙ†ÙŠ ÙˆØ³ÙŠØ§Ø³ÙŠ Ø£Ø³Ø§Ø³ÙŠ ÙŠØ¤ÙƒØ¯ Ø§Ø³ØªÙ‚Ù„Ø§Ù„ÙŠØ© Ø§Ù„Ø³Ù„Ø·Ø© ÙˆØ­ØµØ±ÙŠØªÙ‡Ø§ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠØ© ÙˆØ§Ù„ØªØ´Ø±ÙŠØ¹ÙŠØ© Ø¯Ø§Ø®Ù„ Ø­Ø¯ÙˆØ¯Ù‡Ø§.";
  }
  if (cleanEng.includes("policy") || cleanAr.includes("Ø³ÙŠØ§Ø³")) {
    return "Ù…Ø¬Ù…ÙˆØ¹Ø© Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª ÙˆØ§Ù„Ù…Ø¨Ø§Ø¯Ø¦ Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ÙŠØ© Ø§Ù„Ù…Ù†Ø¸Ù…Ø© Ù„Ù„ØªÙØ§Ø¹Ù„ ÙˆØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹Ù„Ø§Ù‚Ø§Øª Ø¨ÙŠÙ† Ø§Ù„Ø³Ù„Ø·Ø© ÙˆØ§Ù„ÙØ§Ø¹Ù„ÙŠÙ†.";
  }
  if (cleanAr.includes("ÙƒÙØ§Ø¡Ø© Ø¨Ø´Ø±ÙŠØ©") || cleanAr.includes("Ø§Ù„ÙƒÙØ§Ø¡Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ©")) {
    return "Ù…Ù†Ø¸ÙˆÙ…Ø© Ø§Ù„Ù…Ù‡Ø§Ø±Ø§Øª ÙˆØ§Ù„Ù‚Ø¯Ø±Ø§Øª Ø§Ù„ØªØ­Ù„ÙŠÙ„ÙŠØ© ÙˆØ§Ù„Ø¥Ø¨Ø¯Ø§Ø¹ÙŠØ© Ø§Ù„ØªÙŠ ÙŠØªÙÙˆÙ‚ Ø¨Ù‡Ø§ Ø§Ù„Ø¹Ù†ØµØ± Ø§Ù„Ø¨Ø´Ø±ÙŠ ÙÙŠ Ø§ØªØ®Ø§Ø° Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª ÙˆØ­Ù„ Ø§Ù„Ù…Ø´ÙƒÙ„Ø§Øª Ø§Ù„Ù…Ø¹Ù‚Ø¯Ø© Ù…Ù‚Ø§Ø±Ù†Ø© Ø¨Ø§Ù„Ø£Ù†Ø¸Ù…Ø© Ø§Ù„Ø¢Ù„ÙŠØ©.";
  }
  if (cleanAr.includes("Ù†Ø¸Ø±ÙŠØ©") && (cleanAr.includes("ØªØ·Ø¨ÙŠÙ‚ÙŠØ©") || cleanAr.includes("ÙØ¹Ù„"))) {
    return "Ø¥Ø·Ø§Ø± ØªØ­Ù„ÙŠÙ„ÙŠ ÙˆÙ…Ù†Ù‡Ø¬ÙŠ ÙŠØ¯Ø±Ø³ Ø§Ù„Ù…Ù…Ø§Ø±Ø³Ø§Øª ÙˆØ§Ù„Ø£ÙØ¹Ø§Ù„ ÙÙŠ Ø¨ÙŠØ¦ØªÙ‡Ø§ Ø§Ù„Ù…ÙŠØ¯Ø§Ù†ÙŠØ©ØŒ Ù…ÙˆØ¬Ù‡Ø§Ù‹ Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠØ© Ù†Ø­Ùˆ Ø§Ù„Ø§Ø³ØªØ¬Ø§Ø¨Ø© Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ù.";
  }
  if (cleanAr.includes("ØªØ±Ø¬Ù…Ø©") || cleanAr.includes("Ù…ØªØ±Ø¬Ù…")) {
    return "Ø¹Ù…Ù„ÙŠØ© Ù†Ù‚Ù„ Ø¯Ù„Ø§Ù„ÙŠ ÙˆØ«Ù‚Ø§ÙÙŠ ÙˆÙˆØ¸ÙŠÙÙŠ Ù„Ù„Ù†ØµÙˆØµ Ø¨ÙŠÙ† Ø§Ù„Ù„ØºØ§Øª Ù…Ø¹ Ù…Ø±Ø§Ø¹Ø§Ø© Ø§Ù„Ù…Ù‚Ø§ØµØ¯ Ø§Ù„ØªÙˆØ§ØµÙ„ÙŠØ© ÙˆØ®ØµÙˆØµÙŠØ§Øª Ø§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„Ù‡Ø¯Ù.";
  }
  if (cleanAr.includes("ØªØ¹Ù„ÙŠÙ…ÙŠØ©") || cleanAr.includes("Ø¨ÙŠØ¯Ø§ØºÙˆØ¬ÙŠØ§") || cleanAr.includes("ØªØ¹Ù„Ù…") || cleanAr.includes("ØªØ¯Ø±ÙŠØ³")) {
    return "Ø­Ù‚Ù„ Ø¯Ø±Ø§Ø³ÙŠ ÙˆØ¨ÙŠØ¯Ø§ØºÙˆØ¬ÙŠ ÙŠØ±ÙƒØ² Ø¹Ù„Ù‰ ØªØ·ÙˆÙŠØ± Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ§Øª Ø§Ù„ØªØ¯Ø±ÙŠØ³ Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ© ÙˆØ§ÙƒØªØ³Ø§Ø¨ Ø§Ù„ÙƒÙØ§ÙŠØ§Øª ÙˆØªØ·ÙˆÙŠØ± Ø£Ø³Ø§Ù„ÙŠØ¨ Ø§Ù„ØªÙ‚ÙˆÙŠÙ….";
  }
  if (cleanAr.includes("Ø°ÙƒØ§Ø¡") || cleanAr.includes("Ø¢Ù„ÙŠØ©") || cleanAr.includes("Ø®ÙˆØ§Ø±Ø²Ù…") || cleanAr.includes("Ø­Ø§Ø³ÙˆØ¨") || cleanAr.includes("ØªÙ‚Ù†ÙŠØ©")) {
    return "Ø£Ù†Ø¸Ù…Ø© ÙˆØªÙ‚Ù†ÙŠØ§Øª Ø­Ø§Ø³ÙˆØ¨ÙŠØ© Ù…ØªÙ‚Ø¯Ù…Ø© ØªØ¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø®ÙˆØ§Ø±Ø²Ù…ÙŠØ§Øª ÙˆØ§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª ÙˆØªÙˆÙ„ÙŠØ¯ Ø§Ù„Ù…Ø®Ø±Ø¬Ø§Øª Ø§Ù„Ø°ÙƒÙŠØ©.";
  }

  // No locally invented or context-quoted "definitions" are ever produced. A
  // concept may only ship when it has a genuine, commonly accepted scholarly
  // definition (registry match or established keyword domain). Returning an
  // empty string tells the caller to DROP the concept rather than fabricate one.
  return "";
}

