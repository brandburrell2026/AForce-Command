# AFORCE OS — Social + Cruise Enhancement Layer (Addon)

> **Addon, not a rewrite.** This document describes additions that
> layer on top of the core product defined in `AFORCE_FINAL_SPEC.md`.
> Do **not** merge any of this into the core spec. Do **not** start
> implementing any of this until all nine core phases have shipped
> and been approved.

## Activation Order

After Phase 9 of the core spec is complete and approved:

1. Read this document.
2. Apply additions only — do not redesign Social Mode.
3. Apply additions only — do not redesign Cruise Mode.
4. Stop after completion.

## Social Additions

Apply in order. Stop after each.

- **Contexts** — add Social Mode contexts (e.g. session types and
  modifiers) without altering the existing Social Mode surface.
- **Morning Reset** — additive morning ritual screen.
- **Moments Engine** — additive event/moment capture pipeline.

**STOP** after Social additions before starting Cruise.

## Cruise Additions

Apply in order. Stop after each.

- **Voyage Recovery** — Cruise-mode recovery layer.
- **Recovery Concierge** — concierge surface that sits on top of
  Voyage Recovery.
- **Cruise Contexts** — Cruise-mode contexts, additive only.

**STOP** after Cruise additions.

## Explicitly Out of Scope (never build under this addon)

- **Recovery Journey** — architecture only.
- **Journey Summary** — architecture only.
- **Phantom** — architecture only.

These three remain conceptual placeholders. Do not implement
surfaces, services, routes, or storage for them.

## Hard Rules

- Never modify existing Social Mode or Cruise Mode behavior — only
  add new contexts/screens/services alongside the existing ones.
- Never merge this document into `AFORCE_FINAL_SPEC.md`.
- Never start an addon until the core phase 9 is approved.
- One addition per session. Stop after each. Wait for approval.
