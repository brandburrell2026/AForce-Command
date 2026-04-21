// AForce OS Color System
// Investor-grade premium dark performance OS palette.

export const Colors = {
  // Base backgrounds — deep black + charcoal panels per spec
  background: {
    primary: '#050510',     // Deep black
    secondary: '#08081A',   // Slightly elevated black
    card: '#0D0D20',        // Charcoal panel
    elevated: '#13132B',    // Elevated panel
    overlay: 'rgba(5,5,16,0.92)',
  },

  // Gradient stops
  gradient: {
    background: ['#050510', '#0A0A1E', '#050510'],
    backgroundAngle: 160,
    header: ['rgba(5,5,16,0.95)', 'rgba(13,13,32,0.0)'],
    card: ['#0D0D20', '#13132B'],
  },

  // Performance state accents
  states: {
    PEAK: {
      primary: '#B4FF50',      // Lime
      glow: '#B4FF5066',
      dim: '#B4FF5022',
      text: '#B4FF50',
    },
    BALANCED: {
      primary: '#00E5C8',      // Teal/cyan
      glow: '#00E5C866',
      dim: '#00E5C822',
      text: '#00E5C8',
    },
    RECOVERING: {
      primary: '#FFA01E',      // Amber
      glow: '#FFA01E66',
      dim: '#FFA01E22',
      text: '#FFA01E',
    },
    DEPLETED: {
      primary: '#FF2D55',      // Red
      glow: '#FF2D5566',
      dim: '#FF2D5522',
      text: '#FF2D55',
    },
  },

  // Phase-specific accents
  guardian: {
    primary: '#8B5CF6',
    glow: '#8B5CF666',
    dim: '#8B5CF622',
  },
  clutch: {
    primary: '#00E5C8',
    glow: '#00E5C866',
    dim: '#00E5C822',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.65)',
    muted: 'rgba(255,255,255,0.40)',
    inverse: '#050510',
  },

  border: {
    subtle: 'rgba(255,255,255,0.06)',
    medium: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.22)',
  },

  fill: {
    light: 'rgba(255,255,255,0.04)',
    medium: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.14)',
  },

  success: '#B4FF50',
  warning: '#FFA01E',
  danger: '#FF2D55',
  info: '#00E5C8',

  tabBar: {
    background: 'rgba(5,5,16,0.95)',
    active: '#B4FF50',
    inactive: 'rgba(255,255,255,0.40)',
  },
} as const;

export type StateKey = keyof typeof Colors.states;

export function getStateColors(state: StateKey) {
  return Colors.states[state];
}
