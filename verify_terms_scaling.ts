
import { extractFallbackTermsFromText } from './src/utils/termExtractor.ts';
// import { ensureEverySourceHasTerms } from './src/App.tsx'; // Skip App.tsx import to avoid React dependencies in CLI test

const mockSources = [
  { id: 's1', title: 'International Relations Theory', content: 'This document discusses methodology and theoretical framework in IR.' },
  { id: 's2', title: 'Geopolitics of Middle East', content: 'Empirical evidence suggests a shift in quantitative analysis of regional conflicts.' },
  { id: 's3', title: 'Economic Policy in UAE', content: 'A case study on economic policy and sovereign wealth funds.' },
  { id: 's4', title: 'Global Health Governance', content: 'Exploring the paradigm shift in global health governance and ethics.' },
  { id: 's5', title: 'Artificial Intelligence Ethics', content: 'Analyzing the conceptual model of AI ethics and causality in decision making.' },
  { id: 's6', title: 'Climate Change Adaptation', content: 'A comparative study on climate change resilience and inductive reasoning.' },
  { id: 's7', title: 'Digital Transformation in Education', content: 'Discourse analysis of digital transformation and epistemology in learning.' },
  { id: 's8', title: 'Urban Planning and Sustainability', content: 'Triangulation of data in urban planning and sustainability frameworks.' }
];

console.log("--- Testing Term Generation Engine Scaling ---");

let glossary: any[] = [];
mockSources.forEach((source, index) => {
    const newTerms = extractFallbackTermsFromText(source.content, source.id, source.title);
    glossary = [...glossary, ...newTerms];
    console.log(`Added Source ${index + 1}: ${source.title}`);
    console.log(`Terms extracted for this source: ${newTerms.length}`);
});

console.log("\n--- Final Glossary Audit ---");
console.log(`Total Sources: ${mockSources.length}`);
console.log(`Total Terms in Glossary: ${glossary.length}`);

const perSourceCounts = mockSources.map(s => {
    return { title: s.title, count: glossary.filter(t => t.sourceId === s.id).length };
});

console.table(perSourceCounts);

if (glossary.length >= mockSources.length * 2) {
    console.log("\nSUCCESS: Term generation engine scaled proportionally with sources.");
} else {
    console.log("\nFAILURE: Term generation engine failed to scale.");
    process.exit(1);
}
