# AForce OS — Recovery Coach Premium Redesign

> Source of truth for the Recovery Coach full-screen build. Provided by the founder
> (2026-07-18). Implementation notes/decisions are tracked in the build PRs, not here.

## Claude Code implementation handoff

**Decision:** Keep Brandon’s full-screen Recovery Coach concept. Rebuild its presentation and interaction quality so it feels like a luxury performance instrument: Apple clarity, Porsche precision, Rolex restraint, and unmistakably AForce.

**Reference state:** Full-screen black interface, top Recovery Coach label, central red pulse, water command, next-check timer, recovery-focus progress, and close control.

---

## 1. Product intent

This is AForce’s signature focused mode. It should feel like a private performance command—not a dashboard, warning panel, generic wellness app, or gaming HUD.

The screen must communicate three things within two seconds:

1. What should I do?
2. When will AForce check me again?
3. How do I confirm that I did it?

### Preserve

- Full-screen, distraction-free Recovery Coach mode.
- Near-black cinematic field.
- One restrained red pulse as the AForce signature.
- Command, countdown, and progress state.
- Close control at top right.

### Change

- Use sentence case for the primary command; reserve tracked uppercase for micro-labels.
- Remove simultaneous, contradictory instructions.
- Replace the always-visible duplicate command card with an expandable **Why this command** detail.
- Add one primary completion action and one quiet adjustment action.
- Remove absolute or fear-based claims.
- Do not show the bottom navigation or a floating microphone in focused mode.

---

## 2. Approved content hierarchy

Render in this order:

1. **Recovery Coach** header and live status
2. Ambient pulse
3. **Your next move** label
4. Command title and one-line instruction
5. Next-check countdown
6. Primary and secondary actions
7. Why-this-command disclosure
8. Recovery-focus progress

### Exact default copy

| Element | Copy |
| --- | --- |
| Header | `RECOVERY COACH` |
| Status | `Live guidance` |
| Eyebrow | `YOUR NEXT MOVE` |
| Title | `Start with water` |
| Instruction | `Drink 20 oz. Recheck in 15 minutes.` |
| Timer label | `NEXT CHECK` |
| Timer example | `04:12` |
| Primary action | `I've had the water` |
| Secondary action | `Adjust command` |
| Disclosure | `Why this command` |
| Progress label | `RECOVERY FOCUS` |
| Duration label | `15 MIN` |

Do not display these phrases:

- `Electrolytes will restore your balance.`
- `Without action: score drifts to 0.`
- Two different quantities or recheck times on the same screen.

If a validated rule recommends electrolytes, use:

- Title: `Add electrolytes`
- Instruction: `Use one serving according to the product label. Recheck in 15 minutes.`

Do not display `2 sticks` unless that quantity is label-approved, rules-engine validated, and returned by the same command object that supplies every other visible instruction.

---

## 3. Design tokens

Use semantic tokens; do not scatter raw color values through components.

| Token | Value | Use |
| --- | --- | --- |
| `af.canvas` | `#050506` | Root background |
| `af.surface` | `#0D0E10` | Sheets and expanded details |
| `af.surfaceRaised` | `#141518` | Elevated interactive surface |
| `af.textPrimary` | `#F4F2ED` | Command, timer, button text |
| `af.textSecondary` | `#A6A5A1` | Instructions and status |
| `af.textTertiary` | `#727378` | Micro-labels and inactive details |
| `af.divider` | `rgba(255,255,255,0.10)` | Hairline rules |
| `af.border` | `rgba(255,255,255,0.16)` | Secondary button and close control |
| `af.red` | `#FF2B1C` temporary | Primary action and live-state accent |
| `af.redDim` | `rgba(255,43,28,0.16)` | Pulse atmosphere |
| `af.redHairline` | `rgba(255,43,28,0.34)` | Pulse ring |

Replace the temporary red with the approved production AForce brand-red token before release. Red should occupy no more than roughly 8% of the visible screen.

No gold, chrome, glassmorphism, purple, cyan, neon bloom, heavy gradients, or glossy 3D effects.

---

## 4. Typography

### Font stack

- iOS: `SF Pro Display` for display values and `SF Pro Text` for interface copy.
- Android/web: `Inter Variable` until a licensed AForce family is approved.
- Optional premium brand family: Söhne or Neue Haas Unica, only with a valid license and full cross-platform testing.
- Use tabular numerals for the countdown.

| Style | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Command title | `38sp / 44sp` | 500 | `-0.02em` |
| Countdown | `72sp / 76sp` | 400 | `0.04em`, tabular |
| Instruction | `17sp / 24sp` | 400 | `0` |
| Primary button | `17sp / 22sp` | 600 | `0` |
| Secondary button | `16sp / 22sp` | 500 | `0` |
| Eyebrow labels | `11sp / 14sp` | 600 | `0.18em` |
| Header label | `12sp / 16sp` | 650 | `0.16em` |
| Supporting status | `13sp / 18sp` | 400 | `0` |

Do not use a giant all-caps command. Uppercase is a precision accent, not the main voice.

---

## 5. Layout specification

Build against logical points/dp, not screenshot pixels. Respect device safe areas.

### Reference frame

- Design reference: `390 × 844pt`.
- Horizontal content padding: `24pt`.
- Spacing system: `4, 8, 12, 16, 24, 32, 48pt`.
- Maximum readable content width on large phones/tablets: `430pt`.
- Root background is edge-to-edge; interactive content remains inside safe areas.

### Header

- Position: safe-area top + `8pt`.
- Minimum height: `52pt`.
- Live dot: `7 × 7pt`, `af.red`.
- Label-to-dot gap: `12pt`.
- Close hit target: `44 × 44pt` iOS; `48 × 48dp` Android.
- Close icon: `20pt`; circular border `1pt af.border`.
- `Live guidance` sits `6pt` below the header label.

### Ambient pulse zone

- Flexible height: `232–300pt` depending on device height.
- Pulse group centered horizontally.
- Outer ring: `240pt` maximum diameter, `1pt af.redHairline`.
- Inner core: `88pt` diameter, solid AForce red at approximately 72% visual intensity.
- Soft radial atmosphere may extend to `300pt` but must remain below 18% opacity.
- The pulse is decorative; it must not compete with the command.

### Command block

- Center aligned.
- Maximum width: `342pt`.
- Eyebrow-to-title: `20pt`.
- Title-to-instruction: `14pt`.
- Instruction is one line on standard devices and may wrap to two lines with Dynamic Type.

### Countdown

- Top margin from instruction: `36pt`.
- A `32pt` red hairline sits above `NEXT CHECK`.
- Label-to-timer gap: `14pt`.
- Timer uses `mm:ss` and tabular numerals.

### Actions

- Top margin from timer: `32pt`.
- Primary button: full content width, `56pt` height, `16pt` corner radius, filled `af.red`, warm-white label.
- Secondary button: full content width, `56pt` height, `16pt` corner radius, transparent fill, `1pt af.border`.
- Button gap: `12pt`.
- Disclosure link top margin: `24pt`.
- No third action on the main surface.

### Progress footer

- Anchored above bottom safe area with at least `20pt` clearance.
- Track height: `4pt`; background `rgba(255,255,255,0.10)`.
- Progress: `af.red`; linear, no glow.
- Labels sit `14pt` below track.
- If a short device cannot show the actions and footer simultaneously, preserve actions above the fold and allow the footer to move below in a vertical scroll container.

---

## 6. Motion and haptics

| Motion | Specification |
| --- | --- |
| Screen entrance | `420ms`, opacity `0→1`, content translate `12pt→0`, cubic-bezier `(0.22,1,0.36,1)` |
| Pulse ring | `3200ms` loop, scale `0.94→1.05`, opacity `0.24→0.06`, ease-in-out |
| Pulse core | `3200ms` loop, scale `1.00→1.025`, subtle only |
| Countdown | Update once per second without layout shift |
| Progress | Linear interpolation from command start to recheck time |
| Primary tap | Native medium-impact haptic, then immediate visual confirmation |
| Detail sheet | `300ms` native spring; no exaggerated bounce |

Respect Reduce Motion. When enabled, render a static ring and disable scale animation while retaining the countdown and progress state.

Target device refresh rate and profile for dropped frames on supported low-end devices.

---

## 7. Command architecture — non-negotiable

Every visible instruction must derive from one normalized object. Never hardcode the hero copy, command detail, countdown, and progress independently.

```ts
type RecoveryCommand = {
  id: string;
  state: 'active' | 'acknowledged' | 'rechecking' | 'complete' | 'expired';
  title: string;
  instruction: string;
  primaryActionLabel: string;
  quantity?: {
    value: number;
    unit: 'oz' | 'ml' | 'serving';
  };
  recheckAt: string;       // ISO-8601
  rationale: string;
  sourceVersion: string;
  createdAt: string;       // ISO-8601
  expiresAt: string;       // ISO-8601
};
```

Implementation rules:

- Derive the subtitle, countdown, progress, and duration label from `recheckAt`.
- Do not maintain a separate `10 minutes` string anywhere.
- Do not render expired or stale commands as active.
- When offline, show the last-known command only if it remains valid and display `Updated X min ago`.
- If command validation fails, render a safe fallback: `Refresh your command`—never partial or conflicting instructions.
- Health/product guidance must pass the approved rules and content layer before reaching this component.

---

## 8. Interaction states

### Active

- Countdown running.
- Primary CTA: `I've had the water`.
- Secondary CTA: `Adjust command`.

### Acknowledged

- Primary CTA changes to `Water logged` with a check icon.
- Pulse softens.
- Transition to rechecking state after `800ms`.

### Rechecking

- Title: `Recheck in progress`.
- Keep the next-check time visible.
- Prevent duplicate logging.

### Expired

- Stop progress.
- Title: `Your command needs an update`.
- Primary CTA: `Refresh command`.

### Offline

- Show nonblocking `Offline` status.
- Preserve a valid cached command.
- Do not fabricate or extend a command’s expiration.

### Why this command

Open a bottom sheet or inline disclosure using `af.surface`. The rationale must be concise, written in plain language, and avoid unapproved medical certainty.

---

## 9. Accessibility and platform requirements

- Minimum touch target: `44 × 44pt` on Apple platforms and `48 × 48dp` on Android.
- Normal text contrast: at least `4.5:1`; large text: at least `3:1`.
- Meaningful non-text controls and state indicators: at least `3:1`.
- Red cannot be the only status signal; pair it with text or an icon.
- Support Dynamic Type/font scaling through at least 200% without truncating the action.
- VoiceOver/TalkBack order: header, status, command, instruction, timer, primary action, secondary action, disclosure, progress.
- Announce the remaining time meaningfully; do not announce every one-second tick.
- Close accessibility label: `Close Recovery Coach`.
- Progress accessibility label example: `Recovery focus, 35 percent, next check in 4 minutes 12 seconds`.
- Dark mode is intentional for this focused screen; do not automatically invert it into a light theme.

Official anchors: Apple buttons HIG, Material touch targets, WCAG 2.2 contrast.

---

## 10. Analytics

Track interaction—not sensitive raw health values.

```text
recovery_coach_viewed
recovery_coach_primary_tapped
recovery_coach_adjust_tapped
recovery_coach_why_opened
recovery_coach_dismissed
recovery_coach_completed
```

Allowed properties: `commandId`, `commandState`, `sourceVersion`, `screenVersion`, and elapsed interaction time. Apply the product’s privacy and consent rules.

---

## 11. Acceptance criteria

- [ ] The screen preserves the full-screen black field, central pulse, command, countdown, and progress concept.
- [ ] There is exactly one visible instruction and one recheck time.
- [ ] Hero title uses sentence case.
- [ ] A single command object supplies all visible guidance.
- [ ] Primary CTA is visible without scrolling on standard phones.
- [ ] No bottom navigation or floating microphone appears in focused mode.
- [ ] No element overlaps a safe area, system bar, or another control.
- [ ] iOS and Android minimum touch targets pass.
- [ ] Contrast and font-scaling checks pass.
- [ ] Reduced Motion produces a calm static equivalent.
- [ ] Expired/offline/error states never show stale guidance as current.
- [ ] No unapproved absolute health or product claim is present.
- [ ] Screenshot tests pass at `320×568`, `360×800`, `390×844`, `430×932`, and representative Android sizes.
- [ ] Motion remains smooth on the lowest supported device.
- [ ] Copy, dose, timer, and progress cannot disagree.
