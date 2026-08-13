import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { request } from "node:http";
import { readFileSync } from "node:fs";

const repo = process.cwd();
const dalilCardSource = readFileSync("src/components/DalilCard.tsx", "utf8");
assert.match(dalilCardSource, /bg-white/);
assert.match(dalilCardSource, /waitForSpeechVoices/);
assert.match(dalilCardSource, /audio\.load\(\)/);
assert.match(dalilCardSource, /timer-based visual progression/);
const bundle = "/tmp/bahthos-termExtractor-test.cjs";
execFileSync("npx", ["esbuild", "src/utils/termExtractor.ts", "--bundle", "--platform=node", "--format=cjs", `--outfile=${bundle}`], { cwd: repo, stdio: "inherit" });
const { sanitizeSourceSummary } = await import(`file://${bundle}?ts=${Date.now()}`);

const staleLegacyTail = ["الممارسات السياقية ذات الصلة", "باللغة العربية الفصحى"].join(" ");
const stale = "تقدم هذه الدراسة قراءة تحليليّة أكاديمية متخصصة تناقش العلاقات الدولية، مع استعراض الأطر النظرية والمنهجية، " + staleLegacyTail + ".";
const currentTitle = "Westphalian Eurocentrism in International Relations and Power Balances.pdf";
const currentContent = "This article examines Westphalian Eurocentrism in international relations and changing power balances. It compares theoretical approaches to global order.";
const repaired = sanitizeSourceSummary(stale, currentTitle, currentContent);
assert.equal(repaired.includes(staleLegacyTail), false);
assert.equal(repaired.includes("العربية الفصحى"), false);
assert.match(repaired, /المركزية الأوروبية الوستفالية|العلاقات الدولية|توازنات القوى/);

const arabicSource = "يناقش المصدر استعمال العربية الفصحى في التعليم الجامعي.";
const validArabic = sanitizeSourceSummary(stale, "دراسة اللغة العربية", arabicSource);
assert.equal(validArabic.includes("العربية الفصحى"), true);

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const req = request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const port = Number(process.env.TEST_PORT || 3417);
const server = execFileSync;
// The caller starts the server; keep this script focused on black-box endpoint checks.
const response = await httpPost(`http://127.0.0.1:${port}/api/synthesize`, {
  toolType: "dalil-update",
  topic: "International Relations",
  newSourceIds: ["current-1"],
  sources: [
    { id: "current-1", title: currentTitle, language: "English", summary: stale, content: currentContent },
    { id: "current-2", title: "Power Balances", language: "English", summary: "A source on power balances.", content: "The source compares power balances in international relations." }
  ]
});
assert.equal(response.status, 200);
assert.equal(response.body.isFallback, true);
assert.equal(response.body.text.includes(staleLegacyTail), false);
assert.equal(response.body.text.includes("العربية الفصحى"), false);
assert.equal(response.body.text.includes("Makkah"), false);
assert.equal(response.body.text.includes("التربية"), false);
assert.match(response.body.text, /Westphalian Eurocentrism|Power Balances|المركزية|العلاقات الدولية/);
assert.match(response.body.text, /المصادر الحاليّة فقط|المَصَادِرِ الحَالِيَّةِ فَقَطْ/);

const followupRes = await httpPost(`http://127.0.0.1:${port}/api/report-followup`, {
  question: "ما هي الأسئلة والنقاط التي لا تتوفر لها إجابة صريحة في المصادر الحالية؟",
  reportContext: "Published by Wiley on behalf of The International Studies Association Stable URL https://example.com/test",
  reportTitle: "International Relations Report",
  sources: [
    { id: "current-1", title: currentTitle, language: "English", content: currentContent }
  ]
});
assert.equal(followupRes.status, 200);
assert.equal(followupRes.body.answer.includes("https://"), false);
assert.equal(followupRes.body.answer.includes("Wiley"), false);

const ttsRes = await httpPost(`http://127.0.0.1:${port}/api/tts`, {
  text: "هذا اختبار صوتي قصير للدليل."
});
assert.equal(ttsRes.status, 200);
assert.ok(Object.prototype.hasOwnProperty.call(ttsRes.body, "audio"));
assert.equal(ttsRes.body.audio === null || typeof ttsRes.body.audio === "string", true);

console.log(JSON.stringify({
  summaryRepair: "passed",
  ArabicSourcePreservation: "passed",
  briefingEndpoint: "passed",
  reportFollowupEndpoint: "passed",
  ttsEndpointContract: "passed",
  readerModeMarkers: "passed",
  briefingUsesCurrentSourcesOnly: true,
  staleLegacyPhraseAbsent: true
}, null, 2));
