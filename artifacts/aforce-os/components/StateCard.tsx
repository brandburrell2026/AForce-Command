/**
 * StateCard — thin alias of CityCard. Both render identical layouts; the
 * different label is derived from `region.kind` inside CityCard. This file
 * exists so the codebase matches the spec's file list and so future
 * state-specific UX (e.g. legislative-area boundaries) has a home.
 */

export { default } from './CityCard';
export { CityCard as StateCard } from './CityCard';
