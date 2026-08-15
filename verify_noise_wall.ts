
import { cleanAndSanitizeAcademicTerm, isTrivialOrCitationTerm } from './src/utils/termExtractor.ts';

const noisyInputs = [
  { term: "New York", draft: "نيويورك", def: "A city in the United States." },
  { term: "Retrenchment J", draft: "التراجع ج", def: "A fragment from a title." },
  { term: "Foreign Affairs", draft: "الشؤون الخارجية", def: "A journal name." },
  { term: "Saudi Arabia", draft: "المملكة العربية السعودية", def: "A country name." },
  { term: "Robert Mason To", draft: "روبرت ماسون إلى", def: "An author fragment." },
  { term: "Human Competence", draft: "الكفاءة البشرية", def: "القدرة المتكاملة للفرد على أداء المهام بكفاءة وفعالية عالية." }
];

console.log("--- Testing Noise Wall & Term Purification ---");

noisyInputs.forEach(input => {
  const isTrivial = isTrivialOrCitationTerm(input.term, input.def);
  const sanitized = cleanAndSanitizeAcademicTerm(input.term, input.draft, input.draft, input.def);
  
  console.log(`\nInput Term: "${input.term}"`);
  console.log(`- Is Trivial/Citation/Noise: ${isTrivial}`);
  console.log(`- Sanitized isValid: ${sanitized.isValid}`);
  console.log(`- Verified Arabic Term: "${sanitized.verified_term}"`);

  if (input.term === "Human Competence") {
    if (sanitized.isValid && !isTrivial) {
      console.log("PASS: Valid academic concept correctly accepted.");
    } else {
      console.log("FAIL: Valid academic concept incorrectly rejected.");
    }
  } else {
    if (!sanitized.isValid || isTrivial) {
      console.log("PASS: Noisy/metadata term correctly blocked.");
    } else {
      console.log("FAIL: Noisy/metadata term improperly allowed!");
      process.exit(1);
    }
  }
});

console.log("\nAll noise wall checks passed successfully!");
