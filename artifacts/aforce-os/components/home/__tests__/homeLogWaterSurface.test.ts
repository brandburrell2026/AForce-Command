/**
 * HomeScreenV2 — LOG WATER opens a logging surface (build-61 CORRECTION 2,
 * after build 60 failed physical-device QA).
 *
 * THE DEFECT THIS LOCKS OUT. Build 60 shipped the most important control in
 * the product wired like this:
 *
 *     onPrimary={() => {
 *       fireMoment('command_completed');
 *       void logIntake('water', { silent: true, ozOverride: parseDoseOz(...) });
 *     }}
 *
 * The tap WAS the commit: no picker, no amount from the member, no confirm, no
 * cancel. `silent: true` set `showCycleSuccess: false`, and the repo's only
 * `<CycleSuccessOverlay>` mount lived in `HomeScreenLegacy`, which
 * `spec_home: true` makes unreachable — so even without `silent` there was no
 * renderer. And the haptic fired on PRESS, telling the hand "logged" before
 * the write was attempted, and again when the write failed.
 *
 * SOURCE-TEXT GUARD, per this directory's documented convention:
 * `HomeScreenV2` is a store + router + Clerk-connected container this suite
 * never mounts (see `homeScreenV2Wiring.test.ts`'s header, and
 * `components/health/__tests__/connectedHealthContainer.render.test.tsx` for
 * the same rule stated for another container). The BEHAVIOUR of the surface
 * this file wires up — normal logging, cancel, back-out, repeated submit,
 * clamping, and that opening writes nothing — is covered for real, against a
 * real DOM, in `components/__tests__/waterAmountModal.render.test.tsx`. This
 * file covers the half that lives at the call site: which handler writes,
 * which one does not, what the amount comes from, what makes a duplicate
 * impossible, and when the member is told it worked.
 *
 * Every describe block below carries a mutation-verify test, because a
 * source-text assertion that cannot fail on a mutated source is decoration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
/** Comments may describe the old wiring; CODE is what actually runs. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/**
 * The body of a `React.useCallback` handler, bounded by whatever hook or the
 * JSX return follows it. Bounding on the NEXT declaration (rather than trying
 * to brace-match) keeps this a simple text slice while still guaranteeing one
 * handler's assertions can never be satisfied by a neighbouring handler's code.
 */
function handlerBody(name: string): string {
  const decl = `const ${name} = React.useCallback(`;
  const start = CODE.indexOf(decl);
  if (start < 0) throw new Error(`handler ${name} not found in HomeScreenV2.tsx`);
  const from = start + decl.length;
  const boundaries = ['React.useCallback(', 'React.useEffect(', 'React.useMemo(', 'return (']
    .map((marker) => CODE.indexOf(marker, from))
    .filter((i) => i > -1);
  const end = boundaries.length ? Math.min(...boundaries) : CODE.length;
  const body = CODE.slice(start, end);
  // Guard the guard: an empty/degenerate slice would make every `not.toContain`
  // below pass vacuously.
  if (body.length < decl.length + 10) throw new Error(`handlerBody(${name}) sliced nothing`);
  return body;
}

describe('CORRECTION 2 — the surface is SHIPPED UI, re-mounted (nothing new was built)', () => {
  it('mounts the existing WaterAmountModal — the picker that was dead code', () => {
    // Its only previous mount was `components/LogIntakeRow.tsx`, which nothing
    // in the app imports. The presets and the ±2 oz stepper already existed.
    expect(CODE).toContain("import { WaterAmountModal } from '@/components/WaterAmountModal';");
    expect(CODE).toMatch(/<WaterAmountModal\s/);
  });

  it('mounts the existing CycleSuccessOverlay — the confirmation the live Home had no renderer for', () => {
    expect(CODE).toContain("import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';");
    expect(CODE).toMatch(/<CycleSuccessOverlay\s/);
  });

  it('declares no bespoke Home-only picker or confirmation of its own', () => {
    // The failure mode this guards: re-solving a solved problem inside the
    // screen, so the app grows a second logging grammar.
    expect(CODE).not.toMatch(/function\s+\w*(Picker|AmountModal|SuccessOverlay|Confirmation)\w*\s*\(/);
    expect(CODE).not.toContain('<Modal');
    expect(CODE).not.toContain('TextInput');
  });

  it('mutation-verify: a removed mount is detectable', () => {
    const mutated = CODE.replace('<WaterAmountModal', '<View /* removed */');
    expect(mutated).not.toMatch(/<WaterAmountModal\s/);
  });
});

describe('CORRECTION 2 — pressing LOG WATER OPENS the logger and writes nothing', () => {
  it('the primary action is the picker-opening handler, not an inline commit', () => {
    expect(CODE).toMatch(/onPrimary=\{openWaterPicker\}/);
  });

  it('opening writes NOTHING: no intake, no haptic moment, no navigation', () => {
    // "NO score credit merely from opening the logger" — founder acceptance.
    const open = handlerBody('openWaterPicker');
    expect(open).not.toContain('logIntake');
    expect(open).not.toContain('fireMoment');
    expect(open).not.toContain('router.push');
    // All it may do is raise the surface.
    expect(open).toContain('setWaterPickerOpen(true)');
  });

  it('refuses to open while a write is already in flight', () => {
    // `logIntake` early-returns when `state.isCompletingCycle` is true, so an
    // amount confirmed in that window would be silently dropped — the member
    // would believe they logged.
    const open = handlerBody('openWaterPicker');
    expect(open).toMatch(/if \(isCompletingCycle \|\| confirmInFlightRef\.current\) return;/);
  });

  it('mutation-verify: an inline commit restored onto onPrimary is detectable', () => {
    const mutated = CODE.replace(
      'onPrimary={openWaterPicker}',
      "onPrimary={() => { void logIntake('water'); }}",
    );
    expect(mutated).not.toMatch(/onPrimary=\{openWaterPicker\}/);
    expect(mutated.slice(mutated.indexOf('onPrimary='), mutated.indexOf('primaryLoading'))).toContain(
      'logIntake(',
    );
  });
});

describe('CORRECTION 2 — the confirm handler is the ONLY thing that writes', () => {
  it('this screen calls logIntake in exactly one place', () => {
    expect(CODE.match(/logIntake\(/g) ?? []).toHaveLength(1);
  });

  it('…and that place is the picker confirm handler', () => {
    const confirm = handlerBody('confirmWaterAmount');
    expect(confirm).toContain("void logIntake('water', { ozOverride: oz });");
  });

  it('logs the amount the MEMBER chose — not a dose scraped out of the command copy', () => {
    // Build 60 wrote `ozOverride: parseDoseOz(engine.command.action)`: the app
    // deciding, on the member's behalf, how much they had just drunk.
    expect(CODE).not.toContain('parseDoseOz');
    expect(CODE).toContain("import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';");
  });

  it('drops `silent`, so the success path is live', () => {
    // `silent: true` sets `showCycleSuccess: false` in the reducer — the flag
    // that made this action feel dead.
    expect(CODE).not.toContain('silent: true');
    expect(CODE).not.toMatch(/silent:/);
  });

  it('mutation-verify: a second write call site is detectable', () => {
    const mutated = `${CODE}\n  void logIntake('water', { ozOverride: 8 });\n`;
    expect(mutated.match(/logIntake\(/g) ?? []).toHaveLength(2);
  });
});

describe('CORRECTION 2 — cancel and back-out write nothing', () => {
  it('cancel only closes the surface', () => {
    const cancel = handlerBody('cancelWaterPicker');
    expect(cancel).toContain('setWaterPickerOpen(false)');
    expect(cancel).not.toContain('logIntake');
    expect(cancel).not.toContain('fireMoment');
  });

  it('the picker routes its X, its backdrop and Android hardware-back to that one handler', () => {
    // `WaterAmountModal` passes `onCancel` to the header X, the backdrop
    // Pressable AND `AFModal`'s `onRequestClose` (the hardware-back channel),
    // so binding it here is what makes back-out inert.
    expect(CODE).toMatch(/<WaterAmountModal[\s\S]{0,200}?onCancel=\{cancelWaterPicker\}/);
  });

  it('mutation-verify: a cancel handler that logs is detectable', () => {
    const mutated = CODE.replace(
      'const cancelWaterPicker = React.useCallback(() => {\n    setWaterPickerOpen(false);',
      "const cancelWaterPicker = React.useCallback(() => {\n    void logIntake('water');\n    setWaterPickerOpen(false);",
    );
    expect(mutated.match(/logIntake\(/g) ?? []).toHaveLength(2);
  });
});

describe('CORRECTION 2 — one drink is one event (double tap, repeated submit)', () => {
  it('guards the confirm with a SYNCHRONOUS ref, not state', () => {
    // Two taps inside one frame both close over the same pre-render
    // `logIntake`, whose own `state.isCompletingCycle` check has not seen the
    // first tap yet. A `useState` flag re-renders too late to help; a ref is
    // written and read in the same tick.
    expect(CODE).toContain('const confirmInFlightRef = React.useRef(false);');
    const confirm = handlerBody('confirmWaterAmount');
    expect(confirm).toMatch(/if \(confirmInFlightRef\.current \|\| isCompletingCycle\) return;/);
    // The guard must be SET before the dispatch, or the second tap sails past.
    expect(confirm.indexOf('confirmInFlightRef.current = true;')).toBeLessThan(
      confirm.indexOf('logIntake('),
    );
  });

  it('the guard is not a `useState` in disguise', () => {
    expect(CODE).not.toMatch(/const \[confirmInFlight[^\]]*\] = React\.useState/);
  });

  it('the button itself goes inert while a write is outstanding', () => {
    // AFCommandCard has always accepted `primaryLoading` (→ AFPrimaryButton
    // `loading` → `buttonIsInert` → `onPress` undefined); this screen never
    // passed it, so the control looked idle mid-write.
    expect(CODE).toMatch(/primaryLoading=\{isCompletingCycle\}/);
  });

  it('mutation-verify: dropping the in-flight guard is detectable', () => {
    const mutated = CODE.replace(
      'if (confirmInFlightRef.current || isCompletingCycle) return;',
      '',
    );
    const start = mutated.indexOf('const confirmWaterAmount = React.useCallback(');
    const confirm = mutated.slice(start, mutated.indexOf('React.useEffect(', start));
    expect(confirm).not.toContain('confirmInFlightRef.current || isCompletingCycle');
    expect(confirm).toContain('logIntake(');
  });
});

describe('CORRECTION 2 — the member is told it worked, only when it worked', () => {
  it('renders the shipped overlay from the cycle slice, never from local state', () => {
    // Gating on a local "I pressed confirm" boolean would let the celebration
    // appear for a write the store never committed.
    expect(CODE).toContain('const { showCycleSuccess, lastCycleResult, isCompletingCycle } = useCycleSlice();');
    expect(CODE).toMatch(
      /\{showCycleSuccess && lastCycleResult && \([\s\S]{0,160}?<CycleSuccessOverlay result=\{lastCycleResult\} onDismiss=\{dismissSuccess\} \/>/,
    );
  });

  it('takes dismissSuccess from the store actions, like the legacy Home did', () => {
    expect(CODE).toMatch(/const \{ logIntake, dismissSuccess \} = useActionsSlice<HomeActions>\(\);/);
    expect(CODE).toMatch(/dismissSuccess: \(\) => void;/);
  });

  it('mounts the overlay OUTSIDE the scrolling screen, so it cannot scroll away', () => {
    // `AFScreen scroll` renders its children inside a ScrollView; an
    // absolutely-positioned overlay in there is positioned against the
    // content box, not the viewport.
    const afterScreen = CODE.slice(CODE.indexOf('</AFScreen>'));
    expect(afterScreen).toContain('<CycleSuccessOverlay');
    expect(afterScreen).toContain('<WaterAmountModal');
    const insideScreen = CODE.slice(CODE.indexOf('<AFScreen scroll'), CODE.indexOf('</AFScreen>'));
    expect(insideScreen).not.toContain('<CycleSuccessOverlay');
  });

  it('fires the completion haptic on the SETTLED write, not on the press', () => {
    expect(CODE.match(/fireMoment\(/g) ?? []).toHaveLength(1);
    const effect = CODE.slice(
      CODE.indexOf('if (!confirmInFlightRef.current) return;'),
      CODE.indexOf('}, [isCompletingCycle, lastCycleResult]);'),
    );
    expect(effect).toContain("fireMoment('command_completed')");
    // A failed write (CYCLE_FAILURE → lastCycleResult null) must stay silent.
    expect(effect).toContain('if (!lastCycleResult) return;');
    // …and the in-flight marker must be cleared either way, or a failed log
    // would soft-lock the picker behind its own guard.
    expect(effect).toContain('confirmInFlightRef.current = false;');
    expect(effect.indexOf('confirmInFlightRef.current = false;')).toBeLessThan(
      effect.indexOf('if (!lastCycleResult) return;'),
    );
  });

  it('mutation-verify: an overlay gated on local state instead of the store is detectable', () => {
    const mutated = CODE.replace(
      '{showCycleSuccess && lastCycleResult && (',
      '{waterPickerOpen && lastCycleResult && (',
    );
    expect(mutated).not.toContain('{showCycleSuccess && lastCycleResult && (');
  });
});

describe('CORRECTION 2 — Wave-4/5 wins are preserved', () => {
  it('adds no timer, no interval and no extra fetch to the hottest screen in the app', () => {
    expect(CODE).not.toContain('setInterval');
    expect(CODE).not.toContain('setTimeout');
    expect(CODE).not.toContain('fetch(');
    expect(CODE).not.toContain('useEffect(() => { void ');
  });

  it('adds exactly ONE store subscription, and it is the cycle slice', () => {
    // Pinned bidirectionally against the render-count probe in
    // `homeScreenV2RenderCount.render.test.tsx`, which proves this slice costs
    // zero re-renders across a TICK_TIMER burst.
    const hooks = [...(CODE.match(/\buse[A-Za-z]*Slice\s*[<(]/g) ?? [])];
    expect(hooks.filter((h) => h.startsWith('useCycleSlice'))).toHaveLength(1);
  });

  it('introduces no raw colour literal and no alpha concatenation', () => {
    // The picker takes the band `accent` token (a fill, which is what it
    // spends it on); nothing here invents a colour.
    expect(CODE).toMatch(/accentColor=\{accent\}/);
    const added = CODE.slice(CODE.indexOf('<WaterAmountModal'));
    expect(added).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(added).not.toMatch(/\$\{[a-zA-Z.]+\}[0-9a-fA-F]{2}/);
  });

  it('leaves the hero hierarchy alone: one dominant number, WHY inline, evidence gate intact', () => {
    expect(CODE).toContain('<AFReadinessArc');
    expect(CODE).toContain('<ConfidenceChip');
    expect(CODE).toMatch(/rationale=\{engine\.command\.explanation \|\| undefined\}/);
    expect(CODE).toMatch(/const evidence = resolveHomeEvidence\(/);
  });
});
