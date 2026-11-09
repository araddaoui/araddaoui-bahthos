// Optional privileged Firestore writer (Option C activation path).
// Enabled only when a Firebase service account is present in the environment:
//   FIREBASE_CLIENT_EMAIL   e.g. firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY    the PKCS#8 PEM (surrounding quotes are stripped by dotenv)
//   or FIREBASE_SERVICE_ACCOUNT  the full JSON document on a single line
// When not configured, every function here degrades to a silent no-op/false so
// the existing client-assisted activation flow keeps working unchanged.
import { SignJWT, importPKCS8 } from "jose";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0535812922";
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "ai-studio-bahthosos-387d5c26-c1cd-4070-97da-dc8503fc3a7f";

function serviceAccount(): { clientEmail: string; privateKey: string } | null {
  const single = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (single) {
    try {
      const parsed = JSON.parse(single);
      if (parsed?.client_email && parsed?.private_key) {
        return { clientEmail: parsed.client_email, privateKey: String(parsed.private_key) };
      }
    } catch (e) {
      console.warn("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
      return null;
    }
  }
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  if (!email || !key.includes("PRIVATE KEY")) return null;
  return { clientEmail: email, privateKey: key };
}

export function hasFirebaseAdmin(): boolean {
  return serviceAccount() !== null;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const acct = serviceAccount();
  if (!acct) throw new Error("Firebase service account is not configured.");
  const key = await importPKCS8(acct.privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(acct.clientEmail)
    .setSubject(acct.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`[firebaseAdmin] OAuth token exchange failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as any;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.token;
}

export interface ProfilePatch {
  tier?: string;
  planType?: string;
  expiresAt?: number | null; // epoch ms; omitted = untouched, null = clear field value
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// Patch only the given fields of users/{uid} in Firestore (updateMask).
// Returns true when the privileged write happened, false when the service
// account is not configured. Throws on transport/API failure (callers should
// catch and degrade to the client-persisted flow).
export async function adminPatchUserProfile(uid: string, patch: ProfilePatch): Promise<boolean> {
  if (!hasFirebaseAdmin()) return false;
  const token = await getAccessToken();

  const fields: Record<string, any> = {};
  const mask: string[] = [];
  const set = (name: string, value: any) => {
    fields[name] = value;
    mask.push(name);
  };
  if (patch.tier !== undefined) set("tier", { stringValue: patch.tier });
  if (patch.planType !== undefined) set("planType", { stringValue: patch.planType });
  if (patch.expiresAt !== undefined) {
    set("expiresAt", patch.expiresAt === null ? { nullValue: null } : { integerValue: String(Math.trunc(patch.expiresAt)) });
  }
  if (patch.stripeCustomerId !== undefined) set("stripeCustomerId", { stringValue: patch.stripeCustomerId });
  if (patch.stripeSubscriptionId !== undefined) set("stripeSubscriptionId", { stringValue: patch.stripeSubscriptionId });
  if (mask.length === 0) return true;

  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}` +
    `/databases/${FIREBASE_DATABASE_ID}/documents/users/${encodeURIComponent(uid)}` +
    `?${mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&")}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`[firebaseAdmin] Firestore PATCH failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return true;
}
