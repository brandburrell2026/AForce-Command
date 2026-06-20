import { useAuth, useClerk } from "@clerk/react";
import {
  useRetentionGates,
  formatGateMeasured,
  gateSampleLabel,
  type RetentionGate,
} from "@/lib/retentionGates";
import { isForbidden } from "@/lib/commandCenter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, ArrowRight, Info, Lock } from "lucide-react";

const STATUS_STYLES: Record<
  RetentionGate["status"],
  { label: string; chip: string; value: string }
> = {
  passing: {
    label: "On target",
    chip: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    value: "text-emerald-400",
  },
  failing: {
    label: "Below target",
    chip: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    value: "text-amber-400",
  },
  awaiting: {
    label: "Awaiting data",
    chip: "text-muted-foreground bg-white/5 border-white/10",
    value: "text-foreground",
  },
};

function GateCard({ gate }: { gate: RetentionGate }) {
  const styles = STATUS_STYLES[gate.status];
  const measured = formatGateMeasured(gate);

  return (
    <div className="relative flex flex-col p-6 bg-card border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <div className="flex items-start justify-between mb-4">
        <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
          Gate {gate.index}
        </span>
        <span
          className={`px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded uppercase border ${styles.chip}`}
        >
          {styles.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
        <span>{gate.fromLabel}</span>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span>{gate.toLabel}</span>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-muted-foreground">
          Target {gate.target.display}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px] bg-popover text-popover-foreground border-border text-xs leading-relaxed p-3">
            {gate.awaitingNote}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        {gate.status === "awaiting" ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 opacity-60 shrink-0" />
            <span>Awaiting instrumentation</span>
          </div>
        ) : (
          <>
            <span
              className={`text-4xl md:text-5xl font-bold tracking-tight ${styles.value}`}
            >
              {measured}
            </span>
            <div className="mt-2 text-sm text-muted-foreground">
              {gateSampleLabel(gate)}
            </div>
          </>
        )}
      </div>

      <div className="absolute -inset-px bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
    </div>
  );
}

export default function ProductDashboard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { data, isLoading, isError, error } = useRetentionGates({
    enabled: !!isSignedIn,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-56 mb-2 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl bg-white/5" />
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
          {error?.message || "An unexpected error occurred while fetching the retention gates."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const measuredCount = data.gates.filter((g) => g.status !== "awaiting").length;
  const passingCount = data.gates.filter((g) => g.status === "passing").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Retention Gates<span className="align-super text-base text-primary">™</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          {measuredCount === 0
            ? "0 of 5 gates measured — awaiting activation instrumentation"
            : `${measuredCount} of 5 gates measured · ${passingCount} on target`}
          {" • "}
          {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/5 bg-card/40 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Each gate shows its owner target and computes live once the activation
          event pipeline is instrumented. Until then gates read{" "}
          <span className="text-foreground font-medium">Awaiting instrumentation</span>{" "}
          rather than a fabricated number (Score-Protection).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.gates.map((gate) => (
          <GateCard key={gate.id} gate={gate} />
        ))}
      </div>
    </div>
  );
}
