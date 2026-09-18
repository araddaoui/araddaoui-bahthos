export const extractTerms = (...args: any[]) => [];
export const extractFallbackTermsFromText = (...args: any[]) => [];
export const spellcheckAndRepairArabicAndEnglishText = (...args: any[]) => "";
export const spellcheckAndRepairArabicAndEnglish = (...args: any[]) => "";
export const ensureArabicSummary = (...args: any[]) => "";
export const detectSourceLanguage = (...args: any[]) => "ar";
export const stripArabicDiacritics = (text: string = "") => text.replace(/[\u064B-\u065F]/g, "");
export const stripArabicTashkeel = (text: string = "") => text.replace(/[\u064B-\u065F]/g, "");
export const stripArabicParticlesAndNumbers = (text: string = "") => text;
export const normalizeArabicText = (text: string = "") => text;
export const cleanArabicText = (text: string = "") => text;
export default extractTerms;

export const cleanAndSanitizeAcademicTerm = (term: string = "") => term.trim();
export const isTrivialOrCitationTerm = (...args: any[]) => false;
export const sanitizeSourceSummary = (text: string = "") => text;
export const areTermsEquivalent = (a: string = "", b: string = "") => a === b;
export const extractAcademicTerms = (...args: any[]) => [];

export const buildContextPayload = (...args: any[]) => ({});
export const buildContextFromSources = (...args: any[]) => ({});
export const buildContext = (...args: any[]) => ({});

export const buildContextDefinition = (...args: any[]) => ({});
export const buildContextDefinitionPayload = (...args: any[]) => ({});
