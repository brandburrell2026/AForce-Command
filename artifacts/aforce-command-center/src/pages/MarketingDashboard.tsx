import { useAuth, useClerk } from "@clerk/react";
import {
  useMarketingAttribution,
  DIMENSION_LABELS,
  formatGross,
  formatArpu,
  type MarketingSource,
  type MarketingSourceRow,
  type RevenueTotals,
} from "@/lib/marketing";
import { isForbidden, formatPercent } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info, Lock } from "lucide-react";

function MetricCard({
  label,
  value,
  sub,
  awaiting,
}: {
  label: string;
  value: string;
  sub?: string;
  awaiting?: boolean;
}) {
  return (
    <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <span className="text-[10px] font-bold tracking-widest text-primary uppercase mb-4">
        {label}
      </span>
      <div className="flex-1 flex flex-col justify-end">
        {awaiting ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>{value}</span>
          </div>
        ) : (
          <>
            <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              {value}
            </span>
            {sub && <div className="mt-2 text-sm text-muted-foreground">{sub}</div>}
          </>
        )}
      </div>
      <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  );
}

/** Per-currency gross / ARPU + plan mix, or an honest awaiting note. */
function RevenuePanel({ revenue }: { revenue: RevenueTotals }) {
  if (revenue.byCurrency.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Lock className="w-4 h-4 opacity-60 shrink-0" />
        <span>Awaiting revenue data</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {revenue.byCurrency.map((c) => (
          <div
            key={c.currency}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="font-semibold tabular-nums text-foreground">
              {formatGross({ ...revenue, byCurrency: [c] })}
            </span>
            <span className="text-muted-foreground">
              {c.subscribers.toLocaleString()} subs ·{" "}
              {formatArpu({ ...revenue, byCurrency: [c] })} ARPU
            </span>
          </div>
        ))}
      </div>
      {revenue.planMix.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {revenue.planMix.map((p) => (
            <span
              key={p.planTier}
              className="px-2.5 py-1 rounded-full bg-white/5 text-xs text-muted-foreground"
            >
              <span className="text-foreground font-medium">{p.planTier}</span>{" "}
              {p.subscribers.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function rowGross(row: MarketingSourceRow): string {
  return formatGross(row.revenue) ?? "Awaiting";
}

function SourcePanel({ source }: { source: MarketingSource }) {
  const label = DIMENSION_LABELS[source.dimension] ?? source.dimension;

  return (
    <div className="p-5 bg-card border border-white/5 rounded-2xl">
      <h3 className="text-xs font-bold tracking-wider uppercase text-foreground mb-4">
        {label}
      </h3>

      {source.rows.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 opacity-60 shrink-0" />
          <span>No attributed scans yet</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium pb-2 pr-3">Source</th>
                <th className="text-right font-medium pb-2 px-3">Scans</th>
                <th className="text-right font-medium pb-2 px-3">Subs</th>
                <th className="text-right font-medium pb-2 px-3">Rate</th>
                <th className="text-right font-medium pb-2 pl-3">Gross</th>
              </tr>
            </thead>
            <tbody>
              {source.rows.map((row) => (
                <tr key={row.segment} className="border-t border-white/5">
                  <td className="py-2.5 pr-3 text-foreground truncate max-w-[180px]">
                    {row.segment}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {row.scanned.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {row.subscribers.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                    {formatPercent(row.subscribeRate) ?? "—"}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-foreground">
                    {rowGross(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MarketingDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = useMarketingAttribution({
    enabled: !!isSignedIn,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-60 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-80 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl bg-white/5" />
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
            "An unexpected error occurred while fetching marketing attribution."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { overall } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Marketing Attribution
          <span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {data.totalFunnels === 0
            ? "No acquisition activity yet — awaiting first QR scans"
            : `${data.totalFunnels.toLocaleString()} ${
                data.totalFunnels === 1 ? "identity" : "identities"
              } tracked`}
          {" • "}
          {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Which acquisition source drives paid subscriptions. Revenue is
          attributed from non-PII metadata on the subscription event — a source
          with subscribers but no priced events reads{" "}
          <span className="text-foreground font-medium">Awaiting revenue</span>,
          and a source nobody scanned reads{" "}
          <span className="text-foreground font-medium">—</span> rather than a
          fabricated number (Score-Protection). Revenue is never summed across
          currencies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          label="Scans"
          value={overall.scanned.toLocaleString()}
          sub="Attributed acquisition QR scans"
        />
        <MetricCard
          label="Subscribers"
          value={overall.subscribers.toLocaleString()}
          sub="Started a paid subscription"
        />
        <MetricCard
          label="Scan → Subscribe"
          value={formatPercent(overall.subscribeRate) ?? "Awaiting data"}
          awaiting={overall.subscribeRate == null}
          sub={
            overall.subscribeRate != null
              ? `${overall.converted.toLocaleString()} / ${overall.scanned.toLocaleString()} scanners`
              : undefined
          }
        />
        <MetricCard
          label="Gross"
          value={formatGross(overall.revenue) ?? "Awaiting revenue"}
          awaiting={overall.revenue.byCurrency.length === 0}
          sub={
            overall.revenue.byCurrency.length > 0
              ? `${overall.revenue.subscribers.toLocaleString()} priced subs`
              : undefined
          }
        />
      </div>

      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Revenue
        </h2>
        <RevenuePanel revenue={overall.revenue} />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
          Attribution by Source
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {data.sources.map((source) => (
            <SourcePanel key={source.dimension} source={source} />
          ))}
        </div>
      </div>
    </div>
  );
}
