import { useAuth, useClerk } from "@clerk/react";
import {
  useVoiceCheckInUsage,
  type VoiceCheckInUsageDTO,
  type UsageStatus,
} from "@/lib/voiceCheckInUsage";
import { isForbidden, formatPercent } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info, Lock } from "lucide-react";

function RateCard({
  label,
  rate,
  status,
  caption,
}: {
  label: string;
  rate: number | null;
  status: UsageStatus;
  caption: string;
}) {
  const awaiting = status === "awaiting";

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
              {formatPercent(rate) ?? "—"}
            </span>
            <div className="mt-2 text-sm text-muted-foreground">{caption}</div>
          </>
        )}
      </div>

      <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  );
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

function formatAvg(avg: number | null): string {
  if (avg == null) return "—";
  return avg.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export default function VoiceCheckInDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = useVoiceCheckInUsage({
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
        <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
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
            "An unexpected error occurred while fetching voice check-in usage."}
        </p>
      </div>
    );
  }

  if (!data) return null;
  const d: VoiceCheckInUsageDTO = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Voice Check-In Usage
          <span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {d.checkInUsers === 0
            ? "No voice check-ins yet — awaiting first morning rituals"
            : `${d.checkInUsers.toLocaleString()} ${
                d.checkInUsers === 1 ? "adopter" : "adopters"
              } • ${d.totalCheckIns.toLocaleString()} ${
                d.totalCheckIns === 1 ? "check-in" : "check-ins"
              }`}
          {" • "}
          {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          The morning Voice Check-In is a display-only self-report — it never
          changes a hydration score (Score-Protection), so this is pure
          engagement telemetry. Rates with no cohort read{" "}
          <span className="text-foreground font-medium">Awaiting data</span>{" "}
          rather than a fabricated 0%.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RateCard
          label="Adoption"
          rate={d.adoptionRate}
          status={d.adoptionStatus}
          caption={`${d.checkInUsers.toLocaleString()} / ${d.activeUsers.toLocaleString()} active users`}
        />
        <RateCard
          label="Repeat Rate"
          rate={d.repeatRate}
          status={d.repeatStatus}
          caption={`${d.repeatUsers.toLocaleString()} / ${d.checkInUsers.toLocaleString()} returned`}
        />
        <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
          <span className="text-[10px] font-bold tracking-widest text-primary uppercase mb-4">
            Avg / Adopter
          </span>
          <div className="flex-1 flex flex-col justify-end">
            {d.avgPerUser == null ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 opacity-60 shrink-0" />
                <span>Awaiting data</span>
              </div>
            ) : (
              <>
                <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                  {formatAvg(d.avgPerUser)}
                </span>
                <div className="mt-2 text-sm text-muted-foreground">
                  check-ins per adopter
                </div>
              </>
            )}
          </div>
          <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
        </div>
      </div>

      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Engagement Totals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <CountStat label="Active Users" value={d.activeUsers} />
          <CountStat label="Check-In Users" value={d.checkInUsers} />
          <CountStat label="Repeat Users" value={d.repeatUsers} />
          <CountStat label="Total Check-Ins" value={d.totalCheckIns} />
        </div>
      </div>
    </div>
  );
}
