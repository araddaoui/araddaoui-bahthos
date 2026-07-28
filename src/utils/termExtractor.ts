import { GlossaryTerm } from "../types";

// Blacklist filter to block trivial/irrelevant proper names, place names, scholar names, journal names, header metadata, section headers, sentence fragments, and citations
export function isTrivialOrCitationTerm(term: string, definition?: string): boolean {
  if (!term) return true;
  const cleanTerm = term.trim().toLowerCase();

  // Too short or too long
  if (cleanTerm.length < 3 || cleanTerm.length > 50) return true;

  // Contains citation numbers, ISSN, DOI, URLs, page ranges, or header symbols
  if (/[0-9]|issn|doi|http|www|vol|n°|\bno\b|pp\.|isbn|journal|college|university|press|comillas|london|edited|published|accessed|downloaded/i.test(cleanTerm)) {
    return true;
  }

  // Reject citation verbs and author attribution fragments
  if (/\b(cite|citation|cited|author|edited|published|publisher|copyright|rights reserved|et al|ibid|op cit|translator|translated)\b/i.test(cleanTerm)) {
    return true;
  }

  // Reject sentence fragments / conjunctions / adverbs starting English phrases (e.g., "Yet Qatar", "Roberts To", "To cite", "However...")
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
    "joseph nye",
    "nye",
    "roberts to",
    "roberts",
    "david b",
    "david",
    "tamim",
    "emir tamim",
    "john",
    "smith",
    "keohane",
    "waltz",
    "mearsheimer",
    "huntington",
    "fukuyama",
    "morgenthau",
    "bull",
    "wendt"
  ];
  if (scholarAndAuthorNames.some((sa) => cleanTerm === sa || cleanTerm.startsWith(sa + " ") || cleanTerm.endsWith(" " + sa))) {
    return true;
  }

  // Reject geographical regions, country names, city names, and military bases when used as standalone places
  const geographicalAndPlaces = [
    "middle east",
    "qatar",
    "doha",
    "london",
    "al udeid",
    "as sayliyah",
    "sayliyah",
    "udeid",
    "united states",
    "europe",
    "asia",
    "latin america",
    "persian gulf",
    "arabian gulf",
    "الشرق الأوسط",
    "قطر",
    "الدوحة",
    "لندن",
    "واشنطن"
  ];
  if (geographicalAndPlaces.some((gp) => cleanTerm === gp)) {
    return true;
  }

  // Reject trivial phrases and generic non-concept noise
  const trivialPhrasesAndNames = [
    "as sayliyah",
    "al udeid",
    "sayliyah",
    "brotherhood david",
    "brotherhood",
    "emir tamim",
    "college london",
    "king college",
    "comillas journal",
    "oxford university",
    "cambridge university",
    "harvard university",
    "executive summary",
    "full terms",
    "terms of use",
    "privacy policy",
    "special issue",
    "original article",
    "research paper",
    "case study",
    "data collection",
    "main findings",
    "key results",
    "recent years",
    "future research",
    "أسلوب العمل",
    "طريقة العمل",
    "خطوات العمل",
    "نطاق البحث"
  ];

  if (trivialPhrasesAndNames.some((tp) => cleanTerm.includes(tp))) {
    return true;
  }

  // Reject individual proper names or single generic words that are not recognized concepts
  if (!cleanTerm.includes(" ") && !cleanTerm.startsWith("ال")) {
    const validSingleWordConcepts = new Set([
      "realism",
      "constructivism",
      "eurocentrism",
      "pedagogy",
      "correlation",
      "sovereignty",
      "hegemony",
      "neorealism",
      "neoliberalism",
      "multipolarity",
      "unipolarity",
      "bipolarity",
      "deterrence",
      "brinkmanship",
      "الواقعية",
      "البنائية",
      "العولمة",
      "المركزيّة",
      "السيادة",
      "الديمقراطية",
      "الليبرالية",
      "الهيمنة",
      "الردع",
      "القطبية"
    ]);
    if (!validSingleWordConcepts.has(cleanTerm)) {
      return true;
    }
  }

  // Check definition for citation/footer/header garbage if provided
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

// Known academic dictionary for high-precision matching
const ACADEMIC_DICTIONARY: Record<string, { arabic: string; definition: string }> = {
  "westphalian sovereignty": {
    arabic: "السيادة الويستفالية",
    definition: "مفهوم قانوني وسياسي يفترض استقلالية الدولة المطلقة وسلطتها الحصرية على أراضيها ومواطنيها دون أي تدخل خارجي."
  },
  "eurocentrism": {
    arabic: "المركزية الأوروبية",
    definition: "منظور فكري يفسر التاريخ والظواهر العالمية من خلال التركيز على القيم والخبرات والمنظومات الغربية كمعيار أساسي."
  },
  "standard of civilization": {
    arabic: "معيار التحضر",
    definition: "مفهوم تاريخي قانوني استُخدم لتبرير فرض الهيمنة الاستعمارية من خلال تصنيف الدول غير الأوروبية على أنها غير متحضرة."
  },
  "legal positivism": {
    arabic: "الوضعية القانونية",
    definition: "مدرسة في الفلسفة القانونية ترى أن صلاحية القوانين تستند إلى إرادة الدولة والتشريعات الوضعية بدلاً من المبادئ الأخلاقية الطبيعية."
  },
  "international society": {
    arabic: "المجتمع الدولي",
    definition: "مجموعة من الدول تجمعها قواعد ومؤسسات ومصالح مشتركة تلتزم بمراعاتها وتنظيم علاقاتها المتبادلة وفقاً لها."
  },
  "foreign policy": {
    arabic: "السياسة الخارجية",
    definition: "استراتيجية وتفاعلات الدولة مع الفاعلين الدوليين لتحقيق مصالحها الوطنية في الساحة الدولية."
  },
  "balance of power": {
    arabic: "توازن القوى",
    definition: "توزيع القدرات العسكرية والاقتصادية بين الدول لمنع قيام دولة واحدة بالهيمنة على النظام الدولي."
  },
  "soft power": {
    arabic: "القوة الناعمة",
    definition: "قدرة الدولة على التأثير والاقناع في العلاقات الدولية عبر الجاذبية الثقافية والقيم والسياسات بدلاً من الإكراه العسكري."
  },
  "realism": {
    arabic: "الواقعية السياسية",
    definition: "نظرية في العلاقات الدولية تفسر السلوك الدولي بناءً على السعي المباشر نحو القوة والمصلحة الوطنية في بيئة دولية فوضوية."
  },
  "constructivism": {
    arabic: "البنائية في العلاقات الدولية",
    definition: "منظور نظري يرى أن المصالح والهويات الدولية تتشكل عبر الأفكار والقيم والتفاعلات الاجتماعية بدلاً من الهياكل المادية فقط."
  },
  "blended learning": {
    arabic: "التعلم المدمج",
    definition: "نمط تعليمي يجمع بين التعليم التقليدي وجهات لوجه والأنشطة والوسائط التعليمية عبر الإنترنت."
  },
  "distance learning": {
    arabic: "التعلم عن بعد",
    definition: "أسلوب تعليمي يعتمد على توفير المقررات الدراسية والتفاعل الأكاديمي عبر الوسائط الرقمية دون حضور الجسدي."
  },
  "e-learning": {
    arabic: "التعلم الإلكتروني",
    definition: "منظومة تعليمية تعتمد على تقنيات الاتصال والمعلومات لتقديم المحتوى وتسهيل عمليات التعلم."
  },
  "quality assurance": {
    arabic: "ضمان الجودة",
    definition: "منظومة الإجراءات والمعايير المؤسسية والأكاديمية المستمرة للتحقق من كفاءة ومخرجات العملية التعليمية."
  },
  "academic self-regulation": {
    arabic: "التنظيم الذاتي الأكاديمي",
    definition: "قدرة المتعلم على تخطيط ومراقبة وتقييم عملية التعلم الخاصة به بشكل مستقل وفعال."
  },
  "artificial intelligence": {
    arabic: "الذكاء الاصطناعي",
    definition: "أنظمة وبرمجيات محاكاة القدرات الذهنية البشرية كالتعلم والاستنتاج والتحليل واتخاذ القرارات."
  },
  "machine learning": {
    arabic: "تعلم الآلة",
    definition: "فرع من الذكاء الاصطناعي يتيح للأنظمة التعلم وتحسين أدائها تلقائياً من خلال تحليل البيانات دون برمجة صريحة."
  },
  "data science": {
    arabic: "علم البيانات",
    definition: "مجال متعدد التخصصات يستخدم الأساليب والأدوات العلمية لاستخراج المعرفة والرؤى القابلة للتطبيق من البيانات."
  }
};

// Patterns for Arabic academic noun phrases
const ARABIC_CONCEPT_PATTERNS = [
  "السيادة الوطنية",
  "السيادة الويستفالية",
  "المركزية الأوروبية",
  "الوضعية القانونية",
  "المجتمع الدولي",
  "معيار التحضر",
  "السياسة الخارجية",
  "توازن القوى",
  "القوة الناعمة",
  "الواقعية السياسية",
  "البنائية الدولية",
  "العلاقات الدولية",
  "ضمان الجودة",
  "التعليم عن بعد",
  "التعلم الإلكتروني",
  "التعلم المدمج",
  "التحصيل الأكاديمي",
  "التنظيم الذاتي",
  "الذكاء الاصطناعي",
  "الأمن السيبراني",
  "الحوسبة السحابية",
  "التنمية المستدامة",
  "التحول الرقمي",
  "إدارة المعرفة"
];

/**
 * Extracts concepts and terms from text offline as a fallback or supplement
 */
export function extractFallbackTermsFromText(text: string, sourceId?: string): GlossaryTerm[] {
  if (!text || text.trim().length < 10) return [];

  const lowerText = text.toLowerCase();
  const extracted: GlossaryTerm[] = [];
  const addedKeys = new Set<string>();

  // 1. Check known academic terms dictionary (Max 3 per source)
  Object.entries(ACADEMIC_DICTIONARY).forEach(([engTerm, data]) => {
    if (extracted.length >= 3) return;
    if (lowerText.includes(engTerm) || lowerText.includes(data.arabic.toLowerCase())) {
      if (!addedKeys.has(engTerm) && !isTrivialOrCitationTerm(engTerm, data.definition)) {
        addedKeys.add(engTerm);
        extracted.push({
          term: engTerm.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          transliteration: data.arabic,
          draft_term: data.arabic,
          verified_term: data.arabic,
          definition: data.definition,
          sourceId
        });
      }
    }
  });

  // 2. Check predefined Arabic concept patterns (if needed)
  if (extracted.length < 3) {
    ARABIC_CONCEPT_PATTERNS.forEach((arabicTerm) => {
      if (extracted.length >= 3) return;
      if (text.includes(arabicTerm)) {
        const key = arabicTerm;
        if (!addedKeys.has(key)) {
          const def = buildContextDefinition(arabicTerm, text);
          if (!isTrivialOrCitationTerm(arabicTerm, def)) {
            addedKeys.add(key);
            extracted.push({
              term: key,
              transliteration: arabicTerm,
              draft_term: arabicTerm,
              verified_term: arabicTerm,
              definition: def,
              sourceId
            });
          }
        }
      }
    });
  }

  // 3. Extract terms enclosed in parentheses like (السيادة الويستفالية) or (Soft Power)
  if (extracted.length < 3) {
    const parenRegex = /\(([^)]+)\)/g;
    let match;
    while ((match = parenRegex.exec(text)) !== null && extracted.length < 3) {
      const inside = match[1].trim();
      if (inside.length >= 5 && inside.length <= 40 && !isTrivialOrCitationTerm(inside)) {
        const termKey = inside.toLowerCase();
        if (!addedKeys.has(termKey)) {
          addedKeys.add(termKey);
          extracted.push({
            term: inside,
            transliteration: inside,
            draft_term: inside,
            verified_term: inside,
            definition: `مفهوم وأداة تحليلية أكاديمية وردت في السياق حول ${inside}.`,
            sourceId
          });
        }
      }
    }
  }

  return extracted;
}

function buildContextDefinition(term: string, fullText: string): string {
  // Locate sentence containing term, filtering out citation noise
  const cleanSentences = fullText
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && !/issn|doi|journal|n°|volume|pp\.|http|terms|cite/i.test(s));

  for (const sentence of cleanSentences) {
    if (sentence.toLowerCase().includes(term.toLowerCase())) {
      if (sentence.length <= 160) {
        return sentence + ".";
      }
      return sentence.substring(0, 150) + "...";
    }
  }
  return `مفهوم ومصطلح أكاديمي محوري تمت مناقشته في إطار تحليل ${term}.`;
}
