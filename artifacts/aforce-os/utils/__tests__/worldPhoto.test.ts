import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PROTOCOL_SCENES,
  WORLD_EMPTY_SCENE,
  WORLD_SCENES,
  worldPhotosAvailable,
  worldSceneForMoment,
  worldSceneForWords,
} from '../worldPhoto';

const AOS = join(__dirname, '..', '..');

describe('World photographs — where they may show', () => {
  it('development and internal builds only; never a public build', () => {
    expect(worldPhotosAvailable({ dev: false, internalTestflight: false })).toBe(false);
    expect(worldPhotosAvailable({ dev: true, internalTestflight: false })).toBe(true);
    expect(worldPhotosAvailable({ dev: false, internalTestflight: true })).toBe(true);
  });

  it('the image file never hands out a photograph without asking that question', () => {
    const src = readFileSync(join(AOS, 'components', 'world', 'worldPhotoSources.ts'), 'utf8');
    expect(src).toMatch(/return worldPhotosAvailable\(\) \? WORLD_PHOTO_SOURCES\[scene\] : undefined;/);
    // Screens go through worldPhoto / worldPhotoForMoment, not the raw table.
    for (const f of [
      'components/home/cinematic/HomeCinematicContainer.tsx',
      'components/moments/cinematic/ProtocolsScreen.tsx',
      'components/editorial/moments/EditorialMomentsScreen.tsx',
    ]) {
      expect(readFileSync(join(AOS, f), 'utf8'), f).not.toContain('WORLD_PHOTO_SOURCES');
    }
  });
});

describe('World photographs — the files', () => {
  it('every scene has one file, every file is a scene, and each is wired', () => {
    const files = readdirSync(join(AOS, 'assets', 'world')).filter((f) => f.endsWith('.jpg')).sort();
    expect(files).toEqual([...WORLD_SCENES].map((s) => `${s}.jpg`).sort());
    const src = readFileSync(join(AOS, 'components', 'world', 'worldPhotoSources.ts'), 'utf8');
    for (const scene of WORLD_SCENES) {
      expect(existsSync(join(AOS, 'assets', 'world', `${scene}.jpg`))).toBe(true);
      expect(src).toContain(`import ${scene} from '@/assets/world/${scene}.jpg';`);
      expect(src).toMatch(new RegExp(`\\n  ${scene},\\n`));
    }
  });
});

describe('World photographs — which scene', () => {
  const m = (title: string, type: Parameters<typeof worldSceneForMoment>[0] extends infer M ? M extends { type: infer T } ? T : never : never, masked = false) =>
    ({ title, type, masked });

  it('reads the Moment\'s own words first', () => {
    expect(worldSceneForMoment(m('Team dinner', 'personal'))).toBe('dinner');
    expect(worldSceneForMoment(m('Morning lift', 'training'))).toBe('gym');
    expect(worldSceneForMoment(m('5K with Sam', 'training'))).toBe('run');
    expect(worldSceneForMoment(m('Pickleball', 'performance'))).toBe('pickleball');
    expect(worldSceneForMoment(m('Investor meeting', 'work'))).toBe('presentation');
    expect(worldSceneForMoment(m('Flight to LA', 'travel'))).toBe('travel');
    expect(worldSceneForMoment(m("Dana's birthday", 'personal'))).toBe('celebration');
    expect(worldSceneForMoment(m('Flag football', 'performance'))).toBe('football_night');
  });

  it('whole words only', () => {
    expect(worldSceneForWords('Runway show')).toBeNull();
    expect(worldSceneForWords('Bedford visit')).toBeNull();
    expect(worldSceneForWords('Update the datebook')).toBeNull();
  });

  it('falls back to the kind of Moment when the words name nothing', () => {
    expect(worldSceneForMoment(m('Quarterly thing', 'work'))).toBe('mb_work');
    expect(worldSceneForMoment(m('Something', 'personal'))).toBe('mb_social');
    expect(worldSceneForMoment(m('Something', 'recovery'))).toBe('yoga_night');
    expect(worldSceneForMoment(m('Something', 'performance'))).toBe('mb_sport');
  });

  it('a private Moment is never matched on its hidden title', () => {
    expect(worldSceneForMoment(m('Dinner with the board', 'work', true))).toBe('mb_work');
  });

  it('no Moment yet: the one empty-state scene', () => {
    expect(worldSceneForMoment(null)).toBe(WORLD_EMPTY_SCENE);
    expect(WORLD_SCENES).toContain(WORLD_EMPTY_SCENE);
  });

  it('the Protocols tiles pair as the prototype does', () => {
    expect(PROTOCOL_SCENES).toEqual({ recovery: 'yoga_night', sleep: 'bedtime', travel: 'travel' });
  });
});
