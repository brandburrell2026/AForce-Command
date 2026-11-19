/**
 * The World photograph files, one per scene (see utils/worldPhoto.ts for
 * which scene goes where and where they may show). 1290×1935, cut down from
 * the 2336×3504 originals. No two places share a photograph.
 */
import type { ImageSourcePropType } from 'react-native';
import {
  worldDetailSceneForMoment,
  worldPhotosAvailable,
  worldSceneForMoment,
  type WorldScene,
} from '@/utils/worldPhoto';
import type { MomentType } from '@/types/moments';
import gym from '@/assets/world/gym.jpg';
import dinner from '@/assets/world/dinner.jpg';
import run from '@/assets/world/run.jpg';
import pickleball from '@/assets/world/pickleball.jpg';
import presentation from '@/assets/world/presentation.jpg';
import travel from '@/assets/world/travel.jpg';
import bedtime from '@/assets/world/bedtime.jpg';
import celebration from '@/assets/world/celebration.jpg';
import football_night from '@/assets/world/football_night.jpg';
import mb_social from '@/assets/world/mb_social.jpg';
import mb_sport from '@/assets/world/mb_sport.jpg';
import mb_work from '@/assets/world/mb_work.jpg';
import yoga_night from '@/assets/world/yoga_night.jpg';
import gym_b from '@/assets/world/gym_b.jpg';
import dinner_b from '@/assets/world/dinner_b.jpg';
import run_b from '@/assets/world/run_b.jpg';
import pickleball_b from '@/assets/world/pickleball_b.jpg';
import presentation_b from '@/assets/world/presentation_b.jpg';
import travel_b from '@/assets/world/travel_b.jpg';
import bedtime_b from '@/assets/world/bedtime_b.jpg';
import celebration_b from '@/assets/world/celebration_b.jpg';
import football_night_b from '@/assets/world/football_night_b.jpg';
import mb_social_b from '@/assets/world/mb_social_b.jpg';
import mb_sport_b from '@/assets/world/mb_sport_b.jpg';
import mb_work_b from '@/assets/world/mb_work_b.jpg';
import yoga_night_b from '@/assets/world/yoga_night_b.jpg';
import moments_tab from '@/assets/world/moments_tab.jpg';
import replay from '@/assets/world/replay.jpg';
import tile_recovery from '@/assets/world/tile_recovery.jpg';
import tile_sleep from '@/assets/world/tile_sleep.jpg';
import tile_travel from '@/assets/world/tile_travel.jpg';
import screen_recovery from '@/assets/world/screen_recovery.jpg';
import screen_sleep from '@/assets/world/screen_sleep.jpg';
import circles from '@/assets/world/circles.jpg';
import welcome from '@/assets/world/welcome.jpg';
import one_breath from '@/assets/world/one_breath.jpg';
import hydration from '@/assets/world/hydration.jpg';
import profile from '@/assets/world/profile.jpg';
import calendar from '@/assets/world/calendar.jpg';

export const WORLD_PHOTO_SOURCES: Record<WorldScene, ImageSourcePropType> = {
  gym,
  dinner,
  run,
  pickleball,
  presentation,
  travel,
  bedtime,
  celebration,
  football_night,
  mb_social,
  mb_sport,
  mb_work,
  yoga_night,
  gym_b,
  dinner_b,
  run_b,
  pickleball_b,
  presentation_b,
  travel_b,
  bedtime_b,
  celebration_b,
  football_night_b,
  mb_social_b,
  mb_sport_b,
  mb_work_b,
  yoga_night_b,
  moments_tab,
  replay,
  tile_recovery,
  tile_sleep,
  tile_travel,
  screen_recovery,
  screen_sleep,
  circles,
  welcome,
  one_breath,
  hydration,
  profile,
  calendar,
};

/** The photograph for a scene, or nothing in a build that may not show them. */
export function worldPhoto(scene: WorldScene): ImageSourcePropType | undefined {
  return worldPhotosAvailable() ? WORLD_PHOTO_SOURCES[scene] : undefined;
}

/** The photograph behind a Moment (or the empty state), or nothing. */
export function worldPhotoForMoment(
  moment: { title: string; type: MomentType; masked?: boolean } | null,
): ImageSourcePropType | undefined {
  return worldPhoto(worldSceneForMoment(moment));
}

/** The second photograph of a Moment: its own screen, and the Home card that opens it. */
export function worldDetailPhotoForMoment(
  moment: { title: string; type: MomentType; masked?: boolean } | null,
): ImageSourcePropType | undefined {
  return worldPhoto(worldDetailSceneForMoment(moment));
}
