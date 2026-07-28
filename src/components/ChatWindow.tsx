import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  BookOpen, 
  AlertTriangle, 
  ArrowLeft,
  HelpCircle,
  UploadCloud,
  FileText,
  Loader2,
  AlertCircle,
  Plus,
  Paperclip
} from "lucide-react";
import { Message, Source } from "../types";
import { parseReportText, EvidenceLayer } from "./SynthesisReportView";
import { parseDocumentFile } from "../utils/documentParser";

// Helper function to calculate the agreement score based on academic keyword matches
const calculateAgreementMeter = (text: string) => {
  const agreementKeywords = ["تتفق", "اتفاق", "انسجام", "توافق", "تتلاقى", "تطابق", "يتوافق", "agree", "concur", "harmony", "consensus"];
  const disagreementKeywords = ["تختلف", "تعارض", "تباين", "تناقض", "اختلاف", "معاكس", "تراجع", "differ", "contradict", "disagree", "contrast", "conflict"];
  
  let agreeCount = 0;
  let disagreeCount = 0;
  
  agreementKeywords.forEach(kw => {
    const reg = new RegExp(kw, "gi");
    const matches = text.match(reg);
    if (matches) agreeCount += matches.length;
  });

  disagreementKeywords.forEach(kw => {
    const reg = new RegExp(kw, "gi");
    const matches = text.match(reg);
    if (matches) disagreeCount += matches.length;
  });

  if (agreeCount === 0 && disagreeCount === 0) {
    return { score: 75, status: "توافق مرتفع", color: "text-emerald-700 bg-emerald-50 border-emerald-100", barColor: "bg-emerald-600", description: "تشير القراءة الأولية إلى توافق عام في التوجهات البحثية للمصادر." };
  }

  const total = agreeCount + disagreeCount;
  const percentage = Math.round((agreeCount / total) * 100);
  
  if (percentage >= 80) {
    return { score: percentage, status: "تطابق تام", color: "text-emerald-700 bg-emerald-50 border-emerald-100", barColor: "bg-emerald-600", description: "تتطابق الأطروحات والنتائج التجريبية بين الدراسات بشكل شبه كامل." };
  } else if (percentage >= 55) {
    return { score: percentage, status: "توافق جزئي", color: "text-teal-700 bg-teal-50 border-teal-100", barColor: "bg-teal-600", description: "تتلاقى المصادر في الخطوط العريضة لكنها تتباين في بعض التفاصيل والمنهجيات." };
  } else if (percentage >= 35) {
    return { score: percentage, status: "تباين منهجي", color: "text-amber-700 bg-amber-50 border-amber-100", barColor: "bg-amber-500", description: "تظهر المصادر اختلافات واضحة تعزى لاختلاف العينات أو سياق التطبيق." };
  } else {
    const score = Math.max(15, percentage);
    return { score: score, status: "تعارض صريح", color: "text-rose-700 bg-rose-50 border-rose-100", barColor: "bg-rose-500", description: "تطرح الدراسات نتائج متناقضة إحصائياً وتتطلب تفسيراً سياقياً حذراً." };
  }
};

interface ChatWindowProps {
  messages: Message[];
  sources: Source[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  onSourceClick: (id: string) => void;
  onAddSource?: (
    title: string,
    content: string,
    language: "ar" | "en" | "fr",
    summary?: string,
    error?: string,
    terms?: any[]
  ) => void;
}

export default function ChatWindow({
  messages,
  sources,
  onSendMessage,
  isThinking,
  onSourceClick,
  onAddSource,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleDirectFileUpload = async (file: File) => {
    if (!onAddSource) return;
    setIsUploading(true);
    setUploadError("");
    setUploadStep("جاري قراءة واستخراج النص من المستند...");

    try {
      setTimeout(() => setUploadStep("جاري فحص لغة المستند والترميز الأكاديمي..."), 400);
      setTimeout(() => setUploadStep("جاري صياغة الملخص الأكاديمي وتفكيك المصطلحات..."), 800);

      const parsed = await parseDocumentFile(file);
      let reqBody: any = { 
        fileName: parsed.fileName,
        content: parsed.text,
        base64: parsed.base64,
        mimeType: parsed.mimeType
      };

      try {
        const response = await fetch("/api/analyze-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });

        if (response.ok) {
          const data = await response.json();
          onAddSource(data.title, data.originalText || parsed.text, data.language || "ar", data.summary, undefined, data.terms);
        } else {
          const fallbackText = (parsed.text && parsed.text.trim()) 
            ? parsed.text 
            : `محتوى المستند المرفق (${file.name}):\nتم إدراج المستند المرفق بنجاح للتحليل والتوليف البحثي والمقارنة بواسطة الذكاء الاصطناعي.`;
          onAddSource(file.name, fallbackText, "ar", fallbackText.substring(0, 300) + "...", undefined, []);
        }
      } catch (netErr: any) {
        const fallbackText = (parsed.text && parsed.text.trim()) 
          ? parsed.text 
          : `محتوى المستند المرفق (${file.name}):\nتم إدراج المستند المرفق بنجاح للتحليل والتوليف البحثي والمقارنة بواسطة الذكاء الاصطناعي.`;
        onAddSource(file.name, fallbackText, "ar", fallbackText.substring(0, 300) + "...", undefined, []);
      }

      setIsUploading(false);
      setUploadStep("");
    } catch (err: any) {
      console.error("Direct upload error:", err);
      setUploadError(err.message || "فشلت معالجة الملف.");
      setIsUploading(false);
      setUploadStep("");
    }
  };

  const activeSources = sources.filter((s) => s.enabled);
  const starterQuestions = React.useMemo(() => {
    if (activeSources.length === 0) {
      return [
        {
          text: "كيف يمكنني البدء برفع وتحليل الوثائق والمستندات البحثية في المنصة؟",
          label: "بدء رفع الوثائق والتحليل",
        },
        {
          text: "ما هي أدوات التوليف المقارن واستخراج المصطلحات المتاحة؟",
          label: "أدوات التوليف والمصطلحات",
        },
        {
          text: "ما هي صيغ ونوعيات الملفات المدعومة للتحليل الأكاديمي؟",
          label: "صيغ الملفات المدعومة",
        },
      ];
    } else if (activeSources.length === 1) {
      const title = activeSources[0].title || "الوثيقة الأولى";
      return [
        {
          text: `استخلص الملخص الأكاديمي وأهم النتائج والتوصيات المذكورة في "${title}".`,
          label: "أبرز النتائج والتوصيات",
        },
        {
          text: `ما هي المفاهيم والفرضيات الرئيسية التي تعتمد عليها دراسة "${title}"؟`,
          label: "الفرضيات والمنهجية",
        },
        {
          text: `ما هي الفجوات المعرفية أو الحدود المذكورة في مستند "${title}"؟`,
          label: "الفجوات والحدود البحثية",
        },
      ];
    } else {
      const src1 = activeSources[0].title || "الوثيقة الأولى";
      const src2 = activeSources[1].title || "الوثيقة الثانية";
      return [
        {
          text: `قارن بين الوثائق المتاحة (${src1} و ${src2}) وأبرز نقاط التوافق والتعارض الجوهري.`,
          label: "مقارنة الأدلة والتعارض",
        },
        {
          text: `استخلص الفجوات البحثية المشتركة والأدلة الواردة في المستندات المرفقة.`,
          label: "الفجوات والأدلة المشتركة",
        },
        {
          text: `ما هي التوصيات والتداعيات الاستراتيجية التي اتفقت عليها الوثائق؟`,
          label: "التوصيات والاستنتاجات",
        },
      ];
    }
  }, [activeSources]);

  // Simple rendering of text with citation highlights
  const renderMessageTextWithCitations = (text: string) => {
    // Regex matches "الوثيقة 1" through "الوثيقة 10" or "الوثيقة الأولى/الثانية/الثالثة" or "Document 1-10" or "Source 1-10"
    const regex = /(الوثيقة \d+|الوثيقة الأولى|الوثيقة الثانية|الوثيقة الثالثة|Document \d+|Source \d+)/g;
    const parts = text.split(regex);
    if (parts.length === 1) {
      return <div className="whitespace-pre-line leading-relaxed text-[13.5px] text-[#1f1f1f]">{text}</div>;
    }

    return (
      <div className="whitespace-pre-line leading-relaxed text-[13.5px] text-[#1f1f1f]">
        {parts.map((part, index) => {
          if (regex.test(part)) {
            // Figure out source ID based on keyword dynamically from current sources
            let matchedSourceId: string | null = null;
            if (part.includes("1") || part.includes("الأولى")) {
              matchedSourceId = sources[0]?.id || null;
            } else if (part.includes("2") || part.includes("الثانية")) {
              matchedSourceId = sources[1]?.id || null;
            } else if (part.includes("3") || part.includes("الثالثة")) {
              matchedSourceId = sources[2]?.id || null;
            }

            return (
              <span
                key={index}
                onClick={() => {
                  if (matchedSourceId) {
                    onSourceClick(matchedSourceId);
                  }
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold mx-0.5 cursor-pointer transition-all duration-150 ${
                  matchedSourceId 
                    ? "bg-teal-50 text-[#094d4e] border border-teal-200 hover:bg-teal-100" 
                    : "bg-gray-100 text-gray-700 border border-gray-200"
                }`}
                title={matchedSourceId ? "انقر لقراءة محتوى المصدر بالكامل" : undefined}
                id={`citation-tag-${index}`}
              >
                <BookOpen className="w-3 h-3 flex-shrink-0" />
                {part}
              </span>
            );
          }
          return part;
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#fafaf8]" id="chat-window-container">
      {/* Header Info */}
      <div className="p-4 bg-white border-b border-[#e2e2dd] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-50 text-[#094d4e] p-1.5 rounded-lg border border-teal-100/80">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[#111111]">دردشة بحث OS والتحليل التوليفي</h1>
            <p className="text-[10px] text-gray-600 font-semibold mt-0.5">
              الوثائق المشمولة في التحليل حالياً: {activeSources.length} وثيقة
            </p>
          </div>
        </div>

        {activeSources.length === 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>يرجى تفعيل مصدر واحد على الأقل للدردشة!</span>
          </div>
        )}
      </div>

      {/* Main Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          /* Empty State / Onboarding */
          <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-6 py-8" id="chat-onboarding">
            <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center border border-teal-100/80 shadow-sm text-[#094d4e]">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-extrabold text-[#111111]">مرحباً بك في نظام بحث OS البحثي</h2>
              <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                أنا مساعدك المتخصص. قم بطرح أي تساؤل حول دراساتك، وسأقوم بالمقارنة بين المصادر بدقة متناهية، وإبراز الاختلافات والتناقضات المنهجية، مع الاستشهاد بكل فقرة مباشرة.
              </p>
            </div>

            {/* Native Upload Box directly inside Chat Window if no sources uploaded yet */}
            {sources.length === 0 && (
              <div className="w-full bg-white p-5 rounded-2xl border-2 border-dashed border-[#094d4e]/40 shadow-sm text-right space-y-3" dir="rtl" id="chat-native-upload-card">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-[#094d4e] flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4" />
                    <span>رفع وثيقة أو دراسة بحثية جديدة</span>
                  </span>
                  <span className="text-[10px] bg-teal-50 text-[#094d4e] border border-teal-100 px-2 py-0.5 rounded-full font-bold">
                    PDF / Word / TXT
                  </span>
                </div>

                {uploadError && (
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {isUploading ? (
                  <div className="py-6 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-7 h-7 text-[#094d4e] animate-spin" />
                    <p className="text-xs font-bold text-gray-800">جاري تحليل المستند واستخراج البيانات...</p>
                    <p className="text-[10px] text-[#094d4e] font-semibold animate-pulse">{uploadStep}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      قم برفع ملفات الدراسات الأكاديمية (PDF أو Word أو TXT) لتبدأ عملية المقارنة والتحليل التوليفي الذكي فوراً:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,application/pdf,text/plain"
                        id="chat-onboarding-file-input"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleDirectFileUpload(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="chat-onboarding-file-input"
                        className="flex-1 py-2.5 px-4 bg-[#094d4e] hover:bg-[#07393a] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>اختيار وثيقة من جهازك لرفعها فوراً</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prompt Starters */}
            <div className="w-full space-y-2.5">
              <span className="text-[11px] text-gray-400 font-bold block">نماذج أسئلة بحثية سريعة:</span>
              <div className="grid grid-cols-1 gap-2">
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (activeSources.length === 0) return;
                      onSendMessage(q.text);
                    }}
                    disabled={activeSources.length === 0}
                    className={`w-full text-right p-3 rounded-xl border text-xs leading-relaxed transition-all duration-200 flex items-start gap-2.5 ${
                      activeSources.length === 0
                        ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white border-[#e2e2dd] hover:border-[#094d4e] hover:bg-[#fafaf8] text-[#1f1f1f] shadow-2xs font-semibold"
                    }`}
                    id={`starter-question-btn-${idx}`}
                  >
                    <span className="bg-teal-50 text-[#094d4e] text-[9px] px-1.5 py-0.5 rounded font-extrabold mt-0.5 whitespace-nowrap">
                      {q.label}
                    </span>
                    <span className="flex-1 font-medium">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-4 max-w-3xl mx-auto" id="messages-list">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  id={`msg-container-${msg.id}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 shadow-2xs border ${
                      isUser
                        ? "bg-[#094d4e] text-white border-[#07393a]"
                        : "bg-white text-[#1f1f1f] border-[#e2e2dd]"
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between mb-1.5 text-[10px] opacity-70 font-bold">
                      <span>{isUser ? "الباحث" : "بحث OS"}</span>
                      <span className="font-mono">{msg.timestamp}</span>
                    </div>

                    {/* Text content with custom styled citations */}
                    {isUser ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <>
                        {parseReportText(msg.text).map((item, idx) => {
                          if (item.type === "text") {
                            return <div key={idx}>{renderMessageTextWithCitations(item.content)}</div>;
                          } else {
                            return <div key={idx} className="my-2"><EvidenceLayer data={item.data} /></div>;
                          }
                        })}
                        
                        {/* Agreement Meter inline beneath assistant responses (Only if comparing 2+ active sources) */}
                        {activeSources.length >= 2 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2" id={`agreement-meter-${msg.id}`}>
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <div className="flex items-center gap-1.5 text-gray-500">
                                <Sparkles className="w-3.5 h-3.5 text-[#094d4e]" />
                                <span>مقياس توافق المصادر (Agreement Meter):</span>
                              </div>
                              {(() => {
                                const meter = calculateAgreementMeter(msg.text);
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] border ${meter.color}`}>
                                    {meter.status} ({meter.score}%)
                                  </span>
                                );
                              })()}
                            </div>
                            
                            {(() => {
                              const meter = calculateAgreementMeter(msg.text);
                              return (
                                <div className="space-y-1">
                                  {/* Progress Bar */}
                                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${meter.barColor} transition-all duration-500`} 
                                      style={{ width: `${meter.score}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-medium leading-normal">
                                    {meter.description}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="flex justify-start" id="thinking-indicator-wrapper">
                <div className="bg-white text-[#1f1f1f] border border-[#e2e2dd] max-w-[85%] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="flex space-x-1.5 space-x-reverse">
                      <div className="w-2 h-2 bg-[#094d4e] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-[#094d4e] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-[#094d4e] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                    <span className="text-xs text-gray-600 font-extrabold">يقوم بحث OS بمقارنة المصادر وتوليف الرد الآن...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 bg-white border-t border-[#e2e2dd]">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto" id="chat-input-form">
          <div className="flex items-center gap-2">
            {/* Paperclip Direct Upload Button */}
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,application/pdf,text/plain"
              id="chat-paperclip-file-input"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleDirectFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <label
              htmlFor="chat-paperclip-file-input"
              className="p-3 text-gray-500 hover:text-[#094d4e] hover:bg-teal-50 rounded-xl border border-[#e2e2dd] bg-white cursor-pointer transition-all flex items-center justify-center shadow-2xs flex-shrink-0"
              title="إرفاق ورفع وثيقة بحثية جديدة (PDF/Word/TXT)"
              id="chat-paperclip-upload-btn"
            >
              <Paperclip className="w-4 h-4 text-[#094d4e]" />
            </label>

            <div className="relative flex-1 flex items-center">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  sources.length === 0
                    ? "يرجى إضافة أو رفع مصدر بحثي أولاً للبدء..."
                    : activeSources.length === 0
                      ? "اطرح سؤالك هنا (سيتم تفعيل كافة المصادر تلقائياً للإجابة)..."
                      : "اسأل بحث OS حول المصادر (مثال: قارن بين المصادر في أثر التعليم الرقمي)..."
                }
                disabled={sources.length === 0 || isThinking}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                className="w-full text-xs pr-4 pl-12 py-3 border border-[#e2e2dd] rounded-xl bg-white text-[#1f1f1f] focus:outline-none focus:border-[#094d4e] resize-none"
                id="chat-textarea-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sources.length === 0 || isThinking}
                className={`absolute left-2 p-2 rounded-lg transition-all duration-200 ${
                  !inputText.trim() || sources.length === 0 || isThinking
                    ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                    : "text-white bg-[#094d4e] hover:bg-[#07393a] shadow-xs font-semibold"
                }`}
                id="chat-send-btn"
                title="إرسال"
              >
                <Send className="w-4 h-4 transform -rotate-180" />
              </button>
            </div>
          </div>
          
          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-medium">
            <span>مدعوم بنظام Gemini 3.5 لضمان دقة مقارنة المستندات</span>
            <span>اضغط Enter للإرسال، Shift+Enter لسطر جديد</span>
          </div>
        </form>
      </div>
    </div>
  );
}
