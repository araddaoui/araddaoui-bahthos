import fs from "fs";
import path from "path";

async function main() {
  const distDir = path.join(process.cwd(), "dist");
  const htmlPath = path.join(distDir, "index.html");

  if (!fs.existsSync(htmlPath)) {
    console.error("Error: dist/index.html does not exist. Please run 'npm run build' first.");
    process.exit(1);
  }

  console.log("Reading dist/index.html...");
  let html = fs.readFileSync(htmlPath, "utf8");

  // Find the JS script reference
  // E.g., <script type="module" crossorigin src="/assets/index-Bd8R-HUQ.js"></script>
  const jsMatch = html.match(/<script[^>]+src="\/assets\/(index-[a-zA-Z0-9_-]+\.js)"[^>]*><\/script>/);
  if (!jsMatch) {
    console.error("Could not find index.js reference in index.html");
    process.exit(1);
  }
  const jsFileName = jsMatch[1];
  const jsFilePath = path.join(distDir, "assets", jsFileName);
  console.log(`Found JS reference: ${jsFileName}`);

  // Find the CSS reference
  // E.g., <link rel="stylesheet" crossorigin href="/assets/index-DiFuYjpG.css">
  const cssMatch = html.match(/<link[^>]+href="\/assets\/(index-[a-zA-Z0-9_-]+\.css)"[^>]*>/);
  if (!cssMatch) {
    console.error("Could not find index.css reference in index.html");
    process.exit(1);
  }
  const cssFileName = cssMatch[1];
  const cssFilePath = path.join(distDir, "assets", cssFileName);
  console.log(`Found CSS reference: ${cssFileName}`);

  if (!fs.existsSync(jsFilePath) || !fs.existsSync(cssFilePath)) {
    console.error("Could not locate the JS or CSS asset files in dist/assets/");
    process.exit(1);
  }

  console.log("Reading JS and CSS contents...");
  let jsContent = fs.readFileSync(jsFilePath, "utf8");
  const cssContent = fs.readFileSync(cssFilePath, "utf8");

  // Inject Local Storage & Offline sandbox fetch API interceptor at the top of the bundle or in a <script> tag before index.js
  const offlineMockScript = `
    <!-- Mock Offline Interceptor -->
    <script type="text/javascript">
      (function() {
        if (window.location.protocol === 'file:' || !window.location.port || window.location.hostname.includes('github.io')) {
          console.log("Tawlif Standalone: Intercepting API endpoints for offline operation.");
          const originalFetch = window.fetch;
          window.fetch = async function(url, options) {
            const urlStr = String(url);
            
            if (urlStr.includes('/api/chat')) {
              try {
                const body = JSON.parse(options.body);
                const userMessage = body.messages[body.messages.length - 1].text;
                
                // Construct simulation response in beautiful academic Arabic
                const responseText = "أهلاً بك! هذا رد محاكاة تفاعلي محلي (Offline Sandbox) لأن المنصة تعمل كملف مستقل (Standalone HTML).\\n\\nلقد استلمت سؤالك: \\"" + userMessage + "\\"\\n\\nسأقوم بمراجعة مستنداتك المرفوعة محلياً ومقارنتها بدقة. في هذا الوضع المستقل، يمكنك تفعيل وتعطيل الوثائق والبحث فيها وتصميم التقارير وحفظ مشاريعك في الذاكرة المحلية (LocalStorage) بجهازك بشكل كامل وآمن.\\n\\n<evidence strength=\\"جيدة\\" agreement=\\"متفقة\\" supporting=\\"1 من أصل 1 مصادر\\">\\n  <supporting>\\n    <source title=\\"البيئة التجريبية المحلية\\">\\n      <quote>المنصة تعمل محلياً بالكامل دون الحاجة للاتصال بخادم خلفي.</quote>\\n    </source>\\n  </supporting>\\n  <explanation>تم تشغيل محاكي الذكاء الاصطناعي الداخلي لأنك قمت بفتح الملف مباشرة من جهازك.</explanation>\\n</evidence>";
                
                return {
                  ok: true,
                  json: async () => ({ text: responseText })
                };
              } catch (e) {
                console.error(e);
              }
            }
            
            if (urlStr.includes('/api/synthesize')) {
              try {
                const body = JSON.parse(options.body);
                const topic = body.topic;
                const toolType = body.toolType;
                
                let reportText = "";
                if (toolType === "matrix") {
                  reportText = "### مصفوفة الأدلة والتعارضات والتحليل المنهجي\\n\\nالموضوع: " + topic + "\\n\\n| م | المحور الأكاديمي | دراسة (المرونة الأكاديمية 2024) | دراسة (تحديات الصحة النفسية 2025) | التوافق والتعارض |\\n|---|---|---|---|---|\\n| 1 | الأثر الدراسي والتحصيل | تراجع الأداء الدراسي بنسبة 15% | استقرار الأداء لدى الطلبة المتكيفين | يوجد اختلاف جزئي حسب بيئة الدعم |\\n| 2 | المتغير النفسي والاجتماعي | ارتفاع مستويات القلق والتوتر | زيادة العزلة الاجتماعية وصعوبات التكيف | متفقة على زيادة الضغوط النفسية |\\n\\n---\\n\\n#### التحليل والتركيب المنهجي:\\n1. تظهر المقارنة وجود تباين في قياس الأثر الدراسي تبعاً لوجود قنوات الدعم الأكاديمي والأسري للطلاب.\\n2. يتفق كلا المصدرين على أن الانتقال المفاجئ دون تهيئة يرفع مستويات القلق والتوتر لدى عينة الطلاب الخاضعة للدراسة.\\n\\n<evidence strength=\\"قوية\\" agreement=\\"يوجد اختلاف جزئي\\" supporting=\\"2 من أصل 2 مصادر\\">\\n  <supporting>\\n    <source title=\\"تراجع التحصيل\\">\\n      <quote>تراجع الأداء بنسبة 15% في غياب التفاعل المباشر.</quote>\\n    </source>\\n  </supporting>\\n  <explanation>يعزى الاختلاف الجزئي إلى تباين العينات وأدوات القياس المنهجية بين الدراستين.</explanation>\\n</evidence>";
                } else {
                  reportText = "### التقرير التوليفي الشامل للموضوع: " + topic + "\\n\\n#### 1. المقدمة والفرص البحثية:\\nبناءً على مراجعة الوثائق النشطة في المشروع، تم صياغة هذا التقرير التوليفي لتقديم ملخص علمي رصين يرتكز بالكامل على الاقتباسات المباشرة.\\n\\n#### 2. النتائج الرئيسية والمقارنات المنهجية:\\n- **محور التحصيل والتعلم**: أظهرت النتائج تبايناً واضحاً في مستويات التكيف مع التقنيات الحديثة.\\n- **محور الصحة النفسية والاجتماعية**: تُجمع الدراسات على أهمية توفير آليات الدعم والمساندة المستمرة للطلاب لتقليل وطأة الضغوط.\\n\\n---\\n\\n<evidence strength=\\"جيدة\\" agreement=\\"متفقة\\" supporting=\\"2 من أصل 2 مصادر\\">\\n  <supporting>\\n    <source title=\\"دراسة التعليم عن بعد\\">\\n      <quote>أهمية توفير آليات الدعم والمساندة المستمرة للطلاب.</quote>\\n    </source>\\n  </supporting>\\n  <explanation>تتفق النتائج على وجود حاجة ماسة لمنظومات الدعم المدمجة في البيئات التعليمية.</explanation>\\n</evidence>";
                }
                
                return {
                  ok: true,
                  json: async () => ({ text: reportText })
                };
              } catch (e) {
                console.error(e);
              }
            }
            
            if (urlStr.includes('/api/save-state') || urlStr.includes('/api/reset-state')) {
              return {
                ok: true,
                json: async () => ({ status: "ok" })
              };
            }
            
            return {
              ok: true,
              json: async () => ({})
            };
          };
        }
      })();
    </script>
  `;

  // Perform replacements on index.html to bundle assets
  // Replace <link rel="stylesheet"...css> with embedded style block
  html = html.replace(cssMatch[0], `<style type="text/css">\n${cssContent}\n</style>`);

  // Inject offline simulation script
  html = html.replace("</head>", `${offlineMockScript}\n</head>`);

  // Replace <script type="module"...js> with embedded script block
  // Note: we remove 'type="module"' because module scripts loaded via 'file://' are blocked by CORS in some browsers.
  // Converting it to standard JS or maintaining it is fine. Since all dependencies are bundled, removing type="module" or keeping it as normal defer script is ideal.
  html = html.replace(jsMatch[0], `<script type="text/javascript">\n${jsContent}\n</script>`);

  const outputPath = path.join(process.cwd(), "bahthos_standalone.html");
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`\n🎉 SUCCESS! Full app bundled into a single standalone HTML file:\n 👉 ${outputPath}\n`);
}

main().catch(console.error);
