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

## Use-of-Funds order follows the Credit Memorandum, NOT dollar value (slide 23 / TheAsk)
The USE array order is: Manufacturing & Inventory $1.6M, **Sales & Marketing
$800K, Operating Expenses $850K** (note: S&M before OpEx even though S&M is
smaller), R&D / AForce OS™ $350K, Distribution & Fulfillment $300K, Working
Capital Reserve $100K. Total $4.0M.
**Why:** it was briefly value-sorted descending (a deliberate visual choice),
but the owner's "FINAL DECK CONSISTENCY UPDATE" explicitly listed the order to
match the Credit Memorandum / Use of Proceeds Schedule, which supersedes the
value-sort. So the smaller-bar-before-bigger-bar (20% above 21.25%) is INTENDED.
**How to apply:** keep this exact memo order; do not "fix" it by re-sorting by
amount. If a future request asks to re-sort by value, confirm it isn't undoing
the memo alignment.

## Disclosure styling convention
Custom dark-gray institutional disclosures: `font-body`, dark gray `text-[#555]`
(fine print ~`text-[#777]`/`#888`), ~0.6–0.82vw, Inter, institutional tone.
`ProjectionDisclaimer` itself is italic light-gray `#aaa` 0.58vw — do not reuse
its component for these custom disclosures.

## Capitalization fact wording
Credit-memo-exact: "Approximately $832,000 raised from 18 SAFE investors."
Slide 21 already shows it in the support strip ("$832,000 SAFE Capital from 18
Investors"); the footnote was added bottom-right on slide 23.
