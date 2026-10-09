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
6. **Approved exception (2026-10-08):** `src/utils/termExtractor.ts` string
   literals were mechanically de-mojibaked (cp1252 → UTF-8, no logic changes)
   with the user's explicit approval. If this file (or any frozen file) ever
   shows `Ø`/`Ù` mojibake again, repair the encoding only — never rewrite the
   algorithm — and get explicit approval first.

## Deployment & source of truth

- **Production** = bahthos.app, served by **Vercel** project `araddaoui-bahthos`
  (project id in `.vercel/project.json`), deployed from **GitHub
  `araddaoui/araddaoui-bahthos` branch `main`**. There is no separate server
  codebase.
- **This desktop checkout can lag origin by weeks.** ALWAYS run `git fetch`
  and compare `HEAD` with `origin/main` before diagnosing anything. The
  deployed build fingerprint: page title `بحث OS | bahthOS`, `/api/health`
  returns 404 with body `Unknown API route`.
- **No server-side auth exists** on main (all routes are open; an optional
  `BYPASS_AUTH`/`VITE_BYPASS_AUTH` flag was added in `436426be`). Live API
  probes are read-only-possible via header `x-guest-mode: true`.

## Known failure modes (diagnosed 2026-10-08, keep this section updated)

- **Garbled Arabic auto-summaries + exactly-2-terms** were caused by
  cp1252-mojibake corruption of `src/utils/termExtractor.ts` string literals
  during the Sep-18/19 source-tree reconstruction — NOT by PDF extraction,
  the AI, or the server. Repaired 2026-10-08 (see freeze rule 6).
  Diagnostic signature: if Arabic UI text shows `Ø`/`Ù` sequences, the file
  was saved through a non-UTF-8 tool; repair encoding, do not rewrite code.
- **Seeing exactly 2 terms** = extraction contributed nothing (App enforces a
  min-2 title-derived-term floor at `App.tsx` ~line 245).
- **`data.fallback: true`** from `/api/analyze-document` means the AI analysis
  failed (quota/model/timeout) and the server suppressed a synthetic summary.
  The client re-synthesizes locally; `Source.fallback` marks it and the
  SourceViewer labels it `ملخص أوّلي` instead of `ملخص ذكي`.
- **AI calls can exceed Vercel's 60s limit** → gateway 504; client shows a
  per-file upload failure. Retrying is the only mitigation.
- **No local `GEMINI_API_KEY`** in this checkout's `.env` → server AI path
  cannot be reproduced locally; diagnose AI issues via Vercel logs.

## Verification workflow (run after any change touching extraction/UI)

1. `npx tsc --noEmit` must exit 0.
2. Grep any edited Arabic-bearing file for mojibake: `rg "[ØÙ][\x80-\xFF]"`.
3. Extraction repro: extract a known Arabic PDF with pdf.js, run
   `normalizeArabicText` → `ensureArabicSummary` → `extractFallbackTermsFromText`
   (esbuild-bundled script is fine) and assert: summary contains no `Ø`/`Ù`
   and terms are non-empty.
4. Never trust the PowerShell console for Arabic output (codepage mangles it);
   write results to a UTF-8 file and use the Read tool.

## Table / Arabic rendering conventions

- Arabic/mixed tables must never produce empty rows or stray `|` cells.
- If the AI emits raw markdown table rows with empty cells, the client renderer
  must sanitize them (drop empty lines, merge stray pipes) so the table is
  well-formed.
- Column text must not be chunked; the renderer should leave words whole.

## API hardening (auth + cache + rate limit)

- `src/server/auth.ts` (`requireAuth`) verifies Firebase ID tokens via Google
  JWKS (`jose`) against `FIREBASE_PROJECT_ID`. `ENFORCE_API_AUTH=true` returns
  401; `false` is warn-only (attaches `req.auth` when valid, never blocks).
  `BYPASS_AUTH`/`VITE_BYPASS_AUTH` skip verification entirely (local dev).
- `src/server/cache.ts` holds the shared Upstash Redis client, `cacheKey`
  (sha256), `cacheGet`/`cacheSet` (60-day TTL). No env vars → no-op.
- `src/server/rateLimit.ts` applies 30/min + 500/day per identity, keyed by
  `clientKey` (uid, else IP), and fails open on Redis errors.
- Attach `requireAuth, rateLimit` **per route** (`router.post("/api/x", requireAuth, rateLimit, handler)`)
  — do NOT use a pathless `router.use(...)`: routers are mounted at `/` in the
  frozen `api/index.ts`, so a pathless `.use` would run once per router (up to
  8×) for every request, over-counting the rate limit and turning unknown
  `/api/*` into 401 instead of 404. Success responses are cached under
  `bahthos:ai:v1:<route>:<sha256>`; failure/fallback responses are never cached.
  `X-Cache: HIT|MISS` is set.
- Client: use `authFetch` from `src/utils/api.ts` for every `/api` call; it
  attaches `Authorization: Bearer <getIdToken()>`.
- Guests get an anonymous Firebase session via `ensureGuestSession()` (requires
  the Firebase Anonymous provider). `App.tsx`'s `onAuthStateChanged` treats
  `user.isAnonymous` as a guest (never as an account): it keeps `currentUser`
  null and never loads/saves Firestore data under an anonymous uid.
- Rollout: Deploy A ships this with `ENFORCE_API_AUTH=false`; only after the
  token-attach + anonymous sign-in are verified live, set
  `ENFORCE_API_AUTH=true` (Deploy B).