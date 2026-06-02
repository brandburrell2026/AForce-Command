/**
 * videoCoachVoice — pure narrative builder for the AIVideoPlayer
 * full-screen overlay.
 *
 * The expanded "AI COACH" modal renders four pieces of content:
 *   • overlayTitle      (e.g. "CORRECT NOW")
 *   • overlaySubtitle   (e.g. "AForce Stick + 20 oz. Immediate.")
 *   • command.action    (e.g. "Drink 20 oz of water and take 1 AForce RTD…")
 *   • command.explanation (the recovery-window context line)
 *
 * When the user opens the overlay, we want the AI Coach to speak the
 * same content the user can see — in priority order — so the spoken
 * line is always in sync with the rendered card and never repeats
 * itself (a `CORRECT NOW. CORRECT NOW.` style stutter would happen if
 * we naïvely concatenated overlay + command.action when the action
 * already contains the same phrase).
 */

import type { VideoConfig } from '../types/video';
import type { Command } from '../types';

/** Strip leading/trailing whitespace and collapse internal whitespace runs. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Ensure each spoken sentence ends with terminal punctuation so TTS pauses. */
function withPeriod(s: string): string {
  if (!s) return s;
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

/** Strip trailing terminal punctuation so prefix comparisons line up. */
function stripTerminal(s: string): string {
  return s.replace(/[.!?…]+$/, '');
}

/**
 * Build the spoken line for an AI Coach overlay. Returns an empty
 * string when there is nothing meaningful to say (defensive — the
 * caller can then skip the speak() call entirely).
 */
export function buildVideoCoachLine(
  video: Pick<VideoConfig, 'overlayTitle' | 'overlaySubtitle'>,
  command: Pick<Command, 'action' | 'explanation'>,
): string {
  const title = normalize(video.overlayTitle ?? '');
  const subtitle = normalize(video.overlaySubtitle ?? '');
  const action = normalize(command.action ?? '');
  const explanation = normalize(command.explanation ?? '');

  const parts: string[] = [];
  if (title) parts.push(withPeriod(title));
  // Skip subtitle if it is already the leading clause of the action
  // (avoids "AForce Stick + 20 oz. AForce Stick + 20 oz. Drink…").
  // Strip trailing terminal punctuation from both sides so e.g.
  // subtitle "Recover deficit. 12 oz now." still matches an action
  // starting "Recover deficit. 12 oz now and recheck…".
  const subtitleStem = stripTerminal(subtitle).toLowerCase();
  if (subtitle && (!subtitleStem || !action.toLowerCase().startsWith(subtitleStem))) {
    parts.push(withPeriod(subtitle));
  }
  if (action) parts.push(withPeriod(action));
  if (explanation) parts.push(withPeriod(explanation));

  return parts.join(' ');
}
