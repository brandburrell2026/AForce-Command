---
name: aforce-pitch lender disclosures & figure consistency
description: Conventions for the recurring "add lender/credit-memo disclosures to aforce-pitch slides" task — disclaimer dedup, use-of-funds ordering, canonical figures.
---

# aforce-pitch lender / credit-memo disclosure edits

Recurring task: add lender/investor-grade disclosures and small content edits to
named slides in the investor deck (artifacts/aforce-pitch). Keep design/numbers
intact; add verbatim text, small/institutional styling.

## Don't stack duplicate disclaimers
`components/ProjectionDisclaimer.tsx` is the canonical projection footnote and
already says "...management assumptions... Actual results may vary materially."
**Why:** when a request asks to add a new "actual results may differ" style
disclosure to a slide that already renders `ProjectionDisclaimer`, showing both
looks like sloppy redundant fine-print on a lender-ready slide.
**How to apply:** replace the slide's `ProjectionDisclaimer` with the requested
verbatim text (remove the now-unused import) rather than rendering two near-
identical disclaimers. Other slides keep `ProjectionDisclaimer`.

## Use-of-Funds is intentionally value-sorted (slide 23 / TheAsk)
The USE array is ordered **descending by dollar amount** (Operating Expenses
$850K before Sales & Marketing $800K).
**Why:** an explicit prior owner request established this order; it is a
deliberate visual choice. A Credit-Memo "categories should read" list may type
them in a different order (e.g. S&M before OpEx) incidentally.
**How to apply:** when a memo list's order differs, apply the terminology/amount
changes but do NOT silently re-sort — confirm with the owner first.

## Disclosure styling convention
Custom dark-gray institutional disclosures: `font-body`, dark gray `text-[#555]`
(fine print ~`text-[#777]`/`#888`), ~0.6–0.82vw, Inter, institutional tone.
`ProjectionDisclaimer` itself is italic light-gray `#aaa` 0.58vw — do not reuse
its component for these custom disclosures.

## Capitalization fact wording
Credit-memo-exact: "Approximately $832,000 raised from 18 SAFE investors."
Slide 21 already shows it in the support strip ("$832,000 SAFE Capital from 18
Investors"); the footnote was added bottom-right on slide 23.
