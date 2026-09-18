import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { getAdminFirestore } from "../middleware/auth.js";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeClient;
}

const billingRouter = Router();

/**
 * Robust helper to locate Stripe Customer ID:
 * 1. Checks Firestore Admin if available
 * 2. Checks Stripe API directly by metadata firebaseUID or email
 */
async function findStripeCustomerId(uid: string, userEmail?: string): Promise<string | null> {
  // 1. Try Firestore Admin if available
  try {
    const db = getAdminFirestore();
    if (db) {
      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        const data = userDoc.data();
        const customerId = data?.subscription?.stripeCustomerId || data?.stripeCustomerId;
        if (customerId) return customerId;
      }
      const subDoc = await userDocRef.collection("subscription").doc("current").get();
      if (subDoc.exists && subDoc.data()?.stripeCustomerId) {
        return subDoc.data()?.stripeCustomerId;
      }
    }
  } catch (e) {
    // Firestore Admin IAM permissions not available on server container; fallback to Stripe search
  }

  // 2. Query Stripe directly using customer metadata or email
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      try {
        const search = await stripe.customers.search({
          query: `metadata['firebaseUID']:'${uid}'`,
        });
        if (search.data.length > 0) {
          return search.data[0].id;
        }
      } catch (searchErr) {
        // Fallback to customer listing if search index is not available
      }

      const list = await stripe.customers.list({ limit: 100 });
      const matched = list.data.find(
        (c) => c.metadata?.firebaseUID === uid || (userEmail && c.email?.toLowerCase() === userEmail.toLowerCase())
      );
      if (matched) {
        return matched.id;
      }
    } catch (e) {
      console.warn("[Billing] Stripe customer search note:", e);
    }
  }

  return null;
}

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for authenticated users.
 */
billingRouter.post("/api/billing/create-checkout-session", async (req: Request, res: Response) => {
  if (!req.user || req.user.isGuest || !req.user.uid) {
    return res.status(401).json({
      error: "يرجى تسجيل الدخول بحساب باحث نشط للاشتراك في الخطة الاحترافية.",
      code: "auth/unauthenticated",
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: "بوابة الدفع غير مهيأة بعد: يرجى إضافة STRIPE_SECRET_KEY في لوحة الإعدادات والمفاتيح.",
      code: "billing/missing-stripe-key",
    });
  }

  try {
    const stripe = getStripe();
    const uid = req.user.uid;
    const userEmail = req.user.email || undefined;

    // Fetch or find Stripe Customer ID
    let stripeCustomerId = await findStripeCustomerId(uid, userEmail);

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUID: uid,
        },
        description: `Academic Researcher UID: ${uid}`,
      });
      stripeCustomerId = customer.id;
      try {
        const db = getAdminFirestore();
        if (db) {
          await db.collection("users").doc(uid).set({ stripeCustomerId }, { merge: true });
        }
      } catch (fsErr) {
        // Stripe customer metadata serves as primary persistent link
      }
    }

    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : "http://localhost:3000");
    const success_url = `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/?billing=canceled`;

    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    const lineItems = (priceId && !priceId.includes("MY_") && !priceId.includes("PLACEHOLDER"))
      ? [{ price: priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "اشتراك باحث OS الاحترافي (Pro Monthly)",
              description: "توليف متقدم غير محدود، تنقية آلية للمصطلحات، تحليل دراسات السوق والسياسات، ودعم فني مخصص.",
            },
            unit_amount: 1900, // $19.00 / month
            recurring: { interval: "month" as const },
          },
          quantity: 1,
        }];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      client_reference_id: uid,
      line_items: lineItems,
      success_url,
      cancel_url,
      metadata: {
        firebaseUID: uid,
      },
      subscription_data: {
        metadata: {
          firebaseUID: uid,
        },
      },
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error("[Billing] Failed to create checkout session:", error);
    return res.status(500).json({
      error: error?.message || "حدث خطأ أثناء إنشاء جلسة الدفع عبر Stripe.",
      code: "billing/checkout-error",
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Generates a Stripe Customer Portal link so active subscribers can manage/cancel their subscription.
 */
billingRouter.post("/api/billing/create-portal-session", async (req: Request, res: Response) => {
  if (!req.user || req.user.isGuest || !req.user.uid) {
    return res.status(401).json({
      error: "يرجى تسجيل الدخول بحساب باحث نشط لإدارة الاشتراك.",
      code: "auth/unauthenticated",
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: "بوابة الدفع غير مهيأة بعد: يرجى إضافة STRIPE_SECRET_KEY في لوحة الإعدادات والمفاتيح.",
      code: "billing/missing-stripe-key",
    });
  }

  try {
    const stripe = getStripe();
    const uid = req.user.uid;
    const stripeCustomerId = await findStripeCustomerId(uid, req.user.email || undefined);

    if (!stripeCustomerId) {
      return res.status(404).json({
        error: "لم يتم العثور على سجل اشتراك أو معرف عميل Stripe مرتبط بحسابك.",
        code: "billing/no-customer",
      });
    }

    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : "http://localhost:3000");

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/`,
    });

    return res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("[Billing] Failed to create portal session:", error);
    return res.status(500).json({
      error: error?.message || "حدث خطأ أثناء إنشاء رابط بوابة المشتركين.",
      code: "billing/portal-error",
    });
  }
});

/**
 * GET /api/billing/status
 * Safely returns the current user subscription tier and status without ever failing with 500 error.
 */
billingRouter.get("/api/billing/status", async (req: Request, res: Response) => {
  if (!req.user || req.user.isGuest || !req.user.uid) {
    return res.json({
      tier: "free",
      status: "none",
      isGuest: true,
      currentPeriodEnd: null,
      stripeCustomerId: null,
    });
  }

  const uid = req.user.uid;

  // 1. If Stripe is configured, check Stripe directly (source of truth for billing)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeCustomerId = await findStripeCustomerId(uid, req.user.email || undefined);
      if (stripeCustomerId) {
        const stripe = getStripe();
        const subs = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
          limit: 5,
        });
        const activeSub = subs.data.find((s) => s.status === "active" || s.status === "trialing") || subs.data[0];
        if (activeSub) {
          const isActive = activeSub.status === "active" || activeSub.status === "trialing";
          return res.json({
            tier: isActive ? "pro" : "free",
            status: activeSub.status,
            currentPeriodEnd: (activeSub as any).current_period_end
              ? new Date((activeSub as any).current_period_end * 1000).toISOString()
              : null,
            stripeCustomerId,
            isGuest: false,
          });
        }
      }
    } catch (e: any) {
      console.warn("[Billing] Stripe status lookup note:", e?.message);
    }
  }

  // 2. Safe Firestore Admin check (if permissions are available in environment)
  try {
    const db = getAdminFirestore();
    if (db) {
      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      let subData = userDoc.exists ? userDoc.data()?.subscription : null;
      if (!subData) {
        const subDoc = await userDocRef.collection("subscription").doc("current").get();
        if (subDoc.exists) {
          subData = subDoc.data();
        }
      }
      if (subData) {
        return res.json({
          tier: subData?.tier || "free",
          status: subData?.status || "none",
          currentPeriodEnd: subData?.currentPeriodEnd || null,
          stripeCustomerId: subData?.stripeCustomerId || userDoc.data()?.stripeCustomerId || null,
          isGuest: false,
        });
      }
    }
  } catch (fsErr) {
    // Firestore Admin has no IAM permission on server container; expected and handled cleanly
  }

  // 3. Clean default: free tier, HTTP 200
  return res.json({
    tier: "free",
    status: "none",
    currentPeriodEnd: null,
    stripeCustomerId: null,
    isGuest: false,
  });
});

/**
 * Stripe Webhook Handler
 * Verified via stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    return res.status(500).send("Webhook secret not configured.");
  }

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header.");
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let db: any = null;
  try {
    db = getAdminFirestore();
  } catch (e) {
    // Firestore Admin unavailable
  }

  try {
    const stripe = getStripe();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id || session.metadata?.firebaseUID;
        const customerId = session.customer as string;

        if (customerId) {
          try {
            await stripe.customers.update(customerId, {
              metadata: {
                firebaseUID: uid || "",
                tier: "pro",
                status: "active",
              },
            });
          } catch (e) {
            console.warn("[Stripe Webhook] Customer metadata update note:", e);
          }
        }

        if (uid) {
          let currentPeriodEnd: string | null = null;
          if (session.subscription) {
            try {
              const sub: any = await stripe.subscriptions.retrieve(session.subscription as string);
              if (sub?.current_period_end) {
                currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
              }
            } catch (e) {
              console.warn("[Stripe Webhook] Could not retrieve subscription details:", e);
            }
          }

          const subscriptionPayload = {
            tier: "pro",
            status: "active",
            stripeCustomerId: customerId || null,
            subscriptionId: (session.subscription as string) || null,
            currentPeriodEnd,
            updatedAt: new Date().toISOString(),
          };

          if (db) {
            try {
              await db.collection("users").doc(uid).set({
                subscription: subscriptionPayload,
                stripeCustomerId: customerId || null,
              }, { merge: true });

              await db.collection("users").doc(uid).collection("subscription").doc("current").set(
                subscriptionPayload,
                { merge: true }
              );
            } catch (fsErr) {
              console.warn("[Stripe Webhook] Firestore write note:", fsErr);
            }
          }

          console.log(`[Stripe Webhook] Successfully upgraded user ${uid} to Pro tier.`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription: any = event.data.object;
        const customerId = subscription.customer as string;
        let uid = subscription.metadata?.firebaseUID;

        if (!uid && customerId && db) {
          try {
            const usersSnap = await db.collection("users")
              .where("stripeCustomerId", "==", customerId)
              .limit(1)
              .get();
            if (!usersSnap.empty) {
              uid = usersSnap.docs[0].id;
            }
          } catch (e) {}
        }

        if (uid) {
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          const currentPeriodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;

          const subscriptionPayload = {
            tier: isActive ? "pro" : "free",
            status: subscription.status,
            stripeCustomerId: customerId,
            subscriptionId: subscription.id,
            currentPeriodEnd,
            updatedAt: new Date().toISOString(),
          };

          if (db) {
            try {
              await db.collection("users").doc(uid).set({
                subscription: subscriptionPayload,
                stripeCustomerId: customerId,
              }, { merge: true });

              await db.collection("users").doc(uid).collection("subscription").doc("current").set(
                subscriptionPayload,
                { merge: true }
              );
            } catch (fsErr) {
              console.warn("[Stripe Webhook] Firestore write note:", fsErr);
            }
          }

          console.log(`[Stripe Webhook] Updated subscription for user ${uid}: ${subscription.status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        let uid = subscription.metadata?.firebaseUID;

        if (!uid && customerId && db) {
          try {
            const usersSnap = await db.collection("users")
              .where("stripeCustomerId", "==", customerId)
              .limit(1)
              .get();
            if (!usersSnap.empty) {
              uid = usersSnap.docs[0].id;
            }
          } catch (e) {}
        }

        if (uid) {
          const subscriptionPayload = {
            tier: "free",
            status: "canceled",
            stripeCustomerId: customerId,
            subscriptionId: subscription.id,
            currentPeriodEnd: null,
            updatedAt: new Date().toISOString(),
          };

          if (db) {
            try {
              await db.collection("users").doc(uid).set({
                subscription: subscriptionPayload,
              }, { merge: true });

              await db.collection("users").doc(uid).collection("subscription").doc("current").set(
                subscriptionPayload,
                { merge: true }
              );
            } catch (fsErr) {
              console.warn("[Stripe Webhook] Firestore write note:", fsErr);
            }
          }

          console.log(`[Stripe Webhook] Canceled subscription for user ${uid}.`);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    return res.status(500).send("Internal webhook handling error.");
  }

  return res.json({ received: true });
}

export default billingRouter;
