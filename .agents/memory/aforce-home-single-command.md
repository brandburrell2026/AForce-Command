---
name: AForce Home layout — simplified single-command was built then reverted
description: The single-command Home (command block + one CTA via homeCommand) was built then owner-reverted on 2026-06-23 back to the prior orb-focused Home. homeCommand.ts stays in-tree but unused. Rules below apply only if it is reintroduced.
---

# Current state: Home is the orb-focused layout (NOT the single-command Home)

On 2026-06-23 the owner asked to make Home "look like it did at the end of day
yesterday" (a clean orb-focused screen) and `app/(tabs)/index.tsx` was restored
to its 2026-06-22 EOD version. So the LIVE Home is:

readiness eyebrow → status headline → orb → status label → LiveStatusLine →
consequence → status-based primary CTA → EntryActions grid → HomeDashboard
(Hydration Status) → flag-gated zones inline (Metabolic/Perf-Age/Voice/Activation,
each renders nothing when its flag is off) → AFORCE brand footer (absolutely
pinned at the bottom). The large orb pushes everything after the consequence
below the fold, which is why the top of the screen reads as just orb + footer.

**The single-command Home was reverted, not kept:** there is currently NO
`home-command-block`, NO command-driven CTA, and NO `home-secondary-scan` chip on
Home. The CTA is the generic status-based one (`onPrimaryCta`, label
`status.ctaText`). `utils/homeCommand.ts` and `utils/__tests__/homeCommand.test.ts`
still exist in the tree but are UNUSED by Home — do not assume Home renders them.

**Why:** the owner tried the simplified single-command Home (shipped earlier the
same day) and preferred the previous orb-focused layout. The revert was scoped to
the Home screen file only; the i18n/label renames and onboarding-intro changes that
shipped alongside the simplify were left intact (different surfaces).

**How to apply:** before editing Home, read the live `app/(tabs)/index.tsx` — do
not trust older notes (or replit.md's "simplified Home" wording) that describe a
command-block Home. If asked to bring the single-command Home back, the contract +
rules below still apply.

---

# IF REINTRODUCED: simplified Home = exactly ONE command + ONE CTA (dormant contract)

When `SHOW_EXPANDED_HOME = false`, the simplified Home reads top-to-bottom:
readiness hero → Hydration Status card → ONE command block → ONE primary CTA. The
single command is derived by the pure, RN-free `utils/homeCommand.ts` resolver
(priority: water → recovery → protocol → scan), and its CTA owns every action —
including "scan a drink" via the `scan_drink` command.

**Rule:** any *other* actionable button on Home (e.g. the `HydrationStatusCard`
in-card "SCAN A DRINK" button, exposed via its `onScan` prop) must be gated to
expanded mode — pass it `onScan` only when `SHOW_EXPANDED_HOME` is true. If it
renders in simplified mode it becomes a SECOND CTA and can let a non-water action
sit beside/above the water command.

**Why:** the simplified-Home contract is one instruction + one action, and
Water-First means no action may compete with or precede the water command. A stray
always-on card button silently breaks both. (Caught in architect review.)

**Owner-approved exception (only relevant in the single-command Home):** a single
deliberately *secondary* "Scan Drink" chip (`testID home-secondary-scan`) under the
Hydration Status card was sanctioned, gated
`!SHOW_EXPANDED_HOME && command.actionType !== 'scan_drink'`, muted (no brand
accent), reusing `onCommandCta('scan_drink')` → `/scan` (navigation only, never
logs/scores). It was removed by the 2026-06-23 revert along with the command block.

## homeCommand Water-First: no-fluid-logged ⇒ water leads (still true of the helper)

`homeCommand` treats `unitsConsumedToday <= 0` (or a null last-intake timestamp)
as "behind pace", so the water command leads even at an optimal score with a recent
timestamp. Both signals are honored so the caller can supply either and water is
never skipped when nothing has been logged today. Don't let `unitsConsumedToday`
become a dead input — it gates the water branch. (Applies if the helper is wired
back into Home.)
