# HydroScan ruling change, 2026-11-23: the film layout

**Decided by:** Brandon Burrell (founder), in session, 2026-11-23, after reviewing the
"Scan. Confirm. Done." sequence of `AFORCE_OS_HYDRATION_No_Protocols.mp4` (2:17 to 2:42).

**Scope:** the flagged label reader only (`hydroscan_label_reader_enabled`, internal builds).
The barcode-only Scan screen that members see with the flag off is unchanged, and the
rule that governs it (`editorialScanLaw.test.ts`: no capture control, no readout panel,
a frame that does not move) still stands for that screen.

## What changed

The 2026-11-20 decision left out the prototype's Drink mode, round capture button and
Container / Size / Level / Match panel, because the app then read a barcode and measured
nothing. The label reader now reads the label on the device, so for that reader:

| Was left out | Now, in the label reader |
|---|---|
| Drink mode | Drink, Barcode and Type it |
| Round capture button | The round N–И button asks for a read now. Reading also continues on its own. |
| Readout panel | Drink, Size, Level and Match. A field the reader did not resolve shows a dash. |
| A frame that does not move | The brackets settle around the drink when the phone reports reliable bounds, and go back to the middle when it does not. |
| Searching / Reading / Locked | Shown from what the reader actually read. A question is not a lock. |
| Amount choices | A container that empties: drag the line, or Sip, ¼, ½, ¾, All. |

## What did not change

- **No score on Scan (D1).** The film's HydroState ring on the Done screen is not built.
  It needs its own approval.
- **Nothing is measured that the phone cannot measure.** No liquid level is estimated in
  this pass, so Level always shows a dash and the amount screen starts with nothing
  chosen. The film's line "The camera suggests about half" is not used.
- **AFORCE packaging stays unverified** until the unit UPC, net contents and front-label
  text are supplied (`docs/hydroscan/DATA-GAPS.md`). The film's "Watermelon Surge, 12 fl oz"
  is a demo example, not a product fact.
- **Privacy.** Stills stay in memory and are released after each read. The only new things
  the phone's reader returns are one box around the drink, the picture's shape and one
  brightness number. None of it is stored, sent or logged.
- **One explicit Log.** Nothing is saved until the member taps Log on Review.
- **The label reader stays gated**, with the five open items in
  `RULING-CHANGE-2026-11-21.md` still open.

## Known limits of this pass

- Bounds around the drink come from iPhone object detection. Android falls back to the
  box around the label text, which hugs the label, not the whole container.
- An AFORCE can still hands off to the existing product card after "Looks like". Which
  rail an AFORCE can logs on in the film flow is a decision for the next milestone.
- None of this has run on a phone yet. See `FILM-RECORDING.md`.
