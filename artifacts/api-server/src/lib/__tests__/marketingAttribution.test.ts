import { describe, it, expect } from "vitest";
import {
  buildMarketingAttribution,
  MarketingAttributionSchema,
  type MarketingRow,
} from "../marketingAttribution";

const AT = "2026-06-21T00:00:00.000Z";

function row(p: Partial<MarketingRow>): MarketingRow {
  return {
    qrScanned: null,
    subscriptionStarted: null,
    qrPayload: null,
    subscriptionPayload: null,
    ...p,
  };
}

function source(dto: ReturnType<typeof buildMarketingAttribution>, dim: string) {
  const s = dto.sources.find((x) => x.dimension === dim);
  if (!s) throw new Error(`missing source ${dim}`);
  return s;
}

describe("buildMarketingAttribution", () => {
  it("empty cohort: zero funnels, awaiting overall, empty source rows, no fabricated 0", () => {
    const dto = buildMarketingAttribution([], AT);
    expect(() => MarketingAttributionSchema.parse(dto)).not.toThrow();
    expect(dto.totalFunnels).toBe(0);
    expect(dto.generatedAt).toBe(AT);
    expect(dto.overall.scanned).toBe(0);
    expect(dto.overall.subscribers).toBe(0);
    expect(dto.overall.subscribeRate).toBeNull();
    expect(dto.overall.revenue.subscribers).toBe(0);
    expect(dto.overall.revenue.byCurrency).toEqual([]);
    expect(dto.overall.revenue.planMix).toEqual([]);
    // dimensions present in display order, all with empty rows.
    expect(dto.sources.map((s) => s.dimension)).toEqual([
      "sku",
      "retailLocationId",
      "geo",
      "campaign",
    ]);
    for (const s of dto.sources) expect(s.rows).toEqual([]);
  });

  it("attributes revenue to the acquisition source (per-SKU gross / ARPU / plan mix)", () => {
    const rows: MarketingRow[] = [
      row({
        qrScanned: "2026-06-01T00:00:00.000Z",
        subscriptionStarted: "2026-06-08T00:00:00.000Z",
        qrPayload: { sku: "AF-CAN-12" },
        subscriptionPayload: {
          planTier: "pro",
          amountCents: 1999,
          currency: "USD",
          billingInterval: "month",
        },
      }),
      row({
        qrScanned: "2026-06-02T00:00:00.000Z",
        subscriptionStarted: "2026-06-09T00:00:00.000Z",
        qrPayload: { sku: "AF-CAN-12" },
        subscriptionPayload: {
          planTier: "elite",
          amountCents: 4999,
          currency: "USD",
          billingInterval: "month",
        },
      }),
      // scanned a different SKU, did not subscribe
      row({ qrScanned: "2026-06-03T00:00:00.000Z", qrPayload: { sku: "AF-CAN-24" } }),
    ];
    const dto = buildMarketingAttribution(rows, AT);
    expect(() => MarketingAttributionSchema.parse(dto)).not.toThrow();

    expect(dto.totalFunnels).toBe(3);
    expect(dto.overall.scanned).toBe(3);
    expect(dto.overall.subscribers).toBe(2);
    expect(dto.overall.subscribeRate).toBeCloseTo(2 / 3);
    expect(dto.overall.revenue.subscribers).toBe(2);
    expect(dto.overall.revenue.byCurrency).toEqual([
      { currency: "USD", subscribers: 2, grossCents: 6998, arpuCents: 3499 },
    ]);

    const sku = source(dto, "sku");
    // AF-CAN-12 (2 scans) sorts before AF-CAN-24 (1 scan).
    expect(sku.rows[0]?.segment).toBe("AF-CAN-12");
    const can12 = sku.rows.find((r) => r.segment === "AF-CAN-12");
    expect(can12?.scanned).toBe(2);
    expect(can12?.subscribers).toBe(2);
    expect(can12?.subscribeRate).toBe(1);
    expect(can12?.revenue.byCurrency).toEqual([
      { currency: "USD", subscribers: 2, grossCents: 6998, arpuCents: 3499 },
    ]);
    expect(can12?.revenue.planMix).toEqual([
      { planTier: "elite", subscribers: 1 },
      { planTier: "pro", subscribers: 1 },
    ]);

    const can24 = sku.rows.find((r) => r.segment === "AF-CAN-24");
    expect(can24?.scanned).toBe(1);
    expect(can24?.subscribers).toBe(0);
    expect(can24?.subscribeRate).toBe(0);
    expect(can24?.revenue.subscribers).toBe(0);
    expect(can24?.revenue.byCurrency).toEqual([]);
  });

  it("counts a subscriber with no valid revenue payload but never fabricates gross (awaiting revenue)", () => {
    const dto = buildMarketingAttribution(
      [
        row({
          qrScanned: "2026-06-01T00:00:00.000Z",
          subscriptionStarted: "2026-06-08T00:00:00.000Z",
          qrPayload: { sku: "AF-CAN-12" },
          // no amount/currency → not enough to count toward gross
          subscriptionPayload: { planTier: "pro" },
        }),
      ],
      AT,
    );
    expect(dto.overall.subscribers).toBe(1);
    // subscriber counted, but revenue is honestly absent (no fabricated $0).
    expect(dto.overall.revenue.subscribers).toBe(0);
    expect(dto.overall.revenue.byCurrency).toEqual([]);
    expect(dto.overall.revenue.planMix).toEqual([]);
  });

  it("never sums revenue across currencies", () => {
    const dto = buildMarketingAttribution(
      [
        row({
          qrScanned: "2026-06-01T00:00:00.000Z",
          subscriptionStarted: "2026-06-08T00:00:00.000Z",
          qrPayload: { campaign: "spring" },
          subscriptionPayload: { amountCents: 1000, currency: "USD" },
        }),
        row({
          qrScanned: "2026-06-02T00:00:00.000Z",
          subscriptionStarted: "2026-06-09T00:00:00.000Z",
          qrPayload: { campaign: "spring" },
          subscriptionPayload: { amountCents: 2000, currency: "EUR" },
        }),
      ],
      AT,
    );
    const byCur = dto.overall.revenue.byCurrency;
    expect(byCur.length).toBe(2);
    const usd = byCur.find((c) => c.currency === "USD");
    const eur = byCur.find((c) => c.currency === "EUR");
    expect(usd).toEqual({ currency: "USD", subscribers: 1, grossCents: 1000, arpuCents: 1000 });
    expect(eur).toEqual({ currency: "EUR", subscribers: 1, grossCents: 2000, arpuCents: 2000 });
  });

  it("a subscription with no scan lands unattributed with a null (awaiting) rate, never >100%", () => {
    const dto = buildMarketingAttribution(
      [
        row({
          subscriptionStarted: "2026-06-08T00:00:00.000Z",
          subscriptionPayload: { amountCents: 1999, currency: "USD" },
        }),
      ],
      AT,
    );
    expect(dto.overall.scanned).toBe(0);
    expect(dto.overall.subscribers).toBe(1);
    // denominator zero → awaiting, never a fabricated or >100% rate.
    expect(dto.overall.subscribeRate).toBeNull();
    const sku = source(dto, "sku");
    const unattributed = sku.rows.find((r) => r.segment.includes("unattrib"));
    expect(unattributed?.scanned).toBe(0);
    expect(unattributed?.subscribers).toBe(1);
    expect(unattributed?.subscribeRate).toBeNull();
  });

  it("mixed cohort: paid subscribers outside the scanned cohort never push the rate >100% (no schema 500)", () => {
    const dto = buildMarketingAttribution(
      [
        // scanned AND subscribed (chronological) → a real scan→subscribe.
        row({
          qrScanned: "2026-06-01T00:00:00.000Z",
          subscriptionStarted: "2026-06-08T00:00:00.000Z",
          qrPayload: { sku: "AF-CAN-12" },
          subscriptionPayload: { amountCents: 1999, currency: "USD" },
        }),
        // subscribed with NO scan → a subscriber, NOT a scan conversion.
        row({
          subscriptionStarted: "2026-06-09T00:00:00.000Z",
          subscriptionPayload: { amountCents: 1999, currency: "USD" },
        }),
        // a second scan-less subscriber, pushing raw subs above scans.
        row({
          subscriptionStarted: "2026-06-10T00:00:00.000Z",
          subscriptionPayload: { amountCents: 1999, currency: "USD" },
        }),
      ],
      AT,
    );
    // The route re-validates with the same schema — must NOT throw (no 500).
    expect(() => MarketingAttributionSchema.parse(dto)).not.toThrow();
    expect(dto.overall.scanned).toBe(1);
    expect(dto.overall.subscribers).toBe(3);
    // Only the scanner who subscribed counts toward the rate: 1/1, never 3/1.
    expect(dto.overall.converted).toBe(1);
    expect(dto.overall.subscribeRate).toBe(1);

    // The two scan-less subscribers land unattributed at a null (awaiting) rate.
    const sku = source(dto, "sku");
    const unattributed = sku.rows.find((r) => r.segment.includes("unattrib"));
    expect(unattributed?.scanned).toBe(0);
    expect(unattributed?.subscribers).toBe(2);
    expect(unattributed?.converted).toBe(0);
    expect(unattributed?.subscribeRate).toBeNull();
  });

  it("an out-of-order subscribe (before the scan) is not counted as a conversion", () => {
    const dto = buildMarketingAttribution(
      [
        row({
          qrScanned: "2026-06-10T00:00:00.000Z",
          subscriptionStarted: "2026-06-01T00:00:00.000Z", // BEFORE the scan
          qrPayload: { sku: "AF-CAN-12" },
          subscriptionPayload: { amountCents: 1999, currency: "USD" },
        }),
      ],
      AT,
    );
    expect(dto.overall.scanned).toBe(1);
    expect(dto.overall.subscribers).toBe(1);
    // Subscribe precedes the scan → not a real scan→subscribe → 0%, not 100%.
    expect(dto.overall.converted).toBe(0);
    expect(dto.overall.subscribeRate).toBe(0);
  });
});
