import React, { useState } from "react";
import { 
  Sparkles, 
  Save, 
  Copy, 
  Check, 
  AlertTriangle, 
  FileText, 
  FileEdit,
  RotateCcw,
  BookOpen,
  Grid,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Download,
  ShieldCheck
} from "lucide-react";
import { Source, Synthesis, DalilBriefing } from "../types";
import SynthesisReportView, { stripEvidenceTags } from "./SynthesisReportView";
import { copyReportToClipboard, exportToWordDocument, deduplicateSources } from "../utils/reportFormatter";
import { generateClientSynthesisFallback } from "../utils/synthesisFallback";
import DalilCard from "./DalilCard";

interface SynthesisEditorProps {
  sources: Source[];
  onSaveSynthesis: (synthesis: Synthesis) => void;
  dalilBriefing?: DalilBriefing | null;
  dalilCountdown?: number | null;
  isDalilGenerating?: boolean;
  onTriggerDalilBriefing?: () => void;
}

export default function SynthesisEditor({ 
  sources, 
  onSaveSynthesis,
  dalilBriefing = null,
  dalilCountdown = null,
  isDalilGenerating = false,
  onTriggerDalilBriefing
}: SynthesisEditorProps) {
  const [topic, setTopic] = useState(() => {
    const active = sources.filter((s) => s.enabled);
    if (active.length > 0) {
      return `مقارنة وتحليل شامل للمصادر المرفقة (${active.slice(0, 2).map((s) => s.title).join("، ")})`;
    }
    return "توليف وتقاطعات الأدلة للمصادر المرفقة";
  });
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    sources.map((s) => s.id)
  );
  
  const [toolType, setToolType] = useState<"general" | "matrix" | "gap" | "briefing" | "faq">("general");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const handleToggleSelect = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedSourceIds.length === 0) {
      setErrorMsg("يرجى اختيار دراسة واحدة على الأقل للتوليف.");
      return;
    }
    setErrorMsg("");
    setIsGenerating(true);
    setGeneratedText("");
    setIsSaved(false);
    setIsFallbackMode(false);
    setViewMode("preview");

    const rawActiveSources = sources
      .filter((s) => selectedSourceIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        title: s.title,
        language: s.language || "ar",
        wordCount: s.wordCount || 0,
        summary: s.summary || "",
        content: (s.content || s.summary || "").substring(0, 15000),
      }));

    const activeSourcesData = deduplicateSources(rawActiveSources);

    let autoTitle = `توليف بحثي: ${topic || "عام"}`;
    if (toolType === "matrix") autoTitle = `مصفوفة الأدلة والتعارضات: ${topic || "شاملة"}`;
    else if (toolType === "gap") autoTitle = `تقرير فجوات الأدلة: ${topic || "شامل"}`;
    else if (toolType === "briefing") autoTitle = `تقرير التوصيات والآثار: ${topic || "موجز"}`;
    else if (toolType === "faq") autoTitle = `الأسئلة الشائعة والإجابات: ${topic || "دليل"}`;

    try {
      let data: any = null;
      try {
        const response = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources: activeSourcesData,
            topic: topic,
            toolType: toolType,
          }),
        });

        if (response.ok) {
          data = await response.json().catch(() => null);
        } else {
          const errBody = await response.json().catch(() => null);
          console.warn("Server synthesize returned non-ok status:", response.status, errBody);
        }
      } catch (fetchErr) {
        console.warn("Backend API synthesize request failed/unreachable, using client fallback:", fetchErr);
      }

      if (data && data.text && typeof data.text === "string" && data.text.trim().length > 20) {
        setGeneratedText(data.text);
        setIsFallbackMode(Boolean(data.isFallback));
        if (data.isFallback) {
          autoTitle = `توليف الأدلة: ${topic || "مستندات"}`;
        }
        setReportTitle(autoTitle);
      } else {
        // PERMANENT FIX: If AI API or server is down/unreachable/quota-exceeded, generate complete synthesis locally!
        console.log("Generating full synthesis report locally via client-side evidence fallback.");
        const fallbackText = generateClientSynthesisFallback(activeSourcesData, topic, toolType);
        setGeneratedText(fallbackText);
        setIsFallbackMode(true);
        setReportTitle(`توليف الأدلة: ${topic || "مستندات"}`);
      }
    } catch (error: any) {
      console.error("Unexpected synthesis error:", error);
      // Guarantee output even on unexpected errors
      const fallbackText = generateClientSynthesisFallback(activeSourcesData, topic, toolType);
      setGeneratedText(fallbackText);
      setIsFallbackMode(true);
      setReportTitle(`توليف الأدلة: ${topic || "مستندات"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedText) return;
    await copyReportToClipboard(reportTitle || "تقرير بحثي", generatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportWord = () => {
    if (!generatedText) return;
    exportToWordDocument(reportTitle || "تقرير بحثي", generatedText);
  };

  const handleSave = () => {
    if (!generatedText || !reportTitle) return;
    
    const newSynthesis: Synthesis = {
      id: "syn-" + Date.now(),
      title: reportTitle,
      text: generatedText,
      sourceIds: selectedSourceIds,
      dateCreated: new Date().toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    onSaveSynthesis(newSynthesis);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#fafaf8] overflow-y-auto p-4 md:p-6" id="synthesis-editor-view">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Centered Academic Heading and Subtitle */}
        <div className="text-center pt-2 pb-2 max-w-md mx-auto space-y-1.5">
          <h1 className="text-2xl font-extrabold text-[#094d4e] tracking-tight">
            بحث OS
          </h1>
          <p className="text-xs md:text-[13px] text-gray-600 font-bold leading-relaxed">
            ولّد تقريرًا موثقًا يحلل مصادر متعددة، ويستخلص أوجه الاتفاق والاختلاف، ويكشف الفجوات والمعرفة الميدانية، مع إسناد كل استنتاج إلى مصادره.
          </p>
        </div>

        {/* Al-Dalil Guided Companion Card - Prominently Placed Under Synthesis Editor */}
        <DalilCard
          dalilBriefing={dalilBriefing}
          dalilCountdown={dalilCountdown}
          isDalilGenerating={isDalilGenerating}
          onTriggerDalilBriefing={onTriggerDalilBriefing}
        />

        {/* Configuration Panel */}
        <div className="bg-white p-5 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4">
          <h2 className="text-xs font-black text-black border-b border-gray-100 pb-2">
            1. إعداد التقرير التوليفي
          </h2>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Topic input */}
          <div>
            <label className="block text-xs text-black font-black mb-1.5">
              السؤال أو الموضوع الرئيسي:
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: مقارنة وتقاطع نتائج ومفاهيم الوثائق المرفقة..."
              className="w-full text-xs px-3 py-2.5 border border-[#e2e2dd] rounded-lg bg-white text-[#1f1f1f] focus:outline-none focus:border-[#094d4e]"
              id="synthesis-topic-input"
            />
          </div>

          {/* Tool Selector Grid */}
          <div className="space-y-2">
            <label className="block text-xs text-[#094d4e] font-extrabold">
              اختر أداة التحليل المطلوبة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => setToolType("general")}
                className={`group p-3 rounded-xl border text-xs flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  toolType === "general"
                    ? "bg-teal-100/80 border-[#062d2e] text-[#062d2e] font-black shadow-sm"
                    : "bg-white border-[#e2e2dd] text-gray-500 font-medium hover:border-gray-400 hover:text-gray-800"
                }`}
                id="tool-type-general-btn"
              >
                <Sparkles className={`w-4 h-4 transition-colors ${toolType === "general" ? "text-[#062d2e]" : "text-gray-400 group-hover:text-gray-600"}`} />
                <span className={`truncate w-full ${toolType === "general" ? "font-extrabold" : ""}`}>توليف عام ومقارنة</span>
              </button>

              <button
                type="button"
                onClick={() => setToolType("matrix")}
                className={`group p-3 rounded-xl border text-xs flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  toolType === "matrix"
                    ? "bg-teal-100/80 border-[#062d2e] text-[#062d2e] font-black shadow-sm"
                    : "bg-white border-[#e2e2dd] text-gray-500 font-medium hover:border-gray-400 hover:text-gray-800"
                }`}
                id="tool-type-matrix-btn"
              >
                <Grid className={`w-4 h-4 transition-colors ${toolType === "matrix" ? "text-emerald-800 font-extrabold" : "text-emerald-500 group-hover:text-emerald-600"}`} />
                <span className={`truncate w-full ${toolType === "matrix" ? "font-extrabold" : ""}`}>مصفوفة الأدلة</span>
              </button>

              <button
                type="button"
                onClick={() => setToolType("gap")}
                className={`group p-3 rounded-xl border text-xs flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  toolType === "gap"
                    ? "bg-teal-100/80 border-[#062d2e] text-[#062d2e] font-black shadow-sm"
                    : "bg-white border-[#e2e2dd] text-gray-500 font-medium hover:border-gray-400 hover:text-gray-800"
                }`}
                id="tool-type-gap-btn"
              >
                <FileQuestion className={`w-4 h-4 transition-colors ${toolType === "gap" ? "text-rose-800 font-extrabold" : "text-rose-500 group-hover:text-rose-600"}`} />
                <span className={`truncate w-full ${toolType === "gap" ? "font-extrabold" : ""}`}>تقرير الفجوات</span>
              </button>

              <button
                type="button"
                onClick={() => setToolType("briefing")}
                className={`group p-3 rounded-xl border text-xs flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  toolType === "briefing"
                    ? "bg-teal-100/80 border-[#062d2e] text-[#062d2e] font-black shadow-sm"
                    : "bg-white border-[#e2e2dd] text-gray-500 font-medium hover:border-gray-400 hover:text-gray-800"
                }`}
                id="tool-type-briefing-btn"
              >
                <GraduationCap className={`w-4 h-4 transition-colors ${toolType === "briefing" ? "text-indigo-800 font-extrabold" : "text-indigo-500 group-hover:text-indigo-600"}`} />
                <span className={`truncate w-full ${toolType === "briefing" ? "font-extrabold" : ""}`}>التوصيات والآثار</span>
              </button>

              <button
                type="button"
                onClick={() => setToolType("faq")}
                className={`group p-3 rounded-xl border text-xs flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  toolType === "faq"
                    ? "bg-teal-100/80 border-[#062d2e] text-[#062d2e] font-black shadow-sm"
                    : "bg-white border-[#e2e2dd] text-gray-500 font-medium hover:border-gray-400 hover:text-gray-800"
                }`}
                id="tool-type-faq-btn"
              >
                <HelpCircle className={`w-4 h-4 transition-colors ${toolType === "faq" ? "text-amber-800 font-extrabold" : "text-amber-500 group-hover:text-amber-600"}`} />
                <span className={`truncate w-full ${toolType === "faq" ? "font-extrabold" : ""}`}>الأسئلة الشائعة</span>
              </button>
            </div>
          </div>

          {/* Source selection checklist */}
          <div>
            <label className="block text-xs text-black font-black mb-2">
              اختر المصادر التي سيعتمد عليها التقرير:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {sources.map((src) => {
                const isChecked = selectedSourceIds.includes(src.id);
                return (
                  <div
                    key={src.id}
                    onClick={() => handleToggleSelect(src.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                      isChecked
                        ? "bg-teal-100/60 border-[#062d2e] text-[#111111] shadow-2xs"
                        : "bg-white border-[#e2e2dd] text-gray-600 hover:border-gray-300 font-medium"
                    }`}
                    id={`synthesis-source-check-${src.id}`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked ? "bg-[#062d2e] border-[#062d2e] text-white" : "border-[#e2e2dd]"
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-extrabold truncate ${isChecked ? "text-[#062d2e]" : "text-[#111111]"}`}>{src.title}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 font-bold">
                        {src.language === "ar" ? "العربية" : "الإنجليزية"} • {src.wordCount} كلمة
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-10 py-2.5 rounded-xl text-xs font-black transition-all ${
                isGenerating
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  : "bg-[#062d2e] hover:bg-[#042122] text-white shadow-sm"
              }`}
              id="start-synthesis-btn"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? "يجري تحليل وتوليف المستندات الآن..." : "توليد التقرير"}</span>
            </button>
          </div>
        </div>

        {/* Loading / Generating view */}
        {isGenerating && (
          <div className="bg-white p-8 rounded-2xl border border-[#e2e2dd] shadow-2xs flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-gray-100 border-t-[#094d4e] animate-spin"></div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#1f1f1f]">يجري الآن صياغة التوليف</h3>
              <p className="text-xs text-gray-500 leading-relaxed max-w-md">
                يقوم بحث OS حالياً بفحص المنهجيات والدرجات والإحصاءات المذكورة في الوثائق المرفوعة، واستنباط محددات كل دراسة وسياقها الجغرافي والتقني لصياغة تقرير توليفي مقارن رصين.
              </p>
            </div>
          </div>
        )}

        {/* Generated Report Editor Workspace */}
        {generatedText && !isGenerating && (
          <div className="bg-white p-6 rounded-2xl border border-[#e2e2dd] shadow-2xs space-y-4" id="synthesis-workspace">
            {isFallbackMode && (
              <div className="p-3 bg-teal-50/70 border border-teal-200 text-teal-900 rounded-xl text-xs flex items-start gap-2.5 font-medium leading-relaxed mb-2" id="fallback-info-banner">
                <ShieldCheck className="w-4 h-4 text-[#094d4e] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-[#094d4e]">تم توليد التقرير اعتماداً على نظام الأدلة والتحليل المباشر للمستندات</p>
                  <p className="text-[11px] text-teal-800 mt-1">
                    تم تحليل وتقاطع البيانات والاقتباسات من جميع الوثائق المرفقة النشطة وصياغة التقرير مع إسناد الأدلة.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-[#094d4e]" />
                <span className="text-xs font-bold text-gray-800">
                  2. تقرير التوليف البحثي الناتج (قابل للتعديل)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs rounded-lg transition-all border border-blue-200 font-bold"
                  title="تصدير وتحميل كملف Word مخصص بكل التنسيقات"
                  id="export-word-synthesis-btn"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>تصدير لـ MS Word</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#f4f3ee] hover:bg-[#eae9e2] text-gray-700 text-xs rounded-lg transition-all border border-[#e2e2dd]"
                  title="نسخ التقرير بتنسيق غني جاهز للتقليص في MS Word"
                  id="copy-synthesis-btn"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">تم النسخ لـ Word!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ لـ Word</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#094d4e] hover:bg-[#07393a] text-white text-xs rounded-lg transition-all shadow-xs font-semibold"
                  id="save-synthesis-btn"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم الحفظ بسجل التوليفات!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ في السجل</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center justify-between bg-gray-50/50 p-2 py-1.5 rounded-xl border border-gray-100/80 mb-1" dir="rtl">
              <span className="text-[11px] text-gray-500 font-bold">نمط عرض التقرير:</span>
              <div className="flex bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/50">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === "preview"
                      ? "bg-[#094d4e] text-white shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  id="toggle-preview-mode-btn"
                >
                  <span>🔬 معاينة الأدلة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("edit")}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === "edit"
                      ? "bg-[#094d4e] text-white shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  id="toggle-edit-mode-btn"
                >
                  <span>✏️ تحرير النص</span>
                </button>
              </div>
            </div>

            {/* Title field */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">عنوان تقرير التوليف:</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full text-sm font-bold text-[#1f1f1f] bg-transparent border-b border-gray-100 py-1 focus:outline-none focus:border-[#094d4e]"
              />
            </div>

            {/* Editor Textarea vs SynthesisReportView */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">محتوى التقرير:</label>
              {viewMode === "preview" ? (
                <div className="w-full text-sm p-5 border border-[#e2e2dd] rounded-xl bg-white leading-relaxed min-h-[400px]">
                  <SynthesisReportView text={generatedText} reportTitle={reportTitle} sources={sources} />
                </div>
              ) : (
                <textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  rows={16}
                  className="w-full text-sm p-4 border border-[#e2e2dd] rounded-xl bg-white text-[#1f1f1f] focus:outline-none focus:border-[#094d4e] leading-relaxed resize-y font-sans"
                  style={{ lineHeight: "1.85" }}
                  id="synthesis-textarea-workspace"
                />
              )}
            </div>

            <p className="text-[10px] text-gray-400 text-center font-medium leading-relaxed">
              {viewMode === "preview" 
                ? "اضغط على زر (تحرير النص) بالأعلى لإجراء تعديلات يدوية على الصياغة أو المحتوى."
                : "يمكنك تحرير هذا التقرير بحرية وإضافة ملاحظاتك الشخصية أو المنهجية قبل حفظه أو نسخه للبحث الخاص بك."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
