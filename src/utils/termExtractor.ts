import { GlossaryTerm } from "../types";

export function collapseSpacedArabicLetters(text: string): string {
  if (!text) return "";
  let res = text;
  // Match sequences of isolated single Arabic letters separated by spaces e.g. "ك ا ل ك ا ل" or "ا ل ظ و ا ه ر"
  res = res.replace(/(?:^|[\s"'(«،;؛:!؟\-\[])(?:[\u0600-\u06FF]\s+){2,}[\u0600-\u06FF](?=[\s"').!»«،;؛:!؟\]]|$)/g, (match) => {
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
  res = res.replace(/(?:MILLENNIUM\s+)?Journal\s+of\s+[A-Za-z\s]+(?:\d{2,}\(\d+\)\s*\d+[\s–-]+\d+)?/gi, "");
  res = res.replace(/ProQuest\s+pg\.\s*\d+/gi, "");
  res = res.replace(/The\s+Journal\s+of\s+Military\s+History[^\n;.]*/gi, "");
  res = res.replace(/Paret,\s*Peter[^\n;.]*/gi, "");
  res = res.replace(/Ramy\s+Jabbour[^\n;.]*/gi, "");
  res = res.replace(/December\s+2015\s+Gulf\s+Office[^\n;.]*/gi, "");
  res = res.replace(/©\s*The\s+Author\(s\)[^\n;.]*/gi, "");
  res = res.replace(/Reprints\s+and\s+permissions[^\n;.]*/gi, "");
  res = res.replace(/uk\/journalsPermissions[^\n;.]*/gi, "");
  res = res.replace(/All\s+rights\s+reserved[^\n;.]*/gi, "");
  res = res.replace(/\b\d{2,}\(\d+\)\s*\d+[\s–-]+\d+\b/g, "");
  res = res.replace(/\b(Vol|Volume|Issue|pp|pg)\.?\s*\d+/gi, "");
  return res.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes Arabic text to repair PDF font extraction artifacts (such as 'آل' instead of 'ال'
 * or alif-madda 'آ' replacing standard alif 'ا' / 'أ'), removes OCR ligature bugs, and standardizes punctuation.
 */
export function normalizeArabicText(text?: string): string {
  if (!text) return "";
  let res = collapseSpacedArabicLetters(text);

  // 0. Fix repeated prefix loops e.g. "الكالكالكفاءة" -> "الكفاءة", "الالترجمة" -> "الترجمة"
  res = res.replace(/(?:كالك){2,}/g, "الك");
  res = res.replace(/(?:الك){2,}/g, "الك");
  res = res.replace(/(?:ال){2,}/g, "ال");

  // 1. Fix PDF font extraction mapping of "الألف واللام" to "آل" at word boundaries
  // Examples: "آلترجمة" -> "الترجمة", "آلذكاء" -> "الذكاء", "آلداآت" -> "الأدوات", "آلوآضيع" -> "المواضيع", etc.
  res = res.replace(/\bآل([اأإؤئب-ي]+)/g, "ال$1");

  // Fix common OCR typos, broken prefix fragments, and mangled word forms
  res = res.replace(/\bالفاءة\b/g, "الكفاءة");
  res = res.replace(/\bفاءة\b/g, "كفاءة");
  res = res.replace(/\bملترجمة\b/g, "المترجمة");
  res = res.replace(/\bلترجمة\b/g, "الترجمة");

  // 2. Fix specific corrupted PDF words commonly seen in OCR/CID font tables
  const replacements: Record<string, string> = {
    "الفاءة البشرية": "الكفاءة البشرية",
    "الفاءة": "الكفاءة",
    "آلوآضيع": "المواضيع",
    "آلرآهنة": "الراهنة",
    "آلوآسع": "الواسع",
    "آلغرض": "الغرض",
    "آلكاديمي": "الأكاديمي",
    "آلخيرة": "الأخيرة",
    "آلداآت": "الأدوات",
    "أداآت": "أدوات",
    "آلداء": "الأداء",
    "آلستخدمين": "المستخدمين",
    "آلترجمة": "الترجمة",
    "آلوقت": "الوقت",
    "آلجهد": "الجهد",
    "آلدرآسة": "الدراسة",
    "آلكفاءة": "الكفاءة",
    "آلبشرية": "البشرية",
    "آلذكاء": "الذكاء",
    "آلصطناعي": "الاصطناعي",
    "آلقائمة": "القائمة",
    "راآجا": "رواجاً",
    "ادقة": "بدقة",
    "اعليه": "وعليه",
    "ابن ضرارة": "ومن ضرورة",
    "انقدية": "النقدية",
    "لمارسة": "لممارسة",
    "سواآء": "سواء",
    "كبيرآ": "كبيراً",
    "اقد ": "لقد ",
    "هذآ": "هذا",
    "تعليمية ملترجمة": "تعليمية الترجمة",
    "الظوآهر": "الظواهر",
    "آلظوآهر": "الظواهر",
    "آلتتعليمية": "التعليمية",
    "آلتتتعليمية": "التعليمية",
    "التتعليمية": "التعليمية",
    "التتتعليمية": "التعليمية",
    "تتعليمية": "تعليمية",
    "آلتعليمية": "التعليمية",
    "تحليل الظوآهر آلتتعليمية": "تحليل الظواهر التعليمية",
    "تحليل آلظوآهر آلتتعليمية": "تحليل الظواهر التعليمية",
    "تحليل الظواهر التتعليمية": "تحليل الظواهر التعليمية",
    "اتطبيقية": "التطبيقية",
    "الآليية": "الآلية",
    "الإصطناعي": "الاصطناعي",
    "أوتوماتي": "أوتوماتيكي",
    "ترجمة آلي": "ترجمة آلية",
    "توصية مستند": "توصية مستندة",
    "فجوة معرفي": "فجوة معرفية",
    "المترجمي": "المترجمين",
    "الدراسا": "الدراسات",
  };
  for (const [corrupted, fixed] of Object.entries(replacements)) {
    res = res.split(corrupted).join(fixed);
  }

  // 3. Fix remaining standalone alif madda inside normal Arabic words where Alif Madda does not belong
  // Preserve legitimate Alif Madda words: القرآن، الآن، آراء، آثار، آفاق، آلية، آلات، مرآة، مكافآت، منشآت، مآل، منشأة
  const validMaddaRegex = /(القرآن|الآن|آراء|آثار|آفاق|آلية|آلات|مرآة|مكافآت|منشآت|مآل)/;
  res = res.replace(/\b(?!القرآن|الآن|آراء|آثار|آفاق|آلية|آلات|مرآة|مكافآت|منشآت|مآل)[أ-ي]*آ[أ-ي]+\b/g, (match) => {
    if (validMaddaRegex.test(match)) return match;
    return match.replace(/آ/g, "ا");
  });

  // 4. Normalize punctuation spacing
  res = res.replace(/\s+/g, " ").trim();
  res = res.replace(/\s+([،.,؛!؟])/g, "$1 ");
  res = res.replace(/([،.,؛!؟])(?=[^\s،.,؛!؟0-9])/g, "$1 ");
  return res.replace(/\s+/g, " ").trim();
}

// Blacklist filter to block trivial/irrelevant proper names, place names, scholar names, journal names, header metadata, section headers, sentence fragments, citations, and broad generic disciplines
export function isTrivialOrCitationTerm(term: string, definition?: string): boolean {
  if (!term) return true;
  const cleanTerm = normalizeArabicText(term).trim().toLowerCase();

  // Too short or too long
  if (cleanTerm.length < 3 || cleanTerm.length > 55) return true;

  // Reject broad academic disciplines and generic fields when standalone (e.g. "Computer Science", "Marketing")
  const genericDisciplinesAndBroadTerms = [
    "computer science", "marketing", "management", "finance", "accounting", "business",
    "economics", "law", "medicine", "engineering", "education", "sociology", "psychology",
    "philosophy", "history", "literature", "mathematics", "biology", "physics", "chemistry",
    "geography", "statistics", "linguistics", "anthropology", "political science", "journalism",
    "علوم الحاسوب", "علوم الكمبيوتر", "التسويق", "الإدارة", "العلوم المالية", "المحاسبة",
    "إدارة الأعمال", "الاقتصاد", "القانون", "الطب", "الهندسة", "التربية", "علم الاجتماع",
    "علم النفس", "الفلسفة", "التاريخ", "الأدب", "الرياضيات", "الأحياء", "الفيزياء", "الكيمياء",
    "الجغرافيا", "الإحصاء", "اللسانيات", "الأنثروبولوجيا", "العلوم السياسية", "الإعلام"
  ];
  if (genericDisciplinesAndBroadTerms.some(gd => cleanTerm === gd)) {
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

  // Reject specific scholar names, author names, proper personal names
  const scholarAndAuthorNames = [
    "eleonora ardemagni", "ardemagni", "gregory gause", "gause", "gregory gause iii", "gause iii",
    "elizabeth kendall", "kendall", "bernard lewis", "lewis", "joseph nye", "nye", "roberts to", "roberts",
    "david b", "david", "tamim", "emir tamim", "john", "smith", "keohane", "waltz", "mearsheimer",
    "huntington", "fukuyama", "morgenthau", "bull", "wendt", "walt", "kissinger", "weber", "chomsky",
    "bourdieu", "foucault", "derrida", "habermas", "said", "lynch", "marc lynch", "barnett",
    "michael barnett", "telhami", "shibley telhami", "nawaz", "ameer nawaz", "gregory", "eleonora"
  ];
  if (scholarAndAuthorNames.some((sa) => cleanTerm === sa || cleanTerm.startsWith(sa + " ") || cleanTerm.endsWith(" " + sa) || cleanTerm.includes("gause") || cleanTerm.includes("ardemagni") || cleanTerm.includes("kendall"))) {
    return true;
  }

  // Reject any action verbs, verb forms, or clause fragments in English
  if (/\b(reshapes|reshape|reshaped|reshaping|missed|miss|missing|rethinking|rethink|seeking|seek|sought|understanding|understand|understands|facing|face|faced|looking|look|doing|make|makes|making|made|takes|taking|took|gives|giving|gave|shows|showing|showed|creates|creating|created|brings|bringing|brought)\b/i.test(cleanTerm)) {
    return true;
  }

  // Contains citation numbers, ISSN, DOI, URLs, page ranges, or header symbols
  if (/[0-9]|issn|doi|http|www|vol|n°|\bno\b|pp\.|isbn|journal|college|university|press|comillas|london|edited|published|accessed|downloaded/i.test(cleanTerm)) {
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
  if (/^(أسلوب|طريقة|عملية|وفقاً|حسب|نقلاً|شكل|جدول|صورة|شكل رقم|جدول رقم|بناءً|استناداً|مع ذلك|كذلك|علاوة|إضافة|من قبل|عن طريق|بواسطة)\b/i.test(cleanTerm)) {
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
    "جامعة", "قسم", "كلية", "معهد", "طلبة", "طلاب", "سنة أولى", "سنة ثانية", "سنة ثالثة", "سنة رابعة",
    "ليسانس", "ماجستير", "دكتوراه", "سعيدة", "الجزائر", "الدوحة", "قطر", "القاهرة", "لندن", "باريس",
    "مجلة", "حوليات", "مؤتمر", "ندوة", "ملتقى", "أنموذجا", "أنموذجاً", "دراسة حالة", "مقدمة", "خاتمة", "مراجع", "فهرس"
  ];
  if (institutionalAndHeaderTerms.some((sa) => cleanTerm === sa || cleanTerm.includes(sa))) {
    return true;
  }

  // Reject topic action phrases and title fragments that are NOT theoretical concepts
  const topicActionPhrases = [
    "teaching translation", "teaching of", "study of", "light of", "challenges and horizons", "challenges", "horizons",
    "application of", "use of", "case study", "first-year students", "department of translation", "university of saida",
    "تدريس الترجمة", "في ظل", "التحديات الآفاق", "التحديات والآفاق", "قسم الترجمة", "طلبة سنة أولى"
  ];
  if (topicActionPhrases.some((tp) => cleanTerm === tp || cleanTerm.startsWith(tp) || cleanTerm.endsWith(tp) || cleanTerm.includes("teaching"))) {
    return true;
  }

  // Reject any term containing digits or page ranges
  if (/[0-9]/.test(cleanTerm)) {
    return true;
  }

  // Reject geographical regions, country names, city names standalone
  const geographicalAndPlaces = [
    "middle east", "qatar", "doha", "london", "al udeid", "as sayliyah", "sayliyah", "udeid", "united states", "europe", "asia", "latin america", "persian gulf", "arabian gulf", "الشرق الأوسط", "قطر", "الدوحة", "لندن", "واشنطن"
  ];
  if (geographicalAndPlaces.some((gp) => cleanTerm === gp)) {
    return true;
  }

  // Check definition for actual citation/footer/header garbage, page ranges, or empty quotes
  if (definition) {
    const cleanDef = normalizeArabicText(definition).toLowerCase();
    if (
      cleanDef.length < 15 ||
      cleanDef.includes('""') ||
      cleanDef.includes(":\s*\"\"") ||
      cleanDef.includes("مفهوم تحليلي يُقصد به في النص: \"\"") ||
      /issn|doi|n°|001-|[0-9]{3,}|journal of|all rights reserved|executive summary|full terms|cite this article|http|\b\d{1,4}\s*[-–—]\s*\d{1,4}\b/i.test(cleanDef) ||
      cleanDef.includes("جامعة") || cleanDef.includes("أنموذجا") || cleanDef.includes("أنموذجاً") || cleanDef.includes("سنة أولى") || cleanDef.includes("تدريس الترجمة في ظل") || cleanDef.includes("567")
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
      "traduction", "erreur", "intelligibilité", "automatique", "humaine", "sur "
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

  // 1. Collapse spaced single OCR letters e.g. "ك ا ل ك ا ل" -> "الكالك" or "ك ا ل ك ف ا ء ة ا ل ب ش ر ي ة" -> "كالكفاءة البشرية"
  res = collapseSpacedArabicLetters(res);

  // 2. Strip trailing numbers (e.g. " 2,", " 567", " 10"), page markers, and citations
  res = res.replace(/[\s,،;؛:!?؟–—\-\d]+$/g, "");

  // 3. Strip trailing conversational adverbs, conjunctions, or suffixes
  res = res.replace(/[\s,،;؛:!?؟–—-]+(خصوصا|خصوصاً|خاصة|سيما|لا سيما|وفقا|وفقاً|بناء|بناءً|أيضا|أيضاً|كذلك|مع ذلك|منها|إلخ)+$/gi, "");

  // Repeat trailing punctuation and number purge
  res = res.replace(/[\s,،;؛:!?؟–—\-\d]+$/g, "");

  // 4. Purge repeated prefixes e.g. "كالكالكالكفاءة", "الكالكفاءة", "الالترجمة"
  res = res.replace(/(?:كالك){2,}/g, "الك");
  res = res.replace(/(?:الك){2,}/g, "الك");
  res = res.replace(/(?:ال){2,}/g, "ال");

  // 5. Strip prepended particle prepositions (كـ، بـ، فـ، و، لـ، كالـ، بالـ، فالـ، والـ، للـ، وللـ) from the start of Arabic terms
  // CRITICAL FIX: "كالك" -> "الك" (e.g. "كالكفاءة" -> "الكفاءة", "كالكتاب" -> "الكتاب"). Never replace "كالك" with "ال"!
  res = res.replace(/^(?:وكالك|فكالك|كالك)/g, "الك");
  res = res.replace(/^(?:وكال|فكال|وبال|فبال|كال|بال|فال|وال|ولل|فلل|لل)(?=[\u0600-\u06FF]{3,})/g, "ال");
  res = res.replace(/^(?:وك|فك|وب|فب|ك|ب|ف|و)(?=ال[\u0600-\u06FF]{3,})/g, "");

  // 6. Normalization of common OCR mangles, root truncation, or indefinites
  if (res.includes("الفاءة") || res.includes("فاءة")) {
    res = res.replace(/الفاءة/g, "الكفاءة").replace(/\bفاءة\b/g, "كفاءة");
  }
  if (res === "كفاءة البشرية" || res === "فاءة البشرية" || res === "الفاءة البشرية" || res === "كفاءة بشرية") {
    res = "الكفاءة البشرية";
  }
  if (res === "نظرية اتطبيقية للفعل" || res === "نظرية تطبيقية للفعل" || res === "اتطبيقية للفعل") {
    res = "النظرية التطبيقية للفعل";
  }
  if (res.includes("الظوآهر") || res.includes("آلتتعليمية") || res.includes("آلظوآهر") || res.includes("التتعليمية")) {
    res = res
      .replace(/آلظوآهر|الظوآهر/g, "الظواهر")
      .replace(/آلتتعليمية|آلتتتعليمية|التتعليمية|التتتعليمية|تتعليمية/g, "التعليمية");
  }

  return res.replace(/^["'«»()\[\]\s–—:-]+|["'«»()\[\]\s–—:-]+$/g, "").trim();
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
  res = res.replace(/(?<![\u0600-\u06FF])(?:كالك|الك|ك)*الفاءة\s+البشرية(?![ا-ي])/g, "الكفاءة البشرية");
  res = res.replace(/(?<![\u0600-\u06FF])(?:كالك|الك|ك)*كفاءة\s+البشرية(?![ا-ي])/g, "الكفاءة البشرية");
  res = res.replace(/(?<![\u0600-\u06FF])الفاءة\s+البشرية(?![ا-ي])/g, "الكفاءة البشرية");
  res = res.replace(/(?<![\u0600-\u06FF])الفاءة(?![ا-ي])/g, "الكفاءة");
  res = res.replace(/(?<![\u0600-\u06FF])نظرية\s+اتطبيقية(\s+للفعل)?(?![ا-ي])/g, "النظرية التطبيقية$1");
  res = res.replace(/(?<![\u0600-\u06FF])اتطبيقية(?![ا-ي])/g, "التطبيقية");
  res = res.replace(/الظوآهر\s+(آلتتتعليمية|آلتتعليمية|التتعليمية|التتتعليمية|تتعليمية|التعليمية)/g, "الظواهر التعليمية");
  res = res.replace(/الظواهر\s+(آلتتتعليمية|آلتتعليمية|التتعليمية|التتتعليمية|تتعليمية)/g, "الظواهر التعليمية");
  res = res.replace(/الظوآهر/g, "الظواهر");
  res = res.replace(/(آلتتتعليمية|آلتتعليمية|التتعليمية|التتتعليمية)/g, "التعليمية");

  // 4. Additional phrase repairs
  const phraseRepairs: [RegExp, string][] = [
    [/\bتعليمية إشكالية إجمالية\b/g, "الإشكالية التعليمية الإجمالية"],
    [/\bإشكالية إجمالية\b/g, "الإشكالية الإجمالية"],
    [/\bالآليية\b/g, "الآلية"],
    [/\bالإصطناعي\b/g, "الاصطناعي"],
    [/\bأوتوماتي\b/g, "أوتوماتيكي"],
    [/\bترجمة آلي\b/g, "ترجمة آلية"],
    [/\bتوصية مستند\b/g, "توصية مستندة"],
    [/\bفجوة معرفي\b/g, "فجوة معرفية"],
    [/\bالمترجمي\b/g, "المترجمين"],
    [/\bالدراسا\b/g, "الدراسات"],
  ];
  for (const [pattern, replacement] of phraseRepairs) {
    res = res.replace(pattern, replacement);
  }

  // 5. Ensure prefix loops are purged
  res = res.replace(/(?:كالك){2,}/g, "الك");
  res = res.replace(/(?:الك){2,}/g, "الك");
  res = res.replace(/(?:ال){2,}/g, "ال");

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
    "تعليمية إشكالية إجمالية",
    "إشكالية إجمالية",
    "تعليمية إشكالية",
    "دراسة تحليلية",
    "خصوصا",
    "خاصة",
    "مستند مرفق",
  ];
  if (nonsensicalList.some(ns => termAr.includes(ns) || termAr === ns)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 4. Reject if term still contains internal commas or punctuation or numbers
  if (/[,،;؛:!?؟]/.test(termAr) || /[,;:!?]/.test(termEng) || /\d/.test(termAr) || /\d/.test(termEng)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 5. Ensure word count bounds (Concepts are nominal phrases of 1 to 4 words max)
  const arWords = termAr.split(/\s+/).filter(Boolean);
  const engWords = termEng.split(/\s+/).filter(Boolean);
  if (arWords.length > 4 || (termEng && engWords.length > 5)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  // 6. Check if term matches SCHOLARLY_CONCEPTS_REGISTRY (English key or Arabic phrase)
  const lowerEng = termEng.toLowerCase();
  for (const [key, meta] of Object.entries(SCHOLARLY_CONCEPTS_REGISTRY)) {
    if (lowerEng === key || termAr === meta.ar || areTermsEquivalent(termAr, meta.ar)) {
      termEng = key;
      termAr = meta.ar;
      break;
    }
  }

  // 7. Final trivial/citation check
  if (isTrivialOrCitationTerm(termEng, definition) || isTrivialOrCitationTerm(termAr, definition)) {
    return { term: termEng, verified_term: termAr, draft_term: termAr, isValid: false };
  }

  return {
    term: termEng || termAr,
    verified_term: termAr,
    draft_term: termAr,
    isValid: termAr.length >= 3 && termAr.length <= 60,
  };
}

// Authoritative dictionary of genuine scholarly theoretical concepts, frameworks, and methodological paradigms
export interface ScholarlyConceptMeta {
  ar: string;
  def: string;
}

export const SCHOLARLY_CONCEPTS_REGISTRY: Record<string, ScholarlyConceptMeta> = {
  // Translation Studies & Didactics
  "human competence": {
    ar: "الكفاءة البشرية",
    def: "مجموع الكفايات الذهنية واللغوية والتحليلية والتأويلية التي يمتلكها المترجم البشري لفهم السياقات الثقافية والدلالية المعقدة للنصوص والتمييز عن المخرجات الآلية."
  },
  "applied action theory": {
    ar: "النظرية التطبيقية للفعل",
    def: "إطار نظري ومنهجي يدرس الأفعال والممارسات التواصلية والترجمية في بيئتها الميدانية، موجهاً القرارات التنفيذية نحو الاستجابة المباشرة لمتطلبات الموقف."
  },
  "analysis of educational phenomena": {
    ar: "تحليل الظواهر التعليمية",
    def: "منهجية بحثية تفكيكية تعنى برصد ودراسة المتغيرات البيداغوجية والأنماط السلوكية والتفاعلية داخل المنظومة التعليمية للارتقاء بنواتج التعلم والتقويم."
  },
  "pedagogical translation": {
    ar: "الترجمة البيداغوجية",
    def: "إستراتيجية تعليمية ومنهجية توظف الترجمة كأداة لاكتساب الكفايات اللغوية والمهارات المعرفية في تعليم اللغات والترجمة."
  },
  "machine translation post-editing": {
    ar: "التحرير اللاحق للترجمة الآلية",
    def: "إجراء تحليلي ومهني يقوم فيه المترجم بمراجعة وتحرير المخرجات النصية الصادرة عن أنظمة الترجمة الآلية لضمان الجودة والدقة الاصطلاحية."
  },
  "translator competence": {
    ar: "الكفاءة الترجمية",
    def: "منظومة الكفايات اللغوية والثقافية والتكنولوجية والمنهجية التي يمتلكها المترجم لإنجاز عملية النقل الترجمي بجودة عالية ومهنية."
  },
  "didactics of translation": {
    ar: "تعليمية الترجمة",
    def: "الحقل المعرفي والمنهجي المعني بدراسة نظريات وأساليب وتقنيات تدريس الترجمة وتطوير المناهج والتقويم التكويني للطلبة."
  },
  "neural machine translation": {
    ar: "الترجمة الآلية العصبية",
    def: "منهجية متقدمة في الترجمة الآلية تعتمد على شبكات التعلم العميق والذكاء الاصطناعي لمعالجة ونقل التراكيب اللغوية في سياقها المعرفي."
  },
  "technological turn in translation": {
    ar: "المنعطف التكنولوجي في الترجمة",
    def: "التحول الهيكلي والمنهجي في دراسات الترجمة وممارستها نتيجة اندماج أدوات الذكاء الاصطناعي والترجمة بمساعدة الحاسوب في سير العمل الترجمي."
  },
  "translation equivalence": {
    ar: "التكافؤ الترجمي",
    def: "علاقة التماثل الدلالي والوظيفي والأسلوبي بين النص المصدر والنص الهدف بما يحفظ القصد التواصلي للمعنى."
  },
  "skopos theory": {
    ar: "نظرية الغرض (سكوبوس)",
    def: "إطار نظري وظيفي في دراسات الترجمة يؤكد أن الغرض الوظيفي للنص الهدف هو المحدد الأساسي للاستراتيجيات والقرارات الترجمية."
  },
  "functional equivalence": {
    ar: "التكافؤ الوظيفي",
    def: "مفهوم نظري في الترجمة يركز على نقل الوظيفة والأثر التواصلي للنص الأصلي إلى المتلقي في اللغة الهدف."
  },
  "dynamic equivalence": {
    ar: "التكافؤ الديناميكي",
    def: "إستراتيجية ترجمية تهدف إلى إحداث استجابة مكافئة لدى متلقي الترجمة تماثل استجابة متلقي النص الأصلي."
  },
  "descriptive translation studies": {
    ar: "دراسات الترجمة الوصفية",
    def: "حقل فرعي في علم الترجمة يُعنى بالدراسة التجريبية والوصفية للترجمات كظواهر ثقافية ونصية في السياق الهدف."
  },
  "cognitive load in translation": {
    ar: "العبء المعرفي في الترجمة",
    def: "الجهد الذهني ومقدار الموارد المعرفية التي يتطلبها إنجاز عملية التحليل والمعالجة والنقل بين اللغات."
  },
  "audiovisual translation": {
    ar: "الترجمة السمعية البصرية",
    def: "فرع متخصص في دراسات الترجمة يهتم بنقل المحتوى متعدد الوسائط كالأفلام والبرامج الوثائقية عبر الدبلجة والسترجة."
  },
  "computer-assisted translation": {
    ar: "الترجمة بمساعدة الحاسوب",
    def: "استخدام البرمجيات والأدوات التقنية كذاكرة الترجمة وإدارة المصطلحات لدعم كفاءة المترجم وإنتاجيته."
  },
  "translation theory": {
    ar: "نظرية الترجمة",
    def: "الإطار المفاهيمي والنظري الذي يدرس مبادئ وقواعد وآليات نقل المعاني والنصوص بين اللغات والثقافات المختلفة."
  },

  // Pedagogy & Didactics
  "constructivist pedagogy": {
    ar: "البيداغوجيا البنائية",
    def: "إطار تربوي ومنهجي يقوم على أن المتعلم يبني معرفته وكفاياته تحليلياً وتراكمياً من خلال التفاعل والتعلم النشط وحل المشكلات."
  },
  "scaffolding theory": {
    ar: "نظرية السقالات التعليمية",
    def: "إطار تربوي يركز على تقديم دعم مرحلي وموجه للمتعلم من قِبل المعلم أو الخبير لتمكينه من إنجاز مهام معقدة لا يستطيع إنجازها مستقلاً في البداية."
  },
  "formative assessment": {
    ar: "التقويم التكويني",
    def: "عملية تقويم مستمرة وتحليلية تهدف إلى رصد أداء المتعلمين وتشخيص الفجوات وتطوير أساليب التدريس أثناء سير العملية التعليمية."
  },
  "blended learning": {
    ar: "التعلم المدمج",
    def: "نموذج يدمج بين التدريس المباشر وأدوات ومنصات التعلم الإلكتروني والتفاعلي لتعزيز الفاعلية الكلية."
  },
  "quality assurance": {
    ar: "ضمان الجودة",
    def: "منظومة معايير وإجراءات منهجية تهدف إلى تقييم الأداء والمخرجات التشغيلية والمؤسسية وضمان التحسين المستمر وفق معايير الاعتماد."
  },

  // Artificial Intelligence & Technology
  "generative artificial intelligence": {
    ar: "الذكاء الاصطناعي التوليدي",
    def: "أنظمة ذكاء اصطناعي متقدمة قادرة على توليد نصوص أو تحليلات جديدة بناءً على أنماط مكتسبة من التعلم العميق."
  },
  "large language models": {
    ar: "نماذج اللغة الكبيرة",
    def: "نماذج حاسوبية عصبية مدربة على كميات هائلة من البيانات النصية قادرة على فهم وتحليل وتوليد اللغات الطبيعية بدقة عالية."
  },
  "natural language processing": {
    ar: "معالجة اللغات الطبيعية",
    def: "حقل فرعي في الذكاء الاصطناعي واللسانيات الحاسوبية يهتم بتمكين الحواسيب من فهم اللغات البشرية وتحليلها وتوليدها."
  },
  "machine learning": {
    ar: "تعلم الآلة",
    def: "فرع من الذكاء الاصطناعي يركز على تطوير خوارزميات تمكن الأنظمة الحاسوبية من التعلم والتنبؤ من خلال البيانات."
  },
  "artificial intelligence": {
    ar: "الذكاء الاصطناعي",
    def: "حقل متقدم في علوم الحاسوب يهدف إلى بناء أنظمة وخوارزميات قادرة على محاكاة القدرات المعرفية البشرية، كالتحليل والتعلم والاستنتاج."
  },

  // International Relations, Geopolitics & Political Science
  "authoritarian stability": {
    ar: "الاستقرار الاستبدادي",
    def: "مفهوم تحليلي يدرس الآليات والترتيبات المؤسسية والأمنية والمالية التي تعتمدها الأنظمة غير الديمقراطية لإدارة التهديدات وضمان استمراريتها وبقائها."
  },
  "authoritarian resilience": {
    ar: "المرونة الاستبدادية",
    def: "قدرة الأنظمة الاستبدادية على التكيف مع الأزمات الداخلية والضغوط الخارجية عبر مزيج من إعادة توزيع الموارد، والإصلاح الشكلي، والقمع السلس."
  },
  "rentier state theory": {
    ar: "نظرية الدولة الريعية",
    def: "نموذج نظري في الاقتصاد السياسي يفسر سلوك الدولة المستندة أساساً إلى العوائد الخارجية والنفطية، حيث تقل الحاجة للضرائب وبالتالي لتمثيل المواطنين."
  },
  "rentierism": {
    ar: "الريعية السياسية والاقتصادية",
    def: "منظومة علاقات اقتصادية وسياسية تعتمد على التوزيع المباشر للريع الخارجي لشراء الولاءات وتحقيق التضامن الاجتماعي وبقاء السلطة."
  },
  "asymmetric warfare": {
    ar: "الحرب غير المتكافئة",
    def: "نمط من الصراعات المسلحة يقع بين أطراف تتفاوت قدراتها العسكرية وتكنولوجيا قتالها بشكل حاد، مما يدفع الطرف الأضعف لتوظيف استراتيجيات غير تقليدية."
  },
  "proxy warfare": {
    ar: "حرب الوكالة",
    def: "استراتيجية عسكرية وسياسية تعتمد فيها القوى الإقليمية أو الدولية على فاعلين من غير الدول أو حلفاء محليين لإدارة الصراع نيابة عنها وتقليل التكلفة المباشرة."
  },
  "proxy conflict": {
    ar: "الصراع بالوكالة",
    def: "نزاع مسلح تُديره أو تغذيه أطراف خارجية عبر دعم فصائل أو حلفاء محليين دون الانخراط المباشر الشامل للقوى الكبرى."
  },
  "security dilemma": {
    ar: "المعضلة الأمنية",
    def: "مفهوم نظري محوري يفيد بأن إجراءات دولة ما لتعزيز أمنها قد يُفسرها الجيران كتهديد مباشر، مما يدفعهم لردود فعل دفاعية تزيد من حالة عدم الاستقرار."
  },
  "deterrence theory": {
    ar: "نظرية الردع",
    def: "إستراتيجية قائمة على منع الخصم من اتخاذ سلوك هجومي عبر إقناعه بأن التكلفة والخسائر المتوقعة ستتجاوز أي مكاسب محتملة."
  },
  "hybrid warfare": {
    ar: "الحرب الهجينة",
    def: "إستراتيجية صراع متكاملة تمزج بين الأدوات العسكرية التقليدية، والحروب السيبرانية، والحملات الإعلامية، والضغوط الاقتصادية لتحقيق أهداف جيوسياسية."
  },
  "regional hegemony": {
    ar: "الهيمنة الإقليمية",
    def: "حالة يفرض فيها فاعل دولي أو إقليمي نفوذه وقدراته العسكرية والاقتصادية والسياسية ليصبح القوة المهيمنة الرئيسية في نطاقه الجغرافي."
  },
  "patron-client relations": {
    ar: "علاقات التبعية والزبائنية",
    def: "شبكة روابط وتبادل غير متكافئة بين فاعل أقوى (المتبوع) يقدم الحماية والموارد، وفاعل أضعف (الزبون) يقدم الولاء والدعم السياسي."
  },
  "sectarianization": {
    ar: "الهندسة الطائفية (التطييف)",
    def: "عملية سياسية واجتماعية تُوظف فيها الهويات الدينية أو الطائفية عمداً من قبل الفاعلين السياسييين لشرعنة السلطة وتعبئة الأتباع وتأطير الصراعات."
  },
  "power transition theory": {
    ar: "نظرية تحول القوة",
    def: "إطار نظري يدرس دورات صعود وهبوط القوى الكبرى والإقليمية، مؤكداً أن احتمال الحروب الشاملة يزداد عندما تقترب القوى الصاعدة من موازاة القوة المهيمنة."
  },
  "competitive authoritarianism": {
    ar: "الاستبدادية التنافسية",
    def: "نظام سياسي هجين تتواجد فيه مؤسسات ديمقراطية شكلية مثل الانتخابات، لكن السلطة تستغل موارد الدولة للحياد بالعملية ومنع التداول الحقيقي."
  },
  "regime survival": {
    ar: "بقاء النظام السياسـي",
    def: "مجموعة الاستراتيجيات الأمنية والسياسية والاقتصادية التي تتخذها قيادة الدولة لضمان استمراريتها في وجه التهديدات الداخلية والخارجية."
  },
  "institutional resilience": {
    ar: "المرونة المؤسسية",
    def: "قدرة المؤسسات السياسية والاجتماعية على امتصاص الصدمات المتكررة والأزمات الهيكلية والتكيف مع التغيرات دون انهيار النظام."
  },
  "resource curse": {
    ar: "لعنة الموارد",
    def: "ظاهرة اقتصادية وسياسية تفيد بأن البلدان الغنية بالموارد الطبيعية كالنفط تميل لمعاناة نمو اقتصادي أقل ومستويات استبداد أعلى مقارنة بغيرها."
  },
  "strategic autonomy": {
    ar: "الاستقلالية الاستراتيجية",
    def: "قدرة الدولة على اتخاذ قرارات سياسية وأمنية وعسكرية مستقلة وتنفيذها دون الاعتماد المفرط على التحالفات والقوى الخارجية."
  },
  "geopolitics": {
    ar: "الجيوسياسية (الجغرافيا السياسية)",
    def: "دراسة أثر الموارد والتضاريس والموقع الجغرافي للدول في تشكيل سلوكها السياسي وعلاقاتها الدولية واستراتيجياتها الأمنية."
  },
  "state capacity": {
    ar: "قدرة الدولة المؤسسية",
    def: "مدى قدرة مؤسسات الدولة على تنفيذ سياستها العامة وفرض سيادة القانون وجباية الموارد وتقديم الخدمات لجميع مواطنيها."
  },
  "securitization": {
    ar: "الأمننة (التسييس الأمني)",
    def: "عملية تحويل قضية سياسية أو اجتماعية عادية إلى تهديد وجودي عاجل عبر الخطاب الرسمي، مما يسوغ استخدام إجراءات استثنائية خارجة عن المألوف."
  },
  "arab spring": {
    ar: "الحراك العربي (الثورات العربية)",
    def: "موجة الاحتجاجات الشعبية والانتفاضات السياسية التي شهدتها منطقة الشرق الأوسط وشمال أفريقيا منذ عام 2011 لإعادة تشكيل العلاقة بين السلطة والمجتمع."
  },
  "political economy": {
    ar: "الاقتصاد السياسي",
    def: "حقل تحليلي يدرس التفاعل التبادل بين المؤسسات السياسية والأنظمة الاقتصادية وكيفية تأثير القوانين والسلطة على توزيع الثروة."
  },
  "westphalian sovereignty": {
    ar: "السيادة الويستفالية",
    def: "مبدأ في القانون الدولي والعلاقات الدولية ينص على استقلالية كل دولة وسلطتها الحصرية على إقليمها ومواطنيها دون تدخل خارجي."
  },
  "eurocentrism": {
    ar: "المركزية الأوروبية",
    def: "منظور فكري وتحليلي يعتبر القيم والتاريخ والتجارب الأوروبية والغربية معياراً عالمياً لتقييم الثقافات والأنظمة الأخرى."
  },
  "standard of civilization": {
    ar: "معيار التحضر",
    def: "مفهوم تاريخي وقانوني في العلاقات الدولية أُستخدم لتصنيف الدول وتحديد مدى أهليتها للعضوية الكاملة في المجتمع الدولي."
  },
  "legal positivism": {
    ar: "الوضعية القانونية",
    def: "مدرسة فكرية في النظرية القانونية تؤكد أن صحة القواعد القانونية تستند إلى مصادرها التشريعية والمؤسسية وليس إلى اعتبارات أخلاقية."
  },
  "international society": {
    ar: "المجتمع الدولي",
    def: "مفهوم نظري في المدرسة الإنجليزية للعلاقات الدولية يشير إلى مجموعة دول تشترك في قيم وأعراف ومؤسسات تنظم علاقاتها المتبادلة."
  },
  "foreign policy": {
    ar: "السياسة الخارجية",
    def: "مجموعة الأهداف والإستراتيجيات والقرارات التي تتخذها الدولة في تعاملها مع الفاعلين الخارجيين لتحقيق مصالحها الوطنية."
  },
  "balance of power": {
    ar: "توازن القوى",
    def: "مفهوم تحليلي يشير إلى توزيع القوى العسكرية والاقتصادية بين الدول بحيث لا تتمكن دولة واحدة من فرض هيمنتها المطلقة."
  },
  "soft power": {
    ar: "القوة الناعمة",
    def: "قدرة الفاعل الدولي على التأثير في الجذب والإقناع وتشكيل تفضيلات الآخرين من خلال الجاذبية الثقافية والقيم والشرعية الأخلاقية."
  },
  "realism": {
    ar: "الواقعية السياسية",
    def: "إطار نظري في العلاقات الدولية يفسر السياسة العالمية بناءً على توازن القوى ومصلحة الدولة وسيادتها في نظام دولي يتسم بالفوضى الهيكلية."
  },
  "constructivism": {
    ar: "البنائية في العلاقات الدولية",
    def: "منظور نظري يؤكد أن البنى والهويات والمصالح في العلاقات الدولية تتشكل عبر التفاعل الاجتماعي والأعراف المشتركة."
  },
  "structural realism": {
    ar: "الواقعية الهيكلية",
    def: "مدرسة نظرية في العلاقات الدولية تعزو سلوك الدول إلى بنية النظام الدولي غير المركزي وتنافسها الحتمي على الأمن والبقاء."
  },

  // Methodology & Epistemology
  "path dependence": {
    ar: "الارتهان للمسار",
    def: "مفهوم تحليلي يفيد بأن القرارات أو المؤسسات التي أُسست في الماضي تفرض قيوداً وتوجّه مسار القرارات والتطورات اللاحقة في الأمد البعيد."
  },
  "principal agent problem": {
    ar: "مشكلة الوكيل والأصيل",
    def: "معضلة مؤسسية وتحليلية تنشأ عندما تختلف مصالح الأصيل (المُوكِّل) عن مصالح الوكيل المُنَفِّذ في ظل تفاوت المعلومات وصعوبة المراقبة."
  },
  "process tracing": {
    ar: "تتبع العمليات المنهجي",
    def: "منهجية تحليلية كيفية تُستخدم لاختبار الفرضيات السببية عبر تتبع الخطوات والآليات الدقيقة التي تربط الأسباب بالنتائج."
  },
  "moral hazard": {
    ar: "المخاطرة الأخلاقية",
    def: "حالة تحليلية يرتكب فيها طرف معين مخاطر غير محسوبة لعلمه أن تكاليف وعواقب تلك المخاطر سيتحملها طرف آخر."
  },

  // Business, Management & Innovation
  "corporate governance": {
    ar: "الحوكمة المؤسسية",
    def: "منظومة القواعد والممارسات والعمليات التي يتم من خلالها توجيه الشركة وإدارتها ومراقبتها لتحقيق التوازن بين مصالح المساهمين والإدارة."
  },
  "disruptive innovation": {
    ar: "الابتكار الإرباكي (الزعزعة الابتكارية)",
    def: "مفهوم إداري يصف العمليات التي تحول المنتجات والخدمات المعقدة والمكلفة إلى حلول بسيطة ومتاحة لقطاعات واسعة، مما يعيد تشكيل الأسواق القائمة."
  },
  "supply chain resilience": {
    ar: "مرونة سلاسل الإمداد",
    def: "قدرة شبكة التوريد والإمداد المؤسسية على التكيف السريع والامتصاص الفعال للصدمات والاضطرابات دون تعطيل العمليات الجوهرية."
  },
  "strategic management": {
    ar: "الإدارة الاستراتيجية",
    def: "عملية التخطيط والتحليل والتنفيذ والتطوير المستمر للأهداف المحددة والموارد المؤسسية لضمان التفوق والميزة التنافسية المستدامة."
  },
  "value proposition": {
    ar: "القيمة المقترحة",
    def: "الوعد بالقيمة والفوائد الفريدة التي تعهد بها المؤسسة أو العلامة التجارية لعملائها لتميز منتجاتها وخدماتها عن المنافسين."
  },

  // Journalism, Media & Mass Communication
  "agenda setting theory": {
    ar: "نظرية ترتيب الأولويات (وضع الأجندة)",
    def: "إطار تحليلي إعلامي يفسر قدرة وسائل الإعلام على توجيه اهتمام الجمهور ورأيه العام ونوعية القضايا المطروحة للبحث والمناقشة."
  },
  "framing theory": {
    ar: "نظرية التأطير الإعلامي",
    def: "منهج تحليل إعلامي يدرس كيفية اختيار وتركيز وصياغة وسائل الإعلام لجوانب معينة من حدث ما لتأطير إدراك الجمهور وتفسيره."
  },
  "media literacy": {
    ar: "الدراية الإعلامية والرقمنة",
    def: "مجموعة المهارات المعرفية والتحليلية التي تمكن الجمهور من الوصول إلى الرسائل الإعلامية ونقدها وتقييمها وإنتاجها بوعي."
  },
  "investigative journalism": {
    ar: "الصحافة الاستقصائية",
    def: "أسلوب صحفي متعمق يقوم على البحث والتقصي لكشف الحقائق الخفية وقضايا الفساد وسوء استخدام السلطة لخدمة الصالح العام."
  },

  // Literary Criticism, Cultural Studies & Humanities
  "intertextual analysis": {
    ar: "التحليل التناصي (التناص)",
    def: "منهج نقدي يدرس علاقات التداخل والتفاعل والنقل بين النص المدروس والنصوص والأعمال الأدبية السابقة أو المعاصرة له."
  },
  "hermeneutics": {
    ar: "الهرمنيوطيقا (علم التأويل)",
    def: "نظرية ومنهجية التفسير والتأويل الفلسفي والأدبي المعنية بكشف الأبعاد الدلالية والسياقات الثقافية وراء النصوص."
  },
  "cultural hegemony": {
    ar: "الهيمنة الثقافية",
    def: "مفهوم فكري ونقدي يصف قيادة طبقة أو فئة مجتمعية لصياغة المنظومة القيمية والثقافية وتعميمها كمعيار طبيعي ومقبول لدى الجميع."
  },
  "narrative arc": {
    ar: "المسار السردي",
    def: "البنية الهيكلية والزمنية للقصة أو النص الأدبي التي تتطور عبرها الأحداث والشخصيات والصراعات وصولاً إلى الذروة والحل."
  },

  // Social Affairs, Sociology & Public Policy
  "social cohesion": {
    ar: "التماسك الاجتماعي",
    def: "مدى قوة الروابط الاجتماعية والتضامن والشعور بالانتماء المتبادل والثقة بين أفراد المجتمع ومؤسساته المختلفة."
  },
  "social capital": {
    ar: "رأس المال الاجتماعي",
    def: "شبكة العلاقات الاجتماعية والقيم والأعراف المتبادلة والثقة التي تسهل التعاون الفعال وتطوير المجتمع والنهوض به."
  },
  "demographic transition": {
    ar: "التحول الديموغرافي",
    def: "نموذج تحليلي يفسر التغيرات الهيكلية في معدلات المواليد والوفيات والتركيبة العمرية للسكان وتأثيرها على التنمية والتخطيط."
  },

  // Economics & Finance
  "behavioral economics": {
    ar: "الاقتصاد السلوكي",
    def: "حقل معقد يدمج بين علم النفس والاقتصاد لدراسة كيفية اتخاذ الأفراد والمؤسسات للقرارات الاقتصادية والمالية الفعلية في ظل عدم الرشد المطلق."
  },
  "macroeconomic stability": {
    ar: "الاستقرار الاقتصادي الكلي",
    def: "حالة توازن اقتصادي تتسم بمعدلات نمو مستدامة ومستويات تضخم منخفضة وضبط للبطالة والدين العام لحماية الاقتصاد الوطني."
  },
  "content analysis": {
    ar: "تحليل المضمون",
    def: "منهجية علمية تهدف إلى التحليل الكمي والكيفي للمحتوى النصي أو الإعلامي لاستخلاص الأنماط والدلالات الموضوعية."
  },
  "critical discourse analysis": {
    ar: "تحليل الخطاب النقدي",
    def: "منهج تحليلي يدرس العلاقة بين اللغة والقوة والأيديولوجيا في النصوص والخطابات المختلفة والاجتماعية."
  }
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
      .replace(/[-–_،.]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const a = cleanStr(termA);
  const b = cleanStr(termB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Compare via scholarly concepts registry (English key or Arabic translation) with exact equality
  for (const [engKey, meta] of Object.entries(SCHOLARLY_CONCEPTS_REGISTRY)) {
    const keyClean = cleanStr(engKey);
    const arClean = cleanStr(meta.ar);
    const isAMatch = a === keyClean || a === arClean;
    const isBMatch = b === keyClean || b === arClean;
    if (isAMatch && isBMatch) {
      return true;
    }
  }
  return false;
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
  cleaned = cleaned.replace(/Les Annales de l’université[^.\n]*/gi, "");
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
  cleaned = cleaned.replace(/[•\uF0A7\u25CF]/g, " ");
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

  // Translate / map common English title terms into Arabic if the title is in English/Latin
  if (!/[\u0600-\u06FF]/.test(cleanTitle)) {
    let mapped = cleanTitle.toLowerCase();
    const mappings: [RegExp, string][] = [
      [/uae'?s?\s*regional\s*wars/gi, "الحروب الإقليمية ودور دولة الإمارات العربية المتحدة في التدخلات والتحالفات المسلحة"],
      [/war\s*experiences\s*war\s*practices\s*war\s*theory/gi, "التفاعل المفهومي بين تجارب الحرب والممارسات التكتيكية والعقيدة النظرية للعسكرية المعاصرة"],
      [/regional\s*wars/gi, "استراتيجيات وديناميات النزاعات والحروب الإقليمية"],
      [/war\s*experiences/gi, "الخبرة العسكرية والتجارب الميدانية للقتال"],
      [/war\s*practices/gi, "الممارسات والتكتيكات العسكرية الميدانية"],
      [/war\s*theory/gi, "النظرية الفلسفية والعقيدة القتالية العسكرية"],
      [/military\s*power/gi, "مكونات وأبعاد القوة العسكرية الشاملة والقدرات الدفاعية والتنافس الاستراتيجي"],
      [/al\s*qaeda|al\s*qaida|aqap/gi, "استراتيجيات تنظيم القاعدة وديناميات تحركاته المسلحة"],
      [/islamic\s*state|isis|isin/gi, "تنظيم الدولة الإسلامية وصراعات السيطرة"],
      [/yemen/gi, "السياق الجيوسياسي وديناميات الصراع المسلح في اليمن"],
      [/battle\s*for\s*local\s*audiences/gi, "التنافس على التأثير الحشدوي والجمهور المحلي في مناطق النزاع"],
      [/counter\s*terrorism|counter-terrorism/gi, "سياسات واستراتيجيات مكافحة الإرهاب والعمليات الخاصة"],
      [/drone\s*strikes/gi, "الضربات الجوية بالطيران المسير واستجابات الأهداف الميدانية"],
      [/post\s*human|post-human/gi, "مفاهيم ما بعد الإنسانية والتحول التكنولوجي في الاتصال والترجمة"],
      [/machine\s*translation/gi, "تقنيات الترجمة الآلية النيورونية معالجة النصوص"],
      [/post\s*editing|post-editing/gi, "إدارة عمليات التحرير البعدي وتأهيل العنصر البشري"],
      [/pedagogical\s*translation/gi, "التطبيقات البيداغوجية والتعليمية للترجمة"],
      [/foreign\s*policy/gi, "محددات وتوجهات السياسة الخارجية للدول"],
      [/sovereignty/gi, "أبعاد السيادة الوطنية والتحديات الدولية"],
      [/international\s*relations/gi, "تحولات العلاقات الدولية وتوازنات القوى"],
      [/digital\s*technologies/gi, "تأثير التقنيات الرقمية والحلول الذكية"],
      [/artificial\s*intelligence/gi, "تطبيقات الذكاء الاصطناعي والأوتوماتيكية"],
      [/corporate\s*governance/gi, "أطر الحوكمة المؤسسية والشفافية الهيكلية"],
      [/disruptive\s*innovation/gi, "استراتيجيات الابتكار الإرباكي والميزة التنافسية"],
      [/supply\s*chain/gi, "مرونة سلاسل الإمداد والتوريد في الأزمات"],
      [/strategic\s*management/gi, "مبادئ الإدارة الاستراتيجية والتخطيط المرن"],
      [/agenda\s*setting/gi, "نظرية ترتيب الأولويات وبناء الأجندة الإعلامية"],
      [/framing\s*theory/gi, "التأطير الإعلامي وتوجيه اتجاهات الرأي العام"],
      [/investigative\s*journalism/gi, "الصحافة الاستقصائية ومعايير التحقق والتغطية"],
      [/hermeneutics/gi, "المناهج الهرمنيوطيقية والتأويل النادي للنصوص"],
      [/social\s*cohesion/gi, "مؤشرات التماسك الاجتماعي والاستقرار المجتمعي"],
      [/behavioral\s*economics/gi, "مبادئ الاقتصاد السلوكي ورسم القرارات"],
    ];

    mappings.forEach(([rgx, ar]) => {
      mapped = mapped.replace(rgx, ar);
    });

    // Clean up leftover punctuation and filler
    mapped = mapped.replace(/[._\-]+/g, " ").replace(/\s+/g, " ").trim();
    if (/[\u0600-\u06FF]/.test(mapped) && mapped.length > 5) {
      arabicTitle = mapped;
    } else {
      arabicTitle = `الموضوع التخصصي لمستند "${cleanTitle}"`;
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
    return `تستعرض هذه الدراسة تحليلاً متخصصاً وحقلياً حول ${arabicTitle}، مسلطة الضوء على المحاور الأساسية والمعطيات الميدانية المدروسة. ومن أبرز النتائج والمؤشرات الواردة: ${contentHighlights}.`;
  }

  return `تقدم هذه الدراسة قراءة تحليليّة أكاديمية متخصصة تناقش ${arabicTitle}، مع استعراض الأطر النظرية والمنهجية والممارسات السياقية ذات الصلة باللغة العربية الفصحى.`;
}

/**
 * Ensures a summary is strictly informative, document-specific, and normalized in Arabic.
 * Never returns raw verbatim English/foreign quote dumps or generic repetitive boilerplate.
 */
export function ensureArabicSummary(summary?: string, title?: string, content?: string): string {
  const cleanTitle = normalizeArabicText(title || "المستند المرفق")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ")
    .replace(/[-]/g, " ")
    .trim();

  // 1. If summary exists, strip any raw non-Arabic verbatim quotes or boilerplate headers
  if (summary && summary.trim().length > 15) {
    let cleanSum = summary.trim()
      .replace(/^الإجابة العلمية\s*\(ج\)\s*:\s*\*\*/i, "")
      .replace(/^\*\*\s*/, "")
      .replace(/يقدم هذا المستند دراسة تحليلية رصينة تتناول موضوع \([^)]*\)/g, "")
      .replace(/تناقش موضوع \([^)]*\)/g, "")
      .replace(/تناقش موضوع/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/الموضوع المنهجي والأمني المحدد في الدراسة/g, "")
      .trim();

    cleanSum = cleanBibliographicClutterAndNormalizeArabic(cleanSum);

    // Strip out long verbatim English/Latin quotes inside summary
    cleanSum = cleanSum.replace(/:\s*[A-Za-z0-9\s.,'’"()\-\/]{20,}\.\.\./g, ".");
    cleanSum = cleanSum.replace(/[A-Za-z0-9\s.,'’"()\-\/]{35,}/g, "").trim();
    cleanSum = cleanSum.replace(/:\s*$/g, ".").trim();

    // Remove any leftover empty brackets or orphaned "تناقش موضوع"
    cleanSum = cleanSum.replace(/تناقش\s+موضوع\s*\.?/g, "").replace(/\(\s*\)/g, "").trim();

    const arabicCharCount = (cleanSum.match(/[\u0600-\u06FF]/g) || []).length;
    if (cleanSum.length > 25 && arabicCharCount > 15) {
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
export function extractFallbackTermsFromText(text: string, sourceId?: string, title?: string, existingGlossary?: GlossaryTerm[]): GlossaryTerm[] {
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
    if (extracted.length >= 3) return;
    const termClean = rawTerm.trim();
    if (!termClean) return;

    let verifiedArabic = arabicTerm;
    let authoritativeDef = customDef;

    // Look up in scholarly concepts registry
    const registryKey = termClean.toLowerCase();
    const registryEntry = SCHOLARLY_CONCEPTS_REGISTRY[registryKey];
    if (registryEntry) {
      verifiedArabic = registryEntry.ar;
      authoritativeDef = registryEntry.def;
    } else if (!verifiedArabic) {
      if (/[\u0600-\u06FF]/.test(termClean)) {
        verifiedArabic = termClean;
      } else {
        verifiedArabic = termClean
          .split(" ")
          .map((w) => ACADEMIC_TERMS_MAP[w.toLowerCase()] || w)
          .join(" ");
      }
    }

    const sanitized = cleanAndSanitizeAcademicTerm(termClean, verifiedArabic, verifiedArabic, authoritativeDef);
    if (!sanitized.isValid) return;

    const finalEng = sanitized.term;
    const cleanAr = sanitized.verified_term;

    if (isTrivialOrCitationTerm(finalEng, authoritativeDef) || isTrivialOrCitationTerm(cleanAr, authoritativeDef)) {
      return;
    }

    // Zero-duplicate check across English and Arabic equivalents globally
    if (isAlreadyPresent(finalEng, cleanAr, extracted)) {
      return;
    }
    if (isAlreadyPresent(finalEng, cleanAr, existingGlossary)) {
      return;
    }

    const cleanDef = normalizeArabicText(authoritativeDef || buildContextDefinition(finalEng, cleanText, cleanAr));

    // Final safety check against numbers or page ranges in definition
    if (/[0-9]{3,}/.test(cleanDef) || cleanDef.includes("جامعة") || cleanDef.includes("أنموذجا")) {
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

  // 1. Scan against SCHOLARLY_CONCEPTS_REGISTRY sorted by key length descending
  // Add concepts ONLY if the full concept or full Arabic equivalent appears in searchScope or cleanText
  const sortedKeys = Object.keys(SCHOLARLY_CONCEPTS_REGISTRY).sort((a, b) => b.length - a.length);
  const cleanTextLower = cleanText.toLowerCase();

  for (const engKey of sortedKeys) {
    if (extracted.length >= 3) break;
    const meta = SCHOLARLY_CONCEPTS_REGISTRY[engKey];
    const lowerKey = engKey.toLowerCase();
    const lowerAr = meta.ar.toLowerCase();

    // STRICT CHECK: The FULL English key or FULL Arabic concept MUST appear in title, summary, or cleanText
    const isExactMatch =
      searchScope.includes(lowerKey) ||
      searchScope.includes(lowerAr) ||
      cleanTextLower.includes(lowerKey) ||
      cleanTextLower.includes(lowerAr);

    if (isExactMatch) {
      addTerm(engKey, meta.ar, meta.def);
    }
  }

  // 3. Strict fallback for authentic multi-word noun phrase concepts ending in established academic suffixes
  if (extracted.length < 3 && /[a-zA-Z]/.test(cleanText)) {
    const authenticConceptRegex = /\b([A-Z][a-z\-]+(?:\s+[A-Za-z\-]+){0,2}\s+(?:Theory|Governance|Autonomy|Dilemma|Warfare|Analysis|Literacy|Innovation|Transition|Cohesion|Sovereignty|Hegemony|Capacity|Securitization|Aesthetics|Ethics|Policy|Strategy|System|Paradigm|Methodology|Resilience|Curse|Economy|Sectarianization|Rentierism|Geopolitics|Capital|Arc|Hermeneutics|Trope|Discourse|State))\b/g;
    let match;
    while ((match = authenticConceptRegex.exec(cleanText)) !== null && extracted.length < 3) {
      const candidate = match[1].trim();
      if (candidate.length > 6 && !isTrivialOrCitationTerm(candidate)) {
        addTerm(candidate);
      }
    }
  }

  return extracted.slice(0, 3);
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
  if (cleanEng.includes("governance") || cleanEng.includes("management") || cleanAr.includes("حوكمة") || cleanAr.includes("إدارة") || cleanAr.includes("أعمال") || cleanAr.includes("استراتيجية")) {
    return "منظومة المبادئ والقواعد والتخطيط المنظم لتوجيه الموارد وتحقيق الكفاءة التشغيلية والنمو المؤسسي المستدام.";
  }
  if (cleanEng.includes("journalism") || cleanEng.includes("media") || cleanEng.includes("framing") || cleanAr.includes("صحافة") || cleanAr.includes("إعلام") || cleanAr.includes("خبر") || cleanAr.includes("تأطير")) {
    return "إطار تحليلي اتصالي يدرس آليات صياغة الرسائل الإعلامية وتغطية الأحداث ونقلها وتأثيرها على الرأي العام وتوجيه الاهتمام.";
  }
  if (cleanEng.includes("literature") || cleanEng.includes("narrative") || cleanEng.includes("criticism") || cleanAr.includes("سرد") || cleanAr.includes("أدب") || cleanAr.includes("نقد") || cleanAr.includes("تناص") || cleanAr.includes("تأويل")) {
    return "منهج نقدي وتحليلي يعنى بدراسة البنى النصية والسردية والتفاعلات الدلالية والجمالية والتأويلية في الأعمال الأدبية.";
  }
  if (cleanEng.includes("social") || cleanEng.includes("cohesion") || cleanAr.includes("اجتماع") || cleanAr.includes("تماسك") || cleanAr.includes("مجتمعي")) {
    return "مفهوم سوسيولوجي يدرس شبكات الروابط والتضامن والبنى التفاعلية والمؤسسية المنظمة للتماسك والتطور الاجتماعي.";
  }
  if (cleanEng.includes("economic") || cleanEng.includes("finance") || cleanAr.includes("اقتصاد") || cleanAr.includes("تمويل") || cleanAr.includes("سوق") || cleanAr.includes("ريع")) {
    return "إطار تحليلي يدرس آليات إنتاج وتوزيع الموارد والقرارات المالية والسلوكية وانعكاساتها على الأسواق والتنمية.";
  }
  if (cleanEng.includes("authoritarian") || cleanAr.includes("استبداد")) {
    return "مفهوم تحليلي يدرس الترتيبات المؤسسية والأمنية والمالية التي تعتمدها الأنظمة غير الديمقراطية لإدارة التهديدات وضمان الاستقرار.";
  }
  if (cleanEng.includes("war") || cleanEng.includes("warfare") || cleanEng.includes("conflict") || cleanAr.includes("حرب") || cleanAr.includes("صراع")) {
    return "نمط صراع استراتيجي يركز على توظيف التكتيكات العسكرية وغير التقليدية والأدوات السياسية لتحقيق الأهداف والتوازنات.";
  }
  if (cleanEng.includes("security") || cleanAr.includes("أمن")) {
    return "منظومة الترتيبات والاستراتيجيات المتبعة لحماية المصالح الحيوية والحد من التهديدات القائمة والناشئة.";
  }
  if (cleanEng.includes("sovereign") || cleanAr.includes("سياد")) {
    return "مبدأ قانوني وسياسي أساسي يؤكد استقلالية السلطة وحصريتها التنفيذية والتشريعية داخل حدودها.";
  }
  if (cleanEng.includes("policy") || cleanAr.includes("سياس")) {
    return "مجموعة القرارات والمبادئ التوجيهية المنظمة للتفاعل وتوزيع الموارد وإدارة العلاقات بين السلطة والفاعلين.";
  }
  if (cleanAr.includes("كفاءة بشرية") || cleanAr.includes("الكفاءة البشرية")) {
    return "منظومة المهارات والقدرات التحليلية والإبداعية التي يتفوق بها العنصر البشري في اتخاذ القرارات وحل المشكلات المعقدة مقارنة بالأنظمة الآلية.";
  }
  if (cleanAr.includes("نظرية") && (cleanAr.includes("تطبيقية") || cleanAr.includes("فعل"))) {
    return "إطار تحليلي ومنهجي يدرس الممارسات والأفعال في بيئتها الميدانية، موجهاً القرارات التنفيذية نحو الاستجابة المباشرة لمتطلبات الموقف.";
  }
  if (cleanAr.includes("ترجمة") || cleanAr.includes("مترجم")) {
    return "عملية نقل دلالي وثقافي ووظيفي للنصوص بين اللغات مع مراعاة المقاصد التواصلية وخصوصيات السياق الهدف.";
  }
  if (cleanAr.includes("تعليمية") || cleanAr.includes("بيداغوجيا") || cleanAr.includes("تعلم") || cleanAr.includes("تدريس")) {
    return "حقل دراسي وبيداغوجي يركز على تطوير استراتيجيات التدريس المنهجية واكتساب الكفايات وتطوير أساليب التقويم.";
  }
  if (cleanAr.includes("ذكاء") || cleanAr.includes("آلية") || cleanAr.includes("خوارزم") || cleanAr.includes("حاسوب") || cleanAr.includes("تقنية")) {
    return "أنظمة وتقنيات حاسوبية متقدمة تعتمد على الخوارزميات والبيانات لمعالجة المعلومات وتوليد المخرجات الذكية.";
  }

  // 3. Extract grounded sentence from source text if available and non-empty
  if (fullText && fullText.length > 50) {
    const sentences = fullText.split(/[.\n;؛]/).map(s => s.trim()).filter(Boolean);
    const matchingSentence = sentences.find(s => s.length >= 25 && s.length <= 180 && (s.includes(cleanAr) || s.includes(cleanAr.replace(/^ال/, ""))));
    if (matchingSentence) {
      const cleanSentence = spellcheckAndRepairArabicAndEnglishText(matchingSentence.replace(/^[^\u0600-\u06FF]+/, "")).trim();
      if (cleanSentence && cleanSentence.length >= 20) {
        return `مفهوم تحليلي يُقصد به في النص: "${cleanSentence}"`;
      }
    }
  }

  return `مفهوم علمي ومنهجي يدرس الآليات والأبعاد النظرية والتطبيقية المتعلقة بـ (${cleanAr}) في أدبيات المجال والدراسات المتاحة.`;
}

