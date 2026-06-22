/**
 * AForce Phase 1 product catalog.
 * Backed by attached product photography for stick / can / canister / bulk bag.
 */

import type { ProductType, FluidType } from '../types';

export const PRODUCTS: Record<FluidType, ProductType> = {
  water: {
    fluidType: 'water',
    name: 'Water',
    shortName: 'Water',
    ozPerServing: 12,
    hydrationImpact: 6,
    description: 'Plain water — baseline hydration.',
  },
  aforce_stick: {
    fluidType: 'aforce_stick',
    name: 'AForce Hydration Stick',
    shortName: 'Stick',
    ozPerServing: 12,
    hydrationImpact: 12,
    description: 'Mix with 12 ounces water. Fastest electrolyte recovery.',
    image: require('../assets/images/products/stick_watermelon.png'),
    flavor: 'watermelon',
  },
  aforce_rtd: {
    fluidType: 'aforce_rtd',
    name: 'AForce RTD Can',
    shortName: 'RTD Can',
    ozPerServing: 12,
    hydrationImpact: 10,
    description: '12 ounces ready-to-drink. Field-grade hydration.',
    image: require('../assets/images/products/can_watermelon.png'),
    flavor: 'watermelon',
  },
  aforce_canister: {
    fluidType: 'aforce_canister',
    name: 'AForce Canister',
    shortName: 'Canister',
    ozPerServing: 18,
    hydrationImpact: 12,
    description: 'Scoop into 16–20 ounces water. Daily protocol fuel.',
    image: require('../assets/images/products/jar_watermelon.png'),
    flavor: 'watermelon',
  },
  aforce_bulk_bag: {
    fluidType: 'aforce_bulk_bag',
    name: 'AForce FIELD BAG',
    shortName: 'Bulk Bag',
    ozPerServing: 16,
    hydrationImpact: 11,
    description: 'Team / program bulk format. 16 ounces per serving.',
    image: require('../assets/images/products/bag_soursop.jpg'),
    flavor: 'soursop',
  },
};

export const PRODUCT_FLAVORS = {
  watermelon: {
    label: 'Watermelon Surge + Chlorella',
    accent: '#FF2800',
    stick: require('../assets/images/products/stick_watermelon.png'),
    can: require('../assets/images/products/can_watermelon_v2.png'),
    jar: require('../assets/images/products/jar_watermelon.png'),
    bag: require('../assets/images/products/bag_watermelon.jpg'),
    bagAlt: require('../assets/images/products/bag_watermelon_alt.jpg'),
  },
  berry: {
    label: 'Berry Blast + Dulse',
    accent: '#8B5CF6',
    stick: require('../assets/images/products/stick_berry.png'),
    can: require('../assets/images/products/can_berry_v2.png'),
    jar: require('../assets/images/products/jar_berry.png'),
    bag: require('../assets/images/products/bag_berry_v2.png'),
    bagAlt: require('../assets/images/products/bag_berry_alt.jpg'),
  },
  soursop: {
    label: 'Soursop Edge + Seamoss',
    accent: '#1FA35A',
    stick: require('../assets/images/products/stick_soursop.png'),
    can: require('../assets/images/products/can_soursop_v2.png'),
    jar: require('../assets/images/products/jar_soursop.png'),
    bag: require('../assets/images/products/bag_soursop.jpg'),
    bagAlt: require('../assets/images/products/bag_soursop_alt.jpg'),
  },
} as const;

// FIELD BAG / bulk bag intentionally omitted from the Quick Log for now —
// the type/PRODUCTS entry is kept so any historical scans/intake records
// still resolve, but it's no longer offered as a quick-log option.
export const QUICK_INTAKE_ORDER: FluidType[] = [
  'water',
  'aforce_stick',
  'aforce_rtd',
  'aforce_canister',
];
