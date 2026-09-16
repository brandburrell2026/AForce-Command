import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const screen = readFileSync(join(ROOT, 'components', 'oneBreath', 'OneBreathScreen.tsx'), 'utf8');

describe('One Breath text-first containment', () => {
  it('keeps drafts local and review-only', () => {
    expect(screen).toContain('LOCAL DRAFT · NOT SAVED · NO VOICE CAPTURE');
    expect(screen).toContain('No command, action, or data has been saved.');
  });

  it('does not add microphone capture, transcription, persistence, or network transport', () => {
    for (const prohibited of ['expo-av', 'expo-audio', 'expo-speech-recognition', 'AsyncStorage', 'fetch(']) {
      expect(screen).not.toContain(prohibited);
    }
  });
});
