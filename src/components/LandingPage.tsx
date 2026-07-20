import React, { useState } from "react";

interface LandingPageProps {
  onEnterApp: () => void;
  navigateTo: (path: string) => void;
}

export default function LandingPage({ onEnterApp, navigateTo }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen selection:bg-teal-500 selection:text-white" style={{ fontFamily: "'Noto Sans Arabic', 'Inter', system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-x-3">
              <div className="w-11 h-11 bg-teal-800 flex items-center justify-center rounded-2xl shadow-inner">
                <i className="fas fa-book text-white text-2xl"></i>
              </div>
              <div>
                <span className="font-bold text-2xl tracking-tight text-teal-900 block leading-tight">بحث OS</span>
                <span className="font-medium text-teal-700 text-xs block -mt-0.5">bahthOS</span>
              </div>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-x-8 text-sm">
              <a href="#features" className="font-medium text-slate-600 hover:text-teal-800 transition-colors">المميزات</a>
              <a href="#how" className="font-medium text-slate-600 hover:text-teal-800 transition-colors">كيف يعمل</a>
              <a href="#comparison" className="font-medium text-slate-600 hover:text-teal-800 transition-colors">لماذا بحث OS؟</a>
              <a href="#testimonials" className="font-medium text-slate-600 hover:text-teal-800 transition-colors">آراء الباحثين</a>
            </div>
            
            {/* Auth Buttons */}
            <div className="flex items-center gap-x-3">
              {/* Sign In Button */}
              <button 
                onClick={onEnterApp}
                id="landing-signin-btn"
                className="px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 transition-all rounded-3xl border border-teal-200 flex items-center gap-x-2">
                <i className="fas fa-sign-in-alt"></i>
                <span>تسجيل الدخول</span>
              </button>
              
              {/* Sign Up Button */}
              <button 
                onClick={onEnterApp}
                id="landing-signup-btn"
                className="px-5 py-2 text-sm font-semibold bg-teal-800 hover:bg-teal-900 transition-all text-white rounded-3xl flex items-center gap-x-2 shadow-sm">
                <span>ابدأ الآن مجاناً</span>
                <i className="fas fa-arrow-left text-xs"></i>
              </button>
              
              {/* Mobile Menu Btn */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                id="landing-mobile-menu-btn"
                className="md:hidden w-10 h-10 flex items-center justify-center text-teal-800">
                <i className="fas fa-bars text-xl"></i>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-y-3 text-sm" id="landing-mobile-dropdown">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="font-medium text-slate-600 hover:text-teal-800 py-1 transition-colors">المميزات</a>
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="font-medium text-slate-600 hover:text-teal-800 py-1 transition-colors">كيف يعمل</a>
            <a href="#comparison" onClick={() => setMobileMenuOpen(false)} className="font-medium text-slate-600 hover:text-teal-800 py-1 transition-colors">لماذا بحث OS؟</a>
            <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="font-medium text-slate-600 hover:text-teal-800 py-1 transition-colors">آراء الباحثين</a>
          </div>
        )}
      </nav>
      
      {/* Hero Section */}
      <div className="text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f766e 0%, #134e4b 100%)" }} id="landing-hero-section">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="max-w-screen-xl mx-auto px-6 pt-16 pb-20 relative z-10">
          <div className="grid md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7 text-right">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-3xl text-xs font-semibold inline-block mb-4 border border-teal-500/30">مساعد الباحث والمحلل الذكي</span>
              <h1 className="text-4xl md:text-6xl leading-[1.15] font-bold tracking-tight mb-6">
                منصة بحث OS <br/>
                <span className="text-teal-200">مساعدك في شتى مجالات البحث والتحليل</span>
              </h1>
              
              <p className="max-w-xl text-lg md:text-xl text-teal-100 mb-8 leading-relaxed">
                مساعد بحثي متكامل يساعدك على تحليل وتوليف وثائقك ومصادرك بدقة متناهية، ومقارنتها واستخلاص أوجه الاتفاق والاختلاف في مجالات الأعمال، التسويق، التقنية، الصحافة، والعلوم، مع التوثيق المباشر لكل معلومة إلى مصدرها الأساسي.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button 
                  onClick={onEnterApp}
                  id="landing-hero-cta"
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-teal-900 hover:bg-teal-50 transition-all font-bold text-lg rounded-3xl flex items-center justify-center gap-x-3 shadow-xl">
                  <span>ابدأ رحلتك مجاناً</span>
                  <i className="fas fa-arrow-left"></i>
                </button>
                
                <button 
                  onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} 
                  id="landing-hero-secondary-cta"
                  className="w-full sm:w-auto px-8 py-3.5 border border-white/40 hover:bg-white/10 transition-all font-semibold text-lg rounded-3xl flex items-center justify-center gap-x-2">
                  <span>شاهد كيف يعمل</span>
                </button>
              </div>
              
              <div className="mt-10 flex items-center gap-x-4 text-sm justify-start">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  <div className="w-8 h-8 bg-white border border-teal-700 rounded-full overflow-hidden"><img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                  <div className="w-8 h-8 bg-white border border-teal-700 rounded-full overflow-hidden"><img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                  <div className="w-8 h-8 bg-white border border-teal-700 rounded-full overflow-hidden"><img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                </div>
                <div>
                  <span className="font-semibold text-white">أكثر من 100</span>{" "}
                  <span className="text-teal-200">باحث يعتمدون على بحث OS</span>
                </div>
              </div>
            </div>
            
            {/* Hero Visual */}
            <div className="md:col-span-5 relative">
              <div className="glass p-2 rounded-3xl shadow-2xl border border-white/20 max-w-[380px] mx-auto md:mx-0">
                <div className="bg-white rounded-2xl overflow-hidden shadow-inner text-slate-800 text-right">
                  <div className="px-4 py-3 bg-teal-800 text-white flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <i className="fas fa-book text-lg"></i>
                      <span className="font-semibold text-sm">مساعد بحث OS والتحليل المتكامل</span>
                    </div>
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  </div>
                  
                  <div className="p-5 bg-white">
                    <div className="text-[11px] font-medium text-teal-600 mb-1">السؤال البحثي الجاري</div>
                    <div className="text-xs font-semibold text-slate-800 mb-4 leading-relaxed">
                      ما هي أبرز الاختلافات المنهجية ونقاط التعارض في قياس مستوى رضا الطلاب عن التعليم المدمج؟
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <div className="p-2.5 bg-slate-50 border-r-2 border-teal-600 rounded text-[11px] leading-relaxed text-slate-700">
                        "تشير <strong>الوثيقة الأولى</strong> إلى ارتفاع التحصيل بنسبة 8% بينما يوضح <strong>التقرير الثاني</strong> انخفاض التحصيل بنسبة 6% بسبب عوائق البنية التحتية..."
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-2xl font-semibold flex items-center gap-x-1">
                        <i className="fas fa-check-circle text-xs"></i> 
                        <span className="font-bold text-[10px]">10 مصادر مدمجة</span>
                      </div>
                      <div className="text-teal-700 text-xs flex items-center gap-x-1">
                        <i className="fas fa-link"></i> 
                        <span className="text-[11px]">توثيق دقيق</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-5 py-3 bg-slate-50 border-t flex items-center justify-between text-xs">
                    <div className="flex items-center gap-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="font-medium text-emerald-700 text-[11px]">حالة النظام: نشط ومستعد</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">الوثائق: 10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Trust Bar */}
      <div className="max-w-screen-xl mx-auto px-6 py-6 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center">
          <div className="flex items-center gap-x-2">
            <div className="text-teal-700"><i className="fas fa-university text-lg"></i></div>
            <span className="text-sm font-semibold text-slate-600">شركات، جامعات، ومؤسسات بحثية</span>
          </div>
          <div className="hidden md:block w-px h-4 bg-slate-300"></div>
          <div className="text-sm font-medium text-slate-500">مُصمم ومُعرب بدقة للباحثين وصنّاع القرار باللغة العربية الفصحى</div>
        </div>
      </div>
      
      {/* Features Section */}
      <div id="features" className="max-w-screen-xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center mb-16">
          <span className="px-4 py-1 text-xs font-semibold tracking-wide bg-teal-100 text-teal-700 rounded-3xl">مزايا فريدة وعلمية</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-4 tracking-tight text-slate-900">أداة بحثية متكاملة لتحليل وثائقك</h2>
          <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">صُمم بحث OS ليتخطى قصور الدردشة التقليدية العشوائية، ويقدم للباحث عملاً بحثياً وتوليفياً موثقاً ورصيناً.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between" id="landing-feature-1">
            <div>
              <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
                <i className="fas fa-file-shield text-2xl"></i>
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-3">الالتزام الحصري بوثائقك</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                لا يعتمد المساعد على أي معرفة خارجية مسبقة؛ بل يستنبط إجاباته وتحليلاته حصرياً مما تم تزويده به من وثائق، لتفادي الهلوسة والافتراءات العلمية.
              </p>
            </div>
            <div className="mt-6">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-3xl">دقة 100%</span>
            </div>
          </div>
          
          {/* Feature 2 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300" id="landing-feature-2">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
              <i className="fas fa-balance-scale text-2xl"></i>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3">التمييز بين الحقيقة والاستنتاج</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              يفرق محرك بحث OS بوضوح تام بين ما ورد صراحة في المصادر ("الحقائق المصرحة") وبين الاستدلالات أو الفرضيات الضمنية التي يطرحها الباحثون.
            </p>
          </div>
          
          {/* Feature 3 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300" id="landing-feature-3">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
              <i className="fas fa-quote-right text-2xl"></i>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3">الاستشهاد المباشر والموثق</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              يربط كل استنتاج أو فكرة بالوثيقة التي استقى منها المعلومة بشكل دقيق، مع ذكره لاسم الوثيقة داخل سياق الجملة لتيسير المراجعة.
            </p>
          </div>
          
          {/* Feature 4 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300" id="landing-feature-4">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
              <i className="fas fa-object-group text-2xl"></i>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3">مقارنة وتوليف مصادر متعددة</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              يقوم بتشريح منهجي لمجموعة المصادر التي ترفعها، ليكشف تلقائياً عن نقاط التوافق والاتفاق الفكري، ونقاط الاختلاف والتعارض الإحصائي بينها.
            </p>
          </div>
          
          {/* Feature 5 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300" id="landing-feature-5">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
              <i className="fas fa-spell-check text-2xl"></i>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3">تنقية اللفظ والتعريب الركيك</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              يكتشف تلقائياً المصطلحات والتعريبات الصوتية الركيكة (مثل "البلندد ليرنينغ") ويستبدلها فوراً بمصطلحات عربية فصيحة ومعتمدة علمياً.
            </p>
          </div>
          
          {/* Feature 6 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300" id="landing-feature-6">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 text-teal-700 rounded-2xl mb-6">
              <i className="fas fa-compass text-2xl"></i>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3">اقتراح أسئلة مكملة ذكية</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              لا يقف عند حد الإجابة، بل يقود خطتك البحثية إلى الأمام عبر اقتراح أسئلة تكميلية عميقة تكشف الفجوات البحثية والآفاق غير المستكشفة.
            </p>
          </div>
        </div>

        {/* Multilingual Support Banner */}
        <div className="mt-16 text-white rounded-[2rem] p-8 md:p-10 shadow-lg relative overflow-hidden border border-teal-700/50" id="landing-multilingual-banner" style={{ background: "linear-gradient(135deg, #0d5c58 0%, #083c39 100%)" }}>
          {/* Decorative icons and graphics */}
          <div className="absolute -left-10 -bottom-10 text-teal-800/10 text-[10rem] pointer-events-none select-none font-bold">
            A
          </div>
          <div className="absolute -right-10 -top-10 text-teal-800/10 text-[10rem] pointer-events-none select-none font-bold">
            ع
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-right max-w-3xl">
              <div className="inline-flex items-center gap-x-2 px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs font-semibold mb-4 border border-teal-500/30">
                <i className="fas fa-globe text-xs"></i>
                <span>دعم المصادر متعددة اللغات</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">تحليل مصادر بلغات مختلفة وصياغة عربية فصحى</h3>
              <p className="text-teal-100 text-sm md:text-base leading-relaxed">
                يدعم بحث OS قراءة وتحليل الوثائق والمصادر بمختلف اللغات (كالإنجليزية والفرنسية)، ويقوم بتوليفها وإصدار ردوده وتقاريره حصرًا بلغة عربية فصحى تلتزم بالرصانة البحثية والمصطلحات المعتمدة.
              </p>
            </div>
            <div className="flex-shrink-0 flex gap-x-3 text-sm">
              <div className="px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl flex items-center gap-x-2 transition-all font-semibold">
                <span className="text-[10px] uppercase font-mono text-teal-300">en</span>
                <span>English</span>
              </div>
              <div className="px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl flex items-center gap-x-2 transition-all font-semibold">
                <span className="text-[10px] uppercase font-mono text-teal-300">fr</span>
                <span>Français</span>
              </div>
              <div className="px-4 py-2.5 bg-teal-500/20 text-teal-200 border border-teal-500/30 rounded-xl flex items-center gap-x-2 font-bold">
                <span className="text-[10px] uppercase font-mono text-teal-300">ar</span>
                <span>العربية الفصحى</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* How it Works */}
      <div id="how" className="bg-white py-20 border-t border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="max-w-xl mx-auto text-center mb-16">
            <span className="text-teal-700 text-xs font-bold tracking-widest bg-teal-50 px-3 py-1.5 rounded-full">سير العمل البحثي</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 text-slate-950">كيف يعمل نظام بحث OS؟</h2>
            <p className="text-slate-600 mt-2 text-sm md:text-base">تحوّل من العشوائية إلى دراسة ومنهجية بحثية رصينة ومحكمة في أربع خطوات:</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl relative" id="landing-step-1">
              <div className="w-10 h-10 bg-teal-800 text-white rounded-2xl mb-6 flex items-center justify-center font-bold text-lg">1</div>
              <h4 className="font-bold text-lg text-slate-950 mb-3">تحميل مصادرك البحثية</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ارفع أبحاثك، دراساتك، أو تقاريرك (بصيغ PDF أو Docx) بضغطة زر واحدة. يتعرف النظام فوراً على تفاصيلها اللغوية وعدد كلماتها.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl relative" id="landing-step-2">
              <div className="w-10 h-10 bg-teal-800 text-white rounded-2xl mb-6 flex items-center justify-center font-bold text-lg">2</div>
              <h4 className="font-bold text-lg text-slate-950 mb-3">طرح التساؤل المنهجي</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                اطرح سؤالك البحثي أو اطلب إجراء مقارنة وتوليف بين دراسات محددة. سيقوم محرك التحليل والبحث ببدء الفحص الدقيق للمحتوى.
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl relative" id="landing-step-3">
              <div className="w-10 h-10 bg-teal-800 text-white rounded-2xl mb-6 flex items-center justify-center font-bold text-lg">3</div>
              <h4 className="font-bold text-lg text-slate-950 mb-3">استخلاص وتقييم المعطيات</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقوم النظام بالربط والتحليل، واستخلاص المصطلحات التقنية المعربة، واكتشاف الأرقام والإحصائيات المتوافقة والمتعارضة بدقة.
              </p>
            </div>
            
            {/* Step 4 */}
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl relative" id="landing-step-4">
              <div className="w-10 h-10 bg-teal-800 text-white rounded-2xl mb-6 flex items-center justify-center font-bold text-lg">4</div>
              <h4 className="font-bold text-lg text-slate-950 mb-3">تصدير تقرير توليفي محكم</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                احصل على صياغة رصينة وبليغة باللغة العربية الفصحى، مدعومة بإسناد وتوثيق رصين لكل فقرة بالوثيقة المناسبة لها.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Comparison Section */}
      <div id="comparison" className="max-w-screen-xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 text-right">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-3xl text-xs font-bold border border-amber-200">مقارنة مقاربة النظم</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4 leading-tight text-slate-950">ليس مجرد نافذة دردشة.<br/>بل منصة رصينة وموثوقة.</h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              تعتمد المساعدات الذكية التقليدية على تكهناتها، وتصدر إجابات غير محققة وعشوائية الصياغة. منصة بحث OS تؤسس كل استخلاص أو مقارنة على قاعدة برهان ملموسة من ثنايا وثائقك ومصادرك البحثية فحسب.
            </p>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-x-3">
                <div className="mt-1 text-emerald-600"><i className="fas fa-check-circle text-lg"></i></div>
                <div>
                  <div className="font-semibold text-slate-900">مصداقية وأمان كامل</div>
                  <div className="text-sm text-slate-500">لا اجتهاد ولا اختلاق لنصوص خارجية غريبة.</div>
                </div>
              </div>
              <div className="flex items-start gap-x-3">
                <div className="mt-1 text-emerald-600"><i className="fas fa-check-circle text-lg"></i></div>
                <div>
                  <div className="font-semibold text-slate-900">عربية فصحى راقية</div>
                  <div className="text-sm text-slate-500">صياغة بأسلوب النثر العلمي المحكم والمعبر.</div>
                </div>
              </div>
              <div className="flex items-start gap-x-3">
                <div className="mt-1 text-emerald-600"><i className="fas fa-check-circle text-lg"></i></div>
                <div>
                  <div className="font-semibold text-slate-900">هندسة متخصصة لكافة أنواع البحث</div>
                  <div className="text-sm text-slate-500">مبني خصيصاً لأبحاث السوق، التحليل التقني، مراجعة الأدبيات، وتقارير السياسات.</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <span className="font-bold text-slate-900">تحليل مقارن لأوجه الفارق</span>
                <span className="text-xs px-3 py-1 bg-teal-100 text-teal-800 font-bold rounded-3xl">جدول المقارنة</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right" id="landing-comparison-table">
                  <thead>
                    <tr className="border-b text-slate-500 text-xs font-semibold">
                      <th className="py-3 pr-3">المعيار المنهجي</th>
                      <th className="py-3 px-3 text-center bg-teal-50/50 text-teal-900 rounded-t-xl">نظام بحث OS</th>
                      <th className="py-3 px-3 text-center text-slate-500">الروبوتات العامة (GPT/Claude)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                    <tr>
                      <td className="py-4 pr-3 font-semibold text-slate-800">حصر المرجعية بنص الوثائق</td>
                      <td className="py-4 px-3 text-center bg-teal-50/50 text-emerald-700 font-bold">صياغة ملزمة ومطابقة (100%)</td>
                      <td className="py-4 px-3 text-center text-red-500">مستبعد (تدمج معارفها وتخترع مراجع)</td>
                    </tr>
                    <tr>
                      <td className="py-4 pr-3 font-semibold text-slate-800">أسلوب الاستشهاد والإسناد</td>
                      <td className="py-4 px-3 text-center bg-teal-50/50 text-emerald-700 font-bold">إسناد دقيق داخل الجملة لاسم المصدر</td>
                      <td className="py-4 px-3 text-center text-red-500">إشارات عائمة أو غائبة بالكلية</td>
                    </tr>
                    <tr>
                      <td className="py-4 pr-3 font-semibold text-slate-800">اكتشاف التعارض الإحصائي</td>
                      <td className="py-4 px-3 text-center bg-teal-50/50 text-emerald-700 font-bold">محدد وبنيوي في جداول وتقارير ومقارنات</td>
                      <td className="py-4 px-3 text-center text-red-500">غير مكترث (يسرد تلخيصات منفصلة)</td>
                    </tr>
                    <tr>
                      <td className="py-4 pr-3 font-semibold text-slate-800">تنقية اللفظ والتعريب الركيك</td>
                      <td className="py-4 px-3 text-center bg-teal-50/50 text-emerald-700 font-bold">تلقائي عبر معجم المصطلحات المدمج</td>
                      <td className="py-4 px-3 text-center text-red-500">يستخدم المصطلحات كما هي دون فحص</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Testimonials */}
      <div id="testimonials" className="max-w-screen-xl mx-auto px-6 py-16 bg-slate-900 text-white rounded-[3rem] my-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-2xl mx-auto text-center mb-12 relative z-10">
          <span className="font-semibold text-teal-400 tracking-wider">أصداء وتجارب</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2 text-white">ماذا يقول زملاؤنا الباحثون؟</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 relative z-10">
          {/* Testimonial 1 */}
          <div className="bg-slate-800/80 border border-slate-700/50 p-8 rounded-3xl flex flex-col justify-between" id="landing-testimonial-1">
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              "غيّر نظام بحث OS طريقتنا في إعداد دراسات السوق والجدوى الاقتصادية. نرفع تقارير مالية وفنية ضخمة بمختلف اللغات، فتقوم المنصة بتوليفها بدقة فائقة وصياغة ملخصات استراتيجية رصينة بلغة عربية فصحى تناسب غرف الاجتماعات وصنّاع القرار، مع إسناد فوري ودقيق للمصادر والبيانات المرفوعة."
            </p>
            <div className="flex items-center gap-x-4">
              <div className="w-11 h-11 bg-teal-800 rounded-full overflow-hidden flex-shrink-0">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-white">م. خالد الهاشمي</div>
                <div className="text-[11px] text-teal-400">مستشار استراتيجيات وأبحاث السوق، الرياض، السعودية</div>
              </div>
            </div>
          </div>
          
          {/* Testimonial 2 */}
          <div className="bg-slate-800/80 border border-slate-700/50 p-8 rounded-3xl flex flex-col justify-between" id="landing-testimonial-2">
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              "أكثر ما يبهرني في بحث OS هو التزامه الصارم بالمصادر المرفوعة ودقته المنهجية الخالية من التزييف. في التحقيقات الاستقصائية وتحليل السياسات، أقارن عشرات الوثائق والتقارير الصحفية ليعطيني فوراً نقاط الاتفاق والاختلاف بدقة ومصداقية كاملة واحترافية عالية."
            </p>
            <div className="flex items-center gap-x-4">
              <div className="w-11 h-11 bg-teal-800 rounded-full overflow-hidden flex-shrink-0">
                <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-white">أ. ياسمين المصري</div>
                <div className="text-[11px] text-teal-400">باحثة في السياسات العامة وصحفية استقصائية، القاهرة، مصر</div>
              </div>
            </div>
          </div>
          
          {/* Testimonial 3 */}
          <div className="bg-slate-800/80 border border-slate-700/50 p-8 rounded-3xl flex flex-col justify-between" id="landing-testimonial-3">
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              "المعجم اللغوي المدمج عبقري! لقد اعتادت أبحاثنا ومقالاتنا وتقاريرنا التقنية والمهنية على تضمين ترجمات حرفية بشعة للمصطلحات التقنية الأجنبية، لكن أداة مراجعة وتنقية التعريبات الصوتية في بحث OS استبدلت تعبيرات مثل 'البلندد' و 'الأونلاين' بمصطلحات عربية رصينة فصيحة."
            </p>
            <div className="flex items-center gap-x-4">
              <div className="w-11 h-11 bg-teal-800 rounded-full overflow-hidden flex-shrink-0">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-white">أ.د. سميرة بن يوسف</div>
                <div className="text-[11px] text-teal-400">أستاذة اللسانيات وباحثة في النقد المقارن، جامعة المسيلة، الجزائر</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to Action Footer Section */}
      <div className="max-w-screen-xl mx-auto px-6 py-12 text-center text-slate-500 text-xs border-t border-slate-200" id="landing-footer-section">
        <div className="max-w-xl mx-auto mb-6">
          <h3 className="font-bold text-xl text-slate-900 mb-2">ابدأ دراستك التوليفية التالية اليوم</h3>
          <p className="text-sm text-slate-500">انضم إلى آلاف الباحثين وصناع القرار والمحللين الذين يرتقون بجودة أعمالهم وأبحاثهم باستخدام نظام بحث OS.</p>
        </div>
        <div className="mb-8">
          <button 
            onClick={onEnterApp}
            id="landing-footer-cta"
            className="px-8 py-3.5 bg-teal-800 hover:bg-teal-900 transition-all text-white font-bold text-base rounded-3xl inline-flex items-center gap-x-3 shadow-md">
            <span>ادخل إلى منصة الباحث مجاناً</span>
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span>© 2026 بحث OS - مساعد الباحث والمحلل المتكامل. جميع الحقوق محفوظة.</span>
          <div className="flex gap-x-4">
            <button onClick={() => navigateTo("/terms")} className="hover:underline cursor-pointer">شروط الخدمة</button>
            <button onClick={() => navigateTo("/privacy")} className="hover:underline cursor-pointer">سياسة الخصوصية</button>
          </div>
        </div>
      </div>
    </div>
  );
}
