import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '..', 'advancedVisual', 'SkinIAObservationResultsFixture.tsx'), 'utf8');

describe('SkinIA observation results fixture', () => {
  it('is explicitly a static internal fixture, not a member result', () => {
    expect(source).toContain("kind: 'STATIC_TEST_FIXTURE'");
    expect(source).toContain('INTERNAL FIXTURE / NOT A MEMBER RESULT');
    expect(source).toContain('not connected');
  });

  it('uses only approved observation vocabulary and comparative labels', () => {
    for (const observation of ['VISIBLE_DRYNESS', 'VISIBLE_FLAKING', 'VISIBLE_REDNESS', 'VISIBLE_SURFACE_SHINE', 'VISIBLE_TEXTURE']) expect(source).toContain(observation);
    for (const comparison of ["'MORE'", "'LESS'", "'SIMILAR'"]) expect(source).toContain(comparison);
    expect(source).toContain('Visible surface shine');
  });

  it('states the non-diagnostic and no-hydration boundary', () => {
    expect(source).toContain('does not diagnose conditions or measure hydration');
  });

  it('contains no image, capture, persistence, model, or network capability', () => {
    const implementation = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['expo-camera', 'CameraView', 'requestCameraPermissionsAsync', 'ImagePicker', 'fetch(', 'AsyncStorage', 'SecureStore', 'upload', 'inference']) expect(implementation, forbidden).not.toContain(forbidden);
  });

  it('does not introduce scores, medical language, or actions', () => {
    for (const forbidden of ['Skin State', 'score', 'diagnosis', 'treatment', 'RecoveryCommand', 'recommendation']) expect(source, forbidden).not.toContain(forbidden);
  });
});
