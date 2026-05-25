import { useState, type FormEvent } from "react";

interface Props {
  source?: string;
  className?: string;
  buttonText?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done" }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EarlyAccessCapture({
  source = "site",
  className = "",
  buttonText = "Request Access",
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setState({ kind: "error", message: "Enter a valid email." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });
      if (res.ok) {
        setState({ kind: "done" });
        return;
      }
      if (res.status === 429) {
        setState({
          kind: "error",
          message: "Too many attempts. Try again in a minute.",
        });
        return;
      }
      if (res.status === 400) {
        setState({ kind: "error", message: "Enter a valid email." });
        return;
      }
      setState({
        kind: "error",
        message: "Something went wrong. Try again.",
      });
    } catch {
      setState({
        kind: "error",
        message: "Network error. Check your connection.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col gap-2 ${className}`}
      >
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(182,255,0,0.8)]" />
          <p className="text-sm text-white/85">
            You're on the list. We'll be in touch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEmail("");
            setState({ kind: "idle" });
          }}
          className="self-start text-[11px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70 transition-colors"
        >
          Add another email
        </button>
      </div>
    );
  }

  const isLoading = state.kind === "loading";
  const hasError = state.kind === "error";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`flex flex-col gap-2 ${className}`}
    >
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (hasError) setState({ kind: "idle" });
          }}
          disabled={isLoading}
          placeholder="you@domain.com"
          aria-invalid={hasError}
          aria-describedby={hasError ? "early-access-error" : undefined}
          className={`flex-1 min-w-0 bg-white/5 border rounded px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors disabled:opacity-50 ${
            hasError
              ? "border-red-500/60 focus:border-red-500"
              : "border-white/10 focus:border-primary/60"
          }`}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs uppercase tracking-[0.15em] font-bold px-5 py-2.5 rounded transition-colors whitespace-nowrap shadow-[0_0_30px_rgba(182,255,0,0.18)]"
        >
          {isLoading ? "…" : buttonText}
        </button>
      </div>
      {hasError && (
        <p
          id="early-access-error"
          role="alert"
          className="text-xs text-red-400/90"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
