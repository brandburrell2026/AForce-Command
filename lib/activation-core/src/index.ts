/**
 * @workspace/activation-core — pure, dependency-free QR-activation funnel.
 *
 * Shared between the mobile app (per-device funnel) and the server
 * (cohort aggregation for the founder Command Center). Every export is a
 * deterministic function over its inputs: no React, no react-native, no
 * storage, no `Date.now()`. Score-Protection: this code only MEASURES
 * progression that already happened — it never awards or mutates score.
 */

export * from './attribution';
export * from './funnel';
