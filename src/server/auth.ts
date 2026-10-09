import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";

// Firebase project that issues the ID tokens. The public JWKS endpoint is the
// source of truth for verifying them, so no service-account secret is required.
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0535812922";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const jwks = createRemoteJWKSet(new URL(JWKS_URL), { cacheMaxAge: 60 * 60 * 1000 });

export interface AuthContext {
  uid: string;
  email?: string;
  isAnonymous: boolean;
}

export function getAuthContext(req: Request): AuthContext | null {
  return (req as any).auth || null;
}

function isBypassEnabled(): boolean {
  return process.env.BYPASS_AUTH === "true" || process.env.VITE_BYPASS_AUTH === "true";
}

function isEnforced(): boolean {
  return process.env.ENFORCE_API_AUTH === "true";
}

// Stable identity used for rate-limit bucketing: the authenticated uid when
// present, otherwise the caller's IP.
export function clientKey(req: Request): string {
  const auth = getAuthContext(req);
  if (auth?.uid) return `u:${auth.uid}`;
  const forwarded = req.headers["x-forwarded-for"];
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = rawForwarded?.split(",")[0]?.trim() || (req as any).ip || "unknown";
  return `ip:${ip}`;
}

// Attaches a verified AuthContext to the request. In warn-only mode
// (ENFORCE_API_AUTH !== "true") missing or invalid tokens never block a request;
// this lets Deploy A ship the middleware safely before enforcement is flipped on.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isBypassEnabled()) {
    (req as any).auth = { uid: "dev-bypass", isAnonymous: false } as AuthContext;
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    if (!isEnforced()) {
      (req as any).auth = null;
      return next();
    }
    return res.status(401).json({ error: "التوثيق مطلوب للوصول إلى هذه الخدمة.", code: "AUTH_REQUIRED" });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ["RS256"],
    });
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) throw new Error("Token is missing a subject (sub).");
    const provider = (payload as any).firebase?.sign_in_provider;
    (req as any).auth = {
      uid,
      email: typeof payload.email === "string" ? payload.email : undefined,
      isAnonymous: provider === "anonymous",
    } as AuthContext;
    return next();
  } catch (err: any) {
    if (!isEnforced()) {
      console.warn("[auth] Token verification failed (warn-only mode):", err?.message);
      (req as any).auth = null;
      return next();
    }
    return res.status(401).json({ error: "الجلسة غير صالحة أو منتهية. يرجى إعادة تسجيل الدخول.", code: "AUTH_INVALID" });
  }
}
