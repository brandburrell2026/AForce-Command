# Ruling change: HydroScan reads the drink label on the device (2026-11-21)

Status: approved by Brandon (founder) on 2026-11-21 for the **flagged reader only**. Nothing here is on for members. The flag `hydroscan_label_reader_enabled` is off by default, is an internal-tier flag (clamped in public builds), and the existing barcode scanner is what the Scan screen renders with the flag off.

## What changed

Before: Scan is barcode only (founder decision 2026-11-20). The camera reads a barcode, takes no picture, and the Scan laws ban any capture path.

Now, for the flagged reader only: one camera reads the barcode **and** the visible label text, on the device, so a member can point at the front of a can or bottle and log what they drank. About once a second the reader takes a still as an in-memory reference, an on-device text recognizer reads it (Apple Vision on iOS, ML Kit bundled Latin model on Android), and the reference is released.

Conditions that go with the approval (each is pinned by `components/__tests__/hydroscanLabelReaderLaw.test.ts`):

- Images are temporary. Never saved to disk, never uploaded.
- No image, frame or raw label text goes to storage, analytics, logs or any network call. Only the barcode digits (or a catalog id the member confirmed) are looked up, as today.
- Recognised text is never passed to the Open Food Facts lookup or to `postScanMut`.
- The member confirms the drink and the amount; saving happens only on "Log it", through the Scan screen's own guarded write.

## What is unchanged

- D1: no health or hydration score on Scan. There is **no HydroState ring on the Done card**.
- D3 (provenance), D4 (no physiological assertion), D5 (unknown is not zero), D6 (no brand-conditional copy or hierarchy).
- Water counts on the scored rail; every other drink, alcohol included, goes to the private drink log through `postRecordedDrink`, which can never move HydroState. Alcohol is offered only where `drinkAvailability` allows it (SS-26: dev and internal TestFlight).
- `scoringEngine.ts` and `statusColor.ts` are not touched.
- Every existing Scan law test applies unchanged to the existing scanner. No pinned assertion was changed. The new reader's files have their own laws.

## Still open before this can ship to anyone outside the internal build

1. **Camera permission wording.** `app.json` still says: "AForce OS uses your camera to scan hydration product barcodes." (`NSCameraUsageDescription`), and the expo-camera plugin text mentions "approved scans". Neither describes reading a drink label. New wording needs approval, then an `app.json` change and a new native build. `app.json` was deliberately not changed here.
2. **The native module is a new native dependency** (`modules/hydroscan-label-text`). It needs an EAS build; the existing TestFlight binaries do not contain it, and the reader degrades to barcode only there.
3. **Member-facing wording review** of every new line (the list is `LABEL_COPY` in `components/scan/hydroscan/HydroScanLabelSheets.tsx` plus the engine's question texts).
4. **Privacy and legal review** of "on-device label reading" copy and the privacy policy's camera language (CLAUDE.md: the camera surface was dark pending legal; this approval covers the flagged reader as the founder stated, and legal should confirm).
5. The benchmark in `BENCHMARK.md` and the device checks in `DEVICE-TEST.md` have not been run (all "Not run").
