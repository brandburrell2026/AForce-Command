import { useState, type FormEvent } from "react";

interface Props {
  source?: string;
  className?: string;
  buttonText?: string;
}

export function EarlyAccessCapture({
  source = "site",
  className = "",
  buttonText = "Request Access",
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className={`text-sm text-white/70 ${className}`}>
        You're on the list.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`flex gap-2 ${className}`}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@domain.com"
        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="bg-[#E25C5C] hover:bg-[#d04a4a] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
      >
        {state === "loading" ? "..." : buttonText}
      </button>
    </form>
  );
}
