import { getAuthHeaders, auth, db } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";

export interface BillingStatus {
  tier: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isGuest: boolean;
}

/**
 * Fetches the user's current subscription status from /api/billing/status
 * with seamless fallback to client-side Firestore.
 */
export async function fetchBillingStatus(): Promise<BillingStatus> {
  const isGuest = !auth.currentUser;
  let statusResult: BillingStatus = {
    tier: "free",
    status: "none",
    currentPeriodEnd: null,
    stripeCustomerId: null,
    isGuest,
  };

  // 1. Query the backend API endpoint
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch("/api/billing/status", {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.tier === "string") {
        statusResult = {
          tier: data.tier === "pro" ? "pro" : "free",
          status: data.status || "none",
          currentPeriodEnd: data.currentPeriodEnd || null,
          stripeCustomerId: data.stripeCustomerId || null,
          isGuest: !!data.isGuest,
        };
      }
    }
  } catch (err) {
    console.warn("[Billing Client] Server status check fallback:", err);
  }

  // 2. If status is still free and user is authenticated, check client-side Firestore directly
  if (statusResult.tier !== "pro" && auth.currentUser) {
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const sub = userSnap.data()?.subscription;
        if (sub && sub.tier === "pro") {
          statusResult = {
            tier: "pro",
            status: sub.status || "active",
            currentPeriodEnd: sub.currentPeriodEnd || null,
            stripeCustomerId: sub.stripeCustomerId || null,
            isGuest: false,
          };
        }
      }
    } catch (e) {
      // Client Firestore silent fallback
    }
  }

  return statusResult;
}

/**
 * Initiates Stripe Checkout session and redirects user to checkout page
 */
export async function redirectToCheckout(): Promise<{ error?: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || "تعذر بدء عملية الدفع والاشتراك." };
    }
    if (data.url) {
      window.location.href = data.url;
      return {};
    }
    return { error: "لم يتم استلام رابط صفحة الدفع من الخادم." };
  } catch (err: any) {
    return { error: err?.message || "حدث خطأ غير متوقع أثناء الاتصال بخادم الدفع." };
  }
}

/**
 * Initiates Stripe Customer Portal session and redirects user to manage subscriptions
 */
export async function redirectToCustomerPortal(): Promise<{ error?: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch("/api/billing/create-portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || "تعذر فتح بوابة إدارة الاشتراك." };
    }
    if (data.url) {
      window.location.href = data.url;
      return {};
    }
    return { error: "لم يتم استلام رابط بوابة المشتركين من الخادم." };
  } catch (err: any) {
    return { error: err?.message || "حدث خطأ أثناء الاتصال ببوابة Stripe." };
  }
}
