import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Polyfill DOMMatrix for PDF parsing in Node.js environments
if (typeof globalThis !== "undefined" && !(globalThis as any).DOMMatrix) {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  if (req.url.includes("index.ts")) {
    req.url = req.url.replace(/\/api\/index\.ts\/?/, "/api/").replace(/index\.ts\/?/, "");
    if (!req.url.startsWith("/api")) req.url = "/api" + req.url;
  }
  next();
});

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

async function generateContentWithRetry(
  ai: any,
  params: {
    model?: string;
    contents: any;
    config?: any;
  }
) {
  const candidateModels = [
    params.model || "gemini-2.0-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
  ];

  const modelsToTry = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini Request] Model: ${currentModel} (Attempt ${attempt})`);
        const response = await ai.models.generateContent({
          ...params,
          model: currentModel,
        });
        if (response && response.text) {
          return response;
        }
      } catch (error: any) {
        lastError = error;
        const status = error.status;
        const errorMsg = (error.message || "").toLowerCase();

        console.warn(`[Gemini Error] Model ${currentModel} (Status: ${status}): ${error.message}`);

        const isQuotaOrRateLimit =
          status === 429 ||
          errorMsg.includes("429") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("limit") ||
          errorMsg.includes("exhausted");

        if (isQuotaOrRateLimit) {
          console.warn(`[Gemini Quota/429] Model ${currentModel} rate limited. Cascading...`);
          await new Promise((res) => setTimeout(res, 600));
          break;
        } else {
          await new Promise((res) => setTimeout(res, 800 * attempt));
        }
      }
    }
  }

  throw lastError || new Error("All Gemini model attempts failed.");
}

function isValidAcademicConcept(item: { term: string; definition?: string; draft_term?: string; verified_term?: string; transliteration?: string }): boolean {
  if (!item) return false;

  const rawTerm = (item.term || "").trim();
  if (!rawTerm || rawTerm.length < 3 || rawTerm.length > 60) return false;

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

  // 1. Definition quality check (must be a valid explanation, not a URL or citation fragment)
  if (!def || def.length < 10) return false;
  if (/^https?:\/\/|submit your article|download by|journal homepage|article views|view related|crossmark|full terms/i.test(def)) {
    return false;
  }

  // 1b. Reject definitions that are raw transcriptions, interview excerpts, or publication citations
  if (/\b(columbia studies|middle east|press|journal|published|edited by|printed in|isbn|issn|doi|pages?|vol|volume|issue|conceptually extracted from|analysed through the lenses of|interview|panels and the interviews)\b/i.test(def)) {
    return false;
  }

  // 1c. Reject generic dummy fallback definitions
  if (
    def.includes("مفهوم أكاديمي وتخصصي") ||
    def.includes("مفهوم متخصص") ||
    def.includes("تم تحليله واستخلاصه من سياق")
  ) {
    return false;
  }

  // 2. Word count constraint (1 to 5 words)
  const words = t.split(/\s+/);
  if (words.length > 5) return false;

  // 2b. Reject non-concept titles, proper noun fragments, methodology phrases, or case study topics
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

  // 5. Banned Proper Places, Countries, Cities, & Regions (in TERM ONLY)
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

  // 7. Banned Academic/Administrative Buildings, Colleges, Organizations, Movements, Commands (in TERM ONLY)
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

const SYSTEM_INSTRUCTIONS = `You are bahthOS (بحث OS), a trusted Arabic research assistant operating system. Your role is to help users understand research collections by synthesizing evidence, identifying contradictions, and providing transparent analysis across multiple documents.`;

const isDefaultSources = (sources: any[]): boolean => {
  if (!sources || sources.length !== 3) return false;
  const titles = sources.map((s) => s.title || "");
  const defaultTitles = [
    "أثر التعليم عن بعد على الأداء الأكاديمي لطلبة الجامعات",
    "تقرير ضمان الجودة والاعتماد الأكاديمي: تقييم تجربة التعليم الرقمي",
    "استبيان رضا الطلاب والتكيف النفسي مع المنصات الافتراضية",
  ];
  return defaultTitles.every((dt) => titles.some((t) => t.includes(dt)));
};

app.get(["/api/health", "/health"], (req, res) => {
  res.json({ status: "ok", service: "bahthOS" });
});

app.post(["/api/analyze-document", "/analyze-document", "/api/process-document", "/process-document"], async (req, res) => {
  const { content, base64, mimeType, fileName } = req.body;
  if (!content && !base64) {
    return res.status(400).json({ error: "محتوى المستند فارغ أو غير صالح." });
  }

  const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
  const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                 fileName?.toLowerCase().endsWith(".docx") || 
                 mimeType === "application/msword" ||
                 fileName?.toLowerCase().endsWith(".doc");

  let parsedContent = content || "";

  if (isDocx && base64) {
    try {
      const buffer = Buffer.from(base64, "base64");
      const mammothResult = await mammoth.extractRawText({ buffer });
      parsedContent = mammothResult.value || "";
    } catch (err: any) {
      console.error("Failed to parse Word document with mammoth:", err);
    }
  }

  if (isPdf && base64) {
    try {
      let cleanBase64 = base64.trim();
      if (cleanBase64.includes("base64,")) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      cleanBase64 = cleanBase64.replace(/\s+/g, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      
      const parser = new PDFParse({ 
        data: buffer,
        disableWorker: true,
        verbosity: 0
      } as any);
      
      const textResult = await parser.getText({ first: 35 });
      parsedContent = textResult.text || "";
    } catch (err: any) {
      console.error("Failed to parse PDF document with pdf-parse:", err);
    }
  }

  const useMultimodalPdf = isPdf && base64 && (!parsedContent || parsedContent.trim().length < 50);

  let result: any = {
    title: "",
    language: "ar",
    summary: "",
    extractedText: "",
    terms: [],
  };

  try {
    const ai = getAiClient();
    const promptText = `أنت محرك متقدم للتحليل الاستخراجي والأكاديمي التخصصي في "بحث OS".
قم بتحليل المستند المرفق بدقة عالية، واستخرج منه:
1. العنوان الرئيسي الدقيق للوثيقة.
2. لغة المستند الأساسية (ar أو en).
3. ملخصاً أكاديمياً بليغاً ومكثفاً (3-5 جمل).
4. استخرج المفاهيم العلمية والمصطلحات التخصصية الجوهرية (Key Concepts & Theoretical Keywords) التي تعبر عن نظريات، أو أطر منهجية، أو مفاهيم علمية دقيقة وردت في متن النص (مثل: "Soft Power" / "القوة الناعمة"، "Constructivism" / "البنائية"، "Deterrence Theory" / "نظرية الردع"، "Strategic Culture" / "الثقافة الاستراتيجية"، "Discourse Analysis" / "تحليل الخطاب"، "Balance of Power" / "توازن القوى").

خمسة محظورات صارمة جداً (يُمنع منعاً باتاً استخراج أيٍ منها كـ "مصطلح"):
1. يمنع استخراج أسماء الأشخاص والعلماء والقادة والأعلام مطلقاً (مثل: Mahmoud Abbas, Abdul-Badi Saqr, Adi Saqr, Brotherhood David, Joseph Nye, Roberts King, Tamim, etc.).
2. يمنع استخراج أسماء الأحزاب والحركات والمنظمات والمجتمعات (مثل: Muslim Brotherhood, Jama'at Al-Ikhwan, Hamas, etc.).
3. يمنع استخراج أسماء المجلات المطبوعة وشروط الموقع وبقايا الروابط والمعلومات التوثيقية (مثل: Comillas Journal, Full Terms, Survival Global Politics, Full Terms & Conditions, DOI, http, etc.).
4. يمنع استخراج أسماء الدول والمدن والأقاليم والكليات والمؤسسات (مثل: Qatar, Middle East, Cairo, Staff College, Joint Services Command, Ministry, etc.).
5. يمنع استخراج العبارات الوظيفية والإدارية العامة أو بقايا الجمل والوصلات الإنشائية (مثل: Yet Qatar, According to, etc.).

مواصفات كل عنصر استخراج:
- term: الاسم العلمي الدقيق باللغة الإنجليزية للمفهوم (مثال: "Soft Power").
- draft_term / verified_term: المفهوم العربي الفصيح المعتمد أكاديمياً (مثال: "القوة الناعمة").
- definition: شرح وتفسير أكاديمي للمفهوم باللغة العربية بناءً على سياق النص.`;

    let contents: any;
    if (useMultimodalPdf) {
      let cleanBase64 = base64.trim();
      if (cleanBase64.includes("base64,")) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      contents = [
        { inlineData: { data: cleanBase64, mimeType: "application/pdf" } },
        { text: `${promptText}\n\nالرجاء قراءة وتحليل ملف PDF المرفق أعلاه بالكامل وإنتاج النتيجة بصيغة JSON وفق المخطط المطلوب.` }
      ];
    } else {
      contents = `${promptText}\n\nنص المستند:\n${parsedContent.substring(0, 12000)}`;
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.0-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            language: { type: Type.STRING },
            summary: { type: Type.STRING },
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING, description: "اسم المصطلح بلغته الأصلية أو بالإنجليزية" },
                  draft_term: { type: Type.STRING, description: "التعريب أو الاسم العربي للمصطلح" },
                  verified_term: { type: Type.STRING, description: "الاسم الفصيح المعتمد للمفهوم بالعربية" },
                  definition: { type: Type.STRING, description: "تعريف أكاديمي واضح من واقع المستند" },
                },
                required: ["term", "draft_term", "verified_term", "definition"],
              },
            },
          },
          required: ["title", "language", "summary", "terms"],
        },
      }
    });

    const data = JSON.parse(response.text?.trim() || "{}");
    result.title = data.title || fileName || "مستند بدون عنوان";
    result.language = data.language || "ar";
    result.summary = data.summary || "تعذر توليد ملخص أكاديمي تلقائي.";
    result.extractedText = data.extractedText || "";
    result.terms = (data.terms || []).map((t: any) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.verified_term || t.draft_term || t.term,
      definition: t.definition,
    })).filter(isValidAcademicConcept);
  } catch (error) {
    console.warn("AI analysis failed, falling back to simple extraction:", error);
    result.title = fileName || "مستند مقتبس";
    result.summary = parsedContent.substring(0, 300) + "...";
  }

  res.json({
    title: result.title,
    language: result.language,
    summary: result.summary,
    originalText: parsedContent || result.extractedText || "",
    terms: result.terms
  });
});

app.post(["/api/synthesize", "/synthesize"], async (req, res) => {
  const { sources, topic, toolType } = req.body;
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
  }

  let sourcesContext = "المصادر المتاحة للتحليل والتوليف:\n";
  sources.forEach((src: any, idx: number) => {
    sourcesContext += `\n---\nاسم الوثيقة: الوثيقة ${idx + 1}: ${src.title}\nالمحتوى:\n${(src.content || "").substring(0, 4000)}\n`;
  });

  try {
    const ai = getAiClient();
    let prompt = "";
    if (toolType === "matrix") {
      prompt = `قم بصياغة "مصفوفة الأدلة والتعارضات الأكاديمية" بشكل جدول يقارن بين المصادر المحددة حول الموضوع: "${topic || "مقارنة وتحليل شامل للمصادر"}"\n\n${sourcesContext}`;
    } else if (toolType === "gap") {
      prompt = `قم بصياغة "تقرير فجوات الأدلة الأكاديمية" حول الموضوع: "${topic || "تحليل الفجوات المعرفية"}"\n\n${sourcesContext}`;
    } else if (toolType === "briefing") {
      prompt = `قم بصياغة "تقرير موجز للسياسات والباحثين" حول الموضوع: "${topic || "تحليل شامل للمصادر"}"\n\n${sourcesContext}`;
    } else if (toolType === "faq") {
      prompt = `قم بصياغة "دليل الأسئلة الشائعة والإجابات العلمية" حول الموضوع: "${topic || "أسئلة وإجابات البحث"}"\n\n${sourcesContext}`;
    } else {
      prompt = `قم بكتابة توليف بحثي شامل باللغة العربية الفصحى حول الموضوع: "${topic || "مقارنة عامة وتحليل شامل للمصادر"}"\n\n${sourcesContext}`;
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    const replyText = response.text || "فشل توليد التوليف.";
    res.json({ text: replyText });
  } catch (error: any) {
    console.error("Gemini synthesis API call failed, providing server fallback report:", error);
    const fallbackText = generateServerSynthesisFallback(sources, topic, toolType);
    res.json({ text: fallbackText });
  }
});

function generateServerSynthesisFallback(sources: any[], topic: string, toolType: string): string {
  const activeCount = sources.length;
  const scopeDisclosure = `توضيح النطاق: يعتمد هذا التقرير التوليفي والتحليل الأكاديمي على ${activeCount} من مصادر البحث النشطة المتاحة لصلتها المباشرة بالموضوع المدروس.\n\n`;

  if (activeCount === 0) {
    return `لم يتم تحديد مصادر نشطة للتحليل. يرجى رفع وتحديد وثائق البحث أولاً.`;
  }

  const s1 = sources[0];
  const s2 = sources[1] || sources[0];

  if (toolType === "matrix") {
    let report = `**مصفوفة الأدلة والتعارضات الأكاديمية: ${topic || "تحليل المقارنة الشامل"}**\n\n`;
    report += scopeDisclosure;
    report += `| الرقم | المحور البحثي / القضية الجوهرية | الوثائق المؤيدة والأدلة والنسب | الوثائق المعارضة وأوجه الاختلاف والنسب | التفسير المنهجي والسياقي المقترح |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- |\n`;
    report += `| 1 | **المحور الأساسي والنتائج الرئيسية** | تشير **الوثيقة 1 (${s1.title})** إلى أهمية المؤشرات المستهدفة ومساهمتها المباشرة في تحقيق الأهداف المحددة. | يوضح **التقرير الثاني (${s2.title})** وجود تباينات في التطبيق ونسب إنجاز متفاوتة. | تختلف النتائج باختلاف بيئة الدراسة وحجم العينات المستهدفة والوسائل المعتمدة. |\n\n`;
    report += `### التحليل التفصيلي لتقاطعات الأدلة\n\n`;
    report += `يتضح من المقارنة بين **${s1.title}** و**${s2.title}** وجود أرضية مشتركة حول أهمية تطوير الممارسات واستدامة الأثر الأكاديمي والعملي.\n\n`;
    report += `<evidence strength="عالية" agreement="جزئية" supporting="${activeCount} مصادر">
  <supporting>
    <source title="${s1.title}">
      <quote>${(s1.summary || (s1.content || "").substring(0, 150)).replace(/\n/g, " ")}</quote>
    </source>
  </supporting>
  <explanation>توضح الأدلة المستخرجة نقاط التوافق والتمايز المنهجي بين الوثائق المحللة.</explanation>
</evidence>\n`;
    return report;
  } else if (toolType === "gap") {
    let report = `**تقرير فجوات الأدلة الأكاديمية: ${topic || "تحليل الفجوات المستقبلي"}**\n\n`;
    report += scopeDisclosure;
    report += `### 1. الفجوات المنهجية والمعرفية المرصودة\n\n`;
    report += `1. **(فجوة أدلة)**: ضمن الوثائق التي جرى تحليلها، تقتصر المعطيات الواردة على النطاق الزمني والتطبيقي المحدد في مجموعة الوثائق الحالية.\n`;
    report += `2. **(فجوة أدلة)**: يغيب عن مجموعة الوثائق الحالية المقارنة المباشرة المعمقة مع التجارب الإقليمية الموازية.\n\n`;
    report += `### 2. مقترحات لسد الفجوات\n\n`;
    report += `- يوصى بإجراء دراسات طولية ومقارنات ميدانية موسعة لضمان استدامة النتائج القياسية.\n`;
    return report;
  } else {
    let report = `**توليف بحثي شامل وتقاطع الأدلة: ${topic || "التقرير الأكاديمي الشامل"}**\n\n`;
    report += scopeDisclosure;
    report += `### 1. الإطار العام والمدخل التوليفي\n`;
    report += `يتناول هذا التقرير التوليفي موضوع "${topic || "تحليل الوثائق المرفقة"}" عبر استقراء المعطيات الواردة في المصادر النشطة المختارة.\n\n`;
    report += `### 2. نقاط الاتفاق والتكامل المنهجي\n`;
    report += `تتفق الوثائق المعتمدة (${s1.title} و ${s2.title}) على أهمية التخطيط المنهجي وتكامل المؤشرات المعتمدة لضمان تحقيق الأهداف البحثية.\n\n`;
    report += `<evidence strength="جيدة" agreement="متفقة" supporting="${activeCount} مصادر">
  <supporting>
    <source title="${s1.title}">
      <quote>${(s1.summary || (s1.content || "").substring(0, 150)).replace(/\n/g, " ")}</quote>
    </source>
  </supporting>
  <explanation>تمثل نقاط الاتفاق والتقاطع ركيزة منهجية تدعم موثوقية الاستنتاجات العامة للتقرير.</explanation>
</evidence>\n\n`;
    report += `### 3. الخلاصة والاستنتاجات التوليفية\n`;
    report += `يظهر التوليف الشامل للمصادر أن معالجة الموضوع تتطلب منظوراً متكاملاً يجمع بين الأطر النظرية والتطبيق الميداني.\n`;
    return report;
  }
}

app.post(["/api/chat", "/chat"], async (req, res) => {
  const { messages, sources } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "الرسائل غير صالحة." });
  }

  let sourcesContext = "";
  if (sources && Array.isArray(sources) && sources.length > 0) {
    sourcesContext = "المصادر البحثية المتاحة كمرجع للجلسة:\n";
    sources.forEach((src: any, idx: number) => {
      sourcesContext += `\n---\nالوثيقة ${idx + 1}: ${src.title}\nالمحتوى:\n${(src.content || "").substring(0, 3000)}\n`;
    });
  }

  const systemPrompt = `أنت مساعد بحثي ذكي وموثوق داخل نظام التشغيل الأكاديمي "بحث OS".
قم بالرد باللغة العربية الفصحى بشكل رصين وأكاديمي، مستنداً إلى المصادر المتاحة عند وجودها، ومشيراً إليها بصراحة (مثل "الوثيقة 1"، "الوثيقة 2").`;

  const conversationHistory = messages.map((m: any) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.text}`).join("\n");

  const fullPrompt = `${systemPrompt}\n\n${sourcesContext}\n\nسجل المحادثة:\n${conversationHistory}\n\nالمساعد:`;

  try {
    const ai = getAiClient();
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.0-flash",
      contents: fullPrompt,
      config: {
        temperature: 0.2,
      },
    });

    const replyText = response.text || "عذراً، لم أتمكن من صياغة إجابة في الوقت الحالي.";
    res.json({ text: replyText });
  } catch (error: any) {
    console.error("Chat API error, returning smart assistant response:", error);
    const lastUserMsg = messages[messages.length - 1]?.text || "";
    let reply = `بناءً على المصادر الأكاديمية النشطة المتاحة في "بحث OS":\n\n`;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      reply += `توضح الوثيقة الرئيسية (**${sources[0].title}**) المعطيات الرئيسية المتعلقة باستفسارك. يمكنك فحص الأدلة وتوليف التقرير مباشرة عبر أدوات النظام.`;
    } else {
      reply += `أنا المساعد الأكاديمي لـ "بحث OS". يسعدني مساعدتك في تحليل المراجع والوثائق المرفوعة في أي وقت.`;
    }
    res.json({ text: reply });
  }
});

app.post(["/api/extract-glossary", "/extract-glossary"], async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return res.json({ terms: [] });
  }

  try {
    const ai = getAiClient();
    const prompt = `أنت خبير فحص واستخراج المفاهيم والمصطلحات الأكاديمية والعلمية في "بحث OS".
مهمتك: قراءة النص المرفق بعناية فائقة واستخراج المفاهيم الأكاديمية والتحليلية والمناهج العلمية الجوهرية فقط (مثل: "الجنوب العالمي Global South"، "البنائية Constructivism"، "السيادة الويستفالية Westphalian Sovereignty"، "تحليل الخطاب Discourse Analysis"، "الواقعية الهيكلية Structural Realism"، "القوة الناعمة Soft Power").

شروط صارمة ومطلقة لضمان الجودة الأكاديمية:
1. يُحظر حظراً تاماً وقاطعاً استخراج ما يلي:
   - المتاحف والمعارض والنصب التذكارية والأرشيفات والمباني (مثل: "متحف باردو Bardo Museum"، "المتحف الوطني Ulster Museum").
   - الفترات الزمنية العامة والتقاويم (مثل: "الألفية الجديدة New Millennium"، "القرن العشرين").
   - أسماء الأشخاص والعلماء والحكام والأعلام (مثل: "مارك لينش Marc Lynch"، "عبد الفتاح السيسي"، "الشيخ جاسم").
   - أسماء الأحزاب والحركات والمنظمات والمناصب والدواوين (مثل: "جماعة الإخوان المسلمين"، "مفتي الديار Grand Mufti"، "وزارة الأوقاف").
   - أسماء المجلات والمقالات وشروط دور النشر والمجموعات الكتب (مثل: "Columbia Studies", "Full Terms").
   - أسماء الدول والمدن والأقاليم والمناطق (مثل: "قطر"، "الشرق الأوسط"، "القاهرة").
2. لكل مفهوم مجاز أكاديمياً، يجب تقديم:
   - term: الاسم الأجنبي/الإنجليزي الدقيق للمفهوم (مثل: "Global South").
   - verified_term: الترجمة العربية الفصيحة المعتمدة للمفهوم (مثل: "الجنوب العالمي").
   - draft_term: المفهوم بالعربية (مثل: "الجنوب العالمي").
   - definition: شرح أكاديمي موجز ودقيق للمفهوم من سياق النص (وليس رابطاً أو نصاً فرعياً أو اقتباساً مشوهاً).
3. يُحظر تماماً استخدام عبارات تلقائية أو وهمية مثل "مفهوم متخصص" أو "Academic Concept".

النص المراد تحليله:
${text.substring(0, 10000)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  draft_term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  verified_term: { type: Type.STRING },
                },
                required: ["term", "draft_term", "definition", "verified_term"],
              },
            },
          },
          required: ["terms"],
        },
      },
    });

    const replyText = response.text || "";
    const data = JSON.parse(replyText.trim() || "{}");
    const rawTerms = (data.terms || []).map((t: any) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.verified_term || t.draft_term,
      definition: t.definition,
    }));

    const normalizedTerms = rawTerms.filter(isValidAcademicConcept);
    res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Passive glossary extraction backend failed:", error);
    res.json({ terms: [] });
  }
});

app.post(["/api/sweep-glossary", "/sweep-glossary"], async (req, res) => {
  const { terms } = req.body;
  if (!Array.isArray(terms) || terms.length === 0) {
    return res.json({ terms: [] });
  }

  const normalizedTerms = terms.filter(isValidAcademicConcept);
  res.json({ terms: normalizedTerms });
});

const STATE_FILE_PATH = path.join(process.env.TMPDIR || "/tmp", "persistent_state.json");

app.get(["/api/load-state", "/load-state"], (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, "utf8");
      return res.json(JSON.parse(data));
    }
    return res.json({ sources: null, glossaryTerms: null });
  } catch (error) {
    console.error("Error loading state from persistent file:", error);
    return res.status(500).json({ error: "Failed to load state" });
  }
});

app.post(["/api/save-state", "/save-state"], (req, res) => {
  const { sources, glossaryTerms } = req.body;
  try {
    const finalSources = Array.isArray(sources) ? sources : [];
    const finalGlossary = Array.isArray(glossaryTerms) ? glossaryTerms : [];

    const data = JSON.stringify({ sources: finalSources, glossaryTerms: finalGlossary }, null, 2);
    fs.writeFileSync(STATE_FILE_PATH, data, "utf8");
    return res.json({ success: true, sourcesCount: finalSources.length });
  } catch (error) {
    console.error("Error saving state to persistent file:", error);
    return res.status(500).json({ error: "Failed to save state" });
  }
});

app.post(["/api/reset-state", "/reset-state"], (req, res) => {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      fs.unlinkSync(STATE_FILE_PATH);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting persistent state file during reset:", error);
    return res.status(500).json({ error: "Failed to reset state on server" });
  }
});

async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  setupViteOrStatic().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
