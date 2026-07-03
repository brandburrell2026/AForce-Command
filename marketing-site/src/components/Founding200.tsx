import { useState, type FormEvent } from "react";
import { useReveal } from "../hooks/useReveal";

type Status = "idle" | "error" | "success";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Founding200() {
  const ref = useReveal<HTMLDivElement>();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();

    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage("Enter a valid email so we can hold your place.");
      return;
    }

    // STUB: no backend wired yet. Capture to local state only.
    // TODO(founder): POST `value` to the Founding 200 waitlist endpoint.
    setStatus("success");
    setMessage("You're on the list — welcome to the Founding 200.");
    setEmail("");
  }

  return (
    <section
      id="founding"
      className="border-t border-white/[0.06] px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
    >
      <div ref={ref} className="mx-auto max-w-2xl text-center">
        <p className="eyebrow reveal text-signal">Limited · 200 Members</p>
        <h2 className="reveal mt-6 font-display text-4xl leading-[0.95] tracking-[-0.02em] text-bone sm:text-5xl">
          Join the Founding 200.
        </h2>
        <p
          className="reveal mx-auto mt-6 max-w-md text-base leading-relaxed text-bone/55"
          style={{ transitionDelay: "80ms" }}
        >
          Two hundred people will define what performance readiness looks like.
          Membership is by list, and the list opens once.
        </p>

        {status === "success" ? (
          <div
            className="reveal mx-auto mt-12 max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8"
            role="status"
            aria-live="polite"
          >
            <p className="font-display text-lg text-bone">{message}</p>
            <p className="mt-2 font-mono text-xs tracking-[0.16em] text-bone/45 uppercase">
              Watch your inbox
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="reveal mx-auto mt-12 flex max-w-md flex-col gap-3 sm:flex-row"
            style={{ transitionDelay: "160ms" }}
          >
            <div className="flex-1 text-left">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                aria-invalid={status === "error"}
                aria-describedby={status === "error" ? "email-error" : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                className="h-14 w-full rounded-[14px] border border-white/[0.10] bg-white/[0.03] px-5 font-mono text-sm text-bone placeholder:text-bone/30 focus:border-signal focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-14 shrink-0 rounded-[14px] bg-signal px-8 font-mono text-sm font-medium tracking-[0.12em] text-bone uppercase transition-transform duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: "0 0 24px rgba(193,40,27,0.35)" }}
            >
              Request Access
            </button>
          </form>
        )}

        {/* Error lives below the field, announced to screen readers */}
        {status === "error" && (
          <p
            id="email-error"
            role="alert"
            className="reveal mt-3 font-mono text-xs tracking-[0.08em] text-signal"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
