/**
 * World photographs — which scene sits behind a Moment, as in the approved
 * prototype. Pure: no images are loaded here (see
 * components/world/worldPhotoSources.ts for the files).
 *
 * The photographs are AI-generated samples made for AFORCE on 2026-11-19.
 * They show in development and internal builds only, until Legal clears
 * them for a public release. A public build draws the same screens on
 * AFORCE Black, exactly as before.
 *
 * A scene is decoration. It is chosen from the Moment's own words and type,
 * never from health data, and it changes nothing the app says or does.
 */
import { currentUnlockContext, type UnlockContext } from '@/featureFlags/flags';
import type { MomentType } from '@/types/moments';

/**
 * No two places show the same photograph. There are three separate sets:
 *
 *   MOMENT_SCENES        behind a Moment on Home (chosen from its words/type)
 *   `${scene}_b`         a second photograph of each, for the Moment's own
 *                        screen and the small square on a Home card that
 *                        opens it
 *   `${scene}_c`         a third, for One Breath once it has understood
 *                        the Moment
 *   SCREEN_SCENES        one photograph for each screen with a fixed picture
 */
export const MOMENT_SCENES = [
  'gym', 'dinner', 'run', 'pickleball', 'presentation', 'travel', 'bedtime',
  'celebration', 'football_night', 'mb_social', 'mb_sport', 'mb_work', 'yoga_night',
] as const;
export type MomentScene = (typeof MOMENT_SCENES)[number];
export type MomentDetailScene = `${MomentScene}_b`;
export type MomentBreathScene = `${MomentScene}_c`;

export const SCREEN_SCENES = [
  'moments_tab', 'replay', 'tile_recovery', 'tile_sleep', 'tile_travel',
  'screen_recovery', 'screen_sleep', 'circles', 'welcome',
  'hydration', 'profile', 'calendar',
  'travel_page', 'travel_before', 'travel_air', 'travel_arrived',
] as const;
export type ScreenScene = (typeof SCREEN_SCENES)[number];

export const WORLD_SCENES = [
  ...MOMENT_SCENES,
  ...MOMENT_SCENES.map((s) => `${s}_b` as MomentDetailScene),
  ...MOMENT_SCENES.map((s) => `${s}_c` as MomentBreathScene),
  ...SCREEN_SCENES,
] as const;
export type WorldScene = MomentScene | MomentDetailScene | MomentBreathScene | ScreenScene;

/** Development and internal builds only. */
export function worldPhotosAvailable(ctx: UnlockContext = currentUnlockContext()): boolean {
  return ctx.dev || ctx.internalTestflight;
}

/** First match wins; whole words only, so "runway" is not a run. */
const WORD_SCENES: readonly (readonly [RegExp, MomentScene])[] = [
  [/\b(pickleball)\b/i, 'pickleball'],
  [/\b(football|kickoff)\b/i, 'football_night'],
  [/\b(basketball|hoops|soccer|tennis|baseball|softball|volleyball|match|game)\b/i, 'mb_sport'],
  [/\b(run|running|jog|5k|10k|marathon|race)\b/i, 'run'],
  [/\b(lift|lifting|gym|workout|training|weights|crossfit|strength)\b/i, 'gym'],
  [/\b(yoga|stretch|stretching|recovery|mobility|pilates)\b/i, 'yoga_night'],
  [/\b(flight|fly|flying|airport|trip|travel)\b/i, 'travel'],
  [/\b(sleep|bedtime|bed)\b/i, 'bedtime'],
  [/\b(party|birthday|wedding|celebration|toast|rooftop|drinks|bar)\b/i, 'celebration'],
  [/\b(dinner|lunch|brunch|supper|restaurant|date)\b/i, 'dinner'],
  [/\b(presentation|pitch|keynote|interview|meeting|talk|demo|review)\b/i, 'presentation'],
];

/** The scene for each kind of Moment when its words name nothing we have. */
const TYPE_SCENES: Record<MomentType, MomentScene> = {
  work: 'mb_work',
  training: 'gym',
  travel: 'travel',
  recovery: 'yoga_night',
  personal: 'mb_social',
  performance: 'mb_sport',
};

/** The scene Home and Moments show when there is no Moment yet. */
export const WORLD_EMPTY_SCENE: MomentScene = 'run';

export function worldSceneForWords(words: string): MomentScene | null {
  for (const [pattern, scene] of WORD_SCENES) if (pattern.test(words)) return scene;
  return null;
}

/**
 * The scene behind a Moment. A private (masked) Moment is never matched on
 * its title — the photograph would give the hidden words away — so it takes
 * the scene for its type.
 */
export function worldSceneForMoment(
  moment: { title: string; type: MomentType; masked?: boolean } | null,
): MomentScene {
  if (!moment) return WORLD_EMPTY_SCENE;
  if (!moment.masked) {
    const fromWords = worldSceneForWords(moment.title);
    if (fromWords) return fromWords;
  }
  return TYPE_SCENES[moment.type] ?? WORLD_EMPTY_SCENE;
}

/** The second photograph of a Moment's scene: its own screen, and the Home card that opens it. */
export function worldDetailSceneForMoment(
  moment: { title: string; type: MomentType; masked?: boolean } | null,
): MomentDetailScene {
  return `${worldSceneForMoment(moment)}_b`;
}

/**
 * The third photograph of a Moment's scene: One Breath, once it has
 * understood the Moment. One Breath shows no photograph before that.
 */
export function worldBreathSceneForMoment(
  moment: { title: string; type: MomentType; masked?: boolean },
): MomentBreathScene {
  return `${worldSceneForMoment(moment)}_c`;
}

/** The square on Home's "Your first Moment" card, by the answer given at first run. */
export const FIRST_MOMENT_SCENES = {
  train: 'gym_b',
  work: 'presentation_b',
  night: 'dinner_b',
  travel: 'travel_b',
} as const satisfies Record<'train' | 'work' | 'night' | 'travel', MomentDetailScene>;

/** Screens with one fixed photograph each. */
export const MOMENTS_TAB_SCENE: ScreenScene = 'moments_tab';
export const REPLAY_SCENE: ScreenScene = 'replay';
export const CIRCLES_SCENE: ScreenScene = 'circles';
export const WELCOME_SCENE: ScreenScene = 'welcome';
export const HYDRATION_SCENE: ScreenScene = 'hydration';
export const PROFILE_SCENE: ScreenScene = 'profile';
export const CALENDAR_SCENE: ScreenScene = 'calendar';

/**
 * The Travel page, by where the journey stands. These are photographs of
 * travelling, never of a place: Travel's own rule forbids a generic or
 * invented skyline standing in for a real city, and city photographs still
 * wait on licensed images (utils/travel/cityRegistry.ts).
 */
export type TravelStage = 'preview' | 'lock_in' | 'arrival' | 'ready';
export function travelSceneForStage(stage: TravelStage | null): ScreenScene {
  if (stage === 'preview') return 'travel_before';
  if (stage === 'lock_in') return 'travel_air';
  if (stage === 'arrival' || stage === 'ready') return 'travel_arrived';
  return 'travel_page';
}

/** The three Protocols tiles. */
export const PROTOCOL_SCENES = {
  recovery: 'tile_recovery',
  sleep: 'tile_sleep',
  travel: 'tile_travel',
} as const satisfies Record<'recovery' | 'sleep' | 'travel', ScreenScene>;

/** The Recovery and Sleep screens the tiles open. */
export const PROTOCOL_SCREEN_SCENES = {
  recovery: 'screen_recovery',
  sleep: 'screen_sleep',
} as const satisfies Record<'recovery' | 'sleep', ScreenScene>;
