# AForce OS — Design Token Spec for Figma

**Source of truth: this document is generated from the live React Native code in `artifacts/aforce-os/theme/` + `artifacts/aforce-os/constants/` + `artifacts/aforce-os/data/healthProviders.ts`. If a token here disagrees with the app, the app wins — re-export.**

Use this to set up Figma **Variables** (Local Variables panel → Create collection → paste hex values + numbers). Once your Figma file mirrors this spec, anything you design will translate cleanly back to the codebase.

---

## 0. How to import into Figma (5-minute setup)

1. **Variables panel** → New collection → name it `AForce / Color`. Modes: keep just `dark` for now (the app is dark-only).
2. Paste each color group below as a sub-folder using `/` in the variable name (e.g. `bg/primary`, `state/peak/primary`).
3. Repeat for `AForce / Typography`, `AForce / Spacing`, `AForce / Radius`.
4. Install the **Inter** font family (Google Fonts, free) — every weight from 400 to 700.
5. Build a **Text Styles** library mapping each (font weight × size × letter-spacing) combo from §2.

---

## 1. Foundations — Backgrounds, Text, Borders

### Background
| Token | Hex | Usage |
|---|---|---|
| `bg/primary` | `#050510` | Page background (deep black) |
| `bg/secondary` | `#08081A` | Slightly elevated surface |
| `bg/card` | `#0D0D20` | Charcoal panel — primary card surface |
| `bg/elevated` | `#13132B` | Elevated panel (modals, sheets) |
| `bg/overlay` | `rgba(5,5,16,0.92)` | Full-screen overlay tint |

### Background — Gradient stops
| Token | Stops | Angle | Usage |
|---|---|---|---|
| `gradient/background` | `#050510 → #0A0A1E → #050510` | 160° | App background |
| `gradient/header` | `rgba(5,5,16,0.95) → rgba(13,13,32,0)` | top → bottom | Header fade |
| `gradient/card` | `#0D0D20 → #13132B` | top-left → bottom-right | Premium card surface |

### Text
| Token | Value | Usage |
|---|---|---|
| `text/primary` | `#FFFFFF` | Headlines, primary content |
| `text/secondary` | `rgba(255,255,255,0.65)` | Subheads, body |
| `text/muted` | `rgba(255,255,255,0.40)` | Labels, captions |
| `text/inverse` | `#050510` | Text on bright accents (e.g. lime CTA) |

### Border
| Token | Value | Usage |
|---|---|---|
| `border/subtle` | `rgba(255,255,255,0.06)` | Dividers within a card |
| `border/medium` | `rgba(255,255,255,0.12)` | Card outlines, default |
| `border/strong` | `rgba(255,255,255,0.22)` | Emphasized outlines |

### Fill (translucent overlays)
| Token | Value | Usage |
|---|---|---|
| `fill/light` | `rgba(255,255,255,0.04)` | Subtle hover / press |
| `fill/medium` | `rgba(255,255,255,0.08)` | Button background |
| `fill/strong` | `rgba(255,255,255,0.14)` | Active state |

---

## 2. Performance State Palette

The four hydration / performance states. Every accent below has a **primary** (solid), a **glow** (tint at 40% alpha for shadows / halos / dim fills), and a **dim** (tint at 13% alpha for subtle backgrounds).

| State | Primary | Glow (40%) | Dim (13%) | Meaning |
|---|---|---|---|---|
| **PEAK** | `#B4FF50` | `#B4FF5066` | `#B4FF5022` | Lime — at peak performance |
| **BALANCED** | `#00E5C8` | `#00E5C866` | `#00E5C822` | Teal — stable / on-track |
| **RECOVERING** | `#FFA01E` | `#FFA01E66` | `#FFA01E22` | Amber — declining, needs intake |
| **DEPLETED** | `#FF2D55` | `#FF2D5566` | `#FF2D5522` | Red — critical, action required |

Suggested Figma variable names: `state/peak/primary`, `state/peak/glow`, `state/peak/dim`, etc.

---

## 3. Score Status Bands (5-band system)

The AI Coach uses a finer 5-band scale that supersedes the 4-state palette in coaching surfaces. **Use this whenever your design is reacting to a numeric score 0–100.**

| Band | Score range | Calm primary | Pressure Mode primary | Glow alpha | Glow radius |
|---|---|---|---|---|---|
| **OPTIMAL** | 85–100 | `#39FF14` (neon green) | `#22FF00` | 32% / 45% | 22 (soft + wide) |
| **STABLE** | 70–84 | `#B4FF50` (brand lime) | `#A0FF20` | 24% / 36% | 14 (subtle) |
| **DECLINING** | 50–69 | `#FFD60A` (amber) | `#FFC000` | 20% / 32% | 10 (minimal) |
| **RISK** | 30–49 | `#FF8C1A` (orange) | `#FF7A00` | 45% / 65% | 14 (medium) |
| **CRITICAL** | 0–29 | `#FF2D55` (red) | `#FF0040` | 70% / 92% | 8 (tight + intense) |

Animation tempo per band (multiplier vs. baseline 1.0):
- OPTIMAL `0.85x` · STABLE `1.0x` · DECLINING `1.15x` · RISK `1.35x` · CRITICAL `1.6x` · all multiplied by **1.4x** in Pressure Mode.

---

## 4. Phase / Product Accents

| Token | Hex | Glow | Dim | Used by |
|---|---|---|---|---|
| `clutch/primary` | `#00E5C8` | `#00E5C866` | `#00E5C822` | Phase 2 — Clutch Access (coach) |
| `guardian/primary` | `#8B5CF6` | `#8B5CF666` | `#8B5CF622` | Phase 3 — Guardian (medical) |

---

## 5. Semantic Aliases

Convenience pointers — same hex as the state palette, surfaced for non-state contexts.

| Token | Hex | Aliased to |
|---|---|---|
| `semantic/success` | `#B4FF50` | PEAK primary |
| `semantic/warning` | `#FFA01E` | RECOVERING primary |
| `semantic/danger` | `#FF2D55` | DEPLETED primary |
| `semantic/info` | `#00E5C8` | BALANCED primary |

---

## 6. Tab Bar

| Token | Value |
|---|---|
| `tabbar/bg` | `rgba(5,5,16,0.95)` |
| `tabbar/active` | `#B4FF50` |
| `tabbar/inactive` | `rgba(255,255,255,0.40)` |

---

## 7. Health Provider Brand Colors

Each provider uses its **real brand color** for the icon tint, CONNECT pill border, and pressed state. Treat as immutable — never recolor a logo.

| Provider | Brand hex | Notes |
|---|---|---|
| Apple Health | `#FF2D55` | Heart icon |
| Oura Ring | `#9B8CFF` | Lavender |
| Samsung Health | `#1428A0` | Samsung deep blue |
| Google Health Connect | `#4285F4` | Google blue |
| Garmin Connect | `#007CC3` | Garmin azure |
| **WHOOP** | `#B6FF00` | Lime — also used for WHOOP wordmark |
| Strava | `#FC4C02` | Strava orange |

Inside the WHOOP cinematic card, additional WHOOP palette:
- Recovery green: `#16EC06` · Recovery yellow: `#FFDE00` · Recovery red: `#FF0026`
- Strain teal: `#0093E7` · Panel bg gradient: `#0A0A0A → #000000`

---

## 8. Typography

**Family: Inter** (load all four weights — Regular / Medium / SemiBold / Bold).

### Weights
| Token | Family | Weight |
|---|---|---|
| `font/regular` | Inter | 400 |
| `font/medium` | Inter | 500 |
| `font/semibold` | Inter | 600 |
| `font/bold` | Inter | 700 |

### Size scale
| Token | Size (px) | Typical use |
|---|---|---|
| `size/xs` | 11 | Tiny labels, eyebrow rows |
| `size/sm` | 13 | Body small, captions |
| `size/base` | 15 | Default body |
| `size/md` | 17 | Emphasized body |
| `size/lg` | 20 | Section titles |
| `size/xl` | 24 | Card headings |
| `size/2xl` | 28 | Screen subtitles |
| `size/3xl` | 36 | Screen titles |
| `size/4xl` | 48 | Hero numbers |
| `size/5xl` | 64 | Score / orb mega numbers |

### Line height (multiplier)
| Token | × Size |
|---|---|
| `lh/tight` | 1.1 |
| `lh/snug` | 1.2 |
| `lh/normal` | 1.4 |
| `lh/relaxed` | 1.6 |

### Letter spacing (px)
| Token | Value |
|---|---|
| `tracking/tighter` | -1 |
| `tracking/tight` | -0.5 |
| `tracking/normal` | 0 |
| `tracking/wide` | 0.5 |
| `tracking/wider` | 1 |
| `tracking/widest` | 2 |

### Recommended Figma Text Styles (build these as named styles)
| Style | Family / Weight | Size | LH | Tracking | Color | Use |
|---|---|---|---|---|---|---|
| `Display / Hero` | Inter Bold | 64 | 1.1 | -1 | `text/primary` | Score orb |
| `Display / Mega` | Inter Bold | 48 | 1.1 | -0.5 | `text/primary` | Major numbers |
| `Display / Title` | Inter Bold | 36 | 1.2 | -0.5 | `text/primary` | Screen titles |
| `Heading / H1` | Inter Bold | 28 | 1.2 | 0 | `text/primary` | Section heads |
| `Heading / H2` | Inter SemiBold | 24 | 1.2 | 0 | `text/primary` | Card titles |
| `Heading / H3` | Inter SemiBold | 20 | 1.2 | 0 | `text/primary` | Subheads |
| `Body / Lg` | Inter Medium | 17 | 1.4 | 0 | `text/primary` | Emphasized body |
| `Body / Base` | Inter Regular | 15 | 1.4 | 0 | `text/primary` | Default body |
| `Body / Sm` | Inter Regular | 13 | 1.4 | 0 | `text/secondary` | Body small |
| `Caption` | Inter Medium | 11 | 1.4 | 0 | `text/muted` | Captions |
| **`Eyebrow / Bold`** | **Inter Bold** | **10–11** | **1.4** | **+1.4 to +2.5** | **`text/secondary`** | **ALL-CAPS section eyebrows (signature AForce style — used everywhere)** |
| `Pill / Bold` | Inter Bold | 10 | — | +1.4 | brand color | Pill buttons (CONNECT, LIVE) |

> **The Eyebrow style is the AForce house signature.** Every section header in the app uses it. Don't skip it in Figma — design your screens around it.

---

## 9. Spacing Scale (4px base unit)

Use these as the only spacing values in Figma — paste as Number variables.

| Token | px |
|---|---|
| `space/0` | 0 |
| `space/1` | 4 |
| `space/2` | 8 |
| `space/3` | 12 |
| `space/4` | 16 |
| `space/5` | 20 |
| `space/6` | 24 |
| `space/7` | 28 |
| `space/8` | 32 |
| `space/10` | 40 |
| `space/12` | 48 |
| `space/14` | 56 |
| `space/16` | 64 |

---

## 10. Border Radius

| Token | px | Use |
|---|---|---|
| `radius/sm` | 8 | Small chips, inputs |
| `radius/md` | 12 | Default — buttons, small cards |
| `radius/lg` | 16 | Cards, modals |
| `radius/xl` | 20 | Hero cards |
| `radius/2xl` | 24 | Premium cards (WHOOP card uses 14, Apple Health uses 12 — most cards land 12–16) |
| `radius/3xl` | 32 | Large surfaces |
| `radius/full` | 9999 | Pills, dots, circular avatars |

---

## 11. Shadows & Glows

Figma effect equivalents (Inner Shadow / Drop Shadow / Background Blur).

### `shadow/card`
- Color: `rgba(0,0,0,0.30)` · Offset: 0,4 · Blur: 16 · Spread: 0

### `shadow/orb` (used for score orb glow)
- Color: `rgba(170,255,0,0.60)` · Offset: 0,0 · Blur: 32 · Spread: 0

### Status-band glows (apply to dot, ring, border, CTA)
| Band | Color | Blur radius | Opacity |
|---|---|---|---|
| OPTIMAL | `#39FF14` | 22 | 32% |
| STABLE | `#B4FF50` | 14 | 24% |
| DECLINING | `#FFD60A` | 10 | 20% |
| RISK | `#FF8C1A` | 14 | 45% |
| CRITICAL | `#FF2D55` | 8 | 70% |

In Pressure Mode, multiply the Blur ×1 and the Opacity by ~1.4 (use the Pressure values from §3).

---

## 12. Layout Constants

| Token | px | Use |
|---|---|---|
| `layout/web-top-padding` | 67 | Top inset on web (substitutes safe-area) |
| `layout/web-bottom-inset` | 34 | Bottom inset on web |
| `layout/tab-bar-height` | 84 | Bottom tab bar |
| `layout/web-bottom-padding` | 118 | Bottom inset + tab bar (use on tab screens) |

---

## 13. Component Recipes (build these as Figma Components)

### Card (default)
- Fill: `bg/card` (`#0D0D20`)
- Border: 1px `border/medium`
- Radius: `radius/lg` (16)
- Padding: `space/4` (16)
- Shadow: `shadow/card`

### Eyebrow + Card stack
- Eyebrow text style + 8px gap above card.

### CONNECT pill
- Padding: 10×5 · Radius: full · Border: 1px `<provider brand>88` (53% alpha)
- Text: Pill / Bold, color = provider brand.

### LIVE indicator
- Same dimensions as CONNECT pill OR a simple text label.
- Color: `state/peak/primary` (`#B4FF50`).
- Optional 6px pulsing dot to the left.

### Score Orb
- 240×240 circle, fill = `bg/card`, glow = `shadow/orb` tinted by current state's primary.
- Inner number: Display / Hero (64px Bold) in state primary color.

### WHOOP cinematic card (reference: `components/WhoopSnapshotCard.tsx`)
- BG: linear gradient `#0A0A0A → #000000` top-left → bottom-right
- Border: 1px `#B6FF0033`
- Radius: 14
- Padding: 16
- Recovery ring: 132×132 SVG ring, 8px stroke, color from §7 (green/yellow/red by recovery %)
- WHOOP wordmark: Inter Bold 14, tracking +4, color `#B6FF00`

---

## 14. What's intentionally NOT here

- **Light mode** — the app is dark-only by design. Don't build a light theme in Figma; it'll never ship.
- **Pixel-rounded radii other than the 7-step scale** — stick to §10. If you find yourself wanting `radius/10`, the answer is `radius/md` (12).
- **One-off colors per screen** — every accent comes from §2/§3/§4. If you need a "new" color, you've probably picked the wrong band.

---

## 15. When to update this doc

Re-export when any of these files change:

- `artifacts/aforce-os/theme/colors.ts`
- `artifacts/aforce-os/theme/typography.ts`
- `artifacts/aforce-os/theme/spacing.ts`
- `artifacts/aforce-os/theme/statusColor.ts`
- `artifacts/aforce-os/data/healthProviders.ts`

Ask Replit Agent: *"Re-export the AForce design tokens to Figma spec."*
