/**
 * RAW-STORAGE CLASSIFICATION LAWS (PR C).
 *
 * Founder ruling R7: every raw-storage bypass is classified ACCOUNT-SCOPED or
 * DEVICE-GLOBAL BY DESIGN, and device-global status is preserved "only where
 * the semantics are genuinely device-global".
 *
 * ── WHY THIS IS AN ALLOWLIST, NOT A SWEEP ──────────────────────────────────
 *
 * The danger is not the bypasses we classified; it is the thirteenth one,
 * added later by someone who did not know this program existed. So the law is
 * inverted: raw AsyncStorage access is FORBIDDEN unless the module is on an
 * explicit list, and each entry carries the reason it is device-global. A new
 * raw importer fails until a human writes down why it belongs.
 *
 * ── WHY THE LIST IS OF MODULES AND KEYS, NOT JUST MODULES ──────────────────
 *
 * `app/_layout.tsx` legitimately touches the onboarding flag AND renders the
 * identity gate. Allowing the file wholesale would let any future key ride in
 * on that permission, which is how a "different element satisfies the law"
 * failure happens. The keys are named.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

beforeEach(() => mem.clear());

const ROOT = join(__dirname, '..', '..');

/**
 * Modules permitted to touch AsyncStorage directly, with the key they own and
 * the reason. Anything not here must go through `scopedStorage`.
 */
const DEVICE_GLOBAL_ALLOWLIST: ReadonlyArray<{
  file: string;
  keys: readonly string[];
  why: string;
}> = [
  {
    file: 'app/_layout.tsx',
    keys: ['aforce.hasCompletedOnboarding'],
    why:
      'First-run gate. Read before ClerkLoaded to decide the first frame, so it ' +
      'cannot depend on identity; carries no member data — only "this handset has ' +
      'been through first-run". Scoping it would force every member on a shared ' +
      'device through onboarding again for no privacy gain, and would reintroduce ' +
      'a durable read before Clerk has answered.',
  },
  {
    file: 'app/index.tsx',
    keys: ['aforce.hasCompletedOnboarding'],
    why: 'Same first-run gate, same pre-identity read.',
  },
  {
    file: 'components/onboarding/OnboardingScreenV2.tsx',
    keys: ['aforce.hasCompletedOnboarding'],
    why:
      'Writes the same gate. Verified: this is the screen’s ONLY durable write — ' +
      'no answer the member gives during onboarding is persisted here.',
  },
  {
    file: 'components/performanceStatement/PerformanceStatementMount.tsx',
    keys: ['aforce.hasCompletedOnboarding'],
    why: 'Reads the same gate to decide whether to mount.',
  },
  {
    file: 'services/devMode.ts',
    keys: ['@aforce/devMode'],
    why:
      'Developer tooling state for the handset, not a member preference. It is ' +
      'also read at module evaluation, which is only safe BECAUSE it is ' +
      'device-global and therefore identity-independent.',
  },
  {
    file: 'services/intakeOutbox.ts',
    keys: ['@aforce/intake-outbox'],
    why:
      'ACCOUNT-SCOPED by nature, but NOT enrolled here. It runs its own ' +
      'per-user namespace authority (`setIntakeOutboxUser`) gated by the ' +
      '`offline_intake_outbox_enabled` runtime flag. The founder has recorded ' +
      'that second flag-controlled authority as a SEPARATE security ' +
      'prerequisite, to be resolved before wider beta, and directed that A/B/C ' +
      'not be widened with it unless correctness required it. It does not: this ' +
      'module shares no key or namespace with the scoped facade, so nothing in ' +
      'PR A/B/C depends on it changing. Listed here so the exemption is ' +
      'deliberate and visible, NOT because the data is device-global.',
  },
  {
    file: 'analytics/consentAuthority.ts',
    keys: ['@aforce/analytics-pending', '@aforce/analytics-id.v2'],
    why:
      'TRANSITIONAL EXCEPTION, founder-approved for the client analytics lane and ' +
      'ONLY as a bridge. These two keys are ACCOUNT-SCOPED — the opposite of ' +
      'device-global — and that is precisely why they cannot go through ' +
      '`scopedStorage` yet: while `per_user_storage_isolation_enabled` is false the ' +
      'facade resolves every key to its BARE, device-global name, and a ' +
      'device-global pending consent decision is exactly the "member A’s offline ' +
      'revoke replayed for member B" failure the record exists to prevent. So the ' +
      'member id is composed into the key directly, sourced ONLY from ' +
      '`getScopeState()` (no exported function accepts a userId), and nothing is ' +
      'read or written unless the scope is AUTHENTICATED. PR D must migrate both ' +
      'back under the facade and DELETE this entry; it is not a second storage ' +
      'authority and must not be allowed to become one.',
  },
  // The isolation infrastructure itself must reach the raw backend.
  {
    file: 'services/scopedStorage.ts',
    keys: [],
    why: 'The scoped facade itself — it IS the thing every other module routes through.',
  },
  {
    file: 'services/secureStorage.ts',
    keys: [],
    why: 'The Keychain-backed secure backend beneath the facade.',
  },
  {
    file: 'services/userScope.ts',
    keys: [],
    why: 'The scope authority, and the legacy migration it still owns until cutover.',
  },
  {
    file: 'services/userScopeCleanup.ts',
    keys: [],
    why: 'Purges the DEPARTING member’s scoped keys, which the facade cannot address.',
  },
];

const ALLOWED_FILES = new Set(DEVICE_GLOBAL_ALLOWLIST.map((e) => e.file));

const SKIP_DIRS = new Set([
  'node_modules', '__tests__', 'ios', 'android', '.expo', 'dist', 'demo', 'scripts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const IMPORTS_RAW = /from\s+'@react-native-async-storage\/async-storage'/;

describe('LAW C1 — raw AsyncStorage access is allowlisted, not ambient', () => {
  it('no production module imports AsyncStorage unless it is classified', () => {
    const offenders: string[] = [];
    for (const abs of walk(ROOT)) {
      const rel = relative(ROOT, abs);
      const src = readFileSync(abs, 'utf8');
      if (!IMPORTS_RAW.test(src)) continue;
      if (!ALLOWED_FILES.has(rel)) offenders.push(rel);
    }
    expect(
      offenders,
      'a new raw-storage bypass appeared. Classify it: route it through ' +
        'scopedStorage (and make its RAM scope-aware in the SAME change), or ' +
        'add it to DEVICE_GLOBAL_ALLOWLIST with a written reason.',
    ).toEqual([]);
    // MUTATION: add a raw AsyncStorage import to any unlisted module → red.
  });

  it('every allowlisted entry states WHY, so the exemption is a decision', () => {
    for (const e of DEVICE_GLOBAL_ALLOWLIST) {
      expect(e.why.length, `${e.file} has no stated reason`).toBeGreaterThan(20);
    }
  });

  it('an allowlisted file touches only the keys it was cleared for', () => {
    // Prevents a future key riding in on an existing file's permission — the
    // "a different element satisfies the law" failure this repo has hit before.
    const KEY_LITERAL = /['"](@aforce\/[A-Za-z0-9._/-]+|aforce\.[A-Za-z0-9._]+)['"]/g;
    const problems: string[] = [];
    for (const e of DEVICE_GLOBAL_ALLOWLIST) {
      if (e.keys.length === 0) continue; // infrastructure: no key inventory
      const src = readFileSync(join(ROOT, e.file), 'utf8');
      const raw = src.split('\n').filter((l) => /AsyncStorage\.\w+Item\(/.test(l)).join('\n');
      // Which allowlisted keys appear near the raw calls, via their constants.
      for (const m of raw.matchAll(KEY_LITERAL)) {
        if (!e.keys.includes(m[1] as string)) problems.push(`${e.file}: ${m[1]}`);
      }
    }
    expect(problems, 'an allowlisted file used a key it was not cleared for').toEqual([]);
  });
});

describe('LAW C2 — an account-scoped key is only enrolled with scope-aware RAM', () => {
  // The founder's condition: "Enroll a key into account-scoped storage only
  // when its owning RAM store is scope-aware in the same change." A module
  // that reads through the scoped facade AND holds module-level mutable cache
  // MUST also subscribe to scope changes, or it will serve the departing
  // member's value from memory for the whole of the next member's session.
  const CACHING_SCOPED_MODULES = [
    'services/commandLedger.ts',
    'services/hydroScanHistory.ts',
    'services/intentCapture.ts',
    'services/performanceMemoryCapture.ts',
    'services/voiceCheckIn.ts',
    'services/performanceStatements.ts',
    'services/momentsStore.ts',
    'services/momentFeedback.ts',
    'services/calendarMoments.ts',
    'services/locationIntelligenceService.ts',
    'services/coachMode.ts', // enrolled in PR C
    'analytics/privacy_manager.ts',
    'analytics/event_dispatcher.ts',
    // NOT consentAuthority: it deliberately uses `subscribeScopeState`, not
    // `subscribeUserScope`, because the latter fires zero times on an account
    // switch while the isolation flag is off. Its reset is proven behaviourally
    // in analytics/__tests__/clientAnalyticsTransition.test.ts (LAW 8).
  ];

  it.each(CACHING_SCOPED_MODULES)('%s resets its RAM on a scope change', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    expect(src, `${rel} reads scoped storage but never subscribes to scope changes`).toMatch(
      /subscribeUserScope\(/,
    );
    // MUTATION: remove the subscribeUserScope block from any of these → red.
  });

  it('useAppStore re-runs its scoped hydration when the member changes', () => {
    // This store cannot use subscribeUserScope directly: its hydration lives in
    // `[]`-deps effects and AppProvider does not remount on an account change,
    // because ClerkAuthBridge is mounted INSIDE it. It keys those effects on a
    // scope epoch instead. Asserted structurally: every scoped read in the
    // provider must sit in an effect keyed on `scopeEpoch`.
    const src = readFileSync(join(ROOT, 'store/useAppStore.tsx'), 'utf8');
    expect(src).toMatch(/function useScopeEpoch\(\)/);
    const scopedReads = (src.match(/scopedStorage\.getItem\(/g) ?? []).length;
    const keyedEffects = (src.match(/\}, \[scopeEpoch\]\);/g) ?? []).length;
    expect(scopedReads, 'the five PR C keys should be read here').toBeGreaterThanOrEqual(5);
    expect(
      keyedEffects,
      'every scoped hydration effect must re-run on a scope change',
    ).toBeGreaterThanOrEqual(4);
    // MUTATION: change a `[scopeEpoch]` dep back to `[]` → red.
  });
});

// ── LAW C3 · flag OFF is byte-identical for the newly enrolled keys ───

describe('LAW C3 — enrolment causes NO member-visible reset while the flag is off', () => {
  // The protocol step "verify no unexpected member-visible storage reset",
  // made executable. With isolation disabled every enrolled key must resolve
  // to its EXACT pre-PR-C bare name, so an existing member's stored value is
  // still found after the upgrade. If any of these strings changed, that
  // member silently loses the setting.
  const ENROLLED_KEYS = [
    'aforce.reminderLevel',
    '@aforce/notifications',
    '@aforce/coachMode',
    'aforce.voiceCoachEnabled',
    'aforce.selectedVoiceId',
    'aforce.voiceIntensity',
    'aforce.voiceScope',
    'aforce.unitPreferences',
  ] as const;

  it.each(ENROLLED_KEYS)('%s still reads and writes the legacy bare key', async (key) => {
    vi.resetModules();
    const userScope = await import('../userScope');
    userScope.__resetUserScopeForTests(); // isolation disabled — production default
    const { scopedStorage } = await import('../scopedStorage');

    // A value written by the PREVIOUS build, under the bare key.
    mem.set(key, 'PRE-EXISTING');
    expect(await scopedStorage.getItem(key), 'the member’s stored value must still be found').toBe(
      'PRE-EXISTING',
    );

    await scopedStorage.setItem(key, 'UPDATED');
    expect([...mem.keys()], 'no new key shape may appear while the flag is off').toEqual([key]);
    expect(mem.get(key)).toBe('UPDATED');
  });

  it('reminderPolicy round-trips through the legacy key with the flag off', async () => {
    vi.resetModules();
    const userScope = await import('../userScope');
    userScope.__resetUserScopeForTests();
    const rp = await import('../reminderPolicy');

    await rp.setReminderLevel('aggressive');
    expect(mem.get('aforce.reminderLevel')).toBe('aggressive');
    expect(await rp.getReminderLevel()).toBe('aggressive');
  });

  it('an unresolvable scope yields the DEFAULT level, never another member’s', async () => {
    vi.resetModules();
    const userScope = await import('../userScope');
    userScope.__resetUserScopeForTests();
    userScope.setScopeIsolationEnabled(true);
    userScope.resolveScope({ status: 'UNVERIFIABLE', reason: 'watchdog' });
    const rp = await import('../reminderPolicy');

    mem.set('aforce.reminderLevel', 'aggressive'); // someone else's bare value
    expect(await rp.getReminderLevel(), 'must fail closed to the default').toBe('standard');
  });
});
