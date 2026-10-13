import { Router } from "express";
import { getAiClient, generateContentWithRetry, DEFAULT_MODEL } from "../ai.js";
import { normalizeArabicText, sanitizeSourceSummary } from "../../utils/termExtractor.js";
import { generateClientSynthesisFallback, injectEvidenceMatrixIntoReport } from "../../utils/synthesisFallback.js";
import { deduplicateSources, deduplicateReportText } from "../sourceUtils.js";
import { DALIL_SYSTEM_INSTRUCTION } from "../prompts.js";
import { requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { cacheKey, cacheGet, cacheSet } from "../cache.js";

const router = Router();

function isArabicFirstText(text: string): boolean {
  const arabicLetters = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinLetters = (text.match(/[A-Za-z]/g) || []).length;
  // Tolerate translated quotes and foreign proper nouns embedded in an otherwise
  // Arabic report; the threshold only needs to prove the output is predominantly Arabic.
  return arabicLetters >= 180 && latinLetters <= Math.max(140, Math.floor(arabicLetters * 0.18));
}

function shortReference(title: unknown, index: number): string {
  const raw = String(title || "").replace(/\.[a-z0-9]{2,4}$/i, "").trim();
  const arabicWords = raw.match(/[\u0600-\u06FF]+/g) || [];
  return arabicWords.length >= 2 ? arabicWords.slice(0, 6).join(" ") : `الوثيقة ${index + 1}`;
}

function sanitizeArabicReportText(text: string): string {
  const cleaned = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/\b[^\s]+\.(?:pdf|docx?|txt)\b/gi, "الوثيقة")
    .replace(/["“][A-Za-z][^"”]{2,120}["”]/g, "«الوثيقة»")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If the text ends abruptly without terminal punctuation (., !, ؟), trim back to the last complete sentence
  if (cleaned.length > 0 && !/[.!؟؛]$/.test(cleaned)) {
    const lastPunctuation = Math.max(
      cleaned.lastIndexOf('.'),
      cleaned.lastIndexOf('!'),
      cleaned.lastIndexOf('؟'),
      cleaned.lastIndexOf('؛')
    );
    if (lastPunctuation > 200) {
      return cleaned.substring(0, lastPunctuation + 1).trim();
    }
  }
  return cleaned;
}

function arabicEvidence(source: any, limit: number): string {
  const raw = String(source?.content || source?.extractedText || source?.summary || "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = raw
    .split(/(?<=[.!؟؛。])\s+/)
    .filter((sentence) => /[\u0600-\u06FF]/.test(sentence) && sentence.length > 25);
  return sentences.slice(0, 3).join(" ").slice(0, limit);
}

function isSubstantiveDalilText(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter((part) => part.length >= 80);
  const arabicLetters = (clean.match(/[\u0600-\u06FF]/g) || []).length;
  const latinLetters = (clean.match(/[A-Za-z]/g) || []).length;

  // This is a safety check, not a second writing contract. Do not discard a
  // source-grounded response merely because the model used fewer paragraphs,
  // a translated title, or a short foreign proper name. The prompt remains the
  // source of the frozen depth and Arabic-writing requirements.
  return clean.length >= 900 && paragraphs.length >= 4 && arabicLetters >= 180
    && latinLetters <= Math.max(180, Math.floor(arabicLetters * 0.25));
}

function buildDalilFallback(activeSources: any[]): string {
  const sources = Array.isArray(activeSources) ? activeSources : [];
  const title = (source: any, index: number) => shortReference(source?.title, index);
  const paragraphs: string[] = [];

  paragraphs.push(
    `تجمع هذه القراءة ${sources.length} من المصادر النشطة في المشروع الحالي، وتستخرج من كل وثيقة أدلتها المباشرة ورقمها الأساسي، ثم تربطها في رؤية مقارنة متكاملة بدلاً من سرد منفصل.`
  );

  sources.slice(0, 6).forEach((source, index) => {
    const reference = title(source, index);
    const summary = String(source?.summary || "").trim();
    const evidence = arabicEvidence(source, 500);
    const numbers = (String(source?.content || "").match(/\d[\d,.]*%?/g) || []).slice(0, 4).join("، ");

    let paragraph = `تعرض «${reference}» محوراً مستقلاً يمكن إثباته من نصها المتاح`;
    if (summary) {
      paragraph += `؛ فالملخص المحفوظ لها يقول: ${summary.slice(0, 420)}`;
    }
    if (evidence) {
      paragraph += ` ومن أقوى أدلتها المباشرة ما نصه: «${evidence}».`;
    } else if (numbers) {
      paragraph += `، وقد حفظت في أصلها الأجنبي معطيات رقمية قابلة للتحقق منها: ${numbers}.`;
    } else {
      paragraph += `، غير أن النص المتاح لا يتضمن مقطعاً عربياً كافياً للاقتباس المباشر، ويُستحسن إعادة رفع الوثيقة بنسخة نصية كاملة.`;
    }
    paragraphs.push(paragraph);
  });

  paragraphs.push(
    `وعند تقاطع هذه الوثائق يتضح أن كلاً منها يغطي جانباً من الموضوع يكمل نقص الآخر، إذ تغطي بعضها الإطار النظري وأخرى المعطيات الميدانية والأرقام، وهو ما يجعل التوليف في نقاط الاتفاق والاختلاف أقوى من أي قراءة منفردة لوثيقة واحدة.`
  );
  paragraphs.push(
    `ويبقى الحكم المقارن النهائي معلقاً على مواضع لا يفصل فيها النص المتاح، مثل تفاصيل العينة والمنهج والمدى الزمني، وهي مواضع يوصى بتلبيتها بأدلة إضافية عند تحديث الإحاطة، مع الإبقاء على كل استنتاج مرتبطاً باقتباسه الوارد أعلاه.`
  );

  return paragraphs.join("\n\n");
}

function groundedTextFor(activeSources: any[], topic: string, toolType: string): string {
  if (toolType === "dalil-update") {
    return buildDalilFallback(activeSources);
  }
  return generateClientSynthesisFallback(
    activeSources,
    topic || "تحليل ومقارنة شاملة للمصادر",
    (toolType as any) || "general"
  );
}

// Terminal responder for every synthesis path. It is intentionally synchronous
// and dependency-free so it can never throw or hang: whatever the model did, the
// client receives a real, source-grounded Arabic response with HTTP 200.
function sendGrounded(res: any, activeSources: any[], topic: string, toolType: string) {
  let raw = "";
  try {
    raw = groundedTextFor(activeSources, topic, toolType) || "";
  } catch (builderErr) {
    console.error("grounded synthesis builder failed:", builderErr);
    raw = "";
  }
  if (!raw.trim()) {
    raw = Array.isArray(activeSources) && activeSources.length > 0
      ? buildDalilFallback(activeSources)
      : "لا تتوفر مصادر كافية لإنتاج إحاطة في هذه اللحظة.";
  }
  let text = raw;
  try {
    text = sanitizeArabicReportText(deduplicateReportText(normalizeArabicText(raw)));
  } catch (normErr) {
    console.error("grounded synthesis normalization failed:", normErr);
    text = raw;
  }
  if (!text.trim()) {
    text = raw;
  }
  return res.json({ text, isFallback: true, silent: false });
}

router.post("/api/synthesize", requireAuth, rateLimit, async (req, res) => {
  let activeSources: any[] = [];
  let topic = "";
  let toolType = "";
  try {
    const { sources: rawSourcesInput, topic: bodyTopic, toolType: bodyToolType } = req.body || {};
    topic = bodyTopic;
    toolType = bodyToolType;
    const sources = Array.isArray(rawSourcesInput) ? rawSourcesInput : [];
    activeSources = deduplicateSources(sources).map((source: any) => ({
      ...source,
      summary: sanitizeSourceSummary(source?.summary, source?.title, source?.content),
    }));
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
    }

    const synthesizeCacheKey = cacheKey("synthesize", req.body || {});
    const cachedSynthesis = await cacheGet<any>(synthesizeCacheKey);
    if (cachedSynthesis) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cachedSynthesis);
    }

    console.log("Starting synthesis for topic:", topic, "toolType:", toolType, "sources:", activeSources.length);

    const ai = getAiClient();

    // Hard self-imposed deadline below Vercel's 60s function cap: a slow or hung
    // model call aborts into the deterministic, source-grounded fallback instead
    // of being killed by the gateway, so this endpoint always returns a response.
    const deadlineAt = Date.now() + 48_000;
    const aiAbortSignal = AbortSignal.timeout(48_000);
    const withDeadline = (config: any) => ({ ...(config || {}), abortSignal: aiAbortSignal });

    if (toolType === "dalil-update") {
      const { newSourceIds } = req.body || {};
      const newIds = new Set(Array.isArray(newSourceIds) ? newSourceIds : []);
      let newSources = activeSources.filter((s: any) => newIds.has(s.id));
      if (newSources.length === 0) {
        newSources = activeSources;
      }

      let sourcesContext = "المصادر المرفقة في المشروع للتحليل والإحاطة:\n";
      activeSources.forEach((src: any, idx: number) => {
        const reference = shortReference(src?.title, idx);
        const rawContent = String(src?.content || src?.summary || "").trim();
        const safeContent = rawContent.length > 20000
          ? rawContent.substring(0, 20000) + "\n...[اختصار تقني للنص، لا تستنتج من الجزء المحذوف]"
          : rawContent;
        sourcesContext += `\n---\nالمرجع المختصر: «${reference}»\nرقم الوثيقة: الوثيقة ${idx + 1}\nلغة النص الأصلي: ${src?.language || "غير محددة"}\nالملخص الحالي:\n${String(src?.summary || "غير متاح").slice(0, 1200)}\nالنص المتاح للتحليل:\n${safeContent}\n`;
      });

      // Deliberately exclude any previous briefing from the prompt. A briefing
      // belongs to an earlier source snapshot and can contaminate a new project.
      const priorContext = "لا توجد إحاطة سابقة؛ يُحظر الاعتماد على أي محتوى سابق.\n";

      // DALIL_SYSTEM_INSTRUCTION is supplied through config.systemInstruction
      // below; do not duplicate the full contract inside the user payload.
      const dalilPrompt = `أنتَ "الدليل" - المحلل الأكاديمي الصارم في نظام بحث OS.
مهمتك هي إجراء تحليل موضوعي وتوليف نقدي عميق لمحتوى المصادر المرفقة.

حظر قاطع لخطاب "المنهج" (META-DISCOURSE PROHIBITION):
يُحظر تماماً كتابة جمل تشرح "كيف" ستقوم بالتحليل أو "ماذا" تتناول الإحاطة (مثل: "تتناول هذه الإحاطة..."، "تركز المقارنة على..."، "من الناحية المنهجية..."، "تكشف المقارنة الأولية...").
ابدأ فوراً في صلب الموضوع والنتائج المستخلصة من المصادر. لا تتحدث عن "المصادر" ككيانات تقنية، بل تحدث عن "الأدلة" و"الأطروحات" و"النتائج" الواردة فيها.

قواعد الصياغة والعمق (STRICT CONTENT RULES):
1. التحليل المباشر (Direct Analysis): ابدأ الفقرة الأولى بتقرير حقيقة أو استنتاج مركزي يجمع الوثائق.
2. الوضوح اللغوي: اكتب بعربية فصحى واضحة، واستخدم التشكيل عند الحاجة فقط؛ لا تجعل التشكيل بديلاً عن ذكر الوقائع والأدلة.
3. بنية الفقرات: افصل بين كل فقرة وأخرى بسطر فارغ واضح حتى تبقى المقارنة قابلة للقراءة والتتبع.
4. التوليف المقارن (6-8 فقرات): يجب أن تكون كل فقرة غنية بالمعلومات، وأن تتضمن تفصيلاً قابلاً للتحقق من النص المتاح، مثل رقماً أو فاعلاً أو آلية أو تاريخاً أو نتيجة محددة.
5. حظر التكرار والفراغ: لا تستخدم عبارات عامة مثل «تتسم القضية بالتعقيد» أو «تحتاج إلى مزيد من البحث» إلا إذا شرحت تحديداً أي نتيجة أو فقرة من النص تبررها. لا تكتب جملة لا تضيف واقعة أو مقارنة أو قيداً أو استنتاجاً محدداً.
6. التوثيق الداخلي: أشر في كل فقرة إلى «الوثيقة الأولى» أو «الوثيقة الثانية» أو عنوان عربي قصير، واربط كل ادعاء مهم بعبارة أو رقم أو نتيجة واردة في النص المتاح.
7. العربية الخالصة: اكتب الجمل العربية وحدها. ترجم كل فكرة أو اقتباس أجنبي إلى العربية الفصحى، ولا تنقل أي جملة إنجليزية أو فرنسية أو مقتطفاً مبتوراً. إذا لزم ذكر مصدر، استخدم «الوثيقة الأولى» أو عنواناً عربياً موجزاً لا يتجاوز ست كلمات.
8. الحظر التقني: لا تذكر أسماء الملفات أو الامتدادات أو الروابط. استخدم الإحالات العربية القصيرة فقط.
9. الفواصل الصوتية: استخدم علامة || فقط للفواصل الصوتية بين الجمل الكبيرة، ولا تستخدم الماركداون (Markdown).
10. الطول والعمق واستكمال الجمل: اكتب سبع فقرات تقريباً، ولا يقل النص عن 1400 حرف. يُحظر تماماً قطع الجمل أو ترك أي فقرة غير مكتملة؛ يجب أن تنتهي كل جملة بنقطة واضحة ومكتملة المعنى.

الهدف هو تقديم قيمة مضافة للباحث تجعله يفهم "جوهر" ما تقوله الوثائق مجتمعة، وليس مجرد وصف لوجودها.

${priorContext}

${sourcesContext}
`;

      // Layer 1-3: best-effort model synthesis. Any failure here is caught and
      // degrades to the deterministic, source-grounded briefing below — this
      // path never returns an error to the client.
      const generateDalil = async (contents: string): Promise<string> => {
        try {
          const response = await generateContentWithRetry(
            ai,
            {
              model: "gemini-3.1-pro-preview",
              contents,
              config: withDeadline({
                systemInstruction: DALIL_SYSTEM_INSTRUCTION,
                temperature: 0.3,
                maxOutputTokens: 4096,
              }),
            },
            res,
            deadlineAt
          );
          return typeof response?.text === "string" ? response.text.trim() : "";
        } catch (aiErr: any) {
          console.error("al-Dalil briefing generation attempt failed:", aiErr?.message || aiErr);
          return "";
        }
      };

      const looksMeta = (text: string) =>
        /تتناول هذه الإحاطة|تركز المقارنة|من الناحية المنهجية|تكشف المقارنة الأولية|تُقرأ هذه المجموعة|يقتصر هذا الوصف|الموضوع التخصصي لمستند/i.test(text);
      const acceptable = (text: string) =>
        isSubstantiveDalilText(text) ||
        (isArabicFirstText(text) && text.trim().length >= 700 && !looksMeta(text));

      let bestText = await generateDalil(dalilPrompt);
      if (!acceptable(bestText)) {
        const repairInstruction =
          "أعد الآن صياغة الإحاطة كاملة بالعربية الفصحى حصراً من جديد: ابدأ مباشرة في صلب النتائج والأدلة الواردة في النصوص المتاحة دون أي خطاب منهجي، ووسّع كل فقرة بأدلة قابلة للتحقق (رقم أو فاعل أو آلية أو تاريخ)، واجعل النص سبع فقرات تقريباً بما لا يقل عن 1400 حرف، دون نقل أي جملة أجنبية.";
        const repaired = await generateDalil(dalilPrompt + "\n\n" + repairInstruction);
        if (acceptable(repaired)) {
          bestText = repaired;
        } else if (isArabicFirstText(repaired) && repaired.trim().length > bestText.trim().length) {
          bestText = repaired;
        }
      }

      if (isArabicFirstText(bestText) && bestText.trim().length > 5 && !looksMeta(bestText)) {
        const dalilPayload = { text: sanitizeArabicReportText(bestText), isFallback: false, silent: false };
        try {
          await cacheSet(synthesizeCacheKey, dalilPayload);
        } catch (cacheErr) {
          console.warn("al-Dalil cache write skipped:", cacheErr);
        }
        res.setHeader("X-Cache", "MISS");
        return res.json(dalilPayload);
      }

      console.warn("Al-Dalil model output unusable; returning the deterministic source-grounded briefing.");
      return sendGrounded(res, activeSources, topic, "dalil-update");
    }

    let sourcesContext = "المصادر المتاحة للتحليل والتوليف:\n";
    activeSources.forEach((src: any, idx: number) => {
      const docNum = idx + 1;
      const title = src?.title || ("الوثيقة " + docNum);
      const rawContent = src?.content || src?.summary || src?.extractedText || "";
      const safeContent = rawContent.length > 80000 
        ? rawContent.substring(0, 80000) + "\n...[تم اختصار بقية النص لتفادي تجاوز الحد الأقصى للمدخلات]" 
        : rawContent;

      sourcesContext += "\n---\n";
      sourcesContext += "اسم الوثيقة: الوثيقة " + docNum + ": " + title + "\n";
      sourcesContext += "لغة النص الأصلي للوثيقة: " + (src?.language || "غير محددة") + "\n";
      sourcesContext += "الملخص الفعلي للوثيقة: " + (src?.summary || "غير متاح") + "\n";
      sourcesContext += "المحتوى التفصيلي المتاح للوثيقة (اقرأه كاملاً مهما كانت لغته، وحَوِّل مضمونه إلى تحليل عربي):\n" + safeContent + "\n";
    });

    const systemInstruction = "أنت عالم ومحلل خبير في نظام \"بحث OS\" (BahthOS).\n" +
"مهمتك إجراء تحليل توليفي وتوثيقي عميق ومقارن للمصادر المرفقة حول الموضوع المحدد.\n\n" +
"**معالجة المصادر متعددة اللغات (MULTILINGUAL SOURCE HANDLING - إلزامي)**:\n" +
"   - قد تكون الوثائق المرفقة مكتوبة بالعربية أو الإنجليزية أو الفرنسية أو أي لغة أخرى أو مزيج منها. اقرأ النص الأجنبي كاملاً دون استثناء، واستخرج حججه المركزية وأعداده ونتائجه ومناهجه وآلياته وتبايناته، ثم صغ التقرير النهائي بالعربية الفصحى الغنية.\n" +
"   - غياب النص العربي في المصدر لا يبرر رفض التحليل، ولا تقليل العمق، ولا القول إن الأدلة غير متاحة؛ فالنص الأجنبي مطالب بأن يكون أساس التحليل وقابلية الإسناد بذاته. ترجم كل اقتباس أو مقتطف أجنبي بطلاقة إلى العربية، وأضف دائماً [ترجمة عربية للنص الأصلي] عند الاقتباس الحرفي.\n" +
"   - لا تعرّف الأرقام والنسب والسنوات الواردة في الوثائق الأجنبية أبداً بلغة المصدر النهائية؛ اجعلها أساس أدلة بالعربية، مع ربط كل رقم بوثيقته المحددة.\n\n" +
"قواعد صياغة الجودة والتنسيق الصارمة (STRICT QUALITY & FORMATTING RULES):\n" +
"0. **قواعد التنسيق والتوثيق المتقدمة (TABLES & CITATIONS & TRANSLATION)**:\n" +
"   - **تنظيم الجداول**: يُحظر تماماً ترك أي صفوف فارغة أو خلايا ناقصة في الجداول المعيارية؛ يجب ملء جميع الأعمدة بدقة، وفي حال عدم توفر معلومة يُكتب `-` أو `غير متوفر`.\n" +
"   - **التوثيق المبسط**: استبدل الأسماء الببليوجرافية الطويلة أو الملفات الخام بعلامات توثيق مختصرة ونظيفة تعتمد على عنوان الوثيقة بالعربية بين قوسين (مثل [عنوان الوثيقة المختصر]) لتسهيل القراءة واستمرار تدفقها.\n" +
"   - **ترجمة الاقتباسات الأجنبية**: عند إدراج اقتباسات أو مفاهيم أجنبية، قم بترجمتها بطلاقة إلى اللغة العربية الفصحى وأضف دائماً ملاحظة صريحة بأنها مترجمة (مثل: [ترجمة عربية للنص الأصلي]) للحفاظ على الأمانة العلمية.\n" +
"   - **عزل المشروع**: لا تذكر اللغة العربية أو التربية أو أي مجال أو مشروع سابق لمجرد أن لغة الإخراج عربية؛ لا تذكرها إلا إذا وردت في النص الحالي نفسه.\n\n" +
"1. **اللغة العربية الفصحى الصافية والتوليف التام (PURE ARABIC SYNTHESIS)**:\n" +
"   - اكتب بلغة عربية فصيحة سليمة مع مراعاة قواعد المطابقة اللغوية الكاملة.\n" +
"   - يُحظر حظراً تاماً نقل ملخصات الإنجليزية أو الفرنسية بشكل حرفي أو مقتطع مبتور (مثل \"pays pa...\"). يجب ترجمة وتوليف كافة الأفكار والأدلة والمفاهيم الأجنبية إلى جمل عربية رصينة ومكتملة تماماً.\n" +
"   - لا تنقل العنوان الأجنبي كما هو. استخدم «الوثيقة الأولى» أو ترجمة عربية قصيرة لا تتجاوز ست كلمات، ولا تضع إحالة ببليوغرافية طويلة.\n" +
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
"   - **التزام صارم بصيغة كل خلية (STRICT CELL FORMAT)**: يجب أن يكون كل سطر بيانات من معادلة واحدة تماماً: `| الرقم | نص العمود 1 | نص العمود 2 | نص العمود 3 |` مع وجود الفاصل `|` في بداية السطر ونهايته فقط.\n" +
"   - يُحظر حظراً تاماً وضع فاصل `|` داخل أي خلية، أو إنهاء السطر بأنصاف أعمدة، أو تفريغ خلية (كل خلية يجب أن تحتوي نصاً وافياً).\n" +
"   - يُحظر حظراً تاماً استخدام علامات التبويب (Tabs) مفصولة بدل `|`، ويُحظر وضع رقم السطر في سطر مستقل، ويُحظر كسر محتوى صف واحد على أكثر من سطر مادي (سطر فيزيائي واحد فقط لكل صف).\n" +
"   - يُحظر تماماً إضافة أسطر فاصلة مثل `| : |` أو أي سطر فارغ بين صفوف البيانات، ويجب أن يظهر رقم كل وثيقة كأول خلية بحرف `|` مباشرة.\n" +
"7. **توليد ودمج وسوم الأدلة الحية (MANDATORY EVIDENCE TAGS)**:\n" +
"   في نهاية كل قسم رئيسي، قم بتضمين وسم <evidence> بتنسيق XML يوثق الاقتباسات المباشرة من المصادر.\n" +
"قاعدة الإخراج النهائية: يجب أن يكون المتن عربياً فصيحاً حصراً. ترجم أي مادة أجنبية ولا تنقل جملة إنجليزية أو فرنسية. عند الإحالة، استخدم «الوثيقة الأولى» أو عنواناً عربياً قصيراً لا يتجاوز ست كلمات، ولا تذكر اسم الملف أو عنواناً ببليوغرافياً طويلاً.";

    const topicName = topic || "مقارنة وتحليل شامل للمصادر";
    const scopeIntro = "توضيح النطاق: يعتمد هذا التقرير التوليفي والتحليل المتقدم على " + activeSources.length + " من مصادر البحث النشطة المتاحة لصلتها المباشرة بالموضوع المدروس.\n\n";

    let userPrompt = "";
    if (toolType === "matrix") {
      userPrompt = "صغ \"مصفوفة الأدلة والتعارضات والتحليل النقدي\" (Evidence & Contradiction Matrix) بشكل جدول ماركداون (Markdown Table) يتضمن 4 أعمدة فقط وبدون أي أسطر فارغة:\n" +
"1. **الرقم** (1، 2، 3...)\n" +
"2. **الوثيقة والمحور الرئيسي** (اسم الوثيقة بالعربية + القضية الجوهرية)\n" +
"3. **الأدلة والنتائج المؤيدة** (الأدلة الرقمية والمنهجية الموثقة من صلب النص دون أي تكرار قالبي)\n" +
"4. **التباين والتحليل النقدي** (أوجه الاختلاف والحدود المنهجية أو السياقية بصياغة تخصصية فريدة لكل وثيقة)\n\n" +
"**الشروط الإلزامية لصياغة الجدول (MANDATORY FORMAT RULES):**\n" +
"- كل صف بيانات في **سطر مادي واحد تماماً** بالمعادلة الحرفية: `| الرقم | المحور والأدلة | الأدلة والنتائج | التباين والتحليل |`، مع `|` في أول وآخر كل سطر.\n" +
"- لا تستخدم أبداً علامات التبويب (Tabs) بدل `|`، ولا تفصل رقم الوثيقة عن بقية صفها بسطر مستقل، ولا تكسر محتوى صف واحد على عدة أسطر.\n" +
"- لا تضع الفاصل `|` داخل نص أي خلية، ولا تترك أي خلية فارغة (عمود `الرقم` أرقام فقط، وبقية الأعمدة نصوص وافية كلها).\n" +
"- لا تُدرج أي أسطر فاصلة/فارغة بين صفوف البيانات مثل `| : |`، وتقلص أي تكرار قالبي لإبقاء كل صف مضغوطاً ومركباً في سطر واحد.\n" +
"- السطر الأول = الترويسة، السطر الثاني = `| :--- | :--- | :--- | :--- |`، ثم تبدأ صفوف البيانات مباشرة.\n" +
"- **حظر صفوف الأرقام الفارغة (FORBID EMPTY-CELL ROWS)**: يُحظر تماماً إخراج أي سطر يحتوي رقم الوثيقة في عمود `الرقم` بينما بقية الأعمدة فارغة. كل صف يجب أن يحتوي محتوى نصوصياً وافياً في الأعمدة الثلاثة غير الرقمية دون استثناء.\n" +
"- **جدول واحد فقط (SINGLE COMPLETE TABLE)**: أخرج مصفوفة أدلة واحدة متكاملة فقط في الجدول، ولا تقسمها إلى جدولين، ولا تضع رقم الوثيقة في عمود أول لجدول ثانٍ أعمدته فارغة. إن لم يتوفر محتوى مخصص لوثيقة، امنحها صفاً كاملاً مملوءاً بالنص المتاح ولا تُدرج صفاً رقماً فارغاً.\n" +
"- **عدد الصفوف = عدد الوثائق الفعلي**: اجعل عدد صفوف البيانات مساوياً تماماً لعدد المصادر النشطة المرفقة فقط (`" + activeSources.length + "` صفاً)، وتجنب إضافة صفوف فارغة أو إضافية لمواضيع لا تملك محتوى مستندياً.\n\n" +
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

    const readResponseText = (response: any): string =>
      typeof response?.text === "string" ? response.text.trim() : "";

    const generateArabicSynthesis = async () => {
      // First attempt with the full multilingual system instruction.
      const first = await generateContentWithRetry(ai, {
        model: DEFAULT_MODEL,
        contents: userPrompt,
        config: withDeadline({
          systemInstruction,
          temperature: 0.3,
        })
      }, res, deadlineAt);

      let candidate = readResponseText(first);
      let cleanText = candidate.length > 100
        ? sanitizeArabicReportText(deduplicateReportText(normalizeArabicText(candidate)))
        : "";

      if (!(cleanText.length > 100 && isArabicFirstText(cleanText))) {
        // Repair pass: the model either produced too little Arabic, leaked
        // foreign text, or drafted a meta-level answer. Re-prompt once with an
        // explicit pure-Arabic expansion directive before any fallback path.
        console.warn("Synthesis response failed the Arabic gate; issuing a pure-Arabic repair pass.");
        const repairInstruction =
          "أعد الآن صياغة التقرير كاملاً بالعربية الفصحى حصراً من جديد: ترجم كل اقتباس أو مقتطف أجنبي إلى عربية فصيحة، ولا تنقل أي جملة إنجليزية أو فرنسية حرفياً. وسّع كل قسم إلى فقرات غنية بأدلة قابلة للتحقق من النصوص المتاحة. إن لم يتوفر نص عربي في المصادر فهذا لا يمنع التحليل العميق والمقارن للمحتوى الأجنبي؛ يُشترط فقط أن يكون المُخرَج بالعربية الخالصة.";
        const second = await generateContentWithRetry(ai, {
          model: DEFAULT_MODEL,
          contents: userPrompt + "\n\n" + repairInstruction,
          config: withDeadline({
            systemInstruction,
            temperature: 0.3,
          })
        }, res, deadlineAt);
        candidate = readResponseText(second);
        cleanText = candidate.length > 100
          ? sanitizeArabicReportText(deduplicateReportText(normalizeArabicText(candidate)))
          : "";
      }

      return cleanText;
    };

    try {
      const cleanText = await generateArabicSynthesis();

      if (cleanText.length > 100 && isArabicFirstText(cleanText)) {
        const finalText =
          toolType === "matrix"
            ? sanitizeArabicReportText(
                injectEvidenceMatrixIntoReport(cleanText, activeSources, topic || "تحليل ومقارنة شاملة للمصادر")
              )
            : cleanText;
        const synthesisPayload = {
          text: finalText,
          isFallback: false
        };
        await cacheSet(synthesizeCacheKey, synthesisPayload);
        res.setHeader("X-Cache", "MISS");
        return res.json(synthesisPayload);
      }
      if (cleanText.length > 100) {
        console.warn("Synthesis response contained excessive Latin text; using Arabic fallback.");
      }
    } catch (aiErr: any) {
      console.error("AI synthesis call failed, using smart fallback logic:", aiErr);
    }

    // Smart, document-specific fallback if AI call fails.
    return sendGrounded(res, activeSources, topic, toolType);

  } catch (error: any) {
    console.error("Error in synthesis API:", error);
    try {
      return sendGrounded(res, activeSources, topic, toolType);
    } catch (nestedErr) {
      console.error("grounded synthesis terminal failed:", nestedErr);
      return res.json({ text: "تعذر إتمام التوليف التلقائي، ويرجى إعادة المحاولة.", isFallback: true, silent: false });
    }
  }
});

export default router;
