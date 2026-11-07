import { Router } from "express";
import { Type } from "@google/genai";
import mammoth from "mammoth";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, sanitizeSourceSummary, normalizeArabicText, detectSourceLanguage, spellcheckAndRepairArabicAndEnglishText,
        sanitizeAndRepairTermsPipeline } from "../../utils/termExtractor.js";
import { getAiClient, generateContentWithRetry, DEFAULT_MODEL } from "../ai.js";
import { ensurePdfDomGlobals } from "../pdfDomGlobals.js";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { cacheKey, cacheGet, cacheSet } from "../cache.js";
import { ensureSummaryParagraphs } from "../../utils/summaryParagraphs.js";

const router = Router();

// Fallback summaries previously leaned entirely on the frozen 2-highlights
// internal builder in ensureArabicSummary (which renders exactly three lines).
// This helper builds a RICHER highlight string from the document itself and
// hands it to the frozen sanitizer, so the pipeline's validated behavior is
// unchanged while its input becomes a genuinely informative summary. Arabic
// documents only: the frozen sanitizer strips long Latin runs, so non-Arabic
// documents still get the (unchanged) frozen fallback rendering.
function buildRichFallbackSummary(content: string): string {
  const text = (content || "").trim();
  if (text.length < 80) return "";
  const cleanText = text.replace(/https?:\/\/\S+/g, " ");
  const paragraphs = cleanText
    .split(/\r?\n+/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter((p) => p.length >= 60 && /[\u0600-\u06FF]/.test(p));
  const picks: string[] = [];
  let usedChars = 0;
  for (const p of paragraphs) {
    const pick = p.length > 220 ? p.substring(0, 200) + "…" : p;
    picks.push(pick);
    usedChars += pick.length;
    if (picks.length >= 6 || usedChars >= 700) break;
  }
  if (picks.length === 0) return "";
  return `تتناوب فقرات المستند على هذه المحاور الأساسية: ${picks.join(" | ")}`;
}

router.post(["/api/extract-text", "/api/analyze-document"], requireAuth, rateLimit, async (req, res) => {
  try {
    const { content, base64, mimeType, fileName } = req.body || {};

    // Deterministic per-document cache: identical inputs return the identical
    // analysis without any AI call. Only successful analyses are stored, so a
    // transient failure never poisons the cache.
    // v2 salt: entries cached before the extractedText fix could carry a
    // model-echoed partial text; the salt makes pre-fix cache entries
    // unreachable (they expire after 60 days on their own).
    const analyzeCacheKey = cacheKey("analyze-document:v2", { content, base64, mimeType, fileName });
    const cachedAnalysis = await cacheGet<any>(analyzeCacheKey);
    if (cachedAnalysis) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedAnalysis);
    }

    const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                   fileName?.toLowerCase().endsWith(".docx") || 
                   mimeType === "application/msword" ||
                   fileName?.toLowerCase().endsWith(".doc");

    let parsedContent = content || "";
    let isLargePdf = false;

    // When the client could not extract a text layer (scanned PDFs / corrupted
    // Word files) it sends a structured "[مستند ...]" placeholder plus, for small
    // files, the raw base64. The placeholder still counts as content for Gemini,
    // but the branches below must also run so the server re-parses from base64.
    const isPlaceholderMarker = (text: string): boolean => /^\[مستند (PDF|Word):/.test(text);

    if (isPdf && base64) {
      const approxSize = Math.floor((base64.length * 3) / 4);
      if (approxSize > 4_500_000) {
        isLargePdf = true;
      }
    }

    // ----- WORD PARSING -----
    if ((!parsedContent || isPlaceholderMarker(parsedContent)) && isDocx && base64) {
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
    if ((!parsedContent || isPlaceholderMarker(parsedContent)) && isPdf && base64) {
      try {
        console.log(`📄 Parsing PDF: ${fileName || "document.pdf"}`);
        
        const buffer = Buffer.from(base64, "base64");
        console.log(`📄 PDF size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

        if (buffer.length > 4_500_000) {
          isLargePdf = true;
          console.warn(`⚠️ PDF exceeds 4.5MB – fallback to direct Gemini multimodal parsing`);
        }

        // pdf-parse bundles pdfjs-dist, which requires browser globals such as
        // DOMMatrix. The Vercel Node runtime lacks them, so polyfill first and
        // load the parser lazily to avoid a hard "DOMMatrix is not defined".
        ensurePdfDomGlobals();
        const { PDFParse } = await import("pdf-parse");

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
        parsedContent = ""; // ensure the Gemini multimodal path is used as fallback
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

    let defaultFallback: any = (() => {
      const localTitle = spellcheckAndRepairArabicAndEnglishText(fileName || "مستند مرفق");
      // Derive genuine local concepts WITHOUT any AI call so the user always gets
      // content-based terms even when the free Gemini quota is exhausted.
      const localTerms = extractFallbackTermsFromText(parsedContent || "", undefined, localTitle).map((t) => ({
        term: t.term,
        transliteration: t.transliteration,
        draft_term: t.draft_term,
        verified_term: t.verified_term,
        definition: t.definition,
      }));
      return {
        title: localTitle,
        language: detectSourceLanguage(parsedContent || "", fileName || ""),
        summary: ensureSummaryParagraphs(spellcheckAndRepairArabicAndEnglishText(sanitizeSourceSummary(buildRichFallbackSummary(parsedContent || ""), localTitle, parsedContent))),
        extractedText: parsedContent || "",
        terms: localTerms,
      };
    })();

    try {
      const ai = getAiClient();
      const promptText = "أنت خبير ومحلل مصطلحي وباحث تخصصي رفيع (Chief Terminologist & Research Fellow) في نظام \"بحث OS\".\n" +
  "نظام \"بحث OS\" هو منصة أبحاث وتوليف مستقلة ومحايدة تماماً، خالية من أي انحياز مسبق لمجال بعينه، ومصممة لخدمة المستخدمين والمستندات من جميع القطاعات والتخصصات الميدانية والأكاديمية والمهنية (سواء كان المجال: الصحافة والإعلام، إدارة الأعمال والتسويق، العلوم السياسية والسياسات العامة، النقد الأدبي والدراسات الأدبية، التدوين وصناعة المقالات والوسائط، البحث العلمي والأكاديمي، الإدارة العامة والعمل المؤسسي والتنفيذي، أو أي مجال آخر).\n\n" +
  "مهمتك الأساسية هي استخراج قائمة دقيقة ونقية جداً (من 4 إلى 6 مصطلحات) للمفاهيم النظرية المتخصصة (Theoretical Concepts) والأطر المنهجية والمصطلحات المفتاحية الأصيلة النابعة مباشرة من الحقل المعرفي والتخصصي الخاص بالمستند المرفق حصراً، وصياغة ملخص تحليلي متكامل وشامل للمستند باللغة العربية الفصحى.\n\n" +
  "طبق القواعد الحاسمة التالية:\n" +
  "1. الملخص (summary): يجب أن يكون ملخصاً تحليلياً تركيبياً شاملاً باللغة العربية الفصحى حصراً. لغة الإخراج العربية تعليمات صياغة فقط وليست موضوعاً للمستند؛ لا تذكر اللغة العربية أو أسلوبها أو أي مجال عام إلا إذا أثبته النص المصدر صراحة. يُحظر حظراً مطلقاً اقتباس نصوص خام أو جمل بالإنجليزية أو الفرنسية داخل الملخص، بل يجب صياغة الملخص بأسلوب عربي سلس يترجم ويشرح المضمون دون نقل أسطر أو اقتباسات من الأصل. يجب أن يتكون الملخص من ثلاث إلى أربع فقرات متصلة مكتملة المعنى (بما لا يقل عن 1200 حرف إجمالاً)، تُفصل بين الفقرات أسطرٌ فارغة، وتُغطي الفقرات مجتمعة محاور المستند كاملة: موضوعه ومنهجَه وأبرز نتائجه وعمق تحليله ودلالاته؛ فالملخص المختصر من سطرين إلى خمسة أو بفقرة واحدة لا يُعد ملخصاً شاملاً ولا يُقبل.\n" +
  "2. المصطلحات: استخراج 4 إلى 6 مفاهيم نظرية وأطر منهجية ومصطلحات مفتاحية أصيلة تعبر عن مضمون المستند وحقله المعرفي المباشر حصراً دون فرض أي مصطلحات من مجالات أخرى خارج نطاق المستند.\n" +
  "2ب. لكل مصطلح، عبئ حقل term دائمًا بالمكافئ الإنجليزي المعياري المتعارف عليه للمفهوم في الأدبيات التخصصية (بالإنجليزية مهما كان لغة المصدر الأصلية؛ فلا تترك term عربياً إذا كانت الوثيقة عربية). لمفهوم مثل «الوسائط المتعددة» اكتب \"Multimedia\"، ولـ«التعلم المرن» اكتب \"Flexible Learning\"، واستخدم دائمًا المكافئ الأصيل المقبول في الحقل المعرفي ذاته وليس ترجمة حرفية مبتكرة.\n" +
  "2ج. الحقيقة والقبول العلمي إلزاميان (AUTHENTICITY & SCHOLARLY ACCEPTANCE): لا تستخرج إلا مفهوماً حقيقياً راسخاً متداولاً في الأدبيات العلمية لمجاله وله تعريف علمي متعارف عليه في الوسط الأكاديمي. يجب أن تكون خانات definition هي التعريف العلمي المعتمد المتعارف عليه للمفهوم نفسه في الأدبيات، لا إعادة صياغة من سياق المستند ولا جملة منقولة من النص ولا صياغة تقول (في هذا المصدر) أو (يراد بـ). إذا لم تتيقن من وجود تعريف علمي متعارف عليه للمفهوم فاحذف المفهوم كاملاً ولا تُدرجه أبداً بتعريف مختلق.\n" +
  "3. يُحظر حظراً مطلقاً استخراج أسماء المؤلفين والباحثين والأعلام والشخصيات، أو عناوين المقالات والأوراق والكتب، أو العبارات المجزأة والمبتورة المكتفية بحروف جر أو أفعال ناقصة.\n" +
  "4. يجب تقديم تعريف تحليلي أكاديمي متكامل باللغة العربية الفصحى لكل مصطلح يوضح معناه وسياقه المباشر في حقل النص (لا يقل عن 25 حرفاً) دون استخدام اقتباسات فارغة.\n\n" +
  "النص:\n" + (parsedContent ? parsedContent.substring(0, 30000) : "");

      const contentsInput: any[] = [];
      if (parsedContent) {
        contentsInput.push(promptText);
      }
      // Cost guard: attach the raw file (base64) only when no text layer could
      // be parsed locally. When parsedContent exists, the file payload is a
      // redundant duplicate of the text and only multiplies input tokens.
      if (base64 && mimeType && !parsedContent) {
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
        model: DEFAULT_MODEL,
        contents: contentsInput,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "العنوان الرئيسي المفضل للمستند." },
              language: { type: Type.STRING, description: "كود اللغة الأصلي للمستند مثل ar أو en." },
              summary: { type: Type.STRING, description: "ملخص تحليلي شامل باللغة العربية الفصحى من ثلاث إلى أربع فقرات متصلة (1200 حرف على الأقل)، تُفصل الفقرات بأسطر فارغة." },
              extractedText: { type: Type.STRING, description: "النص المستخرج من المستند." },
              terms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING, description: "المكافئ الإنجليزي المعياري المتعارف عليه للمصطلح (دائمًا بالإنجليزية، حتى لو كان المصدر عربياً)." },
                    draft_term: { type: Type.STRING, description: "المصطلح العربي المقترح." },
                    definition: { type: Type.STRING, description: "التعريف العلمي المتعارف عليه للمفهوم في الأدبيات الأكاديمية، وليس صياغة من سياق المستند، ولا جملة منقولة من النص، ولا صياغة مثل (في هذا المصدر) أو (يراد بـ)." },
                    verified_term: { type: Type.STRING, description: "المصطلح العربي النهائي المدقق والمصحح بالكامل." }
                  },
                  required: ["term", "draft_term", "definition", "verified_term"]
                }
              }
            },
            required: ["title", "language", "summary", "terms"]
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

      // Depth floor: exactly one corrective retry (flash → flash, never an
      // escalation) when the AI answered but its summary is a shallow stub
      // below the 3-paragraph / 700-char floor.
      const summaryDepthOk = (t: string): boolean => {
        const text = String(t || "");
        if (text.replace(/\s+/g, "").length < 700) return false;
        const paras = text.split(/\n{2,}/).filter((p) => p.replace(/\s+/g, "").length >= 100);
        return paras.length >= 3;
      };
      if (resData.summary && !summaryDepthOk(resData.summary)) {
        console.warn("⚠️ Summary below 3-paragraph depth floor; one corrective retry.");
        const depthReminder =
          "\n\nتنبيه إلزامي إضافي: في الإجابة السابقة كان الملخص قصيراً جداً. أعد تقديم الإجابة كاملةً مع مراعاة أن يستحوذ الملخص على ثلاث إلى أربع فقرات متصلة، تُفصل بين الفقرات أسطرٌ فارغة، وفي كل فقرة جمل تامة مكتملة المعنى، وبمجموع لا يقل عن 1200 حرف يغطي محاور المستند كافة، مع بقاء القواعد السابقة معتبرة حرفياً.";
        try {
          const retryRes = await generateContentWithRetry(ai, {
            model: DEFAULT_MODEL,
            contents: [...contentsInput, depthReminder],
            config: {
              temperature: 0,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "العنوان الرئيسي المفضل للمستند." },
                  language: { type: Type.STRING, description: "كود اللغة الأصلي للمستند مثل ar أو en." },
                  summary: { type: Type.STRING, description: "ملخص تحليلي شامل باللغة العربية الفصحى من ثلاث إلى أربع فقرات متصلة (1200 حرف على الأقل)، تُفصل الفقرات بأسطر فارغة." },
                  extractedText: { type: Type.STRING, description: "النص المستخرج من المستند." },
                  terms: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        term: { type: Type.STRING, description: "المكافئ الإنجليزي المعياري المتعارف عليه للمصطلح (دائمًا بالإنجليزية، حتى لو كان المصدر عربياً)." },
                        draft_term: { type: Type.STRING, description: "المصطلح العربي المقترح." },
                        definition: { type: Type.STRING, description: "التعريف العلمي المتعارف عليه للمفهوم في الأدبيات الأكاديمية." },
                        verified_term: { type: Type.STRING, description: "المصطلح العربي النهائي المدقق والمصحح بالكامل." }
                      },
                      required: ["term", "draft_term", "definition", "verified_term"]
                    }
                  }
                },
                required: ["title", "language", "summary", "terms"]
              }
            }
          }, res);
          if (retryRes?.text) {
            try {
              const retryData = JSON.parse(retryRes.text);
              if (retryData?.summary && summaryDepthOk(retryData.summary)) {
                resData = { ...resData, ...retryData };
              }
            } catch (retryParseErr) {
              console.warn("Depth-retry JSON parse failed; keeping the first response.");
            }
          }
        } catch (retryErr: any) {
          console.warn("Depth-retry failed; keeping the first response:", retryErr?.message || retryErr);
        }
      }

      // extractedText is server-authoritative. The model's retransmission of
      // the source text is inherently partial (observed as 44-250-word echoes
      // of full articles), so the stored source text must come from the
      // server's own parse. The model echo survives ONLY in the Gemini
      // multimodal rescue path, where the server had no parseable text layer
      // of its own (parsedContent empty). The mostly-"?" guard still applies
      // to that echo.
      {
        const meaningful = (resData.extractedText || "").replace(/\s+/g, "");
        const echoIsQuestionMarks = meaningful.length >= 20 && (meaningful.match(/\?/g) || []).length / meaningful.length >= 0.3;
        const serverParse = (parsedContent || "").trim();
        const serverParseMeaningful = serverParse.length >= 20 && !/^\[مستند (PDF|Word):/.test(serverParse);
        if (serverParseMeaningful) {
          resData.extractedText = parsedContent;
        } else if (echoIsQuestionMarks) {
          console.warn("AI returned placeholder extractedText (mostly '?') and no server parse is available.");
          resData.extractedText = "";
        }
      }

      if (resData.summary) {
        resData.summary = sanitizeSourceSummary(resData.summary, resData.title || fileName, parsedContent);
      } else {
        resData.summary = sanitizeSourceSummary("", resData.title || fileName, parsedContent);
      }

      // Detect true source language (ar/en/fr) and repair spellings
      resData.language = detectSourceLanguage(resData.extractedText || parsedContent || "", resData.title || fileName, resData.language);
      resData.title = spellcheckAndRepairArabicAndEnglishText(resData.title || fileName || "");
      resData.summary = spellcheckAndRepairArabicAndEnglishText(resData.summary);
      resData.summary = ensureSummaryParagraphs(resData.summary);

      if (resData.terms && Array.isArray(resData.terms)) {
        resData.terms = sanitizeAndRepairTermsPipeline(resData.terms, parsedContent || "", resData.title || fileName || "", 2);
      } else {
        resData.terms = [];
      }

      // Quality floor: if the pipeline kept fewer than 2 terms, top up from the
      // frozen local extractor so a thin AI response never reaches the client
      // with effectively no concepts (previously surfaced as the 2-term floor bug).
      if (resData.terms.length < 2) {
        const topUp = extractFallbackTermsFromText(parsedContent || "", undefined, resData.title || fileName || "");
        const existing = new Set(resData.terms.map((t: any) => `${t.term || ""}|${t.verified_term || t.draft_term || ""}`));
        for (const t of topUp) {
          const key = `${t.term || ""}|${t.verified_term || t.transliteration || t.draft_term || ""}`;
          if (existing.has(key)) continue;
          resData.terms.push({
            term: t.term,
            transliteration: t.transliteration,
            draft_term: t.draft_term,
            verified_term: t.verified_term,
            definition: t.definition,
          });
          if (resData.terms.length >= 2) break;
        }
      }

      await cacheSet(analyzeCacheKey, resData);
      res.setHeader("X-Cache", "MISS");
      return res.json(resData);
    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      if (isLargePdf && !parsedContent) {
        return res.status(400).json({
          error: "This PDF is too large to process. Try uploading a smaller file or paste the text content directly into the chat.",
          details: err.message || "PDF exceeds 4.5MB limit for direct processing."
        });
      }
      const errStr = (err?.message || "").toLowerCase();
      const quotaHit = errStr.includes("quota") || errStr.includes("limit") || errStr.includes("429") || errStr.includes("exhausted") || errStr.includes("rate");
      return res.json({
        ...defaultFallback,
        fallback: true,
        // Inform the app that the AI quota was reached so the UI can show a clear message.
        quotaLimitReached: quotaHit,
      });
    }
  } catch (err: any) {
    console.error("Extract handler error:", err);
    return res.status(500).json({ error: "Failed to extract text from document." });
  }
});

export default router;
