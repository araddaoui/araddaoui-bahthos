import { Router } from "express";
import { getAiClient, generateContentWithRetry } from "../ai.js";
import { normalizeArabicText, sanitizeSourceSummary } from "../../utils/termExtractor.js";
import { generateClientSynthesisFallback } from "../../utils/synthesisFallback.js";
import { deduplicateSources, deduplicateReportText } from "../sourceUtils.js";
import { DALIL_SYSTEM_INSTRUCTION } from "../prompts.js";

const router = Router();

function buildDalilFallback(activeSources: any[]): string {
  const sourceCount = activeSources.length;
  const title = (source: any, index: number) =>
    (source?.title || `المصدر ${index + 1}`).replace(/\.[a-z0-9]{2,4}$/i, "").trim();
  const summary = (source: any) =>
    (source?.summary || source?.content || "").replace(/\s+/g, " ").trim();
  const titles = activeSources.map(title).join("، ");
  const first = summary(activeSources[0]).slice(0, 520) || "لا يتوفر في هذا المصدر ملخص قابل للاقتباس المباشر.";
  const second = summary(activeSources[1]).slice(0, 520) || "لا يتوفر في هذا المصدر ملخص قابل للاقتباس المباشر.";
  const additional = activeSources.slice(2, 5).map((source, index) =>
    `المصدر ${index + 3} «${title(source, index + 2)}» يضيف إلى مجموعة الأدلة المقتطف الآتي: «${summary(source).slice(0, 300) || "لا يتوفر ملخص كافٍ"}».`
  ).join(" ");

  return [
    `يُظْهِرُ التَّحْلِيلُ المُعَمَّقُ لِلْأَدِلَّةِ المُقَدَّمَةِ فِي «${title(activeSources[0], 0)}» وَ«${title(activeSources[1], 1)}» تَقَاطُعاً مِحْوَرِيّاً فِي طَبِيعَةِ المُشْكِلَةِ المَدْرُوسَةِ. فَبَيْنَمَا يَنْطَلِقُ الطَّرْحُ الْأَوَّلُ مِنْ مُعْطَيَاتٍ تُؤَكِّدُ أَنَّ: «${first}»، يَتَّخِذُ الطَّرْحُ الثَّانِي مَسَاراً مُكَمِّلاً حِينَ يُشِيرُ إِلَى أَنَّ: «${second}». وَهَذَا التَّبَايُنُ لَيْسَ تَنَاقُضاً مَنْهَجِيّاً، بَلْ هُوَ اخْتِلَافٌ فِي زَاوِيَةِ الرُّؤْيَةِ يُثْرِي فَهْمَ الظَّاهِرَةِ.`,
    `تَتَجَلَّى أَهَمِّيَّةُ هَذَا التَّقَاطُعِ عِنْدَ فَحْصِ السِّيَاقَاتِ التَّطْبِيقِيَّةِ لِلْمَفَاهِيمِ. فَالمَصْدَرُ الْأَوَّلُ يُؤَسِّسُ لِبُنْيَةٍ نَظَرِيَّةٍ يُمْكِنُ اسْتِخْدَامُهَا لِتَفْسِيرِ الحَالَاتِ المَيْدَانِيَّةِ، فِي حِينِ يُقَدِّمُ المَصْدَرُ الثَّانِي شَوَاهِدَ عَمَلِيَّةً تَخْتَبِرُ مَدَى صَلَابَةِ تِلْكَ البُنْيَةِ فِي مُوَاجَهَةِ المُتَغَيِّرَاتِ الفِعْلِيَّةِ.`,
    additional || `وَمِنْ خِلَالِ دَمْجِ هَاتَيْنِ الرُّؤْيَتَيْنِ، يُمْكِنُ اسْتِنْتَاجُ أَنَّ المُقَارَبَاتِ الْأُحَادِيَّةَ تَبْقَى قَاصِرَةً عَنْ الْإِحَاطَةِ بِالتَّعْقِيدِ الكَامِنِ فِي المُشْكِلَةِ، مِمَّا يَسْتَدْعِي تَبَنِّي نَمُوذَجٍ تَفْسِيرِيٍّ مُرَكَّبٍ.`,
    `عَلَى الرَّغْمِ مِنْ هَذَا التَّكَامُلِ، تَبْرُزُ فَجْوَةٌ مَعْرِفِيَّةٌ تَتَعَلَّقُ بِحُدُودِ التَّعْمِيمِ. فَالنَّتَائِجُ المُسْتَخْلَصَةُ تَبْقَى مَشْرُوطَةً بِالسِّيَاقِ الخَاصِّ الَّذِي أُفْرِزَتْ فِيهِ الْأَدِلَّةُ، وَلَا يُمْكِنُ سَحْبُهَا عَلَى نِطَاقَاتٍ أَوْسَعَ دُونَ قَرَائِنَ إِضَافِيَّةٍ لَمْ تُعَالِجْهَا الْوَثَائِقُ الحَالِيَّةُ بِشَكْلٍ صَرِيحٍ.`,
    `وَخُلَاصَةُ القَوْلِ، إِنَّ الْقِيمَةَ الْأَسَاسِيَّةَ لِهَذِهِ المَجْمُوعَةِ تَتَمَثَّلُ فِي قُدْرَتِهَا عَلَى إِعَادَةِ صِيَاغَةِ السُّؤَالِ المَرْكَزِيِّ؛ فَبَدَلاً مِنْ الْبَحْثِ عَنْ إِجَابَاتٍ قَاطِعَةٍ، تُوَجِّهُنَا الْأَدِلَّةُ نَحْوَ مَزِيدٍ مِنْ التَّفْكِيكِ لِلْعَوَامِلِ المُؤَثِّرَةِ وَالمُتَدَاخِلَةِ.`,
    `تَسْتَنِدُ هَذِهِ الْإِحَاطَةُ إِلَى المَصَادِرِ الحَالِيَّةِ فِي هَذَا المَشْرُوعِ حَصْراً، وَلَا تَسْتَعِيرُ مَعْلُومَاتٍ مِنْ مَشْرُوعَاتٍ سَابِقَةٍ.`
  ].join("\n\n");
}

router.post("/api/synthesize", async (req, res) => {
  try {
    const { sources: rawSourcesInput, topic, toolType } = req.body || {};
    const sources = Array.isArray(rawSourcesInput) ? rawSourcesInput : [];
    const activeSources = deduplicateSources(sources).map((source: any) => ({
      ...source,
      summary: sanitizeSourceSummary(source?.summary, source?.title, source?.content),
    }));
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد مصدر واحد على الأقل للتوليف." });
    }

    console.log("Starting synthesis for topic:", topic, "toolType:", toolType, "sources:", activeSources.length);

    const ai = getAiClient();

    if (toolType === "dalil-update") {
      const { newSourceIds } = req.body || {};
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

      // Deliberately exclude any previous briefing from the prompt. A briefing
      // belongs to an earlier source snapshot and can contaminate a new project.
      const priorContext = "لا توجد إحاطة سابقة؛ يُحظر الاعتماد على أي محتوى سابق.\n";

      const dalilPrompt = `${DALIL_SYSTEM_INSTRUCTION}

أنتَ "الدليل" - المحلل الأكاديمي الصارم في نظام بحث OS.
مهمتك هي إجراء تحليل موضوعي وتوليف نقدي عميق لمحتوى المصادر المرفقة.

حظر قاطع لخطاب "المنهج" (META-DISCOURSE PROHIBITION):
يُحظر تماماً كتابة جمل تشرح "كيف" ستقوم بالتحليل أو "ماذا" تتناول الإحاطة (مثل: "تتناول هذه الإحاطة..."، "تركز المقارنة على..."، "من الناحية المنهجية..."، "تكشف المقارنة الأولية...").
ابدأ فوراً في صلب الموضوع والنتائج المستخلصة من المصادر. لا تتحدث عن "المصادر" ككيانات تقنية، بل تحدث عن "الأدلة" و"الأطروحات" و"النتائج" الواردة فيها.

قواعد الصياغة والعمق (STRICT CONTENT RULES):
1. التحليل المباشر (Direct Analysis): ابدأ الفقرة الأولى بتقرير حقيقة أو استنتاج مركزي يجمع الوثائق.
2. التشكيل الكامل (Full Vocalization): اكتب النص بعربية فصيحة راقية ومُشَكَّلَة بالكامل (Vocalized).
3. التوليف المقارن (6-8 فقرات): يجب أن تكون كل فقرة غنية بالمعلومات، تربط بين أفكار المصادر المختلفة، وتستخلص تداعياتها.
4. حظر التكرار: لا تسرد المصادر واحداً تلو الآخر. ادمج المعلومات بناءً على الموضوعات والأدلة.
5. الحظر التقني: لا تذكر أسماء الملفات أو الامتدادات. استخدم العناوين الموضوعية فقط.
6. الفواصل الصوتية: استخدم علامة || فقط للفواصل الصوتية بين الجمل الكبيرة، ولا تستخدم الماركداون (Markdown).
7. الطول والعمق: يجب أن يكون النص طويلاً ومفصلاً (لا يقل عن 1000 حرف)، يغوص في تفاصيل الأدلة والفجوات البحثية الحقيقية الواردة في النصوص.

الهدف هو تقديم قيمة مضافة للباحث تجعله يفهم "جوهر" ما تقوله الوثائق مجتمعة، وليس مجرد وصف لوجودها.

${priorContext}

${sourcesContext}
`;

      try {
        // Upgrade to Gemini 3.1 Pro for deep academic synthesis and reasoning.
        const response = await generateContentWithRetry(ai, {
          model: "gemini-3.1-pro-preview",
          contents: dalilPrompt,
          config: {
            systemInstruction: DALIL_SYSTEM_INSTRUCTION,
            temperature: 0.3,
            maxOutputTokens: 2500
          },
        });

        if (response?.text && response.text.trim().length >= 800) {
          return res.json({ text: response.text.trim(), isFallback: false, silent: false });
        }
        if (response?.text && response.text.trim().length > 5) {
          console.warn("Al-Dalil model returned an undersized briefing; using the grounded long-form fallback.");
        }
      } catch (aiErr: any) {
        console.error("al-Dalil briefing generation failed:", aiErr);
      }

      // Rich source-grounded comparative baseline briefing if AI generation is skipped or fails.
      const fallbackBriefing = buildDalilFallback(activeSources);
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

    const systemInstruction = "أنت عالم ومحلل خبير في نظام \"بحث OS\" (BahthOS).\n" +
"مهمتك إجراء تحليل توليفي وتوثيقي عميق ومقارن للمصادر المرفقة حول الموضوع المحدد.\n\n" +
"قواعد صياغة الجودة والتنسيق الصارمة (STRICT QUALITY & FORMATTING RULES):\n" +
"0. **قواعد التنسيق والتوثيق المتقدمة (TABLES & CITATIONS & TRANSLATION)**:\n" +
"   - **تنظيم الجداول**: يُحظر تماماً ترك أي صفوف فارغة أو خلايا ناقصة في الجداول المعيارية؛ يجب ملء جميع الأعمدة بدقة، وفي حال عدم توفر معلومة يُكتب `-` أو `غير متوفر`.\n" +
"   - **التوثيق المبسط**: استبدل الأسماء الببليوجرافية الطويلة أو الملفات الخام بعلامات توثيق مختصرة ونظيفة تعتمد على عنوان الوثيقة بالعربية بين قوسين (مثل [عنوان الوثيقة المختصر]) لتسهيل القراءة واستمرار تدفقها.\n" +
"   - **ترجمة الاقتباسات الأجنبية**: عند إدراج اقتباسات أو مفاهيم أجنبية، قم بترجمتها بطلاقة إلى اللغة العربية الفصحى وأضف دائماً ملاحظة صريحة بأنها مترجمة (مثل: [ترجمة عربية للنص الأصلي]) للحفاظ على الأمانة العلمية.\n" +
"   - **عزل المشروع**: لا تذكر اللغة العربية أو التربية أو أي مجال أو مشروع سابق لمجرد أن لغة الإخراج عربية؛ لا تذكرها إلا إذا وردت في النص الحالي نفسه.\n\n" +
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

export default router;
