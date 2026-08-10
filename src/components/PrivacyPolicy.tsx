import React from "react";

interface PrivacyPolicyProps {
  navigateTo: (path: string) => void;
  onEnterApp: () => void;
}

export default function PrivacyPolicy({ navigateTo, onEnterApp }: PrivacyPolicyProps) {
  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen selection:bg-teal-500 selection:text-white" style={{ fontFamily: "'Noto Sans Arabic', 'Inter', system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-x-3 cursor-pointer" onClick={() => navigateTo("/")}>
            <div className="w-11 h-11 bg-teal-800 flex items-center justify-center rounded-2xl shadow-inner">
              <i className="fas fa-book text-white text-2xl"></i>
            </div>
            <div>
              <span className="font-bold text-2xl tracking-tight text-teal-900 block leading-tight">بحث OS</span>
              <span className="font-medium text-teal-700 text-xs block -mt-0.5">bahthOS</span>
            </div>
          </div>
          
          {/* Back to Home Button */}
          <div className="flex items-center gap-x-3">
            <button 
              onClick={() => navigateTo("/")}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-teal-800 hover:bg-slate-50 transition-all rounded-3xl border border-slate-200 flex items-center gap-x-2">
              <i className="fas fa-home"></i>
              <span>الرئيسية</span>
            </button>
            <button 
              onClick={onEnterApp}
              className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 transition-all text-white rounded-3xl flex items-center gap-x-2 shadow-sm">
              <span>دخول المنصة</span>
              <i className="fas fa-arrow-left text-xs"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Header section */}
      <div className="relative bg-teal-950 text-white overflow-hidden py-16 md:py-24" id="privacy-header">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent)] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-4">
          <span className="px-3.5 py-1 bg-teal-500/20 text-teal-300 rounded-3xl text-xs font-semibold inline-block border border-teal-500/30">
            الخصوصية والنزاهة والشفافية
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            سياسة الخصوصية وسرية البيانات
          </h1>
          <p className="text-teal-100 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            نحن نلتزم بحماية خصوصية المستخدمين وسرية جميع الوثائق والملفات التي تتم معالجتها داخل منصة بحث OS.
          </p>
          <div className="text-xs text-teal-200/80 font-mono">
            تاريخ التحديث الأخير: 17 يوليو 2026
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 md:p-10 space-y-10 text-right" dir="rtl">
          
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-teal-900">1. سرية الوثائق والملفات المرفوعة</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              جميع الوثائق والمستندات (ملفات PDF، ملفات Word، أو النصوص) التي ترفعها إلى منصة بحث OS تُعالج بسرية تامة. نحن لا نقوم بحفظ ملفاتك في قواعد بيانات مكشوفة للعامة، بل نعتمد على الحفظ المؤقت والآمن على الخادم لغايات التحليل التوليفي، ولا نقوم بمشاركة هذه البيانات مع أي أطراف ثالثة لأغراض تجارية أو دعائية.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">2. المعالجة الآمنة من جانب الخادم (Server-side Processing)</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              لتحقيق أقصى قدر من الأمان، تتم عملية الاتصال بنموذج الذكاء الاصطناعي <strong>Gemini 3.5 Flash</strong> عبر خوادم مخصصة ومحمية (Server-side). يضمن هذا الأسلوب الفني عدم كشف أو تسريب أي مفاتيح برمجية (API Keys) في متصفح المستخدم النهائي، وحماية القنوات المتبادلة لنقل البيانات بالتشفير الكامل (SSL/TLS).
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">3. التخزين المحلي (Local Storage) للخصوصية الذاتية</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              توظّف منصة بحث OS تقنيات التخزين المحلي على جهاز المستخدم (LocalStorage) للاحتفاظ بمصطلحات القاموس وسجل التقارير ومسودات المشاريع التي تعمل عليها. يتيح لك ذلك تحكماً مطلقاً ومباشراً ببياناتك؛ حيث يمكنك مسح هذه البيانات بالكامل وبكبسة زر واحدة من قائمة الإعدادات (Settings View)، لتختفي من متصفحك بشكل فوري ونهائي دون ترك أي أثر.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">4. ملفات تعريف الارتباط والتحليلات</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              قد نستخدم ملفات تعريف الارتباط (Cookies) والتقنيات المماثلة لتحسين أداء الواجهة، والتعرف على تفضيلات اللغة، وحفظ جلسة المستخدم النشطة لتسهيل الدخول. لا نقوم باستخدام أي برمجيات تتبع خبيثة أو متطفلة تنتهك سلامتك الرقمية.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">5. التواصل معنا</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              إذا كان لديك أي أسئلة أو استفسارات تتعلق بسياسة الخصوصية هذه أو كيفية التعامل مع بياناتك وأبحاثك، يسعدنا تواصلك مع فريق الإشراف والدعم الفني عبر البريد الإلكتروني الرسمي للمنصة.
            </p>
          </div>

          {/* Action buttons at bottom */}
          <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => navigateTo("/")}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all flex items-center justify-center gap-x-2">
              <i className="fas fa-chevron-right text-xs"></i>
              <span>العودة للصفحة الرئيسية</span>
            </button>
            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-2.5 text-sm font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-full transition-all flex items-center justify-center gap-x-2 shadow-sm">
              <span>الانتقال وتطبيق الخصوصية الآمنة</span>
              <i className="fas fa-arrow-left text-xs"></i>
            </button>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 mt-12 text-center text-slate-500 text-xs" id="privacy-footer">
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px]">
          <span>© 2026 بحث OS - مساعد الباحث والمحلل المتكامل. جميع الحقوق محفوظة.</span>
          <div className="flex gap-x-4 font-semibold text-slate-600">
            <button onClick={() => navigateTo("/")} className="hover:text-teal-800 transition-colors">الرئيسية</button>
            <button onClick={() => navigateTo("/terms")} className="hover:text-teal-800 transition-colors">شروط الخدمة</button>
            <button onClick={() => navigateTo("/privacy")} className="hover:text-teal-800 transition-colors underline">سياسة الخصوصية</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
