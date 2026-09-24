# PR-R5 before/after evidence (Founder Decision A5, 2026-09-23)

Captured on an iPhone 17 Pro simulator (iOS 26.5), Debug binary `com.aforce.os`,
JS served by Metro from this branch's worktree with
`EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true EXPO_PUBLIC_CAPTURE=1`. BEFORE = the
migrated files restored to base `e0aace58`; AFTER = this branch's head. Pixel
values were sampled from the PNGs with `pngjs`, not inferred.

| Surface | Site | Before (sampled) | After (sampled) | Token |
|---|---|---|---|---|
| Guardian 05 | row 2 accent (caution) | `#C8A84B` | `#FFA01E` | `af.amber` |
| Guardian 05 | row 3 accent (positive) | `#2DBF8A` | `#1FA35A` | `edPositive` |
| Clutch 06 | row 2 accent | `#00C49A` | `#00E5C8` | `af.cyan` |
| Clutch 06 | row 3 accent | `#4ADE80` | `#1FA35A` | `edPositive` |
| Clutch 06 | row 4 accent | `#E8E0C8` | `#EDEAE3` | `edInk.ivory` |
| Clutch 06 | row ground | `#141414` | `#161512` | `edStock.blackRaised` |
| One Breath | idle bar, composited on `#0D0D0D` | `#57554F` | `#5A5957` | `withAlpha(af.textSecondary, 0.5)` |
| Profile | SkinIA entry disc | `rgba(193,40,27,0.14)` | `rgba(193,40,27,0.14)` | `withAlpha(af.red, 0.14)` — byte-identical |

Row 1 of both rosters is `edAccent.red` (`#C1281B`) before and after (unchanged).
Contrast rose or held on every migrated site; none dropped below WCAG AA for
its text size (see the PR body for the full contrast table).
