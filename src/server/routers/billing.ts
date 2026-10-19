import { Router } from "express";
import Stripe from "stripe";
import { requireAuth, getAuthContext } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { getRedis } from "../cache.js";
import { resolveTier } from "../tier.js";

const router = Router();

// Lazily-initialized Stripe client so imports never crash when the secret is
// missing (the checkout route then returns a clear, graceful error instead).
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) {
    stripeClient = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  }
  return stripeClient;
}

function getAppOrigin(req: any): string {
  return req?.get?.("origin") || req?.get?.("referer") || (process.env.APP_URL as string) || "http://localhost:3000";
}

// Find an existing active price created by this integration for a plan, or
// create it on first use. Keyed by metadata so repeated checkouts reuse one price.
async function resolvePlanPrice(planType: "monthly" | "yearly"): Promise<Stripe.Price> {
  const stripe = getStripe()!;
  const existing = await stripe.prices.list({ active: true, limit: 100 });
  const match = existing.data.find((p) => p.metadata?.bahthos_plan === planType);
  if (match) return match;
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: planType === "monthly" ? 1500 : 14000,
    recurring: { interval: planType === "monthly" ? "month" : "year", interval_count: 1 },
    product_data: {
      name: "bahthOS Pro",
      metadata: { bahthos_product: "1", description: "اشتراك bahthOS Pro" },
    },
    metadata: { bahthos_plan: planType },
  });
  return price;
}

// Best-effort ownership check for customer-scoped routes. Checkouts created by
// this deployment stamp `bahthos_uid` onto their subscription metadata; when a
// stamp exists and doesn't match the caller, the request is refused. Legacy
// subscriptions carry no stamp and are allowed, since there is no server-side
// uid↔customer store to consult.
async function customerBelongsToCaller(stripe: Stripe, customer: string, authUid?: string): Promise<boolean> {
  if (!authUid) return true;
  try {
    const subs = await stripe.subscriptions.list({ customer, limit: 100 });
    const stampedUids = subs.data
      .map((s) => (s.metadata as Record<string, string> | undefined)?.bahthos_uid)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (stampedUids.length === 0) return true;
    return stampedUids.includes(authUid);
  } catch (err) {
    console.warn("[billing] customer ownership check failed (allowing):", err);
    return true;
  }
}

// POST /api/billing/stripe-checkout
// Body: { planType: "monthly" | "yearly", uid, email }
router.post("/api/billing/stripe-checkout", requireAuth, rateLimit, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد. يرجى ضبط STRIPE_SECRET_KEY." });
    }
    const auth = getAuthContext(req);
    const { planType, uid: bodyUid, email: bodyEmail } = req.body || {};
    if (planType !== "monthly" && planType !== "yearly") {
      return res.status(400).json({ error: "نوع الخطة غير صالح." });
    }
    // Bind the checkout to the verified identity. The client-supplied uid/email
    // are only a fallback for warn-only mode (ENFORCE_API_AUTH=false), where no
    // verified context exists; they are never trusted while a token is present.
    const uid = auth?.uid || (typeof bodyUid === "string" ? bodyUid : "");
    const email = auth?.email || (typeof bodyEmail === "string" ? bodyEmail : "");
    if (!uid || !email) {
      return res.status(400).json({ error: "بيانات المستخدم ناقصة (uid / email)." });
    }

    const price = await resolvePlanPrice(planType);
    const origin = getAppOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: uid,
      customer_email: email,
      metadata: { bahthos_plan: planType, bahthos_uid: uid },
      subscription_data: { metadata: { bahthos_plan: planType, bahthos_uid: uid } },
      success_url: `${origin}/?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe_checkout=cancelled`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err?.message || "تعذر إنشاء جلسة الدفع." });
  }
});

// GET /api/billing/verify?session_id=<id>
// Confirms the checkout was paid and returns the resources the client needs to
// persist its own profile document.
router.get("/api/billing/verify", requireAuth, rateLimit, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد." });
    }
    const sessionId = (req.query as any).session_id as string;
    if (!sessionId) {
      return res.status(400).json({ error: "session_id مفقود." });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (!session || session.payment_status !== "paid") {
      return res.json({ ok: false, status: session?.payment_status || "unpaid" });
    }
    // A session is only claimable by the identity it was opened for, so user A
    // can never confirm (and thereby persist) user B's checkout session.
    const auth = getAuthContext(req);
    if (auth?.uid && session.client_reference_id && session.client_reference_id !== auth.uid) {
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى جلسة الدفع هذه.", code: "FORBIDDEN" });
    }

    const subscription = session.subscription as Stripe.Subscription | string | null;
    let currentPeriodEnd: number | null = null;
    let status = "active";
    if (typeof subscription === "object" && subscription) {
      currentPeriodEnd = (subscription.items.data[0]?.current_period_end || null) && subscription.items.data[0]!.current_period_end * 1000;
      status = subscription.status;
    }

    // Warm the server tier cache so the very next AI request sees "pro"
    // without waiting for a Firestore round-trip.
    try {
      const verifiedUid = session.client_reference_id || auth?.uid;
      const redis = getRedis();
      if (redis && verifiedUid) await redis.set(`bahthos:tier:${verifiedUid}`, "pro", { ex: 300 });
    } catch (e) {
      // cache warming is best-effort
    }

    res.json({
      ok: true,
      uid: session.client_reference_id,
      planType: (session.metadata as any)?.bahthos_plan || null,
      customer: typeof session.customer === "string" ? session.customer : session.customer?.id,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      currentPeriodEnd,
      status,
    });
  } catch (err: any) {
    console.error("Stripe verify error:", err);
    res.status(500).json({ error: err?.message || "تعذر التحقق من جلسة الدفع." });
  }
});

// POST /api/billing/customer-portal
// Body: { customer }
router.post("/api/billing/customer-portal", requireAuth, rateLimit, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد." });
    }
    const { customer } = req.body || {};
    if (!customer || typeof customer !== "string") {
      return res.status(400).json({ error: "customer مفقود." });
    }
    const auth = getAuthContext(req);
    if (!(await customerBelongsToCaller(stripe, customer, auth?.uid))) {
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا الحساب.", code: "FORBIDDEN" });
    }
    const origin = getAppOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/#settings`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe portal error:", err);
    res.status(500).json({ error: err?.message || "تعذر فتح بوابة إدارة الاشتراك." });
  }
});

// POST /api/billing/status
// Body: { customer } — returns the latest active subscription expiry so the
// client can refresh its own expiresAt (renewal-aware without webhooks).
router.post("/api/billing/status", requireAuth, rateLimit, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد." });
    }
    const { customer } = req.body || {};
    if (!customer || typeof customer !== "string") {
      return res.status(400).json({ error: "customer مفقود." });
    }
    const auth = getAuthContext(req);
    if (!(await customerBelongsToCaller(stripe, customer, auth?.uid))) {
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا الحساب.", code: "FORBIDDEN" });
    }
    const subs = await stripe.subscriptions.list({
      customer,
      status: "active",
      limit: 1,
    });
    const sub = subs.data[0];
    if (!sub || sub.status !== "active") {
      return res.json({ active: false });
    }
    const item = sub.items.data[0];
    const interval = item?.price?.recurring?.interval;
    const planType = interval === "year" ? "yearly" : "monthly";
    res.json({
      active: true,
      status: sub.status,
      currentPeriodEnd: (item?.current_period_end || 0) * 1000,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      planType,
    });
  } catch (err: any) {
    console.error("Stripe status error:", err);
    res.status(500).json({ error: err?.message || "تعذر جلب حالة الاشتراك." });
  }
});

// GET /api/billing/quota-status
// Lets the client render plan/quota state from the server's authoritative tier
// (Firestore + Redis cache) instead of trusting a client-local profile.
router.get("/api/billing/quota-status", requireAuth, rateLimit, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const tier = await resolveTier(req);
    res.json({
      ok: true,
      uid: auth?.uid || null,
      email: auth?.email || null,
      isAnonymous: auth?.isAnonymous || false,
      tier,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "تعذر جلب حالة الحصة." });
  }
});

export default router;