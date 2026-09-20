import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Sparkles, Loader2, CreditCard, Landmark, Upload, CircleCheck } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  UserPlanProfile,
  SubscriptionTier,
  PlanType,
  STRIPE_PRICES,
  TND_PRICES,
  TND_PAYMENT_DETAILS,
  addMonthsToNow,
  formatExpiryDate,
  isUnlimitedTier,
} from "../utils/plans.js";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserPlanProfile | null;
  effectiveTier: SubscriptionTier;
  uid: string;
  email: string;
  onPlanChanged: (next: UserPlanProfile) => void;
}

type BillingChannel = "stripe" | "tnd";

export default function UpgradeModal({
  open,
  onClose,
  profile,
  effectiveTier,
  uid,
  email,
  onPlanChanged,
}: UpgradeModalProps) {
  const [channel, setChannel] = useState<BillingChannel>("stripe");
  const [planType, setPlanType] = useState<PlanType>("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [receiptName, setReceiptName] = useState<string>("");
  const [receiptData, setReceiptData] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [submittedProof, setSubmittedProof] = useState(false);

  const verifiedRef = useRef(false);

  const resetLocal = useCallback(() => {
    setChannel("stripe");
    setPlanType("monthly");
    setBusy(false);
    setError(null);
    setSuccessMsg(null);
    setReceiptName("");
    setReceiptData("");
    setReference("");
    setSubmittedProof(false);
  }, []);

  const clearStripeParams = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe_checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }, []);

  // Verify a returning Stripe checkout session, then persist the upgraded
  // profile (client persists only the user's own profile doc).
  const verifyCheckout = useCallback(
    async (sessionId: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "تعذر التحقق من جلسة الدفع.");
          return;
        }
        if (data.ok !== true) {
          setError("لم تكتمل عملية الدفع بعد. في حال تم الخصم يرجى مراسلة الدعم.");
          return;
        }
        const plan = data.planType === "yearly" ? "yearly" : "monthly";
        const next: UserPlanProfile = {
          uid,
          email,
          tier: "pro_stripe",
          planType: plan,
          expiresAt: data.currentPeriodEnd ? (data.currentPeriodEnd as number) : addMonthsToNow(plan === "yearly" ? 12 : 1),
          role: profile?.role,
          stripeCustomerId: (data.customer as string) || undefined,
          stripeSubscriptionId: (data.subscriptionId as string) || undefined,
        } as UserPlanProfile;
        onPlanChanged(next);
        setSuccessMsg("تم تفعيل اشتراكك Pro بنجاح! خطة غير محدودة الآن.");
      } catch (e: any) {
        setError(e?.message || "تعذر الوصول إلى خادم الدفع.");
      } finally {
        setBusy(false);
      }
    },
    [uid, email, profile?.role, onPlanChanged]
  );

  useEffect(() => {
    if (!open) return;
    resetLocal();
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const step = params.get("stripe_checkout");
    if (sessionId && !verifiedRef.current) {
      verifiedRef.current = true;
      clearStripeParams();
      void verifyCheckout(sessionId);
    }
  }, [open, resetLocal, clearStripeParams, verifyCheckout]);

  const startStripeCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType, uid, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "تعذر إنشاء جلسة الدفع.");
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "تعذر الوصول إلى خادم الدفع.");
    } finally {
      setBusy(false);
    }
  };

  const openCustomerPortal = async () => {
    const customerId = (profile as any)?.stripeCustomerId as string | undefined;
    if (!customerId) {
      setError("لم يتم العثور على حساب Stripe مرتبط. جرّب من جديد أو تواصل مع الدعم.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: customerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "تعذر فتح بوابة إدارة الاشتراك.");
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "تعذر الوصول إلى خادم الدفع.");
    } finally {
      setBusy(false);
    }
  };

  const onReceiptPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("حجم إثبات التحويل يجب ألا يتجاوز 1 ميغابايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptData(String(reader.result || ""));
      setReceiptName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const submitTndProof = async () => {
    if (!reference.trim()) {
      setError("يرجى إدخال مرجع التحويل.");
      return;
    }
    if (!receiptData) {
      setError("يرجى رفع صورة إثبات التحويل.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addDoc(collection(db, "payment_proofs"), {
        uid,
        email,
        planType,
        status: "pending",
        receipt: receiptData,
        reference: reference.trim(),
        date: new Date().toISOString(),
      });
      const next: UserPlanProfile = {
        uid,
        email,
        tier: "pro_tnd_pending",
        planType,
        expiresAt: null,
        role: profile?.role,
      };
      onPlanChanged(next);
      setSubmittedProof(true);
    } catch (e: any) {
      setError(e?.message || "تعذر إرسال طلب الاشتراك. يرجى تسجيل الدخول ثم المحاولة.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const unlimited = isUnlimitedTier(effectiveTier);
  const isPending = effectiveTier === "pro_tnd_pending";

  const btnBase =
    "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900">اشتراك بحث OS (bahthOS)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {unlimited && !isPending && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                <CircleCheck className="w-4 h-4" /> الاشتراك نشط
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                استخدام غير محدود{profile?.expiresAt ? ` — ينتهي في ${formatExpiryDate(profile.expiresAt)}` : ""}.
              </p>
              <button
                onClick={openCustomerPortal}
                className="mt-3 text-xs font-bold text-teal-700 hover:text-teal-900 underline underline-offset-2"
              >
                إدارة فاتورة واشتراك Stripe (إلغاء / تجديد)
              </button>
            </div>
          )}

          {isPending && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">طلب الاشتراك قيد المراجعة</p>
              <p className="text-xs text-amber-700 mt-1">
                تم استلام إثبات التحويل وجارٍ التحقق منه من قِبل الإدارة. سيُفعَّل اشتراكك فور اعتماده.
              </p>
            </div>
          )}

          {/* Channel tabs */}
          {!unlimited && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setChannel("stripe")}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  channel === "stripe" ? "bg-white text-teal-700 shadow" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <CreditCard className="w-4 h-4" /> دفع إلكتروني (Stripe USD)
              </button>
              <button
                onClick={() => setChannel("tnd")}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  channel === "tnd" ? "bg-white text-teal-700 shadow" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Landmark className="w-4 h-4" /> تحويل بنكي (TND)
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
          )}
          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-700">
              {successMsg}
            </div>
          )}

          {unlimited ? (
            <p className="text-sm text-slate-600 leading-relaxed">
              أنت الآن على خطة غير محدودة. يمكنك متابعة استخدام جميع مزايا بحث OS دون حدود على المشاريع أو المصادر.
            </p>
          ) : channel === "stripe" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "yearly"] as PlanType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanType(p)}
                    className={`rounded-2xl border-2 p-4 text-right transition-all ${
                      planType === p ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">{p === "monthly" ? "شهري" : "سنوي"}</p>
                    <p className="text-xl font-extrabold text-teal-700 mt-1">${(STRIPE_PRICES[p] / 100).toFixed(0)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p === "monthly" ? "لكل شهر" : "لكل سنة (وفّر مقابل 12 شهرياً)"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">خطط ومصادر غير محدودة</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => void startStripeCheckout()}
                disabled={busy}
                className={`${btnBase} bg-teal-600 hover:bg-teal-700 text-white`}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {busy ? "جارٍ التحويل إلى بوابة الدفع..." : "الاشتراك الآن عبر Stripe"}
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                الدفع الآمن عبر Stripe (USD). ستتم معالجة الدفع على موقع Stripe ثم تُرجَع إليك للتفعيل تلقائياً. يمكنك
                إلغاء الاشتراك في أي وقت من بوابة Stripe.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "yearly"] as PlanType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanType(p)}
                    className={`rounded-2xl border-2 p-4 text-right transition-all ${
                      planType === p ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">{p === "monthly" ? "شهري" : "سنوي"}</p>
                    <p className="text-xl font-extrabold text-teal-700 mt-1">{TND_PRICES[p]} د.ت</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p === "monthly" ? "لكل شهر" : "لكل سنة"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">خطط ومصادر غير محدودة</p>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                <p className="text-xs font-extrabold text-slate-800 mb-2">تحويل إلى الحسابات المحلية (تونس):</p>
                <p className="text-xs text-slate-600">
                  <span className="font-bold">الحساب البريدي (CCP):</span> <span dir="ltr">{TND_PAYMENT_DETAILS.ccp}</span>
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-bold">بطاقة التحويل E-Dinar (DINAR SMART):</span>{" "}
                  <span dir="ltr">{TND_PAYMENT_DETAILS.dinarSmart}</span>
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-bold">المستفيد:</span> {TND_PAYMENT_DETAILS.holder}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                  يمكنك الإرسال عبر تحويل بريدي إلى CCP، أو من خلال بطاقة E-Dinar (DINAR SMART).
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مرجع التحويل (رقم العملية):</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="مثال: 92745163"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">إثبات التحويل (صورة، ≤ 1MB):</label>
                  <label
                    className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-xs font-bold text-slate-500 cursor-pointer transition-colors ${
                      receiptName ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 hover:border-teal-300"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    {receiptName || "اضغط لرفع صورة الإثبات"}
                    <input type="file" accept="image/*" className="hidden" onChange={onReceiptPick} />
                  </label>
                </div>
                <button
                  onClick={() => void submitTndProof()}
                  disabled={busy || submittedProof}
                  className={`${btnBase} bg-teal-600 hover:bg-teal-700 text-white`}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : submittedProof ? (
                    <CircleCheck className="w-4 h-4" />
                  ) : (
                    <Landmark className="w-4 h-4" />
                  )}
                  {submittedProof ? "تم إرسال الطلب — قيد المراجعة" : "إرسال إثبات التحويل"}
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  بعد إرسال الطلب سيقوم فريق الإدارة بالتحقق من عملية التحويل وتفعيل اشتراكك (عرضة للمراجعة، يُتاح خلال 24-48
                  ساعة عمل). سيتم توثيق العملية لأغراض الفوترة.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}