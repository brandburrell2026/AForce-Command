/**
 * Mock AI Coaching Video Library.
 *
 * In production this would be served by /v1/videos and CDN-backed.
 * For demo, scenes are rendered client-side (zero buffering).
 */

import type { VideoConfig } from '../types/video';

export const VIDEO_LIBRARY: Record<string, VideoConfig> = {
  hydration_action_01: {
    videoId: 'hydration_action_01',
    videoCategory: 'hydration_action',
    commandType: 'hydration_maintain',
    protocol: 'maintenance',
    scene: 'water_stream',
    videoUrl: '/videos/hydration_action_01.mp4',
    durationSec: 8,
    overlayTitle: 'HYDRATE NOW',
    overlaySubtitle: 'Start with water — 16 ounces.',
    themeLevel: 'BALANCED',
  },
  hydration_action_02: {
    videoId: 'hydration_action_02',
    videoCategory: 'hydration_action',
    commandType: 'hydration_urgent',
    protocol: 'recovery',
    scene: 'water_stream',
    videoUrl: '/videos/hydration_action_02.mp4',
    durationSec: 8,
    overlayTitle: 'CLOSE THE GAP',
    overlaySubtitle: 'Recover deficit. 12 ounces now.',
    themeLevel: 'RECOVERING',
  },
  recovery_reset_01: {
    videoId: 'recovery_reset_01',
    videoCategory: 'recovery',
    commandType: 'recovery_reset',
    protocol: 'recovery',
    scene: 'breath_ring',
    videoUrl: '/videos/recovery_reset_01.mp4',
    durationSec: 12,
    overlayTitle: 'RESET',
    overlaySubtitle: 'Breathe in 4 · hold 2 · out 6',
    themeLevel: 'RECOVERING',
  },
  activation_01: {
    videoId: 'activation_01',
    videoCategory: 'activation',
    commandType: 'performance_activation',
    protocol: 'maintenance',
    scene: 'pulse_build',
    videoUrl: '/videos/activation_01.mp4',
    durationSec: 10,
    overlayTitle: 'GO TIME',
    overlaySubtitle: 'Hold the line — you are at peak.',
    themeLevel: 'PEAK',
  },
  depletion_emergency_01: {
    videoId: 'depletion_emergency_01',
    videoCategory: 'depletion_emergency',
    commandType: 'hydration_urgent',
    protocol: 'depletion_correction',
    scene: 'red_alert',
    videoUrl: '/videos/depletion_emergency_01.mp4',
    durationSec: 6,
    overlayTitle: 'START WITH WATER',
    overlaySubtitle: '20 oz of water. Recheck in 15 minutes.',
    themeLevel: 'DEPLETED',
  },
  morning_reset_01: {
    videoId: 'morning_reset_01',
    videoCategory: 'morning_reset',
    commandType: 'morning_reset',
    protocol: 'morning_reset',
    scene: 'sunrise_sweep',
    videoUrl: '/videos/morning_reset_01.mp4',
    durationSec: 8,
    overlayTitle: 'FIRST MOVE',
    overlaySubtitle: 'Reset the system. 16 ounces + 1 stick.',
    themeLevel: 'BALANCED',
  },
};

export function getVideoById(id: string): VideoConfig | null {
  return VIDEO_LIBRARY[id] ?? null;
}

/** Ordered fallback list — used if mapping fails to match. */
export const FALLBACK_VIDEO_ID = 'hydration_action_01';
