import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  commanderVoiceId: process.env.ELEVENLABS_VOICE_COMMANDER,
  mentorVoiceId: process.env.ELEVENLABS_VOICE_MENTOR,
  systemVoiceId: process.env.ELEVENLABS_VOICE_SYSTEM,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiTtsVoice: process.env.OPENAI_TTS_VOICE || "alloy"
};

export function getVoiceId(style = "commander") {
  const voices = {
    commander: ENV.commanderVoiceId,
    mentor: ENV.mentorVoiceId,
    system: ENV.systemVoiceId
  };

  return voices[style] || voices.commander;
}
