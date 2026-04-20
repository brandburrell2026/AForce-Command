// AForce OS Color System
// Dark navy to deep purple gradient aesthetic
// Premium performance command UI

export const Colors = {
  // Base backgrounds
  background: {
    primary: '#050A1A',    // Deep space navy
    secondary: '#0A0F24',  // Dark navy
    card: '#0D1530',       // Card surface
    elevated: '#12193A',   // Elevated surface
    overlay: 'rgba(5,10,26,0.92)',
  },

  // Gradient stops
  gradient: {
    background: ['#050A1A', '#0E0B2E', '#050A1A'],
    backgroundAngle: 160,
    header: ['rgba(5,10,26,0.95)', 'rgba(14,11,46,0.0)'],
    card: ['#0D1530', '#0F1840'],
  },

  // Performance state accents
  states: {
    PEAK: {
      primary: '#AAFF00',      // Neon lime
      glow: '#AAFF0066',
      dim: '#AAFF0022',
      text: '#AAFF00',
    },
    BALANCED: {
      primary: '#00D4B8',      // Teal
      glow: '#00D4B866',
      dim: '#00D4B822',
      text: '#00D4B8',
    },
    RECOVERING: {
      primary: '#FFB800',      // Amber
      glow: '#FFB80066',
      dim: '#FFB80022',
      text: '#FFB800',
    },
    DEPLETED: {
      primary: '#FF3B5C',      // Red
      glow: '#FF3B5C66',
      dim: '#FF3B5C22',
      text: '#FF3B5C',
    },
  },

  // Typography
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.65)',
    muted: 'rgba(255,255,255,0.35)',
    inverse: '#050A1A',
  },

  // UI elements
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    medium: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.2)',
  },

  // Fills
  fill: {
    light: 'rgba(255,255,255,0.05)',
    medium: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.12)',
  },

  // Semantic
  success: '#AAFF00',
  warning: '#FFB800',
  danger: '#FF3B5C',
  info: '#00D4B8',

  // Tab bar
  tabBar: {
    background: 'rgba(5,10,26,0.95)',
    active: '#AAFF00',
    inactive: 'rgba(255,255,255,0.35)',
  },
} as const;

export type StateKey = keyof typeof Colors.states;

export function getStateColors(state: StateKey) {
  return Colors.states[state];
}
