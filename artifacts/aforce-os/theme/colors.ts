// AForce OS Color System — AForce Brand System
// Cinematic near-black canvas (#0D0D0D), signal-red hero accent, near-invisible borders.

export const Colors = {
  background: {
    primary: '#0D0D0D',
    secondary: '#050508',
    card: '#0A0A0F',
    elevated: '#101018',
    surface: '#141420',
    overlay: 'rgba(0,0,0,0.92)',
  },

  gradient: {
    background: ['#0D0D0D', '#050510', '#0D0D0D'],
    backgroundAngle: 160,
    header: ['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.0)'],
    card: ['#0A0A0F', '#101018'],
  },

  accent: {
    primary: '#C1281B',
    glow: 'rgba(193,40,27,0.50)',
    dim: 'rgba(193,40,27,0.12)',
    subtle: 'rgba(193,40,27,0.06)',
    secondary: '#1E5BFF',
    // AForce signal red — hero accent for the Home dashboard (readiness
    // eyebrow, ritual rail, streak, athlete + membership cards and the active
    // tab tint). Deliberately distinct from the DEPLETED state red (#FF2800);
    // use sparingly as thin lines / labels so the hydration state-color engine
    // still reads clearly.
    brand: '#C1281B',
    brandGlow: 'rgba(193,40,27,0.45)',
    brandDim: 'rgba(193,40,27,0.12)',
    brandSubtle: 'rgba(193,40,27,0.06)',
  },

  states: {
    PEAK: {
      primary: '#1FA35A',
      glow: 'rgba(31,163,90,0.50)',
      dim: 'rgba(31,163,90,0.12)',
      text: '#1FA35A',
    },
    BALANCED: {
      primary: '#00E5C8',
      glow: 'rgba(0,229,200,0.40)',
      dim: 'rgba(0,229,200,0.12)',
      text: '#00E5C8',
    },
    RECOVERING: {
      primary: '#FFA01E',
      glow: 'rgba(255,160,30,0.40)',
      dim: 'rgba(255,160,30,0.12)',
      text: '#FFA01E',
    },
    DEPLETED: {
      primary: '#FF2800',
      glow: 'rgba(255,40,0,0.40)',
      dim: 'rgba(255,40,0,0.12)',
      text: '#FF2800',
    },
  },

  guardian: {
    primary: '#8B5CF6',
    glow: 'rgba(139,92,246,0.40)',
    dim: 'rgba(139,92,246,0.12)',
  },
  clutch: {
    primary: '#00E5C8',
    glow: 'rgba(0,229,200,0.40)',
    dim: 'rgba(0,229,200,0.12)',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.55)',
    muted: 'rgba(255,255,255,0.30)',
    ghost: 'rgba(255,255,255,0.18)',
    inverse: '#000000',
  },

  border: {
    subtle: 'rgba(255,255,255,0.04)',
    medium: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.14)',
    accent: 'rgba(193,40,27,0.20)',
  },

  fill: {
    light: 'rgba(255,255,255,0.02)',
    medium: 'rgba(255,255,255,0.05)',
    strong: 'rgba(255,255,255,0.10)',
  },

  success: '#1FA35A',
  warning: '#FFA01E',
  danger: '#FF2800',
  info: '#1E5BFF',

  tabBar: {
    background: 'rgba(0,0,0,0.95)',
    active: '#C1281B',
    inactive: 'rgba(255,255,255,0.30)',
  },
} as const;

export type StateKey = keyof typeof Colors.states;

export function getStateColors(state: StateKey) {
  return Colors.states[state];
}
