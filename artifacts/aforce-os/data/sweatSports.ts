/**
 * Per-sport defaults — mean sweat rates from published athlete-population
 * studies, paired with their Compendium-of-Physical-Activities MET value.
 *
 * Sources for the sweat-rate column — per-sport, mixed provenance. Each value
 * is traced to the sport-specific study nearest its population. Baker 2017 is a
 * METHODOLOGY/VARIABILITY review (its Table 1 is "methodological sources of
 * variability," NOT sport rates); it is cited ONLY for the overall whole-body
 * sweat-rate range (~0.5-2.0 L/h), never as a per-sport mean.
 *
 *   - Barnes KA, Anderson ML, Stofan JR, Dalrymple KJ, Reimel AJ, Roberts TJ,
 *     Randell RK, Ungaro CT, Baker LB. 2019. Normative data for sweating rate,
 *     sweat sodium concentration, and sweat sodium loss in athletes: an update
 *     and analysis by sport. J Sports Sci 37(20):2356-2366.
 *     (endurance mean 1.28 L/h -> Distance Running)
 *   - Maughan RJ, Watson P, Evans GH, Broad N, Shirreffs SM. 2007. Water
 *     balance and salt losses in competitive football. Int J Sport Nutr Exerc
 *     Metab 17(6):583-594. (match loss ~1.68 L over ~90 min ~= 1.1 L/h -> Soccer)
 *   - Broad EM, Burke LM, Cox GR, Heeley P, Riley M. 1996. Body weight changes
 *     and voluntary fluid intakes during training and competition sessions in
 *     team sports. Int J Sport Nutr 6(3):307-320.
 *     (male basketball 1.04-1.60 L/h -> Basketball)
 *   - Godek SF, Bartolozzi AR, Godek JJ. 2005. Sweat rate and fluid turnover in
 *     American football players compared with runners in a hot and humid
 *     environment. Br J Sports Med 39(4):205-211. (footballers 2.14 L/h -> American Football)
 *   - Logan-Sprenger HM, Palmer MS, Spriet LL. 2011. Estimated fluid and sodium
 *     balance and drink preferences in elite male junior players during an ice
 *     hockey game. Appl Physiol Nutr Metab 36(1):145-152. (game 1.11 L/h -> Hockey)
 *   - Baker LB. 2017. Sweating rate and sweat sodium concentration in athletes:
 *     a review of methodology and intra/interindividual variability. Sports Med
 *     47(Suppl 1):111-128. (overall WBSR range ~0.5-2.0 L/h; range anchor for
 *     Tennis, Cycling, Triathlon, CrossFit, Hot Yoga where no single normative
 *     mean is locked -- NOT a per-sport source)
 *   - Sawka MN, Burke LM, Eichner ER, Maughan RJ, Montain SJ, Stachenfeld NS.
 *     2007. ACSM Position Stand: Exercise and Fluid Replacement. Med Sci Sports
 *     Exerc 39(2):377-390. (general/resistance training band -> General Gym)
 *
 * OPEN — founder sign-off (see governance/reviews/CR-1-ER5-CITATION-VERIFICATION.md):
 *   - Hot Yoga value 0.85 contradicts the only Bikram-yoga measurement
 *     (~1.0 L/h); proposed change to ~1.0 (a functional change, not applied).
 *   - Basketball 1.38 is a male-competition anchor (Broad 1996); Barnes 2019's
 *     pooled mean is 0.95 — documented alternative, not applied.
 *   - CrossFit 1.30 has CrossFit-field support (~1.28) pending a locked study locus.
 *
 * MET values from:
 *   - Ainsworth BE et al. 2011. Compendium of Physical Activities, 2nd ed.
 *     Med Sci Sports Exerc 43(8):1575-1581.
 *
 * These are POPULATION MEANS. Individual variability is large; the estimate
 * engine uses these as a baseline and adjusts for body size, intensity, and
 * climate. The numbers exist to anchor the no-scale path, not to replace
 * measurement.
 */

import type { SportDefault } from '@/types/sweat';

export const SWEAT_SPORTS: SportDefault[] = [
  {
    id: 'running_distance',
    label: 'Distance Running',
    emoji: '🏃',
    meanSweatRateLh: 1.25,
    met: 9.8,
    citation: 'Barnes 2019',
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
    citation: 'Broad 1996',
  },
  {
    id: 'football',
    label: 'American Football',
    emoji: '🏈',
    meanSweatRateLh: 2.14,
    met: 8.0,
    citation: 'Godek 2005',
  },
  {
    id: 'tennis',
    label: 'Tennis',
    emoji: '🎾',
    meanSweatRateLh: 1.40,
    met: 7.3,
    citation: 'Baker 2017 (0.5-2.0 L/h range)',
  },
  {
    id: 'cycling',
    label: 'Cycling (Road)',
    emoji: '🚴',
    meanSweatRateLh: 0.94,
    met: 8.0,
    citation: 'Baker 2017 (0.5-2.0 L/h range)',
  },
  {
    id: 'triathlon',
    label: 'Triathlon',
    emoji: '🏊',
    meanSweatRateLh: 1.10,
    met: 9.5,
    citation: 'Baker 2017 (0.5-2.0 L/h range)',
  },
  {
    id: 'crossfit',
    label: 'CrossFit / HIIT',
    emoji: '💥',
    meanSweatRateLh: 1.30,
    met: 8.0,
    citation: 'Baker 2017 (0.5-2.0 L/h range)',
  },
  {
    id: 'hot_yoga',
    label: 'Hot Yoga',
    emoji: '🧘',
    meanSweatRateLh: 0.85,
    met: 4.5,
    citation: 'Baker 2017 (0.5-2.0 L/h range)',
  },
  {
    id: 'hockey',
    label: 'Hockey (Ice)',
    emoji: '🏒',
    meanSweatRateLh: 1.00,
    met: 8.0,
    citation: 'Logan-Sprenger 2011',
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
