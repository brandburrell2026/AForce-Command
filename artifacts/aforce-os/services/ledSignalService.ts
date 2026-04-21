/**
 * LED signal service — translates performance state into the LED pattern the
 * Phantom Band should display. Pure / synchronous so it can be called from
 * render and from event handlers without coordination.
 */

import type { PerformanceLevel } from '../types';
import type { LedPattern } from '../types/hardware';

const LED_BY_LEVEL: Record<PerformanceLevel, LedPattern> = {
  PEAK: {
    color: 'peak',
    shape: 'steady',
    hex: '#E8F0FF', // platinum/silver
    periodMs: 0,
  },
  BALANCED: {
    color: 'balanced',
    shape: 'steady',
    hex: '#00E5C8', // teal
    periodMs: 0,
  },
  RECOVERING: {
    color: 'recovering',
    shape: 'slow_pulse',
    hex: '#F5A623', // amber
    periodMs: 1600,
  },
  DEPLETED: {
    color: 'depleted',
    shape: 'fast_pulse',
    hex: '#FF4D4D', // red
    periodMs: 600,
  },
};

const URGENT_LED: LedPattern = {
  color: 'depleted',
  shape: 'urgent',
  hex: '#FF1F4B',
  periodMs: 300,
};

const OFF_LED: LedPattern = {
  color: 'off',
  shape: 'steady',
  hex: '#3A3F44',
  periodMs: 0,
};

export function ledForLevel(level: PerformanceLevel | null): LedPattern {
  if (!level) return OFF_LED;
  return LED_BY_LEVEL[level];
}

export function ledForCriticalHeat(): LedPattern {
  return URGENT_LED;
}

export function ledOff(): LedPattern {
  return OFF_LED;
}

/** UI-friendly label for the current pattern. */
export function ledLabel(pattern: LedPattern): string {
  switch (pattern.color) {
    case 'peak':       return 'Steady silver';
    case 'balanced':   return 'Steady teal';
    case 'recovering': return 'Slow amber pulse';
    case 'depleted':   return pattern.shape === 'urgent' ? 'Urgent red pulse' : 'Fast red pulse';
    case 'off':        return 'Off';
    default:           return 'Off';
  }
}
