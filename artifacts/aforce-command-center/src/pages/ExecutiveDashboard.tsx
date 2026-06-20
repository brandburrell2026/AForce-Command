import { useAuth, useClerk } from "@clerk/react";
import { useCommandCenterSummary, DAILY_FIVE_META, formatPercent, isForbidden } from "@/lib/commandCenter";
import { MetricCard } from "@/components/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export default function ExecutiveDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = useCommandCenterSummary({
    enabled: !!isSignedIn,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-48 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-64 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
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
            This cockpit is restricted to AForce founders only. Your account does not have the required permissions.
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
          {error?.message || "An unexpected error occurred while fetching the executive summary."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Summary</h1>
        <p className="text-muted-foreground mt-2">
          Daily Five • Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Activations */}
        <MetricCard
          title={DAILY_FIVE_META.activations.title}
          sourceNote={DAILY_FIVE_META.activations.sourceNote}
          proxy={DAILY_FIVE_META.activations.proxy}
          value={data.activations.recent.toLocaleString()}
          subtitle={`${data.activations.total.toLocaleString()} total all-time`}
        />

        {/* D7 Return Rate */}
        <MetricCard
          title={DAILY_FIVE_META.d7ReturnRate.title}
          sourceNote={DAILY_FIVE_META.d7ReturnRate.sourceNote}
          proxy={DAILY_FIVE_META.d7ReturnRate.proxy}
          isEmpty={data.d7ReturnRate.rate === null}
          emptyReason="Not enough mature cohort data"
          value={formatPercent(data.d7ReturnRate.rate)}
          subtitle={`${data.d7ReturnRate.numerator} / ${data.d7ReturnRate.denominator} users`}
        />

        {/* Command Follow Rate */}
        <MetricCard
          title={DAILY_FIVE_META.commandFollowRate.title}
          sourceNote={DAILY_FIVE_META.commandFollowRate.sourceNote}
          proxy={DAILY_FIVE_META.commandFollowRate.proxy}
          isEmpty={data.commandFollowRate.rate === null}
          emptyReason="No confirmations recorded"
          value={formatPercent(data.commandFollowRate.rate)}
          subtitle={`${data.commandFollowRate.numerator} / ${data.commandFollowRate.denominator} confirmations`}
        />

        {/* Subscription Conversion */}
        <MetricCard
          title={DAILY_FIVE_META.subscriptionConversion.title}
          sourceNote={DAILY_FIVE_META.subscriptionConversion.sourceNote}
          proxy={DAILY_FIVE_META.subscriptionConversion.proxy}
          isEmpty={data.subscriptionConversion.rate === null}
          emptyReason="No accounts registered"
          value={formatPercent(data.subscriptionConversion.rate)}
          subtitle={`${data.subscriptionConversion.numerator} / ${data.subscriptionConversion.denominator} accounts`}
        />

        {/* Readiness Score Trend */}
        <MetricCard
          title={DAILY_FIVE_META.readinessScoreTrend.title}
          sourceNote={DAILY_FIVE_META.readinessScoreTrend.sourceNote}
          proxy={DAILY_FIVE_META.readinessScoreTrend.proxy}
          isEmpty={data.readinessScoreTrend.direction === null}
          emptyReason="Insufficient baseline snapshots"
          value={data.readinessScoreTrend.current?.toFixed(1) || "—"}
          trend={
            data.readinessScoreTrend.direction && (
              <span className={`flex items-center ${
                data.readinessScoreTrend.direction === "up" ? "text-secondary" :
                data.readinessScoreTrend.direction === "down" ? "text-destructive" :
                "text-muted-foreground"
              }`}>
                {data.readinessScoreTrend.direction === "up" && <ArrowUp className="w-4 h-4 mr-1" />}
                {data.readinessScoreTrend.direction === "down" && <ArrowDown className="w-4 h-4 mr-1" />}
                {data.readinessScoreTrend.direction === "flat" && <ArrowRight className="w-4 h-4 mr-1" />}
                {data.readinessScoreTrend.delta != null ? Math.abs(data.readinessScoreTrend.delta).toFixed(1) : ""}
              </span>
            )
          }
          subtitle={`Prev: ${data.readinessScoreTrend.previous?.toFixed(1) || "—"} (${data.readinessScoreTrend.currentSamples} vs ${data.readinessScoreTrend.previousSamples} samples)`}
        />
      </div>
    </div>
  );
}
