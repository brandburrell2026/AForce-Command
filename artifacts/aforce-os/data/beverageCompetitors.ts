/**
 * Beverage competitor database — AForce vs the top hydration / electrolyte
 * brands on shelf. Used by the AForce HydroScan "Compare vs Competitors"
 * flow to show how AForce stacks up across the metrics that actually move
 * performance: electrolyte load, sugar burden, ingredient cleanliness,
 * functional adders, and alkaline lift.
 *
 * Numbers reflect the BRAND'S OWN published nutrition panels for a single
 * standard serving (sticks reflect the powder mixed with the recommended
 * water volume — i.e. what the user actually drinks). Where a brand ships
 * multiple SKUs the canonical/most-popular flagship is used so comparisons
 * are apples-to-apples. Adjust here as labels change — the comparison
 * engine reads everything from this file and the parity test will flag any
 * structural drift.
 */

export type CompetitorId =
  | 'aforce_stick'
  | 'gatorade'
  | 'powerade'
  | 'pedialyte'
  | 'lmnt'
  | 'liquid_iv'
  | 'prime'
  | 'nuun'
  | 'bodyarmor'
  | 'g2'
  | 'propel'
  | 'dripdrop';

export interface BeverageProfile {
  id: CompetitorId;
  brand: string;
  product: string;
  /** Final liquid volume the user actually drinks, in oz. */
  servingOz: number;
  /** Marketing one-liner for the comparison header. */
  tagline: string;
  metrics: {
    sodiumMg: number;
    potassiumMg: number;
    magnesiumMg: number;
    sugarG: number;
    addedSugarG: number;
    caloriesKcal: number;
    /** Approximate liquid pH. ≥9 = highly alkaline, 7 = neutral, <7 = acidic. */
    alkalinePh: number;
    artificialColors: boolean;
    artificialSweeteners: boolean;
    /** Functional adders beyond standard electrolytes (sea moss, dulse, etc.). */
    functionalIngredients: string[];
  };
}

/**
 * AForce flagship — the Hydration Stick mixed in 12 oz of water (matches the
 * updated stick protocol). Single canonical entry the engine compares the
 * competitor list against.
 */
export const AFORCE_PROFILE: BeverageProfile = {
  id: 'aforce_stick',
  brand: 'AForce',
  product: 'Hydration Stick',
  servingOz: 12,
  tagline: 'Alkaline electrolytes + sea-mineral functional stack.',
  metrics: {
    sodiumMg: 500,
    potassiumMg: 350,
    magnesiumMg: 60,
    sugarG: 0,
    addedSugarG: 0,
    caloriesKcal: 10,
    alkalinePh: 9.5,
    artificialColors: false,
    artificialSweeteners: false,
    functionalIngredients: ['Chlorella', 'Dulse', 'Sea Moss', 'Spirulina'],
  },
};

export const COMPETITORS: BeverageProfile[] = [
  {
    id: 'gatorade',
    brand: 'Gatorade',
    product: 'Thirst Quencher',
    servingOz: 12,
    tagline: 'Legacy sports drink — sugar-driven carb refuel.',
    metrics: {
      sodiumMg: 270,
      potassiumMg: 75,
      magnesiumMg: 0,
      sugarG: 21,
      addedSugarG: 21,
      caloriesKcal: 80,
      alkalinePh: 3.3,
      artificialColors: true,
      artificialSweeteners: false,
      functionalIngredients: [],
    },
  },
  {
    id: 'powerade',
    brand: 'Powerade',
    product: 'Mountain Berry Blast',
    servingOz: 12,
    tagline: 'Coca-Cola sports drink — high-fructose syrup base.',
    metrics: {
      sodiumMg: 150,
      potassiumMg: 35,
      magnesiumMg: 0,
      sugarG: 21,
      addedSugarG: 21,
      caloriesKcal: 80,
      alkalinePh: 2.8,
      artificialColors: true,
      artificialSweeteners: false,
      functionalIngredients: [],
    },
  },
  {
    id: 'pedialyte',
    brand: 'Pedialyte',
    product: 'Classic',
    servingOz: 12,
    tagline: 'Medical-grade rehydration — clinical, not performance.',
    metrics: {
      sodiumMg: 370,
      potassiumMg: 280,
      magnesiumMg: 0,
      sugarG: 9,
      addedSugarG: 9,
      caloriesKcal: 35,
      alkalinePh: 4.5,
      artificialColors: true,
      artificialSweeteners: true,
      functionalIngredients: [],
    },
  },
  {
    id: 'lmnt',
    brand: 'LMNT',
    product: 'Recharge Stick',
    servingOz: 16,
    tagline: 'High-sodium keto stick — minimalist electrolyte hit.',
    metrics: {
      sodiumMg: 1000,
      potassiumMg: 200,
      magnesiumMg: 60,
      sugarG: 0,
      addedSugarG: 0,
      caloriesKcal: 10,
      alkalinePh: 7.5,
      artificialColors: false,
      artificialSweeteners: false,
      functionalIngredients: [],
    },
  },
  {
    id: 'liquid_iv',
    brand: 'Liquid I.V.',
    product: 'Hydration Multiplier',
    servingOz: 16,
    tagline: 'Cellular Transport Technology — sugar-loaded uptake.',
    metrics: {
      sodiumMg: 500,
      potassiumMg: 380,
      magnesiumMg: 0,
      sugarG: 11,
      addedSugarG: 11,
      caloriesKcal: 45,
      alkalinePh: 4.0,
      artificialColors: false,
      artificialSweeteners: false,
      functionalIngredients: ['Vitamin C', 'B-Complex'],
    },
  },
  {
    id: 'prime',
    brand: 'Prime',
    product: 'Hydration',
    servingOz: 16,
    tagline: 'Influencer-built RTD — coconut water + BCAAs.',
    metrics: {
      sodiumMg: 10,
      potassiumMg: 700,
      magnesiumMg: 0,
      sugarG: 2,
      addedSugarG: 2,
      caloriesKcal: 20,
      alkalinePh: 4.5,
      artificialColors: true,
      artificialSweeteners: true,
      functionalIngredients: ['Coconut Water', 'BCAAs'],
    },
  },
  {
    id: 'nuun',
    brand: 'Nuun',
    product: 'Sport Tablet',
    servingOz: 16,
    tagline: 'Effervescent tab — light electrolyte top-up.',
    metrics: {
      sodiumMg: 300,
      potassiumMg: 150,
      magnesiumMg: 25,
      sugarG: 1,
      addedSugarG: 1,
      caloriesKcal: 15,
      alkalinePh: 6.5,
      artificialColors: false,
      artificialSweeteners: false,
      functionalIngredients: [],
    },
  },
  {
    id: 'bodyarmor',
    brand: 'BODYARMOR',
    product: 'SuperDrink',
    servingOz: 12,
    tagline: 'Coconut-water based RTD — premium sugar drink.',
    metrics: {
      sodiumMg: 27,
      potassiumMg: 530,
      magnesiumMg: 0,
      sugarG: 18,
      addedSugarG: 18,
      caloriesKcal: 70,
      alkalinePh: 4.2,
      artificialColors: false,
      artificialSweeteners: false,
      functionalIngredients: ['Coconut Water', 'Vitamin C'],
    },
  },
  {
    id: 'g2',
    brand: 'Gatorade',
    product: 'G2 Low Calorie',
    servingOz: 12,
    tagline: 'Lower-sugar Gatorade — partial reformulation.',
    metrics: {
      sodiumMg: 270,
      potassiumMg: 75,
      magnesiumMg: 0,
      sugarG: 5,
      addedSugarG: 5,
      caloriesKcal: 20,
      alkalinePh: 3.3,
      artificialColors: true,
      artificialSweeteners: true,
      functionalIngredients: [],
    },
  },
  {
    id: 'propel',
    brand: 'Propel',
    product: 'Electrolyte Water',
    servingOz: 12,
    tagline: 'Zero-sugar flavored water — vitamin top-up.',
    metrics: {
      sodiumMg: 160,
      potassiumMg: 40,
      magnesiumMg: 0,
      sugarG: 0,
      addedSugarG: 0,
      caloriesKcal: 0,
      alkalinePh: 3.4,
      artificialColors: false,
      artificialSweeteners: true,
      functionalIngredients: ['Vitamin C', 'Vitamin E'],
    },
  },
  {
    id: 'dripdrop',
    brand: 'DripDrop',
    product: 'ORS',
    servingOz: 8,
    tagline: 'Medical Oral Rehydration Solution — clinical formula.',
    metrics: {
      sodiumMg: 330,
      potassiumMg: 185,
      magnesiumMg: 39,
      sugarG: 7,
      addedSugarG: 7,
      caloriesKcal: 35,
      alkalinePh: 4.5,
      artificialColors: false,
      artificialSweeteners: false,
      functionalIngredients: ['Vitamin C', 'Zinc'],
    },
  },
];

export function findCompetitor(id: CompetitorId): BeverageProfile | undefined {
  if (id === 'aforce_stick') return AFORCE_PROFILE;
  return COMPETITORS.find((c) => c.id === id);
}
