export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-y-0 right-0 w-[55vw] flex items-center justify-center">
        <div
          className="absolute w-[42vw] h-[42vw] rounded-full opacity-55 blur-[7vw]"
          style={{ background: "radial-gradient(circle, rgba(84,120,213,0.65) 0%, rgba(84,120,213,0.18) 45%, transparent 72%)" }}
        />
        <div
          className="absolute bottom-[8vh] w-[28vw] h-[3vh] rounded-[50%] blur-[2vw] opacity-70"
          style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)" }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[86vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 80px rgba(84,120,213,0.35))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[58vw] pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--slide-bg) 60%, transparent 100%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">01 — Cover</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-muted">1 / 28</div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[55vw] z-10">
        <div className="flex items-baseline gap-[1.4vw] mb-[2.4vh]">
          <div className="font-display text-[3.8vw] leading-none tracking-tight text-primary">AForce</div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-text/55 font-semibold">The Performance Operating System</div>
        </div>
        <h1 className="font-display text-[6.4vw] leading-[0.9] tracking-tighter text-text max-w-[44vw]">
          Performance is <span className="text-primary">non-negotiable.</span>
        </h1>
        <p className="mt-[2.4vh] font-display text-[1.85vw] leading-tight text-text/90 max-w-[42vw] text-pretty">
          <span className="text-primary">Pause.</span> <span className="text-text">Hydrate.</span> <span className="text-accent">Lock in.</span> Perform.
        </p>
        <p className="mt-[1.4vh] font-body text-[1.15vw] font-light text-text/65 max-w-[42vw] leading-snug">
          This is beyond a hydration brand. <span className="text-text/85">This is a performance standard.</span>
        </p>
      </div>

      {/* Provisional patent notice — bottom-right corner. */}
      <div className="absolute bottom-[6vh] right-[6vw] z-10 text-right max-w-[36vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">
          Patent Pending
        </div>
        <div className="font-body text-[0.72vw] text-text/55 mt-[0.4vh] leading-snug">
          U.S. Provisional Patent Application filed May 2026
          <br />
          <span className="text-text/45">
            "Closed-Loop Real-Time Physiological Performance Operating System and
            Methods of Use" · Docket AFG-101-US-P · Inventors: B. Burrell, J. Burrell
          </span>
        </div>
      </div>
    </div>
  );
}
