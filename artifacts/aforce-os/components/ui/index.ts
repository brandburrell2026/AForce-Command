/**
 * af.* primitive library (F2 · Primitives A) — the redesign's shared component
 * layer (spec §5). Every primitive consumes the af.* tokens; screens compose
 * these instead of rolling inline styles. Batch B (AFCommandCard, AFTimeline,
 * AFChart, AFDisclosureSheet, AFEmptyState, AFErrorState, AFTopBar,
 * AFEditorialHero) lands in F3.
 */
export { AFScreen, type AFScreenProps } from './AFScreen';
export { AFCard, type AFCardProps, type AFCardVariant } from './AFCard';
export {
  AFPrimaryButton,
  AFSecondaryButton,
  AFTextButton,
  type AFButtonProps,
} from './AFButton';
export { AFMetric, type AFMetricProps } from './AFMetric';
export { AFReadinessArc, type AFReadinessArcProps } from './AFReadinessArc';
export { AFProgressRing, type AFProgressRingProps } from './AFProgressRing';
export { AFStatusBadge, type AFStatusBadgeProps, type AFStatusTone } from './AFStatusBadge';
export { AFSectionLabel, type AFSectionLabelProps } from './AFSectionLabel';
export { AFListRow, type AFListRowProps } from './AFListRow';

export * from './afPrimitives.logic';
