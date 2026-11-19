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

export const WORLD_SCENES = [
  'gym', 'dinner', 'run', 'pickleball', 'presentation', 'travel', 'bedtime',
  'celebration', 'football_night', 'mb_social', 'mb_sport', 'mb_work', 'yoga_night',
] as const;
export type WorldScene = (typeof WORLD_SCENES)[number];

/** Development and internal builds only. */
export function worldPhotosAvailable(ctx: UnlockContext = currentUnlockContext()): boolean {
  return ctx.dev || ctx.internalTestflight;
}

/** First match wins; whole words only, so "runway" is not a run. */
const WORD_SCENES: readonly (readonly [RegExp, WorldScene])[] = [
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
const TYPE_SCENES: Record<MomentType, WorldScene> = {
  work: 'mb_work',
  training: 'gym',
  travel: 'travel',
  recovery: 'yoga_night',
  personal: 'mb_social',
  performance: 'mb_sport',
};

/** The scene Home and Moments show when there is no Moment yet. */
export const WORLD_EMPTY_SCENE: WorldScene = 'run';

export function worldSceneForWords(words: string): WorldScene | null {
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
): WorldScene {
  if (!moment) return WORLD_EMPTY_SCENE;
  if (!moment.masked) {
    const fromWords = worldSceneForWords(moment.title);
    if (fromWords) return fromWords;
  }
  return TYPE_SCENES[moment.type] ?? WORLD_EMPTY_SCENE;
}

/** The scenes behind the three Protocols tiles, as the prototype pairs them. */
export const PROTOCOL_SCENES = {
  recovery: 'yoga_night',
  sleep: 'bedtime',
  travel: 'travel',
} as const satisfies Record<'recovery' | 'sleep' | 'travel', WorldScene>;
