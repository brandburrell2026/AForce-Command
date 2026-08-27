// S2-10b(1): shell + kit scanned together (primitives + styles moved verbatim to profileKit.tsx).
/**
 * ProfileScreenV2 — the founder's Profile section architecture (Wave-5).
 *
 * Profile scored 3.9/10 (simplicity 2, trust 3) and was called a
 * "miscellaneous feature warehouse": eighteen equal-weight headed cards with
 * no stated taxonomy, no home for PRIVACY or NOTIFICATIONS, and a fixture
 * device list claiming a LIVE connection every member had. The founder's
 * brief names the sections a member must be able to find:
 *
 *   IDENTITY · PERFORMANCE PROFILE · CONNECTED DATA · PRIVACY ·
 *   NOTIFICATIONS · SUBSCRIPTION · ACCOUNT · SUPPORT
 *
 * This guard holds that architecture in place. It asserts STRUCTURE — which
 * block owns which concern, and which tab owns which block — not wording, so
 * copy can still be tuned without touching this file.
 *
 * `ProfileScreenV2` pulls in `useAppStore` / `expo-router` / the WHOOP, Garmin
 * and Apple Health service modules, so it is not mounted directly; see
 * `profileScreenV2ErrorAndSkeletonWiring.test.ts`'s header for the
 * source-text-guard pattern this repo uses for that container, and
 * `profileScreenV2LegalReachability.test.ts` for the sibling guard on the one
 * placement that is a compliance requirement rather than an IA preference.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// S2-10b(2): the tab blocks live in panes/*.tsx now — shell + kit + panes
// scanned together (mechanism move, every invariant intact).
const SOURCE = (readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8') + readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'PerformancePane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'DevicesPane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'AccountPane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'DeveloperPane.tsx'), 'utf8')
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

// S2-10b(2): the trailing-footer invariant below is about the SHELL's render
// tail — panes contribute blocks, not the frame — so that one slice scopes to
// the shell alone (a pane's inline IIFE would otherwise shift lastIndexOf).
const SHELL_CODE = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, '');

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar'] as const;

/** Slice the balanced `(...)` payload of a `const <name> = (` declaration. */
function balancedDeclaration(name: string): string {
  const start = CODE.indexOf(`const ${name} = (`);
  if (start === -1) throw new Error(`ProfileScreenV2 no longer declares \`${name}\``);
  let depth = 0;
  for (let i = CODE.indexOf('(', start); i < CODE.length; i += 1) {
    if (CODE[i] === '(') depth += 1;
    else if (CODE[i] === ')') {
      depth -= 1;
      if (depth === 0) return CODE.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced parens in \`${name}\``);
}

/**
 * tab id -> the block identifiers that render under it.
 * S2-10b(2): `tabSections` wires each tab to a pane render function
 * (`renderXSections(paneCtx)` in panes/<X>Pane.tsx) and each pane's
 * `return [...]` lists its blocks — the map follows that chain, so it still
 * fails if a tab loses its pane or a block is moved, duplicated, or dropped.
 */
function tabSectionsMap(): Record<string, string[]> {
  const start = CODE.indexOf('const tabSections: Record<ProfileTabId, React.ReactNode[]>');
  if (start === -1) throw new Error('ProfileScreenV2 no longer declares `tabSections`');
  const body = CODE.slice(start, CODE.indexOf('};', start));
  const map: Record<string, string[]> = {};
  for (const [, id, fn] of body.matchAll(/(\w+):\s*(render\w+Sections)\(paneCtx\)/g)) {
    const fnStart = CODE.indexOf(`export function ${fn}(`);
    if (fnStart === -1) throw new Error(`pane render function \`${fn}\` is not defined in the scanned panes`);
    const retStart = CODE.indexOf('return [', fnStart);
    if (retStart === -1) throw new Error(`\`${fn}\` no longer returns a block array`);
    const list = CODE.slice(retStart + 'return ['.length, CODE.indexOf(']', retStart));
    map[id] = list.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return map;
}

/** Tab ids `VISIBLE_PROFILE_TABS` removes when developer controls are off. */
function developerStrippedTabIds(): string[] {
  const start = CODE.indexOf('const VISIBLE_PROFILE_TABS');
  if (start === -1) throw new Error('ProfileScreenV2 no longer declares `VISIBLE_PROFILE_TABS`');
  return [...CODE.slice(start, CODE.indexOf(';', start)).matchAll(/tab\.id\s*!==\s*'(\w+)'/g)].map(([, id]) => id);
}

/** Tabs an ordinary production member can actually open. */
function memberFacingTabs(): Record<string, string[]> {
  const stripped = new Set(developerStrippedTabIds());
  return Object.fromEntries(Object.entries(tabSectionsMap()).filter(([id]) => !stripped.has(id)));
}

/**
 * The founder's eight sections, each mapped to the block that owns it and the
 * `profile.v2.*` label key that names it on screen. IDENTITY is deliberately
 * absent from `tabSections`: it renders above the tab bar (asserted below).
 */
const SECTION_BLOCKS: ReadonlyArray<{ section: string; block: string; labelKey: string }> = [
  { section: 'PERFORMANCE PROFILE', block: 'performanceProfileBlock', labelKey: 'performance_profile_label' },
  { section: 'CONNECTED DATA', block: 'connectedDataBlock', labelKey: 'connected_data_label' },
  { section: 'PRIVACY', block: 'privacyBlock', labelKey: 'privacy_label' },
  { section: 'NOTIFICATIONS', block: 'notificationsBlock', labelKey: 'notifications_label' },
  { section: 'SUBSCRIPTION', block: 'subscriptionBlock', labelKey: 'subscription_label' },
  { section: 'ACCOUNT', block: 'settingsBlock', labelKey: 'account_label' },
  { section: 'SUPPORT', block: 'legalBlock', labelKey: 'legal_label' },
];

describe('ProfileScreenV2 — every founder section has exactly one headed home', () => {
  for (const { section, block, labelKey } of SECTION_BLOCKS) {
    it(`${section} is a headed group (\`${block}\` opens with SectionHeader profile.v2.${labelKey})`, () => {
      const decl = balancedDeclaration(block);
      expect(decl).toContain('<SectionHeader');
      expect(decl).toContain(`t('profile.v2.${labelKey}')`);
    });

    it(`${section} appears on exactly one tab (no block is duplicated or homeless)`, () => {
      const hosts = Object.entries(tabSectionsMap())
        .filter(([, blocks]) => blocks.includes(block))
        .map(([id]) => id);
      expect(hosts, `\`${block}\` hosts`).toHaveLength(1);
    });

    it(`${section} is reachable without developer controls`, () => {
      const reachable = Object.entries(memberFacingTabs()).some(([, blocks]) => blocks.includes(block));
      expect(reachable, `\`${block}\` is only on a developer-gated tab`).toBe(true);
    });
  }

  it('IDENTITY renders above the tab bar in BOTH layouts, so it is never behind a tab', () => {
    const identity = balancedDeclaration('identityBlock');
    expect(identity).toContain("t('profile.v2.identity_label')");
    expect(identity).toContain('{profileCard}');
    // Wide (two-column) and narrow both render it ahead of {tabBar}.
    expect(CODE.split(/\{identityBlock\}\s*\n\s*\{tabBar\}/).length - 1).toBe(2);
    // ...and it is therefore NOT one of the per-tab sections.
    for (const blocks of Object.values(tabSectionsMap())) expect(blocks).not.toContain('identityBlock');
  });
});

describe('ProfileScreenV2 — the two sections that had no home before Wave-5', () => {
  it('PRIVACY owns the analytics consent row; it is no longer buried inside the settings card', () => {
    expect(balancedDeclaration('privacyBlock')).toContain('<AnalyticsConsentRow />');
    expect(balancedDeclaration('settingsBlock')).not.toContain('<AnalyticsConsentRow');
  });

  it('PRIVACY also owns Performance Memory governance — "what has AForce observed, and how do I erase it" is one question', () => {
    expect(balancedDeclaration('privacyBlock')).toContain('<PerformanceMemoryGovernanceCard />');
  });

  it('NOTIFICATIONS owns the notification-preferences entry, which used to trail the goals card', () => {
    const notifications = balancedDeclaration('notificationsBlock');
    expect(notifications).toContain('testID="profile-notifications-link"');
    expect(notifications).toContain("router.push('/notifications')");
    expect(balancedDeclaration('performanceProfileBlock')).not.toContain('profile-notifications-link');
  });

  it('NOTIFICATIONS also owns the Voice Coach — it is an interruption channel, not a performance setting', () => {
    const notifications = balancedDeclaration('notificationsBlock');
    expect(notifications).toContain('testID="profile-voice-coach-toggle"');
    // The whole voice panel moved with the toggle; nothing was left stranded
    // under a heading that no longer exists.
    expect(CODE).not.toContain("t('profile.voice_section.label')");
    expect(notifications).toContain('testID="profile-voice-replay"');
  });
});

describe('ProfileScreenV2 — UI that was removed rather than restyled', () => {
  it('the fixture CONNECTED DEVICES list is gone (it showed every member a LIVE Apple Watch + Oura Ring)', () => {
    expect(CODE).not.toContain('mockUserProfile.connectedDevices');
    expect(CODE).not.toContain("t('profile.v2.connected_devices_label')");
  });

  it('the "Reminders" switch is gone — it was local `useState` that persisted nothing', () => {
    expect(CODE).not.toContain('remindersEnabled');
    expect(CODE).not.toContain("t('profile.v2.reminders')");
  });

  it('the derived daily-ounces row is folded into the row it restated (target × 12), not a row of its own', () => {
    expect(CODE).not.toContain("t('profile.v2.daily_ounces_target')");
    expect(balancedDeclaration('performanceProfileBlock')).toContain("t('profile.v2.daily_target_oz_sub'");
  });

  it('MODULES / WEEKLY REPORT / PROTOCOL TOOLS are one headed group, not three', () => {
    const tools = balancedDeclaration('protocolToolsCard');
    for (const testID of [
      'profile-modules-link',
      'profile-weekly-report-link',
      'profile-sensors-link',
      'profile-cruise-link',
      'profile-achievements-link',
      'profile-science-link',
    ]) {
      expect(tools, `${testID} belongs to the merged tools group`).toContain(`testID="${testID}"`);
    }
    expect(CODE).not.toContain("t('profile.v2.modules_label')");
    expect(CODE).not.toContain("t('profile.v2.weekly_label')");
  });

  it('the standalone PREFERENCES card is folded into ACCOUNT (four unit rows did not need their own group)', () => {
    expect(CODE).not.toContain("t('profile.v2.preferences_label')");
    expect(balancedDeclaration('settingsBlock')).toContain("t('profile.v2.pref_weight')");
  });

  it('PROFILE STRENGTH is folded onto the identity card it measures, not a headed card of one row', () => {
    expect(CODE).not.toContain("t('profile.v2.strength_label')");
    expect(CODE).toContain('testID="profile-strength-row"');
  });

  it('sign-out and the patent footer belong to a section instead of trailing every tab', () => {
    expect(balancedDeclaration('settingsBlock')).toContain('<SignOutRow />');
    expect(balancedDeclaration('legalBlock')).toContain("t('profile.v2.patent_pending')");
    // Neither may reappear after the tab-content IIFE, which is what made them
    // the last thing a member read on the goals and devices tabs alike.
    // `lastIndexOf` over the SHELL alone: the shell's last inline IIFE is the
    // tab-content render (the WHOOP snapshot IIFE moved into DevicesPane).
    const afterSections = SHELL_CODE.slice(SHELL_CODE.lastIndexOf('})()}'));
    expect(afterSections).not.toContain('<SignOutRow />');
    expect(afterSections).not.toContain("t('profile.v2.patent_pending')");
  });
});

describe('ProfileScreenV2 — density: fewer equal-weight cards per tab', () => {
  // Before Wave-5: performance 7, devices 2 (three headed groups), account 6.
  // These caps are the point of the task — raising one means re-arguing the
  // founder's "fewer equal-weight cards" lever, not silently absorbing drift.
  const CAPS: Record<string, number> = { performance: 2, devices: 2, account: 7 };

  for (const [tab, cap] of Object.entries(CAPS)) {
    it(`the ${tab} tab carries at most ${cap} top-level groups`, () => {
      const blocks = tabSectionsMap()[tab] ?? [];
      expect(blocks.length, `${tab}: ${blocks.join(', ')}`).toBeLessThanOrEqual(cap);
    });
  }

  it('the account tab runs SUBSCRIPTION first and SUPPORT last, with the referral card demoted out of the lead', () => {
    const account = tabSectionsMap()['account'] ?? [];
    expect(account[0]).toBe('subscriptionBlock');
    expect(account[account.length - 1]).toBe('legalBlock');
    // `inviteCard` used to open this tab: a referral code greeted a member who
    // came to check their plan.
    expect(account.indexOf('inviteCard')).toBeGreaterThan(account.indexOf('subscriptionBlock'));
  });
});

describe('ProfileScreenV2 — internal-only surfaces stay behind the developer strip', () => {
  it('the demo-modes card is developer-only: it activates Night Out against the REAL server session', () => {
    expect(tabSectionsMap()['developer'] ?? []).toContain('demoModesCard');
    for (const [id, blocks] of Object.entries(memberFacingTabs())) {
      expect(blocks, `${id} must not expose demoModesCard`).not.toContain('demoModesCard');
    }
  });

  it('PerformanceIdentityCard — a self-described internal verification surface — mounts inside the developer block', () => {
    expect(balancedDeclaration('developerBlock')).toContain('<PerformanceIdentityCard />');
    expect(balancedDeclaration('settingsBlock')).not.toContain('<PerformanceIdentityCard');
  });

  it('the strip itself is unchanged (SS-01 — this regroup must not widen who sees developer controls)', () => {
    expect(developerStrippedTabIds()).toEqual(['developer']);
    expect(CODE).toMatch(/developerControlsAvailable\(\)\s*\?\s*PROFILE_TABS/);
  });
});

describe('ProfileScreenV2 — the section labels exist in every shipped locale', () => {
  const NEW_KEYS = [
    'identity_label',
    'performance_profile_label',
    'performance_profile_hint',
    'daily_target_oz_sub',
    'connected_data_label',
    'connected_data_hint',
    'privacy_label',
    'privacy_hint',
    'notifications_label',
    'notifications_hint',
    'account_label',
    'account_hint',
  ] as const;

  for (const locale of LOCALES) {
    it(`${locale}.json carries every new profile.v2 section key`, () => {
      const v2 = JSON.parse(
        readFileSync(join(__dirname, '..', '..', '..', 'locales', `${locale}.json`), 'utf8'),
      ).profile.v2;
      for (const key of NEW_KEYS) {
        expect(typeof v2[key], `${locale}.json profile.v2.${key}`).toBe('string');
        expect(v2[key]).not.toBe('');
      }
    });
  }
});
