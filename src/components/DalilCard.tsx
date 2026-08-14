import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Volume2, Pause, Square, ChevronDown, ChevronUp, Radio, Download } from "lucide-react";
import { DalilBriefing } from "../types.js";
import { exportToWordDocument } from "../utils/reportFormatter.js";

interface DalilCardProps {
  dalilBriefing: DalilBriefing | null;
  dalilCountdown: number | null;
  isDalilGenerating: boolean;
  onTriggerDalilBriefing?: () => void;
  compact?: boolean;
}

function cleanDalilDisplayText(text: string): string {
  if (!text) return "";
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[A-Za-z][A-Za-z0-9_'’\-\s]{2,}?\s*\.\s*(?:pdf|docx?|txt)\b\s*\.?/gi, " ")
    .replace(/\b(?:pdf|docx?|txt)\b/gi, "")
    .replace(/\b[a-z0-9]+(?:-[a-z0-9]+){3,}-\d{4}-\d{2}-\d{2}(?:-\d{2}){0,2}\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([،؛:])/g, "$1")
    .trim();
}

function waitForSpeechVoices(synth: SpeechSynthesis, timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices() || []);
    };
    synth.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, timeoutMs);
  });
}

export default function DalilCard({
  dalilBriefing,
  dalilCountdown,
  isDalilGenerating,
  onTriggerDalilBriefing,
  compact = false,
}: DalilCardProps) {
  const displayText = dalilBriefing?.text ? cleanDalilDisplayText(dalilBriefing.text) : "";
  const displaySegments = displayText.split("||").map((segment) => segment.trim()).filter(Boolean);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isStoppedRef = useRef<boolean>(false);

  const cachedAudioDataRef = useRef<{ audio: string; mimeType?: string } | null>(null);
  const cachedBriefingIdRef = useRef<string | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const utterancesKeepAliveRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stopAllSpeech = (clearNotice = true) => {
    isStoppedRef.current = true;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.ontimeupdate = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
      } catch (_) {}
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    activeUtteranceRef.current = null;
    utterancesKeepAliveRef.current = [];
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
    if (clearNotice) setAudioNotice(null);
    setCurrentChunkIdx(-1);
  };

  // Pre-fetch TTS audio in background as soon as dalilBriefing updates
  useEffect(() => {
    if (!dalilBriefing?.text || dalilBriefing.id === cachedBriefingIdRef.current) return;

    cachedBriefingIdRef.current = dalilBriefing.id;
    cachedAudioDataRef.current = null;

    const fullText = (displayText || dalilBriefing.text).replace(/\|\|/g, " . ");

    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fullText }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.audio) return;
        cachedAudioDataRef.current = { audio: data.audio, mimeType: data.mimeType };
      })
      .catch((err) => {
        console.warn("Background TTS prefetch info:", err);
      });
  }, [dalilBriefing?.id, dalilBriefing?.text]);

  // Pre-load and cache browser voices on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      };
    }
  }, []);

  // Clean up speech synthesis when component unmounts or briefing changes
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, [dalilBriefing?.id]);

  const playChunkWithWebSpeechFallback = async (segments: string[], idx: number) => {
    if (idx >= segments.length || isStoppedRef.current) {
      stopAllSpeech();
      return;
    }

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

    let hasFinished = false;

    const handleNext = () => {
      if (hasFinished || isStoppedRef.current) return;
      hasFinished = true;

      if (activeUtteranceRef.current) {
        utterancesKeepAliveRef.current = utterancesKeepAliveRef.current.filter(
          (u) => u !== activeUtteranceRef.current
        );
        activeUtteranceRef.current = null;
      }

      // Advance only from a real speech/audio completion event. There is no
      // timer-based visual progression, so silent strolling is impossible.
      void playChunkWithWebSpeechFallback(segments, idx + 1);
    };

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const synth = window.speechSynthesis;

      try {
        synth.resume();
      } catch (_) {}

      const voices = await waitForSpeechVoices(synth);
      if (isStoppedRef.current) return;
      const arVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith("ar") ||
          v.name.toLowerCase().includes("arabic") ||
          v.name.includes("عربي") ||
          v.name.toLowerCase().includes("maged") ||
          v.name.toLowerCase().includes("tarik") ||
          v.name.toLowerCase().includes("salma") ||
          v.name.toLowerCase().includes("laila") ||
          v.name.toLowerCase().includes("naayf") ||
          v.name.toLowerCase().includes("hoda")
      );

        // Never use the browser's default voice here: it may be French or English.
        // A browser fallback is acceptable only when it is explicitly Arabic.
        const selectedVoice = arVoice;
        if (!selectedVoice) {
          setAudioNotice("لا يتوفر صوت عربي في المتصفح؛ لن تُستخدم أصوات فرنسية أو إنجليزية بديلة.");
        setIsPlaying(false);
        setCurrentChunkIdx(-1);
        isStoppedRef.current = true;
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanSegment);
      utterance.lang = selectedVoice.lang || "ar-SA";
      utterance.voice = selectedVoice;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      activeUtteranceRef.current = utterance;
      utterancesKeepAliveRef.current.push(utterance);

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };
      utterance.onend = handleNext;
      utterance.onerror = (e) => {
        console.warn("Utterance speech warning:", e);
        stopAllSpeech(false);
        setAudioNotice("تعذر تشغيل الصوت في المتصفح؛ تحقّق من مخرج الصوت أو أذونات التلاوة.");
      };

      try {
        synth.speak(utterance);
        setIsPlaying(true);
        setIsPaused(false);
      } catch (err) {
        console.warn("SpeechSynthesis speak error:", err);
        stopAllSpeech(false);
        setAudioNotice("تعذر بدء التلاوة في المتصفح؛ تحقّق من مخرج الصوت أو أذونات التلاوة.");
      }
    } else {
      stopAllSpeech(false);
      setAudioNotice("لا تتوفر خدمة صوت في هذا المتصفح؛ لم يتم تحريك التمييز دون صوت.");
    }
  };

  const handleTogglePlay = async () => {
    if (!dalilBriefing?.text) return;

    if (isLoadingAudio) {
      stopAllSpeech();
      return;
    }

    // 1. Pause logic if currently playing
    if (isPlaying && !isPaused) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setIsPaused(true);
      return;
    }

    // 2. Resume logic if currently paused
    if (isPlaying && isPaused) {
      if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current.play().catch(() => {});
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
      setIsPaused(false);
      return;
    }

    // 3. Pre-unlock HTML5 Audio synchronously inside the user click gesture tick!
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.muted = false;
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    try {
      const p = audio.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    } catch (_) {}

    // Reset previous playback & speech instances
    stopAllSpeech();
    isStoppedRef.current = false;

    const rawSegments = displaySegments;

    if (rawSegments.length === 0) return;

    // Retrieve or fetch TTS audio payload
    let audioData = cachedAudioDataRef.current;
    let serverAudioError: string | null = null;

    if (!audioData) {
      setIsLoadingAudio(true);
      const fullText = (displayText || dalilBriefing.text).replace(/\|\|/g, " . ");

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fullText }),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          serverAudioError = `خدمة الصوت العربية غير متاحة حالياً (${res.status}). ${detail.slice(0, 120)}`;
        } else if (!isStoppedRef.current) {
          const data = await res.json();
          if (data && data.audio) {
            audioData = { audio: data.audio, mimeType: data.mimeType || "audio/wav" };
            cachedAudioDataRef.current = audioData;
          } else {
            serverAudioError = "لم تُرجِع خدمة الصوت العربية ملفاً صوتياً قابلاً للتشغيل.";
          }
        }
      } catch (err) {
        console.warn("On-demand TTS fetch error:", err);
        serverAudioError = "تعذر الوصول إلى خدمة الصوت العربية في الخادم.";
      } finally {
        setIsLoadingAudio(false);
      }
    }

    if (isStoppedRef.current) return;

    // If Gemini TTS audio payload is ready, play through pre-unlocked HTML5 Audio element
    if (audioData && audioData.audio) {
      const mime = audioData.mimeType || "audio/wav";
      audio.src = `data:${mime};base64,${audioData.audio}`;
      audio.load();
      audio.currentTime = 0;
      audio.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };
      audio.onpause = () => {
        if (!isStoppedRef.current && audio.currentTime > 0 && !audio.ended) {
          setIsPaused(true);
        }
      };

      const totalLength = rawSegments.reduce((acc, s) => acc + Math.max(1, s.length), 0);

      audio.ontimeupdate = () => {
        if (isStoppedRef.current || !audio.duration || audio.duration <= 0) return;
        const progress = audio.currentTime / audio.duration;
        let accumulatedRatio = 0;
        for (let i = 0; i < rawSegments.length; i++) {
          accumulatedRatio += rawSegments[i].length / totalLength;
          if (progress <= accumulatedRatio || i === rawSegments.length - 1) {
            setCurrentChunkIdx(i);
            break;
          }
        }
      };

      audio.onended = () => {
        if (!isStoppedRef.current) {
          stopAllSpeech();
        }
      };

      audio.onerror = (e) => {
        console.warn("Generated Arabic audio playback error:", e);
        if (!isStoppedRef.current) {
          stopAllSpeech(false);
          setAudioNotice("تعذر تشغيل الملف الصوتي العربي؛ تحقّق من مخرج الصوت ثم أعد المحاولة.");
        }
      };

      try {
        await audio.play();
        setIsPlaying(true);
        setIsPaused(false);
        setCurrentChunkIdx(0);
        return;
      } catch (playErr) {
        console.warn("HTML5 Arabic audio.play() failed:", playErr);
        serverAudioError = "تعذر بدء تشغيل الملف الصوتي العربي في المتصفح.";
      }
    }

    if (!isStoppedRef.current) {
      stopAllSpeech(false);
      setAudioNotice(serverAudioError || "لم تتوفر إحاطة صوتية عربية. أعد المحاولة بعد التأكد من إعدادات الخادم.");
    }
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
                {isLoadingAudio ? (
                  <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                ) : isPlaying && !isPaused ? (
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

          {audioNotice && (
            <div className="mb-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold leading-5 text-amber-900">
              {audioNotice}
            </div>
          )}

          {/* Fully Scrollable Container with Max Height so text is never truncated */}
          <div
            className={`text-sm leading-8 text-[#173d3b] font-medium whitespace-pre-wrap bg-white p-4 rounded-2xl border border-[#d7e8e1] shadow-inner shadow-[#073f40]/10 overflow-y-auto transition-all ${
              compact ? "max-h-48" : "max-h-64"
            } ${!isExpanded ? "max-h-16 overflow-hidden relative cursor-pointer" : ""}`}
            onClick={() => !isExpanded && setIsExpanded(true)}
            style={{ scrollbarWidth: "thin", scrollbarColor: "#80aaa0 #e4efeb" }}
            id="dalil-text-content-box"
          >
            <div className="space-y-2.5">
              {displaySegments.map((segment, idx) => {
                const cleanSeg = segment.trim();
                if (!cleanSeg) return null;
                const isCurrentlyBeingRead = currentChunkIdx === idx;
                const isHeading = cleanSeg.startsWith("نَسْتَعْرِضُ") || cleanSeg.startsWith("تَعْتَمِدُ") || idx === 0;
                return (
                  <div
                    key={idx}
                    className={`transition-all duration-200 ${
                      isCurrentlyBeingRead
                        ? "bg-[#0d6662] text-white p-2.5 rounded-xl font-bold border border-[#d9a441]/70 shadow-sm"
                        : isHeading
                        ? "text-[#0b5b59] font-bold border-r-2 border-[#d19a3b] pr-3 my-1"
                        : "text-[#173d3b] leading-8"
                    }`}
                  >
                    {cleanSeg}
                  </div>
                );
              })}
            </div>

            {!isExpanded && (
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-0.5">
                <span className="text-[10px] text-[#0b5b59] font-bold bg-[#dcece7] px-2.5 py-0.5 rounded-full border border-[#9fc7bc] shadow-xs">
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


