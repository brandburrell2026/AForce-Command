export default function Phantom() {
  const base = import.meta.env.BASE_URL;

  const pillars = [
    {
      label: "Sense",
      body: "Passive bio-signal capture — no log, no tap, no friction.",
      accent: "text-blue",
      bar: "bg-blue",
    },
    {
      label: "Close the loop",
      body: "Turns the OS from inferred state into measured state.",
      accent: "text-primary",
      bar: "bg-primary",
    },
    {
      label: "Permanent moat",
      body: "Liquid IV can't ship hardware. WHOOP can't ship a can.",
      accent: "text-accent",
      bar: "bg-accent",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 30% 50%, rgba(84,120,213,0.18) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 88% 80%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      {/* Header */}
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">16 — Phantom</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">16 / 25</div>
      </div>

      {/* Two-column body: hero photo (left) + content (right) */}
      <div className="absolute top-[12vh] bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-[1.15fr_1fr] gap-[3vw] items-center">
        {/* LEFT — hero photo */}
        <div className="relative rounded-2xl ring-1 ring-blue/30 overflow-hidden bg-bg-elev/40 w-full aspect-[768/420]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(84,120,213,0.22) 0%, transparent 70%)" }}
          />
          <img
            src={`${base}phantom-hero.png`}
            alt="Phantom One — hydration & performance band prototype"
            className="absolute inset-0 w-full h-full object-contain select-none p-[1.5vw]"
            style={{ filter: "drop-shadow(0 0 60px rgba(84,120,213,0.35))" }}
            draggable={false}
          />

          {/* Photo caption pill */}
          <div className="absolute bottom-[2vh] left-[1.6vw] inline-flex items-center gap-[0.7vw] px-[1vw] py-[0.6vh] rounded-full border border-blue/40 bg-bg/70 backdrop-blur-sm z-10">
            <span className="w-[0.5vw] h-[0.5vw] rounded-full bg-blue animate-pulse" />
            <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-blue font-semibold">Prototype · In Progress</span>
          </div>
        </div>

        {/* RIGHT — content stack */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
              <div className="h-[2px] w-[4vw] bg-blue" />
              <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-blue font-semibold">Phase 2 · 2027+</span>
            </div>
            <h2 className="font-display text-[4.2vw] leading-[0.92] tracking-tighter">
              Drink today.
            </h2>
            <h2 className="font-display text-[4.2vw] leading-[0.92] tracking-tighter text-blue">
              Sense tomorrow.
            </h2>
            <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text/70 mt-[1.2vh]">
              Same OS.
            </div>

            <p className="font-body text-[0.95vw] text-text/70 leading-snug mt-[2vh] max-w-[28vw]">
              Phantom is the wearable AForce will build once the can is on shelf and the OS has 100K daily users teaching it what to listen for. <span className="text-text">No screen. One LED edge.</span> Real-time hydration state, communicated by color.
            </p>
          </div>

          {/* 3 pillars — vertical stack */}
          <div className="flex flex-col gap-[1.2vh] mt-[2vh]">
            {pillars.map((p) => (
              <div key={p.label} className="relative pl-[1vw]">
                <div className={`absolute left-0 top-[0.4vh] bottom-[0.4vh] w-[3px] ${p.bar} rounded-full`} />
                <div className={`font-body uppercase tracking-[0.28em] text-[0.7vw] font-semibold ${p.accent}`}>{p.label}</div>
                <div className="font-body text-[0.95vw] text-text/75 leading-snug mt-[0.3vh]">{p.body}</div>
              </div>
            ))}
          </div>

          {/* Guardrail pill */}
          <div className="mt-[2vh] inline-flex self-start items-center gap-[0.7vw] px-[1vw] py-[0.6vh] rounded-full border border-accent/40 bg-accent/[0.08]">
            <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-accent font-semibold">Vision Slide</span>
            <span className="w-[1px] h-[1.4vh] bg-accent/30" />
            <span className="font-body text-[0.65vw] text-text/70">$0 of this round funds Phantom</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.4vh] flex justify-between items-center">
          <div className="font-display text-[1.3vw] leading-tight tracking-tight text-text/85">
            <span className="text-text">CPG today.</span> <span className="text-blue">Sensing layer next.</span> <span className="text-accent">Same operating system.</span>
          </div>
          <div className="font-body text-[0.78vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Roadmap signal · not a 2026 deliverable<br/>
            $4M Seed funds the can. Phantom funds itself on data.
          </div>
        </div>
      </div>
    </div>
  );
}
