import React, { useState } from "react";
import { Source } from "../types";
import { MessageSquare, Send, Sparkles, Loader2, HelpCircle, ShieldCheck, CornerDownLeft, AlertCircle } from "lucide-react";
import { generateReportFollowUpFallback } from "../utils/synthesisFallback";

interface ReportFollowUpProps {
  reportContext: string;
  reportTitle?: string;
  sources?: Source[];
  className?: string;
}

interface FollowUpThreadItem {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  isFallback?: boolean;
}

export default function ReportFollowUp({
  reportContext,
  reportTitle,
  sources = [],
  className = "",
}: ReportFollowUpProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<FollowUpThreadItem[]>([]);

  const activeSources = sources.filter((s) => s.enabled !== false);

  const suggestedPrompts = [
    {
      label: "استدامة البناء المعرفي",
      text: "كيف نحقق استدامة البناء المعرفي وسد الفجوات الميدانية المذكورة في التقرير؟",
    },
    {
      label: "الآليات التنفيذية",
      text: "توضيح الآليات التنفيذية والتطبيقية للتوصيات المذكورة في التقرير.",
    },
    {
      label: "الأدلة والشواهد",
      text: "ما هي الأدلة والشواهد المباشرة من المصادر التي تدعم هذه النتائج؟",
    },
    {
      label: "تقييم التغطية",
      text: "ما هي الأسئلة والنقاط التي لا تتوفر لها إجابة صريحة في المصادر الحالية؟",
    },
  ];

  const handleSendQuestion = async (textToSend?: string) => {
    const qText = (textToSend || question).trim();
    if (!qText || loading) return;

    setLoading(true);
    setError(null);

    const historyPayload = thread.map((t) => ({
      question: t.question,
      answer: t.answer,
    }));

    try {
      const response = await fetch("/api/report-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: qText,
          reportContext,
          reportTitle: reportTitle || "تقرير توليفي بحثي",
          sources: activeSources,
          history: historyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error("فشلت الاتصال بمركز معالجة الاستفسارات.");
      }

      const data = await response.json();
      const answerText = data.answer || generateReportFollowUpFallback(qText, reportContext, activeSources);

      const newItem: FollowUpThreadItem = {
        id: Date.now().toString(),
        question: qText,
        answer: answerText,
        timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
        isFallback: data.isFallback,
      };

      setThread((prev) => [...prev, newItem]);
      setQuestion("");
    } catch (err: any) {
      console.warn("Follow-up API call failed, falling back locally:", err);
      const fallbackAns = generateReportFollowUpFallback(qText, reportContext, activeSources);

      const newItem: FollowUpThreadItem = {
        id: Date.now().toString(),
        question: qText,
        answer: fallbackAns,
        timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
        isFallback: true,
      };

      setThread((prev) => [...prev, newItem]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`mt-6 border border-teal-200/80 bg-gradient-to-b from-teal-50/40 via-white to-white rounded-2xl p-4 sm:p-5 shadow-xs transition-all text-right ${className}`}
      dir="rtl"
      id="report-followup-container"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/80 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#094d4e] text-white flex items-center justify-center shadow-xs">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-[#111111] flex items-center gap-1.5">
              <span>استفسارات ومتابعة حول هذا التقرير</span>
              <Sparkles className="w-3.5 h-3.5 text-[#094d4e] animate-pulse" />
            </h3>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              اطرح أي سؤال حول التوصيات، الفجوات، أو النتائج للحصول على توضيح معزز بالأدلة المباشرة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200/60 rounded-full text-[10px] font-bold text-[#094d4e]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>مرتبط بالمعطيات والمصادر</span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="mb-4">
        <span className="text-[10px] font-bold text-gray-400 block mb-1.5">أسئلة متابعة مقترحة بناءً على التقرير:</span>
        <div className="flex flex-wrap gap-1.5">
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendQuestion(p.text)}
              disabled={loading}
              className="px-2.5 py-1.5 bg-white border border-teal-200/80 hover:border-[#094d4e] hover:bg-teal-50/60 text-[#094d4e] rounded-xl text-[11px] font-bold transition-all duration-150 flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              id={`followup-suggested-chip-${idx}`}
            >
              <HelpCircle className="w-3 h-3 text-[#094d4e] flex-shrink-0" />
              <span>{p.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Q&A Thread */}
      {thread.length > 0 && (
        <div className="space-y-4 mb-4 border-t border-b border-gray-100 py-4 max-h-[500px] overflow-y-auto" id="followup-thread-list">
          {thread.map((item) => (
            <div key={item.id} className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              {/* User Question */}
              <div className="flex items-start gap-2">
                <span className="bg-[#094d4e] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5">
                  سؤالك:
                </span>
                <p className="text-xs font-extrabold text-slate-800 leading-relaxed flex-1">
                  {item.question}
                </p>
                <span className="text-[9px] font-mono text-gray-400">{item.timestamp}</span>
              </div>

              {/* Assistant Answer */}
              <div className="bg-white p-3.5 rounded-xl border border-teal-100 shadow-2xs space-y-2 mt-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-[10px] font-extrabold text-[#094d4e] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>توضيح بحث OS المستند إلى المصادر</span>
                  </span>
                  {item.isFallback && (
                    <span className="text-[9px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                      تحليل احتياطي موثق
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendQuestion();
        }}
        className="flex items-center gap-2"
        id="report-followup-form"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="اسأل عن أي توصية، فجوة، أو جزئية في التقرير..."
            disabled={loading}
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-[#111111] placeholder-gray-400 focus:outline-none focus:border-[#094d4e] focus:ring-1 focus:ring-[#094d4e] font-medium shadow-2xs disabled:bg-gray-50"
            id="report-followup-input"
          />
          <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="px-4 py-2.5 bg-[#094d4e] hover:bg-[#07393a] text-white rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          id="report-followup-submit-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري التحليل...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 rotate-180" />
              <span>إرسال الاستفسار</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
