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
});
