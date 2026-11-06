// Reviewer access mode: time-boxed, passcode-gated, budget-capped entry for
// external product reviewers (bahthos.app/review). Fail-closed everywhere:
// without REVIEWER_CODES / REVIEW_MODE_UNTIL set, every null returned below
// keeps the regular access rules applied unchanged.

import { createHash } from "node:crypto";
import type { Request } from "express";

export const REVIEWER_HEADER = "x-reviewer-code";

// Review window: access allowed only while now < REVIEW_MODE_UNTIL (ISO).
// Absent, malformed, or past = reviewer mode fully disabled (fail closed).
export function reviewWindowActive(): boolean {
  const raw = process.env.REVIEW_MODE_UNTIL;
  if (!raw) return false;
  const until = new Date(raw);
  if (isNaN(until.getTime())) return false;
  return Date.now() < until.getTime();
}

export function reviewerCodes(): string[] {
  return (process.env.REVIEWER_CODES || "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// AI requests allowed per reviewer passcode per day. Default 10.
export function reviewDailyCap(): number {
  const n = parseInt(process.env.REVIEW_DAILY_AI_CAP || "", 10);
  return isNaN(n) || n < 1 ? 10 : n;
}

// Anonymous hash of the passcode so the raw secret never lands in Redis keys
// or logs.
function codeKeyHash(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex").slice(0, 16);
}

export function reviewerRedisKey(code: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `bahthos:review:d:${yyyy}${mm}${dd}:${codeKeyHash(code)}`;
}

// Resolves the valid reviewer passcode from the request: header present,
// listed in REVIEWER_CODES, and inside the review window. Returns null when
// the request is not a valid reviewer request; callers must then treat the
// caller exactly as they would without the header (no widened access).
export function resolveReviewer(req: Request): string | null {
  const header = req.header(REVIEWER_HEADER);
  if (!header) return null;
  const code = header.trim();
  if (!code) return null;
  if (!reviewWindowActive()) return null;
  if (!reviewerCodes().includes(code)) return null;
  return code;
}

// Used by the quota-status route: lets the client distinguish a wrong
// passcode from a used/expired one without leaking anything (both resolve to
// the same "retry" affordance client-side). Returns "active" | "invalid".
export function reviewerHeaderStatus(req: Request): "active" | "invalid" | null {
  const header = req.header(REVIEWER_HEADER);
  if (header === undefined || header === null) return null;
  return resolveReviewer(req) !== null ? "active" : "invalid";
}
