/**
 * DECISION GUARD SEAM LOCK — pins the wiring, not just the module.
 *
 * The directive makes "Decision Guard bypass" a zero-tolerance release
 * category (:1158) and the adaptEngineOutput precedent proved that
 * "single seam" claims drift (it was documented as the one seam before
 * timer-resetting dispatches, yet 5 of 8 engine-output ingress points
 * bypass it today). This lock therefore pins every delivery path out of
 * AppProvider to the guard, at the source level:
 *
 *  1. AppProvider guards once per engine-output change
 *     (guardEngineOutput memo) and builds `deliveredState`.
 *  2. The facade delivers guarded output (pickFacadeState(deliveredState),
 *     dep keyed on guardedDelivery.engineOutput).
 *  3. The slices deliver guarded output (<SliceProvider state={deliveredState}).
 *  4. The voice effect speaks guarded copy only.
 *  5. The journal snapshot persists guarded copy only.
 *  6. The verdict is recorded to the command ledger
 *     (decisionGuardResultToCommandEvent → appendCommandEvents), and the
 *     event survives the ledger's own normalizer round-trip.
 *
 * A future delivery path added to AppProvider that reads raw
 * `state.engineOutput.command` trips check 7 and must either consume the
 * guarded value or be consciously allowlisted here.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decisionGuardResultToCommandEvent } from '../../utils/intelligence/commandEventAdapters';
import { normalizeCommandEvent } from '../../utils/intelligence/commandEvents';

const SRC = readFileSync(join(__dirname, '..', 'useAppStore.tsx'), 'utf8');
const MOMENTS_SRC = readFileSync(
  join(__dirname, '..', '..', 'services', 'momentNotifications.ts'),
  'utf8',
);

describe('AppProvider delivers only guarded engine output', () => {
  it('guards once per engine-output change', () => {
    expect(SRC).toMatch(
      /const guardedDelivery = useMemo\(\(\) => guardEngineOutput\(state\.engineOutput\), \[state\.engineOutput\]\);/,
    );
    // Exactly one guard call site — a second one would fork the verdict.
    expect(SRC.match(/guardEngineOutput\(/g)?.length).toBe(1);
  });

  it('facade and slices consume deliveredState, never raw state', () => {
    expect(SRC).toMatch(/pickFacadeState\(deliveredState\)/);
    expect(SRC).not.toMatch(/pickFacadeState\(state\)/);
    expect(SRC).toMatch(/<SliceProvider\s*\n\s*state=\{deliveredState\}/);
    expect(SRC).not.toMatch(/<SliceProvider\s*\n\s*state=\{state\}/);
  });

  it('voice effect and journal snapshot read guarded copy', () => {
    expect(SRC).toMatch(/const cmd = guardedDelivery\.engineOutput\.command;/);
    expect(SRC).toMatch(
      /const reason = guardedDelivery\.engineOutput\.command\?\.action\?\.slice\(0, 240\) \?\? '';/,
    );
  });

  it('records the Decision Guard result to the command ledger', () => {
    expect(SRC).toMatch(/decisionGuardResultToCommandEvent\(\{/);
    expect(SRC).toMatch(/void appendCommandEvents\(\[ev\]\);/);
  });

  it('no delivery-side raw command reads remain (allowlist-anchored sweep)', () => {
    // Raw `state.engineOutput.command` may appear ONLY at the sanctioned
    // sites: the guard memo input is `state.engineOutput` (not .command),
    // and the ledger-key read in the record effect. Everything else must
    // go through guardedDelivery/deliveredState.
    const rawCommandReads = SRC.match(/state\.engineOutput\.command/g) ?? [];
    // 2 sanctioned: the ledger effect's `cmdId` read + its dep entry.
    expect(
      rawCommandReads.length,
      'new raw state.engineOutput.command read in AppProvider — route it through the Decision Guard',
    ).toBeLessThanOrEqual(2);
  });
});

describe('ledger row — schema-safe and normalizer-stable', () => {
  it('approved and blocked rows survive normalizeCommandEvent round-trip', () => {
    for (const result of [
      { verdict: 'approved' } as const,
      { verdict: 'blocked', reason: 'unsafe_dose' } as const,
    ]) {
      const ev = decisionGuardResultToCommandEvent({
        result,
        commandId: 'cmd-test',
        atMs: 1_700_000_000_000,
      });
      expect(ev).not.toBeNull();
      const normalized = normalizeCommandEvent(ev as unknown);
      expect(normalized).toEqual(ev);
      expect(normalized?.kind).toBe('execution_event');
      expect((normalized as { subtype?: string }).subtype).toBe('decision_guard_result');
    }
  });

  it('id encodes the evaluation instant (first-wins merge cannot freeze verdicts)', () => {
    const a = decisionGuardResultToCommandEvent({
      result: { verdict: 'approved' },
      commandId: 'cmd-test',
      atMs: 1_700_000_000_000,
    });
    const b = decisionGuardResultToCommandEvent({
      result: { verdict: 'approved' },
      commandId: 'cmd-test',
      atMs: 1_700_000_000_001,
    });
    expect(a?.id).not.toBe(b?.id);
  });
});

describe('Moments notification lane — guard wired at qualification and delivery', () => {
  // Founder-authorized extension of the seam (#876 follow-up). The pure
  // planner runs the guard's structural check as the LAST qualification
  // step (after the DR-010 budget gates, before push), and the sync
  // bridge runs the deliverable-copy check on rendered title/body beside
  // the §42 scan, BEFORE the schedule call (notificationHonesty idiom:
  // source order proves gate-precedes-schedule in an IO layer).

  it('planner: guard step sits after the day-cap gate and before planned.push', () => {
    const gate = MOMENTS_SRC.indexOf('if (dayCount >= MOMENT_NOTIFY_MAX_PER_DAY) continue;');
    const guard = MOMENTS_SRC.indexOf(
      "if (evaluateMomentAction(rec.primaryAction).verdict === 'blocked') continue;",
    );
    const push = MOMENTS_SRC.indexOf('planned.push({');
    expect(gate).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(gate);
    expect(push).toBeGreaterThan(guard);
  });

  it('sync: rendered-copy guard sits beside the §42 scan and before scheduling', () => {
    const scan = MOMENTS_SRC.indexOf(
      'if (consumerCopyBlocked(title) || consumerCopyBlocked(body)) continue;',
    );
    const guardTitle = MOMENTS_SRC.indexOf("evaluateDeliverableCopy(title).verdict === 'blocked'");
    const guardBody = MOMENTS_SRC.indexOf("evaluateDeliverableCopy(body).verdict === 'blocked'");
    const schedule = MOMENTS_SRC.indexOf('await Notif.scheduleNotificationAsync({');
    expect(scan).toBeGreaterThan(-1);
    expect(guardTitle).toBeGreaterThan(scan);
    expect(guardBody).toBeGreaterThan(guardTitle);
    expect(schedule).toBeGreaterThan(guardBody);
  });

  it('both checks import from the one guard module (no forked authority)', () => {
    expect(MOMENTS_SRC).toMatch(
      /import \{ evaluateDeliverableCopy, evaluateMomentAction \} from '@\/utils\/intelligence\/decisionGuard';/,
    );
  });
});

describe('Moments in-app lane — recFor delivers only guarded recommendations', () => {
  // Founder-authorized #877 follow-up: useMomentsData.recFor is the ONE
  // seam every in-app Moments surface consumes (NextMomentCard,
  // MomentsScreen, MomentDetailScreen, PrepareMyDayScreen). The raw
  // builder may not reach the cache or a renderer.
  const HOOK_SRC = readFileSync(
    join(__dirname, '..', '..', 'components', 'moments', 'useMomentsData.ts'),
    'utf8',
  );

  it('recFor routes the builder through guardMomentRecommendation before caching', () => {
    expect(HOOK_SRC).toMatch(
      /const \{ rec \} = guardMomentRecommendation\(buildRecommendation\(moment, signals, nowIso\)\);/,
    );
    expect(HOOK_SRC).not.toMatch(/const rec = buildRecommendation\(/);
  });

  it('single guard import; the raw builder has no other call site in the hook', () => {
    expect(HOOK_SRC).toMatch(
      /import \{ guardMomentRecommendation \} from '@\/utils\/intelligence\/decisionGuard';/,
    );
    expect(HOOK_SRC.match(/buildRecommendation\(/g)?.length).toBe(1);
  });
});

describe('Day-cadence lane — one guarded copy source, no raw-table delivery', () => {
  // Founder-authorized Day-cadence coverage ruling (#878 follow-up): the
  // slot derivation in services/notifications.ts judges every day's copy;
  // the OS bridge must deliver slot.title/slot.body and never re-read the
  // raw NOTIFICATION_COPY table (a second, unguarded copy path).
  const CADENCE_SRC = readFileSync(
    join(__dirname, '..', '..', 'services', 'notifications.ts'),
    'utf8',
  );
  const BRIDGE_SRC = readFileSync(
    join(__dirname, '..', '..', 'services', 'pushNotifications.ts'),
    'utf8',
  );

  it('the derivation guards every slot before it enters the schedule', () => {
    const guardTitle = CADENCE_SRC.indexOf("evaluateDeliverableCopy(copy.title).verdict === 'blocked'");
    const guardBody = CADENCE_SRC.indexOf("evaluateDeliverableCopy(copy.body).verdict === 'blocked'");
    const push = CADENCE_SRC.indexOf('slots.push({');
    expect(guardTitle).toBeGreaterThan(-1);
    expect(guardBody).toBeGreaterThan(guardTitle);
    expect(push).toBeGreaterThan(guardBody);
  });

  it('the OS bridge consumes guarded slots only — the raw table never reaches delivery', () => {
    expect(BRIDGE_SRC).toMatch(/title: slot\.title,/);
    expect(BRIDGE_SRC).toMatch(/body: slot\.body,/);
    expect(BRIDGE_SRC).not.toMatch(/NOTIFICATION_COPY/);
  });

  it('the banner path shares the same guarded slots (no separate copy source)', () => {
    const BANNER_SRC = readFileSync(
      join(__dirname, '..', '..', 'components', 'home', 'NotificationBanner.tsx'),
      'utf8',
    );
    expect(BANNER_SRC).toMatch(/deriveScheduledNotifications\(/);
    expect(BANNER_SRC).not.toMatch(/NOTIFICATION_COPY/);
  });
});
