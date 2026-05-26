/**
 * AForce flavor system — functional variations of the AForce hydration system.
 *
 * Each flavor is a TOOL, not a taste. It connects an ingredient to a
 * physiological purpose and a user state. The Products screen and the AI
 * command engine both consume this data.
 */

import type { PerformanceLevel, ProductFlavor } from '../types';

export interface FlavorVariant {
  id: string;
  /** UI / display name. */
  name: string;
  /** Link back to the flavor token used by PRODUCT_FLAVORS / images. */
  flavor: ProductFlavor;
  /** Functional ingredient pairing (e.g. "Dulse"). */
  functionalIngredient: string;
  /** Short, premium tagline (one line). */
  tagline: string;
  /** Performance bio — 2-3 sentences, factual. */
  bio: string;
  /** Best use cases. */
  bestUse: string[];
  /** Functional focus tags. */
  functionalFocus: string[];
  /** Performance states this flavor is the recommended tool for. */
  stateAlignment: PerformanceLevel[];
  /** AI command line tied to user state (the "take 1 X now..." line). */
  aiCommand: string;
  /** Subtle UI accent color for chips and highlights. */
  accent: string;
}

export const FLAVOR_VARIANTS: FlavorVariant[] = [
  {
    id: 'berry_blast_dulse',
    name: 'Berry Blast',
    flavor: 'berry',
    functionalIngredient: 'Dulse',
    tagline: 'Mineral driven hydration. Built for balance.',
    bio: 'Berry Blast with Dulse is formulated for mineral support and system balance. Dulse delivers naturally occurring trace minerals that support hydration efficiency and recovery. This blend is designed to support sustained performance and maintain consistency throughout the day.',
    bestUse: [
      'Daily hydration',
      'Recovery support',
      'Maintaining balance',
      'Consistent performance',
    ],
    functionalFocus: [
      'Trace minerals',
      'Electrolyte support',
      'Recovery stability',
    ],
    stateAlignment: ['BALANCED', 'PEAK'],
    aiCommand: 'Take 1 Berry Blast now. Maintain your current state.',
    accent: '#8B5CF6',
  },
  {
    id: 'watermelon_surge_chlorella',
    name: 'Watermelon Surge',
    flavor: 'watermelon',
    functionalIngredient: 'Chlorella',
    tagline: 'Clean hydration. Cellular reset.',
    bio: 'Watermelon Surge with Chlorella is built for detox support and cellular recovery. Chlorella helps support internal cleansing and efficient nutrient absorption. This formula is designed to reset the system and improve hydration efficiency after stress, heat, or exertion.',
    bestUse: [
      'Post workout',
      'Heat recovery',
      'System reset',
      'Detox support',
    ],
    functionalFocus: [
      'Detox support',
      'Cellular hydration',
      'Recovery acceleration',
    ],
    stateAlignment: ['RECOVERING'],
    aiCommand: 'Take 1 Watermelon Surge now. You are in recovery.',
    accent: '#FF2800',
  },
  {
    id: 'soursop_edge_seamoss',
    name: 'Soursop Edge',
    flavor: 'soursop',
    functionalIngredient: 'Sea Moss',
    tagline: 'Full spectrum performance. Maximum support.',
    bio: 'Soursop Edge with Sea Moss delivers a broad spectrum of minerals and compounds that support hydration, recovery, and overall performance. Sea Moss is known for its dense nutrient profile, helping the body maintain optimal function under stress. This is the most complete hydration support in the AForce system.',
    bestUse: [
      'High performance days',
      'Recovery from depletion',
      'Full system support',
      'Long duration activity',
    ],
    functionalFocus: [
      'Mineral density',
      'Full body support',
      'Performance recovery',
    ],
    stateAlignment: ['DEPLETED'],
    aiCommand: 'Take 1 Soursop Edge now. You are trending depleted.',
    accent: '#B6FF00',
  },
];

/** Resolve a flavor recommendation from the user's current performance state. */
export function flavorForState(level: PerformanceLevel): FlavorVariant {
  const direct = FLAVOR_VARIANTS.find((f) => f.stateAlignment.includes(level));
  if (direct) return direct;
  // Fallback chain: PEAK -> BALANCED.
  if (level === 'PEAK') return FLAVOR_VARIANTS[0];
  return FLAVOR_VARIANTS[0];
}

export function flavorById(id: string): FlavorVariant | undefined {
  return FLAVOR_VARIANTS.find((f) => f.id === id);
}
