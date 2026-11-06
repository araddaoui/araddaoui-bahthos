import React, { useState } from "react";
import { authFetch } from "../utils/api.js";

// Passcode gate for bahthos.app/review. Submits the passcode to the server
// (GET /api/billing/quota-status with the x-reviewer-code header) and only
// opens the app when the server answers review:"active". No email, no account
// — reviewers run as anonymous guests inside the app's normal guest flow.
interface ReviewerGateProps {
  onValidated: (code: string) => void;
}

export default function ReviewerGate({ onValidated }: ReviewerGateProps) {
  const [code, setCode] = useState<string>("");
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await authFetch("/api/billing/quota-status", {
        method: "GET",
        headers: { "x-reviewer-code": trimmed },
      });
      const data: any = await res.json().catch(() => null);
      if (res.ok && data?.review === "active") {
        onValidated(trimmed);
        return;
      }
      setError(res.ok ? "رمز المراجعة غير صالح أو انتهت فترة المراجعة." : "تعذر التحقق من الرمز حالياً، الرجاء المحاولة بعد قليل.");
    } catch (e) {
      setError("تعذر التحقق من الرمز. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#fafaf8] p-6" dir="rtl" id="reviewer-gate">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white shadow-2xl border border-gray-100 p-8">
          <div className="text-center">
            <span className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold" id="reviewer-gate-badge">
              <SparklesFallback />
              <span className="mr-1">نسخة المراجعين</span>
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-[#094d4e]">دخول المراجعين</h2>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              أدخل رمز المراجعة الذي وصلك في الدعوة للبدء مباشرة — بدون بريد إلكتروني أو حساب.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <input
              type="password"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              placeholder="رمز المراجعة"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition disabled:bg-gray-50"
              id="reviewer-gate-code-input"
              disabled={checking}
            />
            {error && (
              <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={checking || !code.trim()}
              className="w-full rounded-xl bg-[#0d6264] px-4 py-2.5 text-sm font-extrabold text-white shadow hover:bg-[#094d4e] transition disabled:opacity-50 disabled:cursor-not-allowed"
              id="reviewer-gate-submit"
            >
              {checking ? "جاري التحقق من الرمز..." : "دخول"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-gray-400 font-bold" id="reviewer-gate-footer">
          bahthOS — وحدة مراجعة محدودة زمنياً
        </p>
      </div>
    </div>
  );
}

// Local minimal sparkle so the gate never imports the app bundle early.
function SparklesFallback() {
  return <span aria-hidden="true" className="text-emerald-700">✦</span>;
}
