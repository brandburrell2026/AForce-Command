---
name: AForce wordmark casing
description: Brand mark in the pitch deck renders as "AForce" (mixed case, no ™ superscript), not "AFORCE™".
---

The pitch deck displays the brand as **AForce** — mixed case, no trademark superscript.

**Why:** User reverted an earlier all-caps "AFORCE™" treatment. Mixed-case "AForce" is the canonical wordmark for slide chrome and body copy. A later deck rebuild reintroduced a `AForce™` superscript in `SlideFrame`/`EditorialSlide`; it was removed again to comply with this rule.

**How to apply:**
- Any new slide or chrome that shows the wordmark must use the literal string `AForce` — not `AFORCE`, not `AForce™`, no `<span>™</span>` superscript.
- Don't reintroduce the `text-[0.55em] align-super ... ™` superscript span pattern.
- Headings already wrapped in CSS `uppercase` (e.g. `AFORCE PROTOCOL` in `Subscribe.tsx`) keep their source as-is because the class controls casing visually.
