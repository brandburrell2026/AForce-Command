import { describe, it, expect } from "vitest";
import {
  buildActivationFunnel,
  ActivationFunnelSchema,
  type ActivationFunnelRow,
} from "../activationFunnel";

const AT = "2026-06-21T00:00:00.000Z";

function row(p: Partial<ActivationFunnelRow>): ActivationFunnelRow {
  return {
    qrScanned: null,
    appOpened: null,
    profileCompleted: null,
    firstCommandCompleted: null,
    firstWinConfirmed: null,
    subscriptionStarted: null,
    qrPayload: null,
    ...p,
  };
}

function conv(dto: ReturnType<typeof buildActivationFunnel>, id: string) {
  const c = dto.conversions.find((x) => x.id === id);
  if (!c) throw new Error(`missing conversion ${id}`);
  return c;
}

describe("buildActivationFunnel", () => {
  it("empty cohort: zero funnels, all conversions awaiting (null rate), no fabricated 0%", () => {
    const dto = buildActivationFunnel([], AT);
    expect(() => ActivationFunnelSchema.parse(dto)).not.toThrow();
    expect(dto.totalFunnels).toBe(0);
    expect(dto.generatedAt).toBe(AT);
    for (const c of dto.conversions) {
      expect(c.entered).toBe(0);
      expect(c.converted).toBe(0);
      expect(c.rate).toBeNull();
      expect(c.status).toBe("awaiting");
    }
    // every visible stage present, all zero; no segment rows when no funnels.
    expect(dto.stages.length).toBeGreaterThanOrEqual(4);
    for (const s of dto.stages) expect(s.count).toBe(0);
    for (const seg of dto.segments) expect(seg.rows).toEqual([]);
  });

  it("flags un-instrumented funnel stages instead of reporting a real zero reach", () => {
    const dto = buildActivationFunnel(
      [row({ qrScanned: "2026-06-01T00:00:00.000Z" })],
      AT,
    );
    const byStage = Object.fromEntries(dto.stages.map((s) => [s.stage, s]));
    // instrumented: has a Phase-1 event behind it.
    expect(byStage["qr_scanned"]?.instrumented).toBe(true);
    expect(byStage["app_opened"]?.instrumented).toBe(true);
    expect(byStage["profile_completed"]?.instrumented).toBe(true);
    expect(byStage["first_command_completed"]?.instrumented).toBe(true);
    // First Win is now instrumented (mobile emits first_win_confirmed).
    expect(byStage["first_win_confirmed"]?.instrumented).toBe(true);
    // architected-but-not-tracked stages: flagged, not a fabricated reach.
    expect(byStage["can_purchased"]?.instrumented).toBe(false);
    expect(byStage["can_purchased"]?.count).toBe(0);
    expect(byStage["day7_subscription_offer"]?.instrumented).toBe(false);
  });

  it("counts First Win reach from the first_win_confirmed milestone", () => {
    const rows: ActivationFunnelRow[] = [
      row({
        qrScanned: "2026-06-01T00:00:00.000Z",
        appOpened: "2026-06-01T00:05:00.000Z",
        profileCompleted: "2026-06-01T00:10:00.000Z",
        firstCommandCompleted: "2026-06-01T00:20:00.000Z",
        firstWinConfirmed: "2026-06-01T00:25:00.000Z",
      }),
      // activated but no win yet
      row({
        qrScanned: "2026-06-02T00:00:00.000Z",
        appOpened: "2026-06-02T00:05:00.000Z",
        firstCommandCompleted: "2026-06-02T00:20:00.000Z",
      }),
    ];
    const dto = buildActivationFunnel(rows, AT);
    const byStage = Object.fromEntries(dto.stages.map((s) => [s.stage, s]));
    expect(byStage["first_command_completed"]?.count).toBe(2);
    expect(byStage["first_win_confirmed"]?.count).toBe(1);
  });

  it("counts stage reach and chronological conversions across a cohort", () => {
    const rows: ActivationFunnelRow[] = [
      // full path scan→open→profile→command→subscribe
      row({
        qrScanned: "2026-06-01T00:00:00.000Z",
        appOpened: "2026-06-01T00:05:00.000Z",
        profileCompleted: "2026-06-01T00:10:00.000Z",
        firstCommandCompleted: "2026-06-01T00:20:00.000Z",
        subscriptionStarted: "2026-06-08T00:00:00.000Z",
      }),
      // scanned + opened, no activation
      row({
        qrScanned: "2026-06-02T00:00:00.000Z",
        appOpened: "2026-06-02T00:03:00.000Z",
      }),
      // scanned only
      row({ qrScanned: "2026-06-03T00:00:00.000Z" }),
    ];
    const dto = buildActivationFunnel(rows, AT);
    expect(() => ActivationFunnelSchema.parse(dto)).not.toThrow();
    expect(dto.totalFunnels).toBe(3);

    const byStage = Object.fromEntries(dto.stages.map((s) => [s.stage, s]));
    expect(byStage["qr_scanned"]?.count).toBe(3);
    expect(byStage["app_opened"]?.count).toBe(2);
    expect(byStage["profile_completed"]?.count).toBe(1);
    expect(byStage["first_command_completed"]?.count).toBe(1);

    // scanToInstall: 3 scanned, 2 opened.
    const scanToInstall = conv(dto, "scanToInstall");
    expect(scanToInstall.entered).toBe(3);
    expect(scanToInstall.converted).toBe(2);
    expect(scanToInstall.rate).toBeCloseTo(2 / 3);
    expect(scanToInstall.status).toBe("measured");

    // installToActivation: 2 opened, 1 reached first_command_completed.
    const installToActivation = conv(dto, "installToActivation");
    expect(installToActivation.entered).toBe(2);
    expect(installToActivation.converted).toBe(1);

    // activationToSubscription: 1 activated, 1 subscribed.
    const activationToSubscription = conv(dto, "activationToSubscription");
    expect(activationToSubscription.entered).toBe(1);
    expect(activationToSubscription.converted).toBe(1);
    expect(activationToSubscription.rate).toBe(1);
  });

  it("does NOT count an out-of-order conversion (subscribe before activation)", () => {
    const dto = buildActivationFunnel(
      [
        row({
          appOpened: "2026-06-01T00:00:00.000Z",
          firstCommandCompleted: "2026-06-02T00:00:00.000Z",
          // subscription stamped BEFORE activation — not a real conversion
          subscriptionStarted: "2026-06-01T12:00:00.000Z",
        }),
      ],
      AT,
    );
    const c = conv(dto, "activationToSubscription");
    expect(c.entered).toBe(1);
    expect(c.converted).toBe(0);
    expect(c.rate).toBe(0);
  });

  it("segments conversions by attribution, sorts by cohort desc, buckets missing values as unattributed", () => {
    const rows: ActivationFunnelRow[] = [
      row({
        qrScanned: "2026-06-01T00:00:00.000Z",
        appOpened: "2026-06-01T00:05:00.000Z",
        qrPayload: { sku: "AF-CAN-12", retailLocationId: "store-1" },
      }),
      row({
        qrScanned: "2026-06-02T00:00:00.000Z",
        appOpened: "2026-06-02T00:05:00.000Z",
        qrPayload: { sku: "AF-CAN-12" },
      }),
      row({
        qrScanned: "2026-06-03T00:00:00.000Z",
        qrPayload: { sku: "AF-CAN-24" },
      }),
      // no payload at all → unattributed on every dimension
      row({ qrScanned: "2026-06-04T00:00:00.000Z" }),
    ];
    const dto = buildActivationFunnel(rows, AT);
    expect(() => ActivationFunnelSchema.parse(dto)).not.toThrow();

    const skuSeg = dto.segments.find((s) => s.dimension === "sku");
    expect(skuSeg).toBeTruthy();
    // AF-CAN-12 cohort (2) sorts before AF-CAN-24 (1) and unattributed (1).
    expect(skuSeg?.rows[0]?.segment).toBe("AF-CAN-12");
    expect(skuSeg?.rows[0]?.cohort).toBe(2);
    const can12 = skuSeg?.rows.find((r) => r.segment === "AF-CAN-12");
    const can12ScanToInstall = can12?.conversions.find(
      (c) => c.id === "scanToInstall",
    );
    expect(can12ScanToInstall?.entered).toBe(2);
    expect(can12ScanToInstall?.converted).toBe(2);

    // a segment row exists for the unattributed bucket.
    const unattributed = skuSeg?.rows.find((r) => r.segment.includes("unattrib"));
    expect(unattributed?.cohort).toBe(1);

    // retail dimension exists and is present in display order.
    expect(dto.segments.map((s) => s.dimension)).toEqual([
      "sku",
      "retailLocationId",
      "geo",
      "campaign",
    ]);
  });
});
