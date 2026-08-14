import { Router } from "express";
import { getAiClient, generateContentWithRetry } from "../ai.js";
import { normalizeArabicText } from "../../utils/termExtractor.js";
import { generateReportFollowUpFallback } from "../../utils/synthesisFallback.js";
import { deduplicateSources, deduplicateReportText } from "../sourceUtils.js";

const router = Router();

router.post("/api/report-followup", async (req, res) => {
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

export default router;
