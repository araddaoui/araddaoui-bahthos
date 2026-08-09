import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Check, 
  Trash2, 
  Globe, 
  BookOpen, 
  X,
  FileCheck,
  AlertCircle,
  UploadCloud,
  Sparkles,
  Loader2,
  FileText
} from "lucide-react";
import { Source, GlossaryTerm } from "../types";
import { parseDocumentFile } from "../utils/documentParser";
import { ensureArabicSummary, extractFallbackTermsFromText, detectSourceLanguage, spellcheckAndRepairArabicAndEnglishText } from "../utils/termExtractor";

interface SourcesListProps {
  sources: Source[];
  onToggleSource: (id: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onAddSource: (title: string, content: string, language: "ar" | "en" | "fr", summary?: string, error?: string, terms?: any[]) => void;
  onDeleteSource: (id: string) => void;
  onDeleteAllSources?: () => void;
  selectedSourceId: string | null;
  onSelectSource: (id: string) => void;
  onChatWithSingleSource?: (id: string) => void;
  onAskQuestionFromSearch?: (text: string) => void;
  glossaryTerms: GlossaryTerm[];
  isSweeping?: boolean;
  sweepCorrectionCount?: number | null;
}

export default function SourcesList({
  sources,
  onToggleSource,
  onEnableAll,
  onDisableAll,
  onAddSource,
  onDeleteSource,
  onDeleteAllSources,
  selectedSourceId,
  onSelectSource,
  onChatWithSingleSource,
  onAskQuestionFromSearch,
  glossaryTerms,
  isSweeping = false,
  sweepCorrectionCount = null,
}: SourcesListProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sources" | "glossary">("sources");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(() => sources.length === 0);
  
  useEffect(() => {
    if (sources.length === 0) {
      setShowAddForm(true);
    }
  }, [sources.length]);
  
  // Add form fields
  const [newContent, setNewContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Automatic analysis & uploading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadTab, setUploadTab] = useState<"upload" | "paste">("upload");
  const [sourceToDeleteId, setSourceToDeleteId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const activeCount = sources.filter((s) => s.enabled).length;

  const filteredSources = sources.filter((src) => {
    const q = searchQuery.toLowerCase();
    return (
      src.title.toLowerCase().includes(q) ||
      src.content.toLowerCase().includes(q)
    );
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      readAndAnalyzeFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndAnalyzeFile(file);
    }
  };

  const readAndAnalyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    setErrorMsg("");
    setAnalysisStep("جاري استخراج واستلقاء نص المستند...");

    try {
      const parsed = await parseDocumentFile(file);
      await runAutomaticAnalysis(parsed.text, parsed.base64, parsed.mimeType, parsed.fileName);
    } catch (err: any) {
      console.error("Failed to parse document file:", err);
      setErrorMsg("تعذر قراءة المستند. يرجى تجربة ملف آخر.");
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  const runAutomaticAnalysis = async (content: string, base64?: string, mimeType?: string, fileName?: string) => {
    if (!content.trim() && !base64) {
      setErrorMsg("يرجى إدخال محتوى المستند أو لصقه أو رفع ملف صالح.");
      setIsAnalyzing(false);
      setAnalysisStep("");
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg("");
    setAnalysisStep("جاري قراءة محتوى الملف والمستند...");
    
    try {
      setTimeout(() => setAnalysisStep("جاري فحص لغة المستند وترميز النص..."), 400);
      setTimeout(() => setAnalysisStep("جاري استخلاص العنوان وصياغة ملخص بليغ باللغة العربية..."), 800);

      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, base64, mimeType, fileName }),
      });

      if (!response.ok) {
        let errMsg = "فشلت الاستجابة من خادم التحليل.";
        try {
          const contentType = response.headers.get("Content-Type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMsg = errData.error || errData.details || errMsg;
          } else {
            const text = await response.text();
            if (response.status === 429 || text.toLowerCase().includes("quota") || text.toLowerCase().includes("limit")) {
              errMsg = "عذراً، تم تجاوز الحد الأقصى للطلبات اليومية المجانية للذكاء الاصطناعي (Quota Exceeded). يرجى إعادة المحاولة لاحقاً.";
            } else if (text.includes("413") || text.toLowerCase().includes("payload too large")) {
              errMsg = "حجم الملف كبير جداً بالنسبة للشبكة حالياً. يرجى محاولة رفع مستند أصغر أو استخدام اتصال إنترنت أسرع.";
            } else if (response.status === 504 || response.status === 502) {
              errMsg = "انتهت مهلة اتصال خادم التحليل (Timeout) نظراً لبطء اتصال الإنترنت أو الحجم الكبير للملف.";
            }
          }
        } catch (parseErr) {
          // ignore
        }
        throw new Error(errMsg);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error("تلقى التطبيق استجابة غير صالحة من خادم التحليل.");
      }
      
      const finalArabicSummary = spellcheckAndRepairArabicAndEnglishText(ensureArabicSummary(data.summary, data.title, data.originalText || content));
      const detectedLang = detectSourceLanguage(data.originalText || content, data.title, data.language);
      const cleanTitle = spellcheckAndRepairArabicAndEnglishText(data.title);
      onAddSource(cleanTitle, data.originalText || content, detectedLang, finalArabicSummary, undefined, data.terms);
      setNewContent("");
      setErrorMsg("");
      setShowAddForm(false);
    } catch (err: any) {
      console.warn("Server analysis unavailable or failed, using client-side fallback:", err);
      
      const rawTitle = fileName || `مستند مضاف ${sources.length + 1}`;
      const cleanTitle = spellcheckAndRepairArabicAndEnglishText(rawTitle);
      const textContent = (content && content.trim()) 
        ? content 
        : `محتوى المستند المرفق (${cleanTitle}):\nتم إدراج المستند المرفق بنجاح للتحليل والتوليف البحثي والمقارنة بواسطة الذكاء الاصطناعي.`;
      const autoSummary = spellcheckAndRepairArabicAndEnglishText(ensureArabicSummary("", cleanTitle, textContent));
      const detectedLang = detectSourceLanguage(textContent, cleanTitle);
      
      const fallbackTerms = extractFallbackTermsFromText(textContent, undefined, cleanTitle);
      onAddSource(cleanTitle, textContent, detectedLang, autoSummary, undefined, fallbackTerms);
      setNewContent("");
      setErrorMsg("");
      setShowAddForm(false);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#fafaf8] border-l border-[#e2e2dd]" id="sources-column">
      {/* Header */}
      <div className="p-4 border-b border-[#e2e2dd]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-extrabold text-[#111111] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#094d4e]" />
            <span>المصادر البحثية</span>
          </h2>
          <span className="text-xs bg-teal-50 text-[#094d4e] border border-teal-100/80 px-2.5 py-1 rounded-full font-semibold">
            {activeCount} من {sources.length} نشطة
          </span>
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
          الوثائق المفعّلة يتم تضمينها تلقائياً في سياق التحليل والمقارنة بواسطة الذكاء الاصطناعي.
        </p>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-[#e2e2dd] bg-[#fbfbfa] p-1 gap-1" id="sources-list-subtabs">
        <button
          onClick={() => setActiveSubTab("sources")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === "sources"
              ? "bg-white text-[#094d4e] shadow-2xs border border-[#e2e2dd]"
              : "text-gray-600 hover:text-gray-800"
          }`}
          id="tab-sources-list"
        >
          المصادر والمستندات ({sources.length})
        </button>
        <button
          onClick={() => setActiveSubTab("glossary")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === "glossary"
              ? "bg-white text-[#094d4e] shadow-2xs border border-[#e2e2dd]"
              : "text-gray-600 hover:text-gray-800"
          }`}
          id="tab-glossary"
        >
          المصطلحات والمفاهيم ({glossaryTerms.length})
        </button>
      </div>

      {activeSubTab === "sources" ? (
        <>
          {/* Controls: Search and Enable/Disable all */}
      <div className="p-3 border-b border-[#e2e2dd] flex flex-col gap-2 bg-[#fcfbfa]">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث أو اطرح سؤالاً... (Search or ask...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim() && onAskQuestionFromSearch) {
                e.preventDefault();
                onAskQuestionFromSearch(searchQuery.trim());
                setSearchQuery("");
              }
            }}
            className={`w-full text-xs pr-8 py-2 border border-[#e2e2dd] rounded-lg bg-white text-[#1f1f1f] focus:outline-none focus:border-[#094d4e] transition-all ${
              searchQuery.trim() ? "pl-14" : "pl-3"
            }`}
            id="sources-search-input"
            title="Type to search sources, or type a question and hit Enter to ask bahthOS"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5" />
          {searchQuery.trim() && (
            <button
              onClick={() => {
                if (onAskQuestionFromSearch) {
                  onAskQuestionFromSearch(searchQuery.trim());
                  setSearchQuery("");
                }
              }}
              className="absolute left-1.5 top-1.5 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded transition-all shadow-3xs"
              title="طرح هذا السؤال على بحث OS"
              id="sidebar-ask-inline-btn"
            >
              اسأل ↵
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <button
            onClick={onEnableAll}
            className="px-2.5 py-1 bg-[#eae9e2] text-gray-700 hover:text-[#1f1f1f] hover:bg-[#e2e2dd] transition-all rounded font-medium flex flex-col items-center justify-center line-tight"
            id="btn-enable-all-sources"
            title="Enable all sources for chat and analysis"
          >
            <span className="font-bold">تفعيل الكل</span>
            <span className="text-[8px] opacity-60 font-sans font-normal">Enable All</span>
          </button>
          <button
            onClick={onDisableAll}
            className="px-2.5 py-1 bg-[#eae9e2] text-gray-700 hover:text-[#1f1f1f] hover:bg-[#e2e2dd] transition-all rounded font-medium flex flex-col items-center justify-center line-tight"
            id="btn-disable-all-sources"
            title="Disable all sources from chat and analysis"
          >
            <span className="font-bold font-sans">تعطيل الكل</span>
            <span className="text-[8px] opacity-60 font-sans font-normal">Disable All</span>
          </button>
        </div>

        {sources.length > 0 && (
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
            id="btn-delete-all-sources"
            title="حذف جميع المصادر وتفريغ التوليفات والمصطلحات"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>حذف وتفريغ جميع المصادر ({sources.length})</span>
          </button>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredSources.length === 0 ? (
          <div className="text-center py-6 px-4 text-gray-400 space-y-3 bg-white rounded-xl border border-[#e2e2dd] my-2 shadow-2xs" id="no-sources-fallback-container">
            <div className="text-xs font-medium">
              لا توجد مصادر تطابق بحثك.
              <p className="text-[10px] text-gray-400 mt-1">No sources match your search.</p>
            </div>
            {searchQuery.trim().length > 3 && onAskQuestionFromSearch && (
              <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-100 space-y-2 text-right" dir="rtl">
                <p className="text-[10px] text-gray-600 leading-relaxed font-semibold">
                  هل تبحث عن إجابة بحثية لهذا السؤال في مستنداتك؟
                </p>
                <button
                  onClick={() => {
                    onAskQuestionFromSearch(searchQuery.trim());
                    setSearchQuery("");
                  }}
                  className="w-full py-1.5 bg-[#094d4e] text-white hover:bg-[#07393a] rounded-md text-[10px] font-bold transition-all shadow-xs"
                  id="ask-bahthos-from-search-btn"
                >
                  طرح هذا السؤال على مساعد بحث OS الذكي ↵
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredSources.map((src) => {
            const hasError = !!src.error;
            const isSelected = selectedSourceId === src.id;
            return (
              <div
                key={src.id}
                onClick={() => {
                  if (hasError) return;
                  onSelectSource(src.id);
                }}
                className={`group relative p-3 rounded-lg border transition-all duration-200 ${
                  hasError
                    ? "bg-red-50/30 border-red-200 cursor-not-allowed"
                    : isSelected
                    ? "bg-teal-100/30 border-[#094d4e] shadow-sm cursor-pointer font-semibold"
                    : "bg-white border-[#e2e2dd] hover:border-gray-300 cursor-pointer"
                }`}
                id={`source-card-${src.id}`}
              >
                {/* Checkbox and Title */}
                <div className="flex items-start gap-2.5">
                  {hasError ? (
                    <div className="mt-0.5 w-4.5 h-4.5 rounded flex items-center justify-center text-red-600 bg-red-50 border border-red-200">
                      <AlertCircle className="w-3 h-3" />
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Don't trigger card selection
                        onToggleSource(src.id);
                      }}
                      className={`mt-0.5 w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                        src.enabled
                          ? "bg-[#094d4e] border-[#094d4e] text-white shadow-xs"
                          : "border-[#e2e2dd] hover:border-gray-400 bg-white"
                      }`}
                      id={`source-checkbox-${src.id}`}
                    >
                      {src.enabled && <Check className="w-3 h-3 stroke-[3.5]" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-semibold leading-relaxed truncate ${
                      hasError ? "text-gray-500" : src.enabled ? "text-[#1f1f1f]" : "text-gray-400 line-through"
                    }`}>
                      {src.title}
                    </h3>

                    {hasError ? (
                      <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1 leading-snug">
                        <span>{src.error}</span>
                      </p>
                    ) : (
                      /* Metadata row */
                      <div className="flex items-center gap-3.5 mt-1.5 text-[10px] text-gray-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {src.language === "ar" ? "العربية" : src.language === "en" ? "الإنجليزية" : "الفرنسية"}
                        </span>
                        <span>{src.wordCount} كلمة</span>
                        <span>{src.dateAdded}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active control footer */}
                {!hasError ? (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSource(src.id);
                      }}
                      className={`text-[10px] px-2 py-1 rounded font-bold transition-all border ${
                        src.enabled
                          ? "bg-teal-50 text-[#094d4e] border-teal-100/80 hover:bg-teal-100/80"
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:text-gray-600"
                      }`}
                      title={src.enabled ? "Exclude this source from chat context" : "Include this source in chat context"}
                    >
                      {src.enabled ? "مفعّل للدردشة ✓" : "معطّل (تفعيل)"}
                    </button>

                    {onChatWithSingleSource && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChatWithSingleSource(src.id);
                        }}
                        className="text-[10px] px-2 py-1 bg-amber-600 text-white hover:bg-amber-700 rounded font-bold transition-all shadow-3xs"
                        title="Chat with this specific source only (disables other sources temporarily)"
                      >
                        دردشة منفردة (Solo)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-red-100">
                    <span className="text-[10px] text-red-500 font-bold bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                      فشل استخراج النص
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceToDeleteId(src.id);
                      }}
                      className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 rounded font-bold transition-all border border-gray-200"
                    >
                      إزالة المصدر
                    </button>
                  </div>
                )}

                {/* Delete button (only for added sources, or all with confirmation) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourceToDeleteId(src.id);
                  }}
                  className="absolute left-2 top-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all z-10"
                  title="حذف هذا المصدر"
                  id={`source-delete-btn-${src.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Add Source Section */}
      <div className="p-3 border-t border-[#e2e2dd] bg-[#f4f3ee]">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#094d4e] text-white text-xs rounded-lg hover:bg-[#07393a] transition-all font-extrabold shadow-sm"
            id="add-source-trigger-btn"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مصدر بحثي</span>
          </button>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-[#e2e2dd] space-y-3 shadow-md" id="auto-analyzer-upload-panel">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <span className="text-xs font-bold text-[#1f1f1f] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#094d4e]" />
                <span>تحليل ورفع ذكي وتلقائي</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setErrorMsg("");
                }}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg text-[10px] flex items-start gap-1.5 font-medium leading-relaxed animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isAnalyzing ? (
              /* Loading Analysis state */
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#094d4e] animate-spin" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#1f1f1f]">جاري معالجة مستندك البحثي...</p>
                  <p className="text-[10px] text-[#094d4e] font-medium animate-pulse">{analysisStep}</p>
                </div>
              </div>
            ) : (
              /* Upload / Paste interface */
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex bg-[#f4f3ee] p-0.5 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUploadTab("upload")}
                    className={`flex-1 py-1 rounded-md transition-all ${
                      uploadTab === "upload" 
                        ? "bg-white text-[#1f1f1f] shadow-xs" 
                        : "text-gray-500 hover:text-[#1f1f1f]"
                    }`}
                  >
                    رفع مستند (PDF/TXT/Word)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTab("paste")}
                    className={`flex-1 py-1 rounded-md transition-all ${
                      uploadTab === "paste" 
                        ? "bg-white text-[#1f1f1f] shadow-xs" 
                        : "text-gray-500 hover:text-[#1f1f1f]"
                    }`}
                  >
                    لصق نص مقتبس
                  </button>
                </div>

                {uploadTab === "upload" ? (
                  /* Drag and drop file uploader */
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center transition-all ${
                      dragActive 
                        ? "border-[#094d4e] bg-teal-100/30" 
                        : "border-[#e2e2dd] hover:border-gray-400 bg-[#fafaf8]"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".txt,.pdf,.docx,.doc,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-input-uploader"
                    />
                    <label htmlFor="file-input-uploader" className="cursor-pointer flex flex-col items-center space-y-2">
                      <UploadCloud className="w-8 h-8 text-[#094d4e] bg-teal-50 p-1.5 rounded-full border border-teal-100" />
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-gray-700">اسحب الملف هنا أو تصفح</p>
                        <p className="text-[9px] text-gray-400">يدعم مستندات PDF والملفات النصية (.txt) وملفات Word (.docx)</p>
                      </div>
                    </label>
                  </div>
                ) : (
                  /* Paste text area */
                  <div className="space-y-2">
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="ألصق محتوى الدراسة أو مقتطف منها هنا بالكامل..."
                      rows={5}
                      className="w-full text-xs p-2.5 border border-[#e2e2dd] rounded-lg bg-white text-[#1f1f1f] focus:outline-none focus:border-[#094d4e] resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => runAutomaticAnalysis(newContent)}
                      disabled={!newContent.trim()}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#094d4e] hover:bg-[#07393a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-lg transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>تحليل وإضافة المستند فوراً</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
        </>
      ) : (
        /* Glossary Tab View */
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5" id="glossary-list-container">
          {isSweeping && (
            <div className="bg-[#fcfbf7] border border-[#eae9e2] rounded-xl p-3 flex items-center gap-2.5 text-gray-700 text-[11px] font-medium animate-pulse" id="glossary-sweeping-banner" dir="rtl">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500 flex-shrink-0" />
              <span>جاري مراجعة وتدقيق المصطلحات عبر مصفوفة التحقق ثنائية الحقول للعمق الأكاديمي...</span>
            </div>
          )}
          {sweepCorrectionCount !== null && sweepCorrectionCount > 0 && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-emerald-850 text-[11px] font-medium" id="glossary-swept-banner" dir="rtl">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 animate-bounce" />
              <div className="text-right">
                <span className="font-bold text-emerald-900 block mb-0.5">مصفوفة التحقق ثنائية الحقول:</span>
                تم مراجعة كافة مصطلحات المعجم ({glossaryTerms.length} مصطلحاً)، واكتشاف وتصحيح <span className="font-bold text-emerald-950 underline">{sweepCorrectionCount}</span> تعريب لفظي واستبدالها بمصطلحات عربية فصحى رصينة.
              </div>
            </div>
          )}
          {glossaryTerms.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-8 px-4 text-gray-400 text-xs font-medium bg-white rounded-xl border border-[#e2e2dd]">
                لا توجد مصطلحات في المعجم حتى الآن.
                <p className="text-[10px] text-gray-400 mt-1">المصطلحات تظهر تلقائياً عند رفع المستندات أو تفعيل المصادر.</p>
              </div>
              
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-right font-medium text-[11px] text-amber-850 leading-relaxed" dir="rtl">
                <span className="font-bold text-amber-950 block mb-1">توضيح هام حول حصة الاستخدام (API Quotas):</span>
                إذا قمت برفع مستندات متعددة (مثل 5-6 مستندات في جلسة واحدة)، فقد يتم تجاوز الحد اليومي المسموح به مجاناً من طلبات الذكاء الاصطناعي (<span className="font-bold font-mono text-amber-950">20 طلباً/يومياً</span> لنموذج Gemini 3.5 Flash).
                عند حدوث ذلك، يتوقف خادم المعجم والتحليل تلقائياً لحين تجديد الحصة اليومية أو تهيئة مفتاح API مدفوع لتفادي التوقف الممتد.
              </div>
            </div>
          ) : (
            glossaryTerms.map((termItem, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#e2e2dd] hover:border-gray-300 transition-all p-3.5 rounded-xl text-right shadow-3xs hover:shadow-2xs"
                id={`glossary-item-${idx}`}
              >
                <div className="flex flex-wrap items-center gap-2 justify-between mb-2 pb-1.5 border-b border-gray-100/50">
                  <span className="text-xs font-bold text-gray-950 text-right">
                    {spellcheckAndRepairArabicAndEnglishText(termItem.transliteration || termItem.verified_term || termItem.draft_term || termItem.term)}
                  </span>
                  <span className="font-mono text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200" dir="ltr">
                    {termItem.term}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                  {spellcheckAndRepairArabicAndEnglishText(termItem.definition || "")}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {sourceToDeleteId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] transition-all"
          id="delete-source-modal-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setSourceToDeleteId(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#e2e2dd] shadow-lg space-y-4 text-right animate-in fade-in zoom-in-95 duration-150" 
            dir="rtl"
            id="delete-source-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-600 pb-1 border-b border-gray-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h4 className="text-sm font-bold text-gray-900">حذف المصدر البحثي</h4>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                هل أنت متأكد من حذف هذا المصدر؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              
              {(() => {
                const doc = sources.find((s) => s.id === sourceToDeleteId);
                return doc ? (
                  <div className="bg-gray-50/85 p-2.5 rounded-lg border border-gray-200 text-[11px] text-gray-600 font-bold truncate">
                    {doc.title}
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSourceToDeleteId(null)}
                className="px-3.5 py-1.5 bg-[#eae9e2] hover:bg-[#e2e2dd] text-gray-700 text-[11px] font-bold rounded-lg transition-all"
                id="btn-cancel-delete-source"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sourceToDeleteId) {
                    onDeleteSource(sourceToDeleteId);
                    setSourceToDeleteId(null);
                  }
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-xs"
                id="btn-confirm-delete-source"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] transition-all"
          id="delete-all-sources-modal-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteAllModal(false);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 border border-[#e2e2dd] shadow-lg space-y-4 text-right animate-in fade-in zoom-in-95 duration-150"
            dir="rtl"
            id="delete-all-sources-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-600 pb-1 border-b border-gray-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h4 className="text-sm font-bold text-gray-900">حذف وتفريغ جميع المصادر</h4>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                هل أنت متأكد من رغبتك في حذف جميع المصادر المرفوعة وتفريغ المستودع بالكامل؟ سيتم مسح كافة المصطلحات والتوليفات المرتبطة بهذه المصادر.
              </p>
              <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 text-[11px] text-red-700 font-bold">
                عدد المصادر التي سيتم حذفها: {sources.length} مصدر
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-3.5 py-1.5 bg-[#eae9e2] hover:bg-[#e2e2dd] text-gray-700 text-[11px] font-bold rounded-lg transition-all"
                id="btn-cancel-delete-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteAllSources) {
                    onDeleteAllSources();
                  } else {
                    sources.forEach((s) => onDeleteSource(s.id));
                  }
                  setShowDeleteAllModal(false);
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-xs"
                id="btn-confirm-delete-all"
              >
                حذف الكل وتفريغ المستودع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
