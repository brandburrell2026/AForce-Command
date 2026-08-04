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
export { AFMotionPressable, type AFMotionPressableProps } from './AFMotionPressable';
export { AFSkeleton, type AFSkeletonProps } from './AFSkeleton';
export { AFProgressRing, type AFProgressRingProps } from './AFProgressRing';
export { AFStatusBadge, type AFStatusBadgeProps, type AFStatusTone } from './AFStatusBadge';
export { AFSectionLabel, type AFSectionLabelProps } from './AFSectionLabel';
export { AFListRow, type AFListRowProps } from './AFListRow';

// F3 · Primitives B
export { AFTopBar, type AFTopBarProps, type AFTopBarAction } from './AFTopBar';
export { AFCommandCard, type AFCommandCardProps } from './AFCommandCard';
export { AFTimeline, type AFTimelineProps, type AFTimelineStep } from './AFTimeline';
export { AFChart, type AFChartProps } from './AFChart';
export { AFDisclosureSheet, type AFDisclosureSheetProps } from './AFDisclosureSheet';
export { AFEmptyState, type AFEmptyStateProps } from './AFEmptyState';
export { AFErrorState, type AFErrorStateProps, type AFErrorVariant } from './AFErrorState';
export { AFEditorialHero, type AFEditorialHeroProps } from './AFEditorialHero';

// Phase 3 · shared primitives for the remaining-screen redesigns
export { AFPrice, type AFPriceProps } from './AFPrice';
export { AFProductCard, type AFProductCardProps } from './AFProductCard';
export {
  AFSegmentedControl,
  type AFSegmentedControlProps,
  type AFSegment,
} from './AFSegmentedControl';

// RC-1 Wave-2B · state-matrix — honest offline visibility + inline retry
export { AFOfflineBanner, type AFOfflineBannerProps } from './AFOfflineBanner';
export { AFInlineErrorRow, type AFInlineErrorRowProps } from './AFInlineErrorRow';

// RC-1 Wave-5 · a11y breadth — composed numeral+label announcement
export { AFStatPair, type AFStatPairProps } from './AFStatPair';

export * from './afPrimitives.logic';
