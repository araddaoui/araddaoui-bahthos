import { GlossaryTerm } from "../types";

// Comprehensive built-in dictionary for academic, methodological, legal, political, and technical terms
const ACADEMIC_DICTIONARY: Array<{
  keywords: string[];
  term: string;
  draft_term: string;
  verified_term: string;
  definition: string;
}> = [
  {
    keywords: ["westphalian", "westphalia"],
    term: "Westphalian Sovereignty",
    draft_term: "السيادة الويستفالية",
    verified_term: "السيادة الويستفالية",
    definition: "مفهوم قانوني وسياسي يفترض استقلالية الدولة المطلقة وسلطتها الحصرية على أراضيها ومواطنيها دون أي تدخل خارجي."
  },
  {
    keywords: ["eurocentrism", "eurocentric"],
    term: "Eurocentrism",
    draft_term: "المركزية الأوروبية",
    verified_term: "المركزية الأوروبية",
    definition: "منظور فكري يفسر التاريخ والظواهر العالمية من خلال التركيز على القيم والخبرات والمنظومات الغربية كمعيار أساسي."
  },
  {
    keywords: ["standard of civilization", "civilization"],
    term: "Standard of Civilization",
    draft_term: "ستاندرد أوف سيفيليزيشن",
    verified_term: "معيار التحضر",
    definition: "مفهوم تاريخي قانوني استُخدم لتبرير فرض الهيمنة الاستعمارية من خلال تصنيف الدول غير الأوروبية على أنها غير متحضرة."
  },
  {
    keywords: ["legal positivism", "positivism"],
    term: "Legal Positivism",
    draft_term: "الوضعية القانونية",
    verified_term: "الوضعية القانونية",
    definition: "مدرسة في الفلسفة القانونية ترى أن صلاحية القوانين تستند إلى إرادة الدولة والتشريعات الوضعية بدلاً من المبادئ الأخلاقية الطبيعية."
  },
  {
    keywords: ["international society", "society of states"],
    term: "International Society",
    draft_term: "المجتمع الدولي",
    verified_term: "المجتمع الدولي",
    definition: "مجموعة من الدول تجمعها قواعد ومؤسسات ومصالح مشتركة تلتزم بمراعاتها وتنظيم علاقاتها المتبادلة وفقاً لها."
  },
  {
    keywords: ["conceptual framework", "framework"],
    term: "Conceptual Framework",
    draft_term: "كونسيبتوال فريموورك",
    verified_term: "الإطار المفاهيمي",
    definition: "بنية أفكار ونظريات يضعها الباحث لتنظيم الدراسة وتفسير العلاقة بين المتغيرات الأساسية لموضوع البحث."
  },
  {
    keywords: ["methodology", "methodological"],
    term: "Methodology",
    draft_term: "ميثودولوجيا",
    verified_term: "المنهجية البحثية",
    definition: "منظومة القواعد والمبادئ والخطوات العلمية التي يتبعها الباحث لجمع البيانات وتحليلها والوصول إلى النتائج."
  },
  {
    keywords: ["empirical", "empirical analysis"],
    term: "Empirical Analysis",
    draft_term: "التحليل الإمبيريقي",
    verified_term: "التحليل التجريبي/الميداني",
    definition: "أسلوب بحثي يستند إلى الملاحظة المباشرة والتجارب والبيانات الميدانية الواقعية لاختبار الفرضيات بدلاً من التنظير المجرّد."
  },
  {
    keywords: ["epistemology", "epistemological"],
    term: "Epistemology",
    draft_term: "إبستمولوجيا",
    verified_term: "نظرية المعرفة",
    definition: "فرع من الفلسفة يبحث في طبيعة المعرفة وأصلها ونطاقها وحدود وسائط الوصول إليها."
  },
  {
    keywords: ["hegemony", "hegemonic"],
    term: "Hegemony",
    draft_term: "الهيجيمونية",
    verified_term: "الهيمنة السياسية/الفكرية",
    definition: "سيطرة نفوذ دولة أو طبقية أو منظومة فكرية معينة وتسيير قواعد اللعبة في النظام الدولي أو الثقافي."
  },
  {
    keywords: ["constructivism", "constructivist"],
    term: "Constructivism",
    draft_term: "كونستراكتيفيزم",
    verified_term: "البنائية",
    definition: "نظرية في العلاقات الدولية والعلوم الاجتماعية تشير إلى أن هوية الدول ومصالحها تتشكل عبر التفاعل الاجتماعي والثقافي والأفكار المشتركة."
  },
  {
    keywords: ["structural realism", "neorealism", "realism"],
    term: "Structural Realism",
    draft_term: "الواقعية الهيكلية",
    verified_term: "الواقعية الهيكلية",
    definition: "نظرية في السياسة الدولية ترى أن سلوك الدول محكوم بفوضوية هيكل النظام الدولي والسعي للبقاء والقوة."
  },
  {
    keywords: ["multilateralism"],
    term: "Multilateralism",
    draft_term: "المواضيع المباشرة",
    verified_term: "التعددية الدولية",
    definition: "العمل الدبلوماسي والمؤسسي المشترك بين ثلاث دول أو أكثر لتحقيق أهداف وتنظيم القواعد السياسية والاقتصادية."
  },
  {
    keywords: ["normative framework", "normative"],
    term: "Normative Framework",
    draft_term: "الإطار النورماتيفي",
    verified_term: "الإطار المعياري",
    definition: "منظومة القيم والقواعد والأعراف التي تحدد ما يجب أن يكون والسلوك المقبول في مجال معين."
  },
  {
    keywords: ["discourse analysis", "discourse"],
    term: "Discourse Analysis",
    draft_term: "تحليل الديسكورس",
    verified_term: "تحليل الخطاب",
    definition: "منهجية بحثية تُستخدم لدراسة كيفية بناء المعنى والقوة والنفوذ الاجتماعي والثقافي عبر النصوص واللغات."
  },
  {
    keywords: ["hybrid learning", "blended learning"],
    term: "Hybrid Learning",
    draft_term: "هايبريد ليرنينغ",
    verified_term: "التعلم الهجين",
    definition: "نموذج تعليمي يدمج بين المحاضرات الحضور المباشر داخل الفصول والأنشطة الرقمية التفاعلية عبر الإنترنت."
  },
  {
    keywords: ["virtual learning environment", "vle"],
    term: "Virtual Learning Environment",
    draft_term: "فيرتشوال ليرنينغ",
    verified_term: "بيئة التعلم الافتراضية",
    definition: "منصة إلكترونية متكاملة تتيح إدارة المقررات وتداول المواد الدراسية والتفاعل بين الطلاب والأساتذة."
  },
  {
    keywords: ["academic performance", "gpa", "academic achievement"],
    term: "Academic Performance",
    draft_term: "التحصيل الأكاديمي",
    verified_term: "التحصيل الأكاديمي",
    definition: "مستوى الإنجاز ومدى تحقيق الطالب للأهداف التعليمية مقاساً بالدرجات والتقييمات والاختبارات."
  },
  {
    keywords: ["digital divide"],
    term: "Digital Divide",
    draft_term: "الفجوة الرقمية",
    verified_term: "الفجوة الرقمية",
    definition: "التفاوت والتجويف الاجتماعي والتكنولوجي بين الأفراد أو المناطق التي تمتلك اتصالاً بالإنترنت والتقنيات وتلك التي تفتقر إليها."
  },
  {
    keywords: ["quality assurance"],
    term: "Quality Assurance",
    draft_term: "ضمان الجودة",
    verified_term: "ضمان الجودة",
    definition: "مجموعة الإجراءات والمعايير التنظيمية المستمرة للتأكد من استيفاء البرامج والمخرجات التعليمية للمستويات الأكاديمية المطلوبة."
  },
  {
    keywords: ["psychological wellbeing", "wellbeing", "anxiety"],
    term: "Psychological Wellbeing",
    draft_term: "الرخاء النفسي",
    verified_term: "الرفاه والصحة النفسية",
    definition: "حالة الاستقرار العاطفي والنفسي والقدرة على التعامل مع الضغوط والتكيف الأكاديمي والاجتماعي."
  },
  {
    keywords: ["academic isolation", "isolation"],
    term: "Academic Isolation",
    draft_term: "العزلة الأكاديمية",
    verified_term: "العزلة الأكاديمية",
    definition: "شعور الطالب بالانفصال والابتعاد عن مجتمع التعلم والزملاء نتيجة غياب التواصل المباشر في التعليم الرقمي."
  },
  {
    keywords: ["correlation"],
    term: "Correlation",
    draft_term: "كوروليشن",
    verified_term: "الارتباط الإحصائي",
    definition: "مقاييس إحصائية تعبر عن مدى وجود علاقة اتجاهية وقوة التغير بين متغيرين أو أكثر."
  },
  {
    keywords: ["standard deviation"],
    term: "Standard Deviation",
    draft_term: "ستاندرد ديفييشن",
    verified_term: "الانحراف المعياري",
    definition: "مقياس إحصائي لقياس مدى تشتت وتباعد قيم البيانات عن متوسطها الحسابي."
  },
  {
    keywords: ["sample size", "sample"],
    term: "Sample Size",
    draft_term: "حجم العينة",
    verified_term: "حجم العينة البحثية",
    definition: "عدد الأفراد أو الحالات المحددة التي جرى اختيارها من مجتمع الدراسة لجمع البيانات واختبار الفرضيات."
  }
];

export function isValidAcademicConcept(item: { term: string; definition?: string; draft_term?: string; verified_term?: string }): boolean {
  if (!item || !item.term || typeof item.term !== "string") return false;
  const t = item.term.trim().toLowerCase();
  const def = (item.definition || "").trim().toLowerCase();
  const draft = (item.draft_term || "").trim().toLowerCase();
  const verified = (item.verified_term || "").trim().toLowerCase();

  // 1. Length & Basic Structure Checks
  if (t.length < 2 || t.length > 70) return false;
  if (t.split(/\s+/).length > 6) return false; // concepts are 1-6 words max
  if (/^(vol|volume|no|issue|pp|pages?|page|\d+|http|https|doi|isbn|issn)\b/i.test(t)) return false;

  // 2. Reject empty definitions
  if (!def || def.length < 10) return false;

  // 3. Banned Person Names / Author Names / Publishers
  const BANNED_NAME_TOKENS = [
    "jollie", "carol", "javed", "khumalo", "sharma", "chiriac", "ramsuraj", "cantillon",
    "siddiqui", "ahmad", "khan", "pedag", "tatiana", "trisha", "seddik",
    "springer", "elsevier", "routledge", "ieee", "wiley", "nature", "sage", 
    "oxford", "cambridge", "jstor", "pubmed", "scopus", "web of science", "frontiers", "mdpi",
    "emerald", "proquest", "arxiv", "researchgate", "academia.edu", "google scholar"
  ];

  for (const nameToken of BANNED_NAME_TOKENS) {
    if (t.includes(nameToken) || draft.includes(nameToken) || verified.includes(nameToken)) {
      return false;
    }
  }

  // 4. Banned Bibliographic Section Headings & Meta Items
  const BANNED_WORDS = [
    "journal of", "proceedings of", "bulletin of", "annals of", "review of", "handbook of",
    "edited by", "table of contents", "page number", "references list", "abstract section"
  ];

  for (const word of BANNED_WORDS) {
    if (t.includes(word)) return false;
  }

  // 5. Banned Arabic Metadata Indicators
  const BANNED_ARABIC_INDICATORS = [
    "دار نشر", "اسم ناشر", "اسم مؤلف", "عنوان كتاب", "عنوان ورقة", "عنوان دراسة",
    "عنوان مقال", "مجلة علمية", "دورية علمية", "جدول المحتويات", "قائمة المراجع",
    "رسالة ماجستير", "أطروحة دكتوراه", "بحث بعنوان", "كتاب بعنوان"
  ];

  for (const ind of BANNED_ARABIC_INDICATORS) {
    if (t.includes(ind) || draft.includes(ind) || verified.includes(ind)) {
      return false;
    }
  }

  return true;
}

export function performLocalTermExtraction(text: string, sourceId?: string): GlossaryTerm[] {
  if (!text || text.trim().length < 10) return [];

  const textLower = text.toLowerCase();
  const extractedTerms: GlossaryTerm[] = [];
  const addedTermKeys = new Set<string>();

  // Helper to extract a surrounding sentence context as a definition
  const getContextSentence = (phrase: string): string => {
    const idx = text.indexOf(phrase);
    if (idx === -1) return `مصطلح ومفهوم محوري استخلص من تحليل متن المستند المرفوع.`;
    const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
    let end = text.indexOf(".", idx + phrase.length);
    if (end === -1) end = Math.min(text.length, idx + 200);
    const sentence = text.substring(start, end).trim().replace(/\s+/g, " ");
    if (sentence.length >= 20 && sentence.length <= 250) {
      return sentence;
    }
    return `مفهوم علمي وتخصصي تم استخلاصه مباشرة من النص في سياق: "${sentence.substring(0, 120)}..."`;
  };

  // 1. Match against curated dictionary entries
  for (const entry of ACADEMIC_DICTIONARY) {
    const matched = entry.keywords.some((kw) => textLower.includes(kw));
    if (matched && !addedTermKeys.has(entry.term.toLowerCase())) {
      const termObj = {
        term: entry.term,
        transliteration: entry.verified_term,
        draft_term: entry.draft_term,
        verified_term: entry.verified_term,
        definition: entry.definition,
        sourceId: sourceId
      };

      if (isValidAcademicConcept(termObj)) {
        addedTermKeys.add(entry.term.toLowerCase());
        addedTermKeys.add(entry.verified_term.toLowerCase());
        extractedTerms.push(termObj);
      }
    }
  }

  // 2. Dynamic Arabic Domain Term Discovery (Common domain phrases in scientific & technical literature)
  const commonDomainPhrases = [
    "الذكاء الاصطناعي", "التعلم العميق", "تعلم الآلة", "إدارة المعرفة", "التحول الرقمي",
    "الرعاية الصحية", "التحليل المالي", "الجودة الشاملة", "السياسات العامة", "الحوكمة المؤسسية",
    "إدارة المخاطر", "الأمن السيبراني", "التنظيم الذاتي", "البيانات الضخمة", "سلسلة الكتل",
    "الحوسبة السحابية", "التنمية المستدامة", "التسويق الرقمي", "القانون الدولي", "الاستقرار المالي",
    "الطباعة ثلاثية الأبعاد", "إنترنت الأشياء", "علم البيانات", "الهندسة الوراثية", "التعلم الهجين",
    "التعليم الرقمي", "ضمان الجودة", "المنهجية البحثية", "التحليل التجريبي", "الإطار المفاهيمي",
    "تحليل البيانات", "التصميم البحثي", "تقييم الأثر", "التوازن البيئي", "الطاقة المتجددة",
    "التجارة الإلكترونية", "الاقتصاد الدائري", "الأمن الغذائي", "التنمية البشرية", "التخطيط الاستراتيجي"
  ];

  for (const phrase of commonDomainPhrases) {
    if (text.includes(phrase) && !addedTermKeys.has(phrase.toLowerCase())) {
      const termObj = {
        term: phrase,
        transliteration: phrase,
        draft_term: phrase,
        verified_term: phrase,
        definition: getContextSentence(phrase),
        sourceId: sourceId
      };

      if (isValidAcademicConcept(termObj)) {
        addedTermKeys.add(phrase.toLowerCase());
        extractedTerms.push(termObj);
      }
    }
  }

  // 3. Dynamic English Multi-Word Concept Extraction (e.g. "Machine Learning", "Public Policy")
  const englishConceptRegex = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})\b/g;
  let enMatch: RegExpExecArray | null;
  while ((enMatch = englishConceptRegex.exec(text)) !== null && extractedTerms.length < 12) {
    const enPhrase = enMatch[1].trim();
    const enLower = enPhrase.toLowerCase();

    // Skip common stop-phrase matches
    if (/^(United States|United Kingdom|Table Of|Page Number|Journal Of|Volume|Issue|Research Paper|University Of|Department Of|Google Scholar)/i.test(enPhrase)) {
      continue;
    }

    if (!addedTermKeys.has(enLower)) {
      const termObj = {
        term: enPhrase,
        transliteration: enPhrase,
        draft_term: enPhrase,
        verified_term: enPhrase,
        definition: getContextSentence(enPhrase),
        sourceId: sourceId
      };

      if (isValidAcademicConcept(termObj)) {
        addedTermKeys.add(enLower);
        extractedTerms.push(termObj);
      }
    }
  }

  // 4. Dynamic Arabic Concept Pattern Discovery (`الـ... الـ...`)
  const arabicPatternRegex = /\b(ال[آأإء-ي]{3,}\s+ال[آأإء-ي]{3,}(?:\s+ال[آأإء-ي]{3,})?)\b/g;
  let arPatternMatch: RegExpExecArray | null;
  while ((arPatternMatch = arabicPatternRegex.exec(text)) !== null && extractedTerms.length < 15) {
    const arPhrase = arPatternMatch[1].trim();
    const arLower = arPhrase.toLowerCase();

    // Skip stop phrases
    if (arPhrase.includes("التي") || arPhrase.includes("الذي") || arPhrase.includes("الذين") || arPhrase.includes("اللذين") || arPhrase.includes("الصفحة") || arPhrase.includes("المكتبة")) {
      continue;
    }

    if (!addedTermKeys.has(arLower)) {
      const termObj = {
        term: arPhrase,
        transliteration: arPhrase,
        draft_term: arPhrase,
        verified_term: arPhrase,
        definition: getContextSentence(arPhrase),
        sourceId: sourceId
      };

      if (isValidAcademicConcept(termObj)) {
        addedTermKeys.add(arLower);
        extractedTerms.push(termObj);
      }
    }
  }

  return extractedTerms;
}
