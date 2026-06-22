// AForce OS Typography System — AForce Brand System
// Bold, tight, data-forward. Hero numbers massive. Labels small + tracked.
//
// Three faces by role:
//   display  → Archivo Black  (big hero wordmarks / numerals)
//   eyebrow  → IBM Plex Mono  (tracked technical labels / metric captions)
//   body     → Inter          (everything else)

export const Typography = {
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    display: 'ArchivoBlack_400Regular',
    mono: 'IBMPlexMono_500Medium',
  },

  // Role tokens — reference these by intent. Existing hardcoded Inter_* call
  // sites are intentionally left untouched; new surfaces should map to a role.
  roles: {
    display: 'ArchivoBlack_400Regular',
    eyebrow: 'IBMPlexMono_500Medium',
    metric: 'IBMPlexMono_600SemiBold',
    mono: 'IBMPlexMono_400Regular',
    body: 'Inter_400Regular',
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
