import { Router } from "express";
import { Type } from "@google/genai";
import { getAiClient, generateContentWithRetry } from "../ai.js";
import { extractFallbackTermsFromText, sanitizeAndRepairTermsPipeline } from "../../utils/termExtractor.js";

const router = Router();

router.post("/api/extract-glossary", async (req, res) => {
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
"مهمتك تحليل النص واستخراج كافة المفاهيم النظرية المتخصصة (Theoretical Concepts)، والأطر المنهجية (Methodological Frameworks)، والمصطلحات التحليلية المعيارية المعتمدة وردت في المستند الحالي.\n\n" +
"طبق القواعد الصارمة التالية:\n" +
"1. الاقتصار على البناءات النظرية والمفاهيم المركبة:\n" +
"   استخرج البناءات النظرية ذات العمق والأطر المنهجية المعتمدة التي تمتلك تعريفاً جوهرياً متعارفاً عليه (مثل: Human Competence, Soft Power, Path Dependence, Principal-Agent Problem, Process Tracing, Machine Learning).\n" +
"2. تجريد وحظر أدوات الربط والجسيمات الزائدة والأرقام:\n" +
"   استخرج الاسم المعرف السليم دائماً خاوياً من أي حروف زائدة ملتصقة (مثل: استخرج \"الكفاءة البشرية\" وليس \"كالكفاءة البشرية 2،\"). أحظر تماماً أرقام الصفحات والعلامات الملحقة.\n" +
"3. الحظر الصارم للكلمات العامة والهيكلية والجمل الشائعة (Linguistic & Generic Fragments):\n" +
"   يُمنع منعاً باتاً استخراج أي كلمات هيكلية عامة أو مصطلحات فضفاضة غير متخصصة (مثل: \"Theory\", \"The Theory\", \"Research Methodology\", \"Methodology\", \"Research\", \"The Study\", \"Results\", \"Literature Review\", \"Discussion\")، كما يُمنع استخراج أي عبارات وصفية عابرة وردت في النص (مثل: \"results show\", \"data collected\", \"future studies\").\n" +
"4. الجودة الصارمة للتعريب والتعريف الدقيق:\n" +
"   لكل مصطلح، يجب تقديم المصطلح العربي المعيار المعتمد والمكافئ بدقة في حقل verified_term (يُمنع ترك verified_term باللغة الإنجليزية).\n" +
"   صغ تعريفاً إجرائياً حقيقياً شارحاً لجوهره في جملة واحدة رصينة مفيدة، وتجنب العبارات القالبية الفارغة.\n" +
"5. المكافئ الإنجليزي الموثوق دائمًا (CONSISTENT AUTHENTIC ENGLISH):\n" +
"   بغضّ النظر عن لغة المصدر الأصلي للمستند، احرص أن يكون حقل term معبّأً دائمًا بالمكافئ الإنجليزي المعياري المتعارف عليه علمياً للمفهوم (مثل: Multimedia، Flexible Learning، Digital Multimedia Production Tools، Knowledge Management).\n" +
"   إذا كان المستند عربياً فلا تترك term بلغة عربية؛ اكتب مكافئه الإنجليزي الأصيل المتداول في الأدبيات التخصصية. تُمنع ترجمة حرفية ركيكة أو مصطلح مختلق من عندك، بل استخدم المكافئ الإنجليزي المتعارف عليه للمفهوم في الحقل المعرفي ذاته مهما كان التخصص.\n\n" +
"6. الحقيقة والقبول العلمي إلزاميان (AUTHENTICITY & SCHOLARLY ACCEPTANCE):\n" +
"   لا تُخرج إلا مفهوماً حقيقياً راسخاً متداولاً في الأدبيات العلمية لمجاله وله تعريف علمي متعارف عليه في الوسط الأكاديمي. يجب أن تكون خانات definition هي التعريف العلمي المعتمد المتعارف عليه للمفهوم نفسه في الأدبيات، لا إعادة صياغة من سياق المستند ولا جملة منقولة من النص ولا صياغة تقول (في هذا المصدر) أو (يراد بـ). إذا لم تتيقن من وجود تعريف علمي متعارف عليه للمفهوم فاحذف المفهوم كاملاً ولا تُدرجه أبداً بتعريف مختلق.\n\n" +
"لكل مصطلح مستخرج، عبئ الحقول التالية بالترتيب الدقيق:\n" +
"1. term: المكافئ الإنجليزي المعياري المتعارف عليه للمصطلح (دائمًا بالإنجليزية، حتى لو كان المصدر عربياً).\n" +
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
                    description: "المكافئ الإنجليزي المعياري المتعارف عليه للمصطلح (دائمًا بالإنجليزية، حتى لو كان المصدر عربياً).",
                  },
                  draft_term: {
                    type: Type.STRING,
                    description: "المصطلح العربي المقترح في المسودة الأولى (قد يحتوي على تعريب لفظي أو غير دقيق).",
                  },
                  definition: {
                    type: Type.STRING,
                    description: "التعريف العلمي المتعارف عليه للمفهوم في الأدبيات الأكاديمية، وليس صياغة من سياق المستند، ولا جملة منقولة من النص، ولا صياغة مثل (في هذا المصدر) أو (يراد بـ)؛ باللغة العربية الفصحى.",
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
    const normalizedTerms = sanitizeAndRepairTermsPipeline(data.terms || [], text || "", "", 2)
      .map((t) => ({
        term: t.term,
        draft_term: t.draft_term,
        verified_term: t.verified_term,
        transliteration: t.transliteration,
        definition: t.definition,
      }));

    return res.json({ terms: normalizedTerms });
  } catch (error: any) {
    console.warn("Passive glossary extraction backend failed, using local extraction fallback:", error);
    const fallbacks = extractFallbackTermsFromText(text, undefined, undefined).map((t) => ({
      term: t.term,
      draft_term: t.draft_term,
      verified_term: t.verified_term,
      transliteration: t.transliteration,
      definition: t.definition,
    }));
    return res.json({ terms: fallbacks });
  }
});

export default router;
