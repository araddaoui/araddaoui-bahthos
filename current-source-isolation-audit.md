# bahthOS Technological Audit and Corrective Measures Report

## Executive Summary

This report documents the technological audit and corrective measures implemented for **bahthOS**, an Arabic academic research assistant. The work has addressed deployment constraints, tenant isolation, source grounding, Arabic-only output, report presentation, and the comfort and reliability of the Al-Dalil briefing interface.

## Definitive Al-Dalil Reader and Speaker Fix

The Al-Dalil card now uses a **pure white scholarly-paper reading surface** inside the existing dark teal brand frame. The inner content area is `bg-white` with deep charcoal-teal typography, increased line spacing, a soft neutral border, and no dark color wash behind the text. The surrounding frame, header, buttons, teal accents, and amber interaction highlights remain in place, preserving the application motif without allowing the branding to interfere with reading.

The visible reader no longer displays raw document file names, URLs, file extensions, timestamped identifiers, or `||` pause markers. The content is divided into clean paragraphs, and the visual highlight is reserved for the sentence currently being narrated.

The speaker behavior was re-engineered to eliminate the silent “strolling” behavior. The prior fallback could move the highlight on a timer even when no sound was produced. The new implementation advances to the next segment only from an actual audio `ended` event or a Web Speech `onend` event. There is no timer-based visual progression. Browser voices are loaded before fallback speech, Arabic voices are preferred, generated audio is explicitly loaded before playback, and the interface shows an Arabic diagnostic notice instead of silently moving through the text when the browser cannot produce sound.

| Area | Definitive Change | Result |
| :--- | :--- | :--- |
| **Inner background** | Changed from tinted teal to `bg-white`. | Clear reading surface with no color clutter. |
| **Typography** | Deep charcoal-teal text with generous line spacing. | More breathable Arabic reading experience. |
| **Visible content** | Removed raw filenames, extensions, URLs, identifiers, and `||` markers. | Research meaning receives priority. |
| **Narration synchronization** | Removed timer-driven segment advancement. | Highlights cannot stroll without a real speech/audio completion event. |
| **Browser fallback** | Waits for voices and prefers Arabic speech voices. | Better audible fallback when generated TTS is unavailable. |
| **Generated audio** | Calls `audio.load()` and binds play/pause/ended events. | More reliable playback and synchronization. |
| **Failure behavior** | Shows an Arabic audio notice when no speech engine or output is available. | Silent failure is replaced by actionable feedback. |

## Earlier Corrective Measures

The earlier audit also addressed deployment, security, grounding, and report-generation quality.

| Category | Issue Identified | Corrective Strategy |
| :--- | :--- | :--- |
| **Deployment** | Vercel 4.5MB payload and 60s timeout limits. | Client-side text extraction for PDF/Word files and sequential batch upload processing. |
| **Data security** | Potential cross-project and cross-user data leakage. | Strict Firestore owner-only rules and scoped local-storage namespaces. |
| **Project isolation** | Stale context from previous projects appearing in new briefings. | Source fingerprinting, hard project-boundary resets, and summary sanitization. |
| **Report formatting** | Disjointed tables, cumbersome citations, and raw foreign quotations. | Refined prompts, bibliographic cleanup, and Arabic translation of foreign quotes. |
| **Language integrity** | Mixed Arabic and English in follow-up answers. | Arabic-only system instructions across chat, synthesis, and follow-up routers. |

## Validation

The final validation suite passed TypeScript checking, production bundling, summary isolation, follow-up cleanup, the TTS endpoint response contract, and static Reader Mode/audio markers. The TTS contract test confirms that the endpoint returns a valid response shape and graceful fallback when a valid Gemini credential is unavailable in the sandbox. Actual audible Gemini playback requires the valid production `GEMINI_API_KEY` and a browser with an enabled audio output.

| Test Case | Result |
| :--- | :--- |
| `npm run lint` | **Passed** |
| `npm run build` | **Passed** |
| Summary repair and stale-context rejection | **Passed** |
| Follow-up URL and publisher-noise cleanup | **Passed** |
| TTS endpoint response contract | **Passed** |
| White Reader Mode marker | **Passed** |
| No-silent-strolling marker | **Passed** |

## References

1. [bahthOS Source Code Repository](https://github.com/araddaoui/araddaoui-bahthos)
2. [Google Gemini AI Documentation](https://ai.google.dev/docs)
3. [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
4. [Vercel Serverless Function Limits](https://vercel.com/docs/functions/serverless-functions/limitations)
