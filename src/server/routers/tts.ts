import { Router } from "express";
import { getAiClient } from "../ai.js";
import { pcmToWav } from "../audio.js";

const router = Router();

type GeneratedAudio = {
  audio: string;
  mimeType: string;
};

function packageAudio(rawData: string, rawMimeType = "audio/l16", sampleRate = 24000): GeneratedAudio {
  const normalizedMime = rawMimeType.toLowerCase();
  let finalAudioBase64 = rawData;
  let finalMimeType = rawMimeType || "audio/l16";

  // Gemini TTS returns base64 PCM/L16 for the supported audio models. Browsers
  // need a container, so package it as a standard mono 24 kHz WAV file.
  if (
    normalizedMime.includes("pcm") ||
    normalizedMime.includes("l16") ||
    normalizedMime.includes("raw") ||
    normalizedMime === "audio/audio"
  ) {
    const pcmBuffer = Buffer.from(rawData, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, sampleRate || 24000);
    finalAudioBase64 = wavBuffer.toString("base64");
    finalMimeType = "audio/wav";
  }

  return { audio: finalAudioBase64, mimeType: finalMimeType || "audio/wav" };
}

async function generateInteractionAudio(
  ai: any,
  model: string,
  text: string,
  voiceName: string,
): Promise<GeneratedAudio> {
  const voice = voiceName || "Kore";
  console.log(`[TTS] Attempting one bounded synthesis with model: ${model}, voice: ${voice}`);

  const interaction = await ai.interactions.create({
    model,
    input: `اقرأ النص التالي بصوت عربي فصيح وواضح، مع وقفات طبيعية بين الجمل:\n\n${text}`,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice }],
    },
  });

  const outputAudio = interaction?.output_audio;
  if (!outputAudio?.data) {
    throw new Error(`لم يُرجع نموذج الصوت ${model} بيانات صوتية.`);
  }

  console.log(`[TTS] Successfully generated audio using ${model}/${voice}`);
  return packageAudio(
    outputAudio.data,
    outputAudio.mime_type || "audio/l16",
    outputAudio.sample_rate || 24000,
  );
}

router.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "No text provided for speech synthesis." });
    }

    const cleanSegment = text
      .replace(/[#*`_~\[\]()]/g, "")
      .replace(/\|\|/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!cleanSegment) {
      return res.status(400).json({ error: "Text is empty after cleaning." });
    }

    const ai = getAiClient();
    // Keep one fast TTS attempt per short chunk. Sequential model and voice
    // fallbacks can consume the entire Vercel function window and surface as a
    // 504 even when the primary voice itself is healthy.
    const candidateModels = ["gemini-2.5-flash-preview-tts"];
    let lastError: any = null;

    for (const ttsModel of candidateModels) {
      try {
        const audio = await generateInteractionAudio(ai, ttsModel, cleanSegment, voiceName);
        return res.json(audio);
      } catch (modelError: any) {
        lastError = modelError;
        console.warn(`Gemini Interactions TTS model ${ttsModel} failed:`, modelError?.message || modelError);
      }
    }

    const errorText = String(lastError?.message || "");
    const quotaExceeded = lastError?.status === 429 || /\b429\b|quota|rate limit|exhausted/i.test(errorText);
    return res.status(quotaExceeded ? 429 : 502).json({
      error: quotaExceeded
        ? "تم بلوغ حصة خدمة الصوت العربية حالياً. انتظر حتى تتجدد الحصة ثم أعد المحاولة."
        : "خدمة الصوت العربية غير متاحة حالياً.",
      quotaExceeded,
      details: errorText || "لم يُرجع نموذج الصوت ملفاً قابلاً للتشغيل.",
    });
  } catch (error: any) {
    console.warn("Gemini TTS synthesis failed:", error?.message || error);
    const errorText = String(error?.message || "");
    const quotaExceeded = error?.status === 429 || /\b429\b|quota|rate limit|exhausted/i.test(errorText);
    return res.status(quotaExceeded ? 429 : 502).json({
      error: quotaExceeded
        ? "تم بلوغ حصة خدمة الصوت العربية حالياً. انتظر حتى تتجدد الحصة ثم أعد المحاولة."
        : "خدمة الصوت العربية غير متاحة حالياً.",
      quotaExceeded,
      details: errorText || "Gemini TTS unavailable",
    });
  }
});

export default router;
