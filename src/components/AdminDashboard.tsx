import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2, Search, CircleCheck, CircleX, FileImage, RefreshCw } from "lucide-react";
import { collection, doc, getDocs, query, where, limit, updateDoc, setDoc } from "firebase/firestore";
import { User as FirebaseUser } from "firebase/auth";
import { db } from "../firebase.js";
import {
  UserPlanProfile,
  SubscriptionTier,
  PlanType,
  tierBadgeLabel,
  addMonthsToNow,
  formatExpiryDate,
  isAdminUser,
} from "../utils/plans.js";

interface AdminDashboardProps {
  currentUser: FirebaseUser | null;
  isPlanProfileLoading: boolean;
  onOpenSettings: () => void;
}

interface PaymentProof {
  id: string;
  uid: string;
  email: string;
  planType: PlanType;
  status: "pending" | "approved" | "rejected";
  receipt: string;
  reference: string;
  date: string;
}

export default function AdminDashboard({ currentUser, isPlanProfileLoading, onOpenSettings }: AdminDashboardProps) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ uid: string; profile: Partial<UserPlanProfile> } | null>(null);
  const [searching, setSearching] = useState(false);
  const [overrideTier, setOverrideTier] = useState<SubscriptionTier>("free");
  const [overridePlan, setOverridePlan] = useState<PlanType>("none");
  const [overrideExpiry, setOverrideExpiry] = useState<string>("");
  const [savingOverride, setSavingOverride] = useState(false);

  const loadProofs = useCallback(async () => {
    setLoadingProofs(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, "payment_proofs"), limit(300)));
      const rows: PaymentProof[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          uid: data.uid || "",
          email: data.email || "",
          planType: data.planType === "yearly" ? "yearly" : "monthly",
          status: data.status || "pending",
          receipt: data.receipt || "",
          reference: data.reference || "",
          date: data.date || "",
        };
      });
      rows.sort((a, b) => (a.date < b.date ? 1 : -1));
      setProofs(rows);
    } catch (e: any) {
      setError(e?.message || "تعذر تحميل طلبات الاشتراك. تحقق من قواعد Firestore وامتيازات المشرف.");
    } finally {
      setLoadingProofs(false);
    }
  }, []);

  useEffect(() => {
    void loadProofs();
  }, [loadProofs]);

  const isAdmin = isAdminUser(null, currentUser?.email) || !isPlanProfileLoading;

  const resolveProof = async (id: string, approve: boolean) => {
    setActingId(id);
    setError(null);
    setNotice(null);
    try {
      const proof = proofs.find((p) => p.id === id);
      if (!proof) throw new Error("الطلب غير موجود.");
      const proofRef = doc(db, "payment_proofs", id);
      if (approve) {
        await updateDoc(proofRef, { status: "approved" });
        await setDoc(
          doc(db, "users", proof.uid),
          {
            uid: proof.uid,
            email: proof.email,
            tier: "pro_tnd_active",
            planType: proof.planType,
            expiresAt: addMonthsToNow(proof.planType === "yearly" ? 12 : 1),
          },
          { merge: true }
        );
        setNotice(`✓ تم اعتماد اشتراك ${proof.email} وتفعيله (${proof.planType === "yearly" ? "سنوي" : "شهري"} TND).`);
      } else {
        await updateDoc(proofRef, { status: "rejected" });
        setNotice(`تم رفض طلب ${proof.email}.`);
      }
      await loadProofs();
    } catch (e: any) {
      setError(e?.message || "تعذر تحديث الطلب.");
    } finally {
      setActingId(null);
    }
  };

  const searchUser = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) return;
    setSearching(true);
    setError(null);
    setFoundUser(null);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", email), limit(1)));
      if (snap.empty) {
        setFoundUser(null);
        setNotice(`لم يتم العثور على مستخدم بالبريد "${searchEmail}".`);
        return;
      }
      const target = snap.docs[0];
      const data = target.data() as any;
      setFoundUser({ uid: target.id, profile: data });
      setOverrideTier(data.tier || "free");
      setOverridePlan(data.planType || "none");
      setOverrideExpiry(data.expiresAt ? new Date(data.expiresAt as number).toISOString().split("T")[0] : "");
    } catch (e: any) {
      setError(e?.message || "تعذر البحث عن المستخدم.");
    } finally {
      setSearching(false);
    }
  };

  const saveOverride = async () => {
    if (!foundUser) return;
    setSavingOverride(true);
    setError(null);
    setNotice(null);
    try {
      const docPayload: any = {
        uid: foundUser.uid,
        tier: overrideTier,
        planType: overridePlan,
      };
      const expiryNum = overrideExpiry ? new Date(overrideExpiry).getTime() : null;
      docPayload.expiresAt = expiryNum;
      if (overrideTier === "free") docPayload.expiresAt = null;
      await setDoc(doc(db, "users", foundUser.uid), docPayload, { merge: true });
      setNotice(`تم تحديث خطة المستخدم ${foundUser.uid}.`);
    } catch (e: any) {
      setError(e?.message || "تعذر تحديث الخطة (تحقق من امتيازات المشرف في Firestore).");
    } finally {
      setSavingOverride(false);
    }
  };

  const badge = (tier: SubscriptionTier) => {
    const b = tierBadgeLabel(tier);
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${b.className}`}>{b.text}</span>;
  };

  const pending = proofs.filter((p) => p.status === "pending");
  const recent = proofs.filter((p) => p.status !== "pending").slice(0, 8);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafaf8] h-full">
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">لوحة إدارة بحث OS (bahthOS)</h1>
              <p className="text-xs text-slate-500 mt-0.5">إدارة طلبات الاشتراك وحسابات المستخدمين — {currentUser?.email || "بدون جلسة"}</p>
            </div>
          </div>
          <button
            onClick={() => void loadProofs()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingProofs ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>

        {!isAdmin && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            لا تملك صلاحية المشرف. أعِد التحقق من بريدك الإلكتروني في إعدادات المشرف.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
        )}
        {notice && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-bold text-emerald-700">{notice}</div>
        )}

        {/* Pending TND proofs */}
        <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800">طلبات الاشتراك بالتحويل البنكي (TND)</h2>
            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold">
              {pending.length} قيد المراجعة
            </span>
          </div>
          <div className="p-5">
            {loadingProofs ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل الطلبات...
              </div>
            ) : pending.length === 0 ? (
              <p className="py-6 text-center text-xs font-bold text-slate-400">
                لا توجد طلبات اشتراك جديدة حالياً.
              </p>
            ) : (
              <div className="space-y-3">
                {pending.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-800" dir="ltr">{p.email}</span>
                        {badge(p.planType === "yearly" ? "pro_tnd_active" : "pro_tnd_active")}
                      </div>
                      <p className="text-xs text-slate-500">
                        {p.planType === "yearly" ? "اشتراك سنوي" : "اشتراك شهري"} · المرجع{" "}
                        <span dir="ltr" className="font-mono">{p.reference}</span> · تاريخ الإرسال {p.date ? new Date(p.date).toLocaleDateString("ar-EG") : "—"}
                      </p>
                      {p.receipt && (
                        <a
                          href={p.receipt}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          <FileImage className="w-3.5 h-3.5" /> عرض إثبات التحويل
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void resolveProof(p.id, true)}
                        disabled={actingId === p.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        {actingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleCheck className="w-3.5 h-3.5" />}
                        اعتماد
                      </button>
                      <button
                        onClick={() => void resolveProof(p.id, false)}
                        disabled={actingId === p.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 px-3 py-2 text-xs font-bold disabled:opacity-50"
                      >
                        <CircleX className="w-3.5 h-3.5" /> رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Search & override */}
        <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-800">البحث عن مستخدم وتعديل الخطة</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void searchUser(); }}
                  placeholder="البريد الإلكتروني للمستخدم"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-indigo-400"
                  dir="ltr"
                />
              </div>
              <button
                onClick={() => void searchUser()}
                disabled={searching || !searchEmail.trim()}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                بحث
              </button>
            </div>

            {foundUser && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-800" dir="ltr">{foundUser.profile.email || foundUser.uid}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400" dir="ltr">{foundUser.uid}</span>
                    {badge((foundUser.profile.tier as SubscriptionTier) || "free")}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  الخطة الحالية: {foundUser.profile.tier} {foundUser.profile.planType}{" "}
                  {foundUser.profile.expiresAt ? `· تنتهي في ${formatExpiryDate(foundUser.profile.expiresAt as number)}` : ""}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الخطة</label>
                    <select
                      value={overrideTier}
                      onChange={(e) => setOverrideTier(e.target.value as SubscriptionTier)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="free">مجانية</option>
                      <option value="pro_stripe">Pro (Stripe)</option>
                      <option value="pro_tnd_active">Pro (TND نشط)</option>
                      <option value="pro_tnd_pending">قيد المراجعة TND</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع الخطة</label>
                    <select
                      value={overridePlan}
                      onChange={(e) => setOverridePlan(e.target.value as PlanType)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="none">بدون</option>
                      <option value="monthly">شهري</option>
                      <option value="yearly">سنوي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">تاريخ الانتهاء</label>
                    <input
                      type="date"
                      value={overrideExpiry}
                      onChange={(e) => setOverrideExpiry(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void saveOverride()}
                  disabled={savingOverride}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {savingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleCheck className="w-3.5 h-3.5" />}
                  حفظ التعديل
                </button>
              </div>
            )}

            {!foundUser && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                استخدم الأداة أعلاه لعرض خطة أي مستخدم وتعديلها يدوياً (مناسب لتفعيل اشتراكات TND المعتمدة خارجياً أو
                التصحيح).
              </p>
            )}
          </div>
        </section>

        {/* Recently resolved */}
        {recent.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-800">الطلبات الأخيرة المعالجة</h2>
            </div>
            <div className="p-5 overflow-x-auto">
              <div className="min-w-[640px] space-y-2">
                {recent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-bold text-slate-700" dir="ltr">{p.email}</span>
                    <span className="text-xs text-slate-500">{p.planType === "yearly" ? "سنوي" : "شهري"}</span>
                    <span className={`text-[11px] font-bold ${p.status === "approved" ? "text-emerald-600" : "text-red-600"}`}>
                      {p.status === "approved" ? "معتمد" : "مرفوض"}
                    </span>
                    <span className="text-[11px] text-slate-400">{p.date ? new Date(p.date).toLocaleDateString("ar-EG") : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <p className="text-center text-[11px] text-slate-400">
          هذه اللوحة لأغراض الإدارة فقط. انقل إلى{" "}
          <button onClick={onOpenSettings} className="underline underline-offset-2 text-slate-500 hover:text-slate-700">الإعدادات</button>
          {" "}لإدارة حسابك واشتراكك.
        </p>
      </div>
    </div>
  );
}