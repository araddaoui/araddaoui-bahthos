
import { extractFallbackTermsFromText } from './src/utils/termExtractor.ts';

const testCases = [
  {
    id: 'ir_source',
    title: 'Westphalian Sovereignty in IR',
    content: 'This paper analyzes the Westphalian Sovereignty and its impact on International Relations Theory. It explores how state actors navigate the Hegemony Paradigm in the 21st century. The Global Order remains complex.',
    expectedContains: ['Westphalian Sovereignty', 'International Relations Theory', 'Hegemony Paradigm']
  },
  {
    id: 'empty_source',
    title: 'General Notes',
    content: 'This is just a general note with no academic concepts. It contains common words like research and study but nothing specific.',
    expectedEmpty: true
  }
];

console.log("--- Testing Merit-Based Term Extraction ---");

testCases.forEach((tc) => {
  const terms = extractFallbackTermsFromText(tc.content, tc.id, tc.title);
  console.log(`\nSource: ${tc.title}`);
  console.log(`Extracted Terms: ${terms.length}`);
  terms.forEach(t => console.log(` - ${t.term}`));

  if (tc.expectedEmpty && terms.length === 0) {
    console.log("PASS: Correctly yielded no terms for generic source.");
  } else if (!tc.expectedEmpty && terms.length > 0) {
    const foundAll = tc.expectedContains?.every(exp => terms.some(t => t.term.includes(exp)));
    if (foundAll) {
      console.log("PASS: Correctly extracted document-specific concepts.");
    } else {
      console.log("FAIL: Missing expected document-specific concepts.");
    }
  } else {
    console.log("FAIL: Unexpected extraction result.");
  }
});

console.log("\n--- Project Isolation Audit ---");
const genericTerms = ['Epistemology', 'Methodology', 'Inductive Reasoning'];
const isolationTest = extractFallbackTermsFromText(testCases[0].content, 'test', testCases[0].title);
const leaked = genericTerms.filter(gt => isolationTest.some(t => t.term.includes(gt)));

if (leaked.length === 0) {
  console.log("PASS: No generic academic terms leaked into the extraction.");
} else {
  console.log(`FAIL: Leaked generic terms: ${leaked.join(', ')}`);
  process.exit(1);
}
