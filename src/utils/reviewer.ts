// Reviewer session helpers for the bahthos.app/review entry (client side).
// The passcode only unlocks the CLIENT UI; the server independently validates
// every /api call via the x-reviewer-code header against REVIEWER_CODES and
// REVIEW_MODE_UNTIL (server env vars), and enforces REVIEW_DAILY_AI_CAP.

const REVIEWER_CODE_KEY = "bahthos_review_code";
const REVIEW_PATH = "/review";

export function isReviewPath(): boolean {
  try {
    return window.location.pathname === REVIEW_PATH;
  } catch (e) {
    return false;
  }
}

// Client-side mirror of the review window (build-time env). Used only to show
// the "review period has ended" screen; the server re-enforces its own window
// on every request, so any client UX drift can never widen access.
export function isReviewWindowOver(): boolean {
  const raw = import.meta.env.VITE_REVIEW_MODE_UNTIL;
  if (!raw) return false;
  const t = Date.parse(raw);
  if (isNaN(t)) return false;
  return Date.now() >= t;
}

export function activeReviewerCode(): string | null {
  try {
    const code = sessionStorage.getItem(REVIEWER_CODE_KEY);
    if (code && code.length > 0) return code;
  } catch (e) {}
  return null;
}

export function storeReviewerCode(code: string): void {
  try {
    sessionStorage.setItem(REVIEWER_CODE_KEY, code);
  } catch (e) {}
}
