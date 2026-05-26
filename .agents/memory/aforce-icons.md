---
name: aforce-os icon map discipline
description: Icon component takes string names that must exist in theme/icons.ts ICON_MAP, not raw lucide names.
---

`@/components/Icon` accepts any string but only renders mapped entries from `artifacts/aforce-os/theme/icons.ts` `ICON_MAP`. Unmapped names silently fall through.

**Why:** A typo like `refresh-ccw` (lucide has `RefreshCcw`) or `link` (lucide has `Link`) silently renders a fallback / nothing — no compile error, easy to miss in review.

**How to apply:**
- Before using a new icon name, grep `theme/icons.ts` for the exact key.
- If the icon isn't mapped and you actually need it, add the import + map entry in `theme/icons.ts` in the same change.
- Known gotchas: it's `refresh-cw` (no second c); `upload-cloud` (not `cloud-upload`); `grid` maps to lucide `Grid3x3`.
