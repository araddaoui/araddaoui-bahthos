import { auth } from "../firebase.js";
import { activeReviewerCode } from "./reviewer.js";

// Returns a fresh Firebase ID token for the current user (including anonymous
// guests), or null when nobody is signed in / the token cannot be minted.
export async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (err) {
    console.warn("authFetch: unable to obtain an ID token", err);
    return null;
  }
}

// fetch() wrapper that attaches the caller's Firebase ID token as a Bearer
// header so the API can authenticate and rate-limit per user. When a reviewer
// session is active (/review passcode), the passcode rides along as
// x-reviewer-code so the server can grant time-boxed, capped access.
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const reviewerCode = activeReviewerCode();
  if (reviewerCode && !headers.has("x-reviewer-code")) {
    headers.set("x-reviewer-code", reviewerCode);
  }
  return fetch(input, { ...init, headers });
}
