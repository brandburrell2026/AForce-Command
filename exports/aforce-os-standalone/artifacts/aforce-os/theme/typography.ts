// AForce OS Typography System — WHOOP-Cinematic Edition
// Bold, tight, data-forward. Hero numbers massive. Labels small + tracked.

export const Typography = {
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  sizes: {
    '2xs': 9,
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 36,
    '4xl': 48,
    '5xl': 64,
    '6xl': 80,
  },

  lineHeights: {
    tight: 1.0,
    snug: 1.15,
    normal: 1.4,
    relaxed: 1.6,
  },

  letterSpacing: {
    tighter: -1.5,
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
    ultra: 3,
  },
} as const;
