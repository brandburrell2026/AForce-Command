"use client";

import { useState, type FormEvent } from "react";
import Reveal from "../Reveal";

const PILLARS = [
  { k: "01", t: "Hydration", d: "Alkaline balance, measured." },
  { k: "02", t: "Recovery", d: "Readiness, restored." },
  { k: "03", t: "Performance", d: "Output, on demand." },
  { k: "04", t: "Behavior", d: "The ritual, tracked." },
  { k: "05", t: "Consistency", d: "Compounded over time." },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Membership() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage("Enter a valid email so we can hold your place.");
      return;
    }
    // STUB: no backend wired yet.
    // TODO(founder): POST `value` to the Founding 200 waitlist endpoint.
    setStatus("success");
    setMessage("You're on the list — welcome to the Founding 200.");
    setEmail("");
  }

  return (
    <section
      id="membership"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow text-signal">Membership</p>
              <h2 className="mt-6 font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl">
                AForce <span className="chrome-text">OS.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1} variant="fade">
              <p className="mt-8 max-w-md text-lg leading-relaxed text-bone/60">
                More than a drink — an operating system for readiness. Hydration,
                recovery, and performance, connected into one disciplined loop.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.05] sm:grid-cols-2">
              {PILLARS.map((p, i) => (
                <Reveal key={p.t} delay={i * 0.06} variant="fade">
                  <div className="flex h-full flex-col bg-canvas p-7">
                    <span className="font-mono text-xs tracking-[0.2em] text-bone/30">
                      {p.k}
                    </span>
                    <h3 className="mt-8 font-display text-xl text-bone">
                      {p.t}
                    </h3>
                    <p className="mt-2 text-sm text-bone/50">{p.d}</p>
                  </div>
                </Reveal>
              ))}
              {/* Join cell */}
              <Reveal delay={0.3} variant="fade">
                <div className="flex h-full flex-col justify-center bg-signal/[0.08] p-7">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
                    Limited · 200 Members
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-bone/70">
                    The list opens once.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* Join the Founding 200 */}
        <Reveal variant="fade" className="mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="font-display text-3xl leading-tight text-bone sm:text-4xl">
              Join the Founding 200.
            </h3>
            {status === "success" ? (
              <p
                role="status"
                aria-live="polite"
                className="mt-8 font-display text-lg text-bone"
              >
                {message}
              </p>
            ) : (
              <form
                onSubmit={onSubmit}
                noValidate
                className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
              >
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
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
                  className="h-14 flex-1 rounded-[14px] border border-white/[0.12] bg-white/[0.03] px-5 font-mono text-sm text-bone placeholder:text-bone/30 focus:border-signal focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-14 shrink-0 rounded-[14px] bg-signal px-8 font-mono text-sm font-medium uppercase tracking-[0.12em] text-bone transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ boxShadow: "0 0 24px rgba(193,40,27,0.35)" }}
                >
                  Request Access
                </button>
              </form>
            )}
            {status === "error" && (
              <p
                id="email-error"
                role="alert"
                className="mt-3 font-mono text-xs tracking-[0.08em] text-signal"
              >
                {message}
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
