import fetch from "node-fetch";
import { ENV } from "../config/env.js";

export async function openAiTtsFallback(text) {
  if (!ENV.openAiApiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: ENV.openAiTtsVoice,
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.status}`);
  }

  return response.arrayBuffer();
}
