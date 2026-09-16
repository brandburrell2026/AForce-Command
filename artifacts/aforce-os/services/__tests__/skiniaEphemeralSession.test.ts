import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { skinIAEphemeralCleanupRequirement, type SkinIAEphemeralExit } from '../skiniaEphemeralSession';

const source = readFileSync(resolve(__dirname, '..', 'skiniaEphemeralSession.ts'), 'utf8');
const exits: SkinIAEphemeralExit[] = ['COMPLETED', 'CANCELLED', 'FAILED', 'TIMED_OUT', 'CONSENT_WITHDRAWN', 'ABANDONED'];

describe('SkinIA ephemeral session lifecycle contract', () => {
  it('requires immediate raw-image deletion for every exit path', () => {
    for (const exit of exits) {
      const requirement = skinIAEphemeralCleanupRequirement(exit);
      expect(requirement.exit).toBe(exit);
      expect(requirement.rawImageDisposition).toBe('DELETE_IMMEDIATELY');
      expect(requirement.imagePersistence).toBe('PROHIBITED');
    }
  });

  it('forbids every approved persistent and secondary-use surface', () => {
    expect(skinIAEphemeralCleanupRequirement('CONSENT_WITHDRAWN').blockedSurfaces).toEqual([
      'STORAGE', 'DATABASE', 'LOGS', 'ANALYTICS', 'CACHE', 'BACKUPS', 'CRASH_REPORTS', 'MODEL_TRAINING', 'IDENTITY_TEMPLATES',
    ]);
  });

  it('blocks observations until validation rather than producing a fallback result', () => {
    expect(skinIAEphemeralCleanupRequirement('FAILED').observationDisposition).toBe('DO_NOT_PRODUCE_OBSERVATION_UNTIL_VALIDATED');
  });

  it('contains no capture, file, persistence, model, analytics, or network implementation', () => {
    for (const forbidden of ['expo-camera', 'CameraView', 'requestCameraPermissionsAsync', 'ImagePicker', 'fetch(', 'AsyncStorage', 'SecureStore', 'FileSystem', 'upload', 'inference', 'analytics.track']) expect(source, forbidden).not.toContain(forbidden);
  });
});
