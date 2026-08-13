import { Router } from "express";
import { Type } from "@google/genai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extractFallbackTermsFromText, isTrivialOrCitationTerm, ensureArabicSummary, normalizeArabicText, cleanAndSanitizeAcademicTerm, detectSourceLanguage, spellcheckAndRepairArabicAndEnglishText, buildContextDefinition } from "../../utils/termExtractor";
import { getAiClient, generateContentWithRetry } from "../ai";

const router = Router();

router.post(["/api/extract-text", "/api/analyze-document"], async (req, res) => {
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

export default router;
