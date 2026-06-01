# AForce OS Design Tokens — WHOOP-Cinematic Edition

> **Source of truth**: `artifacts/aforce-os/theme/*`
> **Figma import**: `design/aforce-tokens.json` (Tokens Studio for Figma, W3C format)
> **Version**: 2.0.0 — WHOOP-Cinematic

---

## Design Philosophy

AForce OS follows WHOOP's cinematic design language:
- **Pure black canvas** — backgrounds start at `#000000`, not dark gray
- **Content floats on darkness** — no visible card borders, structure comes from spacing
- **One hero color** — WHOOP Lime `#B6FF00` is the signature accent
- **Data-forward** — big numbers, small labels, no decoration
- **Generous spacing** — when in doubt, add more whitespace
- **Soft glows, never hard shadows** — status colors radiate outward

### Color System Lock (v2.0.0)

The canonical AForce OS color system is WHOOP-Cinematic. Pure black `#000000` canvas. WHOOP lime `#B6FF00` as the sole hero accent. Coral `#E8613A` as the pulse ring accent only — no other use cases. All teal palette values (`#1DB594`, `#0F6E56`, `#060F0D`) are deprecated as of 2026-06-01 and must not appear in any new screen, component, or token. The opening screen (`welcome.tsx` / `AForceOSPreview.tsx`) must be migrated to WHOOP-Cinematic tokens before any Cursor build session begins. Any developer encountering teal in the codebase should replace it with the WHOOP-Cinematic equivalent and flag it in the PR.

---

## 1. Colors

### Backgrounds (pure black to near-invisible elevation)

| Token | Hex | Usage |
|---|---|---|
| `bg.primary` | `#000000` | Screen background, canvas |
| `bg.secondary` | `#050508` | Slight elevation (barely visible) |
| `bg.card` | `#0A0A0F` | Card surfaces |
| `bg.elevated` | `#101018` | Elevated panels, sheets |
| `bg.surface` | `#141420` | Highest elevation (modals) |
| `bg.overlay` | `rgba(0,0,0,0.92)` | Fullscreen overlays |

### Text

| Token | Value | Usage |
|---|---|---|
| `text.primary` | `#FFFFFF` | Headlines, scores, primary content |
| `text.secondary` | `rgba(255,255,255,0.55)` | Body text, descriptions |
| `text.muted` | `rgba(255,255,255,0.30)` | Labels, metadata |
| `text.ghost` | `rgba(255,255,255,0.18)` | Placeholder, disabled |
| `text.inverse` | `#000000` | Text on light/accent backgrounds |

### Borders (WHOOP-level invisible)

| Token | Value | Usage |
|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.04)` | Barely-there separators |
| `border.medium` | `rgba(255,255,255,0.08)` | Section dividers |
| `border.strong` | `rgba(255,255,255,0.14)` | Active/selected borders |
| `border.accent` | `rgba(182,255,0,0.20)` | Accent-tinted border |

### Fills (glass-on-black)

| Token | Value | Usage |
|---|---|---|
| `fill.light` | `rgba(255,255,255,0.02)` | Barely-there card fill |
| `fill.medium` | `rgba(255,255,255,0.05)` | Default card fill |
| `fill.strong` | `rgba(255,255,255,0.10)` | Active/pressed fill |

### Hero Accent (WHOOP Lime)

| Token | Value | Usage |
|---|---|---|
| `accent.primary` | `#B6FF00` | Primary accent, CTA, active states |
| `accent.glow` | `rgba(182,255,0,0.50)` | Orb glow, button glow |
| `accent.dim` | `rgba(182,255,0,0.12)` | Accent-tinted backgrounds |
| `accent.subtle` | `rgba(182,255,0,0.06)` | Very faint accent wash |
| `accent.secondary` | `#0093E7` | WHOOP teal, secondary data |

### Performance States (4 bands)

| State | Primary | Glow | Dim |
|---|---|---|---|
| **Peak** | `#B6FF00` | `rgba(182,255,0,0.50)` | `rgba(182,255,0,0.12)` |
| **Balanced** | `#00E5C8` | `rgba(0,229,200,0.40)` | `rgba(0,229,200,0.12)` |
| **Recovering** | `#FFA01E` | `rgba(255,160,30,0.40)` | `rgba(255,160,30,0.12)` |
| **Depleted** | `#FF2D55` | `rgba(255,45,85,0.40)` | `rgba(255,45,85,0.12)` |

### Score Status (5 bands)

| Band | Primary | Pressure Mode |
|---|---|---|
| **Optimal** (85-100) | `#16EC06` | `#00FF00` |
| **Stable** (70-84) | `#B6FF00` | `#A0FF20` |
| **Declining** (50-69) | `#FFDE00` | `#FFC000` |
| **Risk** (30-49) | `#FF8C1A` | `#FF7A00` |
| **Critical** (0-29) | `#FF0026` | `#FF0040` |

### WHOOP Integration Palette

| Token | Value | Usage |
|---|---|---|
| `whoop.lime` | `#B6FF00` | WHOOP wordmark, connected status |
| `whoop.teal` | `#0093E7` | Strain bar fill |
| `whoop.recovery-green` | `#16EC06` | Recovery >= 67% |
| `whoop.recovery-yellow` | `#FFDE00` | Recovery 34-66% |
| `whoop.recovery-red` | `#FF0026` | Recovery <= 33% |
| `whoop.ring-track` | `rgba(255,255,255,0.08)` | Ring background track |
| `whoop.strain-track` | `rgba(0,147,231,0.15)` | Strain bar background |

### Opacity Scale

Use for layering content on pure black:

`0.02` - `0.04` - `0.06` - `0.08` - `0.10` - `0.14` - `0.20` - `0.30` - `0.55` - `1.00`

---

## 2. Typography (Inter)

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

**WHOOP rule**: sections should have 40-64px between them. Cards should have 20px internal padding. Never let elements feel crowded.

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

WHOOP never uses hard box shadows. Everything is a soft radial glow that matches the status color:

| Token | Color | Blur | Usage |
|---|---|---|---|
| `orb-glow` | `rgba(182,255,0,0.50)` | 40px | Orb ambient glow |
| `glow-peak` | `rgba(182,255,0,0.35)` | 24px | Peak state elements |
| `glow-balanced` | `rgba(0,229,200,0.25)` | 18px | Balanced state |
| `glow-recovering` | `rgba(255,160,30,0.30)` | 14px | Recovering state |
| `glow-depleted` | `rgba(255,45,85,0.40)` | 12px | Depleted state |
| `cta-glow` | `rgba(182,255,0,0.20)` | 16px | CTA button ambient |

---

## How to Use in Figma

1. Open Tokens Studio plugin (Cmd+P, type "Tokens Studio")
2. Import `aforce-tokens.json` (three-dot menu, Tools, Load from file)
3. Push to Figma Variables (Tools, Export to Figma Variables)
4. Every color, font size, spacing value becomes a Figma Variable
5. When building frames, use variables for all fills/strokes/text
6. When the codebase changes, ask Replit to re-export, then re-import -- everything stays in sync
