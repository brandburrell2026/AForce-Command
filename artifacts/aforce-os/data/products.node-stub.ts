/**
 * Node/vitest stand-in for data/products.ts (Wave-4 Part 3).
 *
 * The real module executes RN asset `require('*.png')` calls at import,
 * which node cannot parse — the long-standing reason 11 service suites
 * crashed at import (masked for months by the earlier __DEV__ crash).
 * The unit lane aliases the real module here (vitest.config.ts); suites
 * that need richer product data keep their own vi.mock, which always
 * wins over the alias. Shape mirrors the fields service code reads.
 */
export type NodeStubProduct = {
  id: string;
  name: string;
  fluidType: string;
  ozPerServing: number;
  flavor?: string;
  hydrationImpact?: number;
  image: null;
};

const P = (id: string, fluidType: string, oz: number, flavor?: string): NodeStubProduct => ({
  id,
  name: id,
  fluidType,
  ozPerServing: oz,
  ...(flavor ? { flavor } : {}),
  hydrationImpact: 10,
  image: null,
});

export const PRODUCTS: Record<string, NodeStubProduct> = {
  water: P('water', 'water', 12),
  aforce_stick: P('aforce_stick', 'aforce_stick', 12, 'watermelon'),
  aforce_rtd: P('aforce_rtd', 'aforce_rtd', 11, 'berry'),
};

export const PRODUCT_FLAVORS = {
  watermelon: { id: 'watermelon', label: 'Watermelon Surge' },
  berry: { id: 'berry', label: 'Berry Blast' },
  soursop: { id: 'soursop', label: 'Soursop Edge' },
  unflavored: { id: 'unflavored', label: 'Unflavored' },
} as const;

export const QUICK_INTAKE_ORDER: string[] = ['water', 'aforce_stick', 'aforce_rtd'];

export const PRODUCT_LIST: NodeStubProduct[] = Object.values(PRODUCTS);
export default PRODUCTS;
