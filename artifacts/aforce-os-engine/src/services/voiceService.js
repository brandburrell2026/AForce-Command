import fetch from "node-fetch";
import { ENV, getVoiceId } from "../config/env.js";
import { openAiTtsFallback } from "./openAiTtsFallback.js";

export function addCoachPauses(text) {
  const actionWords = [
    "Take",
    "Drink",
    "Open",
    "Mix",
    "Recheck",
    "Wait",
    "Start",
    "Follow"
  ];

  let updatedText = text;

  for (const word of actionWords) {
    updatedText = updatedText.replace(
      new RegExp(`\\b${word}\\b`, "g"),
      `[break time="0.4s"] ${word}`
    );
  }

  return updatedText;
}

export async function speakCommand(text, voiceStyle = "commander") {
  const voiceId = getVoiceId(voiceStyle);
  const preparedText = addCoachPauses(text);

  try {
    if (!ENV.elevenLabsApiKey || !voiceId) {
      throw new Error("ElevenLabs credentials missing");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ENV.elevenLabsApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model_id: "eleven_monolingual_v1",
          text: preparedText,
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs failed: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.warn("ElevenLabs unavailable. Falling back to OpenAI TTS.");
    return openAiTtsFallback(text);
  }
}
