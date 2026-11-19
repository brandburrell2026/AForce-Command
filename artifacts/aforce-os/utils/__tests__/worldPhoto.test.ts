import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CALENDAR_SCENE,
  CIRCLES_SCENE,
  FIRST_MOMENT_SCENES,
  HYDRATION_SCENE,
  MOMENT_SCENES,
  MOMENTS_TAB_SCENE,
  PROFILE_SCENE,
  PROTOCOL_SCREEN_SCENES,
  REPLAY_SCENE,
  SCREEN_SCENES,
  WELCOME_SCENE,
  worldDetailSceneForMoment,
  worldBreathSceneForMoment,
  travelSceneForStage,
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

  it('the Protocols tiles and the screens they open each have their own', () => {
    expect(PROTOCOL_SCENES).toEqual({ recovery: 'tile_recovery', sleep: 'tile_sleep', travel: 'tile_travel' });
    expect(PROTOCOL_SCREEN_SCENES).toEqual({ recovery: 'screen_recovery', sleep: 'screen_sleep' });
  });
});

const TRAVEL_STAGE_SCENES = [
  travelSceneForStage(null), travelSceneForStage('preview'),
  travelSceneForStage('lock_in'), travelSceneForStage('arrival'),
];

describe('World photographs — Travel', () => {
  it('follows the journey: no trip, before leaving, in the air, arrived', () => {
    expect(TRAVEL_STAGE_SCENES).toEqual(['travel_page', 'travel_before', 'travel_air', 'travel_arrived']);
    // Arrived and ready are the same place on the same screen.
    expect(travelSceneForStage('ready')).toBe('travel_arrived');
  });

  it('never touches the city photographs, which still wait on licensed images', () => {
    const registry = readFileSync(join(AOS, 'utils/travel/cityRegistry.ts'), 'utf8');
    expect(registry).not.toMatch(/worldPhoto|assets\/world/);
    const view = readFileSync(join(AOS, 'components/travel/TravelJourneyView.tsx'), 'utf8');
    expect(view).not.toMatch(/worldPhoto|WorldPhoto/);
    expect(view).toContain('City photography coming');
  });
});

describe('World photographs — One Breath, as the prototype shows it', () => {
  const src = readFileSync(join(AOS, 'components/oneBreath/MomentPreparationScreen.tsx'), 'utf8');

  it('shows nothing while it listens: the opening screen has no photograph', () => {
    expect(src).toContain('const BREATH_SCENE_SCREENS: readonly string[] = ["mirror", "plan", "seal", "lock", "quiet"];');
    expect(src).not.toMatch(/one-breath-photo|ONE_BREATH_SCENE/);
    const capture = src.slice(src.indexOf('{screen === "capture" ? ('), src.indexOf('{screen === "mirror"'));
    expect(capture).not.toContain('WorldPhotoHero');
  });

  it('then the Moment\'s own photograph fades in behind everything, and turns down in Quiet', () => {
    expect(src).toMatch(/BREATH_SCENE_SCREENS\.includes\(screen\)\s*\? worldBreathPhotoForMoment\(current\)/);
    expect(src).toMatch(/source=\{breathPhoto\}\s+fill\s+wash=\{screen === "quiet" \? "breathQuiet" : "breath"\}\s+fadeMs=\{1400\}/);
  });
});

describe('World photographs — no two places share one (Brandon, 2026-11-19)', () => {
  const fixed = [
    MOMENTS_TAB_SCENE, REPLAY_SCENE, CIRCLES_SCENE, WELCOME_SCENE,
    HYDRATION_SCENE, PROFILE_SCENE, CALENDAR_SCENE,
    ...TRAVEL_STAGE_SCENES,
    ...Object.values(PROTOCOL_SCENES), ...Object.values(PROTOCOL_SCREEN_SCENES),
  ];

  it('every screen with a fixed photograph has a different one, and every one is used', () => {
    expect(new Set(fixed).size).toBe(fixed.length);
    expect([...fixed].sort()).toEqual([...SCREEN_SCENES].sort());
  });

  it('a fixed screen never shows a photograph a Moment can show', () => {
    const momentPhotos = new Set<string>([
      ...MOMENT_SCENES, ...MOMENT_SCENES.map((s) => `${s}_b`), ...MOMENT_SCENES.map((s) => `${s}_c`),
    ]);
    for (const s of fixed) expect(momentPhotos.has(s), s).toBe(false);
  });

  it('a Moment has one photograph on Home and a different one on its own screen', () => {
    for (const title of ['Team dinner', 'Morning lift', 'Something']) {
      for (const type of ['work', 'training', 'travel', 'recovery', 'personal', 'performance'] as const) {
        const home = worldSceneForMoment({ title, type });
        const detail = worldDetailSceneForMoment({ title, type });
        expect(detail).toBe(`${home}_b`);
        expect(detail).not.toBe(home);
        expect(WORLD_SCENES).toContain(detail);
        // …and a third in One Breath.
        const breath = worldBreathSceneForMoment({ title, type });
        expect(breath).toBe(`${home}_c`);
        expect(WORLD_SCENES).toContain(breath);
      }
    }
  });

  it('Home\'s small cards use the Moment-screen photograph, never the one behind Home', () => {
    for (const s of Object.values(FIRST_MOMENT_SCENES)) expect(s.endsWith('_b')).toBe(true);
    const home = readFileSync(join(AOS, 'components/home/cinematic/HomeCinematicContainer.tsx'), 'utf8');
    expect(home).toMatch(/return m \? worldDetailPhotoForMoment\(m\) : undefined;/);
    expect(home).toContain('photo={worldPhotoForMoment(next)}');
  });

  it('the Moments tab no longer borrows the next Moment\'s photograph', () => {
    const tab = readFileSync(join(AOS, 'components/editorial/moments/EditorialMomentsScreen.tsx'), 'utf8');
    expect(tab).toContain('photo={worldPhoto(MOMENTS_TAB_SCENE)}');
    expect(tab).not.toContain('worldPhotoForMoment');
  });

  it('there are 55 photographs and no two files are the same picture', () => {
    expect(WORLD_SCENES.length).toBe(55);
    expect(new Set(WORLD_SCENES).size).toBe(55);
    const sizes = WORLD_SCENES.map((s) => readFileSync(join(AOS, 'assets', 'world', `${s}.jpg`)).length);
    expect(new Set(sizes).size).toBe(55);
  });
});
