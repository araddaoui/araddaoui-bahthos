import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Volume2, Pause, Square, ChevronDown, ChevronUp, Radio, Download } from "lucide-react";
import { DalilBriefing } from "../types.js";
import { exportToWordDocument } from "../utils/reportFormatter.js";

interface DalilCardProps {
  dalilBriefing: DalilBriefing | null;
  dalilCountdown: number | null;
  isDalilGenerating: boolean;
  dalilError?: string | null;
  onTriggerDalilBriefing?: () => void;
  compact?: boolean;
}

type AudioData = { audio: string; mimeType?: string };
type AudioChunk = {
  text: string;
  paragraphIndex: number;
  sentenceIndex: number;
  sentenceEnd: boolean;
  startOffset: number;
  endOffset: number;
};

// Keep only one look-ahead request. More parallel requests saturate a slow
// connection and delay the first sentence instead of improving continuity.
const AUDIO_PREFETCH_AHEAD = 1;

function cleanDalilDisplayText(text: string): string {
  if (!text) return "";
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[A-Za-z][A-Za-z0-9_'’\-\s]{2,}?\s*\.\s*(?:pdf|docx?|txt)\b\s*\.?/gi, " ")
    .replace(/\b(?:pdf|docx?|txt)\b/gi, "")
    .replace(/\b[a-z0-9]+(?:-[a-z0-9]+){3,}-\d{4}-\d{2}-\d{2}(?:-\d{2}){0,2}\b/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([،؛:])/g, "$1")
    .trim();
}

function normalizeDalilParagraphFlow(text: string): string {
  return text.replace(/\s*\|\|\s*/g, (_marker, offset: number, source: string) => {
    const before = source.slice(0, offset).trimEnd();
    const lastCharacter = before.charAt(before.length - 1);
    return /[.!؟؛:…۔]$/.test(lastCharacter) ? " " : "۔ ";
  });
}

function splitIntoParagraphs(text: string): string[] {
  return normalizeDalilParagraphFlow(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function splitParagraphIntoAudioChunks(paragraph: string, paragraphIndex: number, maxCharacters = 480): AudioChunk[] {
  // Keep each sentence in its own request. Colons are not sentence boundaries;
  // splitting on them was a source of early highlights and audible drift.
  const sentenceMatches = Array.from(paragraph.matchAll(/[^.!؟؛…۔]+(?:[.!؟؛…۔]+|$)/g));
  const chunks: AudioChunk[] = [];

  sentenceMatches.forEach((match, sentenceIndex) => {
    const rawSentence = match[0];
    const sentence = rawSentence.trim();
    if (!sentence) return;

    const rawStart = match.index ?? 0;
    const sentenceStart = rawStart + rawSentence.indexOf(sentence);
    const words = Array.from(sentence.matchAll(/\S+/g));
    let currentWords: string[] = [];
    let currentStart = 0;
    let currentEnd = 0;

    const pushCurrent = (sentenceEnd: boolean) => {
      if (currentWords.length === 0) return;
      chunks.push({
        text: currentWords.join(" "),
        paragraphIndex,
        sentenceIndex,
        sentenceEnd,
        startOffset: sentenceStart + currentStart,
        endOffset: sentenceStart + currentEnd,
      });
      currentWords = [];
    };

    words.forEach((wordMatch) => {
      const word = wordMatch[0];
      const wordStart = wordMatch.index ?? 0;
      const wordEnd = wordStart + word.length;
      const candidate = currentWords.length ? `${currentWords.join(" ")} ${word}` : word;
      if (currentWords.length > 0 && candidate.length > maxCharacters) {
        pushCurrent(false);
        currentStart = wordStart;
      } else if (currentWords.length === 0) {
        currentStart = wordStart;
      }
      currentWords.push(word);
      currentEnd = wordEnd;
    });

    pushCurrent(true);
  });

  return chunks.length > 0
    ? chunks
    : [{
        text: paragraph,
        paragraphIndex,
        sentenceIndex: 0,
        sentenceEnd: true,
        startOffset: 0,
        endOffset: paragraph.length,
      }];
}

export default function DalilCard({
  dalilBriefing,
  dalilCountdown,
  isDalilGenerating,
  dalilError = null,
  onTriggerDalilBriefing,
  compact = false,
}: DalilCardProps) {
  const displayText = dalilBriefing?.text ? cleanDalilDisplayText(dalilBriefing.text) : "";
  const displayParagraphs = useMemo(() => splitIntoParagraphs(displayText), [displayText]);
  const audioChunks = useMemo(
    () => displayParagraphs.flatMap((paragraph, paragraphIndex) => splitParagraphIntoAudioChunks(paragraph, paragraphIndex)),
    [displayParagraphs]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const isStoppedRef = useRef<boolean>(false);

  const cachedAudioChunksRef = useRef<Map<number, AudioData>>(new Map());
  const pendingAudioChunksRef = useRef<Map<number, Promise<AudioData | null>>>(new Map());
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const cachedBriefingIdRef = useRef<string | null>(null);
  const playbackRunIdRef = useRef(0);
  const activeChunkResolveRef = useRef<(() => void) | null>(null);

  const revokeAudioObjectUrl = () => {
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  };

  const audioDataToObjectUrl = (audioData: { audio: string; mimeType?: string }) => {
    const binary = window.atob(audioData.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: audioData.mimeType || "audio/wav" });
    revokeAudioObjectUrl();
    const url = URL.createObjectURL(blob);
    audioObjectUrlRef.current = url;
    return url;
  };

  const fetchAudioChunk = async (chunkIndex: number): Promise<AudioData | null> => {
    const cached = cachedAudioChunksRef.current.get(chunkIndex);
    if (cached) return cached;

    const pending = pendingAudioChunksRef.current.get(chunkIndex);
    if (pending) return pending;

    const chunk = audioChunks[chunkIndex];
    if (!chunk) return null;

    const request = (async () => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk.text }),
        signal: audioAbortControllerRef.current?.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`خدمة الصوت العربية غير متاحة حالياً (${res.status}). ${detail.slice(0, 160)}`);
      }

      const data = await res.json().catch(() => null);
      if (!data?.audio) {
        throw new Error("لم تُرجِع خدمة الصوت العربية ملفاً صوتياً قابلاً للتشغيل.");
      }

      const audioData: AudioData = { audio: data.audio, mimeType: data.mimeType || "audio/wav" };
      cachedAudioChunksRef.current.set(chunkIndex, audioData);
      return audioData;
    })();

    pendingAudioChunksRef.current.set(chunkIndex, request);
    try {
      return await request;
    } finally {
      pendingAudioChunksRef.current.delete(chunkIndex);
    }
  };

  const prefetchAudioWindow = (startIndex: number) => {
    const nextIndex = startIndex;
    if (nextIndex < 0 || nextIndex >= audioChunks.length) return;
    void fetchAudioChunk(nextIndex).catch((err) => {
      if ((err as Error)?.name !== "AbortError") {
        console.warn(`Background Arabic TTS prefetch info for chunk ${nextIndex}:`, err);
      }
    });
  };

  const stopAllSpeech = (clearNotice = true) => {
    isStoppedRef.current = true;
    playbackRunIdRef.current += 1;
    activeChunkResolveRef.current?.();
    activeChunkResolveRef.current = null;

    audioAbortControllerRef.current?.abort();
    audioAbortControllerRef.current = null;
    cachedAudioChunksRef.current.clear();
    pendingAudioChunksRef.current.clear();

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.ontimeupdate = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.oncanplay = null;
        audioRef.current.oncanplaythrough = null;
      } catch (_) {}
    }
    revokeAudioObjectUrl();

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsPlaying(false);
    setIsPaused(false);
    setIsLoadingAudio(false);
    if (clearNotice) setAudioNotice(null);
    setCurrentChunkIdx(-1);
  };

  // Reset the bounded audio cache when the briefing changes, but do not issue
  // any TTS request during editor navigation. Audio begins only after the user
  // explicitly presses the speaker, preserving responsiveness and user control.
  useEffect(() => {
    if (!dalilBriefing?.text || dalilBriefing.id === cachedBriefingIdRef.current) return;

    cachedBriefingIdRef.current = dalilBriefing.id;
    cachedAudioChunksRef.current.clear();
    pendingAudioChunksRef.current.clear();
    playbackRunIdRef.current += 1;
  }, [dalilBriefing?.id]);

  // Clean up speech synthesis when component unmounts or briefing changes
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, [dalilBriefing?.id]);

  const handleTogglePlay = async () => {
    if (!dalilBriefing?.text || audioChunks.length === 0) return;

    if (isLoadingAudio) {
      stopAllSpeech();
      return;
    }

    if (isPlaying && !isPaused) {
      audioRef.current?.pause();
      setIsPaused(true);
      return;
    }

    if (isPlaying && isPaused) {
      try {
        await audioRef.current?.play();
        setIsPaused(false);
      } catch (resumeError) {
        console.warn("Arabic audio resume failed:", resumeError);
        setAudioNotice("تعذر استئناف الملف الصوتي العربي؛ اضغط زر الصوت لإعادة تشغيله.");
      }
      return;
    }

    stopAllSpeech();
    isStoppedRef.current = false;
    audioAbortControllerRef.current = new AbortController();
    const runId = playbackRunIdRef.current;

    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.muted = false;
    audio.volume = 1;

    // Unlock the media element in the original click gesture. The actual Arabic
    // audio requests happen afterward and remain short enough for serverless limits.
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    try {
      await audio.play();
      audioUnlockedRef.current = true;
      audio.pause();
      audio.currentTime = 0;
    } catch (unlockError) {
      audioUnlockedRef.current = false;
      console.warn("Audio element unlock warning:", unlockError);
    }

    setIsLoadingAudio(true);
    setAudioNotice(null);

    try {
      for (let chunkIndex = 0; chunkIndex < audioChunks.length; chunkIndex += 1) {
        if (isStoppedRef.current || playbackRunIdRef.current !== runId) return;

        const audioData = await fetchAudioChunk(chunkIndex);
        if (!audioData) throw new Error("لم تتوفر بيانات صوتية عربية لهذا الجزء من الإحاطة.");
        if (isStoppedRef.current || playbackRunIdRef.current !== runId) return;

        // Start generating the next chunk as soon as the current one arrives,
        // before media setup and playback consume the available overlap time.
        if (AUDIO_PREFETCH_AHEAD > 0) {
          prefetchAudioWindow(chunkIndex + AUDIO_PREFETCH_AHEAD);
        }

        const objectUrl = audioDataToObjectUrl(audioData);
        audio.src = objectUrl;
        audio.preload = "auto";
        audio.muted = false;
        audio.volume = 1;
        audio.load();
        audio.currentTime = 0;
        setCurrentChunkIdx(chunkIndex);

        const endedPromise = new Promise<void>((resolve, reject) => {
          const finish = () => {
            if (activeChunkResolveRef.current === finish) activeChunkResolveRef.current = null;
            resolve();
          };
          activeChunkResolveRef.current = finish;
          audio.onended = finish;
          audio.onerror = (event) => {
            if (activeChunkResolveRef.current === finish) activeChunkResolveRef.current = null;
            console.warn("Generated Arabic audio chunk playback error:", event);
            reject(new Error("تعذر فك الجزء الصوتي العربي أو تشغيله."));
          };
          audio.onplay = () => {
            setIsPlaying(true);
            setIsPaused(false);
            setAudioNotice(null);
          };
          audio.onpause = () => {
            if (!isStoppedRef.current && audio.currentTime > 0 && !audio.ended) {
              setIsPaused(true);
            }
          };
        });

        if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          await new Promise<void>((resolve, reject) => {
            const onReady = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error("تعذر تجهيز الجزء الصوتي العربي للتشغيل."));
            };
            const cleanup = () => {
              audio.removeEventListener("canplay", onReady);
              audio.removeEventListener("canplaythrough", onReady);
              audio.removeEventListener("error", onError);
            };
            audio.addEventListener("canplay", onReady, { once: true });
            audio.addEventListener("canplaythrough", onReady, { once: true });
            audio.addEventListener("error", onError, { once: true });
          });
        }

        if (isStoppedRef.current || playbackRunIdRef.current !== runId) return;
        await audio.play();
        audioUnlockedRef.current = true;
        setIsPlaying(true);
        setIsPaused(false);

        await endedPromise;
        // Give the media element a clean boundary before the next sentence.
        // Playback never overlaps; this pause also prevents the final word of
        // one generated segment from being perceived with the next segment.
        if (audioChunks[chunkIndex]?.sentenceEnd && !isStoppedRef.current) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 90));
        }
      }

      if (!isStoppedRef.current && playbackRunIdRef.current === runId) {
        stopAllSpeech(false);
      }
    } catch (playbackError) {
      console.warn("Chunked Arabic audio playback failed:", playbackError);
      if (!isStoppedRef.current && playbackRunIdRef.current === runId) {
        stopAllSpeech(false);
        setAudioNotice(playbackError instanceof Error ? playbackError.message : "تعذر تشغيل الصوت العربي حالياً.");
      }
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleExportMSW = () => {
    if (!dalilBriefing?.text) return;
    const cleanDocText = normalizeDalilParagraphFlow(cleanDalilDisplayText(dalilBriefing.text));
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
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg text-white tracking-wide leading-tight">الرفيق البحثي الموثوق | bahthOS</span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 bg-teal-500/30 text-teal-200 text-[9px] px-1.5 py-0.5 rounded-full border border-teal-400/30 animate-pulse whitespace-nowrap">
                  <Radio className="w-2.5 h-2.5 text-teal-300" />
                  <span>يتلو الآن</span>
                </span>
              )}
            </div>
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

      {dalilError && !isDalilGenerating && (
        <div className="mb-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900" role="alert">
          <div>{dalilError}</div>
          {onTriggerDalilBriefing && (
            <button
              onClick={onTriggerDalilBriefing}
              className="mt-1.5 rounded-lg bg-amber-200 px-2.5 py-1 text-[10px] font-extrabold text-amber-950 hover:bg-amber-300"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      )}

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
            className={`text-sm leading-8 text-[#173d3b] font-medium whitespace-normal bg-white p-4 rounded-2xl border border-[#d7e8e1] shadow-inner shadow-[#073f40]/10 overflow-y-auto transition-all ${
              compact ? "max-h-48" : "max-h-64"
            } ${!isExpanded ? "max-h-16 overflow-hidden relative cursor-pointer" : ""}`}
            onClick={() => !isExpanded && setIsExpanded(true)}
            style={{ scrollbarWidth: "thin", scrollbarColor: "#80aaa0 #e4efeb" }}
            id="dalil-text-content-box"
          >
            <div className="space-y-2.5">
              {displayParagraphs.map((paragraph, paragraphIndex) => {
                const activeChunk = audioChunks[currentChunkIdx];
                const isCurrentlyBeingRead = activeChunk?.paragraphIndex === paragraphIndex;
                const isHeading = paragraph.startsWith("نَسْتَعْرِضُ") || paragraph.startsWith("تَعْتَمِدُ") || paragraphIndex === 0;
                const activeStart = isCurrentlyBeingRead ? activeChunk.startOffset : -1;
                const activeEnd = isCurrentlyBeingRead ? activeChunk.endOffset : -1;
                const renderedParagraph = activeStart >= 0 && activeEnd > activeStart ? (
                  <>
                    {paragraph.slice(0, activeStart)}
                    <span className="rounded bg-[#d9a441]/35 px-0.5 text-inherit ring-1 ring-[#d9a441]/50">
                      {paragraph.slice(activeStart, activeEnd)}
                    </span>
                    {paragraph.slice(activeEnd)}
                  </>
                ) : paragraph;
                return (
                  <p
                    key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}
                    className={`transition-all duration-200 ${
                      isCurrentlyBeingRead
                        ? "bg-[#0d6662] text-white p-2.5 rounded-xl font-bold border border-[#d9a441]/70 shadow-sm"
                        : isHeading
                        ? "text-[#0b5b59] font-bold border-r-2 border-[#d19a3b] pr-3 my-1"
                        : "text-[#173d3b] leading-8"
                    }`}
                  >
                    {renderedParagraph}
                  </p>
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
            أهلاً بك. أنا <strong className="text-white font-bold">الرفيق البحثي الموثوق</strong> داخل bahthOS. أستخرج لك بدقة تحليلاً موجزاً عما تغيّر ولماذا، استناداً حصراً إلى نصوص مصادرك.
          </p>
          {onTriggerDalilBriefing && (
            <button
              onClick={onTriggerDalilBriefing}
              className="w-full py-1.5 px-3 bg-teal-500 hover:bg-teal-400 text-teal-950 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              id="dalil-initial-request-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-950" />
              <span>طلب إحاطة أولية</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}


