import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assessSkinIATechnicalQuality } from '../skiniaTechnicalQuality';

const source = readFileSync(resolve(__dirname, '..', 'skiniaTechnicalQuality.ts'), 'utf8');

describe('SkinIA technical quality gate', () => {
  it('accepts only usable technical capture metadata', () => {
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 1080, height: 1440 })).toEqual({ state: 'PASS', reason: 'TECHNICAL_METADATA_ACCEPTED' });
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 1206, height: 2622 })).toEqual({ state: 'PASS', reason: 'TECHNICAL_METADATA_ACCEPTED' });
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 2622, height: 1206 })).toEqual({ state: 'PASS', reason: 'TECHNICAL_METADATA_ACCEPTED' });
  });

  it('returns capture-quality-insufficient instead of forcing a result', () => {
    expect(assessSkinIATechnicalQuality({ cameraReady: false, width: 1080, height: 1440 })).toMatchObject({ state: 'CAPTURE_QUALITY_INSUFFICIENT' });
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 200, height: 1440 })).toMatchObject({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'DIMENSIONS_UNUSABLE' });
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 3000, height: 400 })).toMatchObject({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'ASPECT_RATIO_UNUSABLE' });
    expect(assessSkinIATechnicalQuality({ cameraReady: true, width: 400, height: 3000 })).toMatchObject({ state: 'CAPTURE_QUALITY_INSUFFICIENT', reason: 'ASPECT_RATIO_UNUSABLE' });
  });

  it('does not inspect pixels or create a skin observation', () => {
    const implementation = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['base64', 'pixel', 'face', 'image:', 'inference', 'fetch(', 'AsyncStorage', 'SecureStore']) expect(implementation, forbidden).not.toContain(forbidden);
  });
});
