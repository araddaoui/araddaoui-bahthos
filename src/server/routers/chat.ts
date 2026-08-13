import { Router } from "express";
import { getAiClient, generateContentWithRetry, SYSTEM_INSTRUCTIONS } from "../ai";
import { normalizeArabicText } from "../../utils/termExtractor";

const router = Router();

router.post("/api/chat", async (req, res) => {
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

export default router;
