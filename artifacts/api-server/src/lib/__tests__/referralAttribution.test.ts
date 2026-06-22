import { describe, it, expect } from "vitest";
import {
  buildReferralAttribution,
  normalizeReferralFilters,
  tierClaimBounds,
  ReferralAttributionSchema,
  REFERRAL_RECENT_CLAIMS_LIMIT,
  type ReferralAttributionInput,
  type ReferrerCountRow,
  type ReferralClaimRow,
} from "../referralAttribution";

const AT = "2026-06-22T00:00:00.000Z";

const NO_FILTERS = {
  from: null,
  to: null,
  code: null,
  referrerUserId: null,
  tier: null,
  status: null,
};

function input(over: Partial<ReferralAttributionInput> = {}): ReferralAttributionInput {
  return {
    referrers: [],
    totals: { totalClaims: 0, totalReferredUsers: 0 },
    recentClaims: [],
    claimsInRange: 0,
    filters: NO_FILTERS,
    ...over,
  };
}

function referrer(
  referrerUserId: string,
  claims: number,
  referralCode: string | null = `${referrerUserId.toUpperCase()}CODE`,
): ReferrerCountRow {
  return { referrerUserId, referralCode, claims };
}

function claim(over: Partial<ReferralClaimRow> & { id: number }): ReferralClaimRow {
  return {
    codeUsed: "ABCD2345",
    referrerUserId: "user_ref",
    referrerCode: "ABCD2345",
    referrerLifetimeClaims: 1,
    refereeUserId: "user_new",
    claimedAt: AT,
    ...over,
  };
}

describe("buildReferralAttribution — overview & empty state", () => {
  it("reports honest zeros for an empty ledger (no fabrication)", () => {
    const dto = buildReferralAttribution(input(), AT);
    expect(dto.overview).toEqual({
      totalClaims: 0,
      totalAmbassadors: 0,
      totalReferredUsers: 0,
      claimsInRange: 0,
    });
    expect(dto.topAmbassadors).toEqual([]);
    expect(dto.recentClaims).toEqual([]);
    expect(dto.generatedAt).toBe(AT);
    expect(() => ReferralAttributionSchema.parse(dto)).not.toThrow();
  });

  it("derives totalAmbassadors from the distinct-referrer list, not the cap", () => {
    const referrers = [referrer("a", 3), referrer("b", 1), referrer("c", 1)];
    const dto = buildReferralAttribution(
      input({ referrers, totals: { totalClaims: 5, totalReferredUsers: 5 } }),
      AT,
    );
    expect(dto.overview.totalAmbassadors).toBe(3);
    expect(dto.overview.totalClaims).toBe(5);
    expect(dto.overview.totalReferredUsers).toBe(5);
  });
});

describe("buildReferralAttribution — SQL contract: ranking & tiers", () => {
  it("dense-ranks ambassadors by claims desc with ties sharing a rank (no gaps)", () => {
    const referrers = [
      referrer("z", 10),
      referrer("m", 5),
      referrer("a", 5),
      referrer("q", 2),
    ];
    const dto = buildReferralAttribution(input({ referrers }), AT);
    expect(dto.topAmbassadors.map((a) => [a.referrerUserId, a.rank])).toEqual([
      ["z", 1],
      ["a", 2], // tie at 5 → shared rank 2, tie-broken by id asc (a before m)
      ["m", 2],
      ["q", 3], // dense: next bracket is 3, never 4
    ]);
  });

  it("derives tier + anonymized handle from the lifetime claim count", () => {
    const dto = buildReferralAttribution(
      input({ referrers: [referrer("cmd", 15, "GQ55ABCD")] }),
      AT,
    );
    const top = dto.topAmbassadors[0];
    expect(top.tierId).toBe("commander"); // 15 claims
    expect(top.tierLabel).toBe("Commander");
    expect(top.handle).toBe("Operator GQ55"); // first 4 chars, no rank leak
  });

  it("buckets the FULL tier ladder in order, real 0s included", () => {
    const referrers = [
      referrer("op", 1), // operator
      referrer("cap1", 5), // captain
      referrer("cap2", 7), // captain
      referrer("gen", 60), // general
    ];
    const dto = buildReferralAttribution(input({ referrers }), AT);
    expect(dto.tierDistribution).toEqual([
      { tierId: "recruit", label: "Recruit", ambassadors: 0 },
      { tierId: "operator", label: "Operator", ambassadors: 1 },
      { tierId: "captain", label: "Captain", ambassadors: 2 },
      { tierId: "commander", label: "Commander", ambassadors: 0 },
      { tierId: "general", label: "General", ambassadors: 1 },
    ]);
  });

  it("applies the display cap to the leaderboard WITHOUT dropping it from totals", () => {
    const referrers = Array.from({ length: 5 }, (_, i) =>
      referrer(`u${i}`, 5 - i + 1),
    );
    const dto = buildReferralAttribution(input({ referrers }), AT, { topLimit: 2 });
    expect(dto.topLimit).toBe(2);
    expect(dto.topAmbassadors).toHaveLength(2);
    expect(dto.overview.totalAmbassadors).toBe(5); // total unaffected by cap
  });
});

describe("buildReferralAttribution — recent claims & filters", () => {
  it("maps claim rows with referrer tier/handle and echoes filters", () => {
    const filters = {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-22T00:00:00.000Z",
      code: "ABCD2345",
      referrerUserId: "user_ref",
      tier: "captain" as const,
      status: "claimed" as const,
    };
    const dto = buildReferralAttribution(
      input({
        recentClaims: [
          claim({ id: 2, referrerLifetimeClaims: 6, claimedAt: AT }),
        ],
        claimsInRange: 1,
        filters,
      }),
      AT,
    );
    expect(dto.filters).toEqual(filters);
    expect(dto.overview.claimsInRange).toBe(1);
    const row = dto.recentClaims[0];
    expect(row.id).toBe(2);
    expect(row.referrerTierId).toBe("captain"); // 6 lifetime claims
    expect(row.referrerHandle).toBe("Operator ABCD");
    expect(row.refereeUserId).toBe("user_new");
  });

  it("caps the recent-claims page to the requested limit", () => {
    const rows = Array.from({ length: 4 }, (_, i) => claim({ id: i + 1 }));
    const dto = buildReferralAttribution(
      input({ recentClaims: rows, claimsInRange: 4 }),
      AT,
      { recentLimit: 2 },
    );
    expect(dto.recentLimit).toBe(2);
    expect(dto.recentClaims).toHaveLength(2);
  });
});

describe("buildReferralAttribution — missing / deleted users", () => {
  it("renders a deleted referrer (null code) as Operator ???? but keeps the tier", () => {
    const dto = buildReferralAttribution(
      input({
        referrers: [referrer("ghost", 5, null)],
        recentClaims: [
          claim({
            id: 9,
            referrerUserId: "ghost",
            referrerCode: null,
            referrerLifetimeClaims: 5,
            refereeUserId: "user_new",
          }),
        ],
        claimsInRange: 1,
      }),
      AT,
    );
    expect(dto.topAmbassadors[0].handle).toBe("Operator ????");
    expect(dto.topAmbassadors[0].referralCode).toBeNull();
    expect(dto.topAmbassadors[0].tierId).toBe("captain");
    expect(dto.recentClaims[0].referrerHandle).toBe("Operator ????");
    expect(dto.recentClaims[0].referrerCode).toBeNull();
  });

  it("tolerates a claim with a null timestamp", () => {
    const dto = buildReferralAttribution(
      input({ recentClaims: [claim({ id: 1, claimedAt: null })], claimsInRange: 1 }),
      AT,
    );
    expect(dto.recentClaims[0].claimedAt).toBeNull();
    expect(() => ReferralAttributionSchema.parse(dto)).not.toThrow();
  });
});

describe("buildReferralAttribution — no duplicate attribution", () => {
  it("counts each distinct referrer exactly once and never inflates totals", () => {
    // SQL groups by referrer, so one row per referrer reaches the builder.
    const referrers = [referrer("a", 3), referrer("b", 2)];
    const dto = buildReferralAttribution(
      input({ referrers, totals: { totalClaims: 5, totalReferredUsers: 5 } }),
      AT,
    );
    expect(dto.topAmbassadors).toHaveLength(2);
    expect(dto.overview.totalAmbassadors).toBe(2);
    // totalReferredUsers is the SQL COUNT(DISTINCT referee) — the unique index
    // on referee_user_id guarantees one claim per referee, so this is also the
    // claim count. The builder passes it through without re-derivation.
    expect(dto.overview.totalReferredUsers).toBe(5);
    expect(dto.overview.totalClaims).toBe(5);
  });
});

describe("buildReferralAttribution — Score-Protection: no protected data leakage", () => {
  it("exposes ONLY referral fields — no score / health / performance keys", () => {
    const dto = buildReferralAttribution(
      input({
        referrers: [referrer("a", 3)],
        totals: { totalClaims: 3, totalReferredUsers: 3 },
        recentClaims: [claim({ id: 1, referrerUserId: "a", referrerLifetimeClaims: 3 })],
        claimsInRange: 3,
      }),
      AT,
    );

    const FORBIDDEN =
      /score|health|hydration|recovery|readiness|performance|points|sleep|heart|hrv|strain|weight|email/i;

    const assertClean = (obj: Record<string, unknown>, path: string) => {
      for (const key of Object.keys(obj)) {
        expect(FORBIDDEN.test(key), `${path}.${key} must not leak protected data`).toBe(
          false,
        );
      }
    };

    assertClean(dto as unknown as Record<string, unknown>, "dto");
    assertClean(dto.overview as unknown as Record<string, unknown>, "overview");
    assertClean(dto.filters as unknown as Record<string, unknown>, "filters");
    for (const a of dto.topAmbassadors)
      assertClean(a as unknown as Record<string, unknown>, "ambassador");
    for (const t of dto.tierDistribution)
      assertClean(t as unknown as Record<string, unknown>, "tier");
    for (const c of dto.recentClaims)
      assertClean(c as unknown as Record<string, unknown>, "claim");
  });
});

describe("buildReferralAttribution — defensive coercion", () => {
  it("truncates fractional counts and clamps negatives to zero", () => {
    const dto = buildReferralAttribution(
      input({
        referrers: [referrer("a", 3.9)],
        totals: { totalClaims: 5.7, totalReferredUsers: -2 },
        claimsInRange: -4,
      }),
      AT,
    );
    expect(dto.topAmbassadors[0].claims).toBe(3);
    expect(dto.overview.totalClaims).toBe(5);
    expect(dto.overview.totalReferredUsers).toBe(0);
    expect(dto.overview.claimsInRange).toBe(0);
    expect(() => ReferralAttributionSchema.parse(dto)).not.toThrow();
  });
});

describe("normalizeReferralFilters", () => {
  it("defaults to no filters and the default recent-claims cap", () => {
    const res = normalizeReferralFilters({});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.filters).toEqual(NO_FILTERS);
    expect(res.value.recentLimit).toBe(REFERRAL_RECENT_CLAIMS_LIMIT);
  });

  it("ISO-normalises dates, uppercases the code, trims the referrer", () => {
    const res = normalizeReferralFilters({
      from: "2026-06-01",
      to: "2026-06-22T12:00:00Z",
      code: " abcd2345 ",
      referrerUserId: " user_ref ",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.filters.from).toBe("2026-06-01T00:00:00.000Z");
    expect(res.value.filters.to).toBe("2026-06-22T12:00:00.000Z");
    expect(res.value.filters.code).toBe("ABCD2345");
    expect(res.value.filters.referrerUserId).toBe("user_ref");
  });

  it("rejects an unparseable date so it can never reach the SQL cast", () => {
    expect(normalizeReferralFilters({ from: "not-a-date" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
    expect(normalizeReferralFilters({ to: "13/45/2026" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
  });

  it("clamps the limit to [1, MAX] and falls back on garbage", () => {
    expect(
      (normalizeReferralFilters({ limit: 5 }) as { value: { recentLimit: number } })
        .value.recentLimit,
    ).toBe(5);
    expect(
      (normalizeReferralFilters({ limit: 99999 }) as { value: { recentLimit: number } })
        .value.recentLimit,
    ).toBe(REFERRAL_RECENT_CLAIMS_LIMIT);
    expect(
      (normalizeReferralFilters({ limit: "nope" }) as { value: { recentLimit: number } })
        .value.recentLimit,
    ).toBe(REFERRAL_RECENT_CLAIMS_LIMIT);
  });

  it("accepts a known tier case-insensitively and rejects an unknown one", () => {
    const res = normalizeReferralFilters({ tier: "CAPTAIN" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.filters.tier).toBe("captain");
    expect(normalizeReferralFilters({ tier: "diamond" })).toEqual({
      ok: false,
      error: "invalid_tier",
    });
  });

  it("accepts the modeled claim statuses and rejects anything else", () => {
    for (const s of ["all", "Claimed"] as const) {
      const res = normalizeReferralFilters({ status: s });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.filters.status).toBe(s.toLowerCase());
    }
    // "pending" is NOT a modeled state — reject rather than silently return [].
    expect(normalizeReferralFilters({ status: "pending" })).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });
});

describe("tierClaimBounds", () => {
  it("maps each tier to its [lo, hi) lifetime-claim band; top tier is open-ended", () => {
    expect(tierClaimBounds("recruit")).toEqual({ lo: 0, hi: 1 });
    expect(tierClaimBounds("operator")).toEqual({ lo: 1, hi: 5 });
    expect(tierClaimBounds("captain")).toEqual({ lo: 5, hi: 15 });
    expect(tierClaimBounds("commander")).toEqual({ lo: 15, hi: 50 });
    expect(tierClaimBounds("general")).toEqual({ lo: 50, hi: null });
  });
});
