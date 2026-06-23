# AForce OS Design Tokens — AForce Brand System

> **Source of truth**: `artifacts/aforce-os/theme/*`
> **Figma import**: `design/aforce-tokens.json` (Tokens Studio for Figma, W3C format)
> **Version**: 2.1.0 — AForce Brand System

---

## Design Philosophy

AForce OS uses the **AForce Brand System** — a cinematic dark performance aesthetic:
- **Near-black canvas** — solid backgrounds start at `#0D0D0D`, not pure black or dark gray
- **Content floats on darkness** — no visible card borders, structure comes from spacing
- **Signal Red hero** — AForce signal red `#C1281B` is the signature accent, used sparingly (thin lines, eyebrows, active states, CTAs)
- **Soursop green for positive status** — `#1FA35A` marks Peak / Optimal / success
- **Berry blue for secondary data** — `#1E5BFF`
- **Data-forward** — big numbers, small tracked labels, no decoration
- **Generous spacing** — when in doubt, add more whitespace
- **Soft glows, never hard shadows** — status colors radiate outward
- **Three type faces by role** — Archivo Black (display), IBM Plex Mono (eyebrows / metrics), Inter (body)

### Color System Lock (v2.1.0)

The canonical AForce OS color system is the AForce Brand System. Near-black `#0D0D0D` canvas. Signal red `#C1281B` as the hero accent, used sparingly. Soursop green `#1FA35A` for positive status (Peak / Optimal / success). Berry blue `#1E5BFF` for secondary data and info. The score ladder runs Optimal green → Stable light-green → Declining amber → Risk orange → Critical red. Only completed behaviour changes score; accent color never implies score. Scrims (`rgba(0,0,0,a)`), drop-shadow color (`#000000`), and `text.inverse` (`#000000`, text on light/accent fills) stay pure black by design.

---

## 1. Colors

### Backgrounds (near-black to near-invisible elevation)

| Token | Hex | Usage |
|---|---|---|
| `bg.primary` | `#0D0D0D` | Screen background, canvas |
| `bg.secondary` | `#050508` | Slight elevation (barely visible) |
| `bg.card` | `#0A0A0F` | Card surfaces |
| `bg.elevated` | `#101018` | Elevated panels, sheets |
| `bg.surface` | `#141420` | Highest elevation (modals) |
| `bg.overlay` | `rgba(0,0,0,0.92)` | Fullscreen overlay scrim |

### Text

| Token | Value | Usage |
|---|---|---|
| `text.primary` | `#FFFFFF` | Headlines, scores, primary content |
| `text.secondary` | `rgba(255,255,255,0.55)` | Body text, descriptions |
| `text.muted` | `rgba(255,255,255,0.30)` | Labels, metadata |
| `text.ghost` | `rgba(255,255,255,0.18)` | Placeholder, disabled |
| `text.inverse` | `#000000` | Text on light/accent backgrounds |

### Borders (near-invisible)

| Token | Value | Usage |
|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.04)` | Barely-there separators |
| `border.medium` | `rgba(255,255,255,0.08)` | Section dividers |
| `border.strong` | `rgba(255,255,255,0.14)` | Active/selected borders |
| `border.accent` | `rgba(193,40,27,0.20)` | Accent-tinted border |

### Fills (glass-on-black)

| Token | Value | Usage |
|---|---|---|
| `fill.light` | `rgba(255,255,255,0.02)` | Barely-there card fill |
| `fill.medium` | `rgba(255,255,255,0.05)` | Default card fill |
| `fill.strong` | `rgba(255,255,255,0.10)` | Active/pressed fill |

### Hero Accent (Signal Red)

| Token | Value | Usage |
|---|---|---|
| `accent.primary` | `#C1281B` | Primary accent, CTA, active states |
| `accent.glow` | `rgba(193,40,27,0.50)` | Button glow, accent halo |
| `accent.dim` | `rgba(193,40,27,0.12)` | Accent-tinted backgrounds |
| `accent.subtle` | `rgba(193,40,27,0.06)` | Very faint accent wash |
| `accent.secondary` | `#1E5BFF` | Berry blue, secondary data |

### Two band systems (intentional — do not merge)

The code runs **two parallel band systems** with different thresholds and roles:

- **Performance State (4 bands)** — `theme/colors.ts` `states`, classified by
  `utils/scoring/breakdown.ts` `resolveState`. Drives the **orb** (pulse /
  flare-on-peak / collapse-on-depletion), `riskTimer`, and command selection.
  Thresholds: PEAK ≥90, BALANCED ≥75, RECOVERING ≥60, else DEPLETED.
- **Score Status (5 bands)** — `theme/statusColor.ts`, mirrored by
  `utils/hydrationScore.ts`. Drives the **AI Coach status-color layer** (dots,
  borders, glows, CTA tint) and the score read-out. Thresholds: OPTIMAL ≥85,
  STABLE ≥70, DECLINING ≥50, RISK ≥30, else CRITICAL.

Both ladders share the same top green (`#1FA35A`) and bottom red (`#FF2800`); the
middle bands differ by design.

### Performance States (4 bands)

| State | Primary | Glow | Dim |
|---|---|---|---|
| **Peak** (90–100) | `#1FA35A` | `rgba(31,163,90,0.50)` | `rgba(31,163,90,0.12)` |
| **Balanced** (75–89) | `#00E5C8` | `rgba(0,229,200,0.40)` | `rgba(0,229,200,0.12)` |
| **Recovering** (60–74) | `#FFA01E` | `rgba(255,160,30,0.40)` | `rgba(255,160,30,0.12)` |
| **Depleted** (0–59) | `#FF2800` | `rgba(255,40,0,0.40)` | `rgba(255,40,0,0.12)` |

### Score Status (5 bands)

Single source of truth: `theme/statusColor.ts` (mirrored by `utils/hydrationScore.ts`).

| Band | Primary (calm) | Pressure Mode |
|---|---|---|
| **Optimal** (85-100) | `#1FA35A` | `#17C964` |
| **Stable** (70-84) | `#3DBE7A` | `#2BAA66` |
| **Declining** (50-69) | `#FFDE00` | `#FFC000` |
| **Risk** (30-49) | `#FF8C1A` | `#FF7A00` |
| **Critical** (0-29) | `#FF2800` | `#FF0040` |

### Wearable Integration Palette

The `whoop.*` token keys are retained for continuity with the wearable-snapshot
surface; their values now follow the AForce Brand System (green status, blue
strain). The provider brand swatch (`providers.whoop` = `#B6FF00`) keeps WHOOP's
own lime so connect buttons render in the provider's real brand color.

| Token | Value | Usage |
|---|---|---|
| `whoop.lime` | `#1FA35A` | Connected-status accent |
| `whoop.teal` | `#1E5BFF` | Strain bar fill |
| `whoop.recovery-green` | `#1FA35A` | Recovery >= 67% |
| `whoop.recovery-yellow` | `#FFDE00` | Recovery 34-66% |
| `whoop.recovery-red` | `#FF0026` | Recovery <= 33% |
| `whoop.panel-bottom` | `#0D0D0D` | Snapshot panel base |
| `whoop.ring-track` | `rgba(255,255,255,0.08)` | Ring background track |
| `whoop.strain-track` | `rgba(30,91,255,0.15)` | Strain bar background |

### Opacity Scale

Use for layering content on the near-black canvas:

`0.02` - `0.04` - `0.06` - `0.08` - `0.10` - `0.14` - `0.20` - `0.30` - `0.55` - `1.00`

---

## 2. Typography (Archivo Black · IBM Plex Mono · Inter)

### Faces by role

| Role | Family | Token | Usage |
|---|---|---|---|
| `display` | Archivo Black | `fonts.display` / `roles.display` | Hero numerals, wordmarks |
| `eyebrow` | IBM Plex Mono | `roles.eyebrow` | Tracked uppercase section labels |
| `metric` | IBM Plex Mono | `roles.metric` | Metric captions / values |
| `mono` | IBM Plex Mono | `fonts.mono` / `roles.mono` | Technical / tabular text |
| `body` | Inter (400 → 800) | `fonts.regular` … `fonts.bold` | Everything else |

### Scale

| Token | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| `display-hero` | 80px | Bold | -1.5px | Hero score in cinematic view |
| `display-score` | 64px | Bold | -1.5px | Score inside orb |
| `display-mega` | 48px | Bold | -0.5px | Large feature numbers |
| `display-title` | 36px | Bold | -0.5px | Screen titles |
| `h1` | 28px | Bold | 0 | Section headings |
| `h2` | 24px | SemiBold | 0 | Card headings |
| `h3` | 20px | SemiBold | 0 | Subheadings |
| `body-lg` | 17px | Medium | 0 | Primary body |
| `body-base` | 15px | Regular | 0 | Default body |
| `body-sm` | 13px | Regular | 0 | Secondary body |
| `caption` | 11px | Medium | 0 | Metadata |
| `eyebrow` | 11px | Bold | 3px | Section labels (UPPERCASE) |
| `eyebrow-sm` | 9px | Bold | 3px | Tiny labels (UPPERCASE) |
| `metric-label` | 9px | SemiBold | 2px | Metric labels (UPPERCASE) |
| `metric-value` | 24px | Bold | -0.5px | Metric numbers |
| `pill` | 10px | Bold | 1px | Pill/tag text (UPPERCASE) |

---

## 3. Spacing

`0` - `4` - `8` - `12` - `16` - `20` - `24` - `28` - `32` - `40` - `48` - `56` - `64` - `80` - `96`

**Spacing rule**: sections should have 40-64px between them. Cards should have 20px internal padding. Never let elements feel crowded.

---

## 4. Radii

| Token | Value | Usage |
|---|---|---|
| `none` | 0 | Sharp edges (rare) |
| `sm` | 8px | Small chips, pills |
| `md` | 12px | Cards, inputs |
| `lg` | 16px | Metric cards, sections |
| `xl` | 20px | Large cards |
| `2xl` | 24px | Sheets, modals |
| `3xl` | 32px | Hero containers |
| `full` | 9999px | Circles, rounded pills |

---

## 5. Component Dimensions

| Component | Token | Value |
|---|---|---|
| **Orb** | `orb-size` | 200px |
| **Orb ring stroke** | `orb-stroke` | 6px |
| **Orb glow blur** | `orb-glow-radius` | 32px |
| **Recovery ring** | `ring-size` | 132px |
| **Recovery ring stroke** | `ring-stroke` | 8px |
| **Strain bar height** | `strain-bar-height` | 6px |
| **CTA button height** | `cta-height` | 56px |
| **CTA radius** | `cta-radius` | 14px |
| **Status pill height** | `pill-height` | 28px |
| **Share button** | `share-btn-size` | 36px |
| **Content padding** | `content-padding` | 20px |

---

## 6. iPhone 14 Pro Layout

| Constant | Value |
|---|---|
| Screen size | 393 x 852 |
| Status bar | 54px |
| Safe area top | 59px |
| Safe area bottom | 34px |
| Tab bar | 84px |
| Content padding | 20px each side |
| Usable content width | 353px |

---

## 7. Shadows / Glows

AForce never uses hard box shadows. Everything is a soft radial glow that matches the status color:

| Token | Color | Blur | Usage |
|---|---|---|---|
| `orb-glow` | `rgba(31,163,90,0.50)` | 40px | Orb ambient glow (peak) |
| `glow-peak` | `rgba(31,163,90,0.35)` | 24px | Peak state elements |
| `glow-balanced` | `rgba(0,229,200,0.25)` | 18px | Balanced state |
| `glow-recovering` | `rgba(255,160,30,0.30)` | 14px | Recovering state |
| `glow-depleted` | `rgba(255,45,85,0.40)` | 12px | Depleted state |
| `cta-glow` | `rgba(193,40,27,0.20)` | 16px | CTA button ambient |

---

## How to Use in Figma

1. Open Tokens Studio plugin (Cmd+P, type "Tokens Studio")
2. Import `aforce-tokens.json` (three-dot menu, Tools, Load from file)
3. Push to Figma Variables (Tools, Export to Figma Variables)
4. Every color, font size, spacing value becomes a Figma Variable
5. When building frames, use variables for all fills/strokes/text
6. When the codebase changes, ask Replit to re-export, then re-import -- everything stays in sync
