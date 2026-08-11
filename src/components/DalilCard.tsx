import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Volume2, Pause, Square, ChevronDown, ChevronUp, Radio, Download } from "lucide-react";
import { DalilBriefing } from "../types";
import { exportToWordDocument } from "../utils/reportFormatter";

interface DalilCardProps {
  dalilBriefing: DalilBriefing | null;
  dalilCountdown: number | null;
  isDalilGenerating: boolean;
  onTriggerDalilBriefing?: () => void;
  compact?: boolean;
}

export default function DalilCard({
  dalilBriefing,
  dalilCountdown,
  isDalilGenerating,
  onTriggerDalilBriefing,
  compact = false,
}: DalilCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(-1);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Record<number, { audioUri: string; mimeType: string }>>({});
  const isStoppedRef = useRef<boolean>(false);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const utterancesKeepAliveRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stopAllSpeech = () => {
    isStoppedRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    utterancesKeepAliveRef.current = [];
    audioCacheRef.current = {};
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
    setCurrentChunkIdx(-1);
  };

  // Keep-alive timer so browser SpeechSynthesis engine does not pause after 15s
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const interval = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        if (synth.speaking && !synth.paused) {
          synth.pause();
          synth.resume();
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying, isPaused]);

  // Clean up speech synthesis when component unmounts or briefing changes
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, [dalilBriefing?.id]);

  const playChunkWithWebSpeechFallback = (segments: string[], idx: number) => {
    if (idx >= segments.length || isStoppedRef.current) {
      stopAllSpeech();
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      stopAllSpeech();
      return;
    }

    const synth = window.speechSynthesis;

    if (idx === 0) {
      try {
        synth.cancel();
      } catch (_) {}
    }

    try {
      synth.resume();
    } catch (_) {}

    const voices = synth.getVoices() || [];
    const arVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("ar") ||
        v.name.toLowerCase().includes("arabic") ||
        v.name.includes("عربي") ||
        v.name.toLowerCase().includes("maged") ||
        v.name.toLowerCase().includes("tarik") ||
        v.name.toLowerCase().includes("salma")
    ) || voices.find((v) => v.lang.toLowerCase().startsWith("ar"));

    setCurrentChunkIdx(idx);
    const cleanSegment = segments[idx]
      .replace(/[#*`_~\[\]()]/g, "")
      .replace(/\.[a-z0-9]{2,4}\b/gi, "")
      .replace(/[a-zA-Z0-9_\-\.\/]{2,}\.(pdf|docx|txt|html|xlsx|pptx)/gi, "")
      .replace(/[a-zA-Z]{2,}/g, "")
      .replace(/\.\.\./g, " .. ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanSegment) {
      playChunkWithWebSpeechFallback(segments, idx + 1);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSegment);
    utterance.lang = "ar-SA";
    if (arVoice) {
      utterance.voice = arVoice;
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    // Anchor utterance instance in refs so Garbage Collector NEVER deletes it mid-speech
    activeUtteranceRef.current = utterance;
    utterancesKeepAliveRef.current.push(utterance);

    const startTime = Date.now();
    let hasFinished = false;

    const handleNext = () => {
      if (hasFinished || isStoppedRef.current) return;
      hasFinished = true;

      // Remove finished utterance from keepalive array
      utterancesKeepAliveRef.current = utterancesKeepAliveRef.current.filter((u) => u !== utterance);
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }

      if (!isStoppedRef.current) {
        playChunkWithWebSpeechFallback(segments, idx + 1);
      }
    };

    utterance.onend = handleNext;
    utterance.onerror = (e) => {
      console.warn("Utterance speech error:", e);
      handleNext();
    };

    try {
      synth.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    } catch (err) {
      console.warn("SpeechSynthesis speak error:", err);
      handleNext();
    }
  };

  const handleTogglePlay = () => {
    if (!dalilBriefing?.text) return;

    if (isPlaying && !isPaused) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setIsPaused(true);
      return;
    }

    if (isPlaying && isPaused) {
      if (currentAudioRef.current) {
        currentAudioRef.current.play().catch(console.warn);
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
      setIsPaused(false);
      return;
    }

    // Reset any active speech and start fresh
    stopAllSpeech();
    isStoppedRef.current = false;

    // Split text EXACTLY as rendered in UI by "||"
    const rawSegments = dalilBriefing.text
      .split("||")
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSegments.length === 0) return;

    setIsPlaying(true);
    setIsPaused(false);

    // Instant speech rendition using Web Speech API with 0ms delay
    playChunkWithWebSpeechFallback(rawSegments, 0);
  };

  const handleExportMSW = () => {
    if (!dalilBriefing?.text) return;
    const cleanDocText = dalilBriefing.text.replace(/\|\|/g, "\n\n");
    exportToWordDocument("إحاطة الدليل - الصوت المرشد", cleanDocText);
  };

  return (
    <div
      className="p-3.5 bg-linear-to-b from-[#094d4e] via-[#084243] to-[#052d2e] text-white rounded-2xl shadow-sm border border-teal-800/80 transition-all relative"
      id="dalil-widget-card"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-teal-700/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-500/20 rounded-lg text-teal-300 border border-teal-500/30 relative">
            <Sparkles className="w-4 h-4 text-teal-200" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-300"></span>
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-white tracking-wide">الدليل — الصوت المرشد</span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 bg-teal-500/30 text-teal-200 text-[9px] px-1.5 py-0.2 rounded-full border border-teal-400/30 animate-pulse">
                  <Radio className="w-2.5 h-2.5 text-teal-300" />
                  <span>يتلو الآن</span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-teal-200/80 font-medium">الرفيق البحثي الموثوق | bahthOS</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* MS Word Export Button */}
          {dalilBriefing && !isDalilGenerating && (
            <button
              onClick={handleExportMSW}
              className="px-2 py-1 bg-teal-800/60 hover:bg-teal-700/70 active:bg-teal-600/80 text-teal-200 hover:text-white rounded-lg border border-teal-600/50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
              title="تصدير الإحاطة إلى مستند MS Word (.doc/.docx)"
              id="dalil-export-msw-btn"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[10px] hidden sm:inline">تصدير MSW</span>
            </button>
          )}

          {/* Text-To-Speech Controls (Speaker icon only, toggling to Pause) */}
          {dalilBriefing && !isDalilGenerating && (
            <div className="flex items-center gap-1 bg-teal-950/60 p-1 rounded-lg border border-teal-700/50">
              <button
                onClick={handleTogglePlay}
                className="p-1 hover:bg-teal-700/50 active:bg-teal-600/60 text-teal-200 hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center"
                title={isPlaying ? (isPaused ? "استئناف التلاوة" : "إيقاف مؤقت") : "تلاوة الإحاطة بصوت الدليل"}
                id="dalil-tts-play-btn"
              >
                {isPlaying && !isPaused ? (
                  <Pause className="w-4 h-4 text-amber-300" />
                ) : (
                  <Volume2 className="w-4 h-4 text-teal-300" />
                )}
              </button>

              {isPlaying && (
                <button
                  onClick={stopAllSpeech}
                  className="p-1 hover:bg-red-900/50 text-red-300 rounded transition-colors cursor-pointer"
                  title="إنهاء التلاوة"
                  id="dalil-tts-stop-btn"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Trigger Refresh Button */}
          {onTriggerDalilBriefing && (
            <button
              onClick={onTriggerDalilBriefing}
              disabled={isDalilGenerating || (dalilCountdown !== null && dalilCountdown !== undefined)}
              className="px-2.5 py-1 bg-teal-500/30 hover:bg-teal-500/50 active:bg-teal-600/60 disabled:opacity-50 text-teal-100 text-[11px] font-bold rounded-lg border border-teal-400/30 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              title="تحديث الإحاطة المباشرة"
              id="dalil-refresh-btn"
            >
              {isDalilGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin text-teal-200" />
              ) : (
                <Sparkles className="w-3 h-3 text-teal-300" />
              )}
              <span className="hidden sm:inline">{dalilBriefing ? "تحديث" : "إحاطة"}</span>
            </button>
          )}

          {/* Expand/Collapse Toggle */}
          {dalilBriefing && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-teal-700/50 text-teal-200 rounded transition-colors cursor-pointer"
              title={isExpanded ? "طَي النص" : "توسيع النص الكامل"}
              id="dalil-expand-toggle-btn"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Countdown Progress State */}
      {dalilCountdown !== null && dalilCountdown !== undefined && (
        <div className="p-2 mb-2 bg-amber-950/70 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-200" id="dalil-countdown-banner">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="font-bold text-[11px]">جاري تقييم أثر المصدر الجديد مع الدليل...</span>
          </div>
          <span className="font-extrabold bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full text-[10px] border border-amber-400/30">
            {dalilCountdown} ث
          </span>
        </div>
      )}

      {/* Generating Loading State */}
      {isDalilGenerating && (
        <div className="p-2.5 bg-teal-900/60 border border-teal-600/40 rounded-xl flex items-center gap-2 text-xs text-teal-100 animate-pulse" id="dalil-generating-banner">
          <Loader2 className="w-4 h-4 text-teal-300 animate-spin flex-shrink-0" />
          <span className="font-bold text-[11px]">جاري صياغة إحاطة التحديث المباشرة للدليل...</span>
        </div>
      )}

      {/* Active Briefing Display — Fully Scrollable & Unclipped */}
      {dalilBriefing && !isDalilGenerating && (
        <div className="mt-1">
          <div className="flex items-center justify-between text-[10px] text-teal-300/90 mb-1.5 font-medium dir-ltr">
            <span className="bg-teal-900/50 px-2 py-0.5 rounded border border-teal-700/50 text-teal-200 dir-rtl flex items-center gap-1">
              <span>إحاطة قائمة على الأدلة</span>
              {isPlaying && (
                <span className="flex items-center gap-0.5 mr-1">
                  <span className="w-1 h-2 bg-teal-300 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1 h-3 bg-teal-200 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1 h-2 bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </span>
              )}
            </span>
            <span>
              {new Date(dalilBriefing.dateCreated).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Fully Scrollable Container with Max Height so text is never truncated */}
          <div
            className={`text-xs leading-relaxed text-teal-50 font-medium whitespace-pre-wrap bg-teal-950/60 p-3 rounded-xl border border-teal-800/70 overflow-y-auto transition-all ${
              compact ? "max-h-48" : "max-h-64"
            } ${!isExpanded ? "max-h-16 overflow-hidden relative cursor-pointer" : ""}`}
            onClick={() => !isExpanded && setIsExpanded(true)}
            style={{ scrollbarWidth: "thin", scrollbarColor: "#0d6869 #032122" }}
            id="dalil-text-content-box"
          >
            {dalilBriefing.text.split("||").map((segment, idx, arr) => {
              const isDramaticPause = segment.includes("... ") || segment.startsWith("...");
              const isCurrentlyBeingRead = currentChunkIdx === idx;
              return (
                <React.Fragment key={idx}>
                  <span
                    className={`transition-all duration-200 ${
                      isCurrentlyBeingRead
                        ? "bg-teal-700/80 text-amber-200 px-1.5 py-0.5 rounded font-bold border border-amber-400/40 shadow-xs"
                        : isDramaticPause
                        ? "font-bold text-amber-100"
                        : ""
                    }`}
                  >
                    {segment.trim()}
                  </span>
                  {idx < arr.length - 1 && (
                    <span
                      className="inline-flex items-center mx-1 px-1.5 py-0.2 bg-teal-800/90 text-teal-200 rounded text-[10px] font-bold border border-teal-600/50 select-none shadow-2xs"
                      title="وقفة التنفس الطبيعية للدليل"
                    >
                      ||
                    </span>
                  )}
                </React.Fragment>
              );
            })}

            {!isExpanded && (
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#032122] to-transparent flex items-end justify-center pb-0.5">
                <span className="text-[10px] text-teal-300 font-bold bg-[#084243] px-2 py-0.5 rounded-full border border-teal-600/50 shadow-xs">
                  اضغط لتوسيع النص كاملًا
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State / Initial Prompt */}
      {!dalilBriefing && !isDalilGenerating && (dalilCountdown === null || dalilCountdown === undefined) && (
        <div className="text-xs text-teal-100/90 leading-relaxed bg-teal-950/40 p-2.5 rounded-xl border border-teal-800/50">
          <p className="mb-2 text-[11px] font-normal text-teal-100">
            أهلاً بك. أنا <strong className="text-white font-bold">"الدليل"</strong>، الصوت المرشد والرفيق الموثوق داخل بحث OS. أستخرج لك بدقة تحليلاً موجزاً عما تغيّر ولماذا استناداً حصرًا لنصوص مصادرك.
          </p>
          {onTriggerDalilBriefing && (
            <button
              onClick={onTriggerDalilBriefing}
              className="w-full py-1.5 px-3 bg-teal-500 hover:bg-teal-400 text-teal-950 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              id="dalil-initial-request-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-950" />
              <span>طلب إحاطة أولية من الدليل</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

