// bahthOS server quota module: shared constants/keys and helpers.
// Non-frozen; covers AI routes (including frozen glossary.ts via rateLimit).

import type { Request } from "express";

export type QuotaGroup =
  | "analyze"
  | "synthesis"
  | "glossary"
  | "chat"
  | "followup"
  | "tts";

export function resolveQuotaGroup(path: string): QuotaGroup | null {
  if (!path) return null;
  // Normalize
  let p = path;
  // strip query
  const q = p.indexOf("?");
  if (q >= 0) p = p.slice(0, q);

  // Mount points: routers mounted at root, so path is /api/...
  if (p === "/api/analyze-document" || p === "/api/extract-text") return "analyze";
  if (p === "/api/synthesize") return "synthesis";
  if (p === "/api/extract-glossary" || p === "/api/sweep-glossary") return "glossary";
  if (p === "/api/chat") return "chat";
  if (p === "/api/report-followup") return "followup";
  if (p === "/api/tts") return "tts";
  return null;
}

// Read int from env with default
function getInt(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return def;
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return n;
}

export const REQUIRE_SIGNIN = process.env.REQUIRE_SIGNIN === "true";
export const QUOTA_FAIL_CLOSED = process.env.QUOTA_FAIL_CLOSED !== "false"; // default true
// Global daily AI circuit breaker. Default 0 = DISABLED, so the first deploy
// can never accidentally brick AI before the operator opts in (set a positive
// value, e.g. 1000, to enable).
export const GLOBAL_DAILY_AI_CAP = getInt("GLOBAL_DAILY_AI_CAP", 0);

export const FREE_MONTHLY_ANALYSES = getInt("FREE_MONTHLY_ANALYSES", 25);
export const FREE_MONTHLY_SYNTHESIS = getInt("FREE_MONTHLY_SYNTHESIS", 25);
export const FREE_MONTHLY_GLOSSARY = getInt("FREE_MONTHLY_GLOSSARY", 50);
export const FREE_MONTHLY_CHAT = getInt("FREE_MONTHLY_CHAT", 100);
export const FREE_MONTHLY_FOLLOWUP = getInt("FREE_MONTHLY_FOLLOWUP", 25);
export const FREE_MONTHLY_TTS = getInt("FREE_MONTHLY_TTS", 20);

export const PRO_MONTHLY_MULTIPLIER = getInt("PRO_MONTHLY_MULTIPLIER", 10);

export const FREE_PROJECT_CHAR_BUDGET = getInt("FREE_PROJECT_CHAR_BUDGET", 60000);
export const FREE_MONTHLY_CHAR_BUDGET = getInt("FREE_MONTHLY_CHAR_BUDGET", 300000);
export const PRO_MONTHLY_CHAR_BUDGET = getInt("PRO_MONTHLY_CHAR_BUDGET", 1500000);
export const PRO_DAILY_CHAR_BUDGET = getInt("PRO_DAILY_CHAR_BUDGET", 150000);

export function groupCapFree(group: QuotaGroup): number {
  switch (group) {
    case "analyze": return FREE_MONTHLY_ANALYSES;
    case "synthesis": return FREE_MONTHLY_SYNTHESIS;
    case "glossary": return FREE_MONTHLY_GLOSSARY;
    case "chat": return FREE_MONTHLY_CHAT;
    case "followup": return FREE_MONTHLY_FOLLOWUP;
    case "tts": return FREE_MONTHLY_TTS;
    default: return 5;
  }
}

export function groupCapPro(group: QuotaGroup): number {
  const base = groupCapFree(group);
  return base * PRO_MONTHLY_MULTIPLIER;
}

export function groupCap(group: QuotaGroup, tier: "free" | "pro"): number {
  return tier === "pro" ? groupCapPro(group) : groupCapFree(group);
}

// Keys
export function globalDailyKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `bahthos:g:ai:${yyyy}${mm}${dd}`;
}

// rolling-ish identifier not needed; Ratelimit uses prefix + key
export function quotaPrefix(group: QuotaGroup): string {
  return `bahthos:q:${group}`;
}

export function getTokenFromReq(req: Request): string | null {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}
