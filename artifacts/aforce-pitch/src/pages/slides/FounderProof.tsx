export default function FounderProof() {
  const arenas = [
    {
      label: "Wall Street",
      title: "Capital decisions under pressure.",
      detail: "6 AM or 10 PM — the market doesn't wait. You show up sharp, or you pay for it.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Entrepreneurship",
      title: "Building from zero. High-pressure execution.",
      detail: "Every decision is yours. No safety net. No off days. Performance is the job.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 18% 30%, rgba(229,51,65,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 50% at 85% 80%, rgba(84,120,213,0.12) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">02 — Founder Proof</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">2 / 27</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Origin · Built From Reality</span>
        </div>
        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Built where performance <span className="text-primary">is required.</span>
        </h2>
      </div>

      <div className="absolute top-[37vh] left-[6vw] right-[6vw] flex items-end justify-between gap-[3vw]">
        <div className="font-display text-[2.2vw] leading-[1.15] tracking-tight max-w-[44vw]">
          <span className="text-text">No room for inconsistency. </span>
          <span className="text-primary">No off days.</span>
        </div>
        <div className="font-body text-[1.05vw] text-text/80 max-w-[26vw] leading-snug text-right pb-[0.6vh]">
          <div className="text-text">When performance drops, you lose.</div>
          <div className="mt-[0.6vh] text-primary font-semibold">So it doesn't.</div>
        </div>
      </div>

      <div className="absolute top-[50vh] left-[6vw] right-[6vw] h-[22vh] grid grid-cols-2 gap-[2vw]">
        {arenas.map((a) => (
          <div key={a.label} className={`relative rounded-2xl ring-1 ${a.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${a.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${a.bar}`} />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.85vw] ${a.accent} font-semibold`}>{a.label}</div>
              <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text mt-[0.9vh]">{a.title}</div>
              <div className="mt-auto pt-[1vh] border-t border-text/10 font-body text-[0.95vw] text-text/70 leading-snug">
                {a.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-[75vh] left-[6vw] right-[6vw]">
        <div className="rounded-2xl ring-1 ring-primary/40 bg-bg-elev/40 px-[2vw] py-[1.6vh] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.10] via-accent/[0.06] to-primary/[0.10] pointer-events-none" />
          <div className="relative font-display text-[2.3vw] leading-[1.15] tracking-tight text-center">
            <span className="text-text">We built the system </span>
            <span className="text-primary">we wish we had.</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.8vh] flex items-center justify-between gap-[2vw] flex-wrap">
          <div className="font-body uppercase tracking-[0.28em] text-[1vw] text-primary font-semibold">
            AForce exists <span className="text-text">because of that reality.</span>
          </div>
          <div className="font-body text-[0.95vw] uppercase tracking-[0.28em] text-text/55">
            Brandon Burrell · Julius Burrell
          </div>
        </div>
      </div>
    </div>
  );
}
