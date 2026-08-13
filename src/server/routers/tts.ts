import { Router } from "express";
import { Modality } from "@google/genai";
import { getAiClient, generateContentWithRetry } from "../ai";
import { pcmToWav } from "../audio";

const router = Router();

router.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Aoede" } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "No text provided for speech synthesis." });
    }

    const cleanSegment = text
      .replace(/[#*`_~\[\]()]/g, "")
      .replace(/\|\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanSegment) {
      return res.status(400).json({ error: "Text is empty after cleaning." });
    }

    const ai = getAiClient();
    const candidateModels = ["gemini-3.1-flash-tts-preview", "gemini-2.0-flash"];
    let lastError: any = null;

    for (const ttsModel of candidateModels) {
      try {
        const response = await generateContentWithRetry(ai, {
          model: ttsModel,
          contents: [{ parts: [{ text: `اقرأ النص التالي بنبرة صوت عربية فصيحة، معبرة، وواضحة جداً:\n\n${cleanSegment}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || "Aoede" },
              },
            },
          },
        });

        const candidate = response?.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        for (const p of parts as any[]) {
          const rawData = p.inlineData?.data || p.inline_data?.data;
          const rawMime = p.inlineData?.mimeType || p.inline_data?.mime_type || "audio/wav";

          if (rawData) {
            let finalAudioBase64 = rawData;
            let finalMimeType = "audio/wav";

            // If Gemini returned raw PCM / L16 audio, package it into a browser-playable WAV header
            if (rawMime.toLowerCase().includes("pcm") || rawMime.toLowerCase().includes("l16") || rawMime.toLowerCase().includes("raw")) {
              let sampleRate = 24000;
              const rateMatch = rawMime.match(/rate=(\d+)/i);
              if (rateMatch && rateMatch[1]) {
                sampleRate = parseInt(rateMatch[1], 10);
              }
              const pcmBuf = Buffer.from(rawData, "base64");
              const wavBuf = pcmToWav(pcmBuf, sampleRate);
              finalAudioBase64 = wavBuf.toString("base64");
            } else if (rawMime) {
              finalMimeType = rawMime;
            }

            return res.json({
              audio: finalAudioBase64,
              mimeType: finalMimeType,
            });
          }
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.warn(`TTS model ${ttsModel} attempt failed:`, mErr?.message || mErr);
      }
    }

    console.warn("All Gemini TTS models unavailable, returning graceful fallback flag.");
    return res.json({ audio: null, fallback: true, error: lastError?.message || "TTS unavailable" });
  } catch (error: any) {
    console.warn("Gemini TTS synthesis fallback:", error?.message || error);
    return res.json({
      audio: null,
      fallback: true,
      error: error?.message || "Gemini TTS unavailable",
    });
  }
});

export default router;
