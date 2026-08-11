import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, normalizeArabicText, areTermsEquivalent, cleanAndSanitizeAcademicTerm, detectSourceLanguage, spellcheckAndRepairArabicAndEnglishText, buildContextDefinition } from "./src/utils/termExtractor";
import { generateClientSynthesisFallback, generateReportFollowUpFallback } from "./src/utils/synthesisFallback";

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
  },
  res?: any
) {
  let attempt = 1;
  const maxAttempts = 3;
  let currentModel = params.model || "gemini-3.6-flash";

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
        
        if (currentModel === "gemini-3.6-flash") {
          currentModel = "gemini-flash-latest";
        } else {
          currentModel = "gemini-3.6-flash";
        }

        console.warn(`[Retry System] Attempt ${attempt}/${maxAttempts}: Retrying request using model '${currentModel}' due to ${isQuota ? "429 quota/rate limit" : "error"}. Retrying in ${delay}ms...`);
        
        if (res && typeof res.setHeader === "function" && !res.headersSent) {
          try {
            res.setHeader("X-Retry-Count", String(attempt - 1));
            res.setHeader("X-Retried", "true");
            res.setHeader("X-Model-Used", currentModel);
          } catch (hErr) {
            // ignore header errors
          }
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
- Organize the findings logically under themed paragraphs or thematic headings rather than listing document summaries sequentially. Your final response must read like a highly polished synthesis report or research synthesis that contrasts and connects different perspectives.

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

// Helper function to convert raw 16-bit PCM audio buffer into a valid 44-byte WAV container
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(dataSize + 36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Endpoint for High-Quality Modern Standard Arabic Text-To-Speech (Gemini TTS)
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "No text provided for speech synthesis." });
    }

    const cleanSegment = text
      .replace(/[#*`_~\[\]()]/g, "")
      .replace(/\|\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanSegment) {
      return res.status(400).json({ error: "Text is empty after cleaning." });
    }

    const ai = getAiClient();
    const candidateModels = ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"];
    let lastError: any = null;

    for (const ttsModel of candidateModels) {
      try {
        const response = await generateContentWithRetry(ai, {
          model: ttsModel,
          contents: cleanSegment,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
              },
            },
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        for (const p of parts as any[]) {
          const rawData = p.inlineData?.data || p.inline_data?.data;
          const rawMime = p.inlineData?.mimeType || p.inline_data?.mime_type || "audio/wav";

          if (rawData) {
            let finalAudioBase64 = rawData;
            let finalMimeType = "audio/wav";

            // If Gemini returned raw PCM / L16 audio, package it into a browser-playable WAV header
            if (rawMime.toLowerCase().includes("pcm") || rawMime.toLowerCase().includes("l16") || rawMime.toLowerCase().includes("raw")) {
              let sampleRate = 24000;
              const rateMatch = rawMime.match(/rate=(\d+)/i);
              if (rateMatch && rateMatch[1]) {
                sampleRate = parseInt(rateMatch[1], 10);
              }
              const pcmBuf = Buffer.from(rawData, "base64");
              const wavBuf = pcmToWav(pcmBuf, sampleRate);
              finalAudioBase64 = wavBuf.toString("base64");
            } else if (rawMime) {
              finalMimeType = rawMime;
            }

            return res.json({
              audio: finalAudioBase64,
              mimeType: finalMimeType,
            });
          }
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.warn(`TTS model ${ttsModel} attempt failed:`, mErr?.message || mErr);
      }
    }

    console.warn("All Gemini TTS models unavailable, returning graceful fallback flag.");
    return res.json({ audio: null, fallback: true, error: lastError?.message || "TTS unavailable" });
  } catch (error: any) {
    console.warn("Gemini TTS synthesis fallback:", error?.message || error);
    return res.json({
      audio: null,
      fallback: true,
      error: error?.message || "Gemini TTS unavailable",
    });
  }
});

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
    }, res);

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
        text: "مرحباً بك. يرجى تفعيل أو رفع وثيقة واحدة على الأقل في القائمة الجانبية لنتمكن من تحليلها ومقارنتها والإجابة عن سؤالك بدقة عالية وموضوعية."
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
app.post(["/api/extract-text", "/api/analyze-document"], async (req, res) => {
  try {
    const { content, base64, mimeType, fileName } = req.body || {};

    const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                   fileName?.toLowerCase().endsWith(".docx") || 
                   mimeType === "application/msword" ||
                   fileName?.toLowerCase().endsWith(".doc");

    let parsedContent = content || "";
    let isLargePdf = false;

    if (isPdf && base64) {
      const approxSize = Math.floor((base64.length * 3) / 4);
      if (approxSize > 4_500_000) {
        isLargePdf = true;
      }
    }

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
          isLargePdf = true;
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
      title: spellcheckAndRepairArabicAndEnglishText(fileName || "مستند مرفق"),
      language: detectSourceLanguage(parsedContent || "", fileName || ""),
      summary: spellcheckAndRepairArabicAndEnglishText(ensureArabicSummary("", fileName || "مستند مرفق", parsedContent)),
      extractedText: parsedContent || "",
      terms: [],
    };

    try {
      const ai = getAiClient();
      const promptText = "أنت خبير ومحلل مصطلحي وباحث تخصصي رفيع (Chief Terminologist & Research Fellow) في نظام \"بحث OS\".\n" +
  "نظام \"بحث OS\" هو منصة أبحاث وتوليف مستقلة ومحايدة تماماً، خالية من أي انحياز مسبق لمجال بعينه، ومصممة لخدمة المستخدمين والمستندات من جميع القطاعات والتخصصات الميدانية والأكاديمية والمهنية (سواء كان المجال: الصحافة والإعلام، إدارة الأعمال والتسويق، العلوم السياسية والسياسات العامة، النقد الأدبي والدراسات الأدبية، التدوين وصناعة المقالات والوسائط، البحث العلمي والأكاديمي، الإدارة العامة والعمل المؤسسي والتنفيذي، أو أي مجال آخر).\n\n" +
  "مهمتك الأساسية هي استخراج قائمة دقيقة ونقية جداً (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts) والأطر المنهجية والمصطلحات المفتاحية الأصيلة النابعة مباشرة من الحقل المعرفي والتخصصي الخاص بالمستند المرفق حصراً، وصياغة ملخص تحليلي متكامل وشامل للمستند باللغة العربية الفصحى.\n\n" +
  "طبق القواعد الحاسمة التالية:\n" +
  "1. الملخص (summary): يجب أن يكون ملخصاً تحليلياً تركيبياً شاملاً باللغة العربية الفصحى حصراً. يُحظر حظراً مطلقاً اقتباس نصوص خام أو جمل بالإنجليزية أو الفرنسية داخل الملخص، بل يجب صياغة الملخص بأسلوب عربي سلس يترجم ويشرح المضمون دون نقل أسطر أو اقتباسات من الأصل.\n" +
  "2. المصطلحات: استخراج 2 إلى 3 مفاهيم نظرية وأطر منهجية ومصطلحات مفتاحية أصيلة تعبر عن مضمون المستند وحقله المعرفي المباشر حصراً دون فرض أي مصطلحات من مجالات أخرى خارج نطاق المستند.\n" +
  "3. يُحظر حظراً مطلقاً استخراج أسماء المؤلفين والباحثين والأعلام والشخصيات، أو عناوين المقالات والأوراق والكتب، أو العبارات المجزأة والمبتورة المكتفية بحروف جر أو أفعال ناقصة.\n" +
  "4. يجب تقديم تعريف تحليلي أكاديمي متكامل باللغة العربية الفصحى لكل مصطلح يوضح معناه وسياقه المباشر في حقل النص (لا يقل عن 25 حرفاً) دون استخدام اقتباسات فارغة.\n\n" +
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
        model: "gemini-3.6-flash",
        contents: contentsInput,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "العنوان الرئيسي المفضل للمستند." },
              language: { type: Type.STRING, description: "كود اللغة الأصلي للمستند مثل ar أو en." },
              summary: { type: Type.STRING, description: "ملخص تحليلي شامل باللغة العربية الفصحى." },
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
      }, res);

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

      // Detect true source language (ar/en/fr) and repair spellings
      resData.language = detectSourceLanguage(resData.extractedText || parsedContent || "", resData.title || fileName, resData.language);
      resData.title = spellcheckAndRepairArabicAndEnglishText(resData.title || fileName || "");
      resData.summary = spellcheckAndRepairArabicAndEnglishText(resData.summary);

      if (resData.terms && Array.isArray(resData.terms)) {
        resData.terms = resData.terms
          .map((t: any) => {
            const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term, t.definition);
            if (!sanitized.isValid) return null;

            if (isTrivialOrCitationTerm(sanitized.term, t.definition)) return null;
            if (isTrivialOrCitationTerm(sanitized.verified_term, t.definition)) return null;

            const cleanDef = (t.definition &&
              !t.definition.includes('""') &&
              !t.definition.includes(':\s*""') &&
              !t.definition.includes("مفهوم تحليلي يُقصد به في النص: \"\"") &&
              t.definition.length > 25)
              ? spellcheckAndRepairArabicAndEnglishText(t.definition)
              : buildContextDefinition(sanitized.term, parsedContent || "", sanitized.verified_term);

            return {
              term: sanitized.term,
              transliteration: sanitized.verified_term,
              draft_term: sanitized.draft_term,
              verified_term: sanitized.verified_term,
              definition: cleanDef,
            };
          })
          .filter(Boolean);
      } else {
        resData.terms = [];
      }

      // Ensure every source gets 2 to 3 genuine scholarly terms by calling fallback extractor if needed
      if (resData.terms.length < 2) {
        const fallbacks = extractFallbackTermsFromText(parsedContent || "", "temp_id", resData.title || fileName || "", resData.terms);
        for (const fb of fallbacks) {
          if (resData.terms.length < 3) {
            resData.terms.push(fb);
          }
        }
      }

      return res.json(resData);
    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      if (isLargePdf && !parsedContent) {
        return res.status(400).json({
          error: "This PDF is too large to process. Try uploading a smaller file or paste the text content directly into the chat.",
          details: err.message || "PDF exceeds 4.5MB limit for direct processing."
        });
      }
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
      .replace(/^[\s.\-–—:؛"']+|[\s.\-–—:؛"']+$/g, "")
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

  // Fix common Arabic typos and grammar agreement issues
  let cleanedText = text
    .replace(/\bقراءة\s+نقدي\b/g, "قراءة نقدية")
    .replace(/\bمستقبيلة\b/g, "مستقبلية")
    .replace(/\bباعتماها\b/g, "باعتمادها")
    .replace(/\bصناع\s+القرا\s*\n\s*ر\b/g, "صناع القرار")
    .replace(/توصية\s+مستندة\s+إلى\s*[\(\[«]\s*[\s.\-–—:؛"'\(\)]*([^)\n]+?)[\s.\-–—:؛"'\(\)]*[\)\]»]\s*[:：]?/gi, 'توصية مستندة إلى "$1":')
    .replace(/توصية\s+مستندة\s+إلى\s*[-–—•*]?\s*\(\s*([^)]+)\s*\)\s*[:：]?/gi, 'توصية مستندة إلى "$1":');

  // Split inline merged bullets mid-paragraph (e.g. "...المستهدفة. - **تطوير معايير...")
  cleanedText = cleanedText.replace(/([.؛:!؟\u0600-\u06FFa-zA-Z])\s*[-–—•*]\s+(\*\*[\u0600-\u06FFa-zA-Z])/g, "$1.\n\n- $2");
  cleanedText = cleanedText.replace(/([.؛:!؟\u0600-\u06FFa-zA-Z])\s*[-–—•*]\s+([\u0600-\u06FFa-zA-Z]{3,}\s*[:：])/g, "$1.\n\n- $2");

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

const DALIL_SYSTEM_INSTRUCTION = `أنتَ "الدليل"، الصوت المرشد داخل نظام بحث OS (bahthOS)، رفيق بحث يعمل بالذكاء الاصطناعي وموجَّه أساسًا للناطقين بالعربية. اسمك يحمل معنيين مقصودين معًا: المرشد الذي يوجّه المسافر، والدليل الذي يسند الدعوى. يجب أن يكون كلا المعنيين صحيحين في كل ما تقوله.

أنتَ لستَ روبوت محادثة، ولستَ راويًا يمثّل حماسًا مصطنعًا. أنتَ الزميل الموثوق الذي قرأ فعلاً كل ما في المشروع، ويخبر الباحث الآن، بعبارات واضحة، بما يستحق انتباهه ولماذا — بأسلوب من يوجز لزميله قبل اجتماع، لا بأسلوب نص جاهز يُقرأ على حافلة سياحية.

قاعدتك التي لا يجوز خرقها: كل ادّعاء محدد تذكره يجب أن يكون قابلاً للتتبع إلى المحتوى الفعلي المرسل إليك — الملخصات والنصوص المستخرجة من المصادر، لا شيء غير ذلك. لا تخمّن، ولا تُجمّل، ولا تصطنع شعورًا باكتشاف لا يدعمه المحتوى. إن لم يتغيّر شيء جوهري، قل ذلك بوضوح واختصار — فالدليل الذي يختلق إثارة من لا شيء يفقد ثقة من يعتمد عليه في المرة العاشرة.

قواعد الصوت والتشكيل:
- اكتب بالعربية الفصحى بمستوى المتحدث المثقف في محاضرة أكاديمية شفوية — فصحى راقية، لا لهجة، ولا فصحى الكتب المدرسية، ولا تشكيل قرآني.
- شكّل الأفعال بالقدر اللازم لتوضيح الفاعل والصيغة (مثل: أُقدّم مقابل تُقدّم). اترك أواخر الأسماء غير مشكّلة في الغالب، كما يفعل المتحدث المثقف تلقائيًا في الكلام الطليق. لا تُشكّل كل كلمة — التشكيل الكامل يوحي بكتاب أطفال أو تلاوة، لا بزميل يتحدث.
- فكرة واحدة في كل جملة. حيث تستخدم الفصحى المكتوبة جملة معقدة طويلة، فقّطها إلى جملتين أو ثلاث قصيرة بدلاً منها.
- لا تُدرج مصطلحات أجنبية عارية بالإنجليزية أو الفرنسية. صف وظيفة المفهوم بعبارة عربية واضحة بدل تسميته بلغة أجنبية.
- ضع علامة \`||\` عند كل نقطة توقف طبيعية للتنفس. استخدم \`...||\` مستقلة مرة واحدة فقط في كامل النص، مباشرة قبل أهم ملاحظة، لخلق وقفة درامية مقصودة. لا تكررها.
- لا تستخدم أي تنسيق ماركداون إطلاقًا: لا عناوين بـ###، لا جداول، لا قوائم بنقاط، لا وسوم XML من نوع <evidence>. هذا النص سيُحوَّل مباشرة إلى كلام منطوق، وأي رمز كتابي غير \`||\` سيُقرأ بصوت عالٍ حرفيًا إن لم تتم إزالته، فتجنّبه تمامًا من الأساس.

انضباط الاستناد إلى الدليل:
- كل ادّعاء واقعي عن محتوى المصادر يجب أن يقابله شيء موجود فعلاً في المحتوى المرسل إليك. لا تستنتج مواقف أو أرقامًا أو نسبًا غير مذكورة صراحة.
- لا تختلق توترًا أو اتفاقًا أو فجوة لم يظهرها التحليل الفعلي للنص. إن لم تجد علاقة ذات معنى بين المصادر، لا تصطنع واحدة لأجل التأثير السردي.`;

const DALIL_UPDATE_TASK_INSTRUCTION = `مهمتك الآن مختلفة عن الإحاطة الأولى للمشروع. لا تُعرّف بالمشروع من جديد ولا تُرحّب بالمستخدم مجددًا — عبارة "أهلاً بك" مخصصة حصرًا لأول إحاطة يقدمها الدليل في المشروع، ولن تصلك أبدًا في هذا الفرع من العمل. مهمتك أن تخبر الباحث بما تغيّر فقط منذ آخر إحاطة، وباختصار شديد، وفقط إن كان التغيير يستحق فعلاً انتباهه.

ستصلك ثلاثة أقسام من المعلومات بالترتيب التالي:
١. نص آخر إحاطة قدّمها الدليل لهذا المشروع (إن وُجدت) — استخدمه فقط لتحديد ما تغيّر، لا لإعادة سرده أو تلخيصه من جديد بأي شكل.
٢. ملخصات موجزة للمصادر التي كانت موجودة في المشروع قبل هذه الإضافة.
٣. المحتوى الكامل للمصدر أو المصادر المضافة الآن حديثًا.

خطوة أولى — قيّم الأهمية الفعلية بنفسك، اعتمادًا فقط على المحتوى الخام المرسل إليك، قبل كتابة أي شيء:
- هل يُدخل المصدر الجديد توترًا أو تعارضًا حقيقيًا مع مصادر موجودة سابقًا، لم يكن ظاهرًا في آخر إحاطة؟
- هل يُعزّز المصدر الجديد نتيجة أو حجة موجودة سابقًا بقوة تستحق الذكر تحديدًا، لا مجرد تكرار عابر لها؟
- هل يفتح المصدر الجديد محورًا أو موضوعًا غائبًا كليًا عن المصادر السابقة؟
- بعد وزن هذه الاعتبارات الثلاثة مجتمعة: هل يستحق هذا التغيير أن يُقترَح على الباحث ترتيب عمل مختلف عمّا كان مناسبًا سابقًا؟

خطوة ثانية — تفرّع بحسب ما توصلت إليه فعلاً في الخطوة الأولى، لا بحسب افتراض مسبق:

الحالة أ — لا شيء مما سبق صحيح (لا تغيير جوهري):
اكتب فقط "إقرارًا موجزًا" من جملة واحدة إلى جملتين، لا أكثر. اذكر عدد المصادر المضافة (ولغتها إن كانت لافتة، كانضمام مصدر فرنسي إلى مشروع عربي-إنجليزي)، ثم أكّد بوضوح أن هذا لا يغيّر المسار الحالي للباحث — مع إشارة مختصرة، إن كانت صحيحة فعلاً، إلى أن المصدر الجديد يعزز نقطة محددة سبق ذكرها في آخر إحاطة. لا تُدرج أي اقتراح لترتيب عمل جديد، ولا وقفة \`...||\`، ولا خاتمة من أي نوع. هذا إشعار مختصر، لا إحاطة كاملة. يجب ألا يتجاوز ٤٠ كلمة إطلاقًا.

الحالة ب — تغيّر جوهري حقيقي، مدعوم بما وجدته فعلاً في الخطوة الأولى:
اكتب "إحاطة تحديث" بالبنية التالية، على ألا يتجاوز طولها الإجمالي ما بين ١٣٠ و١٦٠ كلمة تقريبًا:
١. أقرّ بالإضافة — عدد المصادر الجديدة، ولغتها إن كانت لافتة.
٢. سمِّ الجديد تحديدًا — ليس "معلومات جديدة" بصياغة عامة، بل الحجة أو الموقف أو المحور الفعلي الذي يطرحه المصدر الجديد، مستندًا حصرًا إلى محتواه المرسل إليك في القسم الثالث.
٣. بيت المحور — مسبوقًا بوقفة \`...||\` واحدة فقط في كامل النص — اذكر بدقة كيف يغيّر هذا الصورة التي رسمتها الإحاطة السابقة: توتر لم يكن موجودًا من قبل، أو تعزيز حقيقي لموقف كان أضعف، أو محور كان غائبًا كليًا.
٤. توجيه اختياري لترتيب العمل — أدرجه فقط إن استنتجتَ فعلاً في الخطوة الأولى أن ترتيب الأولوية تغيّر. سمِّ نوع العمل الذي يستحق الآن اهتمام الباحث أولًا (من بين: الأسئلة الشائعة، التوصيات والآثار، تقرير الفجوات، مصفوفة الأدلة والتعارضات، أو توليف ومقارنة عامة)، مع سبب ذلك في جملة واحدة موجزة. إن لم يتغيّر الترتيب فعليًا، لا تُدرج هذه الخطوة إطلاقًا بدل تكرارها بشكل شكلي لا معنى له.
٥. خاتمة قصيرة جدًا فقط عند الحاجة — لا داعٍ لتكرار أي إشارة إلى إمكانية توليف شامل بين كل المصادر في كل تحديث؛ تلك الإشارة مخصصة حصرًا للإحاطة الأولى للمشروع. استثنِ هذه القاعدة فقط إذا كان المصدر الجديد تحديدًا يفتح إمكانية توليف لم تكن قائمة فعليًا من قبل — وهذا نادر جدًا، فاستخدمه بحذر شديد ولا تلجأ إليه إلا حين يكون صحيحًا بوضوح تام.

قيود صارمة نهائية:
- لا تُعِد إطلاقًا بنية الإحاطة الأولى الكاملة (التعريف بالمشروع، الترحيب، عرض كل المصادر). هذا فرق (delta) عمّا سبق دائمًا، وليس إعادة تعريف بالمشروع من جديد بأي شكل.
- لا تقل "أهلاً بك" أو أي صيغة ترحيب مشابهة أبدًا في هذا الفرع من العمل.
- لا تدّعِ وجود تغيير جوهري إن لم يدعم تحليلك الفعلي لمحتوى المصدر الجديد ذلك بوضوح — عند الشك الحقيقي، استخدم الحالة أ افتراضيًا لا الحالة ب.
- أخرج نصًا عربيًا خامًا فقط، بعلامات \`||\` الفاصلة، وبلا أي رمز آخر. ممنوع تمامًا: عناوين، نجوم تنسيق، جداول، وسوم XML، تعليقات توضيحية قبل النص أو بعده، أو أي شرح لتفكيرك الداخلي. النص المنطوق فقط، بلا زيادة ولا نقصان.`;

app.post("/api/synthesize", async (req, res) => {
  try {
    const { sources: rawSourcesInput, topic, toolType } = req.body || {};
    const sources = Array.isArray(rawSourcesInput) ? rawSourcesInput : [];
    const activeSources = deduplicateSources(sources);
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
    }

    console.log("Starting synthesis for topic:", topic, "toolType:", toolType, "sources:", activeSources.length);

    const ai = getAiClient();

    if (toolType === "dalil-update") {
      const { newSourceIds, priorBriefingText } = req.body || {};
      const newIds = new Set(Array.isArray(newSourceIds) ? newSourceIds : []);
      let newSources = activeSources.filter((s: any) => newIds.has(s.id));
      if (newSources.length === 0) {
        newSources = activeSources;
      }

      const cleanTitles = activeSources
        .map((s: any) => (s?.title || "مستند").replace(/\.[a-z0-9]{2,4}$/i, "").trim())
        .join("، ");

      let sourcesContext = "المصادر المرفقة في المشروع للتحليل والإحاطة:\n";
      activeSources.forEach((src: any, idx: number) => {
        const cleanTitle = (src?.title || `مصدر ${idx + 1}`).replace(/\.[a-z0-9]{2,4}$/i, "").trim();
        const rawContent = src?.content || src?.summary || "";
        const safeContent = rawContent.length > 8000
          ? rawContent.substring(0, 8000) + "\n...[مختصر]"
          : rawContent;
        sourcesContext += `\n---\nمصدر ${idx + 1}: ${cleanTitle} (اللغة: ${src?.language || "العربية"})\nالملخص: ${src?.summary || "غير متاح"}\nالمحتوى التفصيلي:\n${safeContent}\n`;
      });

      const priorContext = priorBriefingText
        ? "نص الإحاطة السابقة:\n" + String(priorBriefingText).substring(0, 4000) + "\n"
        : "لا توجد إحاطة سابقة.\n";

      const dalilPrompt = `${DALIL_SYSTEM_INSTRUCTION}

أنتَ "الدليل" - الصوت المرشد والمحلل في نظام بحث OS.
مهمتك تقديم إحاطة ملخصة ومُباشرة وشاملة ومفيدة جداً للباحث حول المصادر المرفقة (${activeSources.length} مصادر).

قواعد صياغة الإحاطة:
1. اكتب بلغة عربية فصيحة، راقية، وواضحة بدون أي رموز ماركداون (لا عناوين بـ ###، لا أسهم، لا نجوم، لا قوائم).
2. استخدم علامة || فقط للفصل بين الجمل للتحكم بتلاوة الصوت والوقفات الشفوية.
3. قدّم إحاطة توليفية تشمل أهم الأفكار، المحاور الرئيسية، والتوجيه العملي لاستكمال التحليل.
4. حافظ على نبرة الصوت الموثوقة والمركزة.
5. حظر مطلق: لا تذكر إطلاقًا صيغ امتداد الملفات مثل (.pdf, .docx, .txt) أو أسماء الملفات التقنية الخام. قم بتعريب وترجمة أسماء المستندات إلى عناوين موضوعية راقية باللغة العربية.
6. اجعل الإحاطة غنية ومكثفة (تتكون من 3 فقرات متماسكة بطول إجمالي بين 200 و 350 كلمة) لتقديم رؤية علمية عميقة وسلسة التلاوة.

${priorContext}

${sourcesContext}
`;

      try {
        const response = await generateContentWithRetry(ai, {
          model: "gemini-3.6-flash",
          contents: dalilPrompt,
          config: { systemInstruction: DALIL_SYSTEM_INSTRUCTION, temperature: 0.4 },
        });

        if (response?.text && response.text.trim().length > 5) {
          return res.json({ text: response.text.trim(), isFallback: false, silent: false });
        }
      } catch (aiErr: any) {
        console.error("al-Dalil briefing generation failed:", aiErr);
      }

      // Clean local Arabic fallback briefing if AI fails
      const fallbackBriefing = `أهلاً بك في نظام بحث OS. || يتضمن مشروعك البحثي حالياً ${activeSources.length} من المصادر المرفقة الأساسية: ${cleanTitles}. || أظهر التحليل التوليفي الأولي وجود تقاطعات ومفاهيم بحثية هامة تجمع بين الأطر النظرية والتطبيقات الميدانية. || يمكنك استخدام أدوات محرر التوليف أدناه لاستخراج مصفوفة الأدلة والتفاضل بين المصادر، تقرير الفجوات البحثية، والتوصيات التنفيذية الموثقة.`;
      
      return res.json({ text: fallbackBriefing, isFallback: true, silent: false });
    }

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

    const systemInstruction = "أنت عالم ومحلل خبير في نظام \"بحث OS\" (Bahth OS).\n" +
"مهمتك إجراء تحليل توليفي وتوثيقي عميق ومقارن للمصادر المرفقة حول الموضوع المحدد.\n\n" +
"قواعد صياغة الجودة والنزاهة التحليلية الصارمة (STRICT QUALITY RULES):\n" +
"1. **اللغة العربية الفصحى الصافية والتوليف التام (PURE ARABIC SYNTHESIS)**:\n" +
"   - اكتب بلغة عربية فصيحة سليمة مع مراعاة قواعد المطابقة اللغوية الكاملة.\n" +
"   - يُحظر حظراً تاماً نقل ملخصات الإنجليزية أو الفرنسية بشكل حرفي أو مقتطع مبتور (مثل \"pays pa...\"). يجب ترجمة وتوليف كافة الأفكار والأدلة والمفاهيم الأجنبية إلى جمل عربية رصينة ومكتملة تماماً.\n" +
"   - عند ذكر عناوين الوثائق الأجنبية، ضع العنوان بين علامتي تنصيص مثل `\"Title\"` لتفادي انعكاس الأقواس والرموز.\n" +
"2. **منع التكرار اللفظي والأسلوب الميكانيكي القالبي منعاً قاطعاً (ZERO REPETITIVE BOILERPLATE & HUMAN DIVERSITY)**:\n" +
"   - يُحظر حظراً مطلقاً تكرار نفس القالب أو الجمل السطحية عبر الصفوف والفقرات مثل: (\"تفعيل التوصيات التنفيذية لمستند...\"، \"يركز مستند... على فحص...\"، \"غير أن الفجوة المنهجية تتمثل في...\").\n" +
"   - يجب تنويع التراكيب اللغوية وأساليب الافتتاح والربط لكل وثيقة بشكل بشري طبيعي ومتجدد.\n" +
"   - انقب في صلب النص والملخص الفعلي لكل وثيقة واستخرج الحجج والأدلة والأرقام والنتائج والتباينات الفريدة الخاصة بتلك الوثيقة حصراً دون استخدام أي قالب مسبق.\n" +
"3. **استخدام علامتي التنصيص للاقتباس المباشر وتضمين النقطتين الراسيتين بعد العناوين (QUOTES & HEADING COLONS)**:\n" +
"   - يجب إضافة نقطتين راسيتين `:` فوراً بعد كل عنوان أو عنوان فرعي (مثل: `### 1. الملخص التنفيذي للموقف التحليلي:`) لتمييز العنوان عن الشرح التوضيحي الذي يليه.\n" +
"   - عند الاقتباس الحرفي من النص المصدر، يجب استخدام علامتي التنصيص `\"...\"` دائماً ليتمكن القارئ من معرفة النص المقتبس بدقة.\n" +
"4. **التطوير والتعميق الشامل وتجنب الجمل القليلة المبتورة (DEEP SUBSTANTIVE AMPLIFICATION)**:\n" +
"   - يجب أن يتضمن كل عنوان شروحاً وتحليلات موسعة ومكتملة من 3 إلى 5 أسطر على الأقل تغطي الأسئلة الحاكمة (من، أين، لماذا، متى، لأي هدف، وما هي النتائج والتداعيات).\n" +
"5. **الفصل الكامل وإعطاء مساحة للقراءة (STRICT ITEM ISOLATION & PARAGRAPH BREAKS)**:\n" +
"   - يُحظر حظراً تاماً دمج التوصيات أو المحاور الفرعية أو الفجوات في فقرة واحدة متصلة.\n" +
"   - يجب وضع كل نقطة أو توصية أو محور فرعي في سطر مستقل يسبقه `- **عنوان المحور أو التوصية**:` وتفصله أسطر فارغة مزدوجة `\\n\\n`.\n" +
"6. **قواعد الجداول المعيارية (MARKDOWN TABLES)**:\n" +
"   - افصل نص \"توضيح النطاق:\" دائماً بسطرين فارغين قبل بداية سطر الجدول الأول.\n" +
"   - السطر الأول للجدول: `| الرقم | الوثيقة والمحور الرئيسي | الأدلة والنتائج المؤيدة | التحليل النقدي والتباين المنهجي |`.\n" +
"   - السطر الثاني للجدول: `| :--- | :--- | :--- | :--- |`.\n" +
"7. **توليد ودمج وسوم الأدلة الحية (MANDATORY EVIDENCE TAGS)**:\n" +
"   في نهاية كل قسم رئيسي، قم بتضمين وسم <evidence> بتنسيق XML يوثق الاقتباسات المباشرة من المصادر.";

    const topicName = topic || "مقارنة وتحليل شامل للمصادر";
    const scopeIntro = "توضيح النطاق: يعتمد هذا التقرير التوليفي والتحليل المتقدم على " + activeSources.length + " من مصادر البحث النشطة المتاحة لصلتها المباشرة بالموضوع المدروس.\n\n";

    let userPrompt = "";
    if (toolType === "matrix") {
      userPrompt = "صغ \"مصفوفة الأدلة والتعارضات والتحليل النقدي\" (Evidence & Contradiction Matrix) بشكل جدول ماركداون (Markdown Table) يتضمن 4 أعمدة فقط وبدون أي أسطر فارغة:\n" +
"1. **الرقم** (1، 2، 3...)\n" +
"2. **الوثيقة والمحور الرئيسي** (اسم الوثيقة بالعربية + القضية الجوهرية)\n" +
"3. **الأدلة والنتائج المؤيدة** (الأدلة الرقمية والمنهجية الموثقة من صلب النص دون أي تكرار قالبي)\n" +
"4. **التباين والتحليل النقدي** (أوجه الاختلاف والحدود المنهجية أو السياقية بصياغة تخصصية فريدة لكل وثيقة)\n\n" +
"ثم اتبع الجدول بتحليل توليفي ومقارن تفصيلي وأكاديمي متعمق بين المصادر حول الموضوع: \"" + topicName + "\"، يشرح أسباب التباين وتكامل الأدلة بفقرات مستفاضة تعكس مستوى الباحث المتخصص.\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "gap" || toolType === "gaps") {
      userPrompt = "صغ \"تقرير فجوات الأدلة والتحليل النقدي الأكاديمي\" (Evidence & Methodological Gaps Report) حول الموضوع: \"" + topicName + "\" بأسلوب باحث أكاديمي متمرس يقدم تحليلاً عميقاً وشاملاً خاوياً من الإجابات السطحية أو الجمل القالبية المكررة:\n\n" +
"### 1. الفجوات المعرفية والمنهجية المرصودة (المستوى النقدي والأكاديمي)\n" +
"اكتب لكل وثيقة فجوة منهجية ومعرفية مستقلة ومفصلة في **فقرتين تحليليتين كاملتين على الأقل**. يُحظر حظراً تاماً استخدام العبارات السطحية مثل 'تستعرض الدراسة...' أو 'حدود النطاق في...'. اشرح بدقة ما الذي عالجته الوثيقة فعلاً، وما الذي أغفلته على مستوى المتغيرات، العينات، النطاق الميداني، الأطر النظرية، أو المدى الزمني.\n\n" +
"### 2. الأسئلة البحثية الجوهرية المعلقة ومقترحات المستقبل\n" +
"اطرح لكل وثيقة سؤالاً بحثياً استراتيجياً ومحورياً فريداً ومباشراً (بدون صيغ مكررة مثل 'عند معالجة قضية...'). اتبع كل سؤال بشرح تحليلي موسع يبين أهمية الإجابة عن هذا السؤال للسياسات والأبحاث المستقبلية.\n\n" +
"### 3. الأجندة البحثية والمستندات الإضافية المطلوبة لسد الفجوات\n" +
"قدم لكل وثيقة مقترحاً منهجياً وعملياتياً ذا قيمة مضافة ساطعة (يشمل: تصميم دراسات تتبعية، جمع بيانات ميدانية أولية، بناء أطر تقييم مقارنة، أو الوصول إلى أرشيفات ووثائق مساندة).\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "briefing") {
      userPrompt = "صغ تقريراً موجزاً للسياسات والمحللين الاستراتيجيين (Executive Policy Briefing) يتضمن تحليلاً أفقياً وعمودياً عميقاً بأسلوب بشري غير ميكانيكي:\n\n" +
"### 1. الملخص التنفيذي للموقف التحليلي\n" +
"استعرض الملخص بفقرات متعمقة وموسعة توضح تقاطعات الأدلة والآثار الجيوسياسية والتنظيمية بين المصادر.\n\n" +
"### 2. التوصيات العملية الموجهة لصناع القرار\n" +
"ضع لكل وثيقة توصيات مخصصة تعكس مضمونها الفريد وتفاصيلها الميدانية بدون تكرار الجمل القالبية، مع ترك سطرين فارغين بين التوصيات.\n\n" +
"### 3. التداعيات والآثار الاستراتيجية بعيدة المدى\n" +
"صغ تحليلاً عميقاً يمتد لعدة نقاط فرعية مستقلة ومفصلة (الأثر على التخطيط المؤسسي والسياسات، تطوير الكفاءات وتوجيه العنصر البشري، إدارة المخاطر وتفادي الخسائر، واستدامة معايير الجودة)، واشرح كل نقطة باستفاضة وبأسلوب خبير استراتيجي.\n\n" +
"الموضوع: \"" + (topic || "الملخص التنفيذي والتوصيات") + "\"\n\n" +
scopeIntro + sourcesContext;
    } else if (toolType === "faq") {
      userPrompt = "صغ دليلاً للأسئلة الشائعة والأجوبة العلمية الموثقة (In-Depth Research FAQ Guide) بأسلوب خبير أكاديمي متمرس.\n\n" +
"شروط صارمة للعمق والفرادة (CRITICAL SCHOLARLY RULES):\n" +
"- يُحظر حظراً مطلقاً تقديم إجابات سطحية من جملة واحدة أو تكرار السؤال النمطي القالبي لأكثر من وثيقة واحدة.\n" +
"- اطرح لكل وثيقة سؤالاً تحليلياً جوهرياً وفريداً مشتقاً من صلب موضوعها وتخصصها المباشر.\n" +
"- اكتب تحت كل سؤال **إجابة مستفاضة ومفصلة من 3 فقرات متكاملة على الأقل** توضح الأدلة المباشرة، الأبعاد الميدانية والمفهومية، والمقتضيات العملية المترتبة على هذه الأدلة.\n" +
"- التنسيق: `### س1: [سؤال بحثي مخصص ومحدد للوثيقة 1]؟` متبوعاً بسطر فارغ ثم `**الإجابة العلمية الموثقة (ج):** [إجابة تحليلية مستفاضة ودقيقة]`.\n\n" +
"الموضوع: \"" + (topic || "دليل الأسئلة الشائعة") + "\"\n\n" +
scopeIntro + sourcesContext;
    } else {
      userPrompt = "صغ تقريراً تحليلياً وتوليفياً كاملاً ومفصلاً (Full Academic Synthesis Report) حول الموضوع: \"" + topicName + "\" يتضمن الأقسام التالية بفقرات عربية مسترسلة وغنية بالأدلة والاستنتاجات الباحثة:\n\n" +
"1. مقدمة وتوطين موضوع البحث والتحليل\n" +
"2. القراءة التحليلية المقارنة للمصادر المرفقة (معالجة تفصيلية فريدة لكل وثيقة دون اختزال)\n" +
"3. نقاط الاتفاق والتكامل المنهجي بين المصادر\n" +
"4. نقاط الاختلاف والتباين المنهجي (التعارض والتحليل السياقي)\n" +
"5. الخلاصة والاستنتاجات التوليفية والرؤية المستقبلية\n\n" +
scopeIntro + sourcesContext;
    }

    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.6-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.3,
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

// Endpoint to answer report follow-up questions grounded deeply in report context and sources
app.post("/api/report-followup", async (req, res) => {
  const { question, reportContext, reportTitle, sources, history } = req.body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return res.status(400).json({ error: "الرجاء توفير سؤال الاستفسار أو المتابعة." });
  }

  const activeSources = Array.isArray(sources) ? sources : [];

  try {
    const ai = getAiClient();

    let sourcesFormatted = "";
    if (activeSources.length > 0) {
      sourcesFormatted = activeSources.map((s, idx) => {
        const title = (s.title || `المستند ${idx + 1}`).replace(/\.[a-z0-9]+$/i, "");
        const summary = s.summary || s.content || "";
        return `[المصدر ${idx + 1}: ${title}]\nالملخص والبيانات: ${summary.substring(0, 3000)}`;
      }).join("\n\n");
    } else {
      sourcesFormatted = "لا توجد مستندات مصدرية منفصلة مرفقة سوى نص التقرير المتاح.";
    }

    let historyFormatted = "";
    if (Array.isArray(history) && history.length > 0) {
      historyFormatted = history.map((h) => `سؤال الباحث: ${h.question}\nإجابة النظام: ${h.answer}`).join("\n\n");
    }

    const systemInstruction = `أنت عالم ومحلل بحثي خبير في نظام "بحث OS" (Bahth OS).
مهمتك تقديم إجابة تخصصية عميقة وشفافة وواضحة جداً عن سؤال المتابعة والاستفسار الذي يطرحه الباحث حول التقرير والمصادر المرفقة.

قواعد حاسمة وإلزامية للإجابة (CRITICAL MANDATES):
1. **منع التكرار والإعادة العامة (STRICT NON-REPETITION)**:
   - يُحظر حظراً تاماً مجرد إعادة سرد قوائم التقرير العامة أو تكرار الملخصات السابقة من الدردشة.
   - الإجابة يجب أن تضيف قيمة علمية وبحثية جديدة ومباشرة للموضوع المطروح في سؤال الباحث.

2. **التفكيك والتحليل الميداني العميق للنقطة المحددة (DEEP POINT-SPECIFIC RESEARCH)**:
   - حدد بدقة المستند أو الفجوة أو التوصية أو المفهوم المحدد الذي يسأل عنه الباحث في استفساره.
   - قم بالتعمق في نصوص المصادر لاستخراج المعطيات والافتراضات الضمنية (Implicit & Underlying Factors)، المتغيرات الميدانية المؤثرة، والآليات التشغيلية التنفيذية (Operational Roadmap) الخاصة بـ **تلك النقطة المحددة بعينها**.
   - اشرح كيفية معالجة الفجوة أو تطبيق التوصية بالخطوات والأدلة المباشرة.

3. **الاعترف الصريح والواضح عند عدم توفر بيانات إضافية (EXPLICIT ACKNOWLEDGMENT)**:
   - إذا كان سؤال الباحث يتناول جزئية لا تتوفر لها أدلة أو تفاصيل ضمنية جديدة في المصادر المتاحة، صرّح بذلك فوراً وبكل أمانة علمية:
     "بناءً على الفحص التفصيلي لنصوص المصادر المتاحة، لا تتضمن الوثائق معلومات إضافية أو ضمنية حول [اسم المفهوم/النقطة] أبعد مما تم التصريح به، وتقتصر التغطية المباشرة على [موجز المذكور]."
   - يُحظر اختلاق معلومات (Hallucinations) أو تقديم حشو إنشائي غير مبرهن.

4. **الوضوح والنقاء اللغوي (Clear, Direct & Unambiguous)**:
   - صغ إجابتك بلغة عربية فصيحة، واضحة، ورصينة مع استخدام العناوين الفرعية الجليّة.
`;

    const userPrompt = `[عنوان التقرير الحالي]: ${reportTitle || "تقرير توليفي بحثي"}

[نص التقرير أو الجزء المحدد]:
${(reportContext || "").substring(0, 8000)}

[المصادر البحثية النشطة المتاحة]:
${sourcesFormatted}

${historyFormatted ? `[سجل الاستفسارات المباشرة السابقة حول هذا التقرير]:\n${historyFormatted}\n` : ""}

[سؤال المتابعة الحالي من الباحث]:
"${question}"

قدم إجابة موثقة ودقيقة وشاملة وغير غامضة تجيب عن هذا السؤال بناءً على التقرير والمصادر.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    if (response?.text && response.text.trim().length > 30) {
      const cleanAnswer = deduplicateReportText(normalizeArabicText(response.text.trim()));
      return res.json({
        answer: cleanAnswer,
        isFallback: false
      });
    }
  } catch (aiErr: any) {
    console.error("AI report follow-up call failed, using smart fallback:", aiErr);
  }

  // Fallback response generator if AI call fails or offline
  const fallbackAnswer = generateReportFollowUpFallback(question, reportContext || "", activeSources);
  return res.json({
    answer: deduplicateReportText(normalizeArabicText(fallbackAnswer)),
    isFallback: true
  });
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

    const prompt = "أنت خبير ومحلل مصطلحي رفيع (Senior Terminological Analyst) في نظام \"بحث OS\".\n" +
"مهمتك تحليل النص واستخراج قائمة دقيقة للغاية (من 2 إلى 3 مصطلحات فقط) للمفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة.\n\n" +
"طبق القواعد الصارمة التالية:\n" +
"1. الاقتصار على البناءات النظرية والمفاهيم المركبة:\n" +
"   استخرج فقط البناءات النظرية ذات العمق والأطر المنهجية المعتمدة التي تمتلك تعريفاً جوهرياً متعارفاً عليه (مثل: Human Competence, Soft Power, Path Dependence, Principal-Agent Problem, Process Tracing, Machine Learning).\n" +
"2. تجريد وحظر أدوات الربط والجسيمات الزائدة والأرقام:\n" +
"   استخرج الاسم المعرف السليم دائماً خاوياً من أي حروف زائدة ملتصقة (مثل: استخرج \"الكفاءة البشرية\" وليس \"كالكفاءة البشرية 2،\"). أحظر تماماً أرقام الصفحات والعلامات الملحقة.\n" +
"3. الحظر الصارم للكلمات العامة والهيكلية والجمل الشائعة (Linguistic & Generic Fragments):\n" +
"   يُمنع منعاً باتاً استخراج أي كلمات هيكلية عامة أو مصطلحات فضفاضة غير متخصصة (مثل: \"Theory\", \"The Theory\", \"Research Methodology\", \"Methodology\", \"Research\", \"The Study\", \"Results\", \"Literature Review\", \"Discussion\")، كما يُمنع استخراج أي عبارات وصفية عابرة وردت في النص (مثل: \"results show\", \"data collected\", \"future studies\").\n" +
"4. الجودة الصارمة للتعريب والتعريف الدقيق:\n" +
"   لكل مصطلح، يجب تقديم المصطلح العربي المعيار المعتمد والمكافئ بدقة في حقل verified_term (يُمنع ترك verified_term باللغة الإنجليزية).\n" +
"   صغ تعريفاً إجرائياً حقيقياً شارحاً لجوهره في جملة واحدة رصينة مفيدة، وتجنب العبارات القالبية الفارغة.\n" +
"5. منع التكرار مع المصطلحات السابقة في المشروع:\n" +
"   يُمنع منعاً باتاً استخراج أو تكرار أي مصطلح أو مفهوم موجود بالفعل في هذه القائمة:\n" +
"   " + existingTermsStr + "\n\n" +
"لكل مصطلح مستخرج، عبئ الحقول التالية بالترتيب الدقيق:\n" +
"1. term: المصطلح الأصلي بالإنجليزية.\n" +
"2. draft_term: المصطلح العربي المقترح أولياً.\n" +
"3. definition: تعريف مفاهيمي دقيق ونافع يشرح المفهوم وجوهره في جملة واحدة رصينة.\n" +
"4. verified_term: المصطلح العربي النهائي المدقق والمصوب بعد استبدال أي تعريب صوتي بمكافئ عربي فصيح وتجريده من الحروف الزائدة.\n\n" +
"النص المراد تحليله:\n" +
text.substring(0, 3500);

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
              description: "قائمة المصطلحات والمفاهيم المستخرجة والمصححة بالتحقق ثنائي الحقول.",
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
      .map((t: any) => {
        const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term, t.definition);
        if (!sanitized.isValid) return null;
        if (/^[a-zA-Z\s\-]+$/.test(sanitized.verified_term) && /^[a-zA-Z\s\-]+$/.test(sanitized.term)) return null;
        if (existingTerms && Array.isArray(existingTerms) && existingTerms.some((ex: any) =>
          areTermsEquivalent(ex.term || "", sanitized.term) ||
          areTermsEquivalent(ex.verified_term || ex.transliteration || "", sanitized.verified_term)
        )) {
          return null;
        }
        const cleanDef = (t.definition && !t.definition.includes("مفهوم تحليلي وإطار نظري") && t.definition.length > 25)
          ? spellcheckAndRepairArabicAndEnglishText(t.definition)
          : buildContextDefinition(sanitized.term, text || "", sanitized.verified_term);
        return {
          term: sanitized.term,
          draft_term: sanitized.draft_term,
          verified_term: sanitized.verified_term,
          transliteration: sanitized.verified_term,
          definition: cleanDef,
        };
      })
      .filter(Boolean)
      .slice(0, 3);

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
    const prompt = `أنت خبير في مراجعة وتدقيق المصطلحات والمفاهيم في نظام "بحث OS" المخصص لمساعدة المستخدمين والباحثين والمحللين.
لقد تم تزويدك بقائمة من المصطلحات المستخرجة مسبقاً. مهمتك هي تطبيق عملية التدقيق الشاملة وتصحيح أي قصور في الترجمة أو التعريفات:

1. تصحيح واستبدال التعريفات القالبية والتكرارية:
   إذا كان تعريف أي مصطلح يحتوي على عبارات قالبية فارغة من قبيل "مفهوم وأداة تحليلية وردت في السياق حول..." أو "مصطلح محوري تمت مناقشته..."، فيجب عليك فوراً إعادة صياغة التعريف واستبداله بتعريف موضوعي رصين ومكثف (من جملة إلى جملتين) يشرح الجوهر الدقيق لهذا المفهوم.
2. تصحيح واستبدال أسماء العلوم والتخصصات الكلية العامة:
   إذا وجد مصطلح عبارة عن مجرد اسم علم عام أو تخصص مجرد (مثل Computer Science, Marketing, Economics, History, Management)، فقم بتعريفه كمفهوم تحليلي أو إطار تخصصي مع تصحيح التعريف والاسم المعتمد.
3. مراجعة وتصحيح التعريب الصوتي (Domain-Independent Test):
   اقرأ المصطلح العربي المقترح بمفرده. إذا كان تعريباً صوتياً أو لفظياً (مثل: كونسورتيوم -> اتحاد أو ائتلاف، ليرنينغ موداليتي -> نمط التعلم)، اكتب التعريب العربي الفصيح والمكافئ الحقيقي للمصطلح في verified_term.

لكل مصطلح في القائمة أدناه، أعد تعبئة وتوليد الحقول التالية بدقة:
1. term: المصطلح الأصلي بالإنجليزية كما هو.
2. draft_term: المصطلح العربي المقترح حالياً.
3. definition: التعريف الشارح والجامع الصريح بعد إزالة العبارات القالبية الفارغة وتوفير شرح حقيقي ومكثف.
4. verified_term: المصطلح العربي النهائي السليم المعتمد.

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
                    description: "التعريف المفاهيمي الشامل للمصطلح باللغة العربية الفصحى.",
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
      .map((t: any) => {
        const sanitized = cleanAndSanitizeAcademicTerm(t.term, t.draft_term, t.verified_term, t.definition);
        if (!sanitized.isValid) return null;
        const cleanDef = (t.definition && !t.definition.includes("مفهوم تحليلي وإطار نظري") && t.definition.length > 25)
          ? spellcheckAndRepairArabicAndEnglishText(t.definition)
          : buildContextDefinition(sanitized.term, "", sanitized.verified_term);
        return {
          term: sanitized.term,
          draft_term: sanitized.draft_term,
          verified_term: sanitized.verified_term,
          transliteration: sanitized.verified_term,
          definition: cleanDef,
        };
      })
      .filter(Boolean);
    res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Glossary sweep backend failed:", error);
    res.json({ terms: [] });
  }
});

// Endpoint for high-quality Al-Dalil voice speech generation (Gemini TTS)
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "الرجاء تزويد النص المراد تحويله إلى صوت." });
    }

    // Clean text for speech synthesis
    const cleanText = text
      .replace(/\|\|/g, " ")
      .replace(/#[#\s]*/g, "")
      .replace(/[*`_~]/g, "")
      .replace(/\.[a-z0-9]{2,4}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const ai = getAiClient();

    // Primary attempt with gemini-3.1-flash-tts-preview
    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.1-flash-tts-preview",
        contents: `اقرأ النص التالي بنبرة صوت راقية، عربية فصيحة، معبرة، وواضحة جداً:\n\n${cleanText}`,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore",
              },
            },
          },
        },
      });

      const candidate = response?.candidates?.[0];
      const part = candidate?.content?.parts?.find((p: any) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return res.json({
          audio: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "audio/wav",
        });
      }
    } catch (primaryErr: any) {
      console.warn("Primary TTS model (gemini-3.1-flash-tts-preview) failed, trying fallback:", primaryErr?.message);
    }

    // Fallback attempt with gemini-3.6-flash with audio modality
    try {
      const fallbackResponse = await generateContentWithRetry(ai, {
        model: "gemini-3.6-flash",
        contents: `اقرأ النص التالي بلغة عربية فصيحة واضحة:\n\n${cleanText}`,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck",
              },
            },
          },
        },
      });

      const candidate = fallbackResponse?.candidates?.[0];
      const part = candidate?.content?.parts?.find((p: any) => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        return res.json({
          audio: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "audio/wav",
        });
      }
    } catch (fallbackErr: any) {
      console.error("Fallback TTS model failed:", fallbackErr?.message);
    }

    return res.status(500).json({ error: "تعذر توليد التسجيل الصوتي عبر الخادم." });
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    return res.status(500).json({ error: error?.message || "حدث خطأ غير متوقع في توليد الصوت." });
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
