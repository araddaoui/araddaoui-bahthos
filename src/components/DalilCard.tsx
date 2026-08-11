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

// Convert base64 PCM (16-bit Little Endian, 24kHz) to Float32Array for Web Audio API
function base64PcmToFloat32Array(base64Pcm: string): Float32Array {
  const binaryString = atob(base64Pcm);
  
  // Skip 44-byte RIFF header if present
  let offset = 0;
  if (binaryString.length >= 44 && binaryString.substring(0, 4) === "RIFF" && binaryString.substring(8, 12) === "WAVE") {
    offset = 44;
  }

  const bytesCount = binaryString.length - offset;
  const samplesCount = Math.floor(bytesCount / 2);
  const float32 = new Float32Array(samplesCount);

  const buffer = new ArrayBuffer(binaryString.length);
  const uint8 = new Uint8Array(buffer);
  for (let i = 0; i < binaryString.length; i++) {
    uint8[i] = binaryString.charCodeAt(i);
  }
  const dataView = new DataView(buffer);

  for (let i = 0; i < samplesCount; i++) {
    const int16 = dataView.getInt16(offset + i * 2, true); // true = Little Endian
    float32[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
  }

  return float32;
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isStoppedRef = useRef<boolean>(false);

  const cachedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const cachedBriefingIdRef = useRef<string | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const utterancesKeepAliveRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stopAllSpeech = () => {
    isStoppedRef.current = true;

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (_) {}
      try {
        audioSourceRef.current.disconnect();
      } catch (_) {}
      audioSourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state === "running") {
      try {
        audioContextRef.current.suspend();
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
    setCurrentChunkIdx(-1);
  };

  // Pre-fetch TTS audio in background as soon as dalilBriefing updates
  useEffect(() => {
    if (!dalilBriefing?.text || dalilBriefing.id === cachedBriefingIdRef.current) return;

    cachedBriefingIdRef.current = dalilBriefing.id;
    cachedAudioBufferRef.current = null;

    const fullText = dalilBriefing.text.replace(/\|\|/g, " . ");

    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fullText }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!data || !data.audio) return;

        let sampleRate = 24000;
        const mimeType = data.mimeType || "audio/pcm;rate=24000";
        if (mimeType.includes("rate=")) {
          const match = mimeType.match(/rate=(\d+)/);
          if (match) sampleRate = parseInt(match[1], 10);
        }

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const tempCtx = new AudioContextClass({ sampleRate });
        const float32Samples = base64PcmToFloat32Array(data.audio);
        const audioBuf = tempCtx.createBuffer(1, float32Samples.length, sampleRate);
        audioBuf.getChannelData(0).set(float32Samples);

        cachedAudioBufferRef.current = audioBuf;
        try {
          tempCtx.close();
        } catch (_) {}
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

  const playChunkWithWebSpeechFallback = (segments: string[], idx: number) => {
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

    const minReadDuration = Math.min(8000, Math.max(3000, cleanSegment.length * 90));
    const startTime = Date.now();
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

      const elapsed = Date.now() - startTime;
      if (elapsed < minReadDuration - 300) {
        const remainingMs = minReadDuration - elapsed;
        setTimeout(() => {
          if (!isStoppedRef.current) {
            playChunkWithWebSpeechFallback(segments, idx + 1);
          }
        }, remainingMs);
      } else {
        if (!isStoppedRef.current) {
          playChunkWithWebSpeechFallback(segments, idx + 1);
        }
      }
    };

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const synth = window.speechSynthesis;

      try {
        synth.resume();
      } catch (_) {}

      const voices = synth.getVoices() || [];
      const arVoice =
        voices.find(
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
        ) || voices.find((v) => v.lang.toLowerCase().startsWith("ar"));

      const utterance = new SpeechSynthesisUtterance(cleanSegment);
      utterance.lang = "ar-SA";
      if (arVoice) {
        utterance.voice = arVoice;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      activeUtteranceRef.current = utterance;
      utterancesKeepAliveRef.current.push(utterance);

      utterance.onend = handleNext;
      utterance.onerror = (e) => {
        console.warn("Utterance speech warning:", e);
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
    } else {
      setTimeout(handleNext, minReadDuration);
    }
  };

  const playWithAudioBuffer = (ctx: AudioContext, audioBuffer: AudioBuffer, segments: string[]) => {
    if (isStoppedRef.current) return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    audioSourceRef.current = source;

    const startTime = ctx.currentTime;
    const duration = audioBuffer.duration;
    const totalLength = segments.reduce((acc, s) => acc + Math.max(1, s.length), 0);

    const updateHighlight = () => {
      if (isStoppedRef.current || !audioSourceRef.current) return;
      const elapsed = ctx.currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      let accumulatedRatio = 0;
      for (let i = 0; i < segments.length; i++) {
        accumulatedRatio += segments[i].length / totalLength;
        if (progress <= accumulatedRatio || i === segments.length - 1) {
          setCurrentChunkIdx(i);
          break;
        }
      }

      if (progress < 1.0) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight);
      }
    };

    source.onended = () => {
      if (!isStoppedRef.current) {
        stopAllSpeech();
      }
    };

    try {
      source.start(0);
      setIsPlaying(true);
      setIsPaused(false);
      setCurrentChunkIdx(0);
      animationFrameRef.current = requestAnimationFrame(updateHighlight);
    } catch (err) {
      console.warn("AudioBufferSourceNode start failed, falling back to WebSpeech:", err);
      playChunkWithWebSpeechFallback(segments, 0);
    }
  };

  const handleTogglePlay = async () => {
    if (!dalilBriefing?.text) return;

    if (isLoadingAudio) {
      stopAllSpeech();
      return;
    }

    // Initialize/resume AudioContext SYNCHRONOUSLY inside user click gesture tick
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (_) {}
    }

    if (isPlaying && !isPaused) {
      if (ctx && ctx.state === "running") {
        ctx.suspend();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setIsPaused(true);
      return;
    }

    if (isPlaying && isPaused) {
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
      setIsPaused(false);
      return;
    }

    // Reset previous audio and speech instances
    stopAllSpeech();
    isStoppedRef.current = false;

    const rawSegments = dalilBriefing.text
      .split("||")
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSegments.length === 0) return;

    // 1. If audio is already pre-fetched and decoded
    if (ctx && cachedAudioBufferRef.current) {
      playWithAudioBuffer(ctx, cachedAudioBufferRef.current, rawSegments);
      return;
    }

    // 2. Otherwise fetch TTS audio on demand
    setIsLoadingAudio(true);
    const fullText = dalilBriefing.text.replace(/\|\|/g, " . ");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      if (res.ok && !isStoppedRef.current && ctx) {
        const data = await res.json();
        if (data.audio) {
          let sampleRate = 24000;
          const mimeType = data.mimeType || "audio/pcm;rate=24000";
          if (mimeType.includes("rate=")) {
            const match = mimeType.match(/rate=(\d+)/);
            if (match) sampleRate = parseInt(match[1], 10);
          }

          const float32Samples = base64PcmToFloat32Array(data.audio);
          const audioBuffer = ctx.createBuffer(1, float32Samples.length, sampleRate);
          audioBuffer.getChannelData(0).set(float32Samples);
          cachedAudioBufferRef.current = audioBuffer;

          setIsLoadingAudio(false);
          playWithAudioBuffer(ctx, audioBuffer, rawSegments);
          return;
        }
      }
    } catch (err) {
      console.warn("On-demand TTS fetch error:", err);
    } finally {
      setIsLoadingAudio(false);
    }

    if (!isStoppedRef.current) {
      playChunkWithWebSpeechFallback(rawSegments, 0);
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


