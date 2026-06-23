---
name: AForce identifier-derived UI labels leak internal codenames
description: Tone/copy audits must check labels DERIVED from engine identifiers, not just literal copy strings — a raw videoCategory leaked an alarmist word onto Home.
---

# Identifier-derived labels can leak tone-violating internal codenames

A Home "Recovery Coach" meta label rendered an internal engine identifier raw
(`video.videoCategory.replace(/_/g,' ').toUpperCase()`), turning the stable key
`depletion_emergency` into the on-screen words "DEPLETION EMERGENCY" — an
alarmist phrase that fought the app's calm-operator / anti-energy-drink tone,
even though every literal copy string was already calm.

**Why:** internal identifiers are named for engine semantics (urgency, severity),
not user tone. When such a key is surfaced through a generic prettify transform
(`.replace(/_/g,' ')` + `.toUpperCase()`), the codename silently becomes UI copy
and violates tone locks that a copy-string review would never catch.

**How to apply:** during any tone/copy pass on this app, also grep for renders
that DERIVE text from identifiers (e.g. `.videoCategory`, `.replace(/_/`,
`.toUpperCase()` on enum-like fields), not just string literals. Fix by mapping
the identifier to a display label (e.g. a `CATEGORY_LABELS` map:
`depletion_emergency → "RECOVERY FOCUS"`) that keeps the identifier stable and
falls back to the prettified key for unmapped values — never rename the
identifier itself (other engine code keys off it).
