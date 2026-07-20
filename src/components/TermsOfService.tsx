import React from "react";

interface TermsOfServiceProps {
  navigateTo: (path: string) => void;
  onEnterApp: () => void;
}

export default function TermsOfService({ navigateTo, onEnterApp }: TermsOfServiceProps) {
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
      <div className="relative bg-teal-950 text-white overflow-hidden py-16 md:py-24" id="terms-header">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent)] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-4">
          <span className="px-3.5 py-1 bg-teal-500/20 text-teal-300 rounded-3xl text-xs font-semibold inline-block border border-teal-500/30">
            الوثائق القانونية والسياسات
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            شروط وأحكام الخدمة
          </h1>
          <p className="text-teal-100 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            يرجى قراءة شروط الخدمة هذه بعناية قبل البدء في استخدام منصة بحث OS. يوضح هذا الميثاق الالتزامات القانونية وإخلاء المسؤولية المتبادلة.
          </p>
          <div className="text-xs text-teal-200/80 font-mono">
            تاريخ التحديث الأخير: 17 يوليو 2026
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 md:p-10 space-y-10 text-right" dir="rtl">
          
          {/* Critical Liability Disclaimer Box (highlighted) */}
          <div className="bg-amber-50/70 border-r-4 border-amber-600 rounded-xl p-5 md:p-6 space-y-4">
            <div className="flex items-start gap-x-3 text-amber-900 font-bold text-base">
              <i className="fas fa-exclamation-triangle text-amber-600 text-lg mt-0.5"></i>
              <span>بند إخلاء المسؤولية القانونية التامة والنهائية (هام جداً)</span>
            </div>
            
            <div className="text-xs md:text-sm text-slate-700 leading-relaxed space-y-3">
              <p className="font-semibold text-slate-900">
                باستخدامك لمنصة بحث OS، فإنك تقر وتوافق صراحةً وبشكل كامل غير قابل للنقض أو التفاوض على البنود القانونية التالية:
              </p>
              <ul className="list-disc list-inside space-y-2 pr-2">
                <li>
                  <strong className="text-slate-900">عدم تحمل المسؤولية عن المحتوى:</strong> لا تتحمل منصة بحث OS (bahthOS) أو مطوروها أو مالكها أي مسؤولية قانونية أو أدبية أو مالية تجاه أي محتوى خاطئ، أو غير دقيق، أو غير مكتمل، أو معيب، أو مهلوس (Hallucinated)، أو غير مقبول يتم توليده بواسطة الذكاء الاصطناعي المدمج في التطبيق.
                </li>
                <li>
                  <strong className="text-slate-900">المسؤولية الحصرية للمستخدم:</strong> يتحمل المستخدم وحده المسؤولية الكاملة والمنفردة عن استخدام هذا التطبيق وجميع مخرجاته ومقالاته وتقاريره التوليفية وقراراته البحثية أو المهنية المبنية عليه.
                </li>
                <li>
                  <strong className="text-slate-900">التنازل عن الملاحقة القضائية:</strong> يوافق المستخدم موافقة تامة على أنه لا يمكنه، تحت أي ظرف من الظروف وبأي حال من الأحوال، مقاضاة التطبيق، أو مطوريه، أو مالكه، أو تحميلهم أي مسؤولية مدنية أو جنائية، أو تقديم أي دعوى، أو شكوى، أو إجراء قانوني بسبب حدوث أي عطل، أو هلوسة في المحتوى، أو عدم دقة البيانات، أو أي مشكلة أخرى تنشأ عن استخدام هذا التطبيق.
                </li>
                <li>
                  <strong className="text-slate-900">تقديم الخدمة "كما هي":</strong> يتم تقديم منصة بحث OS بالكامل "كما هي" (As Is) ودون أي ضمانات من أي نوع، صريحة كانت أو ضمنية، ويتحمل المستخدم وحده مخاطر استخدام الخدمة.
                </li>
              </ul>
            </div>
          </div>

          {/* Bilingual Disclaimer */}
          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 space-y-4 text-left" dir="ltr">
            <div className="flex items-start gap-x-3 text-slate-900 font-bold text-base">
              <i className="fas fa-balance-scale text-slate-700 text-lg mt-0.5"></i>
              <span>Legal Disclaimers & Limitation of Liability (English Version)</span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-3">
              <p className="font-semibold text-slate-800">
                By accessing and using bahthOS, you explicitly and unconditionally agree to the following terms:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>
                  <strong>No Generated Content Liability:</strong> bahthOS does not assume any responsibility or liability for any faulty, inaccurate, incomplete, hallucinated, or objectionable content generated by the application.
                </li>
                <li>
                  <strong>User Sole Responsibility:</strong> The user assumes full, exclusive, and sole responsibility for any use of the app, its outputs, and any decisions derived therefrom.
                </li>
                <li>
                  <strong>Waiver of Claims:</strong> The user agrees that they cannot, under any circumstances, hold the app, its developers, or its owner legally responsible or file any claim, complaint, lawsuit, or legal action due to malfunction, hallucinated content, inaccurate information, or any other issue arising from the use of the application.
                </li>
                <li>
                  <strong>"As Is" Service:</strong> bahthOS is provided "as is" with no warranties of any kind, express or implied, and the user uses the service strictly at their own risk.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">1. قبول الشروط والاتفاقية</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              عند استخدامك لمنصة بحث OS، فإنك تؤكد موافقتك الالتزام بشروط الخدمة هذه وبجميع القوانين واللوائح المعمول بها. إذا كنت لا توافق على أي من هذه الشروط، فيرجى التوقف فوراً عن استخدام الخدمة.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">2. حقوق الملكية الفكرية والاستخدام المقبول</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              جميع عناصر الواجهة والتصميم والشعارات والأكواد البرمجية الخاصة بمنصة بحث OS هي ملكية حصرية لأصحابها ومحميّة بموجب قوانين حماية الملكية الفكرية. يُرخص للمستخدم استخدام المنصة حصراً لغايات البحث والتحليل العلمي والمهني الشخصي، ويُمنع منعاً باتاً استغلال الأكواد أو محاولة عكس هندسة البرمجيات أو قرصنتها.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">3. طبيعة معالجة الملفات والبيانات</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              تتم معالجة جميع الملفات والوثائق التي ترفعها إلى المنصة بشكل آمن تماماً ومن جانب الخادم (Server-side) عبر واجهة برمجة تطبيقات Gemini الخاصة بشركة Google لضمان سرية وخصوصية بياناتك وعدم تسريب مفاتيح الاتصال. يُنصح دائماً بعدم رفع وثائق تحتوي على بيانات سرية غاية في الحساسية مثل أرقام التعريف الشخصية أو كلمات المرور.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-teal-900">4. التعديلات على شروط الخدمة</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              نحتفظ بحق تعديل أو تغيير شروط وأحكام الخدمة هذه في أي وقت دون إشعار مسبق. يُعتبر استمرارك في استخدام منصة بحث OS بعد أي تعديل بمثابة قبول صريح منك للنسخة المحدثة من شروط الخدمة.
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
              <span>أوافق، الانتقال إلى تطبيق بحث OS</span>
              <i className="fas fa-arrow-left text-xs"></i>
            </button>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 mt-12 text-center text-slate-500 text-xs" id="terms-footer">
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px]">
          <span>© 2026 بحث OS - مساعد الباحث والمحلل المتكامل. جميع الحقوق محفوظة.</span>
          <div className="flex gap-x-4 font-semibold text-slate-600">
            <button onClick={() => navigateTo("/")} className="hover:text-teal-800 transition-colors">الرئيسية</button>
            <button onClick={() => navigateTo("/terms")} className="hover:text-teal-800 transition-colors underline">شروط الخدمة</button>
            <button onClick={() => navigateTo("/privacy")} className="hover:text-teal-800 transition-colors">سياسة الخصوصية</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
