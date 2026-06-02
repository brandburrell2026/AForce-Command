/**
 * Per-sport defaults — mean sweat rates from published athlete-population
 * studies, paired with their Compendium-of-Physical-Activities MET value.
 *
 * Sources for the sweat-rate column:
 *   - Baker LB. 2017. Sports Med 47(Suppl 1):111-128. Table 1
 *     (sport-specific sweating-rate ranges across studies).
 *   - Maughan RJ et al. 2007. Br J Sports Med 41:e1
 *     (soccer training + match data).
 *   - Godek SF et al. 2010. J Athl Train 45(4):364-371
 *     (NFL training-camp data).
 *
 * MET values from:
 *   - Ainsworth BE et al. 2011. Compendium of Physical Activities, 2nd
 *     ed. Med Sci Sports Exerc 43(8):1575-1581.
 *
 * These are POPULATION MEANS. Individual variability is large; the
 * estimate engine uses these as a baseline and adjusts for body size,
 * intensity, and climate. The numbers exist to anchor the no-scale path,
 * not to replace measurement.
 */

import type { SportDefault } from '@/types/sweat';

export const SWEAT_SPORTS: SportDefault[] = [
  {
    id: 'running_distance',
    label: 'Distance Running',
    emoji: '🏃',
    meanSweatRateLh: 1.25,
    met: 9.8,
    citation: 'Baker 2017',
  },
  {
    id: 'soccer',
    label: 'Soccer',
    emoji: '⚽',
    meanSweatRateLh: 1.13,
    met: 8.0,
    citation: 'Maughan 2007',
  },
  {
    id: 'basketball',
    label: 'Basketball',
    emoji: '🏀',
    meanSweatRateLh: 1.38,
    met: 8.0,
    citation: 'Baker 2017',
  },
  {
    id: 'football',
    label: 'American Football',
    emoji: '🏈',
    meanSweatRateLh: 2.14,
    met: 8.0,
    citation: 'Godek 2010',
  },
  {
    id: 'tennis',
    label: 'Tennis',
    emoji: '🎾',
    meanSweatRateLh: 1.40,
    met: 7.3,
    citation: 'Baker 2017',
  },
  {
    id: 'cycling',
    label: 'Cycling (Road)',
    emoji: '🚴',
    meanSweatRateLh: 0.94,
    met: 8.0,
    citation: 'Baker 2017',
  },
  {
    id: 'triathlon',
    label: 'Triathlon',
    emoji: '🏊',
    meanSweatRateLh: 1.10,
    met: 9.5,
    citation: 'Baker 2017',
  },
  {
    id: 'crossfit',
    label: 'CrossFit / HIIT',
    emoji: '💥',
    meanSweatRateLh: 1.30,
    met: 8.0,
    citation: 'Baker 2017',
  },
  {
    id: 'hot_yoga',
    label: 'Hot Yoga',
    emoji: '🧘',
    meanSweatRateLh: 0.85,
    met: 4.5,
    citation: 'Baker 2017',
  },
  {
    id: 'hockey',
    label: 'Hockey (Ice)',
    emoji: '🏒',
    meanSweatRateLh: 1.00,
    met: 8.0,
    citation: 'Baker 2017',
  },
  {
    id: 'general_gym',
    label: 'General Gym',
    emoji: '🏋️',
    meanSweatRateLh: 0.80,
    met: 6.0,
    citation: 'Sawka 2007 (resistance/general training band)',
  },
];

export function getSport(id: string): SportDefault {
  return SWEAT_SPORTS.find((s) => s.id === id) ?? SWEAT_SPORTS[0];
}
