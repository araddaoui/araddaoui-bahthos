import React, { useState, useEffect, useRef } from "react";
import { defaultSources } from "./data/defaultSources";
import { Source, Message, Conversation, Synthesis, GlossaryTerm, ActiveTab, Project } from "./types";
import Sidebar from "./components/Sidebar";
import SourcesList from "./components/SourcesList";
import ChatWindow from "./components/ChatWindow";
import SourceViewer from "./components/SourceViewer";
import SynthesisEditor from "./components/SynthesisEditor";
import SynthesisHistory from "./components/SynthesisHistory";
import SettingsView from "./components/SettingsView";
import LandingPage from "./components/LandingPage";
import { BookOpen, Sparkles, MessageSquare, AlertCircle } from "lucide-react";

// Default glossary terms to populate on first load
const initialGlossary: GlossaryTerm[] = [
  {
    term: "Blended Learning",
    transliteration: "التعليم المدمج",
    definition: "نموذج تعليمي يدمج بين التعليم التقليدي في الفصول الدراسية وأنشطة التعلم الإلكتروني عبر الإنترنت.",
    draft_term: "التعليم المدمج",
    verified_term: "التعليم المدمج"
  },
  {
    term: "Academic Self-Regulation",
    transliteration: "التنظيم الذاتي الأكاديمي",
    definition: "قدرة الطالب على توجيه ومراقبة سلوكياته ومساعيه التعليمية ومثابرته بشكل نشط لتحقيق النجاح الأكاديمي.",
    draft_term: "التنظيم الذاتي الأكاديمي",
    verified_term: "التنظيم الذاتي الأكاديمي"
  },
  {
    term: "Quality Assurance",
    transliteration: "ضمان الجودة",
    definition: "العمليات والسياسات المنهجية المتبعة للتأكد من تلبية البرامج والمؤسسات التعليمية للمعايير الرصينة المحددة.",
    draft_term: "ضمان الجودة",
    verified_term: "ضمان الجودة"
  }
];

// Pre-baked high-quality academic synthesis report
const initialSyntheses: Synthesis[] = [
  {
    id: "pre-baked-1",
    title: "تقرير توليفي تمهيدي: تقييم تجربة التعليم الرقمي وأثرها على الأداء الدراسي والصحة النفسية للطلبة",
    dateCreated: "2026-07-09",
    sourceIds: ["source-1", "source-2", "source-3"],
    text: `مقدمة التقرير:
يقدم هذا التقرير تحليلاً وتوليفاً أكاديمياً رصيناً لثلاث وثائق بحثية وميدانية تقيّم تجربة التحول نحو التعليم الرقمي عن بعد في الأوساط الأكاديمية والجامعية. تشتمل مجموعة الدراسات على تقريرين باللغة العربية ودراسة استقصائية باللغة الإنجليزية، ويهدف هذا التوليف إلى الكشف عن نقاط التوافق والتعارض الإحصائي والمنهجي بين هذه المصادر المتاحة.

أولاً: نقاط التوافق والاتفاق بين المصادر:
1. مرونة نمط التعلم الرقمي:
تتفق المصادر بشكل مبدئي على أن ميزة المرونة هي أحد الأركان الإيجابية الأبرز في التعليم عن بعد. تشير "الوثيقة الأولى" بوضوح إلى أن هذه المرونة سمحت للطلاب الذين يعملون بدوام جزئي بتنظيم أوقاتهم والتوفيق بين التزاماتهم الأكاديمية والمهنية. ويتلاقى هذا بشكل تام مع ما كشفت عنه "الوثيقة الثالثة" (المسح الخاص بصحة الطلبة) حيث عبّر 78% من الطلاب عن تفضيلهم الشديد للمرونة وقدرتهم على الدراسة وفقاً لسرعتهم الخاصة دون الاضطرار للتنقل اليومي المجهد.

ثانياً: نقاط التعارض والاخلتاف الجوهري (التناقض الإحصائي):
تظهر المصادر تبايناً حاداً وتناقضاً صريحاً في مسألة التحصيل والدرجات الأكاديمية ومستويات الانسحاب والالتزام:
1. معدلات التحصيل الدراسي والدرجات:
- تشير "الوثيقة الأولى" (دراسة أثر التعليم عن بعد على الأداء الأكاديمي) إلى نجاح باهر تمثل في زيادة متوسط درجات الطلاب ومعدلاتهم الأكاديمية بنسبة 8% مقارنة بنظام الحضور الفعلي.
- في المقابل، يطرح "التقرير الثاني" (تقرير ضمان الجودة والاعتماد الأكاديمي) رؤية معاكسة تماماً، حيث كشف التحليل الإحصائي عن تراجع عام في التحصيل والدرجات النهائية للطلاب بنسبة 6%.

2. معدلات الغياب والانسحاب:
- تؤكد "الوثيقة الأولى" انخفاض معدلات الغياب والمنقطع عن المحاضرات بفضل المرونة والتمكين الرقمي.
- غير أن "التقرير الثاني" يشير إلى قفزة مقلقة في نسبة الانسحاب الفعلي من المقررات الدراسية (Course Withdrawal) بلغت 11% مقارنة بنظام التعليم التقليدي.

ثالثاً: التفسيرات المنهجية والسياقية للاختلافات:
يقدم هذا التوليف تفسيراً منهجياً مقترحاً لتفسير هذا التناقض الظاهري بين الدراستين:
توضح قراءة فاحصة لـ"التقرير الثاني" (قسم الجودة) أن تراجع الأداء الأكاديمي وزيادة الانسحاب بنسبة 11% لا يعود إلى قصور في جوهر التعليم الرقمي نفسه، بل يرتبط بشكل حاسم بعوامل تشغيلية خارجية؛ لا سيما ضعف الإنترنت وانقطاع الخدمات التقنية في المناطق الريفية. في حين يبدو أن عينة "الوثيقة الأولى" ربما كانت تركز على فئة الطلبة العاملين في حواضر حضرية حظيت بظروف تقنية مستقرة ودعم مستمر.

أما "الوثيقة الثالثة" (Student Wellbeing and Flexibility Survey) فتقدم بعداً نفسياً وعاطفياً يفسر تباين النتائج؛ إذ توضح وجود زيادة ملحوظة في مستويات القلق والتوتر والشعور بالعزلة الأكاديمية تحت النظام الرقمي الكامل، كما تؤكد انقسام آراء الطلاب وغياب الإجماع حول ما إذا كان هذا التعليم يسهم فعلياً في الفهم العميق للمادة الأكاديمية المعقدة، على الرغم من عشقهم لمرونته الزمنية.

خلاصة وتوصية بحثية:
يوضح التحليل المقارن أن التعليم عن بعد نمط ذو فاعلية متباينة للغاية: فهو يحسن التحصيل والالتزام للفئات التي تتطلب مرونة خاصة وتمتلك بنية تحتية مستقرة (مثل الطلاب الموظفين)، بينما يتحول إلى عائق أكاديمي ونفسي يؤدي للانسحاب بنسبة 11% في المناطق التي تفتقر للبنية التحتية التقنية الملائمة. يوصي الباحثون بالانتقال نحو نماذج هجينة مرنة تدعم الاستقرار النفسي والتقني للطلاب بشكل متوازن.`
  }
];

// Helper to clean phonetic transliterations of academic/technical terms to real Arabic equivalents
export function cleanAndMigrateGlossary(terms: GlossaryTerm[]): GlossaryTerm[] {
  const dictionary: Record<string, string> = {
    "blended learning": "التعلم المدمج",
    "academic self-regulation": "التنظيم الذاتي الأكاديمي",
    "quality assurance": "ضمان الجودة",
    "e-learning": "التعلم الإلكتروني",
    "elearning": "التعلم الإلكتروني",
    "ict": "تقنية المعلومات والاتصالات",
    "digital education": "التعليم الرقمي",
    "online learning": "التعلم عبر الإنترنت",
    "distance learning": "التعلم عن بعد",
    "hybrid learning": "التعلم الهجين",
    "mobile learning": "التعلم المتنقل",
    "flipped classroom": "الفصل الدراسي المقلوب",
    "virtual reality": "الواقع الافتراضي",
    "augmented reality": "الواقع المعزز",
    "artificial intelligence": "الذكاء الاصطناعي",
    "machine learning": "تعلم الآلة",
    "deep learning": "التعلم العميق",
    "data science": "علم البيانات",
    "big data": "البيانات الضخمة",
    "cloud computing": "الحوسبة السحابية",
    "software engineering": "هندسة البرمجيات",
    "information technology": "تقنية المعلومات",
    "computer science": "علوم الحاسب",
    "cybersecurity": "الأمن السيبراني",
    "internet of things": "إنترنت الأشياء",
    "blockchain": "سلسلة الكتل",
    "data mining": "تنقيب البيانات",
    "virtual classroom": "الفصل الدراسي الافتراضي",
    "microlearning": "التعلم المصغر",
    "gamification": "التلعيب",
    "learning management system": "نظام إدارة التعلم",
    "lms": "نظام إدارة التعلم",
    "synchronous learning": "التعلم المتزامن",
    "asynchronous learning": "التعلم غير المتزامن",
    "pedagogy": "علم التربية",
    "standard deviation": "الانحراف المعياري",
    "arithmetic mean": "المتوسط الحسابي",
    "self-learning": "التعلم الذاتي",
    "self learning": "التعلم الذاتي",
    "web-based learning": "التعلم القائم على الويب",
    "web based learning": "التعلم القائم على الويب",
    "virtual learning environment": "بيئة التعلم الافتراضية",
    "virtual learning environment (vle)": "بيئة التعلم الافتراضية",
    "vle": "بيئة التعلم الافتراضية",
    "managed learning environment": "بيئة التعلم المُدارة",
    "managed learning environment (mle)": "بيئة التعلم المُدارة",
    "mle": "بيئة التعلم المُدارة"
  };

  const arabicTransliterationDictionary: Record<string, string> = {
    "إي ليرنينغ": "التعلم الإلكتروني",
    "إي ليرنينج": "التعلم الإلكتروني",
    "الإي ليرنينغ": "التعلم الإلكتروني",
    "الإي ليرنينج": "التعلم الإلكتروني",
    "البلندد ليرنينغ": "التعلم المدمج",
    "البلندد ليرنينج": "التعلم المدمج",
    "الأونلاين ليرنينغ": "التعلم عبر الإنترنت",
    "الأونلاين ليرنينج": "التعلم عبر الإنترنت",
    "أونلاين ليرنينغ": "التعلم عبر الإنترنت",
    "أونلاين ليرنينج": "التعلم عبر الإنترنت",
    "الديجيتال إديوكيشن": "التعليم الرقمي",
    "ديجيتال إديوكيشن": "التعليم الرقمي",
    "التعليم الديجيتال": "التعليم الرقمي",
    "آي سي تي": "تقنية المعلومات والاتصالات",
    "الآي سي تي": "تقنية المعلومات والاتصالات",
    "الهايبريد ليرنينغ": "التعلم الهجين",
    "الهايبريد ليرنينج": "التعلم الهجين",
    "الدستانس ليرنينغ": "التعلم عن بعد",
    "الدستانس ليرنينج": "التعلم عن بعد",
    "موبايل ليرنينغ": "التعلم المتنقل",
    "الموبايل ليرنينغ": "التعلم المتنقل",
    "فليبد كلاس روم": "الفصل الدراسي المقلوب",
    "الفليبد كلاس روم": "الفصل الدراسي المقلوب",
    "الفيشوال رياليتي": "الواقع الافتراضي",
    "الأوجمنتد رياليتي": "الواقع المعزز",
    "الآرتيفيشال إنتليجنس": "الذكاء الاصطناعي",
    "المشين ليرنينغ": "تعلم الآلة",
    "المشين ليرنينج": "تعلم الآلة",
    "الديب ليرنينغ": "التعلم العميق",
    "الديب ليرنينج": "التعلم العميق",
    "الديتا ساينس": "علم البيانات",
    "البيغ ديتا": "البيانات الضخمة",
    "السايبر سيكيوريتي": "الأمن السيبراني",
    "الإنترنت أوف ثينغز": "إنترنت الأشياء",
    "الإنترنت أوف ثينجز": "إنترنت الأشياء",
    "ال سنكرونوس": "التعلم المتزامن",
    "ال سنكرونوس ليرنينغ": "التعلم المتزامن",
    "الأسينكرونوس ليرنينغ": "التعلم غير المتزامن",
    "ال بيداغوجيا": "علم التربية",
    "الأريثميتيك مين": "المتوسط الحسابي",
    "الأريثميتك مين": "المتوسط الحسابي",
    "ستاندارد ديفييشن": "الانحراف المعياري",
    "ستاندرد ديفييشن": "الانحراف المعياري",
    "الستاندرد ديفييشن": "الانحراف المعياري",
    "سيلف ليرنينغ": "التعلم الذاتي",
    "سيلف ليرنينج": "التعلم الذاتي",
    "السيلف ليرنينغ": "التعلم الذاتي",
    "السيلف ليرنينج": "التعلم الذاتي",
    "ويب بيست ليرنينغ": "التعلم القائم على الويب",
    "الويب بيست ليرنينغ": "التعلم القائم على الويب",
    "ويب بيزد ليرنينغ": "التعلم القائم على الويب",
    "الويب بيزد ليرنينغ": "التعلم القائم على الويب",
    "ويب بيزد ليرنينج": "التعلم القائم على الويب",
    "الويب بيزد ليرنينج": "التعلم القائم على الويب",
    "فيرتشوال ليرنينغ إنفايرومنت": "بيئة التعلم الافتراضية",
    "الفيرتشوال ليرنينغ إنفايرومنت": "بيئة التعلم الافتراضية",
    "فيرتشوال ليرنينج إنفايرومنت": "بيئة التعلم الافتراضية",
    "الفيرتشوال ليرنينج إنفايرومنت": "بيئة التعلم الافتراضية",
    "بيئة التعلم الفيرتشوال": "بيئة التعلم الافتراضية",
    "مانيجد ليرنينغ إنفايرومنت": "بيئة التعلم المُدارة",
    "المانيجد ليرنينغ إنفايرومنت": "بيئة التعلم المُدارة",
    "مانيجد ليرنينج إنفايرومنت": "بيئة التعلم المُدارة",
    "المانيجد ليرنينج إنفايرومنت": "بيئة التعلم المُدارة",
    "بيئة التعلم المانيجد": "بيئة التعلم المُدارة"
  };

  return terms.map((t) => {
    const englishKey = t.term.trim().toLowerCase();
    const currentTransliteration = t.transliteration || t.verified_term || t.draft_term || "";

    if (dictionary[englishKey]) {
      return {
        ...t,
        transliteration: dictionary[englishKey],
        draft_term: t.draft_term || dictionary[englishKey],
        verified_term: t.verified_term || dictionary[englishKey],
      };
    }

    const translitVal = currentTransliteration.trim();
    if (arabicTransliterationDictionary[translitVal]) {
      return {
        ...t,
        transliteration: arabicTransliterationDictionary[translitVal],
        draft_term: t.draft_term || arabicTransliterationDictionary[translitVal],
        verified_term: t.verified_term || arabicTransliterationDictionary[translitVal],
      };
    }

    let updatedTransliteration = currentTransliteration;
    Object.entries(arabicTransliterationDictionary).forEach(([bad, good]) => {
      if (currentTransliteration.includes(bad)) {
        updatedTransliteration = updatedTransliteration.replace(new RegExp(bad, "g"), good);
      }
    });

    return {
      ...t,
      transliteration: updatedTransliteration || t.term,
      draft_term: t.draft_term || updatedTransliteration || t.term,
      verified_term: t.verified_term || updatedTransliteration || t.term,
    };
  });
}

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("bahthos_entered_app") || localStorage.getItem("tawlif_entered_app");
      return saved ? false : true;
    } catch (e) {
      return true;
    }
  });

  // Projects list
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem("bahthos_projects") || localStorage.getItem("tawlif_projects");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: "default",
        name: "المشروع التجريبي الأول",
        dateCreated: "2026-07-09",
      }
    ];
  });

  // Active project ID
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id");
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return "default";
  });

  // Prevent race conditions when state updates during project switches
  const loadedProjectIdRef = useRef<string>(currentProjectId);

  // Sync active project ID to the ref
  useEffect(() => {
    loadedProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  // Save projects on change
  useEffect(() => {
    try {
      localStorage.setItem("bahthos_projects", JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
  }, [projects]);

  // Save active project ID on change
  useEffect(() => {
    try {
      localStorage.setItem("bahthos_current_project_id", currentProjectId);
    } catch (e) {
      console.error(e);
    }
  }, [currentProjectId]);

  // Lazily load sources for the current project
  const [sources, setSources] = useState<Source[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_sources_${activeId}`) || localStorage.getItem(`tawlif_sources_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (activeId === "default") {
        // Migration of legacy non-prefixed key
        const legacy = localStorage.getItem("bahthos_sources") || localStorage.getItem("tawlif_sources") || localStorage.getItem("al_dalil_sources");
        if (legacy) return JSON.parse(legacy);
        return defaultSources;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

  // Lazily load messages for the current project
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_messages_${activeId}`) || localStorage.getItem(`tawlif_messages_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_messages") || localStorage.getItem("tawlif_messages") || localStorage.getItem("al_dalil_messages");
        if (legacy) return JSON.parse(legacy);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isThinking, setIsThinking] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeMainView, setActiveMainView] = useState<"chat" | "source">("chat");

  // Lazily load syntheses for the current project
  const [syntheses, setSyntheses] = useState<Synthesis[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_syntheses_${activeId}`) || localStorage.getItem(`tawlif_syntheses_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_syntheses") || localStorage.getItem("tawlif_syntheses") || localStorage.getItem("al_dalil_syntheses");
        if (legacy) return JSON.parse(legacy);
        return initialSyntheses;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Lazily load temperature for the current project
  const [temperature, setTemperature] = useState(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_temperature_${activeId}`) || localStorage.getItem(`tawlif_temperature_${activeId}`);
      if (saved) return parseFloat(saved);
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_temperature") || localStorage.getItem("tawlif_temperature") || localStorage.getItem("al_dalil_temperature");
        if (legacy) return parseFloat(legacy);
      }
    } catch (e) {
      console.error(e);
    }
    return 0.2;
  });

  // Lazily load glossary terms for the current project
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>(() => {
    try {
      const activeId = localStorage.getItem("bahthos_current_project_id") || localStorage.getItem("tawlif_current_project_id") || "default";
      const saved = localStorage.getItem(`bahthos_glossary_${activeId}`) || localStorage.getItem(`tawlif_glossary_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return cleanAndMigrateGlossary(parsed);
      }
      if (activeId === "default") {
        const legacy = localStorage.getItem("bahthos_glossary") || localStorage.getItem("tawlif_glossary") || localStorage.getItem("al_dalil_glossary");
        if (legacy) return cleanAndMigrateGlossary(JSON.parse(legacy));
        return initialGlossary;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepCorrectionCount, setSweepCorrectionCount] = useState<number | null>(null);

  const [stateLoadedFromServer, setStateLoadedFromServer] = useState(false);

  // Load state from server on startup (for whatever project is loaded)
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch("/api/load-state");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
              setSources(data.sources);
            }
            if (data.glossaryTerms && Array.isArray(data.glossaryTerms) && data.glossaryTerms.length > 0) {
              setGlossaryTerms(cleanAndMigrateGlossary(data.glossaryTerms));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load state from server:", err);
      } finally {
        setStateLoadedFromServer(true);
      }
    };
    fetchState();
  }, []);

  useEffect(() => {
    const runSweep = async () => {
      const toSweep = glossaryTerms.filter((t) => !t.verified_term);
      if (toSweep.length === 0 || isSweeping) return;

      setIsSweeping(true);
      try {
        console.log(`Retroactive sweep started for ${toSweep.length} glossary terms...`);
        const response = await fetch("/api/sweep-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terms: toSweep }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.terms && Array.isArray(data.terms)) {
            let corrections = 0;
            const updatedTerms = glossaryTerms.map((orig) => {
              const matched = data.terms.find((t: any) => t.term.toLowerCase() === orig.term.toLowerCase());
              if (matched) {
                if (matched.draft_term !== matched.verified_term) {
                  corrections++;
                }
                return {
                  ...orig,
                  draft_term: matched.draft_term,
                  verified_term: matched.verified_term,
                  transliteration: matched.verified_term,
                  definition: matched.definition,
                };
              }
              return {
                ...orig,
                draft_term: orig.transliteration,
                verified_term: orig.transliteration,
              };
            });

            setSweepCorrectionCount(corrections);
            setGlossaryTerms(updatedTerms);
            console.log(`Retroactive sweep completed. ${corrections} terms corrected.`);
          }
        }
      } catch (e) {
        console.warn("Failed to sweep glossary terms retroactively:", e);
      } finally {
        setIsSweeping(false);
      }
    };

    const timer = setTimeout(() => {
      runSweep();
    }, 1500);

    return () => clearTimeout(timer);
  }, [glossaryTerms, isSweeping]);

  // Project Switch, Create, and Delete handlers
  const handleSwitchProject = (newProjectId: string) => {
    if (newProjectId === currentProjectId) return;

    // 1. Save current state of the old project to its specific keys
    if (currentProjectId) {
      try {
        localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(sources));
        localStorage.setItem(`bahthos_messages_${currentProjectId}`, JSON.stringify(messages));
        localStorage.setItem(`bahthos_syntheses_${currentProjectId}`, JSON.stringify(syntheses));
        localStorage.setItem(`bahthos_glossary_${currentProjectId}`, JSON.stringify(glossaryTerms));
        localStorage.setItem(`bahthos_temperature_${currentProjectId}`, temperature.toString());
      } catch (e) {
        console.error("Failed to save state during switch:", e);
      }
    }

    // 2. Load the new project's state
    try {
      const savedSources = localStorage.getItem(`bahthos_sources_${newProjectId}`) || localStorage.getItem(`tawlif_sources_${newProjectId}`);
      const savedMessages = localStorage.getItem(`bahthos_messages_${newProjectId}`) || localStorage.getItem(`tawlif_messages_${newProjectId}`);
      const savedSyntheses = localStorage.getItem(`bahthos_syntheses_${newProjectId}`) || localStorage.getItem(`tawlif_syntheses_${newProjectId}`);
      const savedGlossary = localStorage.getItem(`bahthos_glossary_${newProjectId}`) || localStorage.getItem(`tawlif_glossary_${newProjectId}`);
      const savedTemp = localStorage.getItem(`bahthos_temperature_${newProjectId}`) || localStorage.getItem(`tawlif_temperature_${newProjectId}`);

      const loadedSources = savedSources ? JSON.parse(savedSources) : (newProjectId === "default" ? defaultSources : []);
      const loadedMessages = savedMessages ? JSON.parse(savedMessages) : [];
      const loadedSyntheses = savedSyntheses ? JSON.parse(savedSyntheses) : (newProjectId === "default" ? initialSyntheses : []);
      const loadedGlossary = savedGlossary ? JSON.parse(savedGlossary) : (newProjectId === "default" ? initialGlossary : []);
      const loadedTemp = savedTemp ? parseFloat(savedTemp) : 0.2;

      // 3. Update the ref immediately to block reactive saving of old values during render
      loadedProjectIdRef.current = newProjectId;

      // 4. Update the state
      setSources(loadedSources);
      setMessages(loadedMessages);
      setSyntheses(loadedSyntheses);
      setGlossaryTerms(loadedGlossary);
      setTemperature(loadedTemp);
      
      // 5. Update current project ID
      setCurrentProjectId(newProjectId);
      
      // Close reading view if open
      setSelectedSourceId(null);
      setActiveMainView("chat");
    } catch (e) {
      console.error("Failed to switch project:", e);
    }
  };

  const handleCreateProject = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const newProj: Project = {
      id: "proj-" + Date.now(),
      name: trimmedName,
      dateCreated: new Date().toISOString().split("T")[0],
    };

    setProjects((prev) => [...prev, newProj]);
    handleSwitchProject(newProj.id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;

    const index = projects.findIndex((p) => p.id === projectId);
    if (index === -1) return;

    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);

    // Clean up localstorage
    try {
      localStorage.removeItem(`bahthos_sources_${projectId}`);
      localStorage.removeItem(`bahthos_messages_${projectId}`);
      localStorage.removeItem(`bahthos_syntheses_${projectId}`);
      localStorage.removeItem(`bahthos_glossary_${projectId}`);
      localStorage.removeItem(`bahthos_temperature_${projectId}`);
      localStorage.removeItem(`tawlif_sources_${projectId}`);
      localStorage.removeItem(`tawlif_messages_${projectId}`);
      localStorage.removeItem(`tawlif_syntheses_${projectId}`);
      localStorage.removeItem(`tawlif_glossary_${projectId}`);
      localStorage.removeItem(`tawlif_temperature_${projectId}`);
    } catch (e) {
      console.error(e);
    }

    if (currentProjectId === projectId) {
      const nextActiveProject = updatedProjects[0] || { id: "default" };
      handleSwitchProject(nextActiveProject.id);
    }
  };

  // Save sources to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_sources_${currentProjectId}`, JSON.stringify(sources));
    } catch (e) {
      console.error("Failed to save sources to localStorage", e);
    }
  }, [sources, currentProjectId]);

  // Save messages to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_messages_${currentProjectId}`, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save messages to localStorage", e);
    }
  }, [messages, currentProjectId]);

  // Save syntheses to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_syntheses_${currentProjectId}`, JSON.stringify(syntheses));
    } catch (e) {
      console.error("Failed to save syntheses to localStorage", e);
    }
  }, [syntheses, currentProjectId]);

  // Save temperature to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_temperature_${currentProjectId}`, temperature.toString());
    } catch (e) {
      console.error(e);
    }
  }, [temperature, currentProjectId]);

  // Save glossary to localStorage on change
  useEffect(() => {
    if (currentProjectId !== loadedProjectIdRef.current) return;
    try {
      localStorage.setItem(`bahthos_glossary_${currentProjectId}`, JSON.stringify(glossaryTerms));
    } catch (e) {
      console.error("Failed to save glossary to localStorage", e);
    }
  }, [glossaryTerms, currentProjectId]);

  // Save sources and glossary terms to the server when they change
  useEffect(() => {
    if (stateLoadedFromServer) {
      fetch("/api/save-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, glossaryTerms }),
      }).catch((err) => console.error("Failed to save state to server:", err));
    }
  }, [sources, glossaryTerms, stateLoadedFromServer]);
  const handleResetWorkspace = async () => {
    try {
      // Clear all project localStorage keys
      projects.forEach((p) => {
        localStorage.removeItem(`bahthos_sources_${p.id}`);
        localStorage.removeItem(`bahthos_messages_${p.id}`);
        localStorage.removeItem(`bahthos_syntheses_${p.id}`);
        localStorage.removeItem(`bahthos_glossary_${p.id}`);
        localStorage.removeItem(`bahthos_temperature_${p.id}`);
        localStorage.removeItem(`tawlif_sources_${p.id}`);
        localStorage.removeItem(`tawlif_messages_${p.id}`);
        localStorage.removeItem(`tawlif_syntheses_${p.id}`);
        localStorage.removeItem(`tawlif_glossary_${p.id}`);
        localStorage.removeItem(`tawlif_temperature_${p.id}`);
      });
      localStorage.removeItem("bahthos_projects");
      localStorage.removeItem("bahthos_current_project_id");
      localStorage.removeItem("tawlif_projects");
      localStorage.removeItem("tawlif_current_project_id");
    } catch (e) {
      console.error(e);
    }

    try {
      await fetch("/api/reset-state", { method: "POST" });
    } catch (err) {
      console.error("Failed to reset state on server:", err);
    }

    setProjects([
      {
        id: "default",
        name: "المشروع التجريبي الأول",
        dateCreated: "2026-07-09",
      }
    ]);
    setCurrentProjectId("default");
    setSources(defaultSources);
    setMessages([]);
    setSyntheses(initialSyntheses);
    setTemperature(0.2);
    setGlossaryTerms(initialGlossary);
    setSelectedSourceId(null);
    setActiveMainView("chat");
    setActiveTab("home");
  };

  // Passive background extraction of technical/academic terms
  const extractGlossaryTerms = async (text: string, sourceId?: string) => {
    if (!text || text.trim().length < 10) return;
    try {
      const response = await fetch("/api/extract-glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.terms && Array.isArray(data.terms)) {
          addGlossaryTermsDirectly(data.terms, sourceId);
        }
      }
    } catch (e) {
      console.warn("Passive glossary extraction failed:", e);
    }
  };

  // Add pre-extracted terms directly to the glossary
  const addGlossaryTermsDirectly = (terms: any[], sourceId?: string) => {
    if (!terms || !Array.isArray(terms) || terms.length === 0) return;
    setGlossaryTerms((prev) => {
      const normalizedNewTerms = cleanAndMigrateGlossary(
        terms.filter((t: any) => t.term && (t.transliteration || t.verified_term || t.draft_term) && t.definition)
          .map((t: any) => ({
            term: t.term,
            transliteration: t.transliteration || t.verified_term || t.draft_term,
            definition: t.definition,
            draft_term: t.draft_term || t.transliteration || t.term,
            verified_term: t.verified_term || t.transliteration || t.draft_term || t.term,
            sourceId: sourceId
          }))
      );

      const existingTermsLower = prev.map((t) => t.term.toLowerCase());
      const existingTransLower = prev.map((t) => t.transliteration.toLowerCase());

      const filteredNew = normalizedNewTerms.filter(
        (t) =>
          !existingTermsLower.includes(t.term.toLowerCase()) &&
          !existingTransLower.includes(t.transliteration.toLowerCase())
      );

      if (filteredNew.length > 0) {
        return [...prev, ...filteredNew];
      }
      return prev;
    });
  };

  // Auto-populate glossary for uploaded Westphalian/Eurocentrism sources if not already present
  useEffect(() => {
    if (!stateLoadedFromServer) return;

    const hasWestphalianSource = sources.some(s => 
      s.title?.toLowerCase().includes("westphalian") || 
      s.title?.toLowerCase().includes("eurocentrism") ||
      s.content?.toLowerCase().includes("westphalian") ||
      s.content?.toLowerCase().includes("eurocentrism")
    );

    if (hasWestphalianSource) {
      const westphalianTerms = [
        {
          term: "Westphalian Sovereignty",
          transliteration: "السيادة الويستفالية",
          draft_term: "السيادة الويستفالية",
          verified_term: "السيادة الويستفالية",
          definition: "مفهوم قانوني وسياسي يفترض استقلالية الدولة المطلقة وسلطتها الحصرية على أراضيها ومواطنيها دون أي تدخل خارجي."
        },
        {
          term: "Eurocentrism",
          transliteration: "المركزية الأوروبية",
          draft_term: "المركزية الأوروبية",
          verified_term: "المركزية الأوروبية",
          definition: "منظور فكري يفسر التاريخ والظواهر العالمية من خلال التركيز على القيم والخبرات والمنظومات الغربية كمعيار أساسي."
        },
        {
          term: "Standard of Civilization",
          transliteration: "معيار التحضر",
          draft_term: "ستاندرد أوف سيفيليزيشن",
          verified_term: "معيار التحضر",
          definition: "مفهوم تاريخي قانوني استُخدم لتبرير فرض الهيمنة الاستعمارية من خلال تصنيف الدول غير الأوروبية على أنها غير متحضرة."
        },
        {
          term: "Legal Positivism",
          transliteration: "الوضعية القانونية",
          draft_term: "الوضعية القانونية",
          verified_term: "الوضعية القانونية",
          definition: "مدرسة في الفلسفة القانونية ترى أن صلاحية القوانين تستند إلى إرادة الدولة والتشريعات الوضعية بدلاً من المبادئ الأخلاقية الطبيعية."
        },
        {
          term: "International Society",
          transliteration: "المجتمع الدولي",
          draft_term: "المجتمع الدولي",
          verified_term: "المجتمع الدولي",
          definition: "مجموعة من الدول تجمعها قواعد ومؤسسات ومصالح مشتركة تلتزم بمراعاتها وتنظيم علاقاتها المتبادلة وفقاً لها."
        }
      ];

      setGlossaryTerms((prev) => {
        const existingLower = prev.map(t => t.term.toLowerCase());
        const toAdd = westphalianTerms.filter(t => !existingLower.includes(t.term.toLowerCase()));
        if (toAdd.length > 0) {
          return [...prev, ...toAdd];
        }
        return prev;
      });
    }
  }, [sources, stateLoadedFromServer]);

  // Toggle single source checkbox
  const handleToggleSource = (id: string) => {
    setSources((prev) => {
      const updated = prev.map((src) => (src.id === id ? { ...src, enabled: !src.enabled } : src));
      return updated;
    });
  };

  // Enable all sources
  const handleEnableAll = () => {
    setSources((prev) => prev.map((src) => ({ ...src, enabled: true })));
  };

  // Disable all sources
  const handleDisableAll = () => {
    setSources((prev) => prev.map((src) => ({ ...src, enabled: false })));
  };

  // Add custom source text with optional summary and pre-extracted terms
  const handleAddSource = (
    title: string,
    content: string,
    language: "ar" | "en" | "fr",
    summary?: string,
    error?: string,
    terms?: any[]
  ) => {
    // Basic word count logic
    const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    
    const newSrc: Source = {
      id: "source-" + Date.now(),
      title,
      content,
      dateAdded: new Date().toISOString().split("T")[0],
      wordCount,
      enabled: !error,
      language,
      summary: error || summary,
      error,
    };

    setSources((prev) => [...prev, newSrc]);
    if (!error) {
      setSelectedSourceId(newSrc.id);
      setActiveMainView("source");
      
      // If terms were returned in the same payload, add them directly
      if (terms && terms.length > 0) {
        addGlossaryTermsDirectly(terms, newSrc.id);
      } else {
        // Passively extract terms if not already provided
        extractGlossaryTerms(content.substring(0, 4000), newSrc.id);
      }
    }
  };

  // Delete research source
  const handleDeleteSource = (id: string) => {
    setSources((prev) => prev.filter((src) => src.id !== id));
    if (selectedSourceId === id) {
      setSelectedSourceId(null);
      setActiveMainView("chat");
    }
  };

  // Select source card for reading
  const handleSelectSource = (id: string) => {
    setSelectedSourceId(id);
    setActiveMainView("source");
  };

  // Chat with a single source (disables all other sources temporarily)
  const handleChatWithSingleSource = (id: string) => {
    setSources((prev) =>
      prev.map((src) => ({
        ...src,
        enabled: src.id === id,
      }))
    );
    setActiveTab("home");
    setActiveMainView("chat");
  };

  // Save generated synthesis report to history
  const handleSaveSynthesis = (synthesis: Synthesis) => {
    setSyntheses((prev) => [synthesis, ...prev]);
  };

  // Delete saved synthesis report
  const handleDeleteSynthesis = (id: string) => {
    setSyntheses((prev) => prev.filter((s) => s.id !== id));
  };

  // Send message to Gemini via Express Backend API
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: "msg-" + Date.now(),
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsThinking(true);
    setActiveMainView("chat");
    if (activeTab !== "home") {
      setActiveTab("home");
    }

    try {
      // Send ONLY enabled sources as context for the call
      let activeSources = sources.filter((s) => s.enabled);
      
      // If no sources are enabled, let's automatically enable and use ALL of them!
      if (activeSources.length === 0 && sources.length > 0) {
        setSources((prev) => prev.map((src) => ({ ...src, enabled: true })));
        activeSources = sources.map((src) => ({ ...src, enabled: true }));
      }
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          sources: activeSources,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "فشلت الاستجابة من الخادم.");
      }

      const data = await response.json();

      const assistantMsg: Message = {
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        text: data.text,
        timestamp: new Date().toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: "msg-err-" + Date.now(),
        role: "assistant",
        text: error.message || "عذراً، حدث خطأ غير متوقع أثناء الاتصال بمساعد بحث OS الذكي. يرجى التحقق من اتصالك بالإنترنت وإعادة إرسال السؤال.",
        timestamp: new Date().toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // Find currently active source
  const activeSelectedSource = sources.find((s) => s.id === selectedSourceId);

  if (showLandingPage) {
    return (
      <LandingPage
        onEnterApp={() => {
          setShowLandingPage(false);
          try {
            localStorage.setItem("bahthos_entered_app", "true");
          } catch (e) {}
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#fafaf8] text-[#1f1f1f] font-sans antialiased" dir="rtl" id="bahthos-root-container">
      {/* 1. RIGHT COLUMN (Narrow Sidebar Navigation) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // If switching tab to other things, close source reading view unless on sources tab
          if (tab !== "sources" && tab !== "home") {
            setSelectedSourceId(null);
            setActiveMainView("chat");
          }
        }} 
        activeSourcesCount={sources.filter((s) => s.enabled).length}
        projects={projects}
        currentProjectId={currentProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Grid Wrapper for responsive layout:
          On Large Screens (>= 1024px): 3 columns (Sidebar + SourcesList + MainContent)
          On Medium Screens (720px - 1024px): 2 columns (Sidebar + MainContent) (Sources tab shows SourcesList)
          On Small Screens (< 720px): Stacks / Toggles
      */}
      <div className="flex-1 flex overflow-hidden h-full">
        
        {/* 2. MIDDLE COLUMN (Research Sources List)
            Visible on desktop always when on Home or Sources tabs.
            On smaller viewports, it's only shown if the user explicitly opens the "sources" tab.
        */}
        <div className={`h-full flex-shrink-0 ${
          activeTab === "sources" 
            ? "w-full md:w-80 flex" 
            : "hidden lg:w-80 lg:flex"
        }`}>
          <SourcesList
            sources={sources}
            onToggleSource={handleToggleSource}
            onEnableAll={handleEnableAll}
            onDisableAll={handleDisableAll}
            onAddSource={handleAddSource}
            onDeleteSource={handleDeleteSource}
            selectedSourceId={selectedSourceId}
            onSelectSource={handleSelectSource}
            onChatWithSingleSource={handleChatWithSingleSource}
            onAskQuestionFromSearch={handleSendMessage}
            glossaryTerms={glossaryTerms}
            isSweeping={isSweeping}
            sweepCorrectionCount={sweepCorrectionCount}
          />
        </div>

        {/* 3. MAIN COLUMN (Content Area) */}
        <main className={`flex-1 h-full overflow-hidden relative ${
          activeTab === "sources" && selectedSourceId === null ? "hidden md:flex" : "flex"
        }`}>
          {/* Render content based on selected tab and reading state */}
          {activeTab === "home" && (
            activeMainView === "chat" || !activeSelectedSource ? (
              <ChatWindow
                messages={messages}
                sources={sources}
                onSendMessage={handleSendMessage}
                isThinking={isThinking}
                onSourceClick={(id) => {
                  setSelectedSourceId(id);
                  setActiveMainView("source");
                }}
              />
            ) : (
              <SourceViewer
                source={activeSelectedSource}
                onToggleSource={handleToggleSource}
                onClose={() => setActiveMainView("chat")}
                onBackToChat={() => setActiveMainView("chat")}
                onChatWithSingleSource={handleChatWithSingleSource}
              />
            )
          )}

          {activeTab === "sources" && (
            activeSelectedSource ? (
              <SourceViewer
                source={activeSelectedSource}
                onToggleSource={handleToggleSource}
                onClose={() => setSelectedSourceId(null)}
                onBackToChat={() => {
                  setActiveTab("home");
                  setActiveMainView("chat");
                }}
                onChatWithSingleSource={handleChatWithSingleSource}
              />
            ) : (
              /* Fallback if on sources tab but no source selected */
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 text-gray-400 max-w-md mx-auto space-y-4">
                <BookOpen className="w-16 h-16 text-gray-200" />
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-[#1f1f1f]">استكشاف المستندات البحثية</h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    الرجاء الضغط على أحد المستندات في القائمة لقراءة محتواه بالكامل، أو إضافة وثيقة جديدة في الأسفل.
                  </p>
                </div>
              </div>
            )
          )}

          {activeTab === "editor" && (
            <SynthesisEditor
              sources={sources}
              onSaveSynthesis={handleSaveSynthesis}
            />
          )}

          {activeTab === "history" && (
            <SynthesisHistory
              syntheses={syntheses}
              onDeleteSynthesis={handleDeleteSynthesis}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              temperature={temperature}
              setTemperature={setTemperature}
              onResetWorkspace={handleResetWorkspace}
              onShowLandingPage={() => {
                setShowLandingPage(true);
                try {
                  localStorage.removeItem("bahthos_entered_app");
                  localStorage.removeItem("tawlif_entered_app");
                } catch (e) {}
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
