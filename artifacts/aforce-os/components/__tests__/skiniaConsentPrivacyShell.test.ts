import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '..', 'advancedVisual', 'AdvancedVisualIntelligenceScreen.tsx'), 'utf8');

describe('SkinIA consent and privacy shell', () => {
  it('states the non-diagnostic and no-hydration boundary', () => {
    expect(source).toContain('does not diagnose conditions or measure hydration');
    expect(source).not.toContain('Skin State');
  });
  it('states zero persistent raw-image retention and deletion events', () => {
    expect(source).toContain('ZERO PERSISTENT RETENTION');
    expect(source).toContain('must be deleted immediately');
    expect(source).toContain('storage, databases, logs, analytics, caches, backups, or crash reports');
  });
  it('contains no capture or OS permission capability', () => {
    const implementation = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['expo-camera', 'CameraView', 'requestCameraPermissionsAsync', 'ImagePicker', 'fetch(']) expect(implementation, forbidden).not.toContain(forbidden);
  });
  it('does not imply an acknowledgement begins a scan or stores consent', () => {
    expect(source).toContain('This acknowledgement does not begin a scan.');
    expect(source).toContain('No consent record is stored here.');
  });
  it('includes every authorized pre-capture and non-result state without forcing a result', () => {
    for (const label of ['CAPTURE GUIDANCE', 'PERMISSION DENIED', 'CAPTURE QUALITY INSUFFICIENT', 'NO COMPARABLE BASELINE', 'CONSENT REVOKED']) expect(source).toContain(label);
    expect(source).toContain('Status: UNKNOWN');
    expect(source).toContain('Status: NOT ENOUGH INFORMATION');
    expect(source).toContain('An unavailable result is never a favorable result.');
  });
  it('keeps every added screen non-capture and non-persistent', () => {
    expect(source).toContain('This screen does not open the camera.');
    expect(source).toContain('Any temporary raw image must be deleted immediately.');
    expect(source).toContain('There is no fallback photo-library path in this controlled build.');
  });
});
