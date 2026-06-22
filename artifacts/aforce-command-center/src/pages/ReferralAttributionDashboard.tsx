import { useMemo, useState } from "react";
import { useAuth, useClerk } from "@clerk/react";
import {
  useReferralAttribution,
  TIER_ACCENT,
  TIER_OPTIONS,
  type ReferralAttributionDTO,
  type ReferralAttributionFilters,
  type ReferralTierId,
  type ReferralStatusFilter,
} from "@/lib/referralAttribution";
import { isForbidden } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info, Lock, Search, X } from "lucide-react";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A plain YYYY-MM-DD `to` is expanded to end-of-day UTC so the range is
 *  inclusive on both ends; anything else is passed through untouched. */
function endOfDay(to: string): string {
  return DATE_ONLY.test(to) ? `${to}T23:59:59.999Z` : to;
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ShortId({ value }: { value: string }) {
  const short = value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  return (
    <span className="font-mono text-xs text-muted-foreground" title={value}>
      {short}
    </span>
  );
}

export default function ReferralAttributionDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  // Draft inputs (controlled) vs the applied filters that actually drive the query.
  const [draft, setDraft] = useState<ReferralAttributionFilters>({});
  const [applied, setApplied] = useState<ReferralAttributionFilters>({});

  const queryFilters = useMemo<ReferralAttributionFilters>(() => {
    const f: ReferralAttributionFilters = {};
    if (applied.from) f.from = applied.from;
    if (applied.to) f.to = endOfDay(applied.to);
    if (applied.code) f.code = applied.code;
    if (applied.referrerUserId) f.referrerUserId = applied.referrerUserId;
    if (applied.tier) f.tier = applied.tier;
    if (applied.status) f.status = applied.status;
    return f;
  }, [applied]);

  const { data, isLoading, isError, error, isFetching } = useReferralAttribution(
    queryFilters,
    { enabled: !!isSignedIn },
  );

  const hasFilters =
    !!applied.from ||
    !!applied.to ||
    !!applied.code ||
    !!applied.referrerUserId ||
    !!applied.tier ||
    !!applied.status;

  function apply() {
    setApplied({
      from: draft.from?.trim() || undefined,
      to: draft.to?.trim() || undefined,
      code: draft.code?.trim() || undefined,
      referrerUserId: draft.referrerUserId?.trim() || undefined,
      tier: draft.tier || undefined,
      // `all` is the unfiltered default — only forward an explicit `claimed`.
      status: draft.status === "claimed" ? "claimed" : undefined,
    });
  }

  function clear() {
    setDraft({});
    setApplied({});
  }

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-72 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-96 bg-white/5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (isError) {
    if (isForbidden(error)) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Founder Access Required</h2>
          <p className="text-muted-foreground mb-8">
            This cockpit is restricted to AForce founders only. Your account does
            not have the required permissions.
          </p>
          <button
            onClick={() => signOut()}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Data Retrieval Failed</h2>
        <p className="text-muted-foreground">
          {error?.message ||
            "An unexpected error occurred while fetching referral attribution."}
        </p>
      </div>
    );
  }

  if (!data) return null;
  const d: ReferralAttributionDTO = data;
  const maxTier = d.tierDistribution.reduce((m, t) => Math.max(m, t.ambassadors), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Referral & Ambassador Attribution
          <span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {d.overview.totalClaims === 0
            ? "No referral claims yet — awaiting first ambassadors"
            : `${d.overview.totalAmbassadors.toLocaleString()} ${
                d.overview.totalAmbassadors === 1 ? "ambassador" : "ambassadors"
              } • ${d.overview.totalClaims.toLocaleString()} ${
                d.overview.totalClaims === 1 ? "claim" : "claims"
              }`}
          {" • "}
          {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Real referral ledger — every row is a completed claim (status{" "}
          <span className="text-foreground font-medium">Claimed</span>; a pending
          state is not modeled). Ambassador tier is derived from lifetime claims;
          referrers are shown by their generated code as{" "}
          <span className="text-foreground font-medium">Operator&nbsp;XXXX</span>{" "}
          and a deleted user reads{" "}
          <span className="text-foreground font-medium">Operator&nbsp;????</span>.
          Identity here is the Clerk id + non-PII code only — no hydration score,
          recovery, or health data is ever joined or shown (Score-Protection).
        </p>
      </div>

      {/* Overview totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-card border border-white/5 rounded-2xl">
        <CountStat label="Total Claims" value={d.overview.totalClaims} />
        <CountStat label="Ambassadors" value={d.overview.totalAmbassadors} />
        <CountStat label="Referred Users" value={d.overview.totalReferredUsers} />
        <CountStat
          label={hasFilters ? "Claims In Range" : "Claims (All)"}
          value={d.overview.claimsInRange}
        />
      </div>

      {/* Filters */}
      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-4">
          Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              From
            </span>
            <input
              type="date"
              value={draft.from ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              To
            </span>
            <input
              type="date"
              value={draft.to ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Referral Code
            </span>
            <input
              type="text"
              placeholder="e.g. ABCD2345"
              value={draft.code ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-white/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 uppercase"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Referrer User ID
            </span>
            <input
              type="text"
              placeholder="user_…"
              value={draft.referrerUserId ?? ""}
              onChange={(e) =>
                setDraft((p) => ({ ...p, referrerUserId: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-white/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tier
            </span>
            <select
              value={draft.tier ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  tier: e.target.value
                    ? (e.target.value as ReferralTierId)
                    : undefined,
                }))
              }
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            >
              <option value="">All tiers</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <select
              value={draft.status ?? "all"}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  status: e.target.value as ReferralStatusFilter,
                }))
              }
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            >
              <option value="all">All</option>
              <option value="claimed">Claimed</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={apply}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
          >
            <Search className="w-4 h-4" />
            Apply
          </button>
          {hasFilters && (
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          {isFetching && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Loading…
            </span>
          )}
        </div>
      </div>

      {/* Tier distribution */}
      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Tier Distribution
        </h2>
        <div className="space-y-5">
          {d.tierDistribution.map((t) => {
            const pct = maxTier > 0 ? (t.ambassadors / maxTier) * 100 : 0;
            return (
              <div key={t.tierId} className="space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className={`text-sm font-medium ${TIER_ACCENT[t.tierId]}`}>
                    {t.label}
                  </span>
                  <span className="text-sm tabular-nums">
                    <span className="text-foreground font-semibold">
                      {t.ambassadors.toLocaleString()}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t.ambassadors === 1 ? "ambassador" : "ambassadors"}
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top ambassadors */}
      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Top Ambassadors
        </h2>
        {d.topAmbassadors.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>No ambassadors yet</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  <th className="text-left font-bold py-2 pr-4">Rank</th>
                  <th className="text-left font-bold py-2 pr-4">Ambassador</th>
                  <th className="text-left font-bold py-2 pr-4">Code</th>
                  <th className="text-left font-bold py-2 pr-4">Tier</th>
                  <th className="text-right font-bold py-2">Claims</th>
                </tr>
              </thead>
              <tbody>
                {d.topAmbassadors.map((a) => (
                  <tr
                    key={a.referrerUserId}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      #{a.rank}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">
                          {a.handle}
                        </span>
                        <ShortId value={a.referrerUserId} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {a.referralCode ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-semibold ${TIER_ACCENT[a.tierId]}`}
                      >
                        {a.tierLabel}
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums font-semibold text-foreground">
                      {a.claims.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent claims */}
      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-1">
          Recent Claims
        </h2>
        <p className="text-xs text-muted-foreground mb-6">
          {hasFilters
            ? "Matching the filters above, newest first"
            : "Newest first, across all codes"}
        </p>
        {d.recentClaims.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>No claims match these filters</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  <th className="text-left font-bold py-2 pr-4">Code</th>
                  <th className="text-left font-bold py-2 pr-4">Referrer</th>
                  <th className="text-left font-bold py-2 pr-4">Referred User</th>
                  <th className="text-left font-bold py-2 pr-4">Tier</th>
                  <th className="text-left font-bold py-2 pr-4">Status</th>
                  <th className="text-right font-bold py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {d.recentClaims.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-foreground">
                      {c.codeUsed}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">
                          {c.referrerHandle}
                        </span>
                        <ShortId value={c.referrerUserId} />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <ShortId value={c.refereeUserId} />
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-semibold ${TIER_ACCENT[c.referrerTierId]}`}
                      >
                        {c.referrerTierLabel}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        Claimed
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {c.claimedAt ? new Date(c.claimedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
