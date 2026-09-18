import { Request, Response, NextFunction } from "express";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  isGuest: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

let firebaseAdminApp: App | null = null;
let adminFirestore: Firestore | null = null;

export function getAdminAuth() {
  if (!firebaseAdminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseAdminApp = existingApps[0];
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0535812922";
      try {
        firebaseAdminApp = initializeApp({
          projectId,
        });
      } catch (error) {
        console.warn("[Firebase Admin] Initialization warning:", error);
      }
    }
  }
  return firebaseAdminApp ? getAuth(firebaseAdminApp) : getAuth();
}

export function hasAdminFirestoreCredentials(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_CONFIG_ADMIN
  );
}

export function getAdminFirestore(): Firestore | null {
  if (!hasAdminFirestoreCredentials()) {
    return null;
  }
  if (!adminFirestore) {
    if (!firebaseAdminApp) {
      getAdminAuth();
    }
    const dbId = process.env.FIRESTORE_DATABASE_ID || "ai-studio-bahthosos-387d5c26-c1cd-4070-97da-dc8503fc3a7f";
    try {
      adminFirestore = firebaseAdminApp ? getFirestore(firebaseAdminApp, dbId) : getFirestore(dbId);
    } catch (e) {
      console.warn("[Firebase Admin] Using default firestore database instance:", e);
      adminFirestore = firebaseAdminApp ? getFirestore(firebaseAdminApp) : getFirestore();
    }
  }
  return adminFirestore;
}

/**
 * Isolated Authentication Middleware:
 * - Reads HTTP header `Authorization: Bearer <token>`.
 * - Verifies ID token with `firebase-admin/auth` and attaches `req.user = { uid, email, isGuest: false }`.
 * - Preserves Guest Mode for localStorage users when `x-guest-mode: true` or `Bearer guest-token` is present.
 * - Returns 401 Unauthorized when a token is missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Allow OPTIONS pre-flight requests to pass through
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  const guestHeader = req.headers["x-guest-mode"];

  // 1. Check for Guest Mode preservation
  if (
    guestHeader === "true" || 
    authHeader === "Bearer guest-token" || 
    authHeader === "Bearer guest"
  ) {
    req.user = {
      uid: "guest-user",
      email: null,
      isGuest: true,
    };
    return next();
  }

  // 2. Check for Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "غير مصرح لك بالوصول (401 Unauthorized): يرجى تسجيل الدخول أو المتابعة كضيف.",
      code: "auth/missing-token",
    });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();

  if (!token) {
    return res.status(401).json({
      error: "غير مصرح لك بالوصول (401 Unauthorized): رمز المصادقة غير موجود.",
      code: "auth/missing-token",
    });
  }

  try {
    const authService = getAdminAuth();
    const decodedToken = await authService.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      isGuest: false,
    };
    return next();
  } catch (err: any) {
    console.error("[Auth Middleware] Token verification failed:", err?.message || err);
    return res.status(401).json({
      error: "غير مصرح لك بالوصول (401 Unauthorized): رمز المصادقة غير صالح أو منتهي الصلاحية.",
      code: "auth/invalid-token",
      details: err?.code || "invalid_token",
    });
  }
}
