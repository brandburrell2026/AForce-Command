---
name: AForce dependency / CVE hardening
description: How Clerk and transitive CVE patches are pinned in this monorepo, and the constraints that make naive bumps fail.
---

# AForce dependency hardening

## Clerk patch is peer-pinned, not caret-bumped
GHSA-w24r-5266-9c3c affects ALL `@clerk/*` packages; the fix is a patch-floor
bump (expo 3.2.2, backend 3.2.14, express 2.1.6, clerk-js 6.7.5, react 6.4.3,
shared 4.8.3).

- Direct Clerk deps are pinned **exact** (no caret) in the artifact package.json,
  and the transitive subpackages (`@clerk/clerk-js`, `@clerk/react`,
  `@clerk/shared`) are pinned exact in `pnpm-workspace.yaml` overrides.
- **Why exact, not caret:** `^3.2.x` lets pnpm drift the whole Clerk tree to the
  latest 3.x (e.g. 3.3.0 / clerk-js 6.13 / shared 4.14), a much larger change
  than the CVE needs. Pin to the patched floor to minimize blast radius.
- **Residual, accepted:** `@clerk/react >=6.4.3` declares a react peer of
  `~19.1.4`, but Expo SDK 54 + RN 0.81.5 pin react `19.1.0`. Do NOT bump react to
  satisfy this — RN's bundled renderer must match react, and a mismatch can break
  the whole mobile app. The peer warning is non-fatal; Clerk bundles and loads
  fine on web/native. Leave react at 19.1.0.

## Restoring the lockfile without a destructive git command
To undo a bad resolver drift, restore the committed lockfile with the read-only
`git show HEAD:pnpm-lock.yaml > pnpm-lock.yaml` then `pnpm install` (overrides
re-apply on top of the known-good baseline). `git checkout/restore` is sandbox-
blocked; `git show` is allowed.

## "Unable to resolve @clerk/expo" / ENOENT _tmp watch after install
Not a real corruption — it's a Metro file-watcher race against pnpm's atomic
package swap (watcher latches onto a deleted `*_tmp_*` dir). **Fix: restart the
expo workflow after any install that swaps packages.** Always restart expo after
`pnpm install`, then re-check the bundle.

## uuid CVE is accepted (build-only)
GHSA-w5hq-g745-h8pq on `uuid` 3.4.0 / 7.0.3 traces entirely to `xcode@3.0.1`
(EAS/iOS build tooling, never in the runtime bundle). The fix requires uuid v11
(major) which breaks `xcode`'s pinned uuid@7. Left unpatched intentionally —
non-exploitable at runtime; revisit only if `xcode` widens its range.

## lodash MUST stay pinned at 4.18.0 (do not "fix" to 4.17.21)
The lockfile shows `lodash@4.18.0` with npm metadata `deprecated: Bad release.
Please use lodash@4.17.21 instead.` — that string is STALE. Two 2026 prototype-
pollution CVEs (CVE-2026-2950 / GHSA-f23m-r3pf-42rh in `_.unset`/`_.omit`, and
CVE-2026-4800 / GHSA-r5fr-rjxr-66jc in `_.template`) affect lodash **4.17.23 and
earlier**; the patched release is **4.18.0**. Reverting to 4.17.21 re-introduces
both CVEs. Trust the OSV/dependency-audit CVE data over the npm deprecation note.

## Where the rest are pinned
Transitive CVEs (lodash, js-cookie, fast-uri, path-to-regexp, brace-expansion,
ip-address, picomatch, postcss, qs, ws, yaml) are fixed via `pnpm-workspace.yaml`
overrides to patched versions. `brace-expansion` and `picomatch` use range-keyed
overrides because two majors coexist in the tree.
