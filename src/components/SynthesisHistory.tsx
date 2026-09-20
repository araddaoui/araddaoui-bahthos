import React, { useState } from "react";
import { 
  History, 
  BookOpen, 
  Copy, 
  Trash2, 
  Check, 
  FileText,
  Calendar,
  Sparkles,
  Download
} from "lucide-react";
import { Synthesis, Source } from "../types.js";
import SynthesisReportView, { stripEvidenceTags } from "./SynthesisReportView.js";
import { copyReportToClipboard, exportToWordDocument } from "../utils/reportFormatter.js";

interface SynthesisHistoryProps {
  syntheses: Synthesis[];
  sources?: Source[];
  onDeleteSynthesis: (id: string) => void;
  onOpenSynthesisEditor?: () => void;
}

export default function SynthesisHistory({ syntheses, sources = [], onDeleteSynthesis, onOpenSynthesisEditor }: SynthesisHistoryProps) {
  const [selectedSynId, setSelectedSynId] = useState<string | null>(
    syntheses.length > 0 ? syntheses[0].id : null
  );
  const [isCopied, setIsCopied] = useState(false);

  const activeSyn = syntheses.find((s) => s.id === selectedSynId);

  const handleCopy = async (text: string) => {
    await copyReportToClipboard(activeSyn?.title || "تقرير بحثي", text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportWord = () => {
    if (!activeSyn) return;
    exportToWordDocument(activeSyn.title || "تقرير بحثي", activeSyn.text);
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[#fafaf8]" id="synthesis-history-view">
      {/* List column (right side in RTL) */}
      <div className="w-full md:w-80 border-l border-[#e2e2dd] flex flex-col h-full bg-[#fafaf8]">
        <div className="p-4 border-b border-[#e2e2dd] bg-white">
          <h2 className="text-sm font-bold text-[#1f1f1f] flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-[#0d6264]" />
            <span>سجل التقارير والتوليفات</span>
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">
            التقارير البحثية التي قمت بتوليدها وحفظها في جلسة العمل الحالية.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {syntheses.length === 0 ? (
            <div className="bg-slate-50 border border-emerald-100/60 p-4 rounded-xl text-center space-y-1.5" id="history-empty-notice">
              <p className="text-xs font-bold text-slate-700">لا توجد توليفات محفوظة حتى الآن</p>
              <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                عند توليد تقرير من محرّر التوليف، سيُحفظ هنا تلقائياً ليُقرأ ويُنسخ أو يُصدَّر لاحقاً.
              </p>
            </div>
          ) : (
            syntheses.map((syn) => {
              const isSelected = selectedSynId === syn.id;
              return (
                <div
                  key={syn.id}
                  onClick={() => setSelectedSynId(syn.id)}
                  className={`p-3 rounded-lg border text-right cursor-pointer relative group transition-all ${
                    isSelected
                      ? "bg-[#f4f3ee] border-[#0d6264] shadow-xs"
                      : "bg-white border-[#e2e2dd] hover:border-gray-300"
                  }`}
                  id={`history-item-${syn.id}`}
                >
                  <h3 className="text-xs font-bold text-[#1f1f1f] leading-relaxed truncate max-w-[85%]">
                    {syn.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-700 font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>{syn.dateCreated}</span>
                    <span>•</span>
                    <span>شمل {syn.sourceIds.length} مصادر</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSynthesis(syn.id);
                      if (selectedSynId === syn.id) {
                        setSelectedSynId(syntheses.find((s) => s.id !== syn.id)?.id || null);
                      }
                    }}
                    className="absolute left-2.5 top-2.5 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all z-10"
                    title="حذف هذا التقرير"
                    id={`delete-history-${syn.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Content workspace column (left side in RTL) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white flex flex-col h-full">
        {activeSyn ? (
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col" id="active-synthesis-history-details">
            {/* Header / Info bar */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <span className="text-[10px] bg-teal-50 text-[#0d6264] px-2 py-0.5 rounded font-bold border border-teal-100">
                  تقرير توليف محفوظ
                </span>
                <h1 className="text-base font-bold text-[#1f1f1f] mt-1">
                  {activeSyn.title}
                </h1>
                <p className="text-[10px] text-slate-700 mt-0.5 font-medium">
                  تم التوليد في {activeSyn.dateCreated} بمقارنة {activeSyn.sourceIds.length} مصادر بحثية
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded-lg border border-blue-200 transition-all"
                  title="تصدير التقرير وتحميله كملف MS Word"
                  id="history-export-word-btn"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>تصدير لـ MS Word</span>
                </button>

                <button
                  onClick={() => handleCopy(activeSyn.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4f3ee] hover:bg-[#eae9e2] text-gray-700 text-xs font-semibold rounded-lg border border-[#e2e2dd] transition-all"
                  id="history-copy-btn"
                  title="نسخ بتنسيق غني مهيأ لـ Word"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">تم النسخ لـ Word!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ لـ Word</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 bg-[#fafaf8] p-6 rounded-2xl border border-[#e2e2dd] overflow-y-auto">
              <SynthesisReportView text={activeSyn.text} reportTitle={activeSyn.title} sources={sources} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex items-center justify-center" id="synthesis-history-empty-hero">
            <div className="w-full max-w-lg mx-auto bg-white border border-emerald-200/50 rounded-2xl shadow-sm p-7 md:p-9 text-center space-y-5">
              {/* Mint badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>التقارير التوليفية</span>
              </span>

              {/* Illustrated report preview skeleton */}
              <div className="bg-[#ecfdf5] border border-emerald-200/50 rounded-xl p-5 text-right space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-900 rounded-lg flex items-center justify-center text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 w-32 bg-emerald-200/80 rounded-full animate-pulse" />
                      <div className="h-1.5 w-20 bg-emerald-200/60 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-emerald-900 text-white rounded-full text-[9px] font-bold">
                    خارطة أدلة
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-emerald-200/50 rounded-full animate-pulse" style={{ animationDelay: "80ms" }} />
                  <div className="h-2 w-5/6 bg-emerald-200/50 rounded-full animate-pulse" style={{ animationDelay: "160ms" }} />
                  <div className="h-2 w-2/3 bg-emerald-200/50 rounded-full animate-pulse" style={{ animationDelay: "240ms" }} />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-white border border-emerald-200/70 rounded-md text-[9px] font-bold text-emerald-900">
                    توثيق مباشر
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-emerald-200/70 rounded-md text-[9px] font-bold text-emerald-900">
                    مقارنة مصادر
                  </span>
                </div>
              </div>

              {/* Heading + copy */}
              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-slate-900">سجل التوليفات والتقارير فارغ حالياً</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  ابدأ توليفة بحثية جديدة من محرّر التوليف: يسحب النظام أدلة وثائقك، ويقارن بينها، ثم يكتب تقريراً موثقاً يُحفظ هنا تلقائياً.
                </p>
              </div>

              {/* Primary CTA */}
              <button
                onClick={() => onOpenSynthesisEditor?.()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                id="history-empty-open-editor-btn"
              >
                <Sparkles className="w-4 h-4" />
                <span>ابدأ توليفة بحثية جديدة</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
