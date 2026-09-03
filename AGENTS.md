# bahthOS — Agent Working Agreement

This file is auto-loaded by opencode (via `opencode.json` `instructions`).
Read and follow it on every task.

## Freeze: term extraction pipeline (READ-ONLY)

The following files implement the academic-term extraction, de-duplication,
normalization, and glossary assembly logic. The user has verified this
algorithm and wants it **frozen** so it is never contaminated, refactored, or
silently changed by future edits.

**Read-only files:**
- `src/utils/termExtractor.ts`
- `src/server/routers/glossary.ts`
- `src/server/routers/documents.ts` (only the `sanitizeAndRepairTermsPipeline`
  usage / fallback-extraction path is frozen; the PDF/Word parsing and
  `api` routing logic are NOT frozen)
- `src/server/pdfDomGlobals.ts`
- `api/index.ts`

**Frozen identifiers (do not modify their signatures or behavior):**
- `sanitizeAndRepairTermsPipeline`
- `extractFallbackTermsFromText`
- `areTermsEquivalent`
- `isTrivialOrCitationTerm`
- `normalizeArabicText`
- `cleanAndSanitizeAcademicTerm`
- `SCHOLARLY_CONCEPTS_REGISTRY` / `ACADEMIC_TERMS_MAP`
- `cleanAndMigrateGlossary`, `ensureEverySourceHasTerms` (in `src/App.tsx`)

**Rules:**
1. Do NOT edit these files or the behavior of these identifiers without the
   user's explicit, per-change approval.
2. Do NOT "improve", rename, reorder, or reformat the extraction algorithm.
3. If a build breaks them, fix the minimal breakage and nothing more, then
   report what changed.
4. New code must call the frozen API; it must not rewrite it.
5. The **evidence-matrix / synthesis report generation** is a separate concern
   (rendering of tables) and is NOT frozen.

## Table / Arabic rendering conventions

- Arabic/mixed tables must never produce empty rows or stray `|` cells.
- If the AI emits raw markdown table rows with empty cells, the client renderer
  must sanitize them (drop empty lines, merge stray pipes) so the table is
  well-formed.
- Column text must not be chunked; the renderer should leave words whole.