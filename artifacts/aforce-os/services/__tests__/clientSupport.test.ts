/**
 * CLIENT VERSION AWARENESS — the eight adversarial proofs, client side.
 *
 * The asymmetry that shapes every one of these: failing to block a stale build
 * costs a slower recovery; blocking a GOOD build locks a member out of a
 * working app, and with no OTA the only remedy is an App Store review cycle.
 * So the laws below are mostly about proving the gate CANNOT fire — and one
 * that proves it still can, because a gate that never fires is a no-op rather
 * than a safe default.
 *
 * The last block is a CROSS-PACKAGE law: the client builds the header and the
 * server parses it, in two files that could drift apart silently. It runs the
 * real server parser over the real client output rather than trusting that the
 * two grammars match.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateOwnSupport,
  shouldBlockForUpgrade,
  parseOwnIdentity,
  recordClientPolicy,
  getLastClientPolicy,
  __resetClientPolicyForTests,
  FORCED_UPDATE_UI_ENABLED,
  type ClientSupportPolicy,
} from '../clientSupport';
import { buildClientIdentityHeader } from '../clientIdentity';
// The REAL server implementation, imported across packages so the two cannot
// drift without this file failing.
import {
  parseClientHeader,
  evaluateClientSupport,
  CLIENT_SUPPORT_POLICY,
} from '../../../api-server/src/lib/clientVersion';

/** The artifacts actually in the field, verified from the shipped EAS builds. */
const IOS_71 = 'ios/1.0.0+71';
const ANDROID_1 = 'android/1.0.0+1';

beforeEach(() => __resetClientPolicyForTests());

describe('1+2 — no policy, or no identity, never blocks', () => {
  // NO POLICY AT ALL is `unknown` — we have never heard from a server that
  // knows about versions.
  it.each([
    ['never fetched', null],
    ['undefined', undefined],
    ['not an object', 'nope' as unknown],
  ])('policy %s → unknown', (_label, policy) => {
    expect(evaluateOwnSupport(policy as ClientSupportPolicy | null, IOS_71)).toBe('unknown');
  });

  // A POLICY THAT ARRIVED but gates nothing is `supported`, not `unknown` —
  // the server has spoken and said no minimum applies. This matches the
  // server's own evaluator exactly, which the cross-package law below relies
  // on; the two must not disagree about what silence in a policy means.
  it.each([
    ['empty object', {}],
    ['no minimums', { minSupportedBuild: {} }],
    ['other platform only', { minSupportedBuild: { android: 999 } }],
  ])('policy %s → supported', (_label, policy) => {
    expect(evaluateOwnSupport(policy as ClientSupportPolicy, IOS_71)).toBe('supported');
  });

  it('and every one of those is NON-BLOCKING, which is the property that matters', () => {
    for (const policy of [null, undefined, 'nope' as unknown, {}, { minSupportedBuild: {} },
                          { minSupportedBuild: { android: 999 } }]) {
      const v = evaluateOwnSupport(policy as ClientSupportPolicy | null, IOS_71);
      expect(shouldBlockForUpgrade(v, true), `policy=${JSON.stringify(policy)}`).toBe(false);
    }
  });

  it('a build that cannot identify itself is unknown, not unsupported', () => {
    const strict: ClientSupportPolicy = { minSupportedBuild: { ios: 9999, android: 9999 } };
    for (const h of [null, '', 'garbage', 'web/1.0.0+1', 'ios/1.0.0', 'ios/1.0.0+abc']) {
      expect(evaluateOwnSupport(strict, h), `header=${String(h)}`).toBe('unknown');
    }
  });
});

describe('3 — the server the app talks to today publishes no policy at all', () => {
  it('an older server sends nothing, and nothing happens', () => {
    // Production api-server predates PR-1: its `/state` has no `clientPolicy`.
    recordClientPolicy(undefined);
    expect(getLastClientPolicy()).toBeNull();
    expect(evaluateOwnSupport(getLastClientPolicy(), IOS_71)).toBe('unknown');
  });

  it('a malformed policy body is discarded rather than half-read', () => {
    for (const junk of ['', 0, false, 'policy', NaN]) {
      recordClientPolicy(junk);
      expect(getLastClientPolicy(), `junk=${String(junk)}`).toBeNull();
    }
    // ANTI-VACUITY: a real policy IS retained.
    recordClientPolicy({ minSupportedBuild: { ios: 5, android: 0 } });
    expect(getLastClientPolicy()).toEqual({ minSupportedBuild: { ios: 5, android: 0 } });
  });
});

describe('4 — minimum 0 blocks nobody', () => {
  it('the policy PR-1 actually ships leaves both platforms supported', () => {
    const shipped = CLIENT_SUPPORT_POLICY as ClientSupportPolicy;
    expect(evaluateOwnSupport(shipped, IOS_71)).toBe('supported');
    expect(evaluateOwnSupport(shipped, ANDROID_1)).toBe('supported');
  });

  it('build 0 against minimum 0 is supported', () => {
    expect(evaluateOwnSupport({ minSupportedBuild: { ios: 0 } }, 'ios/1.0.0+0')).toBe('supported');
  });
});

describe('5 — the semantic version never decides anything', () => {
  it('the verdict is invariant across app versions at the same build', () => {
    const p: ClientSupportPolicy = { minSupportedBuild: { ios: 50 } };
    const verdicts = ['0.0.1', '1.0.0', '9.9.9', '2026.1.0'].map((v) =>
      evaluateOwnSupport(p, `ios/${v}+71`),
    );
    expect(new Set(verdicts)).toEqual(new Set(['supported']));
    expect(evaluateOwnSupport(p, 'ios/99.99.99+4')).toBe('unsupported');
  });
});

describe('6 — iOS and Android are judged separately', () => {
  it("Android's versionCode is never measured against the iOS minimum", () => {
    // The shipped reality: iOS 71, Android 1.
    const iosOnly: ClientSupportPolicy = { minSupportedBuild: { ios: 71 } };
    expect(evaluateOwnSupport(iosOnly, ANDROID_1)).toBe('supported');
    expect(evaluateOwnSupport(iosOnly, IOS_71)).toBe('supported');
    expect(evaluateOwnSupport(iosOnly, 'ios/1.0.0+70')).toBe('unsupported');
  });
});

describe('7 — no failure can manufacture a mandatory upgrade', () => {
  it('a non-numeric or non-positive minimum gates nothing', () => {
    for (const min of [undefined, null, NaN, Infinity, -1, 0, '50'] as unknown[]) {
      const p = { minSupportedBuild: { ios: min } } as unknown as ClientSupportPolicy;
      expect(evaluateOwnSupport(p, IOS_71), `min=${String(min)}`).toBe('supported');
    }
  });

  it('THE UI IS OFF, so even a real `unsupported` shows nobody anything', () => {
    expect(FORCED_UPDATE_UI_ENABLED).toBe(false);
    const verdict = evaluateOwnSupport({ minSupportedBuild: { ios: 9999 } }, IOS_71);
    expect(verdict, 'evaluation still runs — that is how telemetry becomes real').toBe('unsupported');
    expect(shouldBlockForUpgrade(verdict), 'but nothing is rendered').toBe(false);
  });
});

describe('8 — once activated the gate cannot be bypassed by accident', () => {
  it('with the UI on, a genuinely stale build IS blocked', () => {
    expect(shouldBlockForUpgrade(evaluateOwnSupport({ minSupportedBuild: { ios: 72 } }, IOS_71), true)).toBe(true);
  });

  it('and only `unsupported` blocks — never unknown, never supported', () => {
    expect(shouldBlockForUpgrade('unknown', true)).toBe(false);
    expect(shouldBlockForUpgrade('supported', true)).toBe(false);
  });

  it('the boundary is exact', () => {
    const p: ClientSupportPolicy = { minSupportedBuild: { ios: 71 } };
    expect(evaluateOwnSupport(p, 'ios/1.0.0+70')).toBe('unsupported');
    expect(evaluateOwnSupport(p, 'ios/1.0.0+71')).toBe('supported');
  });
});

describe('CROSS-PACKAGE — the client emits exactly what the server parses', () => {
  const CASES: Array<[string, string, string, string]> = [
    ['ios', '1.0.0', '71', IOS_71],
    ['android', '1.0.0', '1', ANDROID_1],
    ['ios', '1.2.3-beta.4', '250', 'ios/1.2.3-beta.4+250'],
  ];

  it.each(CASES)('%s %s+%s round-trips through the real server parser', (os, ver, build, expected) => {
    const header = buildClientIdentityHeader(os, ver, build);
    expect(header).toBe(expected);
    const parsed = parseClientHeader(header);
    expect(parsed, 'the server must understand what the client sent').not.toBeNull();
    expect(parsed!.platform).toBe(os);
    expect(parsed!.appVersion).toBe(ver);
    expect(parsed!.build).toBe(Number(build));
  });

  it('the two evaluators agree on every verdict', () => {
    const policies: ClientSupportPolicy[] = [
      { minSupportedBuild: { ios: 0, android: 0 } },
      { minSupportedBuild: { ios: 71, android: 1 } },
      { minSupportedBuild: { ios: 72, android: 2 } },
      { minSupportedBuild: { ios: 9999, android: 9999 } },
    ];
    for (const p of policies) {
      for (const h of [IOS_71, ANDROID_1]) {
        expect(evaluateOwnSupport(p, h), `${h} vs ${JSON.stringify(p)}`)
          .toBe(evaluateClientSupport(parseClientHeader(h), p as never));
      }
    }
  });

  it('the client refuses to send what the server would reject', () => {
    // Anything the client would emit must parse. The inverse of the law above:
    // rather than sending a string the server files as `unknown`, it sends
    // nothing — which is the same outcome without the misleading telemetry.
    for (const [os, ver, build] of [
      ['ios', '1.0.0', '1.2'], ['ios', '1.0.0', 'abc'], ['web', '1.0.0', '1'],
      ['ios', '', '1'], ['android', '1.0.0', '-1'], ['ios', '1.0.0', ''],
    ] as Array<[string, string, string]>) {
      const header = buildClientIdentityHeader(os, ver, build);
      expect(header, `${os}/${ver}+${build}`).toBeNull();
    }
  });

  it('ANTI-VACUITY: buildClientIdentityHeader is not simply always null', () => {
    expect(buildClientIdentityHeader('ios', '1.0.0', '71')).toBe(IOS_71);
  });

  it("the app.json values would have been WRONG — this is why native is read", () => {
    // app.json still says ios.buildNumber "1" while the shipped artifact is
    // build 71. Reading the config would report every iOS install as build 1
    // and make the fleet look uniformly ancient.
    expect(buildClientIdentityHeader('ios', '1.0.0', '1')).toBe('ios/1.0.0+1');
    expect(buildClientIdentityHeader('ios', '1.0.0', '71')).toBe(IOS_71);
    expect(parseClientHeader('ios/1.0.0+1')!.build).not.toBe(parseClientHeader(IOS_71)!.build);
  });
});
