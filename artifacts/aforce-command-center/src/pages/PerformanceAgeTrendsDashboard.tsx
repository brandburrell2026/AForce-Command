import { useAuth, useClerk } from "@clerk/react";
import {
  usePerformanceAgeTrends,
  formatYearsDelta,
  type PerformanceAgeTrendsDTO,
  type PerformanceAgeWindowDTO,
} from "@/lib/performanceAgeTrends";
import { isForbidden } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Info,
  Lock,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

function windowNote(
  w: PerformanceAgeWindowDTO,
  minCohort: number,
): string {
  if (w.status === "awaiting") return "Awaiting data";
  if (w.status === "collecting")
    return `Collecting — ${w.distinctMembers} / ${minCohort} members`;
  return "";
}

function HeroCard({
  label,
  w,
  minCohort,
}: {
  label: string;
  w: PerformanceAgeWindowDTO;
  minCohort: number;
}) {
  const measured = w.status === "measured" && w.avgDeltaYears !== null;
  const phrase = measured ? formatYearsDelta(w.avgDeltaYears as number) : null;

  return (
    <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <span className="text-[10px] font-bold tracking-widest text-primary uppercase mb-4">
        {label}
      </span>

      <div className="flex-1 flex flex-col justify-end">
        {measured && phrase ? (
          <>
            <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              {phrase.text}
            </span>
            <div className="mt-2 text-sm text-muted-foreground">
              avg across {w.distinctMembers.toLocaleString()}{" "}
              {w.distinctMembers === 1 ? "member" : "members"} •{" "}
              {w.snapshotCount.toLocaleString()}{" "}
              {w.snapshotCount === 1 ? "snapshot" : "snapshots"}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>{windowNote(w, minCohort)}</span>
          </div>
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

function ChangeBanner({ d }: { d: PerformanceAgeTrendsDTO }) {
  const { change, windowDays } = d;

  if (change.status !== "measured" || change.deltaYears === null) {
    return (
      <div className="flex items-center gap-3 p-5 rounded-2xl border border-white/5 bg-card">
        <Lock className="w-5 h-5 opacity-60 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {change.status === "awaiting"
            ? "Not enough data yet to compute a trend — awaiting the first cohort."
            : `Building a comparable cohort — a week-over-week trend appears once both ${windowDays}-day windows clear the k-anonymity floor.`}
        </span>
      </div>
    );
  }

  const phrase = formatYearsDelta(change.deltaYears);
  const Icon =
    phrase.direction === "younger"
      ? TrendingDown
      : phrase.direction === "older"
        ? TrendingUp
        : Minus;
  const tone =
    phrase.direction === "younger"
      ? "text-secondary"
      : phrase.direction === "older"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/5 bg-card">
      <div
        className={`w-11 h-11 rounded-full bg-white/5 flex items-center justify-center shrink-0 ${tone}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tracking-tight text-foreground">
          {phrase.direction === "steady"
            ? "Holding steady"
            : `Trending ${phrase.direction}`}{" "}
          <span className={`${tone}`}>({phrase.text})</span>
        </div>
        <div className="text-sm text-muted-foreground">
          cohort mean vs the prior {windowDays}-day window
        </div>
      </div>
    </div>
  );
}

export default function PerformanceAgeTrendsDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = usePerformanceAgeTrends({
    enabled: !!isSignedIn,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-72 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-96 bg-white/5" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
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
            "An unexpected error occurred while fetching Performance Age trends."}
        </p>
      </div>
    );
  }

  if (!data) return null;
  const d: PerformanceAgeTrendsDTO = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Performance Age Trends
          <span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {d.current.status === "measured"
            ? `${d.current.distinctMembers.toLocaleString()} ${
                d.current.distinctMembers === 1 ? "member" : "members"
              } this ${d.windowDays}-day window`
            : "Awaiting a measurable cohort"}
          {" • "}
          {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Performance Age™ is a display-only health estimate, never a scoring
          input (Score-Protection). Members report only the privacy-safe years{" "}
          <span className="text-foreground font-medium">delta</span> (negative =
          younger than their actual age) — never an absolute age. A window needs{" "}
          <span className="text-foreground font-medium">
            ≥ {d.minCohort} members
          </span>{" "}
          before its average is shown; below that it reads{" "}
          <span className="text-foreground font-medium">Collecting</span> rather
          than a fabricated number.
        </p>
      </div>

      <ChangeBanner d={d} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HeroCard
          label={`This ${d.windowDays} Days`}
          w={d.current}
          minCohort={d.minCohort}
        />
        <HeroCard
          label={`Prior ${d.windowDays} Days`}
          w={d.previous}
          minCohort={d.minCohort}
        />
      </div>

      <div className="p-6 bg-card border border-white/5 rounded-2xl">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground mb-6">
          Sample Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <CountStat label="Members (now)" value={d.current.distinctMembers} />
          <CountStat label="Snapshots (now)" value={d.current.snapshotCount} />
          <CountStat label="Members (prior)" value={d.previous.distinctMembers} />
          <CountStat
            label="Snapshots (prior)"
            value={d.previous.snapshotCount}
          />
        </div>
      </div>
    </div>
  );
}
