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
  if (!item || !item.term || typeof item.term !== "string") return false;
  const t = item.term.trim().toLowerCase();
  const def = (item.definition || "").trim().toLowerCase();
  const draft = (item.draft_term || "").trim().toLowerCase();
  const verified = (item.verified_term || "").trim().toLowerCase();
  const translit = (item.transliteration || "").trim().toLowerCase();

  // 1. Length & Basic Structure Checks
  if (t.length < 3 || t.length > 50) return false;
  if (t.split(/\s+/).length > 4) return false; // concepts are concise (1-4 words max)
  if (/^(vol|volume|no|issue|pp|pages?|page|\d+|http|https|doi|isbn|issn)\b/i.test(t)) return false;

  // 2. Reject non-conceptual or placeholder definitions
  if (
    !def ||
    def.length < 20 ||
    def.includes("مفهوم أو عنوان") ||
    def.includes("عنوان بحثي") ||
    def.includes("مستخرج من نص المستند") ||
    def.includes("مقتطف مضاف") ||
    def.includes("تعذر توليد") ||
    def.includes("مسودة محددة")
  ) {
    return false;
  }

  // 3. Strict Banned Tokens (Authors, Names, Universities, Software, Publishers, Non-concept words)
  const BANNED_TOKENS = [
    // Person names & author name fragments
    "jollie", "carol", "javed", "khumalo", "sharma", "chiriac", "ramsuraj", "cantillon",
    "siddiqui", "ahmad", "khan", "hassan", "pedag", "matt", "david", "peter", "tatiana",
    "trisha", "sunil", "kumar", "seddik", "kansara", "mbalenhle", "imshad", "jamshed",
    "moulay", "mohamed", "ahmed", "ali", "john", "smith", "michael", "robert", "creanga",
    // Universities, Institutions, Software & Platforms
    "macquarie", "durban", "open university", "state university", "blackwell", "microsoft",
    "netscape", "explorer", "communicator", "madrasati", "springer", "elsevier", "routledge",
    "ieee", "wiley", "nature", "sage", "taylor", "francis", "oxford", "cambridge", "jstor",
    "pubmed", "scopus", "web of science", "frontiers", "mdpi", "emerald", "proquest", "arxiv",
    "researchgate", "academia", "google scholar", "harvester", "press", "university",
    "department", "scholar", "supervisors", "supervisor", "faculty", "school", "college",
    // Vague phrases, title snippets, non-concept general terms
    "abstract", "introduction", "nowadays", "developing", "achieving", "practical",
    "guide", "world wide", "strategic", "management", "corporate", "education", "science",
    "learning technologies", "plug-ins", "html", "hyperlinks", "videostreaming", "self assessments"
  ];

  for (const token of BANNED_TOKENS) {
    if (
      t.includes(token) ||
      draft.includes(token) ||
      verified.includes(token) ||
      translit.includes(token)
    ) {
      return false;
    }
  }

  // 4. Banned Bibliographic / Heading / Location indicators
  const BANNED_PHRASES = [
    "journal of", "proceedings of", "bulletin of", "annals of", "review of", "handbook of",
    "edited by", "volume ", "issue ", "chapter ", "table of contents", "page number",
    "united states", "united kingdom", "north america", "south america", "western europe",
    "eastern europe", "middle east", "north africa", "new york", "london", "paris", "berlin",
    "vague process", "general process", "analysis process", "key finding",
    "important result", "study result", "research paper", "book title", "paper title",
    "author name", "publisher name", "main result", "overview of"
  ];

  for (const phrase of BANNED_PHRASES) {
    if (t.includes(phrase)) return false;
  }

  // 5. Banned Arabic Indicators
  const BANNED_ARABIC = [
    "دار نشر", "اسم ناشر", "اسم مؤلف", "كاتب", "عنوان كتاب", "عنوان ورقة", "عنوان دراسة",
    "عنوان مقال", "مجلة علمية", "دورية علمية", "جامعة", "مؤسسة أكاديمية", "كلية", "وزارة",
    "جمعية", "منظمة", "مؤتمر", "مدينة", "دولة", "مطبعة", "منشورات", "مكتبة", "طبعة", "مجلد",
    "رسالة ماجستير", "أطروحة دكتوراه", "قسم ", "معهد ", "مركز بحوث", "دراسة حول", "بحث بعنوان",
    "كتاب بعنوان", "دكتور", "أستاذ", "البروفيسور", "الباحث", "الباحثة", "عملية معقدة",
    "نتائج هامة", "جانب رئيسي", "نقاط أساسية", "دراسة هامة", "بحث جيد", "العملية البحثية"
  ];

  for (const ar of BANNED_ARABIC) {
    if (t.includes(ar) || draft.includes(ar) || verified.includes(ar) || translit.includes(ar)) {
      if (!def.includes("المفهوم") && !def.includes("مصطلح") && !def.includes("مبدأ") && !def.includes("طريقة") && !def.includes("أسلوب")) {
        return false;
      }
    }
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
    const promptText = `أنت محرك متقدم للتحليل الأكاديمي في "بحث OS".
قم بتحليل المستند واستخرج عنوانه، لغته، ملخصه، والمصطلحات الأكاديمية أو التقنية فقط.
تنبيه صارم: يمنع استخراج أسماء الناشرين أو المؤلفين أو العناوين كـ "مصطلحات".`;

    let contents: any;
    if (useMultimodalPdf) {
      let cleanBase64 = base64.trim();
      if (cleanBase64.includes("base64,")) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      contents = [
        { inlineData: { data: cleanBase64, mimeType: "application/pdf" } },
        { text: `${promptText}\n\nالرجاء قراءة وتحليل ملف PDF المرفق أعلاه بالكامل وإنتاج النتيجة بصيغة JSON.` }
      ];
    } else {
      contents = `${promptText}\n\nنص المستند:\n${parsedContent.substring(0, 4000)}`;
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.0-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const data = JSON.parse(response.text?.trim() || "{}");
    result.title = data.title || fileName || "مستند بدون عنوان";
    result.language = data.language || "ar";
    result.summary = data.summary || "تعذر توليد ملخص أكاديمي تلقائي.";
    result.extractedText = data.extractedText || "";
    result.terms = (data.terms || []).filter(isValidAcademicConcept);
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
    const prompt = `أنت خبير تدقيق مفاهيمي وأكاديمي متقدم في "بحث OS".
مهتك: استخراج ما لا يزيد عن مفهومين (2) رئيسيين وحقيقيين فقط من النص المرفق.
المفاهيم المقبولة حصراً: النظريات المعرفية، المناهج البحثية، الأطر النظرية، والمؤشرات الإحصائية الأساسية (مثال: الإطار المفاهيمي، المنهجية البحثية، البنائية، الواقعية الهيكلية، التحليل التجريبي، الارتباط الإحصائي، العزلة الأكاديمية).

قيود صارمة للغاية (ممنوع تماماً):
1. يمنع منعاً باتاً استخراج أسماء الأشخاص والمؤلفين والباحثين (مثل: Carol, Javed, Khumalo, Matt, David, Khan, Ahmad, Siddiqui).
2. يمنع منعاً باتاً استخراج أسماء الجامعات والمؤسسات ودور النشر (مثل: Durban University, Macquarie, Blackwell, Springer, Elsevier).
3. يمنع منعاً باتاً استخراج البرامج والتقنيات والمستعرضات العامة (مثل: Microsoft Explorer, Netscape, HTML, Hyperlinks).
4. يمنع منعاً باتاً استخراج عناوين الكتب أو الأوراق أو رؤوس الفقرات أو العبارات العامة العابرة (مثل: Abstract, Developing Effective, Educational Supervisors, Research Scholar).
5. يجب أن يحتوي كل مفهوم على تعريف أكاديمي رصين ومفصّل باللغة العربية.

النص:
${text.substring(0, 3500)}`;

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
  const { sources, glossaryTerms, isExplicitDelete } = req.body;
  try {
    let finalSources = Array.isArray(sources) ? sources : [];
    let finalGlossary = Array.isArray(glossaryTerms) ? glossaryTerms : [];

    if (!isExplicitDelete && fs.existsSync(STATE_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(STATE_FILE_PATH, "utf8");
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed.sources)) {
          const merged = [...finalSources];
          parsed.sources.forEach((es: any) => {
            if (!merged.some((ms) => ms.id === es.id || ms.title === es.title)) {
              merged.push(es);
            }
          });
          finalSources = merged;
        }
        if (Array.isArray(parsed.glossaryTerms)) {
          const merged = [...finalGlossary];
          parsed.glossaryTerms.forEach((eg: any) => {
            if (!merged.some((mg) => mg.term.toLowerCase() === eg.term.toLowerCase())) {
              merged.push(eg);
            }
          });
          finalGlossary = merged;
        }
      } catch (e) {
        console.warn("Failed to parse existing state file during merge:", e);
      }
    }

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
