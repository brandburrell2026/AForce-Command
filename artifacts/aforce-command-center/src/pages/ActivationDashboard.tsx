import { useAuth, useClerk } from "@clerk/react";
import {
  useActivationFunnel,
  findConversion,
  HEADLINE_CONVERSIONS,
  STAGE_LABELS,
  CONVERSION_LABELS,
  DIMENSION_LABELS,
  type FunnelConversion,
  type FunnelStage,
  type FunnelSegment,
} from "@/lib/activationFunnel";
import { isForbidden, formatPercent } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info, Lock } from "lucide-react";

function ConversionCard({ conversion }: { conversion: FunnelConversion }) {
  const awaiting = conversion.status === "awaiting";
  const label = CONVERSION_LABELS[conversion.id] ?? conversion.id;

  return (
    <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <span className="text-[10px] font-bold tracking-widest text-primary uppercase mb-4">
        {label}
      </span>

      <div className="flex-1 flex flex-col justify-end">
        {awaiting ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>Awaiting data</span>
          </div>
        ) : (
          <>
            <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              {formatPercent(conversion.rate) ?? "—"}
            </span>
            <div className="mt-2 text-sm text-muted-foreground">
              {conversion.converted.toLocaleString()} /{" "}
              {conversion.entered.toLocaleString()} converted
            </div>
          </>
        )}
      </div>

      <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  );
}

function StageRow({ stage, maxCount }: { stage: FunnelStage; maxCount: number }) {
  const label = STAGE_LABELS[stage.stage] ?? stage.stage;

  if (!stage.instrumented) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-48 shrink-0 text-sm text-muted-foreground/70">
          {label}
        </div>
        <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground/60">
          <Lock className="w-3.5 h-3.5 opacity-50 shrink-0" />
          Not instrumented yet
        </div>
        <div className="w-16 text-right text-sm text-muted-foreground/40">—</div>
      </div>
    );
  }

  const pct = maxCount > 0 ? Math.max(2, (stage.count / maxCount) * 100) : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="w-48 shrink-0 text-sm font-medium text-foreground">
        {label}
      </div>
      <div className="flex-1 h-7 bg-white/5 rounded-md overflow-hidden">
        <div
          className="h-full bg-primary/30 border-r-2 border-primary/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-16 text-right text-sm font-semibold tabular-nums text-foreground">
        {stage.count.toLocaleString()}
      </div>
    </div>
  );
}

function SegmentPanel({ segment }: { segment: FunnelSegment }) {
  const label = DIMENSION_LABELS[segment.dimension] ?? segment.dimension;

  return (
    <div className="p-5 bg-card border border-white/5 rounded-2xl">
      <h3 className="text-xs font-bold tracking-wider uppercase text-foreground mb-4">
        {label}
      </h3>

      {segment.rows.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 opacity-60 shrink-0" />
          <span>No attributed scans yet</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium pb-2 pr-3">Segment</th>
                <th className="text-right font-medium pb-2 px-3">Cohort</th>
                {HEADLINE_CONVERSIONS.map((id) => (
                  <th key={id} className="text-right font-medium pb-2 px-3">
                    {CONVERSION_LABELS[id] ?? id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segment.rows.map((row) => (
                <tr key={row.segment} className="border-t border-white/5">
                  <td className="py-2.5 pr-3 text-foreground truncate max-w-[180px]">
                    {row.segment}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {row.cohort.toLocaleString()}
                  </td>
                  {HEADLINE_CONVERSIONS.map((id) => {
                    const c = findConversion(row.conversions, id);
                    const display =
                      c && c.status === "measured"
                        ? (formatPercent(c.rate) ?? "—")
                        : "—";
                    return (
                      <td
                        key={id}
                        className="py-2.5 px-3 text-right tabular-nums text-foreground"
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ActivationDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = useActivationFunnel({
    enabled: !!isSignedIn,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-60 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-80 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
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
            "An unexpected error occurred while fetching the activation funnel."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const maxCount = Math.max(
    0,
    ...data.stages.filter((s) => s.instrumented).map((s) => s.count),
  );
  const headlineConversions = HEADLINE_CONVERSIONS.map((id) =>
    findConversion(data.conversions, id),
  ).filter((c): c is FunnelConversion => c != null);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Activation Funnel
          <span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {data.totalFunnels === 0
            ? "No activation funnels yet — awaiting first QR scans"
            : `${data.totalFunnels.toLocaleString()} ${
                data.totalFunnels === 1 ? "identity" : "identities"
              } in funnel`}
          {" • "}
          {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Can → Scan → Install → Activation → Subscription. Stages with no
          Phase-1 event behind them read{" "}
          <span className="text-foreground font-medium">
            Not instrumented yet
          </span>{" "}
          and conversions with no cohort read{" "}
          <span className="text-foreground font-medium">Awaiting data</span>{" "}
          rather than a fabricated number (Score-Protection).
        </p>
      </div>

      {headlineConversions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {headlineConversions.map((conversion) => (
            <ConversionCard key={conversion.id} conversion={conversion} />
          ))}
        </div>
      )}

      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Stage Reach
        </h2>
        <div className="space-y-3">
          {data.stages.map((stage) => (
            <StageRow key={stage.stage} stage={stage} maxCount={maxCount} />
          ))}
        </div>
      </div>

      {data.segments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
            Attribution
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {data.segments.map((segment) => (
              <SegmentPanel key={segment.dimension} segment={segment} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
