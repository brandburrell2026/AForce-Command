/**
 * Text-to-Speech adapter.
 *
 * STATUS: AI voice playback is DISABLED per product spec.
 *   AForce OS responds with on-screen prompts only — no audio response.
 *   Voice INPUT (STT) and the visual command-prompt pipeline remain
 *   fully wired; only this output stage is muted.
 *
 * `speak()` / `stopSpeaking()` are kept as no-op stubs so that all
 * existing callsites (VoiceOverlay, command engines, etc.) continue
 * to compile and execute without scattering platform-specific guards
 * throughout the app. Flip the body back on (or set
 * VOICE_PLAYBACK_ENABLED to true) if voice output is ever re-enabled.
 */

export const VOICE_PLAYBACK_ENABLED = false;

/** No-op while voice playback is disabled. See header for rationale. */
export function speak(_text: string): void {
  if (!VOICE_PLAYBACK_ENABLED) return;
  // Implementation removed — see git history if re-enabling.
}

/** No-op while voice playback is disabled. */
export function stopSpeaking(): void {
  if (!VOICE_PLAYBACK_ENABLED) return;
  // Implementation removed — see git history if re-enabling.
}
