import { Router } from "express";
import { Type } from "@google/genai";
import { getAiClient, generateContentWithRetry } from "../ai.js";
import { cleanAndSanitizeAcademicTerm, spellcheckAndRepairArabicAndEnglishText, buildContextDefinition } from "../../utils/termExtractor.js";

const router = Router();

router.post("/api/sweep-glossary", async (req, res) => {
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

export default router;
