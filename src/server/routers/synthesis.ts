import { Router } from "express";
import { getAiClient, generateContentWithRetry } from "../ai";
import { normalizeArabicText, sanitizeSourceSummary } from "../../utils/termExtractor";
import { generateClientSynthesisFallback } from "../../utils/synthesisFallback";
import { deduplicateSources, deduplicateReportText } from "../sourceUtils";
import { DALIL_SYSTEM_INSTRUCTION } from "../prompts";

const router = Router();

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

أنتَ "الدليل" - الصوت المرشد والمحلل في نظام بحث OS (bahthOS).
مهمتك تقديم إحاطة توليفية أكاديمية عميقة وشاملة ومُشَكَّلَة بالكامل (مع التشكيل والضبط بالشكل التام) لجميع المصادر المرفقة (${activeSources.length} مصادر) على نهج واجهة Google AI Studio القياسية.

قواعد صياغة الإحاطة:
1. الضبط بالشكل والتشكيل التام (مُشَكَّل بالكامل): اكتب النص بعربية فصيحة راقية ومُشَكَّلَة بالكامل مع التشكيل لجميع الكلمات والضمائر (مثل: نَسْتَعْرِضُ الْيَوْمَ المَصَادِرَ المَرْفُوقَةَ فِي البَحْثِ وَعَدَدُهَا المَصَادِرُ...).
2. حظر مطلق: يُمَنَع منعاً باتاً ذكر امتدادات الملفات (.pdf, .docx, .txt) أو الكلمات الأجنبية بالإنجليزية أو الفرنسية. قم بتعريب وترجمة كافة عناوين الوثائق والمستندات الأجنبية إلى عناوين عربية موضوعية وراقية مع تشكيلها.
3. التوليف العميق (3 فقرات متماسكة بطول 220 إلى 350 كلمة):
   - استخرج الموضوعات والأهداف والمفاهيم التي تذكرها المصادر الحالية فقط، ولا تفترض مجالاً أو قطاعاً أو نتيجة غير موجودة في النصوص المرفقة.
   - قارن بين المناهج والأدلة والنتائج الواردة فعلياً في المصادر، واذكر الأرقام أو المواقع أو الجهات فقط إذا وردت صراحة في المصدر المناسب.
   - بيّن الفجوات والتحديات والتوصيات المرتبطة بالمصادر الحالية حصراً، وتوقف عن التعميم عندما لا يقدم النص دليلاً كافياً.
4. استخدم علامة || فقط بين الجمل لضبط التلاوة الصوتية والوقفات التنفسية الشفوية.
5. خلو تام من علامات الماركداون والرموز التقنية.

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

      // Rich fully-vocalized baseline briefing if AI generation is skipped or fails
      const fallbackTitles = activeSources
        .map((src: any, idx: number) => (src?.title || `الوثيقة ${idx + 1}`).trim())
        .join("، ");
      const fallbackEvidence = activeSources
        .slice(0, 3)
        .map((src: any, idx: number) => {
          const raw = String(src?.summary || src?.content || "").replace(/\s+/g, " ").trim();
          const excerpt = raw.length > 240 ? raw.substring(0, 240) + "…" : raw;
          return `يُبَيِّنُ المَصْدَرُ ${idx + 1} «${src?.title || `الوثيقة ${idx + 1}`}» مَا يَرِدُ فِي نَصِّهِ مِنْ مَعْلُومَاتٍ مُتَّصِلَةٍ بِمَوْضُوعِ البَحْثِ: ${excerpt || "لا يَتَوَفَّرُ مُلَخَّصٌ كَافٍ."}`;
        })
        .join(" || ");
      const fallbackBriefing = `نَسْتَعْرِضُ فِي المَشْرُوعِ الحَالِيِّ ${activeSources.length} مَصَادِرَ بَحْثِيَّةٍ، وَهِيَ: ${fallbackTitles}. || ${fallbackEvidence || "تَحْتَاجُ المَصَادِرُ إِلَى قِرَاءَةٍ تَحْلِيلِيَّةٍ مُفَصَّلَةٍ."} || تَعْتَمِدُ هَذِهِ الإِحَاطَةُ عَلَى المَصَادِرِ الحَالِيَّةِ فَقَطْ، وَلَا تَسْتَعِيرُ مَعْلُومَاتٍ مِنْ مَشْرُوعَاتٍ سَابِقَةٍ.`;
      
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
