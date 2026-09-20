import React, { useState } from "react";
import { 
  Settings, 
  Sliders, 
  HelpCircle, 
  BookOpen, 
  Check, 
  Cpu, 
  ShieldCheck,
  AlertTriangle,
  Info,
  Trash2,
  LogOut,
  User,
  Sparkles,
  CreditCard
} from "lucide-react";
import { tierBadgeLabel, formatExpiryDate } from "../utils/plans.js";

interface SettingsViewProps {
  temperature: number;
  setTemperature: (temp: number) => void;
  onResetWorkspace?: () => void;
  onShowLandingPage?: () => void;
  currentUser?: any;
  onSignOut?: () => void;
  planProfile?: any;
  effectiveTier?: string;
  projectsUsed?: number;
  sourcesUsed?: number;
  projectLimit?: number;
  sourceLimit?: number;
  isAdmin?: boolean;
  isPlanProfileLoading?: boolean;
  onOpenUpgrade?: () => void;
  onShowAdmin?: () => void;
}

export default function SettingsView({ 
  temperature, 
  setTemperature, 
  onResetWorkspace, 
  onShowLandingPage,
  currentUser,
  onSignOut,
  planProfile,
  effectiveTier = "free",
  projectsUsed = 0,
  sourcesUsed = 0,
  projectLimit = 2,
  sourceLimit = 5,
  isAdmin = false,
  isPlanProfileLoading = false,
  onOpenUpgrade,
  onShowAdmin,
}: SettingsViewProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#fafaf8] overflow-y-auto p-4 md:p-6" id="settings-view">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-teal-50 text-[#0d6264] p-2 rounded-xl border border-teal-100">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1f1f1f]">إعدادات منصة بحث OS</h1>
            <p className="text-xs text-gray-500 font-medium">
              التحكم في معلمات الذكاء الاصطناعي، ومراجعة ميثاق وقواعد التحليل والتوليف الصارمة.
            </p>
          </div>
        </div>

        {/* Account and Cloud Sync Info */}
        {currentUser && (
          <div className="bg-white p-5 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4" id="settings-account-card">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
              <User className="w-4 h-4 text-[#0d6264]" />
              <span>بيانات حساب الباحث والمزامنة السحابية</span>
            </h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-teal-50/20 p-4 rounded-xl border border-teal-100/50">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">البريد الإلكتروني الحالي:</span>
                  <span className="text-xs font-mono font-bold text-[#0d6264]">{currentUser.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">تاريخ إنشاء الحساب:</span>
                  <span className="text-xs font-bold text-[#0d6264]">
                    {currentUser.metadata?.creationTime
                      ? new Date(currentUser.metadata.creationTime).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "غير متوفر"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">طريقة تسجيل الدخول:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#094d4e] text-white text-[10px] font-bold">
                    {Array.isArray(currentUser.providerData) && currentUser.providerData.some((p: any) => p?.providerId === "google.com")
                      ? "Google"
                      : "البريد الإلكتروني وكلمة المرور"}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  تم تفعيل التخزين والمزامنة السحابية المشفرة بنجاح.
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-red-600 border border-red-100 hover:border-red-200 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 self-start md:self-auto cursor-pointer"
                id="settings-signout-btn"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج الآمن</span>
              </button>
            </div>
          </div>
        )}

        {/* Subscription / Plan Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4" id="settings-plan-card">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
              <Sparkles className="w-4 h-4 text-[#0d6264]" />
              <span>خطتك والاشتراك</span>
            </h2>
            {effectiveTier === "free" && onOpenUpgrade && (
              <button
                onClick={onOpenUpgrade}
                className="px-3 py-1.5 bg-[#094d4e] hover:bg-[#06393a] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                id="settings-upgrade-btn"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>ترقية الآن</span>
              </button>
            )}
          </div>

          {isPlanProfileLoading ? (
            <p className="text-xs font-bold text-gray-400 py-2">جارٍ تحميل بيانات الخطة...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-700">الخطة الحالية:</span>
                <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold ${tierBadgeLabel(effectiveTier as any).className}`}>
                  {tierBadgeLabel(effectiveTier as any).text}
                </span>
              </div>
              {planProfile?.expiresAt && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-700">تاريخ انتهاء الاشتراك:</span>
                  <span className="text-xs font-bold text-[#0d6264]">{formatExpiryDate(planProfile.expiresAt)}</span>
                </div>
              )}
              {effectiveTier === "pro_tnd_pending" && (
                <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-800">
                  طلب الاشتراك قيد المراجعة من قِبل الإدارة. يُفعَّل اشتراكك فور اعتماده.
                </p>
              )}
              {effectiveTier === "free" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-gray-600">المشاريع ({projectsUsed} / {projectLimit})</span>
                      <span className="text-[10px] text-gray-400 font-semibold">الخطة المجانية</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${projectsUsed >= projectLimit ? "bg-amber-400" : "bg-teal-500"}`}
                        style={{ width: `${Math.min(100, (projectsUsed / Math.max(1, projectLimit)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-gray-600">المصادر ({sourcesUsed} / {sourceLimit})</span>
                      <span className="text-[10px] text-gray-400 font-semibold">لكل مشروع</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sourcesUsed >= sourceLimit ? "bg-amber-400" : "bg-teal-500"}`}
                        style={{ width: `${Math.min(100, (sourcesUsed / Math.max(1, sourceLimit)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {onOpenUpgrade && (
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      بلغت حدود الخطة المجانية؟ اشترك في{" "}
                      <button onClick={onOpenUpgrade} className="text-teal-700 font-bold underline underline-offset-2">
                        Pro
                      </button>{" "}
                      للاستخدام غير المحدود للمشاريع والمصادر.
                    </p>
                  )}
                </>
              )}
              {isAdmin && onShowAdmin && (
                <button
                  onClick={onShowAdmin}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
                  id="settings-open-admin-btn"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  فتح لوحة الإدارة
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI Parameters */}
        <div className="bg-white p-5 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Sliders className="w-4 h-4 text-[#0d6264]" />
            <span>معايير توليد الرد والتوليف</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-gray-700">درجة التوليد والحرية الإبداعية (Temperature):</span>
                <span className="text-xs font-mono font-bold text-[#0d6264] bg-teal-50 px-2 py-0.5 rounded">
                  {temperature}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#0d6264] h-1.5 bg-gray-100 rounded-lg cursor-pointer"
                id="temperature-slider"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-1">
                <span>0.0 (دقة متناهية - الأفضل للتحليل والدراسات)</span>
                <span>1.0 (إبداع عالٍ)</span>
              </div>
            </div>

            <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 text-[11px] text-gray-600 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-[#0d6264] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#0d6264]">نصيحة تحليلية:</span> درجة الحرارة المنخفضة (0.1 - 0.2) تضمن التزام النموذج الصارم بالحقائق المذكورة وتمنعه من تشتيت المقارنات أو اختراع بيانات إحصائية غير مدعومة بالوثائق المرفوعة.
              </div>
            </div>
          </div>
        </div>

        {/* System Rules Blueprint */}
        <div className="bg-white p-5 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-[#0d6264]" />
            <span>ميثاق بحث OS وضوابط التحليل (غير القابلة للتفاوض)</span>
          </h2>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            تخضع إجابات بحث OS لمجموعة من القواعد الصارمة المدمجة في نواته لمنع الهلوسة وضمان الموثوقية المعرفية:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-[#e2e2dd] space-y-1 bg-[#fafaf8]">
              <span className="font-bold text-[#0d6264] block">1. التقييد المطلق بالمصادر</span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                يُمنع بحث OS منعاً باتاً من استخدام أي معلومات خارجية أو افتراضات عامة غير واردة صراحة في الوثائق المرفوعة والنشطة.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#e2e2dd] space-y-1 bg-[#fafaf8]">
              <span className="font-bold text-[#0d6264] block">2. إبراز التناقضات والتعارض</span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                بدلاً من دمج البيانات، يتعمد بحث OS الكشف عن نقاط الخلاف الإحصائي والمنهجي بين الدراسات، مع شرح الأسباب المحتملة (الجغرافيا، التقنية، العينة).
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#e2e2dd] space-y-1 bg-[#fafaf8]">
              <span className="font-bold text-[#0d6264] block">3. التوثيق والاستشهاد المباشر</span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                تأتي الاستشهادات مدمجة داخل سياق الجملة لتجنيب الباحثين العناء (مثال: "توضح الوثيقة 1 أن...")، مما يتيح التثبت الفوري من صحة المعلومات.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#e2e2dd] space-y-1 bg-[#fafaf8]">
              <span className="font-bold text-[#0d6264] block">4. ضبط التسميات والمصطلحات</span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                عند استخدام مصطلح غربي ليس له مرادف عربي معتمد، يلتزم بحث OS بكتابته أولاً، تليه الترجمة الصوتية والتعريف الاصطلاحي.
              </p>
            </div>
          </div>
        </div>

        {/* LLM Engine details */}
        <div className="bg-[#f4f3ee] p-5 rounded-2xl border border-[#e2e2dd] space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#0d6264]" />
            <h3 className="text-xs font-bold text-[#1f1f1f]">محرك الذكاء الاصطناعي والسرية</h3>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            المنصة متصلة بشكل مباشر ومحمي عبر واجهة برمجة تطبيقات <strong>Gemini 3.5 Flash</strong> لضمان معالجة فورية وتوليف دقيق للغات المتعددة (العربية والإنجليزية). جميع وثائقك آمنة، وتتم معالجة البيانات بالكامل من جانب الخادم (Server-side) لمنع كشف مفاتيح الاتصال البرمجية في المتصفح.
          </p>
        </div>

        {/* Landing Page Preview Option */}
        {onShowLandingPage && (
          <div className="bg-white p-5 rounded-2xl border border-teal-100 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-teal-800 flex items-center gap-2 border-b border-teal-50 pb-2">
              <BookOpen className="w-4 h-4 text-[#0d6264]" />
              <span>الصفحة التعريفية للمنصة (Landing Page)</span>
            </h2>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-right">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-700 block">عرض الصفحة التعريفية الخارجية</span>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  يمكنك العودة وعرض الصفحة التعريفية الرائعة التي تشرح مزايا منصة بحث OS، خطوات سير العمل، والمقارنات المنهجية في أي وقت.
                </p>
              </div>
              <button
                onClick={onShowLandingPage}
                className="px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 self-start md:self-auto cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>شاهد الصفحة التعريفية</span>
              </button>
            </div>
          </div>
        )}

        {/* Workspace Management */}
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-red-800 flex items-center gap-2 border-b border-red-50 pb-2">
            <button
              onClick={handleReset}
              className="p-1 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 transition-all duration-150 active:scale-90 cursor-pointer flex items-center justify-center"
              title="مسح البيانات والبدء من جديد"
              aria-label="مسح البيانات والبدء من جديد"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <span>إدارة بيانات المشروع البحثي</span>
          </h2>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-700 block">إعادة تعيين مساحة العمل بالكامل</span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                سيؤدي هذا الإجراء إلى حذف جميع المستندات التي قمت برفعها، ومسح سجل الدردشة، وإعادة المنصة لحالتها الافتراضية الأولى.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 self-start md:self-auto"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>مسح البيانات والبدء من جديد</span>
            </button>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="reset-confirm-modal">
          <div className="bg-white rounded-2xl border border-[#e2e2dd] shadow-xl max-w-md w-full p-6 text-right space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="bg-red-50 text-red-600 p-2 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-red-800">تنبيه: إجراء غير قابل للتراجع نهائياً</h3>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">مسح شامل لبيانات المشروع البحثي</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 leading-relaxed font-bold">
              هل أنت متأكد من رغبتك في مسح جميع بيانات المشروع البحثي والبدء من جديد؟ سيؤدي هذا الإجراء إلى حذف كافة المستندات المرفوعة، وسجلات التحليل، والمصطلحات المستخلصّة، ومحادثات الدردشة بالكامل.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetWorkspace?.();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                نعم، مسح البيانات والبدء من جديد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
