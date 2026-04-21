/**
 * AI Coaching Video — type contracts.
 *
 * Videos are NOT generic content. They are visual executions of an AForce
 * command, mapped from real-time performance state. Every video is tied to:
 *   state + score + protocol + commandType
 *
 * Implementation note: in this build, "videos" are short cinematic Reanimated
 * scenes (no MP4s, no buffering, instant load). The contract still mirrors a
 * real video pipeline so we can swap in mp4s, AI-generated avatars, or
 * personalized renders in the future without changing consumers.
 */

import type { PerformanceLevel } from './index';

export type VideoCategory =
  | 'hydration_action'
  | 'recovery'
  | 'activation'
  | 'depletion_emergency'
  | 'morning_reset';

export type VideoCommandType =
  | 'hydration_urgent'
  | 'hydration_maintain'
  | 'recovery_reset'
  | 'performance_activation'
  | 'morning_reset';

export type VideoProtocol =
  | 'maintenance'
  | 'recovery'
  | 'depletion_correction'
  | 'heat_stress'
  | 'morning_reset';

/** Visual scene renderer key. AIVideoPlayer maps this → animated component. */
export type VideoSceneKind =
  | 'water_stream'        // glowing droplet stream into a vessel
  | 'breath_ring'         // expanding/contracting breath ring
  | 'pulse_build'         // rising bars + pulse build-up
  | 'red_alert'           // urgent red flashing reset
  | 'sunrise_sweep';      // morning gradient sweep

export interface VideoConfig {
  videoId: string;
  videoCategory: VideoCategory;
  commandType: VideoCommandType;
  protocol: VideoProtocol;
  /** Scene renderer used by AIVideoPlayer (this build: animated). */
  scene: VideoSceneKind;
  /** Future: real mp4 url. Optional — never required by AIVideoPlayer today. */
  videoUrl?: string;
  /** Suggested duration in seconds (5–20 per spec). */
  durationSec: number;
  /** Bold short overlay text (one or two words). */
  overlayTitle: string;
  /** Secondary overlay text — the action cue. */
  overlaySubtitle: string;
  /** Color theme key derived from performance level. */
  themeLevel: PerformanceLevel;
}

export interface VideoTriggerInput {
  state: PerformanceLevel;
  score: number;
  protocol: VideoProtocol;
  commandType: VideoCommandType;
  /** Optional: trigger source for analytics / future preloading. */
  source?:
    | 'app_open'
    | 'score_drop'
    | 'protocol_change'
    | 'intake_logged'
    | 'depletion_entered'
    | 'morning_reset'
    | 'manual';
}

/**
 * Future extension point — placeholder structure for AI-generated personalized
 * videos. Not implemented; consumers should ignore unknown fields.
 */
export interface AIPersonalizedVideoSpec {
  enabled: false;
  avatarId?: string;
  voiceId?: string;
  sport?: string;
  realtimeRender?: boolean;
}
