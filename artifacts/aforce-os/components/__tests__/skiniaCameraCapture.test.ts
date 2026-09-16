import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '..', 'advancedVisual', 'SkinIACameraCaptureScreen.tsx'), 'utf8');

describe('SkinIA controlled camera capture', () => {
  it('uses the approved editorial scan framing and clear user-triggered permission flow', () => {
    for (const label of ['SKINIA VISUAL CHECK / SCAN', 'ALIGN FACE / EVEN LIGHT / NO FILTERS', 'Capture quality', 'Capture review image']) expect(source).toContain(label);
    expect(source).toContain('onRequest={() => { void requestPermission(); }}');
  });

  it('uses an ephemeral native picture reference, not a preview file or encoded payload', () => {
    expect(source).toContain("takePictureAsync({ pictureRef: true");
    expect(source).toContain('picture.release();');
    const implementation = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['base64:', 'exif:', 'uri:', 'FileSystem', 'AsyncStorage', 'SecureStore', 'fetch(', 'upload']) expect(implementation, forbidden).not.toContain(forbidden);
  });

  it('discards the capture and produces no visual observation in this increment', () => {
    expect(source).toContain('Capture cleared.');
    expect(source).toContain('does not produce a visual observation');
    expect(source).toContain('Do not retain the native reference');
  });

  it('preserves denied, unavailable, and cancel-safe states', () => {
    for (const label of ['PERMISSION DENIED', 'UNKNOWN', 'Cancel and discard']) expect(source).toContain(label);
    expect(source).toContain('isLive.current = false');
  });
});
