# HydroScan label reader: device test list

Build: an EAS build that contains `modules/hydroscan-label-text` and has `hydroscan_label_reader_enabled` on (internal TestFlight or a dev build). The native module has never been compiled or run. Every row below is **Not run**.

Before any row: confirm the screen shows "POINT AT THE LABEL" (the reader found the module) rather than "POINT AT BARCODE" (barcode-only fallback).

## The three first-demo checks

| # | Check | Pass when | Result |
|---|---|---|---|
| 1 | A reflective AFORCE can under glare | Never a wrong drink. Either the right product, or the hint "Tilt to reduce glare" then a result after tilting, or one short question. No confident wrong product. | Not run |
| 2 | A regular and a zero-sugar can of the same brand, barcodes facing away | Each is told apart from the label text alone, or one short question that names both. Never the wrong one without being asked. Switching from one can to the other resets (no carry-over). | Not run |
| 3 | A half-empty bottle | The size is read as the whole container (not the amount left). "How much did you drink?" offers half, all and Custom; nothing is preselected; the member's choice is what is logged. | Not run |

## Permissions and states

| Check | Pass when | Result |
|---|---|---|
| Camera permission denied (first ask) | "Camera is off for AFORCE" with Allow and Type it. Nothing is read. Type it works. | Not run |
| Permission denied permanently | Settings line shown, Type it works. | Not run |
| Offline (airplane mode) | Label reading still works (on device). Barcode of an unknown product gives no name and the label decides. A save fails with "Not logged" and Try again; nothing is claimed saved. Back online, Try again saves once. | Not run |
| Type it | From the camera, a card, a question and the type grid: opens the typed entry; closing it returns to a fresh reader. | Not run |
| Drink-type grid | "Pick a type" is on the camera at all times; choosing a type shows a card with the type from You. | Not run |
| Manual correction | Change type, change size (common size, Custom, Not sure) on the card; the card and the amount step follow. | Not run |
| Size likely vs confirmed | A single unmarked size shows "Likely" and the amount step offers the fallback amounts until "Size is right" is tapped. | Not run |
| Multipack | A 12-pack carton: asked whether the drink was one can of the unit size; "A different size" leaves the size unknown. | Not run |
| Alcohol (internal build) | A beer with ABV: becomes alcohol, goes to the private drink log, does not change today's total or HydroState. A "0.0%" or "non-alcoholic" can does not become alcohol. A can with no strength and a beer word asks. | Not run |
| Alcohol (ordinary build) | Not offered; "This looks like an alcoholic drink" with Scan again. (Needs a build with the internal flag on but SS-26 off, or a unit check; the flag itself is clamped in public builds.) | Not run |

## Logging

| Check | Pass when | Result |
|---|---|---|
| Duplicates | Double-tapping Log it, or tapping it while the save is in flight, creates one log. Holding the camera on the can after confirming creates none. | Not run |
| Second drink | After Done, a second drink (even the same one) logs normally. | Not run |
| Undo, water | Plain bottled water: Undo takes back the intake. | Not run |
| Undo, non-water | A soda: Undo removes the saved entry from the drink log (check the drink log list); "Removed from today." shown only after the server confirmed. | Not run |
| Undo without an id | If the save returned no id, no Undo button appears. | Not run |
| AFORCE hand-off | An AFORCE barcode, or an AFORCE label confirmed with "That's right", opens the existing result flow, not the amount step. | Not run |

## Lifecycle and speed

| Check | Pass when | Result |
|---|---|---|
| Backgrounding stops the camera | Home button while reading: no samples are taken (watch for the camera indicator going off); returning resumes reading. | Not run |
| Closing Scan | No sampling after close; no crash from a late result. | Not run |
| Result on screen | While a card or question is shown, no new samples; Scan again resumes with cleared evidence. | Not run |
| Older phone responsiveness | On the oldest supported iPhone and a mid-range Android: the preview stays smooth, barcode reads as fast as the old scanner, a sample every second does not stutter the UI, the phone does not get warm in two minutes. | Not run |
| Orientation of the still | Text is read with the phone upright and rotated 90 degrees (the still is taken with `skipProcessing`, so orientation handling in the native code needs a look). | Not run |
| Torch | The light still works while reading. | Not run |
| Flag off | With the flag off the screen is the old barcode scanner, unchanged. | Not run |
