// @vitest-environment happy-dom
/**
 * The shared World photograph pieces, and the rule that every screen gets
 * its photograph through the internal-builds check.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-linear-gradient', () => ({ LinearGradient: () => <div data-testid="fade" /> }));

import { WorldPhotoGap, WorldPhotoHero, WorldPhotoThumb } from '../world/WorldPhoto';
import { worldPhoto, worldPhotoForMoment } from '../world/worldPhotoSources';
import { CIRCLES_SCENE, FIRST_MOMENT_SCENES, WELCOME_SCENE, WORLD_SCENES } from '@/utils/worldPhoto';

const AOS = join(__dirname, '..', '..');
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const render = (el: React.ReactElement) => act(() => root.render(el));
const SRC = { uri: 'photo.jpg' };

describe('the shared pieces', () => {
  it('draw nothing at all when there is no photograph', () => {
    render(<><WorldPhotoHero source={undefined} /><WorldPhotoGap source={undefined} /><WorldPhotoThumb source={undefined} /></>);
    expect(host.innerHTML).toBe('');
  });

  it('the hero is a picture with a fade, behind the content and silent to a screen reader', () => {
    render(<WorldPhotoHero source={SRC} bleed={20} lift={80} height={300} testID="hero" />);
    const hero = host.querySelector('[data-testid="hero"]') as HTMLElement;
    const cs = getComputedStyle(hero);
    expect(cs.position).toBe('absolute');
    expect(cs.left).toBe('-20px');
    expect(cs.top).toBe('-80px');
    expect(cs.height).toBe('380px');
    expect(cs.pointerEvents).toBe('none');
    expect(hero.getAttribute('aria-hidden')).toBe('true');
    expect(hero.querySelector('[data-testid="fade"]')).toBeTruthy();
  });

  it('the gap and the thumbnail appear with a photograph', () => {
    render(<><WorldPhotoGap source={SRC} height={90} /><WorldPhotoThumb source={SRC} testID="thumb" /></>);
    expect((host.firstElementChild as HTMLElement).style.height).toBe('90px');
    expect(host.querySelector('[data-testid="thumb"]')).toBeTruthy();
  });
});

describe('a build that may not show photographs', () => {
  it('gets none: this test run is neither a development nor an internal build', () => {
    expect(worldPhoto('gym')).toBeUndefined();
    expect(worldPhotoForMoment({ title: 'Team dinner', type: 'personal' })).toBeUndefined();
  });
});

describe('every screen asks through the same check', () => {
  const SCREENS = [
    'components/editorial/moments/EditorialMomentDetailScreen.tsx',
    'components/editorial/protocol/EditorialProtocolScreen.tsx',
    'components/oneBreath/MomentPreparationScreen.tsx',
    'components/community/CircleScreenV4.tsx',
    'components/auth/PromiseScreen.tsx',
    'components/home/cinematic/HomeCinematicContainer.tsx',
    'screens/SleepModeScreen.tsx',
    'components/hydration/HydrationScreenV2.tsx',
    'components/profile/ProfileHeader.tsx',
    'components/moments/cinematic/MomentsCalendarScreen.tsx',
    'components/travel/TravelIntelligenceScreen.tsx',
  ];
  it('no screen reads the image table directly', () => {
    for (const f of SCREENS) {
      const src = readFileSync(join(AOS, f), 'utf8');
      expect(src, f).toMatch(/world(Detail)?Photo(ForMoment)?\(/);
      expect(src, f).not.toContain('WORLD_PHOTO_SOURCES');
    }
  });

  it('a gallery or demo copy of the Moment screen takes no photograph', () => {
    const src = readFileSync(join(AOS, 'components/editorial/moments/EditorialMomentDetailScreen.tsx'), 'utf8');
    expect(src).toContain('readOnly ? undefined : worldDetailPhotoForMoment(moment)');
  });

  it('the fixed pairings name real scenes', () => {
    for (const s of [CIRCLES_SCENE, WELCOME_SCENE, ...Object.values(FIRST_MOMENT_SCENES)]) {
      expect(WORLD_SCENES).toContain(s);
    }
  });
});
