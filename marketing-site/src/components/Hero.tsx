import Monogram from "./Monogram";
import { useReveal } from "../hooks/useReveal";

export default function Hero() {
  const ref = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id="hero"
      className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 pt-8 pb-12 sm:px-10 lg:px-16"
    >
      {/* Faint Signal Red horizon glow — soft, never a hard shadow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] opacity-[0.14]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(193,40,27,0.55), transparent 70%)",
        }}
      />

      {/* Top bar — wordmark + monogram */}
      <header className="flex items-center justify-between">
        <span className="eyebrow text-bone/70">AForce</span>
        <Monogram className="text-lg text-bone/80" />
      </header>

      {/* Manifesto */}
      <div className="mx-auto flex max-w-5xl flex-1 flex-col justify-center py-16 text-center">
        <p className="eyebrow reveal text-signal">Performance Readiness</p>
        <h1 className="reveal mt-6 font-display text-[13vw] leading-[0.92] tracking-[-0.02em] text-bone sm:text-7xl lg:text-8xl">
          Performance Is
          <br />
          Non-Negotiable.
        </h1>

        {/* The ritual */}
        <p
          className="reveal mx-auto mt-10 max-w-md font-mono text-xs tracking-[0.35em] text-bone/60 uppercase sm:max-w-xl sm:text-sm"
          style={{ transitionDelay: "120ms" }}
        >
          Pause<span className="text-signal"> · </span>Hydrate
          <span className="text-signal"> · </span>Lock-In
          <span className="text-signal"> · </span>Perform
        </p>

        <div
          className="reveal mt-12"
          style={{ transitionDelay: "220ms" }}
        >
          <a
            href="#founding"
            className="group inline-flex h-14 items-center justify-center rounded-[14px] bg-signal px-8 font-mono text-sm font-medium tracking-[0.12em] text-bone uppercase transition-transform duration-200 hover:-translate-y-0.5"
            style={{ boxShadow: "0 0 24px rgba(193,40,27,0.35)" }}
          >
            Join the Founding 200
          </a>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="flex items-center justify-center">
        <span className="font-mono text-[10px] tracking-[0.3em] text-bone/30 uppercase">
          Scroll
        </span>
      </div>
    </section>
  );
}
