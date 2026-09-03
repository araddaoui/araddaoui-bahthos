import { GlossaryTerm } from "../types.js";

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

  // 1b. Fix the lam-alef ligature artifacts that occur in most Arabic PDF text extraction:
  // "امل..." -> "الم..." (a mim/lam swap: "املتعددة"->"المتعددة", "املرن"->"المرن") and
  // "اال..." -> "الإ..." (a doubled-alif lam-alef: "االلكتروني"->"الإلكتروني").
  // These are font-extraction defects, not genuine words, so they can be normalized safely.
  res = res.replace(/(?<![\u0600-\u06FF])(امل)(?=[\u0600-\u06FF]{2,})/g, "الم");
  res = res.replace(/(?<![\u0600-\u06FF])(اال)(?=[\u0600-\u06FF]{2,})/g, "الإ");

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
  };
  for (const [corrupted, fixed] of Object.entries(replacements)) {
    res = res.replace(new RegExp(`(?<![\\u0600-\\u06FF])${corrupted}(?![\\u0600-\\u06FF])`, "g"), fixed);
  }

  // Safe whole-word replacements for word endings without appending extra letters
  res = res.replace(/(?<![\u0600-\u06FF])الدراسا(?![\u0600-\u06FF])/g, "الدراسات");
  res = res.replace(/(?<![\u0600-\u06FF])المترجمي(?![\u0600-\u06FF])/g, "المترجمين");

  // Sanitize any accumulated trailing repeated letters (e.g. "الدراساتتتت" -> "الدراسات")
  res = res.replace(/الدراسات{2,}/g, "الدراسات");
  res = res.replace(/(?<=[\u0600-\u06FF])ت{2,}(?=[\s"').!»«،;؛:!؟\]]|$)/g, "ت");
  res = res.replace(/(?<=[\u0600-\u06FF])ن{2,}(?=[\s"').!»«،;؛:!؟\]]|$)/g, "ن");
  res = res.replace(/(?<=[\u0600-\u06FF])ة{2,}(?=[\s"').!»«،;؛:!؟\]]|$)/g, "ة");

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

  // Reject AI-invented boilerplate forewords that are NEVER part of a real concept.
  // (e.g. "مفهوم تحليلي مستخرج مباشرة من نص المصدر: ..." or "مفهوم تحليلي يُقصد به في النص: ...")
  if (
    cleanTerm.includes("مفهوم تحليلي") ||
    cleanTerm.includes("مستخرج مباشرة") ||
    cleanTerm.includes("مستخرج من") ||
    cleanTerm.includes("من نص المصدر") ||
    cleanTerm.includes("يُقصد به في النص") ||
    cleanTerm.includes("مستخلص من عنوان المصدر") ||
    cleanTerm.includes("مفهوم مركزي")
  ) {
    return true;
  }

  // Reject classic Arabic sentence-fragment constructions taken verbatim from source text.
  // These are 2-word windows of error/truncation messages or grammatical fragments, not concepts.
  const arabicFragmentSubstrings = [
    "اقتصاص بقية", "بقية النص", "النص لتجاوز", "لتجاوز الحد", "الحد الأقصى",
    "الأقصى للمعالجة", "الحد الاقصى", "اقتصاص", "لتجاوز", "تجازي", "تجاوز الحد",
    "كآلية", "لتجويد", "مخرجات العملية", "الرقمي ك", "بقية", "للاستخدام",
  ];
  for (const frag of arabicFragmentSubstrings) {
    if (cleanTerm.includes(frag)) return true;
  }

  // Reject Arabic terms that are composed mostly of function words / prepositions / verbs /
  // filler, i.e. a grammatical fragment rather than a nominal concept.
  const arabicFragmentStopwords = new Set([
    "من", "في", "على", "إلى", "عن", "مع", "بين", "حتى", "ثم", "أو", "بل", "أن", "إن",
    "قد", "لن", "لو", "إذا", "حيث", "عندما", "بعد", "قبل", "دون", "بسبب", "حسب",
    "نحو", "لدى", "عند", "خلال", "ضمن", "خارج", "فوق", "تحت", "أمام", "خلف", "كان",
    "كانت", "يكون", "يتم", "تتم", "تم", "يوجد", "توجد", "يعد", "تعد", "يعتبر", "تعتبر",
    "يعني", "يؤدي", "تؤدي", "أدى", "هو", "هي", "هذا", "هذه", "ذلك", "تلك", "الذي",
    "التي", "الذين", "معالجة", "التالي", "التالية", "أيضا", "كذلك", "بشكل", "بصورة",
    "بعض", "كل", "جميع", "كم", "بقية", "باقي", "اقتصاص", "لتجاوز", "تجاوز", "الأقصى",
    "النص", "المستند", "الصفحة", "الجزء", "العملية", "المخرجات", "مباشرة", "الرقمي",
  ]);
  const cleanArWords = cleanTerm.split(/\s+/).filter(Boolean);
  if (cleanArWords.length >= 2) {
    const normalizeWord = (w: string) => w
      .replace(/^ال/, "")
      .replace(/^[وفبكل]/, "")
      .replace(/ة$/, "ه")
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
    "علوم الحاسوب", "علوم الكمبيوتر", "التسويق", "الإدارة", "العلوم المالية", "المحاسبة",
    "إدارة الأعمال", "الاقتصاد", "القانون", "الطب", "الهندسة", "التربية", "علم الاجتماع",
    "سياسة التعليم العالي", "التعليم العالي", "الإدارة العامة", "الريادة الفكرية", "القيادة الفكرية",
    "السياسات العامة", "السياسة التعليمية", "الإدارة العامة والسياسات", "إدارة المشاريع",
    "علم النفس", "الفلسفة", "التاريخ", "الأدب", "الرياضيات", "الأحياء", "الفيزياء", "الكيمياء",
    "الجغرافيا", "الإحصاء", "اللسانيات", "الأنثروبولوجيا", "العلوم السياسية", "الإعلام",
    "النظرية", "نظرية", "منهجية البحث", "منهجية", "البحث", "بحث", "الدراسة", "دراسة",
    "الورقة البحثية", "التحليل", "البيانات", "النتائج", "المناقشة", "استعراض الأدبيات",
    "الإطار النظرى", "الإطار النظري", "الإطار المنهجي", "الإطار", "المقاربة", "المنهج", "المناهج",
    "المفهوم", "المفاهيم", "المصطلح", "المصطلحات", "العملية", "العملية التعليمية", "الممارسات",
    "الخدمة", "الخدمات", "المنظومة", "البنية", "النظام", "الرؤية", "الرسالة", "الأهداف", "الغايات",
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

  // Reject geographical regions, country names, city names, journals, and publishers
  const geographicalAndPlaces = [
    "middle east", "qatar", "doha", "london", "al udeid", "as sayliyah", "sayliyah", "udeid", "united states", "usa", "america", "europe", "asia", "latin america", "persian gulf", "arabian gulf", "saudi arabia", "riyadh", "new york", "san antonio", "washington", "cairo", "beirut", "tehran", "tel aviv", "jerusalem", "gaza", "israel",
    "الشرق الأوسط", "قطر", "الدوحة", "لندن", "الولايات المتحدة", "أمريكا", "أوروبا", "آسيا", "أمريكا اللاتينية", "الخليج العربي", "السعودية", "الرياض", "نيويورك", "سان أنطونيو", "واشنطن", "القاهرة", "بيروت", "طهران", "تل أبيب", "القدس", "غزة", "إسرائيل"
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
      cleanDef.includes("مستخرج مباشرة") ||
      cleanDef.includes("مستخرج من نص") ||
      cleanDef.includes("من نص المصدر") ||
      cleanDef.includes("يُقصد به في النص") ||
      cleanDef.includes("مستخلص من عنوان المصدر") ||
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

  let cleaned = res.replace(/^["'«»\s–—:-]+|["'«»\s–—:-]+$/g, "").trim();
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

  // 4. Additional phrase repairs using Arabic word boundaries
  const phraseRepairs: [RegExp, string][] = [
    [/(?<![\u0600-\u06FF])تعليمية إشكالية إجمالية(?![\u0600-\u06FF])/g, "الإشكالية التعليمية الإجمالية"],
    [/(?<![\u0600-\u06FF])إشكالية إجمالية(?![\u0600-\u06FF])/g, "الإشكالية الإجمالية"],
    [/(?<![\u0600-\u06FF])الآليية(?![\u0600-\u06FF])/g, "الآلية"],
    [/(?<![\u0600-\u06FF])الإصطناعي(?![\u0600-\u06FF])/g, "الاصطناعي"],
    [/(?<![\u0600-\u06FF])أوتوماتي(?![\u0600-\u06FF])/g, "أوتوماتيكي"],
    [/(?<![\u0600-\u06FF])ترجمة آلي(?![\u0600-\u06FF])/g, "ترجمة آلية"],
    [/(?<![\u0600-\u06FF])توصية مستند(?![\u0600-\u06FF])/g, "توصية مستندة"],
    [/(?<![\u0600-\u06FF])فجوة معرفي(?![\u0600-\u06FF])/g, "فجوة معرفية"],
    [/(?<![\u0600-\u06FF])المترجمي(?![\u0600-\u06FF])/g, "المترجمين"],
    [/(?<![\u0600-\u06FF])الدراسا(?![\u0600-\u06FF])/g, "الدراسات"],
  ];
  for (const [pattern, replacement] of phraseRepairs) {
    res = res.replace(pattern, replacement);
  }

  // Purge any repeated letter artifacts at word end
  res = res.replace(/الدراسات{2,}/g, "الدراسات");
  res = res.replace(/(?<=[\u0600-\u06FF])ت{2,}(?=[\s"').!»«،;؛:!؟\]]|$)/g, "ت");

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

  // 4. Reject if term still contains internal punctuation (numbers are now allowed in academic terms)
  if (/[,،;؛:!?؟]/.test(termAr) || /[,;:!?]/.test(termEng)) {
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

// Curated Arabic -> authentic English equivalents for genuine scholarly concepts. Terms defined
// here always render with a faithful English translation regardless of the source language.
const ARABIC_TO_ENGLISH_REGISTRY: Record<string, string> = {
  "الوسائط المتعددة": "Multimedia",
  "أدوات الإنتاج الرقمي متعدد الوسائط": "Digital Multimedia Production Tools",
  "الأدوات الرقمية متعددة الوسائط": "Digital Multimedia Tools",
  "إدارة وتنظيم المعرفة التشاركية": "Collaborative Knowledge Management and Organization",
  "إدارة المعرفة وتنظيمها التشاركي": "Collaborative Knowledge Management and Organization",
  "تنظيم المعرفة التشاركية": "Collaborative Knowledge Organization",
  "التعلم المرن": "Flexible Learning",
  "التعلم عبر الإنترنت": "Online Learning",
  "التعلم الإلكتروني": "E-Learning",
  "التعلم عن بعد": "Distance Learning",
  "التعلم المدمج": "Blended Learning",
  "التعلم النشط": "Active Learning",
  "التعلم التعاوني": "Cooperative Learning",
  "التعلم الذاتي": "Self-Regulated Learning",
  "التعلم الاجتماعي": "Social Learning",
  "التعلم التنظيمي": "Organizational Learning",
  "التعلم المستند إلى المشاريع": "Project-Based Learning",
  "التعلم القائم على المشكلات": "Problem-Based Learning",
  "التعلم مدى الحياة": "Lifelong Learning",
  "التعلم الشخصي": "Personalized Learning",
  "البيئة التعليمية التفاعلية": "Interactive Learning Environment",
  "البيئة الرقمية": "Digital Environment",
  "التعليم الإلكتروني": "Electronic Education",
  "التعليم عن بعد": "Distance Education",
  "التعليم الهجين": "Hybrid Education",
  "التعليم المفتوح": "Open Education",
  "التعليم الافتراضي": "Virtual Education",
  "استراتيجيات التدريس": "Teaching Strategies",
  "استراتيجيات التعلم": "Learning Strategies",
  "طرائق التدريس": "Teaching Methods",
  "المنهج الدراسي": "Curriculum",
  "المناهج الدراسية": "Curricula",
  "التقويم التكويني": "Formative Assessment",
  "التقويم الختامي": "Summative Assessment",
  "التقويم الذاتي": "Self-Assessment",
  "التحصيل الدراسي": "Academic Achievement",
  "الكفايات المهنية": "Professional Competencies",
  "الكفايات التدريسية": "Teaching Competencies",
  "الكفايات الرقمية": "Digital Competencies",
  "الكفايات اللغوية": "Language Competencies",
  "المهارات الإلكترونية": "Digital Skills",
  "المهارات الرقمية": "Digital Skills",
  "المهارات الحياتية": "Life Skills",
  "تمكين المتعلمين": "Learner Empowerment",
  "تمكين المعلمين": "Teacher Empowerment",
  "المحتوى التعليمي": "Educational Content",
  "المحتوى الرقمي": "Digital Content",
  "المحتوى التفاعلي": "Interactive Content",
  "المصادر الرقمية": "Digital Resources",
  "الموارد التعليمية": "Educational Resources",
  "الموارد الرقمية": "Digital Resources",
  "السرد القصصي الرقمي": "Digital Storytelling",
  "العروض التقديمية التفاعلية": "Interactive Presentations",
  "منصات التعلم": "Learning Platforms",
  "الأدوات الرقمية": "Digital Tools",
  "الوسائط الفائقة": "Hypermedia",
  "الوسائط التفاعلية": "Interactive Media",
  "تقنيات التعليم": "Educational Technology",
  "تكنولوجيا التعليم": "Educational Technology",
  "تكنولوجيا المعلومات": "Information Technology",
  "العلوم المعرفية": "Cognitive Science",
  "الإدراك البصري": "Visual Perception",
  "المعرفة التشاركية": "Knowledge Sharing",
  "إدارة المعرفة": "Knowledge Management",
  "تنظيم المعرفة": "Knowledge Organization",
  "التحليل النقدي": "Critical Analysis",
  "التفكير النقدي": "Critical Thinking",
  "التفكير الإبداعي": "Creative Thinking",
  "التفكير المصممي": "Design Thinking",
  "حل المشكلات": "Problem Solving",
  "اتخاذ القرار": "Decision Making",
  "التوسيم الاجتماعي": "Social Tagging",
  "مجتمعات الممارسة": "Communities of Practice",
  "الممارسة المهنية": "Professional Practice",
  "الممارسة التأملية": "Reflective Practice",
  "البيانات الضخمة": "Big Data",
  "تعلم الآلة": "Machine Learning",
  "الذكاء الاصطناعي": "Artificial Intelligence",
  "الذكاء الاصطناعي التوليدي": "Generative Artificial Intelligence",
  "الواقع الافتراضي": "Virtual Reality",
  "الواقع المعزز": "Augmented Reality",
  "التفاعل بين الإنسان والحاسوب": "Human–Computer Interaction",
  "الواجهات الرقمية": "Digital Interfaces",
  "التصميم التعليمي": "Instructional Design",
  "النمذجة التعليمية": "Instructional Modeling",
  "الدافعية للتعلم": "Learning Motivation",
  "الانخراط الطلابي": "Student Engagement",
  "عزوف المتعلمين": "Learner Disengagement",
  "الرقمنة": "Digitalization",
  "التحول الرقمي": "Digital Transformation",
  "المواطنة الرقمية": "Digital Citizenship",
  "الهوية الرقمية": "Digital Identity",
  "الأمن السيبراني": "Cybersecurity",
  "خصوصية البيانات": "Data Privacy",
  "الملفات السحابية": "Cloud Storage",
  "الحوسبة السحابية": "Cloud Computing",
  "الأنظمة الإلكترونية": "Electronic Systems",
  "الأنظمة الحديثة": "Modern Systems",
  "الشبكات الاجتماعية": "Social Networks",
  "التفاعل المتزامن": "Synchronous Interaction",
  "التفاعل غير المتزامن": "Asynchronous Interaction",
  "الفصول الافتراضية": "Virtual Classrooms",
  "الفصول الذكية": "Smart Classrooms",
  "المختبرات الافتراضية": "Virtual Laboratories",
  "المكتبة الرقمية": "Digital Library",
  "الأرشفة الرقمية": "Digital Archiving",
  "الدليل التعليمي الرقمي": "Digital Learning Guide",
  "التفاعل البيداغوجي": "Pedagogical Interaction",
  "النموذج البيداغوجي": "Pedagogical Model",
  "المقاربة البيداغوجية": "Pedagogical Approach",
  "البيداغوجيا الفارقية": "Differentiated Pedagogy",
  "التربية الإعلامية": "Media Education",
  "التقييم بالمحاكاة": "Simulation-Based Assessment",
  "المحاكاة الرقمية": "Digital Simulation",
  "ورشة العمل البيداغوجية": "Pedagogical Workshop",
  "تكوين الأساتذة": "Teacher Training",
  "التدريب المهني": "Vocational Training",
  "تطوير الممارسات المهنية": "Professional Development",
  "المناهج الحكومية": "Official Curricula",
};

// Small word-level map used only as a deterministic fallback for Arabic terms not in the registry.
const ARABIC_TERM_WORD_MAP: Record<string, string> = {
  الوسائط: "Media",
  المتعددة: "Multimedia",
  التعلم: "Learning",
  التعليم: "Education",
  المرن: "Flexible",
  النشط: "Active",
  المدمج: "Blended",
  الذاتي: "Self-Regulated",
  التعاوني: "Collaborative",
  عن: "",
  بعد: "Distance",
  عبر: "Through",
  الإنترنت: "Internet",
  الإلكتروني: "Electronic",
  الإلكترونية: "Electronic",
  الرقمي: "Digital",
  الرقمية: "Digital",
  التفاعلي: "Interactive",
  التفاعلية: "Interactive",
  الأدوات: "Tools",
  أدوات: "Tools",
  الإنتاج: "Production",
  تنظيم: "Organization",
  إدارة: "Management",
  المعرفة: "Knowledge",
  التشاركية: "Collaborative",
  التشاركي: "Collaborative",
  المحتوى: "Content",
  التعليمي: "Educational",
  المنصة: "Platform",
  المنصات: "Platforms",
  البيداغوجي: "Pedagogical",
  البيداغوجية: "Pedagogical",
  الكفايات: "Competencies",
  الكفاية: "Competency",
  المهارات: "Skills",
  المهارة: "Skill",
  التقويم: "Assessment",
  التقييم: "Assessment",
  التقديم: "Presentation",
  النماذج: "Models",
  النموذج: "Model",
  الأطر: "Frameworks",
  "الأطر المنهجية": "Methodological Frameworks",
  المفاهيم: "Concepts",
  المفهوم: "Concept",
  المصطلحات: "Terms",
  المصطلح: "Term",
  دراسة: "Study",
  تحليل: "Analysis",
  التحليل: "Analysis",
  نقدي: "Critical",
  النقدي: "Critical",
  مقارن: "Comparative",
  المقارن: "Comparative",
  شامل: "Comprehensive",
  الشامل: "Comprehensive",
  اجتماعي: "Social",
  الاجتماعي: "Social",
  المجتمع: "Community",
  الممارسات: "Practices",
  الممارسة: "Practice",
  التسويق: "Marketing",
  الاستراتيجية: "Strategy",
  الاستراتيجيات: "Strategies",
  المناهج: "Curricula",
  المنهج: "Curriculum",
};

const _normAraKey = (s: string): string =>
  String(s || "")
    .replace(/[\u064B-\u0652\u0670]/g, "") // strip diacritics
    .split(/\s+/)
    .map((w) => (w.startsWith("ال") ? w.slice(2) : w))
    .filter(Boolean)
    .join(" ");

/**
 * Resolves an authentic English rendering for an Arabic scholarly term. Uses the curated
 * registry first (exact / normalized match), then a deterministic word-level translation,
 * finally any Latin fragment already present. Never returns empty for a valid Arabic term.
 */
function resolveAuthenticEnglish(arabicTerm: string): string {
  const ar = String(arabicTerm || "").trim();
  if (!ar) return "";

  // 1. Exact normalized registry lookup.
  const norm = _normAraKey(ar);
  for (const [arKey, enKey] of Object.entries(ARABIC_TO_ENGLISH_REGISTRY)) {
    if (_normAraKey(arKey) === norm) return enKey;
  }
  // Also try including the normalized value as a loose containment on key glyphs.
  for (const [arKey, enKey] of Object.entries(ARABIC_TO_ENGLISH_REGISTRY)) {
    if (norm.length >= 2 && (norm.includes(_normAraKey(arKey)) || _normAraKey(arKey).includes(norm))) {
      if (Math.abs(norm.length - _normAraKey(arKey).length) <= 1) return enKey;
    }
  }

  // 2. Deterministic word-level translation, but ONLY when every significant token is covered
  // by the word map. Partial coverage yields unnatural word salads, which would violate the
  // 'authentic translation' requirement, so partial results are discarded in favour of no badge.
  const omit = new Set(["في", "من", "إلى", "على", "عند", "مع", "حول", "بـ", "و", "عن", "بسبب"]);
  const tokens = ar
    .replace(/^[و]/, "")
    .split(/\s+/)
    .map((w) => w.replace(/^و/, "").trim())
    .filter((w) => w.length > 1 && !omit.has(w));
  const translated = tokens.map((w) => {
    const base = w.replace(/^ال/, "");
    return ARABIC_TERM_WORD_MAP[w] || ARABIC_TERM_WORD_MAP[base] || ARABIC_TERM_WORD_MAP["ال" + base] || "";
  });
  if (translated.length > 0 && translated.every((t) => t !== "")) {
    const joined = translated.join(" ").replace(/\s+/g, " ").trim();
    return joined
      .split(" ")
      .map((w) => (w && w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  // 3. Fall back to any Latin already embedded in the Arabic term.
  const latin = ar.match(/[A-Za-z][A-Za-z0-9 &'’\-()]*/);
  if (latin) {
    return latin[0]
      .split(" ")
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
      .replace(/[-–_،.]/g, " ")
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

  return `يقتصر هذا الوصف على العنوان والنص المتاحين من المصدر الحالي، ويعرض موضوعه دون إضافة مجال أو لغة أو سياق غير مثبت في المستند: ${arabicTitle}.`;
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
  return /^(?:يقتصر هذا الوصف|الموضوع التخصصي لمستند|تستعرض هذه الدراسة تحليلاً متخصصاً|تستعرض هذه الدراسة تحليلاً|يقدم هذا المستند دراسة تحليلية رصينة)/i.test(normalized)
    || /دون إضافة مجال أو لغة أو سياق غير مثبت/i.test(normalized)
    || /لا يتوفر في هذا المصدر ملخص/i.test(normalized);
}

export function sanitizeSourceSummary(summary?: string, title?: string, content?: string): string {
  const rawSummary = String(summary || "").trim();
  const sourceText = `${title || ""} ${content || ""}`;
  const sourceMentionsArabic = /اللغة العربية|العربية الفصحى|arabic language/i.test(sourceText);
  const legacyGeneric = /الممارسات السياقية.*(?:اللغة العربية|العربية الفصحى)|ذات الصلة.*(?:اللغة العربية|العربية الفصحى)|صياغة.*(?:اللغة العربية|العربية الفصحى)/i.test(rawSummary);
  if ((legacyGeneric || isGenericSourceSummary(rawSummary)) && !sourceMentionsArabic) {
    const regenerated = ensureArabicSummary("", title, content);
    return isGenericSourceSummary(regenerated) ? "" : regenerated;
  }
  const cleaned = ensureArabicSummary(rawSummary, title, content);
  return isGenericSourceSummary(cleaned) ? "" : cleaned;
}

export function ensureArabicSummary(summary?: string, title?: string, content?: string): string {
  const cleanTitle = normalizeArabicText(title || "المستند المرفق")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s+(?:pdf|docx?|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
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
  // Anchored to real definitional/framing contexts ("مفهوم X", "نظرية X", quoted terms) AND
  // genuine definite noun-adjective compounds, so the fallback never mints bogus compounds
  // like "العدد نوفمبر", "التعليمية تاريخ", or "القبول امللخص" (all of which pair a definite
  // noun with a NON-definite second word).
  const markerPatterns = [
    // Term introduced by a framing/disciplinary marker, e.g. "مفهوم التعلم الرقمي", "نظرية التنظيم الذاتي",
    // "مصطلح الترجمة الآلية", "متغير التحصيل الأكاديمي". Word tokens may be 2+ chars so genuine
    // concepts containing short prepositions (e.g. "التعلم عن بعد") are captured.
    /(?:مفهوم|مصطلح|نظرية|نموذج|استراتيجية|ظاهرة|متغير|منهج|مدخل|إستراتيجية)\s+([\u0600-\u06FF]{2,35}(?:\s+[\u0600-\u06FF]{2,30}){0,3})/g,
    // Term or definition framed by "(...)" parens, e.g. "(التعلم المدمج)"
    /\(([\u0600-\u06FF]{2,50}(?:\s+[\u0600-\u06FF]{2,30}){0,3})\)/g,
  ];

  // Arabic connectives/clause markers that terminate a nominal concept so a marker capture
  // like "مفهوم التعلم الرقمي ومدى تأثيره" is trimmed to "التعلم الرقمي".
  // NOTE: bare prepositions (عن، في، على، من، إلى) are intentionally NOT boundaries here,
  // because genuine concepts legitimately contain them (e.g. "التعلم عن بعد", "التعليم في ").
  const conceptBoundary = /^(?:و|ثم|أو|بل|لكن|مدى|أهمية|هذا|هذه|التي|الذي|الذين|أن|إن|لكن|هو|هي|كان|كانت|تعد|يعتبر|تعتبر|يتم|تتم|يساهم|تساهم|يساعد|تساعد|يؤثر|تؤثر|يؤدي|تؤدي|يمثل|تمثل|يشمل|تشمل|يعتمد|تعتمد|ويعتبر|ويعتمد|ويعد|ويساهم|ويساعد|ويعني|يعني|تُعنى|فاعليته|وتأثير|تأثير|وأثر|أثر|ودور|ودور|ومدى|وأهمية|بأنه|بأنها|إلا|حيث|بينما|فيما|لإنجاز|لتحقيق|لتحسين|لتنمية|لتوظيف|لتطوير|لتجويد|مفاهيم|أهمية|كآلية|كأداة|كوسيلة|وكان|فقد|مايو|توظيف|إنجاز|تحقيق|تحسين|تنمية|بداية|مع بداية)/;
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
        .replace(/[،;؛:!?؟.]+(?:\s*[،;؛:!?؟.()]+)*\s*$/g, "").trim();
      if (candidate.length < 5) continue;
      // Require a definite nominal phrase (starts with "ال"), i.e. a genuine academic concept
      // rather than a verb-led or connective fragment.
      const words = candidate.split(/\s+/);
      if (!/^[\u0600-\u06FF]/.test(candidate) || !words[0].startsWith("ال")) continue;
      if (words.length > 1 && /^[وفكبل]/.test(words[1])) continue;
      // Reject a candidate that ends with a dangling short preposition ("التعلم عن") or a
      // 2-letter particle, which means the framing capture stopped mid-phrase.
      const last = words[words.length - 1];
      if (last.length < 3 || /^(?:عن|في|من|إلى|على|مع|لها|له|منه|فيها)$/.test(last)) continue;
      if (isTrivialOrCitationTerm(candidate)) continue;
      addTerm(candidate, candidate, buildContextDefinition(candidate, cleanText, candidate));
    }
  }

  // 2b. Restricted plain-phrase scan. Unlike the old loose 2-word window this ONLY accepts
  // definite noun-adjective compounds (e.g. "التعلم المدمج", "الانحراف المعياري") where BOTH
  // immediate words are definite, which is the canonical form of a genuine Arabic academic term.
  // Tokenizing 1+ chars keeps short function words (في، من، عن) as natural separators so definite
  // words from DIFFERENT phrases never collide, and definite function words (التي، الذي...) are
  // denied as concept heads.
  const arabicWords = cleanText.match(/[\u0600-\u06FF]+/g) || [];
  const denyFreeDefinite = new Set([
    "التي", "اختي", "الذي", "الذين", "اللذان", "اللتان", "هذا", "هذه", "ذلك", "تلك",
    "الدراسة", "البحث", "النتائج", "المقدمة", "الخاتمة", "المراجع", "المصادر", "وكان",
  ]);
  for (let i = 0; i < arabicWords.length - 1 && extracted.length < 6; i++) {
    const w1 = arabicWords[i];
    const w2 = arabicWords[i + 1];
    // Both immediate words must be definite noun-adjective constructs (الـ + الـ) and non-trivial.
    if (!w1.startsWith("ال") || !w2.startsWith("ال")) continue;
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
        !t.definition.includes('مفهوم تحليلي يُقصد به في النص: ""') &&
        t.definition.length > 25
          ? t.definition
          : "";

      const cleanDef = normalizeArabicText(
        rawDef || buildContextDefinition(sanitized.term, parsedContent, sanitized.verified_term)
      );

      if (/[0-9]{3,}/.test(cleanDef) || cleanDef.includes("جامعة") || cleanDef.includes("أنموذج")) {
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
  if (cleanEng.includes("learning management") || cleanEng.includes("lms") || cleanAr.includes("إدارة التعلم") || cleanAr.includes("نظام التعلم") || cleanAr.includes("منصة تعليمية")) {
    return "منظومة رقمية ومنصة برمجية متكاملة تُستخدم لتصميم وإدارة وتوصيل المحتوى التعليمي وتتبع تقييم وتقدم المتعلمين.";
  }
  if (cleanEng.includes("corporate governance") || cleanEng.includes("strategic management") || cleanEng.includes("governance") || cleanAr.includes("حوكمة") || cleanAr.includes("إدارة الأعمال") || cleanAr.includes("إدارة استراتيجية")) {
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
        return `مفهوم يشير في سياق هذا المصدر إلى: "${cleanSentence}"`;
      }
    }
  }

  return `مفهوم وإطار تخصصي يشير إلى (${cleanAr}) في أدبيات المجال والدراسات ذات الصلة.`;
}

