/**
 * The World photograph files, one per scene (see utils/worldPhoto.ts for
 * which scene goes where and where they may show). 1290×1935, cut down from
 * the 2336×3504 originals.
 */
import type { ImageSourcePropType } from 'react-native';
import {
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
