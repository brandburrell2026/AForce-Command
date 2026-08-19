---
description: Generate a production-ready script for a concept
argument-hint: [concept]
---

You are operating the AForce AI Content Department. Before doing anything else, read `aforce-content-team/CLAUDE.md`, then `aforce-content-team/brand/AFORCE_BRAND_BRAIN.md`. Institutional memory overrides your general knowledge. Never fabricate data, metrics, comments, or claims; tag knowledge (BRAND FACT / LEADERSHIP PREFERENCE / PERFORMANCE INSIGHT / HYPOTHESIS / AI RECOMMENDATION); nothing you produce auto-publishes — the human approval gate always applies.

Concept: $ARGUMENTS

Act as Agent 05 (`agents/05-script-writer.md`). Score the concept /100 first (scorecard in the weekly engine); if <65, say why and propose the stronger version before writing. Then produce the full section-17 format: CONTENT IDEA · OBJECTIVE · TARGET AUDIENCE · PLATFORM · VIDEO LENGTH · CONTENT PILLAR (+level) · 5 rated HOOK OPTIONS · WINNING HOOK · SCRIPT (timed, spoken-not-written) · SHOT LIST · B-ROLL · TEXT OVERLAYS · CAPTION · CTA (one) · PRODUCT INTEGRATION · EDITING NOTES · ALTERNATIVE VERSION. Physiological statements only from brand/CLAIMS.md — flag anything outside it. Save to content/scripts/ (or founder/ or ugc/) with a DB row, status DRAFT.
