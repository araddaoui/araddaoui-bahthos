import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, normalizeArabicText, areTermsEquivalent } from "./src/utils/termExtractor";
import { generateClientSynthesisFallback } from "./src/utils/synthesisFallback";

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
    systemInstruction?: any;
  }
) {
  let attempt = 1;
  const maxAttempts = 3;
  let currentModel = params.model || "gemini-2.0-flash";
  if (currentModel.includes("2.5") || currentModel.includes("3.6") || currentModel.includes("3.5") || currentModel.includes("3.0")) {
    currentModel = "gemini-2.0-flash";
  }

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
        status === 404 ||
        status === 400 ||
        errorStr.includes("503") || 
        errorStr.includes("404") ||
        errorStr.includes("400") ||
        errorStr.includes("not found") ||
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
        const delay = isQuota ? attempt * 2000 : (attempt === 2 ? 1000 : 2000);
        
        currentModel = "gemini-1.5-flash";
        console.warn(`Attempt ${attempt}: Switching model to ${currentModel} due to ${isQuota ? "429 quota/rate limit" : "503/404/timeout"}. Retrying in ${delay}ms...`);
        
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
      model: "gemini-1.5-flash",
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

    let responseText = `### التوليف والمقارنة المباشرة للمصادر المرفقة حول: "${lastUserMessage}"\n\n`;
    responseText += `بناءً على قراءة وتقاطع البيانات الواردة في ${activeSources.length} من الوثائق المتاحة:\n\n`;
    activeSources.forEach((src: any, idx: number) => {
      const title = src?.title || `الوثيقة ${idx + 1}`;
      const summary = src?.summary || (src?.content ? src.content.substring(0, 300) + "..." : "محتوى الوثيقة المرفقة");
      responseText += `#### ${idx + 1}. ${title}\n- ${summary}\n\n`;
    });
    responseText += `---\n**خلاصة تركيبية:** توفر هذه الوثائق أرضية بحثية متكاملة للإجابة على التساؤل المطروح.`;

    return res.json({ text: responseText });
  }
});

// Endpoint to extract text and terms from uploaded file or text content
app.post("/api/extract-text", async (req, res) => {
  try {
    const { content, base64, mimeType, fileName } = req.body || {};

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
      }
    }

    if (!parsedContent && !base64) {
      console.warn(`⚠️ No content or base64 available for ${fileName || "document"}`);
      return res.status(400).json({
        error: "لم نتمكن من قراءة النص أو الملف. يرجى التأكد من صحة المستند وتجربة رفعه مجدداً.",
        details: "No text content or base64",
        fallback: true,
      });
    }

    let defaultFallback: any = {
      title: fileName || "مستند مرفق",
      language: "ar",
      summary: ensureArabicSummary("", fileName || "مستند مرفق", parsedContent),
      extractedText: parsedContent || "",
      terms: [],
    };

    try {
      const ai = getAiClient();
      const promptText = "أنت خبير ومحلل مصطلحي رفيع (Chief Terminologist) في نظام \"بحث OS\".\n" +
  "مهمتك استخراج قائمة دقيقة ونقية جداً (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة لدى الباحثين، وصياغة ملخص شامل ودقيق للمستند باللغة العربية حصراً.\n\n" +
  "طبق القواعد الحاسمة التالية:\n" +
  "1. الملخص (summary) باللغة العربية الفصحى حصراً وشرطاً قاطعاً.\n" +
  "2. الاقتصار على المفاهيم النظرية والأطر المنهجية المعتمدة في المستند.\n" +
  "3. الحظر التام لاستخراج العناوين وأسماء الجامعات والبيانات المؤسسية والعبارات الشائعة.\n" +
  "4. استبعاد التخصصات والمجالات الفضفاضة والكلمات العابرة.\n\n" +
  "النص:\n" + (parsedContent ? parsedContent.substring(0, 30000) : "");

      const contentsInput: any[] = [];
      if (parsedContent) {
        contentsInput.push(promptText);
      }
      if (base64 && mimeType) {
        contentsInput.push({
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        });
      }
      if (contentsInput.length === 0) {
        contentsInput.push(promptText);
      }

      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: contentsInput,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "العنوان الرئيسي المفضل للمستند." },
              language: { type: Type.STRING, description: "كود اللغة الأصلي للمستند مثل ar أو en." },
              summary: { type: Type.STRING, description: "ملخص أكاديمي شامل باللغة العربية الفصحى." },
              extractedText: { type: Type.STRING, description: "النص المستخرج من المستند." },
              terms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING, description: "المصطلح الأصلي بالإنجليزية." },
                    draft_term: { type: Type.STRING, description: "المصطلح العربي المقترح." },
                    definition: { type: Type.STRING, description: "تعريف المصطلح." },
                    verified_term: { type: Type.STRING, description: "المصطلح العربي النهائي المدقق والمصحح بالكامل." }
                  },
                  required: ["term", "draft_term", "definition", "verified_term"]
                }
              }
            },
            required: ["title", "language", "summary", "extractedText", "terms"]
          }
        }
      });

      let resData: any = {};
      if (response?.text) {
        try {
          resData = JSON.parse(response.text);
        } catch (err) {
          console.error("Failed to parse JSON response in extract:", err);
        }
      }

      if (resData.summary) {
        resData.summary = ensureArabicSummary(resData.summary, resData.title || fileName, parsedContent);
      } else {
        resData.summary = ensureArabicSummary("", resData.title || fileName, parsedContent);
      }

      return res.json(resData);
    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      return res.json(defaultFallback);
    }
  } catch (err: any) {
    console.error("Extract handler error:", err);
    return res.status(500).json({ error: "Failed to extract text from document." });
  }
});

// Endpoint to generate academic synthesis reports using Gemini or smart fallback
function deduplicateSources(sources: any[]): any[] {
  if (!Array.isArray(sources)) return [];
  const seenKeys = new Set<string>();
  const unique: any[] = [];

  for (const src of sources) {
    if (!src) continue;
    const title = (src?.title || "").trim();
    const normTitle = title
      .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    const rawContent = (src?.content || src?.summary || src?.extractedText || "").trim();
    const contentSnippet = rawContent.substring(0, 300).toLowerCase().replace(/\s+/g, " ");

    const titleKey = normTitle.length > 5 ? normTitle : null;
    const contentKey = contentSnippet.length > 30 ? contentSnippet : null;

    if (titleKey && seenKeys.has(titleKey)) continue;
    if (contentKey && seenKeys.has(contentKey)) continue;

    if (titleKey) seenKeys.add(titleKey);
    if (contentKey) seenKeys.add(contentKey);

    unique.push(src);
  }

  return unique.length > 0 ? unique : sources;
}

function deduplicateReportText(text: string): string {
  if (!text) return "";

  // Split inline merged bullets mid-paragraph (e.g. "...المستهدفة. - **تطوير معايير...")
  let cleanedText = text.replace(/([.؛:!؟\u0600-\u06FFa-zA-Z])\s*[-–—•*]\s+(\*\*[\u0600-\u06FFa-zA-Z])/g, "$1\n\n- $2");
  cleanedText = cleanedText.replace(/(توصية\s+مستندة\s+إلى\s*\(\s*)[\s.\-–—:؛"'\(\)]+([^)]+)/gi, "$1$2");

  const blocks = cleanedText.split(/\n{2,}/);
  const resultBlocks: string[] = [];
  
  const seenQAKeys = new Set<string>();
  const seenBulletKeys = new Set<string>();
  let questionCounter = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const isQuestion = /^(?:#{1,6}\s*)?(?:س\d*:|سؤال\s*\d*:|\*\*س\d+:\*\*|\*\*س:\*\*|\*\*سؤال:\*\*)/i.test(block);

    if (isQuestion) {
      const nextBlock = i + 1 < blocks.length ? blocks[i + 1].trim() : "";
      const isAnswer = /^(?:\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*|الإجابة\s+العلمية\s*\(ج\):)/i.test(nextBlock);

      const rawQuestionText = block.replace(/^(?:#{1,6}\s*)?(?:س\d*:|سؤال\s*\d*:|\*\*س\d+:\*\*|\*\*س:\*\*|\*\*سؤال:\*\*)\s*/i, "").trim();
      const normQuestion = rawQuestionText
        .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");

      let normAnswer = "";
      if (isAnswer) {
        const rawAnswerText = nextBlock.replace(/^(?:\*\*ج:\*\*|ج:|\*\*إجابة:\*\*|إجابة:|\*\*الجواب:\*\*|الإجابة\s+العلمية\s*\(ج\):)\s*/i, "").trim();
        normAnswer = rawAnswerText
          .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
          .substring(0, 150)
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      const qaKey = normQuestion + "||" + normAnswer;

      if (seenQAKeys.has(qaKey)) {
        if (isAnswer) i++; // Skip answer block
        continue;
      }

      seenQAKeys.add(qaKey);

      const cleanQHeader = `#### س${questionCounter++}: ${rawQuestionText}`;
      resultBlocks.push(cleanQHeader);

      if (isAnswer) {
        resultBlocks.push(nextBlock);
        i++; // Skip answer block as processed
      }
      continue;
    }

    if (block.startsWith("- ") || block.startsWith("* ") || block.startsWith("• ")) {
      const bulletContent = block.replace(/^[*•-]\s+/, "").trim();
      const normBullet = bulletContent
        .replace(/^[\s.\-–—:؛"'\(\)]+|[\s.\-–—:؛"'\(\)]+$/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ");

      if (normBullet.length > 20 && seenBulletKeys.has(normBullet)) {
        continue;
      }
      if (normBullet.length > 20) {
        seenBulletKeys.add(normBullet);
      }
    }

    resultBlocks.push(block);
  }

  return resultBlocks.join("\n\n");
}

app.post("/api/synthesize", async (req, res) => {
  try {
    const { sources: rawSourcesInput, topic, toolType } = req.body || {};
    const sources = Array.isArray(rawSourcesInput) ? rawSourcesInput : [];
    const activeSources = deduplicateSources(sources);
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
    }

    console.log("Starting synthesis for topic:", topic, "toolType:", toolType, "sources:", activeSources.length);

    let sourcesContext = "المصادر المتاحة للتحليل والتوليف:\n";
    activeSources.forEach((src: any, idx: number) => {
      const docNum = idx + 1;
      const title = src?.title || ("الوثيقة " + docNum);
      const rawContent = src?.content || src?.summary || src?.extractedText || "";
      const safeContent = rawContent.length > 25000 
        ? rawContent.substring(0, 25000) + "\n...[تم اختصار بقية النص لتفادي تجاوز الحد الأقصى للمدخلات]" 
        : rawContent;

      sourcesContext += "\n---\n";
      sourcesContext += "اسم الوثيقة: الوثيقة " + docNum + ": " + title + "\n";
      sourcesContext += "الملخص الفعلي للوثيقة: " + (src?.summary || "غير متاح") + "\n";
      sourcesContext += "المحتوى التفصيلي المتاح للوثيقة:\n" + safeContent + "\n";
    });

    const ai = getAiClient();
    const systemInstruction = "أنت عالم ومحلل بحثي وأكاديمي خبير في نظام \"بحث OS\" (Bahth OS).\n" +
"مهمتك إجراء تحليل توليفي وتوثيقي عميق ومقارن للمصادر البحثية المرفقة حول الموضوع المحدد.\n\n" +
"قواعد صياغة الجودة والأمان الأكاديمي الصارمة (STRICT QUALITY RULES):\n" +
"1. **اللغة العربية الفصحى الصافية والنقاء اللغوي (PURE UNINTERRUPTED ARABIC)**:\n" +
"   - اكتب فقرات عربية مترابطة وسلسة بالكامل دون خلط عشوائي مع الإنجليزية.\n" +
"   - احظر تماماً تضمين الروابط المباشرة (URLs/DOIs)، الأرقام المعيارية (ISSNs/ISBNs)، العناوين البيبلوجرافية لدور النشر والمجلات، أو البريد الإلكتروني في متن النصوص والملخصات والجداول.\n" +
"   - ترجم الاقتباسات والمفاهيم الأجنبية فوراً إلى العربية واكتفِ بالإشارة إلى اسم الوثيقة بالعربية مرة واحدة فقط عند الحاجة.\n" +
"2. **قواعد الجداول المعيارية الصارمة (STRICT MARKDOWN TABLE FORMATTING)**:\n" +
"   - يُحظر تماماً كتابة أسطر العناوين خارج الجدول، أو إضافة أي أسطر فارغة أو أعمدة تفصل بين أسطر الجدول.\n" +
"   - السطر الأول في الجدول هو دائماً سطر العناوين الرئيسي المخول بـ 4 أعمدة: `| الرقم | الوثيقة والمحور الرئيسي | الأدلة والنتائج المؤيدة | التحليل النقدي والتباين المنهجي |`.\n" +
"   - السطر الثاني هو سطر المحاذاة المعياري: `| :--- | :--- | :--- | :--- |`.\n" +
"   - لا تضف أي نقاط أو أرقام أو رموز قبل رمز الأنبوب `|` في بداية السطر إطلاقاً.\n" +
"3. **منع التكرار اللفظي والأنماط القالبية (ZERO REPETITIVE BOILERPLATE)**:\n" +
"   - يُمنع منعاً باتاً تكرار العبارات القالبية العابرة. لكل وثيقة، استخرج التفاصيل المنهجية والأدلة الرقمية المحددة والنتائج الميدانية الفريدة.\n" +
"4. **الفصل التام وإفراد التوصيات والنقاط (STRICT ITEM ISOLATION & PARAGRAPH SEPARATION)**:\n" +
"   - يُحظر حظراً تاماً دمج التوصيات (`توصية مستندة إلى`) أو الفجوات أو الأسئلة في سطر واحد أو فقرة واحدة متصلة.\n" +
"   - يجب تخصيص نقطة مستقلة تماماً تبدأ بـ (`- `) لكل توصية على حدة، مع ترك سطرين فارغين بين كل توصية وأخرى.\n" +
"5. **توليد وتحليل عميق وموسع (DEEP ELABORATION & EXPANSION)**:\n" +
"   - يُحظر حظراً تاماً الاكتفاء بجمل عامة قصيرة أو ملخصات موجزة جداً (مثل 'يضمن تعزيز الجودة وتفادي القشور').\n" +
"   - يجب إثراء وتوسيع كل قسم ونقطة (خاصة قسم 'التداعيات والآثار الاستراتيجية بعيدة المدى' وقسم 'التوصيات العملية') بتحليل مفصل يمتد لعدة فقرات ونقاط فرعية مستقلة، يستعرض الآليات التنفيذية، التغييرات المؤسسية والتشغيلية، إدارة المخاطر الميدانية، وتطبيقات الجودة على المدى الطويل.\n" +
"6. **توليد ودمج وسوم الأدلة الحية (MANDATORY EVIDENCE TAGS)**:\n" +
"   في نهاية كل قسم رئيسي، قم بتضمين وسم <evidence> بتنسيق XML يوثق الاقتباسات والأدلة المباشرة المترجمة للعربية من المصادر.";

    const topicName = topic || "مقارنة وتحليل شامل للمصادر";
    const scopeIntro = "توضيح النطاق: يعتمد هذا التقرير التوليفي والتحليل المتقدم على " + activeSources.length + " من مصادر البحث النشطة المتاحة لصلتها المباشرة بالموضوع المدروس.\n\n";

    let userPrompt = "";
    if (toolType === "matrix") {
      userPrompt = "صغ \"مصفوفة الأدلة والتعارضات الأكاديمية\" (Evidence & Contradiction Matrix) بشكل جدول ماركداون (Markdown Table) يتضمن 4 أعمدة فقط وبدون أي أسطر فارغة:\n" +
"1. **الرقم** (1، 2، 3...)\n" +
"2. **الوثيقة والمحور الرئيسي** (اسم الوثيقة بالعربية + القضية الجوهرية)\n" +
"3. **الأدلة والنتائج المؤيدة** (الأدلة الرقمية والمنهجية الموثقة دون تكرار)\n" +
"4. **التباين والتحليل النقدي** (أوجه الاختلاف والحدود المنهجية أو السياقية)\n\n" +
"ثم اتبع الجدول بتحليل توليفي ومقارن تفصيلي ومكتمل بين المصادر حول الموضوع: \"" + topicName + "\".\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "gap" || toolType === "gaps") {
      userPrompt = "صغ \"تقرير فجوات الأدلة الأكاديمية\" (Academic Evidence Gaps Report) حول الموضوع: \"" + topicName + "\" مع الالتزام التام بالفصل الكامل بين الفقرات والعناوين:\n\n" +
"### 1. الفجوات المعرفية والمنهجية المرصودة\n" +
"اكتب كل فجوة في فقرة أو نقطة مستقلة ومفصلة تماماً (الفجوة 1 في فقرة منفصلة، الفجوة 2 في فقرة جديدة منفصلة...) مع ترك سطرين فارغين بين كل فجوة وأخرى. لا تدمج الفجوات إطلاقاً في سطر واحد أو نقطة واحدة.\n\n" +
"### 2. الأسئلة البحثية المعلقة والمقترحة مستقبلاً\n" +
"اكتب كل سؤال بحثي في نقطة رقمية مستقلة ومفصلة تبدأ بـ (1. ، 2. ، 3. ...) مع ترك سطرين فارغين بين كل سؤال وآخر.\n\n" +
"### 3. مقترحات المستندات الإضافية المطلوبة لسد الفجوات\n" +
"اكتب كل مقترح في نقطة مستقلة تبدأ بـ (- لسد فجوة الأدلة المتعلقة بـ...) مع سطرين فارغين بين النقاط.\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "briefing") {
      userPrompt = "صغ تقريراً موجزاً للسياسات والباحثين (Executive Policy Briefing) يتضمن فقرات ومحاور عربية متكاملة وموسعة:\n\n" +
"### 1. الملخص التنفيذي للموقف الأكاديمي\n" +
"استعرض الملخص بفقرات موسعة ومفصلة توضح تقاطعات الأدلة بين المصادر.\n\n" +
"### 2. التوصيات العملية الموجهة لصناع القرار\n" +
"ضع كل توصية في نقطة مستقلة ومفصلة تماماً تبدأ بـ (`- توصية مستندة إلى...`) مع شرح الخطوات والإجراءات الميدانية بدقة، وترك سطرين فارغين بين كل توصية وأخرى. يُحظر حظراً تاماً دمج التوصيات في فقرة واحدة.\n\n" +
"### 3. التداعيات والآثار الاستراتيجية بعيدة المدى\n" +
"صغ تحليلاً عميقاً وشاملاً يمتد لعدة نقاط فرعية مستقلة ومفصلة (يشمل: الأثر على التخطيط المؤسسي والسياسات، تطوير الكفاءات وتوجيه العنصر البشري، إدارة المخاطر وتفادي الخسائر، واستدامة معايير الجودة البحثية والتنفيذية)، واشرح كل نقطة باستفاضة ودون اختزال.\n\n" +
"الموضوع: \"" + (topic || "الملخص التنفيذي والتوصيات") + "\"\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "faq") {
      userPrompt = "صغ دليلاً للأسئلة الشائعة والإجابات العلمية الموثقة (Academic FAQ Guide) يطرح أسئلة جوهرية وفريدة عن كل وثيقة وإجابات تفصيلية باللغة العربية الفصحى السلسة.\n\n" +
"شروط صارمة لمنع التكرار:\n" +
"- يُحظر حظراً تاماً تكرار نفس صيغة السؤال أو نفس الإجابة لأكثر من وثيقة واحدة.\n" +
"- اشتق زاوية سؤال مختلفة ومتميزة لكل وثيقة (مثل: الإطار النظري والقيمة المنهجية، الأدلة الميدانية، التحديات والحدود التشغيلية، ودور العنصر البشري).\n" +
"- قم بترقيم الأسئلة بالتتابع وبشكل فريد (س1:، س2:، س3:...).\n\n" +
"الموضوع: \"" + (topic || "دليل الأسئلة الشائعة") + "\"\n\n" +
scopeIntro + sourcesContext;
    } else {
      userPrompt = "صغ تقريراً تحليلياً وتوليفياً كاملاً ومفصلاً (Full Academic Synthesis Report) حول الموضوع: \"" + topicName + "\" يتضمن الأقسام التالية بفقرات عربية مسترسلة ومتصلة:\n\n" +
"1. مقدمة وتوطين موضوع البحث\n" +
"2. القراءة التحليلية المقارنة للمصادر المرفقة (معالجة تفصيلية فريدة لكل وثيقة)\n" +
"3. نقاط الاتفاق والتكامل المنهجي بين المصادر\n" +
"4. نقاط الاختلاف والتباين المنهجي (التعارض والتحليل السياقي)\n" +
"5. الخلاصة والاستنتاجات التوليفية\n\n" +
scopeIntro + sourcesContext;
    }

    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.0-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        }
      });

      if (response?.text && response.text.trim().length > 100) {
        const cleanText = deduplicateReportText(normalizeArabicText(response.text.trim()));
        return res.json({
          text: cleanText,
          isFallback: false
        });
      }
    } catch (aiErr: any) {
      console.error("AI synthesis call failed, using smart fallback logic:", aiErr);
    }

    // Smart, document-specific fallback if AI call fails
    const fallbackReport = generateClientSynthesisFallback(activeSources, topic || "تحليل ومقارنة شاملة للمصادر", toolType);
    return res.json({
      text: deduplicateReportText(normalizeArabicText(fallbackReport)),
      isFallback: true
    });

  } catch (error: any) {
    console.error("Error in synthesis API:", error);
    const fallbackReport = generateClientSynthesisFallback(req.body?.sources || [], req.body?.topic || "تحليل وتوليف المصادر", req.body?.toolType);
    return res.json({
      text: deduplicateReportText(normalizeArabicText(fallbackReport)),
      isFallback: true
    });
  }
});

// Endpoint to passively extract academic/technical terms from a text snippet
app.post("/api/extract-glossary", async (req, res) => {
  const { text, systemPrompt, existingTerms } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return res.json({ terms: [] });
  }

  try {
    const ai = getAiClient();

    if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim().length >= 10) {
      console.log("🤖 Calling Google AI with custom system prompt...");
      const response = await generateContentWithRetry(ai, {
        model: "gemini-2.5-flash",
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
          .split("```json").join("")
          .split("```").join("")
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

    const existingTermsStr = existingTerms && Array.isArray(existingTerms) && existingTerms.length > 0 
      ? existingTerms.map((t: any) => t.term || t.transliteration || t.verified_term).filter(Boolean).join("، ") 
      : "لا يوجد بعد";

    const prompt = "أنت خبير ومحلل مصطلحي أكاديمي رفيع (Senior Terminological Analyst) في نظام \"بحث OS\".\n" +
"مهمتك تحليل النص واستخراج قائمة دقيقة للغاية (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة لدى الباحثين فقط.\n\n" +
"طبق القواعد الصارمة التالية:\n" +
"1. الاقتصار على البناءات النظرية والمفاهيم العلمية المركبة:\n" +
"   استخرج فقط البناءات النظرية ذات العمق العلمي والأطر المنهجية المعتمدة التي تمتلك تعريفاً جوهرياً متعارفاً عليه (مثل: Soft Power, Path Dependence, Structural Realism, Principal-Agent Problem, Process Tracing, Machine Learning).\n" +
"2. الحظر الصارم للجمل والعبارات اللغوية الشائعة (Linguistic Fragments):\n" +
"   يُمنع منعاً باتاً استخراج أي عبارات وصفية، أو أجزاء جمل، أو تراكيب لغوية عابرة وردت في النص (مثل: \"both have translatability\", \"results show\", \"in this section\", \"data collected\", \"future studies\"). أية تراكيب تحتوي أفعالاً أو أدوات ربط أو ضمائر يُحظر استخراجها إطلاقاً.\n" +
"3. استبعاد التخصصات والمجالات العامة:\n" +
"   يُمنع استخراج أسماء العلوم العامة أو المجالات الفضفاضة (مثل: Computer Science, Marketing, Management, Economics, History, Law, Physics...).\n" +
"4. قواعد الاستبعاد العامة:\n" +
"   يُمنع استخراج أسماء الأشخاص والمفكرين، أسماء الدول والمدن والأقاليم، أسماء المجلات والجامعات ودور النشر، التوثيقات المرجعية، والتواريخ.\n" +
"5. الجودة الصارمة للتعريب والتعريف الأكاديمي:\n" +
"   لكل مصطلح، يجب تقديم المصطلح العربي المعيار المعتمد والمكافئ بدقة في حقل verified_term (يُمنع ترك verified_term باللغة الإنجليزية).\n" +
"   صغ تعريفاً إجرائياً أكاديمياً حقيقياً (من جملة واحدة) يوضح جوهر المفهوم بأسلوب رصين وبدون أي عبارات قالبية فارغة.\n" +
"6. منع التكرار مع المصطلحات السابقة في المشروع:\n" +
"   يُمنع منعاً باتاً استخراج أو تكرار أي مصطلح أو مفهوم موجود بالفعل في هذه القائمة:\n" +
"   " + existingTermsStr + "\n\n" +
"لكل مصطلح مستخرج، عبئ الحقول التالية بالترتيب الدقيق:\n" +
"1. term: المصطلح الأصلي بالإنجليزية.\n" +
"2. draft_term: المصطلح العربي المقترح أولياً.\n" +
"3. definition: تعريف أكاديمي علمي حقيقي ونافع يشرح المفهوم وجوهره في جملة واحدة رصينة.\n" +
"4. verified_term: المصطلح العربي النهائي المدقق والمصوب بعد استبدال أي تعريب صوتي بمكافئ عربي فصيح.\n\n" +
"النص المراد تحليله:\n" +
text.substring(0, 3500);

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
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
        if (existingTerms && Array.isArray(existingTerms) && existingTerms.some((ex: any) =>
          areTermsEquivalent(ex.term || "", mainTerm) ||
          areTermsEquivalent(ex.verified_term || ex.transliteration || "", verified || mainTerm)
        )) {
          return false;
        }
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
      normalizedTerms = extractFallbackTermsFromText(text, undefined, undefined, existingTerms).slice(0, 3).map((t) => ({
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
    const fallbacks = extractFallbackTermsFromText(text, undefined, undefined, existingTerms).map((t) => ({
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
