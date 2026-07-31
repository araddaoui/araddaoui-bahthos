import { GlossaryTerm } from "../types";

// Blacklist filter to block trivial/irrelevant proper names, place names, scholar names, journal names, header metadata, section headers, sentence fragments, citations, and broad generic disciplines
export function isTrivialOrCitationTerm(term: string, definition?: string): boolean {
  if (!term) return true;
  const cleanTerm = term.trim().toLowerCase();

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

  // Contains citation numbers, ISSN, DOI, URLs, page ranges, or header symbols
  if (/[0-9]|issn|doi|http|www|vol|n°|\bno\b|pp\.|isbn|journal|college|university|press|comillas|london|edited|published|accessed|downloaded/i.test(cleanTerm)) {
    return true;
  }

  // Reject citation verbs and author attribution fragments
  if (/\b(cite|citation|cited|author|edited|published|publisher|copyright|rights reserved|et al|ibid|op cit|translator|translated)\b/i.test(cleanTerm)) {
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

  // Reject specific scholar names, author names, proper personal names
  const scholarAndAuthorNames = [
    "joseph nye", "nye", "roberts to", "roberts", "david b", "david", "tamim", "emir tamim", "john", "smith", "keohane", "waltz", "mearsheimer", "huntington", "fukuyama", "morgenthau", "bull", "wendt"
  ];
  if (scholarAndAuthorNames.some((sa) => cleanTerm === sa || cleanTerm.startsWith(sa + " ") || cleanTerm.endsWith(" " + sa))) {
    return true;
  }

  // Reject geographical regions, country names, city names
  const geographicalAndPlaces = [
    "middle east", "qatar", "doha", "london", "al udeid", "as sayliyah", "sayliyah", "udeid", "united states", "europe", "asia", "latin america", "persian gulf", "arabian gulf", "الشرق الأوسط", "قطر", "الدوحة", "لندن", "واشنطن"
  ];
  if (geographicalAndPlaces.some((gp) => cleanTerm === gp)) {
    return true;
  }

  // Check definition for actual citation/footer/header garbage only
  if (definition) {
    const cleanDef = definition.toLowerCase();
    if (
      /issn|doi|n°|001-|[0-9]{4}\]|journal of|all rights reserved|executive summary|full terms|cite this article|http/i.test(cleanDef)
    ) {
      return true;
    }
  }

  return false;
}

// Translation dictionary for common academic terms
const ACADEMIC_TERMS_MAP: Record<string, string> = {
  "translation theory": "نظرية الترجمة",
  "descriptive translation studies": "دراسات الترجمة الوصفية",
  "historical thematic account": "التحليل التاريخي الموضوعي",
  "skopos theory": "نظرية الغرض (سكوبوس)",
  "source text": "النص المصدر",
  "target language": "اللغة الهدف",
  "functional equivalence": "التكافؤ الوظيفي",
  "dynamic equivalence": "التكافؤ الديناميكي",
  "formal equivalence": "التكافؤ الشكلي",
  "semiotic translation": "الترجمة السيميائية",
  "westphalian sovereignty": "السيادة الويستفالية",
  "eurocentrism": "المركزية الأوروبية",
  "standard of civilization": "معيار التحضر",
  "legal positivism": "الوضعية القانونية",
  "international society": "المجتمع الدولي",
  "foreign policy": "السياسة الخارجية",
  "balance of power": "توازن القوى",
  "soft power": "القوة الناعمة",
  "realism": "الواقعية السياسية",
  "constructivism": "البنائية في العلاقات الدولية",
  "structural realism": "الواقعية الهيكلية",
  "path dependence": "الارتهان للمسار",
  "principal agent problem": "مشكلة الوكيل والأصيل",
  "process tracing": "تتبع العمليات المنهجي",
  "moral hazard": "المخاطرة الأخلاقية",
  "blended learning": "التعلم المدمج",
  "distance learning": "التعلم عن بعد",
  "e-learning": "التعلم الإلكتروني",
  "quality assurance": "ضمان الجودة",
  "academic self-regulation": "التنظيم الذاتي الأكاديمي",
  "artificial intelligence": "الذكاء الاصطناعي",
  "machine learning": "تعلم الآلة",
  "data science": "علم البيانات"
};

/**
 * Ensures a summary is strictly in Arabic.
 */
export function ensureArabicSummary(summary?: string, title?: string, content?: string): string {
  const cleanTitle = (title || "المستند المرفق")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_/g, " ")
    .replace(/[-]/g, " ");

  if (summary && summary.trim().length > 15 && !/[a-zA-Z]{5,}/.test(summary)) {
    return summary.trim();
  }

  if (content) {
    const cleanSentences = content
      .split(/[.!\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && /[\u0600-\u06FF]/.test(s) && !/[a-zA-Z]{5,}/.test(s) && !/issn|doi|journal|http/i.test(s));
    if (cleanSentences.length > 0) {
      return cleanSentences.slice(0, 2).join(". ") + ".";
    }
  }

  return `يقدم هذا المستند تحليلاً رصيناً ومكثفاً لموضوع (${cleanTitle})، مع تفكيك أبرز أفكاره ومحاوره وأبعاده الأكاديمية باللغة العربية.`;
}

/**
 * Extracts 2 to 3 concepts and terms strictly relating to the provided text/document
 */
export function extractFallbackTermsFromText(text: string, sourceId?: string, title?: string): GlossaryTerm[] {
  if ((!text || text.trim().length < 5) && (!title || title.trim().length < 3)) {
    return [];
  }

  const cleanText = text || "";
  const extracted: GlossaryTerm[] = [];
  const addedKeys = new Set<string>();

  const addTerm = (rawTerm: string, arabicTerm?: string, customDef?: string) => {
    if (extracted.length >= 3) return;
    const termClean = rawTerm.trim();
    const key = termClean.toLowerCase();
    
    if (addedKeys.has(key)) return;
    
    let verifiedArabic = arabicTerm || ACADEMIC_TERMS_MAP[key];
    if (!verifiedArabic) {
      if (/[\u0600-\u06FF]/.test(termClean)) {
        verifiedArabic = termClean;
      } else {
        verifiedArabic = termClean
          .split(" ")
          .map(w => ACADEMIC_TERMS_MAP[w.toLowerCase()] || w)
          .join(" ");
      }
    }

    if (isTrivialOrCitationTerm(termClean) || isTrivialOrCitationTerm(verifiedArabic)) {
      return;
    }

    addedKeys.add(key);

    const definition = customDef || buildContextDefinition(termClean, cleanText, verifiedArabic);
    
    extracted.push({
      term: termClean,
      transliteration: verifiedArabic,
      draft_term: verifiedArabic,
      verified_term: verifiedArabic,
      definition,
      sourceId
    });
  };

  // 1. Scan for known academic concepts from ACADEMIC_TERMS_MAP present in text
  for (const [engKey, arVal] of Object.entries(ACADEMIC_TERMS_MAP)) {
    if (extracted.length >= 3) break;
    if (cleanText.toLowerCase().includes(engKey.toLowerCase()) || cleanText.includes(arVal)) {
      addTerm(arVal, arVal);
    }
  }

  // 2. Scan for multi-word Capitalized English Phrases present in text
  const capRegex = /\b([A-Z][a-zA-Z\-]{2,20}(?:\s+[A-Z][a-zA-Z\-]{2,20}){1,3})\b/g;
  let match;
  while ((match = capRegex.exec(cleanText)) !== null && extracted.length < 3) {
    const candidate = match[1].trim();
    addTerm(candidate);
  }

  // 3. Scan for Arabic Academic Compound Concepts present in text
  if (extracted.length < 3) {
    const arabicRegex = /([\u0600-\u06FF]{3,20}\s+ال[\u0600-\u06FF]{3,20}(?:\s+ال[\u0600-\u06FF]{3,20})?)/g;
    while ((match = arabicRegex.exec(cleanText)) !== null && extracted.length < 3) {
      const candidate = match[1].trim();
      if (!isTrivialOrCitationTerm(candidate)) {
        addTerm(candidate, candidate);
      }
    }
  }

  // 4. Scan for Parenthesized / Quoted terms in text
  if (extracted.length < 3) {
    const parenRegex = /[\("«]([^"»\)\(]{4,35})[\)"»]/g;
    while ((match = parenRegex.exec(cleanText)) !== null && extracted.length < 3) {
      const inside = match[1].trim();
      addTerm(inside);
    }
  }

  // 5. Derive from Title if fewer than 2 terms extracted
  if (extracted.length < 2 && title) {
    const titleClean = title.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").replace(/[-]/g, " ").trim();
    if (titleClean && titleClean.length > 3) {
      addTerm(titleClean, titleClean, `بناء وأداة تحليلية لمناقشة واستيعاب المحاور الأساسية الخاصة بـ ${titleClean}.`);
    }
  }

  // 6. If still < 2 terms, construct contextual concepts based on title or text to guarantee 2-3 terms
  if (extracted.length < 2) {
    const cleanTitleName = (title || "المستند").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").trim() || "المستند البحثي";
    const term1 = `مفهوم ${cleanTitleName.substring(0, 30)}`;
    const term2 = `الإطار المنهجي لـ ${cleanTitleName.substring(0, 30)}`;
    const term3 = `التحليل الموضوعي في ${cleanTitleName.substring(0, 30)}`;
    
    addTerm(term1, term1, `بناء وأداة تحليلية لمناقشة واستيعاب المحاور الأساسية الخاصة بـ ${cleanTitleName}.`);
    if (extracted.length < 2) {
      addTerm(term2, term2, `الإطار المنهجي والأدوات التحليلية المعتمدة لدراسة ${cleanTitleName}.`);
    }
    if (extracted.length < 3) {
      addTerm(term3, term3, `دراسة الأبعاد الموضوعية والتقاطعات النظرية في سياق ${cleanTitleName}.`);
    }
  }

  return extracted.slice(0, 3);
}

function buildContextDefinition(term: string, fullText: string, arabicTerm: string): string {
  if (!fullText || fullText.length < 20) {
    return `مفهوم وإطار تحليلي رصين يركز على دراسة واستيعاب أبعاد ${arabicTerm} في السياق الأكاديمي.`;
  }

  const cleanSentences = fullText
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && !/issn|doi|journal|n°|volume|pp\.|http|terms|cite/i.test(s));

  for (const sentence of cleanSentences) {
    if (sentence.toLowerCase().includes(term.toLowerCase())) {
      if (sentence.length <= 180) {
        return sentence + (sentence.endsWith(".") ? "" : ".");
      }
      return sentence.substring(0, 175) + "...";
    }
  }

  return `مفهوم وإطار تحليلي رصين يركز على دراسة واستيعاب أبعاد ${arabicTerm} في السياق الأكاديمي للدراسة.`;
}
