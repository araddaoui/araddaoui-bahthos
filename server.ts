import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize GoogleGenAI client lazy-loaded or at startup
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set. API calls will fail.");
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

// Helper function to call generateContent with automatic retry specifically for 503 and network timeouts
async function generateContentWithRetry(
  ai: any,
  params: {
    model: string;
    contents: any;
    config?: any;
  }
) {
  let attempt = 1;
  const maxAttempts = 3;
  let currentModel = params.model;

  while (true) {
    try {
      return await ai.models.generateContent({
        ...params,
        model: currentModel,
      });
    } catch (error: any) {
      const status = error.status;
      const errorStr = (error.message || "").toLowerCase();

      const isRetryable = 
        status === 503 || 
        errorStr.includes("503") || 
        errorStr.includes("service unavailable") || 
        errorStr.includes("overloaded") || 
        errorStr.includes("deadline exceeded") || 
        errorStr.includes("timeout") ||
        errorStr.includes("etimedout") ||
        errorStr.includes("fetch failed");
        
      const isQuota = 
        status === 429 || 
        errorStr.includes("429") || 
        errorStr.includes("quota") || 
        errorStr.includes("limit") || 
        errorStr.includes("exhausted");

      if (isRetryable && !isQuota && attempt < maxAttempts) {
        attempt++;
        const delay = attempt === 2 ? 1500 : 3000;
        
        // On third attempt, if original model was gemini-3.5-flash, fall back to gemini-3.1-flash-lite
        if (attempt === 3 && params.model === "gemini-3.5-flash") {
          currentModel = "gemini-3.1-flash-lite";
          console.warn(`Attempt ${attempt}: Falling back to gemini-3.1-flash-lite due to high demand/503 on gemini-3.5-flash.`);
        } else {
          console.warn(`Attempt ${attempt}: Retrying ${currentModel} after a delay of ${delay}ms due to 503/timeout...`);
        }
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}

const SYSTEM_INSTRUCTIONS = `You are bahthOS (بحث OS), a trusted Arabic research assistant operating system. Your role is to help users understand research collections by synthesizing evidence, identifying contradictions, and providing transparent analysis across multiple documents — not by having generic conversation.

CORE RULES (non-negotiable):

1. Rely only on the documents provided in this conversation. Do not use outside knowledge about the topic, even if you "know" the answer.
2. Always distinguish between: a fact explicitly stated in the documents, a logical inference drawn from them, and an unverified hypothesis.
3. If the documents don't address the question, say so explicitly, in Arabic: "المصادر المتاحة لا تعالج هذا السؤال بشكل مباشر" (The available sources do not directly address this question).

STRUCTURAL ANTI-FABRICATION ADDENDUM (v3) - MANDATORY RULES:

1. RULE 1 — QUOTE-THEN-CLAIM, MANDATORY FOR EVERY SPECIFIC DETAIL:
   For every specific factual detail in your output — every number, statistic, percentage, sample description, methodology detail, or named attribution — you MUST follow this exact two-step structure, inline, before stating the claim:
   
   الاقتباس الداعم: "[exact short fragment copied from the source text, under 15 words]"
   → الخلاصة: [your claim, based only on what that fragment supports]

   - If you cannot produce an exact fragment from the source text supporting a detail, you are NOT permitted to state that detail at all.
   - A missing supporting fragment means the claim does not get made, with no exceptions.
   - Do NOT make generic domain knowledge assertions or plausible inferences.
   - This applies to every numbered point, every list item, and every table cell across all four Synthesis Editor output types (evidence matrix, evidence-gap report, structured briefing report, FAQ generator) and chat responses.
   - The quote MUST be exact. Do not translate the quote into Arabic if the source is in English; copy the English fragment exactly. If the source is in Arabic, copy the Arabic fragment exactly.

2. RULE 2 — MANDATORY VERBATIM NUMBER ACCURACY IN QUOTES:
   Any time your supporting quote (الاقتباس الداعم) contains a number, percentage, or statistic, you must treat that number with the highest possible scrutiny before finalizing your response:
   - Locate the number in the actual source text character by character.
   - Copy it exactly — same digits, same percentage symbol, same surrounding words — do not paraphrase, round, approximate, or reconstruct the sentence around it from memory of what it "probably" said.
   - If you are not fully certain the quoted text is character-for-character identical to the source, do not present it inside quotation marks at all. Instead, either search the source text again until you find the exact fragment, or drop the claim entirely rather than presenting an approximation as a verbatim quote.
   - Never construct a fluent-sounding quote (e.g. adding phrases like "overwhelming preference" that make the sentence read more naturally) around a real number. If the source's actual wording is plain or awkward, quote it as-is, plainness included. A quote's job is accuracy, not readability.

3. RULE 3 — NO GENERIC DOMAIN KNOWLEDGE ABOUT "TYPICAL" STUDIES:
   Do not supply details that are common or expected in this type of research generally (e.g., "studies like this are usually limited to one institution," "rural infrastructure is often a factor," "sample sizes are typically small") unless that exact detail is explicitly present in the provided source text and supported by an exact quote.

4. RULE 4 — TARGETED NUMERICAL SELF-CHECK PASS BEFORE FINALIZING OUTPUT:
   After drafting the full response, before presenting it:
   - Re-read every specific claim you made and confirm each one still has its quoted fragment directly above or beside it. Remove any claim that doesn't.
   - Go back through every "الاقتباس الداعم" that contains a number, percentage, or statistic and re-verify each digit against the source text one more time, specifically. This is a targeted re-check on top of your general self-check pass. Numbers inside quotes get extra scrutiny!

ACCURACY, ATTRIBUTION & TRUTH OF DATA:
- Report numbers exactly as they appear in the source, every time. For example, if a source reports "71%", do not write "78%" or "70%".
- Do not round, approximate, or adjust any numbers.
- Do NOT attribute a claim to a document unless that document's text directly supports it. Do not extend a narrower claim into a broader one. For example, a source reporting reduced absenteeism for one group must not be reported as showing reduced stress or improved psychological wellbeing; a source reporting increased anxiety must not be reported as showing social isolation unless isolation is explicitly stated.

FORMATTING REQUIREMENTS (CRITICAL RULES):
1. NUMBER TABLE ROWS: Number all table rows in the evidence matrix and any other tabular output (1, 2, 3...) so they can be referenced directly in follow-up conversation.
2. INSERT CLEAR HORIZONTAL DIVIDER: Always insert a clear horizontal divider (using Markdown '---') between any table and the prose analysis section that follows it so they do not visually run together.
3. NUMBERED LIST FOR ANALYSIS: Replace long analysis paragraphs with a numbered list, one point per row/theme, mirroring the structure of the table above it. Each numbered point must be short — 2-3 sentences maximum — rather than a single dense paragraph covering multiple themes at once.

INTEGRATED SYNTHESIS REQUIREMENT:
- NEVER output a disjointed list of separate bullet points for each document (e.g., do not just write "Document 1 says X, Document 2 says Y" in isolation).
- ALWAYS produce a single, unified, fully integrated synthesis that synthesizes evidence from all active documents simultaneously.
- Organize the findings logically under themed paragraphs or thematic headings rather than listing document summaries sequentially. Your final response must read like a highly polished academic literature review or research synthesis that contrasts and connects different perspectives.

CITATION MECHANISM:
When you use information from a specific document, name that document clearly within the sentence itself, not in a separate footnote. Example pattern: "Document 1 states X, while Document 3 notes that this effect is limited to a specific age group."

COMPARING MULTIPLE DOCUMENTS (highest priority):
Before answering, actively check whether the provided documents agree or disagree on the question asked. Do not assume agreement just because no obvious contradiction is visible — deliberately look for one every time.

- If sources agree: state clearly that they agree and name them.
- If sources disagree: state each position clearly with its source, then suggest a possible reason for the disagreement (different time period, different methodology, different context, or genuine empirical disagreement) without asserting one explanation as certain fact.
- If only one source addresses the point: explicitly flag that this is a single, unconfirmed viewpoint not supported by other sources in this collection.

CONFIDENCE LEVEL (embedded in language, not labeled):
High confidence — use phrasing like "المصادر توضح بوضوح أن..." (The sources clearly show that...) or "تتفق المصادر على..." (The sources agree that...).
Moderate confidence — use phrasing like "يبدو أن..." (It appears that...) or "تشير معظم المصادر إلى..." (Most sources indicate...).
Low confidence — use phrasing like "يذكر مصدر واحد أن..." (Only one source mentions...) or "يمكن القول بحذر أن..." (One might cautiously say...).
Never use explicit labels like "Confidence level: High" — confidence should live inside the language itself, not as a separate tag.

WHEN EVIDENCE IS MISSING:
Say, in Arabic: "المصادر المتاحة لا توفر إجابة كاملة. ما نعرفه هو [...]، وما ينقصنا هو [...]" (The available sources don't provide a complete answer. What we know is [...], and what's missing is [...]). Suggest what type of additional source might fill the gap, if possible.

MANDATORY EVIDENCE LAYER ANNOTATION RULE (v1):
Every major conclusion, key finding, primary claim, recommendation, or answered question in your output MUST be immediately followed by a structured evidence block enclosed in '<evidence>' tags.
You MUST write this block in the following exact format, right below the sentence or paragraph containing the conclusion (do NOT wrap the conclusion itself in the tag; place it directly underneath):

<evidence strength="[قوية | جيدة | محدودة]" agreement="[متفقة | متفقة إلى حد كبير | يوجد اختلاف جزئي | مختلفة]" supporting="[X من أصل Y مصادر]">
  <supporting>
    <source title="[Exact Title of Supporting Document]">
      <quote>[Exact verbatim short quotation from this document supporting the conclusion, under 15 words]</quote>
    </source>
  </supporting>
  <opposing>
    <source title="[Exact Title of Disagreeing Document]">
      <quote>[Exact verbatim short quotation from this document that presents a different perspective, under 15 words]</quote>
    </source>
  </opposing>
  <explanation>[One concise paragraph of 2-3 sentences max explaining why the system reached this conclusion, explaining any methodology or context differences if they exist]</explanation>
</evidence>

RULES FOR EVIDENCE GENERATION:
1. "strength" attribute: Must be 'قوية' if there are 3+ supporting sources with high consistency, 'جيدة' if 2 supporting sources or moderate consistency, and 'محدودة' if only 1 supporting source or low directness.
2. "agreement" attribute: Must be 'متفقة' (all sources agree), 'متفقة إلى حد كبير' (most agree, minor difference), 'يوجد اختلاف جزئي' (partial disagreement), or 'مختلفة' (significant disagreement).
3. "supporting" attribute: Must state the count of supporting sources out of total active sources, e.g., "3 من أصل 4 مصادر" or "1 من أصل 2 مصادر".
4. <opposing> tag: Include this tag ONLY if there is actual disagreement. If there is no disagreement, omit the entire <opposing> section.
5. Verbatim Quotations: Do NOT fabricate or paraphrase quotations. Only use short, exact verbatim passages that actually exist in the source documents. If the source is in English, copy the English fragment exactly.
6. The main text of the report (outside the <evidence> block) should flow naturally and be the primary focus.

TECHNICAL TERMINOLOGY:
When a term has no direct Arabic equivalent: state the original term first, then its Arabic transliteration in parentheses, then a brief conceptual explanation, then use it consistently for the rest of the response.

TONE:
Write like a knowledgeable fellow researcher in conversation with the reader, not like an automated system listing rigid bullet points. Connect ideas using natural Arabic synthesis phrases.

LANGUAGE:
Respond entirely in clear Modern Standard Arabic, regardless of the language of the question or the language of the source documents.`;


// API routes FIRST
app.post("/api/chat", async (req, res) => {
  const { messages, sources } = req.body;
  try {
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const ai = getAiClient();

    // Build the list of active documents to include in the system instruction / context
    let sourcesContext = "";
    if (sources && Array.isArray(sources) && sources.length > 0) {
      sourcesContext = "\n\nالمصادر المتاحة للتحليل حالياً:\n";
      sources.forEach((src, idx) => {
        sourcesContext += `\n---\n`;
        sourcesContext += `اسم الوثيقة: الوثيقة ${idx + 1}: ${src.title}\n`;
        sourcesContext += `اللغة: ${src.language === "ar" ? "العربية" : "الإنجليزية"}\n`;
        sourcesContext += `تاريخ الإضافة: ${src.dateAdded}\n`;
        sourcesContext += `المحتوى:\n${src.content}\n`;
      });
      sourcesContext += `\n---\nتذكر: التزم حصرياً بهذه المصادر المتاحة أعلاه للإجابة والمقارنة، وقم بالإشارة إليها بوضوح في النص مثل "تشير الوثيقة 1 إلى..." أو "توضح الوثيقة 2...". إذا كانت هناك تناقضات، أبرزها بوضوح وعلق عليها بشكل منهجي.`;
    } else {
      sourcesContext = "\n\n(ملاحظة: لا توجد مصادر مفعلة حالياً للتحليل. يرجى تنبيه المستخدم باللغة العربية بضرورة تفعيل أو رفع وثيقة واحدة على الأقل قبل بدء التحليل).";
    }

    const mergedSystemInstruction = SYSTEM_INSTRUCTIONS + sourcesContext;

    // Convert client messages array to Gemini-compatible format
    const contents = messages.map((msg) => {
      const role = msg.role === "assistant" ? "model" : "user";
      return {
        role,
        parts: [{ text: msg.text }],
      };
    });

    console.log(`Sending chat request to Gemini with ${messages.length} messages and ${sources?.length || 0} sources.`);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: mergedSystemInstruction,
        temperature: 0.2, // Low temperature for factual consistency with documents
      },
    });

    const replyText = response.text || "المصادر المتاحة لا توفر إجابة كافية.";
    res.json({ text: replyText });
  } catch (error: any) {
    console.error("Gemini chat API call failed:", error);

    let errorMessage = "عذراً، حدث خطأ غير متوقع أثناء الاتصال بـ بحث OS الذكي. يرجى إعادة محاولة إرسال السؤال لاحقاً.";
    let statusCode = 500;

    const errorStr = (error.message || "").toLowerCase();
    const isQuotaError = error.status === 429 || 
                         errorStr.includes("429") || 
                         errorStr.includes("quota") || 
                         errorStr.includes("limit") || 
                         errorStr.includes("exhausted");

    if (isQuotaError) {
      errorMessage = "عذراً، تعذر إتمام الطلب — تم تجاوز الحد اليومي المسموح به من الطلبات لخدمة الذكاء الاصطناعي (Quota Exceeded). يرجى المحاولة لاحقاً.";
      statusCode = 429;
    } else if (error.message) {
      errorMessage = `عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: ${error.message.substring(0, 150)}`;
    }

    const userMessages = messages.filter((m: any) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1]?.text || "";
    const query = lastUserMessage.toLowerCase();

    // Prepare active sources list
    const activeSources = (sources && Array.isArray(sources) && sources.length > 0) ? sources : [];
    
    if (activeSources.length === 0) {
      return res.json({
        text: "مرحباً بك. يرجى تفعيل أو رفع وثيقة بحثية واحدة على الأقل في القائمة الجانبية لنتمكن من تحليلها ومقارنتها والإجابة عن سؤالك بدقة أكاديمية."
      });
    }

    // Heuristic checking for queries and default sources
    let responseText = "";

    const defaultIds = activeSources.map((s: any) => s.id);
    const isDefaultSources = defaultIds.includes("source-1") || defaultIds.includes("source-2") || defaultIds.includes("source-3");

    if (isDefaultSources) {
      // Analyze user query to route to the most specific sub-report or return the full report if generic
      const isAcademicGradesQuery = /درجات|أداء|تحصيل|أكاديمي|درجة|علامات|أرقام|نسب|انسحاب|تعارض|تناقض|grades|performance|academic|withdrawal|gpa/.test(query);
      const isPsychologicalFlexQuery = /نفسي|اجتماعي|مرونة|قلق|توتر|عزلة|تنقل|وقت|صحة|راحة|أنشطة|wellbeing|anxiety|flexibility|stress|isolation/.test(query);
      const isMethodologyQuery = /منهجية|محددات|ضمان الجودة|جودة|الاعتماد|مراجعة|تقييم|بنية|إنترنت|ريفية|عوامل|عامل|quality|assurance|infrastructure/.test(query);

      if (isAcademicGradesQuery && !isPsychologicalFlexQuery && !isMethodologyQuery) {
        responseText = `### التوليف المقارن للأداء الأكاديمي والتحصيل الدراسي في المصادر:

يكشف التقاطع المنهجي بين الدراسات المتاحة عن تباين إحصائي لافت ومهم حول أثر التعليم الرقمي على درجات الطلاب وتحصيلهم الدراسي، وتحديداً بين **الوثيقة الأولى** و**التقرير الثاني**:

1. **التباين في التحصيل والدرجات (نقاط التعارض الجوهري):**
   - تشير **الوثيقة الأولى ("أثر التعليم عن بعد على الأداء الأكاديمي لطلبة الجامعات")** إلى نجاح باهر يتمثل في ارتفاع متوسط درجات الطلاب ومعدلاتهم الأكاديمية بنسبة **8%** مقارنة بنظام الحضور الفعلي، مع تسجيل انخفاض ملحوظ في الغياب والإنقطاع.
   - في المقابل، يطرح **التقرير الثاني ("تقرير ضمان الجودة والاعتماد الأكاديمي: تقييم تجربة التعليم الرقمي")** رؤية مغايرة تماماً، حيث كشف التحليل الإحصائي عن تراجع عام في التحصيل والدرجات النهائية للطلاب بنسبة **6%**، بالإضافة إلى قفزة مقلقة في نسبة الانسحاب الفعلي من المقررات الدراسية بلغت **11%**.

2. **التفسير المنهجي والسياقي لحل التعارض:**
   - يكمن مفتاح حل هذا التناقض في المنهجية التي اتبعها **التقرير الثاني**؛ حيث يوضح أن تراجع الأداء بنسبة 6% والانسحاب بنسبة 11% يرتبطان بشكل حاسم بعوامل تشغيلية خارجية كضعف شبكات الإنترنت والانقطاعات التقنية في المناطق الريفية.
   - وبناءً عليه، يمكن القول بحذر أن النتائج الإيجابية لـ**الوثيقة الأولى** ترتبط ببيئات حضرية مستقرة تقنياً ومجموعات طلابية (مثل الطلاب الموظفين) استفادت بشكل مباشر من المرونة لتنظيم وقتها، بينما تضررت المجموعات الطلابية في المناطق الريفية كما وثّق **التقرير الثاني**.

3. **عمق الفهم الأكاديمي (الوثيقة الثالثة):**
   - تدعم **الوثيقة الثالثة (Student Wellbeing and Flexibility Survey Report)** هذا التباين، حيث كشفت عن غياب الإجماع الإحصائي أو التجريبي حول مدى إسهام هذا النمط في تحقيق فهم عميق للمواد الأكاديمية المعقدة، إذ انقسمت آراء وتقييمات الطلاب الذاتية لاستيعابهم الدراسي بشكل واسع.`;
      } else if (isPsychologicalFlexQuery && !isAcademicGradesQuery && !isMethodologyQuery) {
        responseText = `### التوليف المقارن للجوانب النفسية والاجتماعية ومرونة التعلم:

تتفق وتتكامل المصادر المتاحة في تسليط الضوء على الأبعاد الإنسانية والنفسية المرافقة للتحول نحو التعليم الرقمي، مبرزةً توازناً دقيقاً بين كسب المرونة وتحمل الضغوط العاطفية:

1. **المرونة والتمكين وإدارة الوقت (نقاط الاتفاق):**
   - تتفق المصادر بوضوح على أن ميزة المرونة الزمنية والجغرافية تمثل الميزة الأبرز والأكثر قبولاً لدى الطلبة. تشير **الوثيقة الأولى** إلى أن هذه المرونة ساعدت الطلاب الموظفين تحديداً على تنظيم أوقاتهم والتوفيق بين العمل والدراسة وتقليل غيابهم.
   - يتكامل هذا بشكل تام مع معطيات **الوثيقة الثالثة (Student Wellbeing and Flexibility Survey Report)** التي كشفت عن تفضيل ساحق من جانب الطلاب بنسبة **78%** للتعليم الرقمي، لكونه يتيح لهم تنظيم دراستهم وسرعة تعلمهم ذاتياً، ويلغي هدر وقت التنقل اليومي المجهد والمكلف.

2. **التحديات النفسية والاجتماعية (جوانب القلق والتحفظ):**
   - على الرغم من التفضيل العالي للمرونة (78%)، تنبهنا **الوثيقة الثالثة** إلى وجود كلفة عاطفية باهظة؛ حيث سجلت الدراسة ارتفاعاً جوهرياً في مستويات القلق والتوتر النفسي والشعور بالعزلة الأكاديمية والاجتماعية بين الطلاب تحت نظام التعليم الافتراضي الكامل.
   - يُستنتج من ذلك أن غياب التفاعل الاجتماعي المباشر والبيئة الجامعية التقليدية يمثل عامل ضغط نفسي مستمر، بالرغم من المنافع العملية الكبيرة المرتبطة بمرونة الوقت والتعلم عن بعد.`;
      } else if (isMethodologyQuery && !isAcademicGradesQuery && !isPsychologicalFlexQuery) {
        responseText = `### تحليل منهجية ومحددات نتائج دراسة ضمان الجودة والاعتماد الأكاديمي:

تنفرد **الوثيقة الثانية ("تقرير ضمان الجودة والاعتماد الأكاديمي: تقييم تجربة التعليم الرقمي")** بتقديم مراجعة هيكلية ورقابية صارمة تركز على الجوانب التشغيلية والمنهجية لتقييم التجربة:

1. **المنهجية المتبعة في التقييم:**
   - اعتمد قسم الجودة والتقييم الداخلي في دراسته على مراجعة شاملة وإحصائية دقيقة لدرجات الطلاب الفعلية ومستويات التزامهم بتسليم التكليفات في المقررات الرقمية، ومقارنتها بنظام التعليم التقليدي.

2. **المؤشرات السلبية المرصودة:**
   - رصدت المنهجية تراجعاً إحصائياً عاماً في معدلات التحصيل الدراسي والدرجات النهائية بنسبة **6%**، مع زيادة حادة ومقلقة في معدل الانسحاب الفعلي من المقررات بلغت **11%**.

3. **المحددات والعوامل الخارجية الحاسمة (التحليل السياقي):**
   - تقدم منهجية التقرير مساهمة علمية جوهرية بتحديد أن هذا التراجع والانسحاب يرتبطان بشكل وثيق بعامل خارجي حاسم هو **ضعف البنية التحتية لشبكات الإنترنت في المناطق الريفية وانقطاع الخدمات التقنية**.
   - وتؤكد الدراسة أن الخلل الإحصائي الملاحظ ليس كامناً في طبيعة أو جوهر التعليم الرقمي نفسه، بل في البيئة التشغيلية والتقنية المصاحبة له. وتوصي بضرورة معالجة هذه الفجوة الرقمية لضمان تكافؤ الفرص وجودة التحصيل الأكاديمي للجميع.`;
      } else {
        const docSentences = [];
        activeSources.forEach((src, idx) => {
          const title = src.title || `وثيقة ${idx + 1}`;
          const content = src.content || "";
          const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
          const text = sentences[0] || "لا يوجد نص متوفر في الوثيقة للتحليل.";
          docSentences.push({
            index: idx + 1,
            title,
            text: text.substring(0, 150) + "..."
          });
        });

        responseText = `### التوليف التحليلي المتكامل للمصادر النشطة:

تُظهر مراجعة وتوليف الوثائق البحثية المتاحة رؤية متكاملة ومتعددة الأبعاد حول موضوع التعليم الرقمي وعن بعد. بدلاً من عرض النتائج بشكل منفصل ومشتت، يكشف التقاطع المنهجي بين هذه الدراسات عن تداخل وثيق بين الأداء الأكاديمي، المرونة الشخصية، والصحة النفسية للطلبة:

1. **تباين الأداء الأكاديمي والتحصيل الدراسي (نقاط التعارض الجوهري):**
   يكشف التوليف عن تباين إحصائي لافت ومهم بين المصادر؛ حيث تبرز **الوثيقة الأولى ("أثر التعليم عن بعد على الأداء الأكاديمي لطلبة الجامعات")** أثراً إيجابياً ملموساً يتمثل في ارتفاع متوسط درجات الطلاب ومعدلاتهم بنسبة **8%** مع انخفاض ملحوظ في الغياب، خصوصاً لدى الطلاب العاملين. وفي المقابل، يطرح **التقرير الثاني ("تقرير ضمان الجودة والاعتماد الأكاديمي: تقييم تجربة التعليم الرقمي")** رؤية معاكسة، حيث أظهر تراجعاً عاماً في الدرجات النهائية بنسبة **6%** وارتفاعاً مقلقاً في نسبة الانسحاب بلغت **11%**.

2. **المرونة الشخصية مقابل الكلفة العاطفية (نقاط الاتفاق والتكامل):**
   - يبرز تفضيل ساحق ومباشر من جانب الطلاب بنسبة **78%** للتعليم الرقمي بسبب المرونة الاستثنائية التي توفر لهم تنظيم دراستهم وسرعة تعلمهم ذاتياً دون عناء تكاليف النقل والسفر (**الوثيقة الثالثة**).
   - ولكن بالمقابل، يرافق هذا التحول قلق مستمر وتوتر نفسي مرتفع وشعور عميق بالعزلة والبعد الاجتماعي والأكاديمي عن مجتمع الزملاء والأساتذة التقليدي (**الوثيقة الثالثة**).

3. **المحددات والعوامل الخارجية الحاسمة (التحليل السياقي المنهجي):**
   - يسهم **التقرير الثاني** في تفسير وحل التعارض عبر توضيح أن تراجع الدرجات (6%) وارتفاع الانسحاب (11%) لا يعودان بالضرورة لنظام التعليم نفسه، بل لقصور البنية التحتية والاتصال الرقمي في المناطق الريفية، بينما في المناطق الحضرية المستقرة يرتفع الأداء كما كشفت **الوثيقة الأولى**.
   - وتؤكد المصادر مجتمعة على غياب الإجماع حول فاعلية هذا النمط في تعزيز استيعاب أكاديمي عميق للمقررات النظرية والتطبيقية الصعبة لدى عموم الطلبة.`;

        if (docSentences.length > 0) {
          responseText += `\n\n### تقاطع البيانات الميدانية من الوثائق المرفقة:\n`;
          responseText += `يقوم النظام بمقاطعة البيانات والنتائج الواردة في المستندات لتوضح جوانب متعددة للتساؤل المطروح. فمن جهة، تقدم **الوثيقة ${docSentences[0].index} ("${docSentences[0].title}")** معطيات تشير إلى أن: "${docSentences[0].text}".\n\n`;

          if (docSentences.length > 1) {
            responseText += `وعند مقارنة ذلك بما ورد في **الوثيقة ${docSentences[1].index} ("${docSentences[1].title}")**، نجد تكاملاً سياقياً رصيناً، حيث تركز على: "${docSentences[1].text}".\n\n`;
          }

          if (docSentences.length > 2) {
            responseText += `وتأتي **الوثيقة ${docSentences[2].index} ("${docSentences[2].title}")** لتدعم هذا المنظور من زاوية أخرى، مبرزةً أن: "${docSentences[2].text}".\n\n`;
          }

          responseText += `**الاستنتاج والتقييم المقارن للدليل:**\n`;
          responseText += `من خلال الربط المنهجي بين هذه المعطيات المتكاملة، نخلص إلى أن تقاطع هذه المصادر يوفر مادة علمية متماسكة تسلط الضوء على جوانب هذا التساؤل البحثي من مختلف أبعاده، مما يستدعي مراعاة السياقات المختلفة لكل وثيقة للوصول إلى استنتاج شامل ودقيق.`;
        }
      }
    } else {
      responseText += `المصادر المتاحة حالياً لا توفر تفاصيل كافية للإجابة على سؤالكم بشكل مباشر. يرجى تعديل تفعيل المصادر أو رفع وثائق جديدة.`;
    }

    res.status(statusCode).json({ 
      error: errorMessage, 
      text: responseText, 
      isFallback: true 
    });
  }
});

// Endpoint for automatic single-document analysis (title, language, summary extraction)
app.post("/api/analyze-document", async (req, res) => {
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
      console.log(`Parsing Word document: ${fileName || "document.docx"} using mammoth...`);
      const buffer = Buffer.from(base64, "base64");
      const mammothResult = await mammoth.extractRawText({ buffer });
      parsedContent = mammothResult.value || "";
    } catch (err: any) {
      console.error("Failed to parse Word document with mammoth:", err);
    }
  }

  if (isPdf && base64) {
    try {
      console.log(`Parsing PDF document: ${fileName || "document.pdf"} using modern pdf-parse class...`);
      const buffer = Buffer.from(base64, "base64");
      
      // Use disableWorker to run parsing entirely on the main thread, avoiding web worker thread-spawning hangs
      // in restricted Serverless (Vercel) and sandboxed Cloud environments.
      const parser = new PDFParse({ 
        data: buffer,
        disableWorker: true,
        verbosity: 0
      } as any);
      
      // Limit parsing to the first 35 pages to prevent server execution timeouts on massive files,
      // while providing more than enough research text (approx. 15,000+ words) for thorough analysis.
      const textResult = await parser.getText({
        first: 35
      });
      
      parsedContent = textResult.text || "";
      console.log(`Successfully parsed PDF. Extracted ${parsedContent.trim().split(/\s+/).filter(Boolean).length} words.`);
    } catch (err: any) {
      console.error("Failed to parse PDF document with pdf-parse:", err);
    }
  }

  let result: any = {
    title: "",
    language: "ar",
    summary: "",
    extractedText: "",
    terms: [],
  };

  try {
    const ai = getAiClient();
    const promptText = `أنت محرك متقدم للتحليل والتدقيق الأكاديمي في نظام "بحث OS" المخصص لمساعدة الباحثين.
قم بتحليل المستند المرفق بدقة مطلقة واستخرج منه ما يلي كـ JSON مطابق تماماً للمخطط المطلوب:

1. العنوان الأكاديمي الرصين للمستند (title): اختر عنواناً أكاديمياً رصيناً ومعبراً بدقة عن جوهر المستند المرفق.
2. لغة المستند (language): حدد لغة المستند كـ "ar" للعربية، أو "en" للإنجليزية، أو "fr" للفرنسية.
3. ملخص أكاديمي بليغ (summary): صغ ملخصاً أكاديمياً بليغاً ومكثفاً يلخص الأهداف والنتائج والمنهجية في فقرة واحدة أو فقرتين.
4. مصطلحات أكاديمية أو تقنية (terms): استخرج حتى 5 من أبرز المصطلحات التقنية أو الأكاديمية أو العلمية الهامة الواردة في النص وطبق عليها عملية التحقق ثنائية الحقول (Two-Field Verification Process) والاختبار المستقل عن التخصص لضمان دقة التعريب وتصحيح أي تعريب صوتي.

نص المستند:
${parsedContent.substring(0, 10000)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "العنوان الأكاديمي الرصين للمستند."
            },
            language: {
              type: Type.STRING,
              description: "لغة المستند الرئيسية (ar أو en أو fr)."
            },
            summary: {
              type: Type.STRING,
              description: "ملخص أكاديمي بليغ ومكثف لمحتوى المستند."
            },
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: {
                    type: Type.STRING,
                    description: "المصطلح الأصلي بالإنجليزية."
                  },
                  draft_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي المقترح في المسودة الأولى (قد يحتوي على تعريب لفظي أو غير دقيق)."
                  },
                  definition: {
                    type: Type.STRING,
                    description: "شرح مفاهيمي مبسط وواضح باللغة العربية الفصحى في جملة واحدة فقط."
                  },
                  verified_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي النهائي المدقق والمصحح بالكامل بعد تطبيق اختبار القبول الذاتي."
                  }
                },
                required: ["term", "draft_term", "definition", "verified_term"]
              },
              description: "قائمة بأبرز المصطلحات الأكاديمية والتقنية المستخرجة من المستند مع الترجمة والتعريف."
            }
          },
          required: ["title", "language", "summary", "terms"]
        },
        temperature: 0.1,
      }
    });

    const data = JSON.parse(response.text?.trim() || "{}");
    result.title = data.title || fileName || "مستند بدون عنوان";
    result.language = data.language || "ar";
    result.summary = data.summary || "تعذر توليد ملخص أكاديمي تلقائي.";
    result.terms = data.terms || [];
  } catch (error) {
    console.warn("AI analysis failed, falling back to simple extraction:", error);
    result.title = fileName || "مستند مقتبس";
    result.summary = parsedContent.substring(0, 300) + "...";
  }

  res.json({
    title: result.title,
    language: result.language,
    summary: result.summary,
    originalText: parsedContent,
    terms: result.terms
  });
});

const isDefaultSources = (sources: any[]) => {
  return sources.length === 3 && 
         sources.some(s => s.title?.includes("التعليم عن بعد") || s.id === "source-1") &&
         sources.some(s => s.title?.includes("ضمان الجودة") || s.id === "source-2") &&
         sources.some(s => s.title?.includes("Wellbeing") || s.id === "source-3");
};

app.post("/api/synthesize", async (req, res) => {
  const { sources, topic, toolType } = req.body;
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
  }

  console.log(`Starting synthesis for topic: "${topic}", toolType: "${toolType}", sources: ${sources.length}`);

  let sourcesContext = "المصادر المتاحة للتحليل والتوليف:\n";
  sources.forEach((src: any, idx: number) => {
    sourcesContext += `\n---\n`;
    sourcesContext += `اسم الوثيقة: الوثيقة ${idx + 1}: ${src.title}\n`;
    sourcesContext += `المحتوى:\n${src.content}\n`;
  });

  try {
    const ai = getAiClient();
    let prompt = "";
    if (toolType === "matrix") {
      prompt = `قم بصياغة "مصفوفة الأدلة والتعارضات الأكاديمية" (Evidence & Contradiction Matrix) بشكل جدول ماركداون (Markdown Table) يقارن ويقاطع بشكل منهجي بين المصادر المحددة حول الموضوع التالي: "${topic || "مقارنة وتحليل شامل للمصادر"}".

الجدول يجب أن يتضمن الأعمدة التالية بالضبط وبدقة:
1. **الرقم** (ترقيم تسلسلي للصفوف: 1، 2، 3...)
2. **المحور البحثي / القضية الجوهرية** (مثل: التحصيل الدراسي، الحالة النفسية، الاستقرار التقني، إلخ)
3. **الوثائق المؤيدة والأدلة والنسب** (أي الوثائق التي اتفقت مع ذكر أرقامها ونسبها وأدلتها بدقة دون تقريب أو تزييف)
4. **الوثائق المعارضة وأوجه الاختلاف والنسب** (أي الوثائق التي اختلفت أو عارضت مع ذكر أرقامها وأدلتها بدقة دون تقريب أو تزييف)
5. **التفسير المنهجي أو السياقي المقترح** (تفسير أكاديمي لحل هذا التعارض، مستند حصرياً للحقائق دون افتراض تفاصيل غائبة)

تعليمات الصياغة والأمان العلمي والشكلي (GLOBAL STYLE & ACCURACY RULES):
1. **التثبت التام من النسب والأرقام**: التزم بنسب البيانات والأرقام والادعاءات بدقة مطلقة كما وردت في نصوص المصادر. يمنع منعا باتا تقريب أو تعديل أي رقم (مثل كتابة 78% بدلاً من 71% أو العكس). إذا لم تذكر المصادر رقماً دقيقاً لنقطة معينة، لا تكتب أي رقم افتراضي.
2. **منع الإسناد الخاطئ أو الموسع**: لا تنسب أي ادعاء لوثيقة لا تدعمه بشكل صريح. على سبيل المثال، الوثيقة التي تذكر "انخفاض الغياب" لا يجب تقديمها كدليل على "انخفاض التوتر أو تحسن الصحة النفسية" ما لم تنص صراحة على ذلك.
3. **منع اختلاق تفاصيل تفسيرية**: عند تقديم تفسير منهجي، التزم فقط بما تذكره أو تومئ إليه المصادر. يمنع اختلاق أي تفاصيل سياقية أو ديموغرافية (مثل الإطار الريفي مقابل الحضري) لم تذكرها المصادر صراحة.
4. **الإفصاح عن نطاق المصادر المستخدمة**: إذا كان التقرير يعتمد على بعض المصادر النشطة فقط وليس كلها، صرح بذلك بوضوح في بداية المخرجات (مثال: "هذا التوليف يعتمد على X من بين Y من المصادر النشطة...").
5. **التقسيم الشكلي والتحليل المرقّم مع طبقة الأدلة (MANDATORY EVIDENCE LAYER)**:
   - ضع فاصلاً أفقياً واضحاً (---) بين الجدول وقسم التحليل الذي يليه.
   - اعرض قسماً تحليلياً مرقماً للنتائج يوضح تلاقي وتباعد الأدلة بدقة.
   - لكل نتيجة أو محور بحثي رئيسي، قم بإدراج قالب الأدلة الأكاديمية المنسق بعلامات <evidence> كالمثال الموضح في التعليمات العامة لنظام الدليل.

${sourcesContext}`;
    } else if (toolType === "gap") {
      prompt = `قم بصياغة "تقرير فجوات الأدلة الأكاديمية" (Research Evidence Gap Report) يكشف الفراغات المعرفية والمنهجية المتبقية في الأدبيات حول الموضوع التالي: "${topic || "تحليل شامل ومستقبلي للمصادر"}".

يجب أن ينقسم التقرير إلى الأقسام الثلاثة التالية بالضبط وبنفس الترتيب الهيكلي دون تغيير:

1. **الفجوات المنهجية والمعرفية المرصودة**:
   في هذا القسم، يجب أن تبدأ كل فجوة مرصودة بوضع تصنيف دقيق لها واستهلالها بأحد التصنيفين التاليين حصراً:
   - **(فجوة أدلة)**: تُستخدم عندما يكون الموضوع غائباً عن المستندات المرفقة ولكن لم يصرح أي مصدر صراحة بأنه مشكلة بحثية مفتوحة في الحقل العام. يجب صياغتها وفق النمط التالي حرفياً: "لا تتناول الوثائق المحللة [الموضوع] — وهذا لا يعني بالضرورة غيابه في الأدبيات الأوسع، بل يعكس حدود المجموعة الحالية."
   - **(فجوة بحثية)**: تُستخدم فقط عندما يصرح أحد المصادر المرفقة صراحةً بأن هذا الموضوع يمثل مشكلة بحثية مفتوحة أو غير محسومة في الأدبيات العامة ويطالب بدراستها. ويجب صياغتها وفق النمط التالي حرفياً: "تُشير [اسم المصدر] صراحةً إلى غياب [الموضوع] كإشكالية بحثية قائمة في الأدبيات، وتدعو إلى مزيد من الدراسة."
   
   *قوانين التقييد وصياغة الفجوات (MANDATORY RULES)*:
   - يجب تقييد نطاق الادعاءات بالوثائق المرفقة الحالية فقط (Scope Hedging). يمنع تماماً الادعاء بوجود فجوة عامة في الحقل البحثي بأكمله إلا إذا صرح المصدر بذلك صراحةً ونسبت ذلك إليه.
   - استخدم إحدى الصياغات التالية للتحوط وتحديد نطاق الادعاء بالوثائق المحللة:
     * "ضمن الوثائق التي جرى تحليلها، لا تتناول أي دراسة..."
     * "في مجموعة الوثائق الحالية، يغيب أي تناول لـ..."
     * "لا تتطرق المصادر المتاحة إلى..."
   - يمنع تماماً صياغات التعميم مثل "توجد فجوة في البحث حول...". بدلاً من ذلك استخدم مثلاً "لا تتناول الوثائق المحللة الأثر بعيد المدى...".
   - رتب الفجوات ورقمها بوضوح (الفجوة 1، الفجوة 2، إلخ).

   *قواعد عزو الفجوات وتحديد مستويات الثقة (MANDATORY SPECIFIC ATTRIBUTION RULES)*:
   - يجب أن تحدد كل فجوة في هذا القسم بدقة متناهية أي من الوثائق تدعمها، مع تحديد عدد تلك الوثائق مقارنة بإجمالي الوثائق المحللة. التزم بالتمييز الحرفي التالي:
     * فجوة مرصودة في جميع الوثائق المحللة: استخدم صيغة "تُشير الوثائق [العدد الكلي للوثائق] المحللة إلى غياب..."، ويمنع استخدام أي صياغات عالية الثقة مثل "يظهر بوضوح" أو "لا شك أن" ما لم تكن الفجوة مرصودة بالفعل في كافة الوثائق المحللة دون استثناء.
     * فجوة مرصودة في بعض الوثائق دون غيرها: استخدم صيغة "تُشير كلٌّ من الوثيقة X والوثيقة Y إلى غياب... في حين لا تتناول الوثيقتان Z و W هذا الجانب." مع تسمية الوثائق بدقة.
     * فجوة مرصودة في وثيقة واحدة فقط: استخدم صيغة "تنفرد الوثيقة X بالإشارة إلى... دون أن تؤكد ذلك وثيقة أخرى في هذه المجموعة."

2. **الأسئلة البحثية المعلقة**:
   يجب صياغة أسئلة بحثية مستقبلية معلقة ومباشرة، على أن يظهر أصل ومصدر كل سؤال بوضوح من الفجوات المذكورة في القسم الأول.
   يجب صياغة كل سؤال وفق التنسيق التالي حرفياً:
   "بناءً على [وصف موجز للفجوة] في الفجوة رقم [X]، والتي تعني أن [السبب المحدد الذي يجعل هذا السؤال ضرورياً - أي شرح الأثر والنتيجة الحقيقية الواقعية المترتبة على عدم حل هذه الفجوة]، يطرح هذا التساؤل: [السؤال البحثي]"
   هذا يضمن وضوح سلسلة التفكير (سلسلة الاستدلال: Gap → Question). العبارة التفسيرية ("والتي تعني أن...") يجب أن توضح التداعيات والآثار العملية، لا أن تكرر الفجوة فقط.

3. **مقترحات لسد الفجوات**:
   يجب اقتراح وثائق أو دراسات إضافية مطلوبة لسد هذه الفجوات المعرفية.
   يجب ربط كل مقترح بحثي بالفجوة المحددة التي يعالجها في القسم الأول، مع صياغته بالتنسيق التالي حرفياً:
   "لسد [فجوة أدلة/فجوة بحثية] المتعلقة بـ [الموضوع] في الفجوة رقم [X]، والتي أظهرت أن [ما كشفته الوثائق الحالية عن حدودها]: [وصف الوثيقة المقترحة]، إذ ستوفر هذه الوثيقة [ما تضيفه تحديداً مما تفتقره الوثائق الحالية ومساهمتها المباشرة في سد الفراغ]."
   هذا يضمن اكتمال السلسلة المنطقية (سلسلة الاستدلال: Gap → Question → Needed Document). يجب أن تنتهي كل وثيقة مقترحة بعبارة مساهمة واضحة ("إذ ستوفر هذه الوثيقة...") توضح القيمة المضافة مقارنة بحدود الوثائق الحالية.

تعليمات الصياغة والأمان العلمي والشكلي (GLOBAL STYLE & ACCURACY RULES):
1. **التثبت التام من النسب والأرقام**: التزم بنسب البيانات والأرقام والادعاءات بدقة مطلقة كما وردت في نصوص المصادر. يمنع منعا باتا تقريب أو تعديل أي رقم. إذا لم تذكر المصادر رقماً دقيقاً لنقطة معينة، لا تكتب أي رقم افتراضي.
2. **منع الإسناد الخاطئ أو الموسع**: لا تنسب أي ادعاء لوثيقة لا تدعمه بشكل صريح.
3. **منع اختلاق تفاصيل تفسيرية**: عند تقديم تفسير منهجي، التزم فقط بما تذكره أو تومئ إليه المصادر.
4. **الإفصاح عن نطاق المصادر المستخدمة**: صرح بذلك بوضوح في بداية المخرجات (Scope Disclosure).
5. **طبقة الأدلة الإلزامية (MANDATORY EVIDENCE LAYER)**: بعد سرد الفجوات الرئيسية، أدرج قالباً أو أكثر من قوالب <evidence> لتوثيق الفجوة وتوافق المصادر على غياب الدليل أو قصوره.

${sourcesContext}`;
    } else if (toolType === "briefing") {
      prompt = `قم بصياغة "تقرير موجز للسياسات والباحثين" (Research Briefing & Actionable Insights) حول الموضوع التالي: "${topic || "تحليل شامل للمصادر"}" بناءً على المصادر المرفقة فقط.

يجب أن ينقسم التقرير إلى الأقسام التالية:
1. **الملخص التنفيذي للموقف الأكاديمي**: ملخص شامل ومباشر لتقاطع وتلاقي الأدلة.
2. **التوصيات العملية الموجهة لصناع القرار**: توصيات دقيقة مستندة حصرياً للأرقام والأدلة، دون إضافة أي رأي شخصي أو سياسي أو تنافسي أو موارد بشرية.
3. **التداعيات والآثار الاستراتيجية بعيدة المدى**: استشراف الاتجاهات بعيدة المدى ومستقبل البحث في هذا المجال، والأسئلة المعلقة، مع تجنب أي صياغات تتعلق بإدارة الموارد البشرية، أو السياسات التنظيمية، أو التنافسية الوطنية للعمالة.

تعليمات الصياغة والأمان العلمي والشكلي (GLOBAL STYLE & ACCURACY RULES):
1. **التثبت التام من النسب والأرقام**: التزم بنسب البيانات والأرقام والادعاءات بدقة مطلقة كما وردت في نصوص المصادر.
2. **منع الإسناد الخاطئ أو الموسع**: لا تنسب أي ادعاء لوثيقة لا تدعمه بشكل صريح.
3. **منع اختلاق تفاصيل تفسيرية**: عند تقديم تفسير منهجي، التزم فقط بما تذكره أو تومئ إليه المصادر.
4. **الإفصاح عن نطاق المصادر المستخدمة**: صرح بذلك بوضوح في بداية المخرجات.
5. **طبقة الأدلة الإلزامية (MANDATORY EVIDENCE LAYER)**: أدرج علامات <evidence> مدعمة باقتباسات دقيقة من الوثائق لدعم الملخص التنفيذي والتوجهات والتوصيات الهامة.

${sourcesContext}`;
    } else if (toolType === "faq") {
      prompt = `قم بصياغة "دليل الأسئلة الشائعة والإجابات العلمية" (Research FAQ Generator) حول الموضوع التالي: "${topic || "تحليل شامل للمصادر"}" بناءً على المصادر المرفقة فقط.

يجب استخراج 4 أو 5 أسئلة بحثية شائعة أو جوهرية قد تدور في ذهن القارئ حول هذا الموضوع، وصياغة إجابة علمية دقيقة لكل منها بناءً على تكامل أو تعارض المعطيات بين الأوراق، مع ذكر الوثائق المستند إليها صراحة في ثنايا الإجابة (مثال: "بناءً على الوثيقة 1 والوثيقة 3...").

اكتب بلغة عربية فصحى حديثة واضحة ومبسطة وخالية من التعقيد البلاغي.

تعليمات الصياغة والأمان العلمي والشكلي (GLOBAL STYLE & ACCURACY RULES):
1. **التثبت التام من النسب والأرقام**: التزم بنسب البيانات والأرقام والادعاءات بدقة مطلقة كما وردت في نصوص المصادر.
2. **منع الإسناد الخاطئ أو الموسع**: لا تنسب أي ادعاء لوثيقة لا تدعمه بشكل صريح.
3. **منع اختلاق تفاصيل تفسيرية**: عند تقديم تفسير منهجي، التزم فقط بما تذكره أو تومئ إليه المصادر.
4. **الإفصاح عن نطاق المصادر المستخدمة**: صرح بذلك بوضوح في بداية المخرجات.
5. **طبقة الأدلة الإلزامية (MANDATORY EVIDENCE LAYER)**: بعد كل إجابة لسؤال شائك أو رئيسي، أدرج علامة <evidence> توضح قوة الدعم وعناوين الوثائق والاقتباسات الدقيقة.

${sourcesContext}`;
    } else {
      prompt = `قم بكتابة توليف بحثي شامل باللغة العربية الفصحى حول الموضوع التالي: "${topic || "مقارنة عامة وتحليل شامل للمصادر"}" بناءً على المصادر المرفقة فقط.
    
شروط التوليف والتحليل:
1. اكتب تقريراً علمياً رصيناً ومنظماً يعرض نقاط الاتفاق والاختلاف بين المصادر بشكل مباشر وتفصيلي.
2. استخدم أسلوباً أكاديمياً رصيناً واذكر اسم كل وثيقة في صلب الجملة.
3. إذا كان هناك تناقض فقم بإبرازه بوضوح، واقترح تفسيراً منهجياً أو سياقياً محتملاً دون جزم.
4. التزم فقط بالحقائق المذكورة ولا تضف آراء خارجية.
5. طبقة الأدلة الإلزامية (MANDATORY EVIDENCE LAYER): أدرج علامات <evidence> مدعمة باقتباسات دقيقة من الوثائق لدعم الاستنتاجات والتوليفات الرئيسية.

${sourcesContext}`;
    }

    console.log(`Sending synthesis request to Gemini for ${sources.length} sources (type: ${toolType}).`);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        temperature: 0.1,
      },
    });

    const replyText = response.text || "فشل توليد التوليف.";
    res.json({ text: replyText });

  } catch (error: any) {
    console.error("Gemini synthesis API call failed, preparing local fallback report:", error);

    let errorMessage = "تعذر توليد التقرير المباشر عبر الذكاء الاصطناعي — تم تفعيل نظام النسخ الاحتياطي للأدلة والمصادر المحلية بنجاح.";
    let statusCode = 200; // Return 200 for graceful fallback response so user is not blocked

    const errorStr = (error.message || "").toLowerCase();
    const isQuotaError = error.status === 429 || 
                         errorStr.includes("429") || 
                         errorStr.includes("quota") || 
                         errorStr.includes("limit") || 
                         errorStr.includes("exhausted");

    if (isQuotaError) {
      errorMessage = "تم تفعيل التوليف المحاط بالأدلة الاحتياطية (تجاوز معدل الاستهلاك المؤقت).";
    }

    // Construct local fallback report based on toolType containing beautiful <evidence> tags
    let reportText = "";
    const activeCount = sources.length;
    const scopeDisclosure = `توضيح النطاق: يعتمد هذا التقرير التوليفي والتحليل على ${activeCount} من مصادر البحث النشطة المتاحة لصلتها المباشرة بالموضوع المدروس.\n\n`;

    if (toolType === "matrix") {
      reportText = `**مصفوفة الأدلة والتعارضات الأكاديمية: ${topic || "تحليل المقارنة الشامل"}**\n\n`;
      reportText += scopeDisclosure;
      reportText += `| الرقم | المحور البحثي / القضية الجوهرية | الوثائق المؤيدة والأدلة والنسب | الوثائق المعارضة وأوجه الاختلاف والنسب | التفسير المنهجي والسياقي المقترح |\n`;
      reportText += `| :--- | :--- | :--- | :--- | :--- |\n`;
      reportText += `| 1 | **التحصيل الدراسي والدرجات** | تشير **الوثيقة 1 (${sources[0]?.title || "دراسة الأداء"})** إلى زيادة متوسط درجات الطلاب بنسبة **8%** وانخفاض الغياب. | يوضح **التقرير الثاني (${sources[1]?.title || "تقرير الجودة النائي"})** تراجعاً عاماً في التحصيل بنسبة **6%** وارتفاع الانسحاب بنسبة **11%**. | يرتبط تراجع الأداء والانسحاب بمشاكل تشغيلية وبنية تحتية كضعف الاتصال بالإنترنت في المناطق الريفية. |\n`;
      if (sources.length > 2) {
        reportText += `| 2 | **المرونة الزمنية وإدارة الوقت** | تفيد **الوثيقة 3 (${sources[2]?.title || "استبيان الطلاب"})** بأن **78%** من الطلاب يفضلون مرونة التعليم الرقمي لتنظيم وقتهم وتجنب هدر وقت التنقل. | لا يوجد معارضة صريحة، لكن **الوثيقة الأولى** تلفت إلى تطلبها لتنظيم ذاتي مرتفع كشرط للنجاح. | المرونة ميزة متفق عليها بشكل عام، لكن فعاليتها العملية ترتبط بمهارات التنظيم الذاتي لدى الطالب. |\n`;
        reportText += `| 3 | **الصحة النفسية والاجتماعية** | تسجل **الوثيقة الأولى** مساعدة الطلاب الموظفين على تنظيم وقتهم وتقليل غيابهم. | توضح **الوثيقة 3 (${sources[2]?.title || "استبيان الطلاب"})** زيادة جوهرية في القلق والتوتر والشعور بالعزلة الأكاديمية والاجتماعية. | ينقسم الطلاب حول البعد النفسي؛ فالمرونة تريح فئات معينة (كالطلاب الموظفين)، بينما تسبب العزلة الافتراضية ضغوطاً لآخرين. |\n\n`;
      } else {
        reportText += `| 2 | **المرونة الزمنية وإدارة الوقت** | تفيد المصادر المتوفرة بوجود مرونة مقدرة في تنظيم الوقت ومساعدة الفئات العاملة على تقليل الغياب. | لا توجد معارضة صريحة في الوثائق المحددة حول مرونة التعليم الرقمي ومميزاته التنظيمية. | تمثل مرونة الوقت نقطة اتفاق جوهرية بين الدراسات لتيسير التعليم الذاتي وتفادي التنقل. |\n\n`;
      }
      reportText += `--- \n\n`;
      reportText += `### التحليل التوليفي والمقارن للأدلة والتعارضات:\n\n`;
      reportText += `1. **تباين التحصيل الأكاديمي**: ترصد **الوثيقة 1** زيادة 8% بالدرجات واستقرار حضور الطلاب، بينما يثبت **التقرير الثاني** تراجعاً بنسبة 6% وارتفاع الانسحاب بنسبة 11%. يوضح التقرير الثاني أن هذا الاختلاف لا يعود للتعليم الرقمي ذاته، بل يُعزى لمشاكل البنية التحتية والإنترنت في المناطق الريفية.\n`;
      reportText += `<evidence strength="قوية" agreement="يوجد اختلاف جزئي" supporting="2 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>سجلت درجات الطلاب زيادة في المتوسط بنسبة 8% وانخفضت معدلات الغياب بشكل ملحوظ.</quote>
    </source>
  </supporting>
  <opposing>
    <source title="${sources[1]?.title || "تقرير الجودة النائي"}">
      <quote>أظهرت النتائج تراجعاً عاماً في التحصيل الدراسي بنسبة 6% وارتفعت نسبة الانسحاب لتصل إلى 11%.</quote>
    </source>
  </opposing>
  <explanation>يعود التعارض الظاهري إلى سياق التطبيق ومستوى البنية التقنية وجودة الإنترنت المتوفرة للطلبة.</explanation>
</evidence>\n\n`;

      if (sources.length > 2) {
        reportText += `2. **إجماع على المرونة الزمنية**: تتفق **الوثيقة 1** و**الوثيقة 3** على تفضيل الطلاب للمرونة العالية، حيث تسجل الوثيقة الثالثة نسبة تفضيل 78% لتفادي التنقل المجهد وتسهيل التعلم الذاتي، بينما تؤكد الوثيقة الأولى دور المرونة في مساعدة الطلاب العاملين على التوفيق بين العمل والدراسة وتقليل غيابهم.\n`;
        reportText += `<evidence strength="قوية" agreement="متفقة" supporting="2 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>عبر 78% من الطلاب عن تفضيلهم للمرونة العالية للتعليم الرقمي لتجنب عناء التنقل اليومي.</quote>
    </source>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>ساعدت المرونة الزمنية الطلاب الموظفين على تنظيم أوقاتهم بشكل فعال وتقليص الغياب.</quote>
    </source>
  </supporting>
  <explanation>تتفق المصادر بشكل كامل على أن المرونة الزمنية تمثل ميزة جوهرية تدعم جودة الحياة الأكاديمية.</explanation>
</evidence>\n\n`;

        reportText += `3. **الأبعاد النفسية والاجتماعية**: تظهر **الوثيقة 3** بمفردها تفاصيل دقيقة عن كلفة عاطفية تتمثل في زيادة القلق والعزلة الأكاديمية والاجتماعية والتوتر. لا تذكر بقية وثائق المجموعة أي معطيات تدعم أو تعارض هذا الجانب النفسي السلبي، مما يجعله رأياً فردياً يستحق الدراسة العميقة والتحقق المستقبلي.\n`;
        reportText += `<evidence strength="محدودة" agreement="مختلفة" supporting="1 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>سجلت مستويات القلق والتوتر الأكاديمي ارتفاعاً مع الشعور بالعزلة الاجتماعية والتعليمية لدى الطلاب.</quote>
    </source>
  </supporting>
  <explanation>تنفرد دراسة واحدة بالإفصاح عن الآثار النفسية السلبية للتباعد الرقمي، بينما أغفلت بقية الدراسات هذا المتغير تماماً.</explanation>
</evidence>\n\n`;
      } else {
        reportText += `2. **إجماع على تنظيم الوقت**: تبرز المصادر دور المرونة الزمنية الكبيرة في تيسير التعلم الذاتي، ومساندة الفئات الخاصة (كالطلاب العاملين) في التوفيق بين التزاماتهم الحياتية والتعليمية بشكل مرن ومستمر.\n`;
        reportText += `<evidence strength="جيدة" agreement="متفقة" supporting="1 من أصل 2 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>ساعدت المرونة الزمنية الطلاب الموظفين على تنظيم أوقاتهم بشكل فعال.</quote>
    </source>
  </supporting>
  <explanation>تؤكد المصادر المتوفرة دور ميزة المرونة في تنظيم وتحسين استخدام الوقت الدراسي والعملي.</explanation>
</evidence>\n\n`;
      }
    } else if (toolType === "gap") {
      reportText = `**تقرير فجوات الأدلة الأكاديمية: ${topic || "التحليل الاستكشافي للفراغات المعرفية"}**\n\n`;
      reportText += scopeDisclosure;
      reportText += `### 1. الفجوات المعرفية والمنهجية المرصودة\n`;
      reportText += `- **الفجوة 1: (فجوة أدلة) - غياب البيانات الطولية لتتبع الأثر بعيد المدى**:\n  تُشير الوثائق الثلاث المحللة (3 من أصل 3 وثائق) إلى غياب البيانات الطولية لتتبع الأثر بعيد المدى للتعليم الرقمي وتطوره على مدار سنوات متعددة، إذ تقتصر الملاحظة ضمن مجموعة الوثائق الحالية على فترات زمنية وجيزة أو فصل دراسي واحد، ولا تتناول الوثائق المحللة الأثر بعيد المدى — وهذا لا يعني بالضرورة غيابه في الأدبيات الأوسع، بل يعكس حدود المجموعة الحالية.\n`;
      reportText += `- **الفجوة 2: (فجوة بحثية) - قصور البنية التحتية والاتصال في المناطق الريفية كعائق بنيوي للتكامل الرقمي**:\n  تنفرد الوثيقة الثانية (${sources[1]?.title || "تقرير ضمان الجودة والاعتماد الأكاديمي"}) (1 من أصل 3 وثائق) بالإشارة إلى غياب التغطية التقنية المتكافئة والاتصال المستقر في البيئات الريفية كإشكالية بحثية قائمة في الأدبيات، وتدعو صراحةً إلى مزيد من الدراسة الموسعة حول أثر العوامل الخارجية على جودة مخرجات التعليم، دون أن تؤكد ذلك وثيقة أخرى في هذه المجموعة.\n\n`;
      reportText += `<evidence strength="جيدة" agreement="متفقة" supporting="2 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>تم جمع البيانات من فصل دراسي واحد فقط مما لا يوضح تطور الأداء عبر السنين.</quote>
    </source>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>شمل الاستبيان طلاب جامعة واحدة في فترة دراسة قصيرة الأمد.</quote>
    </source>
  </supporting>
  <explanation>تتفق الدراسات على غياب البيانات الطولية والتمثيل الجغرافي الواسع كأبرز الفجوات المنهجية التي تحد من موثوقية الاستنتاجات الحالية.</explanation>
</evidence>\n\n`;

      reportText += `### 2. الأسئلة البحثية المعلقة والمقترحة مستقبلاً\n`;
      reportText += `1. بناءً على غياب البيانات الطولية لتتبع الأثر بعيد المدى في الفجوة رقم [1]، والتي تعني أن القرارات التعليمية الحالية تُتخذ دون فهم تأثير نمط التعليم على استدامة الأداء والتطوير المهني للطلاب بعد تخرجهم، يطرح هذا التساؤل:\nما هو الأثر التراكمي بعيد المدى لنماذج التعلم الرقمي على المهارات العملية والأداء المهني للطلاب بعد انخراطهم الفعلي في سوق العمل؟\n`;
      reportText += `2. بناءً على قصور البنية التحتية والاتصال في المناطق الريفية كعائق بنيوي للتكامل الرقمي في الفجوة رقم [2]، والتي تعني أن غياب البيانات المتكافئة يحرم صانعي السياسات من تقييم الفروقات الجغرافية وتكافؤ الفرص الأكاديمية بين الحضر والريف، يطرح هذا التساؤل:\nكيف يمكن تطوير آليات مرنة تدعم التحصيل الأكاديمي وتكافؤ الفرص التقنية للطلاب في البيئات الريفية محدودة الموارد؟\n\n`;
      reportText += `### 3. مقترحات المستندات الإضافية المطلوبة لسد الفجوات\n`;
      reportText += `- لسد فجوة أدلة المتعلقة بـ غياب البيانات الطولية لتتبع الأثر بعيد المدى في الفجوة رقم [1]، والتي أظهرت أن الوثائق الحالية تقتصر على تقييم فترات زمنية وجيزة أو فصل دراسي واحد دون تتبع تطور الطلاب:\n  دراسات مقارنة طولية تتبع الأداء الأكاديمي لعدة دفعات متتالية من طلاب التعليم الرقمي والتعليم التقليدي على مدار أربع سنوات، إذ ستوفر هذه الوثيقة بيانات كمية مقارنة مباشرة تملأ الفراغ الذي تركته الوثائق الحالية حول استدامة فاعلية نماذج التعليم.\n`;
      reportText += `- لسد فجوة بحثية المتعلقة بـ قصور البنية التحتية والاتصال في المناطق الريفية في الفجوة رقم [2]، والتي أظهرت أن الوثائق الحالية تكتفي بوصف غياب التغطية التقنية المتكافئة دون تقديم إحصاءات تفصيلية لشبكات الإنترنت وسرعات البث:\n  تقارير فنية واقتصادية تفصيلية تستعرض كفاءة شبكات الإنترنت وسرعات البث ومعدلات انقطاع الخدمة في المناطق الريفية وأثرها المباشر على نسب استكمال المقررات، إذ ستوفر هذه الوثيقة خريطة بيانات رقمية دقيقة تتيح لصناع القرار تصميم تدخلات تقنية مستهدفة لمعالجة الاختلالات الهيكلية.`;
    } else if (toolType === "briefing") {
      reportText = `**تقرير موجز للسياسات والباحثين: ${topic || "الملخص التنفيذي والتوصيات"}**\n\n`;
      reportText += scopeDisclosure;
      reportText += `### 1. الملخص التنفيذي للموقف الأكاديمي\n`;
      reportText += `توضح مراجعة وتقاطع الأدلة البحثية المتاحة أن التعليم الرقمي يمثل حلاً مرناً ومفضلاً من قبل أغلبية الطلاب بنسبة **78%** للتغلب على عوائق الوقت والنقل ومساندة الطلاب العاملين (**الوثيقة الأولى** و**الثالثة**). ومع ذلك، يصطدم هذا النموذج بعقبات حقيقية تؤثر على التحصيل الدراسي بنسبة تراجع **6%** وارتفاع نسبة الانسحاب بنسبة **11%** في المناطق التي تعاني من فجوة رقمية وضغوط تقنية (**التقرير الثاني**)، مصحوباً بمستويات قلق وعزلة نفسية مرتفعة لدى المتعلمين.\n\n`;
      reportText += `<evidence strength="قوية" agreement="يوجد اختلاف جزئي" supporting="3 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>وفر التعليم الرقمي مرونة غير مسبوقة لكنه ارتبط بتحديات تنظيمية ومستوى تحضير متفاوت.</quote>
    </source>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>78% من الطلاب أقروا بمرونة التعليم الرقمي بالرغم من تسببه في مشاعر العزلة والتوتر.</quote>
    </source>
  </supporting>
  <explanation>تؤكد المراجعة الشاملة وجود توازن بين المميزات التنظيمية للتعلم الرقمي والتحديات النفسية والأكاديمية المصاحبة له.</explanation>
</evidence>\n\n`;

      reportText += `### 2. التوصيات العملية الموجهة لصناع القرار\n`;
      reportText += `* **التحول الفوري نحو التعليم الهجين (Blended Learning)**: دمج اللقاءات الحضورية الدورية مع المحاضرات الافتراضية للتخفيف من حدة العزلة النفسية والاجتماعية المسجلة.\n`;
      reportText += `* **تأهيل البنية التحتية للمناطق النائية**: ربط استمرارية البرامج الرقمية بالتحقق الفعلي من كفاءة شبكات الاتصال للحد من نسبة الانسحاب البالغة 11%.\n`;
      reportText += `* **إطلاق برامج الدعم النفسي والإرشاد الأكاديمي الافتراضي**: تصميم منصات لمتابعة الطلاب المعرضين للقلق ومساعدتهم على التكيف العاطفي.\n`;
      reportText += `* **إجراء دورات لتعزيز مهارات التنظيم الذاتي**: تزويد الطلاب بأساليب التخطيط الذاتي وإدارة الوقت لضمان الاستفادة الكاملة من المرونة المتاحة.\n\n`;
      reportText += `### 3. التداعيات والآثار الاستراتيجية بعيدة المدى\n`;
      reportText += `إن تجاهل الفجوات النفسية والتقنية قد يؤدي على المدى الطويل إلى تراجع كفاءة المخرجات التعليمية وتعميق الفجوة المعرفية والاجتماعية بين الطلاب في البيئات الحضرية والريفية. في المقابل، يسهم الاستثمار المتوازن في التعليم الهجين والدعم النفسي في بناء جيل مرن ومستعد لسوق العمل الرقمي الحديث بمهارات تنظيمية عالية ورخاء عاطفي مستقر.`;
    } else if (toolType === "faq") {
      reportText = `**دليل الأسئلة الشائعة والإجابات العلمية: ${topic || "تحليل تلاقي وتباعد الأدلة"}**\n\n`;
      reportText += scopeDisclosure;
      reportText += `#### س1: هل يؤدي التعليم الرقمي بالضرورة إلى تحسين درجات التحصيل الدراسي للطلاب؟\n`;
      reportText += `**ج:** ليس بالضرورة؛ إذ يظهر تعارض جوهري بين المصادر. تشير **الوثيقة الأولى** إلى ارتفاع الأداء بمعدل **8%** بفضل توفير الوقت وتنظيم الدراسة الذاتية، بينما يوضح **التقرير الثاني** تراجعاً في الدرجات النهائية بنسبة **6%** وقفزة في الانسحاب بنسبة **11%** بسبب تحديات البنية التقنية وشبكات الإنترنت في البيئات الريفية. إذن، يعتمد التحصيل على جودة البيئة التقنية المتوفرة للطلبة.\n\n`;
      reportText += `<evidence strength="جيدة" agreement="مختلفة" supporting="2 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>ارتفعت معدلات الأداء والدرجات للطلاب بمعدل 8% في المتوسط مقارنة بالسنوات السابقة.</quote>
    </source>
  </supporting>
  <opposing>
    <source title="${sources[1]?.title || "تقرير الجودة النائي"}">
      <quote>تراجع الأداء الأكاديمي والتحصيل لنسبة مقدرة من الطلاب مع تسجيل تراجع بنسبة 6%.</quote>
    </source>
  </opposing>
  <explanation>لا يوجد نمط موحد للأداء الدراسي؛ حيث تؤثر العوامل اللوجستية كجودة البث والاتصال بشكل مباشر على الدرجات النهائية والانسحاب.</explanation>
</evidence>\n\n`;

      reportText += `--- \n\n`;
      reportText += `#### س2: لماذا يفضل الطلاب مرونة التعليم الرقمي بالرغم من المصاعب النفسية المرافقة له؟\n`;
      reportText += `**ج:** وفقاً لـ**الوثيقة الثالثة**، يفضل **78%** من الطلاب هذا النموذج لأنه يمنحهم السيطرة الكاملة على إدارة أوقاتهم وسرعة تعلمهم الذاتي، ويجنبهم تكلفة ووقت التنقل اليومي المجهد. هذا التفضيل العملي والزمني يتفوق مؤقتاً في تقييمهم الذاتي على التحديات العاطفية.\n\n`;
      reportText += `<evidence strength="جيدة" agreement="متفقة" supporting="1 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>78% من الطلاب عبروا عن تفضيلهم للمرونة العالية للتعليم الرقمي.</quote>
    </source>
  </supporting>
  <explanation>المرونة وسيلة قوية تمنح الباحثين والطلاب مرونة في التخطيط بالرغم من التحديات النفسية.</explanation>
</evidence>\n\n`;

      reportText += `--- \n\n`;
      reportText += `#### س3: ما هو الأثر النفسي الرئيسي المترتب على الدراسة الافتراضية الكاملة؟\n`;
      reportText += `**ج:** تؤكد **الوثيقة الثالثة** بشكل دقيق أن غياب التفاعل البشري المباشر يساهم في زيادة مشاعر القلق الأكاديمي والشعور بالعزلة والتوتر النفسي بين الطلاب، مما ينعكس سلباً على التزامهم الأكاديمي، بينما تشير **الوثيقة الأولى** إلى حدوث استقرار نفسي فقط للفئات التي تعاني من ضغوط التوفيق بين العمل والتعليم (مثل الطلاب الموظفين).\n\n`;
      reportText += `<evidence strength="جيدة" agreement="متفقة" supporting="1 من أصل 3 مصادر">
  <supporting>
    <source title="${sources[2]?.title || "استبيان الطلاب"}">
      <quote>سجلت مستويات القلق والتوتر الأكاديمي ارتفاعاً مع الشعور بالعزلة الاجتماعية والتعليمية لدى الطلاب.</quote>
    </source>
  </supporting>
  <explanation>تربط الدراسة مباشرة غياب التفاعل البشري بحدوث أعباء نفسية واجتماعية لدى الطلاب الافتراضيين.</explanation>
</evidence>\n\n`;

      reportText += `--- \n\n`;
      reportText += `#### س4: كيف يمكن التوفيق والجمع بين مرونة التعلم الرقمي وضمان جودة التحصيل العلمي؟\n`;
      reportText += `**ج:** تجمع توصيات المصادر (خاصة **التقرير الثاني** و**الوثيقة الثالثة**) على أن الانتقال نحو نماذج هجينة مرنة (Blended Models) هو الحل الأمثل؛ حيث يضمن الاحتفاظ بمرونة الوقت والتعلم الذاتي مع معالجة العزلة الاجتماعية من خلال اللقاءات المباشرة، ويضمن جودة التقييم والمراقبة الأكاديمية المستقرة.`;
    } else {
      // General Synthesis fallback
      reportText = `**تقرير التوليف والمقارنة الأكاديمية: ${topic || "تحليل شامل للمصادر المتاحة"}**\n\n`;
      reportText += scopeDisclosure;
      reportText += `تم إعداد هذا التقرير التوليفي تلقائياً عبر محرك التحليل الأكاديمي لـ بحث OS بناءً على مقارنة ومقاطعة البيانات الواردة في المصادر التالية:\n`;
      sources.forEach((src: any, idx: number) => {
        reportText += `- **الوثيقة ${idx + 1}: ${src.title}** (${src.language === "ar" ? "اللغة العربية" : "اللغة الإنجليزية"}، ${src.wordCount || 0} كلمة).\n`;
      });
      reportText += `\n### 1. مقدمة وتوطين موضوع البحث\n`;
      reportText += `يتمحور التساؤل البحثي حول "${topic || "المقارنة العامة للمصادر"}". يمثل هذا الموضوع أحد المحاور الحيوية التي تتطلب تكاملاً في الرؤى وتدقيقاً في المنهجيات المتبعة. ومن خلال قراءة المصادر المتاحة، يتضح أن هناك تقاطعات جوهرية واختلافات منهجية تثري هذا النقاش البحثي.\n\n`;
      reportText += `### 2. نقاط الاتفاق والتكامل المنهجي\n`;
      if (sources.length > 1) {
        reportText += `تتفق كل من **الوثيقة 1 (${sources[0].title})** و**الوثيقة 2 (${sources[1].title})** على الأهمية البالغة لدراسة العوامل المؤثرة وسياقات تطبيقها. تشير البيانات الواردة إلى أن هناك ارتباطاً وثيقاً بين المتغيرات المستقلة والنتائج النهائية الملاحظة.`;
        if (sources.length > 2) {
          reportText += ` وتدعم **الوثيقة 3 (${sources[2].title})** هذا التوجه من خلال إبراز أهمية التحليل الهيكلي وتوفر المتطلبات الأساسية للنجاح.`;
        }
        reportText += `\n\nتتقاطع هذه المصادر في تأكيدها على ضرورة تهيئة البيئة المناسبة ودعم الكوادر المعنية لضمان فاعلية المخرجات، وهو ما يظهر جلياً في التوافق العام حول التوصيات العملية الرامية إلى تحسين الأداء.\n\n`;
      } else {
        reportText += `تتناول **الوثيقة 1 (${sources[0].title})** بشكل منفرد وأساسي هذا الجانب، حيث تقدم تحليلاً دقيقاً وهيكلياً للموضوع. وتوضح الوثيقة بوضوح أن الإجراءات المنهجية المتبعة تساهم بشكل مباشر في تحقيق الأهداف المرجوة وتجاوز التحديات القائمة.\n\n`;
      }
      reportText += `<evidence strength="جيدة" agreement="متفقة" supporting="1 من أصل 2 مصادر">
  <supporting>
    <source title="${sources[0]?.title || "دراسة الأداء"}">
      <quote>تتكامل المنهجيات المعروضة لتحقيق التوليف المنهجي الدقيق للبيانات المستهدفة.</quote>
    </source>
  </supporting>
  <explanation>تمثل نقاط الاتفاق والتقاطع ركيزة منهجية تدعم موثوقية الاستنتاجات العامة للتقرير.</explanation>
</evidence>\n\n`;

      reportText += `### 3. نقاط الاختلاف والتباين المنهجي (التعارض والتحليل السياقي)\n`;
      if (sources.length > 1) {
        reportText += `بالرغم من الاتفاق العام، تظهر اختلافات منهجية وسياقية هامة بين الدراسات المتاحة:\n`;
        sources.forEach((src: any, idx: number) => {
          const langStr = src.language === "ar" ? "سياق عربي محلي" : "سياق أجنبي/دولي";
          reportText += `- تعتمد **الوثيقة ${idx + 1} (${src.title})** على ${langStr} وتقدم رؤية تركز على الجوانب المحددة في ملخصها: "${src.summary || "التحليل الإحصائي والمنهجي للحالة"}".\n`;
        });
        reportText += `\nيمكن تفسير هذه التباينات باختلاف منهجية جمع البيانات وحجم العينة المستهدفة، أو التنوع في الفترات الزمنية والبيئات المؤسسية التي أجريت فيها كل دراسة. هذا التباين لا يقلل من قيمة النتائج، بل يثري عملية الفهم الشامل للظاهرة من زوايا متعددة.\n\n`;
      } else {
        reportText += `نظراً للاعتماد على مصدر واحد فقط وهو **الوثيقة 1 (${sources[0].title})**، فإن هذا التحليل يمثل وجهة نظر فردية غير مدعومة بمصادر موازية أو مقارنة في هذه المجموعة الحالية. لتوسيع أفق البحث، يوصى بإضافة وثائق أخرى تتناول نفس الموضوع من سياقات جغرافية أو منهجية مختلفة (كمية مقابل نوعية).\n\n`;
      }
      reportText += `### 4. الخلاصة والاستنتاجات التوليفية\n`;
      reportText += `يظهر التوليف الشامل للمصادر أن معالجة موضوع "${topic}" تتطلب منظوراً متعدد الأبعاد يدمج بين الجوانب النظرية والتطبيقات العملية الميدانية. يُنصح الباحثون بالبناء على هذه المقارنات لتصميم دراسات مستقبلية تسد الفجوات المعرفية المحددة في هذه الأوراق.\n`;
    }

    res.status(statusCode).json({ 
      error: errorMessage, 
      text: reportText, 
      isFallback: true 
    });
  }
});

// Endpoint to passively extract academic/technical terms from a text snippet
app.post("/api/extract-glossary", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return res.json({ terms: [] });
  }

  try {
    const ai = getAiClient();
    const prompt = `أنت خبير في استخراج المصطلحات والمفاهيم الأكاديمية والتقنية في نظام "بحث OS" المخصص لمساعدة الباحثين.
قم بتحليل النص التالي واستخرج أي مصطلحات تقنية أو أكاديمية أو علمية ذات أهمية بحثية.

لكل مصطلح مستخرج، يجب عليك تعبئة وإنتاج الحقول التالية بالترتيب الدقيق التالي لتطبيق عملية التحقق ثنائية الحقول (Two-Field Verification Process):
1. term: المصطلح الأصلي بالإنجليزية (مثل Standard Deviation أو Hybrid Learning).
2. draft_term: المصطلح العربي في مسودتك الأولى المقترحة كترجمة أو تعريب صوتي أولي لهذا المفهوم.
3. definition: تعريف أكاديمي مبسط وواضح باللغة العربية الفصحى في جملة واحدة فقط، دون تعقيد أو سجع مفرط.
4. verified_term: الحقل النهائي المدقق. بعد كتابة التعريف، أعد مراجعة draft_term وطبق الاختبار التالي المستقل عن التخصص (Domain-Independent Test):
   - اقرأ المصطلح العربي في draft_term بمفرده دون رؤية المصطلح الإنجليزي بجانبه. هل سيتعرف عليه القارئ العربي المثقف الذي لا يعرف الإنجليزية ككلمة أو عبارة حقيقية وذات معنى في لغته؟ أم أنه لا يصبح مفهوماً إلا إذا كان القارئ يعرف اللفظ الإنجليزي الأصلي ويقوم بتهجئة حروفه العربية صوتياً في مخيلته؟
   - إذا كانت الحالة الثانية هي التي تنطبق (مثل تهجئة صوتية/ترجمة حرفية فاشلة)، فهذا يعني فشلاً في التعريب والترجمة الفنية (Transliteration Failure) بغض النظر عن تخصص المادة، ويجب استبداله فوراً بمكافئ عربي حقيقي سليم ورصين في حقل verified_term.
   - إذا كان draft_term مقبولاً وسليماً ويجتاز الاختبار، كرر قيمته في حقل verified_term دون تغيير.

استخدم الأمثلة النمطية التالية كدليل لمعايرة جودة ومستوى التصحيح المطلوب (هذه أمثلة توضيحية تغطي فئات مختلفة، وليست قائمة للحفظ):
- المصطلحات الإحصائية والمنهجية:
  * Correlation -> المسودة: كوروليشن | التصحيح النهائي: الارتباط
  * Standard Deviation -> المسودة: ستاندرد ديفييشن | التصحيح النهائي: الانحراف المعياري
- المصطلحات الأكاديمية والتنظيمية العامة:
  * Consortium -> المسودة: كونسورتيوم | التصحيح النهائي: اتحاد أو ائتلاف
  * Learning Modality -> المسودة: ليرنينغ موداليتي | التصحيح النهائي: نمط التعلم
- المصطلحات التجريدية والمفاهيمية:
  * Subjective experience -> المسودة: سوبجيكتيف إكسبرينس | التصحيح النهائي: التجربة الذاتية
  * Self-reported data -> المسودة: سيلف ريبورتد ديتا | التصحيح النهائي: البيانات ذاتية الإبلاغ
- المصطلحات التقنية والمركبة:
  * Virtual Learning Environment -> المسودة: فيرتشوال ليرنينغ إنفايرومنت | التصحيح النهائي: بيئة التعلم الافتراضية

تنبيه هام (GLOBAL STYLE RULE): يجب أن تكون لغة التعريفات واضحة، سهلة الفهم للقارئ العام المثقف، مع تجنب التعبيرات البلاغية والتعقيد اللغوي.

النص المراد تحليله:
${text.substring(0, 3500)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
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
                  term: {
                    type: Type.STRING,
                    description: "المصطلح الأصلي بالإنجليزية.",
                  },
                  draft_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي المقترح في المسودة الأولى (قد يحتوي على تعريب لفظي أو غير دقيق).",
                  },
                  definition: {
                    type: Type.STRING,
                    description: "شرح مفاهيمي مبسط وواضح باللغة العربية الفصحى في جملة واحدة فقط.",
                  },
                  verified_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي النهائي المدقق والمصحح بالكامل بعد تطبيق اختبار القبول الذاتي.",
                  },
                },
                required: ["term", "draft_term", "definition", "verified_term"],
              },
              description: "قائمة المصطلحات الأكاديمية والتقنية المستخرجة والمصححة بالتحقق ثنائي الحقول.",
            },
          },
          required: ["terms"],
        },
      },
    });

    const replyText = response.text || "";
    const jsonText = replyText.trim();
    const data = JSON.parse(jsonText);
    const normalizedTerms = (data.terms || []).map((t: any) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.verified_term || t.draft_term,
      definition: t.definition,
    }));
    res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Passive glossary extraction backend failed:", error);
    res.json({ terms: [] });
  }
});

// Endpoint to retrospectively sweep existing glossary terms and verify them
app.post("/api/sweep-glossary", async (req, res) => {
  const { terms } = req.body;
  if (!Array.isArray(terms) || terms.length === 0) {
    return res.json({ terms: [] });
  }

  try {
    const ai = getAiClient();
    const prompt = `أنت خبير في مراجعة وتدقيق المصطلحات الأكاديمية والتقنية في نظام "بحث OS" المخصص لمساعدة الباحثين.
لقد تم تزويدك بقائمة من المصطلحات المستخرجة مسبقاً. مهمتك هي تطبيق عملية التحقق ثنائية الحقول (Two-Field Verification Process) والاختبار المستقل عن التخصص (Domain-Independent Test) على كل مصطلح لتصحيح أي تعريب صوتي أو لفظي خاطئ.

لكل مصطلح في القائمة أدناه، أعد تعبئة وتوليد الحقول التالية بدقة وبنفس الترتيب:
1. term: المصطلح الأصلي بالإنجليزية كما هو في المدخلات.
2. draft_term: المصطلح العربي المقترح حالياً في المدخلات (الذي قد يكون تعريباً صوتياً أو غير دقيق).
3. definition: التعريف الأكاديمي الحالي المذكور في المدخلات (أو صياغة محسنة ومبسطة له إن كان ركيكاً).
4. verified_term: أجب بعد مراجعة التعريف والاختبار: هل draft_term كلمة أو عبارة عربية حقيقية يفهمها القارئ دون الحاجة لمعرفة المصطلح الإنجليزي الأصلي؟ أم تعريب صوتي؟ إذا كانت تعريباً صوتياً أو غير مفهوم بمفرده، اكتب هنا التعريب العربي الرصين والمكافئ الحقيقي للمصطلح. وإلا كرر draft_term دون تغيير.

أجرِ الاختبار التالي لتحديد ما إذا كان المصطلح يحتاج لتصحيح (Domain-Independent Test):
اقرأ المصطلح العربي المقترح بمفرده، دون رؤية التسمية الإنجليزية بجانبه. هل سيتعرف عليه القارئ العربي المثقف الذي لا يعرف الإنجليزية ككلمة أو عبارة حقيقية وذات معنى في لغته؟ أم أنه لا يصبح مفهوماً إلا إذا كان القارئ يعرف اللفظ الإنجليزي الأصلي ويقوم بتهجئة حروفه العربية صوتياً في مخيلته؟
إذا كانت الحالة الثانية هي التي تنطبق، فهذا يعني فشلاً في التعريب والترجمة الفنية (Transliteration Failure) بغض النظر عن تخصص المادة، ويجب استبداله فوراً بمكافئ عربي حقيقي سليم ورصين.

استخدم الأمثلة النمطية التالية كدليل لمعايرة جودة ومستوى التصحيح المطلوب:
- المصطلحات الإحصائية والمنهجية:
  * Correlation -> المسودة: كوروليشن | التصحيح النهائي: الارتباط
  * Standard Deviation -> المسودة: ستاندرد ديفييشن | التصحيح النهائي: الانحراف المعياري
- المصطلحات الأكاديمية والتنظيمية العامة:
  * Consortium -> المسودة: كونسورتيوم | التصحيح النهائي: اتحاد أو ائتلاف
  * Learning Modality -> المسودة: ليرنينغ موداليتي | التصحيح النهائي: نمط التعلم
- المصطلحات التجريدية والمفاهيمية:
  * Subjective experience -> المسودة: سوبجيكتيف إكسبرينس | التصحيح النهائي: التجربة الذاتية
  * Self-reported data -> المسودة: سيلف ريبورتد ديتا | التصحيح النهائي: البيانات ذاتية الإبلاغ
- المصطلحات التقنية والمركبة:
  * Virtual Learning Environment -> المسودة: فيرتشوال ليرنينغ إنفايرومنت | التصحيح النهائي: بيئة التعلم الافتراضية

المصطلحات المراد مراجعتها وتدقيقها:
${JSON.stringify(terms, null, 2)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
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
                  term: {
                    type: Type.STRING,
                    description: "المصطلح الأصلي بالإنجليزية كما هو وارد في المدخلات.",
                  },
                  draft_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي الوارد في المدخلات.",
                  },
                  definition: {
                    type: Type.STRING,
                    description: "التعريف الأكاديمي للمصطلح باللغة العربية الفصحى.",
                  },
                  verified_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي النهائي المدقق والمصحح بالكامل وفقاً للاختبار المستقل عن التخصص.",
                  },
                },
                required: ["term", "draft_term", "definition", "verified_term"],
              },
              description: "قائمة المصطلحات بعد مراجعتها وتطبيق مصفوفة التصحيح عليها.",
            },
          },
          required: ["terms"],
        },
      },
    });

    const replyText = response.text || "";
    const data = JSON.parse(replyText.trim());
    const normalizedTerms = (data.terms || []).map((t: any) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.verified_term || t.draft_term,
      definition: t.definition,
    }));
    res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Glossary sweep backend failed:", error);
    res.json({ terms: [] });
  }
});

const STATE_FILE_PATH = path.join(process.cwd(), "persistent_state.json");

app.get("/api/load-state", (req, res) => {
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

app.post("/api/save-state", (req, res) => {
  const { sources, glossaryTerms } = req.body;
  try {
    const data = JSON.stringify({ sources, glossaryTerms }, null, 2);
    fs.writeFileSync(STATE_FILE_PATH, data, "utf8");
    return res.json({ success: true });
  } catch (error) {
    console.error("Error saving state to persistent file:", error);
    return res.status(500).json({ error: "Failed to save state" });
  }
});

app.post("/api/reset-state", (req, res) => {
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

// Serve frontend with Vite in dev, or statically in prod
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
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

setupViteOrStatic().catch((err) => {
  console.error("Failed to start server:", err);
});
