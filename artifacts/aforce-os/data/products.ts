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
    ozPerServing: 8,
    hydrationImpact: 6,
    description: 'Plain water — baseline hydration.',
  },
  aforce_stick: {
    fluidType: 'aforce_stick',
    name: 'AForce Hydration Stick',
    shortName: 'Stick',
    ozPerServing: 18,
    hydrationImpact: 12,
    description: 'Mix with 16–20 oz water. Fastest electrolyte recovery.',
    image: require('../assets/images/products/stick_watermelon.jpg'),
    flavor: 'watermelon',
  },
  aforce_rtd: {
    fluidType: 'aforce_rtd',
    name: 'AForce RTD Can',
    shortName: 'RTD Can',
    ozPerServing: 12,
    hydrationImpact: 10,
    description: '12 oz ready-to-drink. Field-grade hydration.',
    image: require('../assets/images/products/can_watermelon.png'),
    flavor: 'watermelon',
  },
  aforce_canister: {
    fluidType: 'aforce_canister',
    name: 'AForce Canister',
    shortName: 'Canister',
    ozPerServing: 18,
    hydrationImpact: 12,
    description: 'Scoop into 16–20 oz water. Daily protocol fuel.',
    image: require('../assets/images/products/jar_watermelon.png'),
    flavor: 'watermelon',
  },
  aforce_bulk_bag: {
    fluidType: 'aforce_bulk_bag',
    name: 'AForce FIELD BAG',
    shortName: 'Bulk Bag',
    ozPerServing: 16,
    hydrationImpact: 11,
    description: 'Team / program bulk format. 16 oz per serving.',
    image: require('../assets/images/products/bag_soursop.jpg'),
    flavor: 'soursop',
  },
};

export const PRODUCT_FLAVORS = {
  watermelon: {
    label: 'Watermelon Surge + Chlorella',
    accent: '#FF2D55',
    stick: require('../assets/images/products/stick_watermelon.jpg'),
    can: require('../assets/images/products/can_watermelon.png'),
    jar: require('../assets/images/products/jar_watermelon.png'),
  },
  berry: {
    label: 'Berry Blast + Dulse',
    accent: '#8B5CF6',
    stick: require('../assets/images/products/stick_berry.jpg'),
    can: require('../assets/images/products/can_berry.png'),
    jar: require('../assets/images/products/jar_berry.png'),
  },
  soursop: {
    label: 'Soursop Edge + Seamoss',
    accent: '#B4FF50',
    stick: require('../assets/images/products/stick_soursop.jpg'),
    can: require('../assets/images/products/can_soursop.png'),
    jar: require('../assets/images/products/jar_soursop.png'),
    bag: require('../assets/images/products/bag_soursop.jpg'),
  },
} as const;

export const QUICK_INTAKE_ORDER: FluidType[] = [
  'water',
  'aforce_stick',
  'aforce_rtd',
  'aforce_canister',
  'aforce_bulk_bag',
];
