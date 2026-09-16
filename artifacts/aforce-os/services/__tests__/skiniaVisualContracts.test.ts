import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unavailableBaseline, unknownQualityGate } from '../skiniaVisualContracts';

const source = readFileSync(resolve(__dirname, '..', 'skiniaVisualContracts.ts'), 'utf8');

describe('SkinIA quality and baseline contracts', () => {
  it('defaults the quality gate to unknown and blocks an observation', () => {
    expect(unknownQualityGate()).toEqual({
      scope: 'DEVICE_LOCAL_FUTURE_INTERFACE',
      state: 'UNKNOWN',
      rawImagePolicy: 'EPHEMERAL_ONLY_NEVER_PERSIST',
      nextAction: 'DO_NOT_PRODUCE_OBSERVATION',
    });
  });

  it('allows only approved unavailable baseline states and never invents a comparison', () => {
    for (const reason of ['NOT_ENOUGH_INFORMATION', 'NO_COMPARABLE_BASELINE'] as const) {
      expect(unavailableBaseline(reason)).toMatchObject({
        state: reason,
        comparisonPolicy: 'PERSONAL_BASELINE_ONLY',
        nextAction: 'DO_NOT_PRODUCE_OBSERVATION',
      });
    }
  });

  it('makes the raw-image policy explicit without accepting visual input', () => {
    expect(source).toContain('EPHEMERAL_ONLY_NEVER_PERSIST');
    expect(source).toContain('function unknownQualityGate()');
    expect(source).not.toContain('image:');
  });

  it('contains no camera, file, persistence, model, or network capability', () => {
    for (const forbidden of ['expo-camera', 'CameraView', 'requestCameraPermissionsAsync', 'ImagePicker', 'fetch(', 'AsyncStorage', 'SecureStore', 'FileSystem', 'upload', 'inference']) expect(source, forbidden).not.toContain(forbidden);
  });

  it('does not introduce scoring, hydration, diagnosis, or recommendations', () => {
    for (const forbidden of ['score', 'hydration', 'diagnosis', 'recommendation', 'RecoveryCommand']) expect(source, forbidden).not.toContain(forbidden);
  });
});
