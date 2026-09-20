import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider
} from "firebase/auth";
import { auth } from "../firebase.js";
import { BookOpen, AlertCircle, CircleCheck, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

interface AuthViewProps {
  onSuccess: () => void;
  onSkip?: () => void;
  initialIsSignUp?: boolean;
}

export default function AuthView({ onSuccess, onSkip, initialIsSignUp = false }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const translateError = (errCode: string, errMessage?: string): string => {
    switch (errCode) {
      case "auth/invalid-credential":
        return "البريد الإلكتروني أو كلمة مرور غير صحيحة.";
      case "auth/email-already-in-use":
        return "البريد الإلكتروني مستخدم بالفعل من قبل حساب آخر.";
      case "auth/weak-password":
        return "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.";
      case "auth/invalid-email":
        return "صيغة البريد الإلكتروني غير صالحة.";
      case "auth/missing-password":
        return "يرجى إدخال كلمة المرور.";
      case "auth/user-not-found":
        return "لم يتم العثور على حساب بهذا البريد الإلكتروني.";
      case "auth/operation-not-allowed":
        return "تسجيل الدخول بالبريد الإلكتروني غير مفعل في إعدادات Firebase Console الخاصة بمشروعك.";
      case "auth/unauthorized-domain":
        return "هذا النطاق غير معتمد لإجراء المصادقة. يرجى إضافة نطاق موقعك الحالي (مثال: Vercel) إلى قائمة Authorized Domains في إعدادات Firebase Authentication.";
      default:
        return `حدث خطأ غير متوقع: (${errCode || "خطأ غير معروف"}). يرجى التأكد من تفعيل خيار البريد الإلكتروني وكلمة المرور في لوحة Firebase وإضافة نطاق موقعك الحالي (Vercel) للنطاقات المعتمدة (Authorized Domains). التفاصيل: ${errMessage || ""}`;
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetSent(false);
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("يرجى إدخال بريدك الإلكتروني أولاً في الحقل أعلاه لتلقي رابط إعادة التعيين.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSent(true);
      setPassword("");
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err?.code === "auth/user-not-found" || err?.code === "auth/invalid-credential") {
        setError("إذا كان الحساب موجوداً، فقد تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
      } else {
        setError(translateError(err?.code || "", err?.message || ""));
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (value: string) => {
    if (!value) return { score: 0, label: "", color: "" };
    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 8) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (/[A-Z]/.test(value)) score++;
    const levels = [
      { score: 1, label: "ضعيفة جداً", color: "bg-red-500" },
      { score: 2, label: "ضعيفة", color: "bg-orange-400" },
      { score: 3, label: "متوسطة", color: "bg-amber-400" },
      { score: 4, label: "قوية", color: "bg-teal-500" },
      { score: 5, label: "قوية جداً", color: "bg-emerald-600" },
    ];
    const level = levels[Math.max(Math.min(score, levels.length) - 1, 0)];
    return { score, label: level.label, color: level.color };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(translateError(err.code || "", err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(translateError(err.code || "", err.message || ""));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white text-[#1f1f1f] p-6 md:p-8 space-y-6 relative overflow-hidden font-sans antialiased" dir="rtl" id="auth-card-container">
      {/* Aesthetic background design accent */}
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-[#094d4e]" />

      {/* Header and Branding */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-[#094d4e] text-white p-3.5 rounded-2xl flex items-center justify-center shadow-md">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold text-[#094d4e] tracking-tight">بحث OS</h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">bahthOS • نظام حسابات الباحثين</p>
          </div>
          <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
            {isSignUp 
              ? "أنشئ حسابك المشفر والخاص لحفظ وثائقك ومشروعاتك البحثية بأمان تام." 
              : "سجل دخولك للوصول إلى مساحتك البحثية الآمنة، حيث تُحفظ وثائقك وتوليفاتك بخصوصية كاملة."
            }
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-red-50 text-red-700 text-xs font-semibold p-4 rounded-xl border border-red-100 flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Password reset success notification */}
        {resetSent && (
          <div className="bg-teal-50 text-teal-800 text-xs font-semibold p-4 rounded-xl border border-teal-100 flex items-center gap-2.5 animate-fadeIn" id="auth-reset-success-banner">
            <CircleCheck className="w-4 h-4 flex-shrink-0 text-teal-600" />
            <span>تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.</span>
          </div>
        )}

        {/* Main Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 block">البريد الإلكتروني للباحث</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#fbfbfa] border border-[#e2e2dd] rounded-xl text-sm focus:outline-hidden focus:border-[#094d4e] focus:bg-white transition-all text-right"
              id="auth-email-input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 block">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-[#fbfbfa] border border-[#e2e2dd] rounded-xl text-sm focus:outline-hidden focus:border-[#094d4e] focus:bg-white transition-all text-right"
                id="auth-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#094d4e] transition-colors cursor-pointer p-1"
                id="auth-toggle-password-btn"
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {isSignUp && showPassword && password.length === 0 && (
              <p className="text-[10px] text-gray-400 font-medium">يمكنك الآن رؤية كلمة المرور أثناء الكتابة.</p>
            )}
          </div>

          {/* Password strength indicator (sign-up only) */}
          {isSignUp && password && (() => {
            const strength = getPasswordStrength(password);
            return (
              <div className="space-y-1.5" id="auth-strength-meter">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((segment) => (
                    <div
                      key={segment}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength.score >= segment ? strength.color : "bg-[#eae9e2]"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500">قوة كلمة المرور: <span className={strength.color === "bg-red-500" || strength.color === "bg-orange-400" ? "text-red-600" : strength.color === "bg-amber-400" ? "text-amber-600" : "text-teal-700"}>{strength.label}</span></span>
                  <span className="text-[10px] text-gray-400 font-medium">6 أحرف على الأقل مع أرقام ورموز يُفضّل</span>
                </div>
              </div>
            );
          })()}

          {/* Forgot password link (sign-in only) */}
          {!isSignUp && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-[11px] font-semibold text-[#094d4e] hover:underline cursor-pointer disabled:opacity-50"
                id="auth-forgot-password-btn"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#094d4e] hover:bg-[#073d3e] disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            id="auth-submit-button"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>يرجى الانتظار...</span>
              </>
            ) : (
              <span>{isSignUp ? "إنشاء حساب جديد" : "تسجيل الدخول الآمن"}</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#eae9e2]"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-[11px] font-bold">أو</span>
          <div className="flex-grow border-t border-[#eae9e2]"></div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs border border-[#e2e2dd] transition-all shadow-2xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          id="auth-google-button"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>تسجيل الدخول بواسطة Google</span>
        </button>

        {/* Toggle Account Type */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setResetSent(false);
            }}
            className="text-xs font-semibold text-[#094d4e] hover:underline cursor-pointer"
            id="auth-toggle-mode-button"
          >
            {isSignUp ? "لديك حساب بالفعل؟ سجل دخولك هنا" : "ليس لديك حساب؟ أنشئ حساباً جديداً"}
          </button>
        </div>

        {/* Skip to Guest Mode (Optional/Secondary) */}
        {onSkip && (
          <div className="text-center border-t border-[#eae9e2] pt-5">
            <button
              onClick={onSkip}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 cursor-pointer flex items-center justify-center gap-1 mx-auto"
              id="auth-skip-button"
            >
              <span>الاستمرار كزائر (مساحة محلية ومستندات افتراضية)</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        )}
    </div>
  );
}
