import { Ratelimit } from "@upstash/ratelimit";
import type { Request, Response, NextFunction } from "express";
import { getRedis } from "./cache.js";
import { clientKey, getAuthContext } from "./auth.js";
import { resolveQuotaGroup, REQUIRE_SIGNIN, QUOTA_FAIL_CLOSED, GLOBAL_DAILY_AI_CAP, groupCap, globalDailyKey, quotaPrefix } from "./quota.js";
import { resolveTier } from "./tier.js";

let minuteLimiter: Ratelimit | null = null;
let dayLimiter: Ratelimit | null = null;
let initialized = false;

function getLimiters() {
  if (!initialized) {
    initialized = true;
    const redis = getRedis();
    if (redis) {
      minuteLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "bahthos:rl:m", analytics: false });
      dayLimiter = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(500, "1 d"), prefix: "bahthos:rl:d", analytics: false });
    }
  }
  return { minute: minuteLimiter, day: dayLimiter };
}



export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const limiters = getLimiters();
  const group = resolveQuotaGroup(req.path);
  const auth = getAuthContext(req);
  const bypass = process.env.BYPASS_AUTH === "true" || process.env.VITE_BYPASS_AUTH === "true";

  // AI routes: extra guards
  if (group) {
    // Require a signed-in (non-anonymous) identity. Gated by REQUIRE_SIGNIN so
    // the client sign-in gate can ship first; flip the env var to enforce.
    if (REQUIRE_SIGNIN && !bypass) {
      if (!auth || !auth.uid || auth.isAnonymous) {
        return res.status(401).json({ error: "التوثيق مطلوب للوصول إلى هذه الخدمة.", code: "AUTH_REQUIRED" });
      }
    }

    // global daily cap (disabled when GLOBAL_DAILY_AI_CAP <= 0)
    try {
      const redis = getRedis();
      if (redis && GLOBAL_DAILY_AI_CAP > 0) {
        const gk = globalDailyKey();
        const cur = await redis.incr(gk);
        if (cur === 1) {
          // expire 2d
          await redis.expire(gk, 2 * 24 * 60 * 60);
        }
        if (cur > GLOBAL_DAILY_AI_CAP) {
          const code = QUOTA_FAIL_CLOSED ? 503 : 429;
          return res.status(code).json({ error: "نظام الذكاء الاصطناعي مشغول حالياً، الرجاء المحاولة بعد قليل.", code: "GLOBAL_CAP", retryable: true });
        }
      }
    } catch (e) {
      if (QUOTA_FAIL_CLOSED) {
        return res.status(503).json({ error: "فشل التحقق من الحصة العامة، الرجاء المحاولة لاحقاً.", code: "QUOTA_CHECK_FAILED", retryable: true });
      }
    }

    // tier + monthly
    const tier = await resolveTier(req);
    (req as any).tier = tier;
    try {
      const redis = getRedis();
      if (redis) {
        const cap = groupCap(group, tier);
        const ident = clientKey(req);
        const pfx = quotaPrefix(group);
        const k = `${pfx}:${ident}:${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const cur = await redis.incr(k);
        if (cur === 1) await redis.expire(k, 30 * 24 * 60 * 60);
        res.setHeader("X-Quota-Limit", String(cap));
        res.setHeader("X-Quota-Remaining", String(Math.max(0, cap - cur)));
        if (cur > cap) {
          return res.status(429).json({ error: "تم تجاوز الحصة الشهرية المجانية.", code: "QUOTA_EXCEEDED", retryable: false });
        }
      }
    } catch (e) {
      if (QUOTA_FAIL_CLOSED) {
        return res.status(503).json({ error: "فشل التحقق من الحصة الشهرية.", code: "QUOTA_CHECK_FAILED", retryable: true });
      }
    }
  }

  // existing per-identity limiter
  if (limiters.minute && limiters.day) {
    const key = clientKey(req);
    try {
      const [minute, day] = await Promise.all([limiters.minute.limit(key), limiters.day.limit(key)]);
      res.setHeader("X-RateLimit-Remaining", String(Math.min(minute.remaining, day.remaining)));
      if (!minute.success || !day.success) {
        const reset = Math.max(minute.reset, day.reset);
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))));
        return res.status(429).json({ error: "تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل.", code: "RATE_LIMITED", retryable: true });
      }
    } catch (err) {
      console.warn("[rateLimit] check failed (failing open):", err);
    }
  }
  return next();
}
