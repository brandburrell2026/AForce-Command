/**
 * HydroScan label reader: the laws of the NEW flagged reader (2026-11-21).
 *
 * The earlier Scan laws (editorialScanLaw, scanProducerSafety, hydroScanUnknown)
 * keep applying UNCHANGED to the existing barcode scanner, which is what the
 * Scan screen renders with the flag off. This file gives the new files their own
 * equally strict rules. Only the reader may take a still, and only as an
 * in-memory reference.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(AOS, ...p), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const FILES = {
  reader: join('components', 'scan', 'hydroscan', 'HydroScanLabelReader.tsx'),
  sheets: join('components', 'scan', 'hydroscan', 'HydroScanLabelSheets.tsx'),
  film: join('components', 'scan', 'hydroscan', 'HydroScanFilm.tsx'),
  lock: join('utils', 'hydroscan', 'lockOn.ts'),
  fill: join('utils', 'hydroscan', 'fillAmount.ts'),
  engine: join('utils', 'hydroscan', 'labelEvidence.ts'),
  amount: join('utils', 'hydroscan', 'amountOptions.ts'),
  log: join('utils', 'hydroscan', 'labelDrinkLog.ts'),
  barcode: join('utils', 'hydroscan', 'barcodeCandidate.ts'),
  module: join('modules', 'hydroscan-label-text', 'index.ts'),
};
const src = (k: keyof typeof FILES) => strip(read(FILES[k]));
const ALL = Object.keys(FILES) as (keyof typeof FILES)[];
const screen = () => strip(read('components', 'editorial', 'scan', 'EditorialScanScreen.tsx'));

describe('PRIVACY — no image, frame or label text is stored, sent, logged or emitted', () => {
  it.each(ALL)('%s has no network, analytics, logging or storage path of its own', (k) => {
    const s = src(k);
    expect(s).not.toMatch(/\bfetch\s*\(/);
    expect(s).not.toMatch(/\bemit\s*\(|event_dispatcher|\banalytics\b|useAnalyticsRecorder/i);
    expect(s).not.toMatch(/\bconsole\./);
    expect(s).not.toMatch(/AsyncStorage|scopedStorage|SecureStore|localStorage|FileSystem|MediaLibrary|expo-file-system/);
    expect(s).not.toMatch(/XMLHttpRequest|WebSocket|FormData|\bupload/i);
    expect(s).not.toMatch(/\.uri\b|base64|writeAsync|saveToLibrary/i);
  });

  it('recognised text is never passed to the Open Food Facts lookup, postScan or any service', () => {
    for (const k of ALL) {
      const s = src(k);
      expect(s, k).not.toMatch(/openFoodFacts|lookupBarcode|postScanMut|usePostScan|postScan\b/);
    }
    // The barcode path hands over digits or a catalog id, never lines.
    const barcode = src('barcode');
    expect(barcode).toMatch(/rawValue:\s*code/);
    expect(barcode).toMatch(/rawValue:\s*productId/);
    expect(barcode).not.toMatch(/\blines?\b|\btext\b/);
    const reader = src('reader');
    const handler = /const handleBarcode = [\s\S]*?\n {4}\[ingest, onHandOff\],\n {2}\);/.exec(reader)?.[0] ?? '';
    expect(handler, 'the barcode handler must be locatable').not.toBe('');
    expect(handler).not.toMatch(/\blines\b/);
    // Lines go only to the engine.
    expect((reader.match(/\blines\b/g) ?? []).length).toBeLessThanOrEqual(6);
    expect(reader).toMatch(/ingest\(\{ lines \}, epoch\)/);
  });

  it('the engine state holds signals, and the module returns only text, confidence and a box', () => {
    expect(src('engine')).not.toMatch(/\brawText\b|\.text\s*\)?\s*\.push|lines:\s*readonly LabelLine\[\]\s*;\s*\n\s*readonly overrides/);
    expect(src('module')).toMatch(/parseHydroScanTextResult/);
  });

  it('the native sources write no file, make no network call and log nothing', () => {
    const sources = [
      read('modules', 'hydroscan-label-text', 'ios', 'HydroScanLabelTextModule.swift'),
      read('modules', 'hydroscan-label-text', 'android', 'src', 'main', 'java', 'com', 'aforce', 'hydroscan', 'HydroScanLabelTextModule.kt'),
    ].map((t) => t.replace(/\/\/[^\n]*/g, ''));
    for (const t of sources) {
      expect(t).not.toMatch(/URLSession|HttpURLConnection|OkHttp|\.write\(|FileOutputStream|FileManager|createTempFile|compress\(|NSLog|\bprint\(|Log\.[dviwe]\(|UIImageWriteToSavedPhotosAlbum/);
    }
    expect(sources[0]).toMatch(/VNRecognizeTextRequest/);
    expect(sources[0]).toMatch(/recognitionLevel = \.accurate/);
    expect(sources[1]).toMatch(/TextRecognition\.getClient/);
    const gradle = read('modules', 'hydroscan-label-text', 'android', 'build.gradle');
    expect(gradle, 'bundled model, not the play-services download').toMatch(/com\.google\.mlkit:text-recognition:/);
    expect(gradle).not.toMatch(/play-services-mlkit/);
  });
});

describe('CAPTURE — only the reader takes a still, in memory, about once a second, never overlapping', () => {
  it('takePictureAsync appears once, in the reader, as a silent in-memory reference', () => {
    for (const k of ALL) {
      if (k === 'reader') continue;
      expect(src(k), k).not.toMatch(/takePicture|takePhoto|captureAsync|shutterSound/);
    }
    const s = src('reader');
    expect((s.match(/takePictureAsync\(/g) ?? []).length).toBe(1);
    expect(s).toMatch(/takePictureAsync\(\{ pictureRef: true, shutterSound: false, skipProcessing: true, quality: 0\.4 \}\)/);
  });

  it('the reference is released in a finally, and the next sample is scheduled only after it', () => {
    const s = src('reader');
    expect(s).toMatch(/finally \{\s*try \{\s*picture\?\.release\(\);/);
    expect((s.match(/setTimeout\(\(\) => void tick\(\)/g) ?? []).length).toBe(2); // first, and the one in finally
    const fin = /finally \{[\s\S]*?\n {6}\}\n {4}\};/.exec(s)?.[0] ?? '';
    expect(fin).toMatch(/if \(!stopped\) timer = setTimeout/);
    expect(s).toMatch(/SAMPLE_INTERVAL_MS = 1000/);
  });

  it('samples stop for a result, a question, a closed or paused Scan, and the background', () => {
    const s = src('reader');
    expect(s).toMatch(/const cameraActive = granted && !paused && appActive && phase === 'reading' && reading\.status === 'reading';/);
    expect(s).toMatch(/AppState\.addEventListener\('change', \(next\) => setAppActive\(next === 'active'\)\)/);
    expect(s).toMatch(/onBarcodeScanned=\{cameraActive \? handleBarcode : undefined\}/);
    expect(s).toMatch(/if \(!cameraActive \|\| !textOn\) return;/);
    expect(s).toMatch(/return \(\) => \{\s*stopped = true;/);
    expect(s).toMatch(/epochRef\.current \+= 1;/);
  });

  it('without the native text module the reader samples nothing and is the barcode reader', () => {
    expect(src('reader')).toMatch(/hydroScanLabelTextAvailable\(\)/);
    // The film layout (2026-11-23): with no text module the hint asks for the barcode.
    expect(src('reader')).toMatch(/mode === 'barcode' \|\| !textOn\s*\?\s*FILM_COPY\.hintBarcode/);
  });

  it('evidence is cleared for a different drink and on Scan again', () => {
    const s = src('reader');
    expect(s).toMatch(/setEvidence\(createEvidence\(\)\)/);
    expect(s).toMatch(/if \(wasPaused\.current && !paused\) resetAll\(\)/);
    expect(src('sheets')).toMatch(/LABEL_COPY\.scanAgain/);
  });
});

describe('SEAM — the flag decides, and with it off the screen is the barcode scanner', () => {
  it('the screen mounts the new reader only behind hydroscanLabelReaderAvailable', () => {
    const s = screen();
    expect(s).toMatch(/hydroscanLabelReaderAvailable\(state\.featureFlags\)/);
    expect((s.match(/<HydroScanLabelReader\b/g) ?? []).length).toBe(1);
    expect(s).toMatch(/\{labelReaderOn \? \(\s*<HydroScanLabelReader/);
    expect(s, 'the existing reader is the other branch').toMatch(/\) : \(\s*<LiveBarcodeReader/);
    expect(s).toMatch(/\{!outcome && !labelReaderOn \? \(/);
    expect(s, 'the screen itself never captures').not.toMatch(/takePicture|shutterSound|pictureRef/);
  });

  it('no route mounts the reader directly; it lives inside the Scan screen', () => {
    for (const r of [join('app', 'scan.tsx'), join('app', '(tabs)', 'scan.tsx')]) {
      expect(strip(read(r)), r).not.toMatch(/HydroScanLabelReader/);
    }
  });

  it('the reader is the only importer of the text module', () => {
    expect(screen()).not.toMatch(/hydroscan-label-text/);
    expect(src('reader')).toMatch(/@\/modules\/hydroscan-label-text/);
  });
});

describe('LOGGING — confirmed by the member, through the screen\'s own guarded write', () => {
  it('the reader never writes itself: saving is the onSave prop, and the drink rail is the screen\'s', () => {
    const r = src('reader');
    expect(r).not.toMatch(/logIntake|postRecordedDrink|drinkRoute\(/);
    expect(r).toMatch(/await onSave\(args\)/);
    expect(r).toMatch(/guardRef\.current\.begin\(drinkKey\(args, epochRef\.current\)\)/);
    // Nothing is saved on recognition: onSave is reached only from the Log it handler.
    expect((r.match(/onSave\(/g) ?? []).length).toBe(1);
    expect(r).toMatch(/onLog=\{\(\) => void doSave\(\)\}/);
    expect(r).toMatch(/onRetry=\{\(\) => void doSave\(\)\}/);
  });

  it('the screen\'s save reuses confirmInFlightRef and the store guards, and the existing counts hold', () => {
    const s = screen();
    const handler = /const saveLabelDrink = [\s\S]*?\n {2}\);/.exec(s)?.[0] ?? '';
    expect(handler).toMatch(/confirmInFlightRef\.current \|\| state\.isCompletingCycle \|\| state\.showCycleSuccess/);
    expect(handler).toMatch(/await onConfirmDrink\(args, true\)/);
    expect((s.match(/logIntake\(/g) ?? []).length).toBe(2);
    expect((s.match(/undoIntake\(/g) ?? []).length).toBe(1);
  });

  it('Undo for a non-water drink removes the saved entry by its id, and only with an id', () => {
    expect(src('reader')).toMatch(/removeRecorded: removeRecordedDrink/);
    expect(screen()).toMatch(/lastSavedRef\.current = typeof savedDrink\?\.id === 'number' \? \{ kind: 'recorded', id: savedDrink\.id \} : null;/);
  });

  it('alcohol is never logged from the reader, in any build', () => {
    expect(src('reader')).toMatch(/if \(reading\.drinkType\.value === 'alcohol' \|\| reading\.traits\.alcohol\.value === 'alcoholic'\) \{\s*setPhase\('alcohol'\);/);
    expect(src('reader')).not.toMatch(/&& !alcoholAllowed/);
    expect(src('reader')).toMatch(/id !== 'custom' && id !== 'alcohol'/);
  });

  it('a late barcode result cannot change a drink that is already on screen', () => {
    expect(src('reader')).toMatch(/openRef\.current = phase === 'reading' && reading\.status === 'reading';/);
    expect(src('reader')).toMatch(/if \(!openRef\.current\) return;/);
  });

  it('no HydroState ring, score or physiological claim on any new surface (D1, D4)', () => {
    // The reader's own controls moved to the film layout file (2026-11-23).
    for (const k of ['film', 'sheets'] as const) {
      const s = src(k);
      expect(s, k).not.toMatch(/hydration\s+score|health\s+score|recovery\s+score|readiness|HydroStateRing|\bring\b|\bscore\b/i);
      expect(s, k).not.toMatch(/\bdehydrat|your body (will|may|is)|\bwill (improve|restore|fix|boost)\b/i);
      expect(s, k).not.toMatch(/scoringEngine|statusColor/);
    }
    for (const k of ALL) expect(src(k), k).not.toMatch(/scoringEngine|statusColor/);
  });
});

describe('DESIGN — tokens, targets, labels, no emoji, no literal doses', () => {
  it('colors and fonts come from tokens', () => {
    // The reader's own controls moved to the film layout file (2026-11-23).
    for (const k of ['film', 'sheets'] as const) {
      expect(src(k), k).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src(k), k).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('no literal ounce or millilitre numbers in the member-facing components', () => {
    // The reader's own controls moved to the film layout file (2026-11-23).
    for (const k of ['film', 'sheets'] as const) {
      const noSizes = src(k).replace(/COMMON_SIZES_OZ[^;]*;/, '');
      expect(noSizes, k).not.toMatch(/['"`>]\s*\d+(\.\d+)?\s?(oz|ml|mL|fl oz)\b/);
    }
  });

  it('every control is labelled, has a role, and meets the 44pt floor', () => {
    // The reader's own controls moved to the film layout file (2026-11-23).
    for (const k of ['film', 'sheets'] as const) {
      const blocks = src(k).match(/<Pressable[\s\S]*?(?:\/>|<\/Pressable>)/g) ?? [];
      expect(blocks.length, k).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(b, k).toMatch(/accessibilityLabel=/);
        expect(b, k).toMatch(/accessibilityRole="button"/);
      }
      for (const m of src(k).matchAll(/minHeight:\s*(\d+)/g)) expect(Number(m[1]), k).toBeGreaterThanOrEqual(44);
    }
  });

  it('the four states are designed: starting, empty (hint), error (not logged), camera off', () => {
    const copy = src('sheets');
    expect(copy).toMatch(/startingCamera/);
    expect(copy).toMatch(/failedTitle: 'Not logged\.'/);
    expect(copy).toMatch(/cameraOffCaption/);
    expect(src('reader')).toMatch(/reading\.hint/);
    expect(src('reader')).toMatch(/HydroScanLabelSaveFailed/);
    expect(src('reader')).toMatch(/HydroScanLabelCameraOff/);
    expect(copy, 'Type it stays on the camera-off, card, question and type grid').toMatch(/hydroscan-label-type"/);
  });

  it('never claims a save that did not happen', () => {
    const copy = src('sheets');
    expect(copy, 'no string states a save or a log').not.toMatch(/['"][^'"\n]*\b(Saved|Logged)\b[^'"\n]*['"]/);
    expect(src('reader')).toMatch(/setPhase\('failed'\)/);
  });
});
