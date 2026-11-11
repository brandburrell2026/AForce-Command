import type { ReactNode } from "react";

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${className}`}>{children}</span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto border border-hairline bg-ink/85 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
      <Mono className="text-muted">{children}</Mono>
      {right}
    </div>
  );
}

export function ToolButton({
  children,
  onClick,
  active = false,
  disabled = false,
  hint,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  hint?: string;
  tone?: "default" | "danger";
}) {
  const color = active
    ? "border-signal text-signal"
    : tone === "danger"
      ? "border-hairline text-muted hover:border-signal hover:text-signal"
      : "border-hairline text-bone hover:border-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`flex h-8 items-center gap-2 border bg-ink/70 px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${color}`}
    >
      {children}
      {hint ? <span className="text-[9px] text-dim">{hint}</span> : null}
    </button>
  );
}

export function Divider() {
  return <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />;
}
