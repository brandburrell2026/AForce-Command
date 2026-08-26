/**
 * Golden-invariant locks — server (Wave-4 Part 15).
 *
 * INVARIANT 5 — "A purchase can never change HydroState."
 *
 * The client half of this lives in
 * `artifacts/aforce-os/utils/__tests__/goldenInvariantLocks.test.ts`. This is
 * the server half, and it is the more consequential one: the client can only
 * ever propose a score, but the api-server is what PERSISTS it. If a webhook
 * or an entitlement resolver ever gained the ability to write a score
 * snapshot or a user-state row, "buying the subscription raised my HydroState"
 * would become true in the database — a Constitution violation ("observation
 * never diagnosis", "trust over attention") that no UI fix could undo.
 *
 * The commerce path is currently clean. This test is what keeps it clean:
 * every module that handles money — checkout session creation, the Stripe and
 * Shopify webhook receivers, entitlement resolution, and Stripe bootstrap —
 * is scanned for any reference to the score-persistence surface. Commerce may
 * write `aforceUsers` (that is who you are and what you bought); it may not
 * touch `aforceScoreSnapshots`, `aforceUserState`, the snapshot repo factory,
 * or any scoring engine.
 *
 * Why a static source scan rather than a runtime test: this invariant is
 * about code that must NOT exist. A runtime test can only observe the branches
 * it happens to execute — it says nothing about a write added on a path that
 * fires for one customer in a rare Stripe event. Reading the source text off
 * disk fails at the moment the forbidden dependency is introduced, in review,
 * before any money moves. It imports nothing from the server, so it needs no
 * DATABASE_URL and no Stripe credentials.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // api-server/src/__tests__
const SRC = resolve(HERE, ".."); // api-server/src

/**
 * The money path, end to end. `lib/webhookHandlers.ts` is included even though
 * the task list names only the routes: it is where `routes/stripeWebhook.ts`
 * actually processes each Stripe event, so it is the likeliest place a
 * "grant them something for paying" write would be added.
 */
const COMMERCE_MODULES = [
  "routes/checkout.ts",
  "routes/stripeWebhook.ts",
  "routes/shopifyWebhook.ts",
  "routes/entitlement.ts",
  "lib/shopifyWebhook.ts",
  "lib/entitlementResolver.ts",
  "lib/featureEntitlements.ts",
  "lib/webhookHandlers.ts",
  "lib/initStripe.ts",
  "middlewares/requireEntitlement.ts",
] as const;

/**
 * Every identifier that means "a HydroState number is being produced or
 * persisted". `aforceUsers` and `aforceWebEntitlements` are deliberately
 * absent — commerce legitimately owns those rows.
 */
const SCORE_SURFACE_MARKERS = [
  "aforceScoreSnapshots",
  "createDrizzleScoreSnapshotRepo",
  "aforceUserState",
  "aforceIntakeLogs",
  "calculateScore",
  "scoringEngine",
  "hydroStateModel",
  "updateUserState",
  "incrementIntake",
] as const;

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

describe("INVARIANT 5 — purchase → HydroState isolation (server)", () => {
  it("every commerce module in the list exists (the scan is not vacuous)", () => {
    for (const rel of COMMERCE_MODULES) {
      expect(read(rel).length, `${rel} is empty or missing`).toBeGreaterThan(0);
    }
  });

  it("no commerce module references the score-persistence surface", () => {
    const offenders: string[] = [];
    for (const rel of COMMERCE_MODULES) {
      const src = read(rel);
      for (const marker of SCORE_SURFACE_MARKERS) {
        if (new RegExp(`\\b${marker}\\b`).test(src)) offenders.push(`${rel} :: ${marker}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no commerce module imports the score-writing route modules", () => {
    // Belt and braces on the marker scan above: reaching journal.ts or
    // sensors.ts (the only two modules that construct the snapshot repo)
    // would launder a score write through an import instead of a symbol.
    const SCORE_WRITING_MODULES = ["routes/aforce/journal", "routes/aforce/sensors", "lib/aforceState"];
    const offenders: string[] = [];
    for (const rel of COMMERCE_MODULES) {
      const src = read(rel);
      for (const match of src.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)) {
        const spec = match[1];
        if (SCORE_WRITING_MODULES.some((m) => spec.includes(m))) offenders.push(`${rel} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the score-writing modules do not reach back into commerce", () => {
    // The inverse direction: a snapshot writer that consulted entitlement or
    // Stripe state would make the score depend on what the user paid for.
    const SCORE_WRITERS = ["routes/aforce/journal.ts", "routes/aforce/sensors.ts"];
    const COMMERCE_MARKERS = ["stripe", "shopify", "entitlement", "checkout", "subscription"];
    const offenders: string[] = [];
    for (const rel of SCORE_WRITERS) {
      const src = read(rel);
      for (const match of src.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)) {
        const spec = match[1].toLowerCase();
        if (COMMERCE_MARKERS.some((m) => spec.includes(m))) offenders.push(`${rel} -> ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
