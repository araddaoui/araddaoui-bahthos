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
    keywords: ["global south", "south-south"],
    term: "Global South",
    draft_term: "الجنوب العالمي",
    verified_term: "الجنوب العالمي",
    definition: "مفهوم جيو-سياسي واقتصادي يُستخدم للإشارة إلى الدول النامية والإقليمية الممتدة في إفريقيا وأمريكا اللاتينية وآسيا في مقابل الشمال المتقدم."
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
  },
  {
    keywords: ["balance of power"],
    term: "Balance of Power",
    draft_term: "توازن القوى",
    verified_term: "توازن القوى",
    definition: "مفهوم محوري في العلاقات الدولية يشير إلى توزيع القدرات العسكرية والاقتصادية بين الدول لمنع هيمنة طرف واحد."
  },
  {
    keywords: ["soft power"],
    term: "Soft Power",
    draft_term: "القوة الناعمة",
    verified_term: "القوة الناعمة",
    definition: "القدرة على التأثير وجذب الآخرين عبر القيم الثقافية، والدبلوماسية، والنموذج السياسي بدلاً من الإكراه العسكري."
  },
  {
    keywords: ["deterrence", "deterrence theory"],
    term: "Deterrence Theory",
    draft_term: "نظرية الردع",
    verified_term: "نظرية الردع",
    definition: "استراتيجية تقوم على تهديد الخصم بعواقب وخيمة لمنعه من الإقدام على سلوك عدائي أو عسكري."
  },
  {
    keywords: ["international political economy", "ipe"],
    term: "International Political Economy",
    draft_term: "الاقتصاد السياسي الدولي",
    verified_term: "الاقتصاد السياسي الدولي",
    definition: "حقل دراسي يتناول التفاعل المتبادل بين القوى السياسية الدولية والأسواق والأنشطة الاقتصادية العالمية."
  },
  {
    keywords: ["public policy"],
    term: "Public Policy",
    draft_term: "السياسة العامة",
    verified_term: "السياسة العامة",
    definition: "مجموعة القرارات والتوجهات والبرامج الحكومية المعتمدة لمعالجة القضايا والمشكلات الملموسة في المجتمع."
  },
  {
    keywords: ["governance", "good governance"],
    term: "Governance",
    draft_term: "الحوكمة",
    verified_term: "الحوكمة المؤسسية",
    definition: "منظومة القواعد والإجراءات والآليات التي تضمن الشفافية والمحاسبة والمساءلة في إدارة المؤسسات والدول."
  }
];

export const CONCEPT_DICTIONARY: Record<string, string> = {
  "westphalian sovereignty": "السيادة الويستفالية",
  "eurocentrism": "المركزية الأوروبية",
  "standard of civilization": "معيار التحضر",
  "legal positivism": "الوضعية القانونية",
  "international society": "المجتمع الدولي",
  "conceptual framework": "الإطار المفاهيمي",
  "methodology": "المنهجية البحثية",
  "empirical analysis": "التحليل التجريبي",
  "epistemology": "نظرية المعرفة",
  "hegemony": "الهيمنة",
  "constructivism": "البنائية",
  "structural realism": "الواقعية الهيكلية",
  "neorealism": "الواقعية الهيكلية",
  "classical realism": "الواقعية الكلاسيكية",
  "realism": "الواقعية",
  "liberalism": "الليبرالية",
  "neoliberalism": "الليبرالية الجديدة",
  "multilateralism": "التعددية الدولية",
  "bilateralism": "الثنائية الدولية",
  "normative framework": "الإطار المعياري",
  "discourse analysis": "تحليل الخطاب",
  "hybrid learning": "التعلم الهجين",
  "blended learning": "التعلم الهجين",
  "virtual learning environment": "بيئة التعلم الافتراضية",
  "academic performance": "التحصيل الأكاديمي",
  "digital divide": "الفجوة الرقمية",
  "quality assurance": "ضمان الجودة",
  "psychological wellbeing": "الرفاه والصحة النفسية",
  "academic isolation": "العزلة الأكاديمية",
  "correlation": "الارتباط الإحصائي",
  "standard deviation": "الانحراف المعياري",
  "sample size": "حجم العينة البحثية",
  "balance of power": "توازن القوى",
  "soft power": "القوة الناعمة",
  "hard power": "القوة الصلبة",
  "smart power": "القوة الذكية",
  "deterrence theory": "نظرية الردع",
  "deterrence": "الردع الاستراتيجي",
  "international political economy": "الاقتصاد السياسي الدولي",
  "political economy": "الاقتصاد السياسي",
  "public policy": "السياسة العامة",
  "governance": "الحوكمة المؤسسية",
  "institutional governance": "الحوكمة المؤسسية",
  "security dilemma": "المعضلة الأمنية",
  "anarchy": "الفوضوية الدولية",
  "interdependence": "الاعتماد المتبادل",
  "complex interdependence": "الاعتماد المتبادل المعقد",
  "strategic culture": "الثقافة الاستراتيجية",
  "artificial intelligence": "الذكاء الاصطناعي",
  "ai": "الذكاء الاصطناعي",
  "deep learning": "التعلم العميق",
  "machine learning": "تعلم الآلة",
  "data science": "علم البيانات",
  "big data": "البيانات الضخمة",
  "cyber security": "الأمن السيبراني",
  "cybersecurity": "الأمن السيبراني",
  "internet of things": "إنترنت الأشياء",
  "knowledge management": "إدارة المعرفة",
  "digital transformation": "التحول الرقمي",
  "risk management": "إدارة المخاطر",
  "sustainable development": "التنمية المستدامة",
  "qualitative research": "النوعية/الكيفية",
  "quantitative research": "الكمية",
  "research methodology": "منهجية البحث",
  "global south": "الجنوب العالمي",
  "global north": "الشمال العالمي",
  "civil society": "المجتمع المدني",
  "human rights": "حقوق الإنسان",
  "postcolonialism": "ما بعد الاستعمار",
  "post-colonialism": "ما بعد الاستعمار",
  "postcolonial theory": "نظرية ما بعد الاستعمار",
  "cultural diplomacy": "الدبلوماسية الثقافية",
  "public diplomacy": "الدبلوماسية العامة",
  "bipolarity": "القطبية الثنائية",
  "multipolarity": "القطبية المتعددة",
  "unipolarity": "القطبية الأحادية",
  "transnationalism": "العابرة للقوميات",
  "subaltern studies": "دراسات التابع",
  "critical theory": "النظرية النقدية"
};

// Inverse Arabic-to-English dictionary lookup table
export const ARABIC_TO_ENGLISH_DICTIONARY: Record<string, string> = {
  "الجنوب العالمي": "Global South",
  "الشمال العالمي": "Global North",
  "المجتمع المدني": "Civil Society",
  "حقوق الإنسان": "Human Rights",
  "ما بعد الاستعمار": "Postcolonialism",
  "نظرية ما بعد الاستعمار": "Postcolonial Theory",
  "الدبلوماسية الثقافية": "Cultural Diplomacy",
  "الدبلوماسية العامة": "Public Diplomacy",
  "القوة الناعمة": "Soft Power",
  "القوة الصلبة": "Hard Power",
  "القوة الذكية": "Smart Power",
  "القطبية الثنائية": "Bipolarity",
  "القطبية المتعددة": "Multipolarity",
  "القطبية الأحادية": "Unipolarity",
  "الاقتصاد السياسي": "Political Economy",
  "الاقتصاد السياسي الدولي": "International Political Economy",
  "الثقافة الاستراتيجية": "Strategic Culture",
  "المعضلة الأمنية": "Security Dilemma",
  "توازن القوى": "Balance of Power",
  "الاعتماد المتبادل": "Interdependence",
  "الاعتماد المتبادل المعقد": "Complex Interdependence",
  "العابرة للقوميات": "Transnationalism",
  "دراسات التابع": "Subaltern Studies",
  "النظرية النقدية": "Critical Theory",
  "الإطار المعياري": "Normative Framework",
  "تحليل الخطاب": "Discourse Analysis",
  "نظرية الردع": "Deterrence Theory",
  "السيادة الويستفالية": "Westphalian Sovereignty",
  "المركزية الأوروبية": "Eurocentrism",
  "معيار التحضر": "Standard of Civilization",
  "الوضعية القانونية": "Legal Positivism",
  "المجتمع الدولي": "International Society",
  "الإطار المفاهيمي": "Conceptual Framework",
  "المنهجية البحثية": "Research Methodology",
  "منهجية البحث": "Research Methodology",
  "التحليل التجريبي": "Empirical Analysis",
  "نظرية المعرفة": "Epistemology",
  "الهيمنة": "Hegemony",
  "البنائية": "Constructivism",
  "الواقعية الهيكلية": "Structural Realism",
  "الواقعية": "Realism",
  "الليبرالية": "Liberalism",
  "التعددية الدولية": "Multilateralism",
  "التعلم الهجين": "Hybrid Learning",
  "بيئة التعلم الافتراضية": "Virtual Learning Environment",
  "التحصيل الأكاديمي": "Academic Performance",
  "الفجوة الرقمية": "Digital Divide",
  "ضمان الجودة": "Quality Assurance",
  "الارتباط الإحصائي": "Correlation",
  "الانحراف المعياري": "Standard Deviation",
  "حجم العينة البحثية": "Sample Size",
  "السياسة العامة": "Public Policy",
  "الحوكمة المؤسسية": "Institutional Governance",
  "الحوكمة": "Governance",
  "الذكاء الاصطناعي": "Artificial Intelligence",
  "تعلم الآلة": "Machine Learning",
  "التعلم العميق": "Deep Learning",
  "الأمن السيبراني": "Cybersecurity",
  "إنترنت الأشياء": "Internet of Things",
  "إدارة المعرفة": "Knowledge Management",
  "التحول الرقمي": "Digital Transformation",
  "التنمية المستدامة": "Sustainable Development"
};

export function getConceptPair(item: { term: string; draft_term?: string; verified_term?: string; transliteration?: string }): { arabicTerm: string; englishTerm: string; dictDefinition?: string } {
  if (!item) return { arabicTerm: "", englishTerm: "" };

  const termStr = (item.term || "").trim();
  const draftStr = (item.draft_term || "").trim();
  const verifiedStr = (item.verified_term || item.transliteration || "").trim();

  const isTermArabic = /[\u0600-\u06FF]/.test(termStr);
  const isDraftArabic = /[\u0600-\u06FF]/.test(draftStr);
  const isVerifiedArabic = /[\u0600-\u06FF]/.test(verifiedStr);

  let arabicTerm = "";
  let englishTerm = "";

  if (isTermArabic) {
    arabicTerm = termStr;
    if (verifiedStr && !isVerifiedArabic) {
      englishTerm = verifiedStr;
    } else if (draftStr && !isDraftArabic) {
      englishTerm = draftStr;
    }
  } else {
    englishTerm = termStr;
    if (verifiedStr && isVerifiedArabic) {
      arabicTerm = verifiedStr;
    } else if (draftStr && isDraftArabic) {
      arabicTerm = draftStr;
    }
  }

  // Dictionary lookups for missing side
  if (!arabicTerm && englishTerm) {
    const lowerEn = englishTerm.toLowerCase();
    arabicTerm = CONCEPT_DICTIONARY[lowerEn] || (isVerifiedArabic ? verifiedStr : isDraftArabic ? draftStr : "");
  }

  if (!englishTerm && arabicTerm) {
    if (ARABIC_TO_ENGLISH_DICTIONARY[arabicTerm]) {
      englishTerm = ARABIC_TO_ENGLISH_DICTIONARY[arabicTerm];
    } else {
      const foundEntry = Object.entries(CONCEPT_DICTIONARY).find(([_, ar]) => ar === arabicTerm);
      if (foundEntry) {
        englishTerm = foundEntry[0].replace(/\b\w/g, (c) => c.toUpperCase());
      } else if (verifiedStr && !isVerifiedArabic) {
        englishTerm = verifiedStr;
      } else if (draftStr && !isDraftArabic) {
        englishTerm = draftStr;
      }
    }
  }

  // Fallback: Use clean terms without dummy placeholders like "مفهوم متخصص" or "Academic Concept"
  let finalArabic = arabicTerm && arabicTerm !== "مفهوم متخصص" ? arabicTerm : (isTermArabic ? termStr : englishTerm);
  let finalEnglish = englishTerm && englishTerm !== "Academic Concept" ? englishTerm : (!isTermArabic ? termStr : arabicTerm);

  // Auto-enrich definition from ACADEMIC_DICTIONARY if available
  const matchDict = ACADEMIC_DICTIONARY.find(
    (a) =>
      a.term.toLowerCase() === finalEnglish.toLowerCase() ||
      a.verified_term === finalArabic ||
      a.draft_term === finalArabic ||
      a.keywords.some((k) => k.toLowerCase() === finalEnglish.toLowerCase())
  );

  return {
    arabicTerm: finalArabic,
    englishTerm: finalEnglish,
    dictDefinition: matchDict ? matchDict.definition : undefined,
  };
}

export function isValidAcademicConcept(item: { term: string; definition?: string; draft_term?: string; verified_term?: string; transliteration?: string }): boolean {
  if (!item) return false;

  const rawTerm = (item.term || "").trim();
  if (!rawTerm || rawTerm.length < 3 || rawTerm.length > 60) return false;

  // Reject generic placeholder text
  if (rawTerm === "مفهوم متخصص" || rawTerm === "Academic Concept") return false;

  // Reject strings containing slashes, URLs, DOIs, email, brackets, or math symbols in term
  if (/[\/\\@=\?&%\[\]{}_<>]|https?:\/\/|www\.|doi\.org|\.com\b|\.org\b|\.net\b|journalcode|issn|isbn/i.test(rawTerm)) {
    return false;
  }

  const t = rawTerm.toLowerCase();
  const def = (item.definition || "").trim().toLowerCase();
  const draft = (item.draft_term || "").trim().toLowerCase();
  const verified = (item.verified_term || "").trim().toLowerCase();
  const trans = (item.transliteration || "").trim().toLowerCase();

  const termOnly = `${t} ${draft} ${verified} ${trans}`;

  if (termOnly.includes("مفهوم متخصص") || termOnly.includes("academic concept")) {
    return false;
  }

  // 1. Definition quality check (must be a valid explanation, not a URL, citation, or raw excerpt fragment)
  if (!def || def.length < 10) return false;
  if (/^https?:\/\/|submit your article|download by|journal homepage|article views|view related|crossmark|full terms/i.test(def)) {
    return false;
  }

  // 1b. Reject definitions that are raw transcriptions, interview excerpts, or publication citations
  if (/\b(columbia studies|middle east|press|journal|published|edited by|printed in|isbn|issn|doi|pages?|vol|volume|issue|conceptually extracted from|analysed through the lenses of|interview|panels and the interviews)\b/i.test(def)) {
    return false;
  }

  // 1c. Reject generic dummy fallback definition unless term is in official concept dictionary
  if (
    def.includes("مفهوم أكاديمي وتخصصي محوري يُستخدم لتفسير العلاقات") ||
    def.includes("مفهوم أكاديمي وتخصصي استُخلص من سياق النص")
  ) {
    const isKnownConcept = ACADEMIC_DICTIONARY.some(
      (a) => a.term.toLowerCase() === t || a.verified_term.toLowerCase() === draft || a.verified_term.toLowerCase() === verified
    ) || !!CONCEPT_DICTIONARY[t] || !!ARABIC_TO_ENGLISH_DICTIONARY[draft];
    if (!isKnownConcept) return false;
  }

  // 2. Word count constraint (1 to 5 words)
  const words = t.split(/\s+/);
  if (words.length > 5) return false;

  // 2b. Reject museums, galleries, exhibitions, archives, monuments
  const MUSEUM_LANDMARK_REGEX = /\b(museum|gallery|exhibition|exhibit|monument|statue|memorial|archive|heritage site|bardo|ulster|mouzeo|al-thaoura|thaoura)\b/i;
  const ARABIC_MUSEUM_LANDMARK_REGEX = /(متحف|معرض|نصب|نصب تذكاري|أرشيف|ضريح|تمثال|معلم أثري|الثورة غير دراج)/i;
  if (MUSEUM_LANDMARK_REGEX.test(termOnly) || ARABIC_MUSEUM_LANDMARK_REGEX.test(termOnly)) {
    return false;
  }

  // 2c. Reject temporal / calendar / century expressions
  const TEMPORAL_REGEX = /\b(millennium|century|decades?|years?|new millennium|21st century|twentieth century|19th century|20th century)\b/i;
  const ARABIC_TEMPORAL_REGEX = /(القرن|الألفية|عقود|سنوات|القرن العشرين|القرن الحادي والعشرين|الألفية الجديدة)/i;
  if (TEMPORAL_REGEX.test(termOnly) || ARABIC_TEMPORAL_REGEX.test(termOnly)) {
    return false;
  }

  // 2d. Reject non-concept titles, proper noun fragments, methodology phrases, or case study topics
  if (/\b(international african|african-american|african american|norman fairclough|fairclough|cda framework|reflexive museology|museum theory|computer-assisted|arab uprisings|columbia studies|security politics|gulf monarchies|journal|review|quarterly|proceedings|uprisings explained|case study|narrative about|personal spark|first person)\b/i.test(termOnly)) {
    return false;
  }

  // 3. Reject bibliographic meta indicators / IDs / Pages
  if (/^(vol|volume|no|issue|pp|pages?|page|\d+|http|https|doi|isbn|issn|url|doi\.org)\b/i.test(t)) return false;

  // 4. Banned Publishers, Journals, Reviews, Publications, Press, Web Debris (in TERM ONLY)
  const PUBLICATION_REGEX = /\b(journal|comillas|review|bulletin|proceedings|quarterly|annals|monograph|periodical|magazine|newsletter|press|publisher|publishing|publication|editorial|edition|series|springer|elsevier|routledge|ieee|wiley|nature|sage|oxford|cambridge|jstor|pubmed|scopus|web of science|frontiers|mdpi|emerald|proquest|arxiv|researchgate|google scholar|crossmark|view crossmark|full terms|terms & conditions|terms and conditions|download by|journal homepage|article views|submit your article|survival global)\b/i;
  const ARABIC_PUBLICATION_REGEX = /(مجلة|دورية|صحيفة|جريدة|مطبعة|دار نشر|ناشر|إصدار|مجلد|عدد|قائمة المراجع|جدول المحتويات|فهرس|أطروحة|رسالة ماجستير|شروط وأحكام|تحميل بواسطة)/i;

  if (PUBLICATION_REGEX.test(termOnly) || ARABIC_PUBLICATION_REGEX.test(termOnly)) {
    return false;
  }

  // 5. Banned Proper Places, Countries, Cities, Regions, & Tribal groups (in TERM ONLY)
  const GEOGRAPHY_REGEX = /\b(northern ireland|ireland|irish|sidi bouszid|sidi bouzid|bouszid|bouzid|south carolina|carolina|ulster|bardo|kairouan|sfax|sousse|tunis|tunisia|tunisian|central arabian|arabian tribal|qatar|qatari|doha|saudi|arabia|emirates|uae|bahrain|kuwait|oman|gulf|persian gulf|arabian gulf|middle east|middle eastern|near east|far east|north america|south america|latin america|europe|asia|africa|oceania|egypt|egyptian|iran|iranian|iraq|iraqi|syria|syrian|turkey|turkish|yemen|jordan|jordanian|lebanon|lebanese|palestine|palestinian|israel|israeli|sudan|algeria|morocco|libya|united states|usa|america|american|uk|britain|british|china|chinese|russia|russian|france|french|germany|german|japan|japanese|india|indian|spain|spanish|madrid|washington|london|beijing|moscow|tehran|riyadh|abu dhabi|cairo|ankara|baghdad|damascus|beirut|jerusalem)\b/i;
  const ARABIC_GEOGRAPHY_REGEX = /(أيرلندا الشمالية|أيرلندا|سيدي بوزيد|سيدي بو زيد|كارولاينا|ألستر|باردو|صفاقس|سوسة|القيروان|قطر|قطري|قطرية|الدوحة|السعودية|الإمارات|البحرين|الكويت|عمان|الخليج|الشرق الأوسط|مصر|إيران|العراق|سوريا|تركيا|اليمن|الأردن|لبنان|فلسطين|السودان|الجزائر|المغرب|تونس|تونسية|ليبيا|أمريكا|الولايات المتحدة|بريطانيا|الصين|روسيا|فرنسا|ألمانيا|اليابان|الهند|إسبانيا|مدريد|واشنطن|لندن|بكين|مسكوا|طهران|الرياض|القاهرة|أنقرة|بغداد)/i;

  if (GEOGRAPHY_REGEX.test(termOnly) || ARABIC_GEOGRAPHY_REGEX.test(termOnly)) {
    return false;
  }

  // 6. Banned Persons, Scholars, Authors, Rulers, Figures, Names (in TERM ONLY)
  const PERSON_REGEX = /\b(fairclough|norman fairclough|norman|cda framework|foucault|michel foucault|gramsci|antonio gramsci|bourdieu|chomsky|derrida|habermas|edward said|said|spivak|bhabha|fanon|agamben|zizek|butler|hardt|negri|wallerstein|cox|robert cox|gilpin|bull|hedley bull|lynch|marc lynch|marc|abdel fatah|sisi|al-sisi|sheikh jassim|sheikh|jassim|mohammed ibn abd al-wahhab|abd al-wahhab|al-wahhab|wahhab|qaradawi|joseph nye|nye|roberts king|roberts|king|kenneth waltz|waltz|alexander wendt|wendt|mearsheimer|keohane|huntington|fukuyama|hobbes|locke|machiavelli|weber|marx|clausewitz|tamim|qaboos|zayed|salman|mbs|mbz|erdogan|khamenei|trump|biden|obama|bush|clinton|putin|xi jinping|macron|scholz|thatcher|blair|al-thani|althani|al thani|bin hamad|bin zayed|bin salman|jollie|carol|javed|khumalo|sharma|chiriac|ramsuraj|cantillon|siddiqui|ahmad|khan|tatiana|trisha|seddik|saqr|abdul|badi|abbas|mahmoud|david|john|michael|kobaisi|abdulla|juma)\b/i;
  const ARABIC_PERSON_REGEX = /(نورمان فيركلوف|فيركلوف|نورمان|فوكو|ميشيل فوكو|غرامشي|أنطونيو غرامشي|بورديو|تشومسكي|ديريدا|هابيرماس|إدوارد سعيد|سعيد|سبيفاك|بهابها|فانون|مارك لينش|لينش|عبد الفتاح السيسي|عبد الفتاح|السيسي|الشيخ جاسم|الشيخ|جاسم|محمد بن عبد الوهاب|عبد الوهاب|القرضاوي|جوزيف ناي|ناي|روبرتس|روبرتس كينغ|والتز|ميرشايمر|كينيث والتز|تميم|قابوس|زايد|سلمان|أردوغان|خامنئي|ترامب|بايدن|أوباما|بوش|كلينتون|بوتين|شي جين بينغ|آل ثاني|بن حمد|بن زايد|بن سلمان|صقر|عبد البديع|عباس|محمود|الكبيسي|عبد الله)/i;

  if (PERSON_REGEX.test(termOnly) || ARABIC_PERSON_REGEX.test(termOnly)) {
    return false;
  }

  // 7. Banned Academic/Administrative Buildings, Offices, Ministries, Organizations, Movements (in TERM ONLY)
  const INSTITUTION_REGEX = /\b(grand mufti|office of grand mufti|islamic affairs|endowments|ministry of endowments|brotherhood|muslim brotherhood|ikhwan|al-ikhwan|hamas|hezbollah|al-qaeda|isis|daesh|staff college|college|staff|academy|university|school|faculty|department|ministry|command|joint services|armed forces|defense force|general command|supreme council|national assembly|parliament|shura council|security council|bureau|committee|commission|institute|center|organisation|organization|foundation|agency|brigade|division|regiment|squadron|unit)\b/i;
  const ARABIC_INSTITUTION_REGEX = /(مفتي الديار|مفتي|مفتى|مكتب المفتي|الأوقاف والإشكاليات|الأوقاف|وزارة الأوقاف|الشؤون الإسلامية|الإخوان|الإخوان المسلمين|حركة|حزب|كلية|كلية الأركان|أركان|قيادة|القيادة المشتركة|قيادة القوات|القوات المسلحة|جامعة|وزارة|معهد|مركز|هيئة|مجلس|برلمان|مجلس الشورى|مجلس النواب|مجلس الأمن|لجنة|مدرسة|أكاديمية|لواء|كتيبة|فرقة)/i;

  if (INSTITUTION_REGEX.test(termOnly) || ARABIC_INSTITUTION_REGEX.test(termOnly)) {
    return false;
  }

  // 8. Starting/Ending Junk Words (conjunctions, prepositions, debris, sentence fragments)
  const STARTING_ENDING_JUNK = [
    "yet", "however", "in", "on", "at", "by", "for", "with", "from", "to", "this", "that", "these", "those",
    "when", "where", "while", "after", "before", "during", "since", "until", "through", "about", "against",
    "between", "into", "above", "below", "further", "then", "here", "there", "why", "how", "all", "any",
    "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
    "so", "than", "too", "very", "can", "will", "just", "should", "now", "although", "because", "despite",
    "whereas", "indeed", "thus", "hence", "therefore", "moreover", "furthermore", "according", "based", "using",
    "via", "within", "without", "among", "under", "over", "full", "terms", "view", "submit", "download", "adi"
  ];

  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  if (STARTING_ENDING_JUNK.includes(firstWord) || STARTING_ENDING_JUNK.includes(lastWord)) {
    return false;
  }

  // 9. Single-word validation: Only allow recognized academic concept words if word count === 1
  const VALID_SINGLE_CONCEPTS = [
    "constructivism", "realism", "neorealism", "liberalism", "neoliberalism", "hegemony", "epistemology", "governance",
    "multilateralism", "institutionalism", "deterrence", "correlation", "sovereignty", "globalization", "interdependence",
    "البنائية", "الواقعية", "الهيمنة", "الحوكمة", "الردع", "المؤسسية", "السيادة", "العولمة", "الارتباط"
  ];

  if (words.length === 1 && !VALID_SINGLE_CONCEPTS.includes(t)) {
    return false;
  }

  return true;
}

export function performLocalTermExtraction(text: string, sourceId?: string): GlossaryTerm[] {
  if (!text || text.trim().length < 10) return [];

  const textLower = text.toLowerCase();
  const extractedTerms: GlossaryTerm[] = [];
  const addedTermKeys = new Set<string>();

  // Match strictly against curated ACADEMIC_DICTIONARY entries with authentic definitions
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

  return extractedTerms;
}
