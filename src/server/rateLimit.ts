import { Ratelimit } from "@upstash/ratelimit";
import type { Request, Response, NextFunction } from "express";
import { getRedis } from "./cache.js";
import { clientKey } from "./auth.js";

let minuteLimiter: Ratelimit | null = null;
let dayLimiter: Ratelimit | null = null;
let initialized = false;

function getLimiters(): { minute: Ratelimit; day: Ratelimit } | null {
  if (!initialized) {
    initialized = true;
    const redis = getRedis();
    if (redis) {
      minuteLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "bahthos:rl:m",
        analytics: false,
      });
      dayLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(500, "1 d"),
        prefix: "bahthos:rl:d",
        analytics: false,
      });
    }
  }
  if (!minuteLimiter || !dayLimiter) return null;
  return { minute: minuteLimiter, day: dayLimiter };
}

// Per-identity dual-window rate limiting (30/min and 500/day). Fails open: if
// Redis is unavailable or errors, the request proceeds rather than 500-ing.
export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const limiters = getLimiters();
  if (!limiters) return next();

  const key = clientKey(req);
  try {
    const [minute, day] = await Promise.all([
      limiters.minute.limit(key),
      limiters.day.limit(key),
    ]);

    res.setHeader("X-RateLimit-Remaining", String(Math.min(minute.remaining, day.remaining)));

    if (!minute.success || !day.success) {
      const reset = Math.max(minute.reset, day.reset);
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))));
      return res.status(429).json({
        error: "تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل.",
        code: "RATE_LIMITED",
        retryable: true,
      });
    }

    return next();
  } catch (err) {
    console.warn("[rateLimit] check failed (failing open):", err);
    return next();
  }
}
