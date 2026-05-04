// AForce OS Color System — WHOOP-Cinematic Edition
// Pure black canvas, WHOOP lime hero accent, near-invisible borders.

export const Colors = {
  background: {
    primary: '#000000',
    secondary: '#050508',
    card: '#0A0A0F',
    elevated: '#101018',
    surface: '#141420',
    overlay: 'rgba(0,0,0,0.92)',
  },

  gradient: {
    background: ['#000000', '#050510', '#000000'],
    backgroundAngle: 160,
    header: ['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.0)'],
    card: ['#0A0A0F', '#101018'],
  },

  accent: {
    primary: '#B6FF00',
    glow: 'rgba(182,255,0,0.50)',
    dim: 'rgba(182,255,0,0.12)',
    subtle: 'rgba(182,255,0,0.06)',
    secondary: '#0093E7',
  },

  states: {
    PEAK: {
      primary: '#B6FF00',
      glow: 'rgba(182,255,0,0.50)',
      dim: 'rgba(182,255,0,0.12)',
      text: '#B6FF00',
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
      primary: '#FF0026',
      glow: 'rgba(255,0,38,0.40)',
      dim: 'rgba(255,0,38,0.12)',
      text: '#FF0026',
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
    accent: 'rgba(182,255,0,0.20)',
  },

  fill: {
    light: 'rgba(255,255,255,0.02)',
    medium: 'rgba(255,255,255,0.05)',
    strong: 'rgba(255,255,255,0.10)',
  },

  success: '#B6FF00',
  warning: '#FFA01E',
  danger: '#FF0026',
  info: '#0093E7',

  tabBar: {
    background: 'rgba(0,0,0,0.95)',
    active: '#B6FF00',
    inactive: 'rgba(255,255,255,0.30)',
  },
} as const;

export type StateKey = keyof typeof Colors.states;

export function getStateColors(state: StateKey) {
  return Colors.states[state];
}
