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

export function performLocalTermExtraction(text: string, sourceId?: string): GlossaryTerm[] {
  if (!text || text.trim().length < 10) return [];

  const textLower = text.toLowerCase();
  const extractedTerms: GlossaryTerm[] = [];
  const addedTermKeys = new Set<string>();

  // 1. Match against academic dictionary keywords
  for (const entry of ACADEMIC_DICTIONARY) {
    const matched = entry.keywords.some((kw) => textLower.includes(kw));
    if (matched && !addedTermKeys.has(entry.term.toLowerCase())) {
      addedTermKeys.add(entry.term.toLowerCase());
      extractedTerms.push({
        term: entry.term,
        transliteration: entry.verified_term,
        draft_term: entry.draft_term,
        verified_term: entry.verified_term,
        definition: entry.definition,
        sourceId: sourceId
      });
    }
  }

  // 2. Extract capitalized multi-word phrases (e.g., "North Africa", "Conceptual Framework", "Regional Integration")
  const capRegex = /\b([A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,}){1,2})\b/g;
  let match: RegExpExecArray | null;
  let customCount = 0;

  while ((match = capRegex.exec(text)) !== null && customCount < 5) {
    const rawPhrase = match[1].trim();
    const rawLower = rawPhrase.toLowerCase();

    // Skip common generic English words
    if (
      rawLower.includes("table of") ||
      rawLower.includes("page number") ||
      rawLower.includes("university press") ||
      rawLower.includes("all rights")
    ) {
      continue;
    }

    if (!addedTermKeys.has(rawLower)) {
      addedTermKeys.add(rawLower);
      customCount++;
      extractedTerms.push({
        term: rawPhrase,
        transliteration: rawPhrase,
        draft_term: rawPhrase,
        verified_term: rawPhrase,
        definition: `مفهوم أو عنوان بحثي رئيسي مستخرج من نص المستند (${rawPhrase}).`,
        sourceId: sourceId
      });
    }
  }

  // 3. Extract Arabic academic terms enclosed in quotes or parentheses or specific key phrases
  const arabicTermsRegex = /(?:السيادة الويستفالية|المركزية الأوروبية|معيار التحضر|الوضعية القانونية|المجتمع الدولي|الإطار المفاهيمي|المنهجية البحثية|التحليل التجريبي|نظرية المعرفة|الهيمنة|البنائية|الواقعية الهيكلية|التعددية|الإطار المعياري|تحليل الخطاب|التعلم الهجين|بيئة التعلم الافتراضية|التحصيل الأكاديمي|الفجوة الرقمية|ضمان الجودة|الرفاه النفسي|العزلة الأكاديمية|الارتباط الإحصائي|الانحراف المعياري)/g;
  
  let arMatch: RegExpExecArray | null;
  while ((arMatch = arabicTermsRegex.exec(text)) !== null && customCount < 8) {
    const arPhrase = arMatch[0].trim();
    const arLower = arPhrase.toLowerCase();

    if (!addedTermKeys.has(arLower)) {
      addedTermKeys.add(arLower);
      customCount++;
      
      // Find matching entry definition if possible
      const dictMatch = ACADEMIC_DICTIONARY.find(
        (d) => d.verified_term === arPhrase || d.draft_term === arPhrase
      );

      extractedTerms.push({
        term: dictMatch?.term || arPhrase,
        transliteration: arPhrase,
        draft_term: arPhrase,
        verified_term: arPhrase,
        definition: dictMatch?.definition || `مصطلح أكاديمي محوري استخلص من تحليل متن المستند.`,
        sourceId: sourceId
      });
    }
  }

  return extractedTerms;
}
