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
    // RC-1 verdict-pass correction (Wave-1 r2, item 7): the #530 AA pass
    // below fixed muted/ghost but left `secondary` at its pre-existing .55,
    // only .03 above the newly-raised `muted` (.52) — white-on-near-black
    // alpha blends to a near-identical resulting color across every
    // background in this file (#0D0D0D/#050508/#0A0A0F/#101018/#141420 all
    // sit within a few luminance steps of pure black), so at that small an
    // alpha gap the two are perceptually one color, collapsing the intended
    // secondary/muted/ghost three-tier emphasis ladder to two tiers. Raised
    // to .66 to restore clear separation AND improve its own ratio (flat-bg
    // range, all 5 backgrounds, continuous WCAG relative-luminance math,
    // same formula as theme/__tests__/afTokens.test.ts):
    //   secondary .55 -> 6.14-6.26:1   (old)
    //   secondary .66 -> 8.36-8.77:1   (new — clear gap above muted below)
    //   muted     .52 -> 5.62-5.69:1   (unchanged)
    //   ghost     .48 -> 4.95-5.00:1   (see below — also changed this pass)
    // Worst-case gap secondary-to-muted is now 2.67 (min 8.36 vs max 5.69,
    // min-vs-max like the 0.45 figure below), up from
    // an effectively-invisible 0.45 (6.14 - 5.69) at the old .55 — the three
    // tiers now read as three tiers again, not two.
    secondary: 'rgba(255,255,255,0.66)',
    // muted/ghost were WCAG AA failures (RC-1 audit): white-on-black alpha
    // blends to a near-identical resulting color across every background in
    // this file (#0D0D0D/#050508/#0A0A0F/#101018/#141420 all sit within a few
    // luminance steps of pure black), so the alpha value alone determines the
    // contrast ratio. At the old .30, worst case (background.secondary
    // #050508) measured 2.53:1; at .18, ghost measured 1.59:1 — both far
    // under the 4.5:1 AA floor for body-weight text. Minimum alpha for 4.5:1
    // across all five backgrounds is ~.45; bumped past that with a safety
    // margin (rendering/anti-aliasing variance) while keeping muted below
    // `secondary` (now .66) and ghost below `muted`, preserving the emphasis
    // ladder:
    //   muted     .52 -> 5.62-5.69:1   (was .30 -> 2.53-2.69:1)
    //   ghost     .48 -> 4.95-5.00:1   (was .18 -> 1.59-1.67:1; see below re: .46 -> .48)
    // Same precedent as the af.textTertiary bump in afTokens.ts:50-52 —
    // a11y over the exact prior value. Visual-QA note: secondary/muted-role
    // text app-wide reads slightly brighter as a result; see PR body.
    //
    // RC-1 verdict-pass correction (Wave-1 r2, item 7): ghost's flat-background
    // numbers (4.62-4.68:1 at .46 — corrected r3: the 4.50-4.62 figure
    // inherited from the first bump was not reproducible) cleared AA on a
    // bare background, but
    // ghost is also used on raised/interactive surfaces painted with a
    // translucent white fill on top — e.g. `surface` (#141420) + `fill.medium`
    // (rgba(255,255,255,0.05)) — and text sits on the RESULT of that
    // composite, not the bare surface underneath. Composite math (fill.medium
    // painted over surface first, producing an effective background of
    // rgb(31.75, 31.75, 43.15), then ghost's own alpha painted on top of
    // THAT):
    //   ghost .46 vs surface+fill.medium composite -> 4.49:1  (FAILS — hair under the 4.5:1 floor)
    //   ghost .48 vs surface+fill.medium composite -> 4.76:1  (clears AA with margin)
    // Bumped ghost .46 -> .48 to close that gap; still comfortably below
    // `muted` (.52) on every flat background (4.95-5.00:1 vs 5.62-5.69:1),
    // so the emphasis ladder is preserved on top of being AA-clean on both
    // bare and filled surfaces.
    muted: 'rgba(255,255,255,0.52)',
    ghost: 'rgba(255,255,255,0.48)',
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

  // Brand neutral — warm off-white ("bone") for tracked technical eyebrows
  // on the cinematic black canvas. Softer than pure #FFFFFF.
  bone: '#F5F0E8',

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
