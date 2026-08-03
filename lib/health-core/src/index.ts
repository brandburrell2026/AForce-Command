/**
 * @workspace/health-core — the AForce Health Integration Layer's canonical
 * contracts, normalization boundary, and deduplication policy.
 * Pure TypeScript; no I/O; no clocks (callers inject `nowMs`).
 */
export * from './contracts';
export * from './normalize';
export * from './dedupe';
