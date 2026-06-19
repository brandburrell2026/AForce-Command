import { describe, it, expect } from 'vitest';

import {
  ACTIVATION_CONVERSIONS,
  ACTIVATION_STAGES,
  aggregateConversion,
  aggregateConversions,
  aggregateStageCounts,
  conversionsBySegment,
  deriveActivationFunnel,
  elapsedMsBetween,
  segmentByAttribution,
  UNATTRIBUTED,
  type ActivationFunnelState,
  type MilestoneTimestamps,
} from '../activation/funnel';
import {
  EMPTY_ATTRIBUTION,
  parseActivationLink,
} from '../activation/attribution';

const T = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toISOString();

function funnel(
  milestones: MilestoneTimestamps,
  link?: string,
): ActivationFunnelState {
  return deriveActivationFunnel({
    milestones,
    attribution: link ? parseActivationLink(link) : undefined,
  });
}

describe('ACTIVATION_STAGES', () => {
  it('matches the owner funnel order exactly', () => {
    expect(ACTIVATION_STAGES).toEqual([
      'can_purchased',
      'qr_scanned',
      'app_opened',
      'profile_completed',
      'performance_age_baseline',
      'first_command_issued',
      'first_command_completed',
      'first_win_confirmed',
      'day7_subscription_offer',
    ]);
  });
});

describe('deriveActivationFunnel', () => {
  it('returns an empty funnel when no milestones are present', () => {
    const f = funnel({});
    expect(f.reachedCount).toBe(0);
    expect(f.furthestStage).toBeNull();
    expect(f.furthestIndex).toBe(-1);
    expect(f.attribution).toEqual(EMPTY_ATTRIBUTION);
    expect(Object.values(f.reached).every((v) => v === false)).toBe(true);
  });

  it('marks reached only for parseable timestamps', () => {
    const f = funnel({
      qr_scanned: T(1),
      app_opened: null,
      profile_completed: 'not-a-date',
    });
    expect(f.reached.qr_scanned).toBe(true);
    expect(f.reached.app_opened).toBe(false);
    expect(f.reached.profile_completed).toBe(false);
    expect(f.reachedAt.qr_scanned).toBe(T(1));
  });

  it('reports the highest-index reached stage even with gaps', () => {
    const f = funnel({ qr_scanned: T(1), first_command_completed: T(5) });
    expect(f.furthestStage).toBe('first_command_completed');
    expect(f.furthestIndex).toBe(ACTIVATION_STAGES.indexOf('first_command_completed'));
    expect(f.reachedCount).toBe(2);
  });

  it('does not let subscription_started advance the visible funnel', () => {
    const f = funnel({ day7_subscription_offer: T(2), subscription_started: T(3) });
    expect(f.reached.subscription_started).toBe(true);
    expect(f.furthestStage).toBe('day7_subscription_offer');
    expect(f.reachedCount).toBe(1); // subscription_started excluded from stage count
  });
});

describe('conversions', () => {
  it('defines the three headline conversions', () => {
    expect(ACTIVATION_CONVERSIONS.map((c) => c.id)).toEqual([
      'scanToInstall',
      'installToActivation',
      'activationToSubscription',
    ]);
  });

  const cohort: ActivationFunnelState[] = [
    funnel({ qr_scanned: T(0), app_opened: T(1), first_command_completed: T(2), subscription_started: T(3) }),
    funnel({ qr_scanned: T(0), app_opened: T(1), first_command_completed: T(2) }),
    funnel({ qr_scanned: T(0), app_opened: T(1) }),
    funnel({ qr_scanned: T(0) }), // scanned, never installed
  ];

  it('aggregates entered/converted/rate for one conversion', () => {
    const r = aggregateConversion(cohort, ACTIVATION_CONVERSIONS[0]); // scan→install
    expect(r.entered).toBe(4);
    expect(r.converted).toBe(3);
    expect(r.rate).toBeCloseTo(0.75);
  });

  it('requires reaching both endpoints to count as converted', () => {
    const [scan, install, sub] = aggregateConversions(cohort);
    expect(scan.converted).toBe(3); // 3 of 4 installed
    expect(install.converted).toBe(2); // 2 of 3 installs activated
    expect(sub.entered).toBe(2); // 2 activated
    expect(sub.converted).toBe(1); // 1 subscribed
    expect(sub.rate).toBeCloseTo(0.5);
  });

  it('returns a null rate when nobody entered', () => {
    const r = aggregateConversion([funnel({})], ACTIVATION_CONVERSIONS[0]);
    expect(r.entered).toBe(0);
    expect(r.rate).toBeNull();
  });
});

describe('aggregateStageCounts', () => {
  it('counts reached funnels per visible stage', () => {
    const counts = aggregateStageCounts([
      funnel({ qr_scanned: T(0), app_opened: T(1) }),
      funnel({ qr_scanned: T(0) }),
    ]);
    expect(counts.qr_scanned).toBe(2);
    expect(counts.app_opened).toBe(1);
    expect(counts.day7_subscription_offer).toBe(0);
  });
});

describe('segmentation by attribution', () => {
  const cohort: ActivationFunnelState[] = [
    funnel({ qr_scanned: T(0), app_opened: T(1) }, 'aforce-os://activate?sku=AF1'),
    funnel({ qr_scanned: T(0) }, 'aforce-os://activate?sku=AF1'),
    funnel({ qr_scanned: T(0), app_opened: T(1) }, 'aforce-os://activate?sku=AF2'),
    funnel({ qr_scanned: T(0), app_opened: T(1) }), // no attribution
  ];

  it('groups funnels by SKU with an unattributed bucket', () => {
    const seg = segmentByAttribution(cohort, 'sku');
    expect(seg.get('AF1')?.length).toBe(2);
    expect(seg.get('AF2')?.length).toBe(1);
    expect(seg.get(UNATTRIBUTED)?.length).toBe(1);
  });

  it('computes per-segment conversions', () => {
    const bySku = conversionsBySegment(cohort, 'sku');
    const af1 = bySku.find((s) => s.segment === 'AF1');
    const scanToInstall = af1?.results.find((r) => r.id === 'scanToInstall');
    expect(scanToInstall?.entered).toBe(2);
    expect(scanToInstall?.converted).toBe(1); // 1 of 2 AF1 scans installed
    expect(scanToInstall?.rate).toBeCloseTo(0.5);
  });
});

describe('elapsedMsBetween', () => {
  it('measures forward funnel velocity', () => {
    const f = funnel({ qr_scanned: T(0), app_opened: T(1) });
    expect(elapsedMsBetween(f, 'qr_scanned', 'app_opened')).toBe(3_600_000);
  });

  it('is null when a milestone is missing or the order is reversed', () => {
    const f = funnel({ qr_scanned: T(2), app_opened: T(1) });
    expect(elapsedMsBetween(f, 'qr_scanned', 'first_win_confirmed')).toBeNull();
    expect(elapsedMsBetween(f, 'qr_scanned', 'app_opened')).toBeNull(); // reversed
  });
});
