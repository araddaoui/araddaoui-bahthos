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
  let lastError: any = null;
  // Try a few common voices if the primary one fails
  const voices = [voiceName || "Aoede", "Kore", "Puck", "Charon"];

  for (const voice of voices) {
    try {
      console.log(`[TTS] Attempting synthesis with model: ${model}, voice: ${voice}`);
      const interaction = await ai.interactions.create({
        model,
        input: `اقرأ النص التالي بصوت عربي فصيح وواضح، مع وقفات طبيعية بين الجمل:\n\n${text}`,
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice }],
        },
      });

      const outputAudio = interaction?.output_audio;
      if (outputAudio?.data) {
        console.log(`[TTS] Successfully generated audio using ${model}/${voice}`);
        return packageAudio(
          outputAudio.data,
          outputAudio.mime_type || "audio/l16",
          outputAudio.sample_rate || 24000,
        );
      }
      console.warn(`[TTS] Model ${model} with voice ${voice} returned no audio data.`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[TTS] Attempt failed for ${model}/${voice}:`, err.message || err);
      // If it's a 429 or 503, maybe wait a bit?
      if (err.status === 429 || err.status === 503) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error(`تعذر توليد الصوت العربي باستخدام النموذج ${model}.`);
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
    // Both are documented Gemini TTS models. The faster 2.5 model is preferred
    // for short sequential chunks; 3.1 remains a compatible fallback.
    const candidateModels = [
      "gemini-2.5-flash-preview-tts",
      "gemini-3.1-flash-tts-preview",
    ];
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

    return res.status(502).json({
      error: "خدمة الصوت العربية غير متاحة حالياً.",
      details: lastError?.message || "لم يُرجع أي نموذج ملفاً صوتياً قابلاً للتشغيل.",
    });
  } catch (error: any) {
    console.warn("Gemini TTS synthesis failed:", error?.message || error);
    return res.status(502).json({
      error: "خدمة الصوت العربية غير متاحة حالياً.",
      details: error?.message || "Gemini TTS unavailable",
    });
  }
});

export default router;
