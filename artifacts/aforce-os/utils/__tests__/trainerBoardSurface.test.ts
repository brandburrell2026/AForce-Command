/**
 * Morning Board — surface locks.
 *
 * Source-scan assertions in the convention of `moduleRouteTargets.test.ts`:
 * they assert what the screen DECLARES, which is the only way to hold a
 * performance or gating property that a render test cannot see.
 *
 * Covers three acceptance criteria from the brief that are otherwise easy to
 * regress silently:
 *   - the 120-athlete list must be virtualized (a ScrollView cannot meet the
 *     render budget, and swapping one in would not fail any other test)
 *   - the surface is flag-gated, default off
 *   - contrast: every text colour the board uses clears 4.5:1 on the canvas
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { af } from "../../theme/afTokens";
import { DEFAULT_FLAGS } from "../../featureFlags/flags";
import { INTERNAL_TIER_FLAGS } from "../../featureFlags/flags";

const ROOT = join(__dirname, "..", "..");
const screen = readFileSync(join(ROOT, "screens", "TrainerBoardScreen.tsx"), "utf8");
/**
 * Comments stripped, so a file's own explanation of why it avoids something
 * does not trip the rule about avoiding it — the same precaution
 * `brandTokenLiterals.lock.test.ts` takes.
 */
const screenCode = screen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const route = readFileSync(join(ROOT, "app", "trainer-board.tsx"), "utf8");
const recordScreen = readFileSync(join(ROOT, "screens", "TrainerAthleteRecordScreen.tsx"), "utf8");
const recordScreenCode = recordScreen
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
const recordRoute = readFileSync(join(ROOT, "app", "trainer-athlete", "[athleteId].tsx"), "utf8");
const seed = readFileSync(join(ROOT, "data", "trainerDemoSeed.ts"), "utf8");

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe("the board is virtualized", () => {
  it("renders the roster through FlatList, not a ScrollView", () => {
    expect(screenCode).toContain("FlatList");
    // A ScrollView over 120 rows mounts every row at once and misses the
    // brief's render budget. If this ever needs to change, change the budget
    // deliberately rather than by importing a different container.
    expect(screenCode).not.toContain("ScrollView");
  });

  it("caps the initial batch so a cold open is not 120 rows of work", () => {
    expect(screen).toContain("initialNumToRender");
    expect(screen).toContain("maxToRenderPerBatch");
    expect(screen).toContain("windowSize");
  });

  it("memoizes the row so a filter change is not 120 re-renders", () => {
    expect(screen).toContain("React.memo");
    expect(screen).toContain("useCallback");
  });
});

describe("the surface is gated, default off", () => {
  it("wraps the screen in a FeatureGate on trainer_board_enabled", () => {
    expect(route).toContain("FeatureGate");
    expect(route).toContain("trainer_board_enabled");
  });

  it("ships both flags false", () => {
    expect(DEFAULT_FLAGS.trainer_board_enabled).toBe(false);
    expect(DEFAULT_FLAGS.trainer_demo_seed_enabled).toBe(false);
  });

  it("registers both in INTERNAL_TIER_FLAGS so demo unlock cannot expose them", () => {
    expect(INTERNAL_TIER_FLAGS).toContain("trainer_board_enabled");
    expect(INTERNAL_TIER_FLAGS).toContain("trainer_demo_seed_enabled");
  });

  it("gates the simulated roster separately and marks it on screen", () => {
    expect(route).toContain("trainer_demo_seed_enabled");
    expect(screen).toContain("SIMULATED");
    expect(seed).toContain("isSimulated: true");
  });
});

describe("contrast on the canvas", () => {
  // Founder ruling, 2026-09-16: Signal Red stays, and is a display-weight
  // signal colour rather than a text colour. af.redText is the AA-clean red
  // the token set already provides for text, so the board uses that.
  it.each([
    ["textPrimary", af.textPrimary],
    ["textSecondary", af.textSecondary],
    ["textTertiary", af.textTertiary],
    ["redText", af.redText],
    ["amber", af.amber],
  ])("%s clears 4.5:1 on af.canvas", (_name, color) => {
    expect(contrast(color, af.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not use the fill red as a text colour anywhere on the board", () => {
    // af.red is 3.32:1 on the canvas. It is legitimate as a fill, a border and
    // an atmosphere, which is how the screen uses it.
    expect(contrast(af.red, af.canvas)).toBeLessThan(4.5);
    expect(screenCode).not.toContain("color: af.red,");
  });
});

describe("touch targets and copy", () => {
  it("keeps every control at or above the 44pt minimum", () => {
    expect(screen).toContain("afLayout.controlMinHeight");
    expect(screen).toContain("hitSlop");
  });

  it("carries the recommendation attribution on the status sheet", () => {
    expect(screen).toContain("clinical decision remains with licensed staff");
  });

  it("uses no raw colour literals — af.* tokens only", () => {
    expect(screenCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("the athlete record (Phase 3)", () => {
  it("is one tap from a board row", () => {
    // The row itself is the target, not a chevron or a menu.
    expect(screenCode).toContain("onOpen?.(athlete.athleteUserId)");
    expect(route).toContain("/trainer-athlete/");
  });

  it("reads the cache before it reads anything live", () => {
    const readAt = recordRoute.indexOf("readRecord");
    const liveAt = recordRoute.indexOf("loadLive()");
    expect(readAt).toBeGreaterThan(-1);
    expect(liveAt).toBeGreaterThan(-1);
    // Order matters: a cache read that happens after the live fetch is not an
    // offline path, it is a fallback.
    expect(readAt).toBeLessThan(liveAt);
  });

  it("writes through so the next open works with no network", () => {
    expect(recordRoute).toContain("writeRecord");
  });

  it("states how old the record on screen is", () => {
    expect(recordRoute).toContain("freshnessLabel");
    expect(recordScreenCode).toContain("freshness");
  });

  it("renders completeness beside every signal", () => {
    expect(recordScreenCode).toContain("COMPLETENESS_LABEL");
    expect(recordScreenCode).toContain("completenessTone");
  });

  it("carries the recommendation attribution", () => {
    expect(recordScreen).toContain("clinical decision remains with licensed staff");
  });

  it("is gated by the same flag as the board", () => {
    expect(recordRoute).toContain("FeatureGate");
    expect(recordRoute).toContain("trainer_board_enabled");
  });

  it("uses no raw colour literals", () => {
    expect(recordScreenCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("does not use the fill red as a text colour", () => {
    expect(recordScreenCode).not.toContain("color: af.red,");
  });

  it("adds no charting dependency for the sparkline", () => {
    expect(recordScreenCode).not.toContain("react-native-svg");
    expect(recordScreenCode).not.toContain("victory");
    expect(recordScreenCode).not.toContain("react-native-chart");
  });
});
