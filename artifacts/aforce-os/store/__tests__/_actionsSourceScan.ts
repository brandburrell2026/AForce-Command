/**
 * Source-scan helpers — RC-1 W3 r2 hardening (#551 verdict follow-ups,
 * should-fix 1 + 2, nit 5).
 *
 * `useActionsSlice<T>()` (`store/slices.tsx`) is an unchecked cast: it hands
 * back `ActionsContext`'s value (typed `ActionsSlice | null`) `as unknown as
 * T`, so a screen can declare any generic action shape it likes and
 * TypeScript will never catch a mismatch against what the real `AppProvider`
 * actions memo (`store/useAppStore.tsx`) actually provides — the gap is
 * silent until the callback is invoked at runtime and comes back
 * `undefined`. Similarly, the render-count probes in the
 * `components/*` render-count test files hardcode the list of slice hooks a
 * screen calls; nothing previously stopped that hardcoded list from
 * drifting stale as the real screen's hook calls changed.
 *
 * These helpers operate on already-read source TEXT (not file paths) —
 * every caller reads its own files via `readFileSync(join(__dirname, ...))`,
 * matching this repo's existing source-guard convention (see
 * `appStoreTimerGating.test.ts`, the `*RenderCount.render.test.tsx` files).
 * Deliberately pure/path-agnostic so this module works the same regardless
 * of which directory imports it.
 */

/**
 * Strips block and line comments so regexes can't accidentally match
 * documentation prose.
 *
 * RC-1 closing follow-ups (#552 review, nit 5): this is a regex
 * approximation, not a real JS/TS tokenizer. `/\/\/.*$/gm` truncates a line
 * at the FIRST `//` it finds, even when that `//` sits inside a string
 * literal rather than starting an actual comment — e.g. a line containing
 * `"see https://example.com"` would have everything from `//` onward
 * discarded, comment or not. Safe here only because every caller feeds this
 * function this repo's own `useAppStore.tsx` / screen source files (see the
 * file header), and the specific slices this scan parses — the actions memo
 * object literal and `useActionsSlice<T>()` destructuring lines — never
 * embed a `//`-containing string literal. Do not reuse this helper as a
 * general-purpose comment stripper for arbitrary source.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
}

function splitKeys(block: string): string[] {
  return block
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extracts the shorthand key set of the real `actions` `useMemo<ActionsSlice>`
 * object literal given `store/useAppStore.tsx`'s source text — the actual
 * runtime shape `useActionsSlice()` resolves to for every consumer, app-wide.
 */
export function extractActionsMemoKeys(useAppStoreSource: string): string[] {
  const source = stripComments(useAppStoreSource);
  const match = source.match(
    /const actions = useMemo<ActionsSlice>\(\(\) => \(\{([\s\S]*?)\}\), \[/,
  );
  if (!match) {
    throw new Error(
      "extractActionsMemoKeys: could not find `const actions = useMemo<ActionsSlice>(() => ({...}), [` in store/useAppStore.tsx — has the actions memo moved or been renamed? Update this scan's regex to match.",
    );
  }
  return splitKeys(match[1]);
}

/**
 * Extracts the keys a screen destructures off `useActionsSlice<...>()` given
 * that screen's source text, e.g.
 * `const { logIntake } = useActionsSlice<HomeActions>();` → `['logIntake']`.
 * Scans the destructuring pattern itself (not the generic type argument), so
 * it works uniformly whether the screen declares a named interface, an
 * inline `Pick<AppContextValue, ...>`, or an inline object type. Returns an
 * empty array for a screen that never calls `useActionsSlice` at all.
 */
export function extractDestructuredActionKeys(screenSource: string): string[] {
  const source = stripComments(screenSource);
  // `[^{}]*` (not `[\s\S]*?`) is deliberate: a screen has several
  // `const { … } = useXSlice()` destructures before its
  // `useActionsSlice()` call, and a lazy-but-brace-unaware capture group
  // would backtrack straight through all of them to reach the first `}`
  // that happens to precede `useActionsSlice` — silently swallowing
  // unrelated destructured names into the "action keys" result. Excluding
  // `{`/`}` from the capture forces each `const { … } = …` destructure to
  // be evaluated on its own, so only the pattern immediately followed by
  // `useActionsSlice` matches.
  const match = source.match(/const\s*\{([^{}]*)\}\s*=\s*useActionsSlice/);
  return match ? splitKeys(match[1]) : [];
}

/**
 * Extracts the SET of distinct store-slice hook names (`use*Slice` plus the
 * `useFeatureFlags` alias for `useFlagsSlice`) actually CALLED — not merely
 * imported — anywhere in a component's source text. Matching on "hook name
 * immediately followed by `(` or `<`" (rather than fully parsing whatever
 * generic type argument follows) is deliberate: it doesn't need to
 * understand the shape of a generic like `useActionsSlice<Pick<X, 'a'>>()`
 * to know the hook was called, and it can't be fooled by an `import { … }`
 * list (import specifiers are followed by `,`/`}`, never `(`/`<`).
 */
export function extractCalledSliceHooks(rawSource: string): Set<string> {
  const code = stripComments(rawSource);
  const names = new Set<string>();
  const re = /\b(use[A-Za-z]*Slice)\s*[<(]/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(code))) names.add(m[1]);
  if (/\buseFeatureFlags\s*\(/.test(code)) names.add('useFeatureFlags');
  return names;
}
