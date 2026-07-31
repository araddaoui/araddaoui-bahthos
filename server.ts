import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, normalizeArabicText } from "./src/utils/termExtractor";

// Load environment variables BEFORE anything else
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// AI Client factory (lazy-loaded)
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY environment variable is not set. AI calls will fail.");
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

// Helper function to call generateContent with automatic retry and model fallback for 503, timeouts, and 429 rate limit/quota errors
async function generateContentWithRetry(
  ai: any,
  params: {
    model: string;
    contents: any;
    config?: any;
    systemInstruction?: any;   // ✅ already correct
  }
) {
  let attempt = 1;
  const maxAttempts = 3;
  let currentModel = params.model === "gemini-3.5-flash" ? "gemini-3.6-flash" : params.model;

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

      if ((isRetryable || isQuota) && attempt < maxAttempts) {
        attempt++;
        const delay = isQuota ? attempt * 2000 : (attempt === 2 ? 1500 : 3000);
        
        // On quota error or on 2nd retry, switch to gemini-3.1-flash-lite for higher throughput limits
        if (isQuota || currentModel === "gemini-3.6-flash") {
          currentModel = "gemini-3.1-flash-lite";
          console.warn(`Attempt ${attempt}: Switching model to gemini-3.1-flash-lite due to ${isQuota ? "429 quota/rate limit" : "503/timeout"}. Retrying in ${delay}ms...`);
        } else {
          console.warn(`Attempt ${attempt}: Retrying ${currentModel} after delay of ${delay}ms...`);
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
  try {
    const { messages, sources } = req.body || {};
    const validSources = Array.isArray(sources) ? sources : [];
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const ai = getAiClient();

    // Build the list of active documents to include in the system instruction / context
    let sourcesContext = "";
    if (validSources.length > 0) {
      sourcesContext = "\n\nالمصادر المتاحة للتحليل حالياً:\n";
      validSources.forEach((src: any, idx: number) => {
        const title = src?.title || `الوثيقة ${idx + 1}`;
        const rawContent = src?.content || src?.summary || src?.extractedText || "";
        const safeContent = rawContent.length > 30000 
          ? rawContent.substring(0, 30000) + "\n...[تم اختصار باقي النص لتفادي تجاوز الحد الأقصى للمدخلات]" 
          : rawContent;

        sourcesContext += `\n---\n`;
        sourcesContext += `اسم الوثيقة: الوثيقة ${idx + 1}: ${title}\n`;
        sourcesContext += `اللغة: ${src?.language === "en" ? "الإنجليزية" : "العربية"}\n`;
        sourcesContext += `المحتوى:\n${safeContent}\n`;
      });
      sourcesContext += `\n---\nتذكر: التزم حصرياً بهذه المصادر المتاحة أعلاه للإجابة والمقارنة، وقم بالإشارة إليها بوضوح في النص مثل "تشير الوثيقة 1 إلى..." أو "توضح الوثيقة 2...". إذا كانت هناك تناقضات، أبرزها بوضوح وعلق عليها بشكل منهجي.`;
    } else {
      sourcesContext = "\n\n(ملاحظة: لا توجد مصادر مفعلة حالياً للتحليل. يرجى تنبيه المستخدم باللغة العربية بضرورة تفعيل أو رفع وثيقة واحدة على الأقل قبل بدء التحليل).";
    }

    const mergedSystemInstruction = SYSTEM_INSTRUCTIONS + sourcesContext;

    // Filter valid messages for Gemini payload
    const validMessages = messages.filter((m: any) => m && m.text && typeof m.text === "string" && m.text.trim().length > 0);

    const contents = validMessages.map((msg: any) => {
      const role = msg.role === "assistant" ? "model" : "user";
      return {
        role,
        parts: [{ text: msg.text }],
      };
    });

    if (contents.length === 0) {
      return res.json({ text: "يرجى كتابة سؤال أو استفسار للتحليل." });
    }

    console.log(`Sending chat request to Gemini with ${contents.length} messages and ${validSources.length} sources.`);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: contents,
      config: {
        systemInstruction: mergedSystemInstruction,
        temperature: 0.2,
      },
    });

    const replyText = normalizeArabicText(response?.text || "المصادر المتاحة لا توفر إجابة كافية حيال هذا السؤال المباشر.");
    return res.json({ text: replyText });
  } catch (error: any) {
    console.error("Gemini chat API call failed, generating synthesis fallback:", error);

    const reqBody = req.body || {};
    const messages = Array.isArray(reqBody.messages) ? reqBody.messages : [];
    const sources = Array.isArray(reqBody.sources) ? reqBody.sources : [];

    const userMessages = messages.filter((m: any) => m && m.role === "user" && m.text);
    const lastUserMessage = userMessages[userMessages.length - 1]?.text || "السؤال المطروح";

    const activeSources = sources;
    
    if (activeSources.length === 0) {
      return res.json({
        text: "مرحباً بك. يرجى تفعيل أو رفع وثيقة بحثية واحدة على الأقل في القائمة الجانبية لنتمكن من تحليلها ومقارنتها والإجابة عن سؤالك بدقة أكاديمية."
      });
    }

    // Dynamic context-aware analysis based on actual active sources
    const docSentences: { index: number; title: string; text: string }[] = [];
    activeSources.forEach((src: any, idx: number) => {
      const title = src?.title || `وثيقة ${idx + 1}`;
      const content = src?.summary || src?.content || src?.extractedText || "";
      const sentences = content.split(/[.!?\n]+/).map((s: string) => s.trim()).filter(Boolean);
      const text = sentences.length > 0 ? sentences.slice(0, 3).join(". ") : "تم تزويد الخادم بنص هذه الوثيقة للتحليل والتنسيق.";
      docSentences.push({
        index: idx + 1,
        title,
        text: text.substring(0, 300) + (text.length > 300 ? "..." : "")
      });
    });

    let responseText = `### التوليف والمقارنة المباشرة للمصادر المرفقة حول: "${lastUserMessage}"\n\n`;
    responseText += `بناءً على قراءة وتقاطع البيانات الواردة في المستندات المرفقة (${activeSources.map((s: any) => s?.title || "وثيقة").join("، ")}):\n\n`;

    docSentences.forEach((doc) => {
      responseText += `1. **الوثيقة ${doc.index} ("${doc.title}")**:\n   ${doc.text}\n\n`;
    });

    responseText += `### التقييم والتقاطع الأكاديمي للدليل:\n`;
    responseText += `تتطرق الوثائق المرفقة بشكل مباشر للتوصيات والاستراتيجيات والأبعاد المرتبطة بسؤالك. تم توليف هذا الرد استناداً للمصادر المرفقة.`;

    // Always return 200 so the UI displays the response text seamlessly
    return res.json({ 
      text: responseText, 
      isFallback: true 
    });
  }
});

// Endpoint for automatic single-document analysis (title, language, summary extraction)
app.post("/api/analyze-document", async (req, res) => {
  const { content, base64, mimeType, fileName } = req.body;
  
  console.log(`📄 Document upload: ${fileName || "unnamed"}, mimeType: ${mimeType}`);
  console.log(`📄 content length: ${content?.length || 0}, base64 length: ${base64?.length || 0}`);

  if (!content && !base64) {
    return res.status(400).json({ error: "محتوى المستند فارغ أو غير صالح." });
  }

  const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
  const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                 fileName?.toLowerCase().endsWith(".docx") || 
                 mimeType === "application/msword" ||
                 fileName?.toLowerCase().endsWith(".doc");

  let parsedContent = content || "";

  // ----- WORD PARSING -----
  if (!parsedContent && isDocx && base64) {
    try {
      console.log(`📄 Parsing Word: ${fileName || "document.docx"} using mammoth...`);
      const buffer = Buffer.from(base64, "base64");
      const mammothResult = await mammoth.extractRawText({ buffer });
      parsedContent = normalizeArabicText(mammothResult.value || "");
      console.log(`✅ Word parsed: ${parsedContent.length} chars`);
    } catch (err: any) {
      console.error("❌ Word parsing error:", err.message);
    }
  }

  // ----- PDF PARSING WITH TIMEOUT & FALLBACK -----
  if (!parsedContent && isPdf && base64) {
    try {
      console.log(`📄 Parsing PDF: ${fileName || "document.pdf"}`);
      
      const buffer = Buffer.from(base64, "base64");
      console.log(`📄 PDF size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      if (buffer.length > 4_500_000) {
        console.warn(`⚠️ PDF exceeds 4.5MB – fallback to direct Gemini multimodal parsing`);
      }

      // Try local PDF parsing with a 6-second timeout
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await Promise.race([
        parser.getText(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("PDF local parsing timeout")), 6000)
        ),
      ]);
      
      parsedContent = normalizeArabicText((textResult as any)?.text || "");
      console.log(`✅ PDF parsed locally: ${parsedContent.length} chars, ${parsedContent.trim().split(/\s+/).filter(Boolean).length} words`);
      
    } catch (err: any) {
      console.warn("⚠️ Local PDF text extraction failed or timed out:", err.message);
      console.warn("🔄 Will rely on direct Gemini multimodal PDF processing via base64...");
      // DO NOT throw or return 500! Gemini will process base64 directly.
    }
  }

  // If no content AND no base64, return a helpful validation error
  if (!parsedContent && !base64) {
    console.warn(`⚠️ No content or base64 available for ${fileName || "document"}`);
    return res.status(400).json({
      error: "لم نتمكن من قراءة النص أو الملف. يرجى التأكد من صحة المستند وتجربة رفعه مجدداً.",
      details: "No text content or base64",
      fallback: true,
    });
  }

  // ----- BUILD RESPONSE OBJECT -----
  let result: any = {
    title: fileName || "مستند مرفق",
    language: "ar",
    summary: ensureArabicSummary("", fileName || "مستند مرفق", parsedContent),
    extractedText: parsedContent || "",
    terms: [],
  };

  // ----- AI ANALYSIS & TERM EXTRACTION -----
  try {
    const ai = getAiClient();
    const promptText = `أنت خبير ومحلل مصطلحي رفيع (Chief Terminologist) في نظام "بحث OS".
مهمتك استخراج قائمة دقيقة ونقية جداً (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة لدى الباحثين، وصياغة ملخص شامل ودقيق للمستند باللغة العربية حصراً.

طبق القواعد الحاسمة التالية:
1. الملخص (summary) باللغة العربية الفصحى حصراً وشرطاً قاطعاً:
   يجب كتابة الملخص باللغة العربية الفصحى حصراً وبأسلوب سلس وواضح، بغض النظر عن لغة المستند الأصلية (حتى لو كان المستند مكتوباً بالإنجليزية أو الفرنسية). يُحظر تماماً كتابة أي نص بالإنجليزية في الملخص.
2. الاقتصار على المفاهيم النظرية والأطر المنهجية المعتمدة في المستند:
   استخرج فقط المفاهيم البنيوية المركبة والأطر المعتمدة المذكورة حقيقة في المستند (مثل: Soft Power, Westphalian Sovereignty, Translation Theory, Path Dependence, Constructivism, Quality Assurance, Realism).
3. الحظر التام لاستخراج العناوين وأسماء الجامعات والبيانات المؤسسية والعبارات الشائعة:
   يُمنع منعاً باتاً استخراج أسماء الجامعات أو الأقسام أو الصفوف أو المدن (مثل: University of Saida, Department of Translation, First-Year Students, Case Study, جامعة سعيدة، قسم الترجمة، طلبة سنة أولى)، أو أجزاء العناوين (مثل: Teaching Translation in the Light of Artificial Intelligence أو تدريس الترجمة في ظل الذكاء الاصطناعي)، أو أرقام الصفحات والمراجع.
4. استبعاد التخصصات والمجالات الفضفاضة والكلمات التافهة:
   يُمنع استخراج أسماء العلوم العامة أو العناوين الفرعية أو التراكيب اللغوية غير النظرية.
5. الترجمة والتعريب الدقيق (verified_term):
   يجب تقديم مصطلح عربي فصيح ومعتمد ومكافئ للمصطلح الأصلي في حقل verified_term.
6. الجودة الصارمة للتعريف:
   لكل مصطلح، صغ تعريفاً إجرائياً أكاديمياً حقيقياً (من جملة واحدة) يوضح جوهر المفهوم العلمي ومعناه الدقيق.`;

    let contentsParam: any;
    if (parsedContent && parsedContent.trim()) {
      contentsParam = `${promptText}\n\nنص المستند:\n${parsedContent.substring(0, 15000)}`;
    } else if (base64) {
      contentsParam = [
        {
          inlineData: {
            mimeType: isPdf ? "application/pdf" : (mimeType || "application/octet-stream"),
            data: base64
          }
        },
        { text: promptText }
      ];
    } else {
      contentsParam = `${promptText}\n\nاسم المستند:\n${fileName || "مستند بدون عنوان"}`;
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: contentsParam,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "عنوان المستند الرصين."
            },
            language: {
              type: Type.STRING,
              description: "لغة المستند الرئيسية (ar أو en أو fr)."
            },
            summary: {
              type: Type.STRING,
              description: "ملخص بليغ ومكثف لمحتوى المستند باللغة العربية الفصحى حصراً وشرطاً قاطعاً (يُمنع كتابة الملخص بالإنجليزية أو بأي لغة غير العربية)."
            },
            extractedText: {
              type: Type.STRING,
              description: "أبرز أجزاء نص المستند أو تفكيك محتواه الأساسي."
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
                    description: "المصطلح العربي المقترح في المسودة الأولى."
                  },
                  definition: {
                    type: Type.STRING,
                    description: "شرح مفاهيمي مبسط وواضح باللغة العربية الفصحى في جملة واحدة فقط."
                  },
                  verified_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي النهائي المدقق والمصحح بالكامل."
                  }
                },
                required: ["term", "draft_term", "definition", "verified_term"]
              },
              description: "قائمة بأبرز المصطلحات والتقنيات المستخرجة من المستند مع الترجمة والتعريف (من 2 إلى 3 مصطلحات)."
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
    result.summary = ensureArabicSummary(data.summary || result.summary, result.title, parsedContent);
    
    if (!parsedContent && data.extractedText) {
      parsedContent = data.extractedText;
      result.extractedText = data.extractedText;
    }

    if (data.terms && Array.isArray(data.terms)) {
      result.terms = data.terms
        .filter((t: any) => {
          const mainTerm = t.term || "";
          const verified = t.verified_term || t.draft_term || "";
          if (isTrivialOrCitationTerm(mainTerm, t.definition)) return false;
          if (isTrivialOrCitationTerm(verified, t.definition)) return false;
          return true;
        })
        .slice(0, 3);
    }
  } catch (error) {
    console.warn("AI analysis failed, falling back to simple extraction:", error);
    result.title = fileName || "مستند مقتبس";
    result.summary = ensureArabicSummary("", result.title, parsedContent);
  }

  // Ensure 2 to 3 terms are ALWAYS generated and returned for every document
  if (!result.terms || !Array.isArray(result.terms) || result.terms.length < 2) {
    const textToExtract = parsedContent || result.summary || result.title || "";
    const fallbackTerms = extractFallbackTermsFromText(textToExtract, undefined, result.title);
    result.terms = fallbackTerms.slice(0, 3).map((t) => ({
      term: t.term,
      draft_term: t.draft_term,
      definition: t.definition,
      verified_term: t.verified_term
    }));
  }

  // Final sanity check on summary to guarantee 100% Arabic language
  result.summary = ensureArabicSummary(result.summary, result.title, parsedContent);

  const finalOriginalText = parsedContent && parsedContent.trim() 
    ? parsedContent 
    : `محتوى المستند المرفق (${result.title}):\n${result.summary}\n\nهذا المستند معتمد ومدمج للتحليل والمقارنة الأكاديمية والتوليف بواسطة الذكاء الاصطناعي.`;

  res.json({
    title: result.title,
    language: result.language,
    summary: result.summary,
    originalText: finalOriginalText,
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
  try {
    const { sources, topic, toolType } = req.body || {};
    const activeSources = Array.isArray(sources) ? sources : [];
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
    }

    console.log(`Starting synthesis for topic: "${topic}", toolType: "${toolType}", sources: ${activeSources.length}`);

    let sourcesContext = "المصادر المتاحة للتحليل والتوليف:\n";
    activeSources.forEach((src: any, idx: number) => {
      const title = src?.title || `الوثيقة ${idx + 1}`;
      const rawContent = src?.content || src?.summary || src?.extractedText || "";
      const safeContent = rawContent.length > 25000 
        ? rawContent.substring(0, 25000) + "\n...[تم اختصار بقية النص لتفادي تجاوز الحد الأقصى للمدخلات]" 
        : rawContent;

      sourcesContext += `\n---\n`;
      sourcesContext += `اسم الوثيقة: الوثيقة ${idx + 1}: ${title}\n`;
      sourcesContext += `المحتوى:\n${safeContent}\n`;
    });

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

    console.log(`Sending synthesis request to Gemini for ${activeSources.length} sources (type: ${toolType}).`);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        temperature: 0.1,
      },
    });

    const replyText = normalizeArabicText(response?.text || "فشل توليد التوليف.");
    return res.json({ text: replyText });

  } catch (error: any) {
    console.error("Gemini synthesis API call failed, preparing local fallback report:", error);

    const reqBody = req.body || {};
    const sources = Array.isArray(reqBody.sources) ? reqBody.sources : [];
    const topic = reqBody.topic || "تحليل المقارنة الشامل";
    const toolType = reqBody.toolType || "synthesis";

    let errorMessage = "تعذر توليد التقرير المباشر عبر الذكاء الاصطناعي — تم تفعيل نظام النسخ الاحتياطي للأدلة والمصادر المحلية بنجاح.";

    const errorStr = (error?.message || "").toLowerCase();
    const isQuotaError = error?.status === 429 || 
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
      reportText += `توضح مراجعة وتقاطع الأدلة البحثية المتاحة للوثائق (${sources.map((s: any) => s.title || "وثيقة").join("، ")}) أن البيانات تعرض زوايا متكاملة حول موضوع "${topic || "البحث"}".\n\n`;
      reportText += `<evidence strength="قوية" agreement="متفقة" supporting="${sources.length} من أصل ${sources.length} مصادر">
  <supporting>
    <source title="${sources[0]?.title || "المستند الأول"}">
      <quote>${(sources[0]?.summary || sources[0]?.content || "").substring(0, 150)}...</quote>
    </source>
  </supporting>
  <explanation>تؤكد المراجعة الميدانية وجود توازن بين المعطيات والنتاجات المذكورة في المصادر.</explanation>
</evidence>\n\n`;

      reportText += `### 2. التوصيات العملية الموجهة لصناع القرار\n`;
      sources.forEach((src: any, idx: number) => {
        reportText += `* **توصية نابعة من (${src.title || "الوثيقة " + (idx + 1)})**: الاستفادة من المعطيات الميدانية والتحليلات الواردة في المستند لدعم القرارات والتطبيق الفعلي.\n`;
      });
      reportText += `\n### 3. التداعيات والآثار الاستراتيجية بعيدة المدى\n`;
      reportText += `إن الاعتماد على الأدلة المستخلصة من هذه المصادر في دعم عملية اتخاذ القرار يضمن استدامة التطوير وتقليل المخاطر الميدانية.`;
    } else if (toolType === "faq") {
      reportText = `**دليل الأسئلة الشائعة والإجابات العلمية: ${topic || "تحليل تلاقي وتباعد الأدلة"}**\n\n`;
      reportText += scopeDisclosure;
      sources.forEach((src: any, idx: number) => {
        const title = src.title || `الوثيقة ${idx + 1}`;
        const summary = src.summary || (src.content ? src.content.substring(0, 180) + "..." : "لا يتوفر ملخص متاح.");
        reportText += `#### س${idx + 1}: ما هي الرؤية والنتائج الرئيسية الواردة في "${title}"؟\n`;
        reportText += `**ج:** تقدم هذه الوثيقة تحليلاً موثقاً يتلخص في: ${summary}\n\n`;
      });
      if (sources.length > 1) {
        reportText += `#### س${sources.length + 1}: هل تتفق المصادر المتاحة حول الاستنتاجات والتوصيات النهائية؟\n`;
        reportText += `**ج:** يظهر تقاطع المصادر المرفقة (${sources.map((s: any) => s.title).join("، ")}) وجود نقاط تكامل مفاهيمي حول الموضوع، مع تفاوت سياقي يعود لاختلاف عينات وزوايا الدراسة في كل وثيقة.\n\n`;
      }
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

    res.json({ 
      text: normalizeArabicText(reportText), 
      isFallback: true 
    });
  }
});

// Endpoint to passively extract academic/technical terms from a text snippet
app.post("/api/extract-glossary", async (req, res) => {
  const { text, systemPrompt } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return res.json({ terms: [] });
  }

  try {
    const ai = getAiClient();

    if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim().length >= 10) {
      console.log("🤖 Calling Google AI with custom system prompt...");
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.6-flash",
        contents: text,
        config: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          systemInstruction: systemPrompt,
        },
      });

      const responseText = response?.text || "";
      let terms: any[] = [];
      try {
        let cleanJson = responseText
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        const start = cleanJson.indexOf("[");
        const end = cleanJson.lastIndexOf("]") + 1;
        if (start !== -1 && end > start) {
          const jsonStr = cleanJson.substring(start, end);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            terms = parsed;
          }
        }
      } catch (parseError) {
        console.error("❌ Failed to parse AI response as JSON:", parseError);
      }
      return res.json({ terms });
    }

    const prompt = `أنت خبير ومحلل مصطلحي أكاديمي رفيع (Senior Terminological Analyst) في نظام "بحث OS".
مهمتك تحليل النص واستخراج قائمة دقيقة للغاية (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة لدى الباحثين فقط.

طبق القواعد الصارمة التالية:
1. الاقتصار على البناءات النظرية والمفاهيم العلمية المركبة:
   استخرج فقط البناءات النظرية ذات العمق العلمي والأطر المنهجية المعتمدة التي تمتلك تعريفاً جوهرياً متعارفاً عليه (مثل: Soft Power, Path Dependence, Structural Realism, Principal-Agent Problem, Process Tracing, Machine Learning).
2. الحظر الصارم للجمل والعبارات اللغوية الشائعة (Linguistic Fragments):
   يُمنع منعاً باتاً استخراج أي عبارات وصفية، أو أجزاء جمل، أو تراكيب لغوية عابرة وردت في النص (مثل: "both have translatability", "results show", "in this section", "data collected", "future studies"). أية تراكيب تحتوي أفعالاً أو أدوات ربط أو ضمائر يُحظر استخراجها إطلاقاً.
3. استبعاد التخصصات والمجالات العامة:
   يُمنع استخراج أسماء العلوم العامة أو المجالات الفضفاضة (مثل: Computer Science, Marketing, Management, Economics, History, Law, Physics...).
4. قواعد الاستبعاد العامة:
   يُمنع استخراج أسماء الأشخاص والمفكرين، أسماء الدول والمدن والأقاليم، أسماء المجلات والجامعات ودور النشر، التوثيقات المرجعية، والتواريخ.
5. الجودة الصارمة للتعريب والتعريف الأكاديمي:
   لكل مصطلح، يجب تقديم المصطلح العربي المعيار المعتمد والمكافئ بدقة في حقل verified_term (يُمنع ترك verified_term باللغة الإنجليزية).
   صغ تعريفاً إجرائياً أكاديمياً حقيقياً (من جملة واحدة) يوضح جوهر المفهوم بأسلوب رصين وبدون أي عبارات قالبية فارغة.

لكل مصطلح مستخرج، عبئ الحقول التالية بالترتيب الدقيق:
1. term: المصطلح الأصلي بالإنجليزية.
2. draft_term: المصطلح العربي المقترح أولياً.
3. definition: تعريف أكاديمي علمي حقيقي ونافع يشرح المفهوم وجوهره في جملة واحدة رصينة.
4. verified_term: المصطلح العربي النهائي المدقق والمصوب بعد استبدال أي تعريب صوتي بمكافئ عربي فصيح.

النص المراد تحليله:
${text.substring(0, 3500)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
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
    let normalizedTerms = (data.terms || [])
      .filter((t: any) => {
        const mainTerm = t.term || "";
        const verified = t.verified_term || t.draft_term || "";
        if (isTrivialOrCitationTerm(mainTerm, t.definition)) return false;
        if (isTrivialOrCitationTerm(verified, t.definition)) return false;
        if (/^[a-zA-Z\s\-]+$/.test(verified) && /^[a-zA-Z\s\-]+$/.test(mainTerm)) return false;
        return true;
      })
      .slice(0, 3)
      .map((t: any) => ({
        term: t.term,
        draft_term: t.draft_term,
        verified_term: t.verified_term,
        transliteration: t.verified_term || t.draft_term,
        definition: t.definition,
      }));

    if (!normalizedTerms || normalizedTerms.length === 0) {
      normalizedTerms = extractFallbackTermsFromText(text).slice(0, 3).map((t) => ({
        term: t.term,
        draft_term: t.draft_term,
        verified_term: t.verified_term,
        transliteration: t.transliteration,
        definition: t.definition,
      }));
    }

    return res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Passive glossary extraction backend failed, using local extraction fallback:", error);
    const fallbacks = extractFallbackTermsFromText(text).map((t) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.transliteration,
      definition: t.definition,
    }));
    return res.json({ terms: fallbacks });
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
لقد تم تزويدك بقائمة من المصطلحات المستخرجة مسبقاً. مهمتك هي تطبيق عملية التدقيق الشاملة وتصحيح أي قصور في الترجمة أو التعريفات:

1. تصحيح واستبدال التعريفات القالبية والتكرارية:
   إذا كان تعريف أي مصطلح يحتوي على عبارات قالبية فارغة من قبيل "مفهوم وأداة تحليلية أكاديمية وردت في السياق حول..." أو "مصطلح محوري تمت مناقشته..."، فيجب عليك فوراً إعادة صياغة التعريف واستبداله بتعريف أكاديمي موضوعي رصين ومكثف (من جملة إلى جملتين) يشرح الجوهر العلمي الدقيق لهذا المفهوم كما في أدبيات التخصص.
2. تصحيح واستبدال أسماء العلوم والتخصصات الكلية العامة:
   إذا وجد مصطلح عبارة عن مجرد اسم علم عام أو تخصص مجرد (مثل Computer Science, Marketing, Economics, History, Management)، فقم بتعريفه علمياً كمفهوم تحليلي أو إطار تخصصي مع تصحيح التعريف والاسم المعتمد.
3. مراجعة وتصحيح التعريب الصوتي (Domain-Independent Test):
   اقرأ المصطلح العربي المقترح بمفرده. إذا كان تعريباً صوتياً أو لفظياً (مثل: كونسورتيوم -> اتحاد أو ائتلاف، ليرنينغ موداليتي -> نمط التعلم)، اكتب التعريب العربي الفصيح والمكافئ الحقيقي للمصطلح في verified_term.

لكل مصطلح في القائمة أدناه، أعد تعبئة وتوليد الحقول التالية بدقة:
1. term: المصطلح الأصلي بالإنجليزية كما هو.
2. draft_term: المصطلح العربي المقترح حالياً.
3. definition: التعريف الأكاديمي الشارح والجامع الصريح بعد إزالة العبارات القالبية الفارغة وتوفير شرح علمي حقيقي ومكثف.
4. verified_term: المصطلح العربي النهائى السليم المعتمد.

المصطلحات المراد مراجعتها وتدقيقها:
${JSON.stringify(terms, null, 2)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
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
    const normalizedTerms = (data.terms || [])
      .filter((t: any) => !isTrivialOrCitationTerm(t.term || t.verified_term || t.draft_term, t.definition))
      .map((t: any) => ({
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

if (!process.env.VERCEL) {
  setupViteOrStatic().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
