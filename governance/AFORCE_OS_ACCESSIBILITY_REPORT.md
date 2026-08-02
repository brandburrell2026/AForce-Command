# AForce OS — Accessibility Report (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0L. (The `/ACCESSIBILITY` Lock mode has
not been formally run before this pass — `CONTINUITY.md`.)

> Static coverage audit. **No render-level a11y tests exist**, so screen-reader order, focus, and
> reduced-motion branches are unverified against rendered UI — a Phase-1 test deliverable.

---

## 1. Coverage (static grep over 233 `.tsx` files)

| Dimension | Coverage | Evidence |
|---|---|---|
| `accessibilityLabel` | 144/233 files | 0L |
| `accessibilityRole` | 134/233 | 0L |
| `accessibilityState` / `Hint` | 49/233 | 0L |
| Touch-target aids (`hitSlop`/`minHeight:44`/`controlMinHeight`) | 67/233; token `afLayout.controlMinHeight = 44` (`afTokens.ts:109`) | 0L |
| Contrast | brand tokens AA-corrected (`textTertiary #85868C ~5:1`, `redText #E4564A` AA on dark), pinned by `afTokens.test.ts:66-67` | 0L |
| Color-independent meaning | asserted at token layer ("never color alone", `afTokens.ts:73-74`); **not test-enforced** | 0L |
| Reduced motion | unified hook (`useReducedMotion.ts`); **only 6 of ~36 animated files consult it** | 0L |

## 2. Gaps (against WCAG 2.2 AA + prompt 0N)

| Gap | Evidence | Severity |
|---|---|---|
| **Dynamic type / text scaling unmanaged** — no `maxFontSizeMultiplier`; `AF_MAX_DISPLAY_FONT_SCALE` absent on main; `allowFontScaling` appears **once** (`AFMetric.tsx:31`). Large numeric displays will overflow at high OS font scale. | 0L | **S2** |
| **No dedicated accessibility settings screen** | 0L | S3 |
| **Reduced-motion coverage thin** — most animated surfaces have no verified static path | 0L | S2 |
| **No render-level a11y tests** — labels/roles/targets/focus/reduced-motion never asserted against rendered UI (0 component `.test.tsx`) | 0L | S2 |
| Color-independent meaning not test-enforced | 0L | S3 |
| Logical focus order / screen-reader traversal not verified | not audited statically | S3 (Phase-1 verify) |

> **Note:** an unmerged branch (`feat/pc-dynamic-type`, not on main at audit time) prototypes a
> `AF_MAX_DISPLAY_FONT_SCALE` clamp on large numerals and an accessibility settings screen. It is
> **evidence of intended direction, not shipped** — evaluate for adoption in Plan P5. This audit
> reflects `main`'s actual state (clamp absent).

## 3. Recommendations (feed Plan P5)
1. Adopt a display-font-scale clamp on large numerics (Home score, Weekly avg, metric values);
   body copy stays fully scalable.
2. Extend the reduced-motion branch to every animated surface; add render tests asserting the static
   path and the presence of a11y labels/roles/targets.
3. Add an accessibility settings surface (motion, haptics opt-out, text-size guidance).
4. Test-enforce color-independent meaning (icon/shape/text always paired with color).
5. Real-device VoiceOver/TalkBack pass across the five bottom tabs at max text scale + tablet.

## 4. Status
Accessibility conformance = **Partially Built** — strong label/role coverage and AA-corrected tokens;
dynamic-type clamp, a11y settings screen, broad reduced-motion coverage, and render-level a11y tests
are the outstanding items.

## 5. Night Out command view — render-level a11y evidence (NO-c, 2026-08-01)
First **render-level** a11y verification in the repo (Phase-0 noted 0 render tests): a non-shipping
harness (`components/nightOut/__tests__/nightOutCommandView.render.test.tsx`, happy-dom +
react-native-web) renders the pure `NightOutCommandView` to a real DOM and asserts, on captured markup:
primary CTA `role="button"` + accessible name (not clipped), exactly one dominant CTA per state,
labeled secondary actions with selectable state, labeled HydroState hero, NOW/NEXT/LATER headers,
**status communicated by text not color alone**, and 44×44 minimum-target tokens; plus reduced-motion
and max-text-scale render variants. 10 reproducible DOM snapshots committed. **Caveat:** DOM/ARIA
structure, not native pixel capture — simulator screen-reader + dynamic-type-overflow verification
remains a final-sign-off step. This is the pattern to extend to other screens.
