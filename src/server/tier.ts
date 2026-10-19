// Tier resolution: Firestore REST + Redis cache (Option C)
import { getRedis } from "./cache.js";
import type { Request } from "express";
import { getTokenFromReq } from "./quota.js";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0535812922";
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "ai-studio-bahthosos-387d5c26-c1cd-4070-97da-dc8503fc3a7f";

export async function resolveTier(req: Request): Promise<"free" | "pro"> {
  const token = getTokenFromReq(req);
  const auth = (req as any).auth;
  const uid = auth?.uid;
  if (!uid || auth?.isAnonymous) return "free";

  const redis = getRedis();
  const cacheKey = `bahthos:tier:${uid}`;
  // try cache
  try {
    if (redis) {
      const cached = await redis.get<string>(cacheKey);
      if (cached === "pro") return "pro";
      if (cached === "free") return "free";
    }
  } catch (e) {
    // ignore
  }

  let tier: "free" | "pro" = "free";
  // try Firestore REST
  if (token) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/users/${uid}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const fields = data?.fields || {};
        const t = fields?.tier?.stringValue;
        const exp = fields?.expiresAt?.integerValue ?? fields?.expiresAt?.doubleValue;
        if (t === "pro_stripe" || t === "pro_tnd_active") {
          if (!exp || Date.now() < parseInt(String(exp), 10)) {
            tier = "pro";
          } else {
            tier = "free";
          }
        } else if (t === "pro_tnd_pending") {
          // pending not pro
          tier = "free";
        } else {
          tier = "free";
        }
      }
    } catch (e) {
      tier = "free";
    }
  }

  // cache
  try {
    if (redis) {
      await redis.set(cacheKey, tier, { ex: 300 });
    }
  } catch (e) {
    // ignore
  }

  return tier;
}
