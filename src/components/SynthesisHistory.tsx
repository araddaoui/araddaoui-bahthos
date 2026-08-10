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
import { Synthesis, Source } from "../types";
import SynthesisReportView, { stripEvidenceTags } from "./SynthesisReportView";
import { copyReportToClipboard, exportToWordDocument } from "../utils/reportFormatter";

interface SynthesisHistoryProps {
  syntheses: Synthesis[];
  sources?: Source[];
  onDeleteSynthesis: (id: string) => void;
}

export default function SynthesisHistory({ syntheses, sources = [], onDeleteSynthesis }: SynthesisHistoryProps) {
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
          <p className="text-[10px] text-gray-500 mt-0.5">
            التقارير البحثية التي قمت بتوليدها وحفظها في جلسة العمل الحالية.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {syntheses.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-semibold">
              لا توجد توليفات محفوظة حتى الآن.
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
                  
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-400 font-medium">
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
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
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
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 max-w-sm mx-auto space-y-4">
            <History className="w-12 h-12 text-gray-300" />
            <div>
              <h3 className="text-xs font-bold text-gray-700">لم يتم اختيار أي تقرير</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                الرجاء اختيار أحد التقارير المحفوظة من القائمة الجانبية لقراءته أو نسخه.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
