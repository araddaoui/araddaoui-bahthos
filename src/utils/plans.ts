// Freemium plan model, quota constants, pricing, and helpers for bahthOS.
// Non-frozen support module for the billing/quota feature.

export type SubscriptionTier = "free" | "pro_stripe" | "pro_tnd_pending" | "pro_tnd_active";
export type PlanType = "monthly" | "yearly" | "none";

export interface UserPlanProfile {
  uid: string;
  email: string;
  tier: SubscriptionTier;
  planType: PlanType;
  expiresAt: number | null; // epoch milliseconds, null = never / n/a
  role?: string;
}

// ---------- Free tier hard caps ----------
export const FREE_PROJECT_LIMIT = 2;
export const FREE_SOURCE_LIMIT = 5;

// ---------- Stripe USD pricing (minor units) ----------
export const STRIPE_PRICES: Record<PlanType, number> = {
  monthly: 1500, // $15.00 USD/month
  yearly: 14000, // $140.00 USD/year
  none: 0,
};

// ---------- Local TND pricing ----------
export const TND_PRICES: Record<PlanType, number> = {
  monthly: 10, // 10 TND/month
  yearly: 100, // 100 TND/year
  none: 0,
};

// Local Tunisian payment details for the TND billing channel.
export const TND_PAYMENT_DETAILS = {
  ccp: "0000753224",
  dinarSmart: "5359401734947308", // E-Dinar / DINAR SMART card
  holder: "بحث OS (bahthOS)",
};

export const GUEST_PLAN_STORAGE_KEY = "bahthos_plan";

// ---------- Helpers ----------

// Effective tier accounts for subscription expiry: any paid tier whose
// expiresAt has passed is treated as "free". "pending" tiers stay pending.
export function resolveEffectiveTier(profile: UserPlanProfile | null | undefined): SubscriptionTier {
  const tier = profile?.tier ?? "free";
  if (tier !== "pro_stripe" && tier !== "pro_tnd_active") return tier;
  if (profile?.expiresAt && Date.now() > profile.expiresAt) return "free";
  return tier;
}

export function isUnlimitedTier(tier: SubscriptionTier): boolean {
  return tier === "pro_stripe" || tier === "pro_tnd_active";
}

export function addMonthsToNow(months: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function tierBadgeLabel(tier: SubscriptionTier): { text: string; className: string } {
  switch (tier) {
    case "free":
      return { text: "مجانية", className: "bg-gray-100 text-gray-600 border border-gray-200" };
    case "pro_stripe":
      return { text: "Pro USD", className: "bg-teal-600 text-white border border-teal-700" };
    case "pro_tnd_pending":
      return { text: "قيد المراجعة TND", className: "bg-amber-50 text-amber-700 border border-amber-200" };
    case "pro_tnd_active":
      return { text: "Pro TND نشط", className: "bg-emerald-600 text-white border border-emerald-700" };
    default:
      return { text: "مجانية", className: "bg-gray-100 text-gray-600 border border-gray-200" };
  }
}

// Admin detection: either the Firestore profile carries role==="admin", or the
// account email is listed in VITE_ADMIN_EMAILS (comma-separated).
export function isAdminUser(profile: UserPlanProfile | null | undefined, email?: string | null): boolean {
  if (profile?.role === "admin") return true;
  if (!email) return false;
  const configured = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}

export function formatExpiryDate(expiresAt: number | null | undefined): string {
  if (!expiresAt) return "";
  try {
    return new Date(expiresAt).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return "";
  }
}