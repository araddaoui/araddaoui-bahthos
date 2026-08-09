import React from "react";
import { 
  ArrowRight, 
  Globe, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  CheckSquare, 
  Square,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { Source, GlossaryTerm } from "../types";
import { BookOpen } from "lucide-react";
import { spellcheckAndRepairArabicAndEnglishText } from "../utils/termExtractor";

interface SourceViewerProps {
  source: Source;
  glossaryTerms?: GlossaryTerm[];
  onToggleSource: (id: string) => void;
  onClose: () => void;
  onBackToChat: () => void;
  onChatWithSingleSource?: (id: string) => void;
}

export default function SourceViewer({
  source,
  glossaryTerms = [],
  onToggleSource,
  onClose,
  onBackToChat,
  onChatWithSingleSource,
}: SourceViewerProps) {
  const sourceTerms = glossaryTerms.filter((gt) => 
    gt.sourceId === source.id || 
    (gt.term && source.content.toLowerCase().includes(gt.term.toLowerCase())) ||
    (gt.transliteration && source.content.includes(gt.transliteration))
  );
  return (
    <div className="w-full h-full flex flex-col bg-[#fafaf8]" id="source-viewer-container">
      {/* Header Controls */}
      <div className="p-4 bg-white border-b border-[#e2e2dd] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
            title="إغلاق المعاينة"
            id="close-source-viewer-btn"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <div>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">
              معاينة مستند بحثي
            </span>
            <h1 className="text-xs font-bold text-[#1f1f1f] mt-0.5 truncate max-w-md md:max-w-xl">
              {source.title}
            </h1>
          </div>
        </div>

        {/* Quick actions inside reader */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleSource(source.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              source.enabled
                ? "bg-teal-50 text-[#094d4e] border-teal-200"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
            id="toggle-source-inside-viewer"
          >
            {source.enabled ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#094d4e]" />
                <span>مشمول في التحليل</span>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded border border-gray-300"></div>
                <span>غير مشمول بالتحليل</span>
              </>
            )}
          </button>

          {onChatWithSingleSource && (
            <button
              onClick={() => onChatWithSingleSource(source.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs"
              id="source-viewer-chat-solo-btn"
              title="الدردشة مع هذه الوثيقة فقط (تعطيل باقي المصادر مؤقتاً)"
            >
              <MessageSquare className="w-4 h-4" />
              <span>الدردشة مع هذا الملف فقط</span>
            </button>
          )}

          <button
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#094d4e] hover:bg-[#07393a] text-white text-xs font-bold rounded-lg transition-all shadow-xs"
            id="source-viewer-back-to-chat-btn"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">الدردشة والتحليل (الكل)</span>
          </button>
        </div>
      </div>

      {/* Main Document Content area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-2xl mx-auto bg-white p-8 md:p-10 rounded-2xl shadow-xs border border-[#e2e2dd]">
          {/* Metadata banner */}
          <div className="grid grid-cols-3 gap-4 pb-6 mb-6 border-b border-gray-100 text-xs text-gray-500 font-semibold">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#094d4e]" />
              <div>
                <p className="text-[10px] text-gray-400">لغة الوثيقة</p>
                <p className="text-[#1f1f1f] mt-0.5">
                  {source.language === "ar" ? "العربية الفصحى" : source.language === "en" ? "الإنجليزية (English)" : "الفرنسية (Français)"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#094d4e]" />
              <div>
                <p className="text-[10px] text-gray-400">تاريخ الإضافة</p>
                <p className="text-[#1f1f1f] mt-0.5">{source.dateAdded}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#094d4e]" />
              <div>
                <p className="text-[10px] text-gray-400">حجم المستند</p>
                <p className="text-[#1f1f1f] mt-0.5">{source.wordCount} كلمة</p>
              </div>
            </div>
          </div>

          {/* Automatic Summary Section if available */}
          {source.summary && (
            <div className="mb-6 p-5 bg-[#fcfbfa] border-r-4 border-[#094d4e] rounded-l-xl border-y border-l border-[#e2e2dd] space-y-2" id="source-auto-summary">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#094d4e]">
                <Sparkles className="w-4 h-4" />
                <span>ملخص ذكي (توليد تلقائي)</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                {source.summary}
              </p>
            </div>
          )}

          {/* Extracted Concepts and Terms Section */}
          {sourceTerms.length > 0 && (
            <div className="mb-8 p-5 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3" id="source-extracted-terms">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#094d4e]">
                  <BookOpen className="w-4 h-4 text-[#094d4e]" />
                  <span>المفاهيم والمصطلحات المستخرجة من الوثيقة ({sourceTerms.length})</span>
                </div>
                <span className="text-[10px] bg-teal-100 text-[#094d4e] px-2 py-0.5 rounded font-bold">
                  مستخرجة ومدققة تلقائياً
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {sourceTerms.map((t, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1f1f1f]">
                        {spellcheckAndRepairArabicAndEnglishText(t.transliteration || t.verified_term || t.draft_term || t.term)}
                      </span>
                      {t.term && t.term !== t.transliteration && (
                        <span className="text-[10px] text-teal-700 font-sans font-semibold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                          {t.term}
                        </span>
                      )}
                    </div>
                    {t.definition && (
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {spellcheckAndRepairArabicAndEnglishText(t.definition)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document text body */}
          <article className="prose max-w-none">
            <h2 className="text-lg font-bold text-[#1f1f1f] mb-4 leading-relaxed">
              {source.title}
            </h2>

            {/* Content text */}
            <div 
              className={`leading-loose text-[14.5px] text-gray-800 tracking-wide font-normal whitespace-pre-wrap ${
                source.language === "ar" ? "text-right" : "text-left ltr font-sans"
              }`}
              style={{ lineHeight: "1.9" }}
              id="source-viewer-text"
            >
              {source.content}
            </div>
          </article>
        </div>
        
        {/* Helper footer */}
        <div className="max-w-2xl mx-auto mt-6 text-center text-xs text-gray-400 leading-relaxed font-medium">
          تم تحميل هذا المستند كجزء من البيئة المرجعية للتحليل والمقارنة للدليل.
        </div>
      </div>
    </div>
  );
}
