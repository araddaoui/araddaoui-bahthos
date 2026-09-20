import { Router } from "express";
import Stripe from "stripe";

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

// POST /api/billing/stripe-checkout
// Body: { planType: "monthly" | "yearly", uid, email }
router.post("/api/billing/stripe-checkout", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد. يرجى ضبط STRIPE_SECRET_KEY." });
    }
    const { planType, uid, email } = req.body || {};
    if (planType !== "monthly" && planType !== "yearly") {
      return res.status(400).json({ error: "نوع الخطة غير صالح." });
    }
    if (!uid || typeof uid !== "string" || !email || typeof email !== "string") {
      return res.status(400).json({ error: "بيانات المستخدم ناقصة (uid / email)." });
    }

    const price = await resolvePlanPrice(planType);
    const origin = getAppOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: uid,
      customer_email: email,
      metadata: { bahthos_plan: planType },
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
router.get("/api/billing/verify", async (req, res) => {
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

    const subscription = session.subscription as Stripe.Subscription | string | null;
    let currentPeriodEnd: number | null = null;
    let status = "active";
    if (typeof subscription === "object" && subscription) {
      currentPeriodEnd = (subscription.items.data[0]?.current_period_end || null) && subscription.items.data[0]!.current_period_end * 1000;
      status = subscription.status;
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
router.post("/api/billing/customer-portal", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد." });
    }
    const { customer } = req.body || {};
    if (!customer || typeof customer !== "string") {
      return res.status(400).json({ error: "customer مفقود." });
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
router.post("/api/billing/status", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "لم يتم تكوين بوابة الدفع (Stripe) بعد." });
    }
    const { customer } = req.body || {};
    if (!customer || typeof customer !== "string") {
      return res.status(400).json({ error: "customer مفقود." });
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

export default router;